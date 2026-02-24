# Emotes Reference

> **For Builders**: This guide explains how to add personality emotes to NPCs.

## Overview

Emotes are personality messages that display when behaviors or scripts trigger events. They let you give each NPC a unique voice without writing custom scripts.

```yaml
key: novice_pema
type: npc
emotes:
  waking_up: "*stretches mindfully* Another day of practice awaits."
  going_to_sleep: "*settles into meditation posture* May dreams bring wisdom."
  greeting: "Peace be with you, traveler."
  becoming_anxious: "*wrings her hands, glancing toward the meditation chamber*"
```

## How Emotes Work

1. **Trait triggers emit()** → `emit(:waking_up)`
2. **System looks up emote** → `emotes.waking_up`
3. **Message displayed** → "*stretches mindfully* Another day..."

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│    Trait    │ ──▶ │  emit(:key)  │ ──▶ │ Emote Displayed │
│ (schedule)  │     │              │     │   to Room       │
└─────────────┘     └──────────────┘     └─────────────────┘
```

---

## Emote Format

Emotes can contain:
- **Actions**: `*action text*` - displayed as entity actions
- **Speech**: Regular text - displayed as entity speech
- **Combined**: Both actions and speech

```yaml
emotes:
  # Action only
  meditation_start: "*closes her eyes, breathing deeply*"

  # Speech only
  greeting: "Welcome to my shop!"

  # Combined
  opening_shop: "*throws open the shutters* Good morning! We're open!"
```

---

## Common Emote Keys

These emote keys are used by the standard trait scripts:

### Day/Night Schedule

| Key | When Triggered |
|-----|----------------|
| `waking_up` | NPC wakes at configured time |
| `going_to_sleep` | NPC sleeps at configured time |
| `arrived_at_work` | NPC reaches wake_room |
| `arrived_home` | NPC reaches sleep_room |

### Shopkeeper Hours

| Key | When Triggered |
|-----|----------------|
| `opening_shop` | Shop opens |
| `closing_shop` | Shop closes |

### Patrol

| Key | When Triggered |
|-----|----------------|
| `patrol_arrive` | NPC arrives at patrol point |

### Nocturnal

| Key | When Triggered |
|-----|----------------|
| `becoming_active` | NPC wakes at night |
| `going_dormant` | NPC hides at dawn |
| `emerged` | NPC appears in active_room |
| `hidden` | NPC moves to hide_room |

### Ambient Emitter

| Key | When Triggered |
|-----|----------------|
| `ambient` | Periodic (default key) |
| `<custom>` | Whatever you configure |

---

## Emotes by NPC Role

### Monks/Religious NPCs

```yaml
emotes:
  waking_up: "*rises from meditation* The dawn brings new wisdom."
  going_to_sleep: "*settles into stillness* May peace find you."
  meditation_start: "*closes eyes, hands forming a mudra*"
  greeting: "May the dharma guide your path."
  blessing: "*traces a sacred symbol* Go with wisdom."
```

### Guards/Warriors

```yaml
emotes:
  waking_up: "*performs morning exercises* The watch begins."
  going_to_sleep: "*sets weapon beside mat* May the night be peaceful."
  patrol_arrive: "*scans the area with practiced vigilance*"
  spotted_player: "*nods in acknowledgment, hand on weapon*"
  alert: "*grips weapon tightly, eyes narrowing*"
  standing_watch: "*stands firm, ever watchful*"
```

### Shopkeepers/Merchants

```yaml
emotes:
  waking_up: "*opens shutters* Time for business!"
  going_to_sleep: "*counts the day's coins* Not bad, not bad."
  opening_shop: "*arranges wares with pride* Welcome, customers!"
  closing_shop: "*packs away goods* Until tomorrow!"
  greeting: "*rubs hands together* What can I get for you?"
  sale_complete: "*bows slightly* Pleasure doing business!"
```

### Cooks/Service NPCs

```yaml
emotes:
  waking_up: "*lights the cooking fire* Time to feed hungry souls!"
  going_to_sleep: "*wipes down surfaces* The kitchen rests."
  cooking: "*stirs a bubbling pot, inhaling deeply*"
  serving_meal: "*ladles stew with care* Eat! Eat!"
  greeting: "*beams warmly* You look hungry!"
```

### Teachers/Trainers

```yaml
emotes:
  waking_up: "*performs morning stretches* The body awakens."
  meditation_start: "*centers himself, still as stone*"
  teaching: "*demonstrates a technique with fluid grace*"
  encouragement: "*places a hand on your shoulder* You have potential."
```

---

## Emotes vs ambient_actions

Entities can also have `ambient_actions` in their components:

```yaml
components:
  ambient_actions:
    messages:
      - "The guard glances around, checking for disturbances."
      - "The guard adjusts his grip on his staff."
    interval_min: 30
    interval_max: 60
    chance: 0.5
```

**Difference**:
- `ambient_actions` - Random periodic messages (automatic, component-based)
- `emotes` - Event-triggered messages (via emit() from traits/scripts)

Use ambient_actions for passive flavor, emotes for reactive personality.

---

## Emote Definitions

Each prototype defines its own complete set of emotes — there is no inheritance. Include all emotes directly in the prototype file.

---

## Using emit() in Scripts

Scripts can trigger emotes with emit():

```elixir
# In a script
if time_of_day() == :dawn do
  emit(:waking_up)
end

# With fallback if emote not defined
emit(:custom_event)  # Silent if no emote for :custom_event
```

If no emote is defined for the key, emit() does nothing (no error).

---

## Best Practices

1. **Match personality**: Grumpy NPCs should have grumpy emotes
2. **Use actions sparingly**: `*asterisk text*` for emphasis, not every emote
3. **Keep it short**: Emotes should be one line
4. **Be consistent**: All NPCs of a type should have similar emote keys
5. **Consider time**: Waking/sleeping emotes create living world feel

```yaml
# Good - personality shows through
emotes:
  greeting: "*grunts* What do you want?"
  opening_shop: "*reluctantly opens shutters* Fine. We're open."

# Less good - generic
emotes:
  greeting: "Hello."
  opening_shop: "The shop is now open."
```
