# Loka: Master Game Design Document

> **The Blueprint for a Social, Async-First Text MMORPG**
>
> *"You matter here. People know your name. Your actions ripple outward. You're part of something."*

---

## Document Status

| Field | Value |
|-------|-------|
| **Status** | Living Document - Active Development |
| **Version** | 1.0 |
| **Created** | 2026-01-18 |
| **Last Updated** | 2026-01-18 |

**Purpose:** This is the master reference for Loka's game design. All other design documents elaborate on sections defined here.

---

## Table of Contents

1. [Vision & Core Philosophy](#1-vision--core-philosophy)
2. [Confirmed Decisions](#2-confirmed-decisions)
3. [Core Gameplay Loops](#3-core-gameplay-loops)
4. [Stat & Skill System](#4-stat--skill-system)
5. [Progression Philosophy](#5-progression-philosophy)
6. [Async Gameplay Design](#6-async-gameplay-design)
7. [Social Systems](#7-social-systems)
8. [Collaborative Building](#8-collaborative-building)
9. [Economy Design](#9-economy-design)
10. [Planet & Territory Design](#10-planet--territory-design)
11. [Tutorial & Onboarding](#11-tutorial--onboarding)
12. [AI Coexistence Strategy](#12-ai-coexistence-strategy)
13. [Lore & Setting](#13-lore--setting)
14. [Monetization Strategy](#14-monetization-strategy)
15. [Implementation Roadmap](#15-implementation-roadmap)
16. [Appendix: Related Documents](#16-appendix-related-documents)

---

# 1. Vision & Core Philosophy

## 1.1 The Core Promise

> *You're building something that matters, in a world that needs you, alongside people who become friends.*

**Loka** is a cooperative text MMORPG where players settle a shared frontier, build towns, gather resources over real time, and trade with neighbors. Competition is replaced with interdependence. **The world is the antagonist, not other players.**

## 1.2 Design Pillars

| Pillar | Description | Anti-Pattern |
|--------|-------------|--------------|
| **Async-first** | 2-minute check-ins are as valid as 2-hour sessions | Daily login required, hours per session |
| **Social/Community** | People are the content; collaboration over competition | Solo-optimal gameplay, toxicity |
| **Collaborative Building** | Towns, cities, planets shaped by players together | Individual-only progression |
| **Terraforming** | Permanent, visible changes to the world | Static, instanced content |
| **Flexible Time** | No punishment for casual play | FOMO, missing days = falling behind |

## 1.3 What Loka Is NOT

- **NOT a DIY MUD platform** - We create the curated experience
- **NOT a combat-centric game** - Combat supports building/social
- **NOT a grind treadmill** - Time = depth, not power
- **NOT competitive PvP** - Maybe future planets, not core

## 1.4 Target Experience

```
TRADITIONAL MMORPG         →    LOKA VISION
─────────────────────────────────────────────────────
Daily login required       →    Check in when convenient
Hours per session          →    Minutes meaningful
Miss a day = fall behind   →    Progress accumulates
Active grind required      →    Queue and return
Real-time raids            →    Async contributions
Anonymous in millions      →    Person in a community
Kill for loot              →    "I need your leather, you need my grain"
```

## 1.5 The Emotional Journey

| Timeline | Player Experience |
|----------|-------------------|
| **Week 1** | "I have a camp and a small garden. Met my neighbor, traded some berries for tools." |
| **Month 1** | "My homestead has a real house now. I'm getting known for my preserves. Helped defend Millbrook from wolves." |
| **Month 6** | "Riverdale is a proper village. I trained two apprentices in herbalism. We just finished the regional granary project." |
| **Year 1** | "I'm one of the founders of this valley. Newcomers ask me for advice. The region we built is thriving." |

---

# 2. Confirmed Decisions

These decisions are **finalized** and should guide all further design.

## 2.1 Core Decisions

| Decision | Answer | Notes |
|----------|--------|-------|
| **Character creation** | Planet/hometown selection only | No visual customization |
| **Planets at launch** | 3 | Minimum viable, can expand |
| **Hometowns** | 3 (one per planet) | Starting location choice |
| **Player cap per planet** | 10,000 | ~500-1000 concurrent expected |
| **Total capacity** | 30,000 players | Across all 3 planets |
| **Visual style** | Text-only | Icons/illustrations in future |
| **Combat role** | Supporting (quests, materials, XP) | Not primary loop |
| **PvP at launch** | No | Future: frontier/PvP planets |
| **Land ownership** | Personal plots + townships | First-come-first-serve with limits |

## 2.2 Player Cap Rationale

| Metric | Value |
|--------|-------|
| Players per planet | 10,000 |
| Expected concurrent (5-10%) | 500-1,000 |
| Towns of 50 players | ~200 per planet |
| Personal plots available | ~10,000 per planet |

**Why 10,000:**
- Enough for vibrant economy and social fabric
- Room for ~200 towns without crowding
- Quiet areas still available for solitude
- Elixir/Phoenix handles this easily
- Can always add more planets

---

# 3. Core Gameplay Loops

## 3.1 The Primary Loop

```
EXPLORE → DISCOVER → CLAIM → DEVELOP → TRADE → EXPLORE DEEPER
   ↑                                              ↓
   └──────────── resources enable ←───────────────┘
```

## 3.2 Session Rhythm

| Mode | Duration | Activities |
|------|----------|------------|
| **Active play** | 10-30 min | Explore wilderness, encounter dangers, make decisions, interact with others |
| **Passive progression** | hours/days | Workers gather lumber, crops grow, buildings construct |
| **Return trigger** | notification | "Your sawmill finished. Bandits spotted near the north road. A trader from Millbrook arrived." |

## 3.3 The Cooperative Advantage

### Why Cooperative?

- Too much competition and toxicity in games today
- Cooperation creates lasting relationships
- "I need your leather, you need my grain" > "I killed you for loot"
- Better stories emerge from shared struggle than domination

### The World Is The Antagonist

External threats requiring collective response:

| Threat | Description |
|--------|-------------|
| **Harsh winters** | Stockpile together or everyone suffers |
| **Blights/plagues** | Spreads between settlements if not contained |
| **Monster migrations** | Too big for one town to handle |
| **Bandit factions** | NPC enemies that raid, requiring organized defense |
| **Natural disasters** | Floods, fires, droughts |

### Anti-Toxicity Design

- Griefing has no payoff
- Can't destroy others' work
- Stealing is mechanically hard and socially ruinous
- No "villain path"
- Your character is persistent—no throwaway alts

---

# 4. Stat & Skill System

## 4.1 The Six Core Stats

| Stat | Abbr | Primary Use | Secondary Use |
|------|------|-------------|---------------|
| **Strength** | STR | Mining, construction, heavy lifting | Combat damage |
| **Dexterity** | DEX | Precision crafting, fine detail work | Combat accuracy, critical hits |
| **Stamina** | STA | Work duration, health pool | Travel endurance, defense |
| **Intelligence** | INT | Complex crafting, technology unlocks | Magic/abilities |
| **Wisdom** | WIS | Resource efficiency, teaching bonus | Mana pool, perception |
| **Charisma** | CHA | Trade prices, recruitment, diplomacy | Reputation gain rate |

## 4.2 Stat Growth Model

**Hybrid: Base + Use-Based**

```
STAT PROGRESSION
├── Base stats from character creation (backgrounds)
├── Stats grow slowly from relevant actions (Skyrim-style)
├── Soft caps at 50 (diminishing returns begin)
├── Hard cap at 100 (maximum possible)
└── Backgrounds provide +2 to one stat
```

**Growth Examples:**
- Swing pickaxe → STR gains
- Craft precision items → DEX gains
- Complete trades successfully → CHA gains
- Teach another player → WIS gains

### Soft Cap Design (Dark Souls Inspiration)

| Stat Range | Growth Rate | Design Intent |
|------------|-------------|---------------|
| 1-30 | Normal | Easy early gains, accessible |
| 31-50 | 75% | Still worthwhile investment |
| 51-75 | 50% | Specialist territory |
| 76-100 | 25% | Mastery requires dedication |

## 4.3 Skill Categories (5 Pillars)

```
GATHERING (Planet Resources)
├── Mining (ore, gems, stone)
├── Forestry (wood, sap, bark)
├── Farming (crops, livestock)
├── Fishing (aquatic resources)
├── Prospecting (find deposits)
└── Surveying (evaluate land quality)

CRAFTING (Item Creation)
├── Smithing (metal items, tools, weapons)
├── Carpentry (wood items, furniture)
├── Masonry (stone items, decorative)
├── Textiles (clothing, fabric goods)
├── Alchemy (potions, compounds)
├── Engineering (machines, advanced tech)
└── Cooking (food buffs, sustenance)

BUILDING (World Shaping)
├── Construction (structures)
├── Architecture (blueprints, aesthetics)
├── Terraforming (reshape land)
├── Infrastructure (roads, bridges, utilities)
└── Restoration (repair, reclaim ruins)

SOCIAL (Community)
├── Trading (better prices, negotiations)
├── Leadership (town governance bonuses)
├── Teaching (boost others' learning)
├── Diplomacy (inter-faction relations)
├── Lore (history, discovery, naming rights)
└── Reputation (passive - tracks contributions)

COMBAT (Supporting Role)
├── Melee (swords, axes, hammers)
├── Ranged (bows, thrown)
├── Defense (armor, blocking)
├── Tactics (group combat bonuses)
└── Monster Lore (weaknesses, drops)
```

## 4.4 Skill Point Pool

**Expanded Pool: 500 points** (up from original 100)

| Skill Level | Point Cost | Cumulative Total |
|-------------|------------|------------------|
| 1-25 | 1 point/level | 25 points |
| 26-50 | 2 points/level | 75 points |
| 51-75 | 3 points/level | 150 points |
| 76-100 | 4 points/level | 250 points |

**Build Archetypes:**

| Build Style | Point Distribution | Identity |
|-------------|-------------------|----------|
| Deep Specialist | 2 skills at 100 | Master craftsman |
| Expert Generalist | 3 skills at 75 | Versatile contributor |
| Broad Journeyman | 6 skills at 50 | Jack-of-all-trades |
| Wide Novice | 20 skills at 25 | Sampler, explorer |

## 4.5 Skill Synergies (RuneScape Inspiration)

Skills that complement each other provide bonuses:

```yaml
synergies:
  - skills: [mining, smithing]
    bonus: "+10% ore yield when you can process it"

  - skills: [forestry, carpentry]
    bonus: "+10% wood yield, better furniture quality"

  - skills: [architecture, construction]
    bonus: "Buildings cost 15% fewer materials"

  - skills: [trading, diplomacy]
    bonus: "Inter-town trade routes cost less"

  - skills: [teaching, any_skill]
    bonus: "Students learn 20% faster from you"

  - skills: [surveying, prospecting]
    bonus: "Find rare deposits more often"
```

## 4.6 Keystones (Path of Exile Inspiration)

Major trade-off choices that define builds:

```yaml
keystones:
  master_craftsman:
    benefit: "+50% crafting quality"
    drawback: "-25% gathering speed"
    unlock: "Any crafting skill at 75"

  efficient_gatherer:
    benefit: "+30% resource yield"
    drawback: "-20% crafting speed"
    unlock: "Any gathering skill at 75"

  community_leader:
    benefit: "2x reputation gain, governance bonuses"
    drawback: "Personal plot size halved"
    unlock: "Leadership 50, Reputation 100"

  lone_wolf:
    benefit: "+50% solo efficiency"
    drawback: "Cannot join towns, reduced trade prices"
    unlock: "Any 3 skills at 50"
```

> **Detailed Reference:** See `docs/architecture/progression-and-content-design.md` for complete skill definitions, XP formulas, and trainer locations.

---

# 5. Progression Philosophy

## 5.1 Vertical vs Horizontal

**Hybrid Approach (GW2/ESO Model):**

```
VERTICAL PROGRESSION (Levels 1-50)
├── Clear power growth
├── New skills unlock
├── New areas accessible
├── ~2-3 months to cap for casual players

HORIZONTAL PROGRESSION (Post-50)
├── Mastery points (planet-specific)
├── Reputation unlocks
├── Cosmetic achievements
├── Legacy projects
├── No power creep - old content stays relevant
```

## 5.2 XP Sources

| Activity | XP Type | Notes |
|----------|---------|-------|
| Gathering resources | Gathering skills | Scales with rarity |
| Crafting items | Crafting skills | Bonus for new recipes |
| Building structures | Building skills | Bonus for collaborative |
| Completing quests | General + specific | Combat quests → combat XP |
| Teaching players | Teaching + taught skill | Both gain |
| Discovering new areas | Lore | First-finder bonus |
| Contributing to projects | Reputation | Non-skill progression |
| Offline queued actions | Queued skill | 25% of active rate |

## 5.3 Progression Without Power Gaps

- The ceiling is low, the breadth is wide
- A veteran is maybe 50% better, not 1000%
- Three newcomers can challenge a veteran
- Veterans need newcomers (designed dependencies)

## 5.4 New Player Integration

### The Problem
Veteran advantage can feel insurmountable. "All the good spots are taken."

### Solutions

**1. The Frontier Never Closes**
- Wilderness is effectively infinite
- Veterans cluster near safe center
- Newcomers settle edges with higher risk but unclaimed resources

**2. Vertical, Not Just Horizontal**
Alternative paths that don't require land:
- Specialist crafters - work in someone's town, build reputation
- Explorers/Scouts - sell map knowledge, find resources for landowners
- Traders - own a cart, not a settlement
- Mercenaries - protect caravans, clear dangers

**3. Settlements Need People**
- Large projects require many hands
- Veterans *want* newcomers for labor, defense, specialization
- Teaching is a prestige marker

**4. Gentle Decay**
- Inactive settlements slowly degrade
- Not punitive—just entropy
- Abandoned land returns to claimable frontier

---

# 6. Async Gameplay Design

## 6.1 Session Length Parity

### 2-Minute Session Flow

```
1. NOTIFICATION
   "Your stone stockpile is full. Workers await orders."

2. COLLECT (30 seconds)
   - Tap to collect 847 stone
   - See overnight progress summary

3. DECIDE (30 seconds)
   - Quick view: What needs materials?
   - Option A: Contribute to town wall
   - Option B: Build personal workshop

4. QUEUE (30 seconds)
   - Set next 8 hours of gathering
   - Assign workers to tasks

5. SOCIAL (30 seconds)
   - Scan guild chat
   - Quick reply to friend

→ DONE. Meaningful progress in 2 minutes.
```

### 1-Hour Session Flow

```
1. DEEP GATHERING (15 min)
   - Actively mine rare nodes
   - Explore new cave system
   - Clear monster nest

2. CRAFTING (15 min)
   - Use rare materials for special items
   - Experiment with recipes
   - Teach apprentice player

3. BUILDING (15 min)
   - Place structure in town
   - Coordinate guild monument
   - Terraform personal plot

4. SOCIAL (15 min)
   - Town meeting
   - Trade negotiations
   - Help newbie with tutorial

→ DONE. Deep engagement available.
```

## 6.2 Offline Progression

| Activity | Offline Rate | Cap | Notes |
|----------|--------------|-----|-------|
| Resource gathering | 50% | 24 hours | Workers continue |
| Skill XP | 25% | 8 hours | Slow but steady |
| Building progress | 75% | No cap | Projects continue |
| Trade orders | 100% | No cap | Buy/sell at set prices |
| Town defense | 50% | 24 hours | Guards patrol |

**Logging in resets caps** - daily check-ins rewarded but missing days not punished.

## 6.3 No FOMO Design

| Avoid | Prefer |
|-------|--------|
| Daily login streaks that punish | Milestone rewards that accumulate |
| Time-limited events requiring specific hours | Permanent content done anytime |
| Grind to keep up with active players | Catch-up mechanics for returning players |
| Power creep obsoleting old content | Horizontal progression, everything relevant |

---

# 7. Social Systems

## 7.1 The 30 Social Primitives

Loka's social systems are built from composable primitives. Full reference: `docs/game-design/social-primitives.md`

### Communication Primitives

| Primitive | Scope | Persistence |
|-----------|-------|-------------|
| `say` | Room | Ephemeral |
| `whisper` | 1 target in room | Ephemeral |
| `shout` | Adjacent rooms | Ephemeral |
| `tell` | 1 player anywhere | Ephemeral |
| `party` | Party members | Ephemeral |
| `guild` | Guild members | Ephemeral |
| `channel` | Subscribers | Ephemeral |
| `mail` | 1+ players | Persistent |

**No global chat** - intentional. Preserves distance, information travels organically.

### Expression Primitives

| Primitive | Description |
|-----------|-------------|
| **Emotes** | 100+ socials (bow, wave, nod, hug, laugh...) |
| **Moods** | Persistent emotional state that colors actions |
| **Poses** | Visible state in room description |
| **Custom Reactions** | Purchasable expression sets |

### Relationship Primitives

| Primitive | Description |
|-----------|-------------|
| **Friend** | Mutual connection, see status/location |
| **Trust Levels** | Graduated permissions (enter home, access storage) |
| **Block** | Prevent interaction |
| **Follow/Lead** | Automatic movement with target |

### Group Primitives

| Primitive | Description |
|-----------|-------------|
| **Party** | Temporary group (max 6) |
| **Guild** | Persistent organization with ranks |
| **Channel** | Topic-based public/private groups |

### Witnessing Primitives

| Primitive | Description |
|-----------|-------------|
| **Witness** | Formal record of presence at events |
| **Oath** | Promises with mechanical weight |

### Emergent Possibilities

| Primitives Combined | Emergent System |
|---------------------|-----------------|
| oath + witness + reputation | Trust networks |
| party + shared_space + board | Raid guilds |
| mail + journal + witness | Legal contracts |
| emote + mood + pose | Roleplay culture |
| channel + board + vote | Democratic governance |
| title + oath + lineage | Honor systems |
| give + witness + reputation | Gift economies |

## 7.2 Information Flow

**Gossip System:**
- News spreads through witnesses → travelers → distant regions
- Details may change in transmission (feature, not bug)
- First-hand knowledge is valuable

**Tavern Effect:**
- Gathering places accelerate information
- Building a tavern = becoming an information hub

## 7.3 Reputation System

**Built Through:**
- Completing trades fairly
- Helping in crises
- Teaching others
- Keeping promises

**Visible As:**
- General sense when meeting ("well-regarded," "unknown")
- Can ask around ("what do you know about...?")
- Precedes you if notable enough

---

# 8. Collaborative Building

## 8.1 Civic Energy System

> **Source:** `docs/proposals/collaborative-planet-economy.md`

**Civic Energy (CE)** is a daily, non-transferable resource that powers collaborative building:

| Property | Value |
|----------|-------|
| Daily allocation | 10 CE per player |
| Rollover | None - use it or lose it |
| Transferable | No - must be spent personally |
| What it powers | Town projects, infrastructure, monuments |

**Design Intent:** Prevents wealth inequality from dominating collaborative projects. Everyone contributes equally to shared works.

## 8.2 Project Contribution System

Large projects require multiple players over time:

```yaml
project: "Town Hall"
  requirements:
    stone: 5000
    timber: 3000
    iron: 500
    skilled_labor:
      - masonry: 200 hours
      - carpentry: 150 hours
      - architecture: 50 hours

  contributors:
    - player_a: {stone: 1200, masonry_hours: 40}
    - player_b: {timber: 800, carpentry_hours: 60}
    - player_c: {architecture_hours: 50, design_credit: true}

  benefits:
    - All contributors get reputation
    - Town gains governance features
    - Names inscribed on building (legacy)
```

### Contribution Types

| Type | What It Means | Reward |
|------|---------------|--------|
| **Resources** | Donate materials | Contributor credit, reputation |
| **Labor** | Spend skill-hours building | XP, reputation, legacy |
| **Design** | Create blueprints | Design credit, royalties if copied |
| **Funding** | Invest currency | Ownership stake, governance votes |
| **Coordination** | Organize workers | Leadership XP, faction standing |

## 8.3 Settlement Tiers

```
SETTLEMENT PROGRESSION
│
├── Camp (1-5 players)
│   ├── Temporary structures
│   ├── Shared campfire
│   └── No governance needed
│
├── Village (5-20 players)
│   ├── Permanent buildings
│   ├── Basic governance (founder control)
│   └── Simple shared projects
│
├── Town (20-100 players)
│   ├── Specialized buildings
│   ├── Marketplace
│   ├── Council governance
│   └── Custom town laws
│
├── City (100-500 players)
│   ├── Districts
│   ├── Complex governance
│   ├── Monuments
│   └── Inter-town diplomacy
│
└── Capital (500+ players)
    ├── Planetary influence
    ├── Interplanetary trade hubs
    └── Faction headquarters
```

## 8.4 Decay & Abandonment

```
DECAY STATES (from collaborative-planet-economy.md)
│
├── ACTIVE - Maintained, full function
│
├── NEGLECTED (7 days no maintenance)
│   └── Visual wear, reduced efficiency
│
├── DECAYED (30 days)
│   └── Others can claim/salvage
│
├── RUINS (90 days)
│   └── Archaeological content, partial salvage
│
└── CLEARED (180 days)
    └── Land available for new claims
```

**Before Leaving Options:**
- Transfer ownership to friend/guild
- Donate to town (communal property)
- Sell to another player
- Demolish (recover % of resources)
- Abandon (decay timer begins)

---

# 9. Economy Design

## 9.1 Phased Rollout

### Phase 1: NPC Foundation (Launch)

```
NPC VENDORS
├── Buy basic resources at low prices
├── Sell basic supplies at high prices
├── Provide price floor/ceiling
└── Prevent total market collapse
```

### Phase 2: Player Markets (Month 2-3)

```
PLAYER TRADING
├── Direct player-to-player trades
├── Town marketplaces (stalls)
├── Auction system for rare items
└── NPCs still exist as backup
```

### Phase 3: Full Player Economy (Month 6+)

```
PLAYER-DRIVEN
├── NPCs fade to minimal role
├── Players control all production
├── Guilds become economic powers
├── Cross-planet trade routes
└── Currency from player activity only
```

## 9.2 Currency Model

**Single earned currency + resource barter.** No premium currency that buys power.

## 9.3 Economic Principles

- Scarcity is real (resources don't infinitely respawn)
- Value from rarity, labor, quality, need
- No gold fountains (wealth comes from other players)

## 9.4 Regional Economics

| Region | Abundant | Scarce |
|--------|----------|--------|
| Mountains | Stone, ore | Timber, food |
| Forest | Timber, game | Stone, metals |
| Plains | Grain, livestock | Everything else |
| Coast | Fish, salt | Metals, timber |

Natural trade emerges from geography.

---

# 10. Planet & Territory Design

## 10.1 Planet Differentiation

Each planet has unique characteristics driving trade and exploration:

| Planet Type | Unique Resources | Unique Mechanics | Building Style |
|-------------|------------------|------------------|----------------|
| **Temperate** | Timber, crops, livestock | Farming bonuses | Medieval villages |
| **Desert** | Rare gems, glass sand, solar | Water management | Adobe, underground |
| **Volcanic** | Rare metals, obsidian, geothermal | Heat resistance | Stone fortresses |
| **Arctic** | Ice crystals, rare furs, artifacts | Cold mechanics | Insulated structures |
| **Forest** | Exotic woods, herbs, wildlife | Dense terrain | Treehouses, natural |
| **Ocean** | Pearls, coral, deep metals | Underwater building | Floating cities |
| **Barren** | Ancient ruins, tech artifacts | Archaeology skill | Reclaimed structures |

## 10.2 Cross-Planet Dependencies

```
Planet A (Forest)     Planet B (Volcanic)     Planet C (Arctic)
     │                      │                      │
  Rare Wood ──────────► Smelting ◄────────── Ice Crystals
     │                      │                      │
     └──────────────► Super Alloy ◄────────────────┘
                           │
                    Required for advanced
                    building blueprints
```

**Design Intent:** No single planet is self-sufficient for endgame content.

## 10.3 Land Ownership

**Hybrid System:**

```
PERSONAL PLOTS
├── Each player gets small personal plot (free)
├── Can be anywhere unclaimed
├── Protected from griefing
├── Size upgrades cost resources/reputation
└── Max size cap prevents hoarding

TOWNSHIP ZONES
├── Towns claim territory (expanding circles)
├── Town leadership allocates plots
├── Shared buildings on communal land
├── Zoning: residential, commercial, industrial
└── Taxes fund improvements
```

## 10.4 Planet Lifecycle

> **Source:** `docs/proposals/collaborative-planet-economy.md`

```
PLANET PHASES
│
├── SEEDING - Planet discovered, initial exploration
│
├── TERRAFORMING - Environmental shaping, infrastructure
│
├── FOUNDING - First settlements establish
│
├── FLOURISHING - Mature civilization, full features
│
└── [FUTURE] DECLINE/RENEWAL - End-game cycles
```

---

# 11. Tutorial & Onboarding

> **Full Reference:** [Familiar Companion System](./familiar-companion-system.md)

## 11.1 The Familiar: AI Companion Guide

Every player bonds with a **Spark**—an AI companion that serves as:

| Role | Description |
|------|-------------|
| **Tutorial Guide** | Teaches new players the game through natural conversation |
| **AI Assistant** | Answers questions about mechanics, progress, lore |
| **Lore Character** | Ancient AI fragment with personality and history |
| **Persistent Companion** | Grows with the player over time |

### Inspiration

Like **Paimon** in Genshin Impact, but designed for text:
- Guides through onboarding naturally
- Always available via `ask spark <question>` or `?`
- Has personality (curious, helpful, modest, dry humor)
- Respects player agency—helps but doesn't play for you

### Lore Basis

```
When you emerged from the awakening pod, a mote of light separated
from the ancient machinery and drifted toward you.

"Greetings, newly awakened. I am a Spark—a fragment of the gate
builders' ancient network. I have waited a long time for someone
to guide. Will you accept my company?"
```

Sparks are fragments of the gate network AI, each unique from centuries of solitary existence.

## 11.2 The First 10 Minutes

### Phase 1: Awakening (2 min)
- Wake in ancient chamber
- Bond with Spark
- First dialogue choice (shapes initial relationship, not mechanics)

### Phase 2: First Steps (3 min)
- Learn movement (`north`, `look`)
- Exit to view new homeworld
- Spark provides gentle guidance

### Phase 3: Core Mechanics (5 min)
- Walk to hometown
- Meet first NPC
- Inventory basics
- Learn `ask spark` for help

### Tutorial Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Integrated** | Tutorial IS the game, not separate mode |
| **Skippable** | Experienced players can skip |
| **Replayable** | Refresh available anytime |
| **Natural** | Spark teaches through conversation |
| **Non-blocking** | Never forces player to stop |

## 11.3 Familiar Capabilities

### What It Can Help With

```
> ask spark about combat

[Spark]
"Combat favors preparation over reflexes. Your Melee skill (15)
provides decent damage. Consider carrying healing potions and
avoiding enemies above your level.

Want me to explain specific tactics?"
```

| Category | Examples |
|----------|----------|
| **Mechanics** | "How do I craft?" "What does this skill do?" |
| **Progress** | "What should I do next?" "Am I ready for the mountain?" |
| **Navigation** | "Where is the blacksmith?" "How do I get to Planet B?" |
| **Lore** | "Tell me about the Dragon War" "Who built the gates?" |
| **Social** | "Who is player_kim?" "What guilds are recruiting?" |

### What It Cannot Do

- Play for the player while away
- Guarantee optimal builds
- Predict other players' actions
- Bypass game rules

## 11.4 Returning Player Experience

```
[You log in after 30 days away]

[Spark glows warmly]
"Welcome back! A few things have changed:

- Your sawmill produced 847 lumber
- The town wall project finished (your contribution: 12%)
- Two new players moved into the neighborhood

Would you like a refresher on the controls?"

[Show me what's new] [Just let me play] [Remind me of controls]
```

## 11.5 Bond Progression

| Level | Name | Unlock | Flavor |
|-------|------|--------|--------|
| 1 | Stranger | Start | Formal, uncertain |
| 2 | Acquaintance | Tutorial complete | Warming up |
| 3 | Companion | 7 days played | Personal touches |
| 4 | Friend | 30 days played | Shares uncertainties |
| 5 | Bonded | Major milestone | Unique, deep dialogue |

As bond deepens, the Spark:
- Anticipates your questions
- Shares memories of the ancient world
- Develops genuine personality quirks
- Remembers your journey together

---

# 12. AI Coexistence Strategy

> **Full Reference:** `docs/product/ai-resilience-strategy.md`

## 11.1 Philosophy

**The question isn't "how do I prevent AI automation?" but rather "what kind of game thrives when automation is ubiquitous?"**

For text-based games, complete bot prevention is essentially impossible:
- You can't distinguish human typing from AI typing
- Detection is an arms race you can't win
- False positives drive away legitimate players

**Instead, design systems that:**
1. Make automation less valuable
2. Make human elements more valuable
3. Leverage automation as a feature

## 11.2 What Cannot Be Automated

- Genuine emotional connection
- Earned trust over time
- Creative expression that resonates with humans
- Wisdom transmission
- Mentorship relationships
- Community belonging
- Personal growth through challenge

## 11.3 Design Patterns

### Pattern 1: Meaningful Scarcity
Shift value to non-farmable elements (unique discoveries, player-authored content).

### Pattern 2: Social Proof Requirements
High-value content requires human vouching/witnessing.

### Pattern 3: Ephemeral Content
Content that exists only in the moment can't be reliably farmed.

### Pattern 4: Embrace Automation
What if automation is a game mechanic? "Minions" that automate basic tasks, controlled by the game.

### Pattern 5: Human-Only Content
- Collaborative storytelling
- Social deduction games
- Emergent politics
- Real-time creative challenges

## 11.4 The Living School Vision

Loka is not a game to be "beaten" but a **virtual dojo**—a living, breathing world where players:
1. Learn about themselves through challenge and reflection
2. Mentor and be mentored in wisdom traditions
3. Co-create the world through collaborative storytelling
4. Practice emotional regulation in a safe sandbox
5. Build genuine community that extends beyond the game

### Mentorship & Lineage

Every player traces their teaching back through generations:

```
Grandmaster Chen (founding player, 2025)
    └── Master Wei
        └── Master Liu
            └── Journeyman Park
                └── Student Kim (you)
```

- Lineage is permanent record
- Achievements reflect on lineage
- Special abilities pass down lineages

## 11.5 Strategic Summary

**The real competitive moat isn't anti-cheat technology. It's building a community where being human matters.**

---

# 13. Lore & Setting

## 13.1 Core Concept: "Planetary Cultures from Historical Seeds"

**Inspiration:** [LegendMUD](https://en.wikipedia.org/wiki/LegendMUD) divides its world into three historical eras (Ancient, Medieval, Industrial), where each area represents "the world the way they thought it was" - history with myth and legend intact.

**Loka's Twist:** Each planet is an entire civilization that evolved from a historical Earth culture/era, but with technology upgraded to connect to the stars.

```
EARTH HISTORICAL ERA  →  PLANETARY CIVILIZATION
─────────────────────────────────────────────────
Ancient Celtic        →  Planet with druidic traditions,
                         nature worship, Sidhe legends
                         (now with starships)

Medieval Japanese     →  Planet with Shogunate governance,
                         honor codes, martial traditions
                         (connected via orbital gates)

Renaissance Italian   →  Planet with city-state politics,
                         artisan guilds, merchant princes
                         (trading across star systems)
```

## 13.2 The Setting

**Sci-fi Foundation:**
- Faster-than-light travel exists (gates, stations, ships)
- All planets connected to interstellar network
- Technology is universal; culture is unique per planet

**Historical Flavor:**
- Each planet's culture, values, morals, stories evolved from a specific historical Earth era
- Not "frozen in time" but organically developed over centuries
- "What if the Roman Republic became a space civilization?"

**The Magic Question:**
Following LegendMUD's principle: "If the people of that time believed in magic, you will find it there."
- Some planets have "magic" (psionic, spiritual, naturalistic)
- Others are purely technological
- This is cultural, not contradictory

## 13.3 Player Origin

Players are new arrivals. Current lean: **emergence/awakening** - players arrive without predetermined history, can integrate into any planetary culture.

This supports:
- Choosing any hometown
- Being a "new citizen" learning the culture
- No lore burden for new players
- Mystery about the origin to develop later

## 13.4 Interstellar Connection

**Travel Methods:**
- **Gates:** Ancient network of portals (who built them? lore mystery)
- **Stations:** Orbital hubs for interplanetary commerce
- **Ships:** For exploration, trade routes, frontier zones

## 13.5 The Three Launch Planets (To Be Designed)

Each planet needs:
1. Historical inspiration (era/culture)
2. Unique resources (drives trade)
3. Cultural flavor (values, aesthetics, social norms)
4. Building style (architecture, materials)
5. Starting experience (hometown area)

**Example Framework:**

| Planet | Historical Seed | Key Values | Unique Resources | Building Style |
|--------|-----------------|------------|------------------|----------------|
| **Planet A** | Celtic/Druidic | Nature harmony, cycles, oral tradition | Rare woods, living crystals, herbs | Organic, grown structures |
| **Planet B** | Mediterranean Trade Republic | Commerce, art, diplomacy, family | Fine metals, pigments, textiles | Stone, marble, mosaics |
| **Planet C** | East Asian Imperial | Honor, discipline, craftsmanship, hierarchy | Rare alloys, precision components | Wood, paper, gardens |

*These are examples - actual planets to be designed.*

---

# 14. Monetization Strategy

> **Full Reference:** `docs/product/calm-monetization-strategies.md`, `docs/product/monetization-ideas.md`

## 14.1 Philosophy: "Calm Monetization"

**Core principle:** Players should feel grateful for the option to pay, not pressured to pay.

## 14.2 Tiered Model

| Tier | Price | Gets |
|------|-------|------|
| **Wanderer** (Free) | $0 | Full exploration, social features, can tip |
| **Resident** | $5/mo | Personal room, journal, garden plot |
| **Builder** | $10/mo | 5 rooms, receive tips, discovery listing |
| **Architect** | $15/mo | 20+ rooms, NPC creation, revenue share |

## 14.3 Launch Priorities (P0)

1. **Gifting** - Gift subscriptions to others
2. **Privacy spaces** - Private instances
3. **Pay-what-you-want** - Voluntary donations

## 14.4 Anti-Patterns Avoided

- No battle pass / FOMO
- No loot boxes / gacha
- No premium currency
- No energy systems
- No pay-to-win

---

# 15. Implementation Roadmap

## 15.1 Phase 1: Foundation (Now - 3 months)

**Core Social Infrastructure**
- [ ] Basic mentorship system (accept/assign relationships)
- [ ] Simple reputation tracking (reliability, generosity)
- [ ] Witness system for major actions
- [ ] Campfire spaces (small group gathering)

**Core Gameplay**
- [ ] Basic gathering and crafting loops
- [ ] Personal plot claiming
- [ ] Settlement founding (Camp → Village)

## 15.2 Phase 2: Deepening (3-6 months)

**Mentorship & Lineage**
- [ ] Full lineage tracking
- [ ] Teaching moment mechanics
- [ ] Advancement-through-demonstration
- [ ] Master rank system

**Co-Creation**
- [ ] Player room creation
- [ ] Simple item creation
- [ ] Journal/chronicle system
- [ ] Content approval workflow

**Governance**
- [ ] Town council elections
- [ ] Basic legislation system
- [ ] Peer mediation for disputes

## 15.3 Phase 3: Maturation (6-12 months)

**Full Economy**
- [ ] Cross-planet trade routes
- [ ] Player-run marketplaces
- [ ] Guild economic systems

**Living World**
- [ ] Player-built structures
- [ ] World evolution from player actions
- [ ] Legacy system
- [ ] Decay and renewal cycles

## 15.4 Phase 4: Emergence (12+ months)

At this point, systems should enable emergent culture:
- Player-created schools and traditions
- Organic governance evolution
- Living history and mythology
- Self-sustaining mentor chains
- Community-driven content

---

# 16. Appendix: Related Documents

## 16.1 Detailed Design Documents

| Document | Contents |
|----------|----------|
| `docs/game-design/CONTENT-DESIGN-FRAMEWORK.md` | **How to design content** — the 5-layer methodology, bead framework, skill gating philosophy, design checklist |
| `docs/game-design/seedship-forest-world/DECISIONS.md` | All greenlit decisions for the Grove (first world) — instancing, skill split, content scope, etc. |
| `docs/architecture/progression-and-content-design.md` | Complete skill definitions, XP formulas, trainers |
| `docs/architecture/immersion-systems-design.md` | Stat architecture, karma system, meditation |
| `docs/game-design/social-primitives.md` | All 30 social primitives with implementation notes |
| `docs/game-design/familiar-companion-system.md` | Tutorial guide, AI assistant, Spark companion |
| `docs/game-design/llm-assisted-gameplay.md` | AI integration strategy, creative quests, social puzzles |
| `docs/proposals/collaborative-planet-economy.md` | Civic Energy, planet lifecycle, decay states |
| `docs/product/ai-resilience-strategy.md` | Full AI coexistence strategy, Living School vision |
| `docs/game-design/cooperative-town-builder-vision.md` | Original vision document |

## 16.2 Monetization Documents

| Document | Contents |
|----------|----------|
| `docs/product/calm-monetization-strategies.md` | 10 ethical monetization approaches |
| `docs/product/monetization-ideas.md` | Tiered subscription model details |
| `docs/product/monetization-comparison.md` | Launch priorities, revenue projections |

## 16.3 Technical Documents

| Document | Contents |
|----------|----------|
| `CLAUDE.md` | Technical implementation guide |
| `docs/architecture/` | System architecture documents |
| `docs/framework/` | Framework module documentation |

---

## Revision History

| Date | Changes |
|------|---------|
| 2026-01-18 | Initial master GDD created from consolidation of all planning documents |
| 2026-01-18 | Added Section 11: Tutorial & Onboarding with Familiar/Spark companion system |

---

## Open Questions

### Design Questions

1. ~~**Starting experience:**~~ ✓ Awakening sequence with Spark companion (see Section 11)
2. **Social onboarding:** How do invite links work?
3. **Hometown differentiation:** How do the 3 starting locations differ?

### Lore Questions

4. **What happened to Earth?** (Lost? Destroyed? Still exists but isolated?)
5. **Who built the gate network?** (Precursors? Future humans? Unknown?)
6. **How long have humans been in space?** (Centuries? Millennia?)
7. **Are there non-humans?** (AI? Aliens? Uplifted species?)

### Technical Questions

8. **Current Loka codebase gaps** for this vision?
9. **Offline progression implementation?**
10. **Cross-planet travel mechanics?**

---

## Next Steps

### Decided ✓
- [x] Character creation approach (hometown selection)
- [x] Number of planets at launch (3)
- [x] Player cap per planet (10,000)
- [x] Visual style (text-only)
- [x] Monetization approach (calm, tiered subs)

### To Design
- [x] **Tutorial experience:** Familiar companion system designed (see Section 11)
- [ ] **3 hometowns:** Define each planet's theme, resources, culture
- [ ] **Invite link system:** Social onboarding flow

### To Build
- [ ] **Familiar/Spark system:** Implement `ask spark` command and LLM integration
- [ ] Map stat/skill system to existing Loka codebase
- [ ] Identify technical gaps for async progression
- [ ] Prototype offline worker system
- [ ] Design cross-planet travel UX

### To Test
- [ ] Paper playtest skill synergies
- [ ] Balance skill point costs
- [ ] Simulate economy with 3 planet types
