# LLM Integration & Monetization Ideation

> **Status**: Draft for deliberation
> **Created**: 2025-01-09
> **Contributors**: Raymond, Claude

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Determinism Spectrum](#the-determinism-spectrum)
3. [LLM Enhancement Opportunities](#llm-enhancement-opportunities)
4. [Cost Management Strategies](#cost-management-strategies)
5. [Monetization Philosophy](#monetization-philosophy)
6. [The Gem Economy](#the-gem-economy)
7. [Shared Town System](#shared-town-system)
8. [Open Questions](#open-questions)

---

## Executive Summary

This document explores how Loka can leverage LLMs to create experiences impossible in traditional MUDs while maintaining sustainable economics and ethical monetization.

### Key Principles

1. **LLM as differentiator, not product** - Don't charge for "AI access"; charge for the game that happens to use AI brilliantly
2. **Deterministic guardrails** - LLMs enhance within boundaries; core game mechanics remain predictable
3. **Community over competition** - Monetization benefits all players, not just payers
4. **Recognition over power** - Paying players get prestige and cosmetics, never gameplay advantages

---

## The Determinism Spectrum

LLM integration exists on a spectrum from fully deterministic to fully autonomous.

| Level | Name | LLM Role | Risk | Example |
|-------|------|----------|------|---------|
| 1 | **Cosmetic** | Flavor text only | None | Combat narration |
| 2 | **Templated** | Fill-in-the-blanks | Low | Quest with `[OBJECTIVE]` slots |
| 3 | **Constrained** | Generate within rules | Medium | DM proposes, system validates |
| 4 | **Supervised** | Decisions reviewed | Medium | Faction changes queued for approval |
| 5 | **Bounded** | Free within safety rails | High | Full narrative control |
| 6 | **Full Agency** | True autonomy | Very High | Research/experimental only |

### Recommended Approach by Feature

```
Level 1-2 (Safe for launch):
  - Combat narration
  - Room description variations
  - Item flavor text
  - NPC greetings

Level 3 (Near-term):
  - Full NPC dialogue
  - Quest narrative generation
  - Memory-enhanced NPCs
  - Investigation systems

Level 4 (Medium-term):
  - Behavioral quest triggers
  - Faction politics simulation
  - Dynamic world events

Level 5 (Premium/Opt-in):
  - DM Mode
  - Emergent storylines
  - Full narrative autonomy
```

---

## LLM Enhancement Opportunities

### Category A: NPC Intelligence

| # | Feature | Description | Deterministic Fence | LLM Freedom |
|---|---------|-------------|---------------------|-------------|
| 1 | **Memory-Enhanced NPCs** | NPCs remember every conversation | Memory stored in DB, relationship scores | How to reference memories naturally |
| 2 | **Emotional State Modeling** | NPC moods affect dialogue tone | Mood is numeric (-100 to 100) | Word choice, emotional expression |
| 3 | **Gossip Networks** | NPCs share info through social connections | Graph DB of relationships, propagation rules | How gossip is presented, embellishments |
| 4 | **Cultural Dialects** | Regions/species have distinct speech | Culture tag on NPC | Actual dialogue generation |
| 5 | **NPC-to-NPC Relationships** | NPCs develop opinions about each other | Relationship matrix with bounds | Emergent relationship dynamics |

### Category B: Dynamic Questing

| # | Feature | Description | Deterministic Fence | LLM Freedom |
|---|---------|-------------|---------------------|-------------|
| 6 | **Behavioral Quest Generation** | Quests spawn from player patterns | Quest templates, trigger conditions | Quest narrative, NPC involvement |
| 7 | **Consequence Chains** | Decisions create rippling effects | State machine for plot points | How consequences manifest |
| 8 | **Moral Dilemma Generation** | Hard choices based on player values | Dilemma templates, outcome constraints | Specific scenario, emotional weight |
| 9 | **Investigation Systems** | LLM plays criminal mastermind | Who did it, key evidence, timeline | Dialogue, red herrings, confessions |
| 10 | **Prophecy Generation** | Cryptic hints about player's future | Active quest objectives | Symbolic language, misdirection |

### Category C: Dungeon Master Mode

| # | Feature | Description | Deterministic Fence | LLM Freedom |
|---|---------|-------------|---------------------|-------------|
| 11 | **Real-Time Narrative Adaptation** | Story adjusts to player state | Difficulty bounds, encounter budget | What happens, narrative framing |
| 12 | **Improvised NPC Creation** | NPCs created on demand if plausible | Population limits, profession rules | Name, personality, backstory |
| 13 | **Dynamic World Events** | Festivals, disasters, upheaval | Event templates, frequency limits | Specific event, timing, scope |
| 14 | **Emergent Faction Politics** | Factions make strategic decisions | Faction goals, resource constraints | Strategic reasoning, alliances |
| 15 | **Session Pacing Control** | Ensures satisfying story arcs | Pacing rules, session awareness | What the beats look like |

### Category D: Combat & Action

| # | Feature | Description | Deterministic Fence | LLM Freedom |
|---|---------|-------------|---------------------|-------------|
| 16 | **Combat Commentary** | Cinematic narration of dice rolls | Combat math unchanged | Narrative flourish |
| 17 | **Tactical Suggestions** | In-character companion advice | Hint triggers, enemy weaknesses | How advice is phrased |
| 18 | **Enemy Taunts** | Enemies have personality in combat | Taunt frequency limits | Actual dialogue |
| 19 | **Death Narratives** | Meaningful death experiences | Death mechanics unchanged | Liminal experience description |

### Category E: World Building

| # | Feature | Description | Deterministic Fence | LLM Freedom |
|---|---------|-------------|---------------------|-------------|
| 20 | **Dynamic Room Descriptions** | Rooms feel different by context | Base template, time/weather modifiers | Atmospheric variation |
| 21 | **Procedural Lore** | Books generate consistent content | Lore database, canon facts | Specific content, writing style |
| 22 | **Historical Narration** | NPCs tell biased history | Historical facts, bias parameters | Spin, emphasis, embellishment |
| 23 | **Environmental Storytelling** | Ruins hint at what happened | Location history | How evidence is presented |

### Category F: Player Experience

| # | Feature | Description | Deterministic Fence | LLM Freedom |
|---|---------|-------------|---------------------|-------------|
| 24 | **Adventure Journals** | LLM writes player's journal | Event log, current quests | Narrative style, emotion |
| 25 | **Contextual Hints** | Organic help when stuck | Hint triggers, solution data | How hint is delivered |
| 26 | **Dream Sequences** | Personalized symbolic dreams | Dream triggers, effects | Symbolic imagery, tone |
| 27 | **Reputation Interpretation** | NPCs express reputation uniquely | Reputation numbers | How it manifests in dialogue |

### Category G: Creative & Social

| # | Feature | Description | Deterministic Fence | LLM Freedom |
|---|---------|-------------|---------------------|-------------|
| 28 | **Bard Song Generation** | Original songs about player deeds | Song templates, event log | Lyrics, melody descriptions |
| 29 | **Court Cases** | LLM judges disputes | Evidence system, verdict effects | Trial dialogue, reasoning |
| 30 | **Negotiation Systems** | Merchants reason about prices | Base prices, bounds | Reasoning, counter-offers |
| 31 | **Teaching NPCs** | In-character game tutorials | Actual mechanics | Pedagogical approach |
| 32 | **Wisdom/Counseling** | Monastery elders offer insight | Content safety guidelines | Actual counsel |

### Category H: Experimental

| # | Feature | Description | Deterministic Fence | LLM Freedom |
|---|---------|-------------|---------------------|-------------|
| 33 | **Emergent Server Events** | Patterns across players trigger events | Impact limits, reversibility | What the response looks like |
| 34 | **Player Content Review** | LLM evaluates submissions | Approval criteria | Feedback quality |
| 35 | **Adaptive Difficulty Narration** | Same mechanics, different stakes | Numbers unchanged | Narrative framing |

---

## Cost Management Strategies

### Model Tiering

| Tier | Model | Cost | Use Cases | % of Calls |
|------|-------|------|-----------|------------|
| 1 | Opus 4.5 | $15/$75 per M | DM decisions, complex quests | <1% |
| 2 | Sonnet 4 | $3/$15 per M | Important dialogue, journals | 5-10% |
| 3 | Haiku 3.5 | $0.80/$4 per M | Standard dialogue, combat | 30-40% |
| 4 | Gemini Flash | $0.075/$0.30 per M | Greetings, simple responses | 50-60% |

### Cost Reduction Techniques

1. **Aggressive Caching** (60-80% reduction)
   - Cache NPC greetings by context hash
   - Only include relevant context in cache key
   - 24-hour TTL for most content

2. **Pre-Generation** (30-40% to off-peak)
   - Generate daily content at 3-6 AM
   - Pre-warm common dialogue cache
   - Build encounter pools in batch

3. **Template + Fill** (40-60% token reduction)
   - Use templates with LLM-filled slots
   - Structured output validation
   - Smaller, more controlled responses

4. **Smart Routing**
   - Classify task complexity automatically
   - Route to cheapest capable model
   - Fallback to deterministic on budget exhaust

### Projected Costs

**100 Concurrent Players, Active Play:**

| Scenario | Cost/Hour | Cost/Player/Hour |
|----------|-----------|------------------|
| Raw (no optimization) | $2.63 | $0.026 |
| With 70% caching | $0.79 | $0.008 |
| Full optimization | $0.40 | $0.004 |

**Monthly (1000 MAU, 4 hrs avg play/day):**

| Scenario | Monthly Cost |
|----------|--------------|
| Raw | $3,153 |
| Optimized | $400-600 |

---

## Monetization Philosophy

### Core Principle: LLM as Table Stakes

> Don't sell LLM access. Sell experiences that happen to use LLMs.

The LLM is your competitive advantage against other games, not a revenue stream. Players choose Loka because NPCs remember them, not because they're paying for API calls.

### What Gems Buy

```
✅ How you LOOK        (cosmetics, housing, mounts)
✅ How you EXPERIENCE  (convenience, QoL, LLM features)
✅ How much CONTENT    (expansions, storylines)
✅ How you EXPRESS     (emotes, titles, social)

❌ How POWERFUL you are (stats, gear, levels)
❌ How you WIN         (PvP advantage)
❌ How you SKIP        (story bypasses)
```

### Revenue Model Options

| Model | Price | Players Needed | Notes |
|-------|-------|----------------|-------|
| Freemium | $8/mo premium | 75-100 | 10% conversion rate |
| Expansions | $15-20 each | 500 buyers/expansion | Sustainable content model |
| DM Mode | $15/mo | 30-50 | Premium experience |
| Patron | $5+/mo | 100+ | Community support |

---

## The Gem Economy

### Currency Structure

```
Real Money ($)
    ↓
Gems (Premium Currency) ←── Cannot earn in-game
    ↓
Three conversion paths:
    ├── Motes (Bound Cosmetic Currency)
    ├── Patron Points (Account Services)
    └── Story Tokens (Content Access)

Gold (Earned In-Game) ←── Cannot buy with gems directly
```

**Key Rule**: Gems never convert directly to gold.

### Gem Pricing

| Gems | Price | Bonus | Per Gem |
|------|-------|-------|---------|
| 100 | $0.99 | 0 | $0.0099 |
| 500 | $4.99 | 25 (5%) | $0.0095 |
| 1,200 | $9.99 | 100 (8%) | $0.0077 |
| 2,500 | $19.99 | 300 (12%) | $0.0071 |
| 6,500 | $49.99 | 1,000 (15%) | $0.0067 |
| 14,000 | $99.99 | 2,500 (18%) | $0.0061 |

### Motes → Cosmetic Shop (1:1 conversion)

| Category | Item | Cost |
|----------|------|------|
| Titles | Custom prefix/suffix | 50 motes |
| Character | Description expansion | 100 motes |
| Equipment | Weapon rename | 25 motes |
| Equipment | Weapon description | 50 motes |
| Emotes | Custom emote pack (5) | 150 motes |
| Housing | Room slot unlock | 100 motes |
| Housing | Furniture pieces | 25-100 motes |
| Social | Guild banner design | 300 motes |

### Patron Points → Account Services (2:1 conversion)

| Category | Item | Cost |
|----------|------|------|
| Character | Extra character slot | 300 PP |
| Character | Name change | 150 PP |
| Character | Stat respec | 100 PP |
| Convenience | Bank tab unlock | 200 PP |
| Convenience | Inventory expansion | 150 PP |
| Convenience | Fast travel unlock | 100 PP |
| QoL | Quest tracker expansion | 75 PP |
| QoL | Map reveal (per zone) | 100 PP |

### Story Tokens → Content Access (1:1 conversion)

| Category | Item | Cost |
|----------|------|------|
| Expansion | Major zone | 1,500 ST |
| Expansion | Story chapter | 500 ST |
| Expansion | Side quest pack | 300 ST |
| LLM Features | DM Mode (monthly) | 800 ST |
| LLM Features | Personal storyline | 500 ST |
| LLM Features | NPC deep memory | 300 ST |
| LLM Features | Custom companion | 600 ST |

### Anti-P2W Safeguards

**Hard Rules - Never Sell:**
- Stat boosts
- Level boosts
- Gear with stats
- Skill unlocks
- PvP advantage
- Quest skips
- Exclusive mechanics
- Drop rate boosts

**Soft Limits:**
- Daily gem spend cap: 5,000 (~$50)
- Monthly gem spend cap: 50,000 (~$500)
- New player restriction: 7 days before spending
- Large purchase warnings with confirmation

---

## Shared Town System

### Core Concept: The Living Monastery

Instead of competitive player towns, Loka has **one shared settlement** that all players build together.

```
┌─────────────────────────────────────────────────────────────┐
│  Your gems don't build YOUR town better than others.        │
│  Your gems help build OUR town for everyone.                │
│  You get recognition. Everyone gets the benefits.           │
└─────────────────────────────────────────────────────────────┘
```

### Three Ways to Contribute

| Method | Who | Points/Day | Example |
|--------|-----|------------|---------|
| **Labor** | Free players | ~50 | Daily tasks, quest completion |
| **Resources** | All players | ~100-200 | Donate materials, gold |
| **Patronage** | Gem buyers | 10 per gem | Accelerate construction |

### Contribution Rates

```
Labor:     5 points per task, 10 tasks/day max = 50 points/day
Resources: 1-100 points per item donated
Gold:      1 point per 100 gold donated
Gems:      10 points per gem spent
```

### Building Tiers

**Tier 1: Basic Infrastructure**

| Building | Cost | Benefits (ALL Players) |
|----------|------|------------------------|
| Traveler's Rest | 10,000 | Faster rest, safe logout, daily meal buff |
| Training Grounds | 15,000 | Practice combat, skill trainers, daily quest |
| Market Square | 20,000 | Player trading, better NPC prices, auction house |

**Tier 2: Specialized Facilities**

| Building | Cost | Benefits (ALL Players) |
|----------|------|------------------------|
| Scriptorium | 30,000 | Lore books, skill books, LLM librarian |
| Meditation Gardens | 25,000 | Stamina regen, meditation quests, LLM koans |
| Artisan's Quarter | 35,000 | Advanced crafting, recipes, commissions |

**Tier 3: Major Structures**

| Building | Cost | Benefits (ALL Players) |
|----------|------|------------------------|
| Great Temple | 100,000 | Resurrection, blessings, festivals, LLM oracle |
| Academy of Arts | 75,000 | Performances, emotes, LLM-composed songs |
| Hall of Heroes | 50,000 | Legacy viewing, inspiration buff, legacy quests |

### Recognition System (Prestige, Not Power)

| Tier | Requirement | Recognition |
|------|-------------|-------------|
| Supporter | 100+ gems lifetime | Name on wall, badge, patron chat |
| Benefactor | 500+ gems lifetime | Building plaques, title, vote on projects |
| Founder | 2,000+ gems lifetime | Name an NPC, statue, custom room description |
| Architect | 5,000+ gems lifetime | Name a building, design input, personal quarters |

### What Patrons DON'T Get

- ❌ Better prices at shops they funded
- ❌ Exclusive building access
- ❌ Faster service or shorter queues
- ❌ Better loot from funded dungeons
- ❌ Combat bonuses in funded areas
- ❌ Quest shortcuts

### Campaign System

**Flow:**
1. **Announcement** (Week 1-2): Plans revealed, benefits explained
2. **Construction** (Week 3-6): Daily progress, leaderboard, stretch goals
3. **Dedication** (Week 7): Server event, recognition, building opens

**Stretch Goals Example (Great Library):**

| Goal | Points | Unlocks |
|------|--------|---------|
| Base | 30,000 | Library opens with basic features |
| Stretch 1 | 40,000 | Rare book collection, more NPCs |
| Stretch 2 | 50,000 | Secret archive, unique quest chain |
| Stretch 3 | 60,000 | LLM-powered librarian |
| Stretch 4 | 75,000 | Teleportation circle |

### Whale Prevention

- **30% cap**: No single patron can contribute more than 30% of building cost
- **Diminishing returns**: Points reduce to 10% rate after threshold
- **Multiple recognition categories**: Architect, First Supporter, Community Champion (labor), Resource Baron, Final Push, Consistency Award

### Crisis Events

```
"The Monastery is Under Siege!"
Duration: 72 hours

Contribution Methods:
  - Combat (defeat enemies): 10 points each
  - Crafting (make supplies): 5 points per item
  - Healing (support fighters): 3 points per heal
  - Gems (emergency funding): 10 points per gem

Victory: Monastery saved, commemorative item, new content
Defeat: Facilities offline 1 week, repair campaign launches
```

---

## Open Questions

### Business Model

1. Should base game be free-to-play or have upfront cost?
2. What's the right premium subscription price point?
3. How aggressive should cosmetic monetization be?
4. Should DM Mode be subscription or one-time purchase?

### LLM Integration

5. Which features should be in MVP vs. later phases?
6. How to handle LLM failures gracefully (fallback content)?
7. Should there be an "AI-free" mode for purists?
8. How much should NPCs remember (storage costs vs. experience)?

### Town System

9. Should there be multiple towns or one central monastery?
10. How often should construction campaigns run?
11. What happens when all buildings are built? Upgrades? New tiers?
12. Should guild-specific buildings exist alongside shared ones?

### Community

13. How transparent should we be about LLM usage?
14. Should players know when they're talking to LLM vs. scripted NPCs?
15. How to handle player expectations if LLM quality varies?

---

## Next Steps

1. **Prioritize features** for MVP vs. future phases
2. **Prototype** one Level 2-3 feature to validate approach
3. **Cost model** with real usage data from prototype
4. **Player research** on willingness to pay for proposed features
5. **Technical architecture** for LLM integration layer

---

## Appendix: The Patron's Pledge

> "When you contribute to our monastery, you give a gift to every player who walks these halls—past, present, and future.
>
> Your name may be carved in stone, but the true reward is knowing that a new player, years from now, will rest in the inn you helped build, learn from the library you funded, and find peace in gardens you made possible.
>
> This is not a transaction. It is a legacy."
