# Seedship Forest - Systems

> This file covers the game systems: The Pulse, the Blight, the Nine Sectors, healing philosophy, and companion sensing.

---

## The Pulse (Central Mechanic)

The Pulse is the ship's living resonance. Like a planetary electromagnetic field or a vast organism's circulatory rhythm, it permeates everything aboard. The Tenders feel it without understanding it. Rootspeakers can read it like a language.

### Pulse Characteristics

The Pulse is not emotional. It is biological, rhythmic, measurable.

| Aspect | Description |
|--------|-------------|
| **Rhythm** | A slow, deep oscillation felt through the ground and in the chest |
| **Strength** | How clearly the resonance carries (strong near Heartroot, weaker at Edges) |
| **Coherence** | How regular and steady the rhythm is (healthy = coherent, failing = erratic) |
| **Frequency** | The base rate of oscillation (varies with ship state) |

### Pulse Phases

| Phase | Frequency | Coherence | Strength | When |
|-------|-----------|-----------|----------|------|
| **Deep rest** | Very slow | High | Moderate | Night, meditation |
| **Baseline** | Slow | High | Strong | Normal operation |
| **Elevated** | Moderate | High | Strong | Activity, growth periods |
| **Irregular** | Variable | Low | Fluctuating | Systems under strain |
| **Rapid** | Fast | Moderate | Intense | Approaching destination |
| **Erratic** | Chaotic | Very low | Surging/fading | Critical failure |
| **Stillness** | None | N/A | Fading | Post-landing transition |

### What the Pulse Is NOT

- Not a voice (that is the Rootsong, which Rootspeakers hear through the Pulse)
- Not an emotion (it does not "feel" angry or sad)
- Not magic (it is the ship's living systems made perceptible)

### Pulse vs Rootsong

| Aspect | The Pulse | The Rootsong |
|--------|-----------|--------------|
| **What it is** | Physical resonance, rhythm | Information carried within the Pulse |
| **Who feels it** | Everyone (faintly) | Rootspeakers only |
| **Nature** | Biological, measurable | Voice-like, meaningful |
| **Can be overwhelming** | Intensity can be disorienting | Information flood can be devastating |
| **Beat 66** | Pulse surges erratically | Rootsong floods with 200 years of memory |

---

## Reading the Pulse (Gameplay System)

> **Design Note**: This system encodes traditional pulse diagnosis concepts into gameplay. Players learn to read qualities and apply remedies without being told the source tradition. The Six Qi energies (Wind, Heat, Dampness, Dryness, Fire, Cold) manifest as sensory qualities. The 70/30 healing philosophy ensures players don't "fix" but "support."

### The Synchronization Principle

Before manipulating the Pulse, one must first synchronize with it. This is Thera's core teaching:

```yaml
thera_synchronization_teaching:
  context: Phase 4 - First teaching session
  dialogue: |
    "Close your eyes. Feel the Pulse beneath you.
    Don't try to change it. Just feel it.

    Match your breathing to it. In... out... in... out...

    Good. Now - only now - can you ask it a question.
    You cannot hold what you have not joined."
```

**Gameplay**: Players must "sync" before reading. Rushing produces inaccurate results. This teaches patience and connection before action.

### Pulse Qualities (Six Qi Correspondences)

The qualities Rootspeakers sense map to the ancient Six Qi energies, though players learn them through experience rather than names:

| Quality | What It Feels Like | Six Qi | What It Indicates | Remedy Activities |
|---------|-------------------|--------|-------------------|-------------------|
| **Floating/Unsettled** | Movement without ground, restless | Wind (풍) | Energy moving wrong, circulation disrupted | Ground it - add stability, shelter, anchoring |
| **Hot/Intense** | Bead-like, sharp, urgent | Heat (서) | Inflammation, excess activity | Cool it - shade, water, clearing |
| **Damp/Heavy** | Sluggish, waterlogged, sticky | Dampness (습) | Stagnation, blocked drainage | Move it - clear channels, prune, open flow |
| **Dry/Brittle** | Thin, papery, fragile, empty | Dryness (조) | Moisture depleted, exhaustion | Nourish it - water deep, add substance, mulch |
| **Rolling/Urgent** | Fast, intense, consuming | Fire (열) | Crisis state, active destruction | Slow it - rest, coolness, gentle intervention |
| **Tight/Cold** | Tense, constricted, near-silent | Cold (한) | Shutdown, near death, frozen | Warm it - slow heat, patience, presence |
| **Scattered/Diffuse** | Unfocused, everywhere and nowhere | (Combined) | Energy dispersed, system failing | Center it - prune edges, strengthen core |
| **Deep/Muffled** | Hard to reach, buried | (Root level) | Problem in constitutional layer | Go deep - work toward center, address causes |

**Design Note**: Players learn these through Thera's teaching and direct experience. The Six Qi names are NEVER used explicitly - just the felt qualities.

### Taking the Pulse (Player Action)

```
> take pulse

You kneel and place your palm on the forest floor. You breathe slowly,
letting your awareness sink into the rhythm beneath.

The Pulse feels... damp. Heavy. Like water pooling where it should flow.
Somewhere in the western groves, something is blocked.
```

### Remedy Quests

When players identify a quality, activities become available:

| Quality Detected | Available Activities |
|------------------|---------------------|
| **Damp** | Clear fallen debris from stream, prune choking vines, dig drainage |
| **Dry** | Carry water to the Thinning, plant deep-rooted species, create shade |
| **Congested** | Thin overgrown areas, separate tangled roots, create clearings |
| **Weak** | Gather compost materials, plant companions, make offerings at Heartroot |
| **Scattered** | Build focus structures (cairns, circles), strengthen central plantings |
| **Tight** | Find blockage (fallen tree, root knot), clear it, massage the area |

### Pulse Perception by Character Type

| Character Type | What They Perceive |
|----------------|-------------------|
| **Normal Tender** | Faint rhythm underfoot, sense of "rightness" or unease |
| **Rootspeaker** | Clear rhythm, can sense coherence/strength, location of disturbances |
| **Trained Player** | Learns to feel it (after Phase 4 teaching), basic awareness |
| **Lira/Thera** | The Rootsong carried within the Pulse, memories, presence |

### Pulse and Story Progression

| Story Phase | Pulse State | What Players Notice |
|-------------|-------------|---------------------|
| **Act 1** | Baseline, occasionally irregular | "Something feels off sometimes" |
| **Act 2** | More frequent irregularity | Coherence dropping, NPCs comment |
| **Act 3** | Rapid, erratic spikes | Intense surges, hard to ignore |
| **Beat 66** | Massive surge | Overwhelming resonance (not screaming, just TOO MUCH) |
| **Landing** | Stillness, then transformation | Pulse fades, then becomes planetary |

---

## The Blight System

The Blight is the ship's failing systems made visible. It progresses over story time following a diagnostic pattern: each stage flows naturally into the next, like seasons of disease.

### The Six Qi Progression (Hidden Pattern)

The Blight follows an ancient pattern of disease progression. The Tenders don't name it this way, but observant players will notice the cascade:

| Qi Stage | What's Happening | How NPCs Describe It |
|----------|------------------|---------------------|
| **Wind (풍)** | Energy moving where it shouldn't | "The trees sway when there's no breeze. Something's stirring." |
| **Heat (서)** | Inflammation, excess activity | "The bark glows wrong. Like fever in the wood." |
| **Dampness (습)** | Stagnation begins | "The sap won't flow. Everything feels... stuck." |
| **Dryness (조)** | Exhaustion, depletion | "The leaves crumble like old paper. No life left." |
| **Fire (열)** | Crisis, active destruction | "The Blight burns through. Whole groves, gone in days." |
| **Cold (한)** | Shutdown, near death | "The Pulse is silent there. Like the ground forgot how to breathe." |

**Design Note**: This progression teaches players that disease moves in stages. Attack in one area leads to hurt in the next.

### Blight Stages

| Stage | Visual | Rooms Affected | Pulse Effect | Qi Correspondence |
|-------|--------|----------------|--------------|-------------------|
| **Stage 0** | None | None | Baseline, coherent | — |
| **Stage 1** | Single sick trees | Edge zones only | Occasional irregularity | Wind (movement wrong) |
| **Stage 2** | Trees in lines | Thinning zones | Frequent irregularity | Heat (fever-bark) |
| **Stage 3** | Dead patches | Spreading inward | Rapid, losing coherence | Dampness → Dryness |
| **Stage 4** | Major zones affected | Half the Grove | Erratic, surging | Fire (active crisis) |
| **Stage 5** | Critical | Approaching Heartwood | Chaotic, fading | Cold (silence) |
| **REVERSED** | New growth in old lines | All zones | Stillness, then planetary | Renewal |

### Seasonal Dialogue (NPC Teaching)

```yaml
elder_teaching_blight:
  speaker: Elder Maren
  dialogue: |
    "The sickness came in spring - strange winds through the eastern grove.
    Energy moving where it shouldn't. Then summer brought the fevers -
    the bark glowing wrong, too bright, too hot.

    Now autumn comes, and where the fever was worst... the branches
    turn to dust. If we cannot act before winter, those zones will
    go silent. The cold silence is the last stage.

    But you see - each stage calls the next. Wind invites heat.
    Heat burns into dryness. Dryness welcomes cold. The old healers
    knew: you must catch it early, or the cascade cannot be stopped."
```

---

## The Tender's Healing Philosophy

The Tenders have ancient wisdom about healing that shapes all their work.

### The 70/30 Rule (Coexistence)

The core healing principle: **Never force perfection. Leave room for the Grove to heal itself.**

| Principle | What It Means | Gameplay Expression |
|-----------|---------------|---------------------|
| **Tonify, don't sedate** | Strengthen the body rather than fight the problem | Healing quests add support, not attack disease |
| **70/30 balance** | Give seven parts effort, leave three for natural healing | Overcomplete remedies have diminishing returns |
| **Coexistence** | Disease is not an enemy but an imbalance | The Blight isn't evil - it's the ship dying |

### Teaching Dialogue

```yaml
rootspeaker_wisdom:
  speaker: Thera
  context: Teaching player about healing
  dialogue: |
    "When I listen to the Rootsong, I hear not just what is sick,
    but what the Grove is already doing to heal. My job is not
    to replace its work - but to amplify it.

    The old healers said: 'Nobody has too much energy. What looks
    like excess is just energy in the wrong place.' So we don't
    fight the excess. We redirect it. We strengthen what's weak.

    That's why the Blight can't be cured by force. The ship isn't
    fighting an invader. It's exhausted. It needs support, not war."
```

### Why This Matters (Thematic)

The 70/30 philosophy prepares players to understand Thera's sacrifice:
- She doesn't "fight" for the ship - she joins it
- She doesn't "fix" the problem - she becomes the solution
- The Heart doesn't sedate the ship's pain - it tonifies its ability to land

---

## The Nine Sectors (Ship Anatomy)

The seedship has nine major systems that Rootspeakers learn to diagnose.

### The Three Jiao (Vertical Divisions)

| Jiao | Ship System | Location | Function | What You Feel There |
|------|-------------|----------|----------|---------------------|
| **Upper Jiao (Sky)** | Sky-membrane | Canopy/ceiling | Light input, atmosphere, protection | Air tastes different - thinner, sharper. Light has weight. |
| **Middle Jiao (Forest)** | Tree-network | Forest itself | Processing, circulation, life support | The Pulse is loudest here. Warmth moves through everything. |
| **Lower Jiao (Deep)** | Ground-substrate | Below ground | Waste, recycling, foundation | Cool and still. Sounds arrive muffled. Time feels slower. |

### The Nine Sectors Grid

| Sector | Jiao | Position | What It Indicates | Sensory Signature |
|--------|------|----------|-------------------|-------------------|
| **Sky-Head** | Upper | Eastern membrane | Energy INPUT - what's coming in | Light changes color here first. Dawn arrives early. |
| **Sky-Body** | Upper | Central dome | Current state of protection | The ceiling breathes - subtle expansion and contraction. |
| **Sky-Tail** | Upper | Western membrane | Energy OUTPUT - what's being released | Moisture condenses here. Stale air collects. |
| **Forest-Head** | Middle | Eastern groves | Nutrient intake, new growth | New leaves emerge first. Sap runs fastest. |
| **Forest-Body** | Middle | Heartwood | Core circulation, current health | The Pulse is clearest. Bark is warmest to touch. |
| **Forest-Tail** | Middle | Western groves | Distribution, sharing outward | Fruit ripens here. Flowers release their scent. |
| **Deep-Head** | Lower | The Deep caves | Deep pattern, constitutional health | Stone hums. Water is oldest. Echoes take longest to fade. |
| **Deep-Body** | Lower | Ground substrate | Processing, transformation | Fungal smell. Decomposition. Warmth from below. |
| **Deep-Tail** | Lower | The Edges | Release, boundaries, interface | Cold seeps in. The membrane is thinnest. Stars show through. |

### Rootspeaker Diagnosis

```yaml
diagnosis_scene:
  context: Phase 10 - The Truth Together
  description: |
    Thera kneels at the Heartroot, hands pressed to the warm wood.
    Her eyes are closed, but you can see them moving beneath the lids.

    "Sky-Head is scattered - the membrane can't focus the light right.
    Forest-Body is congested - too much trying to flow through too little.
    Deep-Tail is..." She pauses. "Cold. Silent. The edges are dying."

    She opens her eyes. "Every sector is failing. Not in isolation -
    in cascade. The ship isn't sick in one place. It's exhausted
    everywhere. There's nothing left to redirect."
```

---

## Tomas and the Hidden Pulse

Tomas's unique condition manifests a "hidden pulse" where one energy occasionally appears within another.

### Hidden Yang Within Yin

| His State | What's Happening | Diagnostic Meaning |
|-----------|------------------|-------------------|
| **Confused (baseline)** | Yin dominant - fading, unclear | His own consciousness weakening |
| **Lucid moments** | Yang peaks - sudden clarity | Lira's presence coming through |
| **"She was smiling"** | Full yang breakthrough | Lira using him as a voice |

### Dialogue

```yaml
tomas_lucid_moment:
  context: One of his clear moments
  speaker: Tomas
  dialogue: |
    *His eyes focus suddenly, sharp and present.*

    "There's something inside me. Not always. Just... peeks through.
    Like sunlight between clouds."

    *He touches his chest.*

    "When the Pulse is strong, I feel more like myself. Solid.
    Clear. And then it fades, and I fade with it."

    *His hand stays on his chest, feeling for something.*

    "She's in there. Lira. Keeping this old heart beating.
    I don't know why she bothers with me."

    *His eyes begin to drift.*

    "But she was smiling. At the end. She was smiling. Why won't
    anyone tell me why?"

    *Clarity fades. He wanders toward the statue.*
```

---

## Spark Pulse-Sensing (Future System)

The Spark companion has unique diagnostic abilities that develop over the story.

### Spark Perception Progression

| Story Phase | What Spark Can Sense |
|-------------|---------------------|
| **Act 1** | "Something feels wrong here" (vague) |
| **Act 2** | Basic qualities - "damp," "dry," "scattered" |
| **Act 3** | Location specificity - "the western grove needs attention" |
| **Act 4** | Full Six Qi reading - wind/heat/damp/dry/fire/cold |
| **Post-landing** | Planetary consciousness connection |

### Spark Diagnostic Dialogue

```yaml
spark_pulse_reading:
  examples:
    early_game: |
      [Spark] "I sense... fragmentation here. The energy doesn't
      flow in one direction. It's scattered, like droplets instead
      of a stream. This zone is struggling."

    mid_game: |
      [Spark] "The western grove pulses with dampness. Heavy.
      Sluggish. Something is blocked. The flow can't complete.
      Perhaps we should look for what's stopping it?"

    late_game: |
      [Spark] "I feel the cascade. Movement at the edges first -
      energy shifting where it shouldn't. Then heat follows,
      inflammation, things running too fast. And beneath it
      all... cold. Waiting. Silent.

      One calls the next. The wind stirs the fever. The fever
      exhausts into stillness. If we want to stop the cold,
      we have to go back. Find where the wind started."

spark_70_30_wisdom:
  context: Player tries to over-heal an area
  dialogue: |
    [Spark] "I could try to boost this system fully, but...
    something feels wrong about that. The Grove has its own
    wisdom. Perhaps we should support it, not replace it.

    Seven parts effort. Three parts trust. That seems right."
```

---

## Day/Night Cycle

### Cycle Phases

| Phase | Duration | Light | NPC Activity |
|-------|----------|-------|--------------|
| **Dawn** | 1 hour | Golden, warming | Waking, morning meal gathering |
| **Morning** | 3 hours | Bright, clear | Work begins, healing sessions |
| **Midday** | 2 hours | Intense, warm | Rest in shade, stories shared |
| **Afternoon** | 3 hours | Softening | Work continues, teaching time |
| **Dusk** | 1 hour | Purple, cooling | Return to Heartwood, evening meal |
| **Evening** | 2 hours | Bioluminescent glow | Elder stories, community time |
| **Night** | 4 hours | Dim pulse-glow | Sleep, dreams, Watcher patrols |

### Time-Locked Content

| Content | Available When | Reason |
|---------|----------------|--------|
| Thera's teaching sessions | Morning/Afternoon | She works then |
| Brennan's Edge patrol | Night only | He guards in darkness |
| Elder council meetings | Dusk | Traditional time |
| Dream sequences | Night (player resting) | Sleep triggers |
| The Small Grove | Any time, but Thera only at dusk | Her private ritual |
