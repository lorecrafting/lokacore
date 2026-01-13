# TCM Herb System Revamp Proposal

## Executive Summary

This proposal revamps the herb gathering and crafting system to:
1. Replace abstract "herb patches" with individually pickable herb items on the ground
2. Use authentic Traditional Chinese Medicine (TCM) herbs with proper descriptions
3. Create TCM-based crafting formulas with progression from simple to complex
4. Integrate herbs with zone respawn system for natural regeneration

---

## Current System Analysis

### What We Have Now

**Gathering System** (`lib/loka/framework/gathering/`)
- Room-based `gathering_node` component
- Abstract "herb_patch" type in `herb_garden` room
- Random yields: healing_herbs (70%), calming_flowers (40%), rare_mountain_root (10%)
- Uses/respawn model: 5 uses, 600s respawn

**Crafting System** (`lib/loka/framework/crafting/`)
- Recipe-based crafting at stations
- 3 herb recipes: health_potion, calming_tea, willpower_tonic
- Skill/station requirements

**Quests**
- `side_tea_for_travelers`: Collect healing_herbs (3) + calming_flowers (2)

### Problems with Current System

1. **Abstract gathering**: "Gather from herb patch" feels like a slot machine, not exploration
2. **Generic items**: "Healing herbs" lacks flavor and cultural authenticity
3. **No discovery**: All yields random from same source
4. **Limited progression**: Only 3 recipes, no clear advancement path
5. **Disconnected from game world**: Herbs don't feel like part of the Tibetan Buddhist setting

---

## Proposed New System

### Core Design: Herbs as Ground Items

Instead of gathering nodes, herbs spawn as **individual items on the ground** in rooms:

```yaml
# priv/world/prototypes/items/herbs/gou_qi_zi.yml
key: gou_qi_zi
type: item
parent: base_herb
short_desc: "Goji Berries"
long_desc: "bright red berries growing on a low shrub"
extra_desc: |
  Clusters of vibrant orange-red berries, each about the size of a
  fingernail, hang from a thorny shrub. The monks call these "gou qi zi"
  and prize them for nourishing the eyes and blood. Their sweet taste
  makes them a favorite addition to healing teas.
keywords:
  - goji
  - berries
  - gou
  - qi
  - zi
primary_keyword: goji
tags:
  - item
  - herb
  - tcm
  - blood_tonic
components:
  physical:
    weight: 0.1
    stackable: true
    max_stack: 20
  valuable:
    base_price: 5
  herb:
    category: blood_tonic
    nature: neutral
    flavor: sweet
```

### TCM Herb Database (15 Herbs)

Organized by TCM category and game tier:

#### Tier 1 - Common Herbs (spawn frequently)

| Key | English | Category | Appearance |
|-----|---------|----------|------------|
| `sheng_jiang` | Fresh Ginger | Warming | Gnarled golden root pushing through soil |
| `da_zao` | Red Jujube | Blood Tonic | Red-brown dates on low branches |
| `gan_cao` | Licorice Root | Harmonizer | Brown root with sweet fragrance |
| `ju_hua` | Chrysanthemum | Cooling | Delicate white and yellow flowers |

#### Tier 2 - Uncommon Herbs (spawn less frequently)

| Key | English | Category | Appearance |
|-----|---------|----------|------------|
| `gou_qi_zi` | Goji Berries | Blood Tonic | Bright red berries on thorny shrub |
| `long_yan_rou` | Longan Fruit | Spirit Tonic | Sweet dried fruit on tree branch |
| `fu_ling` | Poria Mushroom | Draining | White fungus near pine roots |
| `bai_zhu` | White Atractylodes | Qi Tonic | White rhizome in rich soil |

#### Tier 3 - Rare Herbs (spawn infrequently, specific locations)

| Key | English | Category | Appearance |
|-----|---------|----------|------------|
| `ren_shen` | Ginseng | Qi Tonic | Human-shaped root, extremely rare |
| `bai_shao` | White Peony | Blood Tonic | Elegant pink-white root |
| `gui_zhi` | Cinnamon Twig | Warming | Aromatic reddish-brown branches |

#### Tier 4 - Legendary Herbs (quest rewards, special areas)

| Key | English | Category | Appearance |
|-----|---------|----------|------------|
| `shu_di_huang` | Prepared Rehmannia | Blood Tonic | Black sticky root |
| `shan_zhu_yu` | Asiatic Dogwood | Essence Tonic | Small red berries |
| `shan_yao` | Chinese Yam | Qi Tonic | Long starchy root |
| `mu_dan_pi` | Tree Peony Bark | Cooling | Fragrant bark from ancient peony |

### TCM Formula Recipes (8 Formulas)

Progression from 2-ingredient teas to 6-ingredient master formulas:

#### Tier 1 - Simple Teas (2 ingredients, herbalism 1)

**Chrysanthemum Goji Tea** (`recipe_ju_hua_gou_qi_cha`)
- Ingredients: ju_hua (2) + gou_qi_zi (2)
- Effect: Restores 20 HP, clears "blurred" status
- Flavor: "The Queen of Fall Flowers meets the King of Berries"

**Ginger Jujube Tea** (`recipe_jiang_zao_cha`)
- Ingredients: sheng_jiang (1) + da_zao (3)
- Effect: Cold resistance buff (5 min), restores 15 HP
- Flavor: "Warming decoction that drives away cold"

#### Tier 2 - Compound Teas (3 ingredients, herbalism 2)

**Longan Vitality Tea** (`recipe_long_yan_cha`)
- Ingredients: long_yan_rou (2) + da_zao (2) + gou_qi_zi (1)
- Effect: Restores 30 HP, +10% stamina regen (5 min)
- Flavor: "Three sweet treasures that nourish vitality"

#### Tier 3 - Classic Formulas (4 ingredients, herbalism 3)

**Four Gentlemen Decoction** (`recipe_si_jun_zi_tang`)
- Ingredients: ren_shen (1) + bai_zhu (1) + fu_ling (1) + gan_cao (1)
- Effect: +20 max stamina (10 min), restores 40 HP
- Flavor: "The cornerstone of all Qi-tonifying formulas"

#### Tier 4 - Ancient Formulas (5 ingredients, herbalism 4)

**Cinnamon Twig Decoction** (`recipe_gui_zhi_tang`)
- Ingredients: gui_zhi (1) + bai_shao (1) + sheng_jiang (2) + da_zao (3) + gan_cao (1)
- Effect: Strong cold resistance, cures "chilled" status, +15% defense (10 min)
- Flavor: "Han Dynasty formula that harmonizes vital and defensive energies"

#### Tier 5 - Master Formulas (6 ingredients, herbalism 5)

**Six-Ingredient Rehmannia Pill** (`recipe_liu_wei_di_huang_wan`)
- Ingredients: shu_di_huang (1) + shan_zhu_yu (1) + shan_yao (1) + fu_ling (1) + mu_dan_pi (1) + ze_xie (1)
- Effect: Permanent +5 max HP (caps at +50), full HP restore
- Flavor: "Three tonics, three sedatives - perfect balance"

### Herb Spawning via Zone Reset

Instead of adding new infrastructure, leverage the existing `ZoneReset` system:

```yaml
# priv/world/zones/monastery.yml
key: monastery
name: "Monastery Grounds"
reset_interval: 1800  # 30 minutes
reset_mode: always
rooms:
  - herb_garden
  - terraced_fields
  - monastery_gate

resets:
  # Common herbs in herb garden (respawn up to max)
  - type: object
    prototype: sheng_jiang
    room: herb_garden
    max: 3
  - type: object
    prototype: da_zao
    room: herb_garden
    max: 2
  - type: object
    prototype: gan_cao
    room: herb_garden
    max: 2
  - type: object
    prototype: ju_hua
    room: herb_garden
    max: 3

  # Uncommon herbs (fewer, specific locations)
  - type: object
    prototype: gou_qi_zi
    room: terraced_fields
    max: 2
  - type: object
    prototype: fu_ling
    room: herb_garden
    max: 1
```

**Benefits of this approach:**
- Uses existing, tested infrastructure
- Zone-based respawning already handles player presence
- Admin can manually trigger resets
- Easy to configure spawn rates per zone
- Items exist as real entities, not random yields

### Revised Herb Garden Room

```yaml
# priv/world/prototypes/rooms/herb_garden.yml
key: herb_garden
parent: base_room
type: room
short_desc: "Monastery Herb Garden"
long_desc: "A peaceful garden where medicinal herbs grow in neat rows."
extra_desc: |
  A walled garden sheltered from the mountain winds. Medicinal herbs
  grow in careful rows, each variety marked with a small wooden stake
  bearing its name in flowing calligraphy.

  The air is thick with fragrance - the sweet warmth of licorice root,
  the bright scent of chrysanthemum, the earthy presence of ginger.
  Small channels carry snowmelt to thirsty roots.

  Herb Master Dolkar tends this garden with devoted care.
keywords:
  - garden
  - herbs
  - medicinal
exits:
  east: monastery_gate
  south: terraced_fields
spawns:
  - prototype: herb_master_dolkar
tags:
  - outdoor
  - monastery
  - safe_zone
  - gathering
# Note: No gathering_node component - herbs spawn as items via zone reset
```

### Quest Updates

**Tea for Travelers** - Updated objectives:

```yaml
id: side_tea_for_travelers
name: "Tea for Travelers"
description: |
  Tea Vendor Karma needs fresh herbs for her healing teas.
  Chrysanthemum and goji berries grow in the monastery gardens.

objectives:
  - id: talk_karma
    type: talk
    target_id: tea_vendor
    description: "Speak with Tea Vendor Karma"
    dialogue_topic: help_needed

  - id: gather_chrysanthemum
    type: get_item
    target_id: ju_hua
    target_count: 3
    description: "Gather 3 chrysanthemum flowers"
    location_hint: herb_garden

  - id: gather_goji
    type: get_item
    target_id: gou_qi_zi
    target_count: 3
    description: "Gather 3 clusters of goji berries"
    location_hint: herb_garden

  - id: return_ingredients
    type: talk
    target_id: tea_vendor
    description: "Return the herbs to Karma"
    dialogue_topic: ingredients_ready

rewards:
  xp: 50
  gold: 15
  items:
    - recipe_ju_hua_gou_qi_cha  # Teaches the recipe
    - ju_hua_gou_qi_cha         # 2 pre-made teas
    - ju_hua_gou_qi_cha
```

**New Quest: The Four Gentlemen** (herbalism skill advancement)

```yaml
id: side_four_gentlemen
name: "The Four Gentlemen"
description: |
  Herb Master Dolkar offers to teach an ancient formula - but first,
  you must prove your knowledge by gathering its rare ingredients.

giver: herb_master_dolkar
type: side
paramita: wisdom
level_requirement: 3

prerequisites:
  quests:
    - side_tea_for_travelers
  skills:
    herbalism: 2

objectives:
  - id: talk_dolkar
    type: talk
    target_id: herb_master_dolkar
    description: "Learn about the Four Gentlemen formula"
    dialogue_topic: four_gentlemen_intro

  - id: find_ginseng
    type: get_item
    target_id: ren_shen
    target_count: 1
    description: "Find rare ginseng root"
    location_hint: mountain_cave  # New area needed

  - id: gather_atractylodes
    type: get_item
    target_id: bai_zhu
    target_count: 2
    description: "Gather white atractylodes"
    location_hint: terraced_fields

  - id: gather_poria
    type: get_item
    target_id: fu_ling
    target_count: 2
    description: "Find poria near pine roots"
    location_hint: herb_garden

  - id: gather_licorice
    type: get_item
    target_id: gan_cao
    target_count: 2
    description: "Gather licorice root"
    location_hint: herb_garden

  - id: complete_formula
    type: talk
    target_id: herb_master_dolkar
    description: "Return to Dolkar with the ingredients"
    dialogue_topic: four_gentlemen_complete

rewards:
  xp: 150
  gold: 50
  items:
    - recipe_si_jun_zi_tang  # Teaches the master formula
  skills:
    herbalism: 1  # Skill level increase
```

---

## Implementation Plan

### Phase 1: Foundation (Core herbs and basic recipes)

1. **Create base_herb parent prototype**
   - Standard herb component structure
   - Weight, stacking, value defaults

2. **Create 8 Tier 1-2 herb prototypes**
   - sheng_jiang, da_zao, gan_cao, ju_hua (common)
   - gou_qi_zi, long_yan_rou, fu_ling, bai_zhu (uncommon)

3. **Create 3 Tier 1-2 recipe prototypes**
   - recipe_ju_hua_gou_qi_cha
   - recipe_jiang_zao_cha
   - recipe_long_yan_cha

4. **Update monastery zone reset**
   - Add herb spawns to zone definition
   - Remove gathering_node from herb_garden room

5. **Update side_tea_for_travelers quest**
   - Change objectives to new herb keys
   - Update rewards

### Phase 2: Progression (Advanced herbs and formulas)

6. **Create 4 Tier 3 herb prototypes**
   - ren_shen, bai_shao, gui_zhi (+ placeholder for ze_xie)

7. **Create 2 Tier 3-4 recipe prototypes**
   - recipe_si_jun_zi_tang
   - recipe_gui_zhi_tang

8. **Create new quest: The Four Gentlemen**
   - Introduces ginseng hunting
   - Teaches advanced formula

### Phase 3: Mastery (Legendary herbs and ultimate formula)

9. **Create 4 Tier 4 herb prototypes**
   - shu_di_huang, shan_zhu_yu, shan_yao, mu_dan_pi

10. **Create master recipe**
    - recipe_liu_wei_di_huang_wan

11. **Create master herbalist quest chain**

### Phase 4: Polish

12. **Update Herb Master Dolkar dialogue**
    - Add teaching topics for each recipe tier
    - Add lore about TCM principles

13. **Add cave/mountain areas**
    - Rare herb spawning locations
    - Environmental variety

14. **Balance testing**
    - Spawn rates
    - Recipe effects
    - Quest difficulty

---

## Migration Notes

### Files to Remove/Replace

| Old File | Action |
|----------|--------|
| `items/healing_herbs.yml` | Replace with TCM herbs |
| `items/calming_flowers.yml` | Replace with ju_hua |
| `items/rare_mountain_root.yml` | Replace with ren_shen |
| `recipes/health_potion.yml` | Keep, update ingredients |
| `recipes/calming_tea.yml` | Replace with TCM formula |
| `recipes/willpower_tonic.yml` | Replace with TCM formula |
| `nodes/herb_patch.yml` | Remove (not needed) |

### Database Migration

Players with old items need conversion:
- `healing_herbs` → `sheng_jiang` (or give generic "herb bundle")
- `calming_flowers` → `ju_hua`
- `rare_mountain_root` → `ren_shen`

### Backward Compatibility

The gathering system can remain in place for other resources (mining, fishing) - this change only affects herbs.

---

## Summary

This revamp:
- **Transforms gathering** from abstract RNG to exploration-based pickup
- **Adds authenticity** with real TCM herbs and formulas
- **Creates progression** from simple teas to master formulas
- **Leverages existing systems** (zone reset) rather than new infrastructure
- **Enhances world-building** with culturally-appropriate content
- **Provides clear advancement** through skill levels and quest chains

The result is a herb/crafting system that feels like a natural part of the Tibetan monastery setting, rewards exploration, and offers meaningful progression from novice to master herbalist.
