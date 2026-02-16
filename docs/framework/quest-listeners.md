# Quest Listeners - Event-Based Auto-Tracking (V2)

> **For custom handlers, see `quest-system.md`**
> **For YAML format, see `docs/builder-reference/quest-reference.md`**

## Overview (V2)

Quest listeners automatically track objective progress via PubSub events. No manual checking needed.

```
Player Action → PubSub Event → Quest Listener → Progress Update
```

## Event Subscriptions

| Event | Objective Type | Trigger |
|------|---------------|---------|
| `:entity_entered_room` | `go_to` | Player enters a room |
| `:item_received` | `get_item` | Player picks up item |
| `:entity_killed` | `kill` | Entity dies (player-caused) |

## Scaling

The system scales well:
- **Per-player processing** - Each EntityServer handles its own quest checks
- **No shared state** - Quest progress in player's `components["quests"]`
- **O(n)** where n = active quests (typically 1-5)

## Direct-Call Helpers

For manual triggering (returns updated state):

```elixir
alias Loka.Framework.Quest.Listeners, as: QuestListeners

# Room entry
{updated_player, quest_events} = QuestListeners.check_room_entry(player, room_key)

# Item pickup
{updated_player, quest_events} = QuestListeners.check_item_received(player, item_key)

# Entity kill
{updated_player, quest_events} = QuestListeners.check_entity_death(player, entity_key, count)
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
- [docs/builder-reference/quest-reference.md](../builder-reference/quest-reference.md) - YAML format
- [docs/architecture/event-system.md](../architecture/event-system.md) - PubSub event system
