---
name: balance-config-pattern
description: |
  Pattern for moving hardcoded values to balance.yml configuration in Loka mechanics/framework modules.
  Use when: (1) creating new mechanics modules that need tunable values, (2) refactoring hardcoded
  magic numbers into configurable settings, (3) adding new game balance parameters, (4) implementing
  formulas that designers should be able to tweak. Covers Balance.get() API, default value patterns,
  YAML structure conventions, and layer-appropriate configuration placement.
author: Claude Code
version: 1.0.0
date: 2026-01-29
---

# Balance Configuration Pattern

## Problem

Game mechanics modules often start with hardcoded values (multipliers, caps, base values). These need to be:
1. Configurable without code changes
2. Hot-reloadable in development
3. Testable without loading config files
4. Documented with sensible defaults visible in code

## Context / Trigger Conditions

Use this pattern when:
- Creating new mechanics modules (`lib/loka/mechanics/`)
- Creating framework modules with tunable values (`lib/loka/framework/`)
- You see hardcoded numbers like `60`, `100`, `5` that represent game balance
- Designers need to tweak values without code deploys
- Tests fail because they depend on config files being loaded

## Solution

### Step 1: Define Module Defaults

At the top of your module, define defaults as module attributes:

```elixir
defmodule Loka.Mechanics.Stats do
  alias Loka.Config.Balance

  # Defaults (used when Balance config not loaded - enables testing)
  @default_creation_pool 60
  @default_creation_min 5
  @default_creation_max 30
  @default_points_per_level 5
  @default_max_stat 100
  @default_max_level 50
```

### Step 2: Create Accessor Functions

Wrap Balance.get() calls in public functions:

```elixir
  @doc "Returns creation point pool (default: 60)."
  @spec creation_pool() :: pos_integer()
  def creation_pool do
    Balance.get(:stats, :creation, :pool, default: @default_creation_pool)
  end

  @doc "Returns points gained per level (default: 5)."
  @spec points_per_level() :: pos_integer()
  def points_per_level do
    Balance.get(:stats, :points_per_level, default: @default_points_per_level)
  end
```

### Step 3: Use Accessors in Business Logic

Never call Balance.get() directly in business logic - use the accessors:

```elixir
  def points_at_level(level) when level >= 1 do
    # ✅ Uses accessor function
    creation_pool() + (level - 1) * points_per_level()
  end

  # ❌ DON'T: Direct Balance.get() in business logic
  def bad_example(level) do
    pool = Balance.get(:stats, :creation, :pool, default: 60)
    pool + (level - 1) * 5  # Hardcoded!
  end
```

### Step 4: Add Configuration to balance.yml

Structure follows the module hierarchy:

```yaml
# priv/config/balance.yml

# Section name matches module concept
stats:
  # Nested for logical grouping
  creation:
    pool: 60              # Comment explains what this controls
    min_per_stat: 5
    max_per_stat: 30

  # Top-level for simple values
  points_per_level: 5
  max_stat: 100
  max_level: 50

# Another section for another module
character_resources:
  hp:
    base: 50
    con_multiplier: 4
    level_multiplier: 2
  mana:
    base: 20
    int_multiplier: 3
    spi_multiplier: 2
```

### Step 5: Document in Module

Include configuration reference in moduledoc:

```elixir
  @moduledoc """
  Character stats system - 6 primary stats with allocation rules.

  ## Configuration

  These values are configurable in `priv/config/balance.yml`:

      stats:
        creation:
          pool: 60
          min_per_stat: 5
          max_per_stat: 30
        points_per_level: 5
        max_stat: 100
        max_level: 50
  """
```

## Balance.get() API Reference

```elixir
# Single key lookup
Balance.get(:section, :key, default: fallback)

# Nested key lookup (up to 3 levels)
Balance.get(:section, :subsection, :key, default: fallback)

# Examples:
Balance.get(:stats, :max_level, default: 50)
Balance.get(:combat_stats, :crit, :cap, default: 20)
Balance.get(:character_resources, :hp, :base, default: 50)
```

## Verification

After implementing:

1. **Test without config**: Run `mix test` - should use defaults
2. **Test with config**: Start server, verify config values load
3. **Hot reload**: Run `Balance.reload()` in IEx, verify changes take effect
4. **Documentation**: Check `@moduledoc` includes config reference

## Example: Complete Module

```elixir
defmodule Loka.Mechanics.CombatStats do
  @moduledoc """
  Derived combat statistics calculated from base stats.

  ## Configuration

  Configurable in `priv/config/balance.yml`:

      combat_stats:
        damage_bonus_divisor: 3
        crit:
          per_divisor: 5
          cap: 20
  """

  alias Loka.Config.Balance

  # Defaults
  @default_crit_cap 20
  @default_damage_divisor 3

  # Accessor functions
  @doc "Returns the crit chance cap (default: 20%)."
  @spec crit_cap() :: non_neg_integer()
  def crit_cap do
    Balance.get(:combat_stats, :crit, :cap, default: @default_crit_cap)
  end

  # Business logic using accessors
  @spec crit_chance(map()) :: non_neg_integer()
  def crit_chance(stats) do
    per = Map.get(stats, :per, 0)
    divisor = Balance.get(:combat_stats, :crit, :per_divisor, default: 5)
    min(div(per, divisor), crit_cap())
  end
end
```

## Layer Guidelines

| Layer | Config Appropriate? | Example |
|-------|---------------------|---------|
| Mechanics | ✅ Yes - formulas, caps, multipliers | `combat_stats:`, `character_resources:` |
| Framework | ✅ Yes - system parameters | `skills:`, `combat:` |
| Content | ❌ No - use YAML prototypes | NPC stats, item values |
| Engine | ⚠️ Rarely - only infrastructure | Tick intervals, cache TTL |

## Notes

- **Test isolation**: Defaults enable tests to run without loading Balance config
- **Hot reload**: `Balance.reload()` picks up changes without restart
- **Type safety**: Use typespecs on accessor functions
- **Discoverability**: Comment each YAML value with its purpose
- **Grouping**: Nest related values (e.g., `hp: { base:, multiplier: }`)

## References

- `lib/loka/config/balance.ex` - Balance module implementation
- `priv/config/balance.yml` - Main configuration file
- `docs/architecture/core-mechanics-implementation.md` - Full mechanics documentation
