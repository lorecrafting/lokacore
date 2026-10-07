# D9 provisional portable foundation second opinion

Candidate: `50b3e67f2d5179b40cef90c791e41ecbb85c6124`, against published `de8b1cb5`.
Fresh independent scoped review. This supplements the primary review; it is not final
release, browser or milestone approval. Cast reconciliation and complete checks were
pending at the reviewed candidate.

## Verdict: CHANGES REQUIRED

### F1 — blocker: lawful regular-first deadline receipt cannot cold reopen

At `mobile/authority/local-story/deer-save.ts:102`, the suppression-clearing operation's
`expected.job_id` is treated as the regular job in the bound deadline pair. If that
regular job already ran, the hydrated prefix has rotated it to its future successor.
The successor fails the same-deadline/completed-operation checks. When unrelated jobs
intervene between regular and resume, the legitimate reused group is then rejected as
an invalid deer handoff. This violates the D9 protocol equal-deadline ordering clause
and D9 save cold-reopen/reconciliation clause.

Controlled reproduction using real SQLite: copy the existing D9 test and change only
its uncertain-bell invocation suffix `000000000201` to `000000000203`; run
`mise exec -- node --test --test-name-pattern='uncertain bell' <copied-test>`.
The existing assertion at `mobile/authority/local-story/d9.test.ts:311` fails:
`save_corrupt` instead of `open` (exit 1). A separate no-fault probe confirms the
237600 deadline saves successfully, then refuses reopen. Suffixes 201 and 202 run
resume first and reopen successfully. The 203 ordering is regular, intervening
unrelated same-time jobs, resume. Recover the exact original regular occurrence from
the receipt's bound transitions in either delivery order; retain unrelated conflict
and deer handoff validation. Cover both orders with the real SQLite regression.

### F2 — blocker: new portable suppression algebra lacks its required oracle coverage

The new branches in `lib/loka/core/compose_population.ex:43` and
`lib/loka/core/invariants_population.ex:98`, and their TypeScript counterparts, have
no independent suppression fixture or randomized suppression differential coverage.
`protocol/fixtures/population_composition.json` contains six older cases and zero
suppression fields. `test/loka/core/compose_test.exs:295` draws the randomized pool
from older base/pools and patrol cases. Its separate 300 simulator proposals contain
zero population-control operations (measured from the actual generator output).

Mutation proof: temporarily replace both changed Elixir population modules with
published `de8b1cb5` versions, removing all D9 suppression semantics; then run
`mise exec -- mix test --force test/loka/core/population_composition_test.exs test/loka/core/compose_test.exs`.
All 14 tests still pass, exit 0. Thus these tests cannot detect one kernel entirely
refusing legitimate suppression/resume while the other accepts it. This violates
AGENTS Candidate C portable-foundation fixture/differential requirements.

Add a separate independent literal fixture for suppression start, successor retention,
resume and invalid generation/cause transitions, exercise composition and independent
invariant rejection in both kernels, include suppression rows in randomized differential
coverage, and demonstrate the relevant mutations failing. Keep frozen fixtures intact.

## Other observations and checks

- Read the workflow, mechanics/contracts/storage/evidence lessons and D9 mechanics,
  proposal and save clauses before assessing behavior.
- Existing D9 TypeScript and real SQLite tests: 10 passed, exit 0.
- Existing portable population/compose tests: 14 passed, exit 0; restored after the
  surviving Elixir mutation and rerun with `--force`: 14 passed, exit 0.
- Disable only population deadline pairing in `runtime/proposal.ts`: existing exact
  deadline test fails with `conflicting_write`, exit 1. Restored D9 suppression tests
  pass, exit 0.
- The live proposal retains `(due_time, job_id)` order and reads the hydrated prefix.
  The matched pair is based on current control IDs, pending status, identical plan and
  exact suppression deadline. Stale IDs remain separate. No additional functional
  issue found in that inspected live path.
- Suppression control changes use shallow row copies and the existing changed-section
  apply path. No new whole-state cloning/encoding was found on this action path.
- Ponytail Review: no actionable complexity reduction in the scoped change; preserve
  validation and reuse the existing receipt machinery for F1.

Only disposable isolated review files were mutated. The developer branch and owner
save were not changed. Temporary probe/test files were removed before handoff.


## Scoped fix round 1 — APPROVE

Reviewed source `5bee68110fc197e182e8166548a934b828d2d898`, with review-record-only
head `8dbf22c8`. Scope: F1/F2 fixes, direct save-guard callers and the new portable
fixture/tests. No open foundation finding. Browser proof and the complete final
check/CI gate remain pending; this is not overall publication approval.

**F1 closed.** `mobile/authority/local-story/deer-save.ts:102` now locates the
regular occurrence through the same-plan, same-group control rotation at the exact
suppression deadline. It retains distinct IDs, common deadline/plan, completed-job
operations in the same group, and unchanged suppression cause/generation checks.
The existing SQLite test now runs invocation suffixes 201 and 203 through failed
COMMIT and lost-acknowledgement reconciliation, exact replay and reopen.

Independent controlled execution confirmed the actual revised-release orders:
201 runs resume before regular; 203 runs regular before resume, with unrelated
same-time jobs between them. Both save and reopen at 237600. For each order,
changing only the regular job-completion operation's stored writer group to 999
causes `openStory` to return `save_corrupt` without rewriting that receipt; restoring
the receipt restores successful open. This control used disposable real SQLite.
Restoring the old F1 implementation makes the committed uncertain-bell regression
fail with `save_corrupt`, exit 1; restoring the fix makes that test pass, exit 0.

**F2 closed.** The new separate `population_suppression.json` pins four valid
literal transitions and four invalid transitions: active extension, changed resume
cause, initial generation gap, and retained resume job. Each invalid case also pins
a counterfeit success that both independent invariant implementations reject.
Both kernels compare against those literals before their differential comparison;
the added deterministic randomized test exercises 120 varied suppression rows with
both accepted and refused outcomes. The prior population fixture remains unchanged.

Independently reverted each portable production module to published `de8b1cb5`,
one at a time: Elixir composition and invariants each fail the focused tests with
exit 2; TypeScript composition and invariants each fail with exit 1. Restored portable
tests pass, including all literal/oracle checks and 120 differential rows. These
controls now detect the regression that survived the original review.

Verification run with the pinned toolchain:

- `node --test` over population composition, D9 suppression, SQLite D9 and SQLite
  deer tests: 19 passed, exit 0.
- `mix test --force test/loka/core/population_composition_test.exs`: 3 passed,
  exit 0; repeated after mutation restoration.
- Five live production revert controls: all fail as intended; restored portable
  checks and the uncertain-bell SQLite check pass.
- Ponytail Review: focused reuse of the existing receipt/control data; no new
  abstraction or actionable complexity finding.

All mutations and receipt probes used a disposable isolated checkout/database.
No developer source or owner save was changed; temporary probes were removed.
