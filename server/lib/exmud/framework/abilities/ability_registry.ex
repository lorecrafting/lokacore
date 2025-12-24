defmodule Exmud.Framework.Abilities.AbilityRegistry do
  @moduledoc """
  Loads and stores ability definitions from YAML files.

  Abilities are stored as YAML files in `priv/world/abilities/`. This registry:
  - Reads all YAML files from the abilities directory
  - Parses each ability definition
  - Stores abilities in ETS for fast concurrent lookup

  ## Directory Structure

      priv/world/abilities/
      ├── offensive/        # Attack spells, damage abilities
      ├── defensive/        # Heals, shields, buffs
      ├── utility/          # Teleports, summons, transforms
      └── passive/          # Always-active abilities

  ## YAML Format

      key: fireball
      name: "Fireball"
      type: offensive
      cost:
        mana: 15
      cooldown: 3
      target: enemy
      effects:
        - type: damage
          amount: 25
          damage_type: fire
      requirements:
        level: 5
      description: "Hurls a ball of flame at the target."
      cast_message: "You conjure flames and hurl them at {target}!"

  ## Usage

      alias Exmud.Framework.Abilities.AbilityRegistry

      # Get an ability by key
      {:ok, ability} = AbilityRegistry.get("fireball")

      # List all abilities
      abilities = AbilityRegistry.all()

      # List by type
      offensive = AbilityRegistry.by_type(:offensive)

      # Hot-reload from disk
      :ok = AbilityRegistry.reload()
  """

  use GenServer
  require Logger

  alias Exmud.Framework.Abilities.Ability

  @ability_table :exmud_abilities
  @default_path "priv/world/abilities"

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the AbilityRegistry GenServer.

  ## Options

  - `:path` - Path to abilities directory (default: "priv/world/abilities")
  - `:name` - Process name (default: __MODULE__)
  - `:load_on_start` - Whether to load abilities on start (default: true)
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets an ability by key.

  Returns `{:ok, ability}` or `{:error, :not_found}`.
  """
  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  @doc """
  Gets an ability by key, raises if not found.
  """
  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, ability} -> ability
      {:error, :not_found} -> raise "Ability not found: #{key}"
    end
  end

  @doc """
  Lists all abilities of a specific type.
  """
  def by_type(type, server \\ __MODULE__) when is_atom(type) do
    GenServer.call(server, {:by_type, type})
  end

  @doc """
  Lists all abilities with a specific tag.
  """
  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  @doc """
  Returns all loaded abilities.
  """
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc """
  Returns the count of loaded abilities.
  """
  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  @doc """
  Checks if an ability exists.
  """
  def exists?(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, _} -> true
      {:error, _} -> false
    end
  end

  @doc """
  Reloads all abilities from disk. Hot-reload without restart.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Loads abilities from a specific path (useful for testing).
  """
  def load_from(path, server \\ __MODULE__) when is_binary(path) do
    GenServer.call(server, {:load_from, path})
  end

  @doc """
  Lists abilities that an entity can use based on requirements.

  Filters abilities by level and skill requirements.
  """
  def available_for(game_state, server \\ __MODULE__) do
    GenServer.call(server, {:available_for, game_state})
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @default_path)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    # Create ETS table for ability storage
    table = :ets.new(@ability_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      abilities: %{}
    }

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info("AbilityRegistry loaded #{map_size(new_state.abilities)} abilities")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("AbilityRegistry started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.abilities, key) do
        nil -> {:error, :not_found}
        ability -> {:ok, ability}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:by_type, type}, _from, state) do
    abilities =
      state.abilities
      |> Map.values()
      |> Enum.filter(&(&1.type == type))

    {:reply, abilities, state}
  end

  @impl true
  def handle_call({:by_tag, tag}, _from, state) do
    abilities =
      state.abilities
      |> Map.values()
      |> Enum.filter(&(tag in &1.tags))

    {:reply, abilities, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.abilities), state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.abilities), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info("AbilityRegistry reloaded #{map_size(new_state.abilities)} abilities")
        {:reply, :ok, new_state}

      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  @impl true
  def handle_call({:load_from, path}, _from, state) do
    case do_load_all(state, path) do
      {:ok, new_state} ->
        {:reply, :ok, %{new_state | path: path}}

      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  @impl true
  def handle_call({:available_for, game_state}, _from, state) do
    player_level = get_in(game_state.stats, ["level"]) || get_in(game_state.stats, [:level]) || 1

    player_skills =
      get_in(game_state.stats, ["skills"]) || get_in(game_state.stats, [:skills]) || []

    abilities =
      state.abilities
      |> Map.values()
      |> Enum.filter(fn ability ->
        meets_requirements?(ability, player_level, player_skills)
      end)

    {:reply, abilities, state}
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp do_load_all(state, path) do
    full_path = resolve_path(path)

    if File.exists?(full_path) do
      yaml_files = find_yaml_files(full_path)
      {abilities, parse_errors} = parse_yaml_files(yaml_files)

      if Enum.any?(parse_errors) do
        {:error, parse_errors}
      else
        update_ets(state.table, abilities)
        {:ok, %{state | abilities: abilities}}
      end
    else
      Logger.debug("AbilityRegistry: path #{full_path} does not exist, starting empty")
      {:ok, %{state | abilities: %{}}}
    end
  end

  defp resolve_path(path) do
    if Path.type(path) == :absolute do
      path
    else
      Path.join(File.cwd!(), path)
    end
  end

  defp find_yaml_files(dir) do
    Path.wildcard(Path.join([dir, "**", "*.{yml,yaml}"]))
  end

  defp parse_yaml_files(files) do
    Enum.reduce(files, {%{}, []}, fn file, {abilities, errors} ->
      case parse_yaml_file(file) do
        {:ok, ability} ->
          {Map.put(abilities, ability.key, ability), errors}

        {:error, reason} ->
          {abilities, [{file, reason} | errors]}
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, ability} <- Ability.from_map(data) do
      {:ok, ability}
    else
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp update_ets(table, abilities) do
    :ets.delete_all_objects(table)

    Enum.each(abilities, fn {key, ability} ->
      :ets.insert(table, {key, ability})
    end)
  end

  defp meets_requirements?(ability, player_level, player_skills) do
    reqs = ability.requirements
    required_level = Map.get(reqs, "level") || Map.get(reqs, :level) || 1
    required_skills = Map.get(reqs, "skills") || Map.get(reqs, :skills) || []

    level_ok = player_level >= required_level
    skills_ok = Enum.all?(required_skills, &(&1 in player_skills))

    level_ok and skills_ok
  end
end
