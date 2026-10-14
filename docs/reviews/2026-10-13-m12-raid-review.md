# Review: toolbox row 37a, phased world event spawn (loka-kgd.131)

- Branch `toolbox/m12-raid`, head `9697574d3e7596432a7e2761e7a3d87a929fc206`, diffed against `b80dbf71` (`toolbox/batch-m12`). No PR (batch model). Installed `kernel_api` 1.83 to 1.84.
- Governing: [Phased world events](../system/mechanics.md#phased-world-events-toolbox-row-37a) (added here), [reaction@1](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), [C3 populations](../system/mechanics.md#c3-bounded-living-hounds-selected-contract) ("a newly spawned member stays at home for that occurrence"; equal-time jobs), [same-time jobs lesson](../lessons/mechanics.md), Beads `loka-kgd.131` (brief). PM rulings taken as given: chance-1 sampler plan (to become a target-0 plan), `population.suppress` not read.
- Hosted CI at review time: `book-e2e` success, `ci` in progress.
- Verdict: **CHANGES REQUIRED** (two blockers).
- Written 2026-10-13 UTC in Claude Code by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. Schema: `{op: population.spawn, plan}` after `item.move`, no other key; contracts regenerated.
2. One bundle through the existing birth into `home` at the delivery's logical time, lowest free slot up to `cap`; no free slot: no write, no fault; no RNG.
3. Any trigger; the plan's own job unchanged; spawned members are members (cap, death, replacement).
4. Same logical time as the plan's own job, in either job order: no fault, a stated result (lessons, C3 equal-time rule).
5. Receipts rebuild the same world; no respawn.
6. Both loaders: 1.84 floor, UNRESOLVED_REFERENCE at the step's `plan`.
7. No new single-player assumption (owner rule 2026-10-13).

## Proof

- Green at head: `node --test test/raid.test.ts` 6/6; `mix test test/loka/content_raid_test.exs` 1/1.
- Mutants (TS restored with `git checkout`; Elixir likewise):
  - killed: lowest slot `find` to `findLast` (slain-raider test); `replacement_due` ignored (slain-raider test); TS floor 84 to 83 (test g); Elixir floor 84 to 83 and the `leaf_refs.ex` plan entry removed (content_raid_test fails each).
  - survived: `&& !taken(slot)` dropped (6/6 pass): finding 2.
- `reaction.ts` trims: `rule.on.event === 'fact_changed' && terminal(...)` then `if (!result)` faults exactly when the old early return or `!result` did; `[position, gained]` is the same two lets. No behaviour change.
- Acceptance literals hand-checked: lunar 2000, new [0,1000), full [1000,2000); spawn at 1000, none 1100-1900, `calm` at 2000, slot 2 at 3000, nothing at 5000. The sampler plan's own job is due at 200/800 (target boundaries, no draw), never at a raid hour.

## Findings

1. **blocker** `kernel/ts/src/mechanics/population/react.ts:27-32` with `shared.ts:210`: a spawn and the plan's own wander boundary at one time fault the advance when the calendar job orders first. The plan job excludes only its own births (`born.ids`) from the wander, so it moves the reaction-born member in another writer group. Probe (sampler plan with `wander_interval 100`, `chance 100`, target 1, full moon from 100, one elapsed 0 to 100): contexts `3d4e…`, `1111…` (calendar job id sorts first) give `conflicting_write` on the raider's containment; `2222…`, `3333…` (population first) accept with 2 raiders; without the raid rule all four accept with 1. Wander intervals are hour multiples and `clock_hour` fires every hour, so every wandering spawn plan, including the target-0 plan of PM ruling 1, can hit this: that world's elapsed advance faults on every retry. Fix: a member the proposal birthed at this time stays home (C3 rule), and a test in both job orders with literal states. The spec should say whether the spawned member counts toward the job's target at that time (here 2 raiders in one order, 1 in the other).
2. **blocker** (surviving mutant) `react.ts:22-28`: "A later spawn of the same rule takes the next free slot" (spec) is untested. Dropping `taken` keeps 6/6 green; a rule with two spawn steps then faults `precondition_failed` on slot 1 (probe), while with `taken` it gives 2 raiders. Fix: one test with two steps, literal 2.
3. **should-fix** `docs/system/mechanics.md:2813-2832`: the Realm audience is not stated (owner rule). The step takes no actor (occurrence id = cause id, good), but nothing says the spawn is once per world, seen by everyone in `home`, or that the once-per-cycle fact must be instance-scoped. Scenario: a player-scoped `raided` in a Realm spawns again in the same full moon when another player's advance crosses the hour. `birthSlot` binding sight by `world.body` (`settle.ts:126`) is inherited, not new; the composition record's Reads should list it.

## PM ruling 1 (target 0): size

More than schema plus genesis. Genesis needs no code (`initialOps` count 0, `genesisSlots` writes generation-0 rows). Needed: `protocol/cartridge.schema.json` `minimum` 0 on both targets and contracts regen; a 1.84 floor for a 0 target in both loaders (else a cartridge claiming 1.83 loads only on 1.84), with invalid/loader twins; cartridge.md and the Known-limits sentence. Finding 1 applies to such a plan.

## Fix round (3084ce7, on 809b8ff), partial: the PM stopped it

Verdict: **CHANGES REQUIRED**. The recheck is partial: the floor mutants and CI were not run.

- Disposition 1(b) holds. Probe on contexts 3d4e/1111/2222/3333, with both the full moon from 100 and the target-1 chance-100 probe. For every context, a single 0->400 advance gives the same raiders and rooms as an hourly 0->400. The shipped sampler's 0->1000 single advance births 1 raider with no fault. `raid.test.ts` passes (exit 0).
- Disposition 2: the two-spawn test exists (`kernel/ts/test/raid.test.ts:139`). I did not rerun the `taken` mutant.
- Dispositions 3 and 4: the spec text is present (809b8ff). Both kernels have a 1.84 floor for day_target 0 (`cartridge_population.ts:19-29`, `population.ex:59-79`). Floor mutants were not run.
- 1(a), occurrence_id = member id. This is sound for the kernel. The schema pattern is the same as for an entity id. Origin equality compares only a child with its holder (`creation.ts:79`, `invariants_creation.ex:209`). Elixir does not compose births. A mobile cold reopen of the raid sampler after 0->1000 with one spawned raider opens with equal state.
- **New blocker** (`react.ts` spawn -> `birthSight`, settle.ts). Scenario: a Chapter 1 copy whose reaction spawns into the oak_deer sight plan while the player stands in its home. Result: the mobile cold reopen is `save_corrupt`. Cause: the sight job's cause_id is the member id, and `deer-save.ts` `populationCause` requires `jobCommandId(population job, seen_at)` plus a population job.complete in the same writer group. The control (no spawn reaction) opens with equal state. The same failure was present at 9697574, where cause_id was the event id. Minimal fix: spawn skips `birthSight` (a birthSlot flag; the next entry binds sight). Alternatively, deer-save accepts the spawn cause.

## Fix recheck, rounds 1 and 2 (head 4a9aef32, base 6642e7c1)

Verdict: **APPROVE WITH NOTES**. Written 2026-10-14 UTC in Claude Code by anthropic/claude-opus-5-5 (fresh reviewer; scoped recheck). Hosted CI `ci` and `book-e2e` on 4a9aef32 were in progress at review time.

- Round 1, findings 1-3: the dispositions hold at the head. The round-2 diff (908cf6ff..4a9aef32) leaves `held`, `taken` and the highest-free-slot order unchanged; `raid.test.ts` passes 8/8.
- Round-2 blocker (birth sight on spawn): fixed. `react.ts:34` passes `sighted` false and `settle.ts:101` skips `birthSight`. A spawn now writes no sight op, so two spawns and a spawn while engaged write no sight either. The only other sight writers are `arrivalSight` (wander; a spawned member is `held`) and `entrySight` (player entry, plan-job cause). The red control is real: with the `, false` dropped, `deer.test.ts` "reaction spawn into a sighted plan" fails with `save_corrupt` (1 fail, 14 pass).
- Re-entry probe (scratch copy of the new deer test, then moves `east`, `west` back into `willow_shade` at 68400): slot 2 (the spawned member) binds a pending sight with `cause_kind` `player_entry`, and the cold reopen still opens with equal state. So the fix does not move the fault to the next entry.
- Base note: 6642e7c1 is not an ancestor of the head; the merge base is b80dbf71. The tracked `kernel/ts/node_modules` link comes from b80dbf71, and the slice does not touch it, so a merge keeps batch-m12's untrack.
- Open item (a): `mechanics.md:2825` Known limits says "a spawned member never wanders". Sight on a later entry is stated in Step (`:2817`), not in Known limits. See nit 2.
- Open item (b): probed. On origin/main 9c20b15a, the deer fixture without a spawn, after the moves south, south, west, a single `elapsed` from 64800 to 68400 returns `{"kind":"fault","code":"conflicting_write"}`. The head gives the same result. The comment at `deer.test.ts:169` is backed. This is a pre-existing Chapter 1 bug and no Beads issue tracks it; the PM should file one.
- Realm seams: line 2 holds (`spawn` takes no actor; with no birth sight it no longer reads `world.body`). Line 5 holds (`mechanics.md:2820`).
- Mutants (each reverted with `git checkout`): `react.ts` `, false` dropped: killed (deer test). TS floor `cartridge_reactions.ts:37` 84 to 83: killed (raid test g, now with targets 1). Elixir floor `reactions.ex:88` 84 to 83: killed (`content_raid_test.exs`, compile returned ok). `react.ts` `&& !taken(slot)` dropped (the round-1 survivor): killed (`raid.test.ts` "a rule with two spawn steps").

Findings:
1. **should-fix** `protocol/reaction.schema.json:645` (and the generated `contracts.gen.ts`): the step's description still says "in the lowest slot up to cap". Since 3084ce75 the step takes the highest free slot. Scenario: an author who relies on the contract expects slot 1 and collides with the plan job's birth order. Fix: say "highest", then regenerate.
2. **nit** `docs/system/mechanics.md:2825`: Known limits should also say that a spawned member binds sight only on a later player entry, so a player standing in `home` gets no flight until they leave and come back.
3. **nit** `deer.test.ts:169`: "(open item)" cites nothing. Cite the Beads id once it is filed.
