# Quest Patterns

How to design engaging quests that serve the story.

## Quest Structure

```yaml
key: find_lost_pendant
name: The Lost Keepsake
description: |
  The blacksmith's daughter lost a pendant in the eastern woods.
  It belonged to her late mother.

giver_key: blacksmith_ren
giver_dialogue: quest_offer_pendant

objectives:
  - key: search_woods
    description: Search the eastern woods for the pendant
    type: visit_room
    target: eastern_clearing

  - key: find_pendant
    description: Find the pendant
    type: get_item
    target: mothers_pendant

  - key: return_pendant
    description: Return the pendant to the blacksmith
    type: talk_to
    target: blacksmith_ren
    dialogue: quest_complete_pendant

rewards:
  - type: item
    key: quality_dagger
  - type: reputation
    faction: village
    amount: 15
  - type: experience
    amount: 100
```

## Objective Types

| Type | Target | Description |
|------|--------|-------------|
| `visit_room` | room_key | Go to location |
| `get_item` | item_key | Acquire item |
| `talk_to` | npc_key | Have dialogue |
| `kill` | npc_key, count | Defeat enemies |
| `use_item` | item_key, target | Use item on something |
| `escort` | npc_key, room_key | Guide NPC to location |
| `discover` | flag_key | Trigger discovery |
| `choice` | option_keys | Make a decision |

## Quest Patterns

### The Fetch Quest (Done Right)

Basic "get thing, bring back" but with narrative value.

**Bad**: "Bring me 10 wolf pelts."
**Good**: "My daughter's pendant is in the woods. She won't tell me how it got there."

**Keys to good fetch quests:**
- Personal stakes (not arbitrary collection)
- Discovery during the fetch (learn something)
- Choice upon return (what to do with info)

### The Investigation

Player gathers clues to solve mystery.

```yaml
objectives:
  - key: examine_scene
    description: Examine the crime scene
    type: visit_room
    target: broken_window

  - key: talk_witnesses
    description: Talk to witnesses (0/3)
    type: talk_to_multiple
    targets: [witness_1, witness_2, witness_3]
    required: 2  # Only need 2 of 3

  - key: find_evidence
    description: Find physical evidence
    type: discover
    target: bloody_cloth

  - key: confront
    description: Confront the suspect
    type: talk_to
    target: suspicious_merchant
```

**Keys:**
- Multiple information sources
- Some optional, some required
- Player can miss clues and still progress
- Conclusion feels earned

### The Escort

Protect/guide NPC through danger.

```yaml
objectives:
  - key: meet_pilgrim
    description: Meet the pilgrim at the village gate
    type: talk_to
    target: nervous_pilgrim

  - key: escort
    description: Escort the pilgrim through the woods
    type: escort
    target: nervous_pilgrim
    destination: shrine_entrance
    fail_if: [npc_dies: nervous_pilgrim]

  - key: farewell
    description: Bid farewell to the pilgrim
    type: talk_to
    target: nervous_pilgrim
```

**Keys:**
- NPC has personality (dialogue during escort)
- Dangers feel real but fair
- NPC contributes (not pure burden)
- Meaningful destination

### The Moral Choice

Quest culminates in difficult decision.

```yaml
objectives:
  - key: learn_truth
    description: Discover the truth about the theft
    type: discover
    target: theft_truth
    # Player learns the "thief" was feeding starving family

  - key: decide
    description: Decide what to do
    type: choice
    options:
      - key: turn_in
        description: Turn in the thief
        effects:
          - set_flag: chose_justice
          - reputation: guards: 20
          - reputation: poor: -30
      - key: cover_up
        description: Cover for the thief
        effects:
          - set_flag: chose_mercy
          - reputation: poor: 20
          - reputation: guards: -10
      - key: compromise
        description: Find another solution
        effects:
          - set_flag: found_compromise
          - reputation: guards: 5
          - reputation: poor: 10
        requires:
          - flag: spoke_to_merchant
```

**Keys:**
- No obviously "right" answer
- Each choice has real consequences
- Third option requires effort to unlock
- Player values inform outcome

### The Chain Quest

Series of connected quests telling larger story.

```yaml
# Quest 1
key: strange_sounds
prerequisites: []
unlocks: [investigate_source]

# Quest 2
key: investigate_source
prerequisites: [strange_sounds]
unlocks: [confront_cause]

# Quest 3
key: confront_cause
prerequisites: [investigate_source]
unlocks: [resolution_a, resolution_b]  # Branches based on choices

# Resolution A
key: resolution_peaceful
prerequisites: [confront_cause]
requires_flags: [chose_diplomacy]

# Resolution B
key: resolution_forceful
prerequisites: [confront_cause]
requires_flags: [chose_force]
```

## Quest-Aware Dialogue

NPCs should react to quest state.

```yaml
# Before quest
start:
  text: "The usual, stranger?"
  show_if:
    - type: quest_not_started
      quest: tavern_mystery

# During quest
start:
  text: "Still poking around, I see. Found anything?"
  show_if:
    - type: quest_active
      quest: tavern_mystery

# After quest (good outcome)
start:
  text: "You did good work. Drinks are on the house."
  show_if:
    - type: quest_complete
      quest: tavern_mystery
    - type: flag
      flag: tavern_saved

# After quest (bad outcome)
start:
  text: "..."
  show_if:
    - type: quest_complete
      quest: tavern_mystery
    - type: flag
      flag: tavern_destroyed
```

## Reward Philosophy

### Match Reward to Effort

| Quest Type | Appropriate Rewards |
|------------|---------------------|
| Simple fetch | Gold, common items |
| Investigation | Information, access |
| Moral choice | Reputation, story |
| Chain finale | Unique items, abilities |

### Narrative Rewards

Not everything is loot:
- Access to new area
- NPC becomes ally
- Learn important information
- Unlock new dialogue options
- Change world state

### Avoid

- Rewards that trivialize content
- Best items from easiest quests
- Only combat rewards for non-combat quests
- Identical rewards for different choices

## Quest Pacing

### In a Zone

```
Quest 1: Introduction (easy, teaches mechanics)
Quest 2: Development (moderate, reveals character)
Quest 3: Complication (challenging, raises stakes)
Quest 4: Resolution (climactic, meaningful choice)
```

### Across the Game

- Early: Simple objectives, clear morality
- Middle: Complex objectives, shades of grey
- Late: Intertwined objectives, heavy consequences

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| "Kill 20 rats" | Give rats a reason to be there |
| Trivial fetch | Personal stakes for quest giver |
| Railroad to one outcome | Meaningful player agency |
| Quest ends at hand-in | Show consequences in world |
| Every quest saves world | Varied stakes and scale |
