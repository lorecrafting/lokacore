---
name: loka-conventions
description: Ensures code follows Loka conventions for naming, patterns, architecture boundaries, and error handling. Use when writing or modifying Elixir code, refactoring, reviewing changes, or creating new modules.
---

# Loka Code Conventions

**Auto-applies when**: Writing or modifying Elixir code in the Loka codebase

## Purpose

Ensures all code follows Loka conventions for:
- Module organization
- Naming patterns
- Documentation standards
- Error handling
- Architecture boundaries

## When This Skill Activates

This skill activates automatically when you:
- Write new modules or functions
- Refactor existing code
- Review code changes
- Create new features

## Key Conventions

### Layer Boundaries (CRITICAL)

```
Engine (lib/loka/engine/)
   ↑ calls only
Framework (lib/loka/framework/)
   ↑ calls only
Web (lib/loka_web/)
```

**Rules**:
- Engine MUST NOT import Framework modules
- Framework MUST NOT import Web modules
- Engine MUST NOT contain game-specific data (no hardcoded NPCs, items, quests)

### Action Result Pattern

All game actions return `{:ok, Result.t()} | {:error, reason}`:

```elixir
def execute_action(ctx, params) do
  result = Result.new(
    state: %{game_state: updated_game_state},
    events: [{:event, "Action succeeded"}]
  )
  {:ok, result}
end
```

### Error Handling

Return errors, don't raise (except for programmer errors):

```elixir
# Good - return error tuple
def find_npc(room, npc_key) do
  case Enum.find(room.entities, &(&1.key == npc_key)) do
    nil -> {:error, :npc_not_found}
    npc -> {:ok, npc}
  end
end

# Raise only for programmer errors (not user/content errors)
def get_quest_definition!(quest_id) do
  case get_quest_definition(quest_id) do
    nil -> raise "Quest definition not found: #{quest_id}"
    quest -> quest
  end
end
```

### Naming Conventions

- **Modules**: `Loka.Framework.Quest`, `Loka.Engine.Entity`
- **Public functions**: `start_conversation`, `complete_quest`, `quest_completed?`
- **Private helpers**: `parse_objectives`, `format_room`, `build_context`
- **Variables**: Descriptive names (`game_state`, `quest_def`, `active_objectives`)

### Reserved Keywords (Never Use as Names)

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
schedule_after = 5000
def on_complete(callback), do: ...
```

### YAML Data Handling

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
