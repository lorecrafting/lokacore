---
paths: ["test/**", "lib/loka/testing/**"]
---

# Testing Context

This context auto-loads when working in test code.

## Bot Implementation Comparison

| Bot | Production Parity | Use Case | State Storage |
|-----|------------------|----------|---------------|
| **ChannelBot** | 95% | E2E acceptance tests | Test DB |
| **DirectSocketAdapter** | 60% | Fast integration | Real DB |
| **Legacy Bot** | 40% | Load testing only | In-memory |

**Default Choice**: Always use ChannelBot for storyline/E2E tests.

## ChannelBot (Recommended)

Tests the real production code path:
- GameChannel message handling
- Action serialization
- WebSocket event delivery

```elixir
# Location
test/integration/storyline_channel_test.exs

# Example
test "completes monastery arc storyline" do
  {:ok, bot} = ChannelBot.start_link(player: player)

  # Bot uses real GameChannel
  ChannelBot.move(bot, "north")
  ChannelBot.talk_to(bot, "novice_pema")

  assert ChannelBot.quest_complete?(bot, "intro_welcome")
end
```

## Storyline E2E Testing

Run the ChannelBot-based storyline test (95% production parity):
```bash
mix test test/integration/storyline_channel_test.exs
```

## Test Structure Pattern

```elixir
test "descriptive test name" do
  # 1. Setup
  player = create_test_player()
  game_state = GameState.new() |> accept_quest("quest_id")

  # 2. Execute
  {:ok, result} = Action.execute(ctx, params)

  # 3. Assert
  assert result.state.game_state.quests["quest_id"].complete
end
```

## Test Categories

### Unit Tests (`test/loka/`)
```bash
mix test test/loka/engine/
mix test test/loka/framework/quest/
```

### Integration Tests (`test/integration/`)
```bash
mix test test/integration/storyline_channel_test.exs
```

### Content Validation
```bash
mix loka.test.validate
```

### Balance Tests
```bash
mix loka.test.balance --quick
```

## Common Test Patterns

### Factory Functions
```elixir
defp create_test_player do
  %Player{id: UUID.generate(), name: "TestPlayer"}
end

defp with_quest(game_state, quest_id) do
  Quest.accept_quest(game_state, quest_id)
end
```

### Async Safety
```elixir
# Mark async-safe tests
@tag :async
test "independent test" do
  # ...
end

# Tests that share state
@tag :integration
test "depends on shared state" do
  # ...
end
```

### Process Synchronization
```elixir
# Instead of Process.sleep
ref = Process.monitor(pid)
assert_receive {:DOWN, ^ref, :process, ^pid, :normal}

# Or use :sys.get_state for synchronization
_ = :sys.get_state(genserver_pid)
```

## Test Commands

```bash
# Run all tests
mix test

# Run specific file
mix test test/loka/framework/quest_test.exs

# Run failed tests only
mix test --failed

# Run with coverage
mix test --cover
```

## Debugging Test Failures

1. **Check bot implementation** - Are you using ChannelBot?
2. **Check state persistence** - Test DB vs in-memory?
3. **Check production parity** - Does test match real code path?

```elixir
# Add debugging
IO.inspect(result, label: "Result")
Logger.debug("State: #{inspect(state)}")
```

## Related Skills

- `.claude/skills/test-patterns/` - Testing conventions
- `.claude/skills/genserver-test-isolation.md` - Supervised process test isolation
- `.claude/skills/liveview-helper-testing.md` - LiveView component tests
- `.claude/skills/liveview-socket-testing.md` - Socket/channel test setup
- `.claude/skills/test-file-cleanup-pattern.md` - YAML test file cleanup

## Documentation

- `docs/architecture/testing.md`
- `docs/testing/bot-migration-guide.md`
