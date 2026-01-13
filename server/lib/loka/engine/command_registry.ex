defmodule Loka.Engine.CommandRegistry do
  @moduledoc """
  Registry for game commands with centralized dispatch.

  Manages registration and lookup of command handlers, enabling:
  - Dynamic command registration without code changes
  - Command discovery and help generation
  - Unified dispatch across client types (LiveView, SSH, mobile)
  - Alias support for command shortcuts

  ## Usage

      # Register a command
      CommandRegistry.register(MyGame.Commands.LookCommand)

      # Execute a command by key
      {:ok, events} = CommandRegistry.execute("look", "", context)

      # Execute using an alias
      {:ok, events} = CommandRegistry.execute("l", "", context)

      # List all commands
      CommandRegistry.list_commands()
      # => ["look", "get", "attack", ...]

      # Get help for a command
      CommandRegistry.help("look")
      # => "Look at your surroundings or a specific target."

  ## Built-in Commands

  Commands are registered at startup from `Loka.Engine.Commands.*` modules.

  ## Adding Custom Commands

  1. Create a module using `Loka.Engine.Command`:

      defmodule MyGame.Commands.DanceCommand do
        use Loka.Engine.Command

        def key, do: "dance"
        def aliases, do: ["boogie"]
        def help, do: "Dance enthusiastically."

        def parse(_args, _context), do: {:ok, %{}}

        def execute(_parsed, context) do
          {:ok, [%Event{type: :emote, data: %{text: "You dance!"}}]}
        end
      end

  2. Register at application startup:

      CommandRegistry.register(MyGame.Commands.DanceCommand)

  ## Context Structure

  The context passed to commands contains:

      %{
        actor: map(),      # The entity executing (player entity or game_state)
        location: map(),   # Current room
        session: pid()     # Session process for messaging
      }
  """

  use GenServer
  require Logger

  @table :loka_commands
  @alias_table :loka_command_aliases

  # Engine-only commands (no Framework dependencies)
  # Game-specific commands are registered via :command_modules config
  # NOTE: Using module name atoms to avoid compile-time circular dependencies
  @engine_command_names [
    :"Elixir.Loka.Engine.Commands.LookCommand",
    :"Elixir.Loka.Engine.Commands.HelpCommand"
  ]

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the command registry.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Registers a command module.

  The module must use `Loka.Engine.Command` behaviour.

  ## Examples

      iex> CommandRegistry.register(LookCommand)
      :ok

      iex> CommandRegistry.register(InvalidModule)
      {:error, :invalid_command}
  """
  def register(command_module, server \\ __MODULE__) do
    GenServer.call(server, {:register, command_module})
  end

  @doc """
  Unregisters a command by key.

  ## Examples

      iex> CommandRegistry.unregister("dance")
      :ok
  """
  def unregister(key, server \\ __MODULE__) when is_binary(key) do
    GenServer.call(server, {:unregister, key})
  end

  @doc """
  Gets the command module for a key or alias.

  ## Examples

      iex> CommandRegistry.get("look")
      {:ok, Loka.Engine.Commands.LookCommand}

      iex> CommandRegistry.get("l")  # alias
      {:ok, Loka.Engine.Commands.LookCommand}

      iex> CommandRegistry.get("unknown")
      {:error, :not_found}
  """
  def get(key_or_alias, server \\ __MODULE__) when is_binary(key_or_alias) do
    GenServer.call(server, {:get, key_or_alias})
  end

  @doc """
  Gets the command module, raises if not found.
  """
  def get!(key_or_alias, server \\ __MODULE__) when is_binary(key_or_alias) do
    case get(key_or_alias, server) do
      {:ok, command} -> command
      {:error, :not_found} -> raise "No command registered for: #{key_or_alias}"
    end
  end

  @doc """
  Executes a command by key or alias.

  This is the main entry point for command dispatch. It:
  1. Looks up the command module
  2. Checks locks/permissions
  3. Parses the arguments
  4. Executes and returns events

  ## Parameters

  - `key_or_alias` - The command key or alias (e.g., "look" or "l")
  - `args` - The raw argument string
  - `context` - Command context with actor, location, session

  ## Returns

  - `{:ok, [Event.t()]}` - Success with events to emit
  - `{:error, :not_found}` - Command not found
  - `{:error, :access_denied}` - Lock check failed
  - `{:error, String.t()}` - Parse or execute error
  """
  def execute(key_or_alias, args, context, server \\ __MODULE__) do
    start_time = System.monotonic_time()
    actor_id = get_in(context, [:actor, :player_id])

    case get(key_or_alias, server) do
      {:ok, command_module} ->
        result = do_execute(command_module, args, context)
        duration = System.monotonic_time() - start_time

        # Emit telemetry for observability
        :telemetry.execute(
          [:loka, :command, :execute],
          %{duration: duration},
          %{
            command: command_module.key(),
            args: args,
            actor_id: actor_id,
            success: match?({:ok, _}, result)
          }
        )

        Logger.debug("Command executed: #{command_module.key()} by #{actor_id || "unknown"}")
        result

      {:error, :not_found} = error ->
        # Log unknown command attempts
        Logger.debug("Unknown command: #{key_or_alias} by #{actor_id || "unknown"}")
        error
    end
  end

  @doc """
  Lists all registered command keys.

  ## Examples

      iex> CommandRegistry.list_commands()
      ["look", "get", "attack"]
  """
  def list_commands(server \\ __MODULE__) do
    GenServer.call(server, :list_commands)
  end

  @doc """
  Lists all commands with their modules.

  ## Examples

      iex> CommandRegistry.list_all()
      [{"look", LookCommand}, {"get", GetCommand}]
  """
  def list_all(server \\ __MODULE__) do
    GenServer.call(server, :list_all)
  end

  @doc """
  Checks if a command is registered for the given key or alias.
  """
  def registered?(key_or_alias, server \\ __MODULE__) when is_binary(key_or_alias) do
    case get(key_or_alias, server) do
      {:ok, _} -> true
      {:error, _} -> false
    end
  end

  @doc """
  Gets the help text for a command.

  ## Examples

      iex> CommandRegistry.help("look")
      {:ok, "Look at your surroundings or a specific target."}

      iex> CommandRegistry.help("unknown")
      {:error, :not_found}
  """
  def help(key_or_alias, server \\ __MODULE__) when is_binary(key_or_alias) do
    case get(key_or_alias, server) do
      {:ok, command_module} -> {:ok, command_module.help()}
      {:error, :not_found} = error -> error
    end
  end

  @doc """
  Gets all aliases for a command.
  """
  def aliases(key, server \\ __MODULE__) when is_binary(key) do
    case get(key, server) do
      {:ok, command_module} -> {:ok, command_module.aliases()}
      {:error, :not_found} = error -> error
    end
  end

  @doc """
  Returns command info for help generation.

  ## Returns

  List of maps with :key, :aliases, :help for each command.
  """
  def command_info(server \\ __MODULE__) do
    GenServer.call(server, :command_info)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    table = :ets.new(@table, [:set, :protected, read_concurrency: true])
    alias_table = :ets.new(@alias_table, [:set, :protected, read_concurrency: true])
    register_builtins = Keyword.get(opts, :register_builtins, true)

    state = %{table: table, alias_table: alias_table, commands: %{}, aliases: %{}}

    state =
      if register_builtins do
        # Register engine-only commands first (no Framework dependencies)
        state =
          Enum.reduce(@engine_command_names, state, fn command, acc ->
            case do_register(acc, command) do
              {:ok, new_state} -> new_state
              {:error, _} -> acc
            end
          end)

        # Register game-specific commands from config (Framework layer)
        config_commands = Application.get_env(:loka, :command_modules, [])

        Enum.reduce(config_commands, state, fn command, acc ->
          case do_register(acc, command) do
            {:ok, new_state} -> new_state
            {:error, _} -> acc
          end
        end)
      else
        state
      end

    count = map_size(state.commands)
    Logger.info("#{__MODULE__} started with #{count} commands")

    {:ok, state}
  end

  @impl true
  def handle_call({:register, command_module}, _from, state) do
    case do_register(state, command_module) do
      {:ok, new_state} ->
        key = command_module.key()
        Logger.debug("#{__MODULE__}: Registered command '#{key}'")
        {:reply, :ok, new_state}

      {:error, _reason} = error ->
        {:reply, error, state}
    end
  end

  @impl true
  def handle_call({:unregister, key}, _from, state) do
    case Map.get(state.commands, key) do
      nil ->
        {:reply, {:error, :not_found}, state}

      command_module ->
        # Remove from main table
        :ets.delete(state.table, key)

        # Remove aliases
        aliases = command_module.aliases()

        Enum.each(aliases, fn alias_key ->
          :ets.delete(state.alias_table, alias_key)
        end)

        new_commands = Map.delete(state.commands, key)

        new_aliases =
          Enum.reduce(aliases, state.aliases, fn alias_key, acc ->
            Map.delete(acc, alias_key)
          end)

        Logger.debug("#{__MODULE__}: Unregistered command '#{key}'")
        {:reply, :ok, %{state | commands: new_commands, aliases: new_aliases}}
    end
  end

  @impl true
  def handle_call({:get, key_or_alias}, _from, state) do
    result =
      case Map.get(state.commands, key_or_alias) do
        nil ->
          # Try alias lookup
          case Map.get(state.aliases, key_or_alias) do
            nil -> {:error, :not_found}
            command -> {:ok, command}
          end

        command ->
          {:ok, command}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:list_commands, _from, state) do
    keys = Map.keys(state.commands)
    {:reply, keys, state}
  end

  @impl true
  def handle_call(:list_all, _from, state) do
    commands = Enum.map(state.commands, fn {key, module} -> {key, module} end)
    {:reply, commands, state}
  end

  @impl true
  def handle_call(:command_info, _from, state) do
    info =
      Enum.map(state.commands, fn {key, module} ->
        %{
          key: key,
          aliases: module.aliases(),
          help: module.help()
        }
      end)

    {:reply, info, state}
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp do_register(state, command_module) do
    if implements_behaviour?(command_module) do
      key = command_module.key()
      aliases = command_module.aliases()

      # Insert main command
      :ets.insert(state.table, {key, command_module})
      new_commands = Map.put(state.commands, key, command_module)

      # Insert aliases
      Enum.each(aliases, fn alias_key ->
        :ets.insert(state.alias_table, {alias_key, command_module})
      end)

      new_aliases =
        Enum.reduce(aliases, state.aliases, fn alias_key, acc ->
          Map.put(acc, alias_key, command_module)
        end)

      {:ok, %{state | commands: new_commands, aliases: new_aliases}}
    else
      {:error, :invalid_command}
    end
  end

  defp implements_behaviour?(module) do
    Code.ensure_loaded?(module) &&
      function_exported?(module, :key, 0) &&
      function_exported?(module, :help, 0) &&
      function_exported?(module, :parse, 2) &&
      function_exported?(module, :execute, 2)
  end

  defp do_execute(command_module, args, context) do
    # Check locks if any
    locks = command_module.locks()

    with :ok <- check_locks(locks, context),
         :ok <- validate_context(command_module, context),
         {:ok, parsed} <- command_module.parse(args, context),
         {:ok, events} <- command_module.execute(parsed, context) do
      {:ok, events}
    else
      {:error, reason} -> {:error, reason}
      {:denied, reason} -> {:error, {:access_denied, reason}}
    end
  end

  defp validate_context(command_module, context) do
    if function_exported?(command_module, :required_context, 0) do
      required = command_module.required_context()
      missing = Enum.reject(required, &Map.has_key?(context, &1))

      case missing do
        [] ->
          :ok

        keys ->
          Logger.warning("Command #{command_module.key()} missing context keys: #{inspect(keys)}")

          {:error, "Missing required context: #{inspect(keys)}"}
      end
    else
      :ok
    end
  end

  defp check_locks([], _context), do: :ok

  defp check_locks(locks, context) do
    actor = Map.get(context, :actor)

    if actor do
      # Check each lock using the Locks module
      # Locks.check expects (entity, accessor, access_type)
      # For command locks, we check if the actor has the required permission
      Enum.reduce_while(locks, :ok, fn lock, _acc ->
        # For now, command locks are permission-based
        # This is a simplified check - full implementation would use Locks.check
        if has_permission?(actor, lock) do
          {:cont, :ok}
        else
          {:halt, {:denied, "Missing permission: #{lock}"}}
        end
      end)
    else
      :ok
    end
  end

  defp has_permission?(actor, lock) do
    # Check if actor has the required permission tag
    permissions = Map.get(actor, :permissions, [])
    is_admin = Map.get(actor, :is_admin, false)

    is_admin || lock in permissions || :admin in permissions
  end
end
