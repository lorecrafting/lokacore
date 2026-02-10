defmodule Loka.Framework.Skills.BinarySkillRegistry do
  @moduledoc """
  Loads and stores binary skill definitions from YAML files.

  Supports two YAML formats:

  ## Single Skill Format

      key: kick
      name: "Kick"
      category: combat_melee
      cost: 1
      stat: str

  ## Collection Format (multiple skills in one file)

      skills:
        kick:
          key: kick
          name: "Kick"
          category: combat_melee
          cost: 1
          stat: str
        bash:
          key: bash
          name: "Bash"
          category: combat_melee
          cost: 1
          stat: str
  """

  use GenServer
  require Logger

  alias Loka.Engine.Constants.WorldPaths
  alias Loka.Framework.Skills.BinarySkill
  alias Loka.Utils.YamlLoader

  @default_path WorldPaths.skills_dir()

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc "Gets a skill by key."
  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  @doc "Gets a skill by key, raises if not found."
  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, skill} -> skill
      {:error, :not_found} -> raise "Binary skill not found: #{key}"
    end
  end

  @doc "Returns all skills."
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc "Returns count of loaded skills."
  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  @doc "Checks if a skill exists."
  def exists?(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, _} -> true
      {:error, :not_found} -> false
    end
  end

  @doc "Reloads all skills from disk."
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc "Lists all skills in a specific category."
  def by_category(category, server \\ __MODULE__)

  def by_category(category, server) when is_atom(category) do
    GenServer.call(server, {:by_category, category})
  end

  def by_category(category, server) when is_binary(category) do
    by_category(String.to_atom(category), server)
  end

  @doc "Lists all skills with a specific tag."
  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
  end

  @doc "Lists all skills taught by a specific trainer."
  def by_trainer(trainer_key, server \\ __MODULE__) when is_binary(trainer_key) do
    GenServer.call(server, {:by_trainer, trainer_key})
  end

  @doc "Lists all skills with a specific governing stat."
  def by_stat(stat, server \\ __MODULE__) when is_atom(stat) do
    GenServer.call(server, {:by_stat, stat})
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @default_path)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    table = :ets.new(:loka_binary_skills, [:set, :protected, read_concurrency: true])
    state = %{table: table, path: path, skills: %{}}

    if load_on_start do
      # do_load_all always returns {:ok, state} - it logs warnings internally for any errors
      {:ok, new_state} = do_load_all(state, path)
      count = map_size(new_state.skills)
      Logger.info("#{inspect(__MODULE__)} loaded #{count} binary skills")
      {:ok, new_state}
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.skills, key) do
        nil -> {:error, :not_found}
        skill -> {:ok, skill}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.skills), state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.skills), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    # do_load_all always returns {:ok, state} - it logs warnings internally for any errors
    {:ok, new_state} = do_load_all(state, state.path)
    count = map_size(new_state.skills)
    Logger.info("#{inspect(__MODULE__)} reloaded #{count} binary skills")
    {:reply, :ok, new_state}
  end

  @impl true
  def handle_call({:by_category, category}, _from, state) do
    skills = state.skills |> Map.values() |> Enum.filter(&(&1.category == category))
    {:reply, skills, state}
  end

  @impl true
  def handle_call({:by_tag, tag}, _from, state) do
    skills = state.skills |> Map.values() |> Enum.filter(&(tag in &1.tags))
    {:reply, skills, state}
  end

  @impl true
  def handle_call({:by_trainer, trainer_key}, _from, state) do
    skills = state.skills |> Map.values() |> Enum.filter(&(trainer_key in &1.trainers))
    {:reply, skills, state}
  end

  @impl true
  def handle_call({:by_stat, stat}, _from, state) do
    skills = state.skills |> Map.values() |> Enum.filter(&(&1.stat == stat))
    {:reply, skills, state}
  end

  # Test helper - allows injecting test skills
  @impl true
  def handle_call({:put_test_skills, skills}, _from, state) do
    skill_map =
      Enum.reduce(skills, %{}, fn skill, acc ->
        Map.put(acc, skill.key, skill)
      end)

    :ets.delete_all_objects(state.table)
    Enum.each(skill_map, fn {key, skill} -> :ets.insert(state.table, {key, skill}) end)

    {:reply, :ok, %{state | skills: skill_map}}
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp do_load_all(state, path) do
    full_path = YamlLoader.resolve_path(path)

    if YamlLoader.path_exists?(full_path) do
      yaml_files = YamlLoader.find_yaml_files(full_path)
      {skills, errors} = parse_skill_files(yaml_files)

      if Enum.any?(errors) do
        Logger.warning("Errors loading binary skills: #{inspect(errors)}")
      end

      # Update ETS table
      :ets.delete_all_objects(state.table)
      Enum.each(skills, fn {key, skill} -> :ets.insert(state.table, {key, skill}) end)

      {:ok, %{state | skills: skills}}
    else
      Logger.info("Skills path not found: #{full_path}, starting empty")
      {:ok, state}
    end
  end

  # Parse YAML files, handling both single-skill and collection formats
  defp parse_skill_files(files) do
    Enum.reduce(files, {%{}, []}, fn file, {skills, errors} ->
      case parse_skill_file(file) do
        {:ok, parsed_skills} ->
          merged = Map.merge(skills, parsed_skills)
          {merged, errors}

        {:error, reason} ->
          {skills, [{file, reason} | errors]}
      end
    end)
  end

  # sobelow_skip ["Traversal.FileModule"] - file paths from Path.wildcard on priv/world
  defp parse_skill_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content) do
      parse_skill_data(data, file)
    else
      {:error, reason} -> {:error, reason}
    end
  end

  # Handle collection format: skills: { kick: {...}, bash: {...} }
  defp parse_skill_data(%{"skills" => skills_map}, file) when is_map(skills_map) do
    results =
      Enum.map(skills_map, fn {key, skill_data} ->
        # Ensure key is in the data
        skill_data_with_key = Map.put_new(skill_data, "key", to_string(key))

        case BinarySkill.from_map(skill_data_with_key) do
          {:ok, skill} -> {:ok, {skill.key, skill}}
          {:error, reason} -> {:error, {key, reason}}
        end
      end)

    {successes, failures} =
      Enum.split_with(results, fn
        {:ok, _} -> true
        {:error, _} -> false
      end)

    if Enum.any?(failures) do
      failure_details = Enum.map(failures, fn {:error, {k, r}} -> "#{k}: #{inspect(r)}" end)

      Logger.warning(
        "Failed to parse some skills in #{file}: #{Enum.join(failure_details, ", ")}"
      )
    end

    skill_map = successes |> Enum.map(fn {:ok, pair} -> pair end) |> Map.new()
    {:ok, skill_map}
  end

  # Handle single skill format: key: "kick", name: "Kick", ...
  defp parse_skill_data(data, _file) when is_map(data) do
    # Check if this looks like a binary skill (has "cost" field) vs old leveled skill
    if Map.has_key?(data, "cost") or Map.has_key?(data, :cost) do
      case BinarySkill.from_map(data) do
        {:ok, skill} -> {:ok, %{skill.key => skill}}
        {:error, reason} -> {:error, reason}
      end
    else
      # Skip old-format skills (leveled skills with max_level)
      {:ok, %{}}
    end
  end
end
