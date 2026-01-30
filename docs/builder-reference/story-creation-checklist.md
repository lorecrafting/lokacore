# Story Creation Checklist

When creating a new story arc or zone, use this checklist to ensure all mechanics are properly supported.

---

## 1. Level & XP Progression

### Define the Level Range

- [ ] **Target level range** for this arc (e.g., 1-10, 10-20)
- [ ] **Starting level** if this is the first arc
- [ ] **Expected exit level** after completing main content

### XP Sources

- [ ] **Quest XP** - Major quests reward how much?
- [ ] **Kill XP** - Mob levels match zone progression?
- [ ] **Exploration XP** - Discovery bonuses for new areas?
- [ ] **Milestone XP** - Story achievements?

### Progression Milestones

| Level | Stat Points | Skill Points | What Unlocks |
|-------|-------------|--------------|--------------|
| 1 | 60 base | 1 | Starting skills |
| 5 | 80 | 5 | |
| 10 | 105 | 10 | |
| ... | | | |

- [ ] Map out what players unlock at each milestone
- [ ] Ensure trainers exist for new unlocks

---

## 2. Skills & Trainers

### Skill Availability Matrix

For each skill players should learn in this arc:

| Skill | Cost | Prerequisites | Trainer NPC | Location | Level Available |
|-------|------|---------------|-------------|----------|-----------------|
| kick | 1 | none | combat_trainer | training_grounds | 1 |
| bash | 1 | none | combat_trainer | training_grounds | 1 |
| parry | 1 | none | combat_trainer | training_grounds | 1 |
| ... | | | | | |

### Trainer NPCs Required

For each category of skills:

- [ ] **Combat Melee Trainer** - Location: _______
  - Teaches: kick, bash, thrust, combo_strike
  - Quest requirement to unlock? ______

- [ ] **Combat Defense Trainer** - Location: _______
  - Teaches: parry, dodge_skill, disarm
  - Quest requirement to unlock? ______

- [ ] **Magic Trainer** - Location: _______
  - Teaches: meditate, focus, ward, dispel
  - Quest requirement to unlock? ______

- [ ] **Utility Trainer** - Location: _______
  - Teaches: sneak, climb, sprint
  - Quest requirement to unlock? ______

- [ ] **Survival Trainer** - Location: _______
  - Teaches: forage, first_aid
  - Quest requirement to unlock? ______

- [ ] **Social Trainer** - Location: _______
  - Teaches: haggle, intimidate
  - Quest requirement to unlock? ______

### Skill Prerequisites Check

Ensure players can learn prerequisites BEFORE advanced skills:

```
Example skill tree check:
- parry (level 1) → dodge_skill (level 3) → evasion_mastery (level 8)
- kick + bash → combo_strike
- meditate → focus → quickcast
```

- [ ] All prerequisite skills have trainers accessible before advanced skills
- [ ] No impossible skill paths (prerequisite trainer locked behind content requiring the skill)

---

## 3. Magic System - Sanskrit Words

### Word Strata Requirements

| Stratum | INT Required | Words Available |
|---------|--------------|-----------------|
| First | 30 | 12 basic words |
| Second | 50 | +9 intermediate |
| Third | 70 | +5 advanced |

### Word Trainers Required

Players need NPCs to learn words from:

**First Stratum Words (INT 30)**
- [ ] RUPA (Form) words trainer - teaches: ASTRA, SPARSHA, HASTA, NETRA
- [ ] TATTVA (Element) words trainer - teaches: AGNI, HIMA, VAYU, PRITHVI, TEJA, JALA, VISHA, BALA

**Second Stratum Words (INT 50)**
- [ ] Advanced RUPA trainer - teaches: KAVACA, CHAKRA, KSHETRA
- [ ] Advanced TATTVA trainer - teaches: PRANA, KALA, VIDYUT, MRITYU, MAYA, AKASHA

**Third Stratum Words (INT 70)**
- [ ] Master word trainer - teaches: DVAYA, STHIRA, SHIGHRA, BHEDA, MAHA, LAGHU

### Word Trainer Matrix

| Word | Type | Stratum | Trainer NPC | Location | Quest Required? |
|------|------|---------|-------------|----------|-----------------|
| AGNI | TATTVA | 1st | fire_sage | temple | no |
| HIMA | TATTVA | 1st | ice_monk | mountain | no |
| ASTRA | RUPA | 1st | combat_mage | academy | no |
| ... | | | | | |

### Useful Spell Combinations to Enable

Ensure trainers make these combinations learnable:

| Mantra | Words | Effect | Trainers Needed |
|--------|-------|--------|-----------------|
| AGNI ASTRA | Fire + Arrow | Fire bolt | fire_sage + combat_mage |
| HIMA SPARSHA | Ice + Touch | Ice touch | ice_monk + healer |
| PRANA SPARSHA | Life + Touch | Heal | life_priest + healer |
| MAHA AGNI ASTRA | Great Fire Arrow | Big fire bolt | master + fire_sage + combat_mage |

- [ ] Players can learn basic attack combo (TATTVA + ASTRA)
- [ ] Players can learn basic heal combo (PRANA + SPARSHA)
- [ ] Players can learn basic defense (KAVACA variants)

---

## 4. Zone & Area Checklist

### Zone Definition

- [ ] **Zone key**: _______ (e.g., `monastery_grounds`)
- [ ] **Level range**: ___-___
- [ ] **Theme/setting**: _______

### Room Requirements

- [ ] Starting room defined with `starting_room: true` if applicable
- [ ] All exits connect bidirectionally (or one-way documented)
- [ ] Locked exits have keys/skills defined
- [ ] Trainer rooms are accessible

### Mob Placement

| Room | Mobs | Level | Respawn | Notes |
|------|------|-------|---------|-------|
| | | | | |

- [ ] Mob levels appropriate for zone level range
- [ ] Mob density allows progression (not too sparse/dense)
- [ ] Boss mobs have appropriate loot

---

## 5. Quest Checklist

### Main Story Quests

| Quest | Level | Giver | Rewards | Unlocks |
|-------|-------|-------|---------|---------|
| | | | XP, Gold, Items | Next quest, Trainer, Area |

- [ ] Clear progression from quest to quest
- [ ] XP rewards appropriate for level
- [ ] Story makes sense without skipping quests

### Side Quests

| Quest | Level | Type | Repeatable? | Rewards |
|-------|-------|------|-------------|---------|
| | | fetch/kill/escort/explore | | |

### Trainer Unlock Quests

Some trainers might require quest completion:

| Trainer | Unlock Quest | Quest Giver |
|---------|--------------|-------------|
| advanced_combat_trainer | "Prove Your Worth" | combat_trainer |
| word_master | "The Scholar's Test" | monastery_elder |

- [ ] Unlock quests are completable at appropriate level
- [ ] Players aren't locked out of essential skills

---

## 6. Equipment Progression

### Weapon Tiers

| Tier | Level | Example | Source |
|------|-------|---------|--------|
| Starter | 1-5 | Wooden Staff | Starting gear |
| Basic | 5-10 | Iron Sword | Shop/drops |
| Quality | 10-15 | Steel Blade | Quest reward |
| ... | | | |

### Armor Tiers

| Tier | Level | AC Range | Source |
|------|-------|----------|--------|
| Cloth | 1-5 | 1-3 | Starting |
| Leather | 5-10 | 4-8 | Shop/drops |
| Chain | 10-15 | 9-15 | Quest/craft |

- [ ] Shops sell appropriate tier equipment
- [ ] Drops match zone level
- [ ] Quest rewards are meaningful upgrades

---

## 7. Economy Check

### Gold Sources

- [ ] Mob drops scale with level
- [ ] Quest rewards provide meaningful gold
- [ ] Selling items gives reasonable returns

### Gold Sinks

- [ ] Skill training costs (if applicable)
- [ ] Equipment purchases
- [ ] Consumables (potions, bandages)
- [ ] Repairs

### Balance Check

| Level | Expected Gold/Hour | Major Purchases Available |
|-------|-------------------|---------------------------|
| 1-5 | ~50g | Basic gear, consumables |
| 5-10 | ~150g | Quality gear, training |
| 10+ | ~300g | Rare items |

---

## 8. Story Arc Narrative Checklist

### Introduction

- [ ] How does player enter this arc?
- [ ] What's the hook/motivation?
- [ ] Who are the key NPCs?

### Rising Action

- [ ] What challenges escalate tension?
- [ ] What skills/abilities does player gain?
- [ ] What lore/world-building is revealed?

### Climax

- [ ] Boss fight or major challenge
- [ ] Appropriate difficulty for expected level
- [ ] Meaningful rewards

### Resolution

- [ ] What changes in the world?
- [ ] Setup for next arc?
- [ ] Player has clear next steps

---

## 9. Integration Checks

### Skill Integration

- [ ] Combat encounters can be solved with available skills
- [ ] No required skills are unlearnable in this arc
- [ ] Skill synergies are discoverable

### Magic Integration

- [ ] Spell combinations useful for this arc's challenges
- [ ] Word trainers accessible before spells are needed
- [ ] INT requirements achievable at expected levels

### Level Integration

- [ ] Player reaches expected level through normal play
- [ ] No content requires grinding
- [ ] Optional content provides meaningful advancement

---

## 10. Testing Checklist

### Playthrough Test

- [ ] Complete main quest line start to finish
- [ ] Level progression feels natural
- [ ] No impossible skill gates
- [ ] Combat difficulty appropriate

### Edge Cases

- [ ] What if player skips side content?
- [ ] What if player over-levels?
- [ ] What if player rushes main quests?

### Trainer Access Test

- [ ] All trainers reachable
- [ ] Prerequisite skills learnable first
- [ ] Word combinations achievable

---

## Quick Reference: Monastery Arc Example

### Level Range: 1-10

### Trainers:
- **Martial Master** (combat skills) - Training Grounds
- **Elder** (magic skills, words) - Meditation Hall
- **Shadow Monk** (stealth skills) - Shadow Grove
- **Infirmary Keeper** (survival skills) - Infirmary
- **Quartermaster** (social skills) - Storage

### First Stratum Words Available:
- AGNI, HIMA (from Elder after meditation quest)
- ASTRA, SPARSHA (from Elder at level 3)
- PRANA (from Infirmary Keeper after healing quest)

### Key Unlocks:
- Level 1: Basic combat skills (kick, bash, parry)
- Level 3: Meditate, first magic words
- Level 5: Focus, ward, utility skills
- Level 7: Advanced combat skills
- Level 10: Second stratum prep (INT training)
