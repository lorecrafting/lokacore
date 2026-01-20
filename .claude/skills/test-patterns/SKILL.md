---
name: test-patterns
description: Ensures tests follow Loka testing conventions. Use when writing tests, creating test cases, debugging test failures, or working with ChannelBot.
---

# Loka Test Patterns

**Auto-applies when**: Writing tests for Loka code

## Purpose

Ensures tests follow Loka testing conventions and use the correct bot implementations.

## When This Skill Activates

Activates when you:
- Create new test files
- Write test cases
- Debug test failures
- Work with bot testing

## CRITICAL: Bot Selection

**Always use ChannelBot for E2E/integration tests.**

| Bot | Production Parity | Use Case |
|-----|------------------|----------|
| **ChannelBot** | 95% | E2E acceptance tests, storyline tests |
| DirectSocketAdapter | 60% | Fast integration tests |
| Legacy Bot | 40% | Load testing only (DEPRECATED) |

### Why ChannelBot?

ChannelBot tests the **real production code path**:
```
ChannelBot → Phoenix Channel → ActionBridge → Actions → Game Logic
```

Legacy Bot bypasses the channel layer, missing serialization bugs and event delivery issues.

### ChannelBot Example

```elixir
test "bot completes quest objective" do
  player = create_test_player()

  {:ok, bot} = ChannelBot.start(player,
    strategy: QuestStrategy,
    strategy_opts: [storyline_id: "monastery_arc"]
  )

  {:ok, bot} = ChannelBot.run(bot, ticks: 50)

  info = ChannelBot.get_info(bot)
  assert length(info.strategy_state.results.objectives_achieved) >= 1

  :ok = ChannelBot.stop(bot)
end
```

## Test Structure Pattern

Use Setup-Execute-Assert:

```elixir
test "completes talk objective when starting conversation" do
  # Setup
  player = create_test_player()
  game_state = GameState.new() |> accept_quest("intro_welcome")
  ctx = %Context{player_id: player.id, game_state: game_state}

  # Execute
  {:ok, result} = Dialogue.start_conversation(ctx, "novice_pema")

  # Assert
  updated_quests = result.state.game_state.quests
  talk_objective = get_objective(updated_quests, "intro_welcome", "talk_pema")
  assert talk_objective.completed == true
end
```

## Test Categories

| Category | Location | Command |
|----------|----------|---------|
| Unit tests | `test/loka/` | `mix test test/loka/` |
| Integration | `test/integration/` | `mix test test/integration/` |
| Content validation | - | `mix loka.test.validate` |
| Storyline tests | - | `mix loka.test.storyline <id> --run` |
| Balance tests | - | `mix loka.test.balance` |

## Factory Functions

```elixir
defp create_test_player do
  {:ok, player} = Accounts.register_player(%{
    name: "TestPlayer#{:rand.uniform(1000)}",
    email: "test#{:rand.uniform(1000)}@test.com",
    password: "test123456"
  })
  player
end

defp create_game_state_with_quest(quest_id) do
  GameState.new()
  |> Quest.accept_quest(quest_id)
  |> elem(1)
end
```

## Async Safety

```elixir
# Safe - no shared state
use Loka.DataCase, async: true

# Unsafe - uses ChannelBot (must be serial)
use Loka.ChannelCase, async: false
```

## Process Synchronization

**CRITICAL**: Never use `Process.sleep()` in tests - it's brittle and slow.

```elixir
# BAD - Brittle, slow, flaky on CI
Process.sleep(100)
assert something_happened()

# GOOD - Use message-based synchronization
ref = Process.monitor(pid)
assert_receive {:DOWN, ^ref, :process, ^pid, :normal}

# GOOD - Use :sys.get_state for GenServer sync
_ = :sys.get_state(genserver_pid)

# GOOD - Use assert_receive with timeout
assert_receive {:event, _}, 1000
```

### Why Process.sleep is Bad

1. **Brittle**: May pass locally but fail on slower CI machines
2. **Slow**: Wastes time waiting for arbitrary delays
3. **Flaky**: Race conditions can still occur

### Alternatives by Use Case

| Need | Bad | Good |
|------|-----|------|
| Wait for GenServer | `sleep(100)` | `:sys.get_state(pid)` |
| Wait for message | `sleep(100)` | `assert_receive` |
| Wait for process exit | `sleep(100)` | `Process.monitor` + `assert_receive` |
| Wait for async task | `sleep(100)` | `Task.await` or `ref_receive` |

## Async Test Guidelines

### When to Use `async: false`

Document WHY a test needs sequential execution:

```elixir
# BAD - No explanation
use Loka.DataCase, async: false

# GOOD - Explain the reason
# async: false required due to:
# - Global ETS table state (StatusManager)
# - SQLite write concurrency limits
# - Global tick timer interference
use Loka.DataCase, async: false
```

### Common Reasons for `async: false`

| Reason | Example |
|--------|---------|
| SQLite concurrency | Quest progress tests (write conflicts) |
| Global GenServer state | StatusManager, ResourcePool tests |
| Global timers | ResourcePool tick timer |
| ETS table modifications | Registry tests |

### Mocking External Services

When tests depend on services that may not be running:

```elixir
# BAD - Test just skipped with no path forward
@tag :skip
test "uses CropRegistry" do
  ...
end

# GOOD - Skip with clear reason and setup instructions
@tag :skip
@tag :requires_crop_registry
test "uses CropRegistry - requires CropRegistry GenServer running" do
  # To enable: start_supervised({CropRegistry, []}) in setup
  ...
end

# BEST - Mock the dependency
setup do
  # Start a test-specific registry
  {:ok, _} = start_supervised({CropRegistry, name: :test_crop_registry})
  :ok
end
```

## Common Test Commands

```bash
# Run all tests
mix test

# Run specific file
mix test test/loka/framework/quest_test.exs

# Run failed tests only
mix test --failed

# Run with trace (verbose)
mix test --trace

# Full test suite (all categories)
mix loka.test

# Quick mode (skip slow balance sims)
mix loka.test --quick
```

## Supporting Files

See `PATTERNS.md` for detailed examples of test patterns.
