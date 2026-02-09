# Framework Subsystems

Loka's framework layer provides 31 game subsystems that build on the engine core. Each subsystem is designed to be optional and composable, allowing game developers to enable only what they need.

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
│   Abilities, Skills, Status, Resources, Appearance         │
├─────────────────────────────────────────────────────────────┤
│ World Systems                                               │
│   World, Economy, Housing                                  │
├─────────────────────────────────────────────────────────────┤
│ Crafting Systems                                            │
│   Crafting, Gathering, Farming, Magic                      │
├─────────────────────────────────────────────────────────────┤
│ Social Systems                                              │
│   Companion, Messaging                                      │
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

#### Abilities (`lib/loka/framework/abilities/`)

**Purpose**: Skills and special actions characters can perform.

**Key Module**: `Loka.Framework.Abilities.Ability`

**Features**:
- Cooldowns and resource costs
- Requirement checking (level, skill)
- Effect application (damage, heal, buff)
- Types: offensive, defensive, utility, passive

**YAML Format**:
```yaml
key: fireball
name: "Fireball"
type: offensive
cost: {mana: 20}
cooldown: 3
damage: {base: 25, scaling: {int: 0.5}}
requirements:
  level: 5
  skill: fire_magic
```

---

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

#### Appearance (`lib/loka/framework/appearance/`)

**Purpose**: Character appearance and clothing.

**Key Module**: `Loka.Framework.Appearance.Clothing`

**Features**:
- Layer-based clothing slots
- Social bonuses
- Warmth values
- Dyeing system
- Faction disguises

**YAML Component**:
```yaml
components:
  wearable:
    slot: body
    layer: 2
    warmth: 3
    appearance: "wearing elegant robes"
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
- `Loka.Framework.World.RoomElements` - Environmental gameplay modifiers
- `Loka.Framework.World.ExtendedDescriptions` - Context-aware room descriptions

**Features**:
- Load rooms for display with NPCs, items, exits
- Atmospheric room entry messages (for special rooms)
- NPC ambient dialogue (periodic NPC comments)
- Room ambient messages (environmental sounds)
- Weather effects with gameplay modifiers
- Day/night cycles with phases (dawn, day, dusk, night)
- Extended descriptions based on time, weather, skills
- Room elements (water, darkness, terrain) affecting gameplay

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

#### Housing (`lib/loka/framework/housing/`)

**Purpose**: Player housing system.

**Key Module**: `Loka.Framework.Housing`

**Features**:
- Purchase or rent
- Furniture placement
- Secure storage
- Home recall ability

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

#### Farming (`lib/loka/framework/farming/`)

**Purpose**: Crop planting and harvesting.

**Key Module**: `Loka.Framework.Farming`

**Features**:
- Plant, water, harvest cycle
- Growth stages
- Crop withering
- Farm plots

---

#### Magic (`lib/loka/framework/magic/`)

**Purpose**: Discovery-based spell system.

**Key Module**: `Loka.Framework.Magic.SpellWords`

**Features**:
- Learnable spell words
- Word combinations create spells
- Unknown combinations can fizzle
- Random effects for failed casts

---

### Social Systems

#### Companion (`lib/loka/framework/companion/`)

**Purpose**: NPC followers/pets.

**Key Module**: `Loka.Framework.Companion`

**Features**:
- Loyalty, hunger, happiness tracking
- Commands: follow, stay, guard, attack
- Combat assistance
- Item carrying

---

#### Messaging (`lib/loka/framework/messaging/`)

**Purpose**: In-game mail system.

**Key Module**: `Loka.Framework.Messaging.Mail`

**Features**:
- Inbox, sent, archive folders
- Item attachments
- Expiry dates
- System mail from NPCs/quests

---

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
| `abilities/` | Abilities | ability.ex, ability_registry.ex |
| `appearance/` | Appearance | clothing.ex |
| `combat/` | Combat | combat.ex, respawn_manager.ex |
| `companion/` | Companion | companion.ex |
| `crafting/` | Crafting | crafting.ex, crafting_registry.ex |
| `dialogue/` | Dialogue | dialogue.ex |
| `economy/` | Economy | economy.ex, shop.ex |
| `farming/` | Farming | farming.ex, crop.ex |
| `gathering/` | Gathering | gathering.ex, gathering_registry.ex |
| `housing/` | Housing | housing.ex |
| `inventory/` | Inventory | inventory.ex |
| `magic/` | Magic | spell_words.ex |
| `messaging/` | Messaging | mail.ex |
| `player/` | Player | game_state.ex |
| `progression/` | Progression | progression.ex |
| `quest/` | Quest | quest.ex, definitions.ex, progress.ex |
| `resources/` | Resources | resource.ex, resource_registry.ex |
| `skills/` | Skills | skill.ex, skill_registry.ex |
| `status/` | Status | status_manager.ex, status_registry.ex |
| `world/` | World | room.ex, ambient.ex, weather.ex, day_night.ex, atmosphere.ex |

## Related

- [Entity System](../architecture/entity-system.md) - How entities work
- [Prototypes](../architecture/prototypes.md) - YAML content format
- [Hooks & Locks](../architecture/hooks-and-locks.md) - Lifecycle events
