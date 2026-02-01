# Cozy Gaming Design Proposal

> **Status**: Proposal
> **Issue**: TBD
> **Last Updated**: 2026-01-31
> **Related**: [Calm Monetization](../product/calm-monetization-strategies.md), [Spark Companion](spark-companion-system.md), [Collaborative Planet Economy](collaborative-planet-economy.md)

## Executive Summary

This proposal outlines how to lean into **cozy gaming** principles to create a more welcoming, stress-free experience. Cozy games are the fastest-growing segment in gaming, with over 50% of players citing stress relief as their primary motivation.

Loka already has strong cozy foundations—the contemplative Buddhist theme, calm monetization philosophy, ethical quest design. This proposal systematizes these strengths and addresses current tensions (primarily around combat) to create a **cohesive cozy experience**.

**Core thesis**: Coziness isn't just an aesthetic—it's an approach that increases player retention, reduces churn, and builds stronger communities. Players who feel safe and abundant stay longer and engage deeper.

---

## Table of Contents

1. [The Three Pillars of Coziness](#1-the-three-pillars-of-coziness)
2. [Current Cozy Assessment](#2-current-cozy-assessment)
3. [Combat: The Core Tension](#3-combat-the-core-tension)
4. [Cozy Town Building](#4-cozy-town-building)
5. [Expanded Crafting Systems](#5-expanded-crafting-systems)
6. [Ritual Activities](#6-ritual-activities)
7. [Housing & Personal Spaces](#7-housing--personal-spaces)
8. [Companion System Cozy Integration](#8-companion-system-cozy-integration)
9. [Atmospheric Systems](#9-atmospheric-systems)
10. [Cozy Social Design](#10-cozy-social-design)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Appendix: Research Sources](#appendix-research-sources)

---

## 1. The Three Pillars of Coziness

Research from [Lostgarden](https://lostgarden.com/2018/01/24/cozy-games/) and [Game Developer](https://www.gamedeveloper.com/design/designing-for-coziness) identifies three foundational pillars:

### 1.1 Safety

> "A cozy game has an absence of danger and risk. Activities are voluntary and opt-in so that players never feel the threat of coercion."

**What this means for Loka:**
- Combat should never be mandatory
- Safe zones should be clearly marked
- Failure states should be gentle (learning, not punishment)
- No time pressure or FOMO

### 1.2 Abundance

> "Lower level Maslow needs (food, shelter) are met, providing space to work on higher needs (relationships, beauty, self-actualization, nurturing, belonging)."

**What this means for Loka:**
- Resources should feel plentiful, not scarce
- Basic needs (housing, sustenance) are always achievable
- Progression feels like deepening, not grinding
- The world provides more than it demands

### 1.3 Softness

> "Gentle stimuli, slower tempo, intimate spaces, and authentic human connection."

**What this means for Loka:**
- Warm, inviting aesthetic descriptions
- Quiet moments are valued, not rushed through
- NPCs feel genuine, not transactional
- Enclosed, human-scale spaces (gardens, kitchens, temples)

---

## 2. Current Cozy Assessment

### 2.1 Strengths (Already Cozy)

| Element | Cozy Strength |
|---------|---------------|
| **Buddhist contemplative theme** | Emphasizes mindfulness, non-attachment, acceptance |
| **Calm monetization philosophy** | Explicitly rejects FOMO, pressure, exploitation |
| **Paramita rewards** | Generosity, patience, compassion, ethics over power |
| **Ethical quest design** | "Restless Spirits" teaches compassion > violence |
| **NPC personality** | Cook Tenzin, Temple Cat - warm, nurturing presence |
| **Herb gathering/cooking** | Classic cozy activities |
| **Ambient actions** | 20+ messages per NPC create living atmosphere |
| **Housing framework** | Core cozy feature (ready to deploy) |
| **Async-first design** | No punishment for missing days |
| **Spark companion** | Warm guide, not demanding pet |
| **Civic Energy daily cap** | Can't be grinded—levels the field |

**Current Cozy Score: 7/10**

### 2.2 Tensions (Working Against Coziness)

| Element | Cozy Problem |
|---------|--------------|
| **Combat system** | Turn-based battle with HP, damage, death |
| **Kill objectives** | "Kill 3 Hungry Ghosts" as quest requirement |
| **Three Trials arc** | Fighting demons (Raga/Dvesha/Moha Mara) |
| **"World is antagonist" framing** | Wolves, bandits, blights, monster migrations |
| **Combat stats** | STR, DEX, STA designed around fighting |
| **Level requirements** | Gates content behind power progression |
| **XP/Gold primary rewards** | Extrinsic rather than intrinsic motivation |

### 2.3 Opportunities (Cozy Elements in Other Proposals)

| Proposal | Cozy Opportunity |
|----------|------------------|
| **Spark Companion** | Warm guide that grows with you, no demands |
| **Civic Energy** | Daily contribution cap = no grind advantage |
| **Town Building** | Collaborative creation, not competitive conquest |
| **Planet Identity** | Unique community cultures, belonging |
| **Teaching System** | Mentorship as prestige, not power |

---

## 3. Combat: The Core Tension

### 3.1 The Problem

Combat is currently positioned as a core mechanic. The GDD states "The world is the antagonist" with threats including wolves, bandits, and monster migrations. The Three Trials arc requires defeating demons.

This creates cognitive dissonance with the contemplative Buddhist theme. You can't authentically teach non-attachment while requiring players to defeat "Raga Mara" (the attachment demon) through violence.

### 3.2 Solution: Combat as Optional Path

**Principle**: Every challenge should have multiple paths. Combat is ONE option, never the ONLY option.

```
CURRENT DESIGN                    COZY DESIGN
───────────────────────────────────────────────────────────────
Kill 3 hungry ghosts        →    Observe ghosts, learn their need
Then learn compassion             Offer rice (the solution)
                                  *Optional*: Fight (slower path)

Defeat Raga Mara            →    Recognize attachment arising
(combat boss)                     Choose to let go (dialogue/choice)
                                  *Optional*: Fight (works but hard)

Clear monster nest          →    Find alternate route
(blocking path)                   Negotiate with creatures
                                  Wait for them to move on
                                  *Optional*: Clear through combat
```

### 3.3 Reframing the Three Trials

The Buddhist teaching on the Three Poisons is about **observation and release**, not combat.

**Current**: Fight Raga Mara, Dvesha Mara, Moha Mara
**Cozy Reframe**: Face internal challenges through choice

#### Trial of Attachment (Raga)

```yaml
trial_of_attachment:
  setup: |
    Phantom treasures materialize around you—memories of things lost,
    promises of things desired. A voice whispers: "Take them. You deserve this."

  paths:
    reach_for_treasures:
      result: |
        Your fingers pass through mist. The more you grasp, the emptier you feel.
        The phantoms reform, offering again. (Return to choice)

    observe_without_grasping:
      result: |
        You watch the treasures shimmer. Beautiful. Impermanent. Not yours.
        The longing is there—you don't deny it. But you don't chase it.
        The phantoms bow. "You understand." They dissolve peacefully.

    fight_raga_mara:  # Optional
      result: |
        A form coalesces from the phantoms—Raga Mara, spirit of attachment.
        [Combat encounter - difficult, winnable but draining]
        Victory, but the treasures still whisper. Force didn't teach the lesson.
```

#### Trial of Aversion (Dvesha)

```yaml
trial_of_aversion:
  setup: |
    Wrathful figures emerge from shadows, hurling accusations and insults.
    They mock your journey, your choices, your worth.

  paths:
    attack_in_anger:
      result: |
        Your weapon passes through them. For each one struck, two more appear.
        Rage feeds rage. The room fills with wrathful shapes. (Return to choice)

    stand_firm_without_hatred:
      result: |
        Their words sting. You feel the anger arise—acknowledge it—let it pass.
        "I see your pain," you say. "I won't add to it."
        The figures pause. Soften. "You don't feed us." They fade to quiet.

    fight_dvesha_mara:  # Optional
      result: |
        The wrathful energy concentrates into Dvesha Mara, spirit of hatred.
        [Combat encounter - brutal, punishes aggression]
        Beaten but not transformed. Anger remains, directed inward now.
```

#### Trial of Delusion (Moha)

```yaml
trial_of_delusion:
  setup: |
    Mirror images surround you—each claiming to be the real you.
    They argue, contradict, offer competing truths.
    "Follow me." "No, follow me." "They're lying." "I'm the only truth."

  paths:
    choose_one_mirror:
      result: |
        The chosen image smiles—then shatters. You chose certainty over wisdom.
        The mirrors reform. "Try again, seeker." (Return to choice)

    sit_in_uncertainty:
      result: |
        "I don't know which is true," you admit. "Perhaps none. Perhaps all."
        You stop seeking the answer. The seeking was the illusion.
        The mirrors bow. "To not-know is to begin to know."
        They dissolve, leaving only you—imperfect, uncertain, awake.

    shatter_all_mirrors:  # Optional
      result: |
        Glass rains down. Moha Mara emerges from the shards—pure confusion.
        [Combat encounter - disorienting, reality shifts mid-fight]
        Victory, but which you won? The uncertainty remains.
```

### 3.4 Safe Zone System

Clearly mark areas by threat level:

```yaml
safe_zones:
  display: "☀️ Peaceful area"
  locations:
    - monastery_gate
    - main_courtyard
    - dining_hall
    - meditation_hall
    - guest_hall
    - herb_garden
    - temple
    - kitchen

  properties:
    - no_combat_initiates: true
    - no_hostile_npcs: true
    - healing_ambient: true  # Slow HP regen
    - safe_logout: true

threat_zones:
  display: "⚠️ Wilderness - dangers may lurk"
  note: "All threats can be avoided, negotiated, or outwaited"
```

---

## 4. Cozy Town Building

The GDD envisions players settling a frontier and building towns together. This is inherently cozy when framed correctly.

### 4.1 Reframe: Building Together, Not Defending Against

**Current framing** (from GDD):
> "External threats requiring collective response: Harsh winters, Blights/plagues, Monster migrations, Bandit factions"

**Cozy reframe**:
> "Collaborative projects that bring us together: Winter preparations, Garden expansion, Bridge building, Festival organizing"

The *outcome* can be similar (collective action) but the *emotional framing* shifts from threat to opportunity.

### 4.2 Town Development Phases

Integrate with the Civic Energy system, but emphasize creation over defense:

#### Phase 1: Settlement (Weeks 1-4)

| Project | Description | Emotional Hook |
|---------|-------------|----------------|
| Community Fire | Central gathering space | "Where we share stories" |
| Shared Garden | Food for everyone | "We grow together" |
| Guest Shelter | Welcome newcomers | "No one sleeps outside" |
| Message Board | Communication hub | "Staying connected" |

#### Phase 2: Growth (Weeks 5-12)

| Project | Description | Emotional Hook |
|---------|-------------|----------------|
| Library | Knowledge preservation | "Our stories, remembered" |
| Workshop | Crafting together | "Making, not taking" |
| Tea House | Social gathering | "A place to just be" |
| Garden Expansion | More variety, beauty | "Beauty for its own sake" |

#### Phase 3: Flourishing (Weeks 13+)

| Project | Description | Emotional Hook |
|---------|-------------|----------------|
| Festival Grounds | Celebrations | "Joy shared is joy multiplied" |
| Healing House | Wellness center | "Caring for each other" |
| Meditation Garden | Contemplative space | "Silence, together" |
| Monument | Shared history | "What we built means something" |

### 4.3 No Decay Anxiety

**Current GDD approach**: Buildings decay if not maintained.

**Cozy alternative**: Buildings don't decay—they *evolve*.

```
DECAY MODEL (ANXIOUS)              EVOLUTION MODEL (COZY)
───────────────────────────────────────────────────────────────
Neglected = building damaged   →   Neglected = building weathers
Fails without intervention     →   Gains character, "patina"
Loss if you don't play         →   Change, not loss
Punishes absence               →   Accepts absence

"The library needs 200 energy  →   "The library has weathered beautifully.
or it degrades in 3 days!"         Moss grows on the stones.
                                   Some call it ruins; we call it history."
```

If desired, there can be *benefits* to maintenance (building works better when tended) without *punishment* for absence (building still functions, just with more character).

### 4.4 Individual Contribution Meaning

Each player's civic energy contribution is tracked and celebrated:

```
Your Contributions to Riverside Village
───────────────────────────────────────────────────────────────
Total energy contributed: 847

Projects you helped build:
  Grand Library ............ 42 energy (founding contributor!)
  Northern Bridge .......... 28 energy
  Community Garden ......... 156 energy (garden tender)
  Tea House ................ 31 energy

Your role: Garden Tender
"You've nurtured more plants than anyone in Riverside."
```

Titles and recognition emerge from contribution patterns, not grinding.

---

## 5. Expanded Crafting Systems

Crafting is a core cozy activity. Expand beyond functional items to include:

### 5.1 Decorative Crafting

Items with no mechanical benefit—pure aesthetic/emotional value:

| Category | Examples | Cozy Value |
|----------|----------|------------|
| **Flower arrangements** | Ikebana, seasonal bouquets | Beauty creation |
| **Prayer flags** | Colorful, wind-catching | Spiritual expression |
| **Wind chimes** | Room ambiance | Audio atmosphere |
| **Calligraphy** | Inspirational texts | Contemplative practice |
| **Pottery** | Bowls, vases, tea sets | Tactile satisfaction |
| **Tapestries** | Wall decorations | Personal space customization |
| **Garden ornaments** | Statues, lanterns, stones | Outdoor personalization |

### 5.2 Gift Crafting

Items specifically meant for giving:

```yaml
gift_crafting:
  friendship_bracelet:
    materials: [colored_thread, small_bead]
    time: 10 minutes
    description: "A simple bracelet woven with intention."
    effect: "+5 relationship when gifted"
    unique: true  # Recipient's name woven in

  blessing_scroll:
    materials: [paper, ink, pressed_flower]
    time: 15 minutes
    description: "A scroll with well-wishes for the recipient."
    effect: "Recipient receives gentle buff for 24 hours"
    unique: true  # Personalized message

  memory_album:
    materials: [binding, paper, pressed_flowers]
    time: 30 minutes
    description: "A collection of shared moments."
    effect: "Documents relationship history"
    unlock: "Requires 50+ relationship with recipient"
```

### 5.3 Food Crafting Depth

Expand cooking beyond "make item → get buff":

```yaml
tea_ceremony:
  components:
    - tea_selection: [green, white, oolong, pu_erh, herbal]
    - water_temperature: [cool, warm, hot, boiling]
    - steeping_time: [brief, moderate, long]
    - presentation: [simple_cup, ceremonial_set, sharing_pot]

  outcomes:
    perfect_brew:
      description: "The tea is transcendent. Silence feels natural."
      effect: "Shared meditation bonus if drunk together"

    good_brew:
      description: "Warming, comforting. Good for conversation."
      effect: "Relationship bonus with drinking companions"

    learning_brew:
      description: "A bit bitter, but educational. You'll do better next time."
      effect: "Tea skill +1"

meal_sharing:
  mechanic: "Cooking a meal for 2+ people provides bonus"
  solo_meal: "Nourishing. You feel sustained."
  shared_meal: "The food tastes better somehow. Company improves everything."
  feast: "The table overflows. Laughter echoes. This is why we cook."
```

### 5.4 Contemplative Crafting

Crafts that are meditative to perform:

| Craft | Description | Contemplative Element |
|-------|-------------|----------------------|
| **Sand mandala** | Create intricate patterns in sand | Impermanence—destroyed upon completion |
| **Prayer wheel** | Carve and inscribe | Repetitive, rhythmic motion |
| **Incense blending** | Combine scents | Sensory awareness |
| **Bell tuning** | Adjust for perfect tone | Deep listening |
| **Rock balancing** | Stack stones | Patience, presence |

These crafts don't produce items—they produce *experiences* and *insight*.

### 5.5 Slow Crafting

Some items take real time to complete (inspired by calm monetization):

```yaml
aging_crafts:
  fermented_tea:
    start_time: immediate
    ready_time: 30 real days
    description: "Pu-erh tea that improves with age."
    cannot_rush: true
    ambient: "Your tea continues fermenting, developing complexity."

  cured_leather:
    start_time: immediate
    ready_time: 14 real days
    description: "Leather that's been properly cured and weathered."
    quality_improves: "Each week adds character"

  aged_ink:
    start_time: immediate
    ready_time: 60 real days
    description: "Ink that deepens and settles over time."
    effect: "Calligraphy written with aged ink is more valued"
```

---

## 6. Ritual Activities

Cozy games thrive on optional, repeatable rituals that become part of daily rhythm.

### 6.1 Daily Rituals

| Ritual | Time | Action | Reward |
|--------|------|--------|--------|
| **Morning meditation** | Dawn | Sit in meditation hall | Minor wisdom buff + flavor text |
| **Garden tending** | Any | Water plants, pull weeds | Plant growth + ambient text |
| **Evening prayers** | Dusk | Attend temple service | Community connection + blessing |
| **Tea time** | Afternoon | Prepare and drink tea | Relationship bonus if shared |
| **Library reading** | Any | Read a passage | Lore fragment unlock |

**Key design**: Rewards are intrinsic (nice text, small buffs, unlocks) not extrinsic (no XP, no gold). The activity IS the reward.

### 6.2 Weekly Rituals

| Ritual | Day | Description | Community Element |
|--------|-----|-------------|-------------------|
| **Sabbath rest** | Weekly | Town takes a quiet day | Reduced activity, increased social |
| **Market day** | Weekly | Traders gather | Special items, social trading |
| **Story night** | Weekly | Elder tells tales | Lore delivery, gathering |
| **Community meal** | Weekly | Shared feast | Cooking contributions, eating together |

### 6.3 Seasonal Rituals

| Season | Festival | Activities |
|--------|----------|------------|
| **Spring** | Planting Festival | Seed sharing, garden blessing |
| **Summer** | Midsummer Gathering | Fireflies, night market, stories |
| **Autumn** | Harvest Celebration | Food sharing, gratitude practice |
| **Winter** | Lantern Festival | Light in darkness, gift giving |

### 6.4 Ritual UI Integration

```
┌─────────────────────────────────────────┐
│  Today's Rituals                        │
├─────────────────────────────────────────┤
│                                         │
│  ☀️ Dawn Meditation         [✓] Done    │
│     "The mind settles like clear water" │
│                                         │
│  🌿 Garden Tending          [ ] Available│
│     Your tomatoes look thirsty          │
│                                         │
│  🌙 Evening Prayers         [ ] At dusk │
│     Temple bell rings in 2 hours        │
│                                         │
│  ──────────────────────────────────────│
│  This Week: Market Day (3 days)         │
│  This Season: Harvest Fest (12 days)    │
│                                         │
└─────────────────────────────────────────┘
```

---

## 7. Housing & Personal Spaces

Housing is THE defining cozy feature. Prioritize deployment.

### 7.1 Core Housing Features

| Feature | Description | Cozy Value |
|---------|-------------|------------|
| **Personal room** | Private space, always accessible | Safety, ownership |
| **Decoration** | Place furniture, hang art | Personal expression |
| **Garden plot** | Grow plants at your pace | Nurturing, patience |
| **Guest book** | Visitors leave messages | Social connection |
| **Memory wall** | Display quest mementos | Achievement celebration |
| **Cooking corner** | Prepare meals at home | Self-sufficiency |
| **Rest spot** | Comfortable place to log out | Closure, peace |

### 7.2 No Housing Anxiety

**Critical design**: No rent, no taxes, no maintenance requirements.

Your home is a pure sanctuary:
- Always available
- Never degrades
- No cost to maintain
- Can't be lost

Optional improvements exist (bigger garden, nicer furniture) but the base home is permanent and free.

### 7.3 Cozy Home Progression

Instead of "upgrade tiers," homes evolve through use:

```yaml
home_evolution:
  lived_in:
    trigger: "100 hours spent at home"
    change: "Your space shows signs of living—a favorite chair, worn spots on the floor."

  personalized:
    trigger: "Place 10 decorations"
    change: "This place feels uniquely yours. Visitors comment on your style."

  welcoming:
    trigger: "Host 10 guests"
    change: "Your home has a warmth that draws people. Extra seating appears naturally."

  established:
    trigger: "1 real year of ownership"
    change: "Your home has history now. Old photos appear on shelves. It feels like home."
```

### 7.4 Pet/Companion at Home

The Spark companion and any pets have home behaviors:

```yaml
spark_at_home:
  behaviors:
    - "Your Spark hovers near the window, watching the world outside."
    - "Your Spark pulses gently near the hearth, seemingly content."
    - "Your Spark drifts to your memory wall, illuminating old mementos."
    - "Your Spark dims slightly—resting, perhaps? Do Sparks rest?"

temple_cat_at_home:
  unlock: "Befriend the temple cat (relationship 100)"
  behaviors:
    - "The temple cat has claimed your best cushion. Naturally."
    - "Grey fur drifts across the floor. Worth it."
    - "The cat watches you with ancient eyes, then yawns and stretches."
    - "A purr rumbles from somewhere behind the bookshelf."
```

---

## 8. Companion System Cozy Integration

The Spark companion system (see [proposal](spark-companion-system.md)) is already cozy-aligned. Extend it:

### 8.1 No Demands

**Critical**: The Spark never needs feeding, doesn't get sad if ignored, doesn't guilt the player.

```
TAMAGOTCHI MODEL (ANXIOUS)         SPARK MODEL (COZY)
───────────────────────────────────────────────────────────────
"I'm hungry! Feed me!"         →   *Spark pulses warmly*
"You neglected me :("          →   "You've been away. Welcome back."
Dies if not tended             →   Always there, patient
Creates obligation             →   Creates companionship
```

### 8.2 Warm Observations

The Spark comments on cozy moments:

```yaml
spark_cozy_observations:
  at_home:
    - "This place feels more like you each time we return."
    - "Home. Such a simple word for such a complex feeling."

  after_crafting:
    - "There's something satisfying about making things, isn't there?"
    - "Your hands know this work. It's meditative to watch."

  in_garden:
    - "Growth requires patience. I'm glad we have plenty."
    - "Each plant has its own rhythm. We're learning to listen."

  with_friends:
    - "Companionship is its own kind of magic."
    - "I like these people. I think you chose your friends well."
```

### 8.3 Bond Deepening Through Cozy Activities

Bond increases faster through cozy activities than combat:

| Activity | Bond Gain | Why |
|----------|-----------|-----|
| Combat victory | +1 | Shared struggle |
| Meditation together | +3 | Quiet presence |
| Cooking a meal | +2 | Creative act |
| Gardening | +2 | Nurturing patience |
| Reading together | +3 | Shared knowledge |
| Visiting sacred site | +5 | Spiritual connection |

---

## 9. Atmospheric Systems

### 9.1 Weather as Atmosphere, Not Threat

**Current GDD framing**: "Harsh winters" as collective threat.

**Cozy reframe**: Weather creates cozy contrast.

```yaml
weather_system:
  rain:
    outside: "Rain patters on leaves, creating a gentle rhythm."
    inside: "Rain drums on the roof. Inside, you're warm and dry."
    cozy_contrast: true  # Makes indoor spaces feel cozier

  snow:
    outside: "Soft snow blankets the world in quiet white."
    inside: "Snow falls past the window. The fire crackles."
    cozy_contrast: true

  sunny:
    outside: "Warm sun invites you to linger."
    inside: "Sunbeams slice through windows, dust motes dancing."
    garden_bonus: true  # Good for plants

# No "survive the blizzard" mechanics—just atmosphere
```

### 9.2 Time of Day Ambiance

Different times feel different:

```yaml
time_ambiance:
  dawn:
    light: "soft pink and gold"
    sounds: "birds waking, first stirrings"
    special: "Dawn meditation available"

  morning:
    light: "bright and clear"
    sounds: "activity, voices, work beginning"
    special: "Best time for energetic tasks"

  afternoon:
    light: "warm and full"
    sounds: "steady rhythm of daily life"
    special: "Tea time social bonus"

  evening:
    light: "golden hour, long shadows"
    sounds: "winding down, evening meals"
    special: "Evening prayers available"

  night:
    light: "moonlight, stars, lantern glow"
    sounds: "quiet, occasional night creatures"
    special: "Stargazing, intimate conversations"
```

### 9.3 Seasonal Changes

Seasons affect atmosphere and activities:

| Season | Atmosphere | Activities | Plants |
|--------|------------|------------|--------|
| **Spring** | Fresh, new growth | Planting, cleaning | Fast growth |
| **Summer** | Warm, abundant | Outdoor festivals, swimming | Peak harvest |
| **Autumn** | Cozy, reflective | Harvest, preservation | Final fruits |
| **Winter** | Quiet, interior | Crafting, storytelling, rest | Dormant |

---

## 10. Cozy Social Design

### 10.1 Reduce Stranger Anxiety

Per cozy research, strangers represent risk. Design to reduce this:

```yaml
social_design:
  introductions:
    # New players announced warmly to the room
    announcement: "A traveler arrives—[name], looking for a place to rest."
    prompt_to_others: "[Greet them?]"

  persistent_identity:
    # Can't create throwaway alts to grief
    one_character_per_account: true
    reputation_permanent: true

  graduated_interaction:
    # Start with low-risk social, escalate as comfort grows
    level_1: "Wave, nod, simple greetings"
    level_2: "Share space, work alongside"
    level_3: "Direct conversation, gift giving"
    level_4: "Invite to home, party membership"
    level_5: "Close friend status, shared projects"
```

### 10.2 Forgiveness Mechanics

When social mishaps happen, repair is possible:

```yaml
social_repair:
  accidental_offense:
    detection: "Player uses negative emote toward you"
    option: "[Apologize] [Explain] [Space]"
    apology_accepted: "Relationship only -1 instead of -5"

  misunderstanding:
    detection: "Conflict in conversation"
    mediation: "A wise elder could help clarify..."
    resolution_bonus: "Both parties +relationship if resolved"

  time_heals:
    mechanic: "Negative relationship slowly trends toward neutral"
    rate: "+1 per week of no negative interactions"
    message: "Time has softened the distance between you and [name]."
```

### 10.3 Cozy Social Activities

Activities designed for parallel social presence (together but not demanding):

| Activity | Interaction Level | Description |
|----------|-------------------|-------------|
| **Fishing together** | Low | Sit side by side, occasional comment |
| **Garden co-working** | Low | Work in adjacent plots |
| **Library reading** | Low | Quiet presence, shared space |
| **Crafting circle** | Medium | Work together, share tips |
| **Tea ceremony** | Medium | Structured sharing ritual |
| **Story circle** | High | Active sharing and listening |
| **Festival dancing** | High | Coordinated group activity |

---

## 11. Implementation Roadmap

### Phase 1: Quick Wins (Sprint 1-2)

| Task | Effort | Impact |
|------|--------|--------|
| Add safe zone indicators to rooms | Small | High |
| Add non-combat path to Restless Spirits quest | Small | High |
| Create 2-3 pure-cozy NPCs | Medium | Medium |
| Add weather ambient descriptions | Small | Medium |
| Reframe Three Trials as choice-based | Medium | High |

### Phase 2: Core Cozy Systems (Sprints 3-6)

| Task | Effort | Impact |
|------|--------|--------|
| Deploy housing system | Large | Very High |
| Implement daily rituals | Medium | High |
| Add gift crafting category | Medium | Medium |
| Implement seasonal festivals | Medium | High |
| Spark cozy observations | Small | Medium |

### Phase 3: Deep Cozy (Sprints 7-12)

| Task | Effort | Impact |
|------|--------|--------|
| Contemplative crafting (mandalas, etc.) | Medium | Medium |
| Home evolution system | Medium | Medium |
| Weather atmospheric system | Medium | Medium |
| Slow crafting (aging items) | Small | Medium |
| Full ritual calendar | Large | High |

### Phase 4: Social Cozy (Future)

| Task | Effort | Impact |
|------|--------|--------|
| Graduated social introduction system | Medium | High |
| Social repair mechanics | Medium | Medium |
| Parallel social activities | Medium | Medium |
| Community projects with cozy framing | Large | High |

---

## Appendix: Research Sources

### Primary Sources

- [Lostgarden - Cozy Games](https://lostgarden.com/2018/01/24/cozy-games/) - Foundational design framework
- [Game Developer - Designing for Coziness](https://www.gamedeveloper.com/design/designing-for-coziness) - Design principles
- [Wikipedia - Cozy Game](https://en.wikipedia.org/wiki/Cozy_game) - Genre definition
- [Gayming Magazine - What Defines a Cozy Game](https://gaymingmag.com/2025/12/what-defines-a-cozy-game/) - Recent analysis

### Supporting Research

- [Washington Post - What makes games like Stardew Valley cozy](https://www.washingtonpost.com/video-games/2023/01/18/cozy-games-unpacking-stardew-valley-animal-crossing/) - Player psychology
- [Sago Research - The Rise of Cozy Gaming](https://sago.com/en/resources/insights/the-rise-of-cozy-gaming-across-borders/) - Market trends
- [HerCozyGaming - What Makes a Game Cozy](https://hercozygaming.com/what-makes-a-game-cozy/) - Player perspective

### Game Examples

| Game | Cozy Lesson |
|------|-------------|
| **Stardew Valley** | Routine rituals, relationship building, farming rhythm |
| **Animal Crossing** | No fail states, real-time patience, decoration expression |
| **Spiritfarer** | Emotional depth without combat, caring mechanics |
| **Cozy Grove** | Patience rewarded, helping NPCs heal |
| **Littlewood** | Post-adventure life, rebuilding together |

---

## Conclusion

Loka has strong cozy foundations in its contemplative theme, calm monetization, and ethical quest design. The main work is:

1. **Make combat optional** (alternative paths for all challenges)
2. **Deploy housing** (the core cozy feature)
3. **Add ritual activities** (daily, weekly, seasonal rhythms)
4. **Expand crafting** (decorative, gift, contemplative)
5. **Reframe threats as opportunities** (building together, not defending against)

The result: a game that serves players seeking peace, community, and meaningful slow progress—a rapidly growing audience underserved by most games.

**Coziness isn't just aesthetics—it's a design philosophy that creates deeper engagement, longer retention, and stronger communities.**
