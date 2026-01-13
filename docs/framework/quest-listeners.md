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

## Elixir Scripting API

Scripts use sandboxed Elixir bindings. See `docs/architecture/elixir-scripts-design.md` for full API.

### Quest Functions

```elixir
# Check if quest is active
quest_active?("main_quest")

# Check if quest is completed
quest_complete?("tutorial")
```

### Player Functions

```elixir
# Check inventory
has_item?("key")

# Check flags
has_flag?("spoke_to_elder")

# Get stats
get_stat("gold")
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
