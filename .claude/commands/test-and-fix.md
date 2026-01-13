# Test and Fix

Automatically fix common test failures through systematic analysis and iteration.

> **Timeout Budget**: 20 minutes (can extend if making progress)

## When to Use

Run this when:
- Test suite has failures
- CI pipeline is failing
- After refactoring code
- Before creating pull requests

## Usage

```bash
/test-and-fix                                    # Run all tests
/test-and-fix test/path/to/specific_test.exs   # Run specific test
```

## Process

### Step 1: Run Tests and Capture Output

```bash
mix test [path] --trace 2>&1 | tee /tmp/test_output.log
```

Extract:
- Number of failures
- Error messages and stack traces
- Failed assertions
- Compilation warnings

### Step 2: Categorize Failures

#### Category A: Compilation Errors
```
** (CompileError) lib/module.ex:42: undefined function foo/1
```
**Fix Strategy**: Read file, check for typos, missing aliases, syntax errors

#### Category B: Pattern Match Failures
```
** (MatchError) no match of right hand side value: {:error, :not_found}
```
**Fix Strategy**: Check return values, add error handling

#### Category C: Assertion Failures
```
assert length(results) == 5
# Expected: 5
# Got: 3
```
**Fix Strategy**: Read test logic, verify expectations are correct

#### Category D: Async/Timing Issues
```
** (ExUnit.TimeoutError) test timed out after 60000ms
```
**Fix Strategy**: Check for infinite loops, missing receives, deadlocks

#### Category E: Missing Setup/Teardown
```
** (Postgrex.Error) column "id" of relation "users" does not exist
```
**Fix Strategy**: Check database migrations, test setup/teardown

### Step 3: Read Relevant Files

For each failure:

1. **Read test file** - Understand what's being tested
2. **Read implementation** - See actual behavior
3. **Read related modules** - Check dependencies
4. **Check for recent changes** - `git diff HEAD~5..HEAD [file]`

### Step 4: Apply Common Fixes

#### Fix Pattern 1: Undefined Function
```elixir
# Before
def foo(bar), do: baz(bar)

# After (add missing import/alias)
alias MyModule
def foo(bar), do: MyModule.baz(bar)
```

#### Fix Pattern 2: Incorrect Assertion
```elixir
# Before
assert result == expected

# After (check actual vs expected)
assert result.field == expected_value
```

#### Fix Pattern 3: Missing Error Handling
```elixir
# Before
{:ok, value} = might_fail()

# After
case might_fail() do
  {:ok, value} -> use_value(value)
  {:error, reason} -> handle_error(reason)
end
```

#### Fix Pattern 4: Stale Test Data
```elixir
# Before
setup do
  %{user: create_user()}  # Always creates same data
end

# After
setup do
  %{user: create_user(email: "test_#{:rand.uniform(1000)}@test.com")}
end
```

#### Fix Pattern 5: Missing Test Setup
```elixir
# Before
test "does something" do
  result = MyModule.function()
  assert result == expected
end

# After
test "does something" do
  # Setup
  user = create_test_user()
  context = build_context(user)

  # Execute
  result = MyModule.function(context)

  # Assert
  assert result == expected
end
```

### Step 5: Verify Fix

1. Run same test again
2. Check if error changed or resolved
3. Run full test suite to check for regressions
4. If still failing, go back to Step 2

**Maximum Iterations**: 10 per test file

### Step 6: Commit Changes

If tests pass:
```bash
git add [files]
git commit -m "fix(tests): [description of what was fixed]"
```

## Success Criteria

- ✅ All tests pass
- ✅ No compilation warnings introduced
- ✅ No regressions in other tests
- ✅ Changes are minimal and targeted

## Common Test Failure Patterns

### Pattern: Flaky Async Tests
**Symptom**: Test passes sometimes, fails others
**Solution**: Add proper synchronization, use `async: false`, or fix race conditions

### Pattern: Database State Pollution
**Symptom**: Tests fail when run together, pass in isolation
**Solution**: Use `Ecto.Adapters.SQL.Sandbox`, ensure proper cleanup

### Pattern: Missing Factory Data
**Symptom**: Tests fail with null/missing associations
**Solution**: Check factory definitions, ensure required associations are built

### Pattern: Mocking Issues
**Symptom**: `** (UndefinedFunctionError)` for mocked functions
**Solution**: Verify mock setup, check if behavior is defined

### Pattern: Time-Dependent Tests
**Symptom**: Tests fail at certain times of day/dates
**Solution**: Use time mocking (e.g., `Timex.freeze`), avoid hardcoded dates

## Test-Specific Debugging

### For Bot Tests
Use `/debug-bot` instead - it has specialized bot debugging logic.

### For Integration Tests
- Check if test environment is properly configured
- Verify all services are running (PubSub, registries, etc.)
- Look for missing `start_supervised!()` calls

### For Property Tests
- Check generators for edge cases
- Verify properties are actually testable
- Look for shrinking issues

## Reference

After fixing, consider:
- Adding regression test for the bug
- Updating test documentation
- Creating a pattern guide if it's a common issue
