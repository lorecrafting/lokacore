# Claude Code Skills & Commands Reference

All Claude Code skills, commands, agents, and rules for the Loka project.

| Type | Invocation | Purpose |
|------|------------|---------|
| **Skills** | Auto-triggered | Passive knowledge Claude applies when relevant |
| **Commands** | `/command-name` | Explicit workflows you invoke |
| **Agents** | Via Task tool | Specialized sub-agents Claude spawns |
| **Rules** | Auto-loaded by path | Context loaded when editing specific paths |

---

## Skills (Auto-Triggered)

### Core Skills (subdirectory with SKILL.md)

| Skill | Activates When | Key Knowledge |
|-------|----------------|---------------|
| `loka-conventions` | Writing/modifying Elixir code | Layer boundaries, Action Result pattern, naming, error handling. Files: `NAMING.md`, `PATTERNS.md`, `ANTIPATTERNS.md` |
| `quest-validation` | Editing content in `priv/world/` | 14 content validators, quest YAML fields, dialogue trees. Files: `STRUCTURE.md` |
| `test-patterns` | Writing tests | ChannelBot (95% parity), setup-execute-assert, factories, async safety. Files: `PATTERNS.md` |
| `content-creation` | Scaffolding new game content | `mix loka.new`, YAML formats, quest/dialogue patterns |
| `world-builder-patterns` | Working with World Builder code | 3-layer architecture, EntityManager, RoomManager, LiveView |
| `api-verification` | Calling external libraries | Function existence checks, return value handling |
| `yaml-data-handling` | Loading/accessing YAML data | String vs atom keys, format conversion |
| `llm-native-doc-audit` | Documentation review | Token budgets, skill activation, audit checklists |

### System Skills

| Skill | Purpose |
|-------|---------|
| `compound` | Auto-learning loop: Plan → Work → Review → Compound |
| `skill-extractor` | Extracts reusable knowledge from work sessions |
| `world-design` | Collaborative world design with philosophy encoding |
| `narrative-audit` | Structured narrative review methodology |

### Pattern Skills (loose .md files)

| Skill | When to Use |
|-------|-------------|
| `liveview-local-interaction-pattern` | Drag/resize without server roundtrips |
| `liveview-modal-event-pattern` | Modal close buttons not responding |
| `liveview-nested-forms-antipattern` | Forms inside forms (submission fails) |
| `liveview-socket-testing` | `KeyError: :__changed__` in tests |
| `liveview-helper-testing` | Testing modules that use `assign/3` |
| `genserver-test-isolation` | GenServer test isolation patterns |
| `test-file-cleanup-pattern` | Test file cleanup patterns |
| `balance-config-pattern` | Balance configuration patterns |
| `elixir-query-function-signatures` | Elixir query function signatures |
| `elixir-resilient-content-loader` | Content loader resilience patterns |
| `entity-data-structure-differences` | Entity data structure differences |
| `typed-object-field-storage` | TypedObject field storage patterns |
| `godot-class-property-access` | Godot class property access |
| `godot-javascript-bridge-callbacks` | Godot JS bridge callbacks |
| `godot-planemesh-uv-fix` | PlaneMesh UV fix |
| `godot-subviewport-3d-click-detection` | SubViewport 3D click detection |
| `godot-subviewport-meta-click-detection` | SubViewport meta click detection |
| `godot-vfx-optimization` | VFX optimization |
| `godot-webgl-horizontal-banding-fix` | WebGL horizontal banding fix |

---

## Commands (User-Invoked)

Invoke with `/command-name` in the chat.

### Verification & Testing

| Command | Purpose |
|---------|---------|
| `/validate-content` | Content validation using all 14 validators (`mix loka.test.validate`) |
| `/check-game-balance` | Balance verification: combat sims, XP curves, rewards (`mix loka.test.balance`) |
| `/pre-pr-full-verification` | Full pre-PR check: tests, content, balance, formatting, warnings |
| `/test-storyline <id>` | Test storyline completability via ChannelBot |
| `/test-and-fix [path]` | Auto-fix failing tests iteratively (20 min timeout) |

### Development Sessions

| Command | Purpose |
|---------|---------|
| `/engine-work` | Start engine/framework development session |
| `/builder-work` | Start World Builder UI development session |
| `/content-work` | Start game content creation session |
| `/testing-work` | Start testing and bot development session |
| `/research-work` | Research-only exploration (no code changes) |
| `/ux-iterate` | Interactive UX improvement session |

### Audit Suite (13 categories)

| Command | Purpose |
|---------|---------|
| `/audit-full` | Run all audit categories in parallel |
| `/audit-harness` | Meta-audit of `.claude/` config and knowledge |
| `/audit-meta` | Improve the audit system itself |
| `/audit-architecture` | Code structure, patterns, maintainability |
| `/audit-layer` | Engine/Framework/Web separation |
| `/audit-content` | Game data health, deprecated patterns |
| `/audit-testing` | Test coverage, infrastructure |
| `/audit-security` | Auth, input validation, data exposure |
| `/audit-performance` | Load times, memory, DB queries |
| `/audit-scalability` | Single-server limits, bottlenecks |
| `/audit-observability` | Logging, monitoring, debugging |
| `/audit-dependencies` | Mix/npm deps, vulnerabilities |
| `/audit-accessibility` | WCAG compliance, keyboard navigation |
| `/audit-ux` | UI consistency, interaction patterns |
| `/audit-narrative` | Story consistency, writing quality |
| `/audit-godot` | Godot client health, GDScript quality |
| `/audit-balance` | Game balance analysis |
| `/audit-documentation` | Documentation completeness |

### Utilities

| Command | Purpose |
|---------|---------|
| `/debug-bot` | Debug failing ChannelBot tests with log analysis |
| `/simplify-code [path]` | Identify code cleanup opportunities |
| `/devlog-today` | Generate today's devlog entry from git commits |
| `/generate-study-pdf` | Regenerate study guide PDF from markdown |
| `/post-social <platform>` | Post to social media (twitter, itch, kofi) |
| `/ss-mobile` | Capture screenshot from connected mobile device |
| `/ui-polish-chaos-test [URL]` | UI visual + chaos testing |
| `/team-review` | Team code review workflow |

---

## Agents (Claude-Spawned)

| Agent | Purpose | Tools |
|-------|---------|-------|
| `engine-explorer` | Read-only exploration of engine architecture | Read, Grep, Glob |
| `research-agent` | External research, competitive analysis | Read, Grep, Glob, WebFetch, WebSearch |

---

## Rules (Path-Based Context)

| Rule | Paths | Context |
|------|-------|---------|
| `builder` | `lib/loka_web/live/admin_live/**`, `lib/loka/world_builder/**` | World Builder UI patterns |
| `framework` | `lib/loka/framework/**` | 31 subsystems, layer boundaries |
| `engine` | `lib/loka/engine/**` | Engine invariants, TypedObject, hooks |
| `content` | `priv/world/**` | YAML content creation patterns |
| `testing` | `test/**`, `lib/loka/testing/**` | ChannelBot, test structure, async safety |
| `frontend` | `assets/**` | Frontend architecture index |
| `frontend-canvas` | `assets/js/world_builder/` | Canvas interaction patterns |
| `frontend-hooks` | `assets/js/hooks/` | JS hook patterns, HookHelper |
| `frontend-liveview` | World Builder LiveView files | LiveView component patterns |
| `frontend-css` | `assets/css/` | Design tokens, `--wb-*` variables |
| `godot` | `godot-client/**` | Godot 4.6 client development |
| `scripting` | Elixir sandboxed scripts | Script sandbox patterns |
| `narrative` | Narrative content | Writing style, MUD content formats |

---

## Common Workflows

### Creating Content
1. `mix loka.new` to scaffold → 2. Edit YAML → 3. `/validate-content` → 4. `/test-storyline <id>`

### Writing Code
1. Write code → 2. Write tests → 3. `/test-and-fix` if needed → 4. `/pre-pr-full-verification`

### Debugging
- Test failures → `/test-and-fix` or `/debug-bot`
- Architecture → Claude spawns `engine-explorer`
- Research → Claude spawns `research-agent`
