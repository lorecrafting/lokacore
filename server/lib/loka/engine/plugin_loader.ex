defmodule Loka.Engine.PluginLoader do
  @moduledoc """
  Loads, validates, and initializes plugins at application startup.

  PluginLoader handles:
  - Reading plugins from config
  - Resolving dependency order (topological sort)
  - Starting plugin children via PluginSupervisor
  - Registering hooks, validators, scripting extensions
  - Loading additional prototype paths
  - Merging balance configs
  - Calling plugin init callbacks

  ## Startup Order

  1. PluginLoader starts as part of supervision tree (after Engine core)
  2. Reads :plugins config
  3. Resolves dependencies (topological sort)
  4. For each plugin in order:
     a. Start children via PluginSupervisor
     b. Add validators to ContentValidator config
     c. Add scripting extensions to Scripting config
     d. Load prototype paths into PrototypeLoader
     e. Merge balance config
  5. After all plugins loaded, register hooks and call init/0 on each

  ## Configuration

      config :loka, :plugins, [
        MyGame.Plugins.GuildSystem,
        MyGame.Plugins.PetSystem
      ]

  ## Failure Handling

  If any plugin fails to load, the application will fail to start.
  This ensures configuration errors are caught early.
  """

  use GenServer
  require Logger

  alias Loka.Engine.{Hooks, PrototypeLoader, PluginSupervisor}
  alias Loka.Config.Balance

  @default_ets_table :loka_plugins

  defstruct [
    :plugins,
    :load_order,
    :started_children,
    :state,
    :ets_table
  ]

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the PluginLoader GenServer.

  ## Options

  - `:plugins` - List of plugin modules (overrides config)
  - `:name` - Process name (default: __MODULE__)
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Returns list of loaded plugin modules in load order.
  """
  def loaded_plugins(server \\ __MODULE__) do
    GenServer.call(server, :loaded_plugins)
  end

  @doc """
  Returns plugin module for a specific plugin name.
  """
  def get_plugin(name, server \\ __MODULE__) when is_atom(name) do
    GenServer.call(server, {:get_plugin, name})
  end

  @doc """
  Returns metadata for all loaded plugins.
  """
  def plugin_info(server \\ __MODULE__) do
    GenServer.call(server, :plugin_info)
  end

  @doc """
  Checks if a plugin is loaded.

  Uses ETS for fast lookups without going through GenServer.
  Only works with the default PluginLoader instance.
  """
  def loaded?(name) when is_atom(name) do
    case :ets.lookup(@default_ets_table, name) do
      [{^name, _}] -> true
      [] -> false
    end
  rescue
    ArgumentError -> false
  end

  @doc """
  Reloads all plugins.

  This is primarily for development. In production, restart the app.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload, 30_000)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    # Use custom ETS table name for testing, or default for production
    ets_table = Keyword.get(opts, :ets_table, @default_ets_table)

    # Create ETS table for fast lookups (skip if already exists for test isolation)
    if :ets.whereis(ets_table) == :undefined do
      :ets.new(ets_table, [:set, :public, :named_table, read_concurrency: true])
    end

    state = %__MODULE__{
      plugins: %{},
      load_order: [],
      started_children: %{},
      state: :loading,
      ets_table: ets_table
    }

    # Get plugins from opts or config
    plugin_modules = Keyword.get(opts, :plugins, configured_plugins())

    if Enum.empty?(plugin_modules) do
      Logger.debug("PluginLoader: No plugins configured")
      {:ok, %{state | state: :ready}}
    else
      case load_plugins(state, plugin_modules) do
        {:ok, new_state} ->
          Logger.info(
            "PluginLoader: Loaded #{length(new_state.load_order)} plugins: #{inspect(new_state.load_order)}"
          )

          {:ok, %{new_state | state: :ready}}

        {:error, reason} ->
          Logger.error("PluginLoader: Failed to load plugins: #{inspect(reason)}")
          {:stop, {:plugin_load_failed, reason}}
      end
    end
  end

  @impl true
  def handle_call(:loaded_plugins, _from, state) do
    modules = Enum.map(state.load_order, &Map.get(state.plugins, &1))
    {:reply, modules, state}
  end

  @impl true
  def handle_call({:get_plugin, name}, _from, state) do
    {:reply, Map.get(state.plugins, name), state}
  end

  @impl true
  def handle_call(:plugin_info, _from, state) do
    info =
      Enum.map(state.load_order, fn name ->
        plugin = Map.get(state.plugins, name)

        %{
          name: name,
          module: plugin,
          version: plugin.version(),
          description: plugin.description(),
          dependencies: safe_call(plugin, :dependencies, []),
          hooks: length(safe_call(plugin, :hooks, [])),
          children: length(safe_call(plugin, :children, []))
        }
      end)

    {:reply, info, state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    # Stop all plugin children
    Enum.each(state.started_children, fn {_name, pids} ->
      Enum.each(pids, fn pid ->
        if Process.alive?(pid), do: GenServer.stop(pid, :normal, 5000)
      end)
    end)

    # Clear ETS
    :ets.delete_all_objects(state.ets_table)

    # Reload from config
    plugin_modules = configured_plugins()

    new_state = %__MODULE__{
      plugins: %{},
      load_order: [],
      started_children: %{},
      state: :loading,
      ets_table: state.ets_table
    }

    case load_plugins(new_state, plugin_modules) do
      {:ok, final_state} ->
        {:reply, :ok, %{final_state | state: :ready}}

      {:error, reason} ->
        {:reply, {:error, reason}, %{new_state | state: :error}}
    end
  end

  @impl true
  def terminate(_reason, state) do
    # Clean up ETS table to prevent orphaned tables
    if state.ets_table != @default_ets_table do
      # Only delete non-default tables (test instances)
      # Default table is managed by application lifecycle
      try do
        :ets.delete(state.ets_table)
      rescue
        ArgumentError -> :ok
      end
    end

    :ok
  end

  # =============================================================================
  # Private - Plugin Loading
  # =============================================================================

  defp configured_plugins do
    Application.get_env(:loka, :plugins, [])
  end

  defp load_plugins(state, plugin_modules) do
    with :ok <- validate_plugins(plugin_modules),
         {:ok, load_order} <- resolve_dependencies(plugin_modules) do
      # Load each plugin in dependency order
      result =
        Enum.reduce_while(load_order, {:ok, state}, fn plugin_module, {:ok, acc_state} ->
          case load_single_plugin(acc_state, plugin_module) do
            {:ok, new_state} -> {:cont, {:ok, new_state}}
            {:error, reason} -> {:halt, {:error, {plugin_module.name(), reason}}}
          end
        end)

      case result do
        {:ok, final_state} ->
          # Register hooks and call init after all plugins loaded
          register_all_hooks(final_state)
          call_plugin_inits(final_state)
          {:ok, final_state}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp validate_plugins(modules) do
    invalid =
      Enum.filter(modules, fn mod ->
        not (Code.ensure_loaded?(mod) and function_exported?(mod, :name, 0))
      end)

    if Enum.empty?(invalid) do
      :ok
    else
      {:error, {:invalid_plugins, invalid}}
    end
  end

  defp resolve_dependencies(plugin_modules) do
    # Build name -> module map
    name_to_module = Map.new(plugin_modules, fn mod -> {mod.name(), mod} end)
    available_names = Map.keys(name_to_module)

    # Check for missing dependencies
    missing =
      Enum.flat_map(plugin_modules, fn mod ->
        deps = safe_call(mod, :dependencies, [])

        Enum.filter(deps, fn dep ->
          dep not in available_names
        end)
        |> Enum.map(&{mod.name(), &1})
      end)

    if not Enum.empty?(missing) do
      {:error, {:missing_dependencies, missing}}
    else
      # Build dependency graph and topological sort
      case topological_sort(plugin_modules, name_to_module) do
        {:ok, order} -> {:ok, order}
        {:error, :cycle, cycle} -> {:error, {:dependency_cycle, cycle}}
      end
    end
  end

  defp topological_sort(plugin_modules, name_to_module) do
    # Build adjacency list (dependency -> dependents)
    graph =
      Enum.reduce(plugin_modules, %{}, fn mod, acc ->
        name = mod.name()
        deps = safe_call(mod, :dependencies, [])

        # Ensure all nodes exist
        acc = Map.put_new(acc, name, [])

        Enum.reduce(deps, acc, fn dep, inner_acc ->
          Map.update(inner_acc, dep, [name], &[name | &1])
        end)
      end)

    # Calculate in-degrees
    in_degrees =
      Enum.reduce(plugin_modules, %{}, fn mod, acc ->
        name = mod.name()
        deps = safe_call(mod, :dependencies, [])
        Map.put(acc, name, length(deps))
      end)

    # Start with nodes that have no dependencies
    queue =
      in_degrees
      |> Enum.filter(fn {_name, degree} -> degree == 0 end)
      |> Enum.map(fn {name, _} -> name end)

    do_topological_sort(queue, [], graph, in_degrees, name_to_module, length(plugin_modules))
  end

  defp do_topological_sort([], sorted, _graph, _in_degrees, name_to_module, total) do
    if length(sorted) == total do
      # Convert names back to modules in sorted order
      {:ok, Enum.map(Enum.reverse(sorted), &Map.get(name_to_module, &1))}
    else
      # Cycle detected - some nodes never reached 0 in-degree
      {:error, :cycle, Enum.reverse(sorted)}
    end
  end

  defp do_topological_sort([current | rest], sorted, graph, in_degrees, name_to_module, total) do
    # Get nodes that depend on current
    dependents = Map.get(graph, current, [])

    # Decrease in-degree for each dependent
    {new_in_degrees, new_ready} =
      Enum.reduce(dependents, {in_degrees, []}, fn dep, {degrees, ready} ->
        new_degree = Map.get(degrees, dep, 0) - 1
        new_degrees = Map.put(degrees, dep, new_degree)

        if new_degree == 0 do
          {new_degrees, [dep | ready]}
        else
          {new_degrees, ready}
        end
      end)

    do_topological_sort(
      rest ++ new_ready,
      [current | sorted],
      graph,
      new_in_degrees,
      name_to_module,
      total
    )
  end

  defp load_single_plugin(state, plugin_module) do
    name = plugin_module.name()
    Logger.info("PluginLoader: Loading plugin #{name} (#{plugin_module.version()})...")

    # Store in ETS for fast lookup
    :ets.insert(state.ets_table, {name, plugin_module})

    with {:ok, pids} <- start_children(plugin_module),
         :ok <- add_validators(plugin_module),
         :ok <- add_scripting_extensions(plugin_module),
         :ok <- load_prototype_paths(plugin_module),
         :ok <- merge_balance_config(plugin_module) do
      new_state = %{
        state
        | plugins: Map.put(state.plugins, name, plugin_module),
          load_order: state.load_order ++ [name],
          started_children: Map.put(state.started_children, name, pids)
      }

      {:ok, new_state}
    else
      {:error, reason} ->
        # Clean up ETS entry on failure
        :ets.delete(state.ets_table, name)
        {:error, reason}
    end
  end

  defp start_children(plugin_module) do
    children = safe_call(plugin_module, :children, [])

    results =
      Enum.map(children, fn child_spec ->
        case PluginSupervisor.start_child(child_spec) do
          {:ok, pid} ->
            {:ok, pid}

          {:error, {:already_started, pid}} ->
            {:ok, pid}

          {:error, reason} ->
            Logger.error(
              "PluginLoader: Failed to start child #{inspect(child_spec)} for #{plugin_module.name()}: #{inspect(reason)}"
            )

            {:error, reason}
        end
      end)

    errors = Enum.filter(results, &match?({:error, _}, &1))

    if Enum.empty?(errors) do
      pids = Enum.map(results, fn {:ok, pid} -> pid end)
      {:ok, pids}
    else
      {:error, {:child_start_failed, errors}}
    end
  end

  defp register_all_hooks(state) do
    Enum.each(state.load_order, fn name ->
      plugin = Map.get(state.plugins, name)
      hooks = safe_call(plugin, :hooks, [])

      Enum.each(hooks, fn
        {hook_type, module, function, opts}
        when is_atom(hook_type) and is_atom(module) and is_atom(function) and is_list(opts) ->
          priority = Keyword.get(opts, :priority, 100)

          case Hooks.register(hook_type, module, function, priority: priority) do
            :ok ->
              :ok

            {:error, reason} ->
              Logger.warning(
                "PluginLoader: Failed to register hook #{hook_type} for #{name}: #{inspect(reason)}"
              )
          end

        {hook_type, module, function}
        when is_atom(hook_type) and is_atom(module) and is_atom(function) ->
          # 3-tuple without opts, use default priority
          case Hooks.register(hook_type, module, function, priority: 100) do
            :ok ->
              :ok

            {:error, reason} ->
              Logger.warning(
                "PluginLoader: Failed to register hook #{hook_type} for #{name}: #{inspect(reason)}"
              )
          end

        invalid ->
          Logger.warning(
            "PluginLoader: Invalid hook format for #{name}: #{inspect(invalid)}. Expected {hook_type, module, function, opts}"
          )
      end)
    end)
  end

  defp add_validators(plugin_module) do
    validators = safe_call(plugin_module, :validators, [])

    if not Enum.empty?(validators) do
      current = Application.get_env(:loka, :content_validator_plugins, [])
      new_validators = Enum.uniq(current ++ validators)
      Application.put_env(:loka, :content_validator_plugins, new_validators)
    end

    :ok
  end

  defp add_scripting_extensions(plugin_module) do
    extensions = safe_call(plugin_module, :scripting_extensions, [])

    if not Enum.empty?(extensions) do
      current = Application.get_env(:loka, :scripting_extensions, [])
      new_extensions = Enum.uniq(current ++ extensions)
      Application.put_env(:loka, :scripting_extensions, new_extensions)
    end

    :ok
  end

  defp load_prototype_paths(plugin_module) do
    paths = safe_call(plugin_module, :prototype_paths, [])

    Enum.each(paths, fn path ->
      case PrototypeLoader.load_from(path) do
        :ok ->
          :ok

        {:error, reason} ->
          Logger.warning(
            "PluginLoader: Failed to load prototypes from #{path}: #{inspect(reason)}"
          )
      end
    end)

    :ok
  end

  defp merge_balance_config(plugin_module) do
    case safe_call(plugin_module, :balance_config_path, nil) do
      nil ->
        :ok

      path ->
        case Balance.merge_from_file(path) do
          :ok ->
            :ok

          {:error, reason} ->
            Logger.warning(
              "PluginLoader: Failed to merge balance config from #{path}: #{inspect(reason)}"
            )

            :ok
        end
    end
  end

  defp call_plugin_inits(state) do
    Enum.each(state.load_order, fn name ->
      plugin = Map.get(state.plugins, name)

      case safe_call(plugin, :init, :ok) do
        :ok ->
          :ok

        {:error, reason} ->
          Logger.warning("PluginLoader: Plugin #{name} init failed: #{inspect(reason)}")
      end
    end)
  end

  defp safe_call(module, function, default) do
    if function_exported?(module, function, 0) do
      apply(module, function, [])
    else
      default
    end
  end
end
