# CLAUDE.md - ExMUD Development Guide

## Project Overview

**ExMUD** is an Elixir MUD (Multi-User Dungeon) engine framework for building text-based RPGs. It's a framework like Evennia (Python), but leveraging Elixir's strengths: OTP concurrency, fault tolerance, and real-time LiveView.

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Elixir/Phoenix | 1.8.3 |
| Real-time | Phoenix LiveView + Channels | 1.1.19 |
| Database | SQLite (via Ecto) | ecto_sqlite3 |
| Auth | phx.gen.auth (magic link) + Guardian (JWT) | 2.4.0 |
| Scripting | Lua (via Luerl) | 1.5.1 |
| Mobile | React Native/Expo | SDK 54 |
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
│   ├── server/                     # Elixir/Phoenix
│   │   ├── lib/exmud/
│   │   │   ├── accounts/           # Auth (phx.gen.auth)
│   │   │   ├── auth/               # Guardian JWT
│   │   │   ├── engine/             # Core engine
│   │   │   │   ├── entity.ex       # Entity struct
│   │   │   │   ├── event.ex        # Event struct
│   │   │   │   ├── event_bus.ex    # PubSub wrapper
│   │   │   │   ├── command.ex      # Command behaviour
│   │   │   │   ├── behavior.ex     # Behavior protocol
│   │   │   │   └── scripting.ex    # Lua sandbox
│   │   │   └── release.ex          # Release tasks
│   │   ├── lib/exmud_web/
│   │   │   ├── controllers/api/    # REST API
│   │   │   ├── plugs/              # Auth pipeline
│   │   │   └── live/               # LiveView
│   │   ├── config/
│   │   ├── fly.toml
│   │   └── Dockerfile
│   └── mobile/                     # React Native/Expo
│       ├── src/
│       │   ├── screens/            # Login, Register, Game
│       │   ├── services/           # API, Socket
│       │   ├── store/              # Zustand state
│       │   └── hooks/
│       ├── app.json
│       └── eas.json
├── .github/workflows/
│   ├── server-ci.yml               # Fly.io deploy on push
│   └── mobile-preview.yml          # EAS preview builds
└── CLAUDE.md
```

## Quick Commands

```bash
# Server Development
cd apps/server
mix deps.get                       # Install dependencies
mix ecto.create && mix ecto.migrate # Setup database
mix phx.server                     # Start server at localhost:4000
mix test                           # Run tests

# Mobile Development
cd apps/mobile
npm install                        # Install dependencies
npx expo start                     # Start Expo dev server

# Deployment (requires secrets setup)
cd apps/server
fly deploy                         # Deploy to Fly.io

cd apps/mobile
eas build --profile preview        # Build preview for testing
```

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
- `EXPO_TOKEN` - Expo token for EAS builds

## Key Design Decisions

1. **SQLite over PostgreSQL**: Simpler, cheaper, sufficient for single-server MVP
2. **No Redis**: ETS handles caching until multi-server is needed
3. **Lua for Scripting**: Safe sandbox for game creators to customize NPCs/quests
4. **LiveView for Web**: Native real-time, no separate frontend build
5. **Channels for Mobile**: JWT auth + WebSocket for React Native client
6. **Magic Link Auth**: Phoenix 1.8 default, password optional

## Development Guidelines

- Entities are data structs, behaviors are modules implementing callbacks
- Use PubSub topics: `room:{id}`, `player:{id}`, `entity:{id}`, `events:global`
- Commands return `{:ok, [Event.t()]}` - never mutate state directly
- Scripts execute in sandboxed Lua with CPU/memory limits
- Auto-save dirty entities every 5 minutes

## Testing

```bash
# Run all server tests
cd apps/server && mix test

# Run specific test file
mix test test/exmud/engine/entity_test.exs

# Run with coverage
mix test --cover
```

## References

- `ExMUD_Engine_Architecture.md` - Full technical specification
- `ExMUD_Quick_Reference.md` - Setup commands and cost summary
