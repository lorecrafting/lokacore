---
paths: ["server/lib/**/*.ex"]
---

# Type Annotations & @spec Requirements

Applies when writing or modifying Elixir source files in `lib/`.

## Rules

1. **Every public `def` must have an `@spec`** placed immediately before the function head.
2. Use domain-specific types, not generic ones:

| Instead of | Use |
|-----------|-----|
| `map()` | `Entity.t()` |
| `atom()` | `Entity.entity_type()` or `Event.event_type()` |
| `pid()` | `GenServer.server()` |
| `struct()` | `StateMachine.t()`, `Container.t()`, etc. |

3. For ok/error tuples, always spell out both arms:
```elixir
@spec find(String.t()) :: {:ok, Entity.t()} | {:error, :not_found}
```

4. Component accessor modules (`lib/loka/components/`) follow this pattern:
```elixir
@spec get(Entity.t()) :: map() | nil
@spec has?(Entity.t()) :: boolean()
@spec put(Entity.t(), map()) :: Entity.t()
@spec component_key() :: String.t()
```

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | Fix |
|-------------|---------------|-----|
| `@spec foo(any()) :: any()` | Tells nothing | Use specific types |
| Missing `@spec` on public fn | Undocumented contract | Add spec |
| `@spec` on private fn | Noise, dialyzer checks these | Remove |
| `term()` everywhere | Too permissive | Narrow the type |

## Verification

After adding specs, verify:
```bash
mix compile --warnings-as-errors
mix dialyzer  # when PLT is built
```
