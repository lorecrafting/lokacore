defmodule Loka.Framework.Quest.ObjectiveRegistry do
  @moduledoc """
  Registry for quest objective handlers.

  Manages registration and lookup of objective handlers, making the quest system
  extensible without modifying core code.

  ## Usage

      # Register a custom handler
      ObjectiveRegistry.register(MyGame.Quest.Handlers.EscortHandler)

      # Get handler for an objective type
      {:ok, handler} = ObjectiveRegistry.get(:escort)

      # List all registered types
      ObjectiveRegistry.list_types()
      # => [:kill, :get_item, :go_to, :talk, :escort]

      # Check if a type is registered
      ObjectiveRegistry.registered?(:kill)
      # => true

  ## Built-in Handlers

  The following handlers are registered automatically at startup:

  - `Loka.Framework.Quest.Handlers.KillHandler` - `:kill`
  - `Loka.Framework.Quest.Handlers.GetItemHandler` - `:get_item`
  - `Loka.Framework.Quest.Handlers.GoToHandler` - `:go_to`
  - `Loka.Framework.Quest.Handlers.TalkHandler` - `:talk`

  ## Adding Custom Handlers

  To add a custom objective type:

  1. Create a module implementing `Loka.Framework.Quest.ObjectiveHandler`
  2. Register it at application startup:

      # In your application.ex
      def start(_type, _args) do
        # After supervisor starts...
        Loka.Framework.Quest.ObjectiveRegistry.register(MyHandler)
      end

  3. Use the new type in quest YAML files:

      objectives:
        - id: escort_merchant
          type: escort
          target_id: merchant_chen
          target_distance: 100
          description: "Escort the merchant to safety"
  """

  use GenServer
  require Logger

  alias Loka.Framework.Quest.ObjectiveHandler

  @table :loka_objective_handlers

  # Built-in handlers to register at startup
  @builtin_handlers [
    Loka.Framework.Quest.Handlers.KillHandler,
    Loka.Framework.Quest.Handlers.GetItemHandler,
    Loka.Framework.Quest.Handlers.GoToHandler,
    Loka.Framework.Quest.Handlers.TalkHandler,
    Loka.Framework.Quest.Handlers.CraftHandler
  ]

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the objective registry.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Registers an objective handler module.

  The handler must implement the `Loka.Framework.Quest.ObjectiveHandler` behaviour.

  ## Examples

      iex> ObjectiveRegistry.register(MyHandler)
      :ok

      iex> ObjectiveRegistry.register(InvalidModule)
      {:error, :invalid_handler}
  """
  def register(handler_module, server \\ __MODULE__) do
    GenServer.call(server, {:register, handler_module})
  end

  @doc """
  Unregisters an objective handler by type.

  ## Examples

      iex> ObjectiveRegistry.unregister(:escort)
      :ok
  """
  def unregister(type, server \\ __MODULE__) when is_atom(type) do
    GenServer.call(server, {:unregister, type})
  end

  @doc """
  Gets the handler module for an objective type.

  ## Examples

      iex> ObjectiveRegistry.get(:kill)
      {:ok, Loka.Framework.Quest.Handlers.KillHandler}

      iex> ObjectiveRegistry.get(:unknown)
      {:error, :not_found}
  """
  def get(type, server \\ __MODULE__) when is_atom(type) do
    GenServer.call(server, {:get, type})
  end

  @doc """
  Gets the handler module for an objective type, raises if not found.
  """
  def get!(type, server \\ __MODULE__) when is_atom(type) do
    case get(type, server) do
      {:ok, handler} -> handler
      {:error, :not_found} -> raise "No handler registered for objective type: #{type}"
    end
  end

  @doc """
  Lists all registered objective types.

  ## Examples

      iex> ObjectiveRegistry.list_types()
      [:kill, :get_item, :go_to, :talk]
  """
  def list_types(server \\ __MODULE__) do
    GenServer.call(server, :list_types)
  end

  @doc """
  Lists all registered handlers with their types.

  ## Examples

      iex> ObjectiveRegistry.list_handlers()
      [
        {:kill, Loka.Framework.Quest.Handlers.KillHandler},
        {:get_item, Loka.Framework.Quest.Handlers.GetItemHandler},
        ...
      ]
  """
  def list_handlers(server \\ __MODULE__) do
    GenServer.call(server, :list_handlers)
  end

  @doc """
  Checks if a handler is registered for the given type.
  """
  def registered?(type, server \\ __MODULE__) when is_atom(type) do
    case get(type, server) do
      {:ok, _} -> true
      {:error, _} -> false
    end
  end

  @doc """
  Checks if an event matches an objective and returns progress update info.

  This is the main entry point for the quest progress system.

  ## Parameters

  - `objective_def` - The objective definition (struct or map)
  - `event` - The game event

  ## Returns

  - `{:ok, handler, new_progress, is_complete}` if the event matches
  - `:no_match` if the event doesn't match this objective
  - `{:error, :unknown_type}` if no handler is registered for the objective type
  """
  def check_event(objective_def, event, current_progress, server \\ __MODULE__) do
    type = get_objective_type(objective_def)

    case get(type, server) do
      {:ok, handler} ->
        if handler.matches?(objective_def, event) do
          new_progress = handler.progress(objective_def, event, current_progress)
          is_complete = handler.is_complete?(objective_def, new_progress)
          {:ok, handler, new_progress, is_complete}
        else
          :no_match
        end

      {:error, :not_found} ->
        {:error, :unknown_type}
    end
  end

  @doc """
  Validates an objective definition using its handler.

  ## Returns

  - `:ok` if valid
  - `{:error, reason}` if invalid
  - `{:error, :unknown_type}` if no handler registered
  """
  def validate_objective(objective_def, server \\ __MODULE__) do
    type = get_objective_type(objective_def)

    case get(type, server) do
      {:ok, handler} -> handler.validate(objective_def)
      {:error, :not_found} -> {:error, "Unknown objective type: #{type}"}
    end
  end

  @doc """
  Gets a description for an objective using its handler.
  """
  def describe_objective(objective_def, progress, server \\ __MODULE__) do
    type = get_objective_type(objective_def)

    case get(type, server) do
      {:ok, handler} ->
        if function_exported?(handler, :description, 2) do
          handler.description(objective_def, progress)
        else
          ObjectiveHandler.default_description(objective_def, progress)
        end

      {:error, :not_found} ->
        ObjectiveHandler.default_description(objective_def, progress)
    end
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    table = :ets.new(@table, [:set, :protected, read_concurrency: true])
    register_builtins = Keyword.get(opts, :register_builtins, true)

    state = %{table: table, handlers: %{}}

    state =
      if register_builtins do
        Enum.reduce(@builtin_handlers, state, fn handler, acc ->
          case do_register(acc, handler) do
            {:ok, new_state} -> new_state
            {:error, _} -> acc
          end
        end)
      else
        state
      end

    count = map_size(state.handlers)
    Logger.info("#{__MODULE__} started with #{count} handlers")

    {:ok, state}
  end

  @impl true
  def handle_call({:register, handler_module}, _from, state) do
    case do_register(state, handler_module) do
      {:ok, new_state} ->
        type = handler_module.type()
        Logger.debug("#{__MODULE__}: Registered handler for :#{type}")
        {:reply, :ok, new_state}

      {:error, _reason} = error ->
        {:reply, error, state}
    end
  end

  @impl true
  def handle_call({:unregister, type}, _from, state) do
    :ets.delete(state.table, type)
    new_handlers = Map.delete(state.handlers, type)
    Logger.debug("#{__MODULE__}: Unregistered handler for :#{type}")
    {:reply, :ok, %{state | handlers: new_handlers}}
  end

  @impl true
  def handle_call({:get, type}, _from, state) do
    result =
      case Map.get(state.handlers, type) do
        nil -> {:error, :not_found}
        handler -> {:ok, handler}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:list_types, _from, state) do
    types = Map.keys(state.handlers)
    {:reply, types, state}
  end

  @impl true
  def handle_call(:list_handlers, _from, state) do
    handlers = Enum.map(state.handlers, fn {type, handler} -> {type, handler} end)
    {:reply, handlers, state}
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp do_register(state, handler_module) do
    # Verify the module implements the behaviour
    if implements_behaviour?(handler_module) do
      type = handler_module.type()
      :ets.insert(state.table, {type, handler_module})
      new_handlers = Map.put(state.handlers, type, handler_module)
      {:ok, %{state | handlers: new_handlers}}
    else
      {:error, :invalid_handler}
    end
  end

  defp implements_behaviour?(module) do
    # Check if module exports the required callbacks
    Code.ensure_loaded?(module) &&
      function_exported?(module, :type, 0) &&
      function_exported?(module, :matches?, 2) &&
      function_exported?(module, :progress, 3) &&
      function_exported?(module, :is_complete?, 2) &&
      function_exported?(module, :validate, 1)
  end

  defp get_objective_type(objective_def) do
    type = Map.get(objective_def, :type) || Map.get(objective_def, "type")

    cond do
      is_atom(type) -> type
      is_binary(type) -> String.to_existing_atom(type)
      true -> nil
    end
  rescue
    ArgumentError -> nil
  end
end
