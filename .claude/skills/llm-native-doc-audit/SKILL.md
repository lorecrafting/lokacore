# LLM-Native Documentation Audit

> **Trigger**: Documentation review, docs cleanup, CLAUDE.md optimization, skill/command audit
> **Created**: 2026-01-31

## Purpose

Methodology for auditing documentation systems from an LLM-native perspective, optimizing for token efficiency, context loading, and AI-assisted development.

## Core Principles

### 1. Token Budget Awareness

CLAUDE.md loads every session. Every line costs tokens.

| Content Type | Belongs In | Reason |
|--------------|------------|--------|
| Essential patterns | CLAUDE.md | Always needed |
| Detailed gotchas | Skills (auto-load by path) | Only when relevant |
| Historical decisions | Decision records | Reference only |
| Code examples >20 lines | Skills or docs/ | Too verbose for CLAUDE.md |

### 2. Skills > Inline Documentation

**Anti-pattern**: Detailed patterns in always-loaded files
```markdown
# CLAUDE.md (loads every session)
### Common Gotcha: WebGL Banding
When using 3D shaders with gl_compatibility...
[50 lines of detail]
```

**Pattern**: Summary table + skill reference
```markdown
# CLAUDE.md
| Issue | Quick Fix | Full Pattern |
|-------|-----------|--------------|
| WebGL banding | Add `unshaded` | `.claude/skills/godot-webgl-fix.md` |
```

**Token savings**: ~1,500 tokens for 5 gotchas

### 3. Path-Based Activation

`.claude/rules/` auto-load by file path - excellent pattern:
- `framework.md` loads for `lib/loka/framework/**`
- `content.md` loads for `priv/world/**`

Use this for context that's only needed in specific areas.

### 4. Archive Don't Delete

Historical skills/docs have value for understanding decisions:
```
.claude/skills/archived/
├── bevy-0-15-patterns/     # Explains why we moved to Godot
├── react-native-patterns/  # Historical mobile approach
```

## Audit Checklist

### CLAUDE.md Audit

- [ ] Has table of contents for navigation?
- [ ] Detailed patterns moved to skills?
- [ ] Code examples under 20 lines?
- [ ] No duplication with skills that auto-load?
- [ ] Quick reference tables where possible?

### Skills Audit

- [ ] Stale/archived skills in `archived/` subdirectory?
- [ ] Trigger conditions clearly documented?
- [ ] No duplication between skills?
- [ ] Path-based activation where appropriate?

### Rules Audit

- [ ] All path patterns still valid?
- [ ] Referenced directories exist?
- [ ] Content matches current tech stack?

### Commands Audit

- [ ] No duplicate commands across directories?
- [ ] Timeouts appropriate for task?
- [ ] Output format specified?

## Common Issues Pattern

| Issue | Detection | Fix |
|-------|-----------|-----|
| Tech stack drift | References to archived tech | Update or archive doc |
| Skill duplication | Similar content in multiple files | Consolidate |
| CLAUDE.md bloat | Detailed patterns inline | Move to skills |
| Orphaned rules | Path patterns for deleted dirs | Remove rule |
| Inconsistent counts | "27 subsystems" vs "31 subsystems" | Verify and standardize |

## Audit Workflow

1. **Inventory**: Count all docs, skills, commands, rules
2. **Compare to codebase**: Do paths/counts match reality?
3. **Check for duplication**: CLAUDE.md vs skills, duplicate commands
4. **Identify stale content**: References to archived tech
5. **Token analysis**: What loads always vs. on-demand?
6. **Execute fixes**: Archive, consolidate, slim, add TOC

## Metrics to Track

| Metric | Good | Warning |
|--------|------|---------|
| CLAUDE.md lines | <500 | >800 |
| Skills with clear triggers | 100% | <80% |
| Stale content in active dirs | 0 | >0 |
| Duplicate content | 0 | >0 |

## See Also

- `.claude/skills/compound/` - Continuous learning loop
- `.claude/skills/skill-extractor/` - Creating new skills
- `docs/README.md` - Documentation organization
