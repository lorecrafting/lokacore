# Economy System Code Review — Continuation Prompt

## Context
We implemented a central Economy system for the Loka MUD engine. A thorough code review found ~30 issues (4 critical, 8 high, 12 medium, 6 low). We fixed C1-C4 (race condition, atomic update_protected, transfer rollback, zero-amount guard) and H1 (shop error swallowing).

## What's DONE (already fixed)
- **C1+C2**: TOCTOU race condition fixed — balance check is now atomic inside GenServer call. `update_protected` in `entity_server.ex` now supports `{:error, _}` returns from callbacks.
- **C3**: Transfer compensation — if receiver credit fails, sender is refunded.
- **C4**: `apply_faucet_multiplier` now uses `max(1, trunc(...))` to prevent zero-amount mints.
- **H1**: `deduct_currency` and `add_currency` in shop.ex now return `{:ok, entity}` tuples instead of bare entities.

## What STILL NEEDS FIXING

### Compile error: shop.ex callers need updating
`deduct_currency` and `add_currency` now return `{:ok, entity}` but `buy_item` (line 86) and `sell_item` (line 158) call them expecting bare entities. Need to pattern match:
- Line 86: `character_after_deduct = deduct_currency(...)` → `{:ok, character_after_deduct} = deduct_currency(...)`
- Line 158: `character_after_add = add_currency(...)` → `{:ok, character_after_add} = add_currency(...)`
- Buy flow should also handle `{:error, :insufficient_funds}` from `deduct_currency` as a safety net.

### H4: Builder `economy_history` crashes on invalid input
File: `lib/loka_web/channels/builder_commands/economy.ex` line 117
`String.to_integer(n)` → use `Integer.parse/1` with error handling

### H5: `String.to_atom` from builder input (atom table leak)
File: `lib/loka_web/channels/builder_commands/economy.ex` lines 65, 85
Add allowlists for known source/sink atoms, or keep as strings instead of atoms.

### H7: `money_supply` loads all character entities into memory
File: `lib/loka/framework/economy/economy.ex` lines 206-213
Replace with SQL aggregate query using `Ecto.Query` + JSON extraction.

### H8: String.to_atom in action_queue from script input
File: `lib/loka/engine/script/action_queue.ex` lines 675, 692
Keep as strings — pass source/sink as strings throughout, only convert to atom in Economy module where it validates.

### L2: `require Logger` inside function body in economy_log.ex
Move to module level.

### M2: daily_summary loads all transactions into memory
File: `lib/loka/framework/economy/economy_log.ex` lines 71-76
Use SQL GROUP BY + SUM aggregate queries.

### M3: Stale docstring in rewards.ex
Line 13: "stored in player flags" → "stored in wallet component via Economy module"
Also line 67: "Applies gold reward to player flags component" → update

### M4: Missing composite index
Add `(entity_id, inserted_at)` composite index to migration.

### M5: entity_id nullable
Add `null: false` to entity_id in migration.

### M6: `@doc since` inconsistency
Remove `@doc since: "0.1.0"` from wallet.ex `put/2` and entity_server.ex `update_protected/3`.

### M1: credit/debit ignore source/sink param
Remove the unused parameter from credit/3 and debit/3 signatures.

### L1: Local alias style in economy.ex
Move `alias Loka.Engine.Entities` to module top level.

### After all fixes:
1. Run `mix compile --warnings-as-errors` — must pass
2. Run `mix test` — all tests must pass
3. Run `mix test test/loka/components/wallet_test.exs test/loka/framework/economy/economy_test.exs test/architecture_test.exs` — verify economy + arch tests pass
4. Commit and push with message about the Economy system implementation
