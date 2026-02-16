# Phase 3: EntityServer Evolution

> Full spec: `docs/architecture/unified-object-system-v2.md` Section 16 (Steps 3.1-3.5) + Section 3 (Data Flow) + Section 12 (dispatch_event) + Section 27 (Volatile State)
> **Depends on**: Phase 2 (needs seeded data in DB to load)

## Task 3.1: Evolve EntityServer Core

**File**: `lib/loka/engine/entity_server.ex`

### Add dispatch_event/3

The central event processing function. Runs behavior chain with snapshot rollback:

```elixir
def dispatch_event(entity, event_name, payload) do
  snapshot = Entity.snapshot(entity)

  result =
    entity.behaviors
    |> Enum.reduce_while({:ok, entity, payload}, fn behavior_mod, {:ok, ent, pl} ->
      try do
        case behavior_mod.on_event(ent, event_name, pl) do
          {:ok, updated}          -> {:cont, {:ok, updated, pl}}
          {:ok, updated, new_pl}  -> {:cont, {:ok, updated, new_pl}}  # payload modification
          {:halt, updated}        -> {:halt, {:halt, updated}}
        end
      rescue
        e ->
          Logger.warning("[#{entity.key}] behavior #{behavior_mod} crashed on #{event_name}: #{inspect(e)}")
          {:cont, {:ok, ent, pl}}  # skip crashed behavior, continue chain
      end
    end)

  case result do
    {:ok, final_entity, _payload} -> {:ok, final_entity}
    {:halt, final_entity}         -> {:halted, final_entity}
  end
rescue
  _ -> {:error, snapshot}  # full rollback on catastrophic failure
end
```

### Add force_save option

```elixir
def handle_call({:update, fun, opts}, _from, state) do
  entity = fun.(state.entity)
  state = %{state | entity: entity, dirty: true}

  if Keyword.get(opts, :force_save, false) do
    Entities.save(entity)
    state = %{state | dirty: false}
  end

  {:reply, {:ok, entity}, state}
end
```

Critical operations that force-save: room changes, item pickup/drop, quest completion, XP/level changes, gold, equipment changes, death penalties, builder edits.

### Add :reload handler

```elixir
handle_call(:reload, _from, state) ->
  case Entities.find_one(state.entity.id) do
    {:ok, fresh} -> {:reply, :ok, %{state | entity: fresh, dirty: false}}
    {:error, _} -> {:reply, {:error, :not_found}, state}
  end
```

### Script execution model

Scripts run inside EntityServer during dispatch_event:
- **Same-entity mutations**: synchronous, immediate
- **Cross-entity mutations**: queued in ActionQueue, drained after script returns

```elixir
defp drain_action_queue(state, queued_actions) do
  for action <- queued_actions do
    try do
      execute_cross_entity_action(action)
    catch
      kind, reason ->
        Logger.warning("[#{state.entity.key}] queued action failed: #{inspect({kind, reason})}")
    end
  end
  state
end
```

### Other changes
- Remove all `data` field references
- Load tags from `entity_tags` join table on init
- Publish state to ETS live state table on every mutation (optional — defer if not needed)

## Task 3.2: Create EntityBehavior + SystemSupervisor + volatile.ex

### EntityBehavior (`lib/loka/engine/entity_behavior.ex`)

```elixir
defmodule Loka.Engine.EntityBehavior do
  @callback on_init(entity :: Entity.t()) :: {:ok, Entity.t()}
  @callback on_tick(entity :: Entity.t()) :: {:ok, Entity.t()}
  @callback on_event(entity :: Entity.t(), event_name :: atom(), payload :: map()) ::
    {:ok, Entity.t()} | {:ok, Entity.t(), map()} | {:halt, Entity.t()}
  @callback on_terminate(entity :: Entity.t(), reason :: term()) :: :ok

  @optional_callbacks [on_init: 1, on_tick: 1, on_event: 3, on_terminate: 2]
end
```

No `on_save` callback. Saves are infrastructure.

### SystemSupervisor (`lib/loka/engine/system_supervisor.ex`)

DynamicSupervisor for system entities (weather, day_night, etc.):
- `max_restarts: 5, max_seconds: 60` (system entities should NOT crash-loop)
- Separate from EntitySupervisor (regular entities use `:transient` restart)

### Volatile State (`lib/loka/engine/entity_server/volatile.ex`)

Process dictionary helpers for transient state (combat targets, dialogue cursors, tick counts):

```elixir
defmodule Loka.Engine.EntityServer.Volatile do
  def get(key, default \\ nil) do
    vol = Process.get(:entity_volatile, %{})
    Map.get(vol, key, default)
  end

  def set(key, value) do
    vol = Process.get(:entity_volatile, %{})
    Process.put(:entity_volatile, Map.put(vol, key, value))
    value
  end
end
```

EntityServer sets up volatile before calling behaviors:
```elixir
Process.put(:entity_volatile, state.volatile)
# ... call behavior ...
updated_volatile = Process.get(:entity_volatile)
%{state | volatile: updated_volatile}
```

**Must not call from spawned Tasks** — process dictionary is per-process.

## Task 3.3: Rewrite V1 Behaviors

8 modules in `lib/loka/behaviors/`. Rewrite from V1 `Base` callbacks to V2 `EntityBehavior`:

| V1 Callback | V2 Callback |
|-------------|-------------|
| `init(entity)` | `on_init(entity)` |
| `act(entity)` | `on_tick(entity)` |
| `react(entity, event)` | `on_event(entity, event_name, payload)` |

Delete `lib/loka/behaviors/base.ex` (replaced by EntityBehavior).

**Behavior modules**: `aggressive`, `guard`, `janitor`, `patrol`, `runner`, `scavenger`, `wander`

Each module: `use Loka.Engine.EntityBehavior` (or `@behaviour`), implement callbacks, use `Volatile.get/set` for transient state (patrol waypoints, etc.).

## Task 3.4: PubSub Topics + Tick + System Entity Boot

### PubSub Topic Rename

Search-and-replace across ~10 files:
- `"room:#{id}"` → `"location:#{id}"`
- `"player:#{id}"` → `"entity:#{id}"`

Files affected: entity_server.ex, entity_registry.ex, game_channel.ex, session/server.ex, room_helpers.ex, builder_commands/*.ex

### Tick System

EntityServer checks `entity.components["tick"]["interval"]` on init. If present:
```elixir
defp schedule_tick(state) do
  interval = get_in(state.entity.components, ["tick", "interval"]) || 60_000
  Process.send_after(self(), :tick, interval)
  state
end

handle_info(:tick, state) ->
  state = dispatch_event(state.entity, :on_tick, %{})
  schedule_tick(state)
```

Tick must NOT reset idle timer (Decision 13).

### System Entity Boot

After EntitySeeder runs and EntityServer has behavior dispatch:
1. Query `Entities.find_all(tags: ["auto_start"])`
2. Sort by `components["service"]["boot_priority"]` (lower = first)
3. Start each under SystemSupervisor via `EntityRegistry.get_or_start/1`
4. Clean up stale `online` tags from previous boot
