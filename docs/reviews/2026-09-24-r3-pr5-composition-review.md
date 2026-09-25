# Review: R3 PR 5, StateDelta composition and invariant checks in both kernels

- PR: [#15](https://github.com/lorecrafting/lokacore/pull/15), branch `r3-pr5-composition`
- Commit reviewed: `9131dbe`
- Reviewer: fresh Fable session (design-judgment review: the slice fixes composition
  semantics later slices depend on); authored none of the work.
- Spec read first: 14 §R3A and Gate R3; 04 §5.0 to §5.5; 03 §14, §15, §23; 01 A9;
  ROADMAP verification harness; proposed ADR-072; PR #13's record (notes addressed to PR 5).

## Verdict: APPROVE WITH NOTES

Both kernels implement 04 §5.1 to §5.4 the same way, the fixtures are consistent with
hand derivation from the spec, and 27 of 29 mutants die. Two should-fix items, neither a
semantics change: a surviving budget mutant in both kernels (a test gap) and a PR 3 example
that contradicts 06 §1. Nothing needs the owner.

## Requirements derived before reading the diff

1. `compose(state, delta)` is pure and applies ops in the delta's order to an overlay over
   the base; every precondition reads the overlay; the base is never copied (04 §5.1,
   §5.2 step 4; ADR-072 items 2 to 4; AGENTS.md Performance).
2. The canonical MutationTarget is the identity. A second writer group on a target already
   written faults `conflicting_write`, with no last-writer-wins and **no same-value
   coalescing** (04 §5.3 fact row: "repeated independent assignments conflict… No implicit
   same-value coalescing"). One group may make successive legal writes.
3. Preconditions are exactly `delta.schema.json`'s: fact expected value (default when
   unset); transfer source, acyclic, capacity, with capacity counting the overlay
   (03 §23; 04 §5.3); quest activate/legal 06 §1 transition/outcome; choice pending,
   offered, opened revision; job exists, due strictly later than now or than the advance
   target (04 §5.4); `job.complete` against the visited time (PR #13 F5); clock `from`,
   `to > from`.
4. Budgets fault the whole delta (04 §5.2 step 7, §5.4, composition-profile.json); the
   first fault in op order wins; a fault carries only an `evaluation_fault` code and a
   target, in PR 3's frozen DecisionResult shape, and no proposal.
5. Output is the changed rows (the host commits only these, ADR-072 item 3) in an order that
   does not depend on map iteration (more than 32 rows, AGENTS.md); canonical bytes identical
   across kernels.
6. Proposed DomainEvents are observable only as CommittedEvents after a confirmed commit:
   none after a failed commit, an unknown outcome (03 §15), a rejection or a fault
   (04 §5.1; Gate R3).
7. A pure check by id for each `r3_pr5` invariant, each with a holding and a violated
   fixture; expected values hand-written, never computed by either kernel.
8. No PR 3 contract shape changes; the error registry only grows.

## Findings

### F1 (should-fix) `lib/loka/core/compose.ex:91`, `kernel/ts/src/compose.ts:95`: the pending-jobs budget arithmetic is untested

`pending + created - due > pending_jobs` credits completions in the same delta. Mutant
"drop `- due`" (`pending + created > …`) survives in **both** suites (Elixir 5/5, TS 4/4):
the budget test schedules against a full queue but never completes and schedules in one
delta. Failure scenario: an advance that completes 3 due jobs and schedules 3 follow-ups on
a queue at the limit faults `budget_exceeded` under the mutant, and no test notices. Fix: one
line per test file (queue at `pending_jobs`, one `job.complete` plus one `job.schedule`
composes), or a fixture case.

### F2 (should-fix) `protocol/delta.schema.json` `DeltaOp.examples[2]`: a PR 3 example contradicts 06 §1

The example shows `quest.transition` `active → resolved`, which the kernels (correctly)
reject: 06 §1 is normative (spec README §8) and draws `active → objectives_complete →
resolved(outcome_id)` with `resolved` reachable only from `objectives_complete`; the
schema's own description says "a legal 06 §1 transition". An example is not a shape, so
editing `"from"` to `"objectives_complete"` is within this PR's rules (or PR 6b's tidy
pass). Failure scenario: a rule author copies the example and every activation-to-resolution
faults.

### N1 (nit) `kernel/ts/src/compose.ts:171`: capacity scan runs without a capacity

`rows('containment', …)` allocates all container entries on every transfer; the Elixir twin
(`compose.ex:228`) only scans when the destination has a capacity. On a phone that is an
O(containers) allocation per transfer for nothing. One-line reorder: read `cap` first.

### N2 (nit) `lib/loka/core/compose.ex:11`: the clock is required but not stated

A base state without `"clock"` diverges: Elixir compares `due <= nil` (number < atom, true)
and faults `nonfuture_job`; TypeScript compares `<= undefined` (false) and schedules.
Confirmed with a probe. The TS type requires `clock`; the moduledoc lists it under "absent
sections are empty". Out of contract, so a nit: say the clock is required (or have both
kernels fail closed on a missing clock).

### N3 (nit) `lib/loka/core/invariants.ex:49`, `kernel/ts/src/invariants.ts:84`: `delta_preconditions_hold` checks less than its name

It checks the read-value → written-value chain per target only (no capacity, revision,
cycle or time bound). That is a sensible independent check (not a second compose), but the
registry statement says "every delta op's precondition". A one-line note in the moduledoc
(or the statement) stops the R5 simulator from reading it as full coverage.

### N4 (nit) merge conflict ahead with PR #14

Both PRs edit `bin/contracts.exs` and `kernel/ts/src/contracts.gen.ts`. Whichever merges
second must regenerate with `elixir bin/contracts.exs` rather than resolve the generated
file by hand. PR #14's optional `narration` field on the accepted branch does not touch
anything this PR reads.

## Verification

- `bin/check_all.sh` at `9131dbe` in a detached worktree: exit 0 (94 ExUnit, 32 TS tests,
  contracts drift, xref, Credo, size, red controls, ast-grep, docs, Prettier, mobile tsc).
  CI green on all five jobs (PM verified; rechecked).
- **Reviewer differential**, independent of the developer's generator: 3 seeds × 708 cases
  through both kernels (Elixir via `mix run`, TS via the PR's peer), comparing canonical
  bytes of results and the six compose invariants. Inputs the developer's generator does not
  produce: states with 40 to 70 containers and 40 facts (over the 32-key map boundary),
  containment chains 60 deep with transfers into ancestors, cyclic base states, up to 40
  writer groups, 40 to 45 ops per delta, chains of 35 same-group `time.advance` ops,
  `fact.assign` with and without `subject_id` over three scopes, every quest transition with
  and without `outcome`, open-then-resolve continuations, jobs due around the advance
  target, and the budgets at limit and limit+1 for `operations`, `created_jobs`,
  `pending_jobs` and `due_jobs_per_advance`. All 2,124 cases byte-identical; every fault
  code and 0 to 40-row results occurred. Only `containment_acyclic` returned false, and only
  on my deliberately cyclic or over-capacity base states, which is the correct answer.
- **Mutants** (each run in the throwaway worktree, then reverted; `mix test --force`):
  Elixir 16 (conflict check inverted; sort removed; advance target ignored; capacity `>=`
  → `>`; legal table admits `active → resolved`; fact default ignored; op budget off by
  one; resolve ignores revision; escape invariant ignores commit status; `job.schedule`
  bounds on the base clock; pending budget ignores completions; activate ignores an open
  instance in scope; `subject_id` dropped from the fact target; `no_last_writer_wins`
  always true; `job.complete` ignores due time; outcome rule dropped): 15 killed, **1
  survived (F1)**. TypeScript 13 (conflict check removed; sort reversed; advance target
  ignored; cycle check removed; pending budget ignores completions; escape invariant
  ignores commit; capacity `>=` → `>`; resolve ignores revision; legal table admits
  `active → resolved`; fact default ignored; `subject_id` dropped; `job.complete` ignores
  due; activate ignores open instance): 12 killed, **1 survived (F1)**.
- Fixtures: the 56 cases, 5 publication cases and 30 invariant observations read as
  hand-derived: op lists are written in reverse id order with expected rows ascending
  (`changes-sorted-by-target-over-32-rows`, 40 rows), the expected row order in
  `explicit-sequence-across-kinds` is the canonical-text order (`choice` < `containment` <
  `fact` < `instance_id` < `job_id`), and each failure case's code follows the delta schema's
  wording. No expected value passes through either kernel (stdlib JSON in both tests).

## Brief questions, technical view

1. **Semantics vs 04 §5.1 to §5.4.** Overlay reads: every precondition goes through
   `read/2`, overlay first (verified by the "overlay read bypassed" mutant in the PR's own
   sweep and by my overlay-dependent cases: capacity freed and cycle formed inside the
   overlay). Identical-value conflict: **that is the spec** (§5.3 fact row quoted above;
   "a future idempotent ensure operator needs its own contract"). Ordering: ops in delta
   order, rows by canonical target text, never map order. `job.complete` during an advance:
   the kernels use the advance target as the visited time for every completion; that is
   equivalent to F5's "the job's visited due time" for eligibility (a job is in the due set
   iff due ≤ target), and the `job.schedule` bound is the target as §5.4 requires (fixture
   `job-schedule-inside-advance`). Budgets are checked before any op, then first fault in
   op order with conflict before precondition; consistent in both kernels and pinned by
   `first-fault-in-op-order`. Out of scope and correctly left to the coordinator (R5/R6):
   ordering due jobs `(due_time, job_id)`, running final invariants at step 7, and the
   per-writer-group identity assignment.
2. **Elixir/TS divergence.** None within contract (above). One outside it (N2).
3. **Fixtures hand-derived.** Yes, on the evidence above.
4. **Commit-boundary model.** `publish/2` in `compose_test.exs:54` is four lines: publish
   the accepted decision's events as CommittedEvents only when the commit status is
   `committed`; else nothing. The fixtures cover committed, failed, unknown, rejected and
   fault, with hand-written `published` lists, and the invariant's violated cases (published
   after failure, while unknown, bare, wrong revision) show the check detects each escape;
   the "ignore commit status" mutant dies in both kernels. That is what Gate R3's fixture
   clause asks for. It proves the rule and the detector, not a host: the host does not exist
   until R6, where the fault simulation must run this invariant on real failed and unknown
   commits (ROADMAP harness). Sized right for the slice.
5. **Performance.** No whole-state copy in either kernel: the overlay holds only written
   targets, reads are by key, and rows are sorted from the overlay. Per-op work is
   O(target text) plus the two marked linear scans; `overBudget` scans the jobs section
   once per compose. `put` spreads one row (small). N1 is the one asymmetry.
6. **CI Node step and the shell-out.** The step copies the other jobs' pinned
   `setup-node` line exactly; the Elixir test calls `node` on the PR's 13-line peer, which
   imports only kernel source (no `npm ci` needed; Node 24 strips types). A missing `node`
   fails the test with a clear `enoent`. Minimal.
7. **Generator.** `EVALUATION_FAULTS` and `LIMITS` are emitted from the registry and the
   profile; the Elixir kernel reads the same two files at compile time
   (`@external_resource`, the pattern `contracts.ex` already uses). Drift is caught by
   `contracts.exs --check`. Sound single source.
8. **Over-engineering.** Little. `Compose.key/target` are public because the invariant
   twins need them. The two shape-only invariant checks (`fault_discards_whole_proposal`,
   `fault_codes_are_evaluation_faults`) are thin, but each id in the registry needs a check.
   Nothing to delete.
9. **Astra AQ2 (nominal Elixir ids).** The PR adds no structs; state and ops are canonical
   JSON maps read by string key. Keeping AQ2 with gate PR 6b is right; it applies when a
   typed layer above these maps exists.

## The PR's open questions, in plain language for the owner

None of these needs an owner decision; the spec already answers them.

1. **Can a quest skip "objectives complete"?** The rulebook (06 §1, a normative document)
   says no: a quest goes active → objectives complete → resolved. The example that shows a
   skip is in a PR 3 schema file, and examples are illustrations, not rules; it is simply
   wrong and should be corrected (F2). The code follows the rulebook. If the owner ever
   wants skipping, that is a spec amendment, not a code change.
2. **Retrying a failed or abandoned quest.** The rulebook says "only if retry policy
   permits". The composition layer cannot see the policy, so it lets the transition through
   and the rule that proposes it must check the policy. That is the right split; a fixture
   pins it (`quest-retry-clears-outcome`). Technical, no owner input.
3. **Where the advance target comes from.** The delta says "advance time from 6 to 19", and
   compose uses that 19 as the bar new jobs must clear. Reading it from the delta itself is
   simpler than passing it separately and cannot disagree with the delta. Technical.
4. **Fact defaults and capacities in the base state.** Kernel-internal for now; it becomes a
   contract when R6 defines the persisted rows (ADR-072 calls that an R2+ design task) and
   FactSpec (PR 4b) supplies defaults. Decide then, not now. Technical.
5. **One "budget exceeded" code.** The frozen fault shape has only a code and a target;
   which budget was hit is a diagnostic (04 §5.5) that the evaluator can add when it
   exists. One code now, split later if needed. Technical.
6. **Linear scans.** Fine for the Lantern's world size and marked `ponytail:`; an index is
   the upgrade if a cartridge grows. Technical.

## Disposition needed

F1 and F2 are one-line fixes each; nothing else is open. With them landed this record can
close at APPROVE.
