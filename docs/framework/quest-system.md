# Quest System - Developer Guide

> **For YAML format and content creation, see `docs/llm/quest-reference.md`**
>
> This document covers the Elixir architecture for developers extending the quest system.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ CONTENT LAYER (YAML)                                                │
│   priv/world/quests/*.yml - Quest definitions                      │
│   priv/world/storylines/*.yml - Storyline organization             │
├─────────────────────────────────────────────────────────────────────┤
│ OBJECTIVE HANDLER REGISTRY                                          │
│   ObjectiveRegistry - Plugin system for objective types             │
│   Handlers: KillHandler, GetItemHandler, GoToHandler, TalkHandler   │
├─────────────────────────────────────────────────────────────────────┤
│ QUEST FRAMEWORK                                                     │
│   Quest.Progress - Accept, track, turn-in quests                   │
│   Quest.Definitions - Load YAML, validate objectives               │
│   Quest.Listeners - Hook callbacks for auto-tracking                │
│   Quest.QuestRegistry - Cache YAML definitions in ETS               │
├─────────────────────────────────────────────────────────────────────┤
│ ENGINE LAYER                                                        │
│   Hooks - Register callbacks for game events                        │
│   GameState - Persist player quest progress                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Modules

| Module | Purpose |
|--------|---------|
| `Quest.Progress` | Accept, track progress, turn-in quests |
| `Quest.Definitions` | Parse YAML, validate structure |
| `Quest.QuestRegistry` | Cache quests in ETS, lookup |
| `Quest.Listeners` | Hook callbacks for auto-tracking |
| `Quest.ObjectiveRegistry` | Register/lookup objective handlers |
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

## Quest State Management

Player quest state is stored in `GameState.quests`:

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

### API Functions

```elixir
# Accept a quest
{:ok, game_state} = Quest.Progress.accept_quest(game_state, "quest_id")

# Update objective progress
{:ok, game_state} = Quest.Progress.update_objective(game_state, "quest_id", "obj_id", progress)

# Complete objective
{:ok, game_state} = Quest.Progress.complete_objective(game_state, "quest_id", "obj_id")

# Turn in quest (apply rewards)
{:ok, game_state} = Quest.Progress.turn_in_quest(game_state, "quest_id")

# Check quest state
Quest.Progress.quest_active?(game_state, "quest_id")
Quest.Progress.quest_completed?(game_state, "quest_id")
Quest.Progress.all_objectives_complete?(game_state, "quest_id")
```

## Hook-Based Auto-Tracking

Quest listeners register hooks to auto-complete objectives:

```elixir
# Registered in Quest.Listeners
Hooks.register(:at_enter_room, Quest.Listeners, :on_enter_room)
Hooks.register(:at_death, Quest.Listeners, :on_kill)
Hooks.register(:at_object_receive, Quest.Listeners, :on_item_pickup)
```

When a hook fires, the listener:
1. Finds active quests with matching objective type
2. Calls the handler's `check_completion/2`
3. Updates quest state if completed

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

### LLM Tools

```elixir
alias Loka.Testing.LLM.{DependencyGraph, ErrorFormatter}

# Find broken quest references
DependencyGraph.find_broken_references()

# Get quest dependencies
DependencyGraph.quest_dependencies("quest_id")

# Format errors with fix suggestions
ErrorFormatter.format_all_errors()
```

## See Also

- `docs/llm/quest-reference.md` - YAML format reference
- `docs/llm/dialogue-reference.md` - Dialogue integration
- `docs/llm/quest-dialogue-patterns.md` - Common patterns
- `Quest.Progress` moduledoc - API details
- `Quest.ObjectiveRegistry` moduledoc - Handler registration
