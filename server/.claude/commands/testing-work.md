---
description: Start testing and bot development session
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Task
---

# Testing Session

You are now in **Testing Mode**, focused on tests in `test/` and bot infrastructure in `lib/loka/testing/`.

## Session Setup

Before diving in, clarify:
1. **What are you testing**? (unit, integration, E2E, load)
2. **What's the expected behavior**?
3. **Which bot implementation** is appropriate?

## Bot Selection Guide

| Scenario | Bot | Why |
|----------|-----|-----|
| Storyline E2E | **ChannelBot** | 95% production parity |
| Quick integration | DirectSocketAdapter | 60% parity, faster |
| Load testing (100+) | Legacy Bot | 40% parity, lightweight |

**Default**: Always prefer ChannelBot for storyline tests.

## ChannelBot Example

```elixir
# test/integration/storyline_channel_test.exs
test "completes intro quest" do
  {:ok, bot} = ChannelBot.start_link(player: player)

  # Uses real GameChannel
  ChannelBot.move(bot, "north")
  ChannelBot.talk_to(bot, "novice_pema")

  assert ChannelBot.quest_complete?(bot, "intro_welcome")
end
```

## Test Structure Pattern

```elixir
test "descriptive name covering scenario" do
  # 1. SETUP - Create test data
  player = create_test_player()
  game_state = GameState.new() |> with_quest("quest_id")
  ctx = %Context{player: player, game_state: game_state}

  # 2. EXECUTE - Run the action
  {:ok, result} = MyModule.action(ctx, params)

  # 3. ASSERT - Verify outcomes
  assert result.state.game_state.quests["quest_id"].complete
  assert_received {:event, "Quest completed"}
end
```

## Test Commands

```bash
# Run all tests
mix test

# Run specific file
mix test test/loka/framework/quest_test.exs

# Run failed tests only
mix test --failed

# Run with trace
mix test --trace

# Content validation
mix loka.test.validate

# Balance tests
mix loka.test.balance --quick

# Storyline test
mix test test/integration/storyline_channel_test.exs
```

## Test Categories

| Directory | Type | Purpose |
|-----------|------|---------|
| `test/loka/engine/` | Unit | Engine components |
| `test/loka/framework/` | Unit | Framework subsystems |
| `test/loka_web/` | Integration | LiveView, channels |
| `test/integration/` | E2E | Full storyline tests |

## Common Test Patterns

### Avoid Process.sleep
```elixir
# BAD
Process.sleep(100)

# GOOD - Wait for process
ref = Process.monitor(pid)
assert_receive {:DOWN, ^ref, :process, ^pid, :normal}

# GOOD - Synchronize with GenServer
_ = :sys.get_state(genserver_pid)
```

### Test Isolation
```elixir
# Use start_supervised for cleanup
{:ok, pid} = start_supervised(MyServer)

# Mark async-safe tests
@tag :async
test "independent test" do
  # ...
end
```

## Debugging Failures

1. **Check bot type** - Is it ChannelBot (95% parity)?
2. **Check state** - Test DB vs in-memory?
3. **Check production path** - Does test match real code?
4. **Add logging**:
   ```elixir
   IO.inspect(result, label: "Debug")
   Logger.debug("State: #{inspect(state)}")
   ```

## Key Documentation

| Topic | Location |
|-------|----------|
| Testing Architecture | `docs/architecture/testing.md` |
| Bot Migration | `docs/testing/bot-migration-guide.md` |
| Test Patterns | `.claude/skills/test-patterns/` |

## Available Agents

- `test-repair` - Autonomously fix test failures
- `/debug-bot` - Debug ChannelBot issues
- `/test-and-fix` - Auto-fix failing tests

## End of Session

Before finishing:
1. All tests must pass: `mix test`
2. Content valid: `mix loka.test.validate`
3. Use `/save` if you discovered a testing pattern
4. Commit: `git add . && git commit -m "test: ..."`
