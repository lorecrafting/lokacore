# Loka Content Design Framework

> **How to design content for Loka** — the methodology behind narrative, skills, combat, crafting, and how they reinforce each other.
>
> This is the companion to `MASTER-GDD.md` (which covers *what* the game is). This document covers *how to design* it.

**Last Updated:** 2026-02-17

---

## Table of Contents

1. [The Core Principle](#1-the-core-principle)
2. [The Five Layers](#2-the-five-layers)
3. [Narrative Layer — The Bead Framework](#3-narrative-layer--the-bead-framework)
4. [World Layer — Zone Design](#4-world-layer--zone-design)
5. [Skill Layer — Learning in Context](#5-skill-layer--learning-in-context)
6. [Systems Layer — Combat, Crafting, Economy](#6-systems-layer--combat-crafting-economy)
7. [Balance Layer — Numbers Last](#7-balance-layer--numbers-last)
8. [How the Layers Interact](#8-how-the-layers-interact)
9. [Skill Gating Philosophy](#9-skill-gating-philosophy)
10. [Onboarding Design — The Invisible Tutorial](#10-onboarding-design--the-invisible-tutorial)
11. [XP and Leveling Philosophy](#11-xp-and-leveling-philosophy)
12. [Design Checklist](#12-design-checklist)

---

# 1. The Core Principle

> **Every system should make the story feel more real, not interrupt it.**

This is the test for every design decision. When you're deciding whether to add a mechanic, gate a quest, or design a combat encounter — ask: does this make the world feel more real and inhabited, or does it pull the player out?

A skill check on a climbing scene makes the world feel real. A mandatory 10-minute crafting wait before a cutscene doesn't.

---

# 2. The Five Layers

Content in Loka is designed in five concentric layers. Outer layers frame inner ones. You design outside-in (narrative first, numbers last) and experience inside-out (the player encounters mechanics first, story reveals itself over time).

```
┌─────────────────────────────────────────┐
│  5. BALANCE LAYER (numbers, tuning)     │
│  ┌───────────────────────────────────┐  │
│  │  4. SYSTEMS LAYER (combat,        │  │
│  │     crafting, economy)            │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  3. SKILL LAYER             │  │  │
│  │  │  (what players learn)       │  │  │
│  │  │  ┌───────────────────────┐  │  │  │
│  │  │  │  2. WORLD LAYER       │  │  │  │
│  │  │  │  (zones, space)       │  │  │  │
│  │  │  │  ┌─────────────────┐  │  │  │  │
│  │  │  │  │ 1. NARRATIVE    │  │  │  │  │
│  │  │  │  │ LAYER (story)   │  │  │  │  │
│  │  │  │  └─────────────────┘  │  │  │  │
│  │  │  └───────────────────────┘  │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

Design sequence: **Layer 1 → 2 → 3 → 4 → 5**
Player experience: **Layer 5 → 4 → 3 → 2 → 1** (mechanics first, meaning emerges)

---

# 3. Narrative Layer — The Bead Framework

## 3.1 The 108-Bead Structure

Every major story world uses the 108-bead arc — named for the sacred mala bead count. It's not a rigid formula but a structural scaffold that ensures emotional pacing.

**The arc in five movements:**

| Movement | Beats | Emotional Register | World Truth |
|----------|-------|--------------------|-------------|
| **Arrival** | 1–27 | Wonder, disorientation, belonging | The surface of the world |
| **Belonging** | 28–54 | Intimacy, weight, exhaustion, love | The people and their costs |
| **Discovery** | 55–81 | Revelation, grief, stakes | The hidden truth |
| **Crisis** | 82–100 | Loss, choice, sacrifice | The price of caring |
| **Resolution** | 101–108 | Grief transforming to joy | The meaning |

**Design rules:**
- Each beat is a scene, moment, or revelation — not a quest objective. Some beats are 5-minute ambient moments; some are 30-minute quest chains.
- Foreshadowing must be planted at least 20 beats before payoff. If something matters in Act 3, seed it in Act 1.
- The resolution (beats 101–108) is non-negotiable. Never cut the aftermath — this is where the emotional investment pays out.

## 3.2 Quest Chain Minimum

Every quest chain, however small, needs four things:

| Element | Description | Example |
|---------|-------------|---------|
| **Hook** | Why does the player care? | "Thera asks you to find something she lost" |
| **Complication** | The situation is not what it appeared | "What she lost reveals something about her past" |
| **Resolution** | The situation changes | "She has to confront what she was avoiding" |
| **World-truth** | What does this reveal about the world or a character? | "The Grove holds more grief than it shows" |

Quests without a world-truth are fetch quests. They're not inherently bad — but they should be rare and serve pacing (breathing room between heavy beats), not filler.

## 3.3 The Hidden Structure

The best narrative design has two layers:
- **Surface**: what players are doing (helping Thera find a lost herb, learning to sense the Pulse)
- **Subtext**: what it means (she's avoiding the Heartroot because she can feel her calling; sensing the Pulse is learning to listen to another person)

The surface is the gameplay. The subtext is why players remember it.

---

# 4. World Layer — Zone Design

## 4.1 Zone Thesis

Every zone has a single **mood thesis** — one emotional or thematic question it answers through every room, NPC, and encounter within it.

| Zone | Thesis |
|------|--------|
| The Grove (Seedship) | "Who are you, and what are you willing to witness?" |
| Planet (to be designed) | TBD |

Everything in a zone should speak to its thesis. A room description, an ambient NPC line, a crafting recipe — all should be interpretable through the thesis lens. If a piece of content doesn't connect to the thesis, it belongs somewhere else.

## 4.2 Zone Progression Model

Zones gate by **narrative progress, not arbitrary level**. Players move forward because they've witnessed something, not because they've ground enough XP.

```
Story beat unlocked → new area accessible → new skill available → new beat becomes possible
```

This creates a spiral: story drives access, access enables skill, skill unlocks story.

## 4.3 Spatial Storytelling

Rooms are not just transport corridors. Every room should have:
- A **first impression** line (what you see immediately)
- An **atmosphere** layer (what you feel/hear/smell on closer attention)
- At least one **environmental detail** that hints at history

Rooms that reveal the world's hidden truth should have description variants — what the room looks like before and after the revelation is known.

---

# 5. Skill Layer — Learning in Context

## 5.1 The Learning Context Rule

> **Skills are learned from people, not menus.**

Every skill has a canonical learning context — a character, a situation, a relationship. The skill is mechanically identical however learned, but the *how* matters for the world's texture.

| Skill | Canonical Teacher | Context |
|-------|-------------------|---------|
| `meditate` | Thera | Teaching session, beat 35 |
| `forage` | A Tender NPC | Working alongside them in the forest |
| `sneak` | Kira | She shows you how to move quietly near the Edge |
| `first_aid` | Thera | After she heals you, she teaches you the basics |

When players learn these skills in context, the skills carry emotional weight. When they learn them from a generic planet trainer later, they're just mechanics. Both work — but one is richer.

## 5.2 Skill Acquisition Is Story

In the Grove, skill acquisition is woven into the narrative beats:
- Thera's teaching sessions (beats 34–38) are when you learn Meditate and First Aid
- Kira's scouting trips are when you learn Sneak
- Working alongside Tenders is when you learn Forage

The skill isn't rewarded after a quest. The quest IS the skill acquisition. This makes the mechanical and narrative inseparable.

## 5.3 The Grove Skill Set

Skills relevant to the Grove starting world:

| Skill | Learning Source | Role |
|-------|----------------|------|
| `forage` | Tender NPC | Core Tender identity |
| `first_aid` | Thera | Medicine and healing |
| `meditate` | Thera | Pulse sensing, spiritual practice |
| `meditation` | Thera (advanced) | Deeper healing bonus |
| `sneak` | Kira | Navigating restricted areas |
| `sprint` | Exploration | Movement |
| `climb` | Exploration | Vertical terrain |
| `focus` | Advanced (prereq: meditate) | Advanced Pulse work |

Combat/magic/commerce skills are planet-layer and remain dormant during the Grove.

---

# 6. Systems Layer — Combat, Crafting, Economy

## 6.1 Combat Design Principle

> **Design the encounter's intention before its numbers.**

Every fight has a narrative purpose. Ask: what is this fight *about*? Not mechanically — thematically.

- A fight against a creature that's suffering should feel different from a fight against something predatory
- Fights that can be resolved non-violently should offer that path, even if combat is still viable
- Bosses are not damage sponges — they're narrative statements. Their mechanics should embody the theme (e.g., a boss about denial should force the player to face something rather than avoid it)

The Grove has no combat. The planet layer will have combat. When designing planet combat: lead with the intention, then build the numbers.

## 6.2 Crafting Design Principle

> **Crafting reflects the world's culture and resources.**

What a world lets you craft tells you what it values. The Grove would craft: herbal remedies, teas, Pulse-enhancing preparations, tools for tending. The planet will craft: shelter, tools for survival, infrastructure.

Recipes should be discoverable in context — found in journals, taught by characters, figured out by experimentation — not just purchased from a vendor menu.

**Crafting loop:** world activity (foraging, exploring) → raw materials → crafting → items that enable more world activity or support other players.

## 6.3 Economy Design Principle

> **Economy follows need, not arbitrary scarcity.**

Resources should be abundant enough that the game doesn't feel like grinding, but scarce enough that trade is meaningful. The right balance: a solo player can sustain themselves, but a player who specializes and trades can thrive significantly more.

In the Grove: no economy. The community shares. On the planet: player-driven economy emerges from diverse ship origins (forest ship people forage well, ice ship people build well, etc.).

---

# 7. Balance Layer — Numbers Last

> **Balance to the narrative pacing, not to abstract difficulty curves.**

Numbers are designed last, after everything else is working at the design level. The right questions for balancing:

- Does this fight take as long as the story needs it to? (Not: is the DPS tuned correctly?)
- Does this crafting timer feel like meaningful waiting or frustrating blocking?
- Does the skill progression feel like growth or grind?

**Specific rules:**
- Never balance in isolation — balance in the context of the player's skill set and story progress
- Timers (crafting, cooldowns) should match real-world rhythms — a tea that takes 8 hours to brew is a session-between-sessions activity, not friction
- If balance changes break the story feel, the story feel wins

---

# 8. How the Layers Interact

The key is that each layer makes the adjacent layers stronger, not independent of them.

**Narrative → World:** The story arc determines what zones exist and in what order. The Grove's physical spaces (the Deep, the Edge, the Heartroot) exist because the 108-beat narrative needs them at specific moments.

**World → Skills:** The spaces players inhabit naturally teach them skills. A forest teaches foraging. A restricted area teaches stealth. The world's geography is also the skill curriculum.

**Skills → Systems:** The skills players have determine what combat, crafting, and economic options are available. A player who focused on Meditate and Forage has a different system experience than one who focused on combat skills. Both are valid paths.

**Systems → Balance:** The specific system choices (which skills, which crafting paths) determine what needs to be numerically tuned. Balance follows the system, not the other way around.

**The spiral:** Story unlocks world, world teaches skills, skills enable systems, systems create stories worth telling.

---

# 9. Skill Gating Philosophy

## 9.1 The Rule

> **Gate the narrative beat, not the movement. Never say "you need skill X." Say "something is in the way" — and put the solution nearby.**

Players can always go anywhere. But certain story beats only trigger if the player has the relevant skill. And the game must have offered the skill before the block appears.

**Good gating:** Brennan patrols the path to the Edge (beat 61). If the player doesn't have Sneak, Brennan sees them and turns them back. But Kira is nearby and will teach Sneak if asked — and the player has been with Kira enough to know she moves quietly.

**Bad gating:** "You need Sneak level 3 to proceed." — arbitrary, frustrating, non-diegetic.

## 9.2 Skill Gates in the Grove

| Beat | Skill Required | How Player Gets It | What Happens Without It |
|------|---------------|-------------------|-------------------------|
| 37 (Pulse sensing) | `meditate` level 1 | Thera's teaching session (beat 35) | Thera says "you're not ready yet — practice first" |
| 61 (Past Brennan) | `sneak` level 1 | Kira teaches it (available from early Act 2) | Brennan spots you; Kira offers to teach |
| 66 (Rootsong screams) | `meditate` level 2 | Natural progression from beat 35 | The sensation is muted; Thera helps you open up |

## 9.3 Planet Catch-Up

Planet trainers teach all Grove skills. But with texture:
- Higher resource cost than Grove learning (time or materials, not punitive)
- NPCs acknowledge the gap: *"You never learned to forage on your ship? Which grove did you come from?"*
- This makes Grove learning feel like a gift, not a requirement — players who had it feel fortunate, not superior

---

# 10. Onboarding Design — The Invisible Tutorial

## 10.1 The Prime Directive

> **The Grove is the tutorial. The player must never know they're in one.**

The worst tutorials interrupt the experience to explain it. The best tutorials ARE the experience — every mechanic introduced by a story situation that *requires* it, not one that explains it.

A new player should finish the Grove feeling: "That was a beautiful story." Not: "That was a good tutorial."

## 10.2 Show, Don't Tell — The MUD Version

Text MUDs have a specific challenge: the interface is not immediately obvious to new players. The Grove handles this by making confusion *narratively appropriate*. The player wakes up disoriented. Of course they don't know what to do — neither does their character. The world teaches them by needing things from them.

**Rules:**
- No UI popups, no tip boxes, no "press X to do Y"
- All instruction comes from characters in the world ("come to the light," "try touching it")
- Failures are story events, not error messages ("Brennan sees you — he turns you back")
- Every mechanic is introduced in a low-stakes context before it's required in a high-stakes one

## 10.3 The Concept Map

Every game mechanic is taught by a specific story beat. Design these beats to introduce the mechanic gently, then reinforce it with increasing stakes.

| Game Concept | Story Beat That Teaches It | Reinforcement Beat |
|---|---|---|
| Navigation, `look`, room reading | Beat 1–3: Wake up in dark/confusion, Thera says "follow my voice to the light" | Beat 7: First view of the Heartwood — reward for learning to move |
| `examine` | Beat 5–8: Healing grove full of curiosity triggers — herbs, Thera's pendant, strange tools | Beat 20: The humming stone rewards examination with a melody |
| Talking to NPCs, dialogue choices | Beat 3–6: Thera asks you questions, you pick responses, it feels like conversation | Beat 13: Cook gossips — discovery through casual dialogue |
| Quest tracking, objectives | Beat 12: Earning your place — assigned work, first objective appears naturally in context | Beat 17: The Blight task — multi-objective quest |
| Inventory, picking up items | Beat 16: Tomas's trowel — first item with examine text and history | Beat 40: Finding Yara's journal — an item that changes everything |
| Foraging + resource gathering | Early Act 1: Working alongside Tenders — they forage, you join, mechanic emerges from context | Beat 43: Kira asks you to help gather for a specific purpose |
| Crafting | Mid Act 1: Thera makes a remedy, you help — recipe appears in hands, not a menu | Side quest: Full crafting sequence to solve a problem |
| Skills exist + how to train | Beat 35: Thera teaches Meditate — a scene, not a tooltip | Beat 38: Using Meditate at the Lira statue — it does something different here |
| Skill gating (soft) | Beat 37: Can't sense the Pulse — "you need to quiet your mind first, let me show you again" | Beat 66: Stronger version requires Meditate level 2 |
| Danger zones + world rules | Beat 28–32: Edge sickness — a narrative event, not a death screen. Thera rescues you. | Later: The Thinning has progressive danger as you go deeper |
| Stealth mechanics | Pre-beat 61: Kira shows you. "Watch how I move. Like this." Hands-on in a safe space. | Beat 61: Sneaking past Brennan — stakes are real |
| The world has hidden depth | Beats 17–22: Flickering sky, Brennan's lies, the humming stone — seeds of the bigger truth | Pays off in Act 3 |

## 10.4 Pacing the Introduction of Complexity

Complexity is introduced in waves, not all at once. Each wave should feel like a natural expansion of what the player already knows.

```
Wave 1 (Beats 1-12): Navigation, look, talk, basic interaction
         → Player feels: "I understand this world"

Wave 2 (Beats 12-27): Inventory, foraging, quests, crafting basics
         → Player feels: "I have things to do and can do them"

Wave 3 (Beats 28-42): Skills, Pulse mechanic, skill gating, stealth
         → Player feels: "I'm growing, the world is opening up"

Wave 4 (Beats 43-67): Multi-step quest chains, world secrets, stakes
         → Player feels: "I'm invested. I understand how this all fits together"

Wave 5 (Beats 68-108): Full system fluency, emotional payoff, landing
         → Player feels: "I'm ready for whatever comes next"
```

## 10.5 The Landing State

By the time the player lands on the planet, they should have:

**Mechanically:**
- Comfortable with navigation, examination, dialogue
- 4–6 skills at level 2–3
- Completed at least 2 crafting recipes
- Understand quest tracking and multi-step objectives
- A sense of their character lean (healer? explorer? crafter?)

**Emotionally:**
- Grieving (Thera's sacrifice is fresh)
- Motivated (they have a reason to build something)
- Curious, not overwhelmed
- A natural "next step" (find others from different ships, build together)

The planet should feel like a place they're ready for — not a place they were thrown into.

---

# 11. XP and Leveling Philosophy

## 11.1 The Core Rule

> **XP is a side effect of engagement, not the goal of it.**

Players should never grind for XP. XP should flow naturally from doing things they'd want to do anyway — exploring, talking, crafting, witnessing story moments. If a player is grinding for XP, the content has failed them.

## 11.2 XP Sources (Diegetic)

All XP sources should feel like natural consequences of living in the world:

| Source | XP Weight | Notes |
|--------|-----------|-------|
| First time in a new room | Small | Exploration reward — every room once |
| Completing a dialogue tree | Small–Medium | Depends on conversation depth |
| Story beat witnessed | Medium–Large | Scales with beat significance — bigger reveals give more |
| Successful skill use in context | Feeds skill XP, small char XP | Meditating gives Meditate XP + small character XP |
| Foraging / crafting completion | Small–Medium | Consistent background progress |
| Examining unusual or hidden details | Small bonus | Rewards curiosity |
| Quest completion | Medium–Large | Scales with quest length and stakes |

**Never give XP for:**
- Killing things in the Grove (there is no combat)
- Repeating the same action mechanically
- Mandatory story events that the player couldn't avoid

## 11.3 The Leveling Curve

The Grove's leveling curve is front-loaded: fast early, steady middle, meaningful late.

```
Levels 1–5   | First hour of play  | Very fast — everything gives XP, momentum is instant
Levels 6–10  | Acts 1–2 (3–6 hrs)  | Steady — story beats and skill use drive it
Levels 11–15 | Acts 3–4 (2–4 hrs)  | Significant beats, bigger rewards per moment
Landing      | ~Level 12–15        | Skilled, characterized, ready for the planet
```

**Design target:** A player who engages with the story (doesn't skip dialogue, explores rooms, tries crafting) should level 1–3 times faster than they expect. The Grove should feel generous. Players arriving on the planet should feel ahead, not behind.

## 11.4 Skill XP vs. Character XP

Two separate progressions run in parallel:

**Character XP** → character level → increases base stats, unlocks planet-layer content gates
**Skill XP** → individual skill levels → increases specific skill effectiveness

Skill XP comes primarily from *using* the skill in context. You get Meditate XP by meditating meaningfully (during the Pulse sessions, at the Lira statue, in the Heartroot) — not by spam-meditating in a corner. Context-appropriate use should be rewarded significantly more than mechanical repetition.

## 11.5 What Leveling Feels Like

Every level up should feel like something changed — not just a number. Small mechanical benefits + a descriptive flourish:

- "Your footing feels more certain in the forest. The paths seem clearer."
- "When you quiet your mind now, the Pulse comes more easily. Thera notices."
- "You move through the undergrowth without thinking. Your hands know what to look for."

The level up is a story moment, not a stat screen.

---

# 12. Design Checklist

Use this when designing any piece of content — a quest, a zone, a combat encounter, a crafting recipe, or an onboarding beat.

### Narrative Check
- [ ] Does this have a hook, complication, resolution, and world-truth?
- [ ] Is foreshadowing planted at least 20 beats before payoff?
- [ ] Does this connect to the zone's thesis?
- [ ] Does the surface action have a subtext layer?

### World Check
- [ ] Does every room have a first impression, atmosphere layer, and one historical detail?
- [ ] If this gates access, is the solution nearby and diegetic?
- [ ] Do description variants exist for before/after key revelations?

### Skill Check
- [ ] Is there a canonical learning context (a character, a situation)?
- [ ] If this skill gates a beat, has the player been offered the skill first?
- [ ] Is the gate expressed as a world obstacle, not a system message?

### Systems Check
- [ ] For combat: what is this fight *about* thematically?
- [ ] For crafting: does this recipe reflect the world's culture and resources?
- [ ] Is there a non-mechanical path if the player has invested in social/knowledge skills?

### Balance Check
- [ ] Does the timing feel like the story needs it to? (Not: is the number correct?)
- [ ] Are timers aligned with real-world session rhythms?
- [ ] Has this been balanced in context of the player's full skill set, not in isolation?

### Onboarding Check (Grove content only)
- [ ] Is a new mechanic being introduced? Is it first seen in a low-stakes context?
- [ ] Is the instruction diegetic? (A character says it, the world shows it — no tooltips)
- [ ] If this beat introduces a skill gate, has the skill been made available earlier in the same session?
- [ ] Does failure feel like a story event, not an error message?
- [ ] Does completing this beat leave the player feeling more competent, not more confused?

### XP Check
- [ ] Does this content have at least one natural XP source (exploration, dialogue, skill use, quest)?
- [ ] Is any XP source requiring repetitive grinding? If yes, redesign.
- [ ] For skill use: is context-appropriate use rewarded more than mechanical spam?
- [ ] Does any level-up moment have a descriptive flourish (not just a number)?
