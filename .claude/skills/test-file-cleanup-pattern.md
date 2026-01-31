# Test File Cleanup Pattern

## When to Use
- Writing tests that create files in `priv/world/` (YAML prototypes, quests, scripts, etc.)
- Tests that use random keys/suffixes to avoid collisions
- Any test that writes to the filesystem

## The Problem

Tests that create files can leave artifacts if:
1. **Inline cleanup** - `File.rm(path)` at end of test doesn't run if test fails
2. **Random suffixes** - `"test_#{:rand.uniform(10000)}"` creates new files each run, accumulating over time

## The Solution

Use `setup_all` with `on_exit` callback, which runs even when tests fail:

```elixir
defmodule MyTest do
  use Loka.DataCase, async: false

  alias Loka.TestCleanup  # Use the centralized cleanup module

  # Clean up test files after all tests complete (runs even if tests fail)
  setup_all do
    on_exit(fn ->
      TestCleanup.cleanup_room_test_files()
      TestCleanup.cleanup_npc_test_files()
    end)

    :ok
  end

  # ... tests that create files ...
end
```

## TestCleanup Module

Located at `test/support/test_cleanup.ex`, provides:

| Function | Cleans |
|----------|--------|
| `cleanup_room_test_files()` | Room YAML files with test prefixes |
| `cleanup_npc_test_files()` | NPC YAML files with test prefixes |
| `cleanup_item_test_files()` | Item YAML files with test prefixes |
| `cleanup_quest_test_files()` | Quest YAML files with test prefixes |
| `cleanup_script_test_files()` | Script YAML files with test prefixes |
| `cleanup_dialogue_test_files()` | Dialogue YAML files with test prefixes |
| `cleanup_all_test_files()` | All of the above |
| `cleanup_test_files(:type, prefixes)` | Custom type with custom prefixes |

## Adding New Test Prefixes

If you use a new naming pattern, add it to `test_cleanup.ex`:

```elixir
def cleanup_room_test_files do
  cleanup_test_files(:room, [
    "test_room_",
    "tool_test_",
    "my_new_prefix_",  # Add new prefixes here
    # ...
  ])
end
```

## Anti-Patterns

```elixir
# ❌ WRONG - Inline cleanup doesn't run if test fails
test "creates entity" do
  {:ok, entity} = create_entity(%{key: "test_#{:rand.uniform(1000)}"})
  assert entity.key =~ "test_"
  cleanup_entity(entity.key)  # Never runs if assertion fails!
end

# ❌ WRONG - Cleanup in individual test setup (runs too often, may interfere)
setup do
  on_exit(fn -> cleanup_all() end)  # Runs after EVERY test
  :ok
end

# ✅ CORRECT - setup_all with on_exit
setup_all do
  on_exit(fn -> TestCleanup.cleanup_room_test_files() end)
  :ok
end
```

## Why This Matters

Without proper cleanup:
- `priv/world/` directories accumulate 80+ test files
- Git status becomes noisy with untracked files
- Test isolation can be compromised by leftover data
- CI/CD may behave differently than local due to accumulated state
