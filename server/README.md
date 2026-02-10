# Loka Server

The Elixir/Phoenix backend for Loka, a MUD engine framework for building text-based RPGs.

## Setup

```bash
# Install dependencies
mix deps.get
npm install --prefix assets

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
| `/admin` | Admin dashboard | Yes (admin) |
| `/admin/builder` | MUD terminal builder (content creation) | Yes (admin) |
| `/client/auth/login` | Game client auth (magic link to JWT deep link) | No |

The main game client is the Godot 4.6 app, which connects via Phoenix Channels (WebSocket).

## Key Commands

```bash
# Development
mix phx.server           # Start server
mix test                 # Run tests
mix format               # Format code

# Content validation
mix loka.test.validate   # Validate prototypes, quests, dialogues
mix loka.validate.yaml   # Quick YAML syntax check

# Database
mix ecto.migrate         # Run migrations
mix ecto.reset           # Reset database
```

## Project Structure

```
lib/
├── loka/
│   ├── accounts/      # Player auth (phx.gen.auth + magic link)
│   ├── auth/          # Guardian JWT for API
│   ├── engine/        # Core: entities, behaviors, commands, hooks
│   ├── content/       # Content modules (Quest, Dialogue, Script, Zone)
│   └── framework/     # Game systems: combat, quests, inventory, etc.
├── loka_web/
│   ├── channels/      # Phoenix Channels (game, builder)
│   ├── controllers/   # REST API
│   └── live/          # LiveView (admin dashboard, builder terminal)
priv/
└── world/
    └── ...            # YAML game content (prototypes, quests, zones, dialogues, scripts)
```

## Documentation

See `CLAUDE.md` in the project root for the comprehensive development guide covering architecture, patterns, commands, and deployment.
