# Core Mechanics Design

> **Status:** MVP Specification
> **Last Updated:** 2026-01-29
> **Influences:** LegendMUD, Ultima Online

This document defines the core mechanical systems for Loka MVP.

---

## Design Philosophy

1. **Simple foundation, emergent depth** - Few systems that interact richly
2. **Choices matter** - Scarcity creates meaningful decisions
3. **Stats = power, Skills = capability** - What you CAN do vs how WELL you do it
4. **Hybrid builds encouraged** - STR mage, DEX warrior, CON caster all viable
5. **Touch-first interface** - No typing commands, tap-based interactions

---

## Stats

Six primary stats determine character power (LegendMUD style).

| Stat | Abbr | Primary Role | Combat Bonus |
|------|------|--------------|--------------|
| **Strength** | STR | Physical power | Slashing damage |
| **Dexterity** | DEX | Speed, precision | Piercing damage, dodge |
| **Constitution** | CON | Durability | Bludgeoning damage, HP |
| **Intelligence** | INT | Mental capacity | Mana pool, spell slots |
| **Perception** | PER | Awareness | Crit chance, detection |
| **Spirit** | SPI | Magical power | Spell damage, magic resist |

### Allocation

- **Starting pool:** 60 points at character creation
- **Min per stat:** 5
- **Max per stat at creation:** 30
- **Per level:** +5 stat points
- **Level 50 total:** ~300 points (60 base + 240 from levels)
- **Max per stat:** 100

### Gear and Stats

**Gear does NOT provide stat bonuses.** Gear provides:
- Damage (weapons)
- AC / damage reduction (armor)
- Special effects (resist, +crit%, etc.)

This keeps stat identity tied to character choices, not gear swapping.

---

## Derived Resources

| Resource | Formula | Regen |
|----------|---------|-------|
| **HP** | 50 + (CON × 4) + (Level × 2) | Via healing/rest |
| **Mana** | 20 + (INT × 3) + (SPI × 2) | 5 + (INT / 5) per tick |
| **MV** | 100 + (CON × 2) + (DEX × 2) | 10 + (DEX / 5) per tick |

> **Tick interval:** 5 seconds

### Resource Examples at Level 50

| Build | CON | INT | SPI | HP | Mana | MV |
|-------|-----|-----|-----|-----|------|-----|
| Warrior (CON 80) | 80 | 20 | 20 | 470 | 120 | 360 |
| Mage (INT 80, SPI 80) | 40 | 80 | 80 | 310 | 420 | 280 |
| Rogue (DEX 80) | 40 | 30 | 30 | 310 | 170 | 360 |
| Battlemage | 50 | 60 | 60 | 350 | 320 | 300 |

---

## Damage Types

### Physical Damage (3 types)

Each physical damage type scales with a different stat:

| Type | Scales With | Weapons | Bonus |
|------|-------------|---------|-------|
| **Slashing** | STR | Swords, Axes, Claws | STR / 3 |
| **Piercing** | DEX | Daggers, Arrows, Spears | DEX / 3 |
| **Bludgeoning** | CON | Maces, Hammers, Fists | CON / 3 |

### Magical Damage

All magical damage scales with SPI:

| Type | Source | Bonus |
|------|--------|-------|
| **Fire** | AGNI spells | SPI / 3 |
| **Ice** | HIMA spells | SPI / 3 |
| **Lightning** | VIDYUT spells | SPI / 3 |
| **Poison** | VISHA spells | SPI / 3 |
| **Force** | VAYU spells | SPI / 3 |

### Hybrid Build Examples

| Build | Primary Stats | Weapons | Magic | Playstyle |
|-------|---------------|---------|-------|-----------|
| **STR Mage** | STR 60, SPI 60 | Slashing | Fire/Force | Melee + spell burst |
| **DEX Mage** | DEX 60, SPI 60 | Piercing | Ice/Lightning | Ranged + control |
| **CON Mage** | CON 60, SPI 60 | Bludgeon | Heal/Shield | Tanky support |
| **Pure Warrior** | STR 80, CON 60 | Slashing | None | High damage, durable |
| **Pure Mage** | INT 80, SPI 80 | Staff | All schools | Maximum magic |
| **Assassin** | DEX 80, PER 60 | Piercing | Poison | Crit + DoT |

---

## Combat Stats

### Offensive Stats

| Stat | Formula | Source |
|------|---------|--------|
| **Slashing Bonus** | STR / 3 | Strength |
| **Piercing Bonus** | DEX / 3 | Dexterity |
| **Bludgeon Bonus** | CON / 3 | Constitution |
| **Spell Bonus** | SPI / 3 | Spirit |
| **Hit Bonus** | DEX / 4 + PER / 6 | Accuracy |
| **Crit %** | PER / 5 | Perception (cap 20%) |

### Defensive Stats

| Stat | Formula | Source |
|------|---------|--------|
| **AC** | From armor | Equipment |
| **Dodge %** | DEX / 5 | Dexterity (cap 20%) |
| **Magic Resist %** | SPI / 4 | Spirit (cap 25%) |
| **Poison Resist %** | CON / 4 | Constitution (cap 25%) |

### Attack Resolution

```
1. Attacker rolls: d20 + Hit Bonus
2. Compare to: 10 + Defender's DEX/5
3. If hit, defender rolls Dodge % (success = miss)
4. Calculate damage: Weapon Base + Stat Bonus
5. Subtract AC (armor)
6. Apply resistances if magical
7. Minimum damage: 1
```

---

## Levels

Levels 1-50 represent the adventuring phase.

### Per Level Gains

| Gain | Amount |
|------|--------|
| Stat points | +5 |
| Skill points | +1 |

### XP Formula

```
XP required = 100 × (current_level ^ 1.8)
```

### Level 50: Gateway (Post-MVP)

Reaching level 50 unlocks building phase content.

---

## Skills (LegendMUD Style)

Skills are **binary** - you either know them or you don't. No skill levels.

### Core Mechanics

- **1 skill point per level** = 50 skill points by level 50
- **Cost 1-3 points** per skill
- **Learned from trainers** in the world
- **Stats determine effectiveness** of skills you know

### Skill Point Budget

With 50 skill points, players can:
- Focus deeply (25+ in one category)
- Spread moderately (15-20 in two categories)
- Generalist (10-15 in three+ categories)

---

## Skill Categories

### Combat - Melee (14 skills, 20 points to master)

| Skill | Cost | Prereq | Stat | Effect |
|-------|------|--------|------|--------|
| Kick | 1 | — | STR | Light damage + interrupt |
| Bash | 1 | — | STR | Damage + stun 1-2 rounds |
| Parry | 1 | — | DEX | Passive: deflect melee |
| Rescue | 1 | — | STR | Pull ally from combat |
| Trip | 1 | Kick | DEX | Target loses turn |
| Disarm | 2 | Parry | DEX | Remove weapon |
| Headbutt | 2 | Bash | CON | High damage + dizzy |
| Dual Wield | 2 | — | DEX | Wield two weapons |
| Riposte | 2 | Parry | DEX | Counter on parry |
| Berserk | 2 | — | STR | +damage, -defense |
| Charge | 2 | Bash | STR | Rush + stun |
| Cleave | 2 | — | STR | Hit all enemies |
| Hamstring | 2 | Trip | DEX | Slow target |
| Execute | 3 | — | STR | Bonus vs low HP |

### Combat - Ranged (8 skills, 13 points to master)

| Skill | Cost | Prereq | Stat | Effect |
|-------|------|--------|------|--------|
| Aim | 1 | — | PER | +50% next shot |
| Quick Shot | 1 | — | DEX | Fast, low damage |
| Pin | 2 | — | DEX | Root 2 rounds |
| Snipe | 2 | Aim | PER | High damage from hide |
| Volley | 2 | — | DEX | Hit multiple targets |
| Covering Fire | 2 | — | PER | Ally can flee |
| Crippling Shot | 2 | Pin | DEX | Slow + damage |
| Multishot | 3 | Volley | DEX | 3 targets, full damage |

### Combat - Defense (7 skills, 10 points to master)

| Skill | Cost | Prereq | Stat | Effect |
|-------|------|--------|------|--------|
| Dodge | 1 | — | DEX | Passive: +dodge% |
| Block | 1 | — | CON | Block with shield |
| Toughness | 1 | — | CON | Passive: +HP |
| Iron Will | 2 | — | SPI | Resist stun/fear |
| Second Wind | 2 | Toughness | CON | Restore 25% HP |
| Fortress | 2 | Block | CON | +50% block chance |
| Deathless | 3 | Second Wind | CON | Survive lethal once |

### Stealth (10 skills, 16 points to master)

| Skill | Cost | Prereq | Stat | Effect |
|-------|------|--------|------|--------|
| Sneak | 1 | — | DEX | Move unseen |
| Hide | 1 | Sneak | DEX | Become hidden |
| Pick Lock | 1 | — | DEX | Open locks |
| Detect Traps | 1 | — | PER | Reveal traps |
| Backstab | 2 | Hide | DEX | 3× from hiding |
| Steal | 2 | Sneak | DEX | Take items |
| Disarm Traps | 2 | Detect Traps | DEX | Disable traps |
| Vanish | 2 | Hide | DEX | Hide in combat |
| Shadow Step | 2 | Vanish | DEX | Teleport behind |
| Assassinate | 3 | Backstab | DEX | Execute <20% HP |

### Survival (8 skills, 8 points to master)

| Skill | Cost | Prereq | Stat | Effect |
|-------|------|--------|------|--------|
| Bandage | 1 | — | PER | Heal out of combat |
| Forage | 1 | — | PER | Find food/herbs |
| Track | 1 | — | PER | See recent movement |
| Swim | 1 | — | CON | Traverse water |
| Climb | 1 | — | STR | Traverse cliffs |
| Camp | 1 | — | PER | Safe rest |
| Skin | 1 | — | DEX | Harvest pelts |
| Fish | 1 | — | PER | Catch food |

### Crafting (8 skills, 13 points to master)

| Skill | Cost | Prereq | Stat | Effect |
|-------|------|--------|------|--------|
| Cooking | 1 | — | INT | Food buffs |
| Alchemy | 2 | — | INT | Potions, coatings |
| Blacksmithing | 2 | — | STR | Weapons, repair |
| Leatherworking | 1 | — | DEX | Leather armor |
| Tailoring | 1 | — | DEX | Cloth armor |
| Woodworking | 1 | — | DEX | Bows, staves |
| Jewelcrafting | 2 | — | PER | Rings, amulets |
| Enchanting | 3 | — | SPI | Add magic effects |

### Social (4 skills, 4 points to master)

| Skill | Cost | Prereq | Stat | Effect |
|-------|------|--------|------|--------|
| Haggle | 1 | — | INT | Better prices |
| Intimidate | 1 | — | STR | Weaken morale |
| Persuade | 1 | — | SPI | Dialogue options |
| Lore | 1 | — | INT | Learn about things |

---

## Magic System: Sanskrit Mantras

Magic uses a word-combination system. Learn **Words of Power** and combine them to cast.

### Mantra Structure

```
MANTRA = [GUNA] + TATTVA + RUPA
         modifier + element + form

Example: MAHA AGNI ASTRA = "Great Fire Arrow"
```

### The Three Strata

Magic words are organized into three **Strata** (layers of knowledge). Higher strata require greater INT and SPI to access.

| Stratum | INT Required | SPI Required | Who Can Access |
|---------|--------------|--------------|----------------|
| **First Stratum** | 30 | 30 | Everyone (hybrids, fighters with cantrips) |
| **Second Stratum** | 50 | 50 | Semi-dedicated casters |
| **Third Stratum** | 70 | 70 | Pure mages only |

This creates natural specialization:
- **Fighter with cantrips:** First Stratum only (utility magic)
- **Hybrid battlemage:** First + Second Stratum (solid magic)
- **Pure mage:** All three Strata (full mastery)

### RUPA (रूप) - Forms - 8 words

How the spell travels/manifests.

| Sanskrit | English | Mana | Behavior | Cost | Stratum |
|----------|---------|------|----------|------|---------|
| **ASTRA** | Arrow/Missile | 5 | Single target projectile | 1 | First |
| **SPARSHA** | Touch | 3 | Adjacent only | 1 | First |
| **TARANGA** | Wave | 10 | Cone AoE forward | 1 | First |
| **MANDALA** | Circle/Aura | 10 | Buff aura | 1 | First |
| **VISPHOṬA** | Explosion/Burst | 15 | AoE around self | 2 | Second |
| **MEGHA** | Cloud | 20 | Room-wide, persists | 2 | Second |
| **YANTRA** | Device/Trap | 18 | Trap/ward | 3 | Third |
| **BANDHA** | Binding/Enchant | 15 | Enchant item | 3 | Third |

### TATTVA (तत्त्व) - Elements - 12 words

What the spell does.

| Sanskrit | English | Mana | Effect | Cost | Stratum |
|----------|---------|------|--------|------|---------|
| **AGNI** | Fire | 5 | Damage + Burning | 1 | First |
| **HIMA** | Frost | 5 | Damage + Slow | 1 | First |
| **VAYU** | Wind | 5 | Knockback | 1 | First |
| **PRANA** | Life Force | 8 | Heal HP | 1 | First |
| **RAKSHA** | Protection | 10 | Absorb damage | 1 | First |
| **JYOTI** | Light | 4 | Reveal hidden | 1 | First |
| **VIDYUT** | Lightning | 8 | High damage, chains | 2 | Second |
| **VISHA** | Poison | 6 | DoT | 2 | Second |
| **KSHAYA** | Drain | 12 | Damage + self-heal | 2 | Second |
| **SHUNYA** | Void | 8 | Dispel magic | 2 | Second |
| **TAMAS** | Darkness | 8 | Blind | 3 | Third |
| **NIDRA** | Sleep | 12 | Incapacitate | 3 | Third |

### GUNA (गुण) - Modifiers - 6 words

How powerful/special.

| Sanskrit | English | Multiplier | Cost | Stratum |
|----------|---------|------------|------|---------|
| *(none)* | Standard | 1.0× | — | — |
| **MAHA** | Great | 1.5× power | 1 | First |
| **LAGHU** | Small | 0.5× power/cost | 1 | First |
| **DVAYA** | Twin | Cast twice | 2 | Second |
| **STHIRA** | Lasting | 2× duration | 2 | Second |
| **SHIGHRA** | Swift | -1 lag | 2 | Second |
| **BHEDA** | Piercing | Ignore 50% resist | 3 | Third |

### Magic Skill Point Costs by Stratum

| Stratum | Requirement | Words | Points | Cumulative Combos |
|---------|-------------|-------|--------|-------------------|
| **First** | INT 30, SPI 30 | 12 words | 10 pts | 96 combinations |
| **Second** | INT 50, SPI 50 | +9 words | +18 pts | 360 combinations |
| **Third** | INT 70, SPI 70 | +5 words | +15 pts | 672 combinations |
| **Total** | — | 26 words | 43 pts | — |

**First Stratum (10 pts):**
- Forms: ASTRA, SPARSHA, TARANGA, MANDALA (4 pts)
- Elements: AGNI, HIMA, VAYU, PRANA, RAKSHA, JYOTI (6 pts)
- Modifiers: MAHA, LAGHU (2 pts, but included in First Stratum)

**Second Stratum (+18 pts):**
- Forms: VISPHOṬA, MEGHA (4 pts)
- Elements: VIDYUT, VISHA, KSHAYA, SHUNYA (8 pts)
- Modifiers: DVAYA, STHIRA, SHIGHRA (6 pts)

**Third Stratum (+15 pts):**
- Forms: YANTRA, BANDHA (6 pts)
- Elements: TAMAS, NIDRA (6 pts)
- Modifiers: BHEDA (3 pts)

### Mana Cost Formula

```
Base Cost = Form Mana + Element Mana
Final Cost = Base Cost × Modifier × (1 - INT/200)

Example: MAHA AGNI ASTRA (Great Fire Arrow)
  Form: ASTRA = 5
  Element: AGNI = 5
  Base: 10
  Modifier: MAHA = 1.5×
  Raw: 15 mana
  With INT 60: 15 × 0.70 = 10.5 → 11 mana
```

### Spell Power Formula

```
Damage/Healing = Base × (1 + SPI/100)

AGNI ASTRA base damage: 20
With SPI 60: 20 × 1.6 = 32 damage
With MAHA: 32 × 1.5 = 48 damage
```

### Example Mantras - Complete Reference

#### Basic Mantras (No Modifier)

| Mantra | Literal Translation | English Name | Mana | Effect |
|--------|---------------------|--------------|------|--------|
| AGNI ASTRA | Fire Missile | Fire Arrow | 10 | Fire bolt, burning DoT |
| AGNI SPARSHA | Fire Touch | Burning Touch | 8 | Melee fire damage |
| AGNI TARANGA | Fire Wave | Flame Wave | 15 | Cone fire AoE |
| AGNI MANDALA | Fire Circle | Fire Aura | 15 | Fire damage aura |
| AGNI VISPHOṬA | Fire Explosion | Fire Burst | 20 | AoE fire around self |
| AGNI MEGHA | Fire Cloud | Inferno Cloud | 25 | Room fire DoT |
| AGNI YANTRA | Fire Device | Fire Trap | 23 | Triggered fire explosion |
| AGNI BANDHA | Fire Binding | Fire Enchant | 20 | Add fire to weapon |
| | | | | |
| HIMA ASTRA | Frost Missile | Ice Arrow | 10 | Ice bolt, slow |
| HIMA SPARSHA | Frost Touch | Freezing Touch | 8 | Melee ice + slow |
| HIMA TARANGA | Frost Wave | Frost Wave | 15 | Cone ice + slow all |
| HIMA VISPHOṬA | Frost Explosion | Blizzard | 20 | AoE ice around self |
| HIMA MEGHA | Frost Cloud | Frozen Mist | 25 | Room slow + damage |
| | | | | |
| VAYU ASTRA | Wind Missile | Wind Arrow | 10 | Knockback bolt |
| VAYU TARANGA | Wind Wave | Gust | 15 | Cone knockback |
| VAYU VISPHOṬA | Wind Explosion | Cyclone | 20 | AoE knockback |
| | | | | |
| PRANA ASTRA | Life Missile | Healing Arrow | 13 | Ranged heal ally |
| PRANA SPARSHA | Life Touch | Healing Touch | 11 | Melee heal |
| PRANA MANDALA | Life Circle | Healing Aura | 18 | Group heal aura |
| PRANA VISPHOṬA | Life Explosion | Life Burst | 23 | AoE heal around self |
| | | | | |
| RAKSHA ASTRA | Protection Missile | Shield Arrow | 15 | Give ally shield |
| RAKSHA SPARSHA | Protection Touch | Shield Touch | 13 | Touch shield ally |
| RAKSHA MANDALA | Protection Circle | Shield Aura | 20 | Group shield |
| | | | | |
| VIDYUT ASTRA | Lightning Missile | Lightning Bolt | 13 | High damage, chains |
| VIDYUT TARANGA | Lightning Wave | Chain Lightning | 18 | Cone + chain |
| VIDYUT VISPHOṬA | Lightning Explosion | Thunder Burst | 23 | AoE lightning |
| | | | | |
| VISHA ASTRA | Poison Missile | Venom Arrow | 11 | Poison bolt + DoT |
| VISHA TARANGA | Poison Wave | Toxic Wave | 16 | Cone poison |
| VISHA MEGHA | Poison Cloud | Poison Cloud | 26 | Room poison DoT |
| VISHA BANDHA | Poison Binding | Poison Enchant | 21 | Poison weapon coating |
| | | | | |
| KSHAYA ASTRA | Drain Missile | Drain Arrow | 17 | Damage + heal self |
| KSHAYA SPARSHA | Drain Touch | Vampiric Touch | 15 | Melee drain |
| KSHAYA TARANGA | Drain Wave | Life Siphon | 22 | Cone drain |
| | | | | |
| TAMAS ASTRA | Darkness Missile | Shadow Bolt | 13 | Blind target |
| TAMAS TARANGA | Darkness Wave | Blinding Wave | 18 | Cone blind |
| TAMAS MEGHA | Darkness Cloud | Darkness | 28 | Room darkness |
| | | | | |
| JYOTI ASTRA | Light Missile | Light Arrow | 9 | Reveal + damage undead |
| JYOTI MANDALA | Light Circle | Radiance | 14 | Reveal all hidden |
| JYOTI VISPHOṬA | Light Explosion | Flash | 19 | Reveal + blind enemies |
| | | | | |
| SHUNYA ASTRA | Void Missile | Dispel Arrow | 13 | Remove buffs |
| SHUNYA SPARSHA | Void Touch | Nullify | 11 | Touch dispel |
| SHUNYA VISPHOṬA | Void Explosion | Purge | 23 | AoE dispel |
| | | | | |
| NIDRA ASTRA | Sleep Missile | Sleep Arrow | 17 | Put target to sleep |
| NIDRA TARANGA | Sleep Wave | Slumber Wave | 22 | Cone sleep |
| NIDRA MEGHA | Sleep Cloud | Dream Mist | 32 | Room sleep |

#### Modified Mantras (With GUNA)

| Mantra | Literal Translation | English Name | Mana | Effect |
|--------|---------------------|--------------|------|--------|
| **MAHA** (Great) | | | | |
| MAHA AGNI ASTRA | Great Fire Missile | Greater Fire Arrow | 15 | +50% fire damage |
| MAHA PRANA SPARSHA | Great Life Touch | Greater Heal | 17 | +50% healing |
| MAHA VIDYUT TARANGA | Great Lightning Wave | Greater Chain Lightning | 27 | +50% lightning AoE |
| MAHA RAKSHA MANDALA | Great Protection Circle | Greater Shield Aura | 30 | +50% shield strength |
| | | | | |
| **LAGHU** (Small) | | | | |
| LAGHU AGNI ASTRA | Small Fire Missile | Lesser Fire Arrow | 5 | -50% damage, cheap |
| LAGHU PRANA SPARSHA | Small Life Touch | Minor Heal | 6 | -50% healing, cheap |
| LAGHU HIMA TARANGA | Small Frost Wave | Minor Frost Wave | 8 | Weak slow, low cost |
| | | | | |
| **DVAYA** (Twin) | | | | |
| DVAYA AGNI ASTRA | Twin Fire Missile | Twin Fire Arrows | 20 | Two fire bolts |
| DVAYA VIDYUT ASTRA | Twin Lightning Missile | Twin Lightning | 26 | Two lightning bolts |
| DVAYA HIMA ASTRA | Twin Frost Missile | Twin Ice Arrows | 20 | Two ice bolts + slow |
| | | | | |
| **STHIRA** (Lasting) | | | | |
| STHIRA RAKSHA MANDALA | Lasting Protection Circle | Enduring Shield | 26 | 2× duration shield |
| STHIRA VISHA MEGHA | Lasting Poison Cloud | Persistent Poison | 34 | 2× duration cloud |
| STHIRA HIMA TARANGA | Lasting Frost Wave | Enduring Frost | 20 | 2× duration slow |
| | | | | |
| **SHIGHRA** (Swift) | | | | |
| SHIGHRA PRANA SPARSHA | Swift Life Touch | Quick Heal | 14 | Fast heal, low lag |
| SHIGHRA AGNI ASTRA | Swift Fire Missile | Quick Fire | 13 | Fast fire bolt |
| SHIGHRA RAKSHA MANDALA | Swift Protection Circle | Instant Shield | 26 | Quick cast shield |
| | | | | |
| **BHEDA** (Piercing) | | | | |
| BHEDA AGNI ASTRA | Piercing Fire Missile | Penetrating Fire | 14 | Ignores 50% resist |
| BHEDA VIDYUT ASTRA | Piercing Lightning Missile | Penetrating Lightning | 18 | Ignores 50% resist |
| BHEDA KSHAYA SPARSHA | Piercing Drain Touch | Penetrating Drain | 21 | Ignores 50% resist |

#### Pronunciation Guide

| Word | Pronunciation |
|------|---------------|
| AGNI | AHG-nee |
| HIMA | HEE-mah |
| VAYU | VAH-yoo |
| PRANA | PRAH-nah |
| RAKSHA | RAHK-shah |
| JYOTI | JYO-tee |
| VIDYUT | VID-yoot |
| VISHA | VEE-shah |
| KSHAYA | KSHAH-yah |
| SHUNYA | SHOON-yah |
| TAMAS | TAH-mahs |
| NIDRA | NID-rah |
| ASTRA | AHS-trah |
| SPARSHA | SPAR-shah |
| TARANGA | tah-RAHN-gah |
| MANDALA | MAHN-dah-lah |
| VISPHOṬA | vis-FOH-tah |
| MEGHA | MAY-gah |
| YANTRA | YAHN-trah |
| BANDHA | BAHN-dah |
| MAHA | MAH-hah |
| LAGHU | LAH-goo |
| DVAYA | DVAH-yah |
| STHIRA | STHEE-rah |
| SHIGHRA | SHIG-rah |
| BHEDA | BAY-dah |

### Learning Magic Words

Words are learned from **trainers** in the world, similar to skills. Players must:
1. Meet the Stratum stat requirements (INT/SPI)
2. Find a trainer who teaches that word
3. Spend skill points to learn

**Alternative sources:**
- **Quest rewards:** Rare words granted for completing quest chains
- **Ancient texts:** Found scrolls/books teach words (no skill point cost, consumable)

**Trainers by Stratum:**

| Stratum | Trainer Type | Location |
|---------|--------------|----------|
| First | Novice Instructors | Starting areas, temples |
| Second | Experienced Mages | Mid-game areas, academies |
| Third | Masters, Hermits | End-game areas, hidden locations |

---

## Example Character Builds

### Pure Warrior (0 magic, 50 points)

```
STATS (Level 50):
  STR 100, DEX 40, CON 80, INT 20, PER 40, SPI 20
  (INT 20, SPI 20 = NO STRATUM ACCESS - can't cast magic)

SKILLS (50 points):
  Combat Melee:  Kick, Bash, Parry, Trip, Disarm, Headbutt,
                 Dual Wield, Riposte, Berserk, Charge, Cleave,
                 Execute (18 pts)
  Combat Defense: Dodge, Block, Toughness, Iron Will,
                  Second Wind, Fortress, Deathless (10 pts)
  Survival:      Bandage, Swim, Climb, Camp (4 pts)
  Social:        Intimidate (1 pt)
  Crafting:      Blacksmithing (2 pts)

  Remaining: 15 pts for flexibility

DAMAGE: STR 100 / 3 = +33 slashing damage
HP: 50 + 320 + 100 = 470
STRATUM ACCESS: NONE (INT/SPI too low for First Stratum)
```

### DEX Mage (Spellsword, 50 points)

```
STATS (Level 50):
  STR 30, DEX 70, CON 40, INT 55, PER 40, SPI 65
  (INT 55, SPI 65 = First + Second Stratum ONLY)

SKILLS (50 points):
  First Stratum:  ASTRA, SPARSHA, TARANGA, AGNI, HIMA, PRANA,
                  RAKSHA, MAHA, LAGHU (9 pts)
  Second Stratum: VISPHOṬA, VIDYUT, DVAYA (6 pts)
  Combat Melee:   Parry, Dual Wield, Riposte (5 pts)
  Stealth:        Sneak, Hide, Backstab (4 pts)
  Combat Defense: Dodge, Toughness (2 pts)
  Survival:       Bandage, Swim (2 pts)

  Total: 28 pts, 22 remaining

DAMAGE: DEX 70 / 3 = +23 piercing, SPI 65 / 3 = +21 spell
MANA: 20 + 165 + 130 = 315
STRATUM ACCESS: First + Second (NO Third Stratum - can't learn TAMAS, NIDRA, BHEDA)
```

### CON Tank Mage (Support, 50 points)

```
STATS (Level 50):
  STR 30, DEX 30, CON 80, INT 55, PER 30, SPI 75
  (INT 55, SPI 75 = First + Second Stratum ONLY)

SKILLS (50 points):
  First Stratum:  SPARSHA, MANDALA, PRANA, RAKSHA, JYOTI,
                  MAHA, LAGHU (7 pts)
  Second Stratum: VISPHOṬA, SHUNYA, STHIRA (6 pts)
  Combat Melee:   Bash, Parry, Rescue (3 pts)
  Combat Defense: Block, Toughness, Iron Will, Second Wind,
                  Fortress, Deathless (10 pts)
  Survival:       Bandage, Swim, Camp (3 pts)
  Crafting:       Alchemy (2 pts)

  Total: 31 pts, 19 remaining

DAMAGE: CON 80 / 3 = +26 bludgeon, SPI 75 / 3 = +25 spell
HP: 50 + 320 + 100 = 470
MANA: 20 + 165 + 150 = 335
STRATUM ACCESS: First + Second (NO Third Stratum)
ROLE: Healer, buffer, tanky frontline
```

### Assassin (Glass Cannon, 50 points)

```
STATS (Level 50):
  STR 30, DEX 100, CON 30, INT 30, PER 80, SPI 30
  (INT 30, SPI 30 = First Stratum ONLY)

SKILLS (50 points):
  Stealth:        All 10 skills (16 pts)
  Combat Melee:   Kick, Parry, Dual Wield, Riposte (6 pts)
  Combat Ranged:  Aim, Quick Shot, Snipe, Crippling Shot (6 pts)
  Combat Defense: Dodge (1 pt)
  Survival:       Bandage, Track, Skin (3 pts)

  Total: 32 pts, 18 remaining

DAMAGE: DEX 100 / 3 = +33 piercing
CRIT: PER 80 / 5 = 16%
BACKSTAB: 3× damage = 99+ on crit
STRATUM ACCESS: First only (could learn VISHA poison if wanted)
```

### Fighter with Cantrips (50 points)

```
STATS (Level 50):
  STR 80, DEX 50, CON 70, INT 35, PER 30, SPI 35
  (INT 35, SPI 35 = First Stratum ONLY)

SKILLS (50 points):
  First Stratum:  SPARSHA, PRANA, RAKSHA, LAGHU (4 pts)
  Combat Melee:   Kick, Bash, Parry, Disarm, Headbutt,
                  Charge, Cleave (11 pts)
  Combat Defense: Dodge, Block, Toughness, Iron Will,
                  Second Wind (7 pts)
  Survival:       Bandage, Swim, Climb (3 pts)

  Total: 25 pts, 25 remaining

DAMAGE: STR 80 / 3 = +26 slashing
HP: 50 + 280 + 100 = 430
STRATUM ACCESS: First only (utility healing + shields)
ROLE: Warrior with self-healing and minor buffs
```

### Pure Mage (Full Caster, 50 points)

```
STATS (Level 50):
  STR 20, DEX 30, CON 40, INT 80, PER 30, SPI 100
  (INT 80, SPI 100 = ALL THREE STRATA UNLOCKED)

SKILLS (50 points):
  First Stratum:  All 12 words (10 pts)
  Second Stratum: All 9 words (18 pts)
  Third Stratum:  All 5 words (15 pts)
  Combat Defense: Dodge, Toughness (2 pts)
  Survival:       Bandage, Camp (2 pts)
  Social:         Lore (1 pt)

  Total: 48 pts, 2 remaining

DAMAGE: SPI 100 / 3 = +33 spell damage
MANA: 20 + 240 + 200 = 460
INT DISCOUNT: 1 - 80/200 = 60% mana cost
SPELLS: All 26 words = 672 combinations
STRATUM ACCESS: First + Second + Third (full mastery)
```

---

## Combat System

### Combat Loop (Auto-Attack + Skills)

```
ROUND (~3 seconds):
1. AUTO-ATTACKS fire (simultaneous)
2. QUEUED SKILLS execute
3. EFFECTS tick (DoT, etc.)
4. LAG and COOLDOWNS decrement
```

### Lag System

After using a skill, you have **lag** (recovery time):
- Auto-attacks still happen
- Cannot use other skills
- Cannot flee

### Skill Queue

Players can queue **one skill** while lagged. It executes when lag clears.

### Control Effects

| Effect | Duration | Result |
|--------|----------|--------|
| Stunned | 1-3 rounds | Can't use skills or flee |
| Rooted | 2-4 rounds | Can't move, CAN fight |
| Silenced | 3-5 rounds | Can't cast magic |
| Blinded | 2-3 rounds | -50% accuracy |
| Slowed | 3-5 rounds | -50% MV regen, +1 lag |

---

## Status Effects

### DoT Effects

| Effect | Source | Damage/Tick |
|--------|--------|-------------|
| Burning | AGNI | 5 + SPI/10 |
| Poisoned | VISHA | 3 + SPI/10 |
| Bleeding | Slashing crits | 3 + STR/10 |

### Buff/Debuff Effects

| Effect | Source | Bonus |
|--------|--------|-------|
| Shielded | RAKSHA | Absorb X damage |
| Hasted | SHIGHRA mod | -1 lag all skills |
| Weakened | Various | -25% damage |
| Slowed | HIMA | +1 lag, -50% MV |

---

## Movement System

### MV Costs by Terrain

| Terrain | Cost |
|---------|------|
| Road | 5 |
| Normal | 10 |
| Rough | 15 |
| Difficult | 20 |
| Climbing | 25 |
| Swimming | 20 |

### MV Actions

| Action | Cost |
|--------|------|
| Move room | Terrain |
| Flee | 30 |
| Charge skill | 20 |
| Sprint | 2× terrain |

---

## Items & Equipment

### Weapon Damage Types

| Weapon | Type | Stat |
|--------|------|------|
| Sword, Axe | Slashing | STR |
| Dagger, Bow, Spear | Piercing | DEX |
| Mace, Hammer, Fists | Bludgeoning | CON |
| Staff, Wand | Magic | SPI |

### Equipment Slots

```
HEAD     - Helmets
NECK     - Amulets
TORSO    - Armor
HANDS    - Gloves
WAIST    - Belts
LEGS     - Greaves
FEET     - Boots
MAIN     - Weapon
OFF      - Shield/Weapon
```

### Armor Classes

| Type | AC | Dodge Penalty | Best For |
|------|-----|---------------|----------|
| Cloth | 5-15 | 0 | Mages |
| Leather | 15-30 | 0 | Rogues |
| Chain | 30-50 | -5% dodge | Hybrids |
| Plate | 50-80 | -15% dodge | Warriors |

---

## Touch Interface

### Spell Book UI

Craft spells by tapping word buttons:

```
┌─────────────────────────────────────────┐
│ [GUNA] + [TATTVA] + [RUPA]              │
│  MAHA  +  AGNI   + ASTRA                │
│                                         │
│ "MAHA AGNI ASTRA" - Great Fire Arrow    │
│ Mana: 15 | Damage: 48 | Lag: 2          │
│                                         │
│ [Save Slot 1] [Save Slot 2] [Cast]      │
└─────────────────────────────────────────┘
```

### Combat Quick Slots

```
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│AGNI │ │HIMA │ │PRANA│ │RAKSHA│ │ ⚔️  │
│ASTRA│ │ASTRA│ │SPARSHA│MANDALA│ ATK │
│ 🔥  │ │ ❄️  │ │ 💚  │ │ 🛡️  │ │     │
│ 15  │ │ 10  │ │ 11  │ │ 20  │ │     │
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘
  [1]     [2]     [3]     [4]     [5]
```

**Flow:** Tap slot → Tap target → Spell casts

---

## MVP Scope Summary

### Included in MVP

| System | Scope |
|--------|-------|
| Stats | 6 stats, 300 points at 50 |
| Levels | 1-50 |
| Skills | ~70 skills across categories |
| Magic | 4 Forms, 6 Elements, 3 Mods |
| Combat | Auto-attack + skill queue |
| Items | Weapons, armor, potions |
| Movement | MV system, terrain |

### Deferred (Post-MVP)

| Feature | Phase |
|---------|-------|
| Remorting | 2 |
| Respeccing | 2 |
| Advanced crafting | 2 |
| Settlements | 3 |
| Level 50+ content | 3 |

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────────┐
│                    LOKA MVP CORE                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  STATS           STR / DEX / CON / INT / PER / SPI          │
│                  60 base + 5/level = 300 at 50              │
│                  Max 100 per stat                           │
│                                                             │
│  DAMAGE TYPES    Slashing (STR), Piercing (DEX),           │
│                  Bludgeon (CON), Magic (SPI)                │
│                                                             │
│  RESOURCES       HP (CON), Mana (INT+SPI), MV (CON+DEX)     │
│                                                             │
│  SKILLS          Binary, 1 point/level, 50 total            │
│                  Learned from trainers                      │
│                                                             │
│  MAGIC           Sanskrit word combination                  │
│                  [GUNA] + TATTVA + RUPA = Mantra            │
│                                                             │
│  THREE STRATA    First (INT/SPI 30): 12 words, 96 combos   │
│                  Second (INT/SPI 50): +9 words, 360 combos  │
│                  Third (INT/SPI 70): +5 words, 672 combos   │
│                                                             │
│  COMBAT          Auto-attack + skill queue                  │
│                  Lag/cooldown system                        │
│                  Touch: Tap slot → Tap target               │
│                                                             │
│  HYBRIDS         Fighter + First Stratum = cantrips        │
│                  Battlemage + Second Stratum = solid magic  │
│                  Pure Mage + Third Stratum = full mastery   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
