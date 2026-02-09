# Loka Documentation

## Organization by Role

Documentation is organized by **traditional MUD roles**, though work often crosses boundaries:

| Role | Directory | Audience | Content |
|------|-----------|----------|---------|
| **Builder** | `builder-reference/` | Content creators | YAML specs for quests, dialogues, entities |
| **Developer** | `architecture/`, `framework/`, `api/` | Engine developers | Elixir code, system design, APIs |
| **Admin** | `admin/`, `operations/`, `security/` | Game operators | Dashboard, live ops, security |
| **Game** | `game/`, `game-design/` | Story/lore/design reference | Game-specific content, design docs |

## Complete Directory Structure

```
docs/
│
│ ═══ BUILDER - Content Creation ═══
│
├── builder-reference/
│   ├── README.md                        # Quick start for builders
│   ├── quest-reference.md               # Quest format, objectives, rewards
│   ├── dialogue-reference.md            # Dialogue trees, actions, conditions
│   ├── entity-reference.md              # NPCs, items, rooms, components
│   ├── quest-dialogue-patterns.md       # Common issues & fixes
│   ├── behaviors.md                     # NPC behavior reference
│   ├── emotes.md                        # Emote system reference
│   ├── scripting-api-llm-guide.md       # Scripting API for LLM use
│   ├── story-creation-checklist.md      # Story creation workflow
│   └── world-design/
│       └── world-liveliness.md          # Making worlds feel alive
│
│ ═══ GAME - Story, Lore & Design ═══
│
├── game/
│   └── monastery-arc/
│       └── lore-bible.md                # Setting, characters, themes
│
├── game-design/
│   ├── README.md                        # Game design index
│   ├── MASTER-GDD.md                    # Master game design document
│   ├── BRAINSTORM-FRAMEWORK.md          # Brainstorming framework
│   ├── social-primitives.md             # Social systems building blocks
│   ├── llm-assisted-gameplay.md         # AI gameplay design
│   ├── llm-gameplay-comparison-tables.md
│   ├── storyline-design-tips.md         # Writing guidance
│   ├── familiar-companion-system.md     # Companion system design
│   ├── cooperative-town-builder-vision.md
│   ├── cosmic-lore-vision.md
│   ├── WORLD-BUILDER-IMPROVEMENT-PLAN.md
│   ├── SEEDSHIP-FOREST-WORLD-DESIGN-ARCHIVE.md
│   └── seedship-forest-world/           # Detailed world design
│       ├── README.md
│       ├── STORY.md
│       ├── CHARACTERS.md
│       ├── GEOGRAPHY.md
│       ├── SYSTEMS.md
│       ├── WORLDBUILDING.md
│       ├── DESIGN-NOTES.md
│       └── IMPLEMENTATION.md
│
│ ═══ DEVELOPER - Engine & Framework ═══
│
├── architecture/
│   ├── README.md                        # Architecture overview
│   ├── entity-system.md                 # Entity-Component-Behavior model
│   ├── entity-lifecycle.md              # Entity spawn, save, destroy
│   ├── events.md                        # Event bus, PubSub
│   ├── event-system-guidelines.md       # Event system patterns
│   ├── hooks-and-locks.md               # Lifecycle hooks, access control
│   ├── scripting.md                     # Elixir sandbox (overview)
│   ├── elixir-scripts-design.md         # Scripting API reference
│   ├── elixir-scripts-implementation.md # Scripting internals
│   ├── persistence.md                   # Database schema
│   ├── database-schema-design.md        # DB schema details
│   ├── session-system.md               # Client sessions
│   ├── client-architecture.md           # Client arch (ARCHIVED - React Native)
│   ├── client-server-messaging.md       # Client-server protocol
│   ├── channel-events.md               # Channel event reference
│   ├── messaging.md                     # Messaging system
│   ├── action-resolution-system.md      # Action resolution pipeline
│   ├── auto-repair-system.md            # Self-healing system
│   ├── behavior-systems-explained.md    # Behavior pattern deep-dive
│   ├── core-mechanics-design.md         # Core mechanics philosophy
│   ├── core-mechanics-implementation.md # Core mechanics code
│   ├── diagrams.md                      # Architecture diagrams
│   ├── environmental-effects-system.md  # Environmental effects
│   ├── guardrails.md                    # Architectural guardrails
│   ├── immersion-systems-design.md      # Immersion features
│   ├── mechanics-and-primitives.md      # Engine primitives
│   ├── plugin-migration-analysis.md     # Plugin system analysis
│   ├── progression-and-content-design.md
│   ├── prototypes.md                    # Prototype system
│   ├── storylines.md                    # Storyline system
│   ├── testing.md                       # Testing architecture
│   ├── terminal-builder.md              # Terminal Builder architecture
│   ├── world-design-schema.md           # World design data schema
│   └── world-management.md              # World management system
│
├── framework/
│   ├── README.md                        # Framework overview
│   ├── quest-system.md                  # Quest framework internals
│   ├── quest-listeners.md               # Hook-based auto-tracking
│   └── behaviors.md                     # NPC behaviors
│
├── api/
│   ├── README.md                        # API overview
│   └── channel-contract.md              # WebSocket channel protocol
│
├── reference/
│   ├── game-client.md                   # Game client architecture
│   └── environmental-effects-reference.md
│
│ ═══ ADMIN - Operations & Security ═══
│
├── admin/
│   ├── dashboard.md                     # Admin UI guide
│   └── backup-restore.md               # Backup and restore procedures
│
├── operations/
│   ├── live-operations-guide.md         # Hot-reload, deployments, scaling
│   ├── monitoring.md                    # Monitoring and observability
│   ├── logging-guide.md                 # Logging practices
│   ├── mmorpg-operations-guide.md       # MMO operations reference
│   └── Loka_Quick_Reference.md          # Quick reference card
│
├── security/
│   └── README.md                        # Auth, rate limiting, sandbox
│
│ ═══ CROSS-CUTTING ═══
│
├── guides/
│   ├── README.md                        # Human oversight guide
│   ├── ai-workflow-guide.md             # AI-assisted development guide
│   ├── reviewing-changes.md             # Code review checklist
│   ├── common-workflows.md              # How to ask Claude for tasks
│   ├── llm-development-stability.md     # LLM development patterns
│   └── troubleshooting.md              # When things go wrong
│
├── ui/
│   ├── ui-design-brief.md              # Complete UI design reference
│   ├── living-ebook-style-guide.md      # Visual design guide
│   └── accessibility.md                # Accessibility guidelines
│
├── testing/
│   └── bot-migration-guide.md           # Test bot documentation
│
├── development/
│   ├── content-generators-guide.md      # Content generation tools
│   └── git-hooks.md                     # Git hooks configuration
│
├── templates/
│   └── WORLD-DESIGN-TEMPLATE.md         # World design template
│
│ ═══ PLANNING & RESEARCH ═══
│
├── proposals/
│   ├── README.md                        # Proposals index
│   ├── builder-content-layer.md         # DB storage for builders
│   ├── collaborative-planet-economy.md
│   ├── community-relay-infrastructure.md
│   ├── cozy-gaming-design.md
│   ├── decentralized-autonomous-worlds.md
│   ├── encrypted-p2p-communication.md
│   ├── ops-tui-tool.md
│   ├── spark-companion-system.md
│   ├── stat-skill-system-design.md
│   ├── tcm-herb-system-revamp.md
│   └── archived/
│       ├── rust-book-client.md
│       └── rust-book-client-mvp-plan.md
│
├── product/
│   ├── README.md                        # Product docs index
│   ├── world-platform.md               # Platform vision
│   ├── ai-resilience-strategy.md
│   ├── calm-monetization-strategies.md
│   ├── funding-research.md
│   ├── llm-monetization-ideation.md
│   ├── monetization-comparison.md
│   ├── monetization-ideas.md
│   └── open-product-questions.md
│
├── research/
│   ├── mud-engine-analysis.md           # MUD engine comparison
│   ├── scripting-systems-deep-dive.md
│   └── user-research-anecdotes.md
│
├── external-references/                 # MUD design lecture notes
│   ├── LECTURE-SUMMARIES-INDEX.md
│   └── 01-08-lecture-*.md               # 8 lecture summaries
│
├── devlog/
│   ├── DEVELOPMENT_LOG.md               # Internal dev log
│   ├── BLOG_POSTS.md                    # Blog content
│   └── PUBLIC_DEVLOG.md                 # Public updates
│
├── audits/
│   ├── world-builder-audit-2026-01-08.md
│   └── world-builder-action-items.md
│
│ ═══ COMPREHENSIVE REFERENCES ═══
│
├── Loka_Engine_Architecture.md          # Full 200KB spec (historical)
├── LOKA_SYSTEM_STUDY_GUIDE.md           # Learning guide
├── BACKLOG.md                           # Planned work
├── LOAD_TESTING_PLAN.md                 # Performance testing
└── decisions/
    └── 2026-01-26-godot-client-migration.md
```

## Quick Reference by Task

### Building Content
| Task | Start Here |
|------|------------|
| Create a quest | `builder-reference/quest-reference.md` |
| Add NPC dialogue | `builder-reference/dialogue-reference.md` |
| Create entities (NPCs, items, rooms) | `builder-reference/entity-reference.md` |
| Fix broken quest/dialogue | `builder-reference/quest-dialogue-patterns.md` |
| Monastery Arc lore | `game/monastery-arc/lore-bible.md` |

### Developing Engine
| Task | Start Here |
|------|------------|
| Understand entity system | `architecture/entity-system.md` |
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

## See Also

- `CLAUDE.md` - Project overview and development guide
- `.claude/rules/` - Path-scoped development rules
- `.claude/skills/` - Reusable development patterns
- `.claude/commands/` - Available slash commands
