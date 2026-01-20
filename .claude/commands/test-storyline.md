# Test Storyline

Run storyline tests to validate quest chains are completable.

## Usage

```
/test-storyline <storyline_id>
```

## IMPORTANT: Recommended Approach

**The `mix loka.test.storyline` task is DEPRECATED.** It uses the legacy bot (40% production parity).

**Preferred method**: Use ChannelBot tests (95% production parity):

```bash
# Run the ChannelBot-based storyline test
cd server && mix test test/integration/storyline_channel_test.exs
```

This tests the **real production code path**:
- GameChannel message handling
- Action serialization
- WebSocket event delivery

## Instructions

### Option 1: ChannelBot Test (Recommended)

```bash
cd server && mix test test/integration/storyline_channel_test.exs
```

This runs a full playthrough using ChannelBot with 95% production parity.

### Option 2: Legacy Mix Task (Deprecated)

If you need to use the legacy task:

```bash
# List available storylines
cd server && mix loka.test.storyline --list

# Validate storyline structure only (no bot run)
cd server && mix loka.test.storyline <storyline_id>

# Run legacy bot playthrough (40% parity - NOT recommended)
cd server && mix loka.test.storyline <storyline_id> --run

# Verbose output
cd server && mix loka.test.storyline <storyline_id> --run --verbose
```

### Understanding the Difference

| Approach | Production Parity | Tests |
|----------|------------------|-------|
| ChannelBot test | 95% | Real GameChannel code path |
| Legacy mix task | 40% | Bypasses channel layer |

The ChannelBot test catches:
- Serialization bugs
- Event delivery issues
- Channel message handling bugs

The legacy task misses these because it bypasses the channel layer.

## Validation Steps

When running storyline validation:

1. **Structure Check** - All quests in storyline exist
2. **Dependency Check** - Quest chain dependencies are valid
3. **Act Validation** - All acts have quests, required acts exist
4. **Starting Room** - Starting room prototype exists
5. **Playthrough** - Bot can complete all quests (if --run)

## Output Format

```markdown
# Storyline Test Report: <storyline_id>

## Structure Validation
- Quests found: X
- Dependencies valid: ✅ | ❌
- All references exist: ✅ | ❌

## Playthrough Results (if using ChannelBot test)
- Started: ✅
- Quests completed: X/Y
- Objectives achieved: Z
- Final status: COMPLETED | STUCK | FAILED

## Issues Found
[List of errors/warnings]

## Summary
Status: ✅ COMPLETABLE | ❌ BLOCKED AT [quest_id]
```

## Common Issues and Fixes

### Bot Can't Accept Quest
- Ensure quest offer is in FIRST dialogue node
- Check `action: ["accept_quest", "quest_id"]` syntax

### Bot Can't Find NPC
- Verify NPC spawns in expected room
- Check room has correct spawn configuration
- Ensure NPC key matches objective target_id

### Quest Not Activating
- For system quests: ensure `giver: system`
- For NPC quests: verify dialogue has accept action

### Objective Not Completing
- Verify target_id matches entity key exactly
- Check objective type is correct (talk vs kill vs get_item)

## Success Criteria

- All quests in storyline complete
- No infinite loops
- Bot finishes with success status
- Reasonable completion time

## Notes

- **Always prefer ChannelBot tests** over the legacy mix task
- ChannelBot tests are integrated with ExUnit test suite
- The legacy task is maintained for backwards compatibility only
- Run storyline tests after any quest/dialogue changes
