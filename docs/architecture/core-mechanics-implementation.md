# Core Mechanics Implementation

> **Status:** Implemented (Phase 1 Foundation)
> **Last Updated:** 2026-01-29
> **Design Doc:** `docs/architecture/core-mechanics-design.md`

This document describes the implementation of the core RPG mechanics system.

---

## Layer Architecture

The implementation follows Loka's layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│ CONFIGURATION LAYER (priv/config/balance.yml)               │
│ All tunable values: formulas, caps, multipliers, costs      │
├─────────────────────────────────────────────────────────────┤
│ MECHANICS LAYER (lib/loka/mechanics/)                       │
│ Low-level calculations using Balance config                 │
│ - stats.ex, character_resources.ex, combat_stats.ex         │
│ - damage_types.ex                                           │
├─────────────────────────────────────────────────────────────┤
│ FRAMEWORK LAYER (lib/loka/framework/)                       │
│ Game systems using mechanics                                │
│ - skills/binary_skill*.ex                                   │
├─────────────────────────────────────────────────────────────┤
│ CONTENT LAYER (priv/world/)                                 │
│ YAML definitions loaded by framework                        │
│ - skills/*.yml (skill definitions)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Implemented Modules

### Mechanics Layer

| Module | File | Purpose |
|--------|------|---------|
| `Loka.Mechanics.Stats` | `mechanics/stats.ex` | 6-stat system, allocation rules |
| `Loka.Mechanics.CharacterResources` | `mechanics/character_resources.ex` | HP/Mana/MV formulas |
| `Loka.Mechanics.CombatStats` | `mechanics/combat_stats.ex` | Derived combat stats |
| `Loka.Mechanics.DamageTypes` | `mechanics/damage_types.ex` | Physical/magical damage |

### Framework Layer

| Module | File | Purpose |
|--------|------|---------|
| `Loka.Framework.Skills.BinarySkill` | `skills/binary_skill.ex` | Skill struct definition |
| `Loka.Framework.Skills.BinarySkillManager` | `skills/binary_skill_manager.ex` | Learn/forget skills |
| `Loka.Framework.Skills.BinarySkillRegistry` | `skills/binary_skill_registry.ex` | YAML loading |

---

## Configuration Pattern

All modules use the **Balance.get() pattern** for configurable values:

```elixir
# In module:
alias Loka.Config.Balance

# Default value (used when config not loaded)
@default_creation_pool 60

# Runtime lookup with fallback
def creation_pool do
  Balance.get(:stats, :creation, :pool, default: @default_creation_pool)
end
```

This pattern ensures:
1. **Testability** - Works without config in test environment
2. **Hot-reload** - Values can be changed via `Balance.reload()`
3. **Documentation** - Defaults are visible in code
4. **Type safety** - Typespecs on accessor functions

---

## Balance Configuration

New sections added to `priv/config/balance.yml`:

### Stats Configuration

```yaml
stats:
  creation:
    pool: 60              # Total points at creation
    min_per_stat: 5       # Minimum per stat
    max_per_stat: 30      # Maximum per stat at creation
  points_per_level: 5     # Stat points per level
  max_stat: 100           # Maximum any stat can reach
  max_level: 50           # Maximum character level
```

### Character Resources

```yaml
character_resources:
  hp:
    base: 50
    con_multiplier: 4     # HP = 50 + CON*4 + level*2
    level_multiplier: 2
  mana:
    base: 20
    int_multiplier: 3     # Mana = 20 + INT*3 + SPI*2
    spi_multiplier: 2
    regen_base: 5         # Regen = 5 + INT/5
    regen_int_divisor: 5
  mv:
    base: 100
    con_multiplier: 2     # MV = 100 + CON*2 + DEX*2
    dex_multiplier: 2
    regen_base: 10        # Regen = 10 + DEX/5
    regen_dex_divisor: 5
  tick_interval_ms: 5000
  combat_regen_multiplier: 0.5
```

### Combat Stats

```yaml
combat_stats:
  damage_bonus_divisor: 3   # STR/3, DEX/3, etc.
  hit_bonus:
    dex_divisor: 4
    per_divisor: 6
  crit:
    per_divisor: 5
    cap: 20
  dodge:
    dex_divisor: 5
    cap: 20
  magic_resist:
    spi_divisor: 4
    cap: 25
  poison_resist:
    con_divisor: 4
    cap: 25
  spell_power_stat_divisor: 100
  heal_power_stat_divisor: 100
  mana_cost_stat_divisor: 200
```

---

## Binary Skills System

### Key Differences from Old System

| Aspect | Old System | New System |
|--------|------------|------------|
| Skill levels | 1-100 with XP | Binary (learned/not) |
| Point pool | 100 points | 50 points (1/level) |
| Leveling | XP-based | Instant learn |
| Effectiveness | Skill level | Base stats |

### Skill Structure

```elixir
%BinarySkill{
  key: "kick",
  name: "Kick",
  category: :combat_melee,
  cost: 1,                    # 1-3 skill points
  stat: :str,                 # Governing stat
  prerequisites: [],          # Other skill keys
  trainers: ["combat_master"],
  lag: 2,                     # Rounds of recovery
  cooldown: 0,                # Rounds before reuse
  mv_cost: 10,
  mana_cost: 0
}
```

---

## Integration with Game State

Stats are stored in `game_state.stats`:

```elixir
%{
  str: 60, dex: 40, con: 50, int: 70, per: 40, spi: 40,
  level: 25,
  hp: 250, mana: 180, mv: 200,
  learned_skills: MapSet.new(["kick", "bash", "parry"])
}
```

---

## Remaining Work

### Phase 2: Content

- [ ] Create YAML skill definitions in `priv/world/skills/`
- [ ] Add `BinarySkillRegistry` to supervision tree
- [ ] Define skill trainers (NPCs)

### Phase 3: UI Integration

- [ ] Character creation UI (stat allocation)
- [ ] Level up UI (stat + skill point allocation)
- [ ] Combat UI (targeting)

### Phase 4: Testing

- [ ] Unit tests for mechanics modules
- [ ] Integration tests for combat round
- [ ] Balance simulation tests

---

## Quick Reference

```
STATS: STR / DEX / CON / INT / PER / SPI
       60 base + 5/level = 300 at 50
       Max 100 per stat

DAMAGE: Slashing (STR), Piercing (DEX), Bludgeon (CON), Magic (INT)
        Healing scales with SPI

RESOURCES: HP (CON), Mana (INT+SPI), MV (CON+DEX)

SKILLS: Binary, 1 point/level, 50 total
        Cost 1-3 points each
```
