# Quest YAML Structure

## Required Fields

```yaml
id: quest_unique_id               # Required - unique identifier
name: "Quest Display Name"        # Required - shown to player
description: |                    # Optional - quest description
  Multi-line description text
giver: system | npc_key           # Required - "system" or NPC key
type: main | side | daily         # Optional - defaults to "side"
objectives:                       # Required - at least one objective
  - id: objective_id
    type: talk | kill | get_item | go_to
    target_id: entity_key
    description: "What to do"
rewards:                          # Optional
  xp: 100
  gold: 50
```

## Objective Types

### Talk Objective
```yaml
- id: talk_elder
  type: talk
  target_id: elder_monk           # NPC key
  description: "Speak with the Elder"
```

### Kill Objective
```yaml
- id: defeat_bandits
  type: kill
  target_id: bandit               # Enemy key
  count: 5                        # How many
  description: "Defeat 5 bandits"
```

### Get Item Objective
```yaml
- id: collect_herbs
  type: get_item
  target_id: healing_herb         # Item key
  count: 3
  description: "Collect 3 healing herbs"
```

### Go To Objective
```yaml
- id: find_temple
  type: go_to
  target_id: temple_entrance      # Room key
  description: "Find the temple entrance"
```

## System Quests

System quests auto-grant on spawn and auto-complete:
```yaml
id: intro_welcome
giver: system                     # Auto-grants
type: main
objectives:
  - id: talk_novice
    type: talk
    target_id: novice_pema
```

## NPC Quests

NPC quests require dialogue to accept/turn-in:
```yaml
id: help_elder
giver: elder_monk                 # Must talk to accept
turn_in_npc: elder_monk          # Must return to complete
```

## Common Mistakes

❌ **Missing giver**
```yaml
id: broken_quest
# giver: ???                     # Required!
```

✅ **Always specify giver**
```yaml
id: working_quest
giver: system                     # or NPC key
```

❌ **Invalid objective type**
```yaml
objectives:
  - type: talk_to                 # Wrong!
```

✅ **Use valid types**
```yaml
objectives:
  - type: talk                    # Correct
```
