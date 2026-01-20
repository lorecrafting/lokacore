---
name: content-creation
description: Knowledge for creating game content (quests, NPCs, items, rooms, dialogues). Use when scaffolding new content, writing YAML files, or using mix loka.new commands.
---

# Content Creation

**Auto-applies when**: Creating new game content in `priv/world/`

## Purpose

Provides knowledge for creating valid, well-structured game content using Loka's scaffolding tools and YAML formats.

## When This Skill Activates

Activates when you:
- Create new quests, NPCs, items, or rooms
- Use `mix loka.new` scaffolding commands
- Write YAML content files
- Design storylines or quest chains

## Scaffolding Commands

Use `mix loka.new` to generate valid YAML scaffolds:

```bash
# Create a new quest
mix loka.new quest gather_herbs
mix loka.new quest defeat_bandits --giver=elder_npc --type=side

# Create a new NPC
mix loka.new npc blacksmith --type=vendor
mix loka.new npc guard --type=hostile
mix loka.new npc elder --type=quest_giver

# Create a new room
mix loka.new room tavern --connects=north:marketplace,south:street
mix loka.new room dark_cave --parent=base_dungeon_room

# Create a new storyline
mix loka.new storyline tutorial_arc
```

**Supported types**: `quest`, `npc`, `room`, `storyline`

**Options**:
- Quest: `--giver=npc_key` (default: system), `--type=main|side|repeatable`
- NPC: `--type=friendly|hostile|vendor|quest_giver`, `--parent=base_npc`
- Room: `--connects=dir:room,dir:room`, `--parent=base_room`

**Always use scaffolding** - it generates valid YAML with all required fields.

## Content Directory Structure

```
priv/world/
├── prototypes/
│   ├── npcs/           # NPC definitions
│   ├── items/          # Item definitions
│   └── rooms/          # Room definitions
├── quests/             # Quest definitions
├── storylines/         # Story arc definitions
├── dialogues/          # Standalone dialogue trees
├── recipes/            # Crafting recipes
└── cutscenes/          # Cutscene sequences
```

## YAML Format Quick Reference

### Quest
```yaml
id: quest_id
name: "Display Name"
description: "Quest description"
giver: system | npc_key      # Required
type: main | side | daily
objectives:
  - id: obj_id
    type: talk | kill | get_item | go_to
    target_id: entity_key
    description: "What to do"
    count: 1                  # For kill/get_item
rewards:
  xp: 100
  gold: 50
  items:
    - healing_potion
```

### NPC
```yaml
key: npc_key
name: "NPC Name"
description: "NPC description"
type: npc
level: 1
components:
  dialogue_tree:
    start:
      text: "Hello, traveler!"
      choices:
        - text: "Goodbye"
          next: null
```

### Room
```yaml
key: room_key
name: "Room Name"
description: "Room description"
type: room
zone: zone_name
coordinates:
  x: 0
  y: 0
  z: 0
exits:
  north: other_room_key
  south: another_room_key
spawns:
  - npc_key
```

### Item
```yaml
key: item_key
name: "Item Name"
description: "Item description"
type: item
item_type: weapon | armor | consumable | material | quest_item
stats:
  damage: 10        # For weapons
  armor: 5          # For armor
  healing: 20       # For consumables
```

## Dialogue Tree Patterns

### Basic Conversation
```yaml
dialogue_tree:
  start:
    text: "Welcome to my shop!"
    choices:
      - text: "Show me your wares"
        next: "shop"
      - text: "Goodbye"
        next: null

  shop:
    text: "Here's what I have for sale."
    action: ["open_shop"]
    choices:
      - text: "Thanks"
        next: null
```

### Quest-Giving NPC
```yaml
dialogue_tree:
  start:
    text: "I need help with something..."
    choices:
      - text: "[Accept Quest] I'll help"
        action: ["accept_quest", "quest_id"]
        next: "accepted"
      - text: "Tell me more"
        next: "more_info"
      - text: "Not interested"
        next: null

  accepted:
    text: "Thank you! Come back when you're done."
    choices:
      - text: "I'll get started"
        next: null

  more_info:
    text: "Here's what I need you to do..."
    choices:
      - text: "[Accept Quest] I'll do it"
        action: ["accept_quest", "quest_id"]
        next: "accepted"
      - text: "Maybe later"
        next: null
```

### Conditional Dialogue
```yaml
dialogue_tree:
  start:
    text: "Hello again!"
    show_if:
      quest_complete: "intro_quest"
    choices:
      - text: "Hi"
        next: null

  start_default:
    text: "Have we met before?"
    choices:
      - text: "No, I'm new here"
        next: null
```

## Validation After Creation

Always validate after creating content:

```bash
# Validate all content
mix loka.test.validate

# Validate specific types
mix loka.test.validate --only quest
mix loka.test.validate --only dialogue
mix loka.test.validate --only prototype

# Strict mode (warnings = errors)
mix loka.test.validate --strict
```

## Common Patterns

### Quest Chain
Create quests that unlock in sequence:
```yaml
# Quest 1
id: intro_part1
prerequisites: []

# Quest 2 - unlocks after Quest 1
id: intro_part2
prerequisites:
  - intro_part1
```

### System Quest (Auto-Grant)
```yaml
id: tutorial_start
giver: system              # Auto-grants on spawn
type: main
```

### NPC Quest (Dialogue-Based)
```yaml
id: fetch_herbs
giver: herbalist           # Must talk to NPC to accept
turn_in_npc: herbalist     # Must return to NPC to complete
```

## Tips

1. **Use scaffolding first** - `mix loka.new` creates valid structure
2. **Validate immediately** - Run validation after every change
3. **Quest offers upfront** - Put accept choice in FIRST dialogue node
4. **Unique keys** - All keys must be unique within their type
5. **Check references** - Ensure target NPCs/items/rooms exist
