# Review: toolbox row W1, reactions on every registered event kind (loka-kgd.21)

- Branch `toolbox/m3-reactions`, head `b905d0d1151d22c4f3b0cae5c394573b769a3963`, against `origin/toolbox/batch-m3` (`716f1ecb`). No PR: the item joins draft batch PR #351.
- Governing: [MECHANICS-TOOLBOX.md row W1 and slice process](../MECHANICS-TOOLBOX.md#toolbox-slice-process); [mechanics.md reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts); [cartridge.md](../system/cartridge.md); `protocol/event.schema.json` payloads. PM rulings in loka-kgd.21: actor model and crow acceptance are settled and are not findings.
- Hosted CI on the head: `ci` and `book-e2e` success.
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. A trigger exists for each of the 22 EventPayload kinds. Each filter equals the payload field it names, and the attribution table matches the payload semantics in `event.schema.json`.
2. Delivery budgets (deliveries, reaction_depth, query_steps) and FIFO to quiescence are unchanged. A budget regression fails a test.
3. The legacy triggers (fact, room, quest_resolved, rested) and the quest legality rules are unchanged.
4. The two kernels agree: the compiler expands short filters and both kernels refuse an unresolved filter.
5. The change is opt-in: Chapter 1 and the corpus compile to the same bytes.
6. An older kernel refuses a cartridge that uses a new trigger, so no `kernel_api` floor is needed.

## Proof

- (1) The schema has 22 `on` variants, the same as the 22 `EventPayload` kinds.
- (2) `proposal.ts` is untouched, and every new kind goes through the same `triggered()` loop. Mutants:
  - Dropping `reaction_depth` turns `reactions.test.ts` red (belfry cycle, 32/33 chain, Bram's wait).
  - Removing `++` on deliveries turns the 8193-deliveries test red.
  - In both cases the sampler budget test stays green (F3).
- Other mutants:
  - In `reaction.ts`, `every` changed to `some` turns the sampler bone/pebble test red, along with five others.
  - The `attack_result` subject set to `attacker_id` turns the `status.test.ts` subject test red.
  - In Elixir, `"item"` dropped from `@filters` turns `content_reactions_sampler_test` red.
- (5) All 28 corpus cartridges, `ashmere_missing_child` included, compile byte-identical with base `lib/` and `protocol/` and with head. This also clears the Elixir `expand` guard: in the source schemas, only a reaction's `on` carries a string `event` without `op`.
- (6) Settled. The base `protocol/fixtures/invalid.json` case for `on.event: item_dropped` expects `unknown_variant` at `/on/event`, so an older kernel fails closed with SCHEMA_VIOLATION. The brief forbids a bump.
- `invalid.json`: the case placement is harmless because no consumer indexes cases by position. The edited base case (`item_dropped` changed to `status_ticked`) is required now that `item_dropped` is valid.

## Findings

1. **should-fix**, `kernel/ts/src/mechanics/reaction.ts:161-164` and `docs/system/mechanics.md:590-592`:
   - The problem: `event.schema.json` defines `subject_id` as the recipe's target for `custom_event`, `action_completed`, `check_passed` and `check_failed`.
   - The scenario: a reaction `{on: check_failed (disarm), apply: status.apply poison}` silently does nothing, because the subject is the plate, not the performer. Row 12 Traps ("disarm by check") depends on this. After G3, the status would land on the thing.
   - Fix: give these four kinds the actor's body as the subject, or the PM rules that the target-subject behaviour is intended and the table says so.
2. **nit**, `docs/system/mechanics.md:600`: the table gives `fact_changed` the actor's body as its subject. The payload can carry `subject_id` (`fact.ts:196`), so an entity fact change on an NPC applies the status to the player. Name this in the table.
3. **nit**, `kernel/ts/test/reactions_sampler.test.ts:64-89`: the test does not assert `limit`, so it survives the reaction_depth and deliveries mutants. The query_steps limit still faults the loop. The existing tests in `reactions.test.ts` carry the budget, so this test adds little; assert the limit it reaches or drop the budget claim.

## Fix round 1 re-check (head `ed3a6c2aa1bd5e9c7999d9a328e52d14b5efa8f7`)

Scope: commit `ed3a6c2a` only, plus the code it touches (`applies()` in `reaction.ts`, called only from `sequence()`'s `status.apply`). Hosted `ci` and `book-e2e` are green, as the PM reports.

1. Resolved. `custom_event`, `action_completed`, `check_passed` and `check_failed` are gone from `SUBJECT`, so their status lands on the doer, and the table and sentence in `mechanics.md` say so. Red control: mapping `check_failed` back to `subject_id` turns the `status.test.ts` subject test red.
2. Resolved. For `fact_changed`, a `subject_id` other than the player's body skips the status, and an absent one means the actor. The `undefined` fallback reaches only `fact_changed`, because every other mapped field is required in `event.schema.json`. Both cases are asserted in `status.test.ts`.
3. Deviation accepted. The test now asserts the `deliveries` limit. The reaction_depth limit is still covered: in round 1, removing the depth check turned three `reactions.test.ts` tests red (belfry cycle, 32/33 chain, Bram's wait).

The `reactions`, `reactions_sampler` and `status` tests pass at the head. Verdict: **APPROVED**.
