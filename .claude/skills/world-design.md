---
name: world-design
description: |
  Collaborative world design skill for creating story-rich game worlds with encoded philosophy.
  Use when: (1) starting a new world/storyline from scratch, (2) user says "/world-design",
  (3) designing narrative content that needs philosophical depth, (4) creating a new starting area.
  Guides through the full design process: philosophy → lore → characters → beats → implementation.
author: Claude Code
version: 1.0.0
date: 2026-01-31
triggers:
  - /world-design
  - creating a new world
  - designing a starting area
  - encoding philosophy into gameplay
---

# World Design Skill

## Purpose

Guide collaborative creation of story-rich game worlds that encode real-world philosophy without explicit terminology. The result is a complete design document ready for implementation.

## The Process

World design follows seven phases. Each phase builds on the previous. Never skip ahead without completing earlier phases.

### Phase 1: Core Concept (30 min)

**Goal**: Establish the premise, the hook, and the central mystery.

**Questions to ask**:
1. "What's the one-sentence premise?" (e.g., "A forest that's secretly a spaceship")
2. "What appears true at first? What's actually true?"
3. "What's the central mystery players uncover?"
4. "What are the 3 questions this world explores?"

**Deliverable**: Section 1 of template filled out.

### Phase 2: Philosophy Layer (1 hour)

**Goal**: Define what real-world concepts we're encoding and why.

**Questions to ask**:
1. "What philosophy, spiritual tradition, or framework do you want to teach?"
2. "What are the 3-5 core concepts from that tradition?"
3. "What should players FEEL by the end, without hearing the terminology?"
4. "What's the progression of understanding?"

**Research**: If the user mentions a tradition (Buddhism, Stoicism, etc.), research it to understand the structure:
- What are the stages/levels of development?
- What are the key practices?
- What are common misunderstandings to avoid?
- What's the "complete" realization vs. partial?

**Deliverable**: Section 2 of template filled out.

### Phase 3: In-World Translation (1 hour)

**Goal**: Map philosophy concepts to lore terminology.

**Key principle**: Every concept needs an in-world name that feels organic to the setting.

**Questions to ask**:
1. "For [philosophy concept], what would people in this world call it?"
2. "What rituals or practices encode these teachings?"
3. "Who are the 'failed examples' that show incomplete understanding?"

**Pattern - The Failed Examples**:
Every teaching benefits from showing what happens when it's incomplete:
- Character who had A but not B → failed
- Character who had B but not A → failed
- Character who had both but chose wrong → different outcome
- Main character who has both and chooses correctly → success

This teaches without preaching.

**Deliverable**: Section 3 of template filled out.

### Phase 4: Worldbuilding & Characters (2 hours)

**Goal**: Build the world and cast of characters.

**Questions to ask**:
1. "What is this place physically? How old? How big?"
2. "Who lives here? What do they call themselves?"
3. "What do they believe? What don't they know?"
4. "Who is the companion character? What's their arc?"
5. "Who are the supporting cast? What do they hide?"

**Character Arc Pattern**:
Map each major character's arc to the philosophy progression:
| Stage | What They Show | What They're Learning | Philosophy Parallel |
|-------|----------------|----------------------|---------------------|

**Deliverable**: Sections 4 and 5 of template filled out.

### Phase 5: Story Beats (3-4 hours)

**Goal**: Create the complete beat structure.

**The 108 Beat Pattern**:
- 108 is a sacred number (Buddhist mala beads) - use it if appropriate
- Otherwise use meaningful numbers from the source philosophy
- Each beat = one scene, moment, or revelation

**Structure**:
- Act 1 (Beats 1-27): Finding Ground - player arrives, learns the world
- Act 2 (Beats 28-54): Deepening - relationships form, mystery grows
- Act 3 (Beats 55-81): Revelation - truth emerges, stakes rise
- Act 4 (Beats 82-100): Crisis - the choice, the sacrifice
- Epilogue (Beats 101-108): Grief → Joy transformation

**For each beat, define**:
- What happens (action)
- What player learns (information)
- What player feels (emotion)
- What threads connect here (weaving)

**Deliverable**: Section 6 of template filled out.

### Phase 6: Woven Threads (2 hours)

**Goal**: Create the interconnected web that makes the story feel alive.

**The Six Thread Types**:
1. **Hidden Stories**: Parallel narratives revealed gradually
2. **Physical Artifacts**: Objects that carry meaning across the story
3. **Echoing Phrases**: Lines said once, repeated later with new meaning
4. **Visual/Sensory Echoes**: Details that recur meaningfully
5. **Mirror Moments**: Scenes that rhyme with each other
6. **Character Revelations**: Backstories revealed in stages

**For each thread**:
- When is it planted? (early beat)
- When is it developed? (middle beats)
- When does it pay off? (later beat)

**Quality check**: Every thread should have at least 3 touchpoints.

**Deliverable**: Section 7 of template filled out.

### Phase 7: Conflict Map (1 hour)

**Goal**: Ensure the story has tension throughout.

**Conflict Types**:
- **Interpersonal**: Character vs. character
- **Internal**: Character vs. self
- **External**: Character vs. world/circumstance
- **Philosophical**: Character vs. belief/meaning

**For each major conflict**:
1. Setup: Where does tension first appear?
2. Escalation: How does it intensify?
3. Crisis: The breaking point
4. Resolution: How does it resolve?

**Conflict Intensity Map**:
Track tension level (1-10) across beat ranges. Ensure:
- Rising action overall
- Some valleys for emotional rest
- Peak at beats 90-100
- Transformation (not just release) at 105-108

**Micro-conflicts**: Add scene-level tensions for beats that feel flat.

**Deliverable**: Section 8 of template filled out.

### Phase 8: Implementation Bridge (1 hour)

**Goal**: Translate design into Loka implementation structure.

**Map to Loka content**:
- Zones → YAML zone files
- NPCs → Prototype files
- Quests → Quest YAML
- Dialogues → Dialogue trees
- Items → Item prototypes
- Scripts → Behavior scripts

**Create checklist** of all content to implement.

**Deliverable**: Section 9 of template filled out.

### Phase 9: Validation & Audit (1 hour)

**Goal**: Catch inconsistencies before implementation.

**Run these checks**:

1. **Thread Lifecycle Audit**:
   - Does every planted thread have development AND payoff?
   - Does every payoff have a plant?
   - Mark: ✅ Complete / ⚠️ Partial / ❌ Orphaned

2. **Causality Validation**:
   - Why is the crisis happening NOW?
   - Why this character for key roles?
   - What determines success vs. failure?

3. **Character Consistency**:
   - Do established traits match behavior throughout?
   - Are lifespans justified (for long-timeline stories)?

4. **Side Quest Integration**:
   - Is any critical arc locked behind optional content?
   - Add main story beats for essential emotional journeys.

5. **Philosophy Failure Modes**:
   - Is it clear WHY each failed example failed?
   - Can players understand the teaching from the examples?

**Common Issues to Check**:
- Engineered feelings vs. authentic emotions (clarify)
- Timeline gaps ("why now?")
- Preservation/longevity without explanation
- Planted threads that vanish
- Side quest dependency for main character arcs

**Deliverable**: Section 10 of template filled out, all high-priority issues resolved.

---

## The Collaboration Style

### Ask, Don't Assume
Always ask the user to make creative decisions. Offer options with tradeoffs, but let them choose.

### Research When Needed
If the user mentions a philosophy you're not expert in:
1. Use WebSearch to research the key concepts
2. Understand the progression/stages
3. Identify common misunderstandings
4. Bring specific questions back to the user

### Build on What's There
Reference earlier decisions when making new ones. Connect everything.

### Show the Weaving
When filling out beat details, explicitly show how threads connect:
"This is where the pendant (planted in Beat 18) gets developed, and connects to Yara's story (Hidden Story 2)."

### Emotional Check-ins
Periodically ask: "How should the player FEEL at this point?"

---

## Anti-Patterns to Avoid

| Don't | Do Instead |
|-------|------------|
| Lecture about the philosophy | Encode it in story and character |
| Use explicit terminology | Create in-world language |
| Have the companion explain things | Let player discover through experience |
| Front-load exposition | Reveal gradually through beats |
| Make the "right" choice obvious | Present genuine dilemmas |
| Skip the grief | Let players mourn before joy |
| Rush to resolution | Earn every emotional beat |

---

## Templates & Files

- **Template location**: `docs/templates/WORLD-DESIGN-TEMPLATE.md`
- **Create new design doc**: Copy template to `docs/game-design/[WORLD-NAME]-DESIGN.md`

## Starting a Session

When user invokes `/world-design` or requests world design:

1. **Ask if continuing or starting fresh**:
   "Are you continuing work on an existing world, or starting a new one?"

2. **If new**:
   - Copy template to new file
   - Start with Phase 1 questions

3. **If continuing**:
   - Read existing design doc
   - Identify which phase we're in
   - Resume from there

4. **Set expectations**:
   "World design is collaborative and takes multiple sessions. Today let's focus on [Phase X]. We'll [specific goal]."

---

## Quality Checklist

Before marking design complete:

- [ ] Philosophy encoded without explicit terminology
- [ ] In-world language feels organic to setting
- [ ] All major characters have arcs mapped to philosophy
- [ ] 108 beats (or equivalent) fully defined
- [ ] Every thread has 3+ touchpoints
- [ ] Conflicts have full escalation → crisis → resolution
- [ ] Emotional arc has valleys AND peaks
- [ ] Grief is EARNED before joy
- [ ] Implementation bridge complete
- [ ] All content types identified for creation

---

## References

- Example: `docs/game-design/SEEDSHIP-FOREST-WORLD-DESIGN.md`
- Template: `docs/templates/WORLD-DESIGN-TEMPLATE.md`
- Content scaffolding: `mix loka.new [type] [name]`
