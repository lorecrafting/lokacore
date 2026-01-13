# Loka: Cooperative Town Builder Vision

> *You're building something that matters, in a world that needs you, alongside people who become friends.*

## Core Concept

A cooperative MUD where players settle a shared frontier, build towns, gather resources over real time, and trade with neighbors. Competition is replaced with interdependence. The world is the antagonist, not other players.

## The Core Loop

```
EXPLORE → DISCOVER → CLAIM → DEVELOP → TRADE → EXPLORE DEEPER
   ↑                                              ↓
   └──────────── resources enable ←───────────────┘
```

## Session Rhythm

- **Active play (10-30 min):** Explore wilderness, encounter dangers, make decisions, interact with others
- **Passive progression (hours/days):** Workers gather lumber, crops grow, buildings construct
- **Return trigger:** "Your sawmill finished. Bandits spotted near the north road. A trader from Millbrook arrived."

---

## Why Cooperative?

- Too much competition and toxicity in games today
- Cooperation creates lasting relationships
- "I need your leather, you need my grain" > "I killed you for loot"
- Better stories emerge from shared struggle than domination

### The World Is The Antagonist

External threats that require collective response:
- Harsh winters - stockpile together or everyone suffers
- Blights/plagues - spreads between settlements if not contained
- Monster migrations - too big for one town to handle
- Bandit factions - NPC enemies that raid, requiring organized defense
- Natural disasters - floods, fires, droughts

### Anti-Toxicity Design

- Griefing has no payoff
- Can't destroy others' work
- Stealing is mechanically hard and socially ruinous
- No "villain path"
- Your character is persistent—no throwaway alts

---

## New Player Experience

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

## Settlement Interaction

### Physical Proximity

```
         [Mountain Pass]
              │
    [Millbrook] ─── [River Fork] ─── [The Hollows]
         │              │
    [Wheat Fields]  [Your Town]
```

Geography creates natural trade routes, chokepoints, neighbors.

### Trade

- Direct barter - meet in person, negotiate
- Market stalls - leave goods for sale, async commerce
- Trade agreements - automated recurring exchanges
- Caravans - physical goods in transit (can be protected/raided?)

### Shared Infrastructure

- Roads - reduce travel time, benefit everyone
- Bridges - open new areas, require cooperation to afford
- Watchtowers - early warning for a region

### Social Structures

- Guilds/Factions - formal alliances
- Regional governance - councils, elected roles
- Reputation - "Don't trade with Garm, he stiffs everyone"

---

## Progression Systems

### Three Pillars

#### 1. Personal Mastery (Your Character)

Horizontal, not vertical. You become *more versatile*, not infinitely stronger.

```
Woodcutting Lv1: Can fell trees
Woodcutting Lv5: Can identify wood quality, find rare trees
Woodcutting Lv10: Can teach others, craft specialty items
```

Knowledge as progression:
- Recipes learned
- Locations discovered
- Techniques taught
- Lore uncovered

#### 2. Settlement Growth (Your Place)

Physical stages:
```
Camp → Homestead → Village → Town → City
     weeks         months      months+
```

Building progression:
```
Lumber pile → Woodshed → Sawmill → Lumber yard
   instant      hours      days       weeks
```

Not just bigger numbers—new capabilities at each tier.

#### 3. Reputation & Relationships (Your Place in Society)

- General renown (how known are you?)
- Trust (do people vouch for you?)
- Expertise recognition (known for what?)
- Titles earned through action ("Founder of Riverdale")

### Progression Without Power Gaps

- The ceiling is low, the breadth is wide
- A veteran is maybe 50% better, not 1000%
- Three newcomers can challenge a veteran
- Veterans need newcomers (designed dependencies)

### Pacing

```
First hour:     Immediate payoffs, learn the ropes
First day:      First building complete, feel established
First week:     Meaningful settlement, know your neighbors
First month:    Recognized specialist, integrated in region
First season:   Established presence, mentoring newcomers
```

---

## Exploration & Discovery

### The Unknown Is The Game

What you're exploring for:
- Resources (where's the iron? fertile soil?)
- Locations (ruins, landmarks, natural features)
- Knowledge (lore, recipes, techniques)
- Danger assessment
- Routes between places

### The Map Is Earned

- Fog of war, but social
- Only see what you've personally explored OR what others shared
- Maps are tradeable, valuable, sometimes wrong
- Maps degrade (wilderness changes)

### Discovery Types

**Resources:**
```
Common:     Found everywhere, obvious
Uncommon:   Requires searching, regional
Rare:       Hidden, specific conditions
Legendary:  Rumored, quest-like to find
```

**Locations:**
- Natural: caves, groves, springs, cliffs
- Ruins: ancient structures, artifacts
- Encounters: camps, dens, phenomena
- Opportunities: ideal settlement spots

### The Expedition Loop

```
Prepare → Travel → Explore → Discover → Return → Share/Use
```

- Larger parties = safer, slower, shared rewards
- Solo = risky, faster, keep everything
- Specialists help (scout spots danger, herbalist finds plants)

---

## Crafting & Economy

### Crafting Philosophy

Not a slot machine. Not a grind. Feels like *making things*.

**Inputs:**
```
Materials + Knowledge + Tools + Time + Skill = Output
```

### Quality System

```
Crude      → Works, barely
Common     → Standard, reliable
Fine       → Notably good
Exceptional → Remarkable, named
Masterwork → Legendary, one of a kind
```

Items have history: who made it, where, from what.

### Regional Economics

| Region | Abundant | Scarce |
|--------|----------|--------|
| Mountains | Stone, ore | Timber, food |
| Forest | Timber, game | Stone, metals |
| Plains | Grain, livestock | Everything else |
| Coast | Fish, salt | Metals, timber |

Natural trade emerges from geography.

### Trade Mechanics

- Direct trade (meet, negotiate, barter)
- Market stalls (set prices, async)
- Trade agreements (recurring exchanges)
- Caravans (bulk transport, time, risk)

### Currency

Lean toward emergent currency—let players naturally settle on something (salt? iron nails?).

### Economic Principles

- Scarcity is real (resources don't infinitely respawn)
- Value from rarity, labor, quality, need
- No gold fountains (wealth comes from other players)

---

## Social & Communication

### Communication Layers

**Proximity-based (default):**
- Same location: speak freely, everyone hears
- Adjacent: shouts carry, can hear activity

**Direct:**
- Whispers (private, same location)
- Messages (async, any distance, requires knowing someone)

**Group channels:**
- Settlement chat
- Guild/Faction
- Regional (opt-in)

**No global chat** - intentional. Preserves distance, information travels organically.

### Information Flow

**Gossip system:**
- News spreads through witnesses → travelers → distant regions
- Details may change in transmission (feature, not bug)
- First-hand knowledge is valuable

**Tavern effect:**
- Gathering places accelerate information
- Building a tavern = becoming an information hub

### Reputation System

**Built through:**
- Completing trades fairly
- Helping in crises
- Teaching others
- Keeping promises

**Visible as:**
- General sense when meeting ("well-regarded," "unknown")
- Can ask around ("what do you know about...?")
- Precedes you if notable enough

### Social Structures

**Organic relationships:**
```
Stranger → Acquaintance → Colleague → Friend → Trusted
```

**Guilds:** Player-created, player-governed

**Regional governance:** Game provides tools, players build institutions

### The Text Advantage

Rich emotes and expression:
```
John smiles warmly.
John carefully examines the blade, running a thumb along its edge.
John glances nervously toward the forest.
```

Ambience and atmosphere:
```
The evening crowd fills the tavern with conversation and laughter.
Smoke rises from the smithy. The ring of hammer on anvil echoes.
```

Text creates mood that graphics often can't afford.

---

## The Emotional Journey

**Week 1:** "I have a camp and a small garden. Met my neighbor, traded some berries for tools."

**Month 1:** "My homestead has a real house now. I'm getting known for my preserves. Helped defend Millbrook from wolves."

**Month 6:** "Riverdale is a proper village. I trained two apprentices in herbalism. We just finished the regional granary project."

**Year 1:** "I'm one of the founders of this valley. Newcomers ask me for advice. The region we built is thriving."

---

## The Core Promise

> *You matter here. People know your name. Your actions ripple outward. You're part of something.*

Not an anonymous player in a sea of millions. A person in a community.

---

## Open Questions

- Technical implementation with Elixir/LiveView
- Onboarding flow for new players
- Specific threat/event design
- Balance of active vs passive play
- Mobile experience considerations
