# Observability Audit

Review monitoring, logging, error tracking, and debugging infrastructure.

> **Timeout Budget**: 8 minutes

## Areas to Audit

### A. Error Tracking & Reporting
- Error monitoring service integration (Sentry, Rollbar, etc.)
- Unhandled exception capture
- Error categorization and grouping
- Error rate alerting thresholds
- Source map integration for client errors
- Error context enrichment (user, session, entity state)

### B. Logging Infrastructure
- Log level consistency (debug/info/warn/error usage)
- Structured logging format (JSON vs plaintext)
- Log aggregation pipeline
- Log retention policies
- Sensitive data scrubbing (passwords, tokens, PII)
- Log volume management (avoid logging in hot paths)

### C. Metrics & Telemetry
- PromEx/Telemetry coverage for critical paths
- Custom metric definitions for game-specific events
- Metric naming conventions consistency
- Dashboard availability (Grafana, etc.)
- SLI/SLO definitions
- Cardinality concerns (label explosion prevention)

### D. Tracing
- Distributed tracing setup (OpenTelemetry)
- Span coverage for cross-process operations
- Trace sampling strategy
- Trace ID propagation in logs
- Performance impact of tracing

### E. Health Checks & Readiness
- Liveness probe accuracy
- Readiness probe comprehensiveness
- Dependency health checking
- Circuit breaker patterns
- Graceful degradation behavior

### F. Debugging Tools
- IEx remote shell access in production
- Phoenix LiveDashboard configuration
- Session replay capability
- Debug logging toggle (without restart)
- Development vs production parity

### G. Alerting
- Alert rule coverage for critical paths
- Alert fatigue prevention (grouping, deduplication)
- Escalation policies
- On-call rotation integration
- Runbook availability for common alerts

## Checklist

### Critical (Must Have)
- [ ] Error tracking captures all unhandled exceptions
- [ ] Health endpoints return accurate status
- [ ] Logs don't contain sensitive data
- [ ] Critical path metrics exist (login, game actions, combat)

### High Priority
- [ ] Structured logging enabled
- [ ] Dashboard accessible for key metrics
- [ ] Error alerts configured with thresholds
- [ ] Log levels appropriate (no debug logs in production)

### Medium Priority
- [ ] Distributed tracing for cross-process flows
- [ ] Custom game event metrics
- [ ] Alert runbooks exist
- [ ] Log retention policy documented

### Low Priority
- [ ] Session replay for debugging
- [ ] Trace sampling optimized
- [ ] SLI/SLO formally defined
- [ ] Canary alerting

## Deliverables

> **Report only**: Do not create beads automatically. Present findings and await user direction.

1. Observability coverage gaps ranked by impact (bead-ready format)
2. Missing instrumentation for critical paths
3. Alert recommendations
4. Note if docs/operations/monitoring.md needs updates

## Loka-Specific Checks

- EntityServer lifecycle events are logged
- PubSub message rates are tracked
- Quest completion events are metrics
- Combat round timing is measured
- Session connect/disconnect rates tracked
- Elixir script execution time monitored
- Zone reset events logged
