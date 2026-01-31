# Long-Term Stability in LLM-Assisted Development

> **Purpose**: Strategic principles for maintaining codebase stability while using LLMs for rapid development.
> **Audience**: Future Claude sessions, human developers
> **Last Updated**: 2026-01-31

---

## The Core Challenge

LLM-assisted development creates a velocity/stability tension:

| Benefit | Risk |
|---------|------|
| Generate code faster | Code outpaces review |
| Instant context on any topic | Context resets each session |
| Parallel exploration | Knowledge fragments across conversations |
| Rapid iteration | Documentation drifts |

**Without discipline**: Accelerating chaos instead of accelerating velocity.

---

## The Compound Engineering Solution

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPOUND LOOP                            │
│                                                             │
│   Work → Extract Knowledge → Feed Back → Better Work        │
│                                                             │
│   Each session makes the next session easier                │
└─────────────────────────────────────────────────────────────┘
```

### Principle: Make Tomorrow's Claude Smarter Than Today's

Every session should deposit knowledge that future sessions can withdraw.

---

## Knowledge Architecture

### Layer Model

| Layer | Purpose | Loads When | Token Cost |
|-------|---------|------------|------------|
| **CLAUDE.md** | Essential patterns | Every session | High (always) |
| **Skills** | Contextual patterns | Auto by relevance | Medium (on demand) |
| **Rules** | Path-based context | Auto by file path | Medium (on demand) |
| **Docs** | Deep reference | Explicit request | Low (rarely) |

### Token Budget Awareness

CLAUDE.md loads every session. Every line costs tokens.

| Content Type | Belongs In | Why |
|--------------|------------|-----|
| Architecture overview | CLAUDE.md | Always needed |
| Quick commands | CLAUDE.md | Frequent use |
| Detailed gotchas | Skills | Only when relevant |
| Full API specs | docs/ | Reference only |
| Decision history | docs/decisions/ | Rarely needed |

### Skills > Inline Documentation

**Anti-pattern**:
```markdown
# CLAUDE.md (loads every session)
### Detailed Gotcha Section
[50 lines of specific fix]
```

**Pattern**:
```markdown
# CLAUDE.md
| Issue | Quick Fix | Full Pattern |
|-------|-----------|--------------|
| WebGL banding | Add `unshaded` | `.claude/skills/godot-webgl-fix.md` |
```

---

## Validation Gates

```
Pre-Commit Hook → Content Validation → Tests → Deploy
     ↓                    ↓              ↓
  Blocks bad            Catches        Catches
  commits early         YAML bugs      logic bugs
```

### Current Gates (Loka)

| Gate | Trigger | Purpose |
|------|---------|---------|
| Pre-commit validation | `git commit` | Block invalid content |
| Post-edit formatting | File save | Consistent code style |
| Content validators | Manual/CI | YAML structure correct |
| ChannelBot tests | CI | User flows work |
| Unit tests | CI | Logic correct |

---

## Explicit Layering

```
YAML Content (builders can edit)
      ↓ uses
Framework Code (adds capabilities)
      ↓ uses
Engine Code (rarely touched)
      ↓ uses
Platform (never touched)
```

### Why Layers Matter for LLMs

Clear boundaries prevent LLMs from making changes at the wrong layer. Decision trees guide placement:

1. **Is it content-specific?** → YAML/Scripts
2. **Is it a reusable system?** → Framework
3. **Does it change HOW things work?** → Engine (rare)

---

## Maintenance Cadence

| Frequency | Activity | Owner |
|-----------|----------|-------|
| **Every session** | Compound check - extract learnings | Claude (automated) |
| **Weekly** | Review CLAUDE.md for drift | Human |
| **Monthly** | Audit skills for staleness | Human/Claude |
| **Quarterly** | Full documentation review | Human/Claude |
| **Per release** | Update decision records | Human |

### Session-End Checklist

After significant work, ask:

1. **What was non-obvious?** → Create skill
2. **What changed architecturally?** → Update docs
3. **What broke unexpectedly?** → Add test
4. **What will recur?** → Document pattern

---

## CLAUDE.md Health Metrics

| Metric | Healthy | Warning | Action |
|--------|---------|---------|--------|
| Line count | <500 | >800 | Move details to skills |
| Has TOC | Yes | No | Add navigation |
| Code examples | <20 lines each | >30 lines | Point to full examples |
| Duplicate content | None | Any | Consolidate |

---

## Skill Hygiene

### Directory Structure

```
.claude/skills/
├── [active skills]    # Current patterns
├── archived/          # Historical (preserved for context)
└── [skill-name]/
    ├── SKILL.md       # Main content
    └── supporting.md  # Optional deep dives
```

### Skill Quality Checklist

- [ ] Clear trigger conditions documented
- [ ] Created/verified date included
- [ ] Specific enough to be actionable
- [ ] General enough to be reusable
- [ ] Examples are verified working
- [ ] No duplicate of existing skill

### Staleness Signals

| Signal | Action |
|--------|--------|
| References archived tech | Archive skill |
| No longer matches codebase | Update or archive |
| Duplicates another skill | Consolidate |
| Never activates | Consider removing |

---

## Archive Don't Delete

Historical knowledge has value:
- Explains why current approach was chosen
- Prevents re-learning old lessons
- Provides context for future decisions

```
.claude/skills/archived/
├── bevy-0-15-patterns/     # Explains Godot migration
├── react-native-patterns/  # Historical mobile approach
```

---

## Decision Records

For architectural decisions, create records:

```markdown
# Decision: [Title]

**Date**: YYYY-MM-DD
**Status**: Accepted | Superseded | Deprecated

## Context
Why we needed to decide this.

## Decision
What we chose and why.

## Consequences
What this means for future work.
```

**Location**: `docs/decisions/YYYY-MM-DD-decision-title.md`

---

## Anti-Patterns to Avoid

### 1. Context Dumping
❌ Putting everything in CLAUDE.md "just in case"
✅ Lean CLAUDE.md + rich skills that auto-load

### 2. Knowledge Hoarding
❌ Solving problems without documenting
✅ Every non-obvious solution becomes a skill

### 3. Stale Documentation
❌ Docs that reference old tech/patterns
✅ Regular audits + archive discipline

### 4. Duplicate Sources of Truth
❌ Same info in CLAUDE.md, skills, AND docs
✅ Single source, referenced from others

### 5. Over-Extraction
❌ Creating skills for trivial fixes
✅ Skills for patterns that took >10 min to discover

---

## Success Indicators

Compound engineering is working when:

| Indicator | Measurement |
|-----------|-------------|
| Similar bugs caught faster | Time to resolution decreasing |
| Less investigation needed | Skills surface relevant context |
| Patterns self-documenting | New devs productive quickly |
| Velocity increasing | Features per sprint growing |
| Documentation staying current | Fewer "doc is wrong" complaints |

---

## The Meta-Principle

> **Treat your LLM's context like a senior engineer's time: give it the essentials upfront, let it pull details on demand, and ensure every session leaves the codebase smarter than it found it.**

---

## See Also

- `CLAUDE.md` - Project instructions and patterns
- `.claude/skills/compound/` - Compound engineering workflow
- `.claude/skills/llm-native-doc-audit/` - Documentation audit methodology
- `.claude/skills/skill-extractor/` - Creating new skills
- `docs/guides/ai-workflow-guide.md` - AI-assisted development guide
