# Entity Reference for LLMs

> **LLM Instructions**: This is the authoritative reference for all entity types. When creating or modifying entities, follow these exact specifications.

## File Locations

| Entity Type | Path Pattern | Example |
|-------------|--------------|---------|
| Room | `priv/world/prototypes/rooms/**/*.yml` | `rooms/monastery/temple.yml` |
| NPC | `priv/world/prototypes/npcs/**/*.yml` | `npcs/monastery/abbot_jampa.yml` |
| Item | `priv/world/prototypes/items/**/*.yml` | `items/herbs/ju_hua.yml` |
| Exit | `priv/world/prototypes/exits/**/*.yml` | `exits/temple_door.yml` |
| Quest | `priv/world/quests/*.yml` | `quests/intro_find_temple.yml` |
| Storyline | `priv/world/storylines/*.yml` | `storylines/monastery_arc.yml` |

---

## Common Fields (All Entities)

```yaml
# REQUIRED
key: "unique_identifier"     # Alphanumeric + underscore + hyphen only
type: room | npc | item | exit

# INHERITANCE
parent: "base_npc"           # Inherit from another prototype
is_template: false           # True = template only, not spawned

# DESCRIPTIONS (LegendMUD-style)
short_desc: "Goblin Scout"   # Used in actions ("Goblin Scout attacks...")
long_desc: "A goblin scout lurks here."  # Room entity listings
extra_desc: |                # Detailed prose when examined
  A wiry green creature with beady eyes.

# TARGETING
keywords:                    # Words player can use to target
  - goblin
  - scout
primary_keyword: "goblin"    # Single keyword for UI display

# COMPONENTS & BEHAVIORS
components: {}               # See component reference below
behaviors: []                # Reusable behavior scripts (see behaviors.md)
emotes: {}                   # Personality text for emit() events (see emotes.md)
attributes: {}               # Custom key-value data
tags: []                     # String tags for filtering
scripts: {}                  # Elixir scripts
locks: {}                    # Access control strings
```

---

## Room Entity

```yaml
key: monastery_gate
type: room
parent: base_room
short_desc: "Monastery Gate"
long_desc: "Ancient stone pillars mark the entrance."
extra_desc: |
  Ancient stone pillars rise against the mountain sky.

# EXITS - direction: target_room_key
exits:
  north: main_courtyard
  south: cliff_path
  west: village
  # Valid directions: north, south, east, west, up, down,
  #                   northeast, northwest, southeast, southwest, in, out

# SPAWNS - entities to create in this room
spawns:
  - prototype: novice_pema       # NPC key
  - prototype: merchant_dorje
    count: 1                     # How many (default: 1)

tags:
  - outdoor
  - starting_room
  - safe_zone
```

### Room Validation Rules
- All exit destinations must exist as room prototypes
- Exits should be bidirectional (room_a → room_b AND room_b → room_a)
- Spawned prototypes must exist

---

## NPC Entity

```yaml
key: merchant_dorje
type: npc
parent: base_npc
short_desc: "Merchant Dorje"
long_desc: "A weathered trader minds his bulging pack."
keywords: [merchant, dorje, trader]
primary_keyword: trader

components:
  # COMBAT
  combatant:
    health:
      current: 70
      max: 70
    stats:
      str: 10
      dex: 12
      sta: 8
    level: 3

  # AI BEHAVIOR
  ai:
    aggression: friendly    # hostile | neutral | friendly | passive
    wander: false

  # DIALOGUE (see dialogue-reference.md for full format)
  dialogue_tree:
    start:
      text: "Welcome, friend!"
      choices:
        - text: "Show me your wares"
          action: ["open_shop"]
          next: null

  # SHOP
  shop:
    sells: [wooden_staff, cloth_robe]
    buys: [ghost_essence]

tags: [friendly, merchant]

# EMOTES - personality text triggered by behaviors
emotes:
  waking_up: "*unfolds merchant's cloth* Time for business!"
  going_to_sleep: "*wraps pack securely* Tomorrow brings opportunities."
  opening_shop: "*spreads wares with a flourish* Come see my treasures!"
  closing_shop: "*carefully packs goods* Until next time!"
  greeting: "*rubs hands together* Welcome, welcome!"

# BEHAVIORS - reusable mechanics
behaviors:
  - script: shopkeeper_hours
    config:
      open_at: morning
      close_at: evening
  - script: day_night_schedule
    config:
      wake_at: dawn
      sleep_at: dusk
```

### NPC Validation Rules
- Quest givers need `dialogue_tree` with `accept_quest` action
- NPCs tagged `hostile` should have `combatant` component
- NPCs tagged `merchant` should have `shop` component
- `primary_keyword` should appear in `long_desc`

---

## Item Entity

```yaml
key: wooden_staff
type: item
parent: base_weapon
short_desc: "Wooden Staff"
long_desc: "A sturdy wooden staff leans here."
keywords: [staff, wooden, stick]
primary_keyword: staff

components:
  # PHYSICAL PROPERTIES
  physical:
    weight: 3
    size: large
    material: wood

  # EQUIPABLE
  equipable:
    slot: weapon           # weapon | armor | accessory | offhand
    two_handed: true

  # WEAPON STATS
  weapon:
    damage: [4, 8]         # [min, max]
    damage_type: blunt
    speed: normal

  # VALUE
  valuable:
    base_value: 25
    currency: gold

tags: [weapon, staff, wooden]
```

### Item Types & Required Components

| Item Type | Required Components |
|-----------|-------------------|
| Weapon | `equipable`, `weapon` |
| Armor | `equipable`, `armor` |
| Consumable | `consumable` |
| Container | `container` |
| Herb/Ingredient | `herb` or `ingredient` |
| Quest Item | usually just `physical` |

---

## Component Quick Reference

| Component | Purpose | Key Fields |
|-----------|---------|------------|
| `combatant` | Combat stats | `health`, `stats`, `level` |
| `ai` | NPC behavior | `aggression`, `wander` |
| `dialogue_tree` | NPC dialogue | See dialogue-reference.md |
| `shop` | Buy/sell items | `sells`, `buys` |
| `physical` | Weight/size | `weight`, `size`, `material` |
| `equipable` | Wearable slot | `slot`, `two_handed`, `grants_actions` |
| `weapon` | Damage stats | `damage`, `damage_type` |
| `armor` | Defense stats | `defense`, `armor_type` |
| `valuable` | Currency value | `base_value`, `currency` |
| `consumable` | Usable effects | `effects`, `charges` |
| `container` | Holds items | `capacity`, `contents` |
| `herb` | Gathering/crafting | `rarity`, `habitat` |
| `respawnable` | Auto-respawn | `timer`, `conditions` |
| `actions` | Custom entity actions | Array of action definitions |
| `action_restrictions` | Room action limits | `remove`, `intersect` |
| `grants_actions` | Equipment abilities | Array of action definitions |

---

## Action System

Actions available on entities are dynamically resolved based on player state, equipment, status effects, and room context. Actions flow through multiple layers with configurable merge rules (inspired by [Evennia's](https://github.com/evennia/evennia) CmdSet system).

### Resolution Layers

1. **Entity Base Actions** - Actions defined on the entity or defaults based on type
2. **Equipment Grants** (Union) - Equipment can add new actions
3. **Script Grants** (Union) - Scripts can temporarily grant actions
4. **Status Blocks** (Remove) - Status effects can disable actions
5. **Script Blocks** (Remove) - Scripts can temporarily block actions
6. **Room Restrictions** (Remove/Intersect) - Rooms can restrict actions
7. **Condition Filtering** - Final filter based on player state

### Custom Entity Actions

Define explicit actions on any entity:

```yaml
key: mysterious_tome
type: item
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

### Equipment Action Grants

Equipment can add new actions when worn:

```yaml
key: staff_of_fireballs
type: item
components:
  equipable:
    slot: weapon
  grants_actions:
    - key: cast_fireball
      label: "Cast Fireball"
      priority: 100
      conditions:
        - resource_gte: { mana: 20 }
```

### Room Action Restrictions

Rooms can restrict what actions are available:

```yaml
key: sacred_temple
type: room
components:
  action_restrictions:
    remove:
      - attack    # No combat in temple
      - steal
```

```yaml
key: meditation_chamber
type: room
components:
  action_restrictions:
    intersect:
      - meditate   # ONLY meditation allowed
      - pray
      - leave
```

### Supported Conditions

| Condition | Example | Description |
|-----------|---------|-------------|
| `flag` | `flag: has_key` | Player has flag |
| `not_flag` | `not_flag: is_tired` | Player lacks flag |
| `level_gte` | `level_gte: 10` | Player level >= value |
| `quest_active` | `quest_active: find_relic` | Quest is active |
| `quest_completed` | `quest_completed: intro` | Quest is completed |
| `has_item` | `has_item: ancient_key` | Has item in inventory |
| `stat_gte` | `stat_gte: { int: 12 }` | Stat >= value |
| `resource_gte` | `resource_gte: { mana: 20 }` | Resource >= value |
| `faction_gte` | `faction_gte: { monks: 50 }` | Faction rep >= value |

---

## Tags Reference

### NPC Tags
- `hostile` - Will attack players
- `friendly` - Won't attack, may help
- `quest_giver` - Has quests to offer
- `merchant` - Has shop
- `trainer` - Can teach skills

### Room Tags
- `safe_zone` - No combat
- `starting_room` - Player spawn point
- `indoor` / `outdoor` - Environment type
- `dungeon` - Dangerous area

### Item Tags
- `weapon`, `armor`, `accessory` - Equipment type
- `consumable` - Can be used
- `quest_item` - Related to quest
- `no_drop` - Cannot be dropped

---

## Validation Commands

```bash
# Validate all entities
mix loka.test.validate

# Validate specific types
mix loka.test.validate --only prototype,quest,dialogue

# Check a specific prototype
# In IEx:
PrototypeLoader.get("npc_key")
```

---

## Common Mistakes & Fixes

### Missing Parent
```yaml
# WRONG - no parent
key: my_npc
type: npc

# RIGHT
key: my_npc
type: npc
parent: base_npc
```

### Wrong Component Nesting
```yaml
# WRONG - health at wrong level
components:
  health:
    current: 100

# RIGHT - health under combatant
components:
  combatant:
    health:
      current: 100
      max: 100
```

### Invalid Exit Reference
```yaml
# WRONG - destination doesn't exist
exits:
  north: nonexistent_room

# FIX: Create the room OR use existing room key
exits:
  north: main_courtyard  # Must exist in rooms/
```
