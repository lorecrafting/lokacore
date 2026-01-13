---
paths: ["priv/world/**"]
---

# Content Creation Context

This context auto-loads when working in `priv/world/`.

## Content Types

| Directory | Content | Format |
|-----------|---------|--------|
| `prototypes/npcs/` | NPC definitions | YAML |
| `prototypes/items/` | Item definitions | YAML |
| `prototypes/rooms/` | Room definitions | YAML |
| `quests/` | Quest definitions | YAML |
| `storylines/` | Story arc definitions | YAML |
| `recipes/` | Crafting recipes | YAML |
| `cutscenes/` | Cutscene sequences | YAML |

## Quest YAML Format

```yaml
id: quest_unique_id           # Required - unique identifier
name: "Quest Display Name"    # Required - shown to player
description: |                # Optional
  Multi-line description
giver: system | npc_key       # Required - "system" or NPC key
type: main | side | daily     # Optional - defaults to "side"
objectives:                   # Required - at least one
  - id: objective_id
    type: talk | kill | get_item | go_to
    target_id: entity_key
    description: "What to do"
    count: 1                  # For kill/get_item
rewards:                      # Optional
  xp: 100
  gold: 50
```

### Objective Types

| Type | target_id | count | Description |
|------|-----------|-------|-------------|
| `talk` | NPC key | N/A | Talk to NPC |
| `kill` | Enemy key | Yes | Defeat enemies |
| `get_item` | Item key | Yes | Collect items |
| `go_to` | Room key | N/A | Visit location |

## Dialogue YAML Format

```yaml
dialogue_tree:
  start:                        # Entry node (required)
    text: "NPC greeting text"
    show_if:                    # Optional conditions
      quest_active: "quest_id"
    choices:
      - text: "[Accept Quest] I'll help"
        next: "accepted"
        action: ["accept_quest", "quest_id"]
      - text: "Tell me more"
        next: "more_info"
      - text: "Goodbye"
        next: null              # Ends conversation

  accepted:
    text: "Thank you for accepting!"
    choices:
      - text: "I'll get started"
        next: null
```

### Dialogue Conditions

| Condition | Usage |
|-----------|-------|
| `quest_active: "id"` | Show if quest is active |
| `quest_complete: "id"` | Show if quest completed |
| `quest_not_active: "id"` | Show if quest not started |
| `has_item: "item_key"` | Show if player has item |

### Dialogue Actions

| Action | Effect |
|--------|--------|
| `["accept_quest", "id"]` | Accept quest |
| `["complete_quest", "id"]` | Complete quest |
| `["give_item", "item_key"]` | Give item to player |
| `["take_item", "item_key"]` | Take item from player |

## Best Practices

### Quest Offers Must Be Upfront

**ALWAYS** put quest acceptance in the FIRST dialogue node:

```yaml
# GOOD - Quest offer is first choice
start:
  text: "Traveler! I need help with the bandits."
  choices:
    - text: "[Accept Quest] I'll help"      # FIRST
      action: ["accept_quest", "bandit_quest"]
    - text: "Tell me more"                   # SECOND
      next: "more_info"
    - text: "Not now"                        # LAST
      next: null
```

```yaml
# BAD - Quest buried in dialogue
start:
  text: "Hello traveler"
  choices:
    - text: "Who are you?"
      next: "backstory"    # Quest hidden several nodes deep
```

### Node Keys Must Be Unique

Each NPC's dialogue nodes must have unique keys:

```yaml
# BAD - Duplicate keys
start: ...
info: ...
info: ...     # DUPLICATE! Will cause errors

# GOOD - Unique keys
start: ...
general_info: ...
quest_info: ...
```

## Validation Commands

```bash
# Validate all content
mix loka.test.validate

# Run storyline test
mix loka.test.storyline monastery_arc --run

# Check specific quest dependencies (in IEx)
alias Loka.Testing.LLM.DependencyGraph
DependencyGraph.quest_dependencies("quest_id")
DependencyGraph.find_broken_references()
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing `giver` field | Add `giver: system` or `giver: npc_key` |
| Invalid objective type | Use: talk, kill, get_item, go_to |
| Buried quest offer | Move to first dialogue node |
| Duplicate node keys | Rename to be unique |
| Missing target entity | Create the NPC/item/room first |

## Documentation

- `docs/builder-reference/quest-reference.md` - Full quest spec
- `docs/builder-reference/dialogue-reference.md` - Full dialogue spec
- `docs/builder-reference/quest-dialogue-patterns.md` - Common patterns & fixes
- `docs/builder-reference/entity-reference.md` - Entity specifications
