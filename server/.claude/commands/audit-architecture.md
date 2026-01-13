# Loka Architecture Audit

Do a full audit of the codebase to optimize architecture for maintainability (LLMs and humans).

> **Timeout Budget**: 10 minutes

> **Scope**: This audit focuses on code structure, patterns, and maintainability. Specific domain audits (Security, Performance, Documentation) go deeper in their areas.

## 1. Engine Layer (lib/loka/engine/)
- Module organization
- Circular dependencies
- GenServer patterns and state size (>100KB warn, >1MB critical)
- Error handling consistency (tagged tuples vs exceptions)
- Entity lifecycle consistency (spawn/load/save/despawn pattern)

## 2. Framework Subsystems (lib/loka/framework/)
- Pattern consistency across 22 subsystems
- RegistryBase usage (target: 100% adoption)
- Code duplication
- Stub detection (TODO/FIXME in production code)

## 3. Web Layer (lib/loka_web/)
- LiveView organization
- Manager pattern consistency (GameLive managers)
- Component structure
- Dead routes
- Authorization patterns in event handlers (entity ownership)
- Loading and error state handling consistency

## 4. JavaScript Quality (assets/js/)
- Error handling in hooks (try/catch, error callbacks)
- Console.log cleanup (no debug logs in production)
- Event listener cleanup (memory leaks)
- Asset build warnings
- Hook lifecycle management (mounted/destroyed cleanup)

## 5. Concurrency Patterns
- GenServer state mutation safety (no concurrent access issues)
- ETS table access patterns (race conditions)
- PubSub message ordering assumptions
- Task supervision and error handling
- Deadlock potential (multiple GenServer calls)

## 6. Tests (test/)
- Coverage gaps (do tests exist for each module?)
- Organization mirroring lib/

> **Note**: Detailed test quality covered by `/audit-testing`. This section checks existence only.

## 7. Prototypes (priv/world/prototypes/)
- YAML schema consistency
- Naming conventions
- Orphaned prototypes
- Inheritance depth (>3 levels is a warning)

## 8. Deployment Readiness
- Session/socket state portability (can state move between nodes?)
- Process registry strategy (local vs distributed)
- Hot code upgrade patterns
- Singleton GenServer identification (bottlenecks)

## Reporting

For each area report:
- Health score (1-10)
- Specific issues with file paths and line numbers
- Priority (High/Medium/Low) with effort estimate
- Anti-patterns found

## Verification Rules

**IMPORTANT**: Before flagging files as missing:
- Use Read tool to verify file existence
- Check both project root AND server/ subdirectory for project-level files (CLAUDE.md, etc.)

## Follow-up Actions

> **Report only**: Do not create beads automatically. Present findings and await user direction.

1. Present high-priority issues with descriptions (bead-ready format)
2. Note if docs/architecture/patterns.md needs updates for new anti-patterns
3. Note if AGENTS.md needs updates for new Loka-specific patterns
