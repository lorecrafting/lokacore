defmodule Loka.Framework.Abilities do
  @moduledoc """
  Ability execution framework using Timer for cooldowns and Cost for resource management.

  Abilities are actions that have:
  - Resource costs (mana, stamina, etc.) - managed by Cost mechanic
  - Cooldowns - managed by Timer primitive
  - Effects - executed when ability is used

  ## Usage

      alias Loka.Framework.Abilities

      # Check if ability can be used
      case Abilities.can_use?(game_state, "power_strike") do
        :ok -> "Ready to use"
        {:error, :on_cooldown, remaining_ms} -> "Cooldown: \#{remaining_ms}ms"
        {:error, :insufficient_resource, resource, needed, have} -> "Need \#{needed} \#{resource}"
      end

      # Execute ability
      {:ok, game_state, result} = Abilities.execute(game_state, "power_strike", target)

  ## Cooldown Management

  Cooldowns are stored in game_state.stats.cooldowns as Timer structs:

      %{
        "power_strike" => %Timer{started_at: ..., duration_ms: 5000},
        "flee" => %Timer{started_at: ..., duration_ms: 3000}
      }

  ## Balance Config

  Ability definitions come from Balance config (priv/config/balance.yml):

      abilities:
        power_strike:
          stamina_cost: 20
          cooldown_ms: 5000
          damage_multiplier: 1.5
  """

  alias Loka.Config.Balance
  alias Loka.Framework.Player.GameState
  alias Loka.Mechanics.Cost
  alias Loka.Primitives.ResourcePool
  alias Loka.Primitives.Timer
  alias Loka.Utils.MapHelpers

  @type ability_result :: %{
          ability: String.t(),
          success: boolean(),
          costs_paid: map(),
          cooldown_started: boolean(),
          effects: map(),
          message: String.t()
        }

  # Default ability values if not in Balance config
  @default_global_cooldown_ms 1000

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Checks if an ability can be used.

  Returns `:ok` or one of:
  - `{:error, :on_cooldown, remaining_ms}`
  - `{:error, :on_global_cooldown, remaining_ms}`
  - `{:error, :insufficient_resource, resource_type, needed, have}`
  - `{:error, :unknown_ability}`
  """
  def can_use?(%GameState{} = game_state, ability_key) do
    with {:ok, ability_def} <- get_ability_definition(ability_key),
         :ok <- check_global_cooldown(game_state),
         :ok <- check_ability_cooldown(game_state, ability_key, ability_def),
         :ok <- check_ability_costs(game_state, ability_def) do
      :ok
    end
  end

  @doc """
  Executes an ability, paying costs and starting cooldowns.

  Returns `{:ok, updated_game_state, result}` or `{:error, reason}`.
  """
  def execute(%GameState{} = game_state, ability_key, _target \\ nil) do
    with {:ok, ability_def} <- get_ability_definition(ability_key),
         :ok <- can_use?(game_state, ability_key),
         {:ok, state_after_costs, cost_audit} <- pay_ability_costs(game_state, ability_def),
         {:ok, state_with_cooldown} <-
           start_cooldowns(state_after_costs, ability_key, ability_def) do
      result = %{
        ability: ability_key,
        success: true,
        costs_paid: cost_audit,
        cooldown_started: true,
        effects: ability_def,
        message: "Used #{ability_key}!"
      }

      {:ok, state_with_cooldown, result}
    end
  end

  @doc """
  Gets the remaining cooldown for an ability in milliseconds.

  Returns 0 if ability is ready.
  """
  def cooldown_remaining(%GameState{} = game_state, ability_key) do
    cooldowns = get_cooldowns(game_state)

    case Map.get(cooldowns, ability_key) do
      nil -> 0
      timer -> Timer.remaining_ms(timer)
    end
  end

  @doc """
  Gets the remaining global cooldown in milliseconds.
  """
  def global_cooldown_remaining(%GameState{} = game_state) do
    cooldowns = get_cooldowns(game_state)

    case Map.get(cooldowns, :global) do
      nil -> 0
      timer -> Timer.remaining_ms(timer)
    end
  end

  @doc """
  Lists all abilities currently on cooldown with their remaining times.
  """
  def list_cooldowns(%GameState{} = game_state) do
    cooldowns = get_cooldowns(game_state)

    cooldowns
    |> Enum.map(fn {key, timer} ->
      remaining = Timer.remaining_ms(timer)
      {key, remaining}
    end)
    |> Enum.filter(fn {_key, remaining} -> remaining > 0 end)
    |> Enum.into(%{})
  end

  @doc """
  Clears all cooldowns (for testing or admin use).
  """
  def clear_cooldowns(%GameState{} = game_state) do
    stats = game_state.stats || %{}
    new_stats = Map.put(stats, :cooldowns, %{})
    %{game_state | stats: new_stats}
  end

  @doc """
  Gets the definition for an ability from Balance config.
  """
  def get_ability_definition(ability_key) when is_binary(ability_key) do
    get_ability_definition(String.to_atom(ability_key))
  end

  def get_ability_definition(ability_key) when is_atom(ability_key) do
    case Balance.get(:abilities, ability_key) do
      nil -> {:error, :unknown_ability}
      def_map when is_map(def_map) -> {:ok, def_map}
      _ -> {:error, :unknown_ability}
    end
  end

  @doc """
  Gets the costs for an ability.

  Returns a map of resource_type => amount.
  """
  def get_ability_costs(ability_def) when is_map(ability_def) do
    %{}
    |> maybe_add_cost(ability_def, :mana_cost, :mana)
    |> maybe_add_cost(ability_def, :stamina_cost, :stamina)
    |> maybe_add_cost(ability_def, :health_cost, :health)
  end

  defp maybe_add_cost(costs, ability_def, cost_key, resource_key) do
    case MapHelpers.get_flexible(ability_def, cost_key, nil) do
      nil -> costs
      0 -> costs
      amount when is_number(amount) -> Map.put(costs, resource_key, amount)
    end
  end

  # =============================================================================
  # Validation
  # =============================================================================

  defp check_global_cooldown(%GameState{} = game_state) do
    remaining = global_cooldown_remaining(game_state)

    if remaining > 0 do
      {:error, :on_global_cooldown, remaining}
    else
      :ok
    end
  end

  defp check_ability_cooldown(%GameState{} = game_state, ability_key, _ability_def) do
    remaining = cooldown_remaining(game_state, ability_key)

    if remaining > 0 do
      {:error, :on_cooldown, remaining}
    else
      :ok
    end
  end

  defp check_ability_costs(%GameState{} = game_state, ability_def) do
    costs = get_ability_costs(ability_def)

    # Convert game state resources to ResourcePool format
    resources = get_resource_pools(game_state)

    # Check each cost
    Enum.find_value(costs, :ok, fn {resource_key, needed} ->
      pool = Map.get(resources, resource_key, ResourcePool.new(0))

      if Cost.can_afford?(pool, needed) do
        nil
      else
        {:error, :insufficient_resource, resource_key, needed, pool.current}
      end
    end)
  end

  # =============================================================================
  # Cost Payment
  # =============================================================================

  defp pay_ability_costs(%GameState{} = game_state, ability_def) do
    costs = get_ability_costs(ability_def)

    if map_size(costs) == 0 do
      {:ok, game_state, %{}}
    else
      resources = get_resource_pools(game_state)

      case Cost.pay_all(resources, costs) do
        {:ok, new_resources, audit} ->
          new_state = put_resource_pools(game_state, new_resources)
          {:ok, new_state, audit}

        {:error, {:insufficient, missing}} ->
          [{resource, amount} | _] = Enum.to_list(missing)
          pool = Map.get(resources, resource, ResourcePool.new(0))
          {:error, :insufficient_resource, resource, amount, pool.current}
      end
    end
  end

  # =============================================================================
  # Cooldown Management
  # =============================================================================

  defp start_cooldowns(%GameState{} = game_state, ability_key, ability_def) do
    cooldowns = get_cooldowns(game_state)

    # Start ability cooldown
    ability_cd_ms = MapHelpers.get_flexible(ability_def, :cooldown_ms, 0)

    cooldowns =
      if ability_cd_ms > 0 do
        Map.put(cooldowns, ability_key, Timer.new(ability_cd_ms))
      else
        cooldowns
      end

    # Start global cooldown
    global_cd_ms =
      Balance.get(:abilities, :global_cooldown_ms, default: @default_global_cooldown_ms)

    cooldowns =
      if global_cd_ms > 0 do
        Map.put(cooldowns, :global, Timer.new(global_cd_ms))
      else
        cooldowns
      end

    {:ok, put_cooldowns(game_state, cooldowns)}
  end

  # =============================================================================
  # Game State Helpers
  # =============================================================================

  defp get_cooldowns(%GameState{stats: stats}) do
    cooldowns_data = MapHelpers.get_flexible(stats || %{}, :cooldowns, %{})

    # Convert stored maps back to Timer structs
    Enum.map(cooldowns_data, fn
      {key, %Timer{} = timer} -> {key, timer}
      {key, map} when is_map(map) -> {key, Timer.from_map(map)}
      {key, _other} -> {key, Timer.expired()}
    end)
    |> Enum.into(%{})
  end

  defp put_cooldowns(%GameState{stats: stats} = game_state, cooldowns) do
    new_stats = Map.put(stats || %{}, :cooldowns, cooldowns)
    %{game_state | stats: new_stats}
  end

  defp get_resource_pools(%GameState{} = game_state) do
    resources = game_state.resources || %{}

    %{
      mana: to_resource_pool(MapHelpers.get_flexible(resources, :mana, nil)),
      stamina: to_resource_pool(MapHelpers.get_flexible(resources, :stamina, nil)),
      health: to_resource_pool(GameState.get_health(game_state))
    }
  end

  defp to_resource_pool(nil), do: ResourcePool.new(0)

  defp to_resource_pool(%ResourcePool{} = pool), do: pool

  defp to_resource_pool(map) when is_map(map) do
    current = MapHelpers.get_flexible(map, :current, 0)
    max = MapHelpers.get_flexible(map, :max, current)
    ResourcePool.new(current: current, max: max)
  end

  defp to_resource_pool(value) when is_number(value) do
    ResourcePool.new(current: value, max: value)
  end

  defp put_resource_pools(%GameState{} = game_state, resource_pools) do
    resources = game_state.resources || %{}

    new_resources =
      Enum.reduce(resource_pools, resources, fn {key, pool}, acc ->
        Map.put(acc, key, %{current: pool.current, max: pool.max})
      end)

    # Handle health separately since it's special
    health_pool = Map.get(resource_pools, :health)

    new_health =
      if health_pool, do: %{current: health_pool.current, max: health_pool.max}, else: nil

    game_state = %{game_state | resources: new_resources}

    if new_health do
      %{game_state | health: new_health}
    else
      game_state
    end
  end
end
