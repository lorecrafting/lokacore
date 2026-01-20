---
name: api-verification
description: Ensures external library functions exist before use and return values are correctly handled. Use when calling external libraries, pattern matching function returns, or working with YAML data.
---

# API Verification

**Auto-applies when**: Calling external library functions, pattern matching on returns, or accessing YAML-loaded data

## Purpose

Prevents common mistakes:
- Using non-existent library functions
- Incorrect pattern matching on return values
- String/atom key mismatches with YAML data

## When This Skill Activates

This skill activates automatically when you:
- Call functions from external libraries (YamlElixir, Phoenix, Ecto, etc.)
- Pattern match on function return values
- Access data loaded from YAML files
- Work with the LiveView component/render APIs

## Key Rules

### 1. Verify Library Functions Exist

**Before using any external library function:**

```elixir
# BAD - YamlElixir.write_to_file/2 doesn't exist!
YamlElixir.write_to_file(path, data)

# GOOD - Check docs or use IEx first
# iex> h YamlElixir.<tab>
# YamlElixir only provides read functions, not write
```

**Verification checklist:**
1. Check library documentation
2. Use `h Module.function` in IEx
3. Use tab-completion in IEx: `Module.<tab>`
4. Check the library's source on GitHub

### 2. Pattern Match Return Values Correctly

**Always verify the actual return shape:**

```elixir
# BAD - Assumed :ok but function returns {:ok, value}
:ok = RoomManager.delete_room(room_key)

# GOOD - Check actual return type
{:ok, _room} = RoomManager.delete_room(room_key)

# BAD - Missed nested tuple
{:ok, result} = some_function()
result.data  # Crashes if result is actually {:ok, %{data: ...}}

# GOOD - Verify in IEx or check @spec
iex> SomeModule.some_function()
{:ok, %{data: "value"}}
```

### 3. LiveView Component vs View Rendering

```elixir
# BAD - live_component for LiveViews
live_component(MyLiveView)

# GOOD - live_render for LiveViews
live_render(@socket, MyLiveView)

# GOOD - live_component for Components
live_component(MyComponent, id: "my-id")
```

### 4. Elixir Reserved Keywords

Never use these as variable/function names:
- `after`, `and`, `catch`, `do`, `else`, `end`
- `fn`, `in`, `not`, `or`, `receive`, `rescue`
- `try`, `when`, `cond`, `case`, `if`, `unless`

```elixir
# BAD
after = 5000

# GOOD
delay_ms = 5000
schedule_after = 5000
```

## Common Library Gotchas

### YamlElixir
- **Has**: `read_from_file/1`, `read_from_string/1`
- **Does NOT have**: `write_to_file/2`, `dump/1`
- For writing YAML, use custom serialization or `yaml_encoder` library

### Phoenix LiveView
- `live_render/3` - Render a LiveView
- `live_component/2` - Render a Component
- Don't mix these up!

### Ecto
- `Repo.get/2` returns `nil` or struct (not tuple)
- `Repo.get!/2` raises on not found
- `Repo.insert/2` returns `{:ok, struct}` or `{:error, changeset}`

### Map Functions
- `Map.get/3` - returns default if key missing
- `Map.fetch/2` - returns `{:ok, value}` or `:error`
- `Map.fetch!/2` - raises if key missing

## Verification Workflow

1. **Before coding**: Check library docs for function signatures
2. **While coding**: Use `@spec` attributes when available
3. **After coding**: Test in IEx with real data
4. **In tests**: Verify return shapes explicitly

## Supporting Files

See `PATTERNS.md` for common API usage patterns.
