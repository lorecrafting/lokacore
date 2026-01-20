---
name: quest-validation
description: Ensures quest and content definitions are valid. Use when editing quest YAML files, creating dialogues, modifying NPCs, or working with any content in priv/world/.
---

# Quest & Content Validation

**Auto-applies when**: Editing content YAML files in `priv/world/`

## Purpose

Ensures quest definitions and all game content are valid and follow Loka structure.

## When This Skill Activates

Activates when you:
- Create new quest files
- Edit quest definitions
- Modify objectives or rewards
- Create or edit dialogues
- Add NPCs, items, or rooms

## Content Validators (14 Total)

Loka has 14 content validators run via `mix loka.test.validate`:

| Validator | Checks | Flag |
|-----------|--------|------|
| **World** | Orphan rooms, broken exits, connectivity | `--only world` |
| **Quest (Prototypes)** | Kill/talk targets exist, components valid | `--only quest` |
| **Quest (YAML)** | Objectives, prerequisites, givers, rewards | `--only yaml_quest` |
| **Prototype** | Required fields, valid parents, known components | `--only prototype` |
| **Dialogue** | Broken refs, invalid actions, orphan nodes | `--only dialogue` |
| **Quest Chain** | Quest completion offers next quest | `--only quest_chain` |
| **Reachability** | Unobtainable items, unreachable NPCs | `--only reachability` |
| **Cutscene** | Speaker NPCs exist, valid sequences | `--only cutscene` |
| **Crafting** | Ingredient/output items exist, tools valid | `--only crafting` |
| **Storyline** | Quest references valid, act dependencies | `--only storyline` |
| **UI/Data** | Dialogue format, shop validity, quest_giver tags | `--only ui` |
| **Wander** | Wander behavior configs, allowed_rooms connectivity | `--only wander` |
| **Entity Sync** | Stale entities missing components | `--only entity_sync` |
| **Channel** | Event handlers match JSON schema definitions | `--only channel` |

## Quest YAML Validation Rules

### Required Fields
```yaml
id: quest_unique_id           # Required - unique identifier
name: "Quest Display Name"    # Required - shown to player
giver: system | npc_key       # Required - "system" or NPC key
objectives:                   # Required - at least one
  - id: objective_id
    type: talk | kill | get_item | go_to
    target_id: entity_key
```

### Objective Types
- `talk` - target_id must be valid NPC key
- `kill` - target_id must be valid enemy key, requires `count`
- `get_item` - target_id must be valid item key, requires `count`
- `go_to` - target_id must be valid room key

### Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| Missing `giver` field | Add `giver: system` or `giver: npc_key` |
| Invalid objective type | Use: `talk`, `kill`, `get_item`, `go_to` |
| Buried quest offer | Move quest acceptance to FIRST dialogue node |
| Duplicate dialogue node keys | Rename to be unique within NPC |
| Missing target entity | Create the NPC/item/room first |

## Dialogue Validation Rules

### Quest Offers Must Be Upfront

**ALWAYS** put quest acceptance in the FIRST dialogue node:

```yaml
# CORRECT - Quest offer is first choice
start:
  text: "Traveler! I need help with the bandits."
  choices:
    - text: "[Accept Quest] I'll help"      # FIRST
      action: ["accept_quest", "bandit_quest"]
    - text: "Tell me more"
      next: "more_info"
```

### Valid Dialogue Actions
- `["accept_quest", "quest_id"]`
- `["complete_quest", "quest_id"]`
- `["give_item", "item_key"]`
- `["take_item", "item_key"]`

## Validation Commands

```bash
# Validate all content
mix loka.test.validate

# Strict mode (warnings = errors)
mix loka.test.validate --strict

# Validate specific category
mix loka.test.validate --only quest
mix loka.test.validate --only dialogue

# Quick validation (skip slow checks)
mix loka.test.validate --quick
```

## Supporting Files

See `STRUCTURE.md` for complete quest YAML format reference.
