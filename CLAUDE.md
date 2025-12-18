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
┌─────────────────────────────────────────┐
│ GAME CONTENT (Worlds, NPCs, Quests)     │
├─────────────────────────────────────────┤
│ GAME FRAMEWORK (Combat, Skills, etc.)   │
├─────────────────────────────────────────┤
│ ENGINE CORE (Entities, Commands, Events)│
├─────────────────────────────────────────┤
│ PLATFORM (Phoenix, LiveView, Ecto)      │
└─────────────────────────────────────────┘
```

### Core Patterns

- **Entity-Component-Behavior**: Composition over inheritance. Entities are data containers, components hold state, behaviors define logic.
- **GenServer per Entity**: Active entities (rooms, NPCs) are supervised processes with auto-save.
- **Event Bus**: Phoenix.PubSub for entity communication.
- **Command Pipeline**: Parse → Validate → Execute → Emit Events.

## Project Structure

```
lokacore/
├── apps/
│   └── server/                     # Elixir/Phoenix
│       ├── lib/exmud/
│       │   ├── accounts/           # Auth (phx.gen.auth + is_admin)
│       │   ├── auth/               # Guardian JWT
│       │   ├── ecto/               # Custom Ecto types
│       │   │   └── term.ex         # Erlang term serialization
│       │   ├── engine/             # Core engine
│       │   │   ├── entity.ex       # Entity struct
│       │   │   ├── entities.ex     # Entity CRUD context
│       │   │   ├── scripts.ex      # Script CRUD context
│       │   │   ├── schema/         # Ecto schemas
│       │   │   │   ├── entity_schema.ex
│       │   │   │   ├── entity_attribute.ex
│       │   │   │   └── script_schema.ex
│       │   │   ├── event.ex        # Event struct
│       │   │   ├── event_bus.ex    # PubSub wrapper
│       │   │   ├── command.ex      # Command behaviour
│       │   │   ├── behavior.ex     # Behavior protocol
│       │   │   └── scripting.ex    # Lua sandbox
│       │   └── release.ex          # Release tasks
│       ├── lib/exmud_web/
│       │   ├── controllers/api/    # REST API
│       │   ├── plugs/              # Auth pipeline + RequireAdmin
│       │   └── live/               # LiveView clients
│       │       ├── game_live.ex    # Game client (players)
│       │       └── admin_live.ex   # Admin dashboard (6 tabs)
│       ├── assets/js/app.js        # JS hooks for LiveView
│       ├── config/
│       ├── fly.toml
│       └── Dockerfile
├── docs/                           # Architecture documentation
│   ├── architecture/
│   │   ├── README.md               # Overview and navigation
│   │   ├── entity-system.md        # Entity-Component-Behavior
│   │   ├── persistence.md          # Evennia-style DB design
│   │   ├── events.md               # Event bus, PubSub
│   │   ├── scripting.md            # Lua sandbox
│   │   └── commands.md             # Command pipeline
│   └── admin/
│       └── dashboard.md            # Admin interface guide
├── _shelved/
│   └── mobile/                     # Shelved React Native app
├── .github/workflows/
│   └── server-ci.yml               # Fly.io deploy on push
└── CLAUDE.md
```

## Web Clients

### Game Client (`/game`)
- Mobile-responsive LiveView interface
- Text-based MUD experience
- Real-time updates via Phoenix PubSub
- Command history with arrow keys
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
cd apps/server
mix deps.get                       # Install dependencies
mix ecto.create && mix ecto.migrate # Setup database
mix phx.server                     # Start server at localhost:4000
mix test                           # Run tests

# Deployment (requires secrets setup)
cd apps/server
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
- Auto-save dirty entities every 5 minutes
- LiveViews are in `lib/exmud_web/live/`
- JS hooks are in `assets/js/app.js`

## Testing

```bash
# Run all server tests
cd apps/server && mix test

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
- `docs/architecture/persistence.md` - Evennia-style database design
- `docs/architecture/events.md` - Event bus and PubSub patterns
- `docs/architecture/scripting.md` - Lua scripting sandbox
- `docs/architecture/commands.md` - Command pipeline

### Admin & Quick Reference
- `docs/admin/dashboard.md` - Admin dashboard guide
- `ExMUD_Quick_Reference.md` - Setup commands and cost summary
- `ExMUD_Engine_Architecture.md` - Full technical specification (200KB)
