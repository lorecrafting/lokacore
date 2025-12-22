defmodule Exmud.Engine.Hooks do
  @moduledoc """
  Register and execute callbacks for engine lifecycle events.

  Hooks provide extension points for the framework layer.
  Unlike events (fire-and-forget), hooks can:
  - Return values that modify behavior
  - Be executed in priority order
  - Halt processing chain

  ## Usage

      # Register a hook (typically in application startup)
      Hooks.register(:at_entity_creation, MyFramework.Combat, :on_create, priority: 10)

      # In engine code, run hooks
      Hooks.run(:at_entity_creation, [entity, context])

      # Or run until one returns {:halt, reason}
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
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Registers a hook callback.

  ## Parameters

  - `hook_type` - One of the defined hook types (see moduledoc)
  - `module` - Module containing the callback function
  - `function` - Function name (atom)
  - `opts` - Options
    - `:priority` - Execution order (lower = earlier, default: 100)
    - `:server` - Server name (default: __MODULE__)

  ## Examples

      Hooks.register(:at_entity_creation, MyGame.Combat, :on_entity_create)
      Hooks.register(:at_before_move, MyGame.Movement, :check_can_move, priority: 10)
  """
  @spec register(atom(), module(), atom(), keyword()) :: :ok | {:error, term()}
  def register(hook_type, module, function, opts \\ []) do
    server = Keyword.get(opts, :server, __MODULE__)
    priority = Keyword.get(opts, :priority, 100)

    if valid_hook_type?(hook_type) do
      GenServer.call(server, {:register, hook_type, {module, function}, priority})
    else
      {:error, {:invalid_hook_type, hook_type, @hook_types}}
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
  Runs hooks until one returns `{:halt, reason}`.

  Returns `:ok` if all hooks pass, or `{:halt, reason}` if any hook
  requests a halt. Useful for validation hooks.

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
  def init(_opts) do
    {:ok, %{}}
  end

  @impl true
  def handle_call({:register, hook_type, {module, function}, priority}, _from, state) do
    hooks = Map.get(state, hook_type, [])

    # Check for duplicates
    if Enum.any?(hooks, fn {_p, mf} -> mf == {module, function} end) do
      {:reply, :ok, state}
    else
      new_hook = {priority, {module, function}}
      updated_hooks = [new_hook | hooks] |> Enum.sort_by(fn {p, _} -> p end)
      Logger.debug("Hooks: registered #{hook_type} -> #{inspect(module)}.#{function}")
      {:reply, :ok, Map.put(state, hook_type, updated_hooks)}
    end
  end

  @impl true
  def handle_call({:unregister, hook_type, {module, function}}, _from, state) do
    hooks = Map.get(state, hook_type, [])
    updated_hooks = Enum.reject(hooks, fn {_p, mf} -> mf == {module, function} end)
    {:reply, :ok, Map.put(state, hook_type, updated_hooks)}
  end

  @impl true
  def handle_call({:run, hook_type, args}, _from, state) do
    hooks = Map.get(state, hook_type, [])

    Enum.each(hooks, fn {_priority, {module, function}} ->
      try do
        apply(module, function, args)
      rescue
        e ->
          Logger.error("Hooks: error in #{hook_type} hook #{inspect(module)}.#{function}: #{inspect(e)}")
      end
    end)

    {:reply, :ok, state}
  end

  @impl true
  def handle_call({:run_until_halt, hook_type, args}, _from, state) do
    hooks = Map.get(state, hook_type, [])

    result =
      Enum.reduce_while(hooks, :ok, fn {_priority, {module, function}}, _acc ->
        try do
          case apply(module, function, args) do
            {:halt, reason} -> {:halt, {:halt, reason}}
            _ -> {:cont, :ok}
          end
        rescue
          e ->
            Logger.error("Hooks: error in #{hook_type} hook #{inspect(module)}.#{function}: #{inspect(e)}")
            {:cont, :ok}
        end
      end)

    {:reply, result, state}
  end

  @impl true
  def handle_call({:list_hooks, hook_type}, _from, state) do
    hooks = Map.get(state, hook_type, [])
    {:reply, hooks, state}
  end

  @impl true
  def handle_call(:clear_all, _from, _state) do
    {:reply, :ok, %{}}
  end
end
