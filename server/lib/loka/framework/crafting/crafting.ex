defmodule Loka.Framework.Crafting do
  @moduledoc """
  Core crafting execution logic.

  Handles the crafting process: checking requirements, consuming ingredients,
  determining success/failure, and producing output items.

  ## Usage

      alias Loka.Framework.Crafting
      alias Loka.Framework.Crafting.CraftingRegistry

      # Check if player can craft a recipe
      case Crafting.can_craft?(game_state, "recipe_health_potion") do
        :ok -> # Can craft
        {:error, reason} -> # Handle missing requirements
      end

      # Execute crafting
      case Crafting.craft(game_state, "recipe_health_potion") do
        {:ok, result} -> # result contains :items, :message, :xp
        {:error, reason} -> # Handle failure
      end

      # Get missing ingredients
      missing = Crafting.get_missing_ingredients(game_state, "recipe_health_potion")
  """

  require Logger

  alias Loka.Framework.Crafting.{Recipe, CraftingRegistry, CraftingStation}
  alias Loka.Framework.Player.GameState
  alias Loka.Mechanics.Cost
  alias Loka.Primitives.ResourcePool
  alias Loka.Utils.MapHelpers

  @type craft_result :: %{
          success: boolean(),
          items: [%{item: String.t(), quantity: pos_integer()}],
          message: String.t(),
          xp: map() | nil
        }

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Lists all recipes the entity can currently craft.

  Filters based on skill levels and available ingredients.
  """
  def list_available_recipes(%GameState{} = game_state) do
    CraftingRegistry.available_for(game_state)
  end

  @doc """
  Lists recipes available at a specific crafting station in a room.
  """
  def list_station_recipes(room_entity) do
    case CraftingStation.get_station(room_entity) do
      nil -> []
      station -> CraftingRegistry.by_station(station.type)
    end
  end

  @doc """
  Checks if an entity can craft a specific recipe.

  Returns `:ok` or `{:error, reason}`.

  ## Checks Performed

  1. Recipe exists
  2. Skill requirements met
  3. All ingredients available
  4. Required tools in inventory
  5. At correct crafting station (if required)
  """
  def can_craft?(%GameState{} = game_state, recipe_key, opts \\ []) do
    room_entity = Keyword.get(opts, :room, nil)

    Logger.debug("[CRAFTING] Checking can_craft: recipe=#{recipe_key}")

    with {:ok, recipe} <- get_recipe(recipe_key),
         :ok <- check_skill_requirements(game_state, recipe),
         :ok <- check_ingredients(game_state, recipe),
         :ok <- check_tools(game_state, recipe),
         :ok <- check_resource_costs(game_state, recipe),
         :ok <- check_station(room_entity, recipe) do
      Logger.debug("[CRAFTING] Can craft: recipe=#{recipe_key} - all requirements met")
      :ok
    else
      {:error, reason} = error ->
        Logger.debug("[CRAFTING] Cannot craft: recipe=#{recipe_key} reason=#{inspect(reason)}")
        error
    end
  end

  @doc """
  Executes crafting, consuming ingredients and producing output.

  Returns `{:ok, updated_state, result}` or `{:error, reason}`.

  The result contains:
  - `:success` - Whether crafting succeeded
  - `:items` - List of items produced
  - `:message` - Success or failure message
  - `:xp` - XP reward (nil on failure)
  - `:consumed` - Ingredients that were consumed

  Ingredients are consumed atomically - all or nothing.
  State mutations are in-memory; caller handles persistence.
  """
  def craft(%GameState{} = game_state, recipe_key, opts \\ []) do
    room_entity = Keyword.get(opts, :room, nil)
    station_bonus = get_station_bonus(room_entity)

    Logger.info("[CRAFTING] Craft attempt: recipe=#{recipe_key} station_bonus=#{station_bonus}")

    with {:ok, recipe} <- get_recipe(recipe_key),
         :ok <- can_craft?(game_state, recipe_key, opts),
         {:ok, state_after_consume} <- do_consume_ingredients(game_state, recipe.ingredients),
         {:ok, state_after_costs} <- do_pay_resource_costs(state_after_consume, recipe) do
      # Determine success/failure
      success? = determine_success(recipe, station_bonus)

      # Build result based on success
      result =
        if success? do
          build_success_result(recipe)
        else
          build_failure_result(recipe)
        end

      # Update quest progress if craft was successful
      {final_state, quest_events} =
        if success? do
          alias Loka.Framework.Quest.Listeners
          Listeners.check_craft(state_after_costs, recipe_key)
        else
          {state_after_costs, []}
        end

      # Merge quest events into result
      result_with_quest =
        if Enum.any?(quest_events) do
          Map.put(result, :quest_events, quest_events)
        else
          result
        end

      if success? do
        Logger.info(
          "[CRAFTING] Craft succeeded: recipe=#{recipe_key} items=#{inspect(result.items)} xp=#{inspect(result.xp)}"
        )
      else
        Logger.info(
          "[CRAFTING] Craft failed: recipe=#{recipe_key} failure_chance=#{recipe.failure_chance}"
        )
      end

      {:ok, final_state, result_with_quest}
    else
      {:error, reason} = error ->
        Logger.warning("[CRAFTING] Craft aborted: recipe=#{recipe_key} reason=#{inspect(reason)}")
        error
    end
  end

  @doc """
  Returns a list of missing ingredients for a recipe.

  Each item in the list contains:
  - `:item` - Item key
  - `:required` - Amount needed
  - `:have` - Amount in inventory
  - `:missing` - Amount still needed
  """
  def get_missing_ingredients(%GameState{} = game_state, recipe_key) do
    case get_recipe(recipe_key) do
      {:ok, recipe} ->
        Enum.map(recipe.ingredients, fn %{item: item_key, quantity: required} ->
          have = count_item(game_state, item_key)
          missing = max(0, required - have)

          %{
            item: item_key,
            required: required,
            have: have,
            missing: missing
          }
        end)
        |> Enum.filter(&(&1.missing > 0))

      {:error, _} ->
        []
    end
  end

  @doc """
  Returns a list of missing tools for a recipe.
  """
  def get_missing_tools(%GameState{} = game_state, recipe_key) do
    case get_recipe(recipe_key) do
      {:ok, recipe} ->
        Enum.reject(recipe.tools, fn tool_key ->
          has_item?(game_state, tool_key)
        end)

      {:error, _} ->
        []
    end
  end

  @doc """
  Consumes ingredients for a recipe from the inventory.

  Returns `{:ok, updated_state}` or `{:error, reason}`.
  """
  def consume_ingredients(%GameState{} = game_state, recipe_key) do
    case get_recipe(recipe_key) do
      {:ok, recipe} ->
        do_consume_ingredients(game_state, recipe.ingredients)

      {:error, reason} ->
        {:error, reason}
    end
  end

  # =============================================================================
  # Validation Checks
  # =============================================================================

  defp get_recipe(recipe_key) do
    CraftingRegistry.get(recipe_key)
  end

  defp check_skill_requirements(%GameState{} = game_state, %Recipe{} = recipe) do
    if Recipe.requires_skill?(recipe) do
      skills = get_skills(game_state)
      player_level = Map.get(skills, recipe.skill_required, 0)

      if player_level >= recipe.skill_level do
        :ok
      else
        {:error, {:skill_required, recipe.skill_required, recipe.skill_level, player_level}}
      end
    else
      :ok
    end
  end

  defp check_ingredients(%GameState{} = game_state, %Recipe{ingredients: ingredients}) do
    missing =
      Enum.filter(ingredients, fn %{item: item_key, quantity: required} ->
        count_item(game_state, item_key) < required
      end)

    if Enum.empty?(missing) do
      :ok
    else
      {:error, {:missing_ingredients, missing}}
    end
  end

  defp check_tools(%GameState{} = game_state, %Recipe{tools: tools}) do
    missing = Enum.reject(tools, &has_item?(game_state, &1))

    if Enum.empty?(missing) do
      :ok
    else
      {:error, {:missing_tools, missing}}
    end
  end

  defp check_station(_room_entity, %Recipe{station_type: nil}), do: :ok

  defp check_station(nil, %Recipe{station_type: station_type}) do
    {:error, {:station_required, station_type}}
  end

  defp check_station(room_entity, %Recipe{station_type: station_type}) do
    case CraftingStation.get_station(room_entity) do
      nil ->
        {:error, {:station_required, station_type}}

      station ->
        if station.type == station_type do
          :ok
        else
          {:error, {:wrong_station, station_type, station.type}}
        end
    end
  end

  defp check_resource_costs(%GameState{} = _game_state, %Recipe{resource_costs: costs})
       when map_size(costs) == 0 do
    :ok
  end

  defp check_resource_costs(%GameState{} = game_state, %Recipe{resource_costs: costs}) do
    # Build resource pools from game_state.resources
    resource_pools = build_resource_pools(game_state)

    # Use Cost.can_afford_all? to check
    if Cost.can_afford_all?(resource_pools, costs) do
      :ok
    else
      missing = Cost.missing_resources(resource_pools, costs)
      {:error, {:insufficient_resources, missing}}
    end
  end

  defp do_pay_resource_costs(%GameState{} = game_state, %Recipe{resource_costs: costs})
       when map_size(costs) == 0 do
    {:ok, game_state}
  end

  defp do_pay_resource_costs(%GameState{} = game_state, %Recipe{resource_costs: costs}) do
    # Build resource pools from game_state.resources
    resource_pools = build_resource_pools(game_state)

    # Use Cost.pay_all to pay costs atomically
    case Cost.pay_all(resource_pools, costs) do
      {:ok, new_pools, _audit} ->
        # Update game_state with new resource values
        new_resources = pools_to_resources(new_pools, game_state.resources || %{})
        {:ok, %{game_state | resources: new_resources}}

      {:error, {:insufficient, missing}} ->
        {:error, {:insufficient_resources, missing}}
    end
  end

  defp build_resource_pools(%GameState{resources: nil}), do: %{}

  defp build_resource_pools(%GameState{resources: resources}) do
    Map.new(resources, fn {key, value} ->
      atom_key = normalize_resource_key(key)

      pool =
        cond do
          is_map(value) ->
            current = Map.get(value, :current) || Map.get(value, "current") || 0
            max = Map.get(value, :max) || Map.get(value, "max") || current
            ResourcePool.new(current: current, max: max)

          is_number(value) ->
            ResourcePool.new(current: value, max: value)

          true ->
            ResourcePool.new(current: 0, max: 0)
        end

      {atom_key, pool}
    end)
  end

  defp pools_to_resources(pools, original_resources) do
    Map.new(pools, fn {key, pool} ->
      # Preserve original key format
      original_key =
        Enum.find(Map.keys(original_resources), fn k ->
          normalize_resource_key(k) == key
        end) || key

      original_value = Map.get(original_resources, original_key)

      new_value =
        cond do
          is_map(original_value) and Map.has_key?(original_value, "current") ->
            %{"current" => pool.current, "max" => pool.max}

          is_map(original_value) ->
            %{current: pool.current, max: pool.max}

          true ->
            pool.current
        end

      {original_key, new_value}
    end)
  end

  defp normalize_resource_key(key) when is_atom(key), do: key
  defp normalize_resource_key(key) when is_binary(key), do: String.to_atom(key)

  # =============================================================================
  # Crafting Execution
  # =============================================================================

  defp determine_success(%Recipe{failure_chance: chance}, station_bonus) do
    adjusted_chance = max(0, chance - station_bonus)
    :rand.uniform() > adjusted_chance
  end

  defp get_station_bonus(nil), do: 0.0

  defp get_station_bonus(room_entity) do
    case CraftingStation.get_station(room_entity) do
      nil -> 0.0
      station -> station.bonus
    end
  end

  defp build_success_result(%Recipe{} = recipe) do
    items = generate_output_items(recipe.output)

    %{
      success: true,
      items: items,
      message: recipe.success_message,
      xp: recipe.xp_reward,
      consumed: recipe.ingredients
    }
  end

  defp build_failure_result(%Recipe{} = recipe) do
    items = generate_output_items(recipe.failure_output)

    %{
      success: false,
      items: items,
      message: recipe.failure_message,
      xp: nil,
      consumed: recipe.ingredients
    }
  end

  defp generate_output_items(output_list) do
    output_list
    |> Enum.filter(fn %{chance: chance} ->
      :rand.uniform() <= chance
    end)
    |> Enum.map(fn %{item: item, quantity: quantity} ->
      %{
        item: item,
        quantity: Recipe.calculate_quantity(quantity)
      }
    end)
  end

  # =============================================================================
  # Inventory Helpers
  # =============================================================================

  defp get_skills(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :skills, %{})
  end

  defp count_item(%GameState{inventory: inventory}, item_key) do
    alias Loka.Engine.Entities

    # Count occurrences of items with matching prototype key
    # Supports both entity IDs (real gameplay) and prototype keys (tests/simple items)
    Enum.count(inventory, fn item_id ->
      case Entities.get_entity(item_id) do
        nil ->
          # Fallback: check if item_id is the prototype key directly
          item_id == item_key

        entity ->
          entity.key == item_key
      end
    end)
  end

  defp has_item?(%GameState{inventory: inventory}, item_key) do
    alias Loka.Engine.Entities

    # Supports both entity IDs (real gameplay) and prototype keys (tests/simple items)
    Enum.any?(inventory, fn item_id ->
      case Entities.get_entity(item_id) do
        nil ->
          # Fallback: check if item_id is the prototype key directly
          item_id == item_key

        entity ->
          entity.key == item_key
      end
    end)
  end

  defp do_consume_ingredients(game_state, ingredients) do
    Enum.reduce_while(ingredients, {:ok, game_state}, fn %{item: item_key, quantity: qty},
                                                         {:ok, state} ->
      case remove_items(state, item_key, qty) do
        {:ok, new_state} -> {:cont, {:ok, new_state}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp remove_items(game_state, item_key, quantity) do
    alias Loka.Engine.Entities

    # Find item IDs that match the prototype key
    # Supports both entity IDs (real gameplay) and prototype keys (tests/simple items)
    {to_remove, remaining} =
      game_state.inventory
      |> Enum.split_with(fn item_id ->
        case Entities.get_entity(item_id) do
          nil ->
            # Fallback: check if item_id is the prototype key directly
            item_id == item_key

          entity ->
            entity.key == item_key
        end
      end)

    if length(to_remove) >= quantity do
      {_removed, kept} = Enum.split(to_remove, quantity)
      new_inventory = kept ++ remaining
      # Return updated struct directly (caller handles persistence)
      {:ok, %{game_state | inventory: new_inventory}}
    else
      {:error, {:insufficient_items, item_key, quantity, length(to_remove)}}
    end
  end
end
