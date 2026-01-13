defmodule Loka.Framework.Crafting.CraftingRegistry do
  @moduledoc """
  Loads and stores recipe definitions from YAML files.

  Recipes are stored as YAML files in `priv/world/recipes/`. This registry:
  - Reads all YAML files from the recipes directory
  - Parses each recipe definition
  - Stores recipes in ETS for fast concurrent lookup

  ## Directory Structure

      priv/world/recipes/
      ├── alchemy/         # Potions, elixirs
      ├── blacksmithing/   # Weapons, armor
      ├── cooking/         # Food, drinks
      └── general/         # Basic crafting

  ## YAML Format

      key: recipe_health_potion
      name: "Brew Health Potion"
      skill_required: alchemy
      skill_level: 2
      ingredients:
        - item: herb_healing
          quantity: 2
        - item: water_flask
          quantity: 1
      tools:
        - alchemy_kit
      output:
        - item: health_potion
          quantity: 1
      xp_reward:
        skill: alchemy
        amount: 10
      failure_chance: 0.1
      failure_output:
        - item: ruined_potion
          quantity: 1
      description: "Combine healing herbs with water..."
      craft_message: "You carefully combine the ingredients..."
      success_message: "Success! You've created a health potion."
      failure_message: "The mixture bubbles over and is ruined."

  ## Usage

      alias Loka.Framework.Crafting.CraftingRegistry

      {:ok, recipe} = CraftingRegistry.get("recipe_health_potion")
      recipes = CraftingRegistry.all()
      :ok = CraftingRegistry.reload()
  """

  use Loka.Framework.RegistryBase,
    table: :loka_recipes,
    path: "priv/world/recipes",
    item_module: Loka.Framework.Crafting.Recipe,
    item_name: "recipe",
    state_key: :recipes

  alias Loka.Framework.Crafting.Recipe

  @doc """
  Lists all recipes requiring a specific skill.
  """
  def by_skill(skill, server \\ __MODULE__) when is_binary(skill) do
    GenServer.call(server, {:by_skill, skill})
  end

  @doc """
  Lists all recipes for a specific station type.
  """
  def by_station(station_type, server \\ __MODULE__) when is_binary(station_type) do
    GenServer.call(server, {:by_station, station_type})
  end

  @doc """
  Lists all recipes with a specific tag.
  """
  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  @doc """
  Lists recipes that an entity can craft based on skill levels.
  """
  def available_for(game_state, server \\ __MODULE__) do
    GenServer.call(server, {:available_for, game_state})
  end

  @doc """
  Finds recipes that use a specific item as an ingredient.
  """
  def using_ingredient(item_key, server \\ __MODULE__) when is_binary(item_key) do
    GenServer.call(server, {:using_ingredient, item_key})
  end

  @doc """
  Finds recipes that produce a specific item.
  """
  def producing(item_key, server \\ __MODULE__) when is_binary(item_key) do
    GenServer.call(server, {:producing, item_key})
  end

  # Custom call handlers

  @doc false
  def handle_custom_call({:by_skill, skill}, _from, state) do
    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(&(&1.skill_required == skill))

    {:reply, recipes, state}
  end

  def handle_custom_call({:by_station, station_type}, _from, state) do
    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(&(&1.station_type == station_type))

    {:reply, recipes, state}
  end

  def handle_custom_call({:by_tag, tag}, _from, state) do
    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(&(tag in &1.tags))

    {:reply, recipes, state}
  end

  def handle_custom_call({:available_for, game_state}, _from, state) do
    skills = get_in(game_state.stats, ["skills"]) || get_in(game_state.stats, [:skills]) || %{}

    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(fn recipe ->
        meets_skill_requirements?(recipe, skills)
      end)

    {:reply, recipes, state}
  end

  def handle_custom_call({:using_ingredient, item_key}, _from, state) do
    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(fn recipe ->
        Enum.any?(recipe.ingredients, &(&1.item == item_key))
      end)

    {:reply, recipes, state}
  end

  def handle_custom_call({:producing, item_key}, _from, state) do
    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(fn recipe ->
        Enum.any?(recipe.output, &(&1.item == item_key))
      end)

    {:reply, recipes, state}
  end

  # Private helpers

  defp meets_skill_requirements?(%Recipe{skill_required: nil}, _skills), do: true

  defp meets_skill_requirements?(%Recipe{skill_required: skill, skill_level: level}, skills) do
    # Use safe lookup that handles both atom and string keys
    player_level =
      cond do
        is_atom(skill) ->
          Loka.Utils.MapHelpers.get_flexible(skills, skill, 0)

        is_binary(skill) ->
          # Try string key first, then try existing atom if available
          case Map.get(skills, skill) do
            nil ->
              case Loka.Utils.MapHelpers.safe_to_existing_atom(skill) do
                nil -> 0
                atom_key -> Map.get(skills, atom_key, 0)
              end

            value ->
              value
          end

        true ->
          0
      end

    player_level >= level
  end
end
