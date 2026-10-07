# D8 save, protocol and foundation second opinion

PR [#258](https://github.com/lorecrafting/lokacore/pull/258), exact reviewed source
`41e86ee7bd0ca71368fcfeaa92e8a5b1f0b61972` against published D11 main.
Fresh independent reviewer; authored none of the source. **CHANGES REQUIRED**.

## Requirements derived before diff

The [D8 brief](../briefs/chapter-one/d8-crow-scavenge-brief-2026-10-05.md),
[protocol composition and D8](../system/protocol.md),
[D8 save contract](../system/save.md#d8-crow-coin-and-nest-recovery-selected-planning-contract)
and AGENTS require exact item custody, phase/generation-bound jobs, checked CAS,
independent portable invariants, both-kernel agreement, changed-row-plus-receipt
atomicity, explicit mismatch/corruption refusal and unchanged frozen fixtures.
Replacement crows remain valid consumers. Browser proof is separate from SQLite.

## Findings

- **D8-S1 — blocker:** `kernel/ts/src/runtime/invariants_population.ts:50` and
  `lib/loka/core/invariants_population.ex:46` reject lawful replacement acquisition.
  After a participating crow dies, its occurrence is idle with the old member and
  generation. The replacement member's next Drop creates idle→acquire with its new
  identity/generation. Both composers explicitly allow that transition, but both
  independent invariants demand the old member/generation even from idle.
  Controlled reproduction: take fixture `bind-exact-crow-and-coin`; use its value
  as the prior row with phase `idle` and all five nullable fields null; make the
  acquisition value use member `99999999-9999-4999-8999-999999999999`, generation2.
  Both kernels compose successfully and report `delta_preconditions_hold=false`.
  Align the invariant's idle exception with the lawful replacement contract and
  retain a literal cross-kernel regression for this case.
- **D8-S2 — blocker:** `kernel/ts/src/foundation/compose_job.ts:48` accepts an
  unbound population-bundle job that the Elixir kernel rejects at
  `lib/loka/core/compose_encounter.ex:237`. From fixture
  `schedule-phase-bound-crow-job`, remove `crow_member_id`, `crow_generation`
  and `crow_phase`. The resulting DeltaOp passes wire validation. TypeScript
  creates the pending job; Elixir returns `precondition_failed`. TypeScript only
  dispatches the crow check when a crow field exists, while Elixir also checks
  `job.kind == population_bundle`. Check the semantic job kind in the TypeScript
  composer and independent invariant, with a literal shared refusal case.

## Independent checks and limits

- Focused kernel crow/composition and real-SQLite crow suites: **21 passed**.
  Inspected exact cold-held/drop/corridor/delivered/return/death rows, same-invocation
  replay, genuine deferred-constraint failed COMMIT, lost acknowledgement and the
  forged-phase refusal retaining stored rows. Host transaction code is unchanged.
- Elixir crow composition and active chapter compiler suites: **15 passed**.
- In detached throwaway source, removed the crow CAS expected-row guard:
  existing `stale-crow-job-cas` fails with an unexpected successful write.
  Restored exact source; composition suite **4 passed**. No mutant committed.
- Reran retained schema guard sweep: **57 killed, zero survivors**; source subset
  **11 rejected, zero survivors**. These checks pass but do not cover S1/S2.
- Regenerated the independent Python v039 oracle: unchanged files, API1.34,
  hash `e604180806f19b6afa9ca2dc1e69e663c0c4057f8f7f04c5a42560d4289d94a3`,
  208 initial IDs. Diff only adds new fixture files; no frozen fixture modified.
- Proposal adoption extraction preserves its checks, atomic fault result,
  writer-group ordering and final proposal budgets. No new abstraction or
  dependency justified removal in this scoped Ponytail Review.

Hosted green checks on the exact head were supplied by PM; this review does not
recertify hosted CI. The brief's complete intermediate-save matrix is broader
than the five focused SQLite tests above. Full-nest fallback, carrying refresh
and Shoo browser closure remain pending at this source. No browser, E1–E3 or
publication certification is granted. Owner save untouched; native work paused;
UI blur remains deferred. This record is committed separately for PM integration.
