# Audit Harness

Review the health of the entire Claude Code harness: CLAUDE.md, rules, skills, hooks, commands, settings, and docs.

## Usage

```
/audit-harness [scope]
```

**Scope options:**
- (no args) - Full audit of everything
- `config` - Just CLAUDE.md, rules, hooks, settings
- `knowledge` - Just skills, commands, docs
- `docs` - Just documentation cross-references

## Instructions

Run each audit section below. For each finding, classify as:
- **Critical** - Actively causing problems (broken references, conflicting instructions)
- **Warning** - Will cause problems eventually (stale content, duplication, bloat)
- **Info** - Improvement opportunity (missing coverage, style inconsistency)

---

### 1. CLAUDE.md Health

**Size check:**
```bash
wc -l CLAUDE.md
```
- Target: under 200 lines (global context, always loaded)
- If over 200: identify content that should move to path-scoped rules

**Duplication scan:**
- Read CLAUDE.md and each `.claude/rules/*.md`
- Flag any instructions/patterns that appear in both
- CLAUDE.md should have overview only; detailed rules go in rules files

**Stale references:**
- Check every file path mentioned in CLAUDE.md exists
- Check every doc path (e.g., `docs/architecture/...`) exists
- Check any command references (e.g., `mix loka.*`) are valid

**Consistency:**
- Does CLAUDE.md architecture description match actual project structure?
- Are version numbers current? (Check `mix.exs` for Elixir/Phoenix versions)
- Do routes listed match actual router?

### 2. Rules Health

**Inventory:**
```bash
ls -la .claude/rules/
```

**For each rule file, check:**
- Has `paths:` frontmatter? (If not, it's always loaded - is that intentional?)
- Are the glob patterns in `paths:` valid? Do they match actual directories?
- Is the rule file under 200 lines? (Larger files should be split)
- Does it reference files/modules that exist?

**Cross-rule analysis:**
- Any conflicting instructions between rules?
- Any duplication between rules? (e.g., same pattern explained in two files)
- Coverage gaps: are there major code areas with no rule? Check:
  - `lib/loka/engine/` → `engine.md` exists?
  - `lib/loka/framework/` → `framework.md` exists?
  - `lib/loka_web/` → `builder.md` or similar?
  - `assets/` → `frontend.md` exists?
  - `godot-client/` → `godot.md` exists?
  - `test/` → `testing.md` exists?
  - `priv/world/` → `content.md` exists?

**Path-scope validation:**
- For each rule with `paths:`, verify the paths match actual file structure
- Flag rules scoped to directories that don't exist or were renamed

### 3. Skills Health

**Inventory:**
```bash
ls .claude/skills/
```

**For each skill, check:**
- Is it referenced from CLAUDE.md, rules, or commands?
- Is the trigger condition clear? (When should Claude use this?)
- Is it stale? (References code patterns that no longer exist)
- Is it actionable? (Specific enough to apply, not just general advice)

**Orphan detection:**
- Skills not referenced from any CLAUDE.md, rule, or command
- Skills referencing file paths that don't exist
- Skills with dates older than 3 months may need review

**Duplication:**
- Any skills that overlap significantly with rules?
- Any skills that cover the same topic?

### 4. Hooks Health

**Read settings:**
```bash
cat .claude/settings.json
```

**For each hook, verify:**
- The command/script exists and is executable
- Timeout values are reasonable (not too long for interactive work)
- The matcher patterns are correct
- Error handling: what happens if the hook fails?

**Hook scripts:**
```bash
ls .claude/hooks/
```
- Check each script is executable (`chmod +x`)
- Check scripts don't have stale paths
- Check scripts handle errors gracefully

**Coverage check:**
- Are the right lifecycle events hooked? (SessionStart, PreToolUse, PostToolUse, UserPromptSubmit)
- Any hooks that should exist but don't? (e.g., YAML validation on write)

### 5. Commands Health

**Inventory:**
```bash
ls .claude/commands/
```

**For each command, check:**
- Does it reference valid file paths?
- Are bash commands in the instructions still valid?
- Does the output format template make sense?
- Is there a clear "when to use" section?
- Any commands that overlap/duplicate each other?

**Cross-reference:**
- Commands referenced from CLAUDE.md "Audit Commands" section exist?
- Commands that reference other commands (e.g., "Related Commands") - do those exist?

### 6. Settings Health

**Check `.claude/settings.json`:**
- Valid JSON?
- StatusLine working? Test: `.claude/statusline.sh`
- Are hook matchers correct regex/glob patterns?
- Any deprecated settings?

**Check `.claude/settings.local.json`:**
- Valid JSON?
- Appropriate for local-only settings (not things that should be shared)?

### 7. Documentation Health

**Cross-reference validation:**
Collect every doc path referenced from:
- CLAUDE.md
- `.claude/rules/*.md`
- `.claude/skills/*.md`
- `.claude/commands/*.md`

For each path, verify the file exists. Report dead links.

**Orphan detection:**
- Docs not referenced from any harness file
- (Info only - orphaned docs aren't necessarily bad)

**Staleness indicators:**
- Docs with file dates older than 6 months
- Docs referencing modules/functions that no longer exist
- Docs mentioning deprecated approaches (e.g., "React Native", "Legacy Bot" as primary)

**Structure check:**
- Does `docs/README.md` accurately describe the directory structure?
- Are all docs/ subdirectories represented in the README?
- Any docs in wrong directories? (e.g., architecture doc in builder-reference/)

---

## Output Format

```markdown
# Harness Audit Report

## Summary
| Area | Status | Issues |
|------|--------|--------|
| CLAUDE.md | OK/WARN/CRITICAL | count |
| Rules | OK/WARN/CRITICAL | count |
| Skills | OK/WARN/CRITICAL | count |
| Hooks | OK/WARN/CRITICAL | count |
| Commands | OK/WARN/CRITICAL | count |
| Settings | OK/WARN/CRITICAL | count |
| Docs | OK/WARN/CRITICAL | count |

## Critical Issues
[Must fix - actively causing problems]

### 1. [Issue title]
**Area:** Rules / Skills / etc.
**File:** path/to/file
**Issue:** What's wrong
**Fix:** Specific action to take

## Warnings
[Should fix - will cause problems eventually]

### 1. [Issue title]
**Area:** ...
**File:** ...
**Issue:** ...
**Fix:** ...

## Info
[Nice to have - improvement opportunities]

## Metrics
- CLAUDE.md: X lines (target: <200)
- Rules: X files, Y total lines
- Skills: X files (Y orphaned)
- Hooks: X active
- Commands: X files
- Docs: X files (Y dead links, Z orphaned)
- Total harness context: X lines always-loaded, Y lines path-scoped

## Recommended Actions (Priority Order)
1. [Most impactful fix]
2. [Next fix]
3. ...
```

## Success Criteria

- All file references resolve to existing files
- No conflicting instructions between CLAUDE.md and rules
- No significant duplication across harness files
- CLAUDE.md stays under 200 lines
- All hooks are functional
- Skills have clear triggers and aren't stale
- Doc cross-references are valid

## When to Run

- After refactoring CLAUDE.md or rules
- After adding new skills or commands
- Monthly as part of harness maintenance
- When Claude Code seems to "forget" project conventions (symptom of stale/conflicting context)

## Related Commands

- `/review-architecture` - Deep architecture code review
- `/team-review` - Multi-perspective code review
- `/compound` - Extract learnings from work sessions
