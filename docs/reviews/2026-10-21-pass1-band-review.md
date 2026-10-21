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

## Second opinion

- Independent second reviewer, anthropic/claude-opus-5-5, 2026-10-21. Reviewed the same head `1c3f27a73413b87fa1e86841cb3d0cab02ae5b47` on base `1516a8ab020cac788717f0cb5c7de3e01e35eaa5`. The findings below were formed before this record was read; they do not repeat its findings.

**Verdict: CHANGES REQUIRED** (one blocker, a test gap only). This differs from the first verdict.

### Must be true (written before the diff)

1. The band word uses the same rule and table as ResourceView. The table is the pool's, then `world.bands`, then the engine default. An NPC's hp range override is respected.
2. No hp number is sent. CombatView and its member objects keep `additionalProperties: false`. `band` is optional and uses the `Key` pattern. Both kernels run the new fixtures.
3. No save, delta or cartridge field changes. As an optional view field, it needs no tag or kernel_api bump.
4. The band is gated per viewed foe and per actor (light `visible`). This covers the primary and each pack member on its own.
5. Dead and fled members leave the roster.

Holds: 1, 2, 3 and 5. Item 4 holds in the code, but no test pins the per-member part (blocker 1).

### Findings

1. **Blocker**: `kernel/ts/src/view/combat.ts:31`. No test pins the per-member `visible` gate.
   - Mutant: the member gate reads the primary, `visible(world, actor, fight.row.npc_id, steps)`. It SURVIVED `combat_band`, `c4_pack`, `c4_pack_flight` and `combat_contracts`.
   - Scenario: a pack member holds a `hidden` status (toolbox_showcase `statuses/hidden.json`), or it has `perception` and is not yet discovered. The primary is seen. `concealed` (`kernel/ts/src/mechanics/status/shared.ts:227`) and the perception branch (`kernel/ts/src/mechanics/light/shared.ts:112-113`) make `visible` false for that member alone. After the regression, the unseen member's band word leaks to the Combat page, and the suite stays green.
   - The dark test cannot catch this, because in the dark every member's visibility equals the primary's.
   - Fix: add one pack case with one member concealed and assert that its `band` is undefined while the primary's band is a literal key.
2. **Question**: a pack member killed by a spell or status stays in `active_ids` until the round-end prune (`kernel/ts/src/mechanics/combat/shared.ts:105`). If a GameView is built before that prune, a member without `perception` shows the table's bottom row (default `dying`) for a dead foe. Can a view be built in that window? If yes, the fix is to omit the band for a non-living member.

### Evidence

- Mutants (`bin/mutate.sh`, focused files above):
  - member band copied from the primary: red;
  - NPC hp range override ignored in `bandOf`: red;
  - per-member visibility read from the primary: green (finding 1).
- Schema: `band` on the opponent and on each member is `$ref action.schema.json#/$defs/Key`. The member keeps `required: [id, name]` and `additionalProperties: false`. `contracts.gen.ts` matches. Elixir reads the schema at compile time (no generated twin).
- No file under the save, delta or cartridge schemas changed.
