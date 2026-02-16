# Traits Reference (V2)

> **For Builders**: This guide explains how to add traits to NPCs and other entities.

## Overview

Traits are reusable behavior scripts that define how entities react to world events (time changes, player interactions, etc.). Instead of writing custom scripts for each NPC, you can attach pre-built trait scripts with configuration.

```yaml
# Example: NPC with patrol and day/night schedule
key: monastery_guard
type: npc
traits:
  - script: patrol
    config:
      route: [monastery_gate, main_courtyard, temple]
      interval: 180
  - script: day_night_schedule
    config:
      wake_at: dawn
      sleep_at: dusk
```

## Traits vs Scripts vs Emotes

| Feature | Purpose | Triggers |
|---------|---------|----------|
| **Traits** | Reusable mechanics | World events (time, combat, etc.) |
| **Scripts** | Custom one-off logic | Hooks (on_look, on_say, etc.) |
| **Emotes** | Personality text | Trait events via emit() |

**Pattern**: Traits handle *what happens*, emotes handle *what's displayed*.

---

## Available Trait Scripts

All trait scripts are located in `priv/world/scripts/traits/`.

### patrol

Makes an NPC walk a defined route between rooms.

```yaml
traits:
  - script: patrol
    config:
      route:              # Required: list of room keys
        - monastery_gate
        - main_courtyard
        - temple
      interval: 300       # Seconds between moves (default: 300)
      loop: true          # true = repeat, false = reverse (default: true)
```

**Emits**: `:patrol_arrive` when reaching each destination

### day_night_schedule

Makes an NPC wake and sleep based on time events.

```yaml
traits:
  - script: day_night_schedule
    config:
      wake_at: dawn       # dawn, morning, noon (default: dawn)
      sleep_at: dusk      # dusk, evening, midnight (default: dusk)
      wake_room: forge    # Optional: room to move to when waking
      sleep_room: house   # Optional: room to move to when sleeping
```

**Emits**: `:waking_up`, `:going_to_sleep`, `:arrived_at_work`, `:arrived_home`

### shopkeeper_hours

Controls shop open/close based on time.

```yaml
traits:
  - script: shopkeeper_hours
    config:
      open_at: morning    # When shop opens (default: morning)
      close_at: evening   # When shop closes (default: evening)
```

**Emits**: `:opening_shop`, `:closing_shop`

Sets `shop_open` flag that can be checked in dialogues.

### wander

Makes an NPC move randomly within constraints.

```yaml
traits:
  - script: wander
    config:
      interval: 600       # Seconds between moves (default: 600)
      zone: monastery     # Optional: stay within zone
      room_tags: [outdoor]     # Optional: only rooms with these tags
      avoid_tags: [dangerous]  # Optional: avoid rooms with these tags
```

**Emits**: `:wander_arrive`

### ambient_emitter

Periodically emits flavor text events.

```yaml
traits:
  - script: ambient_emitter
    config:
      interval: 300       # Seconds between attempts (default: 300)
      emote_key: ambient  # Which emote to trigger (default: ambient)
      chance: 50          # 0-100 probability each cycle (default: 100)
```

**Emits**: Configured `emote_key` (default: `:ambient`)

### nocturnal

Makes an NPC active only at night, hiding during day.

```yaml
traits:
  - script: nocturnal
    config:
      wake_at: dusk        # When to become active (default: dusk)
      sleep_at: dawn       # When to go dormant (default: dawn)
      active_room: cemetery # Optional: room when active
      hide_room: crypt     # Optional: room when hiding
```

**Emits**: `:becoming_active`, `:going_dormant`, `:emerged`, `:hidden`

### spawn_condition_time

Spawns/despawns entities based on time of day.

```yaml
traits:
  - script: spawn_condition_time
    config:
      prototype: hungry_ghost    # Required: entity to spawn
      active_hours: [20, 21, 22, 23, 0, 1, 2, 3, 4]  # Hours 0-23
      max_count: 3               # Max spawned at once (default: 1)
      spawn_chance: 70           # % chance each check (default: 100)
```

**Emits**: `:spawned_entity`, `:despawned_entities`

---

## Time Events

Behaviors can listen to these world time events:

| Event | Typical Hour |
|-------|--------------|
| `dawn` | 5-6 |
| `morning` | 7-11 |
| `noon` | 12 |
| `afternoon` | 13-17 |
| `dusk` | 18-19 |
| `evening` | 20-21 |
| `midnight` | 0 |

---

## Combining with Emotes

Traits emit events that trigger emotes. Define emotes on the entity to customize what's displayed:

```yaml
key: blacksmith_tashi
type: npc
emotes:
  waking_up: "*stokes the forge embers* Time to work!"
  opening_shop: "*pumps the bellows* Welcome to my forge!"
  closing_shop: "*banks the fire* Come back tomorrow."
  going_to_sleep: "*covers the anvil* The work is done."
traits:
  - script: shopkeeper_hours
    config:
      open_at: morning
      close_at: evening
  - script: day_night_schedule
    config:
      wake_at: dawn
      sleep_at: dusk
```

When the shopkeeper_hours trait emits `:opening_shop`, the emote `"*pumps the bellows* Welcome to my forge!"` is displayed to players in the room.

---

## Config Schema

Each trait script defines what configuration it accepts. Common schema types:

| Type | Example | Description |
|------|---------|-------------|
| `atom` | `wake_at: dawn` | Elixir atom/keyword |
| `string` | `zone: monastery` | Text string |
| `integer` | `interval: 300` | Whole number |
| `boolean` | `loop: true` | true/false |
| `list` | `route: [a, b, c]` | Array of values |

Invalid configs are logged as warnings and the trait continues with defaults.

---

## Trait Format

Traits are defined in the `traits` field (renamed from `behaviors` in V2):

```yaml
# V2 format (current)
traits:
  - script: patrol
    config:
      route: [room_a, room_b]

# V1 format (deprecated) - still works but avoid
behaviors:
  - Loka.Behaviors.Patrol
```

---

## Creating Custom Trait Scripts

Custom trait scripts are located in `priv/world/scripts/traits/`:

```yaml
# priv/world/scripts/traits/custom_trait.yml
key: custom_trait
type: script
name: "My Custom Trait"
description: "Does something custom"
tags: [trait, custom]
data:
  hook: trait
  events: [dawn, dusk]  # Which time events to listen to
  config_schema:
    some_option:
      type: string
      required: true
      description: "A required option"
    other_option:
      type: integer
      default: 100
      min: 1
      max: 1000
  source: |
    # Access config
    value = config.some_option

    # Emit events for emotes
    emit(:custom_event)

    # Modify state
    set_trait_state(:my_state, value)

    # Signal completion
    handled()
```

See the existing trait scripts in `priv/world/scripts/traits/` for examples.
