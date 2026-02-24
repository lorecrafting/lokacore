# NPC Behaviors

Making NPCs feel alive through behaviors and emotes.

## Behavior System

Behaviors are reusable components that give NPCs life.

```yaml
key: grove_guardian
type: npc
name: Grove Guardian
description: |
  A weathered face beneath a simple hood. Her staff shows years of use.

behaviors:
  - script: patrol
    config:
      route: [awakening_clearing, heartwood_grove_path, gathering_circle]
      interval: 180

  - script: day_night_schedule
    config:
      wake_at: dawn
      sleep_at: dusk

emotes:
  waking_up: "*stretches and begins morning exercises*"
  patrol_arrive: "*scans the area with quiet vigilance*"
  going_to_sleep: "*sets staff beside mat* May the night be peaceful."
```

## Available Behaviors

### patrol

NPC moves between locations on schedule.

```yaml
- script: patrol
  config:
    route: [location_1, location_2, location_3]
    interval: 180  # seconds between moves
    pause_at: location_2  # optional: longer pause
    pause_duration: 60
```

### day_night_schedule

NPC wakes and sleeps based on time.

```yaml
- script: day_night_schedule
  config:
    wake_at: dawn      # dawn, morning, noon, afternoon, evening, dusk, night, midnight
    sleep_at: dusk
    sleep_room: barracks  # optional: where they go to sleep
```

### wander

NPC moves randomly within an area.

```yaml
- script: wander
  config:
    home_room: village_square
    radius: 2  # rooms from home
    interval: 120
    avoid_tags: [dangerous, private]
```

### shopkeeper_hours

Merchant available only during hours.

```yaml
- script: shopkeeper_hours
  config:
    open_at: morning
    close_at: evening
    closed_message: "The shop is closed. Come back tomorrow."
```

### ambient_emitter

Periodically displays emotes.

```yaml
- script: ambient_emitter
  config:
    emotes:
      - "*polishes a glass*"
      - "*glances out the window*"
      - "*hums a quiet tune*"
    interval: 45
    variance: 15  # random +/- seconds
```

### nocturnal

Active only at night.

```yaml
- script: nocturnal
  config:
    active_start: dusk
    active_end: dawn
    inactive_message: "*curled up asleep, not to be disturbed*"
```

### spawn_condition_time

NPC only exists during certain times.

```yaml
- script: spawn_condition_time
  config:
    spawn_at: midnight
    despawn_at: dawn
    spawn_message: "A figure emerges from the shadows."
    despawn_message: "The figure fades as light touches the eastern sky."
```

## Emotes

Emotes are personality text triggered by events.

### Emote Triggers

| Trigger | When Fired |
|---------|------------|
| `idle` | Random while in room |
| `player_enter` | Player enters room |
| `player_leave` | Player leaves room |
| `waking_up` | Day begins (with schedule) |
| `going_to_sleep` | Day ends (with schedule) |
| `patrol_arrive` | Arrives at patrol point |
| `combat_start` | Combat begins |
| `low_health` | HP below threshold |
| `victory` | Wins combat |
| `item_received` | Player gives item |

### Emote Examples by Character Type

**The Nervous Scholar**
```yaml
emotes:
  idle:
    - "*adjusts spectacles and squints at a page*"
    - "*mutters calculations under breath*"
    - "*startles at a sound, then relaxes*"
  player_enter: "*looks up, blinking* Oh! I didn't hear you."
  player_leave: "*already absorbed in reading again*"
```

**The Gruff Veteran**
```yaml
emotes:
  idle:
    - "*sharpens blade with practiced strokes*"
    - "*stares at the fire, lost in memory*"
  player_enter: "*glances up, assessing* Hmm.
  combat_start: "Finally. Something to do."
  low_health: "*spits blood* Not done yet."
```

**The Cheerful Merchant**
```yaml
emotes:
  idle:
    - "*rearranges display for the fifth time*"
    - "*polishes something that doesn't need polishing*"
    - "*hums a jaunty tune*"
  player_enter: "*beams* A customer! Welcome, welcome!"
  player_leave: "Come back soon! Tell your friends!"
```

## Layering Behaviors

Combine behaviors for complex NPCs.

```yaml
# The Restless Guard
behaviors:
  - script: patrol
    config:
      route: [east_gate, watchtower, west_gate]
      interval: 300

  - script: day_night_schedule
    config:
      wake_at: dawn
      sleep_at: midnight  # Long shifts

  - script: ambient_emitter
    config:
      emotes:
        - "*scans the treeline*"
        - "*shifts weight from foot to foot*"
        - "*touches sword hilt, as if checking it's there*"
      interval: 60

emotes:
  waking_up: "*splashes face with cold water* Another day."
  going_to_sleep: "*collapses onto cot without removing boots*"
  player_enter: "*hand moves to weapon, then relaxes* State your business."
```

## Movement Speed by Type

| Character Type | Speed | Reasoning |
|----------------|-------|-----------|
| Child | Fast | Energetic, impatient |
| Elder | Slow | Measured, deliberate |
| Guard | Medium | Alert but patient |
| Merchant | Slow | Stopping to chat |
| Animal | Variable | Species-dependent |
| Ethereal | Very slow | Otherworldly presence |

## World Time Integration

NPCs respond to time of day.

```yaml
# Different emotes at different times
emotes:
  idle_morning: "*yawns and sips tea*"
  idle_afternoon: "*wipes sweat from brow*"
  idle_evening: "*stretches tired muscles*"
  idle_night: "*keeps one hand on lantern*"
```

## Common Patterns

### The Busy Worker

```yaml
behaviors:
  - script: ambient_emitter
    config:
      emotes:
        - "*sweeps the floor*"
        - "*wipes down the counter*"
        - "*checks supplies*"
        - "*pauses to catch breath*"
      interval: 30
```

### The Watchful Guardian

```yaml
behaviors:
  - script: patrol
    config:
      route: [post_1, post_2, post_3, post_1]
      interval: 240

  - script: ambient_emitter
    config:
      emotes:
        - "*scans the perimeter*"
        - "*listens intently*"
      interval: 45
```

### The Social Butterfly

```yaml
behaviors:
  - script: wander
    config:
      home_room: village_square
      radius: 3
      interval: 180

  - script: ambient_emitter
    config:
      emotes:
        - "*waves to a passerby*"
        - "*stops to chat with a neighbor*"
        - "*laughs at something someone said*"
      interval: 40
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Same emote for all NPCs | Personalized per character |
| Too frequent emotes | 30-60 second minimum |
| Breaking character | Emotes match personality |
| Only positive emotes | Include frustration, fatigue |
| Static important NPCs | Even quest givers have life |
