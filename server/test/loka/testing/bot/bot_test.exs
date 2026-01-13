defmodule Loka.Testing.BotTest do
  use Loka.DataCase, async: false

  alias Loka.Testing.Bot
  alias Loka.Testing.Bot.Strategies.RandomWalker

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

  # Strategy that tracks actions
  defmodule TrackingStrategy do
    @behaviour Loka.Testing.Bot.Strategy

    @impl true
    def init(opts) do
      {:ok, %{actions: Keyword.get(opts, :actions, [:idle]), index: 0}}
    end

    @impl true
    def decide(_context, state) do
      action = Enum.at(state.actions, state.index, :idle)
      new_index = rem(state.index + 1, length(state.actions))
      {action, %{state | index: new_index}}
    end

    @impl true
    def handle_event(_event, state), do: {:ok, state}
  end

  describe "start_link/1" do
    test "starts a bot with required config" do
      config = %{
        id: "test-bot-1",
        name: "Test Bot",
        strategy: IdleStrategy,
        strategy_opts: [],
        tick_interval_ms: 10_000
      }

      {:ok, pid} = Bot.start_link(config)
      assert Process.alive?(pid)

      # Clean up
      Bot.stop(pid)
    end

    test "initializes with strategy state" do
      config = %{
        id: "test-bot-2",
        name: "Test Bot",
        strategy: IdleStrategy,
        strategy_opts: [],
        tick_interval_ms: 10_000
      }

      {:ok, pid} = Bot.start_link(config)
      state = Bot.get_state(pid)

      assert state.strategy == IdleStrategy
      assert state.strategy_state == %{ticks: 0}

      Bot.stop(pid)
    end
  end

  describe "get_info/1" do
    test "returns bot info" do
      config = %{
        id: "info-bot",
        name: "Info Bot",
        strategy: IdleStrategy,
        strategy_opts: [],
        tick_interval_ms: 10_000
      }

      {:ok, pid} = Bot.start_link(config)
      info = Bot.get_info(pid)

      assert info.id == "info-bot"
      assert info.name == "Info Bot"
      assert info.strategy == IdleStrategy
      assert info.paused == false
      assert info.metrics.actions_taken == 0

      Bot.stop(pid)
    end
  end

  describe "pause/1 and resume/1" do
    test "pauses and resumes bot" do
      config = %{
        id: "pause-bot",
        name: "Pause Bot",
        strategy: IdleStrategy,
        strategy_opts: [],
        tick_interval_ms: 10_000
      }

      {:ok, pid} = Bot.start_link(config)

      # Pause
      :ok = Bot.pause(pid)
      info = Bot.get_info(pid)
      assert info.paused == true

      # Resume
      :ok = Bot.resume(pid)
      info = Bot.get_info(pid)
      assert info.paused == false

      Bot.stop(pid)
    end
  end

  describe "tick_now/1" do
    test "executes a tick immediately" do
      config = %{
        id: "tick-bot",
        name: "Tick Bot",
        strategy: IdleStrategy,
        strategy_opts: [],
        tick_interval_ms: 60_000
      }

      {:ok, pid} = Bot.start_link(config)

      # Pause to prevent automatic ticks
      Bot.pause(pid)

      # Force a tick
      Bot.tick_now(pid)
      Process.sleep(50)

      state = Bot.get_state(pid)
      assert state.strategy_state.ticks >= 1

      Bot.stop(pid)
    end
  end

  describe "metrics tracking" do
    test "increments actions_taken on each tick" do
      config = %{
        id: "metrics-bot",
        name: "Metrics Bot",
        strategy: IdleStrategy,
        strategy_opts: [],
        tick_interval_ms: 60_000
      }

      {:ok, pid} = Bot.start_link(config)
      Bot.pause(pid)

      # Initial metrics
      info = Bot.get_info(pid)
      initial_actions = info.metrics.actions_taken

      # Force some ticks
      Bot.tick_now(pid)
      Process.sleep(50)
      Bot.tick_now(pid)
      Process.sleep(50)

      info = Bot.get_info(pid)
      assert info.metrics.actions_taken >= initial_actions + 2

      Bot.stop(pid)
    end
  end

  describe "RandomWalker strategy" do
    test "initializes with default options" do
      {:ok, state} = RandomWalker.init([])

      assert state.step_count == 0
      assert state.max_steps == :infinity
      assert state.explore_chance == 70
      assert state.attack_hostiles == true
      assert state.pickup_items == true
    end

    test "initializes with custom options" do
      {:ok, state} = RandomWalker.init(max_steps: 50, explore_chance: 80)

      assert state.max_steps == 50
      assert state.explore_chance == 80
    end

    test "returns idle when max_steps reached" do
      {:ok, state} = RandomWalker.init(max_steps: 1)

      context = %{
        bot: %{id: "bot", name: "Bot"},
        game_state: %{health: %{current: 100, max: 100}},
        room: nil,
        nearby_entities: [],
        in_combat: false,
        combat_state: nil
      }

      # First decide increments step_count
      {_action1, state} = RandomWalker.decide(context, state)

      # Second decide should return idle (max_steps reached)
      {action2, _state} = RandomWalker.decide(context, state)
      assert action2 == :idle
    end

    test "returns combat action when in combat" do
      {:ok, state} = RandomWalker.init([])

      context = %{
        bot: %{id: "bot", name: "Bot"},
        game_state: %{health: %{current: 100, max: 100}},
        room: nil,
        nearby_entities: [],
        in_combat: true,
        combat_state: %{enemy: %{name: "Goblin"}}
      }

      {action, _state} = RandomWalker.decide(context, state)
      assert match?({:combat_action, _}, action)
    end
  end
end
