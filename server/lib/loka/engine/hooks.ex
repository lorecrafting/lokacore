defmodule Loka.Engine.Hooks do
  @moduledoc """
  Register and execute callbacks for engine lifecycle events.

  Hooks provide extension points for the framework layer.
  Unlike events (fire-and-forget), hooks can:
  - Return values that modify behavior
  - Be executed in priority order
  - Halt processing chain

  ## Sync vs Async Execution

  - `run/3` - Synchronous execution, blocks until all hooks complete
  - `run_async/3` - Non-blocking execution via Task.Supervisor
  - `run_until_halt/3` - Synchronous validation, stops on {:halt, reason}

  Use `run_async/3` for "after" hooks that don't affect control flow.
  Use `run/3` or `run_until_halt/3` for hooks that must complete before continuing.

  ## Usage

      # Register a hook (typically in application startup)
      Hooks.register(:at_entity_creation, MyFramework.Combat, :on_create, priority: 10)

      # Synchronous execution (blocks until complete)
      Hooks.run(:at_entity_creation, [entity, context])

      # Async execution (returns immediately, hooks run in background)
      Hooks.run_async(:at_after_move, [entity, old_room, new_room])

      # Validation hooks (run until one returns {:halt, reason})
      case Hooks.run_until_halt(:at_before_move, [entity, destination]) do
        :ok -> proceed_with_move()
        {:halt, reason} -> cancel_move(reason)
      end

  ## Hook Types

  ### Entity Lifecycle
  - `:at_entity_creation` - Called after an entity is created
  - `:at_entity_delete` - Called before an entity is deleted
  - `:at_pre_save` - Called before saving entity to database
  - `:at_post_load` - Called after loading entity from database

  ### Movement
  - `:at_before_move` - Called before moving (can halt)
  - `:at_after_move` - Called after successful move
  - `:at_enter_room` - Called when entering a room
  - `:at_leave_room` - Called when leaving a room

  ### Perception
  - `:at_before_look` - Called before look command (can modify)
  - `:at_after_look` - Called after look command
  - `:at_object_receive` - Called when receiving an object
  - `:at_object_leave` - Called when an object leaves

  ### Communication
  - `:at_before_say` - Called before say (can modify/halt)
  - `:at_after_say` - Called after say

  ### Commands
  - `:at_pre_command` - Called before any command (can halt)
  - `:at_post_command` - Called after command execution
  - `:at_command_fail` - Called when command fails

  ### Combat (framework registers these)
  - `:at_before_attack` - Before attack (can halt)
  - `:at_after_attack` - After attack
  - `:at_damage` - When damage is dealt
  - `:at_death` - When entity dies

  ### Scripts
  - `:at_script_execute` - Before script execution
  - `:at_script_error` - When script errors
  """

  use GenServer

  require Logger

  @typedoc """
  Valid return types from hooks executed via `run_until_halt/3`.

  - `:ok` - Continue to next hook
  - `{:ok, term()}` - Continue with optional data (ignored by run_until_halt)
  - `{:halt, reason}` - Stop hook chain and return halt reason
  """
  @type hook_result :: :ok | {:ok, term()} | {:halt, String.t() | atom()}

  # Default TaskSupervisor, can be overridden via start_link opts for testing
  @default_task_supervisor Loka.Engine.Hooks.TaskSupervisor

  @hook_types [
    # Entity lifecycle
    :at_entity_creation,
    :at_entity_delete,
    :at_pre_save,
    :at_post_load,
    # Movement
    :at_before_move,
    :at_after_move,
    :at_enter_room,
    :at_leave_room,
    # Perception
    :at_before_look,
    :at_after_look,
    :at_object_receive,
    :at_object_leave,
    # Communication
    :at_before_say,
    :at_after_say,
    # Commands
    :at_pre_command,
    :at_post_command,
    :at_command_fail,
    # Combat
    :at_before_attack,
    :at_after_attack,
    :at_damage,
    :at_death,
    # Scripts
    :at_script_execute,
    :at_script_error
  ]

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the Hooks GenServer.

  ## Options

  - `:name` - Process name (default: __MODULE__)
  - `:task_supervisor` - TaskSupervisor for async hooks (default: `Loka.Engine.Hooks.TaskSupervisor`).
    Useful for testing without the full supervision tree.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Registers a hook callback.

  The callback function must exist and be exported by the module. If the function
  doesn't exist or has the wrong arity, registration will fail with an error.

  ## Parameters

  - `hook_type` - One of the defined hook types (see moduledoc)
  - `module` - Module containing the callback function
  - `function` - Function name (atom)
  - `opts` - Options
    - `:priority` - Execution order (lower = earlier, default: 100)
    - `:server` - Server name (default: __MODULE__)
    - `:skip_validation` - Skip callback validation (for testing, default: false)

  ## Examples

      Hooks.register(:at_entity_creation, MyGame.Combat, :on_entity_create)
      Hooks.register(:at_before_move, MyGame.Movement, :check_can_move, priority: 10)

  ## Errors

      {:error, {:invalid_hook_type, type, valid_types}}
      {:error, {:callback_not_found, module, function}}
      {:error, {:module_not_loaded, module}}
  """
  @spec register(atom(), module(), atom(), keyword()) :: :ok | {:error, term()}
  def register(hook_type, module, function, opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)
    priority = Keyword.get(opts, :priority, 100)
    skip_validation = Keyword.get(opts, :skip_validation, false)

    with :ok <- validate_hook_type(hook_type),
         :ok <- validate_callback(module, function, skip_validation) do
      GenServer.call(server, {:register, hook_type, {module, function}, priority})
    end
  end

  # Validates the hook type
  defp validate_hook_type(hook_type) do
    if valid_hook_type?(hook_type) do
      :ok
    else
      {:error, {:invalid_hook_type, hook_type, @hook_types}}
    end
  end

  # Validates that the callback function exists
  defp validate_callback(_module, _function, true), do: :ok

  defp validate_callback(module, function, false) do
    # First check if module is loaded/exists
    case Code.ensure_loaded(module) do
      {:module, ^module} ->
        # Check if function is exported with any arity (hooks have variable arities)
        exports = module.__info__(:functions)

        if Enum.any?(exports, fn {name, _arity} -> name == function end) do
          :ok
        else
          Logger.error(
            "Hook registration failed: #{inspect(module)}.#{function} not found. " <>
              "Available functions: #{inspect(Enum.map(exports, fn {n, a} -> "#{n}/#{a}" end))}"
          )

          {:error, {:callback_not_found, module, function}}
        end

      {:error, reason} ->
        Logger.error(
          "Hook registration failed: module #{inspect(module)} could not be loaded: #{reason}"
        )

        {:error, {:module_not_loaded, module}}
    end
  end

  @doc """
  Unregisters a hook callback.

  ## Examples

      Hooks.unregister(:at_entity_creation, MyGame.Combat, :on_entity_create)
  """
  @spec unregister(atom(), module(), atom(), keyword()) :: :ok
  def unregister(hook_type, module, function, opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)
    GenServer.call(server, {:unregister, hook_type, {module, function}})
  end

  @doc """
  Runs all registered hooks for a hook type.

  Executes each hook in priority order. Return values are collected
  but generally ignored (use `run_until_halt/3` for control flow).

  ## Examples

      Hooks.run(:at_entity_creation, [entity, %{spawned_by: "system"}])
  """
  @spec run(atom(), list(), keyword()) :: :ok
  def run(hook_type, args, opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)
    GenServer.call(server, {:run, hook_type, args})
  end

  @doc """
  Runs all registered hooks asynchronously (non-blocking).

  Returns immediately after spawning tasks. Hook execution happens
  in the background via Task.Supervisor. Use this for "after" hooks
  that don't affect control flow.

  ## Options

  - `:server` - Server name (default: __MODULE__)

  ## Examples

      # Fire-and-forget for after hooks
      Hooks.run_async(:at_after_move, [entity, old_room, new_room])
      Hooks.run_async(:at_entity_creation, [entity, context])
  """
  @spec run_async(atom(), list(), keyword()) :: :ok
  def run_async(hook_type, args, opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)
    GenServer.cast(server, {:run_async, hook_type, args})
  end

  @doc """
  Runs hooks until one returns `{:halt, reason}`.

  Returns `:ok` if all hooks pass, or `{:halt, reason}` if any hook
  requests a halt. Useful for validation hooks.

  This always runs synchronously since validation requires blocking.

  ## Examples

      case Hooks.run_until_halt(:at_before_move, [entity, destination]) do
        :ok -> do_move(entity, destination)
        {:halt, :blocked} -> {:error, "Movement blocked"}
      end
  """
  @spec run_until_halt(atom(), list(), keyword()) :: :ok | {:halt, term()}
  def run_until_halt(hook_type, args, opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)
    GenServer.call(server, {:run_until_halt, hook_type, args})
  end

  @doc """
  Lists all hooks registered for a hook type.

  Returns a list of `{priority, {module, function}}` tuples.
  """
  @spec list_hooks(atom(), keyword()) :: [{integer(), {module(), atom()}}]
  def list_hooks(hook_type, opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)
    GenServer.call(server, {:list_hooks, hook_type})
  end

  @doc """
  Clears all registered hooks. Useful for testing.
  """
  @spec clear_all(keyword()) :: :ok
  def clear_all(opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)
    GenServer.call(server, :clear_all)
  end

  @doc """
  Returns the list of valid hook types.
  """
  @spec hook_types() :: [atom()]
  def hook_types, do: @hook_types

  @doc """
  Checks if a hook type is valid.
  """
  @spec valid_hook_type?(atom()) :: boolean()
  def valid_hook_type?(hook_type), do: hook_type in @hook_types

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    task_supervisor = Keyword.get(opts, :task_supervisor, @default_task_supervisor)
    {:ok, %{hooks: %{}, task_supervisor: task_supervisor}}
  end

  @impl true
  def handle_call({:register, hook_type, {module, function}, priority}, _from, state) do
    hooks = Map.get(state.hooks, hook_type, [])

    # Check for duplicates
    if Enum.any?(hooks, fn {_p, mf} -> mf == {module, function} end) do
      {:reply, :ok, state}
    else
      new_hook = {priority, {module, function}}
      updated_hooks = [new_hook | hooks] |> Enum.sort_by(fn {p, _} -> p end)
      Logger.debug("Hooks: registered #{hook_type} -> #{inspect(module)}.#{function}")
      {:reply, :ok, put_in(state.hooks[hook_type], updated_hooks)}
    end
  end

  @impl true
  def handle_call({:unregister, hook_type, {module, function}}, _from, state) do
    hooks = Map.get(state.hooks, hook_type, [])
    updated_hooks = Enum.reject(hooks, fn {_p, mf} -> mf == {module, function} end)
    {:reply, :ok, put_in(state.hooks[hook_type], updated_hooks)}
  end

  @impl true
  def handle_call({:run, hook_type, args}, _from, state) do
    hooks = Map.get(state.hooks, hook_type, [])
    start_time = System.monotonic_time()

    Enum.each(hooks, fn {_priority, {module, function}} ->
      hook_start = System.monotonic_time()

      try do
        apply(module, function, args)
      rescue
        e ->
          Logger.error(
            "Hooks: error in #{hook_type} hook #{inspect(module)}.#{function}: #{inspect(e)}"
          )
      end

      emit_hook_telemetry(hook_type, module, function, hook_start, :sync)
    end)

    emit_batch_telemetry(hook_type, length(hooks), start_time, :sync)
    {:reply, :ok, state}
  end

  @impl true
  def handle_call({:run_until_halt, hook_type, args}, _from, state) do
    hooks = Map.get(state.hooks, hook_type, [])
    start_time = System.monotonic_time()
    hooks_run = :counters.new(1, [:atomics])

    result =
      Enum.reduce_while(hooks, :ok, fn {_priority, {module, function}}, _acc ->
        hook_start = System.monotonic_time()
        :counters.add(hooks_run, 1, 1)

        try do
          result = apply(module, function, args)
          emit_hook_telemetry(hook_type, module, function, hook_start, :sync)

          case validate_hook_result(result, hook_type, module, function) do
            {:halt, reason} -> {:halt, {:halt, reason}}
            :ok -> {:cont, :ok}
          end
        rescue
          e ->
            Logger.error(
              "Hooks: error in #{hook_type} hook #{inspect(module)}.#{function}: #{inspect(e)}"
            )

            emit_hook_telemetry(hook_type, module, function, hook_start, :sync)
            {:cont, :ok}
        end
      end)

    emit_batch_telemetry(hook_type, :counters.get(hooks_run, 1), start_time, :sync)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:list_hooks, hook_type}, _from, state) do
    hooks = Map.get(state.hooks, hook_type, [])
    {:reply, hooks, state}
  end

  @impl true
  def handle_call(:clear_all, _from, state) do
    {:reply, :ok, %{state | hooks: %{}}}
  end

  @impl true
  def handle_cast({:run_async, hook_type, args}, state) do
    hooks = Map.get(state.hooks, hook_type, [])
    task_supervisor = state.task_supervisor

    # Spawn each hook as a separate task for parallel execution
    Enum.each(hooks, fn {_priority, {module, function}} ->
      Task.Supervisor.start_child(task_supervisor, fn ->
        hook_start = System.monotonic_time()

        try do
          apply(module, function, args)
        rescue
          e ->
            Logger.error(
              "Hooks: error in async #{hook_type} hook #{inspect(module)}.#{function}: #{inspect(e)}"
            )
        end

        emit_hook_telemetry(hook_type, module, function, hook_start, :async)
      end)
    end)

    {:noreply, state}
  end

  # =============================================================================
  # Hook Result Validation
  # =============================================================================

  @doc false
  # Validates hook return values and logs warnings for unexpected types.
  # Returns :ok for valid non-halt returns, or {:halt, reason} for valid halts.
  defp validate_hook_result(result, hook_type, module, function) do
    case result do
      :ok ->
        :ok

      {:ok, _} ->
        :ok

      {:halt, reason} when is_binary(reason) or is_atom(reason) ->
        {:halt, reason}

      {:halt, reason} ->
        Logger.warning(
          "Hook #{inspect(module)}.#{function} (#{hook_type}) returned {:halt, #{inspect(reason)}} - " <>
            "reason should be a string or atom for better error messages"
        )

        {:halt, inspect(reason)}

      other ->
        Logger.warning(
          "Hook #{inspect(module)}.#{function} (#{hook_type}) returned unexpected value: #{inspect(other)}. " <>
            "Expected :ok, {:ok, _}, or {:halt, reason}. Treating as :ok."
        )

        :ok
    end
  end

  # =============================================================================
  # Telemetry Helpers
  # =============================================================================

  defp emit_hook_telemetry(hook_type, module, function, start_time, mode) do
    duration = System.monotonic_time() - start_time

    :telemetry.execute(
      [:loka, :hooks, :execute],
      %{duration: duration},
      %{
        hook_type: hook_type,
        module: module,
        function: function,
        mode: mode
      }
    )
  end

  defp emit_batch_telemetry(hook_type, count, start_time, mode) do
    duration = System.monotonic_time() - start_time

    :telemetry.execute(
      [:loka, :hooks, :batch],
      %{duration: duration, count: count},
      %{
        hook_type: hook_type,
        mode: mode
      }
    )
  end
end
