# Loka Quick Reference

## Cost Summary

| Component | Monthly Cost |
|-----------|--------------|
| Fly.io VM (shared-cpu-1x, 512MB) | ~$5 |
| Fly.io Volume (1GB) | $0.15 |
| **Total** | **~$5/month** |

## Tech Stack

```
+----------------------------------+
|          CLIENTS                 |
|  Godot 4.6 (Mobile/Web)          |
|  Phoenix LiveView (Admin)        |
|  - Admin Dashboard (/admin)      |
|  - Terminal Builder (/admin/builder)    |
+----------------+-----------------+
                 |
            WebSocket
                 |
+----------------v-----------------+
|       FLY.IO MACHINE (~$5/mo)    |
|                                  |
|  +----------------------------+  |
|  |     PHOENIX SERVER         |  |
|  |  - Magic Link Auth         |  |
|  |  - Guardian JWT (API)      |  |
|  |  - LiveView                |  |
|  |  - REST API                |  |
|  +-------------+--------------+  |
|                |                 |
|         Ecto (SQLite)           |
|                |                 |
|  +-------------v--------------+  |
|  |    SQLite + Fly Volume     |  |
|  |    /data/loka.db          |  |
|  +----------------------------+  |
+----------------------------------+
```

## What We're NOT Using

| Removed | Reason |
|---------|--------|
| PostgreSQL | Costs $15+/month extra |
| Redis | ETS handles caching for now |
| Native Mobile Apps | Web-first approach (shelved for now) |

## Quick Setup Commands

```bash
# Server setup
cd server
mix deps.get
mix ecto.create && mix ecto.migrate
mix phx.server  # Visit localhost:4000

# Run tests
mix test

# Fly.io deployment
fly launch --name loka --region sjc --no-deploy
fly volumes create loka_data --region sjc --size 1
fly secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)
fly secrets set GUARDIAN_SECRET_KEY=$(mix phx.gen.secret)
fly deploy
```

## fly.toml (Key Settings)

```toml
app = "loka"
primary_region = "sjc"

[mounts]
  source = "loka_data"
  destination = "/data"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

## Key Commands

```bash
# Development
mix phx.server                    # Start server at localhost:4000

# Testing
mix test                          # Run all tests

# Deployment
fly deploy                        # Deploy to Fly.io

# Debugging
fly logs -a loka                 # Stream server logs
fly ssh console -a loka          # SSH into server
sqlite3 /data/loka.db            # SQLite CLI (inside SSH)

# Backup
fly ssh console -C "sqlite3 /data/loka.db '.backup /data/backup.db'"
fly sftp get /data/backup.db      # Download locally
```

## Routes

| Path | Description | Auth |
|------|-------------|------|
| `/` | Landing page | No |
| `/game` | Game client (Living Ebook UI) | Yes |
| `/admin` | Admin dashboard (6 tabs) | Yes (admin) |
| `/players/register` | Register account | No |
| `/players/log-in` | Login page | No |

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/health` | Health check | No |
| POST | `/api/v1/auth/register` | Register player | No |
| POST | `/api/v1/auth/login` | Login (returns JWT) | No |
| GET | `/api/v1/auth/me` | Get current player | Bearer |

## Data Flow

```
1. REAL-TIME (Phoenix LiveView)
   - Game interactions
   - Room updates
   - Combat
   - NPC dialogue

2. REST API (Phoenix Controllers)
   - Auth (login/register)
   - Account settings

3. PERSISTENCE (Ecto + SQLite)
   - Player accounts
   - Game state
   - Entity data (via EAV pattern)
   - World prototypes (YAML)
```

## When to Upgrade

| Trigger | Action |
|---------|--------|
| Need multiple servers | Add PostgreSQL + Redis |
| 10K+ concurrent users | Consider distributed architecture |
| Social login demand | Add Ueberauth |
| Full-text search | Enable SQLite FTS5 (built-in) |

## Project Structure

```
lokacore/
├── server/                    # Elixir/Phoenix
│   ├── lib/loka/
│   │   ├── accounts/          # Auth (phx.gen.auth)
│   │   ├── auth/              # Guardian JWT
│   │   ├── engine/            # Core engine (entities, spawner, etc.)
│   │   └── framework/         # Game systems (combat, quests, etc.)
│   ├── lib/loka_web/
│   │   ├── controllers/       # REST API
│   │   └── live/              # LiveView (game_live, admin_live)
│   ├── priv/world/            # YAML prototypes
│   ├── config/
│   ├── fly.toml
│   └── Dockerfile
├── docs/                      # Architecture documentation
├── .github/workflows/
│   └── server-ci.yml          # CI/CD to Fly.io
└── CLAUDE.md                  # Development guide
```
