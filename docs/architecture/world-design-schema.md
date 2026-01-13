# Loka World Design Schema

## Purpose

This document provides:
1. A **notation language** for designing complete game worlds
2. An **audit methodology** to ensure tight integration
3. The **Monastery Hometown audit** as reference implementation

This schema can be used to design any future hometown with confidence that all systems interlock properly.

---

# Part 1: The World Design Language (WDL)

## Overview

A complete world design consists of **7 interlocking layers**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 7: THEME & PHILOSOPHY                  │
│                   (What does this world teach?)                 │
├─────────────────────────────────────────────────────────────────┤
│                    LAYER 6: NARRATIVE ARC                       │
│              (Beginning → Middle → End structure)               │
├─────────────────────────────────────────────────────────────────┤
│                    LAYER 5: PROGRESSION GATES                   │
│           (What blocks what? Level/skill/karma/item)            │
├─────────────────────────────────────────────────────────────────┤
│                    LAYER 4: SKILL ECOSYSTEM                     │
│              (Learn → Practice → Master → Apply)                │
├─────────────────────────────────────────────────────────────────┤
│                    LAYER 3: ITEM ECONOMY                        │
│              (Source → Transform → Consume/Use)                 │
├─────────────────────────────────────────────────────────────────┤
│                    LAYER 2: NPC NETWORK                         │
│            (Who teaches/gives/sells/blocks what?)               │
├─────────────────────────────────────────────────────────────────┤
│                    LAYER 1: SPATIAL LAYOUT                      │
│              (Rooms, exits, zones, gating)                      │
└─────────────────────────────────────────────────────────────────┘
```

Each layer must be **internally consistent** and **cross-referenced** with adjacent layers.

---

## Layer 1: Spatial Layout Schema

### Room Definition

```yaml
ROOM: <room_key>
  zone: <zone_name>           # Logical grouping
  type: <room_type>           # hub|corridor|destination|secret|boss
  access: <access_type>       # open|quest_gated|skill_gated|item_gated|story_gated

  connections:
    - exit: <direction>
      to: <room_key>
      gate: <gate_condition>  # Optional

  features:
    - <feature_type>          # fountain|shrine|crafting_station|gathering_node|etc

  npcs:
    - <npc_key>

  purpose:                    # Why does this room exist narratively?
    - <purpose_tag>           # quest_objective|trainer_location|resource_source|etc
```

### Zone Types

| Zone Type | Purpose | Examples |
|-----------|---------|----------|
| `hub` | Central area, many connections | Courtyard, village square |
| `residential` | NPC homes, side content | Cells, houses |
| `sacred` | Spiritual activities | Temple, shrine |
| `commercial` | Trading, crafting | Market, forge |
| `wilderness` | Exploration, gathering | Forest, mountain |
| `dungeon` | Challenge, boss content | Caves, trials |

### Connection Notation

```
A ←→ B           # Two-way open connection
A → B            # One-way connection
A ←[gate]→ B     # Two-way gated connection
A →[gate] B      # One-way gated, backtrack open
A ←[gate]→ B     # Bidirectional same gate
```

### Gate Types

```
[quest:quest_id]           # Requires quest complete/active
[skill:skill_name>=N]      # Requires skill level
[item:item_id]             # Requires item in inventory
[karma>=N] or [karma<=N]   # Requires karma threshold
[level>=N]                 # Requires player level
[flag:flag_name]           # Requires flag set
[time:dawn|day|dusk|night] # Time-based access
[npc:npc_id]               # NPC must be present/alive
```

---

## Layer 2: NPC Network Schema

### NPC Definition

```yaml
NPC: <npc_key>
  name: "<Display Name>"
  role: <primary_role>        # trainer|questgiver|merchant|guardian|companion|ambient
  location: <room_key>
  schedule:                   # Optional movement
    dawn: <room_key>
    day: <room_key>
    night: <room_key>

  provides:
    trains:                   # Skills this NPC teaches
      - skill: <skill_key>
        max_level: N
        requires: <condition>

    quests:                   # Quests this NPC gives
      - <quest_key>

    sells:                    # Items this NPC sells
      - <item_key>

    services:                 # Special services
      - <service_type>        # heal|repair|identify|transport|etc

  requires:                   # When is this NPC available?
    quest: <quest_key>        # Must be complete/active
    karma: <threshold>
    time: <time_period>

  story_role: "<narrative function>"
```

### NPC Relationship Notation

```
NPC_A --teaches--> SKILL
NPC_A --gives--> QUEST
NPC_A --sells--> ITEM
NPC_A --guards--> ROOM
NPC_A --unlocks--> NPC_B     # Completing A's quest reveals B
NPC_A --conflicts--> NPC_B   # Mutually exclusive relationships
```

---

## Layer 3: Item Economy Schema

### Item Flow Diagram

```
SOURCE → TRANSFORM → DESTINATION

Sources:
  [G] Gathering node
  [D] Drop from enemy
  [Q] Quest reward
  [S] Shop purchase
  [C] Crafted from recipe
  [W] World object (chest, etc.)

Transforms:
  [R] Recipe input
  [U] Upgrade material
  [E] Enchantment component

Destinations:
  [C] Consumed (potion, food)
  [Q] Quest objective (deliver)
  [O] Offering (shrine, NPC)
  [E] Equipment (wear/wield)
  [K] Key item (permanent)
```

### Item Definition

```yaml
ITEM: <item_key>
  type: <item_type>          # consumable|equipment|material|key|offering|tool

  sources:
    - type: gather
      node: <node_key>
      rooms: [<room_keys>]
    - type: drop
      enemies: [<enemy_keys>]
      chance: N%
    - type: quest
      quest: <quest_key>
    - type: shop
      npc: <npc_key>
      price: N
    - type: craft
      recipe: <recipe_key>

  uses:
    - type: consume
      effect: <effect_description>
    - type: recipe_input
      recipes: [<recipe_keys>]
    - type: quest_objective
      quest: <quest_key>
      objective: <objective_id>
    - type: offering
      shrine: <shrine_key>
      karma: N
    - type: unlock
      unlocks: <what_it_unlocks>
```

### Economy Balance Rules

1. **No orphan items**: Every item must have ≥1 source AND ≥1 use
2. **Progression alignment**: Items needed for Act 2 must be obtainable in Act 1
3. **Skill gating**: If crafting requires skill X at level N, source materials must be obtainable at skill X level < N
4. **Quest item availability**: Quest items must be obtainable BEFORE quest is offered

---

## Layer 4: Skill Ecosystem Schema

### Skill Definition

```yaml
SKILL: <skill_key>
  category: <category>       # body|speech|mind|craft|wisdom

  unlock:
    default: true            # Available from start
    OR
    prerequisite:
      skill: <skill_key>
      level: N
    OR
    quest: <quest_key>
    OR
    npc: <npc_key>           # Must meet this NPC

  trainers:
    - npc: <npc_key>
      max_level: N
      requires: <condition>

  practice_sources:          # How to gain XP through use
    - action: <action_type>
      xp: N

  applications:              # Where this skill is USED (critical!)
    - type: combat
      effect: "<effect>"
    - type: dialogue
      unlocks: "<dialogue_options>"
    - type: crafting
      enables: [<recipe_keys>]
    - type: gathering
      nodes: [<node_keys>]
    - type: quest
      quest: <quest_key>
      how: "<usage description>"
    - type: room_access
      room: <room_key>
    - type: trial
      trial: <trial_id>
      method: "<solution method>"
```

### Skill Utility Audit

Every skill MUST have entries in `applications`. If a skill has no applications, it's **orphaned** and should be removed or given purpose.

```
SKILL AUDIT CHECKLIST:
□ Has at least one trainer
□ Has at least one practice source
□ Has at least one meaningful application
□ Application is reachable AFTER skill is learnable
□ Skill is learnable BEFORE application is needed
```

---

## Layer 5: Progression Gates Schema

### Gate Graph Notation

```
[START] → (condition) → [UNLOCK]

Condition types:
  (Q:quest_id)      Quest completion
  (S:skill>=N)      Skill level
  (L:level>=N)      Player level
  (K:karma>=N)      Karma threshold
  (I:item)          Item possession
  (F:flag)          Flag set
  (N:npc)           NPC interaction
  (C:cutscene)      Cutscene triggered
```

### Progression Path

```yaml
PROGRESSION_PATH: <path_name>
  type: main|side|optional

  stages:
    - id: <stage_id>
      name: "<Stage Name>"
      entry_condition: <condition>
      content:
        quests: [<quest_keys>]
        areas: [<room_keys>]
        skills: [<skill_keys>]
        npcs: [<npc_keys>]
      exit_condition: <condition>

    - id: <next_stage_id>
      # ...
```

### Critical Path Definition

```yaml
CRITICAL_PATH:
  # The minimum requirements to complete the main story

  checkpoints:
    - stage: "Arrive"
      level: 1
      skills: []
      items: []

    - stage: "Investigation"
      level: 2-3
      skills: [meditation:3]
      items: [meditation_journal]

    - stage: "Trials"
      level: 5-6
      skills: [meditation:10, mantra_compassion:5]
      items: [clarity_potion OR lamp_of_wisdom]

    - stage: "Liberation"
      level: 7-8
      skills: [varies by path]
      karma: >=40 (for liberation ending)
```

---

## Layer 6: Narrative Arc Schema

### Three-Act Structure

```yaml
NARRATIVE_ARC: <arc_name>

  ACT_1_SETUP:
    theme: "<What is introduced>"
    duration: "<Expected playtime>"

    story_beats:
      - beat: "Hook"
        trigger: <trigger>
        content: "<What happens>"
      - beat: "Establish Stakes"
        trigger: <trigger>
        content: "<What happens>"
      - beat: "Call to Adventure"
        trigger: <trigger>
        content: "<What happens>"

    player_goals:
      explicit: ["<What player is told to do>"]
      implicit: ["<What player discovers they need>"]

    skills_introduced: [<skill_keys>]
    mechanics_taught: [<mechanic_names>]

  ACT_2_CONFRONTATION:
    theme: "<What is challenged>"
    duration: "<Expected playtime>"

    story_beats:
      - beat: "Rising Action"
        # ...
      - beat: "Midpoint Revelation"
        # ...
      - beat: "Complications"
        # ...

    trials:
      - trial: <trial_id>
        teaches: "<lesson>"
        skill_solutions: [<skill_keys>]
        item_solutions: [<item_keys>]

  ACT_3_RESOLUTION:
    theme: "<What is resolved>"
    duration: "<Expected playtime>"

    story_beats:
      - beat: "Climax"
        # ...
      - beat: "Choice"
        options: [<ending_keys>]
      - beat: "Denouement"
        # ...

    endings:
      - id: <ending_key>
        requirements: <conditions>
        theme: "<What this ending means>"
        rewards: [<reward_keys>]
```

### Beat-to-System Mapping

Every story beat should engage at least one game system:

| Beat Type | Systems Engaged |
|-----------|-----------------|
| Discovery | Room exploration, examine objects, NPC dialogue |
| Challenge | Combat, skill checks, puzzles |
| Growth | Skill training, crafting, meditation |
| Choice | Dialogue branches, quest completion style |
| Revelation | Cutscenes, journal entries, NPC reactions |
| Reward | Items, XP, karma, titles, access |

---

## Layer 7: Theme & Philosophy Schema

### Theme Definition

```yaml
THEME: <theme_name>

  core_lesson: "<The central teaching>"

  mechanical_expression:
    # How theme manifests in gameplay
    - system: <system_name>
      expression: "<How this system embodies the theme>"

  narrative_expression:
    # How theme manifests in story
    - element: <story_element>
      expression: "<How this element embodies the theme>"

  environmental_expression:
    # How theme manifests in world design
    - aspect: <world_aspect>
      expression: "<How this aspect embodies the theme>"

  progression_arc:
    beginning: "<Player's initial understanding>"
    middle: "<Player's challenged understanding>"
    end: "<Player's transformed understanding>"
```

### Thematic Consistency Check

Every major system should answer: **"How does this teach the theme?"**

```
THEME AUDIT:
□ Combat system teaches: _______________
□ Skill system teaches: _______________
□ Crafting system teaches: _______________
□ Dialogue system teaches: _______________
□ Quest system teaches: _______________
□ Karma system teaches: _______________
```

---

# Part 2: Cross-Layer Relationship Notation

## The Integration Matrix

```
           ROOMS  NPCs  ITEMS  SKILLS  QUESTS  CUTSCENES
ROOMS        -     ⊕      ⊕       ⊕       ⊕         ⊕
NPCs         ⊕     -      ⊕       ⊕       ⊕         ⊕
ITEMS        ⊕     ⊕      -       ⊕       ⊕         ⊕
SKILLS       ⊕     ⊕      ⊕       -       ⊕         ⊕
QUESTS       ⊕     ⊕      ⊕       ⊕       -         ⊕
CUTSCENES    ⊕     ⊕      ⊕       ⊕       ⊕         -

⊕ = Must have defined relationships
```

## Relationship Types

### Room ↔ NPC
```
ROOM contains NPC (permanent)
ROOM visited_by NPC (schedule)
ROOM locked_by NPC (guardian)
ROOM unlocked_by NPC (quest completion)
```

### Room ↔ Item
```
ROOM contains ITEM (chest, world object)
ROOM requires ITEM (key)
ROOM enables ITEM gathering (node)
ROOM enables ITEM crafting (station)
```

### Room ↔ Skill
```
ROOM requires SKILL (access gate)
ROOM trains SKILL (special location)
ROOM tests SKILL (challenge)
ROOM rewards SKILL use (better outcomes)
```

### Room ↔ Quest
```
ROOM is objective of QUEST
ROOM unlocked by QUEST
ROOM contains QUEST giver
ROOM triggers QUEST event
```

### Room ↔ Cutscene
```
ROOM triggers CUTSCENE on entry
ROOM triggers CUTSCENE on action
ROOM is setting for CUTSCENE
```

### NPC ↔ Item
```
NPC sells ITEM
NPC gives ITEM (quest reward)
NPC requires ITEM (unlock dialogue)
NPC crafts with ITEM (service)
```

### NPC ↔ Skill
```
NPC trains SKILL
NPC requires SKILL (dialogue unlock)
NPC tests SKILL (challenge)
NPC rewards SKILL mastery
```

### NPC ↔ Quest
```
NPC gives QUEST
NPC is objective of QUEST
NPC unlocked by QUEST
NPC blocks until QUEST complete
```

### NPC ↔ Cutscene
```
NPC triggers CUTSCENE
NPC appears in CUTSCENE
NPC dialogue leads to CUTSCENE
```

### Item ↔ Skill
```
ITEM requires SKILL to use
ITEM grants SKILL (learning item)
ITEM is created by SKILL (crafting)
ITEM boosts SKILL (equipment)
```

### Item ↔ Quest
```
ITEM is objective of QUEST
ITEM is reward of QUEST
ITEM unlocks QUEST
ITEM is required for QUEST
```

### Item ↔ Cutscene
```
ITEM triggers CUTSCENE
ITEM appears in CUTSCENE
ITEM is created by CUTSCENE
```

### Skill ↔ Quest
```
SKILL is taught by QUEST
SKILL is required for QUEST
SKILL is tested by QUEST
SKILL provides alternate QUEST solution
```

### Skill ↔ Cutscene
```
SKILL unlocks CUTSCENE option
SKILL is taught by CUTSCENE
SKILL is demonstrated in CUTSCENE
```

### Quest ↔ Cutscene
```
QUEST triggers CUTSCENE
QUEST is advanced by CUTSCENE
QUEST ending determined by CUTSCENE choice
```

---

# Part 3: Monastery Hometown Audit

## Executive Summary

| Dimension | Status | Issues Found |
|-----------|--------|--------------|
| Spatial Coherence | ⚠️ | 2 orphan rooms |
| NPC Coverage | ⚠️ | 4 skills without trainers |
| Item Flow | ❌ | 0 gathering nodes defined |
| Skill Utility | ❌ | 8 skills without quest applications |
| Quest Integration | ✅ | Well connected |
| Cutscene Coverage | ⚠️ | Missing companion cutscenes |
| Thematic Consistency | ✅ | Strong |

## Detailed Audit

### Audit 1: Spatial Layout

#### Zone Map
```
                    [MOUNTAIN_PEAK]
                          |
                    [CLIFF_PATH]
                          |
    [HERMITS_CAVE]--[WATERFALL_SHRINE]--[OLD_STUPA]
                          |                   |
                    [TERRACED_FIELDS]    [CAVE_ENTRANCE]
                          |                   |
[CEMETERY]--[VILLAGE]--[VILLAGE_SQUARE]  [THRESHOLD]
                |              |              |
           [MARKET]    [MONASTERY_GATE]  [BARDO_REALM]
                              |              |
                    ┌─────────┼─────────┐    |
                    |         |         |    |
              [TEA_HOUSE] [COURTYARD] [GUEST_HALL]
                              |
           ┌──────────────────┼──────────────────┐
           |                  |                  |
    [DINING_HALL]      [MEDITATION_HALL]    [TEMPLE]
           |                  |
    [HERB_GARDEN]      [TENZINS_CELL]
           |
       [FORGE]

    === TRIAL CHAMBERS (from THRESHOLD) ===

    [ATTACHMENT_CHAMBER]--[RAGAS_CORE]
    [AVERSION_CHAMBER]--[DVESHAS_CORE]
    [IGNORANCE_CHAMBER]--[MOHAS_CORE]
              |
        [PREPARATION_CHAMBER]
              |
        [HEART_CAVE]
```

#### Orphan Rooms Identified

| Room | Issue | Fix |
|------|-------|-----|
| `bardo_realm` | No clear entry point in main flow | Add entrance from cave system |
| `preparation_chamber` | Exists but no clear purpose | Add pre-boss preparation content |

#### Access Gate Audit

| Gate | Type | Condition | Status |
|------|------|-----------|--------|
| Village → Monastery | Open | - | ✅ |
| Monastery → Caves | Quest | main_sleeping_master complete | ✅ |
| Threshold → Trials | Quest | main_three_trials active | ✅ |
| Trials → Heart Cave | Quest | All trials complete | ✅ |
| Hermit's Cave → Training | Quest | side_hermits_song complete | ✅ |
| Mountain Peak | Skill | athletics >= 10 OR item:climbing_rope | ❌ Missing |

**Fix Needed**: Add athletics skill gate or item gate for mountain peak.

---

### Audit 2: NPC Network

#### NPC Roster

| NPC | Location | Role | Trains | Quests | Status |
|-----|----------|------|--------|--------|--------|
| novice_pema | Gate | Questgiver, Companion | Meditation(1-5) | intro_welcome | ✅ |
| abbot_jampa | Temple | Questgiver, Trainer | Mantra:Compassion, Mantra:Protection | main_*, side_restless | ✅ |
| teacher_lobsang | Med Hall | Trainer | Meditation(6-25), Philosophy, Inscription | - | ✅ |
| elder_drolma | Tea House | Trainer, Lore | Reading Others, Perception, Local Lore | - | ✅ |
| hermit_milarepa | Hermit Cave | Trainer | Unarmed(31-50), Mantra:Wisdom, Spirit Lore | side_hermits_song | ✅ |
| blacksmith_tashi | Forge | Trainer, Merchant | Smithing, Bartering | side_forge_blessing | ✅ |
| butcher_sonam | Village | Questgiver | Bartering | side_butchers_burden | ✅ |
| tea_vendor_karma | Tea House | Questgiver, Trainer | Persuasion | side_tea_for_travelers | ✅ |
| wandering_musician | Various | Questgiver | Persuasion(16-30) | side_musicians_tale | ✅ |
| herb_master_dolkar | Herb Garden | Trainer | Herbalism, Alchemy | - | ✅ |
| master_chen | Courtyard | Trainer | Swordsmanship, Unarmed(1-30), Endurance | - | ✅ |

#### Skills WITHOUT Trainers

| Skill | Designed Trainer | Status |
|-------|------------------|--------|
| Athletics | mountain_guide | ❌ NPC doesn't exist |
| Cooking | cook_tenzin | ❌ NPC doesn't exist |
| Mantra:Protection | abbot_jampa | ⚠️ Listed but not in dialogue |
| Local Lore | elder_drolma | ⚠️ Listed but not in dialogue |

**Fix Needed**:
1. Create `mountain_guide` NPC in cliff_path or village
2. Create `cook_tenzin` NPC in dining_hall
3. Add training dialogue to abbot_jampa for protection mantra
4. Add training dialogue to elder_drolma for local lore

#### NPC Relationship Map

```
         [PLAYER]
            |
      ┌─────┼─────┬─────────────────┐
      ▼     ▼     ▼                 ▼
   [PEMA] [ABBOT] [LOBSANG]    [MASTER_CHEN]
      |     |        |              |
      |     |        └──trains──────┤
      |     |                       |
      └──companion──────────────────┘
            |
            ▼
    ┌───────┼───────┐
    ▼       ▼       ▼
[HERMIT] [DROLMA] [TASHI]
    |       |        |
    └───────┴────────┘
            |
            ▼
      [SIDE QUEST NPCS]
    Sonam, Karma, Musician
```

---

### Audit 3: Item Economy

#### Critical Items

| Item | Source | Uses | Status |
|------|--------|------|--------|
| meditation_journal | tenzins_cell (world) | Quest objective, lore | ✅ |
| butter | shop:market | Lamp offering | ✅ |
| incense | shop:temple, craft | Offering, crafting | ✅ |
| clarity_potion | craft:alchemy | Trial buff | ⚠️ Recipe exists, ingredients? |
| lamp_of_wisdom | shop:hermit OR quest | Ignorance trial solution | ❌ Not defined |
| compassion_offering | craft:inscription | Liberation ending item | ❌ Not defined |
| sacred_spring_water | gather:waterfall | Alchemy ingredient | ❌ Node not defined |
| chrysanthemum_flower | gather:herb_garden | Tea quest | ❌ Node not defined |
| goji_berry | gather:herb_garden | Tea quest | ❌ Node not defined |

#### Item Flow Gaps

```
INTENDED FLOW:
  [Herb Garden] --gather--> [Chrysanthemum] --recipe--> [Traveler's Tea]
                                   |
                            [Tea Quest Complete]

ACTUAL STATE:
  [Herb Garden] --???--> [NO GATHERING NODE] --???--> [Recipe exists but no ingredients]
```

**Critical Fix Needed**: Define all gathering nodes.

#### Gathering Nodes Required

| Node | Room | Yields | Used By |
|------|------|--------|---------|
| chrysanthemum_patch | herb_garden | chrysanthemum_flower | Tea quest, alchemy |
| goji_bush | herb_garden | goji_berry | Tea quest, alchemy |
| lotus_pond | waterfall_shrine | lotus_essence | Clarity potion |
| sacred_spring | waterfall_shrine | sacred_water | Alchemy base |
| mountain_herbs | terraced_fields | various herbs | General alchemy |
| cave_crystals | cave_entrance | cave_crystal | Clarity potion |
| moonflower_patch | cemetery (night) | moonflower | Cooling balm |

---

### Audit 4: Skill Utility

#### Skill Application Matrix

| Skill | Combat | Dialogue | Crafting | Quest | Trial | Gate | Status |
|-------|--------|----------|----------|-------|-------|------|--------|
| Swordsmanship | ✅ | - | - | - | - | - | ⚠️ Combat only |
| Unarmed | ✅ | - | - | - | - | - | ⚠️ Combat only |
| Endurance | ✅ buff | - | - | - | - | - | ⚠️ Passive only |
| Athletics | ✅ dodge | - | - | Peak quest | - | Peak room | ✅ |
| Persuasion | - | ✅ | - | Multiple | - | - | ✅ |
| Reading Others | - | ✅ | - | Butcher | - | - | ✅ |
| Bartering | - | ✅ shops | - | - | - | - | ⚠️ Shop only |
| Meditation | - | - | - | Multiple | All 3 | - | ✅ |
| Mantra:Compassion | ✅ calm | - | - | Spirits | Aversion | - | ✅ |
| Mantra:Wisdom | ✅ dispel | - | - | - | Attach+Ignor | - | ✅ |
| Mantra:Protection | ✅ shield | - | - | - | - | - | ⚠️ Combat only |
| Perception | - | ✅ | - | - | - | - | ⚠️ Passive only |
| Herbalism | - | - | ✅ | Tea quest | - | - | ✅ |
| Alchemy | - | - | ✅ | - | Potions | - | ✅ |
| Smithing | - | - | ✅ | Forge | - | - | ✅ |
| Cooking | - | - | ✅ | - | - | - | ⚠️ No quest tie |
| Inscription | - | - | ✅ | - | Liberation | - | ✅ |
| Philosophy | - | ✅ | - | - | Dialogue | - | ⚠️ Passive only |
| Local Lore | - | ✅ | - | Musician | - | Secrets | ✅ |
| Spirit Lore | ✅ buff | ✅ | - | Spirits | Mara | - | ✅ |

#### Skills Needing Quest Integration

| Skill | Current Issue | Proposed Fix |
|-------|---------------|--------------|
| Swordsmanship | Combat only | Add sword technique quest from Master Chen |
| Unarmed | Combat only | Already tied to Hermit's training |
| Endurance | Passive only | Add survival challenge in caves |
| Bartering | Shop only | Add "negotiate for supplies" objective |
| Mantra:Protection | Combat only | Add protection puzzle in trial |
| Cooking | No quest | Add "feast for the monastery" side quest |
| Philosophy | Passive only | Add dharma debate side quest |

---

### Audit 5: Quest Integration

#### Quest Dependency Graph

```
[INTRO_WELCOME] ──────┐
       |              |
       ▼              |
[INTRO_FIND_TEMPLE]   |
       |              |
       ▼              |
[MAIN_SLEEPING_MASTER]┼──────────────────────────────────┐
       |              |                                  |
       ├──────────────┼──────────────────┐               |
       |              |                  |               |
       ▼              ▼                  ▼               |
[SIDE_SPIRITS] [SIDE_TEA] [SIDE_HERMIT]  |               |
       |              |         |        |               |
       ▼              ▼         ▼        |               |
 [Teaches:      [Teaches:  [Unlocks:     |               |
  Compassion]   Herbalism]  Mantra:Wisdom]               |
       |              |         |        |               |
       └──────────────┴─────────┴────────┘               |
                      |                                  |
                      ▼                                  ▼
              [MAIN_THREE_TRIALS] ◄─────────────[OTHER SIDE QUESTS]
                      |                         Butcher, Musician,
                      |                         Peak, Forge
                      ▼
              [MAIN_LIBERATION]
                      |
              ┌───────┴───────┐
              ▼               ▼
       [LIBERATION]    [DESTRUCTION]
         ENDING          ENDING
```

#### Quest-Skill Teaching

| Quest | Skill Taught/Unlocked | How |
|-------|----------------------|-----|
| intro_welcome | Meditation basics | Pema teaches on complete |
| intro_find_temple | Mantra:Compassion | Abbot teaches on complete |
| side_restless_spirits | Mantra:Compassion application | Learn calm works better than combat |
| side_hermits_song | Mantra:Wisdom unlock | Hermit teaches on complete |
| side_tea_for_travelers | Herbalism practice | Gather ingredients |
| side_musicians_tale | Local Lore | Learn through stories |
| side_forge_blessing | Smithing + Inscription | Combine skills |
| side_mountain_peak | Athletics | Required for climb |
| main_three_trials | All mantras application | Solutions use skills |

**Status**: ✅ Good coverage - most quests teach or require skills.

---

### Audit 6: Cutscene Coverage

#### Story Beat Mapping

| Story Beat | Cutscene | Status |
|------------|----------|--------|
| Arrival | arrival_vision | ✅ |
| Meet Pema | pema_plea | ❌ Missing |
| Discover Tenzin | tenzin_cell_discovery | ❌ Missing |
| Read Journal | journal_revelation | ❌ Missing |
| Pema joins | pema_joins | ❌ Missing |
| Enter Trial 1 | attachment_temptation | ✅ |
| Complete Trial 1 | attachment_victory | ❌ Missing |
| Enter Trial 2 | aversion_fury | ✅ |
| Complete Trial 2 | aversion_victory | ❌ Missing |
| Enter Trial 3 | ignorance_maze | ✅ |
| Complete Trial 3 | ignorance_victory | ❌ Missing |
| Mara revelation | mara_revelation | ✅ |
| Mara true form | mara_true_form | ❌ Missing |
| Final choice | final_choice | ✅ |
| Liberation ending | liberation_ending | ❌ Missing |
| Destruction ending | destruction_ending | ❌ Missing |

**Major Gap**: Trial victory cutscenes and ending epilogues missing.

---

### Audit 7: Thematic Consistency

#### Theme: Liberation Through Understanding

| System | Thematic Expression | Status |
|--------|---------------------|--------|
| Combat | Violence is an option but has karma cost | ✅ |
| Meditation | Core mechanic teaches stillness | ✅ |
| Mantras | Words have power, compassion overcomes | ✅ |
| Trials | Each poison has non-violent solution | ✅ |
| Final Choice | Understanding > destruction | ✅ |
| Karma | Tracks moral choices, affects endings | ✅ |
| Crafting | ??? | ⚠️ Needs thematic tie |
| Skills | Some orphaned from theme | ⚠️ |

#### Crafting Thematic Fix

```yaml
# Crafting should embody "transformation"
# - Raw materials → refined products = suffering → wisdom
# - Failed crafts → lessons learned = mistakes → growth
# - Offering crafts → karma = generosity → merit

THEMATIC_CRAFTING:
  lesson: "Transformation is possible"

  expression:
    - Alchemy: Poison → medicine (aversion → healing)
    - Inscription: Blank paper → sutra (ignorance → wisdom)
    - Cooking: Raw → nourishing (selfish → generous)
    - Smithing: Ore → tool (rough → refined)
```

---

## Audit Summary: Required Fixes

### Critical (Must Fix)

1. **Define gathering nodes** (7 nodes minimum)
2. **Create missing NPCs**: mountain_guide, cook_tenzin
3. **Define key items**: lamp_of_wisdom, compassion_offering

### High Priority

4. **Add training dialogues** for mantra:protection, local_lore
5. **Add skill-gated room access** for mountain_peak
6. **Create trial victory cutscenes** (3 cutscenes)
7. **Create ending epilogue cutscenes** (2 cutscenes)

### Medium Priority

8. **Add quest ties for orphan skills**:
   - Cooking: Feast quest
   - Philosophy: Debate quest
   - Endurance: Survival challenge
9. **Connect bardo_realm** to main path
10. **Define preparation_chamber** purpose

### Nice to Have

11. Add weather system
12. Add more ambient NPCs (villagers, monks)
13. Add achievement system content

---

# Part 4: World Design Template

## Quick-Start Template

When designing a new hometown, fill in this template:

```yaml
# ============================================
# HOMETOWN: <name>
# Theme: <core teaching/philosophy>
# ============================================

OVERVIEW:
  name: "<Hometown Display Name>"
  theme: "<Core philosophical teaching>"
  setting: "<Physical/cultural setting>"
  tone: "<Mood: somber, joyful, mysterious, etc.>"

  player_journey:
    arrival: "<How player arrives>"
    crisis: "<What's wrong>"
    growth: "<What player learns>"
    resolution: "<How it ends>"

# --------------------------------------------
# LAYER 1: ZONES & ROOMS
# --------------------------------------------

ZONES:
  - id: hub
    name: "<Central area>"
    rooms: [<room_keys>]
    purpose: "Navigation, social, shops"

  - id: sacred
    name: "<Spiritual area>"
    rooms: [<room_keys>]
    purpose: "Training, meditation, lore"

  - id: challenge
    name: "<Dungeon/trial area>"
    rooms: [<room_keys>]
    purpose: "Combat, puzzles, bosses"

  # ... more zones

ROOMS:
  # List each room with connections, features, NPCs
  # Use spatial notation from Layer 1 schema

# --------------------------------------------
# LAYER 2: NPCs
# --------------------------------------------

NPCS:
  # For each NPC: role, location, provides, requires
  # Use NPC schema from Layer 2

  trainers:
    # One trainer per major skill

  questgivers:
    # Main quest giver + side quest givers

  merchants:
    # Shop locations

  ambient:
    # Background characters

# --------------------------------------------
# LAYER 3: ITEMS
# --------------------------------------------

ITEMS:
  key_items:
    # Quest-critical items with sources and uses

  consumables:
    # Potions, food, etc.

  materials:
    # Gathering/crafting components

  equipment:
    # Weapons, armor, accessories

GATHERING_NODES:
  # One node per gatherable material
  # Map to rooms

RECIPES:
  # Crafting recipes using local materials

# --------------------------------------------
# LAYER 4: SKILLS
# --------------------------------------------

SKILLS:
  required:
    # Skills needed for main story

  optional:
    # Skills for side content

  unique:
    # Skills only available here

SKILL_APPLICATIONS:
  # Map each skill to its uses in this hometown
  # Every skill must have ≥1 application

# --------------------------------------------
# LAYER 5: QUESTS
# --------------------------------------------

MAIN_QUEST:
  acts:
    - act: 1
      quests: [<quest_keys>]
      teaches: [<skills>]

    - act: 2
      quests: [<quest_keys>]
      tests: [<skills>]

    - act: 3
      quests: [<quest_keys>]
      applies: [<skills>]

SIDE_QUESTS:
  # Each side quest with NPC, skill tie, reward

# --------------------------------------------
# LAYER 6: NARRATIVE
# --------------------------------------------

CUTSCENES:
  act_1: [<cutscene_keys>]
  act_2: [<cutscene_keys>]
  act_3: [<cutscene_keys>]
  endings: [<cutscene_keys>]

STORY_BEATS:
  # Map story moments to triggers

# --------------------------------------------
# LAYER 7: THEME INTEGRATION
# --------------------------------------------

THEME_CHECK:
  combat: "<How combat teaches theme>"
  skills: "<How skills teach theme>"
  crafting: "<How crafting teaches theme>"
  dialogue: "<How dialogue teaches theme>"
  quests: "<How quests teach theme>"
  endings: "<How endings teach theme>"

# --------------------------------------------
# VALIDATION
# --------------------------------------------

CHECKLIST:
  □ Every room has ≥1 purpose
  □ Every NPC has defined provides/requires
  □ Every item has source AND use
  □ Every skill has trainer AND application
  □ Every quest has skill tie
  □ Every story beat has cutscene
  □ Every system expresses theme
```

---

# Part 5: Visual Notation Summary

## One-Page Reference

### Symbols

```
Entities:
  [R]  Room
  [N]  NPC
  [I]  Item
  [S]  Skill
  [Q]  Quest
  [C]  Cutscene
  [G]  Gate/Condition

Relationships:
  →    Leads to / Unlocks
  ←→   Bidirectional
  ⊕    Contains / Provides
  ⊗    Requires / Consumes
  ◆    Triggers
  ○    Optional
  ●    Required

Gates:
  (Q:id)    Quest gate
  (S:n)     Skill gate
  (L:n)     Level gate
  (K:n)     Karma gate
  (I:id)    Item gate
  (F:id)    Flag gate
```

### Example Diagram

```
[MONASTERY_GATE] ⊕[N:pema] ⊕[Q:intro_welcome]
        |
        → (Q:intro_welcome)
        |
[COURTYARD] ⊕[N:master_chen] ⊕[S:swordsmanship]
        |
        ├───────────────────┐
        ▼                   ▼
[TEMPLE]              [MEDITATION_HALL]
    ⊕                       ⊕
[N:abbot]             [N:lobsang]
    ⊕                       ⊕
[Q:main_*]            [S:meditation]
    |                       |
    └─────────┬─────────────┘
              ▼
        (Q:main_sleeping_master)
              |
[CAVE_ENTRANCE] → [TRIALS] → [HEART_CAVE]
                                  ⊕
                             [N:mara]
                                  ◆
                             [C:final_choice]
                                  |
                         ┌───────┴───────┐
                         ▼               ▼
                   [LIBERATION]    [DESTRUCTION]
```

---

## Conclusion

This World Design Schema provides:

1. **A common language** for describing game worlds
2. **Audit methodology** for catching integration gaps
3. **Validation checklists** for completeness
4. **Visual notation** for quick communication
5. **Templates** for rapid world creation

The Monastery audit revealed several gaps that need fixing:
- Missing gathering nodes (critical)
- Missing NPCs for some skills
- Missing cutscenes for story beats
- Some skills lack quest applications

With this schema, future hometowns can be designed with confidence that all systems will interlock properly from the start.
