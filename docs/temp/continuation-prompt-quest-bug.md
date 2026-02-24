# Continuation Prompt: grove_sacrifice Turn-In Bug + Bot Robustness

## What Was Fixed Already

1. **Planet NPC key collision (DONE)**: Planet grove rooms had spawns with same NPC keys as grove NPCs. Created 4 planet NPC prototypes (`planet_elder_maren`, `planet_kira`, `planet_tomas`, `planet_brennan`) in `priv/world/prototypes/npcs/planet/` inheriting from originals. Updated planet room spawns to use new keys.

2. **Barren exit mismatch (DONE)**: 3 barren margin rooms referenced `planet_the_edge`, `planet_edge_west`, `planet_edge_east` — fixed to `the_edge`, `edge_west`, `edge_east` in `priv/world/prototypes/rooms/barren/margin/{threshold_gate,western_threshold,eastern_threshold}.yml`.

3. **grove_sacrifice missing complete_quest action (PARTIAL)**: Added `action: ["complete_quest", "grove_sacrifice"]` to `after_sacrifice_3` "(Leave)" choice in `elder_maren.yml`. Added `dialogue_topic: after_sacrifice` to `speak_to_maren_after` objective in `grove_sacrifice.yml`. Added `show_if: { quest_active: grove_sacrifice }` to `after_sacrifice` node.

## Current Bug: speak_to_maren_after Already Marked Done

The `after_sacrifice` dialogue topic objective (`speak_to_maren_after`) is already `done=true` before the bot ever reaches Maren for the turn-in. Log evidence:
```
[DIALOGUE] topic_check: quest=grove_sacrifice obj=speak_to_maren_after topic=after_sacrifice done=true in_tree=true
```

Because `done=true`, `find_quest_dialogue_topic` skips the `after_sacrifice` node and falls through to `start`. The bot never reaches `after_sacrifice_3` where the `complete_quest` action lives.

### Root Cause Analysis

The objective gets completed early because of how dialogue tracking works:

- `dialogue.ex` line 50: Every dialogue node visit fires `Progress.update_progress(character, %{type: :talk, target_id: target_key, dialogue_topic: node_id})`
- `tracking.ex` line 182: `topic_matches = is_nil(obj_topic) || obj_topic == "" || obj_topic == dialogue_topic`
- BUT there's also `ObjectiveRegistry.check_event` (line 117) which may use a different handler

The question: Is the `ObjectiveRegistry` handler for `:talk` matching too broadly? Or is there another path that marks the objective done?

### What To Investigate

1. **ObjectiveRegistry talk handler**: Find the `:talk` handler module registered in ObjectiveRegistry. Check its `matches?/2` function — does it check `dialogue_topic` correctly?

2. **Early completion path**: The bot talks to Maren earlier in grove_sacrifice (possibly during grove_revelation's Maren interactions, or during other quests). If grove_sacrifice becomes active while the bot is already talking to Maren, the tracking might fire.

3. **Possible fix approaches**:
   a. Make the `complete_quest` action fire on a NODE action (not a choice action) — put it on the `after_sacrifice_3` node itself so it fires when the player ARRIVES at that node, not when they make a choice
   b. Move the `complete_quest` to a system-level trigger (quest auto-completes when all objectives are done)
   c. Fix the talk handler to properly check `dialogue_topic` matching

### How To Reproduce

```bash
cd /Users/raymondluong/dev/lokacore/server
LOG_LEVEL=info mix test test/integration/storyline_channel_test.exs:54 --include integration 2>&1 | grep -E "\[DIALOGUE\] topic_check.*sacrifice"
```

## Bot Robustness Question

The user also asked about making the bot more robust/antifragile. Key areas:

1. **Disconnected graph handling**: The bot currently falls back to `explore_random` when no path exists, which can send it into disconnected zones. Consider: build graph once, identify connected components, restrict navigation to the component containing the starting room.

2. **Dialogue loop detection**: The bot can get stuck repeating the same dialogue if it can't find the right choice. Add a counter — if the same NPC is talked to N times without progress, skip and try a different approach.

3. **Quest completion timeout**: If a quest objective hasn't progressed in N turns, the strategy should try alternative approaches or log detailed diagnostics.

4. **State validation on phase transition**: When entering a new phase, validate that preconditions hold (e.g., when entering `find_quest_giver`, verify the quest is actually still active on the server).

## Files Modified in This Session

- `lib/loka/testing/quest_strategy.ex` — reverted to simple `find_entity_room`, cleaned up debug logging
- `priv/world/prototypes/rooms/barren/margin/threshold_gate.yml` — fixed exit key
- `priv/world/prototypes/rooms/barren/margin/western_threshold.yml` — fixed exit key
- `priv/world/prototypes/rooms/barren/margin/eastern_threshold.yml` — fixed exit key
- `priv/world/prototypes/npcs/planet/planet_elder_maren.yml` — NEW
- `priv/world/prototypes/npcs/planet/planet_kira.yml` — NEW
- `priv/world/prototypes/npcs/planet/planet_tomas.yml` — NEW
- `priv/world/prototypes/npcs/planet/planet_brennan.yml` — NEW
- `priv/world/prototypes/rooms/planet/grove/planet_elder_hall.yml` — spawn key updated
- `priv/world/prototypes/rooms/planet/grove/planet_healing_grove.yml` — spawn key updated
- `priv/world/prototypes/rooms/planet/grove/planet_training_grove.yml` — spawn key updated
- `priv/world/prototypes/rooms/planet/grove/planet_watchers_post.yml` — spawn key updated
- `priv/world/prototypes/npcs/grove/elder_maren.yml` — added complete_quest action + show_if
- `priv/world/quests/grove_sacrifice.yml` — added dialogue_topic to speak_to_maren_after

## Landing Sequence Proposal

Written to `docs/temp/landing-sequence-proposal.md` — read this for the full creative proposal.
