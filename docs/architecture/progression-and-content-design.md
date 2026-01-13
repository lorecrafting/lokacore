# Loka Progression & Content Design Document

## Executive Summary

This document provides a comprehensive design for skills, crafting, progression, cutscenes, and interactive content that creates **deep, layered immersion** throughout the game. Every system teaches Buddhist philosophy through mechanics while providing meaningful player agency.

---

## Part 1: Complete Skill System

### Design Philosophy

Skills are organized into **5 categories** reflecting the Buddhist path:
1. **Body** (Physical) - Combat and survival
2. **Speech** (Social) - Communication and influence
3. **Mind** (Spiritual) - Meditation and perception
4. **Craft** (Creation) - Making and gathering
5. **Wisdom** (Knowledge) - Lore and understanding

### Skill Point Economy

| Level | Total Skill Points | Notes |
|-------|-------------------|-------|
| 1 | 0 | Starting character |
| 2 | 3 | First trainer visit |
| 5 | 12 | Unlock intermediate skills |
| 10 | 27 | Unlock advanced skills |
| 15 | 42 | Mastery path begins |
| 20 | 57 | Expert tier |
| 30 | 87 | Master tier |
| 50 | 147 | Legendary (max level) |

**Formula**: `skill_points = (level - 1) * 3`

### Complete Skill List

#### Category: Body (Physical)

```yaml
# priv/world/skills/combat/swordsmanship.yml
key: swordsmanship
name: "Swordsmanship"
category: body
description: "The art of the blade. Each level grants +2 damage with swords."
max_level: 50
point_cost_formula: level  # Level 1 costs 1, level 5 costs 5, etc.

prerequisites: []
unlocks: [sword_mastery, blade_dance]

trainers:
  - npc: master_chen
    location: monastery_gate
    max_level: 20
  - npc: wandering_swordsman
    location: mountain_pass
    max_level: 50

effects:
  per_level:
    sword_damage: +2

practice_actions:
  - action: attack_with_sword
    xp: 1
  - action: defeat_enemy_with_sword
    xp: 5

mastery_bonuses:
  level_25:
    name: "Keen Edge"
    effect: "+5% critical chance with swords"
  level_50:
    name: "One Strike"
    effect: "First attack in combat deals double damage"
```

```yaml
# priv/world/skills/combat/unarmed.yml
key: unarmed_combat
name: "Unarmed Combat"
category: body
description: "Fighting without weapons. Monks train in this art."
max_level: 50

effects:
  per_level:
    unarmed_damage: +1
    dodge_chance: +0.5%

trainers:
  - npc: master_chen
    max_level: 30
  - npc: hermit_milarepa
    max_level: 50
    requires: {quest_completed: side_hermits_song}

practice_actions:
  - action: attack_unarmed
    xp: 2
```

```yaml
# priv/world/skills/survival/endurance.yml
key: endurance
name: "Endurance"
category: body
description: "Physical resilience. Increases max health and MV."
max_level: 30

effects:
  per_level:
    max_health: +5
    max_mv: +3

trainers:
  - npc: master_chen
    max_level: 15
  - npc: mountain_guide
    max_level: 30
```

```yaml
# priv/world/skills/survival/athletics.yml
key: athletics
name: "Athletics"
category: body
description: "Running, climbing, swimming. Reduces MV costs for movement."
max_level: 30

effects:
  per_level:
    mv_cost_reduction: 2%

special_uses:
  - location: cliff_path
    check: athletics >= 10
    success: "You scale the cliff with practiced ease."
    failure: "The cliff is too treacherous without more training."
```

#### Category: Speech (Social)

```yaml
# priv/world/skills/social/persuasion.yml
key: persuasion
name: "Persuasion"
category: speech
description: "The art of convincing others. Unlocks dialogue options."
max_level: 30

effects:
  per_level:
    dialogue_options: +1  # Unlocks persuasion-gated dialogue

trainers:
  - npc: tea_vendor_karma
    max_level: 15
    requires: {quest_completed: side_tea_for_travelers}
  - npc: wandering_musician
    max_level: 30

unlocks_dialogue:
  level_5: "gentle_persuasion"
  level_15: "compelling_argument"
  level_25: "silver_tongue"
```

```yaml
# priv/world/skills/social/insight_reading.yml
key: insight_reading
name: "Reading Others"
category: speech
description: "Perceiving truth behind words. See NPC intentions and hidden dialogue."
max_level: 20

effects:
  per_level:
    npc_intention_reveal: true  # Shows NPC mood/intention in look

trainers:
  - npc: elder_drolma
    max_level: 20

special_uses:
  - trigger: examine_npc
    effect: "You sense their true feelings beneath the surface."
```

```yaml
# priv/world/skills/social/bartering.yml
key: bartering
name: "Bartering"
category: speech
description: "Negotiating prices. Better buy/sell rates at shops."
max_level: 20

effects:
  per_level:
    buy_discount: 1%
    sell_bonus: 1%

trainers:
  - npc: butcher_sonam
    max_level: 10
  - npc: blacksmith_tashi
    max_level: 20
```

#### Category: Mind (Spiritual)

```yaml
# priv/world/skills/spiritual/meditation.yml
key: meditation
name: "Meditation"
category: mind
description: "The foundation of spiritual practice. Required to meditate in rooms."
max_level: 50

effects:
  per_level:
    meditation_mv_regen: +2%
    vision_chance: +1%

prerequisites: []
unlocks: [deep_meditation, insight_meditation, walking_meditation]

trainers:
  - npc: novice_pema
    location: monastery_gate
    max_level: 5
    dialogue: "I can teach you the basics of sitting practice."
  - npc: teacher_lobsang
    location: meditation_hall
    max_level: 25
  - npc: lama_tenzin  # Post-liberation only
    location: meditation_hall
    max_level: 50
    requires: {quest_completed: main_liberation}

practice_actions:
  - action: meditate
    xp: 3
  - action: meditate_sacred_location
    xp: 10

mastery_bonuses:
  level_25:
    name: "Still Mind"
    effect: "Meditation cannot be interrupted by ambient events"
  level_50:
    name: "Enlightened Awareness"
    effect: "Gain vision on every meditation session"
```

```yaml
# priv/world/skills/spiritual/mantra_compassion.yml
key: mantra_compassion
name: "Mantra of Compassion"
category: mind
description: "Om Mani Padme Hum. Calms hostile beings and heals allies."
max_level: 30

prerequisites:
  - skill: meditation
    level: 10

effects:
  per_level:
    calm_duration: +2 seconds
    heal_amount: +3

learn_sources:
  - type: quest_reward
    quest: intro_find_temple
    dialogue: "The Abbot teaches you the sacred syllables."
  - type: object_interaction
    room: temple
    object: prayer_wheel
    first_time: true

use:
  command: "recite om mani padme hum"
  cost: {mv: 20}
  cooldown: 60
  effects:
    - type: calm_hostiles
      duration: 30
      radius: room
    - type: heal_allies
      amount: "level * 3"

special_uses:
  - location: chamber_of_aversion
    effect: "Stops enemy multiplication"
  - location: restless_spirits
    effect: "Peaceful resolution without combat"

trainers:
  - npc: teacher_lobsang
    max_level: 15
  - npc: abbot_jampa
    max_level: 30
```

```yaml
# priv/world/skills/spiritual/mantra_wisdom.yml
key: mantra_wisdom
name: "Heart Sutra"
category: mind
description: "Gate Gate Paragate. Dispels illusions and reveals hidden truths."
max_level: 20

prerequisites:
  - skill: meditation
    level: 20
  - skill: mantra_compassion
    level: 10

effects:
  per_level:
    illusion_resistance: +5%
    hidden_reveal_chance: +2%

learn_sources:
  - type: item
    item: sutra_of_perfect_wisdom
    consume: false
    message: "The ancient words burn into your memory."

use:
  command: "recite gate gate paragate"
  cost: {mv: 30}
  cooldown: 120
  effects:
    - type: dispel_illusion
      radius: room
    - type: reveal_hidden
      duration: 60

special_uses:
  - location: chamber_of_attachment
    effect: "Dispels phantom treasures instantly"
  - location: chamber_of_ignorance
    effect: "Reveals true exit from maze"

trainers:
  - npc: hermit_milarepa
    max_level: 20
    requires: {quest_completed: side_hermits_song}
```

```yaml
# priv/world/skills/spiritual/mantra_protection.yml
key: mantra_protection
name: "Vajra Mantra"
category: mind
description: "Om Vajrapani Hum. Creates protective barrier against harm."
max_level: 20

prerequisites:
  - skill: meditation
    level: 15

effects:
  per_level:
    shield_absorb: +5

use:
  command: "recite om vajrapani hum"
  cost: {mv: 25}
  cooldown: 90
  effects:
    - type: shield
      absorb: "50 + level * 5"
      duration: 30

trainers:
  - npc: abbot_jampa
    max_level: 20
    requires: {quest_completed: main_sleeping_master}
```

```yaml
# priv/world/skills/spiritual/perception.yml
key: spiritual_perception
name: "Spiritual Perception"
category: mind
description: "Sensing the unseen. Detect hidden entities and spiritual phenomena."
max_level: 30

effects:
  per_level:
    detect_hidden: +3%
    sense_karma: true  # See karma tier of NPCs

trainers:
  - npc: elder_drolma
    max_level: 15
  - npc: hermit_milarepa
    max_level: 30

special_uses:
  - trigger: enter_room
    level_required: 10
    effect: "You sense lingering spiritual energy here."
  - trigger: examine_npc
    level_required: 20
    effect: "You perceive their karmic aura."
```

#### Category: Craft (Creation)

```yaml
# priv/world/skills/crafting/herbalism.yml
key: herbalism
name: "Herbalism"
category: craft
description: "Knowledge of plants and their uses. Required for alchemy."
max_level: 50

effects:
  per_level:
    gather_herb_bonus: +2%
    alchemy_success: +1%

prerequisites: []
unlocks: [alchemy, poison_lore, botanical_mastery]

trainers:
  - npc: herb_master_dolkar
    location: herb_garden
    max_level: 30
  - npc: hermit_milarepa
    max_level: 50
    requires: {quest_completed: side_hermits_song}

practice_actions:
  - action: gather_herb
    xp: 2
  - action: craft_potion
    xp: 5
```

```yaml
# priv/world/skills/crafting/alchemy.yml
key: alchemy
name: "Alchemy"
category: craft
description: "Transforming ingredients into potions and elixirs."
max_level: 50

prerequisites:
  - skill: herbalism
    level: 5

effects:
  per_level:
    potion_potency: +2%
    crafting_success: +1%

trainers:
  - npc: herb_master_dolkar
    max_level: 25
  - npc: elder_drolma
    max_level: 50

station_required: alchemy_bench
```

```yaml
# priv/world/skills/crafting/smithing.yml
key: smithing
name: "Smithing"
category: craft
description: "Forging and repairing metal items."
max_level: 50

effects:
  per_level:
    forge_success: +1%
    repair_cost_reduction: +1%

trainers:
  - npc: blacksmith_tashi
    location: forge
    max_level: 50

station_required: forge

special_uses:
  - quest: side_forge_blessing
    effect: "Required to enchant weapons with temple blessing"
```

```yaml
# priv/world/skills/crafting/cooking.yml
key: cooking
name: "Cooking"
category: craft
description: "Preparing food that restores health and grants buffs."
max_level: 30

effects:
  per_level:
    food_heal_bonus: +3%
    buff_duration: +2%

trainers:
  - npc: cook_tenzin
    location: dining_hall
    max_level: 30

station_required: kitchen
```

```yaml
# priv/world/skills/crafting/inscription.yml
key: inscription
name: "Sacred Inscription"
category: craft
description: "Writing sutras and prayer flags. Creates spiritual items."
max_level: 30

prerequisites:
  - skill: meditation
    level: 10

effects:
  per_level:
    inscription_power: +2%

trainers:
  - npc: teacher_lobsang
    max_level: 20
  - npc: abbot_jampa
    max_level: 30

creates:
  - prayer_flags  # Buff items
  - sutra_scrolls  # Teaching items
  - blessing_papers  # Protection items
```

#### Category: Wisdom (Knowledge)

```yaml
# priv/world/skills/knowledge/buddhist_philosophy.yml
key: buddhist_philosophy
name: "Buddhist Philosophy"
category: wisdom
description: "Understanding of the dharma. Unlocks deep dialogue and karma bonuses."
max_level: 30

effects:
  per_level:
    karma_gain_bonus: +3%
    dialogue_unlocks: true

learn_sources:
  - type: dialogue
    npc: teacher_lobsang
    topic: dharma_teaching
  - type: item
    item: philosophical_text
    consume: false

trainers:
  - npc: teacher_lobsang
    max_level: 15
  - npc: abbot_jampa
    max_level: 30

unlocks_dialogue:
  level_5: "dharma_understanding"
  level_15: "philosophical_debate"
  level_25: "wisdom_transmission"
```

```yaml
# priv/world/skills/knowledge/local_lore.yml
key: local_lore
name: "Mountain Lore"
category: wisdom
description: "Knowledge of the monastery and surrounding lands."
max_level: 20

effects:
  per_level:
    hidden_location_reveal: +5%

learn_sources:
  - type: quest_completion
    quest: side_musicians_tale
    amount: 5
  - type: dialogue
    npc: elder_drolma
    topic: old_stories

trainers:
  - npc: elder_drolma
    max_level: 20

reveals:
  level_5: "You remember a hidden path near the waterfall."
  level_10: "Ancient texts mention caves beneath the monastery."
  level_15: "The mountain holds secrets from before the monastery was built."
```

```yaml
# priv/world/skills/knowledge/spirit_lore.yml
key: spirit_lore
name: "Spirit Lore"
category: wisdom
description: "Knowledge of spirits, demons, and the bardo realm."
max_level: 30

effects:
  per_level:
    demon_damage: +2%
    ghost_resistance: +2%

prerequisites:
  - skill: buddhist_philosophy
    level: 5

trainers:
  - npc: hermit_milarepa
    max_level: 30
    requires: {quest_completed: side_restless_spirits}

special_knowledge:
  level_10: "You understand the Three Poisons that bind Mara."
  level_20: "You know the true nature of demons - they are our own delusions."
  level_30: "Liberation and destruction are both paths, but only one leads to peace."
```

### Skill Summary Table

| Skill | Category | Max Level | Prerequisites | Primary Trainer |
|-------|----------|-----------|---------------|-----------------|
| Swordsmanship | Body | 50 | - | Master Chen |
| Unarmed Combat | Body | 50 | - | Master Chen |
| Endurance | Body | 30 | - | Master Chen |
| Athletics | Body | 30 | - | Mountain Guide |
| Persuasion | Speech | 30 | - | Tea Vendor Karma |
| Reading Others | Speech | 20 | - | Elder Drolma |
| Bartering | Speech | 20 | - | Butcher Sonam |
| Meditation | Mind | 50 | - | Teacher Lobsang |
| Mantra: Compassion | Mind | 30 | Meditation 10 | Abbot Jampa |
| Mantra: Wisdom | Mind | 20 | Meditation 20, Compassion 10 | Hermit Milarepa |
| Mantra: Protection | Mind | 20 | Meditation 15 | Abbot Jampa |
| Spiritual Perception | Mind | 30 | - | Hermit Milarepa |
| Herbalism | Craft | 50 | - | Herb Master Dolkar |
| Alchemy | Craft | 50 | Herbalism 5 | Herb Master Dolkar |
| Smithing | Craft | 50 | - | Blacksmith Tashi |
| Cooking | Craft | 30 | - | Cook Tenzin |
| Inscription | Craft | 30 | Meditation 10 | Teacher Lobsang |
| Buddhist Philosophy | Wisdom | 30 | - | Teacher Lobsang |
| Mountain Lore | Wisdom | 20 | - | Elder Drolma |
| Spirit Lore | Wisdom | 30 | Philosophy 5 | Hermit Milarepa |

**Total Skills: 20**
**Categories: 5**

---

## Part 2: Progression Through Storyline

### XP Curve Analysis

**Formula**: `XP needed = 100 * level^1.8`

| Level | XP Needed | Cumulative XP | Skill Points |
|-------|-----------|---------------|--------------|
| 1→2 | 100 | 100 | 3 |
| 2→3 | 348 | 448 | 6 |
| 3→4 | 652 | 1,100 | 9 |
| 4→5 | 1,000 | 2,100 | 12 |
| 5→6 | 1,390 | 3,490 | 15 |
| 6→7 | 1,818 | 5,308 | 18 |
| 7→8 | 2,281 | 7,589 | 21 |
| 8→9 | 2,778 | 10,367 | 24 |
| 9→10 | 3,307 | 13,674 | 27 |
| 10→11 | 3,866 | 17,540 | 30 |

### Quest XP Budget

**Design Goal**: Player reaches level 8-10 by final boss through main story + side quests.

| Quest | Type | XP Reward | Cumulative | Expected Level |
|-------|------|-----------|------------|----------------|
| intro_welcome | Main | 50 | 50 | 1 |
| intro_find_temple | Main | 100 | 150 | 2 |
| main_sleeping_master | Main | 300 | 450 | 2-3 |
| side_restless_spirits | Side | 200 | 650 | 3 |
| side_tea_for_travelers | Side | 150 | 800 | 3 |
| side_hermits_song | Side | 250 | 1,050 | 3-4 |
| side_butchers_burden | Side | 200 | 1,250 | 4 |
| side_musicians_tale | Side | 200 | 1,450 | 4 |
| side_forge_blessing | Side | 250 | 1,700 | 4-5 |
| side_mountain_peak | Side | 350 | 2,050 | 5 |
| main_three_trials | Main | 500 | 2,550 | 5-6 |
| main_liberation | Main | 750 | 3,300 | 6-7 |
| **Combat XP** | - | ~2,000 | 5,300 | 7-8 |
| **Exploration XP** | - | ~500 | 5,800 | 8 |
| **Crafting XP** | - | ~500 | 6,300 | 8-9 |

**Result**: Completing all content = Level 8-9, enough skill points for:
- 2-3 skills at level 10
- OR 1 skill at level 20 + 1 at level 5
- Enough to unlock key mantras and complete story

### Skill Unlock Timeline

| Story Point | Level | Skill Points | Recommended Skills |
|-------------|-------|--------------|-------------------|
| **Arrive at monastery** | 1 | 0 | - |
| **Meet Pema** | 1 | 0 | Learn Meditation basics (free) |
| **Complete intro** | 2 | 3 | Meditation 3 |
| **Explore monastery** | 2-3 | 6 | Endurance 3, Meditation 3 |
| **Side quest: Tea** | 3 | 9 | Herbalism 3, Persuasion 3 |
| **Side quest: Spirits** | 3-4 | 9-12 | Mantra: Compassion unlocked |
| **Side quest: Hermit** | 4 | 12 | Meditation 10 (unlock mantras) |
| **Main: Three Trials** | 5-6 | 15-18 | Mantra: Compassion 5+, one more mantra |
| **Main: Liberation** | 7-8 | 21-24 | Full mantra toolkit OR combat focus |

### Skill Gating in Story

**Chamber of Attachment**:
- Can be brute-forced (combat)
- Easier with: Mantra: Wisdom (dispel illusions)
- Easiest with: Meditation 15+ (resist temptation passively)

**Chamber of Aversion**:
- Can be brute-forced (dangerous - enemies multiply)
- Easier with: Mantra: Compassion (calm hostiles)
- Easiest with: Patience (stay calm for 60s)

**Chamber of Ignorance**:
- Cannot be brute-forced
- Requires: Meditation (to see through illusion)
- OR: Mantra: Wisdom (reveal true path)
- OR: Item: Lamp of Wisdom (purchasable)

**Final Boss (Mara)**:
- Combat path: Always available, but harder
- Liberation path: Requires karma >= 40 (virtuous tier)
- Best ending: Karma >= 75 (enlightened) + specific dialogue

---

## Part 3: Crafting Integration

### Crafting Categories

| Category | Station | Primary Skill | Products |
|----------|---------|---------------|----------|
| Alchemy | Alchemy Bench | Herbalism, Alchemy | Potions, elixirs, tonics |
| Cooking | Kitchen | Cooking | Foods, teas, feasts |
| Smithing | Forge | Smithing | Weapons, armor, tools |
| Inscription | Writing Desk | Inscription | Sutras, prayer flags, talismans |
| Woodworking | Workbench | (new) Carpentry | Staves, furniture, prayer wheels |

### Crafting Stations in Story

| Room | Station | Available From | Story Tie-In |
|------|---------|----------------|--------------|
| Herb Garden | Gathering | Start | Side quest: Tea ingredients |
| Herb Garden | Alchemy Bench | Start | Craft potions for trials |
| Dining Hall | Kitchen | Start | Cook meals for buffs |
| Forge | Forge, Anvil | Start | Side quest: Forge Blessing |
| Meditation Hall | Writing Desk | Quest | Craft prayer flags post-temple |
| Hermit's Cave | Special Bench | Quest | Rare recipes from Milarepa |

### Story-Integrated Recipes

#### Act 1: Preparation

```yaml
# Recipe learned from Herb Master Dolkar during tea quest
key: recipe_travelers_tea
name: "Traveler's Tea"
station: alchemy_bench
skill_required: herbalism
skill_level: 1

ingredients:
  - item: chrysanthemum_flower
    quantity: 2
  - item: goji_berry
    quantity: 3
  - item: mountain_water
    quantity: 1

output:
  - item: travelers_tea
    quantity: 1

effects_when_consumed:
  - type: restore_mv
    amount: 50
  - type: buff
    buff: road_weary_resistance
    duration: 600

xp_reward:
  skill: herbalism
  amount: 10

story_context: |
  This tea sustains pilgrims on mountain paths.
  The recipe is shared freely among those who help others.
```

```yaml
# Recipe for trial preparation
key: recipe_clarity_potion
name: "Potion of Clarity"
station: alchemy_bench
skill_required: alchemy
skill_level: 5

prerequisites:
  quest_completed: main_sleeping_master

ingredients:
  - item: lotus_essence
    quantity: 1
  - item: mountain_dew
    quantity: 2
  - item: moonlight_crystal
    quantity: 1

output:
  - item: clarity_potion
    quantity: 1

effects_when_consumed:
  - type: buff
    buff: clear_mind
    duration: 300
    effects:
      illusion_resistance: +50%
      mnd: +5

story_context: |
  Before facing the trials, wise practitioners prepare.
  This potion helps see through the illusions of the Three Poisons.
```

#### Act 2: Trial Support

```yaml
# Special recipe for Attachment Chamber
key: recipe_letting_go_incense
name: "Letting Go Incense"
station: alchemy_bench
skill_required: herbalism
skill_level: 10

prerequisites:
  quest_active: main_three_trials

ingredients:
  - item: sandalwood_chips
    quantity: 3
  - item: white_sage
    quantity: 2
  - item: morning_glory_petals
    quantity: 5

output:
  - item: letting_go_incense
    quantity: 1

use_in_room: attachment_chamber
room_effect: |
  The incense fills the chamber.
  The phantom treasures lose their luster.
  (Temptation resistance +100% for 5 minutes)
```

```yaml
# Special recipe for Aversion Chamber
key: recipe_cooling_balm
name: "Cooling Balm"
station: alchemy_bench
skill_required: alchemy
skill_level: 10

ingredients:
  - item: glacier_water
    quantity: 1
  - item: moonflower
    quantity: 3
  - item: serpent_scale
    quantity: 1

output:
  - item: cooling_balm
    quantity: 1

use_in_room: aversion_chamber
room_effect: |
  The balm cools your skin and your anger.
  (Rage meter cannot increase for 5 minutes)
```

#### Act 3: Liberation Tools

```yaml
# Recipe for final confrontation
key: recipe_compassion_offering
name: "Compassion Offering"
station: writing_desk
skill_required: inscription
skill_level: 15

prerequisites:
  karma_gte: 40

ingredients:
  - item: white_rice
    quantity: 7
  - item: butter_lamp_oil
    quantity: 1
  - item: blessed_paper
    quantity: 1
  - item: own_blood  # Special: costs 10% health
    quantity: 1

output:
  - item: compassion_offering
    quantity: 1

use_on: mara_the_deceiver
effect: |
  This offering, made with your own life force,
  can be given to Mara during the final confrontation.
  It provides an alternative to the combat path,
  allowing liberation through pure compassion.

  (Unlocks special dialogue option in final_choice cutscene)
```

### Gathering Nodes

```yaml
# priv/world/nodes/herb_garden_chrysanthemum.yml
key: herb_garden_chrysanthemum
name: "Chrysanthemum Patch"
node_type: herb
room: herb_garden

gather:
  skill: herbalism
  base_success: 80

  yields:
    - item: chrysanthemum_flower
      quantity: 1-3
      quality_weights:
        common: 70
        uncommon: 25
        rare: 5
    - item: chrysanthemum_seed
      quantity: 0-1
      chance: 20

respawn:
  time: 300  # 5 minutes
  message: "Fresh flowers have bloomed in the garden."

ambient_messages:
  - "Yellow petals sway in the mountain breeze."
  - "Bees drone lazily among the flowers."
```

```yaml
# priv/world/nodes/waterfall_spring.yml
key: waterfall_spring
name: "Sacred Spring"
node_type: water
room: waterfall_shrine

gather:
  skill: herbalism
  base_success: 100  # Always succeed for water

  yields:
    - item: sacred_spring_water
      quantity: 1
      quality_weights:
        common: 50
        blessed: 40  # Special quality for sacred water
        pure: 10

respawn:
  time: 60  # 1 minute
  message: "The spring flows eternally from the mountain's heart."

interactive:
  verb: "fill"
  requires: [water_container, flask, bottle]
  message: "You fill your container with crystal-clear water."
```

```yaml
# priv/world/nodes/cave_crystal.yml
key: cave_crystal
name: "Crystal Formation"
node_type: mineral
room: cave_entrance

gather:
  skill: mining  # New skill or use generic
  base_success: 60
  tool_required: pickaxe

  yields:
    - item: cave_crystal
      quantity: 1
      quality_weights:
        common: 60
        clear: 30
        moonlight: 10

respawn:
  time: 3600  # 1 hour
  message: "Crystals have slowly regrown in the darkness."

special:
  time_of_day: night
  bonus: "+20% moonlight crystal chance"
```

---

## Part 4: Expanded Cutscenes

### Current Cutscenes (6)
1. first_vision - Meditation Hall trigger
2. attachment_temptation - Chamber entry
3. aversion_fury - Chamber entry
4. ignorance_maze - Chamber entry
5. mara_revelation - Heart Cave entry
6. final_choice - Mara defeated

### Proposed New Cutscenes (12 additional)

#### Prologue Cutscenes

```yaml
# priv/world/cutscenes/arrival_vision.yml
key: arrival_vision
name: "The Call"

trigger:
  type: first_enter
  location: monastery_gate
  condition: {quest_active: intro_welcome}

sequence:
  - type: narration
    text: |
      As you pass through the ancient gates, a chill runs down your spine.
      For a moment, the world seems to shimmer...
    duration: 4

  - type: fade_out
    duration: 1

  - type: vision
    text: |
      You see an old man sitting in meditation, surrounded by darkness.
      Shadowy hands reach toward him from all directions.
      His lips move, but no sound reaches you.
    duration: 5

  - type: fade_in
    duration: 1

  - type: narration
    text: |
      The vision fades. The prayer flags snap in the wind.
      Something here needs you. You feel it in your bones.
    duration: 4

effects:
  - set_flag: had_arrival_vision
  - message: "A sense of purpose fills you."
```

```yaml
# priv/world/cutscenes/pema_plea.yml
key: pema_plea
name: "Pema's Tears"

trigger:
  type: dialogue_complete
  npc: novice_pema
  topic: tenzin_condition

sequence:
  - type: dialogue
    speaker: "Novice Pema"
    text: |
      She looks at you with desperate hope.
    emotion: pleading
    duration: 2

  - type: dialogue
    speaker: "Novice Pema"
    text: |
      "Please... Lama Tenzin is like a father to me.
      He found me abandoned as a child.
      Without him, I have no one."
    emotion: tearful
    duration: 5

  - type: player_choice
    choices:
      - text: "I will do everything I can to help."
        effects:
          - karma: +5
          - flag: promised_pema
          - dialogue_unlock: pema_gratitude
      - text: "I make no promises, but I will try."
        effects:
          - karma: +2
          - flag: cautious_with_pema
      - text: "Why should I risk myself for a stranger?"
        effects:
          - karma: -3
          - flag: cold_to_pema
          - dialogue_unlock: pema_disappointed

  - type: narration
    text: |
      Pema wipes her eyes and bows deeply.
    duration: 2

effects:
  - set_flag: pema_cutscene_complete
```

#### Discovery Cutscenes

```yaml
# priv/world/cutscenes/tenzin_cell_discovery.yml
key: tenzin_cell_discovery
name: "The Imprisoned Master"

trigger:
  type: first_enter
  location: tenzins_cell
  condition: {quest_active: main_sleeping_master}

sequence:
  - type: narration
    text: |
      The small cell seems impossibly vast inside.
      Space bends around the figure seated at its center.
    duration: 4

  - type: visual
    description: |
      An old man sits in perfect stillness, but his brow is furrowed.
      Golden light surrounds him like a protective cocoon,
      but dark threads probe at its surface, seeking entry.
    duration: 5

  - type: narration
    text: |
      His lips move constantly, whispering mantras.
      The battle is invisible, but you feel its weight
      pressing against your chest.
    duration: 4

  - type: sound
    description: "Faint chanting, mixing with something darker"
    duration: 2

  - type: narration
    text: |
      On a small table, you notice a worn leather journal.
      It seems important.
    duration: 3
    highlight_object: meditation_journal

effects:
  - set_flag: witnessed_tenzin
  - advance_quest:
      quest: main_sleeping_master
      objective: visit_tenzin
```

```yaml
# priv/world/cutscenes/journal_revelation.yml
key: journal_revelation
name: "Tenzin's Warning"

trigger:
  type: item_read
  item: meditation_journal
  first_time: true

sequence:
  - type: narration
    text: |
      You open the journal carefully. The handwriting starts neat
      but grows increasingly erratic in later entries.
    duration: 4

  - type: document
    title: "Three Months Ago"
    text: |
      "The practice deepens. I venture further into samadhi
      each session. Something watches from the depths,
      but it does not trouble me."
    duration: 6

  - type: document
    title: "Two Months Ago"
    text: |
      "I have made contact. A presence that calls itself
      the essence of liberation. But its touch leaves
      a bitter taste in my consciousness."
    duration: 6

  - type: document
    title: "One Month Ago"
    text: |
      "It was never liberation. The Three Poisons wear
      many masks. I have been fighting my own shadow,
      and in doing so, gave it strength. I must go deeper
      to confront what I have awakened."
    duration: 8

  - type: document
    title: "Final Entry (Unfinished)"
    text: |
      "If you are reading this, I have failed to return.
      The cave beneath the old stupa - that is where I go.
      Seek the Abbot. He knows what must be done.
      Remember: the demon is not other. The demon is—"
    duration: 8

  - type: narration
    text: |
      The entry ends mid-sentence.
      A cold weight settles in your stomach.
    duration: 3

effects:
  - set_flag: read_journal
  - advance_quest:
      quest: main_sleeping_master
      objective: find_journal
  - unlock_journal_entry:
      quest: main_sleeping_master
      entry: journal_revelation
```

#### Companion Cutscenes

```yaml
# priv/world/cutscenes/pema_joins.yml
key: pema_joins
name: "A Companion's Courage"

trigger:
  type: quest_complete
  quest: main_sleeping_master
  condition: {flag: promised_pema}

sequence:
  - type: narration
    text: |
      As you prepare to descend into the caves,
      footsteps approach from behind.
    duration: 3

  - type: dialogue
    speaker: "Novice Pema"
    text: |
      "Wait!"

      Pema stands at the cave entrance, clutching a small bag.
      Her hands tremble, but her jaw is set.
    duration: 4

  - type: dialogue
    speaker: "Novice Pema"
    text: |
      "I know I'm not a warrior. I know I'll slow you down.
      But Lama Tenzin is down there because of something
      in all of us. I have to face it too."
    emotion: determined
    duration: 5

  - type: player_choice
    choices:
      - text: "Your courage honors him. Come."
        effects:
          - karma: +3
          - add_companion: novice_pema
          - dialogue_unlock: pema_grateful_companion
      - text: "It's too dangerous. Wait here and pray for us."
        effects:
          - karma: +1
          - flag: pema_stayed_behind
          - dialogue_unlock: pema_reluctant_acceptance
      - text: "You'll only get in the way."
        effects:
          - karma: -5
          - flag: rejected_pema_harshly
          - dialogue_unlock: pema_hurt

  - type: narration
    text: |
      The wind howls from the cave depths.
      Whatever awaits, there is no turning back.
    duration: 3

effects:
  - set_flag: pema_companion_choice_made
```

#### Trial Enhancement Cutscenes

```yaml
# priv/world/cutscenes/attachment_victory.yml
key: attachment_victory
name: "Seeing Through Desire"

trigger:
  type: trial_complete
  trial: attachment
  method: resistance  # Didn't take any treasures

sequence:
  - type: narration
    text: |
      The phantom treasures flicker and fade.
      In their place, you see what was always there:
      empty air and cold stone.
    duration: 4

  - type: vision
    text: |
      For a moment, you see your own hands reaching—
      all the things you've grasped for in your life
      dissolving like morning mist.
    duration: 5

  - type: dialogue
    speaker: "A voice within"
    text: |
      "What we cling to, we cannot hold.
      What we release, returns transformed."
    duration: 4

  - type: narration
    text: |
      Understanding settles into your bones.
      The first chain is broken.
    duration: 3

effects:
  - karma: +5
  - add_buff:
      buff: non_attachment
      duration: permanent
      effect: "Immune to treasure-type temptations"
  - advance_quest:
      quest: main_three_trials
      objective: defeat_attachment
```

```yaml
# priv/world/cutscenes/aversion_victory.yml
key: aversion_victory
name: "The Heart Opens"

trigger:
  type: trial_complete
  trial: aversion
  method: calm  # Stayed calm, didn't attack

sequence:
  - type: narration
    text: |
      The shadows stop their assault.
      In the sudden stillness, they seem confused,
      like puppets whose strings have been cut.
    duration: 4

  - type: vision
    text: |
      You see faces in the shadows—not monsters,
      but wounded things. Hurt creatures lashing out
      from their own pain.
    duration: 5

  - type: narration
    text: |
      Compassion rises unbidden.
      These are not enemies. They are suffering.
    duration: 4

  - type: dialogue
    speaker: "You (speaking softly)"
    text: |
      "I will not fight you. I see your pain."
    duration: 3

  - type: narration
    text: |
      The shadows bow—and dissolve into light.
      The second chain is broken.
    duration: 4

effects:
  - karma: +7
  - add_buff:
      buff: open_heart
      duration: permanent
      effect: "+20% healing given and received"
  - advance_quest:
      quest: main_three_trials
      objective: defeat_aversion
```

```yaml
# priv/world/cutscenes/ignorance_victory.yml
key: ignorance_victory
name: "Clear Seeing"

trigger:
  type: trial_complete
  trial: ignorance
  method: meditation  # Meditated to see truth

sequence:
  - type: narration
    text: |
      In the stillness of meditation, the maze dissolves.
      There never was a maze—only your confusion,
      given form by your own mind.
    duration: 5

  - type: vision
    text: |
      You see clearly now: the walls were your assumptions.
      The false paths were your habitual thoughts.
      The true way was always here, hidden in plain sight.
    duration: 6

  - type: narration
    text: |
      The chamber is small and simple.
      A single door leads onward.
      You understand now why you couldn't see it before.
    duration: 4

  - type: dialogue
    speaker: "Your own voice, calm"
    text: |
      "I am not my thoughts. I am not my confusion.
      I am the awareness that sees them both."
    duration: 4

  - type: narration
    text: |
      The third and final chain is broken.
      The way to the heart is open.
    duration: 3

effects:
  - karma: +7
  - add_buff:
      buff: clear_seeing
      duration: permanent
      effect: "Can see through all illusions"
  - advance_quest:
      quest: main_three_trials
      objective: defeat_ignorance
  - unlock_area: heart_cave
```

#### Climax Cutscenes

```yaml
# priv/world/cutscenes/mara_true_form.yml
key: mara_true_form
name: "The Mirror"

trigger:
  type: combat_phase
  enemy: mara_the_deceiver
  phase: 2  # At 50% health

sequence:
  - type: combat_pause
    duration: 1

  - type: narration
    text: |
      Mara staggers back, form flickering.
      For a moment, his face shifts—
      and you see your own features staring back.
    duration: 4

  - type: dialogue
    speaker: "Mara"
    text: |
      "Do you see now? Do you finally understand?
      I am not some foreign invader.
      I AM YOU."
    emotion: triumphant_despair
    duration: 5

  - type: visual
    description: |
      Mara's form stabilizes, but now you cannot unsee it.
      Every gesture mirrors something in yourself.
      Every snarl echoes a thought you've had.
    duration: 4

  - type: dialogue
    speaker: "Mara"
    text: |
      "Your attachments. Your aversions. Your blindness.
      I am everything you fear you are.
      Kill me, and you kill yourself."
    duration: 5

  - type: narration
    text: |
      The words hang in the air.
      This battle was never about defeating a monster.
    duration: 3

effects:
  - set_flag: saw_mara_truth
  - update_combat:
      enemy: mara_the_deceiver
      phase: 2
      dialogue_enabled: true
```

#### Epilogue Cutscenes

```yaml
# priv/world/cutscenes/liberation_ending.yml
key: liberation_ending
name: "The Light Returns"

trigger:
  type: ending_chosen
  ending: liberation

sequence:
  - type: narration
    text: |
      You kneel before Mara—before yourself—
      and speak the words that have been forming
      in your heart since you first entered these caves.
    duration: 4

  - type: dialogue
    speaker: "You"
    text: |
      "I see you. I accept you. You are part of me,
      but you do not control me. I offer you
      not destruction, but transformation."
    duration: 5

  - type: narration
    text: |
      You reach out your hand.
      Mara hesitates—and takes it.
    duration: 3

  - type: visual
    description: |
      Light floods the chamber. Not harsh, but gentle.
      Mara's form dissolves into golden motes
      that sink into your chest, where they belong.
    duration: 5

  - type: narration
    text: |
      Behind where Mara stood, Lama Tenzin
      opens his eyes for the first time in months.
      Tears stream down his weathered face.
    duration: 4

  - type: dialogue
    speaker: "Lama Tenzin"
    text: |
      "You did what I could not.
      You faced the demon without becoming one.
      The dharma lives in you, young friend."
    duration: 5

  - type: fade_out
    duration: 2

  - type: narration
    text: |
      The monastery celebrates for seven days.
      But you know this is not an ending.
      It is the first step of a longer journey.

      The path is clear now.
      You need only walk it.
    duration: 8

  - type: credits
    text: |
      LOKA
      A Journey Through the Mountain

      You chose the path of compassion.
      May all beings find such peace.

effects:
  - set_ending: liberation
  - karma: +20
  - unlock_achievement: liberator
  - unlock_new_game_plus: wisdom_path
```

```yaml
# priv/world/cutscenes/destruction_ending.yml
key: destruction_ending
name: "The Shadow Passes"

trigger:
  type: ending_chosen
  ending: destruction

sequence:
  - type: narration
    text: |
      You strike the final blow.
      Mara screams—and the sound is your own voice.
    duration: 3

  - type: visual
    description: |
      The demon dissolves into ash and shadow.
      But something goes with it. A weight lifts,
      but so does something else. Something you can't name.
    duration: 5

  - type: narration
    text: |
      Lama Tenzin opens his eyes.
      He looks at you for a long moment,
      and something in his gaze makes you look away.
    duration: 4

  - type: dialogue
    speaker: "Lama Tenzin"
    text: |
      "It is done. The demon is gone.
      But tell me, young one...
      do you feel lighter, or heavier?"
    duration: 5

  - type: narration
    text: |
      You have no answer.

      The monastery celebrates, but the joy
      does not quite reach your heart.
      Something is missing. Something you destroyed
      along with the demon.
    duration: 6

  - type: dialogue
    speaker: "Lama Tenzin"
    text: |
      "You have won the battle.
      But the war continues within.
      Perhaps... perhaps that is the lesson."
    duration: 5

  - type: fade_out
    duration: 2

  - type: narration
    text: |
      The mountain returns to peace.
      But in quiet moments, you still hear
      Mara's dying words echoing:

      "I will return. I always do.
      I am you."
    duration: 8

  - type: credits
    text: |
      LOKA
      A Journey Through the Mountain

      You chose the path of destruction.
      The demon is defeated.
      But is it gone?

effects:
  - set_ending: destruction
  - karma: -10
  - unlock_achievement: destroyer
  - unlock_new_game_plus: shadow_path
  - set_flag: mara_will_return  # Sets up sequel/NG+ content
```

---

## Part 5: Interactive World Objects

### Design Philosophy

Every room should have **at least one** interactive element beyond exits. These create "verb richness" - more things to do, more ways to engage.

### Object Categories

1. **Consumables** - Drink, eat (fountains, food)
2. **Examinables** - Deeper lore on inspection
3. **Usables** - Action with effect (prayer wheel, bell)
4. **Gatherables** - Resource collection
5. **Craftables** - Workstations
6. **Teachables** - Learn from (statues, murals)

### Fountain System

```yaml
# priv/world/prototypes/objects/fountains.yml
# Template for fountain objects

base_fountain:
  type: object
  subtype: fountain
  keywords: [fountain, water, spring]

  components:
    interactive:
      examine:
        default: "Water flows from carved stone."

      drink:
        verb: "drink"
        cooldown: 300  # 5 minutes
        message: "You cup the cool water in your hands and drink deeply."
        effects:
          - type: restore_resource
            resource: mv
            amount: 20%
          - type: restore_resource
            resource: health
            amount: 10%

# Specific fountains

monastery_fountain:
  parent: base_fountain
  key: monastery_fountain
  name: "Courtyard Fountain"

  components:
    interactive:
      examine:
        default: "A lotus-shaped fountain bubbles in the courtyard center."
        mnd_15: "The water carries a faint blessing. Drinking would be restorative."

      drink:
        message: "The blessed water refreshes body and spirit."
        effects:
          - type: restore_resource
            resource: mv
            amount: 30%
          - type: restore_resource
            resource: health
            amount: 15%
          - type: apply_status
            status: blessed
            duration: 300

sacred_spring:
  parent: base_fountain
  key: sacred_spring
  name: "Sacred Spring"
  room: waterfall_shrine

  components:
    interactive:
      examine:
        default: "Crystal water flows from the living rock."
        mnd_20: "This water has never seen impurity. It carries the mountain's essence."

      drink:
        message: "The water tastes of stone and sky and something eternal."
        effects:
          - type: restore_resource
            resource: health
            amount: 100%
          - type: restore_resource
            resource: mv
            amount: 100%
          - type: apply_status
            status: purified
            duration: 600
        first_time:
          message: "As you drink, visions flash—the spring has been here since before humans came."
          effects:
            - type: karma
              delta: 2
            - type: flag
              flag: drank_sacred_spring

cave_pool:
  key: cave_pool
  name: "Still Pool"
  room: cave_entrance

  components:
    interactive:
      examine:
        default: "A dark pool reflects the faint light."
        mnd_10: "Something moves in the depths. Or is it your reflection?"

      drink:
        message: "The water is cold and tastes of minerals."
        effects:
          - type: restore_resource
            resource: mv
            amount: 15%

      gaze:
        verb: "gaze"
        cooldown: 600
        message: "You stare into the still water..."
        effects:
          - type: script
            script: cave_pool_vision
        requires:
          - skill: meditation
            level: 5
```

### Shrine System

```yaml
# priv/world/prototypes/objects/shrines.yml

base_shrine:
  type: object
  subtype: shrine
  keywords: [shrine, altar, sacred]

  components:
    interactive:
      examine:
        default: "A small shrine with offerings."

      pray:
        verb: "pray"
        duration: 30  # seconds
        cooldown: 3600  # 1 hour
        message: "You kneel and offer prayers."
        effects:
          - type: apply_status
            status: blessed
            duration: 600

buddha_shrine:
  parent: base_shrine
  key: buddha_shrine
  name: "Buddha Shrine"

  components:
    interactive:
      examine:
        default: "A golden Buddha statue sits in serene meditation."
        mnd_10: "The statue's half-smile holds infinite compassion."
        mnd_20: "For a moment, the Buddha seems to breathe."

      pray:
        message: "You bow before the Awakened One."
        effects:
          - type: apply_status
            status: blessed
            duration: 600
          - type: karma
            delta: 1

      offer:
        verb: "offer"
        accepts:
          - item: incense
            effects:
              - type: message
                text: "Fragrant smoke rises toward the Buddha."
              - type: karma
                delta: 3
              - type: apply_status
                status: blessed
                duration: 1200
          - item: flowers
            effects:
              - type: message
                text: "You arrange the flowers before the shrine."
              - type: karma
                delta: 2
          - item: butter_lamp_oil
            effects:
              - type: message
                text: "A new flame joins those already burning."
              - type: karma
                delta: 2
              - type: room_effect
                effect: increased_light
                duration: 3600

ancestor_shrine:
  key: ancestor_shrine
  name: "Ancestor Shrine"
  room: village_square

  components:
    interactive:
      examine:
        default: "Wooden tablets bear the names of those who came before."
        local_lore_10: "You recognize some of the names from village stories."

      pray:
        message: "You bow to those who walked this path before you."
        effects:
          - type: apply_status
            status: ancestor_blessing
            duration: 300
            effect: "+5% experience gain"

      offer:
        accepts:
          - item: rice
            effects:
              - type: message
                text: "The ancestors are pleased by your offering."
              - type: karma
                delta: 2
          - item: butter_tea
            effects:
              - type: message
                text: "Steam rises from the tea, carrying your respect to the beyond."
              - type: karma
                delta: 3
```

### Bell System

```yaml
# priv/world/prototypes/objects/bells.yml

temple_bell:
  key: temple_bell
  name: "Great Temple Bell"
  room: temple

  components:
    interactive:
      examine:
        default: "A massive bronze bell hangs from ancient timbers."
        mnd_15: "The bell seems to hum with accumulated prayers."

      ring:
        verb: "ring"
        cooldown: 60
        message: "BONNNNNG! The bell's voice fills the temple."
        room_message: "The temple bell rings, its voice echoing across the monastery."
        effects:
          - type: room_effect
            effect: bell_resonance
            duration: 60
            description: "All in the temple receive +10% meditation bonus"
          - type: clear_status
            status: [confused, frightened, angry]
            targets: room

prayer_bell:
  key: prayer_bell
  name: "Hand Bell"
  room: meditation_hall

  components:
    interactive:
      examine:
        default: "A small brass bell with a wooden handle."

      ring:
        verb: "ring"
        cooldown: 30
        message: "The clear tone cuts through mental fog."
        effects:
          - type: clear_status
            status: confused
          - type: apply_status
            status: focused
            duration: 120
```

### Mural/Teaching Objects

```yaml
# priv/world/prototypes/objects/murals.yml

wheel_of_life_mural:
  key: wheel_of_life
  name: "Wheel of Life Mural"
  room: temple

  components:
    interactive:
      examine:
        default: "A vast circular painting covers the wall."
        levels:
          buddhist_philosophy_0: |
            You see a complex circular design with many figures.
            It seems to tell a story, but you don't understand it.
          buddhist_philosophy_5: |
            The Wheel of Life depicts the six realms of existence.
            At the center, three animals chase each other:
            pig, rooster, and snake. The Three Poisons.
          buddhist_philosophy_15: |
            Each realm teaches a lesson. The hungry ghosts
            show the suffering of craving. The hell realms
            show the burning of hatred. The animal realm
            shows the fog of ignorance.
          buddhist_philosophy_25: |
            You see now that the wheel is held by Yama,
            lord of death. But outside the wheel stands
            the Buddha, pointing to the path of liberation.
            The wheel is not a prison—it is a classroom.

      study:
        verb: "study"
        duration: 60
        cooldown: 3600
        requires:
          skill: buddhist_philosophy
          level: 1
        effects:
          - type: skill_xp
            skill: buddhist_philosophy
            amount: 25
          - type: message
            text: "You gain deeper understanding of the dharma."
```

### Complete Room Example with Objects

```yaml
# priv/world/prototypes/rooms/temple_enhanced.yml
key: temple
type: room
parent: base_room
name: "Main Temple"
subtype: sacred

description: |
  Butter lamps flicker before a towering golden Buddha,
  casting dancing shadows across painted murals of the
  Buddha's life. The air is thick with juniper incense.

  A great bronze bell hangs near the entrance. Prayer cushions
  line the floor before the altar. A stone fountain bubbles
  softly in an alcove.

interactive_objects:
  golden_buddha:
    inherit: buddha_shrine
    position: center

  temple_bell:
    inherit: temple_bell
    position: entrance

  temple_fountain:
    inherit: monastery_fountain
    position: alcove

  butter_lamps:
    name: "Butter Lamps"
    keywords: [lamps, butter lamps, lights, offerings]
    examine:
      default: "Rows of flickering butter lamps cast dancing shadows."
      mnd_10: "Each flame represents a prayer, a wish for liberation."
    interact:
      verb: "light"
      cost:
        item: butter_lamp_oil
        consume: true
      effects:
        - type: message
          text: "You add your light to the collective prayer."
        - type: karma
          delta: 1
        - type: apply_status
          status: blessed
          duration: 300
      cooldown: 300

  prayer_cushions:
    name: "Prayer Cushions"
    keywords: [cushions, zafu, seats, meditation]
    examine:
      default: "Well-worn cushions face the Buddha."
    interact:
      verb: "meditate"
      triggers: meditation_action

  wheel_of_life:
    inherit: wheel_of_life_mural
    position: east_wall

  incense_holder:
    name: "Incense Holder"
    keywords: [incense, holder, brass]
    examine:
      default: "A brass holder with sand for standing incense sticks."
    interact:
      verb: "offer"
      accepts:
        - item: incense_stick
          effects:
            - type: message
              text: "Fragrant smoke rises toward the rafters."
            - type: karma
              delta: 1
            - type: room_effect
              effect: incense_aroma
              duration: 600

meditation:
  enabled: true
  quality: sacred
  first_time:
    flag: meditated_temple
    effects:
      - type: karma
        delta: 2
      - type: message
        text: "The temple's accumulated holiness deepens your practice."

on_enter:
  - type: apply_status
    status: blessed
    duration: 60
    message: "The temple's sacred atmosphere washes over you."

ambient_messages:
  dawn:
    - "Monks file in silently for morning prayers."
    - "The first light touches the Buddha's serene face."
  day:
    - "A monk adjusts the butter lamps, adding fresh oil."
    - "Incense smoke curls lazily toward the high ceiling."
    - "Someone quietly recites mantras in a corner."
  night:
    - "A single monk sits in meditation before the Buddha."
    - "Shadows dance in the flickering lamp-light."
    - "The temple settles into profound stillness."

senses:
  sound:
    ambient: "Distant chanting mingles with the fountain's gentle music."
    dawn: "A single bell rings, clear as mountain water."
  smell:
    ambient: "Juniper incense, butter lamp smoke, and aged wood."
  touch:
    floor: "Cool flagstones worn smooth by countless prostrations."
    air: "The air feels thick with accumulated prayer."
```

---

## Part 6: Additional Systems

### Achievement System (Tied to Skills/Story)

```yaml
# priv/world/achievements/spiritual_achievements.yml
achievements:
  first_meditation:
    name: "First Stillness"
    description: "Complete your first meditation session."
    trigger:
      type: action_complete
      action: meditate
    reward:
      xp: 25
      title: "Beginner"

  mantra_learned:
    name: "Sacred Words"
    description: "Learn your first mantra."
    trigger:
      type: skill_learned
      skill_category: mantra
    reward:
      xp: 50
      karma: 5

  trial_master:
    name: "Beyond the Three Poisons"
    description: "Complete all three trials without using combat."
    trigger:
      type: quest_complete
      quest: main_three_trials
      condition:
        flag: all_trials_peaceful
    reward:
      xp: 200
      title: "Peaceful Warrior"
      item: robe_of_serenity

  liberator:
    name: "The Compassionate Path"
    description: "Free Mara through compassion rather than destruction."
    trigger:
      type: ending_achieved
      ending: liberation
    reward:
      title: "Liberator"
      unlock: new_game_plus_wisdom

  completionist:
    name: "The Long Path"
    description: "Complete all side quests before facing Mara."
    trigger:
      type: quest_complete
      quest: main_three_trials
      condition:
        all_quests_complete:
          - side_restless_spirits
          - side_hermits_song
          - side_mountain_peak
          - side_butchers_burden
          - side_tea_for_travelers
          - side_musicians_tale
          - side_forge_blessing
    reward:
      xp: 500
      item: masters_walking_staff
      title: "Bodhisattva"
```

### Future: Blueprint/Building System

```yaml
# Design notes for future housing/building system
# Uses same crafting mechanics but outputs "blueprints"

blueprint_system:
  concept: |
    Players can craft "blueprints" that create rooms.
    This uses the same skill (inscription/architecture)
    and crafting station (architect's table) as other crafting.

  workflow:
    1. Player gathers materials (stone, wood, etc.)
    2. Player has architecture/inscription skill
    3. Player crafts blueprint at architect's table
    4. Player uses blueprint in designated area
    5. Room is created with basic exits

  example_blueprint:
    key: blueprint_meditation_hut
    name: "Meditation Hut Blueprint"
    station: architects_table
    skill_required: inscription
    skill_level: 20

    ingredients:
      - item: blueprint_paper
        quantity: 1
      - item: architects_ink
        quantity: 1
      - item: wooden_planks
        quantity: 10
      - item: stone_blocks
        quantity: 5

    output:
      - item: meditation_hut_blueprint
        quantity: 1

    use:
      command: "build meditation hut"
      location_type: housing_zone
      creates_room:
        template: player_meditation_hut
        owner: player
        features:
          - meditation_spot (sacred quality)
          - storage_chest
```

---

## Part 7: Balance Summary

### Skill Point Distribution Recommendation

| Level Range | Focus | Example Allocation |
|-------------|-------|-------------------|
| 1-3 | Basics | Meditation 3, Endurance 3 |
| 4-6 | Specialty | Meditation 10 (unlock mantras) OR Combat 10 |
| 7-10 | Expansion | First mantra 5, Secondary skill 5 |
| 11-15 | Mastery | Primary to 20, unlock advanced skills |
| 16-20 | Diversification | Crafting skills, knowledge skills |
| 21-30 | Expertise | Multiple 20+ skills |
| 31-50 | Legendary | Mastery bonuses, rare abilities |

### XP Sources Summary

| Source | XP Range | Frequency |
|--------|----------|-----------|
| Main Quest | 100-750 | 4 quests |
| Side Quest | 150-350 | 7 quests |
| Combat (per enemy) | 10-50 | Frequent |
| Crafting (per item) | 5-25 | Frequent |
| Gathering (per node) | 2-10 | Frequent |
| Meditation (per session) | 5-20 | Frequent |
| Discovery (first time) | 10-50 | Limited |
| Achievement | 25-500 | Limited |

### Karma Economy

| Action | Karma Change |
|--------|--------------|
| Compassionate dialogue | +1 to +5 |
| Helping NPC | +2 to +7 |
| Peaceful trial resolution | +5 to +7 |
| Liberation ending | +20 |
| Harsh dialogue | -1 to -5 |
| Violence when avoidable | -3 to -7 |
| Destruction ending | -10 |
| Offering at shrine | +1 to +3 |

---

## Conclusion

This design creates a **deeply interconnected** system where:

1. **Skills matter for story** - Mantras unlock trial solutions, perception reveals NPC intentions
2. **Crafting supports progression** - Potions help with trials, inscriptions create spiritual items
3. **Cutscenes reward choices** - Different paths through trials create different narrative moments
4. **Interactive objects add density** - Every room has things to do, not just things to see
5. **Everything teaches Buddhism** - Mechanics embody dharma, not just dialogue

The player's journey is:
- **Act 1**: Learn basics (meditation, herbalism), understand the crisis
- **Act 2**: Develop skills (mantras, crafting), prepare for trials
- **Act 3**: Apply wisdom (trial solutions), face culminating choice

Every system reinforces the central theme: **liberation comes through understanding, not violence**.
