# Dialogue Reference for LLMs

> **LLM Instructions**: Dialogue trees are embedded in NPC prototypes under `components.dialogue_tree`. This reference covers all dialogue features.

## Location

Dialogues are defined inline in NPC files:
```
priv/world/prototypes/npcs/**/*.yml
  └── components.dialogue_tree
```

---

## Basic Structure

```yaml
components:
  dialogue_tree:
    # Node ID → Node Data
    start:                           # Entry point (required)
      text: "Greetings, traveler."
      speaker: "Abbot Jampa"         # Optional, defaults to NPC name
      choices:
        - text: "Hello"
          next: greeting_response
        - text: "Goodbye"
          next: null                 # null = end dialogue

    greeting_response:
      text: "Welcome to our monastery."
      choices:
        - text: "Tell me about this place"
          next: about_monastery
        - text: "I must go"
          next: null
```

---

## Node Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `text` | Yes | string | What NPC says |
| `speaker` | No | string | Override speaker name |
| `choices` | Yes* | list | Player response options |
| `next` | No | string | Auto-advance to this node (no choices) |
| `show_if` | No | map | Conditions to show this node |
| `completed_quest` | No | string | Show variant if quest completed |
| `completed_variants` | No | map | Quest ID → alternate node |

*Either `choices` or `next` required

---

## Choice Fields

```yaml
choices:
  - text: "Player says this"        # Required - display text
    next: "node_id"                 # Where to go (null = end)
    action: ["action_type", "arg"]  # Optional - execute action
    show_if:                        # Optional - conditional visibility
      quest_active: quest_id
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `text` | Yes | string | What player says |
| `next` | Yes | string/null | Next node ID or null to end |
| `action` | No | list | Action to execute (see below) |
| `show_if` | No | map | Conditions to show this choice |

---

## Actions

**Format**: `action: ["action_type", "argument"]`

| Action | Arguments | Description |
|--------|-----------|-------------|
| `accept_quest` | quest_id | Offer quest to player |
| `complete_quest` | quest_id | Turn in completed quest |
| `give_item` | item_key | Give item to player |
| `take_item` | item_key | Remove item from player |
| `set_flag` | flag_name | Set player flag |
| `clear_flag` | flag_name | Remove player flag |
| `give_xp` | amount | Award experience points |
| `give_gold` | amount | Award gold |
| `open_shop` | null | Open shop interface |
| `heal` | null | Restore player health |
| `teach_ability` | ability_key | Teach ability |
| `teleport` | room_key | Move player to room |
| `start_combat` | null | Initiate combat with NPC |
| `trigger_event` | event_name | Fire custom event |

### Action Examples

```yaml
# Quest actions
- text: "I'll help you"
  action: ["accept_quest", "find_herbs"]
  next: quest_accepted

- text: "I found them all"
  action: ["complete_quest", "find_herbs"]
  next: quest_complete

# Item actions
- text: "Take this key"
  action: ["give_item", "temple_key"]
  next: gave_key

# Multiple effects (use separate nodes)
quest_complete:
  text: "Well done!"
  action: ["complete_quest", "find_herbs"]
  next: give_reward

give_reward:
  text: "Here is your reward."
  action: ["give_item", "rare_herb"]
  next: null
```

---

## Conditions (show_if)

**Format**: `show_if: { condition: value }`

| Condition | Value Type | Description |
|-----------|------------|-------------|
| `quest_active` | quest_id | Quest is in progress |
| `quest_completed` | quest_id | Quest was turned in |
| `quest_complete` | quest_id | Quest active AND all objectives done |
| `quest_not_active` | quest_id | Quest not started |
| `quest_not_completed` | quest_id | Quest not turned in yet |
| `has_item` | item_key | Player has item |
| `has_flag` | flag_name | Player flag is set |
| `flag_set` | flag_name | Same as has_flag |
| `flag_not_set` | flag_name | Player flag not set |
| `level_at_least` | number | Player level >= N |
| `has_gold` | number | Player gold >= N |

### Condition Examples

```yaml
# Show only when quest is active
choices:
  - text: "About the quest..."
    show_if:
      quest_active: find_herbs
    next: quest_update

# Show only when ready to turn in
- text: "I found them all"
  show_if:
    quest_complete: find_herbs    # Active + objectives done
  action: ["complete_quest", "find_herbs"]
  next: complete

# Multiple conditions (AND logic)
- text: "I have what you need"
  show_if:
    quest_active: find_herbs
    has_item: rare_herb
  next: turn_in

# Hide after quest done
- text: "Need any help?"
  show_if:
    quest_not_completed: find_herbs
  next: offer_quest
```

---

## Quest Integration Patterns

### Pattern 1: Simple Quest Giver

```yaml
dialogue_tree:
  start:
    text: "Greetings."
    choices:
      # Show quest offer if not started
      - text: "Do you need help?"
        show_if:
          quest_not_active: find_herbs
        next: offer_quest
      # Show during quest
      - text: "About the herbs..."
        show_if:
          quest_active: find_herbs
        next: quest_status
      # Show when ready to turn in
      - text: "I found them!"
        show_if:
          quest_complete: find_herbs
        action: ["complete_quest", "find_herbs"]
        next: complete
      - text: "Goodbye"
        next: null

  offer_quest:
    text: "I need rare herbs from the mountain."
    choices:
      - text: "I'll find them"
        action: ["accept_quest", "find_herbs"]
        next: accepted
      - text: "Not now"
        next: null

  accepted:
    text: "Thank you! Return when you have them."
    choices:
      - text: "(Leave)"
        next: null

  quest_status:
    text: "Have you found the herbs yet?"
    choices:
      - text: "Still looking"
        next: null

  complete:
    text: "Wonderful! Here is your reward."
    action: ["give_item", "gold_coin"]
    next: null
```

### Pattern 2: Different NPCs for Give/Turn-in

```yaml
# NPC 1: Quest Giver (quest.giver)
dialogue_tree:
  start:
    text: "Danger threatens the temple."
    choices:
      - text: "What can I do?"
        show_if:
          quest_not_active: save_temple
        action: ["accept_quest", "save_temple"]
        next: accepted

# NPC 2: Turn-in NPC (quest.turn_in_npc)
dialogue_tree:
  start:
    text: "You've returned."
    choices:
      - text: "The threat is ended"
        show_if:
          quest_complete: save_temple
        action: ["complete_quest", "save_temple"]
        next: complete
```

### Pattern 3: Talk Objective with dialogue_topic

```yaml
# Quest objective:
#   type: talk
#   target_id: elder_monk
#   dialogue_topic: wisdom    # Must reach this specific node

# NPC dialogue:
dialogue_tree:
  start:
    text: "Seek you wisdom?"
    choices:
      - text: "Yes, teach me"
        next: wisdom         # This completes the objective

  wisdom:                    # This is the dialogue_topic
    text: "Listen well..."
    choices:
      - text: "(Continue)"
        next: null
```

---

## Completed Quest Variants

Show different dialogue after quest completion:

```yaml
start:
  text: "Default greeting."
  completed_quest: find_herbs    # If this quest is done...
  completed_variants:
    find_herbs: grateful_start   # ...show this node instead

grateful_start:
  text: "Ah, my herb-finder friend!"
  choices:
    - text: "Hello again"
      next: null
```

---

## Validation Rules

1. **All `next` references must exist** in the same dialogue tree
2. **Quest IDs must exist** in `priv/world/quests/`
3. **Item keys must exist** in `priv/world/prototypes/items/`
4. **Actions must be lists**: `["action", "arg"]` not `"action"`
5. **`start` node required** - entry point for dialogue
6. **No orphan nodes** - all nodes should be reachable from `start`

---

## Common Mistakes

### Wrong Action Format
```yaml
# WRONG
action: "accept_quest"
action: accept_quest

# RIGHT
action: ["accept_quest", "quest_id"]
```

### Missing Quest Reference
```yaml
# WRONG - quest doesn't exist
action: ["accept_quest", "nonexistent_quest"]

# FIX: Create quest at priv/world/quests/quest_id.yml
```

### Broken Next Reference
```yaml
# WRONG - node doesn't exist
next: missing_node

# FIX: Add the node OR use existing node
```

### Show Choice That Should Be Hidden
```yaml
# WRONG - shows turn-in before quest started
- text: "I completed the quest"
  action: ["complete_quest", "find_herbs"]

# RIGHT - conditional on quest state
- text: "I completed the quest"
  show_if:
    quest_complete: find_herbs
  action: ["complete_quest", "find_herbs"]
```

---

## Validation Commands

```bash
# Validate all dialogues
mix loka.test.validate --only dialogue

# Check specific NPC
# In IEx:
DialogueValidator.validate_npc("npc_key")
```
