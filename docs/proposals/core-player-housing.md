# Core Systems: Player Housing & Construction — Proposal

> **Status**: Proposal (not yet implemented)
> **Priority**: Core System (Tier 1 — after Alpha content primitives)
> **Last Updated**: 2026-02-10
> **Depends On**: Tier 0 primitives (item effect dispatch, cooldowns, entity signals, create_room binding)

## Problem Statement

Loka has no concept of player ownership, player-built spaces, or persistent player modifications to the world. All content is builder-authored YAML. For a living world where players invest long-term, we need:

1. Players to own entities (items, rooms, furniture)
2. Players to build and customize personal spaces (houses, shops, workshops)
3. Fine-grained access control (friends can enter, strangers can't)
4. Physical space management (plots, coordinates, neighbors)
5. Construction as gameplay (gathering materials, building over time)

Without these, the game is a theme park. With them, it becomes a world.

## Proposed Solution

Five subsystems that build on each other:

```
Entity Ownership (foundation)
  ↓
Owner Lock Functions (access control)
  ↓
Plot Management (land)
  ↓
Dynamic Zones (organization)
  ↓
Construction System (gameplay)
  ↓
Container Limits (balance)
```

---

## Design Details

### 1. Entity Ownership

**Schema change**: Add `owner_id` to the `entities` table.

```elixir
# In Loka.Engine.EntitySchema
field :owner_id, :binary_id  # player_id or nil (world-owned)
```

**Migration**:
```elixir
alter table(:entities) do
  add :owner_id, :binary_id, null: true
end

create index(:entities, [:owner_id])
```

**Engine API** (in `Loka.Engine.Entities`):
```elixir
def set_owner(entity_id, owner_id)
def get_owner(entity_id) -> owner_id | nil
def owned_by?(entity_id, player_id) -> boolean
def get_owned_by(player_id) -> [EntitySchema.t()]
def get_owned_by(player_id, subtype: :room) -> [EntitySchema.t()]
def transfer_ownership(entity_id, from_player_id, to_player_id) -> {:ok, entity} | {:error, reason}
def clear_owner(entity_id) -> {:ok, entity}
```

**Rules**:
- Only players can own entities (no NPC ownership)
- Ownership is optional — world entities have `owner_id: nil`
- Transfer requires current owner match (prevents theft)
- Spawned entities from prototypes start unowned
- Player-crafted or player-purchased items get `owner_id` set automatically

**Script bindings** (additions to `bindings.ex`):
```elixir
# Query
owner_of: fn entity_id -> Entities.get_owner(entity_id) end,
owned_by?: fn entity_id, player_id -> Entities.owned_by?(entity_id, player_id) end,
my_entities: fn -> Entities.get_owned_by(player.id) end,

# Action (queued)
set_owner: fn entity_id, player_id -> queue_set_owner(entity_id, player_id) end,
```

### 2. Owner Lock Functions

Extend the existing lock system (`Loka.Engine.Locks`) with ownership-aware functions.

**New lock functions** (registered at application startup):
```elixir
# Owner check — entity.owner_id == accessor.id
Locks.register_function("owner", fn entity, accessor, _args ->
  entity.owner_id == accessor.id
end)

# Friend of owner — accessor is in owner's friend list
Locks.register_function("friend_of_owner", fn entity, accessor, _args ->
  case entity.owner_id do
    nil -> false
    owner_id ->
      owner_state = Player.GameState.get_state(owner_id)
      friends = Map.get(owner_state.flags, "friends", [])
      accessor.id in friends
  end
end)

# Permission check — owner has granted specific permission
Locks.register_function("permitted", fn entity, accessor, [access_type] ->
  Permissions.has_permission?(entity.id, accessor.id, access_type)
end)

# Guild member — accessor is in same guild as owner
Locks.register_function("guild_member", fn entity, accessor, [guild_id] ->
  accessor_guilds = Player.GameState.get_flag(accessor.id, "guilds") || []
  guild_id in accessor_guilds
end)
```

**Usage in YAML**:
```yaml
# Player's house door
locks:
  enter: "owner() OR friend_of_owner() OR permitted(enter)"
  edit: "owner()"

# Guild hall
locks:
  enter: "guild_member(artisans_guild) OR perm(admin)"
```

### 3. Plot Management

New module: `Loka.Framework.Housing.Plots`

**Data model**: Plots stored in a new `housing_plots` table.

```elixir
# Loka.Framework.Housing.Plot schema
schema "housing_plots" do
  field :player_id, :binary_id
  field :zone_key, :string         # which housing district
  field :origin_x, :integer
  field :origin_y, :integer
  field :width, :integer, default: 3
  field :height, :integer, default: 3
  field :tier, :string, default: "basic"  # basic, expanded, estate
  field :name, :string              # "Bob's Cottage"
  field :metadata, Loka.Ecto.Json   # extensible
  timestamps()
end
```

**Migration**:
```elixir
create table(:housing_plots, primary_key: false) do
  add :id, :binary_id, primary_key: true
  add :player_id, :binary_id, null: false
  add :zone_key, :string, null: false
  add :origin_x, :integer, null: false
  add :origin_y, :integer, null: false
  add :width, :integer, null: false, default: 3
  add :height, :integer, null: false, default: 3
  add :tier, :string, null: false, default: "basic"
  add :name, :string
  add :metadata, :text, default: "{}"
  timestamps()
end

create unique_index(:housing_plots, [:player_id])
create index(:housing_plots, [:zone_key])
```

**API**:
```elixir
defmodule Loka.Framework.Housing.Plots do
  # Claim a plot in a housing district
  def claim(player_id, zone_key, origin: {x, y}, size: {w, h}) ->
    {:ok, plot} | {:error, :overlap | :already_owns_plot | :zone_full}

  # Get player's plot
  def get_plot(player_id) -> Plot.t() | nil

  # Check if coordinates are inside a plot
  def in_plot?({x, y}, plot) -> boolean

  # Get plot at coordinates
  def plot_at(zone_key, {x, y}) -> Plot.t() | nil

  # Check for overlapping plots
  def overlaps?(zone_key, origin: {x, y}, size: {w, h}) -> boolean

  # Expand plot (upgrade)
  def expand(player_id, new_size: {w, h}) ->
    {:ok, plot} | {:error, :overlap | :max_size}

  # Release plot (demolish all buildings)
  def release(player_id) -> {:ok, plot} | {:error, :not_found}

  # List all plots in a zone
  def list_plots(zone_key) -> [Plot.t()]

  # Get adjacent plots (for town formation)
  def adjacent_plots(plot) -> [Plot.t()]

  # Get available positions in a zone
  def available_positions(zone_key, size: {w, h}) -> [{x, y}]
end
```

**Plot tiers**:

| Tier | Size | Rooms | Furniture | Cost |
|------|------|-------|-----------|------|
| Basic | 3x3 | 5 | 20 | 500 gold |
| Expanded | 5x5 | 12 | 50 | 2000 gold |
| Estate | 7x7 | 25 | 100 | 10000 gold |

**Housing districts**: Predefined zones with coordinate grids.
```yaml
# priv/world/zones/housing_meadows.yml
key: housing_meadows
name: "Meadow Housing District"
type: housing
grid:
  origin: {x: 0, y: 0}
  size: {width: 100, height: 100}
  plot_spacing: 2  # gap between plots
reset_mode: never
```

### 4. Dynamic Zones

Extend `Loka.Framework.World.Zone` to support runtime zone creation.

**Current state**: Zones are YAML-defined, loaded by TypedObject.Loader. Reset timer respawns mobs/items.

**Extension**: Add a `Loka.Framework.Housing.PlayerZone` for player-owned zones.

```elixir
defmodule Loka.Framework.Housing.PlayerZone do
  # Create a player zone (triggered when plot is claimed)
  def create(player_id, plot) ->
    {:ok, zone_key}  # e.g., "player_housing_abc123"

  # Add a room to the player's zone
  def add_room(zone_key, room_id) -> :ok

  # Remove a room
  def remove_room(zone_key, room_id) -> :ok

  # Get all rooms in player zone
  def rooms(zone_key) -> [room_id]

  # Player zones have:
  # - reset_mode: :never (no mob respawns)
  # - No weather override (inherits from parent district)
  # - Owner-controlled settings (name, description, welcome message)
end
```

**Integration**: Player zones register in the existing zone registry but with `reset_mode: :never` and `type: :player_housing`.

### 5. Construction System

New module: `Loka.Framework.Housing.Construction`

Uses the existing `Loka.Timers` system for build queues.

**Blueprints** (YAML-defined):
```yaml
# priv/world/blueprints/stone_room.yml
key: stone_room
name: "Stone Room"
description: "A solid stone room with timber ceiling."
build_time: 300  # seconds (5 minutes for testing, scale up for production)
skill_required: construction
skill_level: 1
materials:
  - {item: stone_block, quantity: 10}
  - {item: wood_beam, quantity: 5}
  - {item: iron_nail, quantity: 20}
tools: [hammer, saw]
result:
  room_prototype: player_stone_room  # base prototype
  tags: [player_built, stone, indoor]
  default_description: "A room of fitted stone blocks with sturdy timber beams overhead."
tier: basic  # which plot tier can build this
```

**API**:
```elixir
defmodule Loka.Framework.Housing.Construction do
  # Start building a room in player's plot
  def start_build(player_id, %{
    blueprint_key: "stone_room",
    position: {x, y},        # within plot bounds
    exit_direction: "north",  # connect to which existing room
    exit_from: room_id        # existing room to connect from
  }) ->
    {:ok, timer_ref} | {:error, reason}

  # Cancel in-progress build (refunds 50% materials)
  def cancel_build(player_id, timer_ref) -> {:ok, refunded_items}

  # Check build status
  def build_status(player_id) -> [%{blueprint: key, remaining: seconds, position: {x, y}}]

  # Place furniture in a room (instant, no timer)
  def place_furniture(player_id, item_id, room_id) ->
    {:ok, room} | {:error, :not_owner | :room_full | :wrong_type}

  # Remove furniture
  def remove_furniture(player_id, item_id, room_id) ->
    {:ok, item} | {:error, reason}

  # Demolish a room (returns some materials, takes time)
  def demolish(player_id, room_id) ->
    {:ok, timer_ref} | {:error, reason}
end
```

**Build flow**:
1. Player has blueprint (learned via skill or purchased)
2. Player has materials in inventory
3. `start_build/2` validates: plot ownership, position in bounds, materials present, skill level
4. Materials consumed, `Loka.Timers.schedule/4` creates a `:construction` timer
5. On timer completion: room spawned via `Spawner.spawn_room/2`, exits linked, ownership set
6. Player gets message: "Your stone room is complete!"

**Furniture**:
- Furniture items have a `placeable` component:
  ```yaml
  components:
    placeable:
      slot_type: floor  # floor, wall, ceiling, corner
      slots_used: 1
      room_types: [stone, wood, any]  # which rooms accept this
  ```
- Rooms track placed furniture in `components.furniture`:
  ```elixir
  %{
    "furniture" => %{
      "max_slots" => 20,
      "placed" => [
        %{"item_id" => "abc123", "slot_type" => "floor"},
        %{"item_id" => "def456", "slot_type" => "wall"}
      ]
    }
  }
  ```

### 6. Container Limits

Add capacity enforcement to the container system.

**Container component** (in YAML prototypes):
```yaml
components:
  container:
    max_slots: 20
    max_weight: 100
    allowed_tags: [item, decoration]  # what can go in
    locked: false
```

**Enforcement** (in `Loka.Framework.Inventory`):
```elixir
def add_to_container(container_id, item_id) do
  container = Entities.get_entity(container_id)
  config = get_in(container.components, ["container"])

  cond do
    length(container.contents) >= config["max_slots"] ->
      {:error, :container_full}

    total_weight(container) + item_weight(item_id) > config["max_weight"] ->
      {:error, :too_heavy}

    item_tag_not_allowed?(item_id, config["allowed_tags"]) ->
      {:error, :not_allowed}

    true ->
      # Move item into container
      Entities.update_location(item_id, container_id)
  end
end
```

**Room capacity**: Player rooms also have a max furniture count (from blueprint).

---

## Integration Points

| System | Integration |
|--------|------------|
| **Locks** | New lock functions: `owner()`, `friend_of_owner()`, `permitted()`, `guild_member()` |
| **Scripts** | New bindings: `set_owner`, `owned_by?`, `my_entities`, `create_room` (Tier 0) |
| **Timers** | Construction uses `:construction` timer type |
| **Spawner** | Room creation via `Spawner.spawn_room/2` with ownership metadata |
| **WorldGraph** | Dynamic room registration for navigation |
| **Inventory** | Container limits enforcement |
| **Economy** | Plot purchase costs, material requirements |
| **Skills** | Construction skill gates blueprint access |
| **Crafting** | Furniture crafting via existing recipe system |
| **PubSub** | New `housing:{plot_id}` topic for notifications |

## Player Commands

```
# Housing
claim plot                  → Claim available plot in current housing district
my house                    → Show house status (rooms, furniture, capacity)
build <blueprint>           → Start construction (if in your plot)
build status                → Check construction progress
demolish <room>             → Demolish a room in your plot
place <item>                → Place furniture in current room
remove <item>               → Remove furniture to inventory
set house name <name>       → Name your house
set house welcome <message> → Set welcome message

# Permissions
lock door                   → Lock room entrance
unlock door                 → Unlock room entrance
permit <player> enter       → Grant enter permission
revoke <player> enter       → Revoke enter permission
permissions                 → List current permissions

# Visiting
visit <player>              → Teleport to player's house entrance
```

## YAML Examples

### Housing district zone
```yaml
key: housing_meadows
name: "Meadow Housing District"
type: housing
description: "Rolling green meadows dotted with player homes."
grid:
  origin_x: 0
  origin_y: 0
  width: 100
  height: 100
  plot_spacing: 2
data:
  max_plots: 200
  entry_room: meadows_entrance
  plot_cost:
    basic: 500
    expanded: 2000
    estate: 10000
```

### Room blueprint
```yaml
key: stone_room
name: "Stone Room"
type: blueprint
build_time: 300
skill_required: construction
skill_level: 1
materials:
  - item: stone_block
    quantity: 10
  - item: wood_beam
    quantity: 5
tools: [hammer]
result:
  base_prototype: player_stone_room
  tags: [player_built, stone, indoor]
  max_furniture: 20
  description: "A room of fitted stone blocks with sturdy timber beams overhead."
```

### Furniture item
```yaml
key: oak_table
name: "Oak Table"
type: entity
subtype: item
description: "A sturdy oak table, well-crafted."
keywords: [table, oak, furniture]
tags: [furniture, placeable]
components:
  placeable:
    slot_type: floor
    slots_used: 2
    room_types: [any]
  valuable:
    base_price: 50
```

## Implementation Phases

### Phase 1: Ownership Foundation (2-3 days)
- [ ] Entity ownership schema migration
- [ ] Entities API (set_owner, get_owned_by, transfer_ownership)
- [ ] Owner lock functions (owner, friend_of_owner)
- [ ] Script bindings (owned_by?, set_owner)
- [ ] Tests

### Phase 2: Plot Management (3-4 days)
- [ ] Housing plots schema + migration
- [ ] Plots module (claim, release, overlap detection)
- [ ] Housing district zone type
- [ ] `claim plot` command
- [ ] Plot visualization (map integration)
- [ ] Tests

### Phase 3: Construction (3-4 days)
- [ ] Blueprint YAML format + loader
- [ ] Construction module (start_build, cancel, demolish)
- [ ] Timer integration (`:construction` type)
- [ ] Room spawning with ownership
- [ ] Bidirectional exit creation
- [ ] `build` / `demolish` commands
- [ ] Tests

### Phase 4: Furniture & Permissions (2-3 days)
- [ ] Container limits component
- [ ] Furniture placement system
- [ ] Permission delegation module
- [ ] `place` / `remove` / `permit` / `revoke` commands
- [ ] Tests

### Phase 5: Polish (2 days)
- [ ] `visit <player>` command
- [ ] House welcome messages
- [ ] Housing district NPC (plot broker)
- [ ] Builder integration (admin can inspect player housing)
- [ ] Content validation for housing content

## Open Questions

1. **Plot limits per player**: One plot? Multiple? Alts?
2. **Inactive player plots**: What happens when a player is inactive for 30+ days? Auto-demolish? Storage mode?
3. **Plot adjacency for towns**: Should adjacent plots automatically form a "neighborhood" with shared infrastructure?
4. **Instanced vs shared housing**: Should housing be on the main world map or in a separate instanced dimension?
5. **Destruction by others**: Can other players damage/siege player buildings? (PvP server consideration)
6. **Rent vs purchase**: One-time purchase or ongoing rent? (Gold sink consideration)
7. **Transferable plots**: Can players sell their plots to other players?

## Alternatives Considered

1. **Instanced pocket dimensions** — Each player gets a private dimension. Simpler but isolating. Rejected: we want houses on the world map for social discovery.
2. **Pre-built houses** — Fixed house templates, no construction. Simpler but less engaging. Rejected: construction-as-gameplay is core to the vision.
3. **Store ownership in flags** — Use player flags for `house_room_ids`, etc. Rejected: flags aren't queryable, ownership is too fundamental to hack.
