# AI Workflow Guide for Loka Development

This guide explains how to use the Claude Code workflow system for Loka development. The system provides **cognitive isolation** - separating different types of work to prevent context pollution and mistakes.

## Quick Start

### 1. Start a Work Session

When you begin working, choose the appropriate mode:

| Command | Use When |
|---------|----------|
| `/engine-work` | Modifying core engine or framework code |
| `/content-work` | Creating quests, NPCs, dialogue, items |
| `/builder-work` | Working on World Builder UI |
| `/testing-work` | Writing tests or debugging bots |
| `/research-work` | Exploring ideas (read-only) |

### 2. Work Within the Mode

Each mode:
- Loads relevant context automatically
- Provides appropriate documentation pointers
- Suggests validation commands
- Has access to specialized subagents

### 3. Switch Modes Cleanly

When changing focus:

```
Option A (Quick): Just run the new command
  /content-work  →  /engine-work
  (Old context stays in history - may cause minor bleed)

Option B (Clean): Clear first
  /save          → Save important context to memory
  /clear         → Fresh slate
  /engine-work   → Start new mode
```

### 4. Save Important Learnings

When you discover something worth remembering:
```
/save
```
This stores a summary in long-term memory for future sessions.

---

## Work Modes Explained

### `/engine-work` - Core Development

**When to use**: Modifying `lib/loka/engine/` or `lib/loka/framework/`

**What it provides**:
- Engine invariants (what must never change)
- OTP patterns (GenServer, supervision)
- Subsystem patterns (RegistryBase)
- Test commands

**Key rules**:
- Commands return `{:ok, [Event.t()]}` - never mutate
- EntityServer auto-saves every 60s
- TypedObject resolution: Content modules → Legacy loaders

**Verification**: `mix test`

---

### `/content-work` - Game Content

**When to use**: Creating/modifying `priv/world/` YAML files

**What it provides**:
- YAML format specifications
- Quest/dialogue patterns
- Validation commands
- Common mistake warnings

**Key rules**:
- Quest offers in FIRST dialogue node
- Valid objectives: talk, kill, get_item, go_to
- System quests use `giver: system`

**Verification**: `mix loka.test.validate`

---

### `/builder-work` - World Builder UI

**When to use**: Working on `lib/loka_web/live/admin_live/`

**What it provides**:
- Three-layer architecture (Content → EntityManager → Specialized)
- LiveView patterns (streams, to_form)
- Phoenix 1.8 conventions

**Key rules**:
- Use EntityManager for simple entities
- Use streams for collections
- Always use `to_form()` for forms

**Verification**: `mix test test/loka_web/`

---

### `/testing-work` - Tests and Bots

**When to use**: Writing tests or debugging bot infrastructure

**What it provides**:
- Bot comparison (ChannelBot 95% vs Legacy 40%)
- Test patterns (setup/execute/assert)
- Debugging guides

**Key rules**:
- Use ChannelBot for E2E tests
- Avoid Process.sleep()
- Use start_supervised for cleanup

**Verification**: `mix test`

---

### `/research-work` - Exploration (Read-Only)

**When to use**: Exploring ideas, analyzing approaches, researching

**What it provides**:
- Web search and fetch
- Codebase exploration
- Proposal template

**Key rules**:
- NO file modifications allowed
- Output goes to `docs/design/`
- User decides on implementation

**Verification**: N/A (read-only)

---

## Path-Scoped Rules

The system automatically loads context based on which files you're working with:

| Path | Rule Loaded |
|------|-------------|
| `lib/loka/engine/**` | Engine patterns |
| `lib/loka/framework/**` | Framework patterns |
| `priv/world/**` | Content patterns |
| `lib/loka_web/live/admin_live/**` | Builder patterns |
| `test/**` | Testing patterns |
| `mobile/**` | Mobile patterns |

You don't need to do anything - rules load automatically when you access files in those paths.

---

## Subagents (Isolated Exploration)

For heavy exploration without polluting your main context:

| Subagent | Purpose | Can Modify? |
|----------|---------|-------------|
| `engine-explorer` | Analyze engine architecture | No |
| `content-validator` | Validate YAML content | No |
| `research-agent` | Research and ideation | No |

These run in isolated contexts - their verbose output stays separate from your main conversation.

---

## Skills (Always Available)

These provide permanent expertise that activates when relevant:

| Skill | Activates When |
|-------|---------------|
| `loka-conventions` | Writing Elixir code |
| `quest-validation` | Editing quest YAML |
| `test-patterns` | Writing tests |

Skills include:
- Code patterns (PATTERNS.md)
- Anti-patterns (ANTIPATTERNS.md)
- Naming conventions (NAMING.md)

---

## Long-Term Memory

### Saving Context

```
/save
```

Saves a summary of important learnings to memory. Use when you:
- Discover a gotcha worth remembering
- Make a design decision with rationale
- Learn something that would help future sessions

### Searching Memory

```
/remember [query]
```

Searches previous memories. Include project name for best results:
- "lokacore engine entity lifecycle"
- "lokacore content quest patterns"

### Memory Format

Memories are stored with project prefix:
```
lokacore engine 2026-01-11 - TypedObject resolution order: Content modules first, then legacy loaders
```

---

## Automation Hooks

The system includes automatic hooks that run without manual intervention:

### PostToolUse Hooks (After File Edits)

| Trigger | Action |
|---------|--------|
| Edit/Write `.ex` or `.exs` files | Auto-runs `mix format` on the file |
| Edit/Write `priv/world/*.yml` files | Auto-runs `mix loka.test.validate` |

### PreToolUse Hooks (Before Actions)

| Trigger | Action |
|---------|--------|
| `git commit` command | Validates content first, blocks if broken |

### SessionStart Hook

Each session shows:
- Current git branch
- Uncommitted changes summary

**Note**: Hooks are configured in `.claude/settings.json`. Changes require a session restart to take effect.

---

## Utility Commands

| Command | Purpose |
|---------|---------|
| `/test-and-fix` | Run tests, analyze failures, fix iteratively |
| `/debug-bot` | Debug failing bot/storyline tests |
| `/check-work` | Post-implementation verification |

---

## Audit Commands

For quality checks, use the audit suite:

| Command | Focus |
|---------|-------|
| `/audit-architecture` | Code structure |
| `/audit-security` | Security issues |
| `/audit-performance` | Performance |
| `/audit-content` | Game content |
| `/audit-testing` | Test coverage |
| `/audit-full` | All audits |

---

## Example Workflow

### Adding a New Quest

```
1. /content-work              # Enter content mode

2. Read existing quest:       # Understand patterns
   Read priv/world/quests/intro_welcome.yml

3. Create new quest:          # Follow patterns
   Write priv/world/quests/side_herbalist.yml

4. Validate:                  # Check for errors
   mix loka.test.validate

5. /save                      # If you learned something
```

### Fixing an Engine Bug

```
1. /engine-work               # Enter engine mode

2. Explore with subagent:     # Find the issue
   Use engine-explorer to find where X is handled

3. Fix the code:              # Make changes
   Edit lib/loka/engine/entity_server.ex

4. Test:                      # Verify fix
   mix test test/loka/engine/

5. /check-work                # Full verification
```

### Researching a Feature

```
1. /research-work             # Enter research mode (read-only)

2. Analyze codebase:          # Understand current state
   Search for how similar features work

3. Research externally:       # Look at alternatives
   Web search for approaches

4. Document:                  # Create proposal
   Write docs/design/proposals/new-feature.md

5. Present to user:           # Let them decide
   Summarize options and recommendation
```

---

## Portability

### What's Portable (Use with Any AI)

The **content** of these files works with any LLM:
- PATTERNS.md, ANTIPATTERNS.md, NAMING.md
- Rule markdown content
- Command markdown content
- Documentation

### What's Claude Code Specific

The **activation mechanisms** are Claude Code specific:
- YAML frontmatter (`paths:`, `allowed-tools:`)
- Subagent tool restrictions
- Hook integrations
- settings.json

### Migrating to Another LLM

1. Keep all markdown content (patterns, conventions)
2. Create equivalent "system prompts" or "instructions"
3. Manually load context (no auto path-scoping)
4. Recreate tool restrictions in their format

---

## Troubleshooting

### Context Feels Wrong

**Symptom**: Claude seems confused about which layer to work in

**Fix**: Run the appropriate work command:
```
/engine-work    # For engine context
/content-work   # For content context
```

### Too Much Context Accumulated

**Symptom**: Responses reference unrelated past work

**Fix**: Clear and restart:
```
/save           # Save important stuff
/clear          # Fresh slate
/engine-work    # Enter mode fresh
```

### Memory Not Finding Things

**Symptom**: `/remember` returns irrelevant results

**Fix**: Include project name in query:
```
/remember lokacore engine entity spawn
```

---

## File Locations

```
.claude/
├── settings.json             # Hooks and plugin configuration
├── rules/                    # Path-scoped context
│   ├── engine.md
│   ├── framework.md
│   ├── content.md
│   ├── builder.md
│   ├── testing.md
│   └── mobile.md
├── agents/                   # Specialized subagents
│   ├── engine-explorer.md
│   ├── content-validator.md
│   ├── research-agent.md
│   └── [existing agents]
├── skills/                   # Permanent expertise
│   ├── loka-conventions/
│   ├── quest-validation/
│   └── test-patterns/
└── commands/                 # Entry points (in server/)
    ├── engine-work.md
    ├── content-work.md
    ├── builder-work.md
    ├── testing-work.md
    ├── research-work.md
    ├── test-and-fix.md
    ├── debug-bot.md
    ├── check-work.md
    └── [audit commands]
```
