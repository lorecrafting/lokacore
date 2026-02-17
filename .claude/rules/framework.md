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
     Engine Layer (Entity, EntityServer, StateMachine, Hooks...)
```

**CRITICAL**: Framework should NEVER import from `LokaWeb.*`

## Subsystem Pattern

Every framework subsystem follows this structure:

```
lib/loka/framework/my_subsystem/
├── my_subsystem.ex       # Public API
├── my_struct.ex          # Data structure (optional)
└── handlers/             # Event handlers (if needed)
```

Framework subsystems use `Entities.find/1` for data access. The DB is the single source of truth — no ETS registries.

## Existing Subsystems (~25)

| Category | Subsystems |
|----------|------------|
| **Core Mechanics** | Quest (progress, chains, definitions), Dialogue (conversation trees), Combat (server, damage types), Inventory (equipment, containers) |
| **Player** | Player (game state), Progression (leveling), Skills (binary + leveled skill systems), Status (status effects) |
| **Resources** | Resources (pools, formulas, tickers), Gathering (nodes, registry), Crafting (recipes, stations) |
| **World** | World (day/night, weather, ambient), Storyline (story arcs, registry) |
| **Social** | Social (channels, parties, messaging), Economy (shops) |
| **Content** | Scripting (behaviors, world events), Conditions (evaluator), Content Validator (quest, dialogue, world plugins) |
| **Infrastructure** | Actions (resolver), Broadcast (event dispatch), Spark (engagement events) |

## Common Patterns

### Action Result Pattern
```elixir
def execute_action(ctx, params) do
  result = Result.new(
    state: %{entity: updated_entity},
    events: [{:my_event, data}]
  )
  {:ok, result}
end
```

### Quest Progress Pattern
```elixir
Quest.update_progress(entity, %{
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
3. Ensure all public functions have `@spec` annotations
4. Run `mix dialyzer` to check type correctness (when PLT is built)
5. Update `docs/framework/` if API changed

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
