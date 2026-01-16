# Loka Monitoring & Operations Guide

This document covers monitoring, health checks, telemetry, alerting, and operational procedures for Loka.

## Table of Contents

- [Health Check Endpoints](#health-check-endpoints)
- [Telemetry & Metrics](#telemetry--metrics)
- [PromEx Metrics](#promex-metrics)
- [Alerting](#alerting)
- [Logging](#logging)
- [Phoenix LiveDashboard](#phoenix-livedashboard)
- [Fly.io Operations](#flyio-operations)
- [Troubleshooting](#troubleshooting)

## Health Check Endpoints

Three endpoints are available for monitoring application health:

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/health` | Liveness check | `200 OK` if app is running |
| `GET /api/health/ready` | Readiness check | `200 OK` if dependencies healthy |
| `GET /api/health/detailed` | System metrics | Memory, processes, schedulers |

### Liveness Probe

**Endpoint**: `GET /api/health`

Basic check that the application is running. Use for container orchestration liveness probes.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**When to use**: Kubernetes/Fly.io liveness checks. If this fails, restart the container.

### Readiness Probe

**Endpoint**: `GET /api/health/ready`

Verifies critical dependencies are healthy. Use for readiness probes to determine if the app can serve traffic.

```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "pubsub": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Returns `503 Service Unavailable` if any check fails:

```json
{
  "status": "not_ready",
  "checks": {
    "database": false,
    "pubsub": true
  }
}
```

**When to use**: Load balancer health checks. Remove from rotation if not ready.

### Detailed Metrics

**Endpoint**: `GET /api/health/detailed`

Comprehensive system information for debugging and monitoring dashboards.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "elixir_version": "1.19.4",
  "otp_version": "28",
  "uptime_seconds": 3600,
  "memory": {
    "total_mb": 256.5,
    "processes_mb": 128.2,
    "ets_mb": 45.3
  },
  "processes": {
    "count": 1234,
    "limit": 262144
  },
  "schedulers": {
    "online": 4,
    "total": 4
  },
  "checks": {
    "database": true,
    "pubsub": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**When to use**: Monitoring dashboards, debugging performance issues.

### Fly.io Health Check Configuration

Health checks are configured in `fly.toml`:

```toml
[[http_service.checks]]
  interval = '30s'
  timeout = '5s'
  grace_period = '10s'
  method = 'GET'
  path = '/api/health'
```

## Telemetry & Metrics

Loka uses Elixir's Telemetry library for metrics collection. Metrics are viewable in Phoenix LiveDashboard during development.

### Available Metrics

#### Phoenix Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `phoenix.endpoint.stop.duration` | Summary | HTTP request duration |
| `phoenix.router_dispatch.stop.duration` | Summary | Route handler duration |
| `phoenix.socket_connected.duration` | Summary | WebSocket connection time |
| `phoenix.live_view.mount.stop.duration` | Summary | LiveView mount duration |
| `phoenix.live_view.handle_event.stop.duration` | Summary | LiveView event handling |

#### Database Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `loka.repo.query.total_time` | Summary | Total query execution time |
| `loka.repo.query.queue_time` | Summary | Time waiting for DB connection |
| `loka.repo.query.query_time` | Summary | Actual query execution time |

#### Game Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `loka.game.active_players.count` | Gauge | Currently active players |
| `loka.game.active_entities.count` | Gauge | Active entity processes |
| `loka.game.rooms_loaded.count` | Gauge | Room entities in memory |
| `loka.game.memory_mb` | Gauge | Total VM memory usage |
| `loka.game.commands.total` | Counter | Total commands executed |
| `loka.game.combat.started.total` | Counter | Combat encounters started |
| `loka.game.login.total` | Counter | Player logins |
| `loka.auth.rate_limited.total` | Counter | Rate-limited requests |

#### VM Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `vm.memory.total` | Summary | Total VM memory usage |
| `vm.total_run_queue_lengths.total` | Summary | Scheduler run queue length |

### Emitting Custom Events

Use the Telemetry module API to emit events:

```elixir
alias LokaWeb.Telemetry

# When a command is executed
Telemetry.emit_command(:look)

# When combat starts
Telemetry.emit_combat_started()

# When a player logs in
Telemetry.emit_login()

# When rate limiting kicks in
Telemetry.emit_rate_limited("/api/v1/auth/login")
```

## PromEx Metrics

Loka uses [PromEx](https://hexdocs.pm/prom_ex) for Prometheus metrics export.

**Endpoint**: `GET /metrics`

This endpoint exposes all metrics in Prometheus format for scraping.

### Available Metric Groups

| Plugin | Metrics |
|--------|---------|
| `Plugins.Application` | App info, uptime |
| `Plugins.Beam` | Memory, processes, schedulers, GC |
| `Plugins.Phoenix` | HTTP request duration, status codes |
| `Plugins.Ecto` | Query duration, queue time |
| `Plugins.PhoenixLiveView` | Mount/event duration |
| `Loka.PromEx.GamePlugin` | Game-specific metrics |

### Game-Specific Prometheus Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `loka_game_active_players_count` | Gauge | Currently connected players |
| `loka_game_active_entities_count` | Gauge | Active entity GenServer processes |
| `loka_game_rooms_loaded_count` | Gauge | Room entities in memory |
| `loka_game_memory_mb` | Gauge | Total VM memory usage |
| `loka_game_commands_total` | Counter | Commands executed (by type) |
| `loka_game_combat_started_total` | Counter | Combat encounters started |
| `loka_game_login_total` | Counter | Player logins |
| `loka_auth_rate_limited_total` | Counter | Rate-limited requests (by endpoint) |

### Metrics Authentication (Production)

Set `METRICS_AUTH_TOKEN` environment variable to require authentication:

```bash
fly secrets set METRICS_AUTH_TOKEN=$(openssl rand -hex 32)
```

Access metrics with bearer token:
```bash
curl -H "Authorization: Bearer $TOKEN" https://lokacore.fly.dev/metrics
```

### Grafana Cloud Setup

1. Create a Grafana Cloud account (free tier: 10k series)
2. Get Prometheus remote_write credentials
3. Set secrets:

```bash
fly secrets set PROMETHEUS_PUSH_GATEWAY_URL="https://prometheus-xxx.grafana.net/api/prom/push"
fly secrets set PROMETHEUS_PUSH_GATEWAY_AUTH="base64(user:api_key)"
```

4. Import PromEx dashboards via `mix prom_ex.dashboard.export`

### Self-Hosted Prometheus

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'loka'
    scheme: https
    bearer_token: 'your-metrics-auth-token'
    static_configs:
      - targets: ['lokacore.fly.dev']
    scrape_interval: 30s
    metrics_path: '/metrics'
```

## Posthog Analytics

Loka integrates with [Posthog](https://posthog.com) for product analytics and feature flags.

### Setup

1. Create a Posthog account at https://posthog.com
2. Get your Project API key from Settings
3. Set environment variable:

```bash
fly secrets set POSTHOG_API_KEY=phc_your_api_key
```

Optional: Set custom API URL for self-hosted:

```bash
fly secrets set POSTHOG_API_URL=https://your-posthog-instance.com
```

### Usage

```elixir
# Track events
Loka.Posthog.capture("player_123", "quest_completed", %{quest: "tutorial"})

# Identify users
Loka.Posthog.identify("player_123", %{email: "player@example.com"})

# Game-specific helpers
Loka.Posthog.track_login(player_id)
Loka.Posthog.track_command(player_id, :look)
Loka.Posthog.track_combat(player_id, :started, %{npc: "goblin"})
```

### Feature Flags

```elixir
# Check if feature is enabled
if Posthog.feature_flag_enabled?("new-combat-ui", player_id) do
  # Use new UI
end
```

## Alerting

### Built-in Alerts

The telemetry system logs warnings for:

- **High memory usage**: Warning logged when total memory exceeds 500 MB
- **Rate limiting**: Warning logged when requests are rate-limited

### Recommended Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Memory usage | > 500 MB | > 800 MB |
| Process count | > 50% of limit | > 80% of limit |
| Response time (p99) | > 500ms | > 2000ms |
| Error rate | > 1% | > 5% |
| DB query time (p99) | > 100ms | > 500ms |

### SLIs & SLOs

#### Service Level Indicators

| SLI | Measurement | Target |
|-----|-------------|--------|
| Availability | `/api/health` success rate | 99.9% |
| Latency (p50) | HTTP request duration | < 100ms |
| Latency (p99) | HTTP request duration | < 500ms |
| Error Rate | 5xx responses / total | < 0.1% |
| LiveView Mount | `phoenix.live_view.mount.stop.duration` | < 200ms |
| DB Query Time | `loka.repo.query.total_time` | < 50ms |

#### Alerting Thresholds

| Condition | Severity | Action |
|-----------|----------|--------|
| Health check fails 3x | Critical | Page on-call |
| Memory > 80% of 512MB | Warning | Investigate |
| Memory > 90% of 512MB | Critical | Scale or restart |
| Error rate > 1% | Warning | Investigate logs |
| p99 latency > 1s | Warning | Check DB queries |

## Logging

Loka uses structured logging with module prefixes for easy debugging. See the comprehensive **[Logging Guide](./logging-guide.md)** for:

- Module prefix conventions (`[COMBAT]`, `[SHOP]`, `[DIALOGUE]`, etc.)
- Log level guidelines (debug/info/warning/error)
- Debugging techniques with log filtering
- Adding logging to new code

### Quick Reference: Module Prefixes

| Prefix | Module | What It Logs |
|--------|--------|--------------|
| `[COMBAT]` | `actions/combat.ex` | Attack, flee, victory, defeat |
| `[SHOP]` | `actions/shop.ex` | Buy, sell, open shop |
| `[DIALOGUE]` | `framework/dialogue.ex` | Conversations, choices |
| `[CRAFTING]` | `framework/crafting.ex` | Craft success/failure |
| `[INVENTORY]` | `framework/inventory.ex` | Add/remove items |
| `[ENTITIES]` | `engine/entities.ex` | Create/update/delete |
| `[ACTION_BRIDGE]` | `action_bridge.ex` | Action execution |

### Log Levels

Set via `LOG_LEVEL` environment variable:

| Level | Use Case |
|-------|----------|
| `error` | Production minimal |
| `warning` | Production normal |
| `info` | Production verbose (default) |
| `debug` | Development only |

### Filtering Logs

```bash
# Filter by module
fly logs | grep "\[COMBAT\]"

# Filter by player
fly logs | grep "player_id=abc123"

# Combine filters
fly logs | grep "\[SHOP\]" | grep "player_id=abc123"
```

### JSON Logging (Production)

Production uses `LoggerJSON` for structured logging:

```json
{
  "time": "2025-01-01T00:00:00.000Z",
  "level": "info",
  "message": "[COMBAT] Victory: player_id=abc123 enemy=Goblin xp=50",
  "metadata": {
    "request_id": "abc123",
    "session_id": "sess_456"
  }
}
```

### Log Retention

Fly.io retains logs for 30 days by default. Access via:

```bash
# View live logs
fly logs

# View recent logs
fly logs --no-tail

# Filter by timestamp
fly logs --since 1h
```

## Phoenix LiveDashboard

Available at `/dev/dashboard` in development mode.

### Tabs

| Tab | Information |
|-----|-------------|
| Home | VM stats, memory, atoms |
| OS | System load, CPU, disk |
| Metrics | All telemetry metrics |
| Request Logger | Recent HTTP requests |
| Applications | Supervision trees |
| Processes | Process list, mailboxes |
| Ports | Network/file ports |
| Sockets | WebSocket connections |
| ETS | ETS table stats |

### Debugging with LiveDashboard

1. **High Memory**: Check ETS tab for large tables, Processes tab for large heaps
2. **Slow Requests**: Check Request Logger for duration, Metrics for DB query time
3. **Process Issues**: Check Processes tab for long message queues
4. **Connection Issues**: Check Sockets tab for WebSocket state

For production, LiveDashboard should be behind admin authentication.

## Fly.io Operations

### Scaling

```bash
# Scale to 2 instances
fly scale count 2

# Scale memory
fly scale memory 1024

# View current scale
fly scale show
```

### Logs

```bash
# Stream logs
fly logs

# View recent logs
fly logs --no-tail
```

### SSH Access

```bash
# SSH into running instance
fly ssh console

# Run IEx shell
fly ssh console -C "/app/bin/loka remote"
```

### Deployments

```bash
# Deploy latest
fly deploy

# Deploy with specific image
fly deploy --image registry.fly.io/loka:v1.0.0

# Rollback to previous release
fly releases list
fly deploy --image <previous-image>
```

### Database Operations

See [Backup & Restore Guide](../admin/backup-restore.md) for database backup procedures.

## Troubleshooting

### Alert Runbooks

#### Health Check Failure

**Symptoms**: Fly.io health checks returning non-200

1. Check application logs: `fly logs --since 5m`
2. SSH into instance: `fly ssh console`
3. Check process status: `/app/bin/loka rpc "Process.alive?(Loka.Supervisor)"`
4. Check database: `/app/bin/loka rpc "Loka.Repo.query!(\"SELECT 1\")"`
5. If unresponsive, restart: `fly apps restart`

#### High Memory Usage

**Symptoms**: `loka_game_memory_mb` > 400

1. Check entity count: Look at `loka_game_active_entities_count`
2. Check ETS tables in LiveDashboard
3. Review recent deployments for memory leaks
4. Trigger entity cleanup: Idle entities should hibernate/terminate
5. Scale vertically if needed: `fly scale memory 1024`

```elixir
# In IEx remote shell
:erlang.memory()
Process.list() |> length()
```

#### Database Connection Issues

**Symptoms**: Health check `database: false`

1. Check SQLite file exists: `fly ssh console -C "ls -la /mnt/lokacore_data/"`
2. Check disk space: `fly ssh console -C "df -h /mnt/lokacore_data"`
3. Check for lock issues: Look for `.db-wal` and `.db-shm` files
4. Restart if locked: `fly apps restart`

#### High Latency

**Symptoms**: p99 latency > 500ms

1. Check `loka.repo.query.queue_time` for DB contention
2. Check `loka.repo.query.query_time` for slow queries
3. Review recent code changes for N+1 queries
4. Check `vm.total_run_queue_lengths.total` for scheduler contention
5. Consider increasing pool size via `POOL_SIZE` env var

#### Rate Limiting Issues

Rate limit state is stored in ETS and cleaned up every 5 minutes. To manually inspect:

```elixir
# In IEx remote shell
:ets.tab2list(:loka_rate_limiter)
```

#### Entity Process Issues

```elixir
# Count active entities
DynamicSupervisor.count_children(Loka.Engine.EntitySupervisor)

# List all entity processes
DynamicSupervisor.which_children(Loka.Engine.EntitySupervisor)
```

### Debugging Checklist

#### Application Won't Start

1. Check build logs: `fly logs --no-tail | head -100`
2. Verify migrations: Check for migration errors in logs
3. Check env vars: `fly secrets list`
4. Check volume mount: `fly volumes list`

#### Players Can't Connect

1. Check WebSocket endpoint in browser devtools
2. Verify SSL certificate: `curl -I https://lokacore.fly.dev`
3. Check for rate limiting in logs
4. Verify auth flow (magic link or JWT)

#### Game State Issues

1. Check entity registry: `/app/bin/loka rpc "Loka.Engine.EntityRegistry.list_all()"`
2. Check player game state in database
3. Review quest/combat state for corruption
4. Check for hook errors in logs

### Debug Logging

Set log level via environment variable:

```bash
fly secrets set LOG_LEVEL=debug
```

Valid levels: `debug`, `info`, `warning`, `error`

## References

- `lib/loka_web/telemetry.ex` - Telemetry metrics definition
- `lib/loka/prom_ex.ex` - PromEx configuration
- `lib/loka/prom_ex/game_plugin.ex` - Game-specific metrics
- `lib/loka_web/controllers/api/health_controller.ex` - Health endpoints
