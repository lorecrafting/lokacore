---
paths: ["lib/loka/framework/**"]
---

# Framework Development Context

This context auto-loads when working in `lib/loka/framework/`.

## What is the Framework Layer?

The framework contains ~25 game subsystems that implement game mechanics on top of the engine. Framework code should:
- Use engine primitives (Entity, Events, Hooks)
- Never call web layer directly
- Return data/events, let web layer handle presentation

## Layer Boundaries

```
     Web Layer (Phoenix, LiveView, Channels)
           ↑ calls ↓ returns events
     Framework Layer (Quest, Combat, Crafting...)
           ↑ calls ↓ returns data
     Engine Layer (Entity, TypedObject, Hooks...)
```

**CRITICAL**: Framework should NEVER import from `LokaWeb.*`

## Subsystem Pattern

Every framework subsystem follows this structure:

```
lib/loka/framework/my_subsystem/
├── my_subsystem.ex       # Public API
├── my_registry.ex        # YAML/ETS storage (use RegistryBase)
├── my_struct.ex          # Data structure
└── handlers/             # Event handlers (if needed)
```

### Registry Pattern
```elixir
defmodule Loka.Framework.MySubsystem.MyRegistry do
  use Loka.Framework.RegistryBase,
    table_name: :my_subsystem,
    directory: "priv/world/my_subsystem",
    schema: Loka.Framework.MySubsystem.MyStruct

  # RegistryBase provides:
  # - get/1, list/0, reload/0
  # - YAML loading on startup
  # - ETS storage for fast lookup
end
```

## Existing Subsystems (~25)

| Category | Subsystems |
|----------|------------|
| **Core Mechanics** | Quest, Dialogue, Combat, Inventory |
| **Resources** | Resources, Skills, Progression |
| **World** | World (day/night, weather), Gathering, Crafting |
| **Social** | Social (channels, parties), Faction |
| **Content** | Storyline, Scripting, Conditions |
| **Economy** | Economy (shops) |
| **Other** | Status, Spark |

## Common Patterns

### Action Result Pattern
```elixir
def execute_action(ctx, params) do
  result = Result.new(
    state: %{game_state: updated_state},
    events: [{:my_event, data}]
  )
  {:ok, result}
end
```

### Quest Progress Pattern
```elixir
Quest.update_progress(game_state, %{
  type: :talk,        # or :kill, :get_item, :go_to
  target_id: "npc_key"
})
```

### Condition Evaluation
```elixir
Conditions.Evaluator.evaluate(condition, context)
# Returns true/false based on game state
```

## Before Making Changes

1. Identify which subsystem is affected
2. Check if similar patterns exist in other subsystems
3. Review `docs/framework/README.md` for subsystem docs
4. Run subsystem-specific tests

## After Making Changes

1. Run `mix test test/loka/framework/my_subsystem/`
2. Run `mix loka.test.validate` if content affected
3. Update `docs/framework/` if API changed

## Anti-Patterns to Avoid

1. **Calling Phoenix from Framework**
   ```elixir
   # BAD - Framework calling Web
   Phoenix.Channel.broadcast(...)

   # GOOD - Return event for Web to handle
   {:ok, %{events: [{:broadcast, data}]}}
   ```

2. **Direct Entity Mutation**
   ```elixir
   # BAD
   entity.stats.health = 50

   # GOOD
   {:ok, %{state: %{entity: updated_entity}}}
   ```

3. **God Modules**
   - Keep modules focused on single responsibility
   - Split large modules into sub-modules

## Related Skills

- `.claude/skills/elixir-query-function-signatures.md` - Ecto query patterns
- `.claude/skills/elixir-resilient-content-loader.md` - Content loading robustness
- `.claude/skills/balance-config-pattern.md` - Game balance config patterns

## Documentation

- `docs/framework/README.md` - All subsystems
- `docs/architecture/mechanics-and-primitives.md`
- `docs/architecture/guardrails.md`
