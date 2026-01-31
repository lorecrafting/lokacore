# Claude Code Skills & Commands Reference

This document catalogs all Claude Code skills, commands, agents, and rules available in the Loka project.

## Quick Reference

| Type | Invocation | Purpose |
|------|------------|---------|
| **Skills** | Auto-triggered | Passive knowledge Claude applies when relevant |
| **Commands** | `/command-name` | Explicit workflows you invoke |
| **Agents** | Via Task tool | Specialized sub-agents Claude spawns |
| **Rules** | Auto-loaded by path | Context loaded when editing specific paths |

### Key Difference: Skills vs Commands

| Skills | Commands |
|--------|----------|
| Auto-triggered by Claude | You type `/command-name` |
| Passive knowledge/patterns | Active workflows with steps |
| "Apply these conventions" | "Run this process now" |
| Example: naming conventions | Example: run all tests |

---

## Skills (Auto-Triggered)

Skills activate automatically when working in relevant areas. Claude detects when they're relevant based on your request and the `description` field.

### loka-conventions

```yaml
name: loka-conventions
description: Ensures code follows Loka conventions for naming, patterns, architecture boundaries, and error handling.
```

**Activates when**: Writing or modifying Elixir code

**Enforces**:
- Layer boundaries (Engine ← Framework ← Web)
- Action Result pattern (`{:ok, Result.new(...)}`)
- Error handling (return tuples, don't raise)
- Naming conventions (modules, functions, variables)

**Supporting files**: `NAMING.md`, `PATTERNS.md`, `ANTIPATTERNS.md`

---

### quest-validation

```yaml
name: quest-validation
description: Ensures quest and content definitions are valid. Use when editing quest YAML files, creating dialogues, modifying NPCs, or working with any content in priv/world/.
```

**Activates when**: Editing content in `priv/world/`

**Knows about**:
- All 14 content validators
- Quest YAML required fields
- Objective types and validation
- Dialogue tree patterns
- Common mistakes to avoid

**Supporting files**: `STRUCTURE.md`

---

### test-patterns

```yaml
name: test-patterns
description: Ensures tests follow Loka testing conventions. Use when writing tests, creating test cases, debugging test failures, or working with ChannelBot.
```

**Activates when**: Writing tests

**Enforces**:
- **ChannelBot** (95% parity) for E2E tests, not Legacy Bot
- Setup-Execute-Assert pattern
- Factory functions
- Async safety rules

**Supporting files**: `PATTERNS.md`

---

### content-creation

```yaml
name: content-creation
description: Knowledge for creating game content (quests, NPCs, items, rooms, dialogues). Use when scaffolding new content, writing YAML files, or using mix loka.new commands.
```

**Activates when**: Creating new game content

**Knows about**:
- `mix loka.new` scaffolding commands
- YAML formats for quests, NPCs, items, rooms
- Dialogue tree patterns
- Quest chain patterns
- Validation commands

---

### llm-native-doc-audit

```yaml
name: llm-native-doc-audit
description: LLM-native documentation auditing methodology. Use when reviewing docs, cleaning up CLAUDE.md, auditing skills/commands, or optimizing token efficiency.
```

**Activates when**: Documentation review, CLAUDE.md optimization, skill audits

**Knows about**:
- Token budget awareness (CLAUDE.md loads every session)
- Skills > inline documentation pattern
- Path-based skill activation
- Archive don't delete pattern
- Audit checklists for docs, skills, rules, commands

---

## Commands (User-Invoked)

Invoke with `/command-name` in the chat. These are explicit workflows with clear steps.

### /validate-content

**Usage**: `/validate-content [--only <type>] [--strict]`

**Purpose**: Run comprehensive content validation using all 14 validators.

**Wraps**: `mix loka.test.validate`

---

### /check-game-balance

**Usage**: `/check-game-balance [--quick] [--iterations N] [--combat-only] [--progression-only]`

**Purpose**: Run balance verification (combat simulations, XP curves, reward analysis).

**Wraps**: `mix loka.test.balance`

**Options**: `--quick` (100 iter), default (1000 iter), `--iterations N` (custom)

---

### /pre-pr-full-verification

**Usage**: `/pre-pr-full-verification`

**Purpose**: Complete verification before creating a PR:
1. Unit tests
2. Content validation
3. Storyline tests (if applicable)
4. Balance check
5. Compilation warnings
6. Code formatting

---

### /review-architecture

**Usage**: `/review-architecture [path]`

**Purpose**: Check for architectural violations:
- Layer separation (Engine ← Framework ← Web)
- Entity-Component-Behavior pattern
- Command pattern (events, not mutation)
- SOLID principles

---

### /simplify-code

**Usage**: `/simplify-code [path]`

**Purpose**: Identify code cleanup opportunities:
- Repeated patterns
- Long functions (>50 lines)
- Compiler warnings
- Complex conditionals
- Magic numbers
- Unclear names

---

### /test-storyline

**Usage**: `/test-storyline <storyline_id>`

**Purpose**: Test storyline completability.

**Recommended**: `mix test test/integration/storyline_channel_test.exs` (ChannelBot, 95% parity)

**Legacy**: `mix loka.test.storyline` (deprecated, 40% parity)

---

### /test-and-fix

**Usage**: `/test-and-fix [path/to/test.exs]`

**Purpose**: Automatically fix common test failures through systematic analysis and iteration.

**Timeout**: 20 minutes

---

### /debug-bot

**Usage**: `/debug-bot`

**Purpose**: Systematically debug failing ChannelBot tests using log analysis.

**Detects patterns**: Stuck phases, missing events, stale data, shape mismatches.

---

### /post-social

**Usage**: `/post-social <platform>`

**Platforms**: `twitter`, `itch`, `kofi`, `all`

**Purpose**: Prepare and post to social media using Chrome automation.

---

### /ss-mobile

**Usage**: `/ss-mobile`

**Purpose**: Capture screenshot from connected mobile device for visual debugging.

---

### /ui-polish-chaos-test

**Usage**: `/ui-polish-chaos-test [URL]`

**Purpose**: Comprehensive UI testing (visual inspection, interactive testing, chaos engineering).

---

## Agents (Claude-Spawned)

These are spawned by Claude as sub-agents for specific tasks. You don't invoke them directly.

### engine-explorer

**Purpose**: Read-only exploration of engine architecture and patterns.

**Tools**: Read, Grep, Glob (NO Write, Edit, Bash)

**Use case**: Claude spawns this when researching how something is implemented in the codebase.

---

### research-agent

**Purpose**: Isolated research and exploration without code modification.

**Tools**: Read, Grep, Glob, WebFetch, WebSearch (NO Write, Edit, Bash)

**Use case**: Claude spawns this for external research, competitive analysis, or technology exploration.

---

## Rules (Path-Based Context)

Rules auto-load when working in specific directories, providing relevant context.

### builder.md

**Paths**: `lib/loka_web/live/admin_live/**`, `lib/loka/world_builder/**`

**Context**: World Builder UI (3-layer architecture, EntityManager patterns, LiveView patterns)

---

### framework.md

**Paths**: `lib/loka/framework/**`

**Context**: Framework development (31 subsystems, layer boundaries, subsystem patterns)

---

### engine.md

**Paths**: `lib/loka/engine/**`

**Context**: Engine invariants (commands return events, auto-save, TypedObject resolution, hooks)

---

### content.md

**Paths**: `priv/world/**`

**Context**: YAML content creation (quest format, dialogue patterns, validation commands)

---

### mobile.md

**Paths**: `mobile/**`

**Context**: React Native development (Expo, TypeScript, WebSocket communication)

---

### testing.md

**Paths**: `test/**`, `lib/loka/testing/**`

**Context**: Testing patterns (ChannelBot 95% parity, test structure, async safety)

---

## File Structure

```
.claude/
├── SKILLS.md              # This documentation
├── settings.json          # Claude Code settings
│
├── skills/                # Auto-triggered (passive knowledge)
│   ├── loka-conventions/
│   │   ├── SKILL.md       # Main skill (with frontmatter)
│   │   ├── NAMING.md
│   │   ├── PATTERNS.md
│   │   └── ANTIPATTERNS.md
│   ├── quest-validation/
│   │   ├── SKILL.md
│   │   └── STRUCTURE.md
│   ├── test-patterns/
│   │   ├── SKILL.md
│   │   └── PATTERNS.md
│   └── content-creation/
│       └── SKILL.md
│
├── commands/              # User-invoked (explicit workflows)
│   ├── validate-content.md
│   ├── check-game-balance.md
│   ├── pre-pr-full-verification.md
│   ├── review-architecture.md
│   ├── simplify-code.md
│   ├── test-storyline.md
│   ├── test-and-fix.md
│   ├── debug-bot.md
│   ├── post-social.md
│   ├── ss-mobile.md
│   └── ui-polish-chaos-test.md
│
├── agents/                # Claude-spawned (specialized sub-agents)
│   ├── engine-explorer.md
│   └── research-agent.md
│
└── rules/                 # Path-based context
    ├── builder.md
    ├── framework.md
    ├── engine.md
    ├── content.md
    ├── mobile.md
    └── testing.md
```

---

## Common Workflows

### Creating New Content

1. Use `mix loka.new` to scaffold (content-creation skill helps)
2. Edit YAML files (quest-validation skill helps)
3. Run `/validate-content` to check
4. Run `/test-storyline <id> --run` if quest-related

### Writing Code

1. Write code (loka-conventions skill helps)
2. Write tests (test-patterns skill helps)
3. Run `/test-and-fix` if tests fail
4. Run `/pre-pr-full-verification` before PR

### Debugging

- Test failures → `/test-and-fix` or `/debug-bot`
- Architecture questions → Claude spawns `engine-explorer`
- External research → Claude spawns `research-agent`

### Before PR

Run `/pre-pr-full-verification` which checks:
- Unit tests
- Content validation
- Balance (quick)
- Formatting
- Warnings

---

## Development Server

Start both Phoenix and mobile Expo servers:

```bash
mix loka.dev           # Both servers
mix loka.dev --server  # Phoenix only
```

This streams mobile debug logs to your terminal for real-time debugging.
