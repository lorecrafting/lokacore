# Storyline Design Tips

This guide captures practical patterns for creating cohesive, immersive narratives using the Loka quest and dialogue systems.

## Core Principles

### 1. Every Interaction Should Feel Meaningful

Players should never feel like they're just running errands. Every NPC interaction, room transition, and quest objective should advance the story or deepen their understanding of the world.

### 2. The World Should React to Player Progress

NPCs should acknowledge player achievements, quest states, and story progress. A static world feels lifeless.

### 3. Guide Without Railroading

Use the quest system to provide direction, but allow players to explore and discover at their own pace.

---

## Pattern: The Introduction Quest

**Problem:** Player arrives in a new area with no context or direction.

**Solution:** Create a short "find the quest giver" quest that establishes the setting and guides players to the main content.

### Example: "Seeking the Abbot"

```yaml
# priv/world/quests/intro_find_temple.yml
id: intro_find_temple
name: "Seeking the Abbot"
description: |
  Novice Pema has told you of a crisis at the monastery. The Abbot
  awaits in the temple and may have answers.
giver: novice_pema
type: main
objectives:
  - id: reach_temple
    type: go_to
    target_id: temple
    description: "Find the temple and speak with the Abbot"
rewards:
  xp: 25
journal_entries:
  start: "Novice Pema spoke of a crisis. The Abbot awaits in the temple."
  complete: "I have reached the temple. The Abbot seems to have been expecting me."
```

### Why This Works:
- Player immediately has a goal and direction
- Quest log reminds them where to go
- Small XP reward validates exploration
- Sets up the main quest giver naturally

---

## Pattern: Quest-Aware NPC Dialogue

**Problem:** NPCs greet every player the same way, regardless of context.

**Solution:** Use `show_if` conditions in dialogue to vary NPC responses based on quest state.

### Example: NPC Who Sent the Player

```yaml
# NPC who gave the intro quest
how_help:
  text: "Please, speak with Abbot Jampa in the temple to the north."
  show_if:
    quest_not_active: "intro_find_temple"
  choices:
    - text: "I'll go to the temple now."
      next: "quest_given"
      action: ["accept_quest", "intro_find_temple"]

how_help_active:
  text: "Have you found the temple yet? The Abbot awaits!"
  show_if:
    quest_active: "intro_find_temple"
  choices:
    - text: "I'm on my way."
      next: null
```

### Example: NPC Expecting the Player

```yaml
# The Abbot, when player arrives with the intro quest
start:
  text: "Ah, traveler. I am Jampa, Abbot of this monastery."
  show_if:
    quest_not_active: "intro_find_temple"
  choices:
    - text: "What is happening here?"
      next: "crisis"

start_pema_sent:
  text: "Ah! Young Pema sent you - I could see it in your step. I have been waiting for someone with your courage."
  show_if:
    quest_active: "intro_find_temple"
  choices:
    - text: "What has happened?"
      next: "crisis"
    - text: "How can I help?"
      next: "help_request"
```

### Why This Works:
- NPCs feel aware of the player's journey
- Creates narrative continuity between conversations
- "I've been expecting you" moments feel rewarding
- Shows the world is interconnected

---

## Pattern: Room Entry Quest Completion

**Problem:** Player reaches a location but nothing happens.

**Solution:** Use `go_to` objectives that automatically complete when entering rooms, with quest log feedback.

### Example

```yaml
objectives:
  - id: reach_temple
    type: go_to
    target_id: temple  # Must match the room's prototype key
    description: "Find the temple"
```

When the player enters the temple room, the system automatically:
1. Checks active quests for matching `go_to` objectives
2. Marks the objective complete
3. Shows "Quest objective completed: Reach Temple" in the event log
4. Updates the quest log

### Implementation Note

The room entry check uses the room's `key` field (prototype key), not the room ID. Make sure quest objectives reference the correct prototype key:

```yaml
# Room prototype
key: temple  # <-- This is what go_to objectives match against
type: room
short_desc: "Temple"
```

---

## Pattern: Sequential Discovery

**Problem:** Player gets overwhelmed with too much information at once.

**Solution:** Reveal story elements gradually through quest chains.

### Example Quest Chain

```
1. intro_find_temple (go_to: temple)
   - Player learns: "There's a crisis, go to the temple"

2. main_sleeping_master (given by Abbot)
   - Player learns: "Master Tenzin won't wake, find his journal"
   - Objectives: visit_cell, find_journal, talk_pema, return_abbot

3. main_three_trials (unlocked by completing #2)
   - Player learns: "Three demons hold Tenzin captive"
   - Each trial reveals more about the Three Poisons
```

### Why This Works:
- Information is digestible
- Each quest builds on previous knowledge
- Player feels progression through understanding
- Avoids lore dumps

---

## Pattern: Environmental Storytelling with Objectives

**Problem:** Player rushes through areas without engaging with the story.

**Solution:** Create objectives that require visiting specific locations or finding specific items.

### Example

```yaml
objectives:
  - id: visit_cell
    type: go_to
    target_id: tenzins_cell
    description: "Visit Lama Tenzin's meditation cell"

  - id: find_journal
    type: get_item
    target_id: meditation_journal
    description: "Find Tenzin's meditation journal"
```

The room description can then tell the story:

```yaml
# tenzins_cell room prototype
extra_desc: |
  The master's private meditation chamber is smaller than expected.
  Lama Tenzin sits motionless on his cushion, his breathing shallow
  but steady. A worn meditation journal lies open on the desk beside
  him, its pages filled with cramped handwriting.
```

---

## Pattern: NPC Companion Setup

**Problem:** Companions join the party without narrative justification.

**Solution:** Use quest completion to unlock companion availability.

### Example

```yaml
# Quest rewards
rewards:
  xp: 100
  companion_available: novice_pema
```

The companion's dialogue should also reflect their readiness to join:

```yaml
# After quest completion
companion_offer:
  text: "I cannot sit idle while Master Tenzin suffers. Let me come with you."
  show_if:
    quest_complete: "main_sleeping_master"
  choices:
    - text: "I could use your help."
      action: ["add_companion", "novice_pema"]
      next: "companion_joined"
    - text: "It's too dangerous."
      next: "companion_declined"
```

---

## Dialogue Action Reference

These actions can be triggered from dialogue choices:

| Action | Format | Description |
|--------|--------|-------------|
| `accept_quest` | `["accept_quest", "quest_id"]` | Accept a quest |
| `complete_quest` | `["complete_quest", "quest_id"]` | Mark quest complete |
| `give_item` | `["give_item", "item_key"]` | Give item to player |
| `set_flag` | `["set_flag", "flag_name"]` | Set a player flag |
| `learn_skill` | `["learn_skill", "skill_id"]` | Teach a skill |

---

## Conditional Dialogue Reference

Show different dialogue based on quest state:

| Condition | Format | Description |
|-----------|--------|-------------|
| `quest_not_active` | `show_if: { quest_not_active: "quest_id" }` | Show if quest NOT in active quests |
| `quest_active` | `show_if: { quest_active: "quest_id" }` | Show if quest IS in active quests |
| `quest_complete` | `show_if: { quest_complete: "quest_id" }` | Show if quest is completed |
| `has_item` | `show_if: { has_item: "item_key" }` | Show if player has item |
| `has_flag` | `show_if: { has_flag: "flag_name" }` | Show if player has flag set |

---

## Checklist: Designing a New Quest Chain

Use this checklist when designing new storylines:

### Setup
- [ ] Is there an intro quest that guides players to the main content?
- [ ] Does the first NPC acknowledge where the player came from?
- [ ] Are `go_to` objectives using the correct room prototype keys?

### NPC Dialogue
- [ ] Do quest givers have different dialogue for quest states (not started, active, complete)?
- [ ] Do NPCs reference player actions and progress?
- [ ] Does dialogue end with clear direction on what to do next?

### Quest Flow
- [ ] Are objectives in a logical order?
- [ ] Does each objective advance the story or reveal new information?
- [ ] Are there journal entries that help players remember the context?

### Rewards & Progression
- [ ] Does completing the quest unlock the next logical step?
- [ ] Are companions earned through story moments, not just given?
- [ ] Is the XP reward appropriate for the effort required?

### Testing
- [ ] Run `mix loka.test.storyline [storyline_id]` to validate
- [ ] Play through manually to check dialogue flow
- [ ] Verify room entry triggers `go_to` objectives correctly

---

## Common Mistakes

### 1. Forgetting `show_if` for alternate dialogue
**Bad:** Single `start` node that plays every time.
**Good:** Multiple start variants based on quest state.

### 2. Mismatched `go_to` target_id
**Bad:** `target_id: "temple_room_uuid"`
**Good:** `target_id: "temple"` (the prototype key)

### 3. Quest without journal entries
**Bad:** No `journal_entries` section.
**Good:** At least `start` and `complete` entries that remind player of goals.

### 4. Dead-end dialogue
**Bad:** Choice leads to `next: null` with no closure.
**Good:** Every conversation ending feels intentional.

### 5. Overwhelming first quest
**Bad:** First quest has 10 objectives across the entire map.
**Good:** First quest is simple (1-2 objectives) to teach the system.

---

## See Also

- [Storyline System Architecture](../architecture/storylines.md) - Technical details
- [Quest System](../framework/README.md#quest-system) - Quest implementation
- [Dialogue System](../framework/README.md#dialogue-system) - Dialogue tree format
