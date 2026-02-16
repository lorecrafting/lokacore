# Framework Subsystems (V2)

Loka's framework layer provides ~52 modules across 14 subsystems that build on the unified entity system. In V2, the framework is a thin dispatch layer — most game logic lives in scripts and behaviors attached to entities.

> **V2 Architecture:** Everything is an entity. All game data lives in `entity.components`. Content modules resolve via `Entities.find_one()`. Component accessor modules provide typed access. Behaviors use `EntityBehavior` callbacks. StateMachine engine powers quests, combat, dialogue, and NPC AI.

> **Documentation Pattern:** This doc provides YAML configuration examples for content creators.
> For Elixir API details, see each module's `@moduledoc`.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Framework Layer (~52 modules)               │
├─────────────────────────────────────────────────────────────┤
│ Core Systems                                                │
│   Actions (2), Combat (4), Dialogue, Inventory (5)         │
│   Player, Quest (19), Status                               │
├─────────────────────────────────────────────────────────────┤
│ Character Systems                                           │
│   Skills (2), Resources (2), Conditions                    │
├─────────────────────────────────────────────────────────────┤
│ World & Content                                             │
│   World (4), Social (6), Broadcast                         │
│   Content Validator (3)                                    │
└─────────────────────────────────────────────────────────────┘

Supporting Layers:
- Content Modules (12): Quest, Dialogue, Script, Zone, Skill, etc.
- Component Accessors (23+): Typed access to entity.components
- Behaviors (11): Weather, DayNight, Patrol, Guard, Wander, etc.
```

## Subsystem Reference

### Core Systems

#### Player (`lib/loka/framework/player/`)

**Purpose**: Player state management (V1 remnant, being phased out in V2).

**Key Module**: `Loka.Framework.Player.GameState`

**V2 Migration Status**: In V2, players are entities with player components. The `GameState` table is a temporary bridge during migration. New code should use `Entities.find_one(account_id: account_id, type: :player)` and component accessors.

**Features**:
- Legacy: Stores inventory, equipment, quests, flags, stats, health
- Current room tracking via `location_id`

**V2 Pattern**:
```elixir
# Get player entity
{:ok, player} = Entities.find_one(account_id: account_id, type: :player)

# Access components
health = Components.Combatant.health(player)
stats = Components.Combatant.stats(player)
inventory = Entities.find_all(location_id: player.id, type: :item)
```

---

#### Inventory (`lib/loka/framework/inventory/`)

**Purpose**: Item management - adding, removing, using items.

**Key Modules**: `Loka.Framework.Inventory` (5 modules: inventory.ex, container.ex, equipment.ex, stacking.ex, item.ex)

**V2 Pattern**: Containment via `location_id`. Items exist as entities with `location_id = player.id`. Equipment uses `components["equipment"]` slot tracking.

**Features**:
- Add/remove items via entity location updates
- Consumable items (healing, buffs) via `components["consumable"]`
- Equipment slots (weapon, armor, accessory) via `components["equipment"]`
- Item stacking for identical items

**V2 Usage**:
```elixir
# Get player inventory (items with location_id = player.id)
items = Entities.find_all(location_id: player.id, type: :item)

# Add item to inventory (update location_id)
{:ok, item} = Entities.update_entity(item, %{location_id: player.id})

# Use consumable (handled by Actions.Context)
{:ok, result} = Actions.Context.use_item(player, item_id)

# Equip item (Equipment module)
{:ok, updated_player} = Equipment.equip(player, item_id)
```

---

#### Progression

**Status**: Removed in V2 cleanup (Feb 2026). XP/leveling functionality moved to component-based progression in `components["progression"]` with script-based level-up handlers.

**V2 Alternative**: Define XP curves and level-up rewards in entity scripts. Use `components["progression"]` to track XP/level state.

**Example**:
```yaml
# Player entity component
components:
  progression:
    xp: 0
    level: 1
    xp_to_next: 400
```

---

#### Combat (`lib/loka/framework/combat/`)

**Purpose**: Combat system powered by StateMachine engine.

**Key Modules**: `Loka.Framework.Combat` (4 modules: combat.ex, damage_calculator.ex, death_handler.ex, respawn_manager.ex)

**V2 Pattern**: Combat uses `StateMachine` for state transitions (idle → combat → victory/defeat/fled). Combatant data in `components["combatant"]`. Death triggers `on_death` event for respawn/loot scripts.

**Features**:
- Attack/defend/flee actions via `Actions.Combat`
- Damage calculation with weapon/armor modifiers
- StateMachine-based combat phases
- Death and respawn handling
- XP and loot rewards on victory

**YAML Component** (in NPC prototypes):
```yaml
components:
  combatant:
    health: {current: 100, max: 100}
    stats: {str: 10, dex: 10, sta: 10}
    xp_reward: 50
    loot_table: ["common_coin_drop"]
```

**V2 Usage**:
```elixir
# Start combat (via Actions.Context)
{:ok, result} = Actions.Context.attack(attacker, target_id)

# Combat state tracked in StateMachine
{:ok, state} = StateMachine.current_state(player.id, :combat)

# Damage calculation
damage = DamageCalculator.calculate(attacker, defender, weapon)
```

---

#### Quest (`lib/loka/framework/quest/`)

**Purpose**: Quest tracking and completion using StateMachine.

**Key Modules**: `Loka.Framework.Quest` (19 modules including quest.ex, objective_tracker.ex, state_machine_integration.ex, etc.)

**V2 Pattern**: Quests are content entities with `components["data"]` containing quest definition. Player progress tracked in `components["quest_progress"]`. Quest state machines handle multi-objective progression.

**Features**:
- Multiple objective types (talk, kill, collect, visit, craft, explore)
- StateMachine-based quest phases (not_started → active → completed/failed)
- Rewards (XP, items, gold) via reward handlers
- Prerequisite quests and branching storylines
- Content loaded via `Content.Quest.get(key)`

**YAML Format** (`priv/world/quests/`):
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

**V2 Usage**:
```elixir
# Get quest definition
{:ok, quest} = Content.Quest.get("find_the_hermit")

# Access quest data via component
quest_data = Components.QuestDef.data(quest)
objectives = Components.QuestDef.objectives(quest)

# Track player progress
progress = Components.QuestProgress.get(player, "find_the_hermit")
```

---

#### Dialogue (`lib/loka/framework/dialogue/`)

**Purpose**: NPC conversation trees using StateMachine.

**Key Module**: `Loka.Framework.Dialogue`

**V2 Pattern**: Dialogues are content entities loaded via `Content.Dialogue.get(key)`. Dialogue state tracked in StateMachine. Node transitions, conditions, and actions defined in `components["data"]`.

**Features**:
- Branching dialogue nodes with StateMachine transitions
- Action triggers (start quest, give item, set flags)
- Conditional responses (show_if conditions evaluated at runtime)
- Quest progress-aware variants
- Multi-speaker cutscenes

**YAML Format** (`priv/world/dialogues/`):
```yaml
key: hermit_greeting
name: "Hermit Greeting"
speaker: hermit
nodes:
  greeting:
    text: "Welcome, seeker of wisdom."
    options:
      - label: "Tell me about the mountain"
        next: mountain_info
      - label: "Farewell"
        action: end
  mountain_info:
    text: "The mountain holds many secrets..."
    options:
      - label: "Continue"
        next: greeting
```

**V2 Usage**:
```elixir
# Get dialogue definition
{:ok, dialogue} = Content.Dialogue.get("hermit_greeting")

# Start dialogue (creates StateMachine instance)
{:ok, state} = Dialogue.start(player, dialogue.id)

# Advance to next node
{:ok, state} = Dialogue.choose_option(player, dialogue.id, option_index)
```

---

### Character Systems

#### Skills (`lib/loka/framework/skills/`)

**Purpose**: Learnable character skills (LegendMUD-style).

**Key Modules**: `Loka.Framework.Skills` (2 modules: skill.ex, skill_use.ex)

**V2 Pattern**: Skills are content entities with `components["data"]` containing skill definition. Player skill levels tracked in `components["skills"]`. Content loaded via `Content.Skill.get(key)`.

**Features**:
- Point-cost formulas
- Prerequisites and skill trees
- Practice to improve (use-based progression)
- Trainer NPCs (learn from entities with `components["trainer"]`)

**YAML Format** (`priv/world/prototypes/skills/`):
```yaml
key: sword_mastery
name: "Sword Mastery"
category: combat
max_level: 100
cost_formula: "level * 10"
prerequisites: []
trainers: [weapon_master]
description: "Master the art of the blade"
```

**V2 Usage**:
```elixir
# Get skill definition
{:ok, skill} = Content.Skill.get("sword_mastery")

# Check player skill level
level = Components.Skills.level(player, "sword_mastery")

# Use skill (triggers practice)
{:ok, result} = Skills.use_skill(player, "sword_mastery", target)
```

---

#### Status (`lib/loka/framework/status/`)

**Purpose**: Buffs, debuffs, and status effects.

**Key Module**: `Loka.Framework.Status`

**V2 Pattern**: Status effects stored in `components["status_effects"]` as a list of active effects. Effect definitions are content entities loaded via `Content.StatusEffect.get(key)`.

**Features**:
- Duration and stack tracking
- Trigger effects (on_apply, on_remove, on_tick)
- Stat modifiers (temporary changes to combatant stats)
- Damage-over-time and healing-over-time
- Dispel mechanics

**YAML Format** (`priv/world/prototypes/status_effects/`):
```yaml
key: poison
name: "Poisoned"
type: debuff
duration: 5
stackable: true
max_stacks: 3
effects:
  on_tick:
    damage: 5
  on_apply:
    message: "You feel poison coursing through your veins."
```

**V2 Usage**:
```elixir
# Apply status effect
{:ok, entity} = Status.apply_effect(entity, "poison", stacks: 1)

# Check active effects
effects = Components.StatusEffects.list(entity)

# Remove effect
{:ok, entity} = Status.remove_effect(entity, "poison")
```

---

#### Resources (`lib/loka/framework/resources/`)

**Purpose**: Consumable resource pools (mana, stamina, etc.).

**Key Modules**: `Loka.Framework.Resources` (2 modules: resource.ex, resource_tracker.ex)

**V2 Pattern**: Resources stored in `components["resources"]` as `{current, max}` pairs. Resource definitions are content entities. Regeneration handled by entity ticks or behavior scripts.

**Features**:
- Configurable regeneration rates
- Regeneration conditions (always, out-of-combat, resting)
- Stat-based max formulas
- Custom resource types (mana, stamina, focus, ki, etc.)

**YAML Format** (`priv/world/prototypes/resources/` - removed in Feb 2026 cleanup, now in entity components):
```yaml
# Example: Player entity with resources
components:
  resources:
    mana: {current: 100, max: 100}
    stamina: {current: 50, max: 50}
```

**V2 Usage**:
```elixir
# Access resources
mana = Components.Resources.get(entity, "mana")

# Consume resource
{:ok, entity} = Resources.consume(entity, "mana", 20)

# Regenerate resource
{:ok, entity} = Resources.regenerate(entity, "mana", 5)
```

---

### World Systems

#### World (`lib/loka/framework/world/`)

**Purpose**: Room loading, display, and atmospheric systems.

**Key Modules**: `Loka.Framework.World` (4 modules: room.ex, weather.ex, day_night.ex, atmosphere.ex)

**V2 Pattern**: Rooms are entities with `components["room"]`. Weather and DayNight are EntityBehavior modules (in `lib/loka/behaviors/`) with tick-based updates. Ambient messages via NpcAmbient and RoomAmbient behaviors.

**Features**:
- Load rooms for display with NPCs, items, exits
- Weather effects with gameplay modifiers (via Weather behavior)
- Day/night cycles with phases (via DayNight behavior)
- NPC ambient dialogue (via NpcAmbient behavior)
- Room ambient messages (via RoomAmbient behavior)

**Room Loading**:
```elixir
# Load room for game client display
{:ok, room_data} = World.Room.load_for_display(room_id)
# => %{id: "uuid", name: "Forest", description: "...", entities: [...], exits: [...]}
```

**Ambient Messages** (YAML):
```yaml
# NPC with ambient behavior
traits:
  - NpcAmbient
components:
  emotes:
    messages:
      - "Novice Pema shifts nervously."
      - "Novice Pema glances around."
    interval: 45
```

**Weather/DayNight** (Behaviors):
```elixir
# Weather and DayNight are EntityBehavior modules
# They run on tick and broadcast state changes via PubSub
# Entities can subscribe to weather/time events
```

---

#### Economy

**Status**: Removed in V2 cleanup (Feb 2026). Shop/trading functionality moved to script-based merchant handlers.

**V2 Alternative**: Define shops via `components["shop"]` on NPC entities with `on_trade` event scripts.

---

#### Crafting

**Status**: Removed in V2 cleanup (Feb 2026). Recipe-based crafting moved to content entities with `type: :recipe`.

**V2 Alternative**: Recipes are content entities loaded via `Content.Recipe.get(key)`. Crafting logic handled by Actions.Context or custom scripts.

---

#### Gathering

**Status**: Removed in V2 cleanup (Feb 2026). Resource nodes are now entities with `components["gathering_node"]` and `on_gather` event scripts.

---

### Social Systems

**Social** (`social/`, 6 modules) provides chat channels and party grouping. Players can communicate via public, private, or system channels (e.g., trade, newbie, announcements). A `MessageRouter` delivers scoped messages (room, direct, party) to the correct PubSub recipients. The `PartyManager` handles temporary player groups for coordinated gameplay.

**V2 Pattern**: Channels and parties tracked in entity components. Social events broadcast via PubSub. No separate social state tables.

**Spark**: Removed in V2 cleanup (Feb 2026). Companion system deferred to post-MVP.

## Common Patterns (V2)

### Content Module Pattern

Content modules provide domain-specific APIs that resolve to entities:

```elixir
# Content modules resolve via Entities.find_one()
{:ok, quest} = Content.Quest.get("intro_welcome")
{:ok, dialogue} = Content.Dialogue.get("hermit_greeting")
{:ok, skill} = Content.Skill.get("sword_mastery")

# Access quest data via component
objectives = Components.QuestDef.objectives(quest)
```

### Component Accessor Pattern

Component modules provide typed access to `entity.components`:

```elixir
# Component accessors (23+ modules in lib/loka/components/)
health = Components.Combatant.health(entity)
stats = Components.Combatant.stats(entity)
inventory = Components.Container.contents(entity)
dialogue_tree = Components.DialogueTree.nodes(entity)
```

### Component Pattern in YAML

Subsystems add functionality via entity components:

```yaml
# NPC with multiple subsystem integrations
components:
  combatant:
    health: {current: 100, max: 100}
    stats: {str: 10, dex: 10, sta: 10}
  dialogue_tree:
    greeting: "Welcome, traveler!"
    nodes: {...}
  trader:
    buy_multiplier: 1.0
    sell_multiplier: 0.5
```

### EntityBehavior Pattern

Behaviors use `EntityBehavior` callbacks for recurring logic:

```elixir
defmodule Loka.Behaviors.Weather do
  use Loka.Engine.EntityBehavior

  @impl true
  def on_init(entity, _config) do
    # Initialize weather state
    {:ok, entity}
  end

  @impl true
  def on_tick(entity) do
    # Update weather, broadcast changes
    {:ok, entity}
  end
end
```

### StateMachine Pattern

Quests, combat, dialogue, and NPC AI use the StateMachine engine:

```elixir
# Start a state machine instance
{:ok, state} = StateMachine.start(entity_id, :quest, "not_started")

# Transition to next state
{:ok, state} = StateMachine.transition(entity_id, :quest, "active")

# Get current state
{:ok, state} = StateMachine.current_state(entity_id, :quest)
```

### Entity Query Pattern

All queries go through `Entities` module:

```elixir
# Find by key and type
{:ok, entity} = Entities.find_one(key: "goblin", type: :npc)

# Find all by type and location
entities = Entities.find_all(type: :item, location_id: room_id)

# Find by component (capability-based)
combatants = Entities.find_all(component: "combatant")
```

## Files

| Directory | Modules | Key Files |
|-----------|---------|-----------|
| `actions/` | 2 | context.ex, combat.ex |
| `broadcast/` | 1 | broadcast.ex |
| `combat/` | 4 | combat.ex, damage_calculator.ex, death_handler.ex, respawn_manager.ex |
| `conditions/` | 1 | evaluator.ex |
| `content_validator/` | 3 | validator.ex, quest_validator.ex, dialogue_validator.ex |
| `dialogue/` | 1 | dialogue.ex |
| `inventory/` | 5 | inventory.ex, container.ex, equipment.ex, stacking.ex, item.ex |
| `player/` | 1 | game_state.ex (V1 remnant) |
| `quest/` | 19 | quest.ex, objective_tracker.ex, state_machine_integration.ex, etc. |
| `resources/` | 2 | resource.ex, resource_tracker.ex |
| `skills/` | 2 | skill.ex, skill_use.ex |
| `social/` | 6 | message_router.ex, channel_manager.ex, party_manager.ex, etc. |
| `status/` | 1 | status.ex |
| `world/` | 4 | room.ex, weather.ex, day_night.ex, atmosphere.ex |

**Supporting Layers**:
- **Content Modules** (`lib/loka/content/`, 12 modules): Quest, Dialogue, Script, Zone, Skill, Recipe, StatusEffect, GatheringNode, Cutscene, Resource, Storyline, Validator
- **Component Accessors** (`lib/loka/components/`, 23+ modules): Combatant, QuestDef, QuestProgress, DialogueTree, Skills, Equipment, Container, Exit, Room, Player, etc.
- **Behaviors** (`lib/loka/behaviors/`, 11 modules): Weather, DayNight, NpcAmbient, RoomAmbient, Patrol, Guard, Wander, Aggressive, Scavenger, Janitor, Runner

## V2 Removed Systems

The following systems were removed in the V2 cleanup (Feb 2026):

- **Magic** (4 modules) - Magic word system
- **Farming** (4 modules) - Crop planting/harvesting
- **Housing** - Player housing
- **Companion** - Pet/companion system (deferred to post-MVP as "Spark")
- **Mail** - In-game mail system
- **Barter** - Player-to-player trading
- **Clothing** - Cosmetic clothing slots
- **Elements** - Elemental damage types
- **WeaponArmorTypes** - Type-specific weapon/armor bonuses
- **CombatRound** - Turn-based combat rounds (replaced by StateMachine)
- **Relationships** - NPC reputation system
- **MVSystem** - Multi-variant system
- **Quest.Status** - Old quest status tracking (replaced by StateMachine)
- **Quest.ObjectiveTypes** - Old objective type registry (moved to content)
- **Abilities** - Character abilities (replaced by Skills)
- **Progression** - XP/leveling (moved to component-based progression)
- **Economy** - Shop/trading (moved to script-based handlers)
- **Crafting** - Recipe-based crafting (moved to content entities)
- **Gathering** - Resource node harvesting (moved to entity scripts)

## Related

- [Unified Object System (V2)](../architecture/unified-object-system-v2.md) - V2 architecture design doc
- [Entity System](../architecture/entity-system.md) - How entities work
- [Components](../architecture/components.md) - Component system
- [StateMachine](../architecture/state-machine.md) - State machine engine
- [EntityBehavior](../architecture/entity-behavior.md) - Behavior callbacks
- [Content System](../architecture/content-system.md) - Content loading
- [Prototypes](../architecture/prototypes.md) - YAML content format
