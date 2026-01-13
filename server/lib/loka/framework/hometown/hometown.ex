defmodule Loka.Framework.Hometown do
  @moduledoc """
  LegendMUD-style hometown/origin system with axiom-based bonuses.

  Players choose a hometown at character creation which grants:
  - Starting stats/skills based on the culture
  - Faction relationships
  - Unique abilities or traits
  - Access to hometown-specific quests

  ## Hometown/Axiom Configuration (YAML)

      key: tara
      name: "Tara"
      description: "Celtic warriors from the emerald isle."
      axiom: celtic
      starting_room: tara_square
      stat_bonuses:
        str: 2
        con: 1
      starting_skills:
        basic_combat: 5
        herbalism: 3
      starting_items:
        - celtic_sword
        - leather_armor
      faction_standings:
        celts: 100
        romans: -50
      traits:
        - battle_fury
        - nature_affinity

  ## Axioms

  Axioms are cultural/temporal settings that group hometowns:
  - `celtic` - Ancient Celtic culture
  - `roman` - Roman Empire
  - `medieval` - Medieval European
  - `arabic` - Arabian/Middle Eastern
  - `asian` - Asian cultures
  """

  use GenServer
  require Logger

  alias Loka.Utils.MapHelpers

  @type stat_bonuses :: %{atom() => integer()}
  @type skill_bonuses :: %{String.t() => non_neg_integer()}

  @type t :: %{
          key: String.t(),
          name: String.t(),
          description: String.t(),
          axiom: String.t(),
          starting_room: String.t(),
          stat_bonuses: stat_bonuses(),
          starting_skills: skill_bonuses(),
          starting_items: [String.t()],
          faction_standings: %{String.t() => integer()},
          traits: [String.t()],
          tags: [String.t()]
        }

  @hometown_table :loka_hometowns
  @default_path "priv/world/hometowns"

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

  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, hometown} -> hometown
      {:error, :not_found} -> raise "Hometown not found: #{key}"
    end
  end

  def by_axiom(axiom, server \\ __MODULE__) when is_binary(axiom) do
    GenServer.call(server, {:by_axiom, axiom})
  end

  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Applies hometown bonuses to a new character's game state.
  """
  def apply_hometown_bonuses(game_state, hometown_key, server \\ __MODULE__) do
    case get(hometown_key, server) do
      {:ok, hometown} ->
        {:ok, do_apply_bonuses(game_state, hometown)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @default_path)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    table = :ets.new(@hometown_table, [:set, :protected, read_concurrency: true])
    state = %{table: table, path: path, hometowns: %{}}

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info("Hometown loaded #{map_size(new_state.hometowns)} hometowns")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("Hometown started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.hometowns, key) do
        nil -> {:error, :not_found}
        hometown -> {:ok, hometown}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:by_axiom, axiom}, _from, state) do
    hometowns = state.hometowns |> Map.values() |> Enum.filter(&(&1.axiom == axiom))
    {:reply, hometowns, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.hometowns), state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.hometowns), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info("Hometown reloaded #{map_size(new_state.hometowns)} hometowns")
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
      {hometowns, errors} = parse_yaml_files(yaml_files)

      if Enum.any?(errors) do
        {:error, errors}
      else
        :ets.delete_all_objects(state.table)
        Enum.each(hometowns, fn {key, ht} -> :ets.insert(state.table, {key, ht}) end)
        {:ok, %{state | hometowns: hometowns}}
      end
    else
      Logger.debug("Hometown: path #{full_path} does not exist, starting empty")
      {:ok, %{state | hometowns: %{}}}
    end
  end

  defp parse_yaml_files(files) do
    Enum.reduce(files, {%{}, []}, fn file, {hometowns, errors} ->
      case parse_yaml_file(file) do
        {:ok, hometown} -> {Map.put(hometowns, hometown.key, hometown), errors}
        {:error, reason} -> {hometowns, [{file, reason} | errors]}
      end
    end)
  end

  # sobelow_skip ["Traversal.FileModule"] - file paths from Path.wildcard on priv/world
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
      axiom: MapHelpers.get_flexible(data, :axiom, "general"),
      starting_room: MapHelpers.get_flexible(data, :starting_room, nil),
      stat_bonuses: MapHelpers.get_flexible(data, :stat_bonuses, %{}),
      starting_skills: MapHelpers.get_flexible(data, :starting_skills, %{}),
      starting_items: MapHelpers.get_flexible(data, :starting_items, []),
      faction_standings: MapHelpers.get_flexible(data, :faction_standings, %{}),
      traits: MapHelpers.get_flexible(data, :traits, []),
      tags: MapHelpers.get_flexible(data, :tags, [])
    }
  end

  defp do_apply_bonuses(game_state, hometown) do
    game_state
    |> apply_stat_bonuses(hometown.stat_bonuses)
    |> apply_skill_bonuses(hometown.starting_skills)
    |> apply_starting_items(hometown.starting_items)
    |> apply_faction_standings(hometown.faction_standings)
    |> apply_traits(hometown.traits)
    |> set_hometown(hometown.key)
  end

  defp apply_stat_bonuses(game_state, bonuses) when map_size(bonuses) == 0, do: game_state

  defp apply_stat_bonuses(game_state, bonuses) do
    stats = game_state.stats

    updated_stats =
      Enum.reduce(bonuses, stats, fn {stat, bonus}, acc ->
        current = MapHelpers.get_flexible(acc, stat, 10)
        Map.put(acc, stat, current + bonus)
      end)

    %{game_state | stats: updated_stats}
  end

  defp apply_skill_bonuses(game_state, skills) when map_size(skills) == 0, do: game_state

  defp apply_skill_bonuses(game_state, skill_bonuses) do
    stats = game_state.stats
    current_skills = MapHelpers.get_flexible(stats, :skills, %{})

    updated_skills =
      Enum.reduce(skill_bonuses, current_skills, fn {skill, level}, acc ->
        Map.put(acc, skill, %{level: level, xp: 0})
      end)

    %{game_state | stats: Map.put(stats, :skills, updated_skills)}
  end

  defp apply_starting_items(game_state, []), do: game_state

  defp apply_starting_items(game_state, items) do
    %{game_state | inventory: game_state.inventory ++ items}
  end

  defp apply_faction_standings(game_state, standings) when map_size(standings) == 0,
    do: game_state

  defp apply_faction_standings(game_state, standings) do
    stats = game_state.stats
    current_factions = MapHelpers.get_flexible(stats, :factions, %{})
    updated_factions = Map.merge(current_factions, standings)
    %{game_state | stats: Map.put(stats, :factions, updated_factions)}
  end

  defp apply_traits(game_state, []), do: game_state

  defp apply_traits(game_state, traits) do
    stats = game_state.stats
    current_traits = MapHelpers.get_flexible(stats, :traits, [])
    %{game_state | stats: Map.put(stats, :traits, current_traits ++ traits)}
  end

  defp set_hometown(game_state, hometown_key) do
    stats = game_state.stats
    %{game_state | stats: Map.put(stats, :hometown, hometown_key)}
  end
end
