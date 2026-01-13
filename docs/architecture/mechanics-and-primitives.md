# Mechanics & Primitives Architecture

## Overview

Loka uses a three-layer architecture for game mechanics:

```
┌─────────────────────────────────────────────────────────┐
│  Framework Layer (Combat, Inventory, etc.)              │
│  Uses mechanics for game operations                     │
├─────────────────────────────────────────────────────────┤
│  Mechanics Layer (Damage, Heal, Cost, Check)            │
│  Game operations with audit trails                      │
├─────────────────────────────────────────────────────────┤
│  Primitives Layer (ResourcePool, Value, Timer, Roll)    │
│  Pure data structures, no side effects                  │
├─────────────────────────────────────────────────────────┤
│  Balance Config (priv/config/balance.yml)               │
│  All formulas and constants in one place                │
└─────────────────────────────────────────────────────────┘
```

## Benefits

1. **Auditability**: Every operation returns an audit trail for debugging balance issues
2. **Configurability**: All formulas live in YAML, not code
3. **Testability**: Pure primitives are easy to unit test
4. **Consistency**: One way to calculate damage, healing, costs

## Primitives Layer

Located in `lib/loka/primitives/`. Pure data structures with no game logic.

### ResourcePool

Tracks current/max values for health, mana, stamina, etc.

```elixir
alias Loka.Primitives.ResourcePool

# Create a pool
pool = ResourcePool.new(100)
pool = ResourcePool.new(current: 50, max: 100)

# Operations return {:ok, pool, audit}
{:ok, pool, audit} = ResourcePool.consume(pool, 20)
{:ok, pool, audit} = ResourcePool.restore(pool, 10)

# Queries
ResourcePool.has_enough?(pool, 30)  # => true
ResourcePool.percentage(pool)        # => 0.5
ResourcePool.is_full?(pool)          # => false
```

### Value

Simple values with stacking modifiers (gold, stats, etc.).

```elixir
alias Loka.Primitives.Value

# Create a value
value = Value.new(100)

# Add modifiers
{:ok, value, _} = Value.add_modifier(value, "buff", :flat, 10, "potion")
{:ok, value, _} = Value.add_modifier(value, "boost", :percent, 0.2, "skill")

# Get computed value: (100 + 10) * 1.2 = 132
Value.compute(value)  # => 132
```

### Timer

Duration and expiration tracking.

```elixir
alias Loka.Primitives.Timer

# Create timers
timer = Timer.new(5000)           # 5 second timer
timer = Timer.new_seconds(30)     # 30 seconds
timer = Timer.new_minutes(5)      # 5 minutes

# Check status
Timer.expired?(timer)      # => false
Timer.remaining_ms(timer)  # => 4500
Timer.progress(timer)      # => 0.1

# Pause/resume
{:ok, timer, _} = Timer.pause(timer)
{:ok, timer, _} = Timer.resume(timer)
```

### Roll

Dice rolling and weighted random selection.

```elixir
alias Loka.Primitives.Roll

# Dice rolls
{:ok, result, _} = Roll.dice("2d6+3")
result.total   # => 11
result.rolls   # => [4, 4]

# Success checks
{:ok, result, _} = Roll.check(75)  # 75% success
result.success  # => true/false

# Weighted selection
table = [{70, :common}, {25, :uncommon}, {5, :rare}]
{:ok, result, _} = Roll.weighted(table)
result.selected  # => :common
```

## Mechanics Layer

Located in `lib/loka/mechanics/`. Game operations that combine primitives.

### Damage

Calculates and applies damage with configurable formulas.

```elixir
alias Loka.Mechanics.Damage
alias Loka.Primitives.ResourcePool

# Calculate damage from stats
context = %{str: 15, weapon_bonus: 5, dex: 12}
{:ok, damage, audit} = Damage.calculate(context)

# Apply to health pool
health = ResourcePool.new(100)
{:ok, health, result} = Damage.apply_to(health, damage)

result.health_before  # => 100
result.health_after   # => 82
result.is_fatal       # => false

# Combined operation
{:ok, health, result} = Damage.deal(health, context, defense: 5)
```

### Heal

Calculates and applies healing.

```elixir
alias Loka.Mechanics.Heal

# Calculate healing
context = %{int: 15, level: 5}
{:ok, healing, audit} = Heal.calculate(context)

# Apply to health
{:ok, health, result} = Heal.apply_to(health, healing)

# Convenience functions
{:ok, health, _} = Heal.heal_full(health)
{:ok, health, _} = Heal.heal_percent(health, 20)  # 20% of max
```

### Cost

Checks and pays resource costs.

```elixir
alias Loka.Mechanics.Cost

# Check affordability
Cost.can_afford?(mana_pool, 30)  # => true

# Pay single cost
{:ok, mana, audit} = Cost.pay(mana_pool, 30)

# Pay multiple costs atomically
resources = %{mana: mana_pool, stamina: stamina_pool}
costs = %{mana: 20, stamina: 30}

{:ok, resources, audit} = Cost.pay_all(resources, costs)
# Returns {:error, {:insufficient, %{mana: 10}}} if can't afford

# Refund costs
{:ok, resources, _} = Cost.refund_all(resources, costs)
```

### Check

Skill checks and stat comparisons.

```elixir
alias Loka.Mechanics.Check

# Percentage check
{:ok, result, _} = Check.percent(75)
result.success  # => true/false

# Skill check with difficulty
context = %{skill_level: 5, stat: 14}
{:ok, result, _} = Check.skill(context, difficulty: :hard)

# DC check (D&D style)
{:ok, result, _} = Check.against_dc(context, 15, dice: "1d20")

# Opposed check
{:ok, result, _} = Check.opposed(%{str: 18}, %{str: 14}, stat: :str)
result.winner  # => :first, :second, or :tie
```

## Balance Config

All game formulas and constants in `priv/config/balance.yml`.

```yaml
combat:
  damage:
    base_formula: "str + weapon_bonus"
    variance_min: 0.8
    variance_max: 1.2
    minimum: 1
    critical:
      base_chance: 5
      multiplier: 2.0

  healing:
    base_formula: "int + level * 2"
    variance_min: 0.9
    variance_max: 1.1

progression:
  xp_formula: "level * level * 100"
  max_level: 50

resources:
  health:
    max_formula: "50 + sta * 5 + level * 10"
    regen_rate: 1
    regen_condition: "out_of_combat"
```

### Using Balance Config

```elixir
alias Loka.Config.Balance

# Get a value
Balance.get(:combat, :damage, :minimum)  # => 1

# Get nested value
damage_config = Balance.get(:combat, :damage)

# Evaluate formula with context
Balance.eval_formula(:combat, :damage, :base_formula, %{str: 15, weapon_bonus: 5})
# => 20.0

# Reload config
Balance.reload()
```

## Audit Trails

Every operation returns an audit map for debugging:

```elixir
{:ok, damage, audit} = Damage.calculate(context)

audit = %{
  operation: :damage,
  result: %{
    base_damage: 20,
    defense: 5,
    variance: 1.15,
    critical: false,
    final_damage: 17
  },
  timestamp: 1704067200000
}
```

Use audits for:
- Debugging balance issues
- Combat logs
- Analytics
- Replays

## Migration Guide

### Converting Inline Damage

Before:
```elixir
base_damage = str + weapon_bonus
damage = max(1, base_damage - enemy_def)
variance = :rand.uniform(41) - 21
final_damage = max(1, trunc(damage * (1 + variance / 100)))
```

After:
```elixir
alias Loka.Mechanics.Damage

context = %{str: str, weapon_bonus: weapon_bonus}
{:ok, final_damage, audit} = Damage.calculate(context, defense: enemy_def)
```

### Converting Health Maps

Before:
```elixir
current = health["current"]
new_health = max(0, current - damage)
updated_health = Map.put(health, "current", new_health)
```

After:
```elixir
alias Loka.Mechanics.Damage

{:ok, updated_health, result} = Damage.apply_to_map(health, damage)
# result.is_fatal tells you if they died
```

## Testing

Tests are in:
- `test/loka/primitives/` - Primitive tests
- `test/loka/mechanics/` - Mechanics tests

Run with:
```bash
mix test test/loka/primitives/ test/loka/mechanics/
```
