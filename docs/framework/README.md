# Framework Subsystems

Loka's framework layer provides ~25 game subsystems that build on the engine core. Each subsystem is designed to be optional and composable, allowing game developers to enable only what they need.

> **Documentation Pattern:** This doc provides YAML configuration examples for content creators.
> For Elixir API details, see each module's `@moduledoc`.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Framework Layer                           │
├─────────────────────────────────────────────────────────────┤
│ Core Systems                                                │
│   Player, Inventory, Progression, Combat, Quest, Dialogue  │
├─────────────────────────────────────────────────────────────┤
│ Character Systems                                           │
│   Skills, Status, Resources, Progression                   │
├─────────────────────────────────────────────────────────────┤
│ World Systems                                               │
│   World, Economy                                           │
├─────────────────────────────────────────────────────────────┤
│ Crafting Systems                                            │
│   Crafting, Gathering                                      │
├─────────────────────────────────────────────────────────────┤
│ Social & Content                                            │
│   Social, Storyline, Scripting, Spark                      │
└─────────────────────────────────────────────────────────────┘
```

## Subsystem Reference

### Core Systems

#### Player (`lib/loka/framework/player/`)

**Purpose**: Core player state management with Ecto persistence.

**Key Module**: `Loka.Framework.Player.GameState`

**Features**:
- Stores inventory, equipment, quests, flags, stats, health
- Single record per player in database
- Current room tracking

**Usage**:
```elixir
# Get player game state
game_state = GameState.get(player_id)

# Update state
{:ok, updated} = GameState.update(player_id, fn gs ->
  %{gs | health: %{current: 50, max: 100}}
end)
```

---

#### Inventory (`lib/loka/framework/inventory/`)

**Purpose**: Item management - adding, removing, using items.

**Key Module**: `Loka.Framework.Inventory`

**Features**:
- Add/remove items from player inventory
- Consumable items (healing, buffs)
- Equipment slots (weapon, armor, accessory)
- Item effect application

**Usage**:
```elixir
# Add item to inventory
{:ok, gs} = Inventory.add_item(game_state, item_entity)

# Use consumable
{:ok, gs} = Inventory.use_item(game_state, item_id)

# Equip item (auto-detects slot from item)
{:ok, gs} = Equipment.equip(game_state, item_id)
```

---

#### Progression (`lib/loka/framework/progression/`)

**Purpose**: XP and leveling system.

**Key Module**: `Loka.Framework.Progression`

**Features**:
- Quadratic XP curve: Level N requires `100 * N²` XP
- Skill points awarded per level
- Level-up notifications

**XP Table**:
| Level | Total XP Required |
|-------|-------------------|
| 2 | 400 |
| 3 | 900 |
| 5 | 2,500 |
| 10 | 10,000 |

**Usage**:
```elixir
# Award XP
{:ok, gs, leveled_up?} = Progression.award_xp(game_state, 150)

# Check level from XP
level = Progression.level_for_xp(2500)  # => 5
```

---

#### Combat (`lib/loka/framework/combat/`)

**Purpose**: Turn-based combat system.

**Key Modules**: `Loka.Framework.Combat`, `Loka.Framework.Combat.RespawnManager`

**Features**:
- Attack/defend/flee actions
- Damage calculation with variance
- Weapon and defense bonuses
- Enemy AI (attacks or defends)
- XP and gold rewards on victory
- PvE and PvP support

**YAML Component** (in NPC prototypes):
```yaml
components:
  combatant:
    health: {current: 100, max: 100}
    stats: {str: 10, dex: 10, sta: 10}
    xp_reward: 50
    gold_reward: 25
```

**Usage**:
```elixir
# Start combat
combat_state = Combat.start_combat(enemy_entity_id, game_state)

# Execute action
{:ok, new_combat} = Combat.player_action(combat_state, :attack)
```

---

#### Quest (`lib/loka/framework/quest/`)

**Purpose**: Quest tracking and completion.

**Key Modules**: `Loka.Framework.Quest`, `Loka.Framework.Quest.Definitions`

**Features**:
- Multiple objective types (talk, kill, collect, visit)
- Quest acceptance and turn-in
- Rewards (XP, items, gold)
- Prerequisite quests

**YAML Format**:
```yaml
key: find_the_hermit
name: "The Hermit's Wisdom"
description: "Find the hermit in the mountains"
objectives:
  - id: talk_hermit
    type: talk
    target: hermit
    description: "Speak with the hermit"
rewards:
  xp: 200
  items: [wisdom_scroll]
```

---

#### Dialogue (`lib/loka/framework/dialogue/`)

**Purpose**: NPC conversation trees.

**Key Module**: `Loka.Framework.Dialogue`

**Features**:
- Branching dialogue nodes
- Action triggers (start quest, give item)
- Conditional responses (show_if)
- Quest-aware variants

**YAML Component**:
```yaml
components:
  dialogue_tree:
    greeting: "Welcome, traveler!"
    nodes:
      - id: greeting
        text: "How can I help you?"
        options:
          - label: "About quests"
            next: quests_info
          - label: "Goodbye"
            action: end
```

---

### Character Systems

#### Skills (`lib/loka/framework/skills/`)

**Purpose**: Learnable character skills (LegendMUD-style).

**Key Module**: `Loka.Framework.Skills.Skill`

**Features**:
- Point-cost formulas
- Prerequisites and skill trees
- Practice to improve
- Trainer NPCs

**YAML Format**:
```yaml
key: sword_mastery
name: "Sword Mastery"
category: combat
max_level: 100
cost_formula: "level * 10"
prerequisites: []
trainers: [weapon_master]
```

---

#### Status (`lib/loka/framework/status/`)

**Purpose**: Buffs, debuffs, and status effects.

**Key Module**: `Loka.Framework.Status.StatusManager`

**Features**:
- Duration and stack tracking
- Trigger effects (on_apply, on_remove, on_turn_start)
- Stat modifiers
- Damage-over-time and healing-over-time
- Dispel mechanics

**YAML Format**:
```yaml
key: poison
name: "Poisoned"
type: debuff
duration: 5
stackable: true
max_stacks: 3
effects:
  on_turn_start:
    damage: 5
```

---

#### Resources (`lib/loka/framework/resources/`)

**Purpose**: Consumable resource pools (mana, stamina, etc.).

**Key Module**: `Loka.Framework.Resources.Resource`

**Features**:
- Configurable regeneration rates
- Regeneration conditions (always, out-of-combat, resting)
- Stat-based max formulas
- Custom resource types

**YAML Format**:
```yaml
key: mana
name: "Mana"
max_formula: "100 + (int * 5)"
regen_rate: 2
regen_condition: out_of_combat
```

---

### World Systems

#### World (`lib/loka/framework/world/`)

**Purpose**: Room loading, display, and atmospheric systems.

**Key Modules**:
- `Loka.Framework.World.Room` - Room loading and entry events
- `Loka.Framework.World.Ambient` - NPC and room ambient messages
- `Loka.Framework.World.Weather` - Dynamic weather system
- `Loka.Framework.World.DayNight` - Day/night cycle
- `Loka.Framework.World.Atmosphere` - Weather + time descriptions
**Features**:
- Load rooms for display with NPCs, items, exits
- Atmospheric room entry messages (for special rooms)
- NPC ambient dialogue (periodic NPC comments)
- Room ambient messages (environmental sounds)
- Weather effects with gameplay modifiers
- Day/night cycles with phases (dawn, day, dusk, night)

**Room Loading**:
```elixir
# Load room for game client display
{:ok, room} = Room.load_for_display(room_id)
# => %{id: "uuid", title: "Forest", entities: [...], items: [...], exits: [...]}
```

**Ambient Messages** (YAML):
```yaml
# NPC ambient dialogue
components:
  ambient:
    messages:
      - "Novice Pema shifts nervously."
      - "Novice Pema glances around."
    chance: 0.3
```

**Room Entry Effects** (YAML):
```yaml
# Add room_entry_effect tag for atmospheric messages on entry
tags:
  - outdoor
  - sacred
  - room_entry_effect  # Required for entry effect
```

---

#### Economy (`lib/loka/framework/economy/`)

**Purpose**: Shops and trading.

**Key Module**: `Loka.Framework.Economy`

**Features**:
- Buy/sell with merchant NPCs
- Currency management
- Stock limits
- Faction-based pricing

**YAML Component** (merchant NPC):
```yaml
components:
  shop:
    buy_multiplier: 1.0
    sell_multiplier: 0.5
    inventory:
      - item: health_potion
        stock: 10
```

---

### Crafting Systems

#### Crafting (`lib/loka/framework/crafting/`)

**Purpose**: Recipe-based item creation.

**Key Module**: `Loka.Framework.Crafting`

**Features**:
- Ingredient and tool requirements
- Skill checks
- Success/failure outcomes
- Crafting stations with quality bonuses

**YAML Format**:
```yaml
key: iron_sword
name: "Forge Iron Sword"
skill: blacksmithing
skill_level: 20
ingredients:
  - item: iron_ore
    quantity: 3
tools: [forge, hammer]
result: iron_sword
```

---

#### Gathering (`lib/loka/framework/gathering/`)

**Purpose**: Resource node harvesting.

**Key Module**: `Loka.Framework.Gathering`

**Features**:
- Skill requirements
- Tool requirements
- Node depletion and respawn
- Yield calculations

**YAML Component** (room):
```yaml
components:
  gathering_node:
    type: mining
    resource: iron_ore
    skill_required: 10
    uses: 5
    respawn_minutes: 60
```

---

### Social Systems

**Social** (`social/`) provides chat channels and party grouping. Players can communicate via public, private, or system channels (e.g., trade, newbie, announcements), and a `MessageRouter` delivers scoped messages (room, direct, party) to the correct PubSub recipients. The `PartyManager` handles temporary player groups of up to 6 for coordinated gameplay.

**Spark** (`spark/`) is the companion system. Every player bonds with a Spark during character creation -- a persistent companion that tracks world events while the player is offline and delivers "while you were away" summaries on login. The Spark's bond level and personality traits evolve over time through gameplay interactions.

## Common Patterns

### Registry Pattern

Many subsystems use GenServer registries for configuration:

```elixir
# Get a skill definition
{:ok, skill} = SkillRegistry.get("sword_mastery")

# List all skills
skills = SkillRegistry.all()
```

### Component Pattern

Subsystems add functionality via entity components:

```yaml
# NPC with multiple subsystem integrations
components:
  combatant: {...}      # Combat system
  dialogue_tree: {...}  # Dialogue system
  shop: {...}           # Economy system
```

### GameState Integration

Most subsystems read/update the player's GameState:

```elixir
# Pattern: function takes game_state, returns updated game_state
{:ok, new_game_state} = Inventory.add_item(game_state, item)
{:ok, new_game_state} = Progression.award_xp(game_state, 100)
{:ok, new_game_state} = Quest.complete(game_state, quest_id)
```

## Files

| Directory | Subsystem | Key Files |
|-----------|-----------|-----------|
| `combat/` | Combat | combat.ex, respawn_manager.ex, damage_types.ex |
| `conditions/` | Conditions | evaluator.ex |
| `crafting/` | Crafting | crafting.ex, crafting_registry.ex |
| `dialogue/` | Dialogue | dialogue.ex |
| `economy/` | Economy | economy.ex, shop.ex |
| `gathering/` | Gathering | gathering.ex, gathering_registry.ex |
| `inventory/` | Inventory | inventory.ex, container.ex |
| `player/` | Player | game_state.ex |
| `progression/` | Progression | progression.ex |
| `quest/` | Quest | quest.ex, definitions.ex, progress.ex |
| `resources/` | Resources | resource.ex, resource_registry.ex |
| `scripting/` | Scripting | behavior_registry.ex, world_event_handler.ex |
| `skills/` | Skills | skill.ex, skill_registry.ex |
| `social/` | Social | broadcast.ex, channel_manager.ex |
| `spark/` | Spark | spark.ex |
| `status/` | Status | status_manager.ex, status_registry.ex |
| `storyline/` | Storyline | storyline_registry.ex |
| `world/` | World | room.ex, ambient.ex, weather.ex, day_night.ex, atmosphere.ex |

## Related

- [Entity System](../architecture/entity-system.md) - How entities work
- [Prototypes](../architecture/prototypes.md) - YAML content format
- [Hooks & Locks](../architecture/hooks-and-locks.md) - Lifecycle events
