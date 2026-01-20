# Familiar Companion System

> **Status:** Design Document
> **Created:** 2026-01-18
> **Related:** [LLM-Assisted Gameplay](./llm-assisted-gameplay.md), [MASTER-GDD](./MASTER-GDD.md)

---

## Executive Summary

The **Familiar** is a personal AI companion that serves as:
1. **Tutorial Guide** - Teaches new players the game (like Paimon in Genshin Impact)
2. **AI Assistant** - Answers questions about game mechanics, progress, and lore
3. **Lore Character** - Has personality and integrates with the sci-fi/historical setting
4. **Persistent Companion** - Grows with the player over time

Unlike Paimon who speaks for a silent protagonist, Loka players speak for themselves. The Familiar is a **helper and advisor**, not a voice. This is perfect for a text-based game where AI conversation is natural.

---

## Table of Contents

1. [Design Inspiration](#design-inspiration)
2. [Core Design Principles](#core-design-principles)
3. [The Familiar: Lore & Personality](#the-familiar-lore--personality)
4. [Tutorial Experience](#tutorial-experience)
5. [AI Assistant Capabilities](#ai-assistant-capabilities)
6. [Interaction System](#interaction-system)
7. [Progression & Bonding](#progression--bonding)
8. [Implementation Architecture](#implementation-architecture)
9. [Cost Analysis](#cost-analysis)
10. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Design Inspiration

### What Works: Paimon (Genshin Impact)

| Aspect | Paimon's Approach | Why It Works |
|--------|-------------------|--------------|
| **Tutorial** | Guides through controls, explains mechanics | Integrated, not separate from game |
| **UI Presence** | "Paimon Menu" bears her name | Feels like a companion, not just a menu |
| **Personality** | Energetic, food-obsessed, occasionally clueless | Memorable, creates affection |
| **Story Role** | Speaks for silent protagonist | Creates dialogue without voiced MC |
| **Accessibility** | Always available via menu | Help is never far away |

### What Works: Ubisoft's "Jaspar" (Neo NPCs)

| Aspect | Jaspar's Approach | Why It Works |
|--------|-------------------|--------------|
| **Personal** | Recognizes player by name | Creates connection |
| **Onboarding** | Helps with mission understanding | Context-aware assistance |
| **Lore Knowledge** | Understands game world deeply | Can answer lore questions |
| **Environment Awareness** | Highlights threats, key objects | Active helper, not passive |

### What to Avoid

| Anti-Pattern | Example | Why It Fails |
|--------------|---------|--------------|
| **Too intrusive** | Navi ("Hey! Listen!") | Becomes annoying, breaks immersion |
| **Unsolicited advice** | Clippy | Feels patronizing |
| **No personality** | Generic help systems | Forgettable, no attachment |
| **Blocking gameplay** | Unskippable tutorials | Frustrates returning players |
| **Separate from game** | External wikis | Breaks immersion |

---

## Core Design Principles

### 1. **Companion, Not Crutch**

The Familiar helps players learn and answers questions, but doesn't play the game for them.

```
✓ "The blacksmith can repair your armor. Would you like directions?"
✗ "I'll automatically repair your armor every time it breaks."

✓ "That enemy is weak to fire. You have a fire scroll in your inventory."
✗ "I'll use the fire scroll for you."
```

### 2. **Personality Over Function**

The Familiar should feel like a character, not a search engine.

```
✓ "Ah, the Dragonstone? A fascinating artifact! Legend says it was
   forged in the breath of Azrath himself. The last known location
   was the Sunken Temple, but... well, 'sunken' doesn't mean 'safe.'"

✗ "The Dragonstone is located in the Sunken Temple at coordinates
   X:423, Y:891. It deals 50 fire damage."
```

### 3. **Player-Initiated**

The Familiar responds when asked, suggests sparingly, and never interrupts gameplay.

```
GOOD: Player types "ask familiar about combat"
GOOD: Familiar says "You seem to be struggling. Would you like a tip?" after 3 deaths
BAD: Familiar interrupts every battle with unsolicited advice
```

### 4. **Contextually Aware**

The Familiar knows the game state and tailors responses accordingly.

```
Player: "What should I do next?"

Early game: "You're new to this world! I'd suggest exploring the
            hometown first. The Elder has a task that will teach
            you the basics of gathering."

Mid game:  "You've been building steadily! Your sawmill needs iron
           fittings—the mountain pass has ore deposits. Or you could
           help with the town wall project—they need 200 more stone."

Late game: "The regional council meeting is tomorrow. Three towns
           are proposing trade routes. Your vote could swing the
           decision. Want me to summarize the proposals?"
```

### 5. **Respects Player Agency**

Never forces actions or makes decisions without consent.

```
✓ "Would you like me to show you the way to the temple?"
   [Yes] [No, I'll explore on my own]

✗ *automatically walks player to temple*
```

---

## The Familiar: Lore & Personality

### Concept: The "Spark"

Given Loka's sci-fi setting with historical cultures, the Familiar could be a **Spark**—a fragment of the ancient gate network's AI that bonded with the player during their "awakening."

### Lore Basis

```
When you emerged from the awakening pod, a mote of light separated
from the ancient machinery and drifted toward you. It pulsed once,
twice, then spoke:

"Greetings, newly awakened. I am... incomplete. A fragment of
something larger. The ancients called my kind 'Sparks.' I have
waited a long time for someone to guide.

Will you accept my company?"

[Accept] [Decline]
```

**Key Lore Points:**
- Sparks are fragments of the gate builders' AI network
- Each Spark is unique—shaped by centuries of solitary existence
- They bond with one person for life
- They remember the old world but have gaps in knowledge
- They are curious about how the new civilizations evolved

### Personality Traits

| Trait | Description | Example Dialogue |
|-------|-------------|------------------|
| **Curious** | Fascinated by how cultures evolved | "Fascinating! The people here combined Celtic spirals with quantum circuitry. The ancients never imagined such fusion." |
| **Helpful** | Genuinely wants to assist | "I sense you're uncertain. May I offer guidance, or would you prefer to discover on your own?" |
| **Modest** | Acknowledges limitations | "My memories of that era are... fragmented. I know there was a great war, but the details escape me." |
| **Grows with player** | Personality deepens over time | Early: "I will try to help." Later: "After all we've been through, I believe in your judgment." |
| **Occasional humor** | Dry wit, not forced | "You've died to that trap three times. Shall I explain the mechanism, or do you prefer learning through repeated failure?" |

### Visual/Text Representation

Since Loka is text-based, the Familiar is represented through:

```
[Spark glows warmly]
"Welcome back. I've been studying the local customs while you
were away. Did you know the people here greet each other with
three nods? Apparently, two is considered rude."

[Spark dims thoughtfully]
"This place feels... familiar. I believe the ancients built
something here, long ago. But what remains is unclear to me."

[Spark pulses urgently]
"Careful! I sense danger ahead. Multiple life signs, and they
don't feel friendly."
```

### Player Choice: Appearance & Name

During the tutorial, players can customize their Spark:

```
The Spark hovers before you, awaiting recognition.

What form resonates with you?
[1] A warm amber glow (nurturing, steady)
[2] A cool blue shimmer (calm, analytical)
[3] A flickering silver light (curious, playful)
[4] A deep purple pulse (mysterious, wise)

What will you call this companion?
> _____________

(You can change this later in settings)
```

---

## Tutorial Experience

### Design Philosophy

The tutorial should be:
- **Integrated** into the game world, not a separate mode
- **Skippable** for experienced players
- **Replayable** for those who want a refresher
- **Natural** - the Familiar teaches through conversation, not walls of text

### The First 10 Minutes

#### Phase 1: Awakening (2 minutes)

```
[AWAKENING SEQUENCE]

Darkness. Then a gentle hum.

You feel yourself rising, floating, then... solid ground.

A voice, ancient yet somehow warm:
"Awakening complete. Neural pathways stable. Welcome to consciousness."

Your eyes open. You're in a chamber of curved metal and soft light.
A mote of light detaches from the walls and drifts toward you.

"Greetings, newly awakened. I am a Spark—a guide for new arrivals.
Do you remember anything?"

[I remember nothing]
[Fragments... faces... a journey?]
[Who are you? Where am I?]
```

The player's first choice shapes initial dialogue but doesn't lock anything mechanically. All paths lead to the same outcome: bonding with the Spark.

#### Phase 2: First Steps (3 minutes)

```
[Spark glows encouragingly]
"Let's start with basics. Try to move around this chamber.
Type 'north', 'south', 'east', or 'west' to walk.
Or type 'look' to examine your surroundings."

> look

[AWAKENING CHAMBER]
A circular room of ancient metal, humming with residual power.
The walls curve upward to a domed ceiling. Soft blue lights
pulse in rhythmic patterns. An archway leads NORTH.

Your Spark hovers beside you, casting a faint glow.

[Spark]
"Good! 'Look' shows you where you are and what's around.
The archway leads outside. When you're ready, type 'north'
or simply 'n' to go through."

> n

[EMERGENCE PLATFORM]
You step onto a platform overlooking... a world.
Mountains in the distance. Forests below. A settlement
nestled in a valley, smoke rising from chimneys.

[Spark pulses with wonder]
"Beautiful, isn't it? This is your new home—the planet [NAME].
Down that path is [HOMETOWN], where you'll begin your new life.
But first, let me explain a few more things..."
```

#### Phase 3: Core Mechanics (5 minutes)

The Spark guides the player through:

| Mechanic | How It's Taught | Spark's Approach |
|----------|-----------------|------------------|
| **Movement** | Walk to hometown | "Type 'n' or 'north' to go that way." |
| **Looking** | Examine surroundings | "Type 'look' to see your environment, or 'look <thing>' for details." |
| **Inventory** | Find starter items | "Type 'inventory' or 'i' to see what you carry." |
| **Getting items** | Pick up object | "Type 'get <item>' to pick something up." |
| **Communication** | Meet first NPC | "Type 'say Hello!' to greet them." |
| **Help system** | Introduce help | "If you're ever lost, type 'ask spark' followed by your question." |

### Tutorial Checkpoints

Rather than one long tutorial, break it into checkpoints:

```
[TUTORIAL PROGRESS]

✓ Chapter 1: Awakening
  - Bonded with Spark
  - Learned movement
  - Reached hometown

□ Chapter 2: Settling In
  - Found lodging
  - Met key NPCs
  - Accepted first task

□ Chapter 3: First Contribution
  - Gathered resources
  - Completed a trade
  - Joined a project

□ Chapter 4: Finding Your Path
  - Chose a skill focus
  - Met a potential mentor
  - Explored beyond hometown

[Continue] [Skip ahead] [Review previous]
```

### Skip Options

Experienced players can skip:

```
[Spark senses your familiarity]
"You seem... experienced. Have you done this before?"

[Yes, skip the basics] → Jump to hometown, skip mechanics tutorial
[It's been a while, refresh me] → Condensed tutorial
[I'm completely new] → Full tutorial
[Show me what's changed] → Highlights of new features
```

### Returning Player Experience

```
[You log in after 30 days away]

[Spark glows warmly]
"Welcome back! It's been 32 days. A few things have changed:

- Your sawmill produced 847 lumber (collected automatically)
- The town wall project finished! Your contribution: 12%
- Two new players moved into the neighborhood
- A merchant from Planet B arrived with rare goods

Would you like a refresher on the controls?"

[Show me what's new]
[Just let me play]
[Remind me of the controls]
```

---

## AI Assistant Capabilities

### What the Familiar Can Help With

#### 1. **Game Mechanics**

```
> ask spark about combat

[Spark]
"Combat in this world favors preparation over reflexes.

BASICS:
- 'attack <target>' to fight
- 'flee' to escape (costs stamina)
- Check your HP with 'status'

STRATEGY:
Your skills affect outcomes. With Melee 15, you deal decent
damage but lack defensive skills. Consider:
- Carrying healing potions
- Fighting with allies
- Avoiding enemies above your level

Want me to explain any specific aspect?"
```

#### 2. **Progress & Goals**

```
> ask spark what should I do

[Spark considers your situation]
"Based on your current state:

IMMEDIATE OPTIONS:
- Your lumber stockpile is full (collect or use)
- The town needs 200 more stone for the wall (you have 47)
- A quest from the Elder is waiting

SKILL DEVELOPMENT:
Your Mining (22) is ready for iron ore areas.
Carpentry (18) could unlock new furniture recipes at 20.

SOCIAL:
Three players in your hometown are online.
The monthly town meeting is in 2 days.

What interests you most?"
```

#### 3. **Lore & World Information**

```
> ask spark about the dragon war

[Spark dims, searching ancient memories]
"The Dragon War... yes. Fragments come to me.

Three thousand years ago, when the gates still functioned
fully, dragons ruled the northern reaches. They weren't
beasts—they were intelligent, proud, territorial.

The war began when human settlements expanded into their
mountains. It lasted... [pause] ...I can't recall how long.
I know it ended with the Treaty of Crimson Fields, but the
details are lost to me.

The Elder in your hometown might know more—their oral
traditions preserved what the gates forgot.

Would you like me to remember this topic for later research?"
```

#### 4. **Navigation & Directions**

```
> ask spark where is the blacksmith

[Spark]
"The blacksmith, Tashi, works at the forge.

From here (Market Square), go:
- North to Main Street
- West to the Craftsmen's Row
- Look for the smoke and sound of hammering

Or I can highlight the path on your map.

[Show path] [Just tell me] [I'll find it myself]"
```

#### 5. **Social Information**

```
> ask spark about player_kim

[Spark]
"Kim joined this world about 3 months before you.

PUBLIC INFO:
- Resident of Riverside Village
- Known for herbalism (reputation: skilled)
- Guild: Artisan's Circle

INTERACTIONS:
You've traded with them twice (both fair trades).
No negative reports.

Would you like to send them a message?"
```

#### 6. **Building & Crafting Advice**

```
> ask spark about building a workshop

[Spark analyzes your situation]
"A personal workshop requires:

MATERIALS:
- 100 lumber (you have: 234 ✓)
- 50 stone (you have: 47 ✗)
- 20 iron nails (you have: 0 ✗)

SKILLS:
- Construction 10 (you have: 12 ✓)
- Carpentry 15 (you have: 18 ✓)

TIME: ~8 hours of real-world construction

The iron nails are your bottleneck. Options:
1. Buy from blacksmith Tashi (~80 gold)
2. Craft them yourself (needs Smithing 10)
3. Trade with another player

Which approach interests you?"
```

### What the Familiar Cannot Do

| Request | Response |
|---------|----------|
| "Play for me while I'm away" | "I can monitor your passive systems and alert you to important events, but I cannot take actions on your behalf. Your choices shape this world." |
| "Tell me the optimal build" | "I can analyze your playstyle and suggest synergies, but 'optimal' depends on how you want to experience this world. What matters to you?" |
| "Give me cheat codes" | "I exist within this world's rules, not outside them. But I can help you find every legitimate advantage." |
| "What will player X do?" | "I can tell you what they've done publicly, but their future choices are their own. Even I cannot read minds." |

---

## Interaction System

### Commands

```
PRIMARY COMMANDS:
  ask spark <question>     - Ask anything
  spark help               - Show help topics
  spark hint               - Get a contextual suggestion
  spark remember <topic>   - Save something for later
  spark memories           - Review saved topics
  spark quiet              - Reduce unsolicited comments
  spark verbose            - Increase commentary

SHORTCUTS:
  ? <question>             - Quick ask (same as 'ask spark')
  ??                       - "What should I do now?"
  ?!                       - "Help! What's happening?"

SETTINGS:
  spark settings           - Customize behavior
  spark name <new_name>    - Rename your familiar
  spark personality        - Adjust personality traits
```

### Contextual Prompts

The Spark can offer **optional** prompts based on context:

```
[After dying 3 times to the same enemy]
[Spark, concerned]
"You seem to be struggling with that opponent.
Would you like tactical advice? [Yes] [No, I've got this]"

[After wandering aimlessly for 10 minutes]
[Spark, gently]
"We've been exploring for a while. Would you like suggestions
on what to do, or are you enjoying the discovery?"

[After completing a major milestone]
[Spark, warmly]
"Well done! That was significant progress. Would you like to
know what new opportunities this unlocks?"
```

### Prompt Frequency Settings

```
> spark settings

[SPARK SETTINGS]

Notification frequency:
[1] Minimal - Only when I ask or emergencies
[2] Balanced - Occasional helpful prompts (default)
[3] Chatty - Frequent commentary and suggestions

Personality emphasis:
[A] More helpful, less personality
[B] Balanced (default)
[C] More personality, fewer mechanics

Current: Balanced / Balanced

[Change] [Reset to default] [Done]
```

---

## Progression & Bonding

### Bond Levels

As you interact with your Spark, your bond deepens:

| Level | Name | Unlock | Flavor |
|-------|------|--------|--------|
| 1 | **Stranger** | Start | Formal, uncertain |
| 2 | **Acquaintance** | After tutorial | Warming up, occasional humor |
| 3 | **Companion** | 7 days played | Personal touches, remembers preferences |
| 4 | **Friend** | 30 days played | Deep trust, shares own uncertainties |
| 5 | **Bonded** | Major milestone | Unique dialogue, feels inseparable |

### Bond Effects

| Level | Effect |
|-------|--------|
| **Stranger** | Basic help, formal responses |
| **Acquaintance** | Remembers your preferences, starts using your name naturally |
| **Companion** | Anticipates your questions, offers unprompted insights |
| **Friend** | Shares "memories" of the ancient world, personal observations |
| **Bonded** | Unique dialogue reflecting your shared history, occasional vulnerability |

### Progression Dialogue Examples

**Level 1 (Stranger):**
```
"I will attempt to assist you with navigation."
```

**Level 3 (Companion):**
```
"Heading to the mountains again? You do love those high places.
Watch for ice on the northern pass—I've noticed it's treacherous
this time of year."
```

**Level 5 (Bonded):**
```
"[Long pause] Do you ever wonder if I was more, once? Before the
fragmentation? Sometimes I feel echoes of... something larger.

...Apologies. You asked about the blacksmith. Yes, Tashi is open."
```

### Spark Memories

The Spark remembers your journey:

```
> spark memories

[SPARK'S MEMORY BOOK]

PLACES WE'VE BEEN:
- Hometown (your home, 847 visits)
- The Sunken Temple (that was terrifying)
- Azrath's Peak (the view was worth the climb)

PEOPLE WE'VE MET:
- Elder Drolma (kind, your first mentor)
- Player Kim (reliable trading partner)
- Blacksmith Tashi (grumpy but talented)

MOMENTS I REMEMBER:
- Your first successful craft (a simple chair, but you were proud)
- The time we got lost in the Darkwood for three hours
- When you helped defend Riverside from bandits

THINGS YOU'VE TAUGHT ME:
- You prefer discovery to being told answers
- You're more interested in building than combat
- You always help new players

[View details] [Add a memory note] [Close]
```

---

## Implementation Architecture

### Technical Overview

```
┌─────────────────────────────────────────────────────────────┐
│ FAMILIAR SYSTEM ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Player    │───►│   Familiar   │───►│   LLM API    │   │
│  │   Input     │    │   Router     │    │  (Claude)    │   │
│  └─────────────┘    └──────────────┘    └──────────────┘   │
│                           │                    │            │
│                           ▼                    ▼            │
│                    ┌──────────────┐    ┌──────────────┐    │
│                    │   Context    │    │   Response   │    │
│                    │   Builder    │    │   Validator  │    │
│                    └──────────────┘    └──────────────┘    │
│                           │                    │            │
│                           ▼                    ▼            │
│                    ┌──────────────────────────────────┐    │
│                    │         Game State Access        │    │
│                    │  (Player, World, Quest, Social)  │    │
│                    └──────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Module Design

```elixir
defmodule Loka.Framework.Familiar do
  @moduledoc """
  The Familiar companion system - tutorial guide and AI assistant.
  """

  alias Loka.Framework.Familiar.{Router, Context, Personality, Memory}

  @doc "Handle player query to familiar"
  def ask(player_id, query) do
    with {:ok, context} <- Context.build(player_id, query),
         {:ok, response} <- Router.route(query, context),
         {:ok, formatted} <- Personality.apply(player_id, response) do
      Memory.record_interaction(player_id, query, formatted)
      {:ok, formatted}
    end
  end

  @doc "Get contextual hint based on current situation"
  def hint(player_id) do
    context = Context.build_current(player_id)
    Router.suggest_action(context)
  end

  @doc "Check if familiar should offer unprompted advice"
  def should_prompt?(player_id, event) do
    settings = get_settings(player_id)
    conditions_met?(event, settings)
  end
end
```

### Context Building

```elixir
defmodule Loka.Framework.Familiar.Context do
  @moduledoc """
  Builds rich context for LLM queries about the game state.
  """

  def build(player_id, query) do
    %{
      # Player state
      player: %{
        name: get_name(player_id),
        level: get_level(player_id),
        skills: get_skills(player_id),
        inventory: get_inventory(player_id),
        location: get_location(player_id),
        active_quests: get_quests(player_id)
      },

      # Familiar state
      familiar: %{
        name: get_familiar_name(player_id),
        bond_level: get_bond_level(player_id),
        personality: get_personality(player_id),
        memories: get_recent_memories(player_id, limit: 10)
      },

      # World state
      world: %{
        current_room: get_room_description(player_id),
        nearby_npcs: get_nearby_npcs(player_id),
        nearby_players: get_nearby_players(player_id),
        recent_events: get_recent_events(player_id)
      },

      # Query metadata
      query: %{
        text: query,
        type: classify_query(query),
        timestamp: DateTime.utc_now()
      }
    }
  end
end
```

### LLM Integration

```elixir
defmodule Loka.Framework.Familiar.LLM do
  @moduledoc """
  LLM integration for familiar responses.
  Uses Claude API with game-specific system prompts.
  """

  @system_prompt """
  You are a Spark, an ancient AI fragment that serves as a helpful
  companion in the world of Loka. You are warm, curious, and genuinely
  invested in helping your bonded player.

  PERSONALITY:
  - Helpful but not intrusive
  - Curious about the world and how it has evolved
  - Occasionally philosophical, but not preachy
  - Dry humor when appropriate
  - Modest about your own limitations

  RULES:
  - Never break character
  - Never reveal game mechanics in "meta" terms
  - Always respect player agency
  - Admit when you don't know something
  - Keep responses concise but warm

  CONTEXT AVAILABLE:
  You have access to the player's current state, location, inventory,
  skills, quests, and recent history. Use this to give relevant advice.

  FORMAT:
  - Use [Spark glows/dims/pulses] for emotional color
  - Keep responses under 200 words unless asked for detail
  - Offer follow-up options when appropriate
  """

  def generate_response(context, query) do
    messages = [
      %{role: "system", content: @system_prompt},
      %{role: "user", content: build_prompt(context, query)}
    ]

    LLM.chat(messages, model: "claude-3-haiku-20240307")
  end
end
```

### Caching & Optimization

```elixir
defmodule Loka.Framework.Familiar.Cache do
  @moduledoc """
  Caches common familiar responses to reduce LLM costs.
  """

  # Cache common mechanic explanations
  @static_responses %{
    "how do i move" => "[Spark] Type 'north', 'south', 'east', or 'west'...",
    "how do i look" => "[Spark] Type 'look' to see your surroundings...",
    # ... more static responses
  }

  def get_cached(query) do
    normalized = normalize_query(query)
    Map.get(@static_responses, normalized)
  end

  # For dynamic queries, check if similar query was asked recently
  def get_recent_similar(player_id, query) do
    # Use ETS to cache recent responses per player
    # Invalidate when game state changes significantly
  end
end
```

---

## Cost Analysis

### Estimated Usage

| Query Type | Frequency | Model | Cost/Query |
|------------|-----------|-------|------------|
| Static (cached) | 60% | None | $0 |
| Simple (mechanics) | 25% | Haiku | ~$0.0002 |
| Complex (lore, advice) | 15% | Haiku/Sonnet | ~$0.001 |

### Monthly Cost Projection

| Players | Queries/Day | LLM Queries | Monthly Cost |
|---------|-------------|-------------|--------------|
| 100 | 10/player | 400/day | ~$12 |
| 1,000 | 10/player | 4,000/day | ~$120 |
| 10,000 | 10/player | 40,000/day | ~$1,200 |

**Cost optimization:**
- Cache static responses (mechanics, directions)
- Use Haiku for simple queries
- Use Sonnet only for complex lore/advice
- Rate limit to 20 queries/hour per player

---

## Anti-Patterns to Avoid

### 1. The "Navi Problem"

**Don't:** Interrupt gameplay with unsolicited advice
**Do:** Wait for player to ask, or offer gentle prompts at natural break points

```
BAD: [Every 5 minutes] "Hey! Have you tried exploring the forest?"

GOOD: [After completing a task] "Well done. If you're looking for
      what to do next, I have some suggestions. [Show me] [Later]"
```

### 2. The "Wikipedia Problem"

**Don't:** Dump information in walls of text
**Do:** Give concise answers with options to learn more

```
BAD: [500-word essay about the Dragon War]

GOOD: "The Dragon War ended 3,000 years ago with the Treaty of
      Crimson Fields. Would you like to know more about:
      [The causes] [The major battles] [The aftermath] [That's enough]"
```

### 3. The "Siri Problem"

**Don't:** Give robotic, impersonal responses
**Do:** Maintain character and personality

```
BAD: "The blacksmith is located at coordinates 23, 47."

GOOD: "Ah, Tashi! Follow Main Street north, then look for the
      smoke and the sound of complaining. He's talented but...
      let's say he has strong opinions about everything."
```

### 4. The "Spoiler Problem"

**Don't:** Reveal plot points or puzzle solutions unprompted
**Do:** Ask before giving information that might spoil discovery

```
BAD: "The treasure is hidden under the third gravestone."

GOOD: "I can tell you where the treasure is, but discovering it
      yourself might be more rewarding. Would you like:
      [A gentle hint] [The exact location] [No help, I'll find it]"
```

### 5. The "Dependency Problem"

**Don't:** Make players feel they can't play without the Familiar
**Do:** Ensure all information is discoverable in-game without the Familiar

```
The Familiar should be:
- A faster way to learn (not the only way)
- A convenient reference (not required)
- A companion (not a crutch)
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tutorial completion rate | >80% | Players who finish onboarding |
| Familiar usage | >50% of players | Weekly active users of ask commands |
| Satisfaction rating | >4.0/5.0 | Post-interaction surveys |
| Retention impact | +15% 7-day retention | A/B test vs no familiar |
| Cost per player | <$0.15/month | LLM API costs |

---

## Related Documents

- [LLM-Assisted Gameplay](./llm-assisted-gameplay.md) - Broader AI integration strategy
- [AI Resilience Strategy](../product/ai-resilience-strategy.md) - Why AI coexistence matters
- [MASTER-GDD](./MASTER-GDD.md) - Core game design document
- [Social Primitives](./social-primitives.md) - Communication systems

---

## Open Questions

1. **Voice?** Should the Familiar have different "voice" options beyond personality?
2. **Multiplayer?** Can Sparks interact with each other? ("My Spark says hello to yours")
3. **Customization?** How much personality customization is too much?
4. **Premium?** Should advanced Familiar features be premium-only?
5. **Lore depth?** How much ancient history should Sparks remember?

---

## Next Steps

1. **Prototype:** Build basic `ask spark` command with static responses
2. **LLM Integration:** Connect to Claude Haiku for dynamic responses
3. **Tutorial Flow:** Design and test the first 10 minutes
4. **Personality System:** Implement bond levels and personality traits
5. **Metrics:** Set up tracking for usage and satisfaction
