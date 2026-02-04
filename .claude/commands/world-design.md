# World Design

Collaborative world design for creating story-rich game worlds with encoded philosophy.

## Usage

```
/world-design [world-name]
```

## Overview

This skill guides the creation of complete world design documents that:
- Encode real-world philosophy without explicit terminology
- Create rich, interconnected narratives
- Produce implementation-ready specifications

## The Process

| Phase | Focus | Time |
|-------|-------|------|
| 1. Core Concept | Premise, mystery, questions | 30 min |
| 2. Philosophy Layer | Source concepts, progression | 1 hour |
| 3. In-World Translation | Terminology mapping, failed examples | 1 hour |
| 4. Worldbuilding & Characters | World, people, character arcs | 2 hours |
| 5. Story Beats | 108 beats, emotional arc | 3-4 hours |
| 6. Woven Threads | Hidden stories, echoes, mirrors | 2 hours |
| 7. Conflict Map | Major/micro conflicts, resolutions | 1 hour |
| 8. Implementation Bridge | Zones, NPCs, quests, items | 1 hour |

## Starting a New World

```
/world-design seedship-forest
```

This creates a new design document at:
```
docs/game-design/[WORLD-NAME]-DESIGN.md
```

Using the template from:
```
docs/templates/WORLD-DESIGN-TEMPLATE.md
```

## Continuing Work

```
/world-design
```

I'll ask which world you're working on and resume from where we left off.

## Example: Seedship Forest

The Seedship Forest design document demonstrates all patterns:
- **Philosophy**: Buddhist Lamrim (three capacities, emptiness, bodhicitta)
- **Translation**: "Hollow Root" (emptiness), "Carrying Heart" (bodhicitta), "Three Roots" (progression)
- **108 Beats**: Complete story structure with 4 acts + grief/joy epilogue
- **Woven Threads**: 6 hidden stories, artifacts, echoing phrases, mirror moments
- **Conflict Map**: 7 major conflicts with full escalation/resolution

See: `docs/game-design/SEEDSHIP-FOREST-WORLD-DESIGN.md`

## Key Principles

### Philosophy Encoding
- Never use explicit terminology (no "Buddhism", "emptiness", "bodhicitta")
- Create in-world language that feels organic to the setting
- Show, don't tell - encode teachings in story and character

### The Failed Examples Pattern
Every teaching benefits from showing incomplete understanding:
- Character with A but not B → failed
- Character with B but not A → failed
- Main character with both → success

### The Grief-to-Joy Pattern
For sacrificial narratives:
1. Player experiences genuine, gut-wrenching grief FIRST
2. Joy comes later as a REVELATION that transforms the grief
3. Never shortcut the grief - it must be earned

### Thread Weaving
Every detail should pay off:
- Plant early (first third)
- Develop (middle)
- Pay off (final third)
- Minimum 3 touchpoints per thread

## Output

A complete design document with:
- [ ] Philosophy → lore terminology mapping
- [ ] All major character arcs
- [ ] 108 beats (or meaningful equivalent)
- [ ] Woven threads with touchpoints mapped
- [ ] Conflict intensity tracked across story
- [ ] Implementation checklist (zones, NPCs, quests, items)

## Skills Used

This command uses:
- `world-design` skill (collaboration guide)
- `content-creation` skill (for implementation phase)
- `quest-validation` skill (for content verification)

## Files

- **Template**: `docs/templates/WORLD-DESIGN-TEMPLATE.md`
- **Example**: `docs/game-design/SEEDSHIP-FOREST-WORLD-DESIGN.md`
- **Skill**: `.claude/skills/world-design.md`
