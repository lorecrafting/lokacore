# Skill & Progression System Design

> Status: Draft — active design discussion (Feb 23 2026)
> Philosophy: "SWG flexibility, LegendMUD discovery, UO feel — levelless, cooperation-first"

---

## Design Principles

1. **Classless** — no character classes, no stat allocation at creation
2. **Levelless** — no XP bar, no level number. Progress is tangible ("I can now shape wood"), not abstract ("I'm level 14")
3. **Cooperation-first** — solo is viable, groups are dramatically better. Mechanics create interdependence.
4. **SWG-style skill points** — fixed pool (250), spend at trainers, surrender anytime for full refund
5. **Use-based proficiency** — within each unlocked skill, you improve by doing (UO feel)
6. **Discovery-based acquisition** — find a trainer, complete a quest, watch another player (LegendMUD)
7. **Typed XP** — combat XP, crafting XP, Pulse XP, etc. You progress in what you DO (SWG)
8. **Callings for breadth** — one character, multiple skill loadouts. No alts, no FOMO.
9. **One account, one character** — your name means something, reputation matters
10. **Emergent by design** — economy, building, combat, social systems interlock to produce unplanned outcomes

---

## Inspirations & Rationale

### Why SWG (Pre-NGE)?

Star Wars Galaxies (2003-2005, before the "New Game Enhancements") had the most successful classless MMO system ever built. Key lessons:

- **250 skill points, fixed forever.** No inflation, no level cap raises. Forces meaningful tradeoffs.
- **~34 professions, each 80-120 points.** You could combine 2-3 into unique builds nobody designed.
- **Typed XP.** ~30 XP types (pistol, unarmed, crafting, scouting, entertainer, etc). You earn what you do.
- **Surrender anytime.** Drop any skill, get points back. Total freedom to respec — no "wrong build" anxiety.
- **No NPC vendors for endgame gear.** 100% player-crafted economy. Crafters were ALWAYS needed.
- **Item decay.** Gear wore out and eventually became unusable. Max durability decreased on each repair. This kept crafters in business perpetually — the most important economic mechanic in any MMO.
- **Resource quality variation.** Resources had quality stats 1-1000. High-quality resources made better items. Resources rotated (spawned/despawned on cycles). Top crafters stockpiled the best materials.
- **Experimentation.** Crafters could experiment on items during creation — choosing to boost damage OR range OR accuracy. Same schematic, same resources, different results based on crafter skill and choices.
- **Player cities.** 5 tiers from Outpost (5 citizens) to Metropolis (40+). Elected mayors, taxes, city specializations, militia. Cities emerged organically from player behavior, not from quest chains.
- **Entertainers buffed combat players.** Cantinas became natural social hubs where combat players got buffed and chatted. An entire profession based on providing a service, not fighting.
- **Apprenticeship.** Players could teach each other skills. Teaching granted Apprentice XP, required for Master-level skill boxes. Community knowledge-sharing was mechanically rewarded.
- **The NGE killed it.** When SWG replaced the skill system with 9 fixed classes, the community revolted and the game eventually shut down. The lesson: classless flexibility is the CORE value. Never sacrifice it.

### Why LegendMUD?

- **Spellwords.** Learn individual words of power, combine them into spells. Discovery-based, emergent, endlessly expandable. Better than spell lists.
- **Trainer-based acquisition.** Skills learned from specific NPCs scattered across the world. Drives exploration.
- **Mutual exclusion.** Some skills explicitly excluded others (Create OR Destroy, Cause OR Remove). Identity through meaningful, permanent choices.
- **Hometown affects trajectory.** Where you start shapes what you CAN learn, without locking you into a class.

### Why UO?

- **Use-based improvement feels good.** "I kicked 50 goblins and my kick got better" is more satisfying than "I spent 3 points and my kick went up."
- **0-100 scale is intuitive.** Everyone understands percentages.
- **Diminishing returns are natural.** Easy things improve fast, hard things improve slowly. No XP tables needed.

### What We Take from Each

| From SWG | From LegendMUD | From UO | Novel to Loka |
|----------|---------------|---------|---------------|
| 250 skill point cap | Spellword combinations | Use-based proficiency | Levelless (no XP bar) |
| Typed XP | Trainer-based learning | 0-100 scale | Callings (loadout switching) |
| Skill surrender | Mutual exclusion | Contextual gains | Pulse word system |
| Player-crafted economy | Hometown origin | Diminishing returns | Three origin worlds |
| Item decay | Discovery-driven | — | Cooperation-gated building |
| Resource quality | Apprenticeship | — | Derived stats |
| Player cities | — | — | Group Pulse weaving |
| Entertainer-style support roles | — | — | Origin traits |

---

## Character Creation

Minimal — 30 seconds max:
- Name
- Appearance descriptor (freeform short text or pick from list)
- Choose origin world (Grove, Depths, or Reach — see Origin Worlds section)
- Done. No stats, no class, no choices requiring game knowledge beyond "where do you want to start?"

---

## Core Progression Loop (Levelless)

There are no levels. No XP bar. No grinding toward an abstract number.

```
DO THINGS (combat, crafting, exploring, building, socializing)
  → earn typed XP (combat XP, crafting XP, Pulse XP, social XP, etc.)
  → typed XP thresholds grant skill points
  → skill points spent at trainers to UNLOCK skills
  → skills improve through USE (UO-style, within unlocked range)
  → better skills unlock access to content, areas, and crafting recipes
```

### Typed XP System (from SWG)

Each activity earns its own XP type. You progress in what you DO:

| XP Type | Earned By | Unlocks |
|---------|-----------|---------|
| **Combat XP** | Defeating hostile creatures/NPCs | Combat skill training |
| **Crafting XP** | Creating items, combining materials | Crafting skill training |
| **Pulse XP** | Using Pulse words, tending, sensing | Pulse skill training |
| **Exploration XP** | Entering new rooms, discovering landmarks | Movement/survival training |
| **Social XP** | Teaching others, group activities, governance | Social skill training |
| **Building XP** | Constructing structures, surveying | Building skill training |

### Skill Point Milestones (Replaces Leveling)

Instead of "level up → get points," XP thresholds in each type award skill points:

```
Every 500 combat XP      → 2 skill points (spendable on any skill)
Every 500 crafting XP    → 2 skill points
Every 500 Pulse XP       → 2 skill points
Every 500 exploration XP → 2 skill points
Every 500 social XP      → 2 skill points
Every 500 building XP    → 2 skill points
Quest completion         → 3-5 skill points (major quests)
Story milestones         → 5-10 skill points (origin world completion, etc.)
```

> **Design note:** All XP types award the same rate (2 pts / 500 XP). Earlier drafts penalized exploration and social XP at half rate — this was cut because it contradicts "all playstyles are equally valid." A pure explorer or social player must progress at the same rate as a fighter or crafter.

**Why this replaces levels:**
- No "level 50 grind." You're always training toward a specific capability.
- Every play session yields points — whether you fought, built, or socialized.
- A crafter who never fights still progresses at the same rate as a warrior. An explorer or teacher does too.
- No "I killed 200 boars and got 3% of a level" — progress is always meaningful.
- Content isn't gated by "requires level 10." It's gated by "requires basic construct" or "requires sense_pulse:30."

### Progress Indicator (Without Levels)

Players still want to know "how far along am I?" The answer is total skill points earned + a title:

```
> status

  Kai — Settler of Thornhaven
  Total skill points earned: 87
  Active calling: Rootspeaker (62 / 250 pts allocated)

  Milestones:
    Combat:      ████░░░░░░  340 / 500 XP  (next: 2 pts)
    Pulse:       ███████░░░  680 / 1000 XP (next: 2 pts)
    Exploration: █████████░  450 / 500 XP  (next: 1 pt)
    Crafting:    ██░░░░░░░░  120 / 500 XP  (next: 2 pts)
```

Title progression (based on total points earned, not spent):

| Points Earned | Title |
|--------------|-------|
| 0-25 | Newcomer |
| 26-75 | Wanderer |
| 76-150 | Settler |
| 151-250 | Veteran |
| 251-400 | Elder |
| 401+ | Founder |

Titles are social signifiers, not power gates. A "Founder" isn't stronger than a "Settler" in any given skill — they've just experienced more of the world.

---

## Skill System

### Skill Points: SWG Model

- **250 skill points per calling** (fixed, never increases)
- Points are spent at trainers to **unlock** skills
- **Surrender anytime**: drop any skill, get ALL points back, reallocate freely
- No "wrong build" — you can always restructure

### Skill Costs (Tiered)

Each skill has three tiers. Higher tiers cost more points AND require finding more specialized trainers:

| Tier | Point Cost | Proficiency Range | Trainer Type |
|------|-----------|-------------------|-------------|
| Novice | 2 points | 0 - 33 | Common (Grove NPCs, Barren settlements) |
| Journeyman | 4 points | 34 - 66 | Specialist (specific Barren NPCs, faction trainers) |
| Master | 6 points | 67 - 100 | Rare (hidden NPCs, quest rewards, player teachers) |

Total cost to fully unlock one skill to master tier: **12 points**.
With 250 points: you can master ~20 skills, or spread novice across ~125 skills. Realistically, a focused build masters 8-12 skills and has 10-15 at novice/journeyman.

### Skill Proficiency (UO-Style, Within Tier)

Once a skill is unlocked at a tier, proficiency grows through USE:

```
Gain chance per use = (tier_ceiling - current_level) * 0.3%
Gain amount = 0.1 per successful roll

Examples (novice tier, ceiling 33):
  Level  1: 9.6% chance per use (fast early learning)
  Level 15: 5.4% chance per use
  Level 30: 0.9% chance per use (approaching ceiling)

Examples (master tier, ceiling 100):
  Level 67: 9.9% chance per use (fresh master, learning fast)
  Level 85: 4.5% chance per use
  Level 95: 1.5% chance per use (true mastery is rare)
```

When you hit your tier ceiling:
```
Your kick connects solidly, but you feel like you've hit a wall.
There's nothing more you can learn on your own.
"Find someone who fights for a living," Brennan said once.
"They'll show you what comes next."
```

### Skill Acquisition

Skills are NOT available from the start. Each must be **discovered** through world interactions:

1. **NPC trainers** — find them, ask them to teach, spend skill points + typed XP
2. **Story moments** — Grove quest objectives teach specific skills automatically
3. **Player teaching (SWG apprenticeship)** — players who have mastered a skill can teach it to others. Teaching grants Social XP to the teacher. This rewards community and creates mentorship.
4. **Observation** — watch another player use a skill you don't have. 5% chance per observation to gain it at proficiency 0.1, max 1 attempt per skill per day. Rewards being in groups without being a macro target.
5. **Experimentation** — try to do something you don't have a skill for. 3% chance of success, but if it works, you gain the skill at proficiency 0.1. Max 3 attempts per skill per day.

Multiple paths to learn the same skill (from LegendMUD):
```
Learn "construct" from:
  - Tomas (Grove) — requires tend:20 + completing his quest
    → teaches Pulse-integrated building (same skill, narrative flavor)
  - A Barren engineer — requires 500 building XP + 2 skill points
    → teaches conventional building

Same skill. Different prerequisites. Different stories.
```

### Mutual Exclusion (from LegendMUD)

Some skills explicitly exclude others. Choosing one means you CAN'T learn the other. This creates identity and interdependence:

**Pulse branch exclusions** (permanent, per character — not per calling):

| Choose... | OR... | Why It Matters |
|-----------|-------|---------------|
| `grow` (nurture, cultivate, build with living things) | `break` (dismantle, dispel, tear apart) | Growers build living structures, heal land. Breakers dispel corruption, demolish blight. Both needed. |
| `bind` (connect, join, fuse) | `release` (separate, free, dissolve) | Binders fuse materials, create alloys, strengthen bonds. Releasers extract resources, purify, break enchantments. |
| `call` (summon, attract, gather) | `shield` (protect, ward, deflect) | Callers summon allies, attract resources. Shielders protect areas, create wards. |

These are chosen during origin world play — the story presents the choice as a meaningful character moment, not a menu selection. The choice persists across ALL callings. It's the one irreversible decision, and it's the one that makes you need other players most.

**Non-Pulse exclusions** (within a calling, can be changed by surrender):

| Choose... | OR... | Rationale |
|-----------|-------|-----------|
| `architecture` (large structures) | `fortification` (defensive structures) | Specialists, not generalists |
| `persuade` (diplomatic influence) | `intimidate` (coercive influence) | Social identity |

### Anti-Macro / Anti-Abuse Measures

Four layers, none hostile to real players:

**1. Tier ceilings (structural).** Can't grind past 33/66/100 without finding a trainer and spending points. The strongest anti-macro measure — converts grinding into exploration + resource decisions.

**2. Contextual gain requirements.** Skills only gain when used in meaningful context:

| Skill | Gains When... | Does NOT Gain When... |
|-------|--------------|----------------------|
| kick | Against a hostile NPC in actual combat | Hitting air, a friend, a dummy |
| forage | Room has resources AND you find something | Spamming in an empty room |
| meditate | Below 80% mana, out of combat | Already full mana |
| sneak | Moving past NPCs/players who could detect you | Sneaking alone |
| first_aid | Healing actual HP damage on someone | At full health |
| construct | Building a structure with materials present | No materials, no blueprint |

**3. Daily gain caps.** Maximum 20 gains per skill per day, 5 per hour. Even optimal botting yields only 2.0 proficiency per skill per day.

**4. Typed XP diminishing returns.** The same activity yields less XP each consecutive hour:

```
Hour 1: 100% XP rate
Hour 2: 75% XP rate
Hour 3: 50% XP rate
Hour 4+: 25% XP rate (floor — never zero)
Resets after 8 hours offline
```

This rewards varied play ("fight for an hour, then build for an hour, then explore") over monotonous grinding. It also naturally encourages logging off — rest is productive.

---

## Callings System (Solving FOMO)

### The Problem

A 250-point skill cap means you can't do everything in one loadout. Some players will feel trapped. Alts undermine community. Remort loses progress. Cap inflation creates power creep.

### The Solution: One Character, Multiple Callings

A calling is a **skill loadout** — a complete set of trained skills, their tiers, and their proficiency levels. One character can develop multiple callings over time, but only one is active at any moment.

```
> callings

  Active: Rootspeaker
    meditate: 58, sense_pulse: 71, tend: 65, shape: 44,
    focus: 33, first_aid: 33
    Points allocated: 62 / 250

  Dormant: Warden (ready to switch)
    kick: 45, parry: 33, sprint: 40, sneak: 28,
    climb: 33, bash: 20
    Points allocated: 48 / 250

  Locked: ??? (requires 150 total skill points earned)
```

### Rules

- **Each calling has its own 250-point pool, skills, tiers, and proficiency levels**
- **First calling**: earned through a story moment on The Barren (early game)
- **Second calling**: unlocks at 100 total skill points earned
- **Third calling**: unlocks at 200 total skill points earned
- **24-hour real-time cooldown on switching** — you commit to a role for meaningful periods
- **Switching is a deliberate act** — visit a specific NPC or location, not a menu toggle
- **Surrender works within callings** — you can restructure your active calling freely

### What Persists Across ALL Callings

- **Universal skills** (Tier 1 origin world skills) — always available at whatever proficiency you trained them
- **Pulse words** — you never unlearn a word (though Pulse skill proficiency varies per calling)
- **Pulse branch choices** — grow/break, bind/release, call/shield are CHARACTER-level, not calling-level
- **Reputation, relationships, settlement membership, story progress** — all persist
- **Inventory and equipment** — persists (some gear requires skills from a specific calling to use effectively)
- **Typed XP accumulated** — shared, continues earning toward milestones regardless of active calling
- **Origin traits** — permanent

**Universal + calling skill overlap:** If a universal skill (e.g., kick) also appears in a calling's skill list, use the HIGHER proficiency of the two. No duplication — the character's body remembers what it learned. Universal proficiency provides a floor; calling-specific training can push it higher within that calling.

### What Changes When You Switch

- Active skill set swaps entirely (different skills, tiers, proficiency levels)
- Derived stats recalculate based on active calling's skills
- Available actions change (can't use `bash` if your active calling doesn't have it)
- Your role in the community shifts

### Why Not Alts?

**One account, one character. Non-negotiable.** Critical for community:

- Your name means something — can't hide behind alts
- Reputation matters — jerks can't reroll
- Economic exploits eliminated (no funneling resources between alts)
- Every player IS someone, not a faceless alt army
- Callings give breadth without the social cost of alts

### SWG Lesson: Why Surrender Matters

SWG let you surrender any skill anytime, getting all points back. This was CRITICAL to the system's success. Players weren't afraid to try things because there was no permanent cost to experimenting. A weaponsmith who wanted to try combat could surrender crafting skills, learn combat, and if they hated it, go right back.

In Loka, surrender works the same way WITHIN a calling. Drop a skill, get all points back, reallocate. The ONLY permanent choice is your Pulse branch exclusions.

---

## Stat System

### Derived Stats

Six stats, each derived from the top 3-5 related skills in the **active calling** (plus universal skills). Not chosen, not allocated — calculated.

| Stat | Full Name | Derived From | Governs |
|------|-----------|-------------|---------|
| **STR** | Strength | kick, bash, combo_strike, climb, intimidate | Melee damage, carry weight |
| **DEX** | Dexterity | parry, sneak, thrust, disarm, dodge | Hit chance, dodge chance |
| **CON** | Constitution | sprint, endurance, toughness, first_aid | Max HP, stamina regen |
| **INT** | Intelligence | focus, dispel, quickcast, craft, haggle | Crafting quality, puzzle-solving |
| **SPI** | Spirit | meditate, ward, sense_pulse, tend | Pulse power, mana pool |
| **PER** | Perception | forage, sneak, survey, track | Detection, foraging yields, resource quality |

Formula: `stat = sum(top_3_related_skill_proficiencies) / 3`

Always divides by 3 regardless of how many related skills are trained. This avoids two problems: (1) dividing by all related skills (including zeros) would penalize specialists, and (2) dividing by only trained skills would make having fewer skills give absurdly high stats (one skill at 100 = stat 100). The top-3 approach rewards depth in a cluster of related skills without punishing breadth.

Stats recalculate when callings switch.

### Stat Display — Numbers + Vibes

```
> stats

  Kai — Settler of Thornhaven
  Origin: Grove    Calling: Rootspeaker

  STR  26  ████░░░░░░  "You've thrown enough punches to know
                         where to aim."
  DEX  18  ███░░░░░░░  "Your hands are steady, if not yet quick."
  CON  31  █████░░░░░  "You can walk all day without stopping."
  INT  12  ██░░░░░░░░  "You solve problems with your hands,
                         not your head."
  SPI  44  ███████░░░  "The Pulse hums at the edge of your
                         awareness, always."
  PER  22  ████░░░░░░  "You notice more than most. Not everything."

  Skills: 62 / 250 pts    Points earned: 87
```

### Flavor Text Thresholds

| Range | Label | Tone |
|-------|-------|------|
| 0-10 | Untrained | Neutral/absent |
| 11-30 | Novice | Aware but clumsy |
| 31-50 | Practiced | Competent, building confidence |
| 51-70 | Skilled | Reliable, recognized by others |
| 71-90 | Expert | Notable, sought out |
| 91-100 | Master | Rare, defining identity |

---

## Three Origin Worlds

Each origin world is a **solo instanced prologue** — a complete story that teaches universal skills and grants permanent origin traits. Players choose their origin at character creation.

### The Grove (Forest / Living Seedship)

**Core relationship with the world**: Cooperation with living systems
**Fiction**: You wake on a generation ship that has become a living forest. The community tends the ship-forest, fights a mysterious Blight, and holds together through connection.

**Unique skills taught**: sense_pulse, tend, shape
**Pulse branch presented**: grow vs break (the central moral question of the Grove)
**Origin traits (permanent)**:
- Pulse Sensitivity: +10% Pulse word effectiveness
- Root Memory: sense_pulse works in any terrain, not just living areas
- Blight Resistance: reduced damage from corrupted zones

**Building advantage**: Living structures (self-repairing walls, growing roofs, breathing buildings)

**Status**: 108 rooms, 5 spine quests, 4 side quests, 5 NPCs. Content ~90% complete.

### The Depths (Underground Caverns / Geothermal)

**Core relationship with the world**: Understanding inert structure — stone, pressure, resonance
**Fiction**: You wake in a vast underground network of caverns, lava tubes, crystal chambers, and geothermal vents. The community mines, forges, and builds in the deep. A structural instability threatens collapse.

**Unique skills taught**: resonance, excavate, forge
**Pulse branch presented**: bind vs release (do you fuse things together or take them apart?)
**Origin traits (permanent)**:
- Stonereading: detect structural weakness, mineral deposits, hidden passages
- Heat Tolerance: reduced damage from fire/geothermal hazards
- Forge Affinity: +10% crafting speed/quality with metal, glass, and crystal

**Building advantage**: Engineered structures (precision, durability, underground construction, bridges)

**Why underground, not desert or mountain**:
- Best contrast to the Grove — inert vs living, isolation vs connection
- Vertical gameplay (shafts, caverns, bridges) — unique navigation
- Massive biome variety within one concept (caves, lava tubes, crystal caverns, flooded passages, geothermal vents, desert basins where caverns open to the surface)
- Underground can INCLUDE desert — a cavern system that opens into a desert basin gives you both

**Status**: Design only. Zero content built.

### The Reach (Coastal / Tidal / Archipelago)

**Core relationship with the world**: Reading patterns — water, weather, cycles
**Fiction**: You wake on a chain of islands connected by tidal bridges that appear and disappear. The community navigates, fishes, and reads the weather. Rising waters threaten to swallow the outermost islands.

**Unique skills taught**: tidecraft, navigate, forecast
**Pulse branch presented**: call vs shield (do you summon what you need or protect what you have?)
**Origin traits (permanent)**:
- Tidal Awareness: sense weather changes before they happen
- Deep Breath: extended underwater/harsh-environment time
- Current Reader: faster travel on water routes, +10% navigation efficiency

**Building advantage**: Adaptive structures (floating platforms, tidal-resistant construction, weather-hardened buildings)

**Status**: Design only. Zero content built.

### How Origins Connect to The Barren

Each origin world is a solo prologue. When you complete it, you arrive at **The Barren** — the shared persistent world. Your origin determines:

1. **What unique skills you bring** (Pulse/Resonance/Tidal)
2. **Your permanent origin traits** (small but flavorful bonuses)
3. **Your building style** (living/engineered/adaptive)
4. **Your Pulse branch exclusion** (grow/break, bind/release, call/shield)

A complete settlement needs ALL THREE ORIGINS:
```
Grove player:   grows living walls, heals blight, senses danger
Depths player:  forges tools, builds foundations, engineers bridges
Reach player:   reads weather, navigates water, predicts storms

None alone can build a complete, thriving settlement.
```

---

## Cooperation-First Design

### Combat: No Solo Heroes

Solo play is viable. Group play is dramatically better. Three mechanisms enforce this:

**1. Combo chains across players.** Skills create status effects that other players' skills exploit:

```
Player A (Warden):   bash → target is STAGGERED (1 round)
Player B (Pulse):    pulse weave break + root → 2x damage vs STAGGERED
                     → target is now EXPOSED
Player C (Scout):    thrust → 3x damage vs EXPOSED → target is DOWN

Solo:  each skill does base damage
Trio:  the chain does ~6x total damage through status synergies
```

**2. No dedicated healer.** "Healer" as a job is boring for that player. Instead, healing is environmental and cooperative:

- `tend` heals an AREA — everyone present recovers slowly
- `pulse weave mend + still` creates a healing zone (not targeted heal)
- `first_aid` works on others but costs YOUR turn (vulnerable while bandaging)
- Pulse network rewards groups — more people synchronized = stronger effect

**3. No aggro/tank mechanics.** Enemies attack based on behavior — whoever's closest, whoever last hit them, whoever's casting. Positioning matters, not a taunt button.

### Crafting: SWG Lessons Applied

The most important SWG lessons for Loka's crafting economy:

**Item decay.** Everything wears out. Repair reduces max durability. Eventually, items must be replaced. This keeps crafters in business PERPETUALLY — not just at endgame.

**No NPC vendors for good gear.** Basic supplies from NPCs. Anything worth having is player-crafted. This forces a real economy.

**Resource quality variation.** Resources have quality stats (1-100). Higher quality = better items. Resources rotate (seasonal spawning). Top crafters stockpile the best materials. This creates differentiation — two weaponsmiths with the same skill can produce different quality items based on their resource stockpiles.

**Experimentation.** During crafting, you choose what to optimize. A sword can be crafted for damage OR speed OR durability. Same recipe, same resources, different crafter choices → different items. This means player reputation matters — "Kai makes the best damage swords, but if you want durability, go to Maren."

**Crafting XP from crafting.** You earn crafting XP by crafting, not by killing things. A crafter who never fights progresses at the same rate as a warrior. No second-class citizens.

### Building: Solo Is Slow, Groups Are Transformative

The scaling isn't linear (2 builders ≠ 2x speed). It's **qualitative** — more people unlock better structures:

```
1 builder:    lean-to (2 hours)
2 builders:   cabin (2 hours) — qualitatively different, not just faster
5 builders:   longhouse (2 hours)
5 mixed:      longhouse with Pulse-grown walls, forged hinges,
              weather-hardened roof, and a ward against blight
```

**Building projects as group quests (SWG-style):**

```
Charter: Longhouse
  Required roles:
    - 1x construct:journeyman (frame the structure)
    - 1x carpentry:novice (finish the woodwork)
    - 1x cultivate:novice (grow the living roof)
  Materials:
    - 200 wood (harvested or shaped)
    - 50 stone (mined or found)
    - 10 binding fiber (foraged)
  Steps:
    1. Survey the site (survey skill check)
    2. Gather materials (community effort — can stockpile over days)
    3. Raise the frame (construct check, builders must be present)
    4. Finish and bless (pulse weave optional — adds living elements)
  Duration: ~1 hour with full team
```

### Entertainer-Style Support Roles (from SWG)

SWG's entertainer profession proved that non-combat roles can be deeply engaging IF they provide real value. In Loka:

**The Rootspeaker** (Grove origin, Pulse specialist):
- Provides Pulse buffs to nearby players (like SWG's entertainer inspiration buffs)
- Heals the area (everyone present benefits)
- Can sense incoming threats (early warning for the settlement)
- Creates Pulse-enhanced tools and structures
- Players seek them out before expeditions — natural social magnet

**The Organizer** (social/building specialist — not a coded role):
- Takes responsibility for claim permissions, shared chest management
- Coordinates building projects, material gathering, defense
- Other players give them modify permission by social agreement
- No coded "governor" — their authority comes from trust, not a skill

**The Teacher** (social specialist):
- Can teach skills they've mastered to other players (SWG apprenticeship)
- Teaching grants Social XP
- Creates a mentorship dynamic — veteran players have a reason to help newcomers
- Master-tier skills are PRIMARILY learned from player teachers — this makes masters valuable community members
- **Fallback for monopoly prevention:** Hidden NPC trainers exist for every master-tier skill, requiring an expensive quest chain + rare materials. Ensures no single player can gatekeep a skill permanently. The NPC path is deliberately harder and slower than player teaching — incentivizing the social path without creating hostage situations

### The Lifestyle Player

This design naturally creates player types most modern games lack:

- The **builder** who never fights but whose structures protect everyone
- The **crafter** whose weapons are sought across settlements
- The **rootspeaker** whose Pulse buffs make expeditions possible
- The **organizer** whose coordination keeps the settlement running
- The **teacher** whose mentorship trains the next generation

All are equally valid. All progress at the same rate (typed XP). All are needed.

---

## Pulse Word System

### Concept (from LegendMUD Spellwords)

The Pulse isn't "cast spell #47." It's a living language you learn fragments of. Players discover individual words, combine them. Most combinations fizzle — the ones that work feel like genuine discoveries.

### Grammar (from LegendMUD's Verb + Noun Structure)

LegendMUD used a verb + noun grammar: `create light`, `destroy movement`, `cause fire`. Loka adapts this:

```
pulse weave <action-word> <target-word>

Action words (verbs — mutually exclusive pairs):
  grow / break
  bind / release
  call / shield

Target words (nouns — learned independently):
  root, stone, water, air, heat, life, form, deep, light
```

You learn ONE from each action pair (permanent). You learn target words through exploration. A player who chose `grow` + `bind` + `call` has a very different Pulse vocabulary than one who chose `break` + `release` + `shield`.

### Combinations

```
GROVE ACTION WORDS:
  grow + root    = accelerate plant growth, heal land
  grow + form    = shape living wood into structures
  grow + life    = nurture living things, boost healing
  break + root   = uproot blight, clear corrupted land
  break + form   = demolish structures, shatter objects
  break + stone  = fracture rock, create passages

BINDING/RELEASE:
  bind + form    = fuse materials together (crafting)
  bind + stone   = reinforce structure, strengthen walls
  release + heat = extract thermal energy
  release + water = purify water, remove toxins

CALL/SHIELD:
  call + life    = attract creatures, summon allies
  call + water   = draw water to surface
  shield + root  = ward an area against blight
  shield + heat  = fireproof a structure
```

### Discovery & Emergence

**Designed combinations** (reliable, tested): ~30-40 known combos across all words. These are documented in-world by NPCs and lore.

**Experimental combinations**: Players can try ANY combo. Unknown combos run through a procedural system:
- Most produce minor flavor effects (sparks, hums, brief sensations)
- Occasionally one produces something genuinely useful
- Player-discovered useful combos get logged
- If many players find and use the same emergent combo, it gets promoted to "designed" in a future patch

**Group discovery**: Some words are ONLY learnable through group Pulse weaving. When 5+ players synchronize, new patterns can emerge that no individual could discover.

**Targeting rules (anti-griefing):** Destructive Pulse words (`break + form`, `break + stone`, etc.) only affect: (a) structures you have build permission for, (b) unclaimed/wild structures, (c) hostile NPCs/creatures. You cannot demolish another player's structures or claimed terrain without their permission. PvP Pulse use is a future opt-in feature, not a default. This prevents `break` specialists from griefing settlements.

### Group Pulse Weaving (SWG Groupchant Inspired)

```
Command: pulse weave <action> <target>
Group:   pulse synchronize  (invite nearby players)
         pulse weave <action> <target>  (execute with all synchronized)

Power scales: base_effect * (1 + 0.5 * additional_weavers)
2 players:  1.5x power
5 players:  3.0x power
10 players: 5.5x power
```

Some effects REQUIRE multiple weavers — pushing back the Blight, terraforming, raising major structures. Community achievements, not solo power fantasies.

---

## Economy & Item Decay (from SWG)

### Why Item Decay Is Non-Negotiable

Without item decay, crafters are only needed once. With it, they're needed forever. SWG proved this is the single most important mechanic for a living economy.

### How It Works in Loka

```
Every item has: current_condition / max_condition

Using items:     condition decreases when EQUIPPED AND USED (SWG model)
                 Stored/inventory items do NOT decay
                 Combat gear decays faster, tools slower
Repairing:       restores condition but permanently reduces max_condition by 5%
At max_condition < 20%: item becomes "worn" (reduced effectiveness)
At max_condition = 0:   item is destroyed

Pulse-grown items: decay slower, repair better (Grove origin advantage)
Forged items:      higher initial condition, heavier (Depths origin advantage)
Weathered items:   resist environmental decay (Reach origin advantage)
```

> **Calling interaction:** Switching callings does NOT cause item decay. Gear sits safely in inventory while dormant. This prevents crafters from resenting making gear for calling-switchers, and prevents the exploit of only equipping gear during active use to cheat decay. Decay happens through USE, period.

### Resource System

Resources have quality attributes (1-100 scale, simpler than SWG's 1-1000):

| Attribute | Affects |
|-----------|---------|
| Purity | Item effectiveness (damage, healing power, etc.) |
| Durability | How slowly the item decays |
| Workability | Crafting success chance |
| Rarity | How hard to find (affects economy) |

Resources rotate seasonally. A specific high-quality iron deposit might only appear for one in-game season. Crafters who stockpiled it can make better weapons until the supply runs out. This creates natural market dynamics.

### No NPC Vendors for Crafted Goods

NPCs sell ONLY:
- Basic supplies (bandages, rope, simple food)
- Recipes/schematics (unlocking what you CAN craft)
- Training (skill unlocks)

Everything else — weapons, armor, tools, furniture, building materials, potions, special food — is player-crafted ONLY. This makes crafters essential, not optional.

---

## Territory & Settlement System (Freeform — No Hardcoded Governance)

### Design Philosophy: Code Tools, Not Structure

SWG hardcoded governance (mayor elections, taxes, city ranks, specializations). We don't. Instead, we provide **permission tools** and let players build whatever social structure they want. EVE Online proved that emergent governance — democracy, dictatorship, councils, coups, whatever players invent — is far more compelling than designed governance.

**What IS coded** (mechanical problems that require system support):
- Building permissions (who can build where?)
- Structure ownership (who owns this building?)
- Shared storage access (who can access the settlement chest?)
- Territory boundaries (where does this territory start/end?)
- Structure maintenance (buildings decay without upkeep)

**What is NOT coded** (players figure this out themselves):
- Leadership selection (no coded elections — players agree among themselves)
- Tax collection (no coded taxes — shared chest with transparent log instead)
- City ranks/tiers (no "Village" label — your settlement IS whatever you've built)
- Militia designation (any player can choose to defend)
- Laws and rules (social contract, not code enforcement)
- Specialization (no menu choice — build a workshop, you get a crafting bonus naturally)

### Claim Stones (Territory in Room-Based Worlds)

Territory works in terms of **room graph distance** (hops via exits), not pixel coordinates. A claim stone placed in a room claims all rooms within N exits:

```
> place claim stone

You drive the stone into the earth at Thornhaven Clearing.
The Pulse ripples outward through the root network.

  Claimed territory: all rooms within 3 exits of here.
  Currently encompasses: 12 rooms.

  Rooms:
    Thornhaven Clearing (center)
    Thornhaven Path North, Thornhaven Path South
    The Old Well, Workshop Hollow, Garden Terrace
    ...and 6 more.
```

**Mechanics:**
- Anyone with survey:novice can place a claim stone (no special "politician" skill)
- Claim stones cost materials to place AND maintain monthly (prevents spam and land-hoarding)
- If maintenance lapses, claim expires → territory becomes unclaimed
- Minimum distance between unaffiliated claim stones: 5 rooms (prevents crowding)

**Expansion:**

| Radius | Rooms (~typical) | Monthly Maintenance | Expansion Cost |
|--------|-----------------|---------------------|---------------|
| 2 | 5-8 | 10 wood, 5 stone | Initial placement |
| 3 | 10-18 | 20 wood, 10 stone | 30 wood, 15 stone |
| 4 | 18-30 | 35 wood, 15 stone | 50 wood, 25 stone |
| 5 | 30-50 | 50 wood, 25 stone | 80 wood, 40 stone |
| 6+ | 50+ | Scales up | Scales up |

Room counts vary because room connectivity isn't uniform — a cave with one exit per room claims fewer rooms at radius 3 than a well-connected forest.

**Merged claims:** When two claim stones' territories overlap (share at least one room), both owners can agree to merge. The merged territory is the union of both radii. Both stones still need individual maintenance. This is how settlements grow organically — neighbors merge claims when they trust each other.

**What players see when entering claimed territory:**

```
> north

Thornhaven Path North
  Dense ferns line a narrow path. A carved stone marker
  reads "Thornhaven" with a small arrow pointing south.

  [Thornhaven territory — Kai, Maren (modify)]

  Exits: north, south
```

### Permission System (Replaces Governance)

Every claim and structure has a permission table. This IS the governance system — whoever controls permissions controls the settlement, but HOW they got that control is entirely player-determined:

```
> claim permissions

  Territory: Thornhaven (merged claim — 8 contributors)

  Build:    Kai, Maren, Tomas, Brennan
  Access:   Kai, Maren, Tomas, Brennan, Lira, Yara, Kira, Jun
  Modify:   Kai, Maren  (can change this permission table)
  Expand:   Kai          (can extend territory radius)
```

**Modify permission IS leadership.** But how that person got it is up to players:
- One person keeps modify → benevolent dictatorship
- Three share modify → council
- Everyone gets modify → direct democracy (chaotic but possible)
- Modify rotates weekly by agreement → no code needed, social contract
- A vote happens in chat, winner gets modify → emergent election

### Shared Resources (Replaces Taxes)

Instead of coded taxation, provide **shared storage** with transparent logs:

```
> build community chest

  Community Chest placed at Thornhaven Clearing.
  Access: Kai (owner)

> chest grant maren
> chest grant tomas

> chest log

  [3 days ago] Kai contributed: 50 wood, 20 stone
  [2 days ago] Maren contributed: 30 herbs, 10 fiber
  [yesterday]  Tomas contributed: 5 iron ingots
  [today]      Kai withdrew: 10 wood (cabin repair)
```

The **chest log is the key mechanic.** It's transparent — everyone sees who contributes and who freeloads. Social pressure handles the rest. No coded tax rate, no forced contribution — just visibility.

### Conflict Resolution (Minimal Coded Protection)

When someone with modify permission goes rogue, three coded protections prevent the worst abuses without dictating governance:

**1. Personal structure ownership.** Your buildings are ALWAYS yours. Even if someone revokes your build permission, they can't demolish your cabin. (They CAN revoke territory access, which means your structure loses territory bonuses — but it's still yours.)

**2. Contribution log is permanent.** Even after a takeover, the log shows who built what. Reputation matters (one account, one character).

**3. Claim split.** Any contributor to a merged claim can split off their portion at any time, taking their structures with them. This is the "right to secede" — messy but prevents hostage situations. If a leader goes bad, people leave. The leader is left with an empty claim and a ruined reputation.

### Structures in MUD Rooms

Structures exist as **entities within rooms**, with different scales represented differently:

**Small structures — objects in the room.** Interact with them in place, no interior:

| Structure | Type | Interaction |
|-----------|------|------------|
| Firepit | Object | `use firepit` (cook, warm, light) |
| Lean-to | Object | `rest in lean-to` (shelter, minor regen) |
| Claim stone | Object | `claim permissions`, `claim expand` |
| Community chest | Object | `chest contribute`, `chest take`, `chest log` |
| Workbench | Object | `craft at workbench` (crafting station) |
| Market stall | Object | `sell at stall`, `browse stall` (player trade) |

**Medium structures — single interior rooms.** `enter` creates a room transition:

```
> enter cabin

  Inside Kai's Cabin
  A cozy single-room dwelling. A sleeping mat, a small
  workbench, and a chest sit against the walls. The scent
  of dried herbs hangs in the air.

  Items: sleeping mat, personal workbench, storage chest

  Exits: outside (Thornhaven Clearing)
```

| Structure | Interior Rooms | What's Inside |
|-----------|---------------|--------------|
| Cabin | 1 | Living space, personal storage |
| Workshop | 1 | Crafting stations, material storage |
| Watchtower | 1 | Elevated view (extended `look` range / sense_pulse range) |
| Clinic | 1 | Healing station (boosted first_aid/tend) |

**Large structures — mini-zones with multiple connected rooms:**

| Structure | Interior Rooms | Layout |
|-----------|---------------|--------|
| Longhouse | 2-3 | Main hall → storage room → sleeping quarters |
| Hall | 3-5 | Meeting hall → offices → storage → kitchen |
| Fortified gate | 2 | Gatehouse → rampart (overlooks outside) |

**Key architectural decision:** Player-built structures literally **create new rooms** in the world. The entity system supports this — a structure is an entity of type `:room` whose exits connect back to the outdoor room it was built in. The map grows as players build. The world is shaped by player action.

### Structure-Based Area Bonuses (Replaces City Specialization)

Instead of a menu choice for "city specialization," certain structures provide area bonuses naturally within the territory:

| Structure | Bonus | Rationale |
|-----------|-------|-----------|
| Workshop | +5% crafting quality in territory | Tools available |
| Healing grove (tended) | +10% healing in territory | Pulse resonance from tended plants |
| Training ground | +10% skill proficiency gains in territory | Practice environment |
| Market stall | Enables player-to-player trade commands | Physical infrastructure |
| Watchtower | sense_pulse range extends to territory border | Elevated vantage |
| Forge (Depths-style) | Enables metal/glass crafting in territory | Specialized equipment |
| Dock (Reach-style) | Enables water travel from territory | Access infrastructure |

No specialization menu. You build a workshop, you get the crafting bonus. Build both a workshop AND a healing grove? Get both bonuses. The "specialization" is whatever you invested materials and labor into.

### Structure Maintenance & Decay

All structures require periodic maintenance or they decay. This is coded — without it, ghost towns persist forever:

```
Lean-to:      5 wood per month
Cabin:        15 wood + 5 stone per month
Workshop:     30 wood + 30 stone + 10 metal per month
Longhouse:    60 wood + 20 stone + 10 fiber per month
Watchtower:   10 wood + 20 stone per month
```

**Decay stages:**
```
100-80% condition: fully functional
79-50% condition:  "weathered" — bonuses reduced by half
49-20% condition:  "crumbling" — no bonuses, reduced shelter
Below 20%:         structure collapses (removed from world)
```

**Pulse-grown structures** (Grove origin builders) decay slower and can be healed with `tend`. **Forged structures** (Depths origin) have higher initial condition. **Weathered structures** (Reach origin) resist environmental decay (rain, wind, storms).

### What Emerges From This

With just these coded systems (claims, permissions, storage, maintenance, structure bonuses, room creation), players will create:

**Governance** — Some settlements will have a single leader. Some will have a council. Some will rotate. Some will have no formal leader at all. All valid because the permission system supports any arrangement.

**Economy** — Some settlements share freely via community chest. Others have privately-owned workshops where crafters charge for services. Others barter. The chest log provides transparency, but the social contract is player-defined.

**Defense** — Without a coded militia, players organize defense themselves. Post lookouts, build walls, negotiate peace, build in hidden locations. All emergent.

**Culture** — One settlement names itself and creates traditions. Another is a transient trading post. Another is a commune built around a Pulse nexus. The game doesn't know or care.

**Conflict** — When two players disagree about who should have modify permission, the game doesn't resolve it. They talk it out, or one secedes (claim split) and founds a new settlement. This IS the emergent political gameplay.

---

## World Creation: Three Layers

The Barren isn't pre-built as 828 hand-crafted rooms. It's a living world that grows through three layers:

### Layer 1: The Skeleton (Dev-Created — ~200 Rooms)

The dev team creates **landmark geography** — permanent, high-quality, hand-crafted rooms that anchor the world. These can't be destroyed or modified by players:

- **Arrival zone** (where all origin players arrive, ~20-30 rooms)
- **Major terrain features** (the Great Rift, the Salt Flats, the Dead River)
- **Resource-rich zones** (iron deposits, crystal caves, fertile valleys)
- **Narrative sites** (ancient ruins, the Pulse nexus, the Blight source)
- **Connection corridors** between regions

These rooms are the bones. Everything else grows between them.

### Layer 2: The Wilderness (Procedural — Infinite)

Between landmark rooms, **wilderness** fills the gaps. Wilderness rooms are generated on entry from **biome templates**:

```yaml
biome: dry_scrubland
  terrain_tags: [arid, rocky, sparse_vegetation]
  description_pool:
    - "Dry, thorny bushes crowd the cracked earth. {wind_detail}"
    - "Wind-scoured soil stretches in every direction. {resource_hint}"
    - "A few stubborn grasses cling to the rocky ground. {distance_feature}"
  resources:
    common: [brush, cracked_stone, dry_clay]
    uncommon: [iron_deposit, hardy_roots]
    rare: [crystal_vein, ancient_artifact]
  hazards: [dust_storm, blight_patch, hostile_creature]
  exits_per_room: 3-4 (denser than caves, sparser than forests)
```

**Wilderness rooms are ephemeral by default.** If nobody claims or modifies them, they recycle after ~48 hours of no visitors. The "slot" still exists (going north from room X always leads somewhere), but you get a fresh generation with respawned resources. The wilderness is alive and renewing.

**You can always walk further.** There is no wall, no edge, no boundary. Walk north for 100 rooms and you're still in wilderness — just different biomes as you get further from the center. The world is effectively infinite but mostly empty until players fill it.

**Biome regions** are defined as rough areas on a hidden coordinate grid (the player never sees coordinates, only room descriptions). Each region has its own biome template:

| Region | Biome | Resources | Terrain |
|--------|-------|-----------|---------|
| Near center | Dry scrubland | Brush, clay, sparse stone | Flat, easy traversal |
| Northeast | Rocky badlands | Iron, dark stone, crystal | Hilly, vertical exits |
| Southeast | Salt flats | Salt, mineral deposits, bleached bone | Flat, hazardous sun |
| West | Dead forest | Petrified wood, old roots, rich soil | Dense, limited exits |
| Far north | Foothills | Granite, streams, alpine herbs | Steep, narrow paths |
| Underground | Caverns (Depths terraformers create access) | Metal ores, gems, geothermal | Vertical, narrow |
| Coastline | Tidal zone (Reach terraformers create access) | Fish, shells, driftwood, coral | Tidal (rooms change with tide) |

### Layer 3: Player Terraforming (Permanent World Expansion)

Players with terraforming skills convert ephemeral wilderness into **permanent, modified terrain**. This is how the world grows.

**What claiming does to wilderness:**
When a claim stone is placed, all wilderness rooms within the claim radius are **promoted to permanent**. They stop recycling. They're saved to the database. They're now real rooms in the persistent world — but they're still "raw" wilderness until terraformed.

**What terraforming does to claimed rooms:**
Terraforming transforms the terrain TYPE of a room — changing its description, resources, properties, and even what can be built there.

### Terraforming Skill Progression

Terraforming isn't a separate system — it's part of the building skill tree, with origin-specific master abilities:

```
PREREQUISITES:
  construct:novice + cultivate:novice → unlocks terraform:novice

TERRAFORM TIERS:

terraform:novice (2 pts)
  Can: clear wilderness, level ground, prepare soil,
       create basic paths between rooms
  Creates: cleared ground, plowed fields, packed-earth paths
  Time: ~1 hour per room
  Cost: minimal materials (tools only)

terraform:journeyman (4 pts, requires construct:journeyman)
  Can: dig ponds, divert streams, create clearings,
       carve trails through rock, create new exits between rooms
  Creates: water features, agricultural land, improved paths,
           new connections between existing rooms
  Time: ~2-4 hours per room
  Cost: moderate materials + tools

terraform:master (6 pts, requires terraform:journeyman + origin skill)
  GROVE origin + shape:journeyman:
    Can: grow forests, create groves, establish Pulse-active zones
    Creates: forested rooms, healing clearings, living terrain
  DEPTHS origin + excavate:journeyman:
    Can: dig tunnels, create caves, open mine shafts,
         create entirely new UNDERGROUND rooms
    Creates: cave systems, vertical connections (up/down exits)
  REACH origin + tidecraft:journeyman:
    Can: create harbors, dig channels, reshape coastlines,
         create water-connected rooms
    Creates: waterways, docks, tidal zones, canal connections
  Time: ~1-2 days per room (real-time)
  Cost: significant materials + Pulse/origin resources
```

**Each origin's master terraformer creates a different kind of space:**
- Grove terraformers grow forests where there was scrubland
- Depths terraformers dig underground rooms that didn't exist before
- Reach terraformers create waterways connecting previously landlocked areas
- You need all three to create a complete, diverse settlement

### How New Exits Are Created

Terraformers can reshape the **topology** of the world, not just modify rooms:

```
> terraform dig tunnel east

  You spend a day excavating through the rock face.
  A narrow passage opens, connecting to the Crystal Cavern
  you discovered last week.

  New exit created: east → Crystal Cavern
  (Reciprocal exit created: Crystal Cavern → west → here)
```

**Restrictions on exit creation:**
- Can only create exits within or between claimed territories
- Can only connect to rooms you've personally visited (explored both sides)
- Landmark rooms can't have their exits modified
- Exit creation costs significant materials + time
- Underground exits (Depths) require excavate skill
- Water exits (Reach) require tidecraft skill
- Living bridges/connections (Grove) require shape skill

### Room Descriptions: System-Generated

For quality control and narrative consistency, terraformed room descriptions are **system-generated** from templates, not player-authored:

```yaml
terrain_type: grove_clearing
  templates:
    - "Young trees form a {season} circle around soft ground.
       {pulse_detail}"
  variables:
    season: [budding, leafy, golden, bare]  # by game season
    pulse_detail:
      high_pulse: "The Pulse hums strongly here."
      low_pulse: "A faint whisper of the Pulse reaches this far."
  origin_flavor:
    grove: "The trees lean toward each other — coaxed, not planted."
    depths: "Stone pilings anchor the soil. The trees grew around them."
    reach: "A small channel feeds the roots. Clever water management."
```

Players choose WHAT terrain to create. The system writes HOW it's described. This maintains the narrative voice. Player-authored descriptions could be a future feature gated behind master terraform + community review.

### How The World Evolves Over Time

```
Month 1:   200 landmark rooms + infinite wilderness
           Players claim land near arrival zone
           First clearings, first farms, first lean-tos

Month 3:   200 landmarks + ~100 player-terraformed rooms
           Settlements forming with paths between them
           First underground excavations by Depths players
           First ponds and irrigation by Reach players

Month 6:   200 landmarks + ~500 player rooms
           Trade routes connecting settlements
           Underground tunnel networks
           Canal systems linking water sources
           Forests growing where scrubland was
           The map is unrecognizable from launch

Year 1:    200 landmarks + 2000+ player rooms
           The Barren isn't barren anymore
           Each region shaped by its dominant origin culture
           Grove areas are forests
           Depths areas are honeycombed underground
           Reach areas have waterways
```

**The game's title becomes ironic.** "The Barren" starts barren. Players make it bloom. That's the entire theme.

### The Dev Team's Evolving Role

**Pre-launch:** Build the skeleton (200 landmarks), biome templates, description pools, resource distributions. Traditional content creation.

**Post-launch (gardeners, not architects):**
- Seed new landmark rooms for narrative events (discovered ruins, Blight incursions)
- Add new biome templates for variety as players push into distant regions
- Add new terrain types as terraforming skills expand
- React to player behavior (if everyone clusters east, seed interesting resources west)
- Run world events that affect the wilderness (storms that reshape terrain, Blight waves that threaten settlements)
- The dev team shapes conditions. Players grow the world.

---

## Emergent Gameplay: How All Systems Interlock

The core SWG lesson, via Raph Koster: "You can't build emergent tools on top of a static world. If you start with a foundation of simulation, and layer static stuff on top, that works fine."

Loka's simulation layer:

| System | Creates | Interacts With |
|--------|---------|---------------|
| **Skill points** | Specialization pressure | Economy (need others), Building (need specialists), Combat (need diverse groups) |
| **Item decay** | Perpetual demand | Crafting (always needed), Economy (trade), Resources (harvesting) |
| **Resource quality** | Crafter differentiation | Economy (reputation), Building (quality structures), Combat (quality gear) |
| **Typed XP** | Activity-driven progression | All — doing ANYTHING progresses you |
| **Pulse exclusions** | Player identity + interdependence | Combat (need both grow AND break), Building (living vs engineered), Healing (different approaches) |
| **Callings** | Role flexibility + commitment | Settlement (today's builder, tomorrow's defender), Economy (adapt to demand) |
| **One character** | Reputation + community | Permissions (trust-based), Economy (trust), Social (relationships) |
| **Territory claims** | Collective space + emergent governance | Building, Permissions, Economy, Defense — all converge |
| **Wilderness generation** | Infinite explorable space | Exploration (always somewhere new), Resources (discovery), Settlement (find the right spot) |
| **Terraforming** | Player-created permanent world | Building (terrain shapes what you build), Origin (each shapes differently), Community (world reflects who lives there) |
| **Origin diversity** | Cultural richness | Building styles, terraforming flavors, Pulse approaches — each origin shapes the world differently |

### Emergence Examples (Unplanned by Designers)

**The Craft Market**: Three crafters with different resource stockpiles set up shops in a settlement. Combat players compare quality. A reputation economy develops. Nobody designed this — it emerges from resource quality + item decay + no NPC vendors.

**The Defense Rotation**: A settlement near the Blight border needs defenders. Players with combat callings take shifts. The organizer posts a schedule in chat. Rootspeakers heal the perimeter walls between attacks. Nobody designed this specific defense strategy.

**The Teaching Guild**: Master-tier players form a guild that teaches skills. They charge Social XP or crafted goods. New players seek them out. A mentorship economy develops alongside the item economy.

**The Expedition**: A group needs a Breaker (to dispel blight), a Grower (to heal the path), a Warden (to fight creatures), and a Surveyor (to find resources). They plan the route based on who's available. The composition changes each time. Every expedition is unique.

**The Leadership Dispute**: Two players both want modify permission on the claim. One argues for trade focus, the other for fortification. The community discusses in the longhouse. They decide to split: one takes the eastern claim and builds a market, the other takes the western claim and builds walls. A year later, they merge again under a shared council. Pure emergent politics — no election code needed.

---

## The Barren: Arrival & Onboarding

The transition from origin world (narrative, guided, solo) to The Barren (sandbox, unguided, multiplayer) is the most critical moment in the game. Get it wrong and players bounce at the exact point they should be hooked.

### The Arrival Sequence

```
Origin world completion
  → cutscene: the crossing (brief, origin-specific)
  → arrive at Barren Arrival Zone (~20-30 rooms, dev-created)
  → first multiplayer moment: you see other players for the first time
  → guided introduction to Barren mechanics (NPC or Spark companion)
```

### Arrival Zone Design

The Arrival Zone is the only place in The Barren that feels curated — because it is. It anchors the entire world:

| Area | Purpose | Rooms |
|------|---------|-------|
| **The Threshold** | Where you physically arrive from your origin world | 1 room per origin (3 total), connected to central plaza |
| **Wayfinder's Plaza** | Central hub, always populated by NPCs + players | 3-5 rooms: plaza, notice board, campfire, supply tent |
| **Training Grounds** | Where Barren-specific skills are taught (survey, construct, combat) | 4-6 rooms with NPC trainers |
| **The First Road** | Path outward to wilderness, with graduated difficulty | 8-10 rooms, scrubland biome, low-level creatures, forageable resources |
| **The Overlook** | A high point where you can `look` and see distant landmarks | 1 room, description names visible landmarks in each direction |

**The Wayfinder's Plaza** is the social anchor — the "cantina" of The Barren. It has:
- A **notice board** (persistent messages — "seeking builder," "iron found northeast," "Thornhaven recruiting")
- A **communal fire** (rest bonus, social gathering point, warm description that invites lingering)
- A **supply NPC** (sells basic tools, bandages, rope, simple food — no good gear)
- A **Wayfinder NPC** (teaches survey, gives hints about regions and resources in each direction)

### What the Arrival Zone Teaches

| Lesson | How |
|--------|-----|
| "Other players exist" | You see them in the plaza. Names visible. |
| "The world is big and empty" | The Overlook shows distant landmarks, all far away |
| "You can claim land" | Wayfinder explains claim stones, sells your first one cheap |
| "You need other people" | Building project posted on notice board requires 3 skills |
| "Danger exists outside" | First Road has creatures that deal real damage |
| "Resources are out there" | Wayfinder hints at what's in each direction |

### Barren Narrative Layer

The Barren isn't narratively empty. It was SOMETHING once. Landmarks tell the story:

- **Ancient ruins** scattered in wilderness — examinable objects with lore fragments about what The Barren was before
- **The Pulse Nexus** — a landmark where the Pulse is strongest, hints at deeper mystery
- **Blight zones** — spreading corruption, combat + Pulse challenge, echoes of origin world threats
- **Resource sites** with environmental storytelling ("the crystal here grows in patterns no natural formation explains")
- **Discoverable history** — players who explore furthest find fragments that piece together WHY The Barren is barren

This isn't a quest chain — there's no quest log for Barren lore. It's pure exploration reward. Find something, read it, piece together the mystery with other players. LegendMUD-style discovery.

---

## Barren Creature Ecology

Combat players need things to fight. The wilderness can't be empty. Creature density and danger scale with distance from the Arrival Zone:

### Creature Zones

| Distance from Center | Danger Level | Creature Types | Solo Viable? |
|---------------------|-------------|---------------|-------------|
| 0-5 rooms | Safe | None (Arrival Zone) | N/A |
| 6-15 rooms | Low | Scavengers, small predators | Yes |
| 16-30 rooms | Moderate | Pack hunters, territorial beasts | Yes (with prep) |
| 31-50 rooms | High | Blight-touched, apex predators | Duo recommended |
| 51+ rooms | Dangerous | Blight spawns, elite creatures | Group required |

### Creature Behavior Types

| Behavior | Description | Example |
|----------|-------------|---------|
| **Scavenger** | Avoids players, flees when hurt. Easy kills, basic resources. | Dust rats, thorn beetles |
| **Territorial** | Attacks if you linger in their room. Warns first. | Rockjaw lizards, den spiders |
| **Pack hunter** | Calls allies when engaged. Dangerous alone, manageable in groups. | Blight hounds, sand stalkers |
| **Patrol** | Moves between rooms on a schedule. Predictable, interceptable. | Blight walkers, corrupted wardens |
| **Ambush** | Hidden until you trigger them (forage, mine, enter at night). | Burrow worms, cave lurkers |
| **Elite** | Rare, powerful, guards high-quality resource nodes. Requires group. | Blight titan, crystal guardian |

### Creature Drops & Economy Integration

Creatures drop materials that crafters need — this is the combat/crafting interdependence loop:

```
Combat player kills blight hound → drops blight-resistant hide + bone
Crafter uses hide → blight-resistant armor (decays slower in corrupted zones)
Combat player wears armor → ventures deeper → kills harder creatures → rarer drops
```

No creature drops finished gear. Every drop is a crafting material. Crafters always needed.

### Spawning Rules

- Wilderness rooms generate creatures on entry based on biome + distance + time of day
- Claimed territory has reduced spawn rates (structures deter creatures)
- Creature density is per-biome (dead forest = more ambushers, salt flats = more patrol)
- Creatures do NOT respawn in a room while players are present — no farming a single spot
- Blight zones have higher density and more dangerous creature types
- Night = more creatures, more aggressive behavior, better resource drops

---

## Death & Respawn

### What Happens When You Die

```
HP reaches 0
  → you are DOWNED (10-second window — another player can revive with first_aid)
  → if not revived → you die
  → items in inventory DROP at your corpse (retrievable)
  → equipped items take 20% condition damage
  → you respawn at: nearest claim stone you have access to, OR Arrival Zone
  → your corpse persists for 1 hour (other players cannot loot it — no PvP looting)
```

### Design Rationale

| Choice | Why |
|--------|-----|
| No skill/XP loss | Punishing exploration and experimentation is anti-core-loop |
| Item condition penalty | Creates demand for repair/replacement (crafter economy) |
| Corpse retrieval | Risk/reward for venturing far — you might lose travel time, not items |
| 10-second revive window | Encourages group play, first_aid is valuable |
| Respawn at claim stone | Incentivizes claiming territory — it's your respawn point |
| No PvP looting | Cooperation-first — no incentive to kill other players |

### Death in Different Contexts

| Context | Experience |
|---------|-----------|
| **Near settlement** | Minor inconvenience — run back, grab your stuff |
| **Deep wilderness** | Significant — long walk back, items at risk until retrieved |
| **With a group** | Revive window makes death recoverable if allies act fast |
| **Blight zone** | Dangerous — corpse is in a hostile area, retrieval is its own challenge |

---

## Communication Systems

The Barren needs communication beyond room-based `say`. Reference: MASTER-GDD Section 7 (30 social primitives). What's needed for alpha:

### Alpha-Required Communication

| Command | Scope | Persistence | Notes |
|---------|-------|-------------|-------|
| `say <message>` | Current room | Ephemeral | Everyone in the room hears |
| `emote <action>` | Current room | Ephemeral | Freeform expression |
| `shout <message>` | Room + adjacent rooms | Ephemeral | Louder, wider |
| `tell <player> <message>` | One player, anywhere | Ephemeral | Direct message, requires knowing name |
| `party <message>` | Party members (max 6) | Ephemeral | Group communication |
| `post <message>` | Notice board (physical) | Persistent (7 days) | Must be at a notice board object |

### No Global Chat (Intentional)

Distance matters. Information travels organically. If you want to tell someone something far away, you `tell` them directly (requires knowing their name) or post on a notice board. Settlements with notice boards become information hubs. This drives players to communal spaces.

### Notice Boards

```
> read board

  Thornhaven Notice Board
  ────────────────────────
  [3 hours ago] Kai: "Iron deposit found 12 rooms northeast of here.
                       Quality 72. Bring a pick."
  [yesterday]   Maren: "Seeking someone with construct:journeyman
                         for longhouse project. Materials provided."
  [2 days ago]  Tomas: "Blight spreading near the dead forest.
                         Be careful heading west."
```

Notice boards are **craftable objects** placed in rooms. Any claimed territory can have one. The Arrival Zone has one built-in. This is the Barren's social infrastructure — emergent, player-placed, not globally available.

### Future (Post-Alpha)

- `mail` — persistent cross-world messages (requires postal structure in settlement)
- `channel` — subscriber-based chat groups (guild chat, trade chat)
- `journal` — personal chronicle, shareable with others

---

## Travel & Movement

### The Problem

Infinite wilderness means walking 30 rooms between settlements is tedious. But teleportation would destroy the sense of distance and make the world feel small.

### Solution: Paths Provide Speed

| Travel Method | Speed | Requirement |
|--------------|-------|-------------|
| Wilderness walking | 1x (base) | None |
| Established path | 2x | Terraform:novice created a path between rooms |
| Paved road | 3x | Construct:journeyman + stone materials |
| Water route | 3x | Reach-origin tidecraft + waterway |
| Underground tunnel | 2x | Depths-origin excavate + tunnel |

**Speed bonus means:** movement commands in path/road rooms process instantly without the normal 2-second travel delay. Walking through 10 rooms of wilderness takes ~20 seconds. Walking through 10 rooms of road takes ~7 seconds. The journey still happens — you still see rooms, can be ambushed, can stop to forage — but established infrastructure makes it faster.

### Wayfinding

- `survey` skill reveals direction and approximate distance to nearest landmarks, settlements, and resource deposits
- Claim stones are detectable via `sense_pulse` from a distance (Grove origin) or `resonance` (Depths origin)
- The Overlook in Arrival Zone permanently shows major landmark directions
- Player-placed **trail markers** (cheap craftable object) persist in wilderness rooms and prevent them from recycling

### No Teleportation

Deliberate. Distance creates value for: trade routes (carrying goods is work), settlement location (proximity to resources matters), defense (remote settlements are safer from Blight but harder to trade with), and information asymmetry (you don't know what's happening far away unless someone tells you).

---

## Inventory & Carry Weight

### Weight System

```
Carry capacity = 50 + (STR * 2) units

Examples:
  STR 10 (newcomer):  70 units
  STR 30 (practiced):  110 units
  STR 50 (skilled):    150 units
```

| Item Type | Weight (units) | Examples |
|-----------|---------------|---------|
| Light | 1-2 | Herbs, bandages, rope, food |
| Medium | 3-5 | Tools, weapons, armor pieces |
| Heavy | 8-15 | Raw stone, metal ingots, large wood |
| Bulk | 20+ | Building materials (stacked) |

### Overloaded

At >100% capacity: movement speed halved, cannot sprint, combat penalties. At >150%: cannot move. This creates demand for:

- **Handcarts** (craftable, doubles carry capacity, 1 room/move speed penalty)
- **Pack animals** (future — tamed creatures that carry goods)
- **Stockpiles** (structure that stores bulk materials at a location)

### Storage

- **Personal chest** (cabin interior) — 200 units, private
- **Community chest** (claim structure) — 500 units, shared with transparent log
- **Stockpile** (outdoor structure) — 1000 units, bulk materials only, shared

---

## Day/Night & Seasons

### Day/Night Cycle

Already partially built (Atmosphere module). Integration with The Barren:

| Time | Duration | Effects |
|------|----------|---------|
| **Dawn** | 1 hour real | Some plants forageable only at dawn. Creature aggression low. |
| **Day** | 4 hours real | Normal visibility, normal spawns. |
| **Dusk** | 1 hour real | Pulse power slightly increased. Warning period. |
| **Night** | 4 hours real | Reduced `look` range in wilderness. More creatures, more aggressive. Better resource drops. Pulse power +20%. |

Full day/night cycle = 10 hours real time (~2.4 cycles per real day).

### Seasons (Post-Alpha)

| Season | Duration | Effects |
|--------|----------|---------|
| **Growth** | 1 month real | Plants grow faster, resource quality +10% |
| **Harvest** | 1 month real | Maximum yields, best foraging |
| **Scarcity** | 1 month real | Reduced spawns, creature aggression up, resource quality -10% |
| **Renewal** | 1 month real | Resource rotation — old deposits depleted, new ones appear |

4-month cycle. Seasons drive resource rotation (the SWG mechanic where top crafters stockpile).

---

## Resource System (Expanded)

### How Resource Quality Works

Resources have quality attributes (1-100 scale). Quality is determined by:

| Factor | Effect | Notes |
|--------|--------|-------|
| **Node location** | Base quality range per biome region | Near center: 20-50. Far out: 40-80. Specific sites: 60-100. |
| **Skill proficiency** | +1 quality per 5 proficiency points in relevant skill | Forage at 50 → +10 quality |
| **PER stat** | +1 quality per 10 PER | PER 40 → +4 quality |
| **Season** | ±10 during Growth/Scarcity | Incentivizes stockpiling |
| **Time of day** | Certain resources peak at specific times | Herbs at dawn +5, minerals at night +5 |

Quality is rolled at harvest time: `base_quality + skill_bonus + PER_bonus + seasonal_modifier + random(-5, +5)`

### Resource Rotation

Resources spawn in nodes that last 1-3 in-game seasons, then deplete and new nodes appear elsewhere. This prevents permanent resource monopolies and creates ongoing exploration demand.

```
Season 1: High-quality iron (82) found 20 rooms NE → crafters stockpile
Season 2: That iron node depletes → new iron (67) found 15 rooms SW
Season 3: Exceptional iron (91) found 35 rooms N → deep wilderness expedition needed
```

### Recipe Discovery

| Method | What You Learn | Example |
|--------|---------------|---------|
| **NPC vendor** | Basic recipes (cheap, common) | Iron sword, wooden shield, leather vest |
| **Quest reward** | Intermediate recipes | Reinforced armor, compound bow |
| **Drop from creatures** | Specialized recipes | Blight-resistant coating, crystal-tipped arrows |
| **Experimentation** | Discovered recipes (player finds new combinations) | Combining unusual materials at workbench |
| **Player teaching** | Any recipe the teacher knows | Master teaches apprentice |

### Experimentation System

When crafting, the crafter chooses where to focus their effort. This is the SWG experimentation mechanic adapted for text:

```
> craft iron sword

  Materials: 3 iron ingot (quality 75), 1 wood handle (quality 60)
  Your craft skill: 68

  Choose focus:
  [1] Damage    (base 40, range: 35-55 based on quality + focus)
  [2] Speed     (base 30, range: 25-45)
  [3] Durability (base 50, range: 40-70)

  > 1

  You hammer the blade, focusing on the cutting edge...
  [Skill check: 68 vs difficulty 50 — success with margin 18]

  Created: Iron Sword (Damage 52, Speed 28, Durability 45)
  Condition: 100/100
  Maker: Kai
  Quality: Excellent

  Your craft proficiency has improved! (68.1)
```

Higher skill + higher quality materials + experimentation choice = unique items. Two smiths with the same recipe make different swords. This creates crafter reputation and economic differentiation.

---

## Anti-Abuse: Comprehensive Protections

### Claim Griefing Prevention

| Abuse | Protection |
|-------|-----------|
| Placing claims to block others' expansion | Claims expire if no structure built within 7 days |
| Surrounding another claim with hostile claims | Existing claims get first-right-of-expansion: can expand into adjacent rooms before new claims can be placed within 3 rooms of their border |
| Placing claims on resource-rich areas without using them | Monthly maintenance costs — unused claims become expensive to hold |
| Claim stone spam in wilderness | Material cost to place + maintenance cost + 5-room minimum spacing |

### Permission Abuse Prevention

| Abuse | Protection |
|-------|-----------|
| Modify-holder revokes everyone's access | **48-hour grace period** on permission removals — affected players have 48 hours to retrieve items from community storage and access their structures |
| Modify-holder locks community chest | Contribution log is permanent and visible even without access — community sees the abuse |
| New modify-holder changes everything | Claim split is always available — any contributor can secede, taking their structures with them |
| Social engineering to gain modify | One character, one name — reputation follows. Scamming a settlement ruins you permanently |

### Economic Abuse Prevention

| Abuse | Protection |
|-------|-----------|
| Resource hoarding / monopoly | Resource rotation (nodes deplete and new ones spawn) — can't permanently control supply |
| Price manipulation | No global auction house — prices are local, per-settlement. Hard to corner a distributed market |
| Crafting monopoly (only master in a skill) | Hidden NPC trainers as fallback — expensive but prevents absolute gatekeeping |
| Alt account resource funneling | One account, one character, enforced at account level |

### Territorial Abuse Prevention

| Abuse | Protection |
|-------|-----------|
| Building in someone else's territory | Build permission required — coded, not social |
| Blocking paths with structures | Structures in rooms don't block exits — you can always walk through |
| Resource lockout in claimed territory | Resources in claimed territory are always harvestable by anyone — claim gives +20% yield bonus, not exclusivity |

---

## Skill Tiers & Acquisition

### Tier 1: Universal Skills (Origin World — Everyone Gets These)

Learned naturally through origin world story. Persist across all callings.

**Grove universal skills:**

| Skill | Category | Learned From | Story Moment |
|-------|----------|-------------|--------------|
| **forage** | Survival | Thera / exploration | You need to eat |
| **first_aid** | Survival | Thera | "Learn the basics of healing" |
| **meditate** | Recovery | Thera | "Learn to synchronize with the Pulse" |
| **sprint** | Movement | Brennan / exploration | Exploring the 108 rooms |
| **sneak** | Movement | Exploration | Edge/Thinning zones |
| **kick** | Combat | Instinct / Brennan | First hostile encounter |

(Depths and Reach would have analogous sets — same categories, different flavor.)

### Tier 2: Origin Elective Skills (Side Quests)

Optional — earned through origin side content. Creates early divergence.

| Skill | Origin | Unlocked By |
|-------|--------|-------------|
| **climb** | Grove | Exploring canopy zones |
| **parry** | Grove | Brennan's side quest |
| **focus** | Grove | Deep meditation with Thera |
| **haggle** | Grove | Tomas interaction |

### Tier 3: Origin-Unique Skills

Skills only that origin teaches. Carried into The Barren as a distinctive advantage.

| Skill | Origin | What It Does |
|-------|--------|-------------|
| **sense_pulse** | Grove | Detect living things, sense health, feel disturbances |
| **tend** | Grove | Heal/nurture living things, heal blight |
| **shape** | Grove | Influence plant growth, coax living materials |
| **resonance** | Depths | Sense structural integrity, mineral deposits, hidden passages |
| **excavate** | Depths | Mine, tunnel, create underground passages |
| **forge** | Depths | Work metal, glass, crystal with heat and pressure |
| **tidecraft** | Reach | Read and work with water — currents, tides, purification |
| **navigate** | Reach | Wayfinding on water and in unfamiliar terrain |
| **forecast** | Reach | Predict weather, sense environmental changes |

### Tier 4: Barren Skills (Post-Origin, Specialized)

Discoverable on The Barren through trainers, factions, or player teaching.

**Combat**: bash, thrust, combo_strike, disarm, dodge, ward, mana_shield
**Crafting**: craft, repair, combine, brew, tailor
**Building**: survey, harvest, construct, carpentry, masonry, engineering, architecture, fortification
**Cultivation**: cultivate, terraform, landscape
**Social**: intimidate, persuade, lead, teach
**Movement**: climb (if not from Grove), swim, track

Note: governance/administration is NOT a skill. Settlement management happens through claim permissions and social agreement, not coded professions.

---

## Implementation Phases

### Release Strategy: Staged Alphas

**Alpha 1 (Grove):** Ship the Grove as a complete solo RPG with the new skill/progression system. Tests narrative, skills, Pulse words, combat, crafting. ~4-6 weeks. Gather feedback.

**Alpha 2 (Barren):** Ship the multiplayer sandbox, informed by Alpha 1 feedback. Tests cooperation, economy, territory, building. ~2-3 months after Alpha 1.

This staged approach lets us validate the progression feel before building the sandbox, and compounds learnings between releases.

---

### Alpha 1: Grove (Solo RPG — Target: 4-6 Weeks)

#### What Already Exists (No Work Needed)

| System | Status | Notes |
|--------|--------|-------|
| Navigation (108 rooms) | Done | 8 zones, all exits bidirectional |
| Dialogue trees + quests | Done | 5 main + 4 side quests, 5 NPCs, 225+ dialogue nodes |
| Combat (PvE turn-based) | Done | 667 LOC, end-to-end wired. 3 skills already affect combat |
| Inventory/equipment/shops | Done | Get/drop/equip/unequip/buy/sell all functional |
| Economy (gold) | Done | Mint/burn/transfer/credit/debit |
| Gathering (forage action) | Works | Reads `gathering_node` from room, grants items |
| Cutscenes | Done | Server streaming + client rendering |
| Atmosphere/ambient | Done | Day/night visual descriptions, NPC ambient emotes |
| Death/ghost/resurrect | Done | Existing system functional for Alpha 1 |
| Social (emote/mood/say) | Done | Room-scoped communication |
| Spark AI companion | Done | `ask spark` command, context-aware |
| Godot client | Done | All above features rendered in 3D book UI |

#### What's Deferred to Alpha 2 (Explicitly Cut)

| System | Why Cut | When It Returns |
|--------|---------|-----------------|
| Callings (multiple loadouts) | Solo experience, one skill set is enough | Alpha 2 (multiplayer identity) |
| Skill surrender | No respec pressure in narrative game | Alpha 2 (with callings) |
| Anti-macro (daily caps, diminishing returns) | Solo, no abuse vector | Alpha 2 (multiplayer) |
| Mutual exclusion enforcement | Present choice in story, enforce lock later | Alpha 2 (when other players exist) |
| Derived stats (top-3 formula) | Current flat stats work for combat | Alpha 2 (with callings) |
| Experimentation (crafting focus choice) | Basic craft-from-recipe is enough | Alpha 2 (crafter economy) |
| Resource quality variation | Flat quality for solo | Alpha 2 (crafter differentiation) |
| Item decay | No economic loop to sustain in solo | Alpha 2 (perpetual crafting demand) |
| Weight/carry limits | Current inventory works | Alpha 2 (trade logistics) |
| Day/night gameplay effects | Visual atmosphere exists, gameplay effects can wait | Alpha 2 |
| Death redesign (corpse, condition penalty) | Existing ghost/resurrect works for Grove | Alpha 2 (risk/reward in Barren) |
| `tell` (cross-room messaging) | Solo experience | Alpha 2 |

#### What to Build — Work Breakdown

##### Tier 1: Core Progression (Wire Existing Code) — ~1 Week

Existing `SkillManager` has `train/2` and `practice/3` — fully implemented but unreachable from any client command. Existing `Progression` has `apply_xp/2` — never called. The work is wiring, not writing.

**1. Fix SkillManager data key inconsistency**
- Current: skills stored under atom key `:skills` inside string-keyed `"stats"` component
- Fix: standardize on string keys (`"skills"`) matching all other component data
- Files: `lib/loka/framework/skills/skill_manager.ex`

**2. Replace leveling with typed XP**
- Gut `Progression.apply_xp` level formula (xp_base * n^1.8)
- Replace with typed XP buckets: `entity.components["typed_xp"]` → `%{"combat" => 340, "pulse" => 680, "crafting" => 120, "exploration" => 450}`
- Milestone thresholds: every 500 XP in any type → 2 skill points
- Skill points stored in `entity.components["skill_points"]` → `%{"earned" => 87, "spent" => 62}`
- Files: `lib/loka/framework/progression.ex` (rewrite), new component accessor `lib/loka/components/skill_points.ex`

**3. Wire `train` command to channel**
- New `handle_in "train"` in `game_channel.ex` → calls `SkillManager.train/2` → saves entity → pushes updated skills to client
- Also wire as dialogue action: `teach_skill` action type in `dialogue.ex` (trainers teach through conversation)
- Costs: novice = 2 pts, journeyman = 4 pts, master = 6 pts
- Files: `game_channel.ex`, `lib/loka/framework/dialogue/dialogue.ex`, `lib/loka/framework/dialogue/action.ex`

**4. Wire `practice` call sites**
- Combat victory → `SkillManager.practice(entity, skill_used)`
- Gathering success → `SkillManager.practice(entity, "forage")`
- Crafting completion → `SkillManager.practice(entity, "craft")`
- Pulse weave → `SkillManager.practice(entity, "sense_pulse")`
- Files: `lib/loka/framework/combat/combat.ex`, `lib/loka/game/actions/gathering.ex`, new crafting module, new Pulse module

**5. Wire XP grants**
- Combat victory → combat XP (based on enemy level)
- Gathering → exploration XP
- Crafting → crafting XP
- Pulse weave → Pulse XP
- Quest completion → 3-5 bonus skill points (existing `rewards.ex` hook)
- Files: `combat.ex` (add XP after `check_combat_end :victory`), `gathering.ex`, quest `rewards.ex`

**6. Add `skills` and `status` commands**
- New channel messages: `"skills"` → push skill list with proficiency/tier/XP-to-next
- `"status"` → push name, title (based on total points earned), typed XP progress, skill point count
- Progress bars: `████░░░░░░ 340 / 500 combat XP (next: 2 pts)`
- Title thresholds: 0-25 Newcomer, 26-75 Wanderer, 76-150 Settler, 151-250 Veteran, 251+ Elder
- Files: `game_channel.ex`, `command_parser.ex`

##### Tier 2: Skills in Combat (Extend Existing Hooks) — ~1 Week

`combat.ex` already has `get_skill_level/2` reading from `stats["skills"]`. Three skills are wired: `strength_training` (+damage), `agility` (+dodge), `toughness` (+damage reduction). Extend to the full Grove combat skill set.

**7. Rename and expand combat skills**
- `kick` → replaces `strength_training` as primary damage skill. Bonus damage = proficiency / 5.
- `bash` → new. Chance to STAGGER enemy (miss next turn). Chance = proficiency / 3, cap 33%.
- `parry` → replaces generic "defend" action. Damage reduction = proficiency / 2 (% of incoming).
- `sprint` → flee success chance bonus. Base 40% + proficiency / 2.
- `sneak` → new passive. If sneak > enemy perception: guaranteed first strike.
- `dodge` → replaces `agility`. Passive dodge = proficiency * 0.3%, cap 30%.
- `first_aid` → new combat action. Heal self for 10 + proficiency / 2 HP. Costs your attack turn.
- Files: `lib/loka/framework/combat/combat.ex` (extend `execute_combat_tick`, `player_action`)

**8. Combat skill practice**
- After each combat action, roll proficiency gain for the skill used
- Formula: `(tier_ceiling - current_level) * 0.3%` chance, gain 0.1 on success
- Example: kick at proficiency 15, novice ceiling 33 → 5.4% chance per use
- Files: `combat.ex` (add `maybe_practice_skill` after each action)

**9. Tier ceilings**
- When proficiency hits tier ceiling (33 for novice, 66 for journeyman), stop granting gains
- Show message: "Your kick connects solidly, but you feel you've hit a wall. There's nothing more you can learn on your own."
- Cue player to find a journeyman/master trainer
- Files: `skill_manager.ex` (add ceiling check to `practice/3`)

##### Tier 3: Pulse Word System (New Module) — ~1.5 Weeks

No Pulse code exists. This is the one genuinely new system.

**10. Pulse word engine**
- New module: `lib/loka/framework/pulse/pulse.ex`
- Word storage: `entity.components["pulse_words"]` → `["grow", "root", "life", "form", "light"]`
- Command: `pulse weave <action_word> <target_word>` (parsed by `command_parser.ex`)
- Combination table: hardcoded map in `pulse.ex` for Alpha 1 (YAML-driven in Alpha 2)
- Effect execution: each combo maps to an effect function
- Pulse XP granted on successful weave
- Proficiency check: `sense_pulse` proficiency affects power and success rate
- Files: new `lib/loka/framework/pulse/pulse.ex`, `command_parser.ex` (add `pulse` command)

**11. Seven Grove words**

| Word | Type | Learned From |
|------|------|-------------|
| `grow` | Action (exclusive with `break`) | Grove story — the grow/break choice moment |
| `break` | Action (exclusive with `grow`) | Grove story — the grow/break choice moment |
| `root` | Target | Thera teaches during training session |
| `life` | Target | Thera teaches after healing grove quest |
| `form` | Target | Tomas teaches (side quest) |
| `light` | Target | Discovered in seed_archive (exploration reward) |
| `deep` | Target | Discovered in heartroot_chamber (story moment) |

**12. ~10-15 combinations with effects**

| Combo | Effect | Gameplay Impact |
|-------|--------|-----------------|
| `grow + root` | Accelerate plant growth, heal damaged land | Heals blight patches in Thinning rooms |
| `grow + life` | Nurture living things | Area heal: restores HP to self + allies in room |
| `grow + form` | Shape living wood | Creates a temporary shelter object (lean-to) |
| `grow + light` | Coax bioluminescence | Illuminates dark rooms, reveals hidden details |
| `grow + deep` | Strengthen root networks | Sense all NPCs/creatures within 3 rooms |
| `break + root` | Uproot corruption | Removes blight from a room (stronger than grow+root) |
| `break + life` | Disrupt living energy | Damage + WEAKEN effect on target creature |
| `break + form` | Shatter objects | Demolish weak barriers, open blocked paths |
| `break + light` | Extinguish | Create darkness (sneak bonus in room for 5 minutes) |
| `break + deep` | Fracture foundations | Reveal hidden exits, structural weaknesses |

Unrecognized combinations produce flavor text: sparks, hums, brief sensations. Not errors.

**13. Wire to Grove story**
- `sense_pulse` taught by Thera (existing training session quest objectives)
- First target words taught during training sessions (root, life)
- `grow` vs `break` choice presented during heartroot confrontation (beat 93-98)
- Additional words discovered through exploration and side quests
- Files: existing Thera dialogue YAML (add `teach_skill` actions), quest YAML updates

##### Tier 4: Crafting & Gathering (Replace Stubs) — ~1 Week

**14. Implement crafting**
- New module: `lib/loka/framework/crafting/crafting.ex`
- Replace stub in `gathering.ex` craft function → route to new module
- Flow: `craft <recipe_key>` → look up recipe → check skill requirement → check materials in inventory → consume materials → create item entity → add to inventory → grant crafting XP → practice craft skill
- No experimentation, no quality variation — simple input → output for Alpha 1
- Files: new `lib/loka/framework/crafting/crafting.ex`, `gathering.ex` (replace stub), `game_channel.ex` (wire `"craft"` handle_in)

**15. Five to ten recipes**

| Recipe | Materials | Skill Req | Product |
|--------|-----------|-----------|---------|
| Healing salve | 2 moonpetal, 1 binding fiber | forage:novice | Restores 20 HP |
| Herbal tea | 1 sunleaf, 1 water | forage:novice | Restores 10 HP, Pulse +5% for 5 min |
| Wooden shield | 3 shaped wood, 1 binding fiber | craft:novice | +3 defense |
| Simple blade | 2 shaped wood, 1 stone | craft:novice | +4 attack |
| Rope | 3 binding fiber | craft:novice | Utility (climbing, building) |
| Torch | 1 wood, 1 resin | none | Illuminates dark rooms |
| Poultice | 1 healing salve, 1 moonpetal | first_aid:novice | Restores 35 HP |
| Bark armor | 4 shaped wood, 2 binding fiber | craft:novice | +5 defense |
| Blight ward | 1 binding fiber, pulse weave | sense_pulse:novice | Protects room from blight for 1 hour |
| Rootspeaker staff | 3 shaped wood, 1 crystal | craft:journeyman | +10% Pulse effectiveness |

Recipe data: YAML files in `priv/world/prototypes/recipes/` (entity type `:recipe` already exists in EntityTypes).

**16. Resource nodes in Grove rooms**
- Add `gathering_node` component to ~15 existing Grove rooms
- Examples: moonpetal + sunleaf in `healing_grove`, shaped wood in `western_orchard`, stone in `the_deep`, binding fiber in `understory_crossing`, crystal in `heartroot_antechamber`, resin in `grove_garden`
- Gathering action already reads `gathering_node` — just need the data in room YAML
- Files: room YAML updates (add `gathering_node` to components)

**17. Skill checks on gathering**
- `forage` proficiency affects success rate: base 60% + proficiency * 0.8% (at forage:33 = 86.4%)
- Higher proficiency also affects yield quantity (round up at proficiency thresholds)
- Failed gather: "You search but find nothing useful."
- Files: `gathering.ex` (add skill check before yield rolls)

**18. Combine command**
- Alias for `craft` with field-recipe subset (no workbench needed)
- `combine moonpetal binding_fiber` → healing salve
- Some recipes require workbench structure (Alpha 2), some are field-combinable (Alpha 1)
- Files: `command_parser.ex` (add `combine` alias)

##### Tier 5: Content Wiring & Polish — ~1 Week

**19. Wire 6 universal skills to Grove quests**

| Skill | Quest/Moment | How Learned |
|-------|-------------|-------------|
| `forage` | Exploration — first time entering a room with resources | Auto-granted at proficiency 1 with tutorial message |
| `first_aid` | `grove_arrival` — Thera teaches basics | `teach_skill` dialogue action |
| `meditate` | `grove_belonging` — training session | `teach_skill` dialogue action |
| `sprint` | Exploration — first time running from Thinning zone | Auto-granted on first flee attempt |
| `sneak` | Entering Edge/Thinning zones | Auto-granted with narrative cue |
| `kick` | First hostile encounter (blight creature) | Auto-granted on first combat |

**20. Wire 4 elective skills to side quests**

| Skill | Quest | How Learned |
|-------|-------|-------------|
| `parry` | `side_brennan` — Brennan's patrol training | `teach_skill` in Brennan dialogue |
| `climb` | Canopy zone exploration | Auto-granted on entering canopy_access |
| `focus` | Deep meditation with Thera (training session 2) | `teach_skill` in Thera dialogue |
| `haggle` | Tomas interaction (`side_tomas`) | `teach_skill` in Tomas dialogue |

**21. Wire 3 origin-unique Pulse skills**

| Skill | Story Moment | Effect |
|-------|-------------|--------|
| `sense_pulse` | `grove_belonging` — Thera teaches | Detect living things in adjacent rooms |
| `tend` | `grove_belonging` — healing grove training | Heal blight on plants/land |
| `shape` | `grove_revelation` — small grove moment | Influence plant growth, coax living wood |

**22. NPC trainers via dialogue**
- New dialogue action type: `teach_skill` with fields `skill_key`, `tier`, `cost` (skill points)
- Thera: teaches `first_aid`, `meditate`, `sense_pulse`, `tend`, `shape`, Pulse words
- Brennan: teaches `kick` (journeyman), `parry`, `bash`, `sprint` (journeyman)
- Tomas: teaches `craft`, `haggle`, `forage` (journeyman), `form` (Pulse word)
- Kira: teaches `focus`, `climb` (journeyman)
- Elder Maren: teaches `sneak` (journeyman), `meditate` (journeyman)
- Add `teach_skill` to `@valid_action_types` in `dialogue.ex` and handler in `action.ex`
- Files: NPC dialogue YAML files (add trainer nodes), `dialogue.ex`, `action.ex`

**23. Two to three blight creatures**
- Hostile NPCs in Thinning/Edge zones with `combatant` components
- `blight_hound`: HP 30, ATK 8, DEF 3. Territorial — attacks if you linger. Drops blight-resistant hide.
- `blight_walker`: HP 50, ATK 12, DEF 5. Patrol — moves between rooms. Drops corrupted bone.
- `thorn_beetle`: HP 15, ATK 5, DEF 2. Scavenger — easy first combat. Drops chitin shard.
- Spawn via `spawns:` in room YAML for Thinning/Edge rooms
- Combat XP on victory: 50/100/25 respectively
- Files: new NPC YAML in `priv/world/prototypes/npcs/grove/creatures/`, room YAML updates

**24. Character creation**
- New flow: name → appearance descriptor (freeform short text) → "Choose your origin: The Grove" (only option for Alpha 1)
- On creation: spawn at `awakening_clearing`, grant no skills (learned through story)
- Remove any existing level/stat allocation from creation
- Files: `character_creation.ex` (or equivalent), `game_channel.ex` `"create_character"` handler, Godot `character_creation.gd`

**25. Godot client updates**

| Feature | Client Work | Priority |
|---------|-------------|----------|
| Skill list tab | Render skills with proficiency bars, tier labels | Must-have |
| XP progress display | Show typed XP bars in status tab | Must-have |
| Skill point count | Show available/spent in status tab | Must-have |
| Title display | Show "Settler of the Grove" etc. | Must-have |
| Pulse word UI | `pulse weave` command input, effect text rendering | Must-have |
| Crafting UI | Recipe list, material check, craft button | Must-have |
| Tier ceiling message | Distinct formatting for "you've hit a wall" | Nice-to-have |
| Proficiency gain toast | Brief "+0.1 kick" notification on skill gain | Nice-to-have |

#### Dependency Order & Timeline

```
WEEK 1: Tier 1 — Core Progression Wiring
  ├── Fix SkillManager key inconsistency
  ├── Replace leveling with typed XP + skill points
  ├── Wire train command + teach_skill dialogue action
  ├── Wire practice call sites (combat, gathering)
  ├── Wire XP grants (combat victory, gathering, quests)
  └── Add skills/status commands

WEEK 2: Tier 2 — Combat Skills
  ├── Rename/expand combat skill effects (kick, bash, parry, etc.)
  ├── Add combat skill practice rolls
  ├── Implement tier ceilings with narrative message
  └── Start Tier 3 — Pulse word engine skeleton

WEEK 3: Tier 3 — Pulse Words + Tier 4 — Crafting
  ├── Pulse word engine (combination table, effects, command)
  ├── 7 words, 10-15 combinations
  ├── Implement crafting module (replace stub)
  ├── 5-10 recipes as YAML
  ├── Resource nodes in ~15 Grove rooms
  └── Skill checks on gathering

WEEK 4: Tier 5 — Content Wiring
  ├── Wire all skills to quest moments + NPC trainers
  ├── Create 3 blight creatures with spawns
  ├── Character creation flow
  └── Dialogue YAML updates for teach_skill

WEEK 5: Client + Polish
  ├── Godot client: skill tab, XP bars, Pulse UI, craft UI
  ├── Playtesting: full Grove playthrough with new systems
  └── Balance pass: XP rates, skill gain rates, creature difficulty

WEEK 6: Buffer
  └── Bug fixes, overflow, final polish
```

#### Alpha 1: Definition of Done

A player can:

- [ ] Create a character (name, appearance, Grove origin)
- [ ] Play the full Grove story (108 rooms, 9 quests, all dialogue)
- [ ] Learn skills from NPCs through dialogue (`teach_skill` action)
- [ ] Learn skills automatically through story moments (first combat, first forage)
- [ ] See typed XP progress bars and earn skill points from all activities
- [ ] Spend skill points at trainers to unlock skill tiers (novice → journeyman)
- [ ] Improve skill proficiency through use (UO-style gain rolls)
- [ ] Hit tier ceilings and be prompted to find better trainers
- [ ] Fight blight creatures using kick, bash, parry, first_aid, dodge
- [ ] Learn Pulse words from Thera and through exploration
- [ ] Weave Pulse combinations (`pulse weave grow root`) with real effects
- [ ] Make the grow/break choice as a meaningful story moment
- [ ] Gather resources from ~15 rooms (with forage skill affecting yield)
- [ ] Craft basic items from gathered materials (5-10 recipes)
- [ ] See a `status` screen: skills, typed XP, title, skill points
- [ ] Complete the Grove and see a transition hook ("The Barren awaits...")
- [ ] Do all of the above through the Godot 3D book client

---

### Alpha 2: Barren (Multiplayer Sandbox — Target: 2-3 Months After Alpha 1)

Informed by Alpha 1 feedback. Scope will be refined after Alpha 1 ships.

#### Phase 2a: Multiplayer & Economy

| System | Scope | Depends On |
|--------|-------|-----------|
| Barren Arrival Zone | ~25 hand-crafted rooms (Threshold, Plaza, Training Grounds, First Road, Overlook) | Room YAML, NPC trainers |
| Multiplayer presence | See other players move, act, fight in real-time | Channel presence tracking |
| Communication | `say`, `shout`, `tell`, `emote` + notice boards at physical locations | Channel messages + notice board entity |
| Barren creatures | 10-15 creature types across 5 biome regions, scaling danger with distance | Combat system (Alpha 1) |
| Death/respawn redesign | Downed state, corpse retrieval, item condition penalty, respawn at claim/arrival | New death flow |
| Combat combo chains | Duo chains (2 players) AND trio chains (3 players) with status effects | Multiplayer combat |
| Callings | Second skill set unlocks at 100 pts earned, 24hr real-time switch cooldown | Skill system (Alpha 1) |
| Item decay | Condition/max_condition, repair reduces max, equipped+used items only | Crafting (Alpha 1) |
| Resource quality | 1-100 scale, node quality + skill + PER bonuses | Gathering (Alpha 1) |
| Experimentation | Choose focus during crafting (damage/speed/durability) | Crafting (Alpha 1) |
| Player trade | Direct trade command + market stall structures | Inventory + economy |
| Day/night effects | Creature spawns, resource availability, Pulse power, visibility | Atmosphere (exists) |
| Anti-macro | Daily gain caps, typed XP diminishing returns, contextual gain requirements | Multiplayer needed |

#### Phase 2b: Territory & Building

| System | Scope | Depends On |
|--------|-------|-----------|
| Barren landmark rooms | ~200 hand-crafted rooms across biome regions (NOT procedural) | Room YAML |
| Claim stones | Placement, radius, permissions, merge/split, maintenance | New system |
| Anti-griefing | 7-day build req, first-right-of-expansion, 48hr grace period, open harvesting | Claims |
| Small structures | Firepits, workbenches, claim stones, community chests, market stalls | Claims + crafting |
| Interior rooms | Cabins, workshops, watchtowers — `enter` creates room transition | Structure system |
| Shared storage | Community chest with transparent contribution logs | Structures |
| Area bonuses | Workshop +crafting, healing grove +healing, training ground +proficiency | Structures |
| Basic terraforming | terraform:novice — clear, level, prepare soil, create paths | Skills + claims |
| Travel speed | Paths/roads provide movement speed bonus | Terraforming |
| Trail markers | Cheap craftable, prevents room recycling | Crafting + terraforming |
| `survey` command | Assess terrain, detect landmarks and resources | New command |

> **Key decision: No procedural wilderness in Alpha 2.** Hand-craft ~200 Barren rooms instead. Test the sandbox with static content. Build the procedural generation engine when we know what biomes and room variety players actually want. This cuts the single largest technical risk from the alpha timeline.

### Phase 3: Growth (Post-Alpha, Informed by Player Behavior)

- Second origin world (Depths or Reach — whichever players request more)
- Third calling unlock
- **Procedural wilderness generation** (biome templates, ephemeral rooms, coordinate grid)
- Large structure mini-zones (longhouse, hall — multi-room interiors)
- Structure maintenance and decay system
- Full building tree
- Advanced terraforming (terraform:journeyman — ponds, streams, new exits)
- Master terraforming (origin-specific — grow forests, dig caves, create waterways)
- Seasons (4-month cycle: Growth, Harvest, Scarcity, Renewal)
- Resource rotation (seasonal spawning, node depletion)
- Advanced Pulse weaving (group events, 5+ player synchronize)
- Mutual exclusion Pulse branches fully enforced
- `mail` system (persistent messages)
- `channel` system (subscriber-based group chat)

### Phase 4: Maturity

- Third origin world
- Cross-origin settlement interactions
- Large-scale group terraforming
- Player-authored room descriptions (master terraform + community review)
- Mastery titles at 90+ proficiency
- Faction system
- World events (Blight incursions, storms, resource discoveries)
- Dev team shifts to gardener role — seeding conditions, not designing content

---

## Existing Skill YAML Cleanup

Before implementation, reconcile current 25 skill files:

1. **Delete `meditation.yml`** — overlaps with `meditate.yml`
2. **Rename `dodge_skill.yml` → `dodge.yml`**
3. **Standardize stat names** → STR/DEX/CON/INT/SPI/PER
4. **Unify YAML schema** — one schema with `type: active|passive|toggle`
5. **Add tier/cost fields** — `tiers: {novice: {cost: 2, ceiling: 33}, journeyman: {cost: 4, ceiling: 66}, master: {cost: 6, ceiling: 100}}`
6. **Add typed XP requirements** — `xp_type: combat`, `xp_required: 500`
7. **Add contextual gain conditions** — `gain_context: {requires_combat: true}` or `{requires_target_resources: true}`
8. **Add mutual exclusion fields** — `excludes: [break]` on `grow.yml`
9. **New skills**: sense_pulse, tend, shape, resonance, excavate, forge, tidecraft, navigate, forecast, combine, survey, harvest, construct, cultivate, teach
10. **Pulse word definitions** — new directory `priv/world/pulse_words/` with per-word YAML files defining combinations

---

## Open Questions

### Resolved

1. ~~**Calling names**~~ — player-chosen ("my combat build") or predetermined? **DECIDED: Player-chosen.** Players name their own callings. Allows creative identity without system overhead.
2. ~~**24-hour switch**~~ — real-time or play-time? **DECIDED: Real-time.** Simpler implementation. The 24-hour window prevents rapid abuse. Players who log in on the "wrong" calling can still use universal skills.
3. **PvP** — consensual only? Open-world in certain zones? **DECIDED: No PvP at launch.** Cooperation-first. Future consideration for opt-in PvP zones on future planets.
4. ~~**Cross-calling synergies**~~ — **DECIDED: Yes, via universal skills.** Universal skills use the HIGHER of universal or calling proficiency (see Callings section). No other cross-calling bonus needed — it's already elegant.
5. **Pulse branch choice timing** — **OPEN.** When in the origin story? Too early = uninformed. Too late = doesn't affect origin gameplay. The Grove presents grow/break as the central moral question. Needs playtesting.
6. ~~**Player vendor system**~~ — **DECIDED: Physical market stalls in territory.** No global auction house — prices are local. Crafters build stalls, set prices. Players browse in person or by notice board word-of-mouth. Preserves locality and travel value.
7. ~~**Death penalty**~~ — **DECIDED.** See Death & Respawn section. Items drop at corpse (retrievable), equipped items take 20% condition damage, respawn at nearest claim/arrival. No skill or XP loss.
8. ~~**Group XP sharing**~~ — **DECIDED: Full XP to all group members.** SWG model. Encourages grouping. No splitting — everyone present gets full typed XP for the activity. (Daily diminishing returns still apply per individual.)
9. ~~**Resource nodes in claimed territory**~~ — **DECIDED: Open harvesting, +20% yield bonus for claim holders.** Resources are never exclusive. Claiming gives an economic incentive without gatekeeping. See Anti-Abuse section.
10. ~~**Claim griefing**~~ — **DECIDED.** See Anti-Abuse section. 7-day build requirement, first-right-of-expansion, monthly maintenance, 5-room minimum spacing.
11. **Structure limits per room** — **OPEN.** Scale by room size tag? Needs design. Tentative: small rooms (3 objects max), medium (5), large (8), outdoor (10).
12. ~~**Interior room persistence**~~ — **DECIDED: Always persist.** Interior rooms are regular entities in the DB. Performance cost is negligible — they're just entity records. Only loaded into memory when a player enters (existing EntityServer lazy-load pattern).

### New Open Questions

13. **Skill point pool size** — 250 per calling with 12 pts per mastery allows ~20 mastered skills. Is this too generous? SWG professions cost 80-120 each from a 250 pool (2-3 professions). Our system allows 20 mastered skills. Consider reducing to ~180 points for sharper tradeoffs.
14. **Pulse branch realignment** — Should there be a one-time "branch switch" available per character? Permanent exclusion is right at scale but dangerous with 20-50 alpha players if nobody chose a needed branch. Expensive, narrative-heavy quest chain as a safety valve?
15. **Barren arrival timing** — When in the origin story does the player transition? After full completion (108 beats)? After Act 2? A natural breakpoint that gives enough skills to survive but leaves origin content to return to?
16. **Wilderness coordinate system** — Technical: what spatial model underlies procedural room generation? Hidden hex grid? Cartesian? Need to define before implementation.
17. **Currency** — The doc describes barter economy. Is there an earned currency? When does it get introduced? Phase 1 (alpha) can be pure barter. Define for Phase 2b+.
18. **Async building** — Building projects that require multiple players: can progress be saved across sessions? The MASTER-GDD describes async contribution. Import that pattern. Projects should accumulate contribution over time, not require simultaneous presence.

---

## References

### Primary Inspirations

- **Star Wars Galaxies (Pre-NGE)**: 250 skill points, typed XP, 34 professions, surrender mechanic, player cities, item decay, resource quality, experimentation, entertainer buffs, apprenticeship system
- **LegendMUD**: Spellword combinations, trainer-based acquisition, mutual exclusion, hometown influence
- **Ultima Online**: Use-based 0-100 proficiency, contextual gains, diminishing returns

### Additional Inspirations (from Design Review)

| Game | Relevant System | What to Study |
|------|----------------|---------------|
| **Caves of Qud** | Procedural world with biome regions, template descriptions, handcrafted landmarks in procedural wilderness | Closest analog to our wilderness generation. Study their biome boundary algorithms and description template system. |
| **Haven & Hearth** | Player claims in shared persistent world, claim overlap, decay, organic settlement growth | 15+ years of iterating claim griefing solutions. Study their deed mechanics. |
| **Wurm Online** | Deed system with upkeep, expansion, permissions, player-built persistent world | Most mature "player-shaped world" in any MMO. Direct ancestor of our design. |
| **A Tale in the Desert** | No combat, all social/building, player-run laws, governance experiments | Shows what happens when you give players governance tools without structure. Key lesson: they create complex systems AND bureaucracy. |
| **Albion Online** | Guild/territory with minimal coded governance, permissions + transparent logs | Shows how permissions naturally create hierarchy without coded elections. |
| **Puzzle Pirates** | Non-combat skill expression — every activity is a unique minigame | Inspiration for making crafting ACTIVE and skill-expressing, not menu clicking. |
| **Dwarf Fortress (Adventure Mode)** | Procedural world with room-scale detail, resource distribution, creature ecology | Proves text/tile games can have rich procedural worlds at scale. |

### Key SWG Sources
- [SWG Skills Wiki](https://swg.fandom.com/wiki/Skills)
- [SWG Professions Pre-NGE](https://swg.fandom.com/wiki/Professions_(pre-NGE))
- [SWG Skill Points](https://swg.fandom.com/wiki/Skill_points)
- [SWG Crafting](https://swgr.org/wiki/crafting/)
- [SWG Player Cities](https://swgr.org/wiki/player_cities/)
- [SWG Design Analysis](https://flatfingers-theory.blogspot.com/2007/09/lessons-of-star-wars-galaxies.html)
- [SWG Entertainer Discussion](https://forums.mmorpg.com/discussion/163562/swg-entertainers-did-it-work)

### Loka Internal
- Loka MASTER-GDD Section 4 (skill pillars — partially superseded by this doc)
- Loka skill YAMLs: `server/priv/world/skills/` (25 files, need cleanup)
- Loka Grove content: `server/priv/world/quests/` (training sessions, Pulse learning moments)
- Loka Grove world: `docs/game-design/seedship-forest-world/`

---

## Design Review (Feb 23 2026)

Comprehensive review across 8 perspectives. Findings have been integrated into the doc above; this section records the analysis and rationale.

### 1. Player Experience: Three Player Types

**Combat-focused player:**
- Strengths: combo chain system, no healer/tank roles, typed XP for combat progression
- Weaknesses addressed: Barren creature ecology now designed (see section above), duo combo chains added alongside trio chains, death/respawn system defined
- Remaining risk: combo chains requiring specific players online at alpha scale (20-50). Duo chains mitigate but don't fully solve. Monitor in playtesting.

**Pure crafter/builder:**
- Strengths: SWG-style economy (quality variation, experimentation, item decay) is proven. Building creates actual rooms. Typed XP means crafters never feel like second-class citizens.
- Weaknesses addressed: experimentation system now designed in detail, recipe discovery paths specified, resource quality acquisition clarified
- Remaining risk: async building contribution not yet fully designed (Open Question #18). Projects requiring simultaneous presence will block crafters at low population.

**Social/explorer:**
- Strengths: Pulse word discovery, infinite wilderness, permission-based freeform governance, teaching as mechanically rewarded skill
- Weaknesses addressed: exploration/social XP equalized to 2pts/500 (was 1pt — half rate), Barren narrative layer designed, observation learning rates specified
- Remaining risk: no global chat means social players need physical proximity. Notice boards help. Monitor whether the Arrival Zone plaza becomes the social hub intended.

### 2. Systems Coherence

All major conflicts resolved:
- Calling switch + item decay → decay is use-based only, stored items don't decay
- Derived stat formula → top-3 skill proficiencies / 3 (fixed divisor)
- Universal + calling skill overlap → use HIGHER of the two proficiencies
- Pulse word griefing → targeting rules restrict destructive words to own/unclaimed structures
- Teaching monopoly → hidden NPC trainers as fallback

Remaining coherence concern: **skill point pool size** (250 per calling, 12 per mastery = ~20 mastered skills). May be too generous. See Open Question #13. Needs paper playtesting.

### 3. Economy Viability

**At 20-50 players (alpha):** Item decay + no NPC endgame vendors ensures perpetual demand. Resource quality creates crafter differentiation. Barter economy works at this scale. No currency needed.

**At 1000+ players:** Resource rotation prevents permanent monopolies. Local market stalls (no global auction) prevent price manipulation. Experimentation creates unique items — no two crafters are identical.

**Remaining risks:**
- Claim stone scarcity near arrival zone (first 40 claims are prime real estate)
- Crafter market saturation at high population — experimentation system's depth determines whether this works

### 4. Anti-Abuse

Now comprehensive. See Anti-Abuse section above. Key additions:
- Claim griefing: 7-day build requirement, first-right-of-expansion, maintenance costs
- Permission abuse: 48-hour grace period on removals, permanent contribution logs
- Pulse trolling: targeting rules prevent cross-player destruction
- Teaching gatekeeping: hidden NPC trainers as fallback
- Resource monopoly: resources always open (+20% yield for claim holders, not exclusivity)

### 5. Scope Reality Check

Phase 2 split into 2a (multiplayer economy) and 2b (territory/world generation). Key scope observations:
- Phase 1 (Grove Alpha) is realistic: ~2-3 months for skill system + Grove wiring
- Phase 2a gives a playable multiplayer game without the world generation complexity
- Phase 2b adds the sandbox layer — can ship independently
- Terraforming tiers: design novice only, leave journeyman/master for when players hit ceiling
- Cross-planet dependencies: irrelevant until second planet exists
- Wilderness generation is the most technically complex system — needs detailed technical design before implementation

### 6. Inspiration Gaps

See Additional Inspirations table in References section. Key additions: Caves of Qud (wilderness generation), Haven & Hearth / Wurm Online (claim systems), A Tale in the Desert (freeform governance), Puzzle Pirates (active crafting).

### 7. The Barren at Scale

- **10 players:** Too empty in open wilderness. Arrival Zone plaza is the social anchor. Notice boards bridge gaps. Trail markers let explorers leave traces.
- **50 players:** Goldilocks zone. 2-3 settlements, enough for economy and politics.
- **500 players:** Wilderness generation earns its keep. Multiple settlements, trade routes, real economic differentiation.

Resource scarcity near center and unique resources at distance incentivize spreading rather than clustering. Biome variation in different directions provides natural distribution.

### 8. Missing Systems

All identified gaps now have sections in this doc:
- Death/respawn ✓
- Communication (say, tell, shout, notice boards) ✓
- Day/night cycle ✓
- Creature ecology ✓
- Travel/movement speed ✓
- Inventory/weight ✓
- Barren arrival/onboarding ✓
- Resource quality mechanics ✓
- Experimentation system ✓
- Anti-abuse protections ✓

**Deferred to post-alpha:** Seasons, mail system, party formation, map/cartography, pack animals/mounts.
