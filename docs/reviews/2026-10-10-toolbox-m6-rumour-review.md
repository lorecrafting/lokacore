# Review: toolbox row W3, rumour by co-presence (loka-kgd.57, batch M6)

- Branch `toolbox/m6-rumour`, head `9f09a6049c1b098a245a973e425abb43f7f48387`, base `89a277c8`, 23 files. No PR; handoff in Beads `loka-kgd.57`. Record kept (PM ruling): the slice adds an optional `npc` trigger filter on `entity_entered_room` to `protocol/reaction.schema.json` ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [row W3](../MECHANICS-TOOLBOX.md#ranked-toolbox); [reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts); [mechanics.md W3](../system/mechanics.md#rumour-by-co-presence-toolbox-row-w3); [cartridge.md declarations](../system/cartridge.md#rumour-declarations).
- Hosted CI on the head: ci and book-e2e, both success (`gh run list --commit`).
- Trial merge into `origin/toolbox/batch-m6` `73abdead` (row 46): conflicts only in `docs/MECHANICS-TOOLBOX.md` (keep W3 from this branch, 46 from the batch), `docs/system/cartridge.md`, `docs/system/mechanics.md` (both append a section; keep both) and two generated files. After that resolution, `elixir bin/contracts.exs` regenerated them, `--check` passed, `contracts.gen.ts` auto-merged byte-equal to the regenerated output, and both focused rumour tests passed.
- Verdict: **APPROVE WITH NOTES**: one should-fix, one nit.

## Must be true

1. News passes only by co-presence: no rule fires when the carrier is elsewhere, the player included (row W3 "never global").
2. An NPC's schedule jump fires `entity_entered_room` reactions with the player away, so the innkeeper knows by evening only because Ada walked past.
3. The new filter is the smallest engine change. It matches the authored instance only and is legal on `entity_entered_room` only.
4. The loader and the compiler both refuse an unresolved `npc` and a floor below 1.47. The floor refactor changes no existing verdict.
5. Existing cartridges compile to the same bytes. Chapter 1 and corpus are untouched.

## Proof

- (1, 3) Gap is real: mutant `reaction.ts:54` `npc: () => true` (the content-only trigger) fails "the player entering the inn while Ada is away" with actual `[true, true]`. A content-only alternative does not close it: `npc_present` reads the player's room, so it would block the schedule case. Schema `on` branches are `additionalProperties: false`, and `npc` appears in `on` only for `entity_entered_room` (`reaction.schema.json:40`; the other `npc` keys are in `apply` steps). The filter cannot collide with another kind.
- (2) Test 1: player in the square from 16:30 to 18:30, innkeeper `false` then `true`. Killed by the filter-off mutant via test 2. Test 1 needs the job-emitted event.
- (4) Mutants all killed: TS floor 47→46, TS `NAMED.npc` removed, Elixir floor 47→46, Elixir `"npc" => "npc"` removed. The kills are assertion failures, not compile errors.
- (4) Refactor equivalence: the old Elixir `api/2` was one `or` and gave one diagnostic per rule. The old TS had three separate `if`s, so up to three identical diagnostics per rule. The loader surfaces one (`cartridge.ts:96` `first(ds)`). OR of (op used ∧ v < floor) equals v < max(floor of the ops used), so no verdict changes in either kernel. No test pins a count. The commit text "so both report one" overstates the Elixir side, but this is cosmetic.
- (5) The base and head compilers built every directory under `cartridges/`. 47 of the 48 gave identical results; only `rumour_sampler` differs, because the base compiler refuses `npc`. The diff stat touches no fixture, corpus or other cartridge.
- Documented authoring rule: [mechanics.md W3](../system/mechanics.md#rumour-by-co-presence-toolbox-row-w3) Pattern and Limits say the listener must stay in the room. The arrival variant reuses W2's unnamed `fact.assign`, which the sampler's `sees_mill` exercises.
- loka-qi0r: tests wait one hour at a time; accepted per brief.
- Re-run claims: "[true,true]" (above) is confirmed. "One diagnostic per rule" is confirmed, with no observable change.

## Findings

1. **should-fix (this slice)**, `kernel/ts/src/content/cartridge_reactions.ts:28` and `lib/loka/content/reactions.ex:64`: the 1.8, 1.12 and 1.35 floors survive in both kernels. Each was set to 0, and the TS loader tests (`d9_contracts`, `first_search`, `quest_deadline`, `cartridge_escort`) and Elixir tests (`content_{d9,escort,ferry,first_search,quest_deadline,reward_storage,sampler}`, `content_test`) stayed green. The gap was there before, but this slice rewrote those lines. Failure: a later edit drops `'quest.resolve'` from `FLOORS`; a 1.11 cartridge with `quest.resolve` then loads, and a 1.11 host faults at runtime. Fix: one row per floor per kernel, each just below its floor with only that op. If another check masks a floor, say so and drop that row.
2. **nit**: the developer's `/code-review` result is not reported. There is no PR body yet; put it in the batch PR.

## Re-check: fix round 1 (head `53b878b3904e432924cfd7910a20190487da1fd8`)

Scope: `ccaf4912`, `7a224723` (floor tests), `57f3efc0` (merge of batch `73abdead`), `53b878b3` (PM rulings: spawn-template entrant refused, row W3 text). Hosted ci and book-e2e: success. Verdict: **APPROVE WITH NOTES**.

- Finding 1, mostly resolved. `rumour.test.ts:156` and `content_rumour_test.exs:45` call `reactions()` / `Reactions.check` directly. Killed in both kernels: `quest.resolve` 12→11, `quest.fail` 12→0, `population.suppress` 35→36. Dropping the `quest.activate` row is sound, because the trigger floor already covers that op's only accepted trigger.
- **should-fix (residual)**, `kernel/ts/src/content/cartridge_reactions.ts:69` and `lib/loka/content/reactions.ex:89`: setting the `quest_resolved` trigger's own 1.8 to 0 survives in both kernels against the rumour tests. The test comment relies on that trigger floor, but it is the one line no row exercises. Failure: a later edit drops the trigger term, and a 1.7 rule on `quest_resolved` passes `reactions()`. Fix: add one row (`on: {event: quest_resolved}`, `apply: []`, 1.7 refused, 1.8 not) to the same direct-call tables. It can go in the batch's next fix round.
- Spawn-template refusal. Mutants were killed in both kernels: TS condition forced false (`cartridge_reactions.ts:80`), and the Elixir clause never matching (`reactions.ex:66`). Parity holds. `entity.schema.json:529` makes `spawn_template` `const: true`, so the field is either `true` or absent. Elixir's `%{"spawn_template" => true}` match and TS truthiness therefore always agree.
- Merge `57f3efc0`: the merge result keeps every line of both parents. It drops only the stale side of each row in `MECHANICS-TOOLBOX.md` (row W3 is now "done" from this branch, row 46 from the batch) and the old `entity_entered_room` row in `mechanics.md`. `cartridge.md` and `mechanics.md` keep both sections. `elixir bin/contracts.exs --check` passed at the head.
- The row W3 text in `MECHANICS-TOOLBOX.md` and the declaration in `cartridge.md` now describe the built filter, its template refusal and its 1.47 floor.
- The nit (`/code-review` in the batch PR body) is still open until that PR exists.
