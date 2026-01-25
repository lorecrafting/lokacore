# Content Generators Guide

> **For Developers and Builders**: How to use `mix loka.new` to scaffold game content

---

## Overview

The `mix loka.new` task generates valid, pre-validated YAML scaffolds for game content. All generated files pass validation out of the box and include TODO markers for customization.

**Generator Status:** ✅ Verified (2026-01-24)

---

## Available Generators

| Content Type | Command | Output Location | Schema |
|--------------|---------|-----------------|--------|
| **Quest** | `mix loka.new quest <name>` | `priv/world/quests/<name>.yml` | `Content.Quest` |
| **NPC** | `mix loka.new npc <name>` | `priv/world/prototypes/npcs/<name>.yml` | `Entity` type `:npc` |
| **Room** | `mix loka.new room <name>` | `priv/world/prototypes/rooms/<name>.yml` | `Entity` type `:room` |
| **Storyline** | `mix loka.new storyline <name>` | `priv/world/storylines/<name>.yml` | Storyline |

---

## Quest Generator

### Command

```bash
mix loka.new quest <name> [options]
```

### Options

- `--giver=<npc_key>` - NPC who offers the quest (default: "system")
- `--type=<quest_type>` - Quest type: main, side, repeatable (default: "side")

### Example

```bash
mix loka.new quest rescue_villagers --giver=elder_npc --type=main
```

### Generated YAML

```yaml
id: rescue_villagers
name: "Rescue Villagers"
description: |
  TODO: Write a compelling quest description here.
  Explain what the player needs to do and why it matters.
giver: elder_npc
type: main
level_requirement: 1
objectives:
  - id: first_objective
    type: talk
    target_id: TODO_npc_key
    description: "TODO: Describe what the player must do"
    # Optional: dialogue_topic: node_name
rewards:
  xp: 50
  # Optional: items, gold, unlocks, reputation
journal_entries:
  start: "TODO: Journal entry when quest is accepted"
  completed: "TODO: Journal entry when quest is completed"
```

### Next Steps

1. Update TODO fields with real content
2. Add quest to a storyline in `priv/world/storylines/`
3. Run `mix loka.test.validate --only quest` to verify

---

## NPC Generator

### Command

```bash
mix loka.new npc <name> [options]
```

### Options

- `--type=<npc_type>` - NPC type: friendly, hostile, vendor, quest_giver (default: "friendly")
- `--parent=<prototype>` - Parent prototype (default: "base_npc")

### Example

```bash
mix loka.new npc blacksmith_tom --type=vendor
```

### Generated YAML

```yaml
key: blacksmith_tom
type: npc
parent: base_npc
short_desc: "Blacksmith Tom"
long_desc: "TODO: A description of Blacksmith Tom standing here."
extra_desc: |
  TODO: Extended description when player examines this NPC.
keywords:
  - blacksmith
primary_keyword: blacksmith
tags:
  - friendly
  - vendor
components:
  combatant:
    health:
      current: 100
      max: 100
    stats:
      str: 10
      dex: 10
      sta: 10
    level: 1
dialogue_tree:
  start:
    text: "Greetings, traveler. TODO: Add dialogue here."
    choices:
      - text: "Who are you?"
        next: introduction
      - text: "Goodbye."
        next: null
  introduction:
    text: "I am Blacksmith Tom. TODO: Add more dialogue."
    choices:
      - text: "Interesting."
        next: null
```

### NPC Types

| Type | Tags | Includes Dialogue |
|------|------|-------------------|
| `friendly` | friendly | ✅ Yes |
| `hostile` | hostile, monster | ❌ No |
| `vendor` | friendly, vendor | ✅ Yes |
| `quest_giver` | friendly, quest_giver | ✅ Yes |

### Next Steps

1. Update TODO fields with real content
2. Add NPC to a room's `spawns` list
3. Run `mix loka.test.validate --only prototype` to verify

---

## Room Generator

### Command

```bash
mix loka.new room <name> [options]
```

### Options

- `--connects=<exits>` - Comma-separated exits (format: `direction:room_key`)
- `--parent=<prototype>` - Parent prototype (default: "base_room")

### Example

```bash
mix loka.new room village_square --connects=north:town_gate,south:marketplace
```

### Generated YAML

```yaml
key: village_square
type: room
parent: base_room
short_desc: "Village Square"
long_desc: "TODO: What the player sees when entering this room."
extra_desc: |
  TODO: Extended description when player looks around carefully.
keywords: []
exits:
  north: town_gate
  south: marketplace
spawns: []
  # - prototype: npc_key
tags:
  - outdoor
```

### Next Steps

1. Update TODO fields with real descriptions
2. Add exits to connect to other rooms
3. Add NPCs or items to the `spawns` list
4. Run `mix loka.test.validate --only world` to verify

---

## Storyline Generator

### Command

```bash
mix loka.new storyline <name>
```

### Example

```bash
mix loka.new storyline village_arc
```

### Generated YAML

```yaml
key: village_arc
name: "Village Arc"
description: |
  TODO: Write an overview of this storyline arc.
  What is the main conflict? What will the player experience?
starting_room: TODO_starting_room_key
tags:
  - main
acts:
  - id: act_1
    name: "Act One"
    description: |
      TODO: What happens in this act?
    quests:
      - TODO_first_quest_id
  - id: act_2
    name: "Act Two"
    description: |
      TODO: What happens in this act?
    quests:
      - TODO_second_quest_id
    requires:
      - act_1
side_quests:
  # - optional_quest_id
```

### Next Steps

1. Update TODO fields with real content
2. Create the quests referenced in acts
3. Run `mix loka.test.validate --only storyline` to verify

---

## Validation

### Validate Individual Content Types

```bash
mix loka.test.validate --only quest
mix loka.test.validate --only prototype
mix loka.test.validate --only world
mix loka.test.validate --only storyline
```

### Validate All Content

```bash
mix loka.test.validate
```

### Common Validation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Missing required field" | TODO not replaced | Fill in TODO placeholders |
| "Invalid room key" | Room doesn't exist | Create the room first or fix the key |
| "Invalid NPC key" | NPC doesn't exist | Create the NPC or fix the key |
| "Invalid quest type" | Typo in quest_type | Use: main, side, or repeatable |

---

## World Builder LLM Integration

The World Builder can use these generators via tool execution. When the LLM needs to create content:

```javascript
// World Builder sends tool call
{
  "tool": "create_quest",
  "args": {
    "name": "find_lost_artifact",
    "giver": "archaeologist_maya",
    "type": "side"
  }
}

// Backend executes
mix loka.new quest find_lost_artifact --giver=archaeologist_maya --type=side

// Returns success + file path
{
  "success": true,
  "file": "priv/world/quests/find_lost_artifact.yml",
  "next_steps": [...]
}
```

**LLM Instructions:** After generating, fill in TODO fields with context-appropriate content based on the storyline/conversation.

---

## Schema Compatibility

All generators produce YAML compatible with current schemas:

| Generator | Schema Module | TypedObject Type | Validation |
|-----------|---------------|------------------|------------|
| Quest | `Content.Quest` | `:quest` | `Quest.validate/1` |
| NPC | `Entity` | `:entity` (subtype `:npc`) | Prototype validator |
| Room | `Entity` | `:entity` (subtype `:room`) | Prototype validator |
| Storyline | Storyline | `:storyline` | Storyline validator |

**Verified:** Generated YAML parses correctly and passes initial validation (2026-01-24).

---

## Common Workflow

### Creating a Quest Chain

```bash
# 1. Create the storyline
mix loka.new storyline monastery_arc

# 2. Create rooms
mix loka.new room monastery_gate
mix loka.new room meditation_chamber
mix loka.new room sleeping_quarters

# 3. Create NPCs
mix loka.new npc elder_tenzin --type=quest_giver
mix loka.new npc novice_pema --type=friendly

# 4. Create quests
mix loka.new quest sleeping_master --giver=novice_pema --type=main
mix loka.new quest dark_presence --giver=elder_tenzin --type=main

# 5. Fill in TODOs in all files

# 6. Validate
mix loka.test.validate
```

### Quick NPC + Room Setup

```bash
# Create room with connected exits
mix loka.new room tavern --connects=north:street,east:kitchen

# Create NPC for that room
mix loka.new npc barkeep_grog --type=vendor

# Edit tavern.yml to add NPC to spawns:
# spawns:
#   - prototype: barkeep_grog

# Validate
mix loka.test.validate --only prototype
```

---

## File Overwrite Protection

Generators will NOT overwrite existing files by default:

```bash
$ mix loka.new quest existing_quest
File already exists: priv/world/quests/existing_quest.yml
Use --force to overwrite

$ mix loka.new quest existing_quest --force
Created quest: priv/world/quests/existing_quest.yml
```

---

## Future Enhancements

### Planned (Not Yet Implemented)

- **Item generator** - `mix loka.new item <name> --type=weapon`
- **Dialogue generator** - `mix loka.new dialogue <name> --npc=<key>`
- **Script generator** - `mix loka.new script <name> --type=behavior`
- **Zone generator** - `mix loka.new zone <name> --rooms=<list>`

### Feature Requests

- **Interactive mode** - Walk through prompts for all fields
- **Template selection** - Choose from pre-defined quest/NPC templates
- **Batch generation** - Generate multiple related entities at once
- **AI-assisted filling** - Auto-fill TODOs using LLM context

---

## Summary

✅ **Generators are production-ready**
- All output valid YAML
- Pass initial validation
- Include helpful TODO markers
- Protected against overwrites
- Integrated with World Builder (planned)

**Recommendation:** Use generators as the standard way to create new content. Manual YAML writing should be reserved for advanced cases or copying existing content.

---

**Last Updated:** 2026-01-24
**See Also:**
- `lib/mix/tasks/loka.new.ex` - Generator implementation
- `docs/builder-reference/` - Content YAML specifications
- `mix loka.test.validate` - Validation command
