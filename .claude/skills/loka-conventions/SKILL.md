---
name: loka-conventions
description: Ensures code follows Loka conventions for naming, patterns, architecture boundaries, and error handling. Use when writing or modifying Elixir code, refactoring, reviewing changes, or creating new modules.
---

# Loka Code Conventions

**Auto-applies when**: Writing or modifying Elixir code in the Loka codebase

> See also: `.claude/rules/framework.md` for layer boundaries, subsystem patterns, Action Result pattern, and error handling.

## Reserved Keywords (Never Use as Names)

Elixir reserved keywords that will cause syntax errors:

```
after, and, catch, cond, do, else, end, fn, for, if,
in, not, or, quote, receive, rescue, try, unquote,
unquote_splicing, when, with, unless
```

```elixir
# BAD - 'after' is reserved
after = 5000
def after(callback), do: ...

# GOOD - Use descriptive alternatives
delay_ms = 5000
def on_complete(callback), do: ...
```

## YAML Data Handling

YAML files load with **string keys**. Use `MapHelpers` for access:

```elixir
alias Loka.Utils.MapHelpers

# BAD - Only works if data has atom keys
Map.get(effect, :amount)

# GOOD - Works with both string and atom keys
MapHelpers.get_flexible(effect, :amount, 0)
```

**Key rule**: When iterating YAML-loaded maps, the keys are strings:

```elixir
# BAD - stat is a string, get_flexible needs atom
Enum.reduce(bonuses, %{}, fn {stat, value}, acc ->
  MapHelpers.get_flexible(acc, stat, 0)  # FAILS!
end)

# GOOD - Convert or use both formats
Enum.reduce(bonuses, %{}, fn {stat, value}, acc ->
  stat_atom = String.to_existing_atom(stat)
  MapHelpers.get_flexible(acc, stat_atom, 0)
end)
```

See `yaml-data-handling` skill for complete guidance.

## Supporting Files

See these files for detailed guidance:
- `NAMING.md` - Complete naming conventions
- `PATTERNS.md` - Common code patterns (Action Result, Event Dispatch, Pipeline)
- `ANTIPATTERNS.md` - What to avoid (direct mutation, side effects, god modules)
