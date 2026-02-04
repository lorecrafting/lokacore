# Seedship Forest - Geography & Zones

> This file covers the physical layout of the Grove: zones, rooms, sensory design, and the map.

---

## The Grove Map

```
                         THE EDGES (forbidden)
                    ┌─────────────────────────────┐
                    │      ░░░░░░░░░░░░░░░░░      │
                    │   ░░░  THE THINNING  ░░░    │
                    │  ░░░░░░░░░░░░░░░░░░░░░░░    │
        ┌───────────┼────────────┬────────────────┤
        │           │            │                │
        │  WESTERN  │   THE      │    EASTERN     │
        │  GROVES   │   DEEP     │    GROVES      │
        │           │  (ancient) │                │
        │   ┌───────┼────────────┼───────┐        │
        │   │       │            │       │        │
        │   │    THE HEARTWOOD   │       │        │
        │   │    ┌──────────┐    │       │        │
        │   │    │ Central  │    │       │        │
        │   │    │ Clearing │    │       │        │
        │   │    └──────────┘    │       │        │
        │   │         │          │       │        │
        │   │    ┌────┴────┐     │       │        │
        │   │    │ The     │     │       │        │
        │   │    │ Spring  │     │       │        │
        │   │    └─────────┘     │       │        │
        │   └────────────────────┘       │        │
        │                                │        │
        │        THE UNDERSTORY          │        │
        │        (streams, paths)        │        │
        │                                │        │
        └────────────────────────────────┴────────┘
                    │                    │
                    │   THE ROOTS        │
                    │   (below ground)   │
                    │   [SEALED]         │
                    └────────────────────┘
```

---

## Zone Breakdown

| Zone | Description | What's There | Story Purpose |
|------|-------------|--------------|---------------|
| **The Heartwood** | Central settlement, communal clearing | Elder Hall, dwellings, the Spring, gathering areas | Hub, most NPCs, safety |
| **The Western Groves** | Cultivated forest, orchards | Shapers work here, food trees, gentle | Early exploration, gathering quests |
| **The Eastern Groves** | Wilder growth, less tended | Animals, Gatherers, more unpredictable | Mid exploration, companion bonding |
| **The Understory** | Network of streams and paths | Connecting routes, quiet spots | Travel, quiet moments |
| **The Deep** | Ancient trees, dark, sacred | Oldest growth, Rootspeaker shrine | Mystery, companion's visions |
| **The Thinning** | Where trees grow sparse, strange | Sick trees, odd light, edge effects | Clues to the truth |
| **The Edges** | FORBIDDEN - where forest ends | Walls? Machinery? The membrane? | Major revelation zone |
| **The Roots** | Tunnels beneath the Grove | Ship systems, sealed chambers | Endgame reveals |

---

## Sensory Design (Per Zone)

| Zone | Sounds | Light | Smell | Feel |
|------|--------|-------|-------|------|
| **Heartwood** | Voices, crackling fire, gentle hum | Warm, dappled sunlight | Cooking, flowers | Safe, communal |
| **Western Groves** | Birdsong, rustling, work sounds | Bright, open | Fruit, fresh growth | Productive, peaceful |
| **Eastern Groves** | Animal calls, wind, distant water | Shifting, shadowed | Earth, wild plants | Alert, alive |
| **The Deep** | Near silence, deep resonance | Dim, bioluminescent | Ancient, moss | Sacred, heavy |
| **The Thinning** | Wrong sounds, static, echoes | Flickering, harsh | Metallic hints | Unsettling |
| **The Edges** | Hum of machinery, your heartbeat | Artificial, cold | Recycled air | Forbidden, true |
| **The Roots** | Pulses, flowing, ship sounds | Bioluminescent veins | The ship's breath | Alive, different |

---

## Room Count Target

| Zone | Rooms | Priority |
|------|-------|----------|
| **Heartwood** | 8-10 | FIRST - Build this |
| **Western Groves** | 5-7 | FIRST - Early content |
| **Eastern Groves** | 5-7 | SECOND |
| **The Understory** | 4-6 | SECOND |
| **The Deep** | 4-5 | SECOND - Companion arc |
| **The Thinning** | 3-4 | THIRD - Mid revelation |
| **The Edges** | 2-3 | THIRD - Major reveal |
| **The Roots** | 3-5 | FOURTH - Endgame |
| **TOTAL** | ~35-45 | |

---

## Ecology (Flora and Fauna)

### Flora Behaviors

| Plant Type | Behavior | Script |
|------------|----------|--------|
| **Pale blue flowers** | Lean toward Rootspeakers, especially Thera | Proximity check, emote |
| **Heartroot tendrils** | Pulse visibly, glow intensifies with emotion | Tied to Pulse state |
| **Canopy trees** | Leaves rustle with Pulse rhythm | Ambient room description |
| **Blight-touched trees** | Leaves curl, bark darkens | Room state change |
| **New growth** (post-landing) | Emerges along old Blight lines | Spawn on landing trigger |

### Fauna Behaviors

| Creature | Normal | Stressed | Crisis |
|----------|--------|----------|--------|
| **Birds** | Singing, flying | Quieter, clustered | Silent, gone |
| **Small animals** | Foraging, visible | Hiding, rare | Fled to Deep |
| **Insects** | Buzzing, active | Erratic | Dead/dormant |

### Ecology Script

```
on_pulse_change(new_state):
  if new_state == "stressed":
    reduce_fauna_spawn_rate(50%)
    change_bird_emotes("anxious")
  if new_state == "erratic":
    despawn_most_fauna()
    add_room_description("The forest is silent. No birds sing.")
```

---

## Atmospheric Events

### Ambient Events (Random)

| Event | Frequency | Description |
|-------|-----------|-------------|
| **Wind through canopy** | Common | Gentle rustling, leaves fall |
| **Bird call exchange** | Common | Two birds calling to each other |
| **Stream sounds** | When near water | Gurgling, splashing |
| **Pulse intensification** | Occasional | The ground hums stronger for a moment |
| **Sky flicker** | Rare (increasing) | The light stutters |

### Story-Triggered Events

| Event | Trigger | Description |
|-------|---------|-------------|
| **Blight spread** | Act progression | New sick trees appear |
| **NPC convergence** | Council called | All head to Elder Hall |
| **Memorial placing** | Post-landing | NPCs leave flowers at statue |
| **New growth emergence** | Post-landing | Seedlings in Blight scars |
