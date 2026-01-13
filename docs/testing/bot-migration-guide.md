# Bot Testing Migration Guide

## Current State (January 2026)

The storyline e2e tests currently use **Legacy Bot** (40% production parity), which:
- Uses in-memory game state (no DB persistence)
- Calls `BotActions` instead of production code paths
- Fast but misses channel/serialization bugs

## Recommendation: Migrate to ChannelBot

**ChannelBot** provides 95% production parity because it:
- Tests actual `GameChannel` code (what production uses)
- Verifies serialization (what mobile/web clients receive)
- Uses test database (realistic state management)
- Catches channel/transport bugs

## Migration Steps

### 1. Update Storyline Test Runner

**Current** (`lib/mix/tasks/loka.test.storyline.ex`):
```elixir
# Uses BotSupervisor.spawn_bot with legacy Bot
{:ok, bot_pid} = BotSupervisor.spawn_bot(
  strategy: StorylineRunner,
  strategy_opts: [storyline_id: storyline.key]
)
```

**Proposed**:
```elixir
# Use ChannelBot with test channel
use Loka.ChannelCase

{:ok, socket} = connect(UserSocket, %{})
{:ok, _, socket} = subscribe_and_join(socket, GameChannel, "game:test")

{:ok, bot} = ChannelBot.start_link(
  socket: socket,
  strategy: StorylineRunner,
  strategy_opts: [storyline_id: storyline.key]
)
```

### 2. Adapt StorylineRunner Strategy

**Changes needed:**
```elixir
defmodule Loka.Testing.Bot.Strategies.StorylineRunner do
  # Add ChannelBot compatibility
  def decide(context) do
    # context.socket instead of context.game_state for some checks
    # context.client_state vs context.server_state for validation
  end
end
```

### 3. Update Test Assertions

**Legacy Bot**:
```elixir
# Direct game state access
assert bot_state.game_state.quests != []
```

**ChannelBot**:
```elixir
# Client view + server validation
assert bot.client_state.quests != []
assert StateInspector.has_quest?(bot.player_id, "intro_welcome")
```

### 4. Performance Considerations

**Legacy Bot**:
- Fast (direct calls, in-memory)
- ~30 seconds for full storyline

**ChannelBot**:
- Slower (channel overhead, DB calls)
- ~60 seconds for full storyline
- **BUT**: Tests real production code

**Mitigation**:
- Run only on CI (not locally during dev)
- Use `async: true` where possible
- Keep Legacy Bot for quick smoke tests

## When to Use Each Bot

| Bot Type | Use Case | Command |
|----------|----------|---------|
| **ChannelBot** | E2E storyline tests (CI/CD) | `mix test test/integration/storyline_test.exs` |
| **DirectSocketAdapter** | Fast integration tests | For quick local testing |
| **Legacy Bot** | Load testing (100+ bots) | `mix loka.load_test` |

## Migration Checklist

- [ ] Create `test/integration/storyline_test.exs` using ChannelCase
- [ ] Adapt StorylineRunner for ChannelBot context
- [ ] Add StateInspector assertions for validation
- [ ] Update CI to run ChannelBot tests
- [ ] Keep Legacy Bot for load testing only
- [ ] Document bot selection in CLAUDE.md

## Example: ChannelBot Storyline Test

```elixir
defmodule Loka.Integration.StorylineTest do
  use Loka.ChannelCase, async: false

  alias Loka.Testing.Bot.{ChannelBot, StateInspector}
  alias Loka.Testing.Bot.Strategies.StorylineRunner

  @moduletag :integration
  @moduletag timeout: 180_000  # 3 minutes

  describe "monastery_arc storyline" do
    test "bot completes full storyline", %{socket: socket} do
      # Start bot with storyline strategy
      {:ok, bot} = ChannelBot.start_link(
        socket: socket,
        strategy: StorylineRunner,
        strategy_opts: [storyline_id: "monastery_arc"],
        tick_interval_ms: 500
      )

      # Wait for completion or timeout
      assert_receive {:bot_complete, results}, 180_000

      # Verify completion
      assert results.quests_completed >= 12
      assert results.errors == []

      # Validate server state
      assert StateInspector.has_completed_quest?(bot.player_id, "main_liberation")
    end
  end
end
```

## Benefits of Migration

1. **Production Parity**: 95% vs 40% - catches real bugs
2. **Channel Testing**: Verifies serialization, event delivery
3. **One Approach**: Eliminates DB vs in-memory confusion
4. **Better Validation**: Client view + server truth
5. **Future-Proof**: Tests code that will run in production

## Timeline

**Phase 1** (1 day):
- Create ChannelBot storyline test
- Verify it works end-to-end

**Phase 2** (1 day):
- Migrate `mix loka.test.storyline` to use ChannelBot
- Update CI configuration

**Phase 3** (ongoing):
- Keep Legacy Bot for load testing
- Document best practices
- Train team on bot selection

## Questions?

See:
- `docs/testing/bot-architectures.md` - Detailed comparison
- `.claude/agents/test-repair.md` - Auto-repair agent docs
- `lib/loka/testing/bot/channel_bot.ex` - Implementation
