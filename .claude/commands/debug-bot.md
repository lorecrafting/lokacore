# Debug Bot Tests

Systematically debug failing ChannelBot tests using log analysis and iterative fixes.

> **Timeout Budget**: 15 minutes (can extend if making progress)

## When to Use

Run this when:
- Bot integration tests fail
- Bot gets stuck in infinite loop
- Quest objectives not completing
- Bot can't find NPCs or navigate

## Systematic Debugging Process

### Step 1: Run Test and Capture Logs

```bash
mix test test/loka/testing/quest_bot_integration_test.exs --trace 2>&1 | tee /tmp/bot_test.log
```

Capture:
- Strategy phase transitions
- Quest state changes
- Event flow (dialogue_start, game_state, room_update)
- Error messages

### Step 2: Identify Failure Pattern

Look for these common patterns in logs:

#### Pattern A: Stuck in Same Phase
```
[STRATEGY] next_action: phase=:dialogue
[STRATEGY] next_action: phase=:dialogue
[STRATEGY] next_action: phase=:dialogue (repeating)
```
**Root Cause**: Can't transition out of phase
**Investigation**: What condition is blocking transition?

#### Pattern B: Events Not Received
```
[ACTION_BRIDGE] Broadcasting game_state update
(no corresponding [ChannelBot] game_state event)
```
**Root Cause**: Event not reaching bot
**Investigation**: Is Phoenix.Channel.push() called? Is bot calling receive_events()?

#### Pattern C: Stale Data
```
Tick 50: objective completed=false
(but logs show objective completed at tick 30)
```
**Root Cause**: Bot using old data
**Investigation**: Event timing - is receive_events() called before build_context()?

#### Pattern D: Data Shape Mismatch
```
dialogue_phase: current_node=nil
(but GameChannel sends different structure)
```
**Root Cause**: Reading wrong field name
**Investigation**: What does GameChannel actually send?

#### Pattern E: Missing Implementation
```
** (UndefinedFunctionError) function QuestStrategy.init/1 is undefined
```
**Root Cause**: Missing behavior callback
**Investigation**: Does strategy implement required callbacks?

### Step 3: Read Context Files

Read files in this order based on failure pattern:

**For Phase Transitions:**
1. `lib/loka/testing/quest_strategy.ex` - Decision logic
   - Check phase handler functions
   - Verify transition conditions
   - Look for data structure assumptions

**For Event Issues:**
2. `lib/loka/testing/bot/channel_bot.ex` - Execution layer
   - Check receive_events() implementation
   - Verify execute_action() sends correct messages
   - Check event timing in tick() function

**For State Updates:**
3. `lib/loka_web/channels/game_channel/action_bridge.ex` - Game integration
   - Check if state changes are applied
   - Verify events are broadcast with Phoenix.Channel.push()
   - Look for maybe_assign(:game_state) patterns

**For Game Logic:**
4. Game action modules (dialogue.ex, navigation.ex, etc.)
   - Check if action updates game state
   - Verify objective tracking (Quest.update_progress calls)
   - Look for event emission

### Step 4: Common Fixes

Apply these fixes based on root cause:

#### Fix 1: Event Timing
**Problem**: receive_events() called after build_context()
**Solution**:
```elixir
def tick(bot) do
  bot = receive_events(bot)      # FIRST - get fresh data
  context = build_context(bot)   # THEN - use fresh data
  # ...
end
```

#### Fix 2: Missing Broadcast
**Problem**: State changes on server but bot doesn't see them
**Solution**:
```elixir
defp maybe_assign(socket, :game_state, value) do
  Phoenix.Channel.push(socket, "game_state", %{quests: value.quests})
  Phoenix.Socket.assign(socket, :game_state, value)
end
```

#### Fix 3: Data Shape Mismatch
**Problem**: Reading field that doesn't exist
**Solution**:
```elixir
# Check what GameChannel actually sends, then read correctly
choices = dialogue_state[:choices] || dialogue_state["choices"] || []
```

#### Fix 4: Key Conversion
**Problem**: String keys vs atom keys
**Solution**:
```elixir
quests_with_atom_keys = %{
  active: Map.get(value.quests, "active", %{}),
  completed: Map.get(value.quests, "completed", [])
}
```

#### Fix 5: Missing Objective Tracking
**Problem**: Action happens but objective not marked complete
**Solution**:
```elixir
def start_conversation(ctx, entity_id) do
  # Track objective
  new_game_state = Quest.update_progress(game_state, %{
    type: :talk,
    target_id: entity.key
  })
  # ...
end
```

### Step 5: Test and Iterate

1. Apply fix
2. Run test again
3. Check if failure pattern changed
4. If still failing, repeat from Step 2
5. If passing, commit changes

**Maximum Iterations**: 10 fixes per session

## Success Criteria

Test passes with:
- ✅ Bot completes at least 1 quest objective
- ✅ No infinite loops (same phase > 20 ticks)
- ✅ No `:stuck` or `:failed` terminal states
- ✅ strategy_state.results shows progress

## After Fixing

1. Run full test suite to ensure no regressions
2. Commit with descriptive message explaining fix
3. Update this document with new patterns discovered

## Reference

Key bot concepts:
- **Phase**: Current state machine phase (init, navigate, dialogue, interact, etc.)
- **Context**: Data passed to strategy (room, entities, quests, dialogue)
- **Action**: What bot should do next (move, talk, attack, etc.)
- **Event**: Server → Client message (room_update, game_state, dialogue_start)
- **Tick**: One decision cycle (receive events → decide → execute → update)
