defmodule Exmud.Framework.Crafting.CraftingRegistry do
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

      alias Exmud.Framework.Crafting.CraftingRegistry

      {:ok, recipe} = CraftingRegistry.get("recipe_health_potion")
      recipes = CraftingRegistry.all()
      :ok = CraftingRegistry.reload()
  """

  use GenServer
  require Logger

  alias Exmud.Framework.Crafting.Recipe

  @recipe_table :exmud_recipes
  @default_path "priv/world/recipes"

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the CraftingRegistry GenServer.

  ## Options

  - `:path` - Path to recipes directory (default: "priv/world/recipes")
  - `:name` - Process name (default: __MODULE__)
  - `:load_on_start` - Whether to load recipes on start (default: true)
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a recipe by key.

  Returns `{:ok, recipe}` or `{:error, :not_found}`.
  """
  def get(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:get, key})
  end

  @doc """
  Gets a recipe by key, raises if not found.
  """
  def get!(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, recipe} -> recipe
      {:error, :not_found} -> raise "Recipe not found: #{key}"
    end
  end

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
  Returns all loaded recipes.
  """
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc """
  Returns the count of loaded recipes.
  """
  def count(server \\ __MODULE__) do
    GenServer.call(server, :count)
  end

  @doc """
  Checks if a recipe exists.
  """
  def exists?(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, _} -> true
      {:error, _} -> false
    end
  end

  @doc """
  Reloads all recipes from disk. Hot-reload without restart.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Loads recipes from a specific path (useful for testing).
  """
  def load_from(path, server \\ __MODULE__) when is_binary(path) do
    GenServer.call(server, {:load_from, path})
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

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, @default_path)
    load_on_start = Keyword.get(opts, :load_on_start, true)

    table = :ets.new(@recipe_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      recipes: %{}
    }

    if load_on_start do
      case do_load_all(state, path) do
        {:ok, new_state} ->
          Logger.info("CraftingRegistry loaded #{map_size(new_state.recipes)} recipes")
          {:ok, new_state}

        {:error, errors} ->
          Logger.warning("CraftingRegistry started with errors: #{inspect(errors)}")
          {:ok, state}
      end
    else
      {:ok, state}
    end
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.recipes, key) do
        nil -> {:error, :not_found}
        recipe -> {:ok, recipe}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:by_skill, skill}, _from, state) do
    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(&(&1.skill_required == skill))

    {:reply, recipes, state}
  end

  @impl true
  def handle_call({:by_station, station_type}, _from, state) do
    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(&(&1.station_type == station_type))

    {:reply, recipes, state}
  end

  @impl true
  def handle_call({:by_tag, tag}, _from, state) do
    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(&(tag in &1.tags))

    {:reply, recipes, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.recipes), state}
  end

  @impl true
  def handle_call(:count, _from, state) do
    {:reply, map_size(state.recipes), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    case do_load_all(state, state.path) do
      {:ok, new_state} ->
        Logger.info("CraftingRegistry reloaded #{map_size(new_state.recipes)} recipes")
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
    skills = get_in(game_state.stats, ["skills"]) || get_in(game_state.stats, [:skills]) || %{}

    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(fn recipe ->
        meets_skill_requirements?(recipe, skills)
      end)

    {:reply, recipes, state}
  end

  @impl true
  def handle_call({:using_ingredient, item_key}, _from, state) do
    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(fn recipe ->
        Enum.any?(recipe.ingredients, &(&1.item == item_key))
      end)

    {:reply, recipes, state}
  end

  @impl true
  def handle_call({:producing, item_key}, _from, state) do
    recipes =
      state.recipes
      |> Map.values()
      |> Enum.filter(fn recipe ->
        Enum.any?(recipe.output, &(&1.item == item_key))
      end)

    {:reply, recipes, state}
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp do_load_all(state, path) do
    full_path = resolve_path(path)

    if File.exists?(full_path) do
      yaml_files = find_yaml_files(full_path)
      {recipes, parse_errors} = parse_yaml_files(yaml_files)

      if Enum.any?(parse_errors) do
        {:error, parse_errors}
      else
        update_ets(state.table, recipes)
        {:ok, %{state | recipes: recipes}}
      end
    else
      Logger.debug("CraftingRegistry: path #{full_path} does not exist, starting empty")
      {:ok, %{state | recipes: %{}}}
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
    Enum.reduce(files, {%{}, []}, fn file, {recipes, errors} ->
      case parse_yaml_file(file) do
        {:ok, recipe} ->
          {Map.put(recipes, recipe.key, recipe), errors}

        {:error, reason} ->
          {recipes, [{file, reason} | errors]}
      end
    end)
  end

  defp parse_yaml_file(file) do
    with {:ok, content} <- File.read(file),
         {:ok, data} <- YamlElixir.read_from_string(content),
         {:ok, recipe} <- Recipe.from_map(data) do
      {:ok, recipe}
    else
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp update_ets(table, recipes) do
    :ets.delete_all_objects(table)

    Enum.each(recipes, fn {key, recipe} ->
      :ets.insert(table, {key, recipe})
    end)
  end

  defp meets_skill_requirements?(%Recipe{skill_required: nil}, _skills), do: true

  defp meets_skill_requirements?(%Recipe{skill_required: skill, skill_level: level}, skills) do
    player_level = Map.get(skills, skill) || Map.get(skills, String.to_atom(skill)) || 0
    player_level >= level
  end
end
