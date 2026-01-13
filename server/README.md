# Loka Server

[![Issues tracked with beads](https://img.shields.io/badge/issues-beads-blue)](https://github.com/anthropics/beads)

An Elixir MUD (Multi-User Dungeon) engine framework for building text-based RPGs. Leverages Elixir's strengths: OTP concurrency, fault tolerance, and real-time LiveView.

## Quick Start

```bash
# Install dependencies
mix deps.get

# Setup database
mix ecto.create && mix ecto.migrate

# Start server
mix phx.server
```

Visit [`localhost:4000`](http://localhost:4000) to see the landing page.

## Routes

| Path | Description | Auth Required |
|------|-------------|---------------|
| `/` | Landing page | No |
| `/game` | Game client (Living Ebook UI) | Yes |
| `/admin` | Admin dashboard | Yes (admin) |
| `/players/register` | Create account | No |
| `/players/log-in` | Login | No |

## Project Structure

```
lib/
├── loka/
│   ├── accounts/      # Player auth (phx.gen.auth + magic link)
│   ├── auth/          # Guardian JWT for API
│   ├── engine/        # Core: entities, behaviors, commands, hooks
│   └── framework/     # Game systems: combat, quests, inventory, etc.
├── loka_web/
│   ├── controllers/   # REST API
│   └── live/          # LiveView clients (game, admin)
priv/
└── world/
    └── prototypes/    # YAML entity templates (rooms, NPCs, items)
```

## Key Commands

```bash
# Development
mix phx.server           # Start server
mix test                 # Run tests
mix format               # Format code

# Database
mix ecto.migrate         # Run migrations
mix ecto.reset           # Reset database

# Deployment (Fly.io)
fly deploy               # Deploy to production
fly logs                 # View logs
```

## Architecture

- **Entity-Component-Behavior**: Composition over inheritance
- **Prototype System**: YAML templates with inheritance for game content
- **GenServer per Entity**: Active entities are supervised processes
- **Event Bus**: Phoenix.PubSub for entity communication
- **Hooks**: 22 lifecycle event types for extensibility

See `CLAUDE.md` in the project root for comprehensive development documentation.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Elixir 1.19 / Phoenix 1.8 |
| Real-time | Phoenix LiveView |
| Database | SQLite (via ecto_sqlite3) |
| Auth | phx.gen.auth + Guardian JWT |
| Scripting | Lua (via Luerl) |
| Deployment | Fly.io |

## Tests

```bash
mix test                    # Run all tests
mix test --cover            # With coverage
mix test path/to/test.exs   # Specific file
```
