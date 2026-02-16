# Quest System - Developer Guide

> **For YAML format and content creation, see `docs/builder-reference/quest-reference.md`**
>
> This document covers the Elixir architecture for developers extending the quest system.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ CONTENT LAYER (YAML)                                                │
│   priv/world/quests/*.yml - Quest definitions                      │
├─────────────────────────────────────────────────────────────────────┤
│ ENTITY SEEDER (V2)                                                  │
│   EntitySeeder.seed() - Loads YAML → entity structs → SQLite       │
│   Content.Quest.get(key) - Type-safe quest accessor                │
│   Entities.find_one(key: key, type: :quest) - Direct query         │
├─────────────────────────────────────────────────────────────────────┤
│ STATE MACHINE (V2)                                                  │
│   StateMachine engine for quest progress states                    │
│   States: not_started → active → complete / failed                 │
├─────────────────────────────────────────────────────────────────────┤
│ QUEST FRAMEWORK                                                     │
│   Quest.Progress - Accept, track, turn-in quests                   │
│   Quest.Listeners - Event callbacks for auto-tracking               │
├─────────────────────────────────────────────────────────────────────┤
│ ENGINE LAYER                                                        │
│   Event system - PubSub for game events                             │
│   Components - Player quest state in components["quests"]           │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Modules

| Module | Purpose |
|--------|---------|
| `Content.Quest` | Type-safe quest accessor (V2) |
| `Entities` | Direct entity queries (V2) |
| `Quest.Progress` | Accept, track progress, turn-in quests |
| `Quest.Listeners` | Event callbacks for auto-tracking |
| `Quest.Validator` | Validate quest definitions |

## Objective Handler System

The quest system uses a plugin architecture for objective types. Each objective type (`:kill`, `:go_to`, `:get_item`, `:talk`) has a handler module.

### Built-in Handlers

| Handler | Objective Type | Triggered By |
|---------|---------------|--------------|
| `KillHandler` | `:kill` | `:at_death` hook |
| `GoToHandler` | `:go_to` | `:at_enter_room` hook |
| `GetItemHandler` | `:get_item` | `:at_object_receive` hook |
| `TalkHandler` | `:talk` | Dialogue system callback |

### Creating a Custom Handler

```elixir
defmodule MyGame.Quest.Handlers.CraftHandler do
  @moduledoc "Handler for 'craft' objective type"

  @behaviour Loka.Framework.Quest.ObjectiveHandler

  @impl true
  def type, do: :craft

  @impl true
  def check_completion(objective, context) do
    # Check if player crafted the target item
    crafted_items = context.game_state.crafted_items || []
    count = Enum.count(crafted_items, &(&1 == objective.target_id))

    %{
      completed: count >= (objective.target_count || 1),
      progress: count
    }
  end

  @impl true
  def validate(objective) do
    cond do
      !objective.target_id -> {:error, "craft requires target_id"}
      true -> :ok
    end
  end
end
```

### Registering a Custom Handler

```elixir
# In your application startup
Quest.ObjectiveRegistry.register(MyGame.Quest.Handlers.CraftHandler)
```

## Quest State Management (V2)

**Quest Definitions:** Content entities (`type: :quest`) seeded from YAML via `EntitySeeder`. Stored in SQLite `entities` table with `components["data"]` containing quest structure.

**Player Progress:** Stored in player entity's `components["quests"]`:

```elixir
%{
  active: %{
    "quest_id" => %{
      "objectives" => %{
        "obj_id" => %{
          "completed" => false,
          "progress" => 0,
          "started_at" => ~U[2024-01-01 00:00:00Z]
        }
      },
      "accepted_at" => ~U[2024-01-01 00:00:00Z]
    }
  },
  completed: ["old_quest_1", "old_quest_2"]
}
```

### API Functions (V2)

```elixir
# Get quest definition
{:ok, quest} = Content.Quest.get("quest_id")

# Accept a quest
{:ok, player} = Quest.Progress.accept_quest(player, "quest_id")

# Update objective progress
{:ok, player} = Quest.Progress.update_objective(player, "quest_id", "obj_id", progress)

# Complete objective
{:ok, player} = Quest.Progress.complete_objective(player, "quest_id", "obj_id")

# Turn in quest (apply rewards)
{:ok, player} = Quest.Progress.turn_in_quest(player, "quest_id")

# Check quest state
Quest.Progress.quest_active?(player, "quest_id")
Quest.Progress.quest_completed?(player, "quest_id")
Quest.Progress.all_objectives_complete?(player, "quest_id")
```

## Event-Based Auto-Tracking (V2)

Quest listeners subscribe to PubSub events to auto-complete objectives:

```elixir
# Events published via Phoenix.PubSub
Phoenix.PubSub.broadcast(Loka.PubSub, "entity:#{player_id}", {:entity_entered_room, room_key})
Phoenix.PubSub.broadcast(Loka.PubSub, "entity:#{player_id}", {:entity_killed, entity_key})
Phoenix.PubSub.broadcast(Loka.PubSub, "entity:#{player_id}", {:item_received, item_key})
```

When an event fires, the listener:
1. Finds active quests with matching objective type
2. Checks objective completion criteria
3. Updates quest state in player components

## Validation

```elixir
# Validate all quests
{:ok, results} = Quest.Validator.validate()

# Validate specific quest
{:ok, {errors, warnings}} = Quest.Validator.validate_quest("quest_id")

# Check if valid
Quest.Validator.valid?()
```

## Testing

```bash
# Run quest validators
mix loka.test.validate --only quest

# Run storyline bot test
mix loka.test.storyline monastery_arc --run
```

### Dependency Analysis Tools

```elixir
alias Loka.WorldBuilder.Analysis.DependencyGraph

# Build the dependency graph
{:ok, graph} = DependencyGraph.build()

# Find broken quest references
DependencyGraph.find_broken_references(graph)

# Get quest dependencies
DependencyGraph.dependencies_for(graph, "quest:quest_id")

# Find what depends on a quest
DependencyGraph.dependents_of(graph, "quest:quest_id")
```

## See Also

- `docs/builder-reference/quest-reference.md` - YAML format reference
- `docs/builder-reference/dialogue-reference.md` - Dialogue integration
- `docs/builder-reference/quest-dialogue-patterns.md` - Common patterns
- `Quest.Progress` moduledoc - API details
- `Quest.ObjectiveRegistry` moduledoc - Handler registration
