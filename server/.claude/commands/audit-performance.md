# Performance Audit

Identify and address performance bottlenecks across the Loka codebase.

> **Timeout Budget**: 8 minutes

> **Scope**: Performance = optimize current bottlenecks. For future scaling limits and architectural constraints, see `/audit-scalability`.

## Areas to Audit

### A. Database & Queries
- N+1 query patterns in Ecto
- Missing indexes on frequently queried columns
- Unoptimized joins or subqueries
- Entity loading patterns (lazy vs eager)
- SQLite-specific optimizations

### B. GenServer & Processes
- EntityServer memory usage patterns
- Process hibernation effectiveness
- Message queue buildup risks
- Registry lookup efficiency
- Supervisor restart strategies

### C. LiveView & Real-time
- Socket payload sizes
- Unnecessary re-renders
- Diff optimization opportunities
- PubSub broadcast efficiency
- Event handler complexity
- UI component render optimization (expensive computations on frequent events)
- Memoization and structural sharing opportunities

### D. Prototype Loading
- ETS table memory usage
- Hot-reload impact
- YAML parsing overhead
- Inheritance resolution caching
- World loading time

### E. Game Loop
- Combat calculation efficiency
- Quest objective checking overhead
- Room broadcast frequency
- NPC behavior tick rates
- Status effect processing
- Global broadcast patterns (broadcasting to all vs targeted broadcasts)
- Ticker frequency vs actual state change rate (unnecessary broadcasts)

### F. Memory & Resources
- Large struct allocations
- Binary handling (descriptions, scripts)
- Process heap sizes
- ETS table growth
- Telemetry overhead

## Deliverables

> **Report only**: Do not create beads automatically. Present findings and await user direction.

1. Bottlenecks ranked by impact (bead-ready format)
2. Profiling data where applicable
3. Benchmark baselines for future comparison
4. Note if docs/operations/monitoring.md needs updates with metrics to watch
