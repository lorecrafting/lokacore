# Quest Listeners - Hook-Based Auto-Tracking

> **For custom handlers, see `quest-system.md`**
> **For YAML format, see `docs/llm/quest-reference.md`**

## Overview

Quest listeners automatically track objective progress via hooks. No manual checking needed.

```
Player Action → Hook Fires → Quest Listener → Progress Update
```

## Registered Hooks

| Hook | Objective Type | Trigger |
|------|---------------|---------|
| `:at_enter_room` | `go_to` | Player enters a room |
| `:at_object_receive` | `get_item` | Player picks up item |
| `:at_death` | `kill` | Entity dies (player-caused) |

## Scaling

The system scales well:
- **Per-player processing** - Each LiveView handles its own quest checks
- **No shared state** - Quest progress in each player's `game_state`
- **O(n)** where n = active quests (typically 1-5)

## Direct-Call Helpers

For manual triggering (returns updated state):

```elixir
alias Loka.Framework.Quest.Listeners, as: QuestListeners

# Room entry
{updated_state, quest_events} = QuestListeners.check_room_entry(game_state, room_key)

# Item pickup
{updated_state, quest_events} = QuestListeners.check_item_received(game_state, item_key)

# Entity kill
{updated_state, quest_events} = QuestListeners.check_entity_death(game_state, entity_key, count)
```

## Lua Scripting API

### Quest Functions (`game.quest.*`)

```lua
-- Check if quest is active
if game.quest.is_active("main_quest") then
  -- Player has this quest
end

-- Check if quest is completed
if game.quest.is_complete("tutorial") then
  -- Player finished this quest
end
```

### Player Functions (`game.player.*`)

```lua
-- Check inventory
if game.player.has_item("key") then
  -- Player has the item
end

-- Check flags
if game.player.has_flag("spoke_to_elder") then
  return "elder_greeting_return"
end

-- Get stats
local gold = game.player.get_stat("gold")
```

## Event Logging

All progress updates are logged to `Quest.EventLog`:

```elixir
alias Loka.Framework.Quest.EventLog

# See all events for a player's quest
events = EventLog.get_events(player_id, quest_id: "find_treasure")

# Diagnose a specific objective
diagnosis = EventLog.diagnose_objective(player_id, "find_treasure", "defeat_boss")
```

## Testing

```bash
# Run quest tests
mix test test/loka/framework/quest

# Validate quest definitions
mix loka.test.validate
```

## See Also

- [quest-system.md](quest-system.md) - Elixir API & custom handlers
- [docs/llm/quest-reference.md](../llm/quest-reference.md) - YAML format
- [docs/architecture/hooks-and-locks.md](../architecture/hooks-and-locks.md) - Hook system
