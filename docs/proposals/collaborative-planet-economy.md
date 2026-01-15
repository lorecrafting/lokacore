# Collaborative Planet Economy - Proposal

> **Status**: Proposal (not yet implemented)
> **Issue**: TBD
> **Last Updated**: 2026-01-15
> **Related**: [Decentralized Autonomous Worlds](decentralized-autonomous-worlds.md)

## Executive Summary

This proposal outlines an economic and incentivization system designed to:
- **Resist gaming/exploitation** through daily caps and non-transferable resources
- **Reward participation** over grinding
- **Create viral growth loops** through collaborative goals
- **Foster unique planet identities** through phased development
- **Encourage real-world wellness** through vitality integration

The core innovation: **Planets as Discord-like servers** that all build toward the same baseline infrastructure, then diverge into unique creative expressions. Mass collaboration first, individual creativity second.

---

## Problem Statement

### Traditional Game Economies Get Gamed

| Problem | Result |
|---------|--------|
| Grindable resources | Bots and no-lifers dominate |
| Tradeable currencies | Real-money trading, wealth inequality |
| Competitive servers | Late joiners feel permanently behind |
| Pure intrinsic rewards | Not enough motivation for most players |
| Individual progression | Isolated experience, no community bonds |

### The Goal

Design systems where:
1. **"Gaming" the system IS the intended behavior** (participation = reward)
2. **Late joiners aren't disadvantaged** (same foundation for all)
3. **Community bonds form naturally** (shared goals create shared stories)
4. **Healthy behaviors are rewarded** (real-world wellness integration)

---

## Core Concept: Civic Energy

A **daily-refreshing, non-transferable resource** that players direct toward collaborative goals.

### Properties

| Property | Value | Why It Matters |
|----------|-------|----------------|
| Daily amount | 10 base | Can't be grinded |
| Accumulation | None (use it or lose it) | Must engage daily |
| Tradeable | No | No market manipulation |
| Equal for all | Yes | Day-1 player = Day-1000 player for civic contribution |

### The Daily Choice

With only 10 energy/day, players must prioritize:

```
"Do I help finish the library (89% done!),
 keep the healer's hall from decaying,
 or support my friend's tavern project?"
```

This creates:
- **Conversation** - "Hey, library is almost done, everyone pitch in today!"
- **Strategy** - Guilds coordinate where members spend energy
- **Identity** - "I'm a maintainer" vs "I'm a builder" vs "I support new projects"

### UI Concept: The Civic Board

```
+===============================================================+
|  CIVIC BOARD - Kepler-7                                       |
+===============================================================+
|                                                               |
|  YOUR CIVIC ENERGY: [########--] 8/10                         |
|                                                               |
|  === URGENT ===                                               |
|  Healer's Hall needs 111 energy or decays in 2 days!          |
|                                                               |
|  === ACTIVE PROJECTS ===                                      |
|  Grand Library      [########--] 89%    <- Almost done!       |
|  Northern Bridge    [######----] 67%                          |
|  Town Walls         [##--------] 23%                          |
|                                                               |
|  === EVENTS ===                                               |
|  Midsummer Festival [#######---] 77%    2d 14h left           |
|                                                               |
|  === PLAYER PROPOSALS ===                                     |
|  Dwarven Tavern     34 supporters      [View] [Support]       |
|  Theater            12 supporters      [View] [Support]       |
|                                                               |
|                              [View Completed Projects ->]     |
+===============================================================+
```

---

## Spending Categories

### 1. Infrastructure Projects

Big collaborative builds that unlock content:

| Project | Unlocks | Example Energy Required |
|---------|---------|------------------------|
| Northern Bridge | Frostpeak Mountains zone | 10,000 |
| Town Walls | Reduced monster raids | 8,000 |
| Grand Library | Lore archives + quest line | 5,000 |
| Marketplace | Trading system | 3,000 |

**Key mechanic**: Individual contribution cap (e.g., max 50 energy/project/player). You *need* more players to complete faster.

### 2. Maintenance & Upkeep

Keep existing things from decaying:

```
Healer's Hall            Status: Neglected
Weekly upkeep: 200 energy (currently: 89/200)
Days until decay: 3
"If unmaintained, healing costs +50%"
```

This creates ongoing engagement without permanent loss (see Decay States below).

### 3. Community Events

Time-limited goals with immediate payoff:

```
Midsummer Festival       Ends in: 2d 14h
Goal: 5,000 energy from the community
Current: 3,847
Reward: Server-wide +20% XP for one week
```

### 4. Player-Initiated Projects

Players propose, community decides:

```
PLAYER PROJECT: Dwarven Tavern
Proposed by: ThunderAxe
Location: Mining District
Needs: 1,500 energy to begin construction
Supporters: 34 players
                                [Support] [Contribute]
```

Projects need X supporters before becoming "real" (prevents spam).

---

## Decay States (Not Deletion)

Buildings and infrastructure follow a decay lifecycle:

```
Active -> Neglected -> Decayed -> Ruins -> [Reclaimed by Nature]
  ^          |            |          |
  +----------+------------+----------+
        Can be restored (increasing cost)
```

### State Definitions

| State | Timeline | Visual | Mechanical |
|-------|----------|--------|------------|
| **Active** | Maintained | Normal | Full functionality |
| **Neglected** | 2 weeks idle | Dusty, weeds | Works but looks sad |
| **Decayed** | 1 month | Crumbling, overgrown | Partial functionality |
| **Ruins** | 3 months | Collapsed structures | Explorable, non-functional |
| **Reclaimed** | 6 months | Nature took over | Becomes "wild zone" |

### Why Not Delete?

**Ghost towns become content.** New players stumble upon ruins and wonder "who built this?"

Features:
- Plaques with founder names
- Old shop signs ("Barkley's Blades - Est. 2025")
- Lore about what happened ("The guild disbanded after the Dragon War")
- Old items left behind (cosmetics from that era)

### Restoration Mechanic

| Transition | Effort |
|------------|--------|
| Neglected -> Active | Just resume maintenance |
| Decayed -> Active | Resources + time investment |
| Ruins -> Active | Major community project (perfect for collaborative goals) |

---

## Planet Lifecycle

Planets are like "Discord servers" - separate communities that follow the same development arc.

### The Four Phases

```
+===============================================================+
|                      PLANET LIFECYCLE                         |
+===============================================================+
|                                                               |
|   SEEDING        TERRAFORMING        FOUNDING     FLOURISHING |
|      |                |                  |               |    |
|   +-----+        +---------+        +--------+     +----------+
|   | Raw |   ->   | Hostile |   ->   | Stable |  -> | Thriving |
|   |World|        |  but    |        |  World |     |  World   |
|   |     |        |Buildable|        |        |     |          |
|   +-----+        +---------+        +--------+     +----------+
|                                                               |
|   Collective <---------------------------> Individual         |
|   Everyone works on same goals    Guilds/players build unique |
|                                                               |
+===============================================================+
```

### Phase 1: Seeding (Pioneer Era)

A new planet starts as a **hostile, empty world**. Early adopters are "pioneers."

**Experience:**
- No respawn point yet (death = major setback)
- No marketplace (barter only)
- Limited crafting (basic tools only)
- Harsh environment (-10% to all stats)
- Population: ~50 pioneers
- High stakes, tight community

**First Milestone: Base Camp**
```
MILESTONE ACHIEVED: BASE CAMP ESTABLISHED

After 847 collective contributions from 52 pioneers,
Kepler-7 now has permanent shelter.

UNLOCKED:
* Respawn point (death is no longer devastating)
* Basic storage (shared community chest)
* Campfire gathering spot

ALL PIONEERS RECEIVE: "First Shelter" badge
TOP CONTRIBUTORS: Name on Base Camp plaque

NEXT CHALLENGE: Establish Water Supply
```

**Why pioneers stay:**
- High impact (your 10 energy is 2% of daily total)
- Pioneer identity ("I was here when there was nothing")
- Founder status when planet completes

### Phase 2: Terraforming (Building Era)

The planet is survivable but not comfortable. Real infrastructure begins.

**The Terraforming Tech Tree:**

```
BASE CAMP (survival)
    |
WATER SUPPLY (hydration solved)
    |
AGRICULTURE (food solved)
    |
SHELTER DISTRICT (housing solved)
    |
MARKETPLACE (economy begins)
    |
CRAFTING HALLS (production unlocked)
    |
    +-- ROAD NETWORK (travel unlocked)
    +-- DEFENSIVE WALLS (safety unlocked)
    +-- COMMUNICATIONS (planet-wide chat)
    |
GOVERNANCE HALL (voting/proposals unlocked)
    |
    V
========================================
    |
PLANET FOUNDED - Phase 3 begins
```

All planets follow the same tree. No competition - just collective progress.

**Retention mechanics:**
- Clear progress bars ("We're 71% to water!")
- Each milestone removes a pain point
- Shared anticipation ("Once we get marketplace, we can finally trade!")
- Daily ritual (spend energy, see bar move)

### Phase 3: Founding (The Transition)

This is the **graduation ceremony**. The planet becomes "real."

```
+===============================================================+
|                                                               |
|           KEPLER-7 HAS BEEN FOUNDED                           |
|                                                               |
|   After 47 days and 12,847 collective contributions,          |
|   this world is now a thriving civilization.                  |
|                                                               |
|   ========================================                    |
|                                                               |
|   FOUNDING PIONEERS: 234 players                              |
|   (All receive permanent "Founder of Kepler-7" title)         |
|                                                               |
|   TOP CONTRIBUTORS:                                           |
|   #1 TerraformTanya     1,247 energy                          |
|   #2 BuilderBrendan       986 energy                          |
|   #3 PioneerPaula         871 energy                          |
|   (Names inscribed on Founders' Monument)                     |
|                                                               |
|   ========================================                    |
|                                                               |
|   NEW PHASE UNLOCKED: FLOURISHING                             |
|                                                               |
|   -> Guild territories now available                          |
|   -> Personal housing plots now available                     |
|   -> Custom building proposals now enabled                    |
|   -> Inter-planet travel now possible                         |
|                                                               |
+===============================================================+
```

**Emotional design:** This moment should feel like:
- A graduation
- A nation's founding
- A ship christening

Everyone who contributed can say: **"I helped build this world."**

### Phase 4: Flourishing (Creative Era)

The canvas is prepared. Time for individual expression.

**What changes:**

| Terraforming Phase | Flourishing Phase |
|-------------------|-------------------|
| Everyone works on same goals | Multiple competing priorities |
| Progress is linear | Progress is branching |
| "We need water" | "What should WE build?" |
| Civic energy -> infrastructure | Civic energy -> guild/personal projects |

**New content types:**

1. **Guild Territories** - Guilds claim zones, build identity
2. **Personal Housing** - Individual plots with customization
3. **Community Proposals** - Player-driven building projects
4. **Maintenance** - Keep the foundation running

**The Flourishing Civic Board:**

```
+===============================================================+
|  CIVIC BOARD - Kepler-7 (Founded World)                       |
+===============================================================+
|                                                               |
|  YOUR CIVIC ENERGY: [########--] 8/10                         |
|                                                               |
|  === MAINTENANCE (keeps infrastructure running) ===           |
|  Water System     [needs 50/day]     current: 34    !!        |
|  Farms            [needs 40/day]     current: 41    OK        |
|  Walls            [needs 30/day]     current: 28    !!        |
|                                                               |
|  === GUILD PROJECTS ===                                       |
|  Ironclad Arena (Warriors Guild)     [####------] 43%         |
|  Mage Tower (Arcane Circle)          [######----] 62%         |
|  Grand Tavern (Merchants Guild)      [########--] 81%         |
|                                                               |
|  === COMMUNITY PROPOSALS ===                                  |
|  Open Air Theater        89 supporters    [Support]           |
|  Racing Track            34 supporters    [Support]           |
|  Botanical Garden        156 supporters   [Support] <- Hot!   |
|                                                               |
|  === YOUR PERSONAL PROJECT ===                                |
|  Hillside Cottage        [######----] 58%                     |
|                                                               |
+===============================================================+
```

---

## Planet Identity & Divergence

### The Key Insight

All planets reach the **same baseline** but develop **different souls**.

Over time, each planet develops a reputation:

| Planet | Identity | Why |
|--------|----------|-----|
| Nova Prime | "The First" | Oldest, most established |
| Verdant | "The Garden" | Focused on beauty/peace |
| Ironhold | "The Forge" | PvP culture, crafting focus |
| Kepler-7 | ??? | Players decide |

### Cross-Planet Dynamics

Once founded, planets join the "galactic community":

**Starport (Inter-Planet Travel):**
```
FOUNDED WORLDS (visitable):

  Nova Prime      Pop: 1,247    "The First World"
    Known for: Grand Colosseum, Scholar's Quarter

  Verdant         Pop: 834     "The Garden World"
    Known for: Botanical Wonders, Peaceful culture

  Ironhold        Pop: 621     "The Forge World"
    Known for: Master Crafters, PvP Arenas

TERRAFORMING (not yet visitable):
  Kepler-12       Pop: 89      67% terraformed
  Frontier-3      Pop: 23      12% terraformed
```

**Planet Tourism:**
- Players visit other worlds, see what's different
- "Wow, they built a colosseum!"
- Cross-pollination of ideas without competition

---

## New Player Experience

### Joining a New Planet (Seeding/Terraforming)

**Pitch:** "You're a pioneer. Everything is hard. But you matter enormously. Your 10 civic energy is 2% of today's total contributions. You will be a Founder when this planet completes."

**Appeal:** High impact, tight community, pioneer identity

### Joining a Mature Planet (Flourishing)

**Pitch:** "You've arrived in a thriving world. The infrastructure is built. Find a guild, claim a plot, make your mark. The Founders built the world. You'll build its future."

**Appeal:** Stability, variety, established community

### Player Choice at Onboarding

```
+===============================================================+
|  CHOOSE YOUR DESTINATION                                      |
+===============================================================+
|                                                               |
|  NEW WORLDS (Pioneer Experience)                              |
|  ---------------------------------                            |
|  Frontier-3      23 pioneers     12% terraformed              |
|    "Join the ground floor. Shape a world from nothing."       |
|                                                               |
|  Kepler-12       89 pioneers     67% terraformed              |
|    "Almost founded! Help us cross the finish line."           |
|                                                               |
|  ESTABLISHED WORLDS (Settler Experience)                      |
|  ---------------------------------                            |
|  Nova Prime      1,247 players   Founded 8 months ago         |
|    "The first world. Rich history, grand monuments."          |
|                                                               |
|  Verdant         834 players     Founded 5 months ago         |
|    "A peaceful garden world focused on beauty."               |
|                                                               |
+===============================================================+
```

---

## Viral Mechanics

### The Collaborative Hook

The bridge example - collective goals that need more people:

```
NORTHERN BRIDGE

Progress: [########------------] 847/2000 stones

Your contribution: 15/20 (daily cap)
Contributors: 89 players

"Once complete, unlocks the Frostpeak Mountains
 zone for ALL players on the server."
```

**Individual cap is key** - You *can't* solo-complete. You need more players.

**The natural pitch:** "I can only contribute 20/day. We need 50 more people to finish this week. Anyone want to join?"

### Types of Viral Moments

| Goal | Reward | Viral Angle |
|------|--------|-------------|
| Build the bridge | Unlocks new zone | "Help us unlock Frostpeak!" |
| Defend the town | Event boss spawns | "We need 30 defenders tonight at 8pm" |
| Fund the festival | Server-wide buff | "Everyone gets +10% XP if we hit goal" |
| Restore the ruins | Ghost town revives | "Let's bring back the old guild hall" |

### During Terraforming

```
"Kepler-7 is 67% terraformed. We need 50 more pioneers
 to finish by end of month. Join the founding generation!"

 [Invite Link]
```

**The pitch:** Be a Founder. Limited time opportunity.

### During Flourishing

```
"The Merchants Guild on Verdant is building a Grand Bazaar.
 They need 30 more members to complete it.

 [Join Guild Invite]"
```

**The pitch:** Join our specific project/community.

### Referral Integration

Make it explicit but not sleazy:

```
TOWN CRIER'S NOTICE

"The bridge grows closer to completion!
 Spread word to travelers in distant lands."

[Share Link] -> If a friend joins and contributes,
you both get a "Bridge Builder" cosmetic cloak
```

**Not:** "Refer friends for rewards"
**Instead:** "The world needs more help. Here's how to invite someone."

---

## Bonus Energy (Limited)

Base is always 10/day, but small bonuses for prosocial behavior:

| Action | Bonus | Cap |
|--------|-------|-----|
| First contribution of the day | +1 | 1/day |
| Inviting a friend who contributes | +2 | 2/week |
| Completing a "civic quest" | +1 | 3/week |
| Streak bonus (7 days consecutive) | +2 | 1/week |
| Vitality practice (see below) | +1 to +5 | Based on streak |

**Key:** Bonuses are small and capped. Can't game your way to 100 energy/day.

---

## Real-World Wellness Integration (Vitality System)

### Core Concept

**"Your character thrives when YOU thrive."**

Players record themselves doing wellness activities and submit as "daily practice" to earn bonus civic energy.

```
Real World Wellness -> Vitality Streak -> +Civic Energy
```

### The Daily Practice

```
+===============================================================+
|  DAILY VITALITY PRACTICE                                      |
+===============================================================+
|                                                               |
|  Today's Practice: Not yet submitted                          |
|  Current Streak: 12 days                                      |
|                                                               |
|  BASE CIVIC ENERGY:     10/day                                |
|  VITALITY BONUS:        +3/day (from 12-day streak)           |
|  TOTAL:                 13/day                                |
|                                                               |
|  === SUBMIT TODAY'S PRACTICE ===                              |
|                                                               |
|  Accepted activities:                                         |
|  * Meditation (5+ min)                                        |
|  * Movement (10+ min walking, yoga, stretching)               |
|  * Breathwork (5+ min)                                        |
|  * Journaling (gratitude or reflection)                       |
|                                                               |
|                        [Record Practice] [Upload Video]       |
+===============================================================+
```

### Streak Bonuses

| Streak | Civic Energy Bonus | Additional Perk |
|--------|-------------------|-----------------|
| 3 days | +1/day | - |
| 7 days | +2/day | "Mindful" badge visible to others |
| 14 days | +3/day | Access to Sanctuary zones |
| 30 days | +4/day | "Dedicated" title |
| 60 days | +5/day | Unique cosmetic aura |
| 100 days | +5/day + special | "Enlightened" title |

**Capped at +5** to prevent feeling mandatory.

### Activity Types (Accessibility)

Not everyone can do yoga. Design for inclusion:

**Physical Movement:**
- Walking (any pace)
- Yoga / Stretching
- Any exercise
- Cycling, Swimming
- Active chores (gardening, cleaning)

**Mental / Stillness:**
- Meditation (guided or silent)
- Breathwork
- Journaling
- Prayer / spiritual practice
- Mindful tea/coffee (no screens)

**Creative:**
- Art / crafting
- Playing music
- Reading (physical book)
- Nature time (just being outside)

**The point:** ANY mindful break from screens counts.

### Wellness Circles (Social Accountability)

Small groups (5-15 people) that practice together:

```
+===============================================================+
|  DAWN MEDITATION CIRCLE                                       |
+===============================================================+
|                                                               |
|  "We greet each sunrise together"                             |
|                                                               |
|  Members: 23                                                  |
|  Focus: Morning meditation                                    |
|  Collective Streak: 8 days (all members submitted)            |
|                                                               |
|  TODAY'S SUBMISSIONS:                                         |
|  [x] MindfulMike        5:42am    "Peaceful morning"          |
|  [x] SereneSara         6:15am    "Grateful for this group"   |
|  [x] CalmCarlos         6:30am    "Day 47 for me!"            |
|  [ ] You                pending                               |
|  [ ] TranquilTanya      pending                               |
|  [ ] ZenZach            pending                               |
|                                                               |
|  CIRCLE BONUS: When all submit, +1 extra energy each          |
|                                                               |
|  [View Practice Feed]  [Submit Practice]  [Encourage]         |
+===============================================================+
```

**The "Encourage" Feature:**

If someone's streak is about to break:

```
TranquilTanya hasn't submitted today
Her 34-day streak ends in 2 hours

[Send Encouragement]

"Hey Tanya! Your 34-day streak is inspiring.
 Even 5 minutes of breathing counts. You've got this!"
```

**Peer support, not peer pressure.** Tone matters.

### Verification Tiers

**Tier 1: Honor System (Now)**
- Simple checkbox: "I completed my daily practice"
- Social accountability through Circles
- Works because lying to friends feels bad

**Tier 2: Photo/Video Proof (Near Future)**
- Upload video (processed locally, only duration verified)
- Connect fitness tracker (auto-verify movement)
- Connect meditation apps (Headspace, Calm, etc.)
- **Privacy-first:** Video processed on-device, server only gets `{verified: true, duration: 720s}`

**Tier 3: AI Verification (Future, When Cheap)**
- On-device ML verifies: "This is a person doing yoga/meditation/walking"
- Duration verification
- No content leaves device

**Tier 4: Wearable Integration**
- Apple Health, Fitbit, Garmin, Oura Ring
- Auto-submit when activity detected

### Anti-Gaming (Gentle Approach)

The goal isn't catching cheaters - it's making cheating feel pointless.

| Instead of... | Do this... |
|---------------|-----------|
| Punishing suspected cheaters | Make rewards feel earned |
| Requiring proof | Make sharing feel good |
| Policing | Trust + social accountability |
| Harsh verification | Soft friction |

**Soft friction example:**

"You've submitted 10-minute meditations for 30 days straight.
That's amazing dedication! Would you like to share a reflection
on how your practice has evolved?"

Invites genuine practitioners to share, makes fakers feel awkward.

### Narrative Integration

**In-Game Lore:**

```
THE MONASTERY OF INNER LIGHT

"Long ago, the monks discovered a truth: the energy that
 flows through our characters comes from within ourselves.
 When we tend to our bodies and minds in the waking world,
 our spirits here grow stronger.

 This is the Way of Vitality.

 Those who practice daily find their civic energy renewed,
 their contributions to the realm magnified.

 Join a Circle. Tend to yourself. The realm will flourish."
```

**Wellness Zones (Requires 14-day streak to enter):**

```
THE SANCTUARY

A peaceful mountain retreat. No combat. No trading.
Just beauty, conversation, and reflection.

Features:
-> Guided meditation NPCs
-> Reflection pools (write and share thoughts)
-> Community garden (collaborative tending)
-> Sunrise/sunset events

"A place for those who tend to themselves to tend to others"
```

---

## The Complete Loop

```
Real World Wellness
       |
       V
   Vitality Streak
       |
       V
   +Civic Energy
       |
       V
   More Contribution
       |
       V
   Faster Planet Building
       |
       V
   Shared Achievement
       |
       V
   Deeper Community
       |
       V
   Accountability to Continue
       |
       V
   Real World Wellness (reinforced)
```

**The game makes you healthier. Your health makes the game world better. The community keeps you accountable to both.**

---

## Anti-Gaming Summary

| Exploit Attempt | Prevention |
|-----------------|------------|
| Alt accounts for more energy | Account age requirement (7 days) |
| Botting daily logins | Energy requires gameplay action to claim |
| Whale buying energy | Can't be purchased. Period. |
| Guild domination | Individual caps on per-project contribution |
| Proposal spam | Support threshold + cooldown on proposals |
| Wellness faking | Social accountability through Circles |

---

## Implementation Considerations

### Data Model (Conceptual)

```elixir
# Civic Energy
%CivicEnergy{
  player_id: uuid,
  base_amount: 10,
  bonus_amount: 3,  # From vitality streak
  last_refresh: datetime,
  spent_today: 7
}

# Project
%Project{
  id: uuid,
  planet_id: uuid,
  type: :infrastructure | :maintenance | :guild | :personal | :event,
  title: string,
  required_energy: integer,
  current_energy: integer,
  contributors: map(player_id => amount),
  status: :proposed | :funding | :construction | :active | :decayed | :ruins,
  decay_deadline: datetime | nil
}

# Vitality Practice
%VitalityPractice{
  player_id: uuid,
  date: date,
  activity_type: :meditation | :movement | :breathwork | :journaling | :creative,
  duration_seconds: integer,
  verified: boolean,
  verification_method: :honor | :video | :wearable | :app
}

# Wellness Circle
%WellnessCircle{
  id: uuid,
  name: string,
  focus: string,
  members: [player_id],
  collective_streak: integer
}
```

### Phase 1: Core Civic Energy

1. Implement daily energy refresh
2. Create project/contribution system
3. Build Civic Board UI
4. Add basic decay states

### Phase 2: Planet Lifecycle

1. Define terraforming tech tree
2. Implement phase transitions
3. Create Founding celebration
4. Build Starport (inter-planet travel)

### Phase 3: Vitality System

1. Honor system implementation
2. Wellness Circles
3. Streak tracking
4. Sanctuary zones

### Phase 4: Verification & Integrations

1. Video verification (on-device)
2. Wearable integrations
3. Meditation app connections
4. AI verification (when cost-effective)

---

## Success Metrics

### Engagement
- [ ] Daily active users spending civic energy: >60%
- [ ] Average projects contributed to per player: >2/week
- [ ] Streak retention (7+ day streaks): >30% of active players

### Community
- [ ] Guild participation rate: >40% of players
- [ ] Average Wellness Circle size: 8-12 members
- [ ] Cross-planet tourism: >20% of founded-planet players visit other planets

### Health Integration
- [ ] Vitality practice participation: >25% of players
- [ ] Average streak length: >14 days
- [ ] Self-reported wellness improvement: >70% positive

### Virality
- [ ] Referral rate during terraforming: >15% of players invite friends
- [ ] Conversion rate from invites: >20%
- [ ] "Founder" retention (players who stay after founding): >60%

---

## Open Questions

### Game Design
1. **Energy amount**: Is 10/day the right number?
2. **Decay timing**: Are 2 weeks -> 1 month -> 3 months the right intervals?
3. **Streak caps**: Should vitality bonus cap at +5 or scale higher?
4. **Planet size**: What's the ideal founding population?

### Technical
1. **Video processing**: On-device ML requirements?
2. **Wearable APIs**: Which platforms to prioritize?
3. **Cross-planet travel**: How does inventory/progression transfer?

### Social
1. **Circle dynamics**: How to handle inactive members?
2. **Guild territory**: How much space per guild?
3. **Proposal spam**: What's the right support threshold?

### Business
1. **Monetization**: Premium cosmetics? Wellness app partnerships?
2. **Partnerships**: Which meditation apps to integrate first?
3. **Planet hosting**: Player-hosted planets? Cost structure?

---

## References

### Inspiration
- Discord server model (communities with shared identity)
- Habitica (gamified habits)
- Ring Fit Adventure (real-world activity -> game rewards)
- Headspace/Calm (wellness app UX)

### Related Proposals
- [Decentralized Autonomous Worlds](decentralized-autonomous-worlds.md) - P2P infrastructure
- [Builder Content Layer](builder-content-layer.md) - Player-created content

---

## Appendix A: The Retention Loop

### Why Players Stay

**Early Game (Seeding/Terraforming):**
```
"We're building something together"
     |
     V
Daily civic energy -> visible progress
     |
     V
Milestone unlocks -> celebration + new capabilities
     |
     V
"Almost there!" -> urgency to see it through
     |
     V
FOUNDING -> massive payoff, permanent recognition
```

**Late Game (Flourishing):**
```
"Now I can express myself"
     |
     V
Guild identity -> social belonging
     |
     V
Personal project -> ownership
     |
     V
Maintenance pressure -> daily engagement
     |
     V
"Look what we built" -> pride in unique planet
```

**The Key Insight:**
- Phase 1 creates BONDS (we survived together)
- Phase 2 creates IDENTITY (this is who we are)

Players stay because they're emotionally invested in both.

---

## Appendix B: Example Timeline

### A New Planet's Journey

**Week 1-2: Seeding**
- 30-50 pioneers arrive
- Base camp established
- Tight community forms
- High stakes, high engagement

**Week 3-6: Early Terraforming**
- Water supply, then agriculture
- Population grows to 100-150
- First guilds form informally
- Word spreads: "Come help us build!"

**Week 7-10: Late Terraforming**
- Marketplace, crafting halls
- Population 200-300
- Serious guild organization
- "We're almost founded!"

**Week 11-12: Founding**
- Final milestones complete
- Celebration event
- 234 players earn "Founder" title
- Phase transition

**Month 3+: Flourishing**
- Guild territories claimed
- Personal housing spreads
- Unique culture develops
- Tourism from other planets
- "Come see our colosseum!"

**Year 2+: Established Identity**
- Known across the galaxy
- Rich history and lore
- Self-sustaining community
- New players join for the culture

---

## Appendix C: Cosmetics & Recognition

### Time-Based (Can't Be Bought)

| Item | Source | Signal |
|------|--------|--------|
| "Founder" title | Present at founding | Tenure |
| "Pioneer" badge | First 100 on planet | Early adopter |
| Era-specific cloaks | Active during events | "I was there" |
| Streak auras | 100-day vitality streak | Dedication |

### Contribution-Based

| Item | Source | Signal |
|------|--------|--------|
| Building plaques | Top contributor | Legacy |
| Statue in town square | #1 overall contributor | Fame |
| Named structures | Proposed and completed project | Creativity |
| Guild banners | Guild territory established | Community |

### Wellness-Based

| Item | Source | Signal |
|------|--------|--------|
| "Mindful" badge | 7-day vitality streak | Commitment |
| Sanctuary access | 14-day streak | Dedication |
| "Enlightened" title | 100-day streak | Mastery |
| Circle Leader robes | Founded a Wellness Circle | Leadership |
