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

---

## The Dual Nature: Ship Architecture Hidden as Forest

> **This is the most important design constraint for all room writing.**
> Every room is designed as a ship location first, then described as forest.
> The player must never know until Act 3. In retrospect, every detail must click.

### The Design Rule

Every room needs three things written before any description is drafted:

1. **Ship reality** — what this space actually is functionally on the ship
2. **Surface description** — what Tenders (who have lived here 200 years) perceive and would naturally describe
3. **The tell** — ONE specific detail in the room description that will feel obvious in retrospect, but completely natural before the reveal

The tell must be:
- Natural enough that residents have a comfortable explanation for it
- Specific enough that it reads "ship" in retrospect
- Present in the initial room description — never added later

### The Ship Architecture Map

The Tenders' cosmology perfectly describes real ship systems they don't know exist:

| Tender Concept | Ship Reality |
|----------------|--------------|
| The Pulse | Engine rhythm — the drive systems' vibration |
| The Rootsong | Ship's data network — Lira's consciousness communicating |
| The Three Roots | Three primary systems: life support, propulsion, consciousness |
| Rootspeakers | People biologically attuned to the ship's interface systems |
| "The Grove" | The ship (named after what they thought it was) |
| The Heartroot | The consciousness node — where Lira actually lives |
| The Blight | Hull membrane failure — biological skin deteriorating along a seam |

Everything they believe is real. Just more literal than they know.

---

### Room-by-Room Dual Nature Guide

Use this when writing room descriptions for Phase 1. The "tell" must appear in the description from day one.

---

#### `awakening_clearing` — The Clearing

| | |
|---|---|
| **Ship reality** | Maintenance access bay — deliberately kept clear for hull inspection |
| **Surface** | Soft forest floor, dappled light, fog, smell of leaves, gentle disorientation |
| **The tell** | The clearing is a perfect oval. The roots around its edge form a precise border. The earth is unusually level and firm — packed, not natural. |
| **Post-reveal line** | *"You realize now — this clearing was designed. Someone made sure nothing would grow here."* |

---

#### `healing_grove` — Thera's Healing Grove

| | |
|---|---|
| **Ship reality** | Climate-controlled medical bay. The stream is the water reclamation system. Herbs grow in optimized arrangements. |
| **Surface** | Thera's workspace — herbs drying, a small stream, warm air, soft moss, the smell of medicine |
| **The tell** | The temperature is always perfect here even when Tenders complain of cold elsewhere. The stream never lowers despite no rainfall. The herbs grow in rows Thera didn't plant. |
| **Post-reveal line** | *"The herbs always grew in rows. Not because Thera planted them — because the system arranged them for optimal extraction."* |

---

#### `heartwood` — The Heartwood

| | |
|---|---|
| **Ship reality** | Structural core. The great trees are biological load-bearing columns. The warmth is thermal bleed from drive systems below. |
| **Surface** | The main settlement — massive ancient trees, communal spaces, warm light, the sound and smell of community |
| **The tell** | Every tree spirals in the same direction. Their bark is warm to the touch even in shadow. They are impossibly large for their species. |
| **Post-reveal line** | *"You pressed your hand to the tree and felt warmth. You thought it was sunlight stored in bark. It wasn't."* |

---

#### `lira_memorial` — Lira's Memorial

| | |
|---|---|
| **Ship reality** | Interface node — the place where Lira's consciousness is most accessible. She tends the flowers herself. |
| **Surface** | A peaceful clearing, carved stone statue, offerings, always-fresh flowers, a quality of expectant silence |
| **The tell** | The flowers are always fresh. No one tends them. The air here feels different — not peaceful exactly, but *attentive*. |
| **Post-reveal line** | *"She's been placing fresh flowers on her own memorial for two hundred years."* |

---

#### `tender_fields` — The Tending Fields

| | |
|---|---|
| **Ship reality** | Managed biological food production. The ship ensures perfect yields. Tenders maintain the system without knowing it. |
| **Surface** | Worked fields, crop rows, Tenders with tools, the satisfaction of physical labor |
| **The tell** | Perfect yields, every season. No blights (until the larger Blight began), no droughts. The soil never depletes despite no fertilization. |
| **Post-reveal line** | *"Two hundred years of farming the same soil without ever depleting it. Not natural. Never natural."* |

---

#### `blight_zone` — The Dying Trees

| | |
|---|---|
| **Ship reality** | Hull membrane failure along a seam. Biological skin deteriorating. |
| **Surface** | Trees dying — leaves curling and blackening, bark splitting, Kira looking worried |
| **The tell** | The dying follows a perfectly straight line, then turns at a right angle. Organic rot doesn't work this way. |
| **Post-reveal line** | *"The Blight followed the seam. A hull seam. Two hundred years old and finally failing."* |

---

#### `brennan_path` — The Edge Patrol Path

| | |
|---|---|
| **Ship reality** | An inspection corridor along the inner hull. Trees planted to line it. Brennan runs diagnostics without knowing it. |
| **Surface** | A well-worn path through forest, Brennan walking his nightly circuit |
| **The tell** | The path is perfectly straight despite the natural forest. Trees on either side are equally spaced. Brennan traces his fingers along certain trees as he walks — checking something he couldn't name. |
| **Post-reveal line** | *"He was running diagnostics. He didn't know it. The ship had trained a man to inspect itself."* |

---

#### `deep_threshold` — The Deep Threshold

| | |
|---|---|
| **Ship reality** | Transition into the engine/processing section. The hum is the drive. Rootspeakers feel high system activity as "wrongness." |
| **Surface** | A boundary — the forest changes here. Darker, closer together, the air different, a low unease |
| **The tell** | There is a hum here you feel in your teeth, not hear. The temperature rises slightly. Thera refuses to cross: *"Too loud for me."* |
| **Post-reveal line** | *"The engine room. The hum was always the engine. Thera could hear it because she was made to."* |

---

#### `the_deep` — The Deep

| | |
|---|---|
| **Ship reality** | Primary biological computing substrate. Trees ARE neural pathways. Roots are processing nodes. Warmth is computation heat. |
| **Surface** | Enormous ancient trees, dim bioluminescent light, near-sacred silence, the Rootsong overwhelming |
| **The tell** | Trees bigger than physics allows for their species. Bark covered in geometric patterns — too regular, like circuit traces. Ground warm to the touch with no sun source. |
| **Post-reveal line** | *"Roots processing two hundred years of memory. Every whisper of the Rootsong was data. Lira thinking."* |

---

#### `the_thinning` — The Thinning

| | |
|---|---|
| **Ship reality** | Approaching the outer hull. Biological systems sparse by design, giving way to structural membrane. |
| **Surface** | Trees growing sparse, light harsher and more even, ground firmer underfoot, a sense of exposure |
| **The tell** | The trees thin in a mathematically perfect gradient — not randomly. The light is too even. The ground stops being soil and starts being something that looks like soil but isn't. |
| **Post-reveal line** | *"You had thought the trees just... ran out. They stop where the hull begins. They always stopped there."* |

---

#### `the_edge` — The Edge / The Membrane

| | |
|---|---|
| **Ship reality** | Inner surface of the ship's hull. The membrane is the outer skin. The viewport is a real viewport into space. |
| **Surface** | Where "sky" curves down to ground level, strange reflective quality, a visible seam, a sense of forbidden |
| **The tell** | Up close, the sky has a seam where it meets the ground. It reflects your face faintly. When it flickers, the light is clearly not sunlight — it stutters like a system fault. |
| **Post-reveal line** | *"Of course it was a seam. Of course the sky had a seam."* |

---

#### `elder_hall` — The Elder Hall

| | |
|---|---|
| **Ship reality** | Designed command/communication space. Acoustics engineered. Floor markings are navigation coordinates and status readouts. |
| **Surface** | Formal meeting space, great trees arching overhead, perfect acoustics, floor markings treated as decorative tradition |
| **The tell** | The acoustics are perfect — every word carries without echo. The floor markings are too geometric for decoration. Elders always sit in the same positions, as if drawn there. |
| **Post-reveal line** | *"The circle on the floor is a status display. Elder Maren sat directly above the consciousness node every time."* |

---

#### `small_grove` — The Small Grove

| | |
|---|---|
| **Ship reality** | Junction point in the ship's biological network — the Pulse is strongest here. Thera found a power node and made it her sanctuary. |
| **Surface** | Thera's secret place — tiny, beautiful, flowers leaning toward her presence, the Pulse noticeably stronger |
| **The tell** | The flowers lean toward Thera in a way flowers don't. She found this place as a child and always felt drawn back. |
| **Post-reveal line** | *"She built her sanctuary on a power junction. The ship chose the same spot she did."* |

---

#### `heartroot_chamber` — The Heartroot Chamber

| | |
|---|---|
| **Ship reality** | The ship's consciousness center. The Heartroot IS Lira — her physical substrate. This is where she lives and processes. |
| **Surface** | A vast underground chamber, ancient root system at the center, pulsing soft light, the Rootsong overwhelming |
| **The tell** | The roots branch in mathematical progressions — too regular. The light pulses in rhythm. The whole chamber is warm. It feels like being inside something alive, something that knows you're there. |
| **Post-reveal line** | *"A brain. Neurons. She'd been living in Lira's mind the whole time. The Rootsong was thought."* |
