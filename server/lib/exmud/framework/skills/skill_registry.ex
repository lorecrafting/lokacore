defmodule Exmud.Framework.Skills.SkillRegistry do
  @moduledoc """
  Loads and stores skill definitions from YAML files.

  ## YAML Format

      key: swordsmanship
      name: "Swordsmanship"
      category: combat
      max_level: 100
      description: "Proficiency with bladed weapons."
      prerequisites:
        - skill: basic_combat
          level: 10
      unlocks:
        - parry
        - riposte
      trainers:
        - weapons_master
      practice_actions:
        - attack_with_sword
      xp_per_use: 1
      xp_per_level: 100
  """

  use GenServer
  require Logger

  alias Exmud.Framework.Skills.Skill

  @skill_table :exmud_skills
  @default_path "priv/world/skills"

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, skill} -> skill
      {:error, :not_found} -> raise "Skill not found: #{key}"
    end
  end

  def by_category(category, server \\ __MODULE__) when is_binary(category) do
    GenServer.call(server, {:by_category, category})
  end

  def by_tag(tag, server \\ __MODULE__) when is_binary(tag) do
    GenServer.call(server, {:by_tag, tag})
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

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @default_path)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    table = :ets.new(@skill_table, [:set, :protected, read_concurrency: true])
    state = %{table: table, path: path, skills: %{}}

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info("SkillRegistry loaded #{map_size(new_state.skills)} skills")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("SkillRegistry started with errors: #{inspect(errors)}")
          {:ok, state}
      end
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
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.skills), state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.skills), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info("SkillRegistry reloaded #{map_size(new_state.skills)} skills")
        {:reply, :ok, new_state}

      {:error, errors} ->
        {:reply, {:error, errors}, state}
    end
  end

  # Test helper - only use in tests
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
    full_path = if Path.type(path) == :absolute, do: path, else: Path.join(File.cwd!(), path)

    if File.exists?(full_path) do
      yaml_files = Path.wildcard(Path.join([full_path, "**", "*.{yml,yaml}"]))
      {skills, errors} = parse_yaml_files(yaml_files)

      if Enum.any?(errors) do
        {:error, errors}
      else
        :ets.delete_all_objects(state.table)
        Enum.each(skills, fn {key, skill} -> :ets.insert(state.table, {key, skill}) end)
        {:ok, %{state | skills: skills}}
      end
    else
      Logger.debug("SkillRegistry: path #{full_path} does not exist, starting empty")
      {:ok, %{state | skills: %{}}}
    end
  end

  defp parse_yaml_files(files) do
    Enum.reduce(files, {%{}, []}, fn file, {skills, errors} ->
      case parse_yaml_file(file) do
        {:ok, skill} -> {Map.put(skills, skill.key, skill), errors}
        {:error, reason} -> {skills, [{file, reason} | errors]}
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, skill} <- Skill.from_map(data) do
      {:ok, skill}
    end
  end
end
