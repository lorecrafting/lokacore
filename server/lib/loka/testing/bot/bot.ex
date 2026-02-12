defmodule Loka.Testing.Bot do
  @moduledoc """
  **DEPRECATED**: Use `Loka.Testing.Bot.ChannelBot` instead for storyline/integration tests.

  This bot implementation bypasses the channel layer and calls framework code directly,
  providing only 40% production parity. ChannelBot provides 95% parity by testing the
  actual GameChannel code path that real clients use.

  ## When to Use This Bot (Legacy Bot)

  - Load testing (100+ bots with in-memory state)
  - Stress testing (minimal overhead)
  - Multi-bot scenarios

  ## When NOT to Use This Bot

  - ❌ Storyline validation → Use ChannelBot
  - ❌ Integration tests → Use ChannelBot
  - ❌ Testing serialization/channels → Use ChannelBot

  ## Migration

  ```elixir
  # OLD (this module - 40% production parity)
  BotSupervisor.spawn_bot(strategy: StorylineRunner)

  # NEW (ChannelBot - 95% production parity)
  use Loka.ChannelCase
  {:ok, bot} = ChannelBot.start_link(socket: socket, strategy: StorylineRunner)
  ```

  See `test/integration/storyline_channel_test.exs` for examples.

  ---

  GenServer for an individual testing bot.

  Each bot maintains an in-memory game state (mirroring a player's GameState),
  runs a decision-making strategy, and executes actions via BotActions.

  Bots operate at the framework layer for performance - they don't go through
  LiveView, which makes them suitable for load testing.

  ## Bot State

  The bot maintains:
  - Game state (inventory, stats, health, current room)
  - Strategy module and state
  - Current room entity and nearby entities
  - Combat state (if in combat)
  - Metrics (actions taken, distance traveled, etc.)

  ## Lifecycle

  1. Start: Initialize with strategy, load/create game state
  2. Tick: Ask strategy for next action, execute it
  3. Events: Handle game events (combat, room changes)
  4. Stop: Clean up resources

  ## Usage

      # Start via BotSupervisor (preferred)
      {:ok, pid} = BotSupervisor.spawn_bot(
        strategy: RandomWalker,
        name: "Explorer Bot"
      )

      # Or start directly
      {:ok, pid} = Bot.start_link(%{
        id: "bot-123",
        name: "Test Bot",
        strategy: RandomWalker,
        strategy_opts: []
      })

      # Get bot info
      info = Bot.get_info(pid)

      # Pause/resume
      Bot.pause(pid)
      Bot.resume(pid)
  """

  use GenServer
  require Logger

  alias Loka.Testing.Bot.{BotActions, Strategy}
  alias Loka.Framework.Player.GameState
  alias Loka.Framework.World.RoomLoader
  alias Loka.Engine.{EventBus, WorldLoader}

  @default_tick_interval_ms 1000

  defstruct [
    :id,
    :name,
    :strategy,
    :strategy_state,
    :game_state,
    :room,
    :nearby_entities,
    :combat_state,
    :dialogue_state,
    :tick_interval_ms,
    :tick_timer,
    :started_at,
    :paused,
    :metrics
  ]

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts a bot process with the given configuration.

  ## Config

  - `:id` - Unique bot identifier
  - `:name` - Display name
  - `:strategy` - Strategy module
  - `:strategy_opts` - Options for strategy init
  - `:starting_room_id` - Room to start in
  - `:tick_interval_ms` - Time between decisions
  """
  def start_link(config) do
    GenServer.start_link(__MODULE__, config)
  end

  @doc """
  Gets information about a bot.
  """
  def get_info(pid) do
    GenServer.call(pid, :get_info)
  end

  @doc """
  Gets the bot's current state (for debugging).
  """
  def get_state(pid) do
    GenServer.call(pid, :get_state)
  end

  @doc """
  Pauses the bot (stops ticking).
  """
  def pause(pid) do
    GenServer.call(pid, :pause)
  end

  @doc """
  Resumes a paused bot.
  """
  def resume(pid) do
    GenServer.call(pid, :resume)
  end

  @doc """
  Forces an immediate tick (for testing).
  """
  def tick_now(pid) do
    GenServer.cast(pid, :tick_now)
  end

  @doc """
  Stops the bot gracefully.
  """
  def stop(pid) do
    GenServer.stop(pid, :normal)
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(config) do
    # Extract config
    id = Map.fetch!(config, :id)
    name = Map.fetch!(config, :name)
    strategy = Map.fetch!(config, :strategy)
    strategy_opts = Map.get(config, :strategy_opts, [])
    starting_room_id = Map.get(config, :starting_room_id)
    tick_interval_ms = Map.get(config, :tick_interval_ms, @default_tick_interval_ms)

    # Initialize strategy
    {:ok, strategy_state} = strategy.init(strategy_opts)

    # Create in-memory game state for bot
    game_state = create_bot_game_state(id, starting_room_id)

    # Load starting room
    {room, nearby} = load_initial_room(game_state)

    # Subscribe to room events
    if room do
      EventBus.subscribe("location:#{room.id}")
    end

    # Initialize metrics
    metrics = %{
      actions_taken: 0,
      rooms_visited: 1,
      combats_won: 0,
      combats_lost: 0,
      items_collected: 0,
      distance_traveled: 0
    }

    state = %__MODULE__{
      id: id,
      name: name,
      strategy: strategy,
      strategy_state: strategy_state,
      game_state: game_state,
      room: room,
      nearby_entities: nearby,
      combat_state: nil,
      tick_interval_ms: tick_interval_ms,
      tick_timer: nil,
      started_at: DateTime.utc_now(),
      paused: false,
      metrics: metrics
    }

    # Schedule first tick
    state = schedule_tick(state)

    Logger.info("Bot #{name} (#{id}) started in room #{(room && room.title) || "unknown"}")
    {:ok, state}
  end

  @impl true
  def handle_call(:get_info, _from, state) do
    info = %{
      id: state.id,
      name: state.name,
      strategy: state.strategy,
      room: state.room && %{id: state.room.id, title: state.room.title},
      in_combat: not is_nil(state.combat_state),
      paused: state.paused,
      started_at: state.started_at,
      metrics: state.metrics
    }

    {:reply, info, state}
  end

  @impl true
  def handle_call(:get_state, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def handle_call(:pause, _from, state) do
    state = cancel_tick(state)
    {:reply, :ok, %{state | paused: true}}
  end

  @impl true
  def handle_call(:resume, _from, state) do
    state = %{state | paused: false} |> schedule_tick()
    {:reply, :ok, state}
  end

  @impl true
  def handle_cast(:tick_now, state) do
    {:noreply, do_tick(state)}
  end

  @impl true
  def handle_info(:tick, %{paused: true} = state) do
    {:noreply, state}
  end

  @impl true
  def handle_info(:tick, state) do
    state = do_tick(state)
    state = schedule_tick(state)
    {:noreply, state}
  end

  # Handle PubSub events
  @impl true
  def handle_info({:event, event}, state) do
    # Pass event to strategy
    {:ok, new_strategy_state} = state.strategy.handle_event(event, state.strategy_state)
    {:noreply, %{state | strategy_state: new_strategy_state}}
  end

  # Handle player entered/left room (other bots/players)
  @impl true
  def handle_info({:player_entered, _player_id, _player_name}, state) do
    {:noreply, state}
  end

  @impl true
  def handle_info({:player_left, _player_id, _player_name, _direction}, state) do
    {:noreply, state}
  end

  @impl true
  def handle_info(msg, state) do
    Logger.debug("Bot #{state.id} received unknown message: #{inspect(msg)}")
    {:noreply, state}
  end

  @impl true
  def terminate(reason, state) do
    Logger.info("Bot #{state.name} (#{state.id}) stopping: #{inspect(reason)}")

    # Unsubscribe from room
    if state.room do
      EventBus.unsubscribe("location:#{state.room.id}")
    end

    # Call strategy terminate if defined
    if function_exported?(state.strategy, :terminate, 2) do
      state.strategy.terminate(reason, state.strategy_state)
    end

    :ok
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp do_tick(state) do
    # Build bot_state map for actions
    bot_state = %{
      id: state.id,
      name: state.name,
      game_state: state.game_state,
      room: state.room,
      nearby_entities: state.nearby_entities,
      combat_state: state.combat_state,
      dialogue_state: state.dialogue_state
    }

    # Build context for strategy decision (includes bot_state for dialogue access)
    context =
      Strategy.build_context(
        bot: %{id: state.id, name: state.name},
        game_state: state.game_state,
        room: state.room,
        nearby_entities: state.nearby_entities,
        in_combat: not is_nil(state.combat_state),
        combat_state: state.combat_state,
        bot_state: bot_state
      )

    # Ask strategy for action
    {action, new_strategy_state} = state.strategy.decide(context, state.strategy_state)

    case BotActions.execute(action, bot_state) do
      {:ok, updated_bot_state} ->
        # Update metrics
        metrics = update_metrics(state.metrics, action, bot_state, updated_bot_state)

        # Handle room subscription change
        state = handle_room_change(state, bot_state.room, updated_bot_state.room)

        %{
          state
          | strategy_state: new_strategy_state,
            game_state: updated_bot_state.game_state,
            room: updated_bot_state.room,
            nearby_entities: updated_bot_state.nearby_entities,
            combat_state: updated_bot_state.combat_state,
            dialogue_state: Map.get(updated_bot_state, :dialogue_state),
            metrics: metrics
        }

      {:error, reason} ->
        Logger.debug("Bot #{state.id} action failed: #{inspect(reason)}")
        %{state | strategy_state: new_strategy_state}
    end
  end

  defp schedule_tick(%{paused: true} = state), do: state

  defp schedule_tick(state) do
    timer = Process.send_after(self(), :tick, state.tick_interval_ms)
    %{state | tick_timer: timer}
  end

  defp cancel_tick(%{tick_timer: nil} = state), do: state

  defp cancel_tick(%{tick_timer: timer} = state) do
    Process.cancel_timer(timer)
    %{state | tick_timer: nil}
  end

  defp create_bot_game_state(bot_id, starting_room_id) do
    room_id =
      starting_room_id || RoomLoader.get_starting_room_id() || WorldLoader.get_starting_room_id()

    # Create a virtual game state (not persisted to DB)
    # Bot has high stats to ensure it can complete combat for testing
    game_state = %GameState{
      id: bot_id,
      player_id: bot_id,
      inventory: [],
      equipment: %{weapon: nil, armor: nil, accessory: nil},
      quests: %{},
      flags: %{},
      stats: %{str: 50, dex: 30, sta: 30, defense: 20, level: 10, xp: 0},
      health: %{current: 500, max: 500},
      current_room_id: room_id
    }

    # Grant system quests (quests with giver: "system")
    # This ensures bots can complete storylines that start with system quests
    grant_system_quests(game_state)
  end

  # Grant all system quests to the bot (in-memory only, no DB persistence)
  # System quests are quests with `giver: "system"` that auto-activate for real players
  defp grant_system_quests(game_state) do
    alias Loka.Framework.Quest.{Definitions, QuestRegistry}

    # Get all system quests
    system_quests =
      QuestRegistry.all()
      |> Enum.filter(fn quest ->
        quest.giver == "system" or quest.giver == :system
      end)

    if Enum.any?(system_quests) do
      Logger.info("[Bot] Granting #{length(system_quests)} system quests",
        bot_id: game_state.id
      )

      # Grant each system quest IN-MEMORY (bots don't persist to DB)
      Enum.reduce(system_quests, game_state, fn quest, state ->
        case Definitions.get_quest_definition(quest.id) do
          nil ->
            Logger.error("[Bot] Quest definition not found: #{quest.id}", quest_id: quest.id)
            state

          quest_def ->
            # Manually add quest to active quests (in-memory, no DB call)
            accepted_at = DateTime.utc_now()
            objectives = initialize_quest_objectives(quest_def.objectives, accepted_at)

            active_quests = Map.get(state.quests, "active", %{})

            new_active =
              Map.put(active_quests, quest.id, %{
                "objectives" => objectives,
                "accepted_at" => accepted_at
              })

            new_quests = Map.put(state.quests, "active", new_active)

            Logger.debug("[Bot] Granted system quest #{quest.id}",
              bot_id: state.id,
              quest_id: quest.id
            )

            %{state | quests: new_quests}
        end
      end)
    else
      game_state
    end
  end

  # Initialize quest objectives in-memory (mirrors Quest.Progress logic)
  defp initialize_quest_objectives(objectives, _accepted_at) when is_list(objectives) do
    # Objectives are now a list of Objective structs
    Map.new(objectives, fn obj ->
      {obj.id, %{"completed" => false, "progress" => 0}}
    end)
  end

  defp initialize_quest_objectives(objectives, _accepted_at) when is_map(objectives) do
    # Legacy support for map-based objectives
    Map.new(objectives, fn {obj_id, _obj_config} ->
      {obj_id, %{"completed" => false, "progress" => 0}}
    end)
  end

  defp load_initial_room(game_state) do
    case RoomLoader.load_room_for_display(game_state.current_room_id) do
      {:ok, room} ->
        nearby = BotActions.load_nearby_entities(room.id)
        {room, nearby}

      {:error, _} ->
        {nil, []}
    end
  end

  defp handle_room_change(state, old_room, new_room) do
    old_id = old_room && old_room.id
    new_id = new_room && new_room.id

    if old_id != new_id do
      # Unsubscribe from old room
      if old_id do
        EventBus.unsubscribe("location:#{old_id}")
      end

      # Subscribe to new room
      if new_id do
        EventBus.subscribe("location:#{new_id}")
      end
    end

    state
  end

  defp update_metrics(metrics, action, _old_state, _new_state) do
    metrics = %{metrics | actions_taken: metrics.actions_taken + 1}

    case action do
      {:move, _} ->
        %{
          metrics
          | distance_traveled: metrics.distance_traveled + 1,
            rooms_visited: metrics.rooms_visited + 1
        }

      {:interact, _} ->
        metrics

      {:attack, _} ->
        metrics

      {:combat_action, _} ->
        metrics

      _ ->
        metrics
    end
  end
end
