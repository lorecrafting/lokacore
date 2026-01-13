---
description: Start game content creation session
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# Content Creation Session

You are now in **Content Creation Mode**, focused on game content in `priv/world/`.

## Session Setup

Before diving in, clarify:
1. **What content** are you creating or modifying? (quest, NPC, dialogue, item, room)
2. **What's the narrative context**? (which storyline, which area)
3. **What should happen** when a player encounters this content?

## Content Locations

| Content Type | Directory |
|--------------|-----------|
| NPCs | `priv/world/prototypes/npcs/` |
| Items | `priv/world/prototypes/items/` |
| Rooms | `priv/world/prototypes/rooms/` |
| Quests | `priv/world/quests/` |
| Storylines | `priv/world/storylines/` |
| Recipes | `priv/world/recipes/` |
| Cutscenes | `priv/world/cutscenes/` |

## Key Patterns

### Quest Offers Must Be Upfront
```yaml
# First dialogue node should have quest acceptance
start:
  text: "Traveler! I need help."
  choices:
    - text: "[Accept Quest] I'll help"     # FIRST
      action: ["accept_quest", "quest_id"]
    - text: "Tell me more"                  # SECOND
    - text: "Not now"                       # LAST
```

### Valid Objective Types
- `talk` - Talk to NPC (target_id: npc_key)
- `kill` - Defeat enemies (target_id: enemy_key, count: N)
- `get_item` - Collect items (target_id: item_key, count: N)
- `go_to` - Visit location (target_id: room_key)

### System vs NPC Quests
```yaml
# System quest - auto-grants on game start
giver: system

# NPC quest - requires dialogue to accept
giver: elder_monk
```

## Validation Workflow

```bash
# After any content change
mix loka.test.validate

# Test full storyline
mix loka.test.storyline monastery_arc --run

# Check quest dependencies (in IEx)
alias Loka.Testing.LLM.DependencyGraph
DependencyGraph.quest_dependencies("quest_id")
DependencyGraph.find_broken_references()
```

## Key Documentation

| Topic | Location |
|-------|----------|
| Quest Format | `docs/builder-reference/quest-reference.md` |
| Dialogue Format | `docs/builder-reference/dialogue-reference.md` |
| Entity Types | `docs/builder-reference/entity-reference.md` |
| Common Patterns | `docs/builder-reference/quest-dialogue-patterns.md` |

## Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| Missing `giver` | Add `giver: system` or `giver: npc_key` |
| Wrong objective type | Use: talk, kill, get_item, go_to |
| Buried quest offer | Move [Accept Quest] to first node |
| Duplicate node keys | Make each key unique within NPC |
| Missing target | Create the target entity first |

## What NOT To Do

- Don't modify code in `lib/` (use `/engine-work` for that)
- Don't skip validation - always run `mix loka.test.validate`
- Don't create orphaned content (ensure quest chains connect)

## End of Session

Before finishing:
1. Run `mix loka.test.validate` - must pass
2. Test storyline if you modified a quest chain
3. Use `/save` if you discovered a useful pattern
4. Commit: `git add priv/world/ && git commit -m "content: ..."`
