# Landing Sequence Spec: "The Descent"

## Overview

New quest `grove_landing` between `grove_sacrifice` and `grove_epilogue`. Replaces the abrupt teleport with a multi-phase landing that the player walks through.

**Flow**: sacrifice ends → tremor → gather NPCs (pre-landed grove) → landing cutscene through Tomas → teleport → walk outward (planet rooms) → see the world → return to grove → epilogue begins

## Storyline Arc Update (`grove_arc.yml`)

```yaml
acts:
  - id: arrival
    name: "Arrival"
    quests: [grove_arrival]

  - id: belonging
    name: "Belonging"
    quests: [grove_belonging]
    requires: [arrival]

  - id: revelation
    name: "Discovery"
    quests: [grove_revelation]
    requires: [belonging]

  - id: crisis
    name: "Crisis"
    quests: [grove_sacrifice]
    requires: [revelation]

  - id: descent
    name: "The Descent"
    quests: [grove_landing]
    requires: [crisis]

  - id: grief_and_joy
    name: "Grief and Joy"
    quests: [grove_epilogue]
    requires: [descent]
```

---

## Quest: `grove_landing`

**File**: `priv/world/quests/grove_landing.yml`

```yaml
id: grove_landing
name: "The Descent"
description: |
  The ground is shaking. The sky is wrong. Thera is bringing you down. Find the others before the world changes forever.

type: main
priority: 4
act: 4

giver: elder_maren
turn_in_npc: null

requires_quest: grove_sacrifice

objectives:
  # --- PRE-LANDING (original grove) ---

  - id: find_brennan
    type: talk
    target_id: brennan
    dialogue_topic: landing_brennan
    description: "Find Brennan — he will be watching the membrane"
    hint: "He patrols the thinning. He will want to see it go."

  - id: find_tomas
    type: talk
    target_id: tomas
    dialogue_topic: landing_tomas
    description: "Find Tomas"
    hint: "He will be where the soil is deepest."
    # Landing cutscene fires inside this dialogue.
    # Final node teleports to planet_awakening_clearing.

  # --- POST-LANDING (planet rooms, walking outward) ---

  - id: reach_the_edge
    type: go_to
    target_id: planet_the_edge
    description: "Walk to where the membrane was"
    hint: "Outward. Through the grove. To the place that used to be a wall."

  - id: cross_threshold
    type: go_to
    target_id: threshold_gate
    description: "Step beyond the grove"
    hint: "North. Where the grove ends and the planet begins."

  - id: see_the_world
    type: go_to
    target_id: threshold_summit
    description: "Climb to where you can see it all"
    hint: "Higher ground. You need to see where you are."

  # --- RETURN (walking back inward) ---

  - id: return_to_grove
    type: go_to
    target_id: planet_awakening_clearing
    description: "Return to the grove"
    hint: "You have seen the world. Now go home."

rewards:
  xp: 500
  gold: 0

journal_entries:
  start: "The ground is moving. Not earthquake. Direction. Maren said to find the others."
  find_brennan: "Brennan was at the thinning, watching the membrane flicker apart. He said: ready has not mattered for a while. He will be where he needs to be."
  find_tomas: "Tomas was in the orchard with his hands in the dirt. He felt it first. He said hello to the ground. The landing came through him — through roots lighting up in patterns no one has seen in two hundred years."
  reach_the_edge: "The membrane is gone. Where it stood there is a seam in the earth, and beyond it, wind. Real wind."
  cross_threshold: "I stepped past the grove. The soil changed under my feet — pale, dry, ancient. A single root threaded through it. The grove's first reach."
  see_the_world: "From the summit I could see both: the grove behind me, green and enormous and no longer the whole world. And ahead, the planet — grey and flat and quiet and very, very large."
  return_to_grove: "The walk back felt different. Shorter. The grove looked the same from outside — green against grey. But I know what it is now. An island. A seed. The beginning of something."
  complete: "I have seen where we are. I have seen what we have to do. The grove is an island. The roots are already reaching."

labels: [main, grove_arc, act_4, landing]
```

---

## NPC Dialogue Additions

### Elder Maren — Quest Accept (`elder_maren.yml`)

Chains from existing `after_sacrifice_3`. Replace the "(Leave)" → null choice:

```yaml
# MODIFY after_sacrifice_3 — replace existing choices
after_sacrifice_3:
  text: "Not yet. But you will."
  choices:
    - text: "(The ground shudders)"
      next: landing_start

# NEW NODES:
landing_start:
  show_if: { quest_active: grove_landing }
  text: |
    The floor shifts beneath you. Not a tremor — a settling, deep and structural, as if the world just found a new center of gravity. Maren puts one hand flat against the wall. Her expression does not change. If anything, she looks calmer than you have ever seen her.

    "It has begun. Can you feel it? The Pulse — listen. Two voices now. She is doing it."
  choices:
    - text: "What do we do?"
      next: landing_start_2

landing_start_2:
  text: |
    "Find the others. Brennan will be at the Thinning — he will want to see the membrane go. Tomas..." She pauses. Something crosses her face that might be two hundred years of waiting. "Tomas will know what this is before anyone. He has been waiting for this sound his whole life."

    She straightens. The wall shudders again beneath her hand.

    "Go. I will gather everyone here."
  choices:
    - text: "(Go)"
      next: null
```

### Brennan — Landing Dialogue (`brennan.yml`)

```yaml
landing_brennan:
  show_if: { quest_active: grove_landing }
  text: |
    He stands at the edge of the thinning, one hand on his blade hilt. Not for defense. For steadiness. Above him, the membrane flickers in long, slow pulses. Through the gaps: darkness. Points of light.
  choices:
    - text: "What do you see?"
      next: landing_brennan_2

landing_brennan_2:
  text: |
    "Stars. And something else. A surface. Grey, flat, going on forever." He does not take his eyes off it. "I have spent my whole life patrolling a wall I could not see. Now it is disappearing."
  choices:
    - text: "Are you ready?"
      next: landing_brennan_3
    - text: "We will need you out there."
      next: landing_brennan_3b

landing_brennan_3:
  text: |
    He is quiet for a moment.

    "No. But I was not ready for any of this. I was not ready when the blight started. I was not ready when Maren told us the truth." He adjusts his grip on the blade. "Ready has not mattered for a while now. I will be where I need to be."
  choices:
    - text: "(Nod)"
      next: null

landing_brennan_3b:
  text: |
    "Out there." He looks north, through a gap in the membrane where sky should be and is not. "I have been protecting a boundary my whole life. Now it is going to be a frontier."

    A pause. The practical mind, already working.

    "Wider patrols. I will need to talk to Rendell about the shifts."
  choices:
    - text: "(Nod)"
      next: null
```

### Tomas — Landing Dialogue + Cutscene (`tomas.yml`)

The emotional peak. The landing fires through the man who has waited 200 years.

```yaml
landing_tomas:
  show_if: { quest_active: grove_landing }
  text: |
    He is kneeling in the orchard, both hands pressed flat against the soil. Eyes closed. He is smiling — not the confused half smile you have seen before. A full one. Clear and certain.
  choices:
    - text: "Tomas?"
      next: landing_tomas_2

landing_tomas_2:
  text: |
    "I can feel it. Under the substrate. Real ground. It has been there for..." He shakes his head slowly. "I do not know how long. Getting closer."
  choices:
    - text: "We are landing."
      next: landing_tomas_3
    - text: "Are you afraid?"
      next: landing_tomas_3b

landing_tomas_3:
  text: |
    "Landing." He says the word like he is tasting it. His fingers dig deeper into the dirt.

    "Two hundred years. Lira told me once — she could feel the planet before anyone else could. She aimed us here. She has been steering for two centuries." A long breath. "She is tired."
  choices:
    - text: "(Stay with him)"
      next: landing_tomas_4

landing_tomas_3b:
  text: |
    "Afraid?" He opens his eyes. They are wet. "I have been afraid for two hundred years. This is the part that comes after afraid."
  choices:
    - text: "(Stay with him)"
      next: landing_tomas_4

# === THE LANDING CUTSCENE (non-interactive, timed beats) ===

landing_tomas_4:
  text: |
    The ground shifts. Not subtly — a deep, structural movement, like the world settling into its final position. Above the canopy, the membrane peels away in long silent strips, dissolving into the air like morning frost.
  choices:
    - text: "(Look up)"
      next: landing_tomas_5

landing_tomas_5:
  text: |
    Stars. Real stars. And below them, growing closer with each breath — a horizon. Not the membrane curving back on itself but actual distance, actual planet, actual sky without a ceiling.

    The Pulse changes. Two voices now. The old one easing, slowing, releasing a weight held for two centuries. And a new one, strong and steady and unmistakably hers. The roots beneath the orchard light up in sequences no one alive has ever seen. Not emergency patterns. Landing patterns.
  choices:
    - text: "(Stay still)"
      next: landing_tomas_6

landing_tomas_6:
  text: |
    The trees hold. The roots hold. There is a sound — deep, resonant, final — like the largest door in the world closing for the last time. The air pressure changes. Your ears adjust. Wind comes through the canopy. Real wind, carrying dust from a planet you have never touched.

    Tomas has not moved. His hands are in the dirt. He is crying and he is smiling and he says, very quietly:

    "Hello, ground."
  choices:
    - text: "(The grove has landed)"
      action: ["teleport", "planet_awakening_clearing"]
      next: null
```

### Kira — Optional Landing Dialogue (`kira.yml`)

Not a required visit. For players who seek her out during the gathering.

```yaml
landing_kira:
  show_if: { quest_active: grove_landing }
  text: |
    She is at her field station, scribbling furiously. Instruments scattered everywhere. The blight sample jars are glowing — not the sickly flicker of decay but a steady, warm pulse.
  choices:
    - text: "Kira, what is happening?"
      next: landing_kira_2

landing_kira_2:
  text: |
    "The conduit patterns. They are reversing." She holds up a jar. The blight lines inside are running backward, sealing shut, becoming something else. "The decay channels — they were never decay. They were dormant growth channels. The whole time."

    She looks up at you. Her eyes are wide.

    "This is what they were always for."
  choices:
    - text: "The blight was part of the design?"
      next: landing_kira_3

landing_kira_3:
  text: |
    "Not the blight — the pathways. The blight was the system failing because the pathways had no purpose yet. Now they do." She turns back to her notes. "I need to document everything. When this is over I am going to need years to understand what I am seeing right now."

    She is already writing again before you finish nodding.
  choices:
    - text: "(Leave her to it)"
      next: null
```

### Elder Maren — Optional Landing Dialogue (if player returns before finding others)

```yaml
landing_maren_waiting:
  show_if: { quest_active: grove_landing }
  text: |
    She is standing in the elder hall, steady as the walls shake around her. Others are arriving — you can hear voices in the corridor. She sees you and shakes her head once.

    "Not here. Go find them. Brennan and Tomas — they should not be alone for this."
  choices:
    - text: "(Go)"
      next: null
```

---

## New Entity: `thera_presence` NPC

**File**: `priv/world/prototypes/npcs/planet/thera_presence.yml`

A non-combatant NPC entity in `planet_heartroot_chamber` representing Thera's voice in the Pulse. Used by `grove_epilogue` for the `presence_speaks` dialogue_topic.

```yaml
key: thera_presence
type: npc
parent: base_npc
short_desc: "Thera's Presence"
long_desc: "The air here hums with something that is not sound. A warmth, a weight, a quality of attention that you recognize."
extra_desc: |
  She is not here in the way a person is here. But the roots are full of light. The Pulse carries a rhythm you know — the way she breathed when she was concentrating, the cadence of her voice when she was teaching. It is not memory. It is current. She is paying attention to this room, right now, and you can feel it.
keywords: [thera, presence, pulse, voice]
primary_keyword: thera

components:
  combatant:
    health:
      current: 999
      max: 999
    stats:
      str: 1
      dex: 1
      sta: 1
    level: 1

  ai:
    aggression: friendly
    wander: false

  dialogue_tree:
    start:
      text: |
        The warmth intensifies. The roots around you pulse once, slowly, like a breath. Not a greeting — a recognition. She knows you are here.
      choices:
        - text: "(Touch the root)"
          next: presence_speaks

    presence_speaks:
      show_if: { quest_active: grove_epilogue }
      text: |
        The Pulse deepens. Not words — you do not hear words. But something settles into your awareness the way warmth settles into cold hands. A meaning without language:

        I found the part of me that loves you all. It is the whole thing. I am not less than I was. I am more.
      choices:
        - text: "(Listen)"
          next: presence_speaks_2

    presence_speaks_2:
      text: |
        The roots dim slightly, then brighten. A rhythm — almost playful. The quality of attention you remember from the training grove, when she was about to say something she thought was funny and important at the same time.

        The love did not get smaller. It got bigger. That is the trick. That is the third root and what is past it.
      choices:
        - text: "I will listen for you."
          next: presence_speaks_3

    presence_speaks_3:
      text: |
        A pulse. Warm. Steady. The specific pressure of someone squeezing your hand who cannot squeeze your hand anymore but is doing it anyway, somehow, through root and soil and the whole living system of a grove that used to be a ship and is now a world.

        She does not say goodbye. She says: listen.
      choices:
        - text: "(You will)"
          next: null

    # Post-epilogue ambient
    post_landing:
      text: |
        The roots pulse gently. A steady warmth. She is here. She is always here.
      choices:
        - text: "(Listen)"
          next: null
```

Spawned in `planet_heartroot_chamber.yml`:
```yaml
spawns:
  - prototype: thera_presence
```

---

## Ambient Events: Landing Tremor Script

**File**: `priv/world/scripts/traits/landing_ambience.yml`

Attaches to a system entity. Fires tremor messages to `grove_landing` quest-active players every 30-45s, escalating.

```yaml
key: landing_ambience
type: script
name: "Landing Ambience"

components:
  data:
    hook: behavior
    description: "Fires escalating tremor ambient messages during the landing sequence"
    source: |
      # Check if any players in the room have grove_landing active
      # Fire escalating messages based on how many NPCs visited (tick count as proxy)

      state = get_trait_state.("tick_count") || 0
      set_trait_state.("tick_count", state + 1)

      early_messages = [
        "The ground shifts beneath your feet. A vibration you have never felt before.",
        "A low hum rises through the floor, deeper than the Pulse. Structural.",
        "The roots beneath the path flare bright for a moment, then dim."
      ]

      mid_messages = [
        "A crack of light splits the sky above the canopy. Through it: darkness and stars.",
        "Your ears pop. The air pressure is changing.",
        "The trees sway — not from wind. From movement. The whole grove is moving."
      ]

      late_messages = [
        "A sound like metal settling. The membrane above flickers. A panel goes dark.",
        "Through the gaps in the sky you can see a horizon. An actual horizon.",
        "The Pulse stutters, catches, changes rhythm. Two voices where there was one."
      ]

      messages = cond do
        state < 3 -> early_messages
        state < 6 -> mid_messages
        true -> late_messages
      end

      message = Enum.random(messages)
      emit.(message)

      # Re-fire every 35-45 seconds
      delay = 35 + :rand.uniform(10)
      after.(delay * 1000)
```

**Implementation note**: This script needs to be attached to a system entity that exists in the pre-landed grove during the landing phase. Options:
- Attach to a `landing_system` entity spawned when `grove_landing` activates
- OR attach to the `world_system` entity with a quest-active check
- Exact mechanism depends on how quest-conditional scripts are wired; may need a signal from the quest system to start/stop the trait

---

## Modified Quest: `grove_epilogue`

**File**: `priv/world/quests/grove_epilogue.yml` (updated)

All targets changed to planet room/NPC keys. Thera target changed to `thera_presence`.

```yaml
id: grove_epilogue
name: "What Remains"
description: |
  The Grove landed. Thera is gone — and everywhere. Walk the places she loved. Let the grief have its full shape. Something is waiting on the other side of it.

type: main
priority: 5
act: 4

giver: planet_elder_maren
turn_in_npc: planet_elder_maren

requires_quest: grove_landing

objectives:
  - id: attend_memorial
    type: go_to
    target_id: planet_heartwood
    description: "Attend the memorial gathering in the Heartwood"
    hint: "The community is gathering to grieve together."

  - id: walk_healing_grove
    type: go_to
    target_id: planet_healing_grove
    description: "Walk through the healing grove — the place she worked"
    hint: "Her absence will be loudest in the places she most inhabited."

  - id: visit_small_grove
    type: go_to
    target_id: planet_small_grove
    description: "Visit the small grove — the place Thera only ever showed you"
    hint: "She said she had never shown anyone. You know where it is."

  - id: find_tomas
    type: talk
    target_id: planet_tomas
    dialogue_topic: epilogue_tomas
    description: "Find Tomas at the memorial stone"
    hint: "He knows something about the smile. He has always known."

  - id: return_heartroot
    type: go_to
    target_id: planet_heartroot_chamber
    description: "Return to the Heartroot Chamber"
    hint: "She said: if you look for me and cannot find me... Go back. Look."

  - id: thera_presence
    type: talk
    target_id: thera_presence
    dialogue_topic: presence_speaks
    description: "Listen for her in the Pulse"
    hint: "Touch the root. Stand still. Listen downward."

  - id: speak_to_maren_end
    type: talk
    target_id: planet_elder_maren
    dialogue_topic: epilogue_end
    description: "Tell Elder Maren what you found at the Heartroot"

rewards:
  xp: 500
  gold: 0

journal_entries:
  start: "Maren asked me to walk the Grove. To let it happen. She said the joy comes after the grief, not instead of it."
  attend_memorial: "Everyone placed something. Flowers, small objects, things they had been holding back. Kira was last. She laid down her pruning shears — the ones her mother left her. She will pick them up again. But not today."
  walk_healing_grove: "Empty. Every spot she used to stand in is just air now. The plants she tended are still growing. That is something."
  visit_small_grove: "She said she had never shown anyone. The grove is quieter now. The light comes from a real sun."
  find_tomas: "Tomas looked up when I sat beside him. He said: she is here, you know. She never left. That is what I have been trying to tell everyone. Then he went back to his conversation with the stone."
  return_heartroot: "The chamber was warmer than before. The roots were full of light — not emergency light. Living light."
  thera_presence: "She was there. The love did not get smaller, she said. It got bigger. The whole thing. She asked me to listen for her. I said I would."
  complete: "Maren asked what I found. I said: I think she found the third root, and then found what is past it. Maren was quiet for a long time. Then she said: yes. That is what Lira tried to tell Tomas for two hundred years."

labels: [main, grove_arc, act_4, epilogue]
```

---

## Epilogue NPC Dialogue Updates

Planet NPCs (`planet_elder_maren`, `planet_tomas`) need the epilogue dialogue nodes that currently live on their pre-landed counterparts. Specifically:

- **`planet_elder_maren`**: needs `epilogue_accepted`, `epilogue_accepted_2`, `epilogue_end`, `epilogue_complete` through `epilogue_complete_3` nodes. Remove the teleport action from `epilogue_complete_3` (player is already in planet rooms).
- **`planet_tomas`**: needs `epilogue_tomas` node (the memorial stone scene).
- **`thera_presence`**: already specced above with `presence_speaks` nodes.

### planet_elder_maren epilogue_complete_3 change

```yaml
# REMOVE the teleport action — player is already in planet rooms
epilogue_complete_3:
  text: "She found what is beyond all the roots. There is no word for it. There does not need to be."
  choices:
    - text: "Thank you, Elder."
      action: ["complete_quest", "grove_epilogue"]
      next: null
```

---

## Summary of Files to Create/Modify

### New files:
1. `priv/world/quests/grove_landing.yml` — the landing quest
2. `priv/world/prototypes/npcs/planet/thera_presence.yml` — Thera's presence entity
3. `priv/world/scripts/traits/landing_ambience.yml` — ambient tremor script

### Modified files:
4. `priv/world/storylines/grove_arc.yml` — add `descent` act
5. `priv/world/quests/grove_epilogue.yml` — planet room targets, requires grove_landing
6. `priv/world/prototypes/npcs/grove/elder_maren.yml` — landing_start chain from after_sacrifice_3
7. `priv/world/prototypes/npcs/grove/brennan.yml` — landing_brennan dialogue
8. `priv/world/prototypes/npcs/grove/tomas.yml` — landing_tomas + cutscene dialogue
9. `priv/world/prototypes/npcs/grove/kira.yml` — landing_kira optional dialogue
10. `priv/world/prototypes/npcs/planet/planet_elder_maren.yml` — epilogue dialogue nodes
11. `priv/world/prototypes/rooms/planet/grove/planet_heartroot_chamber.yml` — add thera_presence spawn

### Possibly needed:
12. Planet NPC dialogue files may need epilogue nodes copied/adapted from pre-landed counterparts
13. System entity for landing_ambience script attachment
