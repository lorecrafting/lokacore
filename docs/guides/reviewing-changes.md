# Reviewing LLM Changes

When Claude makes changes to game content, here's what to look for.

## Quick Validation

Always run after changes:
```bash
mix loka.test.validate
```

If specific to quests/storylines:
```bash
mix test test/integration/storyline_channel_test.exs
```

---

## Quest Changes Checklist

When Claude creates or modifies quests:

### Structure
- [ ] Quest file is in `priv/world/quests/`
- [ ] Has required fields: `id`, `name`, `giver`, `objectives`
- [ ] `type` is `main` or `side`

### Connections
- [ ] `giver` NPC exists with `dialogue_tree`
- [ ] Giver's dialogue has `accept_quest` action
- [ ] `turn_in_npc` exists (or defaults to giver)
- [ ] Turn-in dialogue has `complete_quest` action

### Objectives
- [ ] Each objective has `id`, `type`, `target_id`, `description`
- [ ] Target entities exist (rooms, NPCs, items)
- [ ] For `talk` with `dialogue_topic`, node exists in NPC

### Integration
- [ ] Quest is in a storyline (`priv/world/storylines/`)
- [ ] `requires_quest` is valid if specified

---

## Dialogue Changes Checklist

When Claude modifies NPC dialogue:

### Structure
- [ ] Has `start` node (entry point)
- [ ] All `next` references point to existing nodes
- [ ] Choices have `text` and `next` fields

### Actions
- [ ] Actions are lists: `["action_type", "arg"]`
- [ ] Referenced quests exist
- [ ] Referenced items exist

### Conditions
- [ ] `show_if` conditions are valid
- [ ] Quest conditions reference existing quests

### Flow
- [ ] No orphan nodes (unreachable from start)
- [ ] No dead ends (unless intentional)
- [ ] Quest integration works (accept/complete actions present)

---

## NPC Changes Checklist

When Claude creates or modifies NPCs:

- [ ] Has `key`, `type: npc`, `parent`
- [ ] `primary_keyword` appears in `long_desc`
- [ ] Tagged appropriately (`quest_giver`, `merchant`, `hostile`, etc.)
- [ ] Components match tags (e.g., `hostile` → has `combatant`)
- [ ] Dialogue tree is valid if present

---

## Room Changes Checklist

When Claude modifies rooms:

- [ ] Has `key`, `type: room`, `parent`
- [ ] Exits point to existing rooms
- [ ] Exits are bidirectional (room A → B has B → A)
- [ ] Spawned entities exist

---

## Red Flags to Watch For

### Common LLM Mistakes

1. **String instead of list actions**
   ```yaml
   # WRONG
   action: "accept_quest"
   # RIGHT
   action: ["accept_quest", "quest_id"]
   ```

2. **Missing connections**
   - Quest references NPC that doesn't exist
   - Dialogue references quest that doesn't exist
   - Exit points to room that doesn't exist

3. **Wrong field nesting**
   ```yaml
   # WRONG
   components:
     health: {current: 100}
   # RIGHT
   components:
     combatant:
       health: {current: 100, max: 100}
   ```

4. **Orphaned content**
   - Dialogue nodes unreachable from start
   - Quests not in any storyline
   - Items/NPCs not spawned anywhere

---

## Using the LLM Tools

Ask Claude to run diagnostics:

```
"Run DependencyGraph.find_broken_references() and show me what's missing"

"What does quest X depend on?"

"Are there any validation errors?"
```

Or run yourself in IEx:
```elixir
alias Loka.WorldBuilder.Analysis.DependencyGraph
{:ok, graph} = DependencyGraph.build()
DependencyGraph.find_broken_references(graph)
```

---

## When to Reject Changes

Reject and ask for fixes if:

1. **Validation fails** with errors (not just warnings)
2. **Bot test fails** - quest flow is broken
3. **Missing critical connections** - NPCs without dialogue for quests they give
4. **Structural issues** - wrong YAML format, missing required fields

---

## When to Accept with Notes

Accept but note for later if:

1. **Only warnings** - orphan nodes, etc. (not blocking)
2. **Minor style issues** - naming conventions, descriptions
3. **Balance concerns** - XP/gold rewards seem off

---

## Approving Flow

1. Claude makes changes
2. You review changes (this checklist)
3. Run `mix loka.test.validate`
4. Run `mix test test/integration/storyline_channel_test.exs` if storyline-related
5. If issues, tell Claude what to fix
6. If clean, approve and commit
