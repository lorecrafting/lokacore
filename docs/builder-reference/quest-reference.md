# Quest Reference for LLMs

> **LLM Instructions**: Quests are YAML files that define objectives and rewards. They must be connected to NPC dialogues for acceptance/completion.

## File Location

```
priv/world/quests/{quest_id}.yml
```

---

## Complete Quest Template

```yaml
id: intro_find_temple
name: "Find the Temple"
description: |
  The monastery's temple holds answers you seek.

type: main                    # main | side
priority: 1                   # Lower = more important
act: 1                        # Which storyline act (optional)
level_requirement: 1          # Minimum player level (optional)

# Who gives/receives the quest
giver: abbot_jampa           # NPC who offers quest
turn_in_npc: abbot_jampa     # NPC who receives completion (default: giver)

# Prerequisites
requires_quest: null         # Quest that must be completed first

# What player must do
objectives:
  - id: find_temple
    type: go_to
    target_id: temple_main
    description: "Find the temple"

  - id: speak_to_monk
    type: talk
    target_id: elder_monk
    dialogue_topic: wisdom    # Optional: specific node to reach
    description: "Speak with the elder monk"
    hint: "The monk meditates in the temple"  # Optional player hint

# What player gets
rewards:
  xp: 100
  gold: 50
  items:
    - temple_key

# Journal entries (key-based format)
journal_entries:
  start: "I should find the temple and speak with the elder."
  find_temple: "I found the temple. Now to find the elder monk."
  complete: "The elder shared ancient wisdom with me."

# Optional time limit (seconds)
time_limit: null

# Labels for categorization
labels: [tutorial, exploration]
```

---

## Objective Types

### go_to - Visit a Location

```yaml
- id: visit_shrine
  type: go_to
  target_id: mountain_shrine    # Room key
  description: "Visit the mountain shrine"
```

**Completes when**: Player enters the room.

### talk - Speak with NPC

```yaml
# Basic - any dialogue completes it
- id: meet_elder
  type: talk
  target_id: elder_monk         # NPC key
  description: "Speak with the elder monk"

# Specific - must reach a dialogue node
- id: learn_secret
  type: talk
  target_id: elder_monk
  dialogue_topic: secret_wisdom  # Node ID in NPC's dialogue_tree
  description: "Learn the secret from the elder"
```

**Completes when**:
- Basic: Any dialogue with NPC
- With `dialogue_topic`: Reaching that specific node

### get_item - Collect Items

```yaml
- id: collect_herbs
  type: get_item
  target_id: rare_herb         # Item key
  target_count: 3              # How many needed
  description: "Collect 3 rare herbs"
```

**Completes when**: Player has `target_count` of item in inventory.

### kill - Defeat Enemies

```yaml
- id: slay_spirits
  type: kill
  target_id: restless_spirit    # NPC key
  target_count: 5               # How many to kill
  description: "Defeat 5 restless spirits"
```

**Completes when**: Player defeats `target_count` of target NPC type.

---

## Quest → NPC Dialogue Connection

### Required Dialogue Actions

**Quest Giver must have**:
```yaml
# In giver NPC's dialogue_tree
choices:
  - text: "I'll help"
    action: ["accept_quest", "quest_id"]
    next: accepted
```

**Turn-in NPC must have**:
```yaml
# In turn_in_npc's dialogue_tree
choices:
  - text: "I completed it"
    show_if:
      quest_complete: quest_id    # Quest active + objectives done
    action: ["complete_quest", "quest_id"]
    next: rewarded
```

### Connection Diagram

```
QUEST YAML                         NPC DIALOGUE
─────────────────────────────────────────────────

giver: abbot_jampa ─────────────→ abbot_jampa.yml
                                   └─ action: ["accept_quest", "quest_id"]

turn_in_npc: elder_monk ─────────→ elder_monk.yml
                                   └─ action: ["complete_quest", "quest_id"]

objectives:
  - type: talk
    target_id: elder_monk ───────→ elder_monk.yml
    dialogue_topic: wisdom         └─ start: ... → wisdom: (this node)
```

---

## Storyline Integration

Quests belong to storylines:

```yaml
# priv/world/storylines/monastery_arc.yml
key: monastery_arc
starting_room: monastery_gate

acts:
  - id: prologue
    quests:
      - intro_find_temple      # Quest ID
      - intro_meet_abbot
  - id: act_1
    quests:
      - main_three_trials
    requires:
      - prologue               # Act dependency

side_quests:
  - side_herb_gathering
  - side_help_merchant
```

**Validation**: Orphaned quests (not in any storyline) generate warnings.

---

## Quest Prerequisites

```yaml
# This quest requires another quest to be completed first
id: advanced_training
requires_quest: basic_training

# Chain example:
# basic_training → advanced_training → master_training
```

**Validation**: Circular prerequisites are errors.

---

## Rewards Structure

```yaml
rewards:
  xp: 100                  # Experience points
  gold: 50                 # Gold currency
  insight: 1               # Insight points (optional)
  items:                   # Item keys to give
    - temple_key
    - rare_gem
  reputation:              # Faction reputation (optional)
    temple_monks: 10
  unlocks:                 # Quest IDs unlocked on completion (optional)
    - advanced_training
```

**Validation**: All reward item keys must exist as prototypes.

---

## Journal Entries

Track quest progress in player's journal using key-based format:

```yaml
journal_entries:
  start: "Quest accepted message"
  find_temple: "Shows when find_temple objective completes"
  complete: "Quest completion message"
```

| Key | When |
|-----|------|
| `start` | Quest accepted |
| `{objective_id}` | Specific objective completed (use objective's `id` field) |
| `complete` | Quest turned in |

**Example from actual quest:**
```yaml
journal_entries:
  start: "The caves open before me. Three trials await."
  raga_defeated: "Attachment overcome. One seal fragment acquired."
  dvesha_defeated: "Aversion overcome. Two seal fragments acquired."
  complete: "The Heart Cave awaits. Mara and Tenzin are within."
```

---

## Validation Rules

1. **giver NPC must exist** as prototype with `dialogue_tree`
2. **giver dialogue must have** `accept_quest` action for this quest
3. **turn_in_npc must exist** if specified (defaults to giver)
4. **turn_in dialogue must have** `complete_quest` action
5. **All target_ids must exist** (rooms, NPCs, items)
6. **dialogue_topic must exist** in target NPC's dialogue tree
7. **requires_quest must exist** if specified
8. **No circular prerequisites**
9. **Quest should be in a storyline** (warning if orphaned)
10. **Reward items must exist**

---

## Common Patterns

### Simple Fetch Quest

```yaml
id: gather_herbs
name: "Gather Healing Herbs"
type: side
giver: healer_maya
objectives:
  - id: collect
    type: get_item
    target_id: healing_herb
    target_count: 5
    description: "Gather 5 healing herbs"
rewards:
  xp: 50
  gold: 25
```

### Multi-Step Main Quest

```yaml
id: rescue_master
name: "Rescue the Master"
type: main
giver: abbot_jampa
turn_in_npc: abbot_jampa

objectives:
  - id: learn_location
    type: talk
    target_id: elder_monk
    dialogue_topic: master_location
    description: "Learn where the master is held"

  - id: find_key
    type: get_item
    target_id: prison_key
    description: "Find the prison key"

  - id: reach_prison
    type: go_to
    target_id: underground_prison
    description: "Find the prison"

  - id: defeat_guard
    type: kill
    target_id: shadow_guard
    target_count: 1
    description: "Defeat the shadow guard"

rewards:
  xp: 500
  gold: 100
  items:
    - master_blessing
```

### Talk Chain Quest

```yaml
id: gather_wisdom
name: "Gather Wisdom"
giver: abbot_jampa
turn_in_npc: abbot_jampa

objectives:
  - id: talk_elder
    type: talk
    target_id: elder_monk
    dialogue_topic: wisdom_part1
    description: "Learn from Elder Monk"

  - id: talk_herbalist
    type: talk
    target_id: herbalist
    dialogue_topic: wisdom_part2
    description: "Learn from Herbalist"

  - id: talk_smith
    type: talk
    target_id: blacksmith
    dialogue_topic: wisdom_part3
    description: "Learn from Blacksmith"

rewards:
  xp: 200
```

---

## Validation Commands

```bash
# Validate all quests
mix loka.test.validate --only quest

# Run storyline bot test
mix loka.test.storyline monastery_arc --run

# Check dependencies in IEx:
alias Loka.WorldBuilder.Analysis.DependencyGraph
{:ok, graph} = DependencyGraph.build()
DependencyGraph.dependencies_for(graph, "quest:quest_id")
```

---

## Common Mistakes

### Missing Dialogue Connection

```yaml
# Quest says giver is abbot_jampa
giver: abbot_jampa

# But abbot_jampa's dialogue has NO accept_quest action!
# FIX: Add to NPC dialogue:
#   action: ["accept_quest", "quest_id"]
```

### dialogue_topic Node Missing

```yaml
# Quest says:
dialogue_topic: secret_wisdom

# But NPC's dialogue_tree has no node named "secret_wisdom"
# FIX: Add the node OR remove dialogue_topic
```

### Circular Prerequisites

```yaml
# quest_a requires quest_b
# quest_b requires quest_a
# = IMPOSSIBLE TO COMPLETE

# FIX: Remove one requires_quest
```

### Wrong Objective Target Type

```yaml
# WRONG - go_to should target room, not NPC
- type: go_to
  target_id: elder_monk   # This is an NPC!

# RIGHT
- type: go_to
  target_id: temple_main  # This is a room
```
