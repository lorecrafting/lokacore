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

## PM-requested adjudication of the Astra review (at `9131dbe`)

Astra's cross-vendor review (relayed by the owner) returned CHANGES REQUIRED with A1 as a
blocker. Dispositions, with the evidence the PM asked for:

**A1 (Astra: blocker) — `job.complete` compares against the advance target, not the visited
time.** *Disagree that compose is where this is decided; agree there is an unregistered
obligation, and I correct my own record.* Astra's scenario is real: clock 6, J10 due 10,
J19 due 19, advance to 20; a reaction running while J10 is visited (time 10) proposes
`job.complete(J19)`, and both kernels accept because 19 ≤ 20. The frozen shape carries no
per-op visited time, so compose cannot tell that op from J19's own completion; my earlier
"equivalent for eligibility" holds only under an obligation I did not state: **`job.complete(J)`
is proposed by J's own `run_job` root sequence, at J's visited due time, and by nothing else.**
That is what the frozen description already says ("Consume a due job occurrence when its
run_job commits", delta.schema.json:375) and what 04 §5.3 means by content not forging
"engine-owned … completion … evidence"; the composition profile adds "capability emission
permissions fail closed". Under it, the visited time at the only legal `job.complete(J)` is
J's due time, `due ≤ visited` is `due ≤ due`, and compose's `due ≤ target` is the remaining
check: membership in the advance's snapshot ("up to the requested target", §5.4). A reaction
that wants J19 not to run uses the cancel op §5.4 names ("cancelled, completed or
rescheduled"), which is not in the shape yet. Sizing the alternatives: a per-op
`visited_time` is a PR 3 shape change and hands content a field to forge; an extra compose
input (job → visited time) still trusts the coordinator that supplies it, so it buys nothing
over the obligation itself. **Smallest change, land now:** one data row in
`protocol/invariants.json` (for example `job_complete_owned_by_run`, citation 04 §5.4 and
delta.schema.json `job.complete`, `implemented_in: r5`) so the R5 coordinator slice must
enforce and test it, plus one sentence in the `job.complete` description ("proposed only by
the job's own run_job"; a description, not a shape). Astra's requested fixture (an earlier
job completing a later occurrence must fault) cannot be written against the frozen shape and
belongs to that R5 invariant. Not a blocker for this PR.

**A2 (should-fix) — `delta_preconditions_hold` checks only the value chain.** *Agree on the
fact (my N3); defer the extension to the R5 simulator slice, add follow-up.* Its only
consumer today is the fixture run, where every frozen precondition is already pinned and the
mutants that weaken them die in both kernels (16 + 13 above). A check that re-implements
every precondition is a third compose; the harness deliberately trusts fixtures over
agreement. Do the one-line scope note now; extend the check (revision, offered choice, time
bounds, legal table, each with a negative observation) in the slice that gives it a consumer.

**A3 (should-fix) — the commit-boundary evidence is a truth table.** *Disagree for this
slice; defer the stateful model to R6, add follow-up.* Gate R3's clause is about the fixture
suite; the brief asked for the model to be tiny and in test code. The sequence Astra wants
("propose E, then a fault or a failed/unknown COMMIT, inspect what escaped, with adoption
history") is R6's fault simulation on the real local authority with real SQLite faults
(ROADMAP harness); a stateful fake host now is scaffolding R6 replaces. Agree that
`fault_discards_whole_proposal` is shape-only until state, receipt, RNG and time exist to
observe. Follow-up: R6's brief must run `no_proposed_event_escapes` and
`fault_discards_whole_proposal` against injected failed and unknown commits with observed
publication and adoption history.

**A4 (should-fix) — TS transfer materializes every containment row without a capacity.**
*Agree (my N1); fix as: read `cap` first and skip `rows()` when it is undefined,
`compose.ts:170-174`.* The bounded scan when a capacity exists stays a marked `ponytail:`.

**A5 (should-fix) — `containment_acyclic` is quadratic.** *Agree on the cost; defer to the
R5 simulator slice, add follow-up, unless the developer is already in the file.* The check
has no production caller and the simulator's states are Tiny/Medium; the fix is small (a
"proven acyclic" set makes the walk linear, about four lines per kernel), but its value is
measurable only when the simulator exists. Do not switch to affected-path validation; that
changes the invariant's meaning by assuming a valid base.

**AQ1 — budget preflight precedence and pending-prefix semantics.** *Agree; fix as two
fixture cases (folds F1 in).* No frozen text orders budget faults before op faults (04 §5.2
step 7 only says all three discard the whole proposal), so the precedence is a determinism
choice that both kernels make and no fixture pins: add an over-budget delta whose first op
also fails a precondition, expected `budget_exceeded`. `pending_jobs` is an admission bound
on the queue ("Admission also bounds pending jobs", §5.4), so the final-queue reading is
right; pin it with a queue at the limit, one `job.schedule` then one `job.complete`,
expected changes. That case kills F1's surviving mutant in both kernels. Astra's AQ3 point
that the at-limit asserts pass on any non-budget fault is fair; the same fixture answers it.

**AQ2 — derivation record for the fixtures.** No separate record exists; the evidence for
hand derivation is in "Verification" above (op order reversed against ascending expected
rows; canonical-text row order; stdlib JSON in both tests). Per A1, the fixture
`job-complete-at-visited-time-inside-advance` (J19 completing at target 19) is J19's own
completion and stays correct; no expectation needs correction.

**AQ3 — larger differential.** Done in this review (3 × 708 cases: 70-row states, 60-deep
chains, 40 writer groups, 45-op deltas, exact budget boundaries), byte-identical.

**Verdict unchanged: APPROVE WITH NOTES.** Open before APPROVE: F1/AQ1 (two fixture cases),
F2 (example edit), A4/N1 (one-line reorder), A1's registry row and description sentence.
Follow-ups to register for R5 (A2, A5, A1 invariant) and R6 (A3).

## Cross-vendor review (Astra), relayed verbatim by the owner

Reviewed commit `9131dbe`, independently of the review above. The PM checked A1 and A4 against the code before forwarding them: `job.complete` in `kernel/ts/src/compose.ts` compares `due_time` with `ctx.horizon` (the advance target), and `transfer` collects every containment row before looking at the capacity.

```text
VERDICT: CHANGES REQUIRED

FINDINGS:
A1 [blocker] kernel/ts/src/compose.ts:138 (at 9131dbe) — job.complete uses the advance's final target rather than the currently visited logical time; the Elixir implementation makes the same substitution — With clock=6, pending jobs J10 due at 10 and J19 due at 19, and an advance targeting 20, a reaction executing at visited time 10 can propose job.complete(J19). Both implementations accept because 19 <= 20, although the frozen precondition requires 19 <= 10. The API has lost the information needed to distinguish these executions. Keep the advance target as job.schedule's lower bound, but carry the current visited time separately for completion checks. Add an independently expected fixture where an earlier job attempts to complete a later occurrence.

A2 [should-fix] kernel/ts/src/invariants.ts:84 (at 9131dbe) — delta_preconditions_hold checks only a simplified value/status chain, not every declared operation precondition; the Elixir checker has the same omission — Given a pending choice opened at revision 3, choice.resolve(expected_revision=2), and an observation containing an incorrectly successful result, the invariant returns true because it checks only pending -> resolved. Similarly, a pending job due at 19 can be reported completed at clock 6 without this checker detecting the violation. The composer correctly rejects those ordinary cases, but the purported independent invariant does not detect a regression in that rejection. Cover freshness, offered-choice membership, due/future time, legal transitions and the other frozen preconditions with independently expected negative observations.

A3 [should-fix] test/loka/core/compose_test.exs:54 (at 9131dbe) — The commit-boundary evidence is a status-to-publication truth table, not an exercised composition/commit boundary — The test receives an already constructed decision and commit status, calls a test-only publish helper, and compares its output with a literal published list. It never runs the sequence “propose E, encounter a later composition fault or failed/unknown COMMIT, inspect everything that escaped.” An eager publication or adoption in that sequence would therefore remain outside this test. Relatedly, fault_discards_whole_proposal at kernel/ts/src/invariants.ts:95 checks result-object shape, not whether state, receipts, RNG or time changed. This is an evidence gap, not a demonstrated production leak. Add a small stateful boundary model with observed publication/adoption history, failure injection and unknown-outcome reconciliation; real SQLite fault testing can remain R6.

A4 [should-fix] kernel/ts/src/compose.ts:171 (at 9131dbe) — Every TypeScript transfer materializes the entire containment section even when the destination has no capacity limit — With 20,000 unrelated containment rows, moving one item between two root containers with no capacities still reads all 20,000 rows through rows(), allocates Object.entries/filter/spread arrays, and then discards the count because cap is undefined. The Elixir full? path skips this work when no capacity is defined. This is unnecessary O(N) allocation per operation, not structural sharing proportional to the changed paths. Check whether a capacity exists before collecting occupants; for bounded capacity scans, count through an overlay view rather than materializing the whole table.

A5 [should-fix] kernel/ts/src/invariants.ts:63 (at 9131dbe) — containment_acyclic copies the complete containment index and independently walks every entity's ancestry, yielding quadratic work; the Elixir checker also repeats the ancestry walks — A valid 10,000-row containment chain plus an empty delta performs roughly 50 million ancestor lookups merely to confirm that nothing is cyclic. This cost is not bounded by the delta-operation budget, and it exists even when no containment target changed. It will dominate a per-step invariant/simulation gate. Use a memoized/marked linear graph traversal for full validation, or affected-path validation only under an explicit already-validated-base contract. Avoid rebuilding the complete TypeScript index for each observation.

QUESTIONS:
AQ1 — What frozen rule establishes global budget preflight before all earlier operation faults, and is pending_jobs a limit on every proposal prefix or only the final queue? Currently, 1,024 pending jobs followed by schedule(new) then complete(old) succeeds because pending + created - due is 1,024, despite the intermediate proposal having 1,025 pending jobs. Specify that distinction and the first-fault precedence in reviewed fixtures rather than leaving them implicit in overBudget.

AQ2 — Is there a retained derivation/review record for protocol/fixtures/composition.json? The expectations are checked-in literals, and the tests do not call compose to generate them; I found no code-under-test expectation generator. That establishes how the tests consume expectations, not whether their original values were independently derived. In particular, expectations adopting the final-target-as-visited-time interpretation need correction, not merely confirmation that both implementations agree.

AQ3 — Can the seeded differential include large/deep states, more writer groups, and exact budget-boundary cases, while the boundary tests require successful changes rather than merely “not budget_exceeded”? The random generator currently uses 0–4 operations and groups 0–2; the forty-row literal fixture is useful but does not exercise those combinations. At-limit assertions can pass on an unrelated precondition/conflict fault. I did not establish a valid-input Elixir/TS byte mismatch; the logical defects above are shared. The full pinned dual-runtime suite was not executed in this review.

VIEWS ON THE PR'S OPEN QUESTIONS 1-6:
1 — Prefer the explicit active -> objectives_complete -> resolved lifecycle in 06 §1; reconcile the contradictory delta-schema example through a reviewed clarification rather than silently introducing a shortcut.
2 — Keeping retry-policy evaluation in the owning capability is reasonable only with a documented caller obligation and enforcement tests; composition's acceptance alone must not be described as proof that a retry is authorized.
3 — No: the requested advance target and currently visited logical time are different semantic inputs. Preserve that distinction as A1 describes; ordinary overlay reads, same-value cross-group conflicts and canonical row sorting otherwise look sound on the inspected paths.
4 — Keep fact_defaults/capacities and the indexed base representation internal for now, with explicit validated-input assumptions. Do not freeze an additional wire-state protocol before R5 supplies the real definition/state boundary.
5 — One public budget_exceeded code is acceptable only if deterministic diagnostics separately identify the exhausted budget and causal location. Do not invent fields in the frozen DecisionResult envelope or claim that a bare code satisfies 04 §5.5.
6 — Small, explicitly bounded linear scans can be an acceptable ponytail; unconditional whole-table allocation and quadratic ancestry validation are not. Cut those unnecessary costs first. The pinned Node setup in the Elixir CI job is the least that works for the existing native-TypeScript differential peer; no npm installation or additional orchestration is needed there.
```

## Re-review (fix round 1): `2812a71`

Scope: the fix commit only (the PM's list: F1+AQ1, F2, A4/N1, A1, N2, N3), the code each
fix touched and its direct callers. `bin/check_all.sh` at `2812a71` in a detached worktree:
exit 0 (94 ExUnit, 32 TS, contracts drift check included).

- **F1 + AQ1, fixed.** Two fixture cases, states `full_queue` (1,024 pending) and `base`:
  `pending-jobs-bound-is-the-final-queue` (schedule then complete on a full queue → two
  changes; pins the final-queue reading) and `budget-before-first-op-fault` (65 schedules,
  the first on a job that already exists → `budget_exceeded`, not `precondition_failed`;
  pins precedence). The at-limit budget asserts now require the expected changes (clock at
  6 + 4096; 64, 1 and 1,024 rows) instead of "not budget_exceeded". Mutants: drop `- due`
  now dies in both kernels (Elixir 4/5, TS 3/4); "budget checked after the ops" dies
  (Elixir). No existing case changed.
- **F2, fixed.** `delta.schema.json` example `from` is `objectives_complete`. The only
  drift in `contracts.gen.ts` is the two description strings; no shape change
  (`contracts.exs --check` green).
- **A4 / N1, fixed.** `compose.ts:172` returns before `rows()` when the destination has no
  capacity; the capacity branch is unchanged. Mutant "missing capacity treated as zero"
  dies (TS 3/4).
- **A1, fixed as agreed.** `protocol/invariants.json` gains `job_complete_owned_by_run`
  (04 §5.4, `implemented_in: r5`); the `job.complete` description says it is proposed only
  by the job's own run_job at its visited due time. Data and description only.
- **N2, fixed.** Both kernels fail closed on a non-integer clock with `precondition_failed`
  on the clock target, before the budget check; fixture `missing-clock-fails-closed` (state
  `no_clock`). Mutant "clock guard removed" dies in both kernels. My clockless probe now
  gives identical bytes in both kernels.
- **N3, fixed.** One scope comment on `delta_preconditions_hold` in each kernel.
- Reviewer differential re-run at `2812a71` (2 seeds × 709 cases including the clockless
  probe): byte-identical.
- Follow-ups for R5 (A2, A5, `job_complete_owned_by_run`, Q5 diagnostics) and R6 (A3) are in
  the PR body.

**Verdict: APPROVE.** Nothing open.
