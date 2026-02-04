---
name: narrative-audit
description: |
  Audit narrative designs for consistency, emotional craft, and blockbuster quality.
  Use when: (1) reviewing world/storyline designs before implementation, (2) user asks
  to check story quality, (3) after completing a world design document, (4) debugging
  why a story feels "off." Covers thread lifecycle, causality validation, showing vs
  telling, and emotional architecture.
author: Claude Code
version: 1.0.0
date: 2026-02-01
triggers:
  - reviewing story design
  - narrative feels inconsistent
  - checking story quality
  - world design audit
---

# Narrative Audit Skill

## When to Use

Run a narrative audit when:
- A world design document is complete (before implementation)
- Story elements feel disconnected or "off"
- User asks to check narrative quality
- Preparing content for implementation

## MUD Device Reference

Before auditing, know what devices are available:

### Static Devices (Defined in YAML)
| Device | Purpose | Examples |
|--------|---------|----------|
| **Room** | Space with description, exits | Heartwood clearing, The Deep |
| **NPC Prototype** | Character template | Thera the healer, Elder Maren |
| **Item Prototype** | Object template | Thera's pendant, humming stone |
| **Dialogue Tree** | Branching conversation | Teaching sessions, confessions |
| **Quest** | Structured objectives | Find the journal, reach the Edge |

### Dynamic Devices (Powered by Scripts)
| Device | Purpose | Examples |
|--------|---------|----------|
| **Behavior Script** | NPC patterns, schedules | Thera's daily routine, Brennan's patrols |
| **Event Script** | Triggered occurrences | Council gathering, memorial service |
| **Atmospheric Script** | Environmental effects | Pulse changes, Blight spreading |
| **World-Mod Script** | Room/object changes | Room description swap, item spawn |
| **Trigger Script** | Conditional actions | On enter room, on examine item |

### Script Capabilities
Scripts can:
- Spawn/despawn NPCs, items, containers
- Change room descriptions dynamically
- Create temporary rooms (dreams, visions)
- Broadcast messages to zones/players
- Track and respond to flags/state
- Schedule future events
- Modify NPC behavior in real-time

**Rule**: If the narrative needs something DYNAMIC, it needs a script.

---

## The Seven Audit Categories

### 1. Thread Lifecycle Audit

Every narrative thread must have: **Plant → Develop → Payoff**

| Thread | Planted (Beat) | Developed (Beats) | Paid Off (Beat) | Status |
|--------|----------------|-------------------|-----------------|--------|
| | | | | ✅/⚠️/❌ |

**Status Key:**
- ✅ Complete: Full lifecycle with 3+ touchpoints
- ⚠️ Partial: Missing development OR weak payoff
- ❌ Orphaned: Planted but never paid off, OR paid off without planting

**Common Issues:**
- Mystery planted in Act 1, forgotten by Act 3
- Emotional payoff without proper setup
- Side character arcs that vanish

### 2. Causality Validation

For every major event, verify:

| Question | Must Have Answer |
|----------|------------------|
| Why NOW? | Timing justification (not just "plot needs it") |
| Why THIS character? | Selection logic |
| What determines success/failure? | Clear criteria |
| Why didn't earlier attempts succeed? | If applicable |

**Red Flags:**
- Crisis happens "because it's time for Act 3"
- Character chosen "because they're the protagonist"
- Success/failure feels arbitrary

### 3. Showing vs Telling (MUD Format)

**Telling (avoid):**
> "Thera seemed sad about her future."

**Showing (prefer):**
> Room: *The flowers lean toward her. You are almost certain you are not imagining it.*
> Emote: *Thera closes her eyes. Her breathing slows to match the Pulse.*
> Dialogue: "The Rootsong is loud there." *(She does not answer the actual question.)*

**MUD Showing Techniques:**
- Room descriptions that create mood through sensory detail
- Emotes that reveal character through behavior
- Dialogue subtext (what is NOT said)
- Environmental responses to story events

### 4. Dialogue vs Cutscene Balance

| Use Dialogue For | Use Cutscene For |
|------------------|------------------|
| Character conversations | Major plot reveals |
| Building relationships | Transitions (time, location) |
| Exposition and backstory | Climactic moments |
| Player choices that matter | Moments requiring precise pacing |

**Rule:** If the player could reasonably respond, use dialogue. Cutscenes are for moments that must unfold exactly as written.

**Target Ratio:** 90% dialogue, 10% cutscene (approximately)

### 5. Emotional Architecture

Check emotional pacing:

| Element | Questions |
|---------|-----------|
| **Breathing room** | Are there quiet moments between intense scenes? |
| **Contrast** | Does joy precede grief (to make grief hit harder)? |
| **Earned catharsis** | Is the emotional payoff set up properly? |
| **Transformation** | Does grief transform into something else (not just resolve)? |

**The Ordinary World Test:**
- Do we spend enough time in normalcy before crisis?
- Do players know what they are losing?
- Is there a concrete image of "the life that could have been"?

### 6. Character Consistency

| Check | Questions |
|-------|-----------|
| **Contradictions** | Do established traits match behavior throughout? |
| **Dimensionality** | Does each major character have internal conflict? |
| **Voice** | Does each character speak distinctly? |
| **Lifespans** | For long timelines, is preservation/longevity explained? |

## Quick Audit Checklist

Run through before marking design complete:

- [ ] All threads have complete lifecycle (plant → develop → payoff)
- [ ] No character arcs locked behind optional content
- [ ] All causality questions answered
- [ ] "Why NOW" is clear for the crisis
- [ ] Showing outweighs telling
- [ ] Cutscenes used sparingly (major moments only)
- [ ] Emotional beats have breathing room
- [ ] Character voices are distinct
- [ ] Timeline/lifespans are consistent

## Common Narrative Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| **Orphaned thread** | Mystery planted, never resolved | Add payoff OR remove plant |
| **Arbitrary timing** | Crisis happens "when plot needs it" | Add in-world justification |
| **Engineered feelings** | Love/bond feels forced | Clarify authentic vs manipulated |
| **Telling emotions** | "She was sad" | Replace with behavior/environment |
| **Cutscene overuse** | Player passive too long | Convert to dialogue with choices |
| **Missing ordinary world** | Stakes feel abstract | Add scenes of normal life first |
| **Lifespan gaps** | Character alive too long | Add preservation explanation |

## Audit Report Template

```markdown
## Narrative Audit: [World Name]

### Thread Lifecycle
- ✅ Complete: [list]
- ⚠️ Partial: [list with issues]
- ❌ Orphaned: [list]

### Causality Issues
- [List any "why now/why this character" gaps]

### Showing vs Telling
- [Specific scenes that need rewriting]

### Dialogue/Cutscene Balance
- Current ratio: X% dialogue, Y% cutscene
- Scenes to convert: [list]

### Emotional Architecture
- [Pacing issues]
- [Missing breathing room]

### Character Issues
- [Consistency problems]
- [Voice distinctiveness]

### Priority Fixes
1. [High priority]
2. [Medium priority]
3. [Low priority]
```

## References

- World Design Template: `docs/templates/WORLD-DESIGN-TEMPLATE.md`
- Example audit: See Seedship Forest design session
- Writing conventions: See "Narrative Writing Style" in CLAUDE.md
