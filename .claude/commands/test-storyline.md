# Test Storyline

Run storyline E2E tests to validate quest chains are completable.

## Usage

```
/test-storyline
```

## Instructions

Run the ChannelBot-based storyline E2E test:

```bash
cd server && mix test test/integration/storyline_channel_test.exs
```

This tests the **real production code path** with 95% production parity:
- GameChannel message handling
- Action serialization
- WebSocket event delivery

For trace output:
```bash
cd server && mix test test/integration/storyline_channel_test.exs --trace
```

## Validation Steps

When running storyline validation:

1. **Structure Check** - All quests in storyline exist
2. **Dependency Check** - Quest chain dependencies are valid
3. **Act Validation** - All acts have quests, required acts exist
4. **Starting Room** - Starting room prototype exists
5. **Playthrough** - ChannelBot can complete all quests

## Output Format

```markdown
# Storyline Test Report

## Playthrough Results
- Started: pass/fail
- Quests completed: X/Y
- Objectives achieved: Z
- Final status: COMPLETED | STUCK | FAILED

## Issues Found
[List of errors/warnings]

## Summary
Status: COMPLETABLE | BLOCKED AT [quest_id]
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

- ChannelBot tests are integrated with ExUnit test suite
- Run storyline tests after any quest/dialogue changes
- The legacy `mix loka.test.storyline` task has been deleted (Feb 2026)
