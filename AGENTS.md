# Agent Instructions

This project uses **Claude Code native task system** for tracking work during development sessions.

## Quick Reference

```bash
# Claude Code has built-in task management tools:
TaskCreate   # Create a new task
TaskUpdate   # Update task status (pending → in_progress → completed)
TaskList     # List all tasks
TaskGet      # Get task details
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **Complete all tasks** - Mark all finished tasks as completed
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update task status** - Review TaskList, ensure accurate status
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git add <changed files>
   git commit -m "descriptive message"
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

## Task System Workflow

Claude Code provides native task tracking during development sessions.

### Task Lifecycle

1. **Create tasks** - Use `TaskCreate` to break down work into manageable pieces
2. **Start work** - Use `TaskUpdate` to mark tasks as `in_progress`
3. **Complete work** - Use `TaskUpdate` to mark tasks as `completed`
4. **Review** - Use `TaskList` to see overall progress

### Best Practices

- **Break down complex work** - Create subtasks for multi-step operations
- **Update status proactively** - Mark tasks in_progress before starting work
- **Track blockers** - Use task dependencies (blocks/blockedBy) when needed
- **Keep descriptions clear** - Include acceptance criteria and context

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
git commit -m "..."     # Commit everything
git push                # Push to remote
```

### Long-term Issue Tracking

For issues that span multiple sessions or need persistence beyond the current conversation:

- Use `docs/BACKLOG.md` for planned work
- Document architectural decisions in `docs/architecture/`
- Track bugs and features in GitHub Issues (when project has external contributors)
