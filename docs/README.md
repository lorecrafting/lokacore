# Loka Documentation

## Organization by Role

Documentation is organized by **traditional MUD roles**, though work often crosses boundaries:

| Role | Directory | Audience | Content |
|------|-----------|----------|---------|
| **Builder** | `builder-reference/` | Content creators | YAML specs for quests, dialogues, entities |
| **Developer** | `architecture/`, `framework/` | Engine developers | Elixir code, system design, APIs |
| **Admin** | `admin/`, `operations/`, `security/` | Game operators | Dashboard, live ops, security |

### Cross-Cutting Work

With LLM-assisted development, most sessions are **cross-cutting**:

```
┌─────────────────────────────────────────────────────────────┐
│ Typical LLM Session                                         │
│                                                             │
│  "Fix the quest bug" might require:                         │
│    → Builder: Edit quest YAML, fix dialogue                 │
│    → Developer: Debug Elixir code, check validators         │
│    → Admin: Run diagnostics, check logs                     │
│                                                             │
│  The docs are organized by TOPIC, not strict audience.      │
│  Cross-link freely. Use what you need.                      │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
docs/
├── builder-reference/     # YAML content creation
│   ├── quest-reference.md       # Quest format, objectives, rewards
│   ├── dialogue-reference.md    # Dialogue trees, actions, conditions
│   ├── entity-reference.md      # NPCs, items, rooms, components
│   ├── quest-dialogue-patterns.md  # Common issues & fixes
│   ├── world-design/            # World building guides
│   │   ├── lore-bible.md        # Lore & setting
│   │   ├── world-designer.md    # World design principles
│   │   └── world-liveliness.md  # Making worlds feel alive
│   └── README.md                # Quick start for builders
│
├── architecture/          # System design (Developer)
│   ├── entity-system.md         # Entity-Component-Behavior model
│   ├── commands.md              # Command pipeline
│   ├── events.md                # Event bus, PubSub
│   ├── hooks-and-locks.md       # Lifecycle hooks, access control
│   ├── scripting.md             # Elixir sandbox scripting
│   └── ...
│
├── framework/             # Elixir APIs (Developer)
│   ├── quest-system.md          # Quest framework internals
│   ├── quest-listeners.md       # Hook-based auto-tracking
│   ├── combat.md                # Combat system
│   └── ...
│
├── admin/                 # Dashboard & tools (Admin)
│   └── dashboard.md             # Admin UI guide
│
├── operations/            # Live game operations (Admin)
│   └── live-operations-guide.md # Hot-reload, deployments
│
├── security/              # Security measures (Admin)
│   └── README.md                # Auth, rate limiting, sandbox
│
├── guides/                # Cross-cutting workflows
│   ├── reviewing-changes.md     # Code review checklist
│   ├── common-workflows.md      # How to ask Claude for tasks
│   └── troubleshooting.md       # When things go wrong
│
├── design/                # Design proposals & specs
├── research/              # Research & comparisons
└── devlog/                # Historical development logs
```

## Quick Reference by Task

| Task | Start Here |
|------|------------|
| Create a quest | `builder-reference/quest-reference.md` |
| Add NPC dialogue | `builder-reference/dialogue-reference.md` |
| Fix broken quest | `builder-reference/quest-dialogue-patterns.md` |
| Extend quest system | `framework/quest-system.md` |
| Add new command | `architecture/commands.md` |
| Understand events | `architecture/events.md` |
| Write scripts | `architecture/scripting.md` |
| Deploy changes | `operations/live-operations-guide.md` |
| Admin dashboard | `admin/dashboard.md` |

## Validation Commands

```bash
# Validate all content
mix loka.test.validate

# Run storyline bot test
mix loka.test.storyline monastery_arc --run

# Check dependencies (in IEx)
alias Loka.WorldBuilder.Analysis.DependencyGraph
{:ok, graph} = DependencyGraph.build()
DependencyGraph.find_broken_references(graph)
```

## See Also

- `CLAUDE.md` - Project overview and development guide
- `README.md` (root) - Project introduction
