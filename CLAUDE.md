# CLAUDE.md - ExMUD Development Guide

## Project Overview

**ExMUD** is an Elixir MUD (Multi-User Dungeon) engine framework for building text-based RPGs. It's a framework like Evennia (Python), but leveraging Elixir's strengths: OTP concurrency, fault tolerance, and real-time LiveView.

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Elixir/Phoenix | 1.19.4 / Phoenix 1.8.3 |
| Runtime | Erlang/OTP | 28.3 |
| Real-time | Phoenix LiveView | 1.1.19 |
| Database | SQLite (via Ecto) | ecto_sqlite3 |
| Auth | phx.gen.auth (magic link) + Guardian (JWT) | 2.4.0 |
| Scripting | Lua (via Luerl) | 1.5.1 |
| Deployment | Fly.io | ~$5/month |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ GAME CONTENT                                                │
│   priv/world/prototypes/ (YAML files)                       │
│   Rooms, NPCs, Items, Exits - defined without code          │
├─────────────────────────────────────────────────────────────┤
│ GAME FRAMEWORK (lib/exmud/framework/)                       │
│   Combat, Quests, Inventory, Progression, Dialogue          │
│   Player state, Room loading for UI                         │
├─────────────────────────────────────────────────────────────┤
│ ENGINE CORE (lib/exmud/engine/)                             │
│   Entities, EntityServer, Registry, Supervisor              │
│   Prototypes, Spawner, WorldLoader                          │
│   Events, Commands, Behaviors, Hooks, Locks, Scripting      │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM                                                    │
│   Phoenix 1.8, LiveView, Ecto + SQLite                      │
└─────────────────────────────────────────────────────────────┘
```

### Core Patterns

- **Entity-Component-Behavior**: Composition over inheritance. Entities are data containers, components hold state, behaviors define logic.
- **Prototype System**: YAML templates with inheritance define game content without code changes.
- **GenServer per Entity**: Active entities (rooms, NPCs) are supervised processes with auto-save and lazy loading.
- **Event Bus**: Phoenix.PubSub for entity communication.
- **Command Pipeline**: Parse → Validate → Execute → Emit Events.
- **Hooks**: 22 lifecycle event types for extensibility.
- **Locks**: Evennia-style string-based access control.

## Project Structure

```
lokacore/
├── server/                             # Elixir/Phoenix
│   ├── lib/exmud/
│   │   ├── accounts/               # Auth (phx.gen.auth + is_admin)
│   │   ├── auth/                   # Guardian JWT
│   │   ├── ecto/                   # Custom Ecto types
│   │   ├── engine/                 # Core engine (see Engine section below)
│   │   ├── framework/              # Game framework systems
│   │   │   ├── combat/             # Combat + spawner
│   │   │   ├── dialogue/           # NPC dialogue trees
│   │   │   ├── inventory/          # Inventory + equipment
│   │   │   ├── progression/        # XP, levels, skills
│   │   │   ├── quest/              # Quest system
│   │   │   ├── player/             # Player game state
│   │   │   └── world/              # Room loader for UI
│   │   ├── utils/                  # Utility helpers
│   │   └── release.ex              # Release tasks
│   ├── lib/exmud_web/
│   │   ├── controllers/api/        # REST API
│   │   ├── plugs/                  # Auth pipeline + RequireAdmin
│   │   └── live/                   # LiveView clients
│   │       ├── game_live.ex        # Game client (players)
│   │       └── admin_live.ex       # Admin dashboard (6 tabs)
│   ├── priv/world/                     # Game content (YAML)
│   │   └── prototypes/             # Entity templates
│   │       ├── _base/              # Base prototypes (parents)
│   │       ├── rooms/              # Room definitions
│   │       ├── npcs/               # NPC definitions
│   │       ├── items/              # Item definitions
│   │       └── exits/              # Exit definitions
│   ├── assets/js/app.js            # JS hooks for LiveView
│   ├── config/
│   ├── fly.toml
│   └── Dockerfile
├── docs/                               # Architecture documentation
│   ├── architecture/
│   │   ├── README.md               # Overview and navigation
│   │   ├── entity-system.md        # Entity-Component-Behavior
│   │   ├── entity-lifecycle.md     # Registry, Server, Supervisor
│   │   ├── prototypes.md           # Prototype system, YAML format
│   │   ├── hooks-and-locks.md      # Hooks & access control
│   │   ├── persistence.md          # Evennia-style DB design
│   │   ├── events.md               # Event bus, PubSub
│   │   ├── scripting.md            # Lua sandbox
│   │   └── commands.md             # Command pipeline
│   ├── admin/
│   │   └── dashboard.md            # Admin interface guide
│   └── ui/
│       └── living-ebook-style-guide.md  # UI style guide
├── _shelved/
│   └── mobile/                     # Shelved React Native app
├── .github/workflows/
│   └── server-ci.yml               # Fly.io deploy on push
└── CLAUDE.md
```

### Engine Directory (`lib/exmud/engine/`)

```
engine/
├── schema/                   # Ecto schemas
│   ├── entity_schema.ex      # Entity DB schema
│   ├── entity_attribute.ex   # EAV attributes
│   └── script_schema.ex      # Lua scripts
├── entity.ex                 # Entity struct (composition-based)
├── entities.ex               # Entity CRUD context
├── entity_server.ex          # GenServer for active entities
├── entity_registry.ex        # Process lookup + room broadcast
├── entity_supervisor.ex      # DynamicSupervisor for entities
├── prototype.ex              # Template struct with inheritance
├── prototype_loader.ex       # YAML → ETS prototype loading
├── spawner.ex                # Create entities from prototypes
├── world_loader.ex           # BFS world spawn from prototypes
├── world_exporter.ex         # Export entities to YAML
├── event.ex                  # Event struct
├── event_bus.ex              # PubSub wrapper
├── command.ex                # Command behaviour
├── behavior.ex               # Behavior protocol
├── hooks.ex                  # Lifecycle callbacks (22 types)
├── locks.ex                  # Evennia-style access control
├── scripting.ex              # Lua sandbox
├── scripts.ex                # Script CRUD context
└── text_parser.ex            # MUD text markup → HTML
```

## Web Clients

### Game Client (`/game`)
- **"Living Ebook" aesthetic** - Literary, book-like interface
- Touch/click-based interactions (no text input)
- Serif typography (Crimson Text), grayscale only
- Underlined text for interactive elements
- Context panel for entity interactions
- Compass navigation for room movement
- See `docs/ui/living-ebook-style-guide.md` for UI standards
- Accessible at: `http://localhost:4000/game` (requires login)

### Admin Dashboard (`/admin`)
- **Dashboard Tab**: Real-time stats (players, rooms, entities, scripts)
- **Players Tab**: List, toggle admin, delete players
- **Rooms Tab**: CRUD for room entities
- **Entities Tab**: CRUD for NPCs, items, exits
- **Scripts Tab**: Lua script editor with test execution
- **System Tab**: Export/import world data, reload scripts
- Accessible at: `http://localhost:4000/admin` (requires admin role)

## Quick Commands

```bash
# Server Development
cd server
mix deps.get                       # Install dependencies
mix ecto.create && mix ecto.migrate # Setup database
mix phx.server                     # Start server at localhost:4000
mix test                           # Run tests

# Deployment (requires secrets setup)
cd server
fly deploy                         # Deploy to Fly.io
```

## Routes

| Path | Description | Auth |
|------|-------------|------|
| `/` | Landing page | No |
| `/game` | Game client | Yes |
| `/admin` | Admin dashboard | Yes (admin) |
| `/players/register` | Register account | No |
| `/players/log-in` | Login page | No |

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/health` | Health check | No |
| POST | `/api/v1/auth/register` | Register player | No |
| POST | `/api/v1/auth/login` | Login (returns JWT) | No |
| GET | `/api/v1/auth/me` | Get current player | Bearer |

## Environment Variables (Production)

### Server (Fly.io Secrets)
```bash
fly secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)
fly secrets set GUARDIAN_SECRET_KEY=$(mix phx.gen.secret)
```

### GitHub Actions Secrets
- `FLY_API_TOKEN` - Fly.io API token for deployments

## Key Design Decisions

1. **Web-First**: LiveView for all clients (game + admin) - single codebase, instant updates, no App Store fees
2. **SQLite over PostgreSQL**: Simpler, cheaper, sufficient for single-server MVP
3. **No Redis**: ETS handles caching until multi-server is needed
4. **Lua for Scripting**: Safe sandbox for game creators to customize NPCs/quests
5. **Magic Link Auth**: Phoenix 1.8 default, password optional
6. **Mobile-Responsive**: Web app works great on phones, native apps shelved for now

## Development Guidelines

- Entities are data structs, behaviors are modules implementing callbacks
- Use PubSub topics: `room:{id}`, `player:{id}`, `entity:{id}`, `events:global`
- Commands return `{:ok, [Event.t()]}` - never mutate state directly
- Scripts execute in sandboxed Lua with CPU/memory limits
- Auto-save dirty entities every 60 seconds (via EntityServer)
- LiveViews are in `lib/exmud_web/live/`
- JS hooks are in `assets/js/app.js`

## Prototype System

Game content is defined in YAML files (`priv/world/prototypes/`) without code changes:

```yaml
# Example: priv/world/prototypes/npcs/goblin.yml
key: goblin
parent: base_npc          # Inherits from _base/base_npc.yml
type: npc
name: "Goblin"
description: "A sneaky green creature"
components:
  combatant:
    health: { current: 30, max: 30 }
    stats: { str: 8, dex: 14 }
tags: [hostile, monster]
```

- **PrototypeLoader**: Loads YAML into ETS on startup, supports hot-reload
- **Spawner**: Creates entities from prototypes with optional overrides
- **WorldLoader**: BFS traversal to spawn entire world from starting room
- **WorldExporter**: Serializes live entities back to YAML for backup

## Entity Lifecycle

Entities use lazy loading - processes only created when accessed:

```
1. Prototype (YAML) → Spawner.spawn() → Entity in DB
2. EntityRegistry.get_or_start(id) → EntityServer process starts
3. EntityServer loads from DB, holds state in memory
4. Auto-save every 60s if dirty, hibernate after 2min idle
5. Stop after 5min idle → final save → process removed
```

- **EntityServer**: GenServer holding entity state, periodic saves
- **EntityRegistry**: Process lookup, room-based broadcasting
- **EntitySupervisor**: DynamicSupervisor for fault tolerance

## Hooks & Locks

**Hooks** - 22 lifecycle event types for extensibility:
```elixir
# Register a hook
Hooks.register(:at_entity_creation, MyModule, :on_create, priority: 10)

# Hook types: :at_entity_creation, :at_before_move, :at_after_attack,
#             :at_damage, :at_death, :at_pre_command, etc.
```

**Locks** - Evennia-style string-based access control:
```elixir
# Lock string format
"perm(admin) OR id(owner123)"
"has_key(gold_key) AND attr_gt(strength, 50)"

# Check access
Locks.check(entity, accessor, "get")  # :ok | {:denied, reason}
```

## Testing

```bash
# Run all server tests
cd server && mix test

# Run specific test file
mix test test/exmud/engine/entity_test.exs

# Run with coverage
mix test --cover
```

## Shelved Code

The `_shelved/` directory contains code that's been deferred:
- `_shelved/mobile/` - React Native/Expo app (shelved in favor of web-first approach)

This code is kept for reference and potential future use when native mobile apps become necessary.

## References

### Architecture Documentation
- `docs/architecture/README.md` - Architecture overview and index
- `docs/architecture/entity-system.md` - Entity-Component-Behavior pattern
- `docs/architecture/entity-lifecycle.md` - Registry, Server, Supervisor
- `docs/architecture/prototypes.md` - Prototype system, YAML format
- `docs/architecture/hooks-and-locks.md` - Hooks & access control
- `docs/architecture/persistence.md` - Evennia-style database design
- `docs/architecture/events.md` - Event bus and PubSub patterns
- `docs/architecture/scripting.md` - Lua scripting sandbox
- `docs/architecture/commands.md` - Command pipeline

### UI & Design
- `docs/ui/living-ebook-style-guide.md` - **UI style guide for game client**

### Admin & Quick Reference
- `docs/admin/dashboard.md` - Admin dashboard guide
- `ExMUD_Quick_Reference.md` - Setup commands and cost summary
- `ExMUD_Engine_Architecture.md` - Full technical specification (200KB)
