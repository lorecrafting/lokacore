# Landing Sequence Proposal: The Descent

## Overview

Replace the abrupt teleport at the end of `grove_epilogue` with an epic multi-phase landing sequence that connects the player's entire journey, reveals the seedship's true nature, and delivers the emotional climax of Thera's sacrifice.

## Current Flow (What Exists)

1. `grove_sacrifice` ends → player talks to Maren → `after_sacrifice_3` → "(Leave)" + `complete_quest`
2. `grove_epilogue` starts → walk grief objectives → talk to Maren → `epilogue_complete_3` → teleport to `planet_awakening_clearing`

## Proposed Flow: Three-Phase Landing

### Phase 1: The Sky Opens (Cutscene — immediately after grove_sacrifice completes)

**Trigger**: After `after_sacrifice_3` dialogue ends (Maren: "Not yet. But you will."), before `grove_epilogue` begins.

**Content**: A cutscene sequence. The player cannot move. Text appears in timed blocks:

```
The ground shifts beneath you. Not earthquake — direction. For the first time in your life,
the world is going somewhere.

Above you, the sky flickers. The membrane — you know what it is now — stutters like a
system shutting down in the correct order. Panel by panel, section by section, the light
that was never sunlight goes dark.

And through the gaps: stars. Real stars. Closer than they should be.

The Pulse changes. Not the rhythm you have known your entire life — Lira's rhythm, steady
and patient and two hundred years tired. This is different. This is two voices. The old one,
still carrying. And a new one, strong and certain and unmistakably her.

Thera.

She is not gone. She is everywhere. The temperature in the healing grove stabilizes. The
water in the spring adjusts its pressure. The roots in the Deep light up in sequences you
have never seen — not emergency patterns. Landing patterns. She is bringing you down.

The membrane peels away in long strips, dissolving into the air like morning frost. The wind
that comes through is cold and dry and carries dust that is not grove dust. It smells like
nothing you have ever smelled. It smells like a planet.

The trees hold. The roots hold. The ground beneath you, which was never ground, settles
into ground that is. There is a sound — deep, resonant, final — like the largest door in the
world closing behind you.

The Grove has landed.
```

**Implementation**: This could be a cutscene entity or a scripted dialogue sequence with no choices (auto-advance). The key is that it's non-interactive and atmospheric.

### Phase 2: The Dream Rooms (3-5 transitional rooms — optional but epic)

**Concept**: After the cutscene, the player briefly enters a "dream state" — the moment between the old world and the new. These are temporary rooms that exist only during the transition, representing the player's consciousness processing the landing.

**Room 1: "The Space Between"**
The player floats in the Pulse itself. The grove's neural network is visible as light — every root, every tree, every path they walked during the game, lit up like a circuit diagram. They can see the shape of the ship for the first time. It is beautiful.

**Room 2: "Lira's Voice"**
Lira speaks. Not as the Rootsong — as herself. She thanks the player. She explains: she aimed the ship at this planet two hundred years ago because she could feel, even then, that the soil here would answer. She has been steering for two centuries. She is tired. She is not sad.

**Room 3: "Thera's Weight"**
The player feels Thera's presence — not as voice but as weight, warmth, the particular quality of attention she always had. She does not speak in words. The room description conveys what she communicates: *I found the part of me that loves you all. It is the whole thing. I am not less. I am more. Listen for me.*

**Room 4: "The First Breath"**
The dream fades. The player is standing in the clearing. The sky is real. Wind moves. The first breath of planet air. The trees are the same trees. Everything is different.

→ Player exits to `planet_awakening_clearing`

**Implementation**: These rooms would be created as special `dream_` prefixed room prototypes. They could be spawned dynamically or exist as permanent rooms only reachable via the transition script. Exits are linear (only "forward" or "continue"). No NPCs, no items — pure atmosphere.

### Phase 3: The Epilogue Walk (existing `grove_epilogue` quest, modified)

After arriving at `planet_awakening_clearing`, the epilogue quest proceeds as designed — walking the grief, finding Tomas, hearing Thera in the Pulse, talking to Maren.

The epilogue objectives remain the same but now carry the weight of the landing sequence. The planet rooms are already written with the right tone.

## Lore: How Seedships Land

Embedded in the cutscene/dream sequence, revealed naturally:

1. **The Two-Heart System**: A seedship requires two merged consciousnesses — a Launch Heart (Lira, who severed the ship from the dying homeworld 200 years ago) and a Landing Heart (Thera, who roots it into the new world). Neither dies. Both become the ship's living nervous system, which becomes the planet's nervous system.

2. **The Landing Mechanics**: The membrane (hull skin) dissolves in a controlled sequence — not catastrophic failure but planned release. The roots extend through the ship's base into actual soil. The substrate (fake ground) merges with real ground. The trees, which were load-bearing columns and neural pathways, become actual trees rooted in actual earth — but they keep their ship functions. The grove IS the ship IS the forest. Nothing is lost.

3. **The Seed Front**: After landing, roots begin extending outward from the grove into the barren planet surface. The margin zone shows this — fine roots threading through cracked soil, two centimetre seedlings pushing up. The ship begins seeding the planet. This is what seedships DO. The entire 200-year journey was for this moment: arrival, rooting, and the slow greening of a dead world.

4. **The Blight Becomes Growth**: The blight lines (failing bio-circuitry in the hull) become growth lines. Thera's consciousness flows through the old conduit seams as new planetary nervous system. Kira's blight research becomes the foundation for understanding the new growth patterns.

5. **The Pulse Continues**: The engine vibration that was the ship's heartbeat becomes the planet's heartbeat. Tenders who could feel the Pulse before can still feel it — but now it carries two voices instead of one.

## Quest/Content Changes Required

1. **New cutscene**: `landing_sequence` cutscene entity (or scripted dialogue on a system NPC)
2. **4 dream rooms**: `dream_space_between`, `dream_liras_voice`, `dream_theras_weight`, `dream_first_breath` — linear exits only
3. **Modified `grove_sacrifice` completion**: After `complete_quest` fires, trigger the landing cutscene
4. **Modified `grove_epilogue` start**: Player begins in `planet_awakening_clearing` after dream sequence
5. **Transition mechanism**: Either a script trait that fires on quest completion, or a dialogue action chain that walks the player through cutscene → dream rooms → planet

## Tone Guidelines

- **No sentimentality**: The writing should be observational, not emotional. Let the reader supply the feeling.
- **Sensory grounding**: Wind, temperature, sound, light. The landing is physical.
- **Recognition over revelation**: The player already knows everything. The landing is the moment where knowing becomes feeling.
- **Thera's presence, not absence**: She is not gone. She is the reason the temperature is right.
- **Scale**: The grove felt like a world. The planet makes it feel like an island. Both are true.

## Open Questions

1. Should the dream rooms be permanent (always reachable via a special path) or one-time-only?
2. Should Lira speak directly, or only through environmental description?
3. How long should the cutscene text blocks be? (Current proposal: ~250 words total, delivered in 6-8 timed blocks)
4. Should there be a "point of no return" warning before the landing? Or should it feel inevitable?
5. Should the landing sequence reference specific rooms/NPCs the player interacted with during their playthrough, or keep it universal?
