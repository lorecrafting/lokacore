# Test and Fix

Run tests, analyze failures, and fix them iteratively until all pass.

## Workflow

### Step 1: Run Tests
```bash
cd /Users/raymondluong/dev/lokacore/server && mix test
```

### Step 2: Analyze Failures
For each failing test:
1. Read the test file to understand what's being tested
2. Read the implementation file(s) involved
3. Identify the root cause (not just the symptom)

### Step 3: Fix Systematically
- Fix ONE issue at a time
- Re-run tests after each fix
- Don't move on until the specific test passes

### Step 4: Verify No Regressions
After all fixes:
```bash
mix test
mix loka.test.validate
```

## Common Failure Patterns

### Pattern Matching Issues
```elixir
# Wrong: Expecting bare value when function returns tuple
value = SomeModule.get("key")

# Right: Pattern match the tuple
{:ok, value} = SomeModule.get("key")
```

### Nil Safety
```elixir
# Wrong: No nil guard
def process(data), do: data.field

# Right: Handle nil case
def process(nil), do: {:error, :no_data}
def process(data), do: {:ok, data.field}
```

### Async Race Conditions
```elixir
# Wrong: Timing-dependent
Process.sleep(100)
assert something()

# Right: Wait for specific condition
assert_eventually(fn -> something() end)
```

## Output Format

After each iteration, report:
- Tests run: X
- Passing: Y
- Failing: Z
- Fixed this iteration: [list]
- Remaining issues: [list]

## When Done

All tests pass AND `mix loka.test.validate` passes.
