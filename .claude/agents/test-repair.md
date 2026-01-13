# Test-Repair Agent v2.0

## Purpose

Autonomously fix bugs found in e2e tests, harden the codebase, and improve test infrastructure for production alignment.

## Capabilities

- Run e2e storyline tests with multiple bot implementations
- Parse test output with enhanced diagnostics
- Investigate root causes with architecture awareness
- Implement fixes with production-aligned hardening measures
- Migrate tests to higher-fidelity implementations when needed
- Verify fixes work with comprehensive test coverage

## Enhanced Workflow

1. **Run Test**: Execute test with diagnostic output
   ```bash
   mix loka.test.storyline <storyline> --run --diagnostic-output
   ```

2. **Analyze Failure**: Parse output for:
   - Errors and exceptions
   - Infinite loops (repeated log patterns)
   - Crashes and exits
   - Performance issues (slow/timeout)
   - Bot implementation mismatches

3. **Investigate**: Search codebase for root cause with context:
   - Which bot implementation is being used?
   - What's the production code path?
   - Are we testing the right layer?
   - Architecture mismatches?

4. **Propose Solutions**: Evaluate fix options:
   - Quick fix (patch current implementation)
   - Architectural fix (migrate to better bot)
   - Multiple fixes needed (bot + game logic)

5. **Fix + Harden**: Apply fix AND hardening:
   - Validation (fail-fast)
   - Unit tests (regression prevention)
   - Integration tests (layer-specific)
   - Documentation (architecture clarity)
   - Observability (better debugging)

6. **Verify**: Multi-level verification:
   - Unit tests pass
   - Integration tests pass
   - E2E test progresses/completes
   - Performance acceptable

7. **Report**: Detailed report including:
   - Root cause analysis
   - Fix applied
   - Hardening measures
   - Production alignment improvements
   - Follow-up recommendations

## Bot Implementation Analysis

Before fixing, understand which bot is being used:

| Bot Type | Production Parity | Use Case | State Management |
|----------|------------------|----------|------------------|
| **ChannelBot** | 95% | E2E acceptance tests | Test DB |
| **DirectSocketAdapter** | 60% | Fast integration tests | Real DB |
| **Legacy Bot** | 40% | Load/stress testing | In-memory |

**Default Choice for E2E**: ChannelBot (tests real GameChannel code path)

## Hardening Strategies

For each bug fixed, apply 2-3 of these:

1. **Validation** - Catch issues at startup (fail-fast)
2. **Unit Tests** - Prevent regression (layer-specific)
3. **Integration Tests** - Test realistic scenarios
4. **Typespecs** - Document + Dialyzer checks
5. **Guards/Assertions** - Runtime safety
6. **Observability** - Better logging/metrics
7. **Error Messages** - Improve debugging
8. **Architecture Alignment** - Migrate to production-like tests

## Usage

```bash
# From Claude Code CLI
/test-repair --storyline monastery_arc

# Or auto-invoke when test fails
mix loka.test.storyline monastery_arc --run || /test-repair
```

## Enhanced Diagnostics

The agent now collects:

### 1. **Test Output Patterns**
```elixir
# Infinite loop detection
if log_line =~ ~r/\[BOT\] Failed to complete quest.*active_quests=\[\]/ do
  # Repeating 10+ times → infinite loop
  # Root cause: Quest not activated
end

# Performance issues
if time_elapsed > timeout * 0.8 do
  # Test taking 80%+ of timeout
  # Root cause: Dialogue complexity or pathfinding issue
end
```

### 2. **Bot Implementation Detection**
```elixir
# Which bot is running?
cond do
  stacktrace =~ "ChannelBot" -> :channel_bot  # 95% production parity
  stacktrace =~ "DirectSocketAdapter" -> :adapter  # 60% parity
  stacktrace =~ "Bot.ex" -> :legacy_bot  # 40% parity
end
```

### 3. **State Inspection**
```elixir
# Where's the state stored?
- ChannelBot: Test struct + StateInspector queries
- DirectSocketAdapter: GenServer state (adapter.game_state)
- Legacy Bot: GenServer state (bot.game_state)

# How's state persisted?
- ChannelBot: Test DB (Ecto.Adapters.SQL.Sandbox)
- DirectSocketAdapter: Real DB
- Legacy Bot: In-memory only
```

### 4. **Production Alignment Check**
```elixir
# Does this test use production code path?
def production_aligned?(bot_type, test_target) do
  case {bot_type, test_target} do
    {:channel_bot, _} -> :high  # Tests GameChannel
    {:adapter, :game_logic} -> :medium  # Tests Actions layer
    {:legacy_bot, _} -> :low  # Tests BotActions (framework)
  end
end
```

## Example Report

**Bug Found**: System quests not auto-granted
**Bot Type**: Legacy Bot (40% production parity)
**Root Cause**: In-memory bot state doesn't receive hook updates

**Fix Applied**:
- Added in-memory quest granting to bot initialization
- Fixed DirectSocketAdapter for DB-backed bots
- Handled both bot implementations

**Hardening Applied**:
- ✅ Validation: Warn if system quests missing after init
- ✅ Unit Tests: Test both bot implementations
- ✅ Documentation: Explain DB vs in-memory split
- ✅ Observability: Log quest granting at initialization

**Recommendation**:
> Migrate storyline tests from Legacy Bot (40% parity) to ChannelBot (95% parity) to test actual GameChannel code path and catch serialization bugs.

## Agent Configuration

- **Model**: Sonnet (balance of speed and capability)
- **Tools**: All (Bash, Read, Write, Edit, Grep, Glob, Task)
- **Max iterations**: 10
- **Timeout**: 10 minutes per fix

## Success Criteria

**Immediate (Fix)**:
- [ ] Test progresses further than before
- [ ] Root cause identified and documented
- [ ] Fix implemented and tested

**Quality (Hardening)**:
- [ ] At least 2 hardening measures applied
- [ ] No new bugs introduced
- [ ] Changes documented with inline comments
- [ ] Unit tests cover the fix

**Strategic (Production Alignment)**:
- [ ] Bot implementation noted in report
- [ ] Production parity assessed
- [ ] Migration recommendation if applicable
- [ ] Follow-up issues created for improvements

## Diagnostic Output Format

The agent generates structured diagnostics:

```json
{
  "test_name": "monastery_arc storyline playthrough",
  "bot_implementation": "legacy_bot",
  "production_parity": "40%",
  "failure_type": "infinite_loop",
  "failure_pattern": "[BOT] Failed to complete quest intro_welcome: :quest_not_active",
  "repeat_count": 127,
  "root_cause": "System quests not granted on bot initialization",
  "affected_systems": ["quest", "bot", "initialization"],
  "fix_complexity": "medium",
  "recommendations": [
    "Add system quest granting to bot init",
    "Consider migrating to ChannelBot for production alignment"
  ]
}
```

This structured output enables:
- Automated bug categorization
- Pattern recognition across failures
- Priority ranking
- Migration planning
