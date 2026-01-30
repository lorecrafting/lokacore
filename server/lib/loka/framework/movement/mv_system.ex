defmodule Loka.Framework.Movement.MVSystem do
  @moduledoc """
  Movement Points (MV) system for travel costs and physical actions.

  MV is consumed by:
  - Room travel (5-25 based on terrain)
  - Fleeing combat (30 MV)
  - Some physical skills

  ## MV Formula

      MV = 100 + (CON × 2) + (DEX × 2)

  ## Regeneration

      10 + (DEX / 5) per tick (5 seconds)
      Halved in combat

  ## Terrain Costs

  | Terrain | Cost |
  |---------|------|
  | Road | 5 |
  | Normal | 10 |
  | Rough | 15 |
  | Difficult | 20 |
  | Climbing | 25 |
  | Swimming | 20 |

  ## Usage

      alias Loka.Framework.Movement.MVSystem

      # Check if can move to room
      MVSystem.can_move?(game_state, "forest_path")

      # Move to room (deducts MV)
      {:ok, state} = MVSystem.move(game_state, "forest_path")

      # Check MV cost for an exit
      cost = MVSystem.exit_cost(exit_data)

      # Regenerate MV (called each tick)
      {:ok, state} = MVSystem.regen_tick(game_state, in_combat: false)
  """

  alias Loka.Framework.Player.GameState
  alias Loka.Mechanics.CharacterResources
  alias Loka.Config.Balance
  alias Loka.Utils.MapHelpers

  # Default terrain costs (used when Balance config not loaded)
  @default_terrain_costs %{
    road: 5,
    normal: 10,
    path: 8,
    rough: 15,
    difficult: 20,
    climbing: 25,
    swimming: 20,
    water: 20,
    mountain: 25,
    forest: 12,
    swamp: 18,
    desert: 15,
    snow: 18
  }

  @default_terrain_cost 10
  @default_flee_cost 30
  @default_sprint_multiplier 2

  # =============================================================================
  # MV Queries
  # =============================================================================

  @doc """
  Gets current MV from game state.
  """
  @spec current_mv(GameState.t()) :: non_neg_integer()
  def current_mv(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :mv, 100)
  end

  @doc """
  Gets maximum MV from game state (calculated from stats).
  """
  @spec max_mv(GameState.t()) :: non_neg_integer()
  def max_mv(%GameState{stats: stats}) do
    player_stats = extract_stats(stats)
    level = MapHelpers.get_flexible(stats, :level, 1)
    CharacterResources.max_mv(player_stats, level)
  end

  @doc """
  Gets MV regeneration rate per tick.
  """
  @spec regen_rate(GameState.t()) :: non_neg_integer()
  def regen_rate(%GameState{stats: stats}) do
    player_stats = extract_stats(stats)
    CharacterResources.mv_regen_rate(player_stats)
  end

  @doc """
  Returns MV as a percentage (0-100).
  """
  @spec mv_percent(GameState.t()) :: non_neg_integer()
  def mv_percent(%GameState{} = game_state) do
    current = current_mv(game_state)
    max = max_mv(game_state)
    if max > 0, do: div(current * 100, max), else: 0
  end

  # =============================================================================
  # Movement Checks
  # =============================================================================

  @doc """
  Checks if player has enough MV to move through an exit.
  """
  @spec can_move?(GameState.t(), map()) :: boolean()
  def can_move?(%GameState{} = game_state, exit_data) do
    current_mv(game_state) >= exit_cost(exit_data)
  end

  @doc """
  Checks if player has enough MV to flee.
  """
  @spec can_flee?(GameState.t()) :: boolean()
  def can_flee?(%GameState{} = game_state) do
    current_mv(game_state) >= flee_cost()
  end

  @doc """
  Checks if player has enough MV for a skill.
  """
  @spec can_use_skill?(GameState.t(), non_neg_integer()) :: boolean()
  def can_use_skill?(%GameState{} = game_state, mv_cost) do
    current_mv(game_state) >= mv_cost
  end

  # =============================================================================
  # Cost Calculations
  # =============================================================================

  @doc """
  Calculates MV cost for an exit.

  Exit data can contain:
  - `:terrain` - Terrain type (atom or string)
  - `:mv_cost` - Explicit MV cost (overrides terrain)
  """
  @spec exit_cost(map()) :: non_neg_integer()
  def exit_cost(exit_data) when is_map(exit_data) do
    # Check for explicit cost first
    explicit_cost =
      MapHelpers.get_flexible(exit_data, :mv_cost, nil) ||
        MapHelpers.get_flexible(exit_data, :cost, nil)

    if explicit_cost do
      explicit_cost
    else
      # Calculate from terrain
      terrain = get_terrain(exit_data)
      terrain_cost(terrain)
    end
  end

  def exit_cost(_), do: @default_terrain_cost

  @doc """
  Returns the MV cost for a terrain type.
  """
  @spec terrain_cost(atom()) :: non_neg_integer()
  def terrain_cost(terrain) when is_atom(terrain) do
    # Try Balance config first, fall back to defaults
    case Balance.get(:movement, :terrain_costs, terrain, default: nil) do
      nil -> Map.get(@default_terrain_costs, terrain, default_cost())
      cost -> cost
    end
  end

  def terrain_cost(terrain) when is_binary(terrain) do
    terrain_atom =
      try do
        String.to_existing_atom(terrain)
      rescue
        ArgumentError -> :normal
      end

    terrain_cost(terrain_atom)
  end

  def terrain_cost(_), do: @default_terrain_cost

  @doc """
  Returns the MV cost for fleeing combat.
  """
  @spec flee_cost() :: non_neg_integer()
  def flee_cost do
    Balance.get(:movement, :flee_cost, default: @default_flee_cost)
  end

  @doc """
  Calculates sprint cost (2x normal terrain cost).
  """
  @spec sprint_cost(map()) :: non_neg_integer()
  def sprint_cost(exit_data) do
    multiplier = Balance.get(:movement, :sprint_multiplier, default: @default_sprint_multiplier)
    exit_cost(exit_data) * multiplier
  end

  # =============================================================================
  # MV Modification
  # =============================================================================

  @doc """
  Deducts MV for moving through an exit.

  Returns `{:ok, updated_state}` or `{:error, :insufficient_mv}`.
  """
  @spec move(GameState.t(), map()) :: {:ok, GameState.t()} | {:error, term()}
  def move(%GameState{} = game_state, exit_data) do
    cost = exit_cost(exit_data)
    spend(game_state, cost)
  end

  @doc """
  Deducts MV for fleeing combat.
  """
  @spec flee(GameState.t()) :: {:ok, GameState.t()} | {:error, term()}
  def flee(%GameState{} = game_state) do
    spend(game_state, flee_cost())
  end

  @doc """
  Deducts MV for a skill.
  """
  @spec use_skill(GameState.t(), non_neg_integer()) :: {:ok, GameState.t()} | {:error, term()}
  def use_skill(%GameState{} = game_state, mv_cost) do
    spend(game_state, mv_cost)
  end

  @doc """
  Spends MV.

  Returns `{:ok, updated_state}` or `{:error, :insufficient_mv}`.
  """
  @spec spend(GameState.t(), non_neg_integer()) :: {:ok, GameState.t()} | {:error, term()}
  def spend(%GameState{stats: stats} = game_state, amount) when amount >= 0 do
    current = current_mv(game_state)

    if current >= amount do
      new_mv = current - amount
      new_stats = Map.put(stats, :mv, new_mv)
      {:ok, %{game_state | stats: new_stats}}
    else
      {:error, {:insufficient_mv, amount, current}}
    end
  end

  @doc """
  Restores MV (up to max).
  """
  @spec restore(GameState.t(), non_neg_integer()) :: {:ok, GameState.t()}
  def restore(%GameState{stats: stats} = game_state, amount) when amount >= 0 do
    current = current_mv(game_state)
    max = max_mv(game_state)
    new_mv = min(current + amount, max)
    new_stats = Map.put(stats, :mv, new_mv)
    {:ok, %{game_state | stats: new_stats}}
  end

  @doc """
  Sets MV to max.
  """
  @spec restore_full(GameState.t()) :: {:ok, GameState.t()}
  def restore_full(%GameState{stats: stats} = game_state) do
    max = max_mv(game_state)
    new_stats = Map.put(stats, :mv, max)
    {:ok, %{game_state | stats: new_stats}}
  end

  # =============================================================================
  # Regeneration
  # =============================================================================

  @doc """
  Applies MV regeneration for one tick.

  ## Options

  - `:in_combat` - If true, regen is halved (default: false)
  - `:resting` - If true, regen is doubled (default: false)
  """
  @spec regen_tick(GameState.t(), keyword()) :: {:ok, GameState.t()}
  def regen_tick(%GameState{} = game_state, opts \\ []) do
    in_combat = Keyword.get(opts, :in_combat, false)
    resting = Keyword.get(opts, :resting, false)

    base_regen = regen_rate(game_state)

    modified_regen =
      cond do
        resting -> base_regen * 2
        in_combat -> div(base_regen, 2)
        true -> base_regen
      end

    restore(game_state, modified_regen)
  end

  # =============================================================================
  # Display
  # =============================================================================

  @doc """
  Returns a map with MV info for display.
  """
  @spec info(GameState.t()) :: map()
  def info(%GameState{} = game_state) do
    %{
      current: current_mv(game_state),
      max: max_mv(game_state),
      percent: mv_percent(game_state),
      regen_rate: regen_rate(game_state)
    }
  end

  @doc """
  Returns terrain display name.
  """
  @spec terrain_name(atom()) :: String.t()
  def terrain_name(:road), do: "Road"
  def terrain_name(:normal), do: "Normal"
  def terrain_name(:path), do: "Path"
  def terrain_name(:rough), do: "Rough"
  def terrain_name(:difficult), do: "Difficult"
  def terrain_name(:climbing), do: "Climbing"
  def terrain_name(:swimming), do: "Swimming"
  def terrain_name(:water), do: "Water"
  def terrain_name(:mountain), do: "Mountain"
  def terrain_name(:forest), do: "Forest"
  def terrain_name(:swamp), do: "Swamp"
  def terrain_name(:desert), do: "Desert"
  def terrain_name(:snow), do: "Snow"
  def terrain_name(_), do: "Unknown"

  # =============================================================================
  # Constants
  # =============================================================================

  @doc "Returns all terrain types with their costs."
  @spec terrain_costs() :: %{atom() => non_neg_integer()}
  def terrain_costs do
    # Merge Balance config with defaults
    Balance.get(:movement, :terrain_costs, default: @default_terrain_costs)
  end

  @doc "Returns the default terrain cost (10)."
  @spec default_cost() :: non_neg_integer()
  def default_cost do
    Balance.get(:movement, :default_cost, default: @default_terrain_cost)
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp extract_stats(stats) do
    %{
      str: MapHelpers.get_flexible(stats, :str, 10),
      dex: MapHelpers.get_flexible(stats, :dex, 10),
      con: MapHelpers.get_flexible(stats, :con, 10),
      int: MapHelpers.get_flexible(stats, :int, 10),
      per: MapHelpers.get_flexible(stats, :per, 10),
      spi: MapHelpers.get_flexible(stats, :spi, 10)
    }
  end

  defp get_terrain(exit_data) do
    terrain = MapHelpers.get_flexible(exit_data, :terrain, "normal")

    case terrain do
      t when is_atom(t) ->
        t

      t when is_binary(t) ->
        try do
          String.to_existing_atom(t)
        rescue
          ArgumentError -> :normal
        end

      _ ->
        :normal
    end
  end
end
