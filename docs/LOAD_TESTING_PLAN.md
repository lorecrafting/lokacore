# Load Testing System for Loka

> **Status**: Draft / Ideation
> **Target**: 2000+ concurrent players

## Summary

Two-phase load testing system:
- **Phase 1**: In-process BotSwarm (quick iteration, tests game logic)
- **Phase 2**: External WebSocket client (production-like, distributed)

---

## Phase 1: In-Process BotSwarm

### New Files to Create

```
server/lib/loka/testing/load/
├── bot_swarm.ex           # Orchestrates mass bot spawning + metrics
├── metrics_collector.ex   # ETS-based concurrent metric collection
├── histogram.ex           # Latency histogram (p50/p90/p99)
├── report.ex              # Console + JSON output
└── scenarios/
    ├── scenario.ex        # Behaviour
    ├── exploration.ex     # Pure navigation
    ├── combat_heavy.ex    # Combat stress
    └── room_crowding.ex   # O(N) broadcast test

server/lib/mix/tasks/
└── loka.load.ex           # mix loka.load CLI
```

### Key Module: BotSwarm

```elixir
defmodule Loka.Testing.Load.BotSwarm do
  # Spawn 100-1000 bots with ramp-up
  def start_link(bot_count: 500, ramp_up_seconds: 30, scenario: :exploration)
  def run_for(swarm, duration_ms)
  def get_report(swarm)
  def stop(swarm)
end
```

### Mix Task Interface

```bash
# Quick smoke test
mix loka.load --quick

# Full test
mix loka.load --bots 1000 --duration 5m --scenario combat

# Room crowding stress test
mix loka.load --scenario crowding --bots 200

# Export results
mix loka.load --bots 500 --duration 10m --output results.json
```

### Scenarios

| Scenario | Purpose | Key Metric |
|----------|---------|------------|
| `exploration` | Room loading, navigation | Move latency |
| `combat` | Combat system stress | Combat tick latency |
| `crowding` | O(N) broadcast | Room broadcast time |
| `mixed` | Realistic player mix | Overall throughput |

---

## Phase 2: External WebSocket Client

### File Structure (Separate Mix Project)

```
apps/loka_load_client/
├── lib/loka_load_client/
│   ├── client.ex              # Single WebSocket client GenServer
│   ├── client_supervisor.ex   # DynamicSupervisor
│   ├── channel_client.ex      # Phoenix Channel protocol (gun)
│   ├── auth.ex                # REST API auth helper
│   ├── coordinator.ex         # Distributed test orchestration
│   └── metrics/
│       ├── collector.ex       # Aggregate metrics
│       └── prometheus.ex      # /metrics endpoint
└── bin/loka_load              # escript CLI
```

### Connection Flow

1. `POST /api/v1/auth/login` → JWT token
2. WebSocket connect `/socket/websocket?token=JWT`
3. Join channel `game:lobby`
4. Receive `game_state` push
5. Run strategy loop (send actions, receive events)

### Dependencies

```elixir
{:gun, "~> 2.0"},      # WebSocket client
{:bandit, "~> 1.0"},   # Prometheus HTTP server
{:optimus, "~> 0.4"}   # CLI parsing
```

---

## Metrics to Collect

### Latencies
- `action_latency_ms` - p50, p90, p99, max
- `move_latency_ms` - Navigation specific
- `combat_latency_ms` - Combat actions

### Throughput
- `actions_per_second` - Total across all bots
- `error_rate` - Errors / total actions

### System (Phase 1)
- `process_count` - Erlang processes
- `memory_mb` - VM memory
- `entity_server_count` - Active entities
- `session_count` - Active sessions

---

## Implementation Order

### Phase 1 (~10 hours)
1. `histogram.ex` - Simple percentile stats
2. `metrics_collector.ex` - ETS concurrent collection
3. `bot_swarm.ex` - Core orchestration
4. Scenarios - exploration, combat, crowding
5. `report.ex` - Console/JSON output
6. `mix loka.load` - CLI task

### Phase 2 (~13 hours)
1. `channel_client.ex` - Phoenix protocol
2. `client.ex` - Single client lifecycle
3. `auth.ex` - JWT authentication
4. `client_supervisor.ex` - Mass client spawning
5. `coordinator.ex` - Distributed testing
6. `prometheus.ex` - Metrics endpoint
7. CLI escript

---

## Critical Files to Reference

| File | Purpose |
|------|---------|
| `lib/loka/testing/bot/bot.ex` | Existing bot GenServer |
| `lib/loka/testing/bot/bot_supervisor.ex` | DynamicSupervisor pattern |
| `lib/loka/testing/bot/strategy.ex` | Strategy behaviour |
| `lib/loka_web/channels/game_channel.ex` | Channel protocol reference |
| `lib/loka/session/server.ex` | Session bottleneck |
| `lib/loka/engine/entity_server.ex` | Entity bottleneck |

---

## Example Usage

### Phase 1
```bash
# Development benchmarks
mix loka.load --bots 500 --duration 5m --scenario exploration --live

# Stress test
mix loka.load --bots 1000 --duration 10m --scenario combat --output combat_results.json
```

### Phase 2
```bash
# Remote server testing
./bin/loka_load --server https://loka.fly.dev --bots 500 --duration 30m

# Distributed (2000+ bots across 4 machines)
./bin/loka_load --server https://loka.fly.dev \
  --distributed node1@host1,node2@host2,node3@host3,node4@host4 \
  --bots 2000 --duration 1h
```

---

## Key Bottlenecks to Test

1. **Session.Server** - 1 GenServer per online player
2. **EntityServer** - 1 GenServer per entity, auto-saves every 60s
3. **ResourceTicker** - Iterates all entities every 1 second
4. **Room broadcasts** - O(N) for N players in same room
5. **SQLite** - Single-writer limitation

---

## Start With

**Recommended**: Implement Phase 1 first for quick wins, then Phase 2 when production testing is needed. Phase 1 will immediately identify game logic bottlenecks.
