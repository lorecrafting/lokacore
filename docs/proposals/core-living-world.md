# Core Systems: Living World — Proposal

> **Status**: Proposal (not yet implemented)
> **Priority**: Core System (Tier 3 — after Economy & Trading)
> **Last Updated**: 2026-02-10
> **Depends On**: Entity Ownership (Tier 1), Economy (Tier 2), Zone State requires Zone system from Housing (Tier 1)

## Problem Statement

Loka's world is currently reactive — things happen when players act, but the world doesn't evolve on its own. NPCs respawn on timers regardless of what happens. Prices are fixed. Nothing the player does has lasting impact on the world.

For a living world, we need:
1. Shared zone-level state that players collectively influence
2. NPC populations that respond to player behavior (overhunting, defending, etc.)
3. Reputation systems that make NPCs remember and react to player history
4. Notable events that become part of the world's shared narrative
5. Private instances for personal story moments and group challenges
6. An audit trail so the world's history is traceable

## Proposed Solution

Six independent subsystems that can be built in any order:

```
Zone-Level State ←→ NPC Population Dynamics
       ↕                     ↕
Reputation/Factions ←→ Events/Achievements
       ↕                     ↕
Instanced Zones        Audit Trail
```

---

## Design Details

### 1. Zone-Level State

Shared mutable state scoped to a zone. Enables collective objectives, zone progression, and world events.

**Storage**: ETS for hot path, DB snapshots for persistence.

**New module**: `Loka.Framework.World.ZoneState`

```elixir
defmodule Loka.Framework.World.ZoneState do
  @moduledoc """
  Shared mutable state per zone. Unlike entity attributes (per-entity)
  or player flags (per-player), zone state is shared across all players
  in a zone.

  Use cases: siege progress, zone threat level, collective kill counters,
  town prosperity, seasonal events.
  """

  # Set a zone variable
  def set(zone_key, var_key, value) -> :ok

  # Get a zone variable
  def get(zone_key, var_key, default \\ nil) -> term()

  # Atomic increment (for counters)
  def increment(zone_key, var_key, amount \\ 1) -> new_value

  # Atomic decrement (with floor of 0)
  def decrement(zone_key, var_key, amount \\ 1) -> new_value

  # Get all state for a zone
  def get_all(zone_key) -> map()

  # Subscribe to zone state changes
  def subscribe(zone_key) -> :ok
  # Emits on PubSub "zone_state:{zone_key}" topic

  # Persistence (called periodically and on shutdown)
  def snapshot(zone_key) -> :ok
  def restore(zone_key) -> :ok
end
```

**Schema** (for persistence):
```elixir
schema "zone_states" do
  field :zone_key, :string
  field :state, Loka.Ecto.Json  # full state snapshot
  field :snapshot_at, :utc_datetime
  timestamps()
end
```

**Script bindings**:
```elixir
# Query
zone_state: fn key -> ZoneState.get(current_zone_key, key) end,
zone_state_all: fn -> ZoneState.get_all(current_zone_key) end,

# Action (queued)
set_zone_state: fn key, value -> queue_set_zone_state(current_zone_key, key, value) end,
increment_zone: fn key -> queue_increment_zone(current_zone_key, key, 1) end,
increment_zone: fn key, amount -> queue_increment_zone(current_zone_key, key, amount) end,
```

**YAML example — zone-wide siege event**:
```yaml
# Script: on_npc_death hook for bandit NPCs in bandit_camp zone
key: bandit_death_counter
hook: at_death
zone: bandit_camp
source: |
  # Count bandit kills zone-wide
  increment_zone("bandits_killed")
  kills = zone_state("bandits_killed")

  if kills >= 100 do
    announce_room("The bandit camp falls silent... the siege is won!")
    set_zone_state("siege_complete", true)
    # Trigger zone transformation
    emit(:siege_victory)
  end
```

**Zone thresholds** (declarative in zone YAML):
```yaml
key: bandit_camp
thresholds:
  - var: bandits_killed
    value: 50
    event: siege_halfway
    message: "The bandits are weakening! Keep fighting!"
  - var: bandits_killed
    value: 100
    event: siege_victory
    actions:
      - set_zone_state: {siege_complete: true}
      - spawn_npc: {key: liberated_merchant, room: camp_center}
      - lock_spawns: {prototype: bandit_warrior}
```

### 2. NPC Population Dynamics

Zone resets become ecology-aware. NPC populations respond to player behavior.

**New module**: `Loka.Framework.World.PopulationDynamics`

```elixir
defmodule Loka.Framework.World.PopulationDynamics do
  @moduledoc """
  Makes NPC populations dynamic. Tracks kill rates, adjusts spawn
  counts on zone resets, and enables migration between zones.

  A zone with high kill rates sees declining populations.
  A zone left alone sees populations grow.
  Overpopulated zones may send NPCs to adjacent zones.
  """

  # Record a kill event
  def record_kill(zone_key, prototype_key) -> :ok

  # Record a spawn event (on zone reset)
  def record_spawn(zone_key, prototype_key) -> :ok

  # Get population health for a zone
  def population_health(zone_key) -> %{
    prototype_key => %{
      current: integer,       # current count in zone
      baseline: integer,      # from zone YAML
      kill_rate_24h: float,   # kills per hour over 24h
      spawn_rate_24h: float,  # spawns per hour
      health: :thriving | :stable | :declining | :endangered | :extinct
    }
  }

  # Calculate adjusted spawn count for next zone reset
  def adjusted_spawn_count(zone_key, prototype_key, base_count) -> integer

  # Get migration candidates (overpopulated → underpopulated)
  def migration_candidates(zone_key) -> [%{prototype: key, target_zone: key, count: integer}]
end
```

**Population health tiers**:

| Health | Kill Rate vs Spawn Rate | Spawn Adjustment |
|--------|------------------------|-----------------|
| Thriving | kills < 20% of spawns | +50% spawns (cap at 2x baseline) |
| Stable | kills 20-80% of spawns | Normal spawns |
| Declining | kills 80-120% of spawns | -25% spawns |
| Endangered | kills > 120% of spawns | -50% spawns, migration from adjacent |
| Extinct | kills >> spawns for 48h+ | 0 spawns until recovery event |

**Zone reset integration**:
```elixir
# In zone reset logic, replace:
#   spawn(prototype, room, max: base_count)
# with:
#   adjusted = PopulationDynamics.adjusted_spawn_count(zone, prototype, base_count)
#   spawn(prototype, room, max: adjusted)
```

**Migration**: When a zone is `thriving` and an adjacent zone is `endangered` for the same prototype, some NPCs "migrate" — they spawn in the endangered zone on next reset.

**Player feedback**:
```
> look
Forest Clearing
The woods here feel eerily quiet. Animal tracks are scarce,
and the few remaining deer watch you with fearful eyes.
[Population: Declining — hunting has taken its toll]
```

**Recovery events**: Extinct populations can recover via:
- Time (48h with no kills → slow recovery)
- Player action (plant seeds, release captive animals)
- Quest (ecosystem restoration quest)

### 3. Reputation & Factions

Structured relationship tracking between players and factions.

**New module**: `Loka.Framework.Social.Reputation`

```elixir
defmodule Loka.Framework.Social.Reputation do
  @moduledoc """
  Tracks player standing with factions. Replaces ad-hoc flag-based
  tracking with a structured system that NPCs can query.
  """

  # Adjust reputation (positive or negative)
  def adjust(player_id, faction_key, amount) -> {:ok, new_value}

  # Get current rep value (-1000 to 1000)
  def get(player_id, faction_key) -> integer

  # Get standing tier
  def standing(player_id, faction_key) -> standing_atom

  # Get all reputations for a player
  def all(player_id) -> %{faction_key => %{value: integer, standing: atom}}

  # Check if player meets a standing threshold
  def meets?(player_id, faction_key, min_standing) -> boolean
end
```

**Standing tiers**:

| Standing | Range | NPC Behavior |
|----------|-------|-------------|
| Exalted | 800+ | Best prices, unique quests, titles |
| Honored | 500-799 | Good prices, additional dialogue |
| Friendly | 200-499 | Normal+ interactions |
| Neutral | -199 to 199 | Default behavior |
| Unfriendly | -200 to -499 | Higher prices, refused quests |
| Hostile | -500 to -799 | Attacked on sight, shops closed |
| Hated | -800 to -1000 | Kill on sight, bounty placed |

**Storage**: Player game state (JSON field) — keeps it with existing player data.
```elixir
# In GameState
reputation: %{
  "merchants_guild" => 350,
  "forest_druids" => -100,
  "monastery" => 750
}
```

**Faction definitions** (YAML):
```yaml
key: merchants_guild
name: "Merchants' Guild"
type: faction
description: "The trade consortium that controls commerce in the valley."
data:
  standings:
    exalted:
      title: "Master Merchant"
      shop_discount: 0.15
    honored:
      title: "Trusted Trader"
      shop_discount: 0.10
    hostile:
      attack_on_sight: true
      bounty: 100
  reputation_sources:
    - action: complete_trade
      amount: 5
    - action: complete_quest
      quest_tag: merchants_guild
      amount: 25
    - action: kill_npc
      npc_tag: merchants_guild
      amount: -50
```

**NPC dialogue integration** (existing `show_if` system):
```yaml
# In NPC dialogue
nodes:
  - id: special_offer
    text: "Ah, a trusted friend! I have something special for you..."
    show_if:
      reputation:
        faction: merchants_guild
        min_standing: honored
```

**Lock function**:
```elixir
Locks.register_function("reputation", fn _entity, accessor, [faction, min_standing] ->
  Reputation.meets?(accessor.id, faction, String.to_atom(min_standing))
end)

# Usage in YAML:
locks:
  enter: "reputation(merchants_guild, friendly)"
```

**Script bindings**:
```elixir
reputation: fn faction -> Reputation.get(player.id, faction) end,
reputation_standing: fn faction -> Reputation.standing(player.id, faction) end,
adjust_reputation: fn faction, amount -> queue_adjust_reputation(player, faction, amount) end,
```

### 4. Events & Achievements

Track and broadcast notable world events. Create shared narrative.

**New module**: `Loka.Framework.World.Events`

```elixir
defmodule Loka.Framework.World.Events do
  @moduledoc """
  Records notable events in the world. Events are broadcast to
  relevant audiences and stored for world history.

  Events drive NPC gossip, town bulletin boards, and achievements.
  """

  # Record a world event
  def record(event_type, data) -> {:ok, event}
    # event_type: :first_kill, :quest_complete, :house_built, :item_crafted,
    #             :zone_liberated, :boss_defeated, :population_extinct, etc.

  # Get recent events
  def recent(opts \\ []) -> [event]
    # opts: [zone: "monastery", type: :quest_complete, limit: 20, since: datetime]

  # Get events for a specific player
  def player_events(player_id) -> [event]

  # Achievement system
  def check_achievements(player_id, event) -> [unlocked_achievement]
  def get_achievements(player_id) -> [%{key: key, unlocked_at: datetime}]
  def all_achievements() -> [achievement_definition]
end
```

**Event schema**:
```elixir
schema "world_events" do
  field :event_type, :string
  field :player_id, :binary_id  # who triggered it (nil for world events)
  field :zone_key, :string
  field :data, Loka.Ecto.Json    # event-specific payload
  field :visibility, :string, default: "public"  # public, zone, private
  timestamps()
end
```

**Achievement definitions** (YAML):
```yaml
# priv/world/achievements/first_blood.yml
key: first_blood
name: "First Blood"
description: "Defeat your first enemy."
type: achievement
data:
  trigger:
    event_type: kill
    count: 1
  reward:
    xp: 50
    title: "Blooded"

# priv/world/achievements/master_builder.yml
key: master_builder
name: "Master Builder"
description: "Build 10 rooms in your housing plot."
type: achievement
data:
  trigger:
    event_type: room_built
    count: 10
  reward:
    xp: 500
    blueprint: ornate_stone_room
    title: "Master Builder"
```

**NPC gossip integration**:
```elixir
# Tavern NPCs periodically check recent events and generate gossip
# Behavior script: gossip_generator
events = recent_events(zone: current_zone, limit: 5)

if any?(events, fn e -> e.type == :boss_defeated end) do
  event = find(events, fn e -> e.type == :boss_defeated end)
  say("Did you hear? #{event.data.player_name} defeated #{event.data.boss_name}!")
end
```

**Bulletin board** (room item):
```yaml
key: town_bulletin_board
name: "Town Bulletin Board"
scripts:
  on_look: display_recent_events  # shows last 10 events in this zone
tags: [interactive, bulletin]
```

**PubSub**: Events broadcast on `world:events` topic (existing) and `zone:events:{zone_key}` (new).

### 5. Instanced Zones

Private copies of zones for solo/party content.

**New module**: `Loka.Framework.World.Instances`

```elixir
defmodule Loka.Framework.World.Instances do
  @moduledoc """
  Creates temporary private copies of zones. Used for:
  - Solo dungeons (personal challenge, no competition)
  - Party dungeons (group content)
  - Dream sequences (story moments)
  - Boss encounters (instanced to prevent griefing)

  Instances are ephemeral — destroyed after completion or timeout.
  """

  # Create an instance from a zone template
  def create(zone_template_key, opts) -> {:ok, instance_id}
    # opts: [owner_id: player_id, party: [player_ids], ttl: 3600, difficulty: :normal]

  # Enter an instance (teleport player to instance entry room)
  def enter(player_id, instance_id) -> {:ok, entry_room_id} | {:error, reason}

  # Leave an instance (teleport back to where they entered from)
  def leave(player_id) -> :ok

  # Get instance status
  def status(instance_id) -> %{
    zone: key,
    owner: player_id,
    players: [player_id],
    state: :active | :completed | :expired,
    created_at: datetime,
    expires_at: datetime,
    progress: map()  # instance-specific state
  }

  # Mark instance as completed (triggers rewards, cleanup timer)
  def complete(instance_id) -> :ok

  # Destroy instance immediately
  def destroy(instance_id) -> :ok

  # List active instances for a player
  def active_instances(player_id) -> [instance]
end
```

**How instances work**:
1. Zone template defines rooms, NPCs, items, scripts (normal YAML)
2. `create/2` spawns a complete copy: new room entities, new NPC entities, all with unique IDs
3. Instance rooms are linked only to each other (no exits to the main world)
4. Players enter via a portal/command, storing their "return point"
5. Instance has its own zone state (separate from the template zone)
6. On completion or expiry, all instance entities are destroyed
7. Players are teleported back to their return points

**Instance templates** (zone YAML with `instanced: true`):
```yaml
key: crystal_caverns_instance
name: "Crystal Caverns"
type: zone
instanced: true
data:
  difficulty_scaling: true
  max_players: 4
  ttl: 3600
  entry_room: crystal_caverns_entry
  completion_conditions:
    - type: all_killed
      prototype: crystal_guardian
    - type: flag_set
      flag: crystal_collected
  rewards:
    xp: 500
    items:
      - key: crystal_shard
        chance: 1.0
      - key: crystal_armor_recipe
        chance: 0.1
```

**Difficulty scaling**:
```elixir
# NPC stats scaled based on party size and average level
def scale_npc(npc, party_size, avg_level) do
  hp_mult = 1.0 + (party_size - 1) * 0.5
  dmg_mult = 1.0 + (party_size - 1) * 0.3
  level_mult = avg_level / npc.components["combatant"]["level"]

  # Apply multipliers to NPC stats
  update_combatant(npc, hp_mult * level_mult, dmg_mult * level_mult)
end
```

### 6. Audit Trail

Comprehensive logging of ownership transfers, trades, and item provenance.

**New module**: `Loka.Framework.Audit`

```elixir
defmodule Loka.Framework.Audit do
  @moduledoc """
  Immutable audit log for economic and ownership events.
  Used for: admin investigation, player history, item provenance,
  economy monitoring, anti-cheat.
  """

  # Log an event
  def log(event_type, data) -> {:ok, entry}

  # Query audit log
  def query(filters) -> [entry]
    # filters: [entity_id: id, player_id: id, type: :trade, since: datetime, limit: 100]

  # Get full provenance chain for an entity
  def provenance(entity_id) -> [entry]
    # Returns: created → traded → modified → traded → current

  # Get player's economic history
  def player_history(player_id, opts \\ []) -> [entry]

  # Economy metrics (for admin dashboard)
  def metrics(period: :daily) -> %{
    trades: integer,
    total_gold_traded: integer,
    items_created: integer,
    items_destroyed: integer,
    active_listings: integer,
    avg_item_price: float
  }
end
```

**Schema**:
```elixir
schema "audit_log" do
  field :event_type, :string
    # item_created, item_destroyed, ownership_transfer, trade_executed,
    # marketplace_listed, marketplace_sold, currency_transfer,
    # quest_reward, npc_loot, item_consumed
  field :actor_id, :binary_id      # who did it
  field :entity_id, :binary_id     # what entity was affected
  field :data, Loka.Ecto.Json      # event-specific payload
  field :created_at, :utc_datetime # immutable timestamp
end

create index(:audit_log, [:entity_id])
create index(:audit_log, [:actor_id])
create index(:audit_log, [:event_type])
create index(:audit_log, [:created_at])
```

**Auto-logging points** (integrated into other systems):
```elixir
# In Trading.execute/1
Audit.log(:trade_executed, %{
  trade_id: trade.id,
  player_a: trade.player_a.id,
  player_b: trade.player_b.id,
  items_a_to_b: trade.player_a.items,
  items_b_to_a: trade.player_b.items,
  currency_a_to_b: trade.player_a.currency,
  currency_b_to_a: trade.player_b.currency
})

# In Crafting on successful craft
Audit.log(:item_created, %{
  item_id: item.id,
  item_key: item.key,
  quality: quality,
  modifiers: modifiers,
  crafter_id: player_id,
  recipe_key: recipe.key,
  materials_consumed: materials
})

# In Marketplace.buy/2
Audit.log(:marketplace_sold, %{
  listing_id: listing.id,
  item_id: listing.item_id,
  seller_id: listing.seller_id,
  buyer_id: buyer_id,
  price: listing.price,
  currency: listing.currency,
  fee: listing_fee
})
```

**Item provenance display**:
```
> examine (Masterwork) Iron Sword [+5 damage, +2 speed]
A beautifully crafted iron sword that gleams in the light.

Crafted by Bob the Smith on Feb 15, 2026 (#47)
Quality: Masterwork
Previously owned by: Alice the Warrior (traded Feb 20)
```

**Admin commands**:
```
audit item <item_id>          → Full provenance chain
audit player <name>           → Recent economic activity
audit metrics                 → Economy dashboard
audit suspicious              → Flag unusual patterns (gold duplication, etc.)
```

---

## Integration Points

| System | Integration |
|--------|------------|
| **Zone Resets** | PopulationDynamics adjusts spawn counts |
| **Combat** | Kill events feed PopulationDynamics + Reputation + ZoneState |
| **Quests** | Quest completion feeds Reputation + Events + ZoneState |
| **Dialogue** | `show_if` checks reputation standing |
| **Locks** | `reputation()` lock function |
| **Scripts** | Bindings for zone_state, reputation, events |
| **Trading** | All transactions logged to Audit |
| **Crafting** | Item creation logged to Audit |
| **Marketplace** | Sales logged to Audit |
| **NPC Behaviors** | Gossip behavior reads Events |
| **Housing** | Construction events feed Events + Achievements |
| **PubSub** | New topics: `zone_state:{key}`, `zone:events:{key}`, `reputation:{player_id}` |

## Implementation Phases

### Phase 1: Zone-Level State (2-3 days)
- [ ] ZoneState module (ETS + DB persistence)
- [ ] Script bindings (zone_state, set_zone_state, increment_zone)
- [ ] ActionQueue handler for zone state actions
- [ ] Threshold system (declarative triggers in zone YAML)
- [ ] PubSub integration
- [ ] Tests

### Phase 2: Reputation & Factions (3-4 days)
- [ ] Reputation module
- [ ] Faction YAML format + loader
- [ ] Standing tiers + NPC behavior rules
- [ ] Dialogue `show_if` integration
- [ ] Lock function `reputation()`
- [ ] Script bindings
- [ ] `reputation` command for players
- [ ] Tests

### Phase 3: Events & Achievements (3-4 days)
- [ ] World events schema + module
- [ ] Achievement definitions (YAML)
- [ ] Achievement checking on event
- [ ] NPC gossip behavior
- [ ] Bulletin board item
- [ ] PubSub broadcast
- [ ] Tests

### Phase 4: NPC Population Dynamics (3-4 days)
- [ ] PopulationDynamics module
- [ ] Kill/spawn tracking
- [ ] Zone reset integration
- [ ] Migration system
- [ ] Room description integration (population health)
- [ ] Recovery mechanics
- [ ] Tests

### Phase 5: Instanced Zones (4-5 days)
- [ ] Instances module
- [ ] Zone cloning (spawn all entities with unique IDs)
- [ ] Entry/exit portal system
- [ ] Instance state isolation
- [ ] Difficulty scaling
- [ ] Completion detection + rewards
- [ ] TTL expiry + cleanup
- [ ] Tests

### Phase 6: Audit Trail (2-3 days)
- [ ] Audit schema + module
- [ ] Auto-logging integration points
- [ ] Provenance chain query
- [ ] Admin commands
- [ ] Economy metrics
- [ ] Tests

## Open Questions

1. **Zone state persistence frequency**: Snapshot every 60s? Every state change? On shutdown only?
2. **Population recovery speed**: How fast should populations bounce back? Too fast = meaningless, too slow = frustrating.
3. **Faction wars**: Can player actions tip faction wars? (High complexity, maybe defer)
4. **Instance loot**: Personal loot or shared? Roll for contested items?
5. **Audit retention**: How long to keep audit logs? 30 days? Forever? Archival strategy?
6. **Achievement rewards**: Titles only? Or gameplay rewards (unlockable blueprints, skills)?
7. **Cross-zone reputation**: Does killing bandits in Zone A affect bandit faction rep in Zone B?
8. **Population extinction consequences**: What happens to quests that require extinct NPCs? Failsafe spawns?

## Alternatives Considered

1. **Static world (no dynamics)**: Simplest but boring. The whole point is a living world. Rejected.
2. **Fully procedural world**: Generate everything. Too unpredictable, hard to tell stories. Rejected in favor of authored content with dynamic layers.
3. **Player voting for world changes**: Democratic world evolution. Interesting but complex. Could layer on later as a governance system for player towns.
4. **AI-driven NPC behavior**: Let NPCs make autonomous decisions. Fascinating but unpredictable and expensive. Defer to post-launch experimentation.
