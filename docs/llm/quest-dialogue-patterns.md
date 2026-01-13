# Quest & Dialogue Pattern Library for LLMs

This document captures common issues, patterns, and fixes for the quest/dialogue system. Use this as a reference when debugging or implementing quest content.

## Quick Reference: Entity Locations

| Entity Type | File Location | Key Pattern |
|-------------|--------------|-------------|
| Quests | `priv/world/quests/*.yml` | `quest_id` (e.g., `intro_find_temple`) |
| NPCs | `priv/world/prototypes/npcs/**/*.yml` | `npc_key` (e.g., `abbot_jampa`) |
| Items | `priv/world/prototypes/items/**/*.yml` | `item_key` (e.g., `temple_key`) |
| Rooms | `priv/world/prototypes/rooms/**/*.yml` | `room_key` (e.g., `temple_main`) |
| Storylines | `priv/world/storylines/*.yml` | `storyline_key` (e.g., `monastery_arc`) |

## Dependency Validation Commands

```bash
# Validate everything
mix loka.test.validate

# Validate specific domains
mix loka.test.validate --only quest,dialogue

# Run storyline bot test
mix loka.test.storyline monastery_arc --run

# Use dependency graph (in IEx)
alias Loka.Testing.LLM.DependencyGraph
DependencyGraph.find_broken_references()
DependencyGraph.quest_dependencies("intro_find_temple")
```

---

## BEST PRACTICE: Upfront Quest Offers

**Quest acceptance should always be available in the FIRST dialogue node.** Do NOT bury quest offers deep in dialogue trees.

### The Pattern

When a player talks to a quest-giving NPC, the **first dialogue node** should:
1. Briefly explain the situation/need
2. Offer `[Accept Quest]` as the FIRST choice
3. Provide `[Ask for more info]` for curious players
4. Include `[Decline/Leave]` option

### Example Structure

```yaml
dialogue_tree:
  # ==========================================================================
  # BEST PRACTICE: Quest offers should be upfront in the first dialogue node.
  # Players can accept immediately or ask for more context.
  # Pattern: [Accept Quest] first, then [Ask Questions], then [Decline/Leave]
  # ==========================================================================

  start:
    text: "Traveler! I need your help. The mountain caves have been overrun by spirits. Will you investigate?"
    show_if:
      quest_not_active: "side_cave_spirits"
    choices:
      - text: "[Accept Quest] I'll investigate the caves."
        next: "quest_accepted"
        action: ["accept_quest", "side_cave_spirits"]
      - text: "Tell me more about what happened."
        next: "more_info"
      - text: "I should go."
        next: null

  more_info:
    text: "Strange lights appeared three nights ago. Now no one dares enter. The spirits seem angry about something..."
    choices:
      - text: "[Accept Quest] I'll look into it."
        next: "quest_accepted"
        action: ["accept_quest", "side_cave_spirits"]
      - text: "I need to think about this."
        next: null

  quest_accepted:
    text: "Thank you! The cave entrance is east of here. Be careful - the spirits are restless."
    choices:
      - text: "I'll be careful."
        next: null
```

### Why This Matters

1. **Player experience**: Players who know what they want can accept immediately (1 click)
2. **Exploration-friendly**: Curious players can still dig deeper before accepting
3. **Bot compatibility**: Bots can easily find and select `[Accept Quest]` choices
4. **Clear intent**: The `[Accept Quest]` prefix makes quest choices obvious

### Anti-Pattern: Buried Quest Offers

❌ **Don't do this:**
```yaml
start:
  text: "Hello, traveler."
  choices:
    - text: "Who are you?"
      next: "introduction"

introduction:
  text: "I am the village elder."
  choices:
    - text: "What troubles you?"
      next: "problems"

problems:
  text: "The caves are haunted."
  choices:
    - text: "How can I help?"
      next: "help_request"

help_request:
  text: "Will you investigate?"
  choices:
    - text: "[Accept Quest] Yes"  # <-- 4 clicks to reach quest!
      action: ["accept_quest", "..."]
```

### Checklist for Quest Dialogues

- [ ] First dialogue node mentions the quest/need
- [ ] `[Accept Quest]` is the first choice in the start node
- [ ] Every "more info" node also has an `[Accept Quest]` option
- [ ] Quest acceptance takes at most 1-2 clicks
- [ ] Comment block at top of dialogue_tree documents the pattern

---

## Pattern 1: Quest Giver Has No Accept Dialogue

### Symptoms
- Bot gets stuck trying to accept quest
- Validator: `QUEST004 - Quest giver has no dialogue to offer quest`

### Root Cause
The NPC specified as `giver:` in the quest YAML doesn't have a dialogue choice with `accept_quest` action.

### Diagnosis
```yaml
# Quest file says:
giver: abbot_jampa

# But NPC abbot_jampa.yml dialogue has no:
# action: ["accept_quest", "quest_id"]
```

### Fix
Add dialogue choice to NPC with accept action:

```yaml
# In abbot_jampa.yml, add to dialogue_tree:
offer_quest:
  text: "I have an important task for you."
  choices:
    - text: "I'll help"
      action: ["accept_quest", "intro_find_temple"]
      next: quest_accepted
    - text: "Not right now"
      next: null

quest_accepted:
  text: "Thank you. May your path be clear."
  choices:
    - text: "(Continue)"
      next: null
```

---

## Pattern 2: Talk Objective Missing dialogue_topic

### Symptoms
- Bot talks to NPC but objective doesn't complete
- Quest stuck at "talk to X" even after dialogue

### Root Cause
Talk objectives with `dialogue_topic` require reaching that specific node.

### Diagnosis
```yaml
# Quest objective:
- id: learn_crisis
  type: talk
  target_id: abbot_jampa
  dialogue_topic: crisis  # <-- Must reach this specific node!
```

### Fix Options

**Option A**: Ensure dialogue path leads to the topic node
```yaml
# NPC dialogue must have reachable node:
crisis:
  text: "A great darkness has fallen..."
  choices: [...]
```

**Option B**: Remove dialogue_topic if any conversation counts
```yaml
- id: learn_crisis
  type: talk
  target_id: abbot_jampa
  # No dialogue_topic = any dialogue completes it
```

---

## Pattern 3: Dialogue Action Format Wrong

### Symptoms
- Validator: `DIAL002 - Invalid dialogue action`
- Action doesn't execute when player selects choice

### Root Cause
Actions must be lists, not strings.

### Wrong
```yaml
action: "accept_quest"
action: accept_quest
```

### Correct
```yaml
action: ["accept_quest", "quest_id"]
action: ["give_item", "temple_key"]
action: ["set_flag", "talked_to_abbot"]
```

### Valid Action Formats
```yaml
# Quest actions
action: ["accept_quest", "quest_id"]
action: ["complete_quest", "quest_id"]

# Item actions
action: ["give_item", "item_key"]
action: ["take_item", "item_key"]

# Flag actions
action: ["set_flag", "flag_name"]
action: ["clear_flag", "flag_name"]

# Reward actions
action: ["give_xp", 100]
action: ["give_gold", 50]

# Other
action: ["open_shop"]
action: ["heal"]
action: ["teach_ability", "ability_key"]
```

---

## Pattern 4: Broken Dialogue Next Reference

### Symptoms
- Validator: `DIAL001 - Dialogue node references non-existent node`
- Dialogue breaks mid-conversation

### Diagnosis
```yaml
start:
  text: "Hello"
  choices:
    - text: "Tell me more"
      next: more_info  # <-- This node doesn't exist!
```

### Fix
Add the missing node OR fix the reference:
```yaml
more_info:
  text: "Here's more information..."
  choices:
    - text: "(Continue)"
      next: null
```

---

## Pattern 5: Objective Target Doesn't Exist

### Symptoms
- Validator: `QUEST001 - Quest objective targets X which doesn't exist`
- Bot can't find target entity

### Root Cause
The `target_id` in objective doesn't match any prototype key.

### Diagnosis
```yaml
# Quest objective:
- id: find_scroll
  type: get_item
  target_id: ancient_scroll  # <-- No item with this key exists
```

### Fix Options

**Option A**: Create the missing entity
```yaml
# priv/world/prototypes/items/ancient_scroll.yml
key: ancient_scroll
type: item
parent: base_item
short_desc: "Ancient Scroll"
long_desc: "A weathered scroll with faded writing."
```

**Option B**: Fix the target_id to match existing entity
```yaml
- id: find_scroll
  type: get_item
  target_id: scroll_of_wisdom  # Use existing item key
```

---

## Pattern 6: show_if Condition Format Wrong

### Symptoms
- Dialogue choices always/never show up
- Validator: `DIAL005 - Invalid show_if condition`

### Wrong Formats
```yaml
# Wrong: string instead of map
show_if: "quest_active"

# Wrong: missing value
show_if:
  quest_active:
```

### Correct Format
```yaml
show_if:
  quest_active: intro_find_temple

# Multiple conditions (AND logic)
show_if:
  quest_active: intro_find_temple
  has_item: temple_key

# Quest complete (active AND all objectives done)
show_if:
  quest_complete: intro_find_temple
```

### Valid Conditions
```yaml
quest_active: "quest_id"      # Quest in progress
quest_completed: "quest_id"    # Quest turned in
quest_complete: "quest_id"     # Active + all objectives done
quest_not_active: "quest_id"   # Quest not started
quest_not_completed: "quest_id" # Quest not turned in yet
has_item: "item_key"           # Player has item
has_flag: "flag_name"          # Player flag set
flag_set: "flag_name"          # Same as has_flag
flag_not_set: "flag_name"      # Flag not set
level_at_least: 5              # Player level >= N
has_gold: 100                  # Player gold >= N
```

---

## Pattern 7: Quest Complete Action Missing

### Symptoms
- Player completes all objectives but quest stays active
- No way to turn in quest

### Root Cause
No dialogue choice has `complete_quest` action.

### Fix
Add turn-in dialogue to appropriate NPC:

```yaml
# In turn_in_npc's dialogue_tree
turn_in:
  text: "You've done well. Here is your reward."
  show_if:
    quest_complete: intro_find_temple  # Only show when ready
  choices:
    - text: "Thank you"
      action: ["complete_quest", "intro_find_temple"]
      next: after_turnin
```

---

## Pattern 8: Orphaned Dialogue Node

### Symptoms
- Validator: `DIAL101 - Dialogue node is unreachable`
- Node exists but players never see it

### Root Cause
No path from `start` node to this node.

### Diagnosis
```yaml
dialogue_tree:
  start:
    text: "Hello"
    choices:
      - text: "Goodbye"
        next: null

  secret_info:  # <-- No other node links here!
    text: "Here's a secret..."
```

### Fix Options

**Option A**: Add path to the node
```yaml
start:
  text: "Hello"
  choices:
    - text: "Tell me a secret"
      next: secret_info  # Now it's reachable
    - text: "Goodbye"
      next: null
```

**Option B**: Make it conditional from start
```yaml
secret_info:
  text: "Here's a secret..."
  show_if:
    has_flag: knows_secret
```

**Option C**: Delete if unused
```yaml
# Just remove the orphaned node
```

---

## Pattern 9: Bot Navigation Fails

### Symptoms
- Bot stuck with "no path found"
- StorylineRunner returns `:stuck`

### Root Cause
Room graph is disconnected or room doesn't exist.

### Diagnosis
1. Check room exists: `priv/world/prototypes/rooms/target_room.yml`
2. Check exits connect: Room A → exit → Room B → exit back → Room A
3. Check world connectivity: `mix loka.test.validate --only world`

### Fix
Ensure bidirectional exits:
```yaml
# room_a.yml
exits:
  north:
    destination: room_b

# room_b.yml
exits:
  south:
    destination: room_a  # Must have return path!
```

---

## Pattern 10: Circular Quest Prerequisites

### Symptoms
- Validator: `QUEST006 - Circular prerequisites`
- Quest chain impossible to complete

### Root Cause
```yaml
# quest_a.yml
requires_quest: quest_b

# quest_b.yml
requires_quest: quest_a  # <-- Circular!
```

### Fix
Break the cycle by removing one prerequisite:
```yaml
# quest_a.yml
requires_quest: quest_b

# quest_b.yml
# Remove requires_quest OR point to a different quest
```

---

## Bot Decision Logic Reference

The bot (`QuestStrategy`) follows this logic:

```
1. FIND NEXT QUEST
   - Get storyline quest order
   - Skip completed quests
   - Pick first incomplete quest

2. CHECK QUEST STATE
   - Not started? → Go to giver, accept via dialogue
   - In progress? → Work on objectives
   - All objectives done? → Go to turn_in_npc, complete via dialogue

3. WORK ON OBJECTIVE
   - go_to: Navigate to room
   - talk: Navigate to NPC, start dialogue, reach dialogue_topic
   - get_item: Navigate to item room, pick up
   - kill: Navigate to enemy, attack until dead

4. DIALOGUE NAVIGATION
   - Look for choice with matching action (accept/complete)
   - Or look for choice leading to dialogue_topic
   - Fall back to first available choice
```

---

## Debugging Checklist

When a quest/dialogue issue occurs:

1. **Run validators**
   ```bash
   mix loka.test.validate --only quest,dialogue
   ```

2. **Check dependencies**
   ```elixir
   # In IEx
   alias Loka.Testing.LLM.DependencyGraph
   DependencyGraph.quest_dependencies("quest_id")
   DependencyGraph.find_broken_references()
   ```

3. **Get formatted errors**
   ```elixir
   alias Loka.Testing.LLM.ErrorFormatter
   ErrorFormatter.quick_summary()
   {:ok, errors} = ErrorFormatter.format_all_errors()
   ```

4. **Run bot test**
   ```bash
   mix loka.test.storyline monastery_arc --run
   ```

5. **Check specific files**
   - Quest: `priv/world/quests/{quest_id}.yml`
   - NPC: `priv/world/prototypes/npcs/**/{npc_key}.yml`
   - Storyline: `priv/world/storylines/{storyline_key}.yml`

---

## Entity Cross-Reference Quick Check

When creating/modifying content, verify these connections:

### For a New Quest:
- [ ] `giver` NPC exists and has dialogue_tree
- [ ] Giver dialogue has `accept_quest` action for this quest
- [ ] `turn_in_npc` exists (or same as giver)
- [ ] Turn-in dialogue has `complete_quest` action
- [ ] All objective `target_id` values exist
- [ ] For talk objectives with `dialogue_topic`, node exists in NPC
- [ ] Quest added to storyline (acts or side_quests)
- [ ] Reward items exist

### For a New NPC with Dialogue:
- [ ] All `next` references point to existing nodes
- [ ] All action references valid (quest IDs, item keys)
- [ ] All `show_if` conditions valid
- [ ] Has path from `start` to all important nodes
- [ ] Quest givers have accept/complete actions

### For a New Item:
- [ ] Key doesn't conflict with existing items
- [ ] If quest reward, quest references correct key
- [ ] If dialogue gives it, action uses correct key
