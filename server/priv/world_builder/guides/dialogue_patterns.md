# Dialogue Patterns

How to write effective dialogue trees for NPCs.

## Dialogue Tree Structure

```yaml
key: elder_thoma_intro
npc_key: elder_thoma
nodes:
  start:
    text: "Ah, a new face. The forest has been... restless lately."
    options:
      - text: "Restless? What do you mean?"
        next: explain_restless
      - text: "I'm looking for work."
        next: work_available
      - text: "I should go."
        next: farewell

  explain_restless:
    text: "Strange sounds at night. Animals behaving oddly. Nothing I can put words to, but..."
    options:
      - text: "But what?"
        next: but_what
      - text: "Sounds like trouble."
        next: trouble_response

  farewell:
    text: "Safe travels, stranger. May the forest provide."
    actions:
      - type: end_dialogue
```

## Node Types

### Information Node

Delivers lore/exposition.

```yaml
explain_history:
  text: |
    "This village has stood for three hundred years. We were here before
    the kingdom claimed these lands, and we'll be here after."
  options:
    - text: "Tell me more"
      next: history_detail
    - text: "Interesting. What about..."
      next: change_topic
```

**Tip**: Break long exposition into multiple nodes with player prompts.

### Choice Node

Player decision with consequences.

```yaml
moral_choice:
  text: "The merchant offers twice what the widow could pay. What's your answer?"
  options:
    - text: "I'll sell to you."
      next: sell_merchant
      actions:
        - type: set_flag
          flag: chose_profit
        - type: reputation
          faction: merchants
          change: 10
    - text: "I promised it to the widow."
      next: keep_promise
      actions:
        - type: set_flag
          flag: kept_promise
        - type: reputation
          faction: villagers
          change: 10
```

### Gated Node

Requires condition to access.

```yaml
secret_info:
  text: "Since you helped my daughter... there's something you should know."
  show_if:
    - type: quest_complete
      quest: help_merchant_daughter
  options:
    - text: "I'm listening."
      next: reveal_secret
```

### Action Node

Triggers game state changes.

```yaml
give_reward:
  text: "Take this. You've earned it."
  actions:
    - type: give_item
      item: ancient_key
    - type: advance_quest
      quest: find_the_key
      stage: key_obtained
  options:
    - text: "Thank you."
      next: farewell
```

## Show_If Conditions

Control when options/nodes appear.

```yaml
options:
  - text: "I found your pendant."
    next: pendant_return
    show_if:
      - type: has_item
        item: lost_pendant

  - text: "[Intimidate] You WILL tell me."
    next: intimidate_success
    show_if:
      - type: skill_check
        skill: intimidation
        difficulty: 15

  - text: "About what you mentioned before..."
    next: previous_topic
    show_if:
      - type: flag
        flag: discussed_ruins
```

### Available Conditions

| Type | Parameters | Description |
|------|------------|-------------|
| `has_item` | item | Player has item |
| `quest_active` | quest | Quest in progress |
| `quest_complete` | quest | Quest finished |
| `flag` | flag | Game flag set |
| `reputation` | faction, min, max | Rep within range |
| `skill_check` | skill, difficulty | Skill meets threshold |
| `stat` | stat, min | Stat meets minimum |

## Dialogue Actions

What happens when node is reached or option selected.

```yaml
actions:
  - type: give_item
    item: healing_potion
    quantity: 3

  - type: take_item
    item: gold_coin
    quantity: 50

  - type: set_flag
    flag: knows_secret

  - type: advance_quest
    quest: main_story
    stage: met_elder

  - type: reputation
    faction: village
    change: 5

  - type: teleport
    room: secret_room

  - type: spawn_npc
    npc: mysterious_stranger
    room: current

  - type: end_dialogue
```

## Writing Effective Dialogue

### Voice Consistency

Each NPC should have distinct speech patterns.

**Elder (formal, measured)**:
> "The ways of our ancestors guide us still. To ignore them would be... unwise."

**Child (informal, energetic)**:
> "Hey! Hey, did you see the thing? In the forest? It was THIS big!"

**Merchant (transactional, cautious)**:
> "Quality goods. Fair prices. No questions about where things came from."

### Subtext

What characters DON'T say matters.

**Surface**: "We don't go into the eastern woods."
**Subtext**: Something terrible happened there.

**Surface**: "Your room is ready. Will you be staying... long?"
**Subtext**: I hope you leave soon.

### Natural Branching

Don't force players through linear exposition.

```yaml
# Bad: Linear exposition dump
start:
  text: "[Long paragraph of history]"
  options:
    - text: "Continue"
      next: more_exposition

# Good: Player-driven exploration
start:
  text: "What brings you to our village?"
  options:
    - text: "Tell me about this place"
      next: village_info
    - text: "I heard there's work here"
      next: work_available
    - text: "Just passing through"
      next: brief_exchange
```

### Emotional Beats

Include moments of connection, not just information.

```yaml
shared_moment:
  text: |
    The elder is quiet for a long moment. When he speaks again,
    his voice is softer.

    "You remind me of someone. Someone I... well. That was a long time ago."
  options:
    - text: "Who?"
      next: personal_story
    - text: "[Say nothing]"
      next: respectful_silence
```

## Common Patterns

### The Information Broker

```yaml
# Gives info for price/favor
start:
  text: "Information has value. What do you offer?"
  options:
    - text: "[Pay 50 gold]"
      show_if: [has_gold: 50]
      next: paid_info
      actions: [take_gold: 50]
    - text: "I helped with the rat problem"
      show_if: [quest_complete: clear_rats]
      next: favor_info
    - text: "Never mind"
      next: farewell
```

### The Reluctant Revealer

```yaml
# Requires multiple interactions to open up
start:
  text: "What do you want?"
  options:
    - text: "About the ruins..."
      next: deny_knowledge

deny_knowledge:
  text: "I don't know anything about that."
  actions: [set_flag: asked_about_ruins]

# Later, after building trust:
trust_unlock:
  show_if: [flag: helped_three_times]
  text: "Look... about those ruins. I wasn't entirely honest."
```

### The Quest Giver

```yaml
quest_offer:
  text: |
    "Someone's been taking from my traps. I'm too old to chase them down.
    Find out who's responsible, and I'll make it worth your while."
  options:
    - text: "I'll look into it."
      next: accept_quest
      actions:
        - type: start_quest
          quest: trap_thief
    - text: "What's in it for me?"
      next: negotiate_reward
    - text: "Not my problem."
      next: decline_quest
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Wall of text | Break into digestible chunks |
| "Tell me everything" | Player chooses topics |
| All paths same outcome | Choices have consequences |
| NPCs explain plot | Show through events |
| Same voice all NPCs | Distinct speech patterns |
