# LLM Reference Documentation

> **This is the primary documentation for LLM consumption.**

This directory contains comprehensive reference documentation optimized for Claude and other LLMs working on Loka's quest, dialogue, and game content systems.

## Documentation Structure

| File | Purpose |
|------|---------|
| [entity-reference.md](entity-reference.md) | All entity types, fields, validation |
| [quest-reference.md](quest-reference.md) | Quest YAML format, objectives, rewards |
| [dialogue-reference.md](dialogue-reference.md) | Dialogue format, actions, conditions |
| [quest-dialogue-patterns.md](quest-dialogue-patterns.md) | Common issues and fixes |
| [README.md](README.md) | This file - quick start and tools |

## Human Oversight Docs

For humans guiding LLM work, see `docs/guides/`:
- [reviewing-changes.md](../guides/reviewing-changes.md) - Review checklist
- [common-workflows.md](../guides/common-workflows.md) - How to ask Claude for tasks
- [troubleshooting.md](../guides/troubleshooting.md) - When things go wrong

## Quick Start for LLMs

When working on quest/dialogue/bot issues, use these tools:

### 1. Run Validation First
```bash
mix loka.test.validate --only quest,dialogue
```

### 2. Get Formatted Errors (in IEx)
```elixir
alias Loka.Testing.LLM.ErrorFormatter
ErrorFormatter.quick_summary()
{:ok, errors} = ErrorFormatter.format_all_errors()

# Each error includes:
# - error_code: Machine-readable code (e.g., "DIAL001")
# - severity: :critical | :error | :warning
# - message: Human-readable description
# - location: File path and field path
# - fix: Step-by-step fix instructions
# - related_entities: Other affected entities
```

### 3. Query Dependency Graph
```elixir
alias Loka.Testing.LLM.DependencyGraph

# Find all broken references
DependencyGraph.find_broken_references()

# What does this quest depend on?
DependencyGraph.quest_dependencies("intro_find_temple")

# What references this NPC?
DependencyGraph.npc_references("abbot_jampa")

# Get full context for any entity
DependencyGraph.entity_context("quest:intro_find_temple")
```

### 4. Run Bot Test
```bash
# Validate storyline structure
mix loka.test.storyline monastery_arc

# Run full bot playthrough
mix loka.test.storyline monastery_arc --run
```

## Files in This Directory

| File | Purpose |
|------|---------|
| `quest-dialogue-patterns.md` | Common issues and their fixes |
| `README.md` | This file - quick reference |

## Elixir Modules

| Module | Purpose |
|--------|---------|
| `Loka.Testing.LLM.DependencyGraph` | Queryable entity dependency graph |
| `Loka.Testing.LLM.ErrorFormatter` | Structured errors with fix suggestions |

---

## Entity Relationship Summary

```
STORYLINE
├── acts[]
│   └── quests[] ─────────────────────────┐
├── side_quests[] ────────────────────────┤
└── starting_room ─────────────────────┐  │
                                       │  │
ROOM ←─────────────────────────────────┘  │
├── exits → ROOM                          │
└── entities → NPC, ITEM                  │
                                          │
QUEST ←───────────────────────────────────┘
├── giver ──────────────────────────────────┬──→ NPC
├── turn_in_npc ────────────────────────────┘    ├── dialogue_tree
├── requires_quest ──────────────────→ QUEST     │   ├── node_id
├── objectives[]                                 │   │   ├── text
│   ├── type: talk ────────────────────────────→│   │   ├── choices[]
│   │   └── dialogue_topic ───────────→ node_id │   │   │   ├── action
│   ├── type: kill ────────────────────────────→│   │   │   │   ├── accept_quest → QUEST
│   ├── type: get_item ───────────────→ ITEM    │   │   │   │   ├── complete_quest → QUEST
│   └── type: go_to ──────────────────→ ROOM    │   │   │   │   ├── give_item → ITEM
└── rewards                                      │   │   │   │   └── take_item → ITEM
    └── items[] ──────────────────────→ ITEM     │   │   │   ├── show_if
                                                 │   │   │   │   ├── quest_* → QUEST
                                                 │   │   │   │   └── has_item → ITEM
                                                 │   │   │   └── next → node_id
                                                 │   │   └── completed_variants
                                                 │   │       └── quest_id → alt_node
                                                 │   └── ...
                                                 └── components
                                                     └── combatant, etc.
```

---

## File Location Reference

| Content | Path Pattern |
|---------|--------------|
| Quests | `priv/world/quests/{quest_id}.yml` |
| Storylines | `priv/world/storylines/{storyline_key}.yml` |
| NPCs | `priv/world/prototypes/npcs/**/{npc_key}.yml` |
| Items | `priv/world/prototypes/items/**/{item_key}.yml` |
| Rooms | `priv/world/prototypes/rooms/**/{room_key}.yml` |

---

## Error Code Reference

### Dialogue Errors (DIAL*)

| Code | Severity | Issue |
|------|----------|-------|
| DIAL001 | error | Broken `next` reference to non-existent node |
| DIAL002 | error | Invalid action format (should be list) |
| DIAL003 | critical | References non-existent quest |
| DIAL004 | error | References non-existent item |
| DIAL005 | error | Invalid `show_if` condition format |
| DIAL101 | warning | Orphaned/unreachable dialogue node |
| DIAL102 | warning | Dead-end node (no choices/next) |
| DIAL103 | warning | Empty text in node |

### Quest Errors (QUEST*)

| Code | Severity | Issue |
|------|----------|-------|
| QUEST001 | critical | Objective target entity doesn't exist |
| QUEST002 | error | Invalid objective structure |
| QUEST003 | critical | Quest giver NPC doesn't exist |
| QUEST004 | critical | Quest giver has no accept dialogue |
| QUEST005 | critical | Dialogue topic node doesn't exist |
| QUEST006 | critical | Circular prerequisite chain |
| QUEST101 | warning | Quest not in any storyline |

---

## Bot Decision Flow

```
┌─────────────────────────────────────────────────────────────┐
│ QuestStrategy.next_action(context)                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Get storyline quest order                                │
│ 2. Find first incomplete quest                              │
│    ├─ Not accepted? → Find giver → Navigate → Accept        │
│    └─ Accepted?                                             │
│       ├─ Find incomplete objective                          │
│       │   ├─ go_to: Navigate to room                        │
│       │   ├─ talk: Navigate to NPC → Start dialogue         │
│       │   │        → Reach dialogue_topic (if specified)    │
│       │   ├─ get_item: Navigate to item → Pick up           │
│       │   └─ kill: Navigate to enemy → Attack               │
│       └─ All objectives done?                               │
│          → Find turn_in_npc → Navigate → Complete           │
│ 3. Return action: {:navigate, dir} | {:talk, npc} |         │
│                   {:dialogue_choice, idx} | {:attack, e} |  │
│                   {:pick_up, item} | {:idle} | {:stuck, r}  │
└─────────────────────────────────────────────────────────────┘
```

---

## Validation Command Reference

```bash
# Run ALL validators
mix loka.test.validate

# Run specific validators
mix loka.test.validate --only quest,dialogue,world

# Fail on warnings too
mix loka.test.validate --strict

# List available storylines
mix loka.test.storyline --list

# Validate storyline structure
mix loka.test.storyline monastery_arc

# Run bot playthrough
mix loka.test.storyline monastery_arc --run

# Quick balance check
mix loka.test.balance --quick
```

---

## Common Fix Patterns

### Quest Won't Accept
1. Check `giver` NPC exists
2. Check NPC has `dialogue_tree` component
3. Check dialogue has choice with `action: ["accept_quest", "quest_id"]`

### Quest Won't Complete
1. Check `turn_in_npc` exists (defaults to `giver`)
2. Check NPC dialogue has `action: ["complete_quest", "quest_id"]`
3. Check dialogue choice has `show_if: {quest_complete: quest_id}`

### Talk Objective Won't Complete
1. If `dialogue_topic` specified, check that node exists in NPC dialogue
2. Check dialogue path leads to that node
3. Or remove `dialogue_topic` if any conversation should work

### Bot Gets Stuck
1. Check room connectivity (bidirectional exits)
2. Check NPC is in expected room (location or spawn)
3. Check item is obtainable (not locked behind condition)
4. Run `DependencyGraph.find_broken_references()` for missing entities

---

## Using These Tools Together

### Workflow for Fixing a Broken Quest

```elixir
# 1. Get overview
alias Loka.Testing.LLM.{DependencyGraph, ErrorFormatter}
ErrorFormatter.quick_summary()

# 2. Find specific issues
{:ok, errors} = ErrorFormatter.format_all_errors()
quest_errors = Enum.filter(errors, &String.starts_with?(&1.error_code, "QUEST"))

# 3. Understand dependencies
DependencyGraph.quest_dependencies("broken_quest_id")

# 4. Find broken references
DependencyGraph.find_broken_references()
|> Enum.filter(&String.contains?(&1.edge.from, "broken_quest_id"))

# 5. Each error has fix instructions
Enum.each(quest_errors, fn e ->
  IO.puts("#{e.error_code}: #{e.message}")
  IO.puts("Fix: #{e.fix}")
  IO.puts("---")
end)
```

### Workflow for Adding a New Quest

```elixir
# After creating quest YAML, validate
DependencyGraph.quest_dependencies("new_quest_id")
# → Shows all required entities

DependencyGraph.find_broken_references()
|> Enum.filter(&String.contains?(&1.edge.from, "new_quest_id"))
# → Shows what's missing
```

---

## See Also

- [quest-dialogue-patterns.md](quest-dialogue-patterns.md) - Detailed pattern library
- [entity-reference.md](entity-reference.md) - Entity types and components
- [quest-reference.md](quest-reference.md) - Quest YAML specification
- [dialogue-reference.md](dialogue-reference.md) - Dialogue tree specification
- `CLAUDE.md` - Project-wide development guide
- `docs/guides/` - Human oversight documentation
