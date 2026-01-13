---
paths: ["lib/loka/engine/**"]
---

# Engine Development Context

This context auto-loads when working in `lib/loka/engine/`.

## Invariants (NEVER Violate)

These are architectural constants that must remain true:

1. **Commands return events, never mutate**
   ```elixir
   # ALWAYS: Return {:ok, [Event.t()]}
   {:ok, [%Event{type: :item_picked_up, data: item}]}

   # NEVER: Direct mutation
   entity.inventory = new_inventory  # NO!
   ```

2. **EntityServer auto-saves every 60 seconds**
   - Don't manually save in hooks
   - Dirty flag triggers auto-save
   - State lives in GenServer process

3. **TypedObject resolution order**
   ```
   Content modules (Quest, Dialogue, Script, Zone)
        ↓ (if not found)
   Legacy loaders (YAML files, Database)
   ```

4. **Hook system has 22 lifecycle events**
   - Async execution via Task supervisor
   - Don't block in hooks
   - See `docs/architecture/hooks-and-locks.md`

5. **Lock strings follow Evennia pattern**
   - `"owner"` - entity owner only
   - `"wizard:admin"` - admin role required
   - `"lock:key_item"` - requires item

## Key Patterns

### GenServer per Entity
```elixir
# Entities are lazy-loaded processes
EntityServer.call(entity_id, :get_state)
# Process created on first access, auto-despawns on inactivity
```

### RegistryBase for Subsystems
```elixir
# New subsystems should use this macro
defmodule Loka.Framework.MySubsystem.MyRegistry do
  use Loka.Framework.RegistryBase,
    table_name: :my_registry,
    directory: "priv/world/my_data",
    schema: MyStruct
end
```

### PubSub Topics
- `room:{id}` - Room events (entry, exit, actions)
- `player:{id}` - Player-specific events
- `entity:{id}` - Entity lifecycle events

### Error Handling
```elixir
# Return errors, don't raise (except programmer errors)
def find_npc(room, key) do
  case Enum.find(room.entities, &(&1.key == key)) do
    nil -> {:error, :npc_not_found}
    npc -> {:ok, npc}
  end
end
```

## Before Making Changes

1. Check `docs/architecture/` for design context
2. Run `mix test` to establish baseline
3. Identify affected subsystems and their tests
4. Review similar patterns in existing code

## After Making Changes

1. Run `mix test` - all tests must pass
2. Run `mix loka.test.validate` - content integrity
3. Check for compiler warnings - fix all
4. Run `/check-work` for comprehensive verification

## Key Files

| File | Purpose |
|------|---------|
| `entity.ex` | Core entity struct |
| `entity_server.ex` | GenServer lifecycle |
| `entity_registry.ex` | Entity lookup |
| `typed_object/` | Unified content system |
| `hooks.ex` | Lifecycle events |
| `locks.ex` | Access control |

## Documentation

- `docs/architecture/entity-system.md`
- `docs/architecture/entity-lifecycle.md`
- `docs/architecture/hooks-and-locks.md`
- `docs/architecture/events.md`
