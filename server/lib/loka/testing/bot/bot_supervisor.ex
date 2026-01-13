defmodule Loka.Testing.Bot.BotSupervisor do
  @moduledoc """
  DynamicSupervisor for managing testing bot lifecycles.

  Provides functions to spawn, stop, and list active bots.
  Each bot is a GenServer process managed by this supervisor.

  ## ⚠️  Deprecation Notice (2026)

  The legacy `spawn_bot/1` function uses the old Bot implementation (40% production parity).
  For storyline and integration tests, use ChannelBot directly instead:

  ```elixir
  # ✅ RECOMMENDED: ChannelBot (95% production parity)
  use Loka.ChannelCase
  {:ok, bot} = ChannelBot.start_link(socket: socket, strategy: StorylineRunner)

  # ⚠️  LEGACY: Direct bot (40% parity, load testing only)
  {:ok, pid} = BotSupervisor.spawn_bot(strategy: StorylineRunner)
  ```

  See `test/integration/storyline_channel_test.exs` for examples.

  ## Bot Types

  - **ChannelBot** (recommended): Executes actions through Phoenix channels, testing
    the full code path that real clients use (95% production parity).

  - **Bot** (legacy/deprecated): Directly calls framework modules. Faster but only
    40% production parity. Use for load testing only.

  ## Usage

      # Start the supervisor (usually done in application.ex for testing)
      {:ok, _pid} = BotSupervisor.start_link()

      # Spawn a channel-based bot (recommended - tests real code path)
      {:ok, pid} = BotSupervisor.spawn_channel_bot(
        strategy: Loka.Testing.Bot.Strategies.RandomWalker,
        strategy_opts: [max_steps: 100],
        name: "Test Bot 1"
      )

      # Or provide your own player
      {:ok, pid} = BotSupervisor.spawn_channel_bot(
        player: existing_player,
        strategy: RandomWalker
      )

      # Legacy direct-call bot (for backward compatibility)
      {:ok, pid} = BotSupervisor.spawn_bot(
        strategy: RandomWalker,
        use_channel: false
      )

      # List all active bots
      bots = BotSupervisor.list_bots()

      # Stop a specific bot
      :ok = BotSupervisor.stop_bot(pid)

      # Stop all bots
      :ok = BotSupervisor.stop_all()
  """

  use DynamicSupervisor

  require Logger

  alias Loka.Testing.Bot, as: LegacyBot
  alias Loka.Testing.Bot.ChannelBot
  alias Loka.Accounts

  @registry Loka.Testing.Bot.Registry

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the BotSupervisor.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    DynamicSupervisor.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Spawns a new channel-based bot (recommended).

  ChannelBot executes actions through Phoenix channels, testing the full code
  path that real clients use. This is the recommended way to test game logic.

  ## Options

  - `:strategy` - (required) The strategy module to use
  - `:player` - Player to use (default: creates a test player)
  - `:strategy_opts` - Options passed to strategy's init/1
  - `:name` - Bot name (default: player's name or auto-generated)
  - `:tick_interval_ms` - Time between decisions (default: 100ms)

  ## Returns

  - `{:ok, pid}` - Bot started successfully
  - `{:error, reason}` - Failed to start
  """
  def spawn_channel_bot(opts \\ []) do
    unless Keyword.has_key?(opts, :strategy) do
      raise ArgumentError, "must provide :strategy option"
    end

    # Get or create player
    player =
      case Keyword.fetch(opts, :player) do
        {:ok, player} -> player
        :error -> create_test_player()
      end

    bot_name = Keyword.get(opts, :name, player.name || "Bot #{player.id}")

    # Build bot config
    config = %{
      player: player,
      name: bot_name,
      strategy: Keyword.fetch!(opts, :strategy),
      strategy_opts: Keyword.get(opts, :strategy_opts, []),
      tick_interval_ms: Keyword.get(opts, :tick_interval_ms, 100)
    }

    # Start ChannelBot under supervisor
    spec = {ChannelBot, config}

    case DynamicSupervisor.start_child(__MODULE__, spec) do
      {:ok, pid} ->
        maybe_register(player.id, pid)
        Logger.info("BotSupervisor: Started ChannelBot #{bot_name} (#{player.id})")
        {:ok, pid}

      {:error, reason} = error ->
        Logger.error("BotSupervisor: Failed to start ChannelBot - #{inspect(reason)}")
        error
    end
  end

  @doc """
  Spawns a legacy bot (for backward compatibility).

  The legacy bot directly calls framework modules instead of going through
  channels. This is faster but doesn't test the channel layer.

  Use `spawn_channel_bot/1` instead for realistic testing.

  ## Options

  - `:strategy` - (required) The strategy module to use
  - `:strategy_opts` - Options passed to strategy's init/1
  - `:name` - Bot name (default: auto-generated)
  - `:starting_room_id` - Room to start in (default: world's starting room)
  - `:tick_interval_ms` - Time between decisions (default: 1000)

  ## Returns

  - `{:ok, pid}` - Bot started successfully
  - `{:error, reason}` - Failed to start
  """
  def spawn_bot(opts \\ []) do
    # Ensure required options
    unless Keyword.has_key?(opts, :strategy) do
      raise ArgumentError, "must provide :strategy option"
    end

    # Generate bot ID and name
    bot_id = generate_bot_id()
    bot_name = Keyword.get(opts, :name, "Bot #{bot_id}")

    # Build bot config
    config = %{
      id: bot_id,
      name: bot_name,
      strategy: Keyword.fetch!(opts, :strategy),
      strategy_opts: Keyword.get(opts, :strategy_opts, []),
      starting_room_id: Keyword.get(opts, :starting_room_id),
      tick_interval_ms: Keyword.get(opts, :tick_interval_ms, 1000)
    }

    # Start bot under supervisor
    spec = {LegacyBot, config}

    case DynamicSupervisor.start_child(__MODULE__, spec) do
      {:ok, pid} ->
        # Register bot in registry if available
        maybe_register(bot_id, pid)
        Logger.info("BotSupervisor: Started bot #{bot_name} (#{bot_id})")
        {:ok, pid}

      {:error, reason} = error ->
        Logger.error("BotSupervisor: Failed to start bot - #{inspect(reason)}")
        error
    end
  end

  @doc """
  Stops a specific bot.
  """
  def stop_bot(pid) when is_pid(pid) do
    case DynamicSupervisor.terminate_child(__MODULE__, pid) do
      :ok ->
        Logger.info("BotSupervisor: Stopped bot #{inspect(pid)}")
        :ok

      {:error, :not_found} ->
        :ok
    end
  end

  def stop_bot(bot_id) when is_binary(bot_id) do
    case lookup_bot(bot_id) do
      {:ok, pid} -> stop_bot(pid)
      :not_found -> {:error, :not_found}
    end
  end

  @doc """
  Stops all active bots.
  """
  def stop_all do
    list_bots()
    |> Enum.each(fn {_id, pid, _info} -> stop_bot(pid) end)

    :ok
  end

  @doc """
  Lists all active bots.

  Returns a list of `{bot_id, pid, info}` tuples.
  """
  def list_bots do
    DynamicSupervisor.which_children(__MODULE__)
    |> Enum.map(fn {_id, pid, _type, _modules} ->
      case get_bot_info(pid) do
        {:ok, info} -> {info.id, pid, info}
        :error -> {nil, pid, %{}}
      end
    end)
    |> Enum.reject(fn {id, _pid, _info} -> is_nil(id) end)
  end

  @doc """
  Returns count of active bots.
  """
  def count_bots do
    DynamicSupervisor.count_children(__MODULE__)
    |> Map.get(:active, 0)
  end

  @doc """
  Looks up a bot by ID.
  """
  def lookup_bot(bot_id) do
    case Registry.lookup(@registry, bot_id) do
      [{pid, _}] -> {:ok, pid}
      [] -> :not_found
    end
  rescue
    # Registry might not exist if not started
    ArgumentError -> :not_found
  end

  @doc """
  Gets info about a specific bot.

  Works with both ChannelBot and legacy Bot.
  """
  def get_bot_info(pid) when is_pid(pid) do
    if Process.alive?(pid) do
      try do
        # Both ChannelBot and LegacyBot implement get_info/1
        info = GenServer.call(pid, :get_info)
        {:ok, info}
      catch
        :exit, _ -> :error
      end
    else
      :error
    end
  end

  # =============================================================================
  # Supervisor Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    # Start the registry for bot lookup
    start_registry()

    DynamicSupervisor.init(strategy: :one_for_one)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp generate_bot_id do
    :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
  end

  defp start_registry do
    case Registry.start_link(keys: :unique, name: @registry) do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
      {:error, reason} -> Logger.warning("Failed to start bot registry: #{inspect(reason)}")
    end
  end

  defp maybe_register(bot_id, pid) do
    Registry.register(@registry, bot_id, pid)
  rescue
    ArgumentError -> :ok
  end

  @doc """
  Creates a test player for bot testing.

  The player is created with a unique email and confirmed.
  Returns the player struct.
  """
  def create_test_player(opts \\ []) do
    # Generate unique email
    unique_id = :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
    email = Keyword.get(opts, :email, "bot_#{unique_id}@test.local")
    name = Keyword.get(opts, :name, "TestBot#{unique_id}")

    # Create player (email_changeset only handles email)
    {:ok, player} =
      Accounts.register_player(%{
        email: email
      })

    # Confirm the player and set name
    # Truncate to second precision for Ecto :utc_datetime type
    confirmed_at = DateTime.utc_now() |> DateTime.truncate(:second)

    player
    |> Ecto.Changeset.change(%{confirmed_at: confirmed_at, name: name})
    |> Loka.Repo.update!()
  end
end
