defmodule Exmud.Framework.Combat.Tactical do
  @moduledoc """
  Tactical combat features: action points, initiative, and combos.

  This module provides optional advanced features that can be integrated with
  the core `Exmud.Framework.Combat` module:

  ## Features

  ### Action Points (AP)
  - Each combatant gets a set number of AP per turn (default: 3)
  - Actions consume different amounts of AP
  - Multiple actions per turn possible if AP allows

  ### Initiative
  - Turn order determined by DEX stat
  - Higher DEX goes first
  - Random tiebreaker for equal DEX

  ### Combo System
  - Chaining specific abilities in sequence grants bonus effects
  - Tracks recent abilities for combo detection

  ## Combat State Structure

      %CombatState{
        combatants: [
          %{entity_id: "player123", ap: 3, initiative: 15},
          %{entity_id: "enemy456", ap: 3, initiative: 12}
        ],
        turn_order: ["player123", "enemy456"],
        current_turn: "player123",
        round: 1,
        combo_chain: []
      }

  ## Configuration

  Combat settings loaded from `priv/world/combat/config.yml`:

      combat:
        initiative: true
        action_points: 3
        action_costs:
          attack: 1
          ability: 2
          item: 1
          defend: 1
          flee: 2
        combo_system: true
        elemental_system: true
  """

  use GenServer
  require Logger

  alias Exmud.Utils.MapHelpers

  @config_table :exmud_combat_config

  # Default combat configuration
  @default_config %{
    initiative: true,
    action_points: 3,
    action_costs: %{
      attack: 1,
      ability: 2,
      item: 1,
      defend: 1,
      flee: 2
    },
    combo_system: true,
    elemental_system: true
  }

  # =============================================================================
  # Combat State Struct
  # =============================================================================

  defmodule CombatState do
    @moduledoc """
    Represents the state of an enhanced combat encounter.
    """
    defstruct [
      :id,
      combatants: [],
      turn_order: [],
      current_turn: nil,
      round: 1,
      combo_chain: [],
      log: []
    ]

    @type combatant :: %{
            entity_id: String.t(),
            name: String.t(),
            ap: non_neg_integer(),
            max_ap: non_neg_integer(),
            initiative: non_neg_integer()
          }

    @type t :: %__MODULE__{
            id: String.t() | nil,
            combatants: [combatant()],
            turn_order: [String.t()],
            current_turn: String.t() | nil,
            round: pos_integer(),
            combo_chain: [String.t()],
            log: [map()]
          }
  end

  # =============================================================================
  # Client API - GenServer
  # =============================================================================

  @doc """
  Starts the CombatEnhanced GenServer.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets the current combat configuration.
  """
  def get_config(server \\ __MODULE__) do
    GenServer.call(server, :get_config)
  end

  @doc """
  Reloads combat configuration from YAML.
  """
  def reload_config(server \\ __MODULE__) do
    GenServer.call(server, :reload_config)
  end

  # =============================================================================
  # Client API - Initiative
  # =============================================================================

  @doc """
  Calculates turn order based on initiative (DEX stat).

  Takes a list of combatants with their stats and returns them sorted by initiative.

  ## Examples

      combatants = [
        %{entity_id: "player1", stats: %{dex: 14}},
        %{entity_id: "enemy1", stats: %{dex: 10}},
        %{entity_id: "enemy2", stats: %{dex: 14}}
      ]
      sorted = CombatEnhanced.calculate_initiative(combatants)
      # => ["player1", "enemy2", "enemy1"] (player1/enemy2 tied, random order)
  """
  def calculate_initiative(combatants) do
    combatants
    |> Enum.map(fn combatant ->
      dex = get_dex(combatant)
      # Add random tiebreaker (0-99)
      initiative = dex * 100 + :rand.uniform(100)
      Map.put(combatant, :initiative, initiative)
    end)
    |> Enum.sort_by(& &1.initiative, :desc)
    |> Enum.map(& &1.entity_id)
  end

  defp get_dex(combatant) do
    stats = Map.get(combatant, :stats, %{})

    MapHelpers.get_flexible(stats, :dex, 10) ||
      MapHelpers.get_flexible(stats, :dexterity, 10) ||
      10
  end

  # =============================================================================
  # Client API - Action Points
  # =============================================================================

  @doc """
  Gets the AP cost for a specific action type.

  ## Examples

      CombatEnhanced.get_action_cost(:attack)
      # => 1

      CombatEnhanced.get_action_cost(:ability)
      # => 2
  """
  def get_action_cost(action_type, server \\ __MODULE__) do
    config = get_config(server)
    action_key = normalize_action(action_type)
    Map.get(config.action_costs, action_key, 1)
  end

  @doc """
  Checks if an entity has enough AP to perform an action.

  ## Examples

      CombatEnhanced.can_act?(%{ap: 2}, :attack)
      # => true

      CombatEnhanced.can_act?(%{ap: 1}, :ability)
      # => false
  """
  def can_act?(combatant, action_type, server \\ __MODULE__) do
    current_ap = Map.get(combatant, :ap, 0)
    cost = get_action_cost(action_type, server)
    current_ap >= cost
  end

  @doc """
  Consumes AP for an action. Returns updated combatant.

  ## Examples

      combatant = %{ap: 3}
      updated = CombatEnhanced.consume_ap(combatant, :attack)
      # => %{ap: 2}
  """
  def consume_ap(combatant, action_type, server \\ __MODULE__) do
    cost = get_action_cost(action_type, server)
    current_ap = Map.get(combatant, :ap, 0)
    Map.put(combatant, :ap, max(0, current_ap - cost))
  end

  @doc """
  Resets AP to maximum for a combatant (called at start of turn).
  """
  def reset_ap(combatant, server \\ __MODULE__) do
    config = get_config(server)
    max_ap = Map.get(combatant, :max_ap, config.action_points)
    Map.put(combatant, :ap, max_ap)
  end

  @doc """
  Returns the default max AP from config.
  """
  def default_max_ap(server \\ __MODULE__) do
    config = get_config(server)
    config.action_points
  end

  # =============================================================================
  # Client API - Combo System
  # =============================================================================

  @doc """
  Adds an ability to the combo chain.

  Maintains a rolling window of recent abilities for combo detection.
  """
  def add_to_combo_chain(combo_chain, ability_key, max_length \\ 5) do
    new_chain = combo_chain ++ [ability_key]

    if length(new_chain) > max_length do
      Enum.drop(new_chain, 1)
    else
      new_chain
    end
  end

  @doc """
  Checks if a combo sequence is present in the chain.

  ## Examples

      chain = ["fireball", "ice_shard", "lightning"]
      CombatEnhanced.check_combo(chain, ["fireball", "ice_shard"])
      # => true
  """
  def check_combo(combo_chain, required_sequence) do
    chain_length = length(combo_chain)
    sequence_length = length(required_sequence)

    if sequence_length > chain_length do
      false
    else
      # Check if sequence appears anywhere in chain
      Enum.any?(0..(chain_length - sequence_length), fn start_idx ->
        Enum.slice(combo_chain, start_idx, sequence_length) == required_sequence
      end)
    end
  end

  @doc """
  Clears the combo chain (called on turn end or failed action).
  """
  def clear_combo_chain(_combat_state) do
    []
  end

  # =============================================================================
  # Client API - Combat State Management
  # =============================================================================

  @doc """
  Creates a new enhanced combat state.

  ## Parameters
  - `combatants` - List of combatant maps with entity_id, name, stats

  ## Returns
  - `%CombatState{}` with initialized turn order and AP
  """
  def new_combat(combatants, server \\ __MODULE__) do
    config = get_config(server)

    # Initialize combatants with AP
    initialized =
      Enum.map(combatants, fn c ->
        dex = get_dex(c)

        %{
          entity_id: c.entity_id,
          name: Map.get(c, :name, "Unknown"),
          ap: config.action_points,
          max_ap: config.action_points,
          initiative: dex * 100 + :rand.uniform(100),
          stats: Map.get(c, :stats, %{}),
          health: Map.get(c, :health, %{current: 100, max: 100})
        }
      end)

    # Calculate turn order
    turn_order =
      initialized
      |> Enum.sort_by(& &1.initiative, :desc)
      |> Enum.map(& &1.entity_id)

    current_turn = List.first(turn_order)

    %CombatState{
      id: generate_combat_id(),
      combatants: initialized,
      turn_order: turn_order,
      current_turn: current_turn,
      round: 1,
      combo_chain: [],
      log: [%{text: "Combat begins!", type: :info, round: 0}]
    }
  end

  @doc """
  Advances to the next turn in combat.

  Resets AP for the next combatant and updates round if needed.
  """
  def next_turn(%CombatState{} = state, server \\ __MODULE__) do
    current_idx = Enum.find_index(state.turn_order, &(&1 == state.current_turn))
    next_idx = rem(current_idx + 1, length(state.turn_order))
    next_entity_id = Enum.at(state.turn_order, next_idx)

    # Check if we're starting a new round
    new_round = if next_idx == 0, do: state.round + 1, else: state.round

    # Reset AP for next combatant
    updated_combatants =
      Enum.map(state.combatants, fn c ->
        if c.entity_id == next_entity_id do
          reset_ap(c, server)
        else
          c
        end
      end)

    %{state | current_turn: next_entity_id, round: new_round, combatants: updated_combatants}
  end

  @doc """
  Gets a combatant from combat state by entity_id.
  """
  def get_combatant(%CombatState{combatants: combatants}, entity_id) do
    Enum.find(combatants, &(&1.entity_id == entity_id))
  end

  @doc """
  Updates a combatant in the combat state.
  """
  def update_combatant(%CombatState{} = state, entity_id, updates) do
    updated_combatants =
      Enum.map(state.combatants, fn c ->
        if c.entity_id == entity_id do
          Map.merge(c, updates)
        else
          c
        end
      end)

    %{state | combatants: updated_combatants}
  end

  @doc """
  Adds a log entry to the combat state.
  """
  def add_log(%CombatState{} = state, text, type \\ :info) do
    entry = %{text: text, type: type, round: state.round}
    %{state | log: state.log ++ [entry]}
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, "priv/world/combat/config.yml")

    # Create ETS table for config storage
    table = :ets.new(@config_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      config: @default_config
    }

    # Load from YAML or use defaults
    state = load_config(state)

    Logger.info("CombatEnhanced loaded configuration")

    {:ok, state}
  end

  @impl true
  def handle_call(:get_config, _from, state) do
    {:reply, state.config, state}
  end

  @impl true
  def handle_call(:reload_config, _from, state) do
    new_state = load_config(state)
    Logger.info("CombatEnhanced reloaded configuration")
    {:reply, :ok, new_state}
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp load_config(state) do
    full_path = resolve_path(state.path)

    config =
      if File.exists?(full_path) do
        case load_from_yaml(full_path) do
          {:ok, loaded} -> loaded
          {:error, _} -> @default_config
        end
      else
        @default_config
      end

    # Update ETS
    :ets.delete_all_objects(state.table)
    :ets.insert(state.table, {:config, config})

    %{state | config: config}
  end

  defp load_from_yaml(path) do
    with {:ok, content} <- File.read(path),
         {:ok, data} <- YamlElixir.read_from_string(content) do
      combat_data = MapHelpers.get_flexible(data, :combat, %{})

      config = %{
        initiative: MapHelpers.get_flexible(combat_data, :initiative, true),
        action_points: MapHelpers.get_flexible(combat_data, :action_points, 3),
        action_costs:
          parse_action_costs(MapHelpers.get_flexible(combat_data, :action_costs, %{})),
        combo_system: MapHelpers.get_flexible(combat_data, :combo_system, true),
        elemental_system: MapHelpers.get_flexible(combat_data, :elemental_system, true)
      }

      {:ok, config}
    end
  end

  defp parse_action_costs(costs) do
    default_costs = @default_config.action_costs

    Enum.reduce(costs, default_costs, fn {key, value}, acc ->
      atom_key = normalize_action(key)
      Map.put(acc, atom_key, value)
    end)
  end

  defp normalize_action(action) when is_atom(action), do: action

  defp normalize_action(action) when is_binary(action) do
    String.to_existing_atom(action)
  rescue
    ArgumentError -> String.to_atom(action)
  end

  defp resolve_path(path) do
    if Path.type(path) == :absolute do
      path
    else
      Path.join(File.cwd!(), path)
    end
  end

  defp generate_combat_id do
    "combat_" <> Base.encode16(:crypto.strong_rand_bytes(8), case: :lower)
  end
end
