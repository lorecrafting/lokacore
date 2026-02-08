# Testing Audit

Review test coverage, quality, and infrastructure.

> **Timeout Budget**: 8 minutes

## Coverage Thresholds

Target coverage percentages by module category:

| Module Category | Target | Critical Minimum |
|-----------------|--------|------------------|
| Engine (lib/loka/engine/) | 80% | 70% |
| Framework (lib/loka/framework/) | 70% | 60% |
| Web (lib/loka_web/) | 60% | 50% |
| Critical Paths* | 100% | 90% |

*Critical Paths: Authentication, combat damage calculation, quest completion, item transactions

Run `mix test --cover` to check current coverage.

## Areas to Audit

### A. Unit Test Coverage
- Engine modules coverage percentage (target: 80%)
- Framework subsystem coverage (target: 70%)
- Web layer coverage (target: 60%)
- Untested public functions
- Edge case coverage gaps
- Error path testing

### A.1. GameLive Manager Coverage
Verify test files exist for each GameLive manager:
- `room_manager.ex` → `room_manager_test.exs`
- `combat_manager.ex` → `combat_manager_test.exs`
- `inventory_manager.ex` → `inventory_manager_test.exs`
- `dialogue_manager.ex` → `dialogue_manager_test.exs`
- `social_manager.ex` → `social_manager_test.exs`
- `gathering_manager.ex` → `gathering_manager_test.exs`
- `crafting_manager.ex` → `crafting_manager_test.exs`
- `chat_manager.ex` → `chat_manager_test.exs`

### B. Integration Tests
- Cross-module interaction tests
- Database transaction tests
- LiveView integration tests
- API endpoint tests
- WebSocket/PubSub tests

### C. Content Validation
- Validator completeness (what's missing?)
- False positive rates
- False negative rates
- Validator performance
- Error message clarity

### D. E2E Tests (Playwright)
- Critical path coverage
- Flaky test identification
- Test data management
- CI/CD integration
- Cross-browser testing

### E. Test Quality
- Test isolation (no shared state leaks)
- Fixture organization and reuse
- Mock appropriateness
- Test naming conventions
- Setup/teardown consistency

### F. Test Infrastructure
- Test run time optimization
- Parallel test execution
- CI pipeline efficiency
- Test database management
- Coverage reporting

## Deliverables

> **Report only**: Do not create beads automatically. Present findings and await user direction.

1. Coverage gaps by module (bead-ready format)
2. Flaky tests to fix
3. Missing test categories
4. Note if docs/architecture/testing.md needs updates
