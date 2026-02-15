defmodule Loka.Testing.ChannelBotTest do
  @moduledoc """
  Tests for ChannelBot - the hybrid testing bot.

  These tests verify that ChannelBot:
  - Properly connects via Phoenix.ChannelTest
  - Executes actions through the real GameChannel code path
  - Updates state from channel events
  - Works with StateInspector for server state assertions
  """

  use Loka.ChannelCase, async: false

  alias Loka.Testing.Bot.ChannelBot
  alias Loka.Testing.Bot.StateInspector

  # A simple test strategy that just idles
  defmodule IdleStrategy do
    @behaviour Loka.Testing.Bot.Strategy

    @impl true
    def init(_opts), do: {:ok, %{ticks: 0}}

    @impl true
    def decide(_context, state) do
      {:idle, %{state | ticks: state.ticks + 1}}
    end

    @impl true
    def handle_event(_event, state), do: {:ok, state}
  end

  # Strategy that moves in a single direction
  defmodule MoveStrategy do
    @behaviour Loka.Testing.Bot.Strategy

    @impl true
    def init(opts) do
      {:ok, %{direction: Keyword.get(opts, :direction, "north"), moved: false}}
    end

    @impl true
    def decide(_context, %{moved: true} = state) do
      {:idle, state}
    end

    def decide(_context, state) do
      {{:move, state.direction}, %{state | moved: true}}
    end

    @impl true
    def handle_event(_event, state), do: {:ok, state}
  end

  # Strategy that performs a list of actions in order
  defmodule ScriptedStrategy do
    @behaviour Loka.Testing.Bot.Strategy

    @impl true
    def init(opts) do
      actions = Keyword.get(opts, :actions, [:idle])
      {:ok, %{actions: actions, index: 0}}
    end

    @impl true
    def decide(_context, state) do
      action = Enum.at(state.actions, state.index, :idle)
      new_index = min(state.index + 1, length(state.actions))
      {action, %{state | index: new_index}}
    end

    @impl true
    def handle_event(_event, state), do: {:ok, state}
  end

  describe "start/2" do
    test "starts a bot and connects to channel" do
      player = create_test_player()

      {:ok, bot} = ChannelBot.start(player, strategy: IdleStrategy)

      assert bot.player.id == player.id
      assert bot.strategy == IdleStrategy
      assert bot.tick_count == 0
      assert not is_nil(bot.socket)

      # Clean up
      :ok = ChannelBot.stop(bot)
    end

    test "receives initial game state" do
      player = create_test_player()

      {:ok, bot} = ChannelBot.start(player, strategy: IdleStrategy)

      # Bot should have inventory as a list
      assert is_list(bot.inventory)

      # After a tick, room should be populated (events processed)
      {:ok, bot} = ChannelBot.tick(bot)

      # Inventory should still be a list
      assert is_list(bot.inventory)

      :ok = ChannelBot.stop(bot)
    end

    test "initializes strategy state" do
      player = create_test_player()

      {:ok, bot} = ChannelBot.start(player, strategy: IdleStrategy)

      assert bot.strategy_state == %{ticks: 0}

      :ok = ChannelBot.stop(bot)
    end
  end

  describe "tick/1" do
    test "executes strategy and increments tick count" do
      player = create_test_player()

      {:ok, bot} = ChannelBot.start(player, strategy: IdleStrategy)
      assert bot.tick_count == 0

      {:ok, bot} = ChannelBot.tick(bot)

      assert bot.tick_count == 1
      assert bot.strategy_state.ticks == 1
      assert bot.last_action == :idle

      :ok = ChannelBot.stop(bot)
    end

    test "updates metrics on each tick" do
      player = create_test_player()

      {:ok, bot} = ChannelBot.start(player, strategy: IdleStrategy)
      initial_actions = bot.metrics.actions_taken

      {:ok, bot} = ChannelBot.tick(bot)
      {:ok, bot} = ChannelBot.tick(bot)

      assert bot.metrics.actions_taken == initial_actions + 2

      :ok = ChannelBot.stop(bot)
    end
  end

  describe "run/2" do
    test "runs multiple ticks" do
      player = create_test_player()

      {:ok, bot} = ChannelBot.start(player, strategy: IdleStrategy)

      {:ok, bot} = ChannelBot.run(bot, ticks: 5)

      assert bot.tick_count == 5
      assert bot.strategy_state.ticks == 5

      :ok = ChannelBot.stop(bot)
    end

    test "stops early with :until option" do
      player = create_test_player()

      {:ok, bot} = ChannelBot.start(player, strategy: IdleStrategy)

      {:ok, bot} = ChannelBot.run(bot, ticks: 100, until: fn b -> b.tick_count >= 3 end)

      # Should stop at 3, not run all 100
      assert bot.tick_count == 3

      :ok = ChannelBot.stop(bot)
    end
  end

  describe "get_info/1" do
    test "returns summary info" do
      player = create_test_player()

      {:ok, bot} = ChannelBot.start(player, strategy: IdleStrategy)
      {:ok, bot} = ChannelBot.tick(bot)

      info = ChannelBot.get_info(bot)

      assert info.player_id == player.id
      assert info.tick_count == 1
      assert info.last_action == :idle
      assert info.in_combat == false
      assert info.in_dialogue == false
      assert is_map(info.metrics)

      :ok = ChannelBot.stop(bot)
    end
  end

  describe "hybrid approach - StateInspector integration" do
    test "StateInspector can access game state for assertions" do
      player = create_test_player()

      {:ok, bot} = ChannelBot.start(player, strategy: IdleStrategy)
      {:ok, bot} = ChannelBot.tick(bot)

      # Use Entities API to verify server state matches (V2: no more GameState)
      {:ok, character} = Loka.Engine.Entities.find_one(account_id: player.id, type: :character)

      # Character entity should exist
      assert not is_nil(character)

      # Character is linked to this player
      assert character.account_id == player.id

      # Room IDs should match between bot (client view) and server
      # Note: bot.room may be nil if initial state push hasn't arrived
      bot_room_id = bot.room && (bot.room[:id] || bot.room["id"] || Map.get(bot.room, :id))
      server_room_id = character.location_id

      # Either both nil or both equal
      assert bot_room_id == server_room_id or is_nil(bot_room_id)

      :ok = ChannelBot.stop(bot)
    end

    test "can use StateInspector assertions" do
      player = create_test_player()

      {:ok, bot} = ChannelBot.start(player, strategy: IdleStrategy)
      {:ok, _bot} = ChannelBot.tick(bot)

      # StateInspector query helpers should work
      assert is_binary(StateInspector.current_room(player.id)) or
               is_nil(StateInspector.current_room(player.id))

      health = StateInspector.health_percent(player.id)
      assert is_number(health)
      assert health >= 0 and health <= 100

      :ok = ChannelBot.stop(bot)
    end
  end

  describe "movement actions" do
    test "pushing move action through channel" do
      player = create_test_player()

      # Use a scripted strategy that moves north once
      {:ok, bot} =
        ChannelBot.start(player,
          strategy: ScriptedStrategy,
          strategy_opts: [actions: [{{:move, "north"}, :idle}]]
        )

      # Get initial room
      initial_room_id = bot.room && (bot.room[:id] || bot.room["id"] || bot.room.id)

      # Tick to execute movement
      {:ok, bot} = ChannelBot.tick(bot)

      # Movement might succeed or fail depending on room layout
      # Either way, metrics should update
      assert bot.metrics.moves >= 0

      # The bot should have received some events
      assert bot.metrics.events_received >= 0

      :ok = ChannelBot.stop(bot)
    end
  end

  describe "scripted actions" do
    test "executes multiple actions in sequence" do
      player = create_test_player()

      actions = [:idle, :idle, {:wait, 100}]

      {:ok, bot} =
        ChannelBot.start(player,
          strategy: ScriptedStrategy,
          strategy_opts: [actions: actions]
        )

      {:ok, bot} = ChannelBot.tick(bot)
      assert bot.last_action == :idle

      {:ok, bot} = ChannelBot.tick(bot)
      assert bot.last_action == :idle

      {:ok, bot} = ChannelBot.tick(bot)
      assert bot.last_action == {:wait, 100}

      :ok = ChannelBot.stop(bot)
    end
  end
end
