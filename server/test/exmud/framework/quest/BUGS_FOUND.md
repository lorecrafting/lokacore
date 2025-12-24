# Bugs Found in Quest Framework Tests

This document describes bugs in the Quest framework source code that were discovered while creating comprehensive tests.

## Bug 1: Improper Tuple Unwrapping in apply_rewards/2

**Location:** `lib/exmud/framework/quest/progress.ex:349-351`

**Issue:** The `apply_xp_reward/2`, `apply_gold_reward/2`, and `apply_item_rewards/2` helper functions all return `{:ok, state}` tuples, but in `apply_rewards/2` these tuples are being assigned directly to the `state` variable without unwrapping them.

**Current Code:**
```elixir
defp apply_rewards(state, rewards) do
  # ...
  state = apply_xp_reward(state, xp)      # Returns {:ok, state}
  state = apply_gold_reward(state, gold)  # Called with {:ok, state} instead of state
  apply_item_rewards(state, items)        # Called with nested tuples
end
```

**Problem:** This causes nested tuples like `{:ok, {:ok, state}}` to be returned, and functions fail when trying to access fields on tuples instead of structs.

**Fix Needed:**
```elixir
defp apply_rewards(state, rewards) do
  # ...
  with {:ok, state} <- apply_xp_reward(state, xp),
       {:ok, state} <- apply_gold_reward(state, gold),
       {:ok, state} <- apply_item_rewards(state, items) do
    {:ok, state}
  end
end
```

**Affected Tests (currently skipped):**
- `test/exmud/framework/quest/progress_test.exs:448` - turns in a completed quest and applies rewards
- `test/exmud/framework/quest/progress_test.exs:520` - returns error for quest not found
- `test/exmud/framework/quest/progress_test.exs:534` - handles empty rewards
- `test/exmud/framework/quest/progress_test.exs:549` - handles partial rewards
- `test/exmud/framework/quest/quest_test.exs:160` - turn_in_quest/2 is delegated
- `test/exmud/framework/quest/quest_test.exs:275` - complete workflow from accept to turn in

---

## Bug 2: Incorrect Map Access in complete_objective/3

**Location:** `lib/exmud/framework/quest/progress.ex:149`

**Issue:** The code uses dot notation (`quest_data.objectives`) to access a map field, but `quest_data` is a map with string keys, not a struct.

**Current Code:**
```elixir
case Map.get(quest_data.objectives, objective_id) do
```

**Problem:** This causes a `KeyError` because you can't use dot notation on a map with string keys.

**Fix Needed:**
```elixir
objectives = quest_data["objectives"] || quest_data[:objectives] || %{}
case Map.get(objectives, objective_id) do
```

Or more concisely:
```elixir
case Map.get(quest_data["objectives"] || quest_data[:objectives] || %{}, objective_id) do
```

**Affected Tests (currently skipped):**
- `test/exmud/framework/quest/progress_test.exs:341` - manually completes an objective
- `test/exmud/framework/quest/progress_test.exs:374` - returns error for nonexistent objective
- `test/exmud/framework/quest/quest_test.exs:118` - complete_objective/3 is delegated

---

## Summary

**Total Tests Created:** 58
**Tests Passing:** 49
**Tests Skipped (reveal bugs):** 9

The test suite successfully covers all public API functions in the Quest framework modules:
- `Exmud.Framework.Quest.Definitions` (quest definition loading and parsing)
- `Exmud.Framework.Quest.Progress` (quest progress tracking and rewards)
- `Exmud.Framework.Quest` (delegation facade)

Once the two bugs above are fixed, all 58 tests should pass.
