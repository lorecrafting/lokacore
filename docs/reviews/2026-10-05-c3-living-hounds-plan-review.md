# C3 living Fen hounds — independent planning review

Reviewed exact planning head `8413ef168db91fc0a08151a61af3f1f9e5965521`,
base `98cc60b1647d031eed790ca085681bbe62af9d73`, 2026-10-05. PR: null.
I authored none of the planning documents. **Verdict: CHANGES REQUIRED.**
C3-P1 is open. This is a plan review, not implementation or runtime proof.

## Governing requirements

Derived before reading the diff from the [PM adoption](../decisions/pm-decision-c3-living-hounds-2026-10-05.md),
[population](../system/mechanics.md#c3-bounded-living-hounds-selected-contract),
[parameters](../system/cartridge.md#c3-hound-population-and-loot),
[composition](../system/protocol.md#c3-spawned-bundles-and-population-composition),
[save](../system/save.md#c3-living-population-recovery),
[Book](../system/book-ui.md#c3-living-hound-and-loot-details),
[brief](../briefs/chapter-one/chapter-one-c3-living-hounds-brief-2026-10-05.md)
and adopted [C1 combat](../decisions/pm-decision-c1-tobin-training-2026-10-05.md):

- Six bounded slots and one current plan job retain living dawn surplus; each dead
  slot independently respects its delay and night-only eligibility.
- Exact per-instance HP, fresh checked hound/pelt identities and conserved public
  corpse loot survive replay, replacement and lawful later custody.
- Ordinary due ordering, writer conflicts, shared budgets and atomic save adoption
  remain valid, including simultaneous population and combat deliveries.
- Deliberate fights, immediate loss recovery and first loot proof need no respawn,
  night, new Wait or required equipment gate. C4 behavior stays separate.
- Literal controlled answers, corruption/fault/reopen controls and later consumers
  prove new semantics; browser evidence does not substitute for real SQLite proof.

## Finding

**C3-P1 — blocker — whole-plan mutation conflicts at a fatal due boundary.**
At the reviewed head, `docs/system/protocol.md:687`–`:689` selects a full-prior
population-row transition/mutation target containing both slots and current job.
`docs/system/mechanics.md:1023`–`:1025` puts fatal replacement eligibility in the
combat round's writer group, while `:1039`–`:1045` makes the due population job
advance that same row's current-job/wander binding. Existing
`kernel/ts/src/runtime/proposal.ts:288` assigns a different writer group to each
due job; `kernel/ts/src/foundation/compose.ts:63` rejects a second group writing
one target even when it reads the previous group's result.

Concrete controlled case: use calendar24×10, wander10, delay240, houndHP6,
playerHP10, zero recovery, accuracy100, fixed player3/NPC1, no defenses and round
interval5. Attack H1 at200. Round205 leaves player9/H1=3; at210 round2 must leave
player8/H1=0, transfer L1 to one corpse and set replacement due450. The population
job is also due210 and must advance its binding/wander boundary. The proposed
whole-row target is written by both groups, so either job-ID order faults the
entire elapsed segment instead of committing that lawful result. Retrying the
same clock boundary repeats the fault and prevents catch-up/player continuation.
Suppressing engaged movement does not remove the population job's row write.

Declare a conflict-safe population mutation/dispatch contract while preserving
ordinary cross-writer refusal, fatal atomicity and canonical equal-time ordering.
Add this equality case in both job-ID orders to controlled acceptance, including
cold reopen/receipt retry and a red control for the chosen guard or composition
rule. No broader scheduler redesign is requested.

## Other checks and simplicity

The selected4/6 eligibility and retained surplus, never-used versus dead slots,
extra-slot due550→night680 case, paired template-only creation, dynamic victim
selection, post-Take custody and historical HP0 victims are coherent. The route
keeps passive hounds off required story/recovery corridors, supports adjacent Scan
now and assigns C4 aggression/assist/flee separately. Genesis/receipt bindings,
real failed/unknown COMMIT variants, lost acknowledgement, corruption refusal,
30-day boundary samples and independent literal/mutation obligations are explicit.
Dependency integration and successor pins correctly remain gates before source GO.

Read the changed planning documents, installed clock/combat/death/custody/save
clauses, C1 contract, workflow and relevant mechanics/storage/contract lessons.
`git diff --check HEAD^ HEAD` passes. A pinned Node24.21.0 probe of the existing
portable composer confirms different-group writes to one target return literal
`conflicting_write`; a same-group control composes successfully. This verifies the
existing conflict premise, not unimplemented C3 behavior. No source edits, runtime
C3 tests, mutations, browser/native sessions or full publication checks were run.
The normal review-record hook result accompanies the handoff.

Ponytail Review: Lean already. Ship. Fixed slots and one owned job have a real
population/fight/loot consumer; no per-beast scheduler, ecology framework,
additional receipt ledger or speculative loot consumer is selected. C3-P1 needs
a narrow composition decision, not extra machinery.

## Scoped fix recheck — round 1

Reviewed exact fix `0127bf4c9c02f944941008d3962982c1144fd2e2` against
`8413ef168db91fc0a08151a61af3f1f9e5965521`. **Final verdict: APPROVE.**
C3-P1 is closed; the initial CHANGES REQUIRED verdict above remains historical.
This approves the corrected plan, not source GO or executed implementation proof.

The six changed documents separate plan control from fixed ordinal slot targets,
with a complete-prior comparison per row and no duplicated membership index.
Fatal combat changes only its exact victim slot. Population dispatch changes control
and actual birth/replacement slots, refusing no-op rewrites of unchanged slots.
Thus combat-first records H1's future due450 and population skips that slot;
population-first skips the still-engaged H1 and fatal combat then changes its slot.
Other living hounds may move in either order without touching the fatal slot.
Canonical job-ID order, distinct groups and ordinary same-slot conflict refusal
remain intact; there is no grouping or priority exemption.

The compiler/loader period guard closes the adjacent scheduling concern: the
current job is at or before the next wander boundary, at most one wander interval
away. Requiring that interval <= replacement delay means a new death cannot need
an earlier control write. Equality is explicitly admitted; wander241/delay240 must
refuse, and removing that guard must make the invalid-plan test fail.

The brief freezes the round205 and210 HP/RNG, fatal slot due450, same L1 corpse,
unchanged H2–H6 identities/pelts, nest movement and one successor due220 answers.
It requires both orderings from actual allocated IDs, reopen/replay and failed/
unknown COMMIT controls. The no-op-slot mutant must fail both orders, and two
otherwise valid different-group writes to one slot must retain literal
`conflicting_write`. Both foundations must independently match literal split-target
answers. These are concrete implementation obligations, not claimed runtime proof.

Scoped diff whitespace validation passes. No source or runtime mutation work applies
to this docs-only recheck. The normal record commit hook supplies documentation
validation. Ponytail Review: Lean already. Ship. The split uses the existing writer
model, keeps one job and adds no membership ledger or scheduler framework.
