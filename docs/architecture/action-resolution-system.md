# Action Resolution System

> Evennia-inspired action resolution for dynamic, context-aware entity actions.

## Overview

The Action Resolution System determines what actions a player can perform on an entity (NPC, item, player) based on multiple contextual factors. Instead of hardcoding actions client-side, the server resolves available actions through a layered pipeline that considers:

- Entity type and components
- Player's equipment
- Active status effects
- Current room restrictions
- Script-granted/blocked actions
- Condition-based filtering (level, flags, items, etc.)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Player clicks entity                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Loka.Framework.Actions.Resolver                 │
│                                                              │
│  Layer 1: Entity Base Actions (prototype or defaults)        │
│       │                                                      │
│       ▼                                                      │
│  Layer 2: Equipment Grants (Union merge)                     │
│       │                                                      │
│       ▼                                                      │
│  Layer 3: Script Grants (Union merge)                        │
│       │                                                      │
│       ▼                                                      │
│  Layer 4: Status Blocks (Remove merge)                       │
│       │                                                      │
│       ▼                                                      │
│  Layer 5: Script Blocks (Remove merge)                       │
│       │                                                      │
│       ▼                                                      │
│  Layer 6: Room Restrictions (Remove/Intersect merge)         │
│       │                                                      │
│       ▼                                                      │
│  Layer 7: Condition Filtering                                │
│       │                                                      │
│       ▼                                                      │
│  Sort by priority, return to client                          │
└─────────────────────────────────────────────────────────────┘
```

## Merge Rules (Evennia-Inspired)

| Merge Type | Behavior | Use Case |
|------------|----------|----------|
| **Union** | Add new actions, keep existing | Equipment grants, script grants |
| **Remove** | Filter out specific actions | Status effects (stun), script blocks |
| **Intersect** | Only actions in BOTH sets survive | Restricted zones (meditation only) |
| **Replace** | Completely replace all actions | Transformation (werewolf form) |

## File Locations

| Component | Path |
|-----------|------|
| Action struct | `lib/loka/framework/actions/action.ex` |
| Resolver | `lib/loka/framework/actions/resolver.ex` |
| Status effects | `lib/loka/framework/status/status_effect.ex` |
| Script API | `lib/loka/framework/scripting/game_script_api.ex` |

---

## Layer 1: Entity Base Actions

Actions can be defined explicitly on an entity prototype, or the system provides sensible defaults based on entity type and components.

### Explicit Actions (YAML)

```yaml
# priv/world/prototypes/items/mysterious_tome.yml
key: mysterious_tome
type: item
parent: base_item
components:
  actions:
    - key: read
      label: "Read the Tome"
      priority: 100
      conditions:
        - flag: can_read_ancient
      unavailable_message: "The script is incomprehensible."
    - key: study
      label: "Study the Script"
      priority: 90
      conditions:
        - not_flag: can_read_ancient
        - stat_gte: { int: 12 }
```

### Default Actions (Automatic)

If no explicit `actions` component is defined, defaults are generated:

| Entity Type | Components | Default Actions |
|-------------|------------|-----------------|
| Item | - | `get` (priority 100) |
| Item | `container` | `get`, `open` |
| Item | `equipable` | `get`, `equip` |
| Item | `consumable` | `get`, `use` |
| NPC | `dialogue_tree` | `talk` |
| NPC | `shop` | `talk`, `shop` |
| NPC | `combatant` (not friendly) | `attack` |
| NPC | `container` | `open` |
| Player | - | `whisper`, `invite`, `inspect` |

---

## Layer 2: Equipment Grants (Union)

Equipment can grant additional actions when worn. These are added via Union merge (no duplicates).

### Example: Staff that grants Fireball

```yaml
# priv/world/prototypes/items/staff_of_fireballs.yml
key: staff_of_fireballs
type: item
parent: base_weapon
components:
  equipable:
    slot: weapon
  weapon:
    damage: 8
    damage_type: blunt
  grants_actions:
    - key: cast_fireball
      label: "Cast Fireball"
      priority: 100
      icon: fire
      conditions:
        - resource_gte: { mana: 20 }
```

When the player equips this staff, `cast_fireball` appears as an available action on entities (filtered by conditions).

### Example: Ring of Invisibility

```yaml
key: ring_of_invisibility
type: item
components:
  equipable:
    slot: ring
  grants_actions:
    - key: turn_invisible
      label: "Turn Invisible"
      priority: 80
      conditions:
        - not_flag: invisible
        - resource_gte: { mana: 30 }
```

---

## Layer 3: Script Grants (Union)

Scripts can temporarily grant actions by setting the `_granted_actions` flag on the player.

### Via Dialogue Action

```yaml
# In a dialogue tree
nodes:
  bless_player:
    text: "I bestow upon you the power of healing."
    actions:
      - set_flag:
          _granted_actions:
            - key: divine_heal
              label: "Divine Heal"
              priority: 100
              conditions:
                - resource_gte: { faith: 10 }
```

### Via Script API (Lua)

```lua
-- Check if player has a granted action
if game.actions.is_granted("divine_heal") then
  game.message(entity.id, "Your blessing remains active.")
end

-- Get all granted actions
local granted = game.actions.get_granted()
```

---

## Layer 4: Status Blocks (Remove)

Status effects can disable specific actions using the `removes_actions` field.

### Example: Stun Status

```yaml
# priv/world/statuses/stunned.yml
key: stunned
name: Stunned
type: debuff
duration: 2
display_icon: dizzy
display_color: yellow
description: "You are stunned and cannot act."
removes_actions:
  - attack
  - cast
  - move
  - use
```

When a player has the `stunned` status, these actions are filtered out.

### Example: Silence Status

```yaml
key: silenced
name: Silenced
type: debuff
duration: 3
description: "You cannot speak or cast spells."
removes_actions:
  - cast
  - talk
  - shout
```

---

## Layer 5: Script Blocks (Remove)

Scripts can temporarily block actions by setting the `_blocked_actions` flag.

### Via Dialogue Action

```yaml
nodes:
  curse_player:
    text: "You shall not raise your weapon against the innocent!"
    actions:
      - set_flag:
          _blocked_actions:
            - attack
            - attack_player
```

### Checking Blocked Actions (Lua)

```lua
if game.actions.is_blocked("attack") then
  game.message(entity.id, "A curse prevents you from attacking.")
end
```

---

## Layer 6: Room Restrictions (Remove/Intersect)

Rooms can restrict what actions are available using the `action_restrictions` component.

### Remove Mode (Blacklist)

Specific actions are disabled in this room:

```yaml
# priv/world/prototypes/rooms/sacred_temple.yml
key: sacred_temple
type: room
parent: base_room
short_desc: "Sacred Temple"
components:
  action_restrictions:
    remove:
      - attack
      - steal
      - cast_fireball
tags:
  - indoor
  - sacred
  - safe_zone
```

### Intersect Mode (Whitelist)

ONLY these actions are allowed:

```yaml
# priv/world/prototypes/rooms/meditation_chamber.yml
key: meditation_chamber
type: room
parent: base_room
short_desc: "Meditation Chamber"
components:
  action_restrictions:
    intersect:
      - meditate
      - pray
      - talk
      - leave
```

In this room, even if a player has `attack` available from equipment, it will be filtered out because it's not in the intersect list.

---

## Layer 7: Condition Filtering

After all merge operations, each action's conditions are evaluated against the player's current state. Actions whose conditions fail are removed.

### Supported Conditions

| Condition | YAML Syntax | Description |
|-----------|-------------|-------------|
| `flag` | `flag: has_key` | Player has flag set to truthy |
| `not_flag` | `not_flag: cursed` | Player does NOT have flag |
| `level_gte` | `level_gte: 10` | Player level >= value |
| `quest_active` | `quest_active: main_quest` | Quest is currently active |
| `quest_completed` | `quest_completed: intro` | Quest has been completed |
| `has_item` | `has_item: ancient_key` | Has item in inventory |
| `stat_gte` | `stat_gte: { int: 12 }` | Stat >= value |
| `resource_gte` | `resource_gte: { mana: 20 }` | Resource >= value |
| `faction_gte` | `faction_gte: { monks: 50 }` | Faction reputation >= value |

### Example: Conditional Actions

```yaml
components:
  actions:
    - key: unlock
      label: "Unlock the Door"
      priority: 100
      conditions:
        - has_item: golden_key
      unavailable_message: "You need a key."

    - key: pick_lock
      label: "Pick the Lock"
      priority: 90
      conditions:
        - stat_gte: { dex: 14 }
        - has_item: lockpicks

    - key: force_open
      label: "Force Open"
      priority: 80
      conditions:
        - stat_gte: { str: 18 }
```

---

## Transformation/Replace (Special Case)

Status effects with `replaces_all_actions: true` completely replace the action set.

### Example: Werewolf Transformation

```yaml
key: werewolf_form
name: Werewolf Form
type: buff
duration: null  # Permanent until cured
replaces_all_actions: true
grants_actions:
  - key: bite
    label: "Savage Bite"
    priority: 100
  - key: claw
    label: "Rending Claw"
    priority: 90
  - key: howl
    label: "Terrifying Howl"
    priority: 80
  - key: revert
    label: "Revert to Human"
    priority: 10
    conditions:
      - not_flag: moon_full
```

When `replaces_all_actions` is true, the normal resolution pipeline is skipped and ONLY the status-granted actions are available.

---

## Priority System

Actions are sorted by priority (highest first) for display. Use consistent priority ranges:

| Priority Range | Use Case |
|----------------|----------|
| 100+ | Primary actions (talk, attack, get) |
| 80-99 | Secondary actions (shop, open) |
| 60-79 | Utility actions (inspect, examine) |
| 40-59 | Combat abilities |
| 20-39 | Special/rare actions |
| 1-19 | Meta actions (leave, cancel) |

---

## Mobile Client Integration

The mobile client receives resolved actions from the server:

```typescript
interface EntityAction {
  key: string;
  label: string;
  icon?: string;
}

interface EntityContext {
  id: string;
  name: string;
  type: string;
  // ... other fields
  actions?: EntityAction[];  // Server-resolved actions
}
```

The client uses server actions if provided, with a fallback to client-side logic for backwards compatibility.

---

## Script API Reference

Available in Lua scripts via `game.actions.*`:

```lua
-- Check if an action is currently granted by scripts
game.actions.is_granted("divine_heal")  -- returns boolean

-- Check if an action is currently blocked by scripts
game.actions.is_blocked("attack")  -- returns boolean

-- Get list of all script-granted action keys
game.actions.get_granted()  -- returns table of strings

-- Get list of all script-blocked action keys
game.actions.get_blocked()  -- returns table of strings
```

---

## Common Patterns

### Quest-Gated Actions

```yaml
- key: enter_sanctum
  label: "Enter the Sanctum"
  conditions:
    - quest_completed: prove_worthy
```

### Level-Gated Actions

```yaml
- key: challenge_master
  label: "Challenge the Master"
  conditions:
    - level_gte: 20
```

### Resource-Cost Actions (from equipment)

```yaml
grants_actions:
  - key: teleport_home
    label: "Teleport Home"
    conditions:
      - resource_gte: { mana: 50 }
```

### Faction-Gated Actions

```yaml
- key: access_vault
  label: "Access the Vault"
  conditions:
    - faction_gte: { thieves_guild: 75 }
```

---

## Debugging

To debug action resolution, check:

1. **Entity prototype** - Does it have explicit `actions` component?
2. **Player equipment** - Any `grants_actions` components?
3. **Active statuses** - Any `removes_actions` or `replaces_all_actions`?
4. **Player flags** - Check `_granted_actions` and `_blocked_actions`
5. **Room components** - Any `action_restrictions`?
6. **Conditions** - Do player stats/flags/items satisfy conditions?

In IEx:
```elixir
# Get resolved actions for an entity
alias Loka.Framework.Actions.Resolver
alias Loka.Framework.Player.GameState

entity = %{type: :npc, components: %{"dialogue_tree" => %{}}, tags: []}
game_state = %GameState{player_id: 1, level: 10, flags: %{}}
room = %{components: %{}}

Resolver.resolve(entity, game_state, room)
# => [%Action{key: "talk", label: "Talk", priority: 100}]
```
