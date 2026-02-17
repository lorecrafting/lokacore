# Common Workflows

How to ask Claude to do common game content tasks.

---

## Creating a New Quest

### Simple Request
```
Create a side quest where players gather 3 moonflowers for the herbalist in the village.
```

### Detailed Request
```
Create a side quest:
- ID: gather_moonflowers
- Given by: herbalist_chen in village
- Objective: collect 3 moonflower items
- Reward: 50 gold, 25 xp
- Add to monastery_arc storyline as side quest
```

### What Claude Will Do
1. Create quest YAML in `priv/world/quests/`
2. Create/modify herbalist NPC with dialogue
3. Create moonflower item if needed
4. Add quest to storyline
5. Run validation

### What You Review
- Quest structure makes sense
- NPC dialogue flows naturally
- Item exists and is obtainable
- Validation passes

---

## Adding NPC Dialogue

### Simple Request
```
Add dialogue to merchant_dorje so players can ask about the monastery history.
```

### Detailed Request
```
Add dialogue to merchant_dorje:
- New topic: "Tell me about the monastery"
- Should mention the sleeping master
- Only show after player completes intro_find_temple quest
```

### What Claude Will Do
1. Add new dialogue nodes to NPC
2. Add show_if conditions if needed
3. Validate dialogue references

### What You Review
- Dialogue text feels natural
- Conditions are appropriate
- Links to other nodes work

---

## Fixing a Broken Quest

### Request
```
Quest intro_find_temple is broken - the bot gets stuck. Fix it.
```

### What Claude Will Do
1. Run validation to find errors
2. Check dependency graph
3. Identify missing connections
4. Fix the issues
5. Run bot test to verify

### What You Review
- Root cause was identified
- Fix addresses the actual problem
- Bot test now passes

---

## Creating a New Area

### Request
```
Create a new area: the mountain cave system with 3 rooms (entrance, main cavern, crystal chamber).
Add a hostile creature (cave spider) in the main cavern.
```

### What Claude Will Do
1. Create 3 room prototypes
2. Set up bidirectional exits
3. Create cave spider NPC
4. Set spawn in main cavern
5. Validate world connectivity

### What You Review
- Rooms have good descriptions
- Exits connect properly
- Spider has appropriate combat stats
- Area connects to existing world

---

## Adding Items

### Request
```
Create a healing potion item that restores 50 health when consumed.
```

### What Claude Will Do
1. Create item prototype
2. Add consumable component
3. Set heal effect
4. Validate

### What You Review
- Item has sensible properties
- Effect values are balanced
- Can be obtained somewhere

---

## Debugging "Bot Stuck" Issues

### Request
```
The storyline bot is stuck on the monastery_arc. Debug and fix.
```

### What Claude Will Do
1. Run `mix test test/integration/storyline_channel_test.exs`
2. Analyze where it gets stuck
3. Use dependency graph to find issues
4. Fix missing connections
5. Re-run until passing

### What You Review
- Claude identified correct root cause
- Fixes don't break other things
- Full storyline now completes

---

## Adding Quest to Storyline

### Request
```
Add the new side_cave_exploration quest to the monastery_arc storyline.
```

### What Claude Will Do
1. Edit storyline YAML
2. Add to `side_quests` list
3. Validate storyline structure

### What You Review
- Quest is in appropriate section
- No circular dependencies
- Quest prerequisites make sense

---

## Reviewing All Validation Errors

### Request
```
Show me all current validation errors and fix the critical ones.
```

### What Claude Will Do
1. Run all validators
2. Use DependencyGraph to analyze broken references
3. Fix critical issues first
4. Report what was fixed

### What You Review
- Critical issues addressed
- Fixes don't introduce new problems
- Remaining warnings are acceptable

---

## Bulk Operations

### Request
```
All NPCs in the monastery area should have their level increased by 2.
```

### What Claude Will Do
1. Find all NPCs in monastery rooms
2. Update combatant.level for each
3. Report changes made

### What You Review
- Correct NPCs were modified
- Level increases are reasonable
- Combat balance still makes sense

---

## Tips for Better Results

### Be Specific
```
# Less good
"Add a quest"

# Better
"Add a side quest where players collect 5 herbs for the healer"

# Best
"Add a side quest:
- ID: collect_healing_herbs
- Giver: healer_chen
- Objective: collect 5 healing_herb items
- Reward: 100xp, potion_of_vitality item
- Prerequisite: must have completed intro_meet_healer"
```

### Reference Existing Content
```
"Add a quest similar to gather_moonflowers but for fire crystals"
"Use the same dialogue style as abbot_jampa"
```

### Ask for Validation
```
"After making changes, run validation and show me the results"
"Test the storyline bot after fixing the quest"
```

### Request Context First
```
"Before making changes, show me what currently references merchant_dorje"
"What quests are in the monastery_arc storyline?"
```
