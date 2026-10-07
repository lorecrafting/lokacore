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
