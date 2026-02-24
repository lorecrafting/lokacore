# Bot Antifragility Plan

A prioritized plan to make the QuestStrategy + ChannelBot robust against all known failure modes.

## Critical Fixes (Do First)

### C1. Atom vs String Objective ID Mismatch

**Bug**: `find_next_objective` uses `Map.get(objectives_progress, obj.id, %{})` where `obj.id` is an atom (`:meet_thera`) but channel JSON keys are strings (`"meet_thera"`). Objectives appear forever incomplete.

**Fix**: In `find_next_objective`, check both atom and string forms:
```elixir
obj_progress = Map.get(objectives_progress, obj.id) ||
               Map.get(objectives_progress, to_string(obj.id), %{})
```
Same pattern already used in `kill_objective_complete?` (lines 1662-1678).

**File**: `quest_strategy.ex` ~line 1630

---

### C2. Silent Push Error Swallowing

**Bug**: All `push()` return values in `channel_bot.ex` are ignored. `%Phoenix.Socket.Reply{status: :error}` messages are silently discarded in `receive_events_loop`. The bot sends talk/navigate commands that fail on the server, never knows, and enters infinite retry loops with no errors recorded.

**Fix**: Match `%Phoenix.Socket.Reply{status: :error, payload: payload}` in `receive_events_loop` and store errors in `bot.errors` list. Expose via `bot.last_error` field so the strategy can check it.

**File**: `channel_bot.ex` ~lines 419-441

---

### C3. Phase Oscillation Detection

**Bug**: The phase stuck detector only catches SAME-PHASE stagnation (`phase == last_phase` for N ticks). Phase oscillation (`:init` → `:navigate` → `:init` → `:navigate`) resets the counter on every transition and is completely invisible. This is the most common failure pattern.

**Fix**: Add a rolling history buffer (last 10 phases). If the buffer shows a repeating pattern (e.g., `[:init, :navigate, :init, :navigate, ...]`), trigger stuck recovery. Simple implementation:
```elixir
# In strategy_state:
phase_history: [],  # last 10 phases

# On each tick:
history = Enum.take([current_phase | state.phase_history], 10)
oscillating = length(history) >= 6 and length(Enum.uniq(history)) <= 2
```

**File**: `quest_strategy.ex` ~lines 283-301

---

## High Priority

### H1. Per-Objective Attempt Counter

**Problem**: No tracking of how many times an objective has been attempted. Impossible objectives (unreachable NPC, broken dialogue) silently consume all `max_steps`.

**Fix**: Add `objective_attempts: %{}` to strategy state. Increment `attempts[obj.id]` each time `setup_objective_target` is called for that objective. After N attempts (e.g., 20), log an error to `results.errors` with the objective ID and skip to the next objective (or mark quest as blocked).

**File**: `quest_strategy.ex` in `work_on_quest` and `setup_objective_target`

---

### H2. Smarter Random Exploration

**Problem**: `explore_random` picks a random exit with no memory. In a linear corridor, the bot oscillates between 2 rooms indefinitely.

**Fix**: Add `recently_visited: []` (last 5 room IDs) to strategy state. In `explore_random`, prefer exits leading to rooms NOT in `recently_visited`. Only fall back to any random exit if all exits lead to recently visited rooms. This prevents oscillation while keeping exploration simple.

```elixir
exits = room[:exits] || []
unvisited = Enum.reject(exits, fn {_dir, room_id} ->
  room_id in state.recently_visited
end)
chosen = if unvisited != [], do: Enum.random(unvisited), else: Enum.random(exits)
```

**File**: `quest_strategy.ex` ~lines 1230-1246

---

### H3. Cache and Reuse Room Graph

**Problem**: `build_full_room_graph()` does a full DB scan (`Entities.list_by_type(:exit)`) on every path failure. With 200+ exits, this is expensive and the result is always the same within a test run.

**Fix**: Build the graph once on first use and store it in `strategy_state.room_graph_cache`. Clear the cache only on explicit invalidation (e.g., after a teleport action). This turns O(N) per failed path into O(1) amortized.

**File**: `quest_strategy.ex` ~lines 1171-1192

---

### H4. Dialogue Loop Detection

**Problem**: The bot can get stuck in cyclic dialogue nodes (choice 0 leads back to the same node). The phase stuck detector catches it after 30 ticks but resets to `:init` which re-enters the same dialogue.

**Fix**: Track `dialogue_node_visits: %{}` in strategy state. Increment `visits[node_id]` each time a dialogue node is visited. If any node is visited > 3 times in the same dialogue session, force-exit the dialogue by picking the exit choice (next: null) or sending a leave action.

**File**: `quest_strategy.ex` in `dialogue_phase`

---

### H5. Unknown Objective Type Warning

**Problem**: The `_` catch-all in `setup_objective_target` returns `{:wait, 500}` with no logging. New objective types silently loop.

**Fix**: Log a warning with the objective type and ID, and add an error to `results.errors`:
```elixir
_ ->
  Logger.warning("[STRATEGY] Unknown objective type: #{inspect(obj.type)} for #{obj.id}")
  state = record_error(state, "Unknown objective type: #{inspect(obj.type)}")
  {{:wait, 500}, state}
```

**File**: `quest_strategy.ex` ~lines 1119-1121

---

## Medium Priority

### M1. Stuck Recovery Diagnostics

**Problem**: When the stuck detector fires, it silently resets to `:init`. No error is recorded, no context is logged. Test failures show "timed out" with no clue about which phase/objective caused the hang.

**Fix**: On stuck detection, log and record:
```elixir
error_msg = "Stuck in #{state.phase} for #{state.phase_ticks} ticks. " <>
            "Quest: #{state.current_quest_id}, Obj: #{state.current_objective && state.current_objective.id}, " <>
            "Target: #{state.target_entity_key}"
Logger.warning("[STRATEGY] #{error_msg}")
state = record_error(state, error_msg)
```

**File**: `quest_strategy.ex` ~lines 299-302

---

### M2. Nil Room ID Guard

**Problem**: When `find_entity_room` returns nil (NPC not spawned yet), the bot enters perpetual random exploration with no diagnostic.

**Fix**: In `navigate_or_explore`, when `target_room_id` is nil AND `target_entity_key` is non-nil, log a warning and record the error. After 3 failed lookups for the same entity, skip the objective.

**File**: `quest_strategy.ex` ~lines 1128-1133

---

### M3. Event Burst Handling

**Problem**: `receive_events_loop` caps at 20 events per tick. During dialogue chains with rapid server pushes, events can queue past the cap.

**Fix**: Increase cap to 50, or add a second drain pass after strategy tick if the first drain hit the cap (indicating more events may be pending).

**File**: `channel_bot.ex` ~line 419

---

### M4. `has_new_quest_active?` Side Quest Filtering

**Problem**: Returns true for ANY active quest different from `current_quest_id`, including unrelated side quests. Can cause premature dialogue exit.

**Fix**: Filter to quests in the current storyline's quest order only:
```elixir
def has_new_quest_active?(game_state, current, quest_filter) do
  active_ids = get_active_quest_ids(game_state)
  relevant = if quest_filter, do: Enum.filter(active_ids, &(&1 in quest_filter)), else: active_ids
  Enum.any?(relevant, &(&1 != current))
end
```

**File**: `quest_strategy.ex` ~lines 1684-1693

---

### M5. Validate Navigate Destination

**Problem**: `navigate_phase` blindly follows a pre-computed path. If the destination room changed (NPC moved), the bot arrives at the wrong room and wastes turns.

**Fix**: After path completion (path is empty, should be at target), verify `context.current_room_id == target_room_id`. If not, clear path and re-compute. Log the mismatch.

**File**: `quest_strategy.ex` ~lines 775-790

---

## Low Priority

### L1. Entity Location Cache TTL

Add a timestamp to `entity_locations` entries. Evict entries older than 30 seconds (adjustable). Prevents stale cached locations from misleading navigation.

### L2. Normalize Quest Structure Safety

The test-side `normalize_quest_structure` can silently wipe active quests when `active` is a list. Add a guard:
```elixir
%{active: active} when is_list(active) and active != [] ->
  Logger.warning("[BOT] Active quests in unexpected list format, converting")
  ...
```

### L3. Channel Reconnect

Add `handle_info({:DOWN, ...})` monitoring of the socket process. On disconnect, attempt one reconnect with backoff. For tests, just log and stop gracefully instead of silently failing all subsequent pushes.

### L4. Game State Flags Passthrough

Pass actual character flags (from `entity.components["flags"]`) into `game_state.flags` context so flag-gated dialogue paths work in the bot.

### L5. False Completion Corrector Loop Guard

Add a counter: if the same quest is "un-completed" more than 3 times, log an error and stop trying. This prevents infinite correction loops on server-side quest state bugs.

---

## Implementation Order

```
Session 1: C1 + C2 + C3 (critical fixes, ~30 min)
Session 2: H1 + H2 + H3 (navigation + objective robustness, ~30 min)
Session 3: H4 + H5 + M1 (dialogue + diagnostics, ~20 min)
Session 4: M2-M5 (medium priority, ~30 min)
Session 5: L1-L5 (low priority, as needed)
```

## Metrics to Track

After implementing fixes, the bot should:
1. Complete all 5 spine quests in < 120s (currently times out at 170s)
2. Zero "stuck resets" per quest (currently unlimited)
3. All failures produce descriptive entries in `results.errors`
4. No silent push error swallowing
5. Phase oscillation detected within 6 ticks (currently never detected)
