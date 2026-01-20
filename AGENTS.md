# Agent Instructions

This project uses **beads_rust** (`br`) for issue tracking - Jeffrey Emanuel's lightweight Rust port.

## Quick Reference

```bash
br ready              # Find available work
br show <id>          # View issue details
br update <id> --status=in_progress  # Claim work
br close <id>         # Complete work
# Note: br doesn't auto-sync - commit .beads/ manually with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git add .beads/
   git commit -m "Update beads"
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

---

## Beads Workflow Integration

This project uses **beads_rust** (`br`) - a lightweight, non-invasive issue tracker.
Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# CLI commands for agents
br ready              # Show issues ready to work (no blockers)
br list               # All open issues (default)
br list --status=closed  # Closed issues
br show <id>          # Full issue details with dependencies
br create --title="..." --type=task --priority=2
br update <id> --status=in_progress
br close <id>         # Mark complete
br close <id1> <id2>  # Close multiple issues at once
br dep add <a> <b>    # Add dependency (a depends on b)
```

### Workflow Pattern

1. **Start**: Run `br ready` to find actionable work
2. **Claim**: Use `br update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `br close <id>`
5. **Commit**: `git add .beads/ && git commit -m "Update beads" && git push`

### Key Concepts

- **Dependencies**: Issues can block other issues. `br ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers 0-4)
- **Types**: task, bug, feature, epic, question, docs
- **No daemon**: br reads/writes directly to `.beads/` - no background processes

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
git add .beads/         # Stage beads changes
git commit -m "..."     # Commit everything
git push                # Push to remote
```

### Key Differences from bd (Yegge's beads)

| Aspect | br (beads_rust) | bd (beads) |
|--------|-----------------|------------|
| Auto-sync | No - manual git | Yes - daemon |
| CLI flags | `--status=open` | `--status open` |
| Binary size | ~5MB | ~30MB |
| Philosophy | Non-invasive | Full orchestration |
