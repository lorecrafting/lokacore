# Review: FD1 delayed reactions, job checker and save, second opinion

- Branch `toolbox/m12-delayed`, exact commit `f4c6fa325d9a112053fde28c5b53d151c8d6d596` (base `e78a8629`); Beads `loka-kgd.138`; kernel_api 1.88. Second opinion because the slice widens the portable job checker (`compose_job.ts`, `compose_encounter.ex`) and pending jobs cross a save ([WORKFLOW Review count](../WORKFLOW.md)). Scope: the checker in both kernels, its invariant twins, fixtures, schemas, save reopen. Another reviewer covers the gameplay.
- Governing: [mechanics.md Delayed reactions (FD1)](../system/mechanics.md#delayed-reactions-toolbox-row-fd1), [contracts lessons](../lessons/contracts.md), [storage lessons](../lessons/storage.md); brief rulings in `br show loka-kgd.138` (no new JobRow column; clamp to wait end + 1 in the rule; reopen does not validate a reaction job's `actor_id`, known limit).
- **Verdict: APPROVE WITH NOTES.**

## Must be true (written before the diff)

1. `job.schedule` with kind `reaction` needs `actor_id` and no other binding (quest, water, encounter, crow, bleed, sight); `actor_id` alone stays refused on every other kind. TS and Elixir give the same answer on each shape, and the invariant twins agree with their composers.
2. The `nonfuture_job` guard (`compose_job.ts:17`) is unchanged; the clamp lives in the rule.
3. No JobRow or delta schema change beyond what `contracts --check` regenerates.
4. A pending reaction job survives a real-SQLite cold reopen, a lost COMMIT acknowledgement and recovery replay with state equal to an uninterrupted run.
5. Chapter 1 hash unchanged.

## Evidence

- 1: reviewer probe, both kernels, on `encounter_composition.json` `base` (17 shapes): equal answers on reaction+actor (accepted, row stores `actor_id`), reaction alone, reaction+actor+quest, +water, +water_body only, +bleed, +crow, +encounter, actor on npc/status/population_bundle (all `precondition_failed`); cancel or early complete of a stored reaction row refused in both. `delta_preconditions_hold` agrees with its composer in each kernel. One divergence: finding 1.
- 2: the `compose_job.ts` diff touches only `bindingValid` and `pendingJob`; reaction+actor at `due_time` 0 gives `nonfuture_job` in both. Clamp at `reaction.ts:323`.
- 3: `mix run bin/contracts.exs --check` exit 0; `contracts.gen.ts` changes only Policy and ReactionRule (`after`); no JobRow change.
- 4: `raid_aftermath.test.ts` green. Reviewer scratch test (not committed) with `elapsedHost` lost-COMMIT fault on the 1000 pulse that schedules the aftershock: `pending`, then `ready` on recovery, cold reopen, run to 2100; receipts (21), view, `aftershocks` `[[1600,1]]`, `aftermaths` `[[2000,1]]` equal the unfaulted control.
- 5: `missing_child.test.ts` green; no `*_hash.json` touched; frozen fixtures: only `encounter_composition.json` and `invalid.json` appended.
- Claims rerun: "dropping each new required entry/bound fails validate.test.ts" (19e4b62b) holds once `contracts.gen.ts` is regenerated (S1, S2 below); "passing the fault through fails the removed-rule test" (3880e980) holds (C1).

## Mutants (all red)

- TS composer: M1 actor-alone refused on reaction, M2 drop reaction encounter refusal, M3 row drops `actor_id`: red in `encounter_composition.test.ts`. TS invariant: M4 replay row drops `actor_id`, M5 actorless reaction admitted: red. Rule: M9 clamp removed, C1 fault passes through `runDelayed`: red in `raid.test.ts`.
- Elixir: M6 actorless reaction, M7 reaction+encounter, M8 invariant actor-alone on any kind: red in `encounter_composition_test.exs`.
- Schema: S1 drop `after.minimum`, S2 drop `time_since` `at_least` from required: red in `contracts_test.exs` and, after regeneration, `validate.test.ts`.

## Findings

1. **should-fix** `lib/loka/core/compose_encounter.ex:285-287` (and `invariants_encounter.ex:265-266`): the FD1 clause admits `{kind reaction, actor_id, sight}`; TS refuses it (`compose_job.ts:67-73`: sight only on `population`, never with `actor_id`). Failure: that delta faults `precondition_failed` in TS and commits a reaction row carrying `sight` in Elixir. At `e78a8629` both refused it (actor on reaction failed), so FD1 opens the divergence. Not reachable from shipped rules (`reaction.ts:320-324` sets no `sight`), hence not a blocker. Fix: `op["sight"] == nil` in that clause and its invariant twin, plus one `encounter_composition.json` case `reaction-schedule-refuses-sight` (`precondition_failed`).
2. **nit** `protocol/fixtures/encounter_composition.json`: no literal case for reaction+actor+quest or reaction+actor+water. Older clauses refuse both today (probe), so this is cheap cover only.

## Open items

- Pre-existing, not FD1: Elixir `other_binding?/1` never checks `sight`; `{npc, sight}` and `{quest, actor_id, quest_instance_id, sight}` are accepted by Elixir and refused by TS at both `e78a8629` and head. For the PM to file.
