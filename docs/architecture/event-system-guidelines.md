# Event System Usage Guidelines

> **For Developers**: When to use Events vs direct function calls

---

## What Are Events?

Events are immutable data structures that represent "something happened" in the game world:

```elixir
%Loka.Engine.Event{
  id: "uuid",
  type: :damage,
  source: player_id,
  target: enemy_id,
  payload: %{amount: 50, damage_type: "fire"},
  timestamp: ~U[2026-01-24 12:34:56Z],
  correlation_id: "action_uuid",  # Links related events
  caused_by: parent_event_id      # Event chain
}
```

Events are broadcast via Phoenix.PubSub to subscribers (hooks, quest listeners, logging, etc.).

---

## When To Use Events

✅ **Use Events when:**

### 1. Side Effects Needed (Hooks, Plugins, Quests)

When OTHER systems need to know something happened:

```elixir
# ✅ GOOD: Use event for quest tracking
def player_kills_enemy(player_id, enemy_id) do
  # ... combat logic ...

  # Broadcast event so quest system can track
  event = Event.new(:death,
    source: player_id,
    target: enemy_id,
    payload: %{killer_name: player.name, enemy_type: enemy.type}
  )
  EventBus.publish(event)

  # Hooks:
  # - Quest system increments "kill_goblins" objective
  # - Achievement system checks for "First Blood"
  # - Combat log records the kill
  # - Faction system adjusts reputation
end
```

**Why events:** Multiple systems need to react independently. Adding new quest types doesn't require modifying combat code.

### 2. Auditing & Debugging (Game Log, Replays)

When you need a historical record:

```elixir
# ✅ GOOD: Event for admin debugging
def craft_item(player_id, recipe_id) do
  event = Event.new(:craft_complete,
    source: player_id,
    payload: %{
      recipe_id: recipe_id,
      materials_used: [...],
      result_item: item_id
    }
  )
  EventBus.publish(event)
  GameLog.log(:economy, :craft_complete, event.payload, player_id: player_id)
end
```

**Why events:** Admin can query `GameLog` to see "When did player X craft this item? What materials did they use?"

### 3. Asynchronous Reactions

When effects should happen without blocking:

```elixir
# ✅ GOOD: Event for non-blocking NPC reactions
def player_enters_room(player_id, room_id) do
  event = Event.new(:entity_entered,
    source: player_id,
    location: room_id
  )
  EventBus.publish(event)

  # NPCs in room react asynchronously:
  # - Shopkeeper: "Welcome!" (if shop is open)
  # - Guard: Check if player is wanted
  # - Quest NPC: Trigger dialogue if quest active
  # All without blocking the player's enter action
end
```

### 4. Correlation Tracking

When you need to trace related actions:

```elixir
# ✅ GOOD: Event chain for debugging
attack_event = Event.new(:attack, source: player_id, target: enemy_id)
damage_event = Event.caused_by(attack_event, :damage, payload: %{amount: 50})
death_event = Event.caused_by(damage_event, :death, payload: %{})

# All three share same correlation_id
# Admin can query: "Show me everything from this attack"
```

### 5. Cancellable Actions (Before Hooks)

When you want to allow hooks to prevent an action:

```elixir
# ✅ GOOD: Cancellable event for lock checking
def player_move(player_id, from_room, to_room, direction) do
  event = Event.new(:before_move,
    source: player_id,
    cancellable?: true,
    payload: %{from: from_room, to: to_room, direction: direction}
  )

  # Run hooks (lock checks, quest requirements, etc.)
  case Hooks.run(:before_move, event, %{player: player}) do
    {:ok, _event} -> perform_move(player_id, to_room)
    {:cancel, reason} -> {:error, reason}
  end
end
```

---

## When NOT To Use Events

❌ **Don't use Events when:**

### 1. Pure Queries (Read-Only)

Reading state doesn't need events:

```elixir
# ❌ BAD: Event for query
def get_player_hp(player_id) do
  event = Event.new(:query_hp, source: player_id)  # NO!
  # ...
end

# ✅ GOOD: Direct function call
def get_player_hp(player_id) do
  player = Players.get(player_id)
  get_in(player.components, ["combat", "hp"]) || 0
end
```

**Why no event:** Nothing happened. No one needs to react. Just return the value.

### 2. Internal Calculations

Pure functions don't need events:

```elixir
# ❌ BAD: Event for math
def calculate_damage(attacker, defender) do
  event = Event.new(:damage_calculation, ...)  # NO!
  # ...
end

# ✅ GOOD: Pure function
def calculate_damage(attacker, defender) do
  base = attacker.strength * 2
  armor_reduction = defender.armor / 3
  max(1, base - armor_reduction)
end
```

**Why no event:** This is internal logic. No hooks, quests, or logs care about intermediate calculations.

### 3. Synchronous State Changes (No Listeners)

If no one's listening, don't broadcast:

```elixir
# ❌ BAD: Event when no one listens
def update_player_setting(player_id, setting, value) do
  event = Event.new(:setting_changed, ...)  # NO!
  Players.update_setting(player_id, setting, value)
  EventBus.publish(event)  # No subscribers exist
end

# ✅ GOOD: Direct update
def update_player_setting(player_id, setting, value) do
  Players.update_setting(player_id, setting, value)
end
```

**Why no event:** If there are no hooks, quests, or systems that care, skip the event overhead.

### 4. High-Frequency Updates

Events have overhead - don't spam them:

```elixir
# ❌ BAD: Event every tick
def tick_regen(player_id) do
  # Called every second
  event = Event.new(:regen_tick, ...)  # NO! Too frequent
  # ...
end

# ✅ GOOD: Only event on significant change
def tick_regen(player_id) do
  old_hp = get_hp(player_id)
  new_hp = min(old_hp + regen_rate, max_hp)

  # Only event when fully healed (for quest: "reach full HP")
  if old_hp < max_hp and new_hp == max_hp do
    event = Event.new(:fully_healed, source: player_id)
    EventBus.publish(event)
  end

  set_hp(player_id, new_hp)
end
```

### 5. Error Conditions

Errors are synchronous returns, not events:

```elixir
# ❌ BAD: Event for error
def validate_move(player, direction) do
  if blocked?(direction) do
    event = Event.new(:move_blocked, ...)  # NO!
    EventBus.publish(event)
    {:error, "Path blocked"}
  end
end

# ✅ GOOD: Return error
def validate_move(player, direction) do
  if blocked?(direction) do
    {:error, "Path blocked"}
  else
    :ok
  end
end
```

**Why no event:** The caller needs immediate feedback. Don't broadcast failures.

---

## Combat Example: Why Events Are Needed

Combat uses events because multiple systems need to react:

```elixir
def player_attacks(player_id, target_id) do
  # 1. Create attack event
  attack_event = Event.new(:attack,
    source: player_id,
    target: target_id,
    payload: %{weapon: player.equipped_weapon}
  )

  # 2. Calculate damage (pure function - no event)
  damage = calculate_damage(player, target)

  # 3. Create damage event (caused by attack)
  damage_event = Event.caused_by(attack_event, :damage,
    source: player_id,
    target: target_id,
    payload: %{amount: damage, type: "physical"}
  )
  EventBus.publish(damage_event)

  # 4. Apply damage
  new_hp = apply_damage(target_id, damage)

  # 5. Check for death
  if new_hp <= 0 do
    death_event = Event.caused_by(damage_event, :death,
      source: player_id,
      target: target_id
    )
    EventBus.publish(death_event)

    # Quest system reacts to :death event
    # Achievement system checks for milestones
    # Faction system adjusts reputation
    # Loot system spawns items
  end
end
```

**Why events:**
- **Quest tracking** - "Kill 10 goblins" increments on `:death` event
- **Achievements** - "First Blood", "Kill Streak" tracked via events
- **Hooks** - Plugins can add custom death behavior
- **Logging** - Combat log shows full attack chain
- **Correlation** - Admin can trace attack → damage → death

**What's NOT an event:**
- `calculate_damage/2` - Pure math
- `apply_damage/2` - Direct HP update
- `get_equipped_weapon/1` - Query

---

## Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│ Does another system need to REACT to this?                  │
│   YES → Event                                                │
│   NO  → Continue...                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Do you need an audit trail / replay capability?             │
│   YES → Event                                                │
│   NO  → Continue...                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Is this a significant game-world state change?              │
│   YES → Event                                                │
│   NO  → Direct function call                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Common Patterns

### ✅ Pattern: Publish After Action

```elixir
def give_item(player_id, item_key) do
  # 1. Perform action
  {:ok, player} = Inventory.add_item(player_id, item_key)

  # 2. Publish event (for quests, achievements)
  event = Event.new(:item_received,
    source: player_id,
    payload: %{item_key: item_key}
  )
  EventBus.publish(event)

  {:ok, player}
end
```

### ✅ Pattern: Event Chain

```elixir
def cast_spell(caster_id, target_id, spell_id) do
  # Root event
  cast_event = Event.new(:spell_cast,
    source: caster_id,
    payload: %{spell_id: spell_id}
  )

  # Effect events (caused by cast)
  damage_event = Event.caused_by(cast_event, :damage, ...)
  stun_event = Event.caused_by(cast_event, :status_applied, payload: %{status: "stunned"})

  EventBus.publish([cast_event, damage_event, stun_event])
end
```

### ❌ Anti-Pattern: Query Via Event

```elixir
# ❌ BAD
def get_room_entities(room_id) do
  event = Event.new(:query_entities, location: room_id)
  # ... somehow try to get response via event?
  # Events are fire-and-forget! Can't return values!
end

# ✅ GOOD
def get_room_entities(room_id) do
  EntityRegistry.get_by_location(room_id)
end
```

### ❌ Anti-Pattern: Event Spam

```elixir
# ❌ BAD: 60 events/second per player
def update_position(player_id, x, y) do
  event = Event.new(:position_changed, ...)  # Called 60 times/sec!
  EventBus.publish(event)
end

# ✅ GOOD: Only event on zone change
def update_position(player_id, x, y) do
  old_zone = get_zone(player_id)
  new_zone = calculate_zone(x, y)

  if old_zone != new_zone do
    event = Event.new(:zone_changed,
      source: player_id,
      payload: %{from: old_zone, to: new_zone}
    )
    EventBus.publish(event)
  end

  set_position(player_id, x, y)
end
```

---

## Event Types Reference

From `lib/loka/engine/event.ex`, categorized by usage:

### ✅ Always Use Events

**Combat:**
- `:attack`, `:damage`, `:death` - Quest tracking, achievements
- `:heal` - Quest objectives, logging
- `:initiate_combat`, `:flee` - NPC reactions

**Movement:**
- `:enter_room`, `:leave_room` - NPC reactions, quest triggers
- `:before_move` - Lock checks (cancellable)

**Items:**
- `:get`, `:drop`, `:equip`, `:unequip` - Quest tracking
- `:give` - Quest "give X to NPC"

**Quests:**
- `:quest_started`, `:quest_completed`, `:objective_progress` - Quest UI, achievements

**Economy:**
- `:currency_changed`, `:item_purchased`, `:item_sold` - Economy tracking

### Maybe Use Events (Context-Dependent)

**Communication:**
- `:say`, `:emote` - If you need NPC reactions or quest triggers
- `:tell`, `:whisper` - Usually don't need events unless monitored

**World:**
- `:weather_change`, `:time_change` - For NPC schedules, room atmosphere

**System:**
- `:connect`, `:disconnect` - For analytics, presence tracking

### ❌ Rarely Use Events

**Display:**
- `:display`, `:message`, `:notify_room` - These are OUTPUT, not state changes

---

## Performance Considerations

### Event Overhead

Each event costs:
- ~0.1-0.5ms for event creation
- ~0.5-2ms for PubSub broadcast
- ~1-10ms per hook/listener execution

**Total:** 2-20ms per event (depends on # of subscribers)

### When To Worry

Events are fine for gameplay actions (attacks, item pickups, room transitions). Optimize if:
- Publishing >100 events/second per entity
- Hooks run complex logic (move to async Task)
- Event queues backing up (check PubSub metrics)

### Optimization Strategies

1. **Batch events** - Collect and publish in groups
2. **Async hooks** - Use `Task.Supervisor` for heavy work
3. **Debounce** - Only publish significant changes
4. **Sampling** - For analytics, sample 10% of events

---

## Testing Events

### Test That Events Are Published

```elixir
test "player death publishes event" do
  player = player_fixture()
  enemy = enemy_fixture()

  # Subscribe to event bus
  EventBus.subscribe(:death)

  # Perform action
  Combat.kill(enemy.id, player.id)

  # Assert event received
  assert_receive {:event, %Event{type: :death, target: ^player_id}}
end
```

### Test Event Payload

```elixir
test "damage event includes amount and type" do
  EventBus.subscribe(:damage)

  Combat.deal_damage(attacker.id, target.id, 50, :fire)

  assert_receive {:event, %Event{
    type: :damage,
    payload: %{amount: 50, damage_type: :fire}
  }}
end
```

### Test Correlation

```elixir
test "death event caused by damage event" do
  EventBus.subscribe_all()

  Combat.attack(player.id, enemy.id)

  # Receive events in order
  assert_receive {:event, %Event{type: :attack, id: attack_id}}
  assert_receive {:event, %Event{type: :damage, id: damage_id, caused_by: ^attack_id}}
  assert_receive {:event, %Event{type: :death, id: death_id, caused_by: ^damage_id}}
end
```

---

## Summary

### ✅ Use Events For

- Quest tracking
- Achievement triggers
- Hook integration
- Audit logging
- Asynchronous reactions
- Cancellable actions
- Correlation tracking

### ❌ Don't Use Events For

- Pure queries
- Internal calculations
- Synchronous state updates (no listeners)
- High-frequency updates
- Error conditions

### The Litmus Test

> **"If we added a new quest requiring 'X happens', would we need this event?"**
>
> - YES → Use event
> - NO → Direct function call

**Examples:**
- "Kill 10 enemies" → Need `:death` event ✅
- "Calculate damage formula" → No event needed ❌
- "Player enters room" → Need `:enter_room` event (for NPC reactions) ✅
- "Get player's HP" → No event needed ❌

---

**Last Updated:** 2026-01-24
**See Also:**
- `lib/loka/engine/event.ex` - Event struct and types
- `lib/loka/engine/event_bus.ex` - PubSub implementation
- `lib/loka/engine/hooks.ex` - Hook system integration
- `docs/architecture/hooks-design.md` - Hooks documentation
