# Scalability Audit

Evaluate readiness for increased load and multi-server deployment.

> **Timeout Budget**: 8 minutes

## Areas to Audit

### A. State Management
- Session state portability
- EntityServer state size
- ETS table distribution strategy
- PubSub across nodes
- Cache invalidation patterns

### B. Database
- SQLite limitations for scale
- PostgreSQL migration path
- Connection pooling
- Read replica readiness
- Sharding considerations

### C. Process Architecture
- Process per entity sustainability
- Registry bottlenecks
- Supervisor tree depth
- Hot code upgrade readiness
- Cluster formation strategy

### D. External Services
- Redis integration path
- CDN for static assets
- External API rate limits
- Third-party service fallbacks
- Async job processing

### E. Monitoring at Scale
- Telemetry coverage
- Metric aggregation
- Log volume management
- Alerting thresholds
- Distributed tracing

### F. Deployment
- Zero-downtime deployment
- Rolling update strategy
- Feature flag infrastructure
- A/B testing capability
- Canary deployment support

### G. Backup & Disaster Recovery
- Backup automation (cron/scheduled tasks)
- Backup verification (test restores work)
- Recovery time objective (RTO) documented
- Recovery point objective (RPO) documented
- Off-site backup storage
- Entity state export/import capability
- Prototype backup (YAML files in git)

## Deliverables

> **Report only**: Do not create beads automatically. Present findings and await user direction.

1. Scalability blockers ranked by impact (bead-ready format)
2. Migration paths for critical changes
3. Quick wins for scale readiness
4. Note if docs need scalability updates
5. Backup/restore procedure validation results
