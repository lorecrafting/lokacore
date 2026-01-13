# World Liveliness Guide

> Best practices for making NPCs and the game world feel alive and dynamic.

## Overview

A living world makes players feel immersed. Static NPCs waiting forever for player interaction break immersion. This guide covers systems and techniques to add life to your world.

## Available Systems

Loka provides several systems for world liveliness:

| System | Purpose | Code Required |
|--------|---------|---------------|
| NPC Ambient Actions | Periodic descriptive text | No (YAML) |
| Room Ambient Messages | Atmospheric room descriptions | No (auto) |
| Day/Night Cycle | Time-aware content | No (YAML phases) |
| Weather System | Dynamic weather events | No (config) |
| Patrol Behavior | Fixed-route movement | No (YAML) |
| WanderBehavior | Random movement within area | No (YAML) |

## Quick Start

### 1. Add Ambient Actions to Key NPCs

The fastest way to add life is ambient actions - character-specific flavor text that broadcasts periodically. Add to any NPC prototype:

```yaml
# priv/world/prototypes/npcs/monastery/merchant_dorje.yml
components:
  ambient_actions:
    messages:
      - "The merchant carefully polishes a piece of jade."
      - "Dorje arranges his wares with practiced precision."
      - "The merchant counts coins, lips moving silently."
      - "He glances up from his ledger and smiles warmly."
    interval_min: 30    # Minimum seconds between messages
    interval_max: 60    # Maximum seconds between messages
    chance: 0.5         # 50% chance when timer fires
```

**Guidelines for ambient actions:**
- Use third person: "The merchant polishes..." not "I polish..."
- Keep messages short (one sentence)
- Mix actions, observations, and atmospheric details
- 5-6 messages per NPC is ideal for variety
- Interval of 30-60 seconds with 50% chance feels natural

### 2. Room Ambient Messages (Automatic)

Room ambient messages are handled automatically by the `RoomAmbient` system based on room tags. No YAML configuration needed - just tag your rooms appropriately:

```yaml
# priv/world/prototypes/rooms/monastery/courtyard.yml
tags:
  - outdoor
  - monastery
```

The system selects messages based on tags:
- `monastery`: "The faint sound of chanting drifts on the air."
- `forest`: "Leaves rustle in the canopy above."
- `cave`: "Water drips from the ceiling."
- `outdoor`: Weather and time-of-day specific messages

## Wandering NPCs

### When to Use Wandering NPCs

Wandering NPCs add movement and life. Good candidates:

| NPC Type | Why They Wander |
|----------|-----------------|
| Animals (cats, dogs) | Natural curiosity |
| Pilgrims/visitors | Exploring the area |
| Workers (sweeping monks) | Doing their job |
| Patrol guards | Security routes |

### Configuring WanderBehavior

```yaml
# priv/world/prototypes/npcs/monastery/temple_cat.yml
key: temple_cat
parent: base_npc
type: npc
short_desc: "Temple Cat"
long_desc: "A serene orange cat with knowing eyes."
tags: [animal, ambient, non_hostile, cannot_attack]
behaviors:
  - Loka.Behaviors.Wander
attributes:
  behavior_config:
    wander:
      allowed_rooms:
        - monastery_courtyard
        - monastery_garden
        - monastery_meditation_hall
        - monastery_kitchen
      move_chance: 0.25    # 25% chance to move each tick
      tick_interval: 60000 # Check every 60 seconds (in ms)
      phases:              # Only wander during day
        - day
      idle_messages:
        - "The cat watches you with half-closed eyes."
```

### Fencing Rules

NPCs only move to rooms in `allowed_rooms`. Choose rooms that make sense for the NPC's role:

| NPC | Appropriate Rooms | Inappropriate Rooms |
|-----|-------------------|---------------------|
| Temple cat | Courtyard, garden, kitchen | Dungeon, combat areas |
| Pilgrim | Public areas, shrine | Private quarters |
| Sweeping monk | Halls, courtyard | Bedrooms, storage |

### Room Connectivity

All rooms in `allowed_rooms` should form a connected path. If rooms are disconnected, the NPC can get trapped.

**Good (connected):**
```yaml
allowed_rooms:
  - courtyard      # connects to garden
  - garden         # connects to courtyard and hall
  - meditation_hall # connects to garden
```

**Bad (disconnected):**
```yaml
allowed_rooms:
  - courtyard      # connects to garden
  - garden         # connects to courtyard
  - isolated_shrine # NO connection to courtyard or garden!
```

The system validates connectivity at load time and warns about potential traps.

## Design Patterns

### The "Extras" Pattern

Create ambient NPCs that exist purely for atmosphere, not gameplay:

```yaml
key: elderly_visitor
type: npc
parent: base_npc
short_desc: "Elderly Visitor"
long_desc: "An old woman here to light incense for her ancestors."
keywords: [visitor, woman, elder, grandmother]
primary_keyword: visitor
tags: [friendly, atmosphere]
behaviors:
  - Loka.Behaviors.Wander
attributes:
  behavior_config:
    wander:
      allowed_rooms:
        - temple
        - main_courtyard
        - monastery_gate
      move_chance: 0.1  # Moves very slowly (elderly)
      tick_interval: 150000
      phases:
        - day
components:
  combatant:
    health: { current: 15, max: 15 }
    stats: { str: 4, dex: 6, sta: 8 }
    level: 1
  ambient_actions:
    messages:
      - "The old woman adjusts her shawl."
      - "She gazes at the shrine with misty eyes."
      - "The woman's lips move in silent prayer."
    interval_min: 70
    interval_max: 120
    chance: 0.25
```

### Movement Speed by Character Type

| Character Type | move_chance | tick_interval | Feel |
|----------------|-------------|---------------|------|
| Cat, dog | 0.25-0.35 | 45-60s | Active, curious |
| Adult human | 0.15-0.25 | 60-90s | Purposeful |
| Elderly | 0.05-0.15 | 120-180s | Slow, deliberate |
| Child | 0.30-0.40 | 30-45s | Energetic |

### Layering Ambient Effects

Combine multiple systems for rich atmosphere:

1. **Room ambient** - Base atmosphere ("Incense drifts...")
2. **Weather** - Dynamic conditions ("Rain patters on the roof...")
3. **NPC ambient** - Character activities ("The monk meditates...")
4. **NPC movement** - Characters coming and going
5. **Time of day** - Different feel at different times

## Common Mistakes

### Don't: Over-frequent Messages

```yaml
# BAD - Too spammy
interval: 5000  # Every 5 seconds!
```

```yaml
# GOOD - Natural pacing
interval: 45000  # Every 45 seconds
```

### Don't: Generic Messages

```yaml
# BAD - Could be anyone
messages:
  - "The NPC does something."
  - "They stand there."
```

```yaml
# GOOD - Character-specific
messages:
  - "Dorje polishes a jade figurine with a soft cloth."
  - "The merchant mutters calculations under his breath."
```

### Don't: Breaking Character

```yaml
# BAD - Monk acting out of character
messages:
  - "The monk counts his gold greedily."  # Monks shouldn't be greedy!
```

```yaml
# GOOD - Consistent with role
messages:
  - "The monk fingers his prayer beads thoughtfully."
```

### Don't: Ignoring Context

```yaml
# BAD - Combat area with peaceful messages
# (in a dungeon room)
messages:
  - "Birds chirp happily outside."  # No birds in a dungeon!
```

## Validation

Run `mix loka.test.validate` to check:
- Ambient actions format
- Room connectivity for wandering NPCs
- Phase names are valid

## Sample NPCs

### Temple Cat

```yaml
key: temple_cat
type: npc
parent: base_npc
short_desc: "Temple Cat"
long_desc: "A sleek grey cat with knowing amber eyes lounges nearby."
keywords: [cat, feline, temple]
primary_keyword: cat
tags: [friendly, animal, atmosphere, sacred]
behaviors:
  - Loka.Behaviors.Wander
attributes:
  behavior_config:
    wander:
      allowed_rooms:
        - main_courtyard
        - temple
        - meditation_hall
        - dining_hall
        - monastery_gate
      move_chance: 0.25
      tick_interval: 90000
      phases:
        - day
        - dusk
      idle_messages:
        - "The temple cat watches you with half-closed eyes."
components:
  ambient_actions:
    messages:
      - "The temple cat stretches luxuriously in a patch of sunlight."
      - "The grey cat grooms her paw with meticulous care."
      - "The cat's ears swivel, tracking some sound only she can hear."
      - "The temple cat curls into a tight ball, tucking her nose under her tail."
      - "The cat yawns, revealing tiny sharp teeth."
      - "The grey cat blinks slowly at you - a feline gesture of trust."
    interval_min: 30
    interval_max: 60
    chance: 0.5
  combatant:
    health: { current: 15, max: 15 }
    stats: { str: 3, dex: 18, sta: 6 }
    level: 1
```

### Wandering Pilgrim

```yaml
key: wandering_pilgrim
type: npc
parent: base_npc
short_desc: "Wandering Pilgrim"
long_desc: "An elderly pilgrim in dusty robes walks with the slow certainty of faith."
keywords: [pilgrim, elder, traveler]
primary_keyword: pilgrim
tags: [friendly, traveler, sacred, atmosphere]
behaviors:
  - Loka.Behaviors.Wander
attributes:
  behavior_config:
    wander:
      allowed_rooms:
        - monastery_gate
        - main_courtyard
        - temple
        - waterfall_shrine
        - village
        - cliff_path
      move_chance: 0.2
      tick_interval: 120000
      phases:
        - dawn
        - day
      idle_messages:
        - "The pilgrim's lips move in silent prayer."
components:
  ambient_actions:
    messages:
      - "The pilgrim fingers her prayer beads, whispering mantras."
      - "The elderly woman pauses to catch her breath, smiling peacefully."
      - "The pilgrim touches a carved stone with reverent fingers."
      - "A soft chant drifts from the pilgrim's lips."
      - "The pilgrim adjusts her dusty robes with practiced ease."
      - "The elderly pilgrim gazes at the mountains with quiet wonder."
    interval_min: 30
    interval_max: 60
    chance: 0.5
  combatant:
    health: { current: 35, max: 35 }
    stats: { str: 5, dex: 8, sta: 12 }
    level: 2
```

### Sweeping Monk

```yaml
key: sweeping_monk
type: npc
parent: base_npc
short_desc: "Sweeping Monk"
long_desc: "A monk in simple robes sweeps devotedly with a worn bamboo broom."
keywords: [monk, sweeper, brother]
primary_keyword: monk
tags: [friendly, monk, atmosphere]
behaviors:
  - Loka.Behaviors.Wander
attributes:
  behavior_config:
    wander:
      allowed_rooms:
        - main_courtyard
        - meditation_hall
        - monastery_gate
      move_chance: 0.15
      tick_interval: 120000
      idle_messages:
        - "The monk pauses to wipe sweat from their brow."
components:
  ambient_actions:
    messages:
      - "The monk sweeps methodically, finding peace in the rhythm."
      - "Dust motes swirl in the light as the monk works."
      - "The monk hums a low chant while sweeping."
      - "The bamboo broom whispers against the stone floor."
      - "The monk pauses to adjust their grip on the worn handle."
    interval_min: 40
    interval_max: 80
    chance: 0.5
  combatant:
    health: { current: 25, max: 25 }
    stats: { str: 8, dex: 10, sta: 10 }
    level: 2
```

## Related Documentation

- **NPC Reference**: `docs/reference/npc-reference.md` - Full NPC YAML schema
- **Room Reference**: `docs/reference/room-reference.md` - Room ambient config
- **Behaviors**: `docs/framework/behaviors.md` - All NPC behaviors
- **Day/Night Cycle**: `lib/loka/framework/world/time.ex` - Time system
- **Weather**: `lib/loka/framework/world/weather.ex` - Weather events
