# Check Work - Post-Implementation Verification

Run comprehensive verification of recent implementation work to catch bugs before they reach production.

## Verification Steps

### 1. Run Test Suite
Execute the relevant tests to ensure nothing broke:
```bash
mix test
```

### 2. Run Content Validators
Check game content integrity:
```bash
mix loka.test.validate
```

### 3. Live Runtime Testing
Use `mcp__Tidewave__project_eval` to verify critical runtime behavior:

**Common verification patterns:**
- Test function return values match expected types (tuples vs bare values)
- Verify function signatures (positional vs keyword args)
- Check module exports are accessible
- Validate integration points work correctly

**Example verifications:**
```elixir
# Check a module's public API
exports(ModuleName)

# Test a function with real data
result = ModuleName.function(args)
IO.inspect(result, label: "Result type")

# Verify pattern matching works
case SomeModule.get("key") do
  {:ok, value} -> IO.puts("Returns {:ok, value} tuple")
  value when is_map(value) -> IO.puts("Returns bare value")
  _ -> IO.puts("Returns something else")
end
```

### 4. Check for Common Bug Patterns

**Pattern matching issues:**
- Functions returning `{:ok, value}` vs bare values
- Case statements matching wrong shapes

**Function signature issues:**
- Positional args vs keyword args
- Map vs struct expectations

**Nil safety:**
- Missing nil guards on optional data
- Default value handling

### 5. Browser Verification (if UI changes)
Use `mcp__Tidewave-Web__browser_eval` to verify UI behavior:
- Navigate to affected pages
- Test interactions work correctly
- Verify expected text/elements appear

## Output

After verification, report:
1. **Tests**: Pass/fail count
2. **Validators**: Any errors or warnings
3. **Live tests**: Results of runtime verification
4. **Issues found**: List any bugs discovered with fixes applied

## When to Use

Invoke this command:
- After implementing a feature
- After fixing a bug
- Before closing a bead/issue
- When asked to "check your work"
