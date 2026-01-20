---
name: yaml-data-handling
description: Ensures correct handling of YAML-loaded data with string/atom key awareness. Use when loading YAML files, accessing YAML data, or converting between formats.
---

# YAML Data Handling

**Auto-applies when**: Loading YAML files, accessing YAML-loaded data, or working with string/atom key conversions

## Purpose

Prevents the #1 bug pattern in the codebase: **string vs atom key mismatches** when working with YAML data.

## The Core Problem

YAML files load with **string keys**, but Elixir code often expects **atom keys**:

```yaml
# YAML file
stat_bonuses:
  str: 2
  con: 1
```

```elixir
# Loaded as:
%{"stat_bonuses" => %{"str" => 2, "con" => 1}}

# NOT as:
%{stat_bonuses: %{str: 2, con: 1}}
```

## When This Skill Activates

This skill activates automatically when you:
- Load YAML files with YamlElixir
- Access data from YAML-loaded maps
- Write functions that process YAML content
- Work with entity prototypes, quests, dialogues, scripts

## Key Rules

### 1. Use MapHelpers for YAML Data Access

```elixir
alias Loka.Utils.MapHelpers

# BAD - Only works with atom keys
Map.get(effect, :amount)
data.stat_bonuses

# GOOD - Works with both string and atom keys
MapHelpers.get_flexible(effect, :amount, 0)
MapHelpers.get_flexible(data, :stat_bonuses, %{})
```

### 2. get_flexible Requires Atom Keys as Input

**CRITICAL**: `get_flexible/3` has a guard `when is_atom(key)`:

```elixir
# BAD - stat is a string from YAML iteration
Enum.reduce(bonuses, stats, fn {stat, bonus}, acc ->
  current = MapHelpers.get_flexible(acc, stat, 10)  # FAILS! stat is string
  ...
end)

# GOOD - Convert string key to atom first
Enum.reduce(bonuses, stats, fn {stat, bonus}, acc ->
  stat_atom = MapHelpers.normalize_atom(stat, :unknown)
  current = MapHelpers.get_flexible(acc, stat_atom, 10)
  ...
end)

# ALSO GOOD - Use get_any with both key types
Enum.reduce(bonuses, stats, fn {stat, bonus}, acc ->
  stat_atom = if is_binary(stat), do: String.to_existing_atom(stat), else: stat
  current = MapHelpers.get_flexible(acc, stat_atom, 10)
  ...
end)
```

### 3. Atomize Keys at Load Boundaries

When loading YAML, convert keys at the boundary:

```elixir
# At load time - convert to atoms
defp from_map(data) do
  %{
    key: MapHelpers.get_flexible(data, :key, ""),
    effects: data
      |> MapHelpers.get_flexible(:effects, [])
      |> Enum.map(&atomize_effect/1)
  }
end

defp atomize_effect(effect) when is_map(effect) do
  MapHelpers.deep_atomize_keys(effect)
end
```

### 4. Document Key Format Expectations

```elixir
@doc """
Processes status effects.

## Key Format
Effect maps should have atom keys (use `deep_atomize_keys/1` if loading from YAML):
- `:action` - The effect action type
- `:amount` - Numeric amount for the effect
"""
def process_effect(effect, active) do
  # Now safe to use atom keys
  amount = Map.get(effect, :amount, 0)
  ...
end
```

## MapHelpers Reference

| Function | Purpose | Use Case |
|----------|---------|----------|
| `get_flexible/3` | Get value by atom key, tries string too | Single key access |
| `get_any/3` | Get value by list of keys | Multiple fallback keys |
| `atomize_keys/1` | Convert top-level string keys to atoms | Shallow conversion |
| `deep_atomize_keys/1` | Recursively convert all string keys | Nested structures |
| `normalize_atom/2` | Convert string to existing atom safely | Key normalization |

## Common Bug Patterns

### Pattern 1: Iteration with String Keys

```elixir
# BUG - stat is string, get_flexible needs atom
Enum.reduce(yaml_bonuses, %{}, fn {stat, value}, acc ->
  current = MapHelpers.get_flexible(acc, stat, 0)  # FAILS
  ...
end)

# FIX - Normalize the key first
Enum.reduce(yaml_bonuses, %{}, fn {stat, value}, acc ->
  stat_key = if is_atom(stat), do: stat, else: String.to_atom(stat)
  current = MapHelpers.get_flexible(acc, stat_key, 0)
  ...
end)
```

### Pattern 2: Direct Map.get on YAML Data

```elixir
# BUG - YAML has string keys
amount = Map.get(effect, :amount) || 0  # Always nil!

# FIX - Use get_flexible
amount = MapHelpers.get_flexible(effect, :amount, 0)
```

### Pattern 3: Forgetting Nested Structures

```elixir
# BUG - Only top level atomized
data = MapHelpers.atomize_keys(yaml_data)
nested_value = data.effects.amount  # FAILS if effects not atomized

# FIX - Use deep atomization
data = MapHelpers.deep_atomize_keys(yaml_data)
```

## Validation

After editing YAML-related code:

```bash
# Run content validation
mix loka.test.validate

# Run specific tests
mix test test/loka/framework/status/status_manager_test.exs
mix test test/loka/framework/hometown/hometown_test.exs
```

## Supporting Files

See `loka-conventions/PATTERNS.md` for general Elixir patterns.
