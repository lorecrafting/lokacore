# Stat & Skill System Design Proposal

> ⚠️ **DEPRECATED:** This document has been consolidated into the **Master Game Design Document**.
>
> **See:** [`docs/game-design/MASTER-GDD.md`](../game-design/MASTER-GDD.md)
>
> This file is kept for historical reference and research notes.

---

> **Status:** Superseded by MASTER-GDD.md
> **Created:** 2026-01-18
> **Last Updated:** 2026-01-18
> **Superseded:** 2026-01-18

## Executive Summary

This document captures research and design proposals for Loka's stat and skill system, informed by analysis of successful MMORPGs, RPGs, and games that align with our vision of a **social, async-friendly text MMORPG with collaborative building**.

### Core Vision

| Principle | Description |
|-----------|-------------|
| **Async-first** | 2-minute check-ins are as valid as 2-hour sessions |
| **Social/Community** | People are the content; collaboration over competition |
| **Collaborative Building** | Towns, cities, planets shaped by players together |
| **Terraforming** | Permanent, visible changes to the world |
| **Flexible Time** | No punishment for casual play |

---

## Confirmed Decisions

These decisions have been made and should guide further design:

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

### Player Cap Rationale

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

## Table of Contents

1. [Confirmed Decisions](#confirmed-decisions)
2. [Research Summary](#research-summary)
3. [Inspirational Games](#inspirational-games)
4. [Core Stats Design](#core-stats-design)
5. [Skill System Design](#skill-system-design)
6. [Progression Philosophy](#progression-philosophy)
7. [Async Gameplay Design](#async-gameplay-design)
8. [Collaborative Building](#collaborative-building)
9. [Planet & Territory Design](#planet--territory-design)
10. [Social Systems](#social-systems)
11. [Economy Design](#economy-design)
12. [Combat Role](#combat-role)
13. [Monetization Strategy](#monetization-strategy)
14. [Social Onboarding](#social-onboarding-to-be-designed)
15. [Open Questions](#open-questions)
16. [Lore & Setting](#lore--setting-draft-concepts)
17. [Sources & References](#sources--references)

---

## Research Summary

### Top MMORPGs Analyzed

| Game | Key Innovation | Relevance to Loka |
|------|----------------|-------------------|
| **World of Warcraft** | Quest-driven accessibility | Onboarding, clear progression |
| **Final Fantasy XIV** | One character, all classes | Flexibility without alts |
| **RuneScape** | 28 interlocking skills, 20+ years stable | Skill interdependence |
| **Guild Wars 2** | Horizontal progression, level scaling | Content longevity |
| **Elder Scrolls Online** | One Tamriel scaling, megaserver | Mixed-level play |
| **EVE Online** | Real-time skill training, single universe | Async progression |
| **Ultima Online** | 700-point skill cap, player housing | Forced specialization |
| **Path of Exile** | 1,500+ passive nodes, keystones | Deep customization |

### Top RPGs Analyzed

| Game | Key Innovation | Relevance to Loka |
|------|----------------|-------------------|
| **Skyrim** | Use-based skill growth | Organic progression |
| **Dark Souls** | Soft caps, build trade-offs | Meaningful choices |
| **Disco Elysium** | Psychology as stats, Thought Cabinet | Narrative depth in text |
| **Diablo 2** | Skill trees with synergies | Visual progression |
| **Baldur's Gate 3** | D&D dice system, visible rolls | Transparency |

### Social/Building Games Analyzed

| Game | Key Innovation | Relevance to Loka |
|------|----------------|-------------------|
| **A Tale in the Desert** | No combat, social tests, player laws | Community-first design |
| **Wurm Online** | Terraforming, player-built world | Permanent world changes |
| **BitCraft** | Civilization building, single world | Town → city progression |
| **Ymir** | Async civilization, offline growth | Persistent population |
| **Prosperous Universe** | Async economy, hours/days actions | Check-in gameplay |

---

## Inspirational Games

### A Tale in the Desert - Social Without Combat

> "A social MMORPG which does not include combat. Instead, social activities provide the basis of most interaction."

**Key Lessons:**
- Tests require community cooperation
- Player-written laws affect gameplay
- "No combat ≠ no conflict" - social dynamics create drama
- Architecture discipline: build monuments together

### Wurm Online - Terraforming Pioneer

> "The world you arrive in is completely player-built...the very land can be terraformed, shovel by shovel."

**Key Lessons:**
- 130+ skills, use-based progression
- Major events recorded as history
- Infrastructure (roads, bridges) benefits everyone
- Influenced Minecraft's design

### BitCraft - Civilization Building

> "Players work together to build a new civilization...build from a small village into a global economic hub."

**Key Lessons:**
- Single shared world, no shards
- Town building as core loop
- "You're never forced to group up—you choose your level of social interaction"
- Player-driven economy

### Prosperous Universe - Async Economy

> "Actions take hours or days...no grind required: success is not limited by time input."

**Key Lessons:**
- Queue production, return hours later
- Every resource made by real players
- Browser-based, check in anywhere
- Deep systems without requiring active play

---

## Core Stats Design

### The Six Core Stats

| Stat | Abbr | Primary Use | Secondary Use |
|------|------|-------------|---------------|
| **Strength** | STR | Mining, construction, heavy lifting | Combat damage |
| **Dexterity** | DEX | Precision crafting, fine detail work | Combat accuracy, critical hits |
| **Stamina** | STA | Work duration, health pool | Travel endurance, defense |
| **Intelligence** | INT | Complex crafting, technology unlocks | Magic/abilities |
| **Wisdom** | WIS | Resource efficiency, teaching bonus | Mana pool, perception |
| **Charisma** | CHA | Trade prices, recruitment, diplomacy | Reputation gain rate |

### Stat Growth Model

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

**Why Soft Caps?**
- Prevents one-dimensional "dump all into STR" builds
- Encourages diverse stat investment
- Specialists are better but not overwhelmingly so

---

## Skill System Design

### Skill Categories (5 Pillars)

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

### Skill Point Pool

**Expanded Pool: 500 points** (up from current 100)

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

### Skill Synergies (RuneScape Inspiration)

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

### Skill Prerequisites (Skill Web)

To prevent clone builds and create natural progression paths:

```yaml
prerequisites:
  engineering:
    requires:
      - smithing: 25
      - carpentry: 25

  architecture:
    requires:
      - construction: 30
      - masonry: 20

  leadership:
    requires:
      - reputation: 50
      - diplomacy: 20

  terraforming:
    requires:
      - mining: 40
      - surveying: 30
```

### Keystones (Path of Exile Inspiration)

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

---

## Progression Philosophy

### Vertical vs Horizontal

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

### XP Sources

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

### Level Scaling (Optional)

For mixed-level group play:

```
SCALING OPTIONS
├── Mentor down: High-level players scale to zone
├── Apprentice up: Low-level players boosted in groups
├── No scaling: Traditional zones with level requirements
└── Hybrid: Scaling in towns, no scaling in wilderness
```

---

## Async Gameplay Design

### Design Principles

```
TRADITIONAL MMORPG         →    LOKA VISION
─────────────────────────────────────────────────────
Daily login required       →    Check in when convenient
Hours per session          →    Minutes meaningful
Miss a day = fall behind   →    Progress accumulates
Active grind required      →    Queue and return
Real-time raids            →    Async contributions
```

### Session Length Parity

#### 2-Minute Session Flow

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

#### 1-Hour Session Flow

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

### Offline Progression

| Activity | Offline Rate | Cap | Notes |
|----------|--------------|-----|-------|
| Resource gathering | 50% | 24 hours | Workers continue |
| Skill XP | 25% | 8 hours | Slow but steady |
| Building progress | 75% | No cap | Projects continue |
| Trade orders | 100% | No cap | Buy/sell at set prices |
| Town defense | 50% | 24 hours | Guards patrol |

**Logging in resets caps** - daily check-ins rewarded but missing days not punished.

### No FOMO Design

| Avoid | Prefer |
|-------|--------|
| Daily login streaks that punish | Milestone rewards that accumulate |
| Time-limited events requiring specific hours | Permanent content done anytime |
| Grind to keep up with active players | Catch-up mechanics for returning players |
| Power creep obsoleting old content | Horizontal progression, everything relevant |

---

## Collaborative Building

### Project Contribution System

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

### Settlement Tiers

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

---

## Planet & Territory Design

### Planet Differentiation

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

### Cross-Planet Dependencies

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

### Land Ownership

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

### First-Come-First-Serve with Limits

| Mechanic | How It Works |
|----------|--------------|
| **Claim limits** | Max 1 personal plot + 1 town membership |
| **Maintenance cost** | Unused land decays, becomes reclaimable |
| **Prime location premium** | Best spots require more resources |
| **Expansion unlocks** | New planets open periodically |

### Abandoned Buildings

```
ABANDONMENT TIMELINE
│
├── Day 0: Player stops logging in
│
├── Day 7: Building marked "inactive"
│   └── Maintenance stops, slow decay
│
├── Day 30: Building marked "abandoned"
│   └── Others can claim/salvage
│
├── Day 90: Building crumbles
│   └── Resources partially recoverable
│
└── Day 180: Land fully cleared
    └── Available for new claims
```

**Before Leaving Options:**
- Transfer ownership to friend/guild
- Donate to town (communal property)
- Sell to another player
- Demolish (recover % of resources)
- Abandon (decay timer begins)

**Archaeology Opportunity:** Abandoned buildings become exploration content.

---

## Social Systems

### Reputation System

Reputation replaces traditional "level" as status measure:

```
REPUTATION SOURCES
├── Contribution to shared projects
├── Helping new players (teaching)
├── Trading fairly (no scams)
├── Community votes
├── Completing collaborative achievements
├── Time investment (veteran bonus)
└── Discovery (first-finder credits)

REPUTATION BENEFITS
├── Voting power in town decisions
├── Access to leadership roles
├── Priority in project sign-ups
├── Visible titles and recognition
├── Advanced building blueprints
├── Mentor status (teaching bonuses)
└── Governance eligibility
```

### Governance Models

**Scales with settlement size:**

| Settlement Size | Governance Model |
|-----------------|------------------|
| Camp → Village | Founder control |
| Village → Town | Council (founder + 2-4 elected) |
| Town → City | Mayor + Departments + Council |
| City → Capital | Full representative government |

**Advanced Feature (ATITD-inspired):** Towns can write custom laws.

### Chat & Communication

**Synchronous Channels:**

| Channel | Scope | Purpose |
|---------|-------|---------|
| **Local** | Same room/area | Immediate surroundings |
| **Town** | Settlement members | Coordination |
| **Guild** | Faction members | Organization |
| **Trade** | Planet-wide | Commerce |
| **Global** | All planets | Announcements, LFG |
| **Direct** | 1-on-1 | Private messages |

**Asynchronous Communication:**
- Message boards in towns (persistent posts)
- Mail system with item attachments
- Project comments (discuss builds)
- Guild journals (shared progress logs)

### Social Events

Scheduled activities for community:
- Town festivals (bonus XP during window)
- Building ceremonies (monument unveilings)
- Markets (player-run trading hours)
- Governance sessions (voting periods)

---

## Economy Design

### Phased Rollout

#### Phase 1: NPC Foundation (Launch)

```
NPC VENDORS
├── Buy basic resources at low prices
├── Sell basic supplies at high prices
├── Provide price floor/ceiling
└── Prevent total market collapse
```

**Why:** New games need stability.

#### Phase 2: Player Markets (Month 2-3)

```
PLAYER TRADING
├── Direct player-to-player trades
├── Town marketplaces (stalls)
├── Auction system for rare items
└── NPCs still exist as backup
```

#### Phase 3: Full Player Economy (Month 6+)

```
PLAYER-DRIVEN
├── NPCs fade to minimal role
├── Players control all production
├── Guilds become economic powers
├── Cross-planet trade routes
└── Currency from player activity only
```

### Currency Model

**Recommendation:** Single earned currency + resource barter. No premium currency that buys power.

| Approach | Pros | Cons |
|----------|------|------|
| Single currency | Simple, universal | Inflation risk |
| Resource barter | No inflation | Clunky trading |
| Dual (premium + earned) | Monetization | Pay-to-win risk |
| Planet-specific | Regional economies | Complexity |

---

## Combat Role

### Design Decision

Combat is a **supporting system**, not the core loop.

### Combat Purposes

| Purpose | Description |
|---------|-------------|
| **Quests** | Story progression, exploration |
| **Material grinding** | Monster drops for crafting |
| **Territory defense** | Protect settlements from threats |
| **Exploration** | Clear dangerous areas for building |
| **XP source** | One of many progression paths |

### Combat Stats (Minimal)

```
COMBAT SKILLS
├── Melee (swords, axes, hammers)
├── Ranged (bows, thrown)
├── Defense (armor, blocking)
├── Tactics (group combat bonuses)
└── Monster Lore (weaknesses, drops)
```

### PvP Design (Future Expansion)

**Current Plan:**
- No PvP at launch
- Future: Frontier/PvP-only planets
- Opt-in territories where building can be contested

---

## Monetization Strategy

> **Full Documentation:** See `docs/product/` directory for detailed strategies.

### Philosophy: "Calm Monetization"

Core principle: **Players should feel grateful for the option to pay, not pressured to pay.**

### Key Documents

| Document | Contents |
|----------|----------|
| `calm-monetization-strategies.md` | 10 ethical monetization approaches |
| `monetization-ideas.md` | Tiered subscription model |
| `monetization-comparison.md` | Launch priorities, revenue projections |

### Tiered Model Summary

| Tier | Price | Gets |
|------|-------|------|
| **Wanderer** (Free) | $0 | Full exploration, social features, can tip |
| **Resident** | $5/mo | Personal room, journal, garden plot |
| **Builder** | $10/mo | 5 rooms, receive tips, discovery listing |
| **Architect** | $15/mo | 20+ rooms, NPC creation, revenue share |

### Launch Priorities (P0)

1. **Gifting** - Gift subscriptions to others
2. **Privacy spaces** - Private instances
3. **Pay-what-you-want** - Voluntary donations

### Anti-Patterns Avoided

- No battle pass / FOMO
- No loot boxes / gacha
- No premium currency
- No energy systems
- No pay-to-win

---

## Social Onboarding (To Be Designed)

### Concept: Invite Links to Public Projects

New players can be invited via links that connect them to:
- A specific town or guild
- A public building project they can contribute to
- A mentor who invited them

**Status:** Not yet documented. Needs design work.

### Proposed Flow

```
1. Existing player generates invite link
2. New player clicks link, creates account
3. New player spawns near inviter's town
4. Optional: Auto-join the public project
5. Inviter gets reputation bonus for successful onboarding
```

This creates immediate social connection and purpose.

---

## Open Questions

### ~~Answered~~ (Moved to Confirmed Decisions)

1. ~~Character creation~~ → Planet/hometown selection only
2. ~~Planets at launch~~ → 3
3. ~~Player cap~~ → 10,000 per planet
4. ~~Visual style~~ → Text-only for now
5. ~~Monetization~~ → See `docs/product/` (calm monetization)

### Remaining Design Questions

1. **Starting experience:** Tutorial on home planet? Or drop into existing world?

2. **Social onboarding:** How do invite links work? (See section above)

3. **Hometown differentiation:** How do the 3 starting locations differ?

### Lore & Story Questions

4. **Setting:** Fantasy? Sci-fi? Blend?

5. **Why multiple planets?** Space travel? Magic portals? Ancient gates?

6. **What's the player's role?** Colonists? Refugees? Explorers?

7. **Is there an overarching conflict?** Or pure sandbox?

8. **Historical context:** Who built the ruins? What happened before?

### Technical Questions

9. **Current Loka codebase gaps** for this vision?

10. **Offline progression implementation?**

11. **Cross-planet travel mechanics?**

---

## Sources & References

### MMORPGs

- [World of Warcraft](https://worldofwarcraft.blizzard.com/) - Quest-driven accessibility
- [Final Fantasy XIV](https://www.finalfantasyxiv.com/) - Armory system
- [RuneScape](https://oldschool.runescape.wiki/w/Skills) - Interlocking skills
- [Guild Wars 2](https://www.guildwars2.com/) - Horizontal progression
- [Elder Scrolls Online](https://www.elderscrollsonline.com/) - One Tamriel scaling
- [EVE Online](https://wiki.eveuniversity.org/Skills_and_learning) - Real-time training
- [Ultima Online](https://www.uoguide.com/Skill_Cap) - 700-point skill cap

### RPGs

- [Skyrim](https://elderscrolls.bethesda.net/en/skyrim) - Use-based progression
- [Dark Souls](https://darksouls.wiki.fextralife.com/Stats) - Soft caps
- [Path of Exile](https://www.pathofexile.com/passive-skill-tree) - Passive tree
- [Disco Elysium](https://discoelysium.fandom.com/wiki/Thought_Cabinet) - Psychology stats
- [Diablo 2](https://blog.writtenrealms.com/stats/) - Skill trees

### Social/Building Games

- [A Tale in the Desert](https://en.wikipedia.org/wiki/A_Tale_in_the_Desert) - No combat, social tests
- [Wurm Online](https://www.wurmonline.com/) - Terraforming pioneer
- [BitCraft](https://bitcraftonline.com/) - Civilization building
- [Ymir](https://ymir-online.com/) - Async civilization
- [Prosperous Universe](https://prosperousuniverse.com/) - Async economy

### Research

- [MMO Social Systems Study](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4606486) - Guild retention
- [Camelot Unchained Stat Design](https://www.camelotunchained.com/v3/bsc-design-docs/stat-system/) - Stats as gating
- [BitCraft: Skills and Levels](https://clockwork-labs.medium.com/skills-and-levels-in-mmos-9b027be8567c) - Long-term progression
- [Horizontal vs Vertical Progression](https://www.mmorpg.com/columns/choosing-your-path-horizontal-or-vertical-progression-2000133424) - Design philosophy

---

---

## Lore & Setting (Draft Concepts)

### Core Concept: "Planetary Cultures from Historical Seeds"

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

### The Setting

**Sci-fi Foundation:**
- Faster-than-light travel exists (gates, stations, ships)
- All planets connected to interstellar network
- Technology is universal; culture is unique per planet

**Historical Flavor:**
- Each planet's culture, values, morals, stories evolved from a specific historical Earth era
- Not "frozen in time" but organically developed over centuries
- "What if the Roman Republic became a space civilization?"
- "What if the Tokugawa Shogunate reached the stars?"

**The Magic Question:**
Following LegendMUD's principle: "If the people of that time believed in magic, you will find it there."
- Some planets have "magic" (psionic, spiritual, naturalistic)
- Others are purely technological
- This is cultural, not contradictory - it's how they understand the universe

### Player Origin (Draft Ideas)

Players are new arrivals to this universe. Possible origins:

| Concept | Description | Implications |
|---------|-------------|--------------|
| **Seedship Colonists** | Generational ships from Earth arrived centuries ago | Players are descendants, connected to heritage |
| **Reincarnation Cycle** | Souls distributed across planets by cosmic process | Explains why you can choose hometown |
| **Spore/Cocoon Emergence** | Humans emerge from bio-tech pods across planets | Fresh starts, no memory of origin |
| **Gate Migrants** | New arrivals through ancient gate network | Outsiders learning local customs |
| **Digital Consciousness** | Minds transmitted across stars, embodied locally | Explains instant travel |

**Current Lean:** Some kind of **emergence/awakening** - players arrive without predetermined history, can integrate into any planetary culture. This supports:
- Choosing any hometown
- Being a "new citizen" learning the culture
- No lore burden for new players
- Mystery about the origin to develop later

### Interstellar Connection

**Travel Methods:**
- **Gates:** Ancient network of portals (who built them? lore mystery)
- **Stations:** Orbital hubs for interplanetary commerce
- **Ships:** For exploration, trade routes, frontier zones

**What Connects Planets:**
- Shared trade network
- Universal communication (chat across planets)
- Gate authority / governing body (player-run eventually?)
- Common currency (or exchange rates between planetary currencies)

### The Three Launch Planets (To Be Designed)

Each planet needs:
1. **Historical inspiration** (era/culture)
2. **Unique resources** (drives trade)
3. **Cultural flavor** (values, aesthetics, social norms)
4. **Building style** (architecture, materials)
5. **Starting experience** (hometown area)

**Example Framework:**

| Planet | Historical Seed | Key Values | Unique Resources | Building Style |
|--------|-----------------|------------|------------------|----------------|
| **Planet A** | Celtic/Druidic | Nature harmony, cycles, oral tradition | Rare woods, living crystals, herbs | Organic, grown structures |
| **Planet B** | Mediterranean Trade Republic | Commerce, art, diplomacy, family | Fine metals, pigments, textiles | Stone, marble, mosaics |
| **Planet C** | East Asian Imperial | Honor, discipline, craftsmanship, hierarchy | Rare alloys, precision components | Wood, paper, gardens |

*These are examples - actual planets to be designed.*

### Storyline Backbone (To Develop)

**Starting Position:**
- Universe is at relative peace
- Planets trade and communicate
- Ancient mysteries remain (who built the gates? what happened to Earth?)
- Player communities can shape events

**Possible Story Threads:**
- Discovery of new gates / planets
- Political tensions between planetary factions
- Ancient threat awakening
- Environmental challenges requiring cooperation
- Player-driven conflicts and alliances

**Design Principle:** Start with light lore, let player actions write history. Like Wurm Online: "Major events are recorded so players' actions write the history of the game."

### Lore Questions to Answer Later

1. **What happened to Earth?** (Lost? Destroyed? Still exists but isolated?)
2. **Who built the gate network?** (Precursors? Future humans? Unknown?)
3. **How long have humans been in space?** (Centuries? Millennia?)
4. **Are there non-humans?** (AI? Aliens? Uplifted species?)
5. **What's the origin of "magic" on some planets?** (Psionics? Alien tech? Genuine supernatural?)

### References

- [LegendMUD Eras](https://en.wikipedia.org/wiki/LegendMUD) - Ancient, Medieval, Industrial
- [Dune Worldbuilding](https://www.fictionate.me/blog/worldbuilding-deep-dive-dune-by-frank-herbert) - Feudal cultures in space, historical echoes
- [Foundation](https://longnow.org/ideas/dune-foundation-and-the-allure-of-science-fiction-that-thinks-long-term/) - Galactic civilization, rise and fall

---

## Revision History

| Date | Changes |
|------|---------|
| 2026-01-18 | Initial draft from research session |
| 2026-01-18 | Added confirmed decisions, monetization summary, player cap recommendation |
| 2026-01-18 | Added Lore & Setting section with planetary cultures concept |

---

## Next Steps

### Decided
- [x] Character creation approach (hometown selection)
- [x] Number of planets at launch (3)
- [x] Player cap per planet (10,000)
- [x] Visual style (text-only)
- [x] Monetization approach (calm, tiered subs)

### To Design
- [ ] **Lore & setting:** Fantasy/sci-fi, why multiple planets, player role
- [ ] **3 hometowns:** Define each planet's theme, resources, culture
- [ ] **Invite link system:** Social onboarding flow
- [ ] **Tutorial experience:** New player first 10 minutes

### To Build
- [ ] Map stat/skill system to existing Loka codebase
- [ ] Identify technical gaps for async progression
- [ ] Prototype offline worker system
- [ ] Design cross-planet travel UX

### To Test
- [ ] Paper playtest skill synergies
- [ ] Balance skill point costs
- [ ] Simulate economy with 3 planet types
