# ExMUD Quick Reference - Simplified Architecture

## Cost Summary

| Component | Monthly Cost |
|-----------|--------------|
| Fly.io VM (shared-cpu-1x, 512MB) | ~$5 |
| Fly.io Volume (1GB) | $0.15 |
| **Total** | **~$5/month** |

## Tech Stack (Simplified)

```
+----------------------------------+
|          CLIENTS                 |
|  React Native (iOS + Android)   |
|  LiveView (Web)                  |
+----------------+-----------------+
                 |
            WebSocket
                 |
+----------------v-----------------+
|       FLY.IO MACHINE (~$5/mo)    |
|                                  |
|  +----------------------------+  |
|  |     PHOENIX SERVER         |  |
|  |  - Custom Auth (Guardian)  |  |
|  |  - Phoenix Channels        |  |
|  |  - LiveView                |  |
|  |  - REST API                |  |
|  +-------------+--------------+  |
|                |                 |
|         Ecto (SQLite)           |
|                |                 |
|  +-------------v--------------+  |
|  |    SQLite + Fly Volume     |  |
|  |    /data/exmud.db          |  |
|  +----------------------------+  |
+----------------------------------+
```

## What We're NOT Using

| Removed | Reason |
|---------|--------|
| PostgreSQL | Costs $15+/month extra |
| Supabase | External dependency, latency |
| ElectricSQL | Adds complexity, not needed yet |
| Redis | ETS handles caching for now |

## Quick Setup Commands

```bash
# 1. Create project
mkdir -p exmud/apps/{server,mobile}
cd exmud

# 2. Server setup
cd apps/server
mix phx.new . --app exmud --database sqlite --live
mix deps.get
mix phx.gen.auth Accounts Player players
# Add {:guardian, "~> 2.3"} to mix.exs
mkdir -p data
mix ecto.create && mix ecto.migrate

# 3. Mobile setup  
cd ../mobile
npx create-expo-app . --template expo-template-blank-typescript
npm install phoenix zustand @react-navigation/native react-native-iap
eas init

# 4. Fly.io setup
cd ../server
fly launch --name exmud --region sjc --no-deploy
fly volumes create exmud_data --region sjc --size 1
fly secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)
fly secrets set GUARDIAN_SECRET_KEY=$(mix phx.gen.secret)
fly deploy
```

## fly.toml (Key Settings)

```toml
app = "exmud"
primary_region = "sjc"

[mounts]
  source = "exmud_data"
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

## Database Config (config/runtime.exs)

```elixir
if config_env() == :prod do
  config :exmud, ExMUD.Repo,
    database: "/data/exmud.db",
    pool_size: 5
end
```

## Key Commands

```bash
# Development
mix phx.server                    # Start server
npx expo start                    # Start mobile

# Deployment
fly deploy                        # Deploy server
eas build --profile preview       # Build mobile

# Debugging
fly logs -a exmud                 # Stream server logs
fly ssh console -a exmud          # SSH into server
sqlite3 /data/exmud.db            # SQLite CLI (inside SSH)

# Backup
fly ssh console -C "sqlite3 /data/exmud.db '.backup /data/backup.db'"
fly sftp get /data/backup.db      # Download locally
```

## Auth Flow

```
Mobile App                    Phoenix Server
    |                              |
    |-- POST /api/v1/auth/login -->|
    |                              |-- Verify password
    |<-- JWT token + player -------|
    |                              |
    |-- WebSocket + token -------->|
    |                              |-- Validate JWT
    |<-- Channel joined -----------|
    |                              |
    |-- game:command ------------->|
    |<-- game:state_update --------|
```

## Data Flow

```
1. REAL-TIME (Phoenix Channels)
   - Game commands
   - Room updates
   - Chat messages
   - Combat

2. REST API (Phoenix Controllers)
   - Auth (login/register)
   - IAP verification
   - Account settings

3. PERSISTENCE (Ecto + SQLite)
   - Player accounts
   - Character saves
   - World definitions
   - Transactions
```

## When to Upgrade

| Trigger | Action |
|---------|--------|
| Need multiple servers | Add PostgreSQL + Redis |
| 10K+ concurrent users | Add ElectricSQL for caching |
| Social login demand | Add Ueberauth |
| Full-text search | Enable SQLite FTS5 (built-in) |

## File Structure

```
exmud/
├── apps/
│   ├── server/               # Elixir/Phoenix
│   │   ├── lib/exmud/
│   │   │   ├── accounts/     # Auth (phx.gen.auth)
│   │   │   ├── auth/         # Guardian JWT
│   │   │   ├── engine/       # Game engine
│   │   │   └── game/         # Game logic
│   │   ├── lib/exmud_web/
│   │   │   ├── channels/     # Phoenix Channels
│   │   │   ├── controllers/  # REST API
│   │   │   └── live/         # LiveView
│   │   ├── config/
│   │   ├── fly.toml
│   │   └── Dockerfile
│   └── mobile/               # React Native
│       ├── src/
│       │   ├── screens/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── services/
│       │   └── store/
│       ├── app.json
│       └── eas.json
├── .github/workflows/
│   ├── server-ci.yml
│   └── mobile-preview.yml
└── scripts/
    └── dev.sh
```

---

**Total complexity reduced by ~60%** compared to original architecture with PostgreSQL, Supabase, and ElectricSQL.
