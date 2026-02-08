---
description: Start engine/framework development session
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Task
---

# Engine Development Session

You are now in **Engine Development Mode**, focused on core engine (`lib/loka/engine/`) and game framework (`lib/loka/framework/`).

## Session Setup

Before diving in, clarify:
1. **What module/feature** are you implementing or modifying?
2. **Is this new or existing** functionality?
3. **What behavior** do you expect?

## Key Invariants to Remember

- Commands return `{:ok, [Event.t()]}` - never mutate directly
- EntityServer auto-saves every 60s - don't manually save
- TypedObject resolution: Content modules first, then legacy loaders
- Hook system has 22 lifecycle events (async via Task supervisor)
- Lock strings are string-based access control

## Development Workflow

```
1. Explore     → Use engine-explorer subagent for analysis
2. Plan        → Identify affected modules and tests
3. Implement   → Follow loka-conventions skill
4. Test        → mix test test/loka/engine/ or test/loka/framework/
5. Verify      → /check-work
```

## Quick Commands

```bash
# Run all tests
mix test

# Engine tests only
mix test test/loka/engine/

# Framework tests only
mix test test/loka/framework/

# Specific subsystem
mix test test/loka/framework/quest/

# Content validation
mix loka.test.validate
```

## Key Documentation

| Topic | Location |
|-------|----------|
| Entity System | `docs/architecture/entity-system.md` |
| Entity Lifecycle | `docs/architecture/entity-lifecycle.md` |
| Hooks & Locks | `docs/architecture/hooks-and-locks.md` |
| Events | `docs/architecture/events.md` |
| Framework Subsystems | `docs/framework/README.md` |
| Patterns | `.claude/skills/loka-conventions/` |

## Available Subagent

Use `engine-explorer` for read-only codebase analysis:
- Finds where functionality is implemented
- Traces code paths
- Identifies patterns
- Returns findings without modifying files

## What NOT To Do

- Don't modify `priv/world/` (use `/content-work` for that)
- Don't modify `lib/loka_web/` (use `/builder-work` for UI)
- Don't skip tests - always verify with `mix test`

## End of Session

Before finishing:
1. Run `/check-work` for verification
2. Use `/save` if you learned something worth remembering
3. Commit if changes are complete: `git add . && git commit -m "feat: ..."`
