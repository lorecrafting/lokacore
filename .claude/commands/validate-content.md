# Validate Content

Run comprehensive content validation and present results in a clear, actionable format.

## Usage

```
/validate-content [--only <type>] [--strict]
```

## Instructions

### Step 1: Run Master Validator

```bash
cd server && mix loka.test.validate
```

This runs all 14 validators:
- World (orphan rooms, broken exits, connectivity)
- Quest Prototypes (kill/talk targets, components)
- Quest YAML (objectives, prerequisites, givers, rewards)
- Prototype (required fields, valid parents, components)
- Dialogue (broken refs, invalid actions, orphan nodes)
- Quest Chain (completion offers next quest)
- Reachability (unobtainable items, unreachable NPCs)
- Cutscene (speaker NPCs, valid sequences)
- Crafting (ingredients, outputs, tools)
- Storyline (quest references, act dependencies)
- UI/Data (dialogue format, shop validity, quest_giver tags)
- Wander (behavior configs, allowed_rooms connectivity)
- Entity Sync (stale entities missing components)
- Channel (event handlers match JSON schema definitions)

### Step 2: Parse Results by Category

Organize errors/warnings into:

#### Missing Entities
- Rooms referenced but not defined
- NPCs referenced but not defined
- Items referenced but not defined
- Exit targets that don't exist

#### Broken Quest Objectives
- `go_to` with invalid room
- `kill` with invalid NPC
- `get_item` with invalid item
- `talk` with invalid NPC or dialogue node

#### Invalid Dialogue Actions
- `give_item` with invalid item
- `complete_quest` with invalid quest
- `accept_quest` with invalid quest

#### Unreachable Rooms
- Rooms with no incoming exits
- Rooms with no outgoing exits
- Disconnected room clusters

### Step 3: Cross-Reference Check

Verify consistency across content types:

**Quest ↔ Dialogue**:
- Quests reference dialogue nodes that exist
- Dialogue `complete_quest` actions reference valid quests
- Quest giver NPCs have dialogue

**NPC ↔ Items**:
- Shop NPCs reference valid items
- NPC loot tables reference valid items
- Quest reward items exist

**Room ↔ Exits**:
- Exit targets point to valid rooms
- Bidirectional exits are properly paired
- Room coordinates are unique

## Output Format

```markdown
# Content Validation Report

## Summary
- Total prototypes: X
- Quests validated: Y
- Dialogues validated: Z
- Rooms checked: W

## Errors (Must Fix)

### Missing Entities (N errors)
- `monastery_courtyard` → references NPC `elder_monk` (not found)
  **File**: priv/world/prototypes/rooms/monastery_courtyard.yml
  **Fix**: Create NPC or remove reference

### Broken Quest Objectives (N errors)
[List each with file:line and fix]

## Warnings (Review)
[List potential issues]

## Status
✅ ALL VALID | ⚠️ WARNINGS PRESENT | ❌ ERRORS FOUND
```

## Validation Flags

```bash
# Validate specific category
mix loka.test.validate --only quest
mix loka.test.validate --only dialogue
mix loka.test.validate --only world

# Strict mode (warnings = errors)
mix loka.test.validate --strict

# Quick mode (skip slow checks)
mix loka.test.validate --quick
```

## Success Criteria

- Zero critical errors
- All storylines completable
- All rooms reachable from starting room
