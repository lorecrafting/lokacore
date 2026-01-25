# Compound Engineering Skill

This skill implements the compound engineering workflow: making each unit of work easier than the last.

## How It Works

### Automatic Triggering

The compound skill is automatically triggered after you complete each user request via the `user-prompt-submit` hook.

**Hook Location:** `.claude/hooks/skill-extractor-activator.sh`

### What It Does

1. **Analyzes** the work session for compoundable knowledge
2. **Extracts** skills for non-obvious solutions (via skill-extractor)
3. **Updates** documentation (CLAUDE.md, docs/*, etc.)
4. **Reports** what was captured and how it helps future work

### When It Activates

The skill evaluates every session but only takes action when:
- ✅ Non-obvious solutions were discovered
- ✅ Debugging required significant investigation
- ✅ Patterns emerged that will help future work
- ✅ Architecture decisions were made

### When It Skips

The skill intelligently skips sessions with no compoundable knowledge:
- ❌ Simple typo fixes
- ❌ Standard framework usage
- ❌ One-off changes with no insights

## Manual Invocation

You can also manually invoke the compound skill:

```bash
# In Claude Code
/compound
```

Or tell Claude:
```
"Run the compound skill to capture learnings from this session"
```

## What Gets Captured

### Skills Created
- Non-obvious debugging techniques
- Framework workarounds
- Project-specific patterns
- Error resolution methods

**Location:** `.claude/skills/[skill-name]/skill.md`

### Documentation Updated
- `CLAUDE.md` - Project instructions
- `docs/architecture/*.md` - System design
- `docs/framework/*.md` - Game framework
- `docs/builder-reference/*.md` - Content authoring

### Impact Tracking
Each compound session reports:
- What was accomplished
- What was learned
- How it makes future work easier

## Integration with Existing Skills

### With skill-extractor
When compoundable knowledge is identified, the compound skill invokes:
```
Skill(skill-extractor)
```

The skill-extractor handles the detailed extraction workflow.

### With Audit Commands
The compound skill may suggest running audits to validate new patterns:
- `/audit-architecture` - Validate architectural changes
- `/audit-documentation` - Ensure docs are current
- `/audit-meta` - Improve the audit system itself

## Philosophy

**Traditional Engineering:**
```
Feature 1 → Complexity +1
Feature 2 → Complexity +2
Feature 3 → Complexity +3
Velocity: SLOWS over time
```

**Compound Engineering:**
```
Feature 1 → Pattern extracted → Skill created
Feature 2 → Uses pattern → Faster development
Feature 3 → Uses pattern + adds new pattern → Even faster
Velocity: ACCELERATES over time
```

## Examples

### Session with Compoundable Knowledge

**What happened:** Fixed quest completion not saving due to EntityServer dirty tracking bug

**Compound actions:**
- ✅ Created `entity-dirty-tracking-pattern` skill
- ✅ Updated `docs/architecture/entity-server.md`
- ✅ Added pattern to CLAUDE.md Development Guidelines

**Impact:** Future similar bugs caught immediately via skill surfacing

---

### Session without Compoundable Knowledge

**What happened:** Fixed typo in NPC dialogue YAML ("syas" → "says")

**Compound actions:**
- ❌ None (correctly skipped)

**Report:** "No compoundable knowledge this session"

**Impact:** No noise added to knowledge base

## Success Metrics

Compound engineering is working when:
- ✅ Similar bugs are caught faster each time
- ✅ New features require less investigation
- ✅ Codebase patterns are self-documenting
- ✅ Skills surface relevant knowledge automatically
- ✅ Documentation stays current without manual effort

## Configuration

The compound skill is configured to run automatically. No additional setup needed.

**Hook:** `.claude/hooks/skill-extractor-activator.sh`
**Skill:** `.claude/skills/compound/skill.md`

To disable automatic compounding, remove or comment out the hook invocation in your Claude Code settings.

## Version

- **Version:** 1.0.0
- **Created:** 2026-01-24
- **Author:** Loka
- **Inspired by:** [Every Inc's Compound Engineering Plugin](https://github.com/EveryInc/compound-engineering-plugin)

## Learn More

- [Compound Engineering: How Every Codes With Agents](https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents)
- [Compound Engineering Plugin README](https://github.com/EveryInc/compound-engineering-plugin/blob/main/README.md)
