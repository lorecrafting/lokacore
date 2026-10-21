# Review: pass-1 GE7 opponent hp band in GameView (loka-y6yg.49)

- Local branch `showcase/pass1-band`, exact head `1c3f27a73413b87fa1e86841cb3d0cab02ae5b47`; slice commits `9b477237a..1c3f27a73` on base `1516a8ab0`; merges into `showcase/pass1` (no PR).
- Governing: [pass-1 UI rulings C2b](2026-10-21-pass1-ui-rulings.md); [book-ui.md "Live combat response (M6-A)" and "Conditions details"](../system/book-ui.md); [protocol.md GameView](../system/protocol.md); [cartridge.md versioning](../system/cartridge.md); [contracts lessons](../lessons/contracts.md); AGENTS.md "Writing tests".
- Hosted CI at the head: `ci` run 39682244519 success, `book-e2e` 39682244447 success.
- Written 2026-10-21 by anthropic/claude-opus-5-5.

**Verdict: APPROVE WITH NOTES** (no blocker or should-fix).

## Must be true (written before the diff)

1. Each opponent, and each pack member, carries a band key from the same table rule as the player's ResourceView: the pool's `bands`, else the cartridge `world.bands`, else the engine default; first row with `100*(current-min) >= at_percent*(max-min)`.
2. No hp number reaches CombatView.
3. Dead and fled pack members drop out of the view.
4. An unseen opponent (dark) shows no band; its name follows the existing perception rule.
5. The view is actor-relative (Realm): name and visibility take the viewing actor.
6. Schema, generated types and fixtures agree; every new bound has a failing fixture; versioning follows precedent.
7. An Elixir twin is needed only if `bin/contracts.exs` declares one.

Holds: 1-7. Item 6: optional view field, no kernel_api bump, as ConditionView `duration` (`44caf9920`). Item 7: no GameView or combat twin is declared.

## Developer open items

- No tone with the band: correct, C2b rules word only.
- Primary opponent described twice in a pack fight (`kernel/ts/src/view/combat.ts:36`): the shape predates this slice. Note for UI6: draw `active_opponents` when present, else the top-level opponent.
- `bandOf` returns hp numbers (`kernel/ts/src/view/resources.ts:47`): no wire leak; CombatView refuses unknown properties and the tests validate the view. Accepted.
- Stale cite: finding 1.

## Findings

1. **Nit**: `docs/system/protocol.md:384` still cites `kernel/ts/src/view/view.ts:216`, `:235`; at the head those lines are an entity `id` parameter and `liquidView`. A reader following the cite finds no band rule. Fix: point it at `bandOf` in `kernel/ts/src/view/resources.ts`.
2. **Nit**: `kernel/ts/test/combat_band.test.ts:36` and `kernel/ts/test/c4_pack.test.ts:256` take the expected name from the code under test (`combat(w).name`, `view.combat?.name`). A regression that changes the name for every caller (for example the dark name rule) passes both. Fix: assert the literal TextKey.
3. **Nit**: the handback has no `/code-review` result, and its `resources.ts:59` cite is a comment line; `bandOf` is at `:47`. Fix: report both in the fix round.
4. **Question** (designer, UI6): an unseen opponent's name stays visible in the dark. This is inherited from the base, and no spec clause hides it. Is that intended?

## Evidence

- `elixir bin/contracts.exs --check`: exit 0.
- Focused tests (`combat_band`, `c4_pack`, `c4_pack_flight`, `combat_contracts`): 21 pass, 0 fail.
- `bin/mutate.sh`, all red: `>=` to `>` in `bandOf`; `visible` check forced true; member band taken from the primary; `world.bands` dropped; bands forced undefined.
- Schema mutant (member band `$ref` to plain string, regenerated): red in TS (`CombatView:invalid member band`) and Elixir (exit 2, same fixture).
