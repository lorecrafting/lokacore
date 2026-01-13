# validate-content

One-command content validation wrapper for existing Loka validators.

## Purpose

Run all content validation checks and present results in a clear, actionable format.

## Instructions

Execute the comprehensive content validation workflow:

### 1. Run Master Validator

```bash
cd server && mix loka.test.validate
```

This runs all validators:
- Prototype validator (YAML syntax, required fields)
- Quest validator (objectives, rewards, dependencies)
- Dialogue validator (actions, conditions, node references)
- World connectivity validator (all rooms reachable)

### 2. Parse Results by Category

Organize errors/warnings into categories:

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
- `set_flag` with missing flag definition

#### Unreachable Rooms
- Rooms with no incoming exits
- Rooms with no outgoing exits
- Disconnected room clusters

#### YAML Syntax Errors
- Parse errors
- Type mismatches
- Missing required fields
- Invalid enum values

### 3. Storyline Validation (Conditional)

If storylines were modified, run storyline-specific validation:

```bash
# List all storylines
cd server && mix loka.test.storyline --list

# Validate each storyline
cd server && mix loka.test.storyline monastery_arc
cd server && mix loka.test.storyline [other_storylines]
```

Check:
- All quests in storyline exist
- Quest chain dependencies are correct
- No circular dependencies
- Storyline is completable start to finish

### 4. Cross-Reference Check

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

## ❌ Errors (Must Fix)

### Missing Entities (N errors)
- `monastery_courtyard` → references NPC `elder_monk` (not found)
  **File**: priv/world/prototypes/rooms/monastery_courtyard.yml
  **Fix**: Create NPC or remove reference

- `quest_monastery_intro` → objective references room `inner_sanctum` (not found)
  **File**: priv/world/prototypes/quests/monastery_intro.yml
  **Fix**: Create room or change objective

### Broken Quest Objectives (N errors)
[List each broken objective with file:line and fix]

### Invalid Dialogue Actions (N errors)
[List each invalid action with file:line and fix]

### Unreachable Rooms (N errors)
[List unreachable rooms with suggested exit additions]

## ⚠️ Warnings (Review)

### Potential Issues (N warnings)
- `goblin_warrior` has no loot table (intentional?)
- `quest_fetch_herbs` has no failure path
- Room `dark_cave` has no description

## ✅ Valid Content

- X quests passed validation
- Y dialogues passed validation
- Z rooms are fully connected
- All items have required fields

## 📊 Validation Stats

| Category | Checked | Errors | Warnings |
|----------|---------|--------|----------|
| Prototypes | X | Y | Z |
| Quests | X | Y | Z |
| Dialogues | X | Y | Z |
| World Graph | X | Y | Z |
| **TOTAL** | **X** | **Y** | **Z** |

## Status
✅ ALL VALID | ⚠️ WARNINGS PRESENT | ❌ ERRORS FOUND

## Next Steps
1. Fix errors (blocking issues)
2. Review warnings (potential issues)
3. Re-run validation after fixes
```

## Error Severity Guide

**Critical (Blocks Game)**:
- Missing entities that break quests
- Unreachable rooms in main storyline
- Invalid dialogue actions that crash
- Syntax errors in YAML

**High (Breaks Features)**:
- Broken quest objectives
- Missing quest rewards
- Dead-end dialogue trees
- Disconnected room clusters

**Medium (Suboptimal)**:
- Missing descriptions
- Unbalanced rewards
- Inconsistent naming
- Missing loot tables

**Low (Polish)**:
- Typos in text
- Inconsistent formatting
- Missing optional fields

## Success Criteria

- Zero critical errors
- Zero high errors
- All storylines completable
- All rooms reachable from starting room

## When to Run

- After adding/modifying content
- Before committing YAML changes
- After running LLM content generation
- Before releasing new quests/areas

## Notes

- Warnings are OK (document if intentional)
- Some errors may be false positives (verify manually)
- Fix errors in order of severity
- Re-run after each fix to catch new issues
- Use `--strict` flag to treat warnings as errors for CI/CD
