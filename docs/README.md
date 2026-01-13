# Loka Documentation

## Organization by Role

Documentation is organized by **traditional MUD roles**, though work often crosses boundaries:

| Role | Directory | Audience | Content |
|------|-----------|----------|---------|
| **Builder** | `builder-reference/` | Content creators | YAML specs for quests, dialogues, entities |
| **Developer** | `architecture/`, `framework/`, `api/` | Engine developers | Elixir code, system design, APIs |
| **Admin** | `admin/`, `operations/`, `security/` | Game operators | Dashboard, live ops, security |
| **Game** | `game/` | Story/lore reference | Game-specific content (Monastery Arc) |

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

## Complete Directory Structure

```
docs/
│
│ ═══════════════════════════════════════════════════════════
│ BUILDER - Content Creation (Game-Agnostic)
│ ═══════════════════════════════════════════════════════════
│
├── builder-reference/           # YAML specs & templates
│   ├── README.md                    # Quick start for builders
│   ├── quest-reference.md           # Quest format, objectives, rewards
│   ├── dialogue-reference.md        # Dialogue trees, actions, conditions
│   ├── entity-reference.md          # NPCs, items, rooms, components
│   ├── quest-dialogue-patterns.md   # Common issues & fixes
│   └── world-design/                # Design principles
│       ├── world-designer.md            # World building guide
│       └── world-liveliness.md          # Making worlds feel alive
│
│ ═══════════════════════════════════════════════════════════
│ GAME - Story & Lore (Game-Specific)
│ ═══════════════════════════════════════════════════════════
│
├── game/                        # Game-specific content
│   └── monastery-arc/               # The demo game
│       └── lore-bible.md                # Setting, characters, themes
│
│ ═══════════════════════════════════════════════════════════
│ DEVELOPER - Engine & Framework
│ ═══════════════════════════════════════════════════════════
│
├── architecture/                # System design deep-dives
│   ├── README.md                    # Architecture overview
│   ├── entity-system.md             # Entity-Component-Behavior model
│   ├── entity-lifecycle.md          # Entity spawn, save, destroy
│   ├── commands.md                  # Command pipeline
│   ├── events.md                    # Event bus, PubSub
│   ├── hooks-and-locks.md           # Lifecycle hooks, access control
│   ├── scripting.md                 # Elixir sandbox (overview)
│   ├── elixir-scripts-design.md     # Scripting API reference
│   ├── elixir-scripts-implementation.md  # Scripting internals
│   ├── persistence.md               # Database schema
│   ├── session-system.md            # Client sessions
│   └── ...                          # Many more subsystems
│
├── framework/                   # Elixir APIs for game systems
│   ├── quest-system.md              # Quest framework internals
│   ├── quest-listeners.md           # Hook-based auto-tracking
│   ├── behaviors.md                 # NPC behaviors
│   └── README.md                    # Framework overview
│
├── api/                         # API contracts
│   ├── README.md                    # API overview
│   └── channel-contract.md          # WebSocket channel protocol
│
├── reference/                   # Technical references
│   ├── game-client.md               # Game client architecture
│   └── environmental-effects-reference.md
│
│ ═══════════════════════════════════════════════════════════
│ ADMIN - Operations & Security
│ ═══════════════════════════════════════════════════════════
│
├── admin/                       # Dashboard & admin tools
│   ├── dashboard.md                 # Admin UI guide
│   └── backup-restore.md            # Backup and restore procedures
│
├── operations/                  # Live game operations
│   ├── live-operations-guide.md     # Hot-reload, deployments, scaling
│   ├── monitoring.md                # Monitoring and observability
│   └── Loka_Quick_Reference.md      # Quick reference card
│
├── security/                    # Security documentation
│   └── README.md                    # Auth, rate limiting, sandbox
│
│ ═══════════════════════════════════════════════════════════
│ CROSS-CUTTING
│ ═══════════════════════════════════════════════════════════
│
├── guides/                      # Workflow guides
│   ├── README.md                    # Human oversight guide
│   ├── ai-workflow-guide.md         # AI-assisted development guide
│   ├── reviewing-changes.md         # Code review checklist
│   ├── common-workflows.md          # How to ask Claude for tasks
│   └── troubleshooting.md           # When things go wrong
│
├── ui/                          # UI/UX documentation
│   ├── living-ebook-style-guide.md  # Visual design guide
│   └── accessibility.md             # Accessibility guidelines
│
├── testing/                     # Testing guides
│   └── bot-migration-guide.md       # Test bot documentation
│
├── development/                 # Development setup
│   └── git-hooks.md                 # Git hooks configuration
│
│ ═══════════════════════════════════════════════════════════
│ PLANNING & FUTURE WORK
│ ═══════════════════════════════════════════════════════════
│
├── proposals/                   # Future work proposals
│   ├── README.md                    # Proposals index
│   ├── builder-content-layer.md     # DB storage for builders
│   ├── expo-mobile-app.md           # Mobile app proposal
│   └── ...                          # Other planned features
│
├── game-design/                 # Game mechanics & philosophy
│   ├── README.md                    # Game design index
│   ├── social-primitives.md         # Social systems building blocks
│   ├── llm-assisted-gameplay.md     # AI gameplay design
│   └── storyline-design-tips.md     # Writing guidance
│
├── product/                     # Business strategy & monetization
│   ├── README.md                    # Product docs index
│   ├── world-platform.md            # Platform vision
│   ├── monetization-*.md            # Revenue models
│   └── ai-resilience-strategy.md    # AI coexistence strategy
│
├── research/                    # Research & comparisons
│   ├── mud-engine-analysis.md       # MUD engine comparison
│   ├── scripting-systems-deep-dive.md
│   └── user-research-anecdotes.md
│
├── devlog/                      # Historical development logs
│   ├── DEVELOPMENT_LOG.md           # Internal dev log
│   ├── BLOG_POSTS.md                # Blog content
│   └── PUBLIC_DEVLOG.md             # Public updates
│
├── audits/                      # Code audits
│   └── world-builder-audit-*.md     # Audit reports
│
│ ═══════════════════════════════════════════════════════════
│ COMPREHENSIVE REFERENCES
│ ═══════════════════════════════════════════════════════════
│
├── Loka_Engine_Architecture.md  # Full engine specification
├── LOKA_SYSTEM_STUDY_GUIDE.md   # Learning guide
└── LOAD_TESTING_PLAN.md         # Performance testing plan
```

## Quick Reference by Task

### Building Content
| Task | Start Here |
|------|------------|
| Create a quest | `builder-reference/quest-reference.md` |
| Add NPC dialogue | `builder-reference/dialogue-reference.md` |
| Create entities (NPCs, items, rooms) | `builder-reference/entity-reference.md` |
| Fix broken quest/dialogue | `builder-reference/quest-dialogue-patterns.md` |
| Design world content | `builder-reference/world-design/` |
| Monastery Arc lore | `game/monastery-arc/lore-bible.md` |

### Developing Engine
| Task | Start Here |
|------|------------|
| Understand entity system | `architecture/entity-system.md` |
| Add new command | `architecture/commands.md` |
| Work with events | `architecture/events.md` |
| Write Elixir scripts | `architecture/elixir-scripts-design.md` |
| Extend quest system | `framework/quest-system.md` |
| WebSocket API | `api/channel-contract.md` |

### Admin & Operations
| Task | Start Here |
|------|------------|
| Admin dashboard | `admin/dashboard.md` |
| Deploy changes | `operations/live-operations-guide.md` |
| Security overview | `security/README.md` |

## Validation Commands

```bash
# Validate all content
mix loka.test.validate

# Run storyline tests (ChannelBot - 95% production parity)
mix test test/integration/storyline_channel_test.exs

# Check dependencies (in IEx)
alias Loka.WorldBuilder.Analysis.DependencyGraph
{:ok, graph} = DependencyGraph.build()
DependencyGraph.find_broken_references(graph)
```

## See Also

- `CLAUDE.md` - Project overview and development guide
- `README.md` (root) - Project introduction
