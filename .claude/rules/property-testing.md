---
paths: ["server/lib/loka/mechanics/**", "server/lib/loka/engine/state_machine.ex", "server/lib/loka/framework/inventory/**", "server/lib/loka/components/**"]
---

# Property-Based Testing

Applies when modifying mechanics, state machines, inventory, or component modules.

## When to Write Property Tests

Write property tests when a module has:
- **Mathematical invariants** (damage >= 1, health never negative, balance non-negative)
- **Roundtrip operations** (add then remove returns original state)
- **Algebraic properties** (grouping preserves count, tags are unique)
- **State machine rules** (valid transitions succeed, invalid fail, terminal states)

## Pattern

```elixir
defmodule MyPropertyTest do
  use ExUnit.Case, async: true
  use ExUnitProperties

  import Loka.Test.Generators   # shared generators in test/support/generators.ex

  property "descriptive invariant name" do
    check all(input <- generator()) do
      result = Module.function(input)
      assert invariant_holds?(result)
    end
  end
end
```

## Available Generators (test/support/generators.ex)

| Generator | Produces |
|-----------|---------|
| `entity_type()` | Valid entity type atoms |
| `entity()` | Minimal Entity structs |
| `component_key()` | Component key strings |
| `component_data()` | Simple maps for components |
| `resource_pool()` | `%{"current" => n, "max" => m}` where n <= m |
| `inventory_list()` | Flat list of item key strings |
| `quantity()` | Positive integers 1..10 |
| `gold_balance()` | Non-negative integers |
| `currency_amount()` | Positive integers for credit/debit |

## Existing Property Tests

- `test/loka/engine/entity_property_test.exs` — Entity invariants
- `test/loka/engine/state_machine_property_test.exs` — StateMachine transitions
- `test/loka/framework/inventory/stacking_property_test.exs` — Stacking operations
- `test/loka/mechanics/damage_property_test.exs` — Damage math invariants
- `test/loka/components/wallet_property_test.exs` — Wallet balance properties

## Naming Convention

Property test files use `*_property_test.exs` suffix to distinguish from unit tests.
