# E1 world/items batch review (loka-e1-r9-certification-2rz.6)

- Branch: local `e1/world-resources-items` (not pushed), for draft PR #288.
- Reviewed: `5ac6d2fffbf90d709f9206fa3a179fa4e9795518` (developer `3e6dad66` merged with #288 head `c04aef98`); batch diff `c04aef98..5ac6d2ff` (4 test files, +118).
- Governing: [E1 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md); [architecture.md](../system/architecture.md) item/NPC presence and ancestry/transfer clauses; AGENTS.md Writing tests.
- Verdict: **APPROVE WITH NOTES**

## Requirements written before the diff

1. Credit an item transfer only for a static authored item. Its prior and resulting holders must match the receipt's `entity.transfer` and its acquisition or drop event.
2. Looking at merchant stock gives no credit. Dynamically created entities give no credit.
3. Give no credit to `any`/`not` policy descendants. Add no witness code (`e1_identity.ts` and `e1_obligations.ts` are unchanged).
4. Expected values are literals. One test per break per layer.

## Checks

- The batch diff does not change the witness rule. It adds the `item-round` case and its focused test.
- `npm run typecheck`: exit 0. `node --test test/e1*.test.ts`: 37/37 pass.
- `e1_cases.ts` recorder: exit 2, 24 cases, `failure: null`, `gaps.authored_obligations` = 143. Compared with the 157-path list from ff63b598, it removes the 6 debt paths and exactly these 8 items: iron_sword, lamp_oil, satchel, silver_ring, spare_waterskin, tin_whistle, waterskin and wooden_shield. It adds nothing. `lantern_ale_cask`, the corpse/pelt/hide items and the 14 world-setting/resource paths are still pending. The `item-round` replay exits 0.
- All 8 paths are in `e1-children/world.txt` (one line each).
- Mutants planted in a throwaway worktree (since removed). The table shows exit codes for e1_items.test and e1_identity.test:
  - A. Credit only acquisitions by the player body (`e1_identity.ts:46`): items 1, identity 0.
  - B. Require an NPC source: items 1, identity 0.
  - C. Drop the event check: items 1, identity 1.
  - D. Drop the resulting-holder check (`e1_identity.ts:43`): items 1, identity 0.
  - E. Route skips `ignite`: items 1 (`not_present` at the dark pool).
- Duplication dispute: settled for the developer. The new test is the only one that catches A, B and D (sell direction, room source and resulting holder). It is not a same-layer duplicate.
- `op.op` clause (`e1_identity.ts:40`): keep it. It narrows the `DeltaOp` union. Removing it makes `tsc -p test` fail (TS2339 on `source_id`, `destination_id` and `entity_id`), so the typecheck is its red control. At runtime the clause is equivalent to removing it, so no runtime plant is needed.
- `created` clause (`e1_identity.ts:33-34`): unreachable in lawful states. `entityIds` is minted only for static definitions (`src/runtime/fresh.ts:126`), and the lookup at `e1_identity.ts:28` already excludes created IDs. A plant would need a state the kernel cannot produce. It is not a finding for this batch (see nit 1).

## Findings

1. nit, `kernel/ts/test/e1_identity.ts:33-34` (outside the batch): the `created` guard repeats the static-ID lookup. Scenario: none reachable. If the identity owner wants it, deleting the guard is safe. No plant is needed.
2. nit, `kernel/ts/test/e1_items.test.ts:35-38`: the `entityIds: {}`, `events: []`, no-transfer and after/after perturbations repeat `e1_identity.test.ts:126-145`. Mutant C fails both tests. Only line 39 (before/before) is unique, and it catches mutant D. Removing lines 35-38 would lose no break that is currently caught.
