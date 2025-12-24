# ExMUD Monitoring & Operations Guide

This document covers monitoring, health checks, telemetry, and operational procedures for ExMUD.

## Table of Contents

- [Health Check Endpoints](#health-check-endpoints)
- [Telemetry & Metrics](#telemetry--metrics)
- [Alerting](#alerting)
- [Fly.io Operations](#flyio-operations)
- [Troubleshooting](#troubleshooting)

## Health Check Endpoints

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

## Telemetry & Metrics

ExMUD uses Elixir's Telemetry library for metrics collection. Metrics are viewable in Phoenix LiveDashboard during development.

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
| `exmud.repo.query.total_time` | Summary | Total query execution time |
| `exmud.repo.query.queue_time` | Summary | Time waiting for DB connection |
| `exmud.repo.query.query_time` | Summary | Actual query execution time |

#### Game Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `exmud.game.active_players.count` | Gauge | Currently active players |
| `exmud.game.active_entities.count` | Gauge | Active entity processes |
| `exmud.game.commands.total` | Counter | Total commands executed |
| `exmud.game.combat.started.total` | Counter | Combat encounters started |
| `exmud.game.login.total` | Counter | Player logins |
| `exmud.auth.rate_limited.total` | Counter | Rate-limited requests |

#### VM Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `vm.memory.total` | Summary | Total VM memory usage |
| `vm.total_run_queue_lengths.total` | Summary | Scheduler run queue length |

### Emitting Custom Events

Use the Telemetry module API to emit events:

```elixir
alias ExmudWeb.Telemetry

# When a command is executed
Telemetry.emit_command(:look)

# When combat starts
Telemetry.emit_combat_started()

# When a player logs in
Telemetry.emit_login()

# When rate limiting kicks in
Telemetry.emit_rate_limited("/api/v1/auth/login")
```

### LiveDashboard

In development, access metrics at: `http://localhost:4000/dev/dashboard`

For production, LiveDashboard should be behind admin authentication.

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

### External Monitoring Integration

To export metrics to external services (Datadog, Prometheus, etc.):

1. Add the appropriate reporter to `ExmudWeb.Telemetry.init/1`
2. Configure the reporter in your config

Example for Prometheus:

```elixir
# In telemetry.ex init/1
children = [
  {:telemetry_poller, measurements: periodic_measurements(), period: 10_000},
  {TelemetryMetricsPrometheus, metrics: metrics()}
]
```

## Fly.io Operations

### Scaling

```bash
# Scale to 2 instances
fly scale count 2

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
fly ssh console -C "/app/bin/exmud remote"
```

### Deployments

```bash
# Deploy latest
fly deploy

# Deploy with specific image
fly deploy --image registry.fly.io/exmud:v1.0.0

# Rollback to previous release
fly releases list
fly deploy --image <previous-image>
```

### Database Operations

See [Backup & Restore Guide](../admin/backup-restore.md) for database backup procedures.

## Troubleshooting

### Common Issues

#### High Memory Usage

1. Check `/api/health/detailed` for memory breakdown
2. Look for process leaks in LiveDashboard
3. Check ETS table sizes
4. Review entity process counts

```bash
# In IEx remote shell
:erlang.memory()
Process.list() |> length()
```

#### Slow Responses

1. Check database query times in telemetry
2. Review `exmud.repo.query.queue_time` for connection pool issues
3. Check scheduler run queue lengths

#### Rate Limiting Issues

Rate limit state is stored in ETS and cleaned up every 5 minutes. To manually inspect:

```elixir
# In IEx remote shell
:ets.tab2list(:exmud_rate_limiter)
```

#### Entity Process Issues

```elixir
# Count active entities
DynamicSupervisor.count_children(Exmud.Engine.EntitySupervisor)

# List all entity processes
DynamicSupervisor.which_children(Exmud.Engine.EntitySupervisor)
```

### Debug Logging

Set log level via environment variable:

```bash
fly secrets set LOG_LEVEL=debug
```

Valid levels: `debug`, `info`, `warning`, `error`

### Health Check Failures

If health checks fail:

1. **Liveness failure**: Application crash - check logs for errors
2. **Readiness failure - database**: Check database connectivity, disk space
3. **Readiness failure - pubsub**: PubSub supervisor may have crashed

```bash
# Check Fly.io VM status
fly status

# Check for recent issues
fly logs | grep -i error
```
