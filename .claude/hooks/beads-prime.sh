#!/bin/bash
# Beads workflow context for Claude Code sessions
# Replacement for `bd prime` using `br` commands

cat << 'EOF'
# Beads Workflow Context

> **Context Recovery**: Run this hook after compaction, clear, or new session

# 🚨 SESSION CLOSE PROTOCOL 🚨

**CRITICAL**: Before saying "done" or "complete", you MUST run this checklist:

```
[ ] 1. git status              (check what changed)
[ ] 2. git add <files>         (stage code changes)
[ ] 3. git commit -m "..."     (commit code)
[ ] 4. git push                (push to remote)
```

## Core Rules
- Track strategic work in beads (multi-session, dependencies, discovered work)
- Use `br create` for issues, TodoWrite for simple single-session execution
- When in doubt, prefer br—persistence you don't need beats lost context
- Session management: check `br ready` for available work

## Essential Commands

### Finding Work
- `br ready` - Show issues ready to work (no blockers)
- `br list --status=open` - All open issues
- `br list --status=in_progress` - Your active work
- `br show <id>` - Detailed issue view with dependencies

### Creating & Updating
- `br create --title="..." --type=task|bug|feature --priority=2` - New issue
  - Priority: 0-4 or P0-P4 (0=critical, 2=medium, 4=backlog). NOT "high"/"medium"/"low"
- `br update <id> --status=in_progress` - Claim work
- `br update <id> --assignee=username` - Assign to someone
- `br close <id>` - Mark complete
- `br close <id1> <id2> ...` - Close multiple issues at once (more efficient)
- `br close <id> --reason="explanation"` - Close with reason
- **Tip**: When creating multiple issues/tasks/epics, use parallel subagents for efficiency

### Dependencies & Blocking
- `br dep add <issue> <depends-on>` - Add dependency (issue depends on depends-on)
- `br blocked` - Show all blocked issues
- `br show <id>` - See what's blocking/blocked by this issue

### Sync & Collaboration
- `br sync` - Sync database with JSONL file
- `br sync --status` - Check sync status

### Project Health
- `br stats` - Project statistics (open/closed/blocked counts)
- `br doctor` - Check for issues (sync problems, missing hooks)

## Common Workflows

**Starting work:**
```bash
br ready           # Find available work
br show <id>       # Review issue details
br update <id> --status=in_progress  # Claim it
```

**Completing work:**
```bash
br close <id1> <id2> ...    # Close all completed issues at once
git push                    # Push to remote
```

**Creating dependent work:**
```bash
# Run br create commands in parallel (use subagents for many items)
br create --title="Implement feature X" --type=feature
br create --title="Write tests for X" --type=task
br dep add beads-yyy beads-xxx  # Tests depend on Feature (Feature blocks tests)
```
EOF
