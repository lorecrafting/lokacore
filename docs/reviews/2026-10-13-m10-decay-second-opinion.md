# Review: m10 decay (row 41) writer-group join, second opinion

- Branch `toolbox/m10-decay`, exact commit `2d8352b6bf9806bf13cc4872c0e875149701718c` (parent `f94fbcb8`); Beads `loka-kgd.121`. Second opinion because `kernel/ts/src/runtime/proposal.ts` changed ([WORKFLOW Review count](../WORKFLOW.md)); scope: the writer-group change only.
- Governing: [protocol.md Composition](../system/protocol.md#composition) (a second group on a written target faults `conflicting_write`), [mechanics.md schedule@1 job groups](../system/mechanics.md#schedule1-behavior1-calendar1-mechanicsschedulerulets-kerneltssrcmechanicsschedulebehaviorts) (sub-steps in the job's group; lowest-group merge, loka-x2gv), [G3 Tick](../system/mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3), [Replenish](../system/mechanics.md#replenish-toolbox-row-19b), [Decay](../system/mechanics.md#decay-toolbox-row-41).
- **Verdict: CHANGES REQUIRED** (one test missing; code sound).

## Must be true (written before the diff)

1. A spoil `item.move` and a later replenish move of the same item in one advance compose in order; nothing else stops faulting.
2. Writers the join does not cover (root group 0, crow, death drops) keep `conflicting_write`; no job completion lands in group 0.
3. Status, bleed, round, crow, schedule, population, wage, co-move and sleep keep their group choice; a replenish crossed sub-step stays in its job's group.
4. Same input, same groups; no Elixir twin may diverge.

## Evidence

- Focused set at head (25 files: decay, replenish, writer_groups, status*, bleed*, crow*, population, hireling, group, sleep, elapsed, fear, fire, reactions): 157 pass. deer, d9_suppression, showcase_combat (conflict-still-faults cases): 38 pass.
- 2, 3: for every non-replenish kind `statusGroup` (`status/job.ts:162-167`) yields the same bodies as before; with `prior` set (population partners, schedule/wage/population crossed hours) it returns `undefined`, so `group = prior` as before. Status jobs on an item a replenish moved now join its group (ordered; no shared target). Group 0 is never in `p.holders`.
- 4: TS only (Elixir has compose, no proposal). The single wait run twice gives identical ops; all fish, job and status writes in group 1.
- Mutants (decay, replenish, writer_groups, status_composition, npc_status): M3 replenish branch `[]` red; M5 old group choice red (both the developer's red controls, rerun); M1 drop `found.add(also)` green (no shared target across crossed sub-steps; equivalent); M4 drop `holders.set` in moveItem green (equivalent here: a job's status-event subject is already in `holders`); **M2 `writer_group = group` keeping the set: green**.

## Findings

1. **blocker** `kernel/ts/src/mechanics/containment/react.ts:24`, untested. M2 passes the suite, but a legal spoil rule `[item.move midden, status.apply spoiling]` with one wait of 90000 then faults `conflicting_write` (status row in the status group, re-apply in the delivery group); head accepts it (scratch probe). Fix: one decay test with that rule edit, asserting acceptance.
2. **nit** `docs/system/mechanics.md:686` says a replenish joins "an earlier write of the advance" to the item; it joins only `holders` groups. Scenario: a duration recipe moves an item into the reserve in group 0, then the replenish run moves it: still `conflicting_write`, correctly (joining 0 breaks `job_complete_owned_by_run`). Say "an earlier status, `item.move` or replenish write".
