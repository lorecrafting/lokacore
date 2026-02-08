# Debug Bot Tests

Debug failing bot/storyline tests with detailed trace analysis.

## Quick Diagnosis

### Step 1: Run the Failing Test
```bash
cd /Users/raymondluong/dev/lokacore/server
mix test test/integration/storyline_channel_test.exs --trace
```

### Step 2: Identify Failure Point
Look for:
- Which storyline step failed?
- What was the expected vs actual state?
- Was it a timing issue or logic error?

## Bot Architecture Reference

| Component | Path | Purpose |
|-----------|------|---------|
| ChannelBot | `lib/loka/testing/bot/channel_bot.ex` | 95% production parity |
| Strategies | `lib/loka/testing/bot/strategies/` | Bot behavior patterns |
| StorylineRunner | `lib/loka/testing/bot/strategies/storyline_runner.ex` | Quest/dialogue automation |

## Common Bot Issues

### 1. Quest Not Progressing
**Symptom**: Bot stuck on quest objective
**Debug**:
```elixir
# Check quest state
bot_state.quests
# Check if objective is valid
Loka.Framework.Quest.Progress.check_objective(player, objective)
```

### 2. Dialogue Not Advancing
**Symptom**: Bot can't find dialogue option
**Debug**:
- Check NPC has correct dialogue key in prototype
- Verify dialogue node exists in YAML
- Check conditions on dialogue options

### 3. Navigation Failures
**Symptom**: Bot can't reach location
**Debug**:
- Verify room exists in prototypes
- Check exits are bidirectional
- Look for locked exits or conditions

### 4. Timing Issues
**Symptom**: Intermittent failures
**Fix**: Replace `Process.sleep` with proper synchronization
```elixir
# Bad
Process.sleep(100)

# Good
assert_receive {:game_event, _}, 5000
```

## Detailed Trace

For deep debugging, add logging:
```elixir
# In storyline_runner.ex
Logger.debug("Step: #{inspect(step)}")
Logger.debug("Bot state: #{inspect(bot_state)}")
```

Run with debug logging:
```bash
MIX_ENV=test mix test test/integration/storyline_channel_test.exs --trace 2>&1 | tee debug.log
```

## Validation Commands

After fixing:
```bash
# Run specific test
mix test test/integration/storyline_channel_test.exs

# Run all bot tests
mix test test/loka/testing/

# Validate content (quest/dialogue)
mix loka.test.validate
```

## Key Files to Check

1. **Storyline definition**: `priv/world/storylines/monastery_arc.yml`
2. **Quest definitions**: `priv/world/quests/`
3. **NPC dialogues**: `priv/world/prototypes/npcs/`
4. **Room connections**: `priv/world/prototypes/rooms/`

## Output

Report:
1. Failure point identified
2. Root cause analysis
3. Fix applied
4. Test result after fix
