# New System Checklist

When adding a new game system (framework module, script, behavior, or content type), run through this checklist before implementation.

## 1. Does it have states?

If your system has distinct phases, modes, or lifecycle stages — use `Loka.Engine.StateMachine`.

**Signs you need a state machine:**
- You're about to write a boolean like `is_active`, `in_progress`, `is_dead`
- You have a `status` field with string values
- You're writing `cond` or `case` chains that check "what phase are we in"
- There are transitions that should be guarded (can't go from A to C without passing through B)
- There are actions that should only be available in certain states
- You need to know "what can happen next" for UI or AI decisions

**How to add one:**
```elixir
@machine StateMachine.new(%{
  initial: "idle",
  transitions: %{
    "idle"    => ["active"],
    "active"  => ["complete", "failed"],
    "complete"=> [],
    "failed"  => ["idle"],
  },
  on_enter: %{"active" => :start_timer},
  on_exit: %{"active" => :cleanup},
})
```

Define as a module attribute in your component accessor (`lib/loka/components/*.ex`). The machine is pure data — no processes, no side effects.

**Existing examples:** Quest progress, combat, crafting, NPC AI, player session, dialogue, entity lifecycle. See `docs/v2-migration/phase-7-polish.md` Task 7.3.

## 2. Is it an entity?

In V2, everything is an entity. Your new system's data should live in entity components, not a separate table or GenServer state.

- **Content definitions** (quest templates, recipes, skill defs) → prototype entities seeded from YAML
- **Runtime state** (player quest progress, combat state) → components on character/NPC entities
- **Global singletons** (weather, day/night, economy) → system entities with behaviors

## 3. Does it need a behavior?

If your system has recurring logic (tick-based updates, event reactions), implement `EntityBehavior`:
- `on_init/1` — setup on entity spawn
- `on_tick/2` — periodic updates (interval set by `tick` component)
- `on_event/3` — react to PubSub events

## 4. Does it need content validation?

If builders create content for this system via YAML, add a validator in `lib/loka/testing/content/`:
- Reference integrity (do referenced entities exist?)
- Reachability (can players actually reach/trigger this?)
- Completability (can the system reach its end state?)

Wire it into `mix loka.test.validate`.

## 5. Does it need script bindings?

If players or builders should be able to customize behavior via Elixir scripts, follow the 4-file pattern:
1. `event.ex` — add event type
2. `bindings.ex` — add binding function
3. `action_queue.ex` — add action handler
4. `entity_server.ex` — handle incoming events (if needed)

## 6. Component accessor

Create `lib/loka/components/your_system.ex` with typed accessors:
```elixir
defmodule Loka.Components.YourSystem do
  @component_key "your_system"
  def get(entity), do: Map.get(entity.components, @component_key)
  def has?(entity), do: Map.has_key?(entity.components, @component_key)
  # ... domain-specific accessors
end
```
