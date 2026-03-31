# Loka

A text-based RPG engine built with Elixir/Phoenix and React Native. Leverages Elixir's OTP concurrency, fault tolerance, and real-time Phoenix Channels for modern MUD development.

## What is Loka?

Loka is a MUD (Multi-User Dungeon) engine framework for building text-based RPGs. It provides:

- **Entity-Component-Behavior architecture** - Composition over inheritance for flexible game objects
- **Prototype system** - YAML templates with inheritance for rapid content creation
- **Real-time multiplayer** - Phoenix Channels for instant updates across all clients
- **Web and mobile clients** - Admin LiveView dashboard + React Native (Expo) mobile client
- **Sandboxed scripting** - Elixir-based scripting for game customization
- **Quest and dialogue systems** - Built-in support for narrative content

## Project Structure

```
lokacore/
├── server/           # Elixir/Phoenix backend
│   ├── lib/loka/     # Game engine and framework
│   └── priv/world/   # YAML game content (prototypes, quests, dialogues)
├── rn-client/        # React Native (Expo) mobile client
└── docs/             # Architecture documentation
```

## Quick Start

### Clone the Repository

```bash
# Fast clone (~2 MB, latest code only)
git clone --depth 1 https://github.com/lorecrafting/lokacore.git

# Full clone with history (~5 MB)
git clone https://github.com/lorecrafting/lokacore.git
```

### Prerequisites

- **Elixir** 1.19+ ([install guide](https://elixir-lang.org/install.html))
- **Node.js** 18+ (for assets and React Native)
- **SQLite** 3.x
- **Git LFS** (for audio assets): `brew install git-lfs && git lfs install`

### Server Setup

```bash
cd server

# Install dependencies
mix deps.get
npm install --prefix assets

# Setup database
mix ecto.setup

# Start server
mix phx.server
```

Server runs at http://localhost:4000. Admin dashboard at http://localhost:4000/admin.

### React Native Client Setup

```bash
cd rn-client

# Install dependencies
npm install

# Start Expo dev server
npm start

# iOS simulator
npm run ios

# Android emulator
npm run android
```

## Architecture

Loka is organized in layers from content to platform:

```
┌─────────────────────────────────────────────────────────────┐
│ GAME CONTENT (priv/world/)                                  │
│   YAML prototypes (rooms, NPCs, items) + quests, dialogues  │
│   Seeded into SQLite on boot via EntitySeeder               │
├─────────────────────────────────────────────────────────────┤
│ GAME FRAMEWORK (lib/loka/framework/)                        │
│   Combat, Inventory, Quest, Skills, StateMachine            │
│   Shared StateMachine engine for quests/combat/dialogue     │
├─────────────────────────────────────────────────────────────┤
│ ENGINE CORE (lib/loka/engine/)                              │
│   Entities, EntityServer, EntitySeeder, Spawner             │
│   SQLite is single source of truth — no ETS dual-store      │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM                                                    │
│   Phoenix 1.8, LiveView, Ecto + SQLite                      │
└─────────────────────────────────────────────────────────────┘
```

**Key design principles:**

- **Everything is an entity** — rooms, NPCs, items, quests, skills, dialogues all unified
- **Components as JSON** — all game data lives in `entity.components` (no separate EAV tables)
- **GenServer per entity** — active entities are supervised OTP processes with auto-save
- **Traits** — `entity.traits` lists behavior modules or Elixir script maps for NPC AI
- **StateMachine engine** — shared state engine drives quests, combat, dialogue, crafting
- **Flat YAML prototypes** — self-contained templates, no inheritance, seeded to DB on boot

### Process Supervision Tree

```
Loka.Application (~50 supervised children)
       │
  ┌────┴────────────────────────────────┐
  │                                     │
Hooks / Seeder / Registry       EntitySupervisor (DynamicSupervisor)
                                         │
                              ┌──────────┼──────────┐
                              │          │          │
                         EntityServer EntityServer  ...
                          (room:1)    (npc:5)
                              │
                         Traits (on_tick/on_event)
                         StateMachine
```

### Codebase Metrics

| Category | Count | Location |
|----------|-------|----------|
| Engine Core | 24 modules | `lib/loka/engine/` |
| Components | 24 modules | `lib/loka/components/` |
| Framework | 52 modules | `lib/loka/framework/` |
| Content API | 12 modules | `lib/loka/content/` |
| YAML Content | ~286 files | `priv/world/` |
| Tests | ~2,319 tests | `test/` |

### Architecture Docs

| Topic | Doc |
|-------|-----|
| Entity system | [docs/architecture/entity-system.md](docs/architecture/entity-system.md) |
| Entity lifecycle & GenServer | [docs/architecture/entity-lifecycle.md](docs/architecture/entity-lifecycle.md) |
| Unified entity system (V2 design) | [docs/architecture/unified-object-system-v2.md](docs/architecture/unified-object-system-v2.md) |
| Elixir scripting | [docs/architecture/elixir-scripts-design.md](docs/architecture/elixir-scripts-design.md) |
| Events & PubSub | [docs/architecture/events.md](docs/architecture/events.md) |
| Architecture diagrams | [docs/architecture/diagrams.md](docs/architecture/diagrams.md) |
| Channel API contract | [docs/api/channel-contract.md](docs/api/channel-contract.md) |
| Framework subsystems | [docs/framework/README.md](docs/framework/README.md) |
| Full architecture index | [docs/architecture/README.md](docs/architecture/README.md) |

## Development

See `CLAUDE.md` for the comprehensive development guide, including architecture details, all routes and API endpoints, test commands, deployment, and coding conventions.

### Running Tests

```bash
cd server

# Run all tests
mix test

# Validate game content (prototypes, quests, dialogues)
mix loka.test.validate

# Run full test suite including content validation
mix loka.test
```

## Documentation

Organized by [traditional MUD roles](docs/README.md):

| Role | Directory | Content |
|------|-----------|---------|
| **Builder** | [docs/builder-reference/](docs/builder-reference/) | YAML specs (quests, dialogues, entities) |
| **Developer** | [docs/architecture/](docs/architecture/), [docs/framework/](docs/framework/) | Elixir code, system design |
| **Admin** | [docs/admin/](docs/admin/), [docs/operations/](docs/operations/) | Dashboard, live ops, security |

## Deployment

Designed for [Fly.io](https://fly.io) deployment:

```bash
fly deploy
```

## Acknowledgments

Special thanks to the [Evennia](https://github.com/evennia/evennia) project and community. Evennia's pioneering work in Python MUD development provided invaluable inspiration and learning. If you're building a MUD in Python, Evennia is an excellent choice.

## License

MIT
