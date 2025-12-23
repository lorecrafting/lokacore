defmodule Exmud.Framework.Faction do
  @moduledoc """
  Faction and reputation system.

  Tracks player standing with various factions, affecting:
  - NPC reactions and dialogue
  - Shop prices (discounts/premiums)
  - Quest availability
  - Area access

  ## Faction Configuration (YAML)

      key: merchants_guild
      name: "Merchants' Guild"
      description: "A powerful trading consortium."
      allies:
        - craftsmen_union
      enemies:
        - thieves_guild
      tiers:
        - name: Hostile
          min: -1000
          max: -500
          effects:
            shop_multiplier: 1.5
            can_enter: false
        - name: Unfriendly
          min: -499
          max: -100
        - name: Neutral
          min: -99
          max: 99
        - name: Friendly
          min: 100
          max: 499
          effects:
            shop_multiplier: 0.9
        - name: Honored
          min: 500
          max: 1000
          effects:
            shop_multiplier: 0.75

  ## Reputation Values

  - -1000 to -500: Hostile (KOS, no services)
  - -499 to -100: Unfriendly
  - -99 to 99: Neutral
  - 100 to 499: Friendly
  - 500 to 1000: Honored/Exalted
  """

  use GenServer
  require Logger

  alias Exmud.Framework.Player.GameState
  alias Exmud.Utils.MapHelpers

  @faction_table :exmud_factions
  @default_path "priv/world/factions"

  @default_neutral 0
  @min_reputation -1000
  @max_reputation 1000

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Gets a player's reputation with a faction.
  """
  def get_reputation(%GameState{stats: stats}, faction_key) do
    factions = MapHelpers.get_flexible(stats, :factions, %{})
    Map.get(factions, faction_key, @default_neutral)
  end

  @doc """
  Gets the reputation tier name for a value.
  """
  def get_tier(faction_key, reputation, server \\ __MODULE__) do
    case get(faction_key, server) do
      {:ok, faction} ->
        tier = Enum.find(faction.tiers, fn t ->
          reputation >= t.min and reputation <= t.max
        end)
        if tier, do: tier.name, else: "Unknown"

      {:error, _} ->
        "Unknown"
    end
  end

  @doc """
  Modifies a player's reputation with a faction.

  Also affects allied/enemy factions proportionally.
  """
  def modify_reputation(%GameState{} = game_state, faction_key, amount, server \\ __MODULE__) do
    case get(faction_key, server) do
      {:ok, faction} ->
        game_state
        |> do_modify_reputation(faction_key, amount)
        |> apply_allied_changes(faction.allies, amount, server)
        |> apply_enemy_changes(faction.enemies, amount, server)

      {:error, _} ->
        do_modify_reputation(game_state, faction_key, amount)
    end
  end

  @doc """
  Gets the shop price multiplier based on faction standing.
  """
  def get_shop_multiplier(%GameState{} = game_state, faction_key, server \\ __MODULE__) do
    reputation = get_reputation(game_state, faction_key)

    case get(faction_key, server) do
      {:ok, faction} ->
        tier = Enum.find(faction.tiers, fn t ->
          reputation >= t.min and reputation <= t.max
        end)

        if tier do
          Map.get(tier.effects || %{}, :shop_multiplier, 1.0)
        else
          1.0
        end

      {:error, _} ->
        1.0
    end
  end

  @doc """
  Checks if player can enter faction-controlled areas.
  """
  def can_enter?(%GameState{} = game_state, faction_key, server \\ __MODULE__) do
    reputation = get_reputation(game_state, faction_key)

    case get(faction_key, server) do
      {:ok, faction} ->
        tier = Enum.find(faction.tiers, fn t ->
          reputation >= t.min and reputation <= t.max
        end)

        if tier do
          Map.get(tier.effects || %{}, :can_enter, true)
        else
          true
        end

      {:error, _} ->
        true
    end
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @default_path)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    table = :ets.new(@faction_table, [:set, :protected, read_concurrency: true])
    state = %{table: table, path: path, factions: %{}}

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info("Faction loaded #{map_size(new_state.factions)} factions")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("Faction started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result = case Map.get(state.factions, key) do
      nil -> {:error, :not_found}
      faction -> {:ok, faction}
    end
    {:reply, result, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.factions), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info("Faction reloaded #{map_size(new_state.factions)} factions")
        {:reply, :ok, new_state}
      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp do_load_all(state, path) do
    full_path = if Path.type(path) == :absolute, do: path, else: Path.join(File.cwd!(), path)

    if File.exists?(full_path) do
      yaml_files = Path.wildcard(Path.join([full_path, "**", "*.{yml,yaml}"]))
      {factions, errors} = parse_yaml_files(yaml_files)

      if Enum.any?(errors) do
        {:error, errors}
      else
        :ets.delete_all_objects(state.table)
        Enum.each(factions, fn {key, f} -> :ets.insert(state.table, {key, f}) end)
        {:ok, %{state | factions: factions}}
      end
    else
      Logger.debug("Faction: path #{full_path} does not exist, starting empty")
      {:ok, %{state | factions: %{}}}
    end
  end

  defp parse_yaml_files(files) do
    Enum.reduce(files, {%{}, []}, fn file, {factions, errors} ->
      case parse_yaml_file(file) do
        {:ok, faction} -> {Map.put(factions, faction.key, faction), errors}
        {:error, reason} -> {factions, [{file, reason} | errors]}
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content) do
      {:ok, from_map(data)}
    end
  end

  defp from_map(data) do
    %{
      key: MapHelpers.get_flexible(data, :key, ""),
      name: MapHelpers.get_flexible(data, :name, ""),
      description: MapHelpers.get_flexible(data, :description, ""),
      allies: MapHelpers.get_flexible(data, :allies, []),
      enemies: MapHelpers.get_flexible(data, :enemies, []),
      tiers: parse_tiers(MapHelpers.get_flexible(data, :tiers, [])),
      tags: MapHelpers.get_flexible(data, :tags, [])
    }
  end

  defp parse_tiers(tiers) do
    Enum.map(tiers, fn tier ->
      %{
        name: MapHelpers.get_flexible(tier, :name, "Unknown"),
        min: MapHelpers.get_flexible(tier, :min, 0),
        max: MapHelpers.get_flexible(tier, :max, 0),
        effects: MapHelpers.get_flexible(tier, :effects, %{})
      }
    end)
  end

  defp do_modify_reputation(%GameState{stats: stats} = game_state, faction_key, amount) do
    factions = MapHelpers.get_flexible(stats, :factions, %{})
    current = Map.get(factions, faction_key, @default_neutral)
    new_value = clamp(current + amount, @min_reputation, @max_reputation)
    updated_factions = Map.put(factions, faction_key, new_value)
    %{game_state | stats: Map.put(stats, :factions, updated_factions)}
  end

  defp apply_allied_changes(game_state, [], _amount, _server), do: game_state
  defp apply_allied_changes(game_state, allies, amount, _server) do
    allied_amount = div(amount, 2)
    Enum.reduce(allies, game_state, fn ally_key, gs ->
      do_modify_reputation(gs, ally_key, allied_amount)
    end)
  end

  defp apply_enemy_changes(game_state, [], _amount, _server), do: game_state
  defp apply_enemy_changes(game_state, enemies, amount, _server) do
    enemy_amount = -div(amount, 2)
    Enum.reduce(enemies, game_state, fn enemy_key, gs ->
      do_modify_reputation(gs, enemy_key, enemy_amount)
    end)
  end

  defp clamp(value, min, max), do: value |> max(min) |> min(max)
end
