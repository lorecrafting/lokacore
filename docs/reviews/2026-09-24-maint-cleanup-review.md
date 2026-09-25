# Review: post-R3 maintenance cleanup

- PR: [#20](https://github.com/lorecrafting/lokacore/pull/20), branch `maint-cleanup`
- Commit reviewed: `d387b93` (CI green on all 5 jobs)
- Reviewer: fresh session; authored none of the work. Cleanup slice with no intended
  behavior change, so the review is proportionate and asks one question: was anything lost?

## Verdict: APPROVE WITH NOTES

Nothing was lost. Each kernel runs a known-answer case list whose canonical bytes are the
same as on `main`. The 1,000 differential inputs are byte-identical too. The PR #15
mutants that the moved cases exist to kill still die in both kernels. There is one
should-fix: the fixture does not tell a future host how to rebuild the three cases it no
longer lists.

## What must be true (written before reading the diff)

1. Each kernel runs the same cases as before: same ids, order, states, ops and expected
   values. The seeded differential inputs do not change.
2. The expected values for the built cases are hand-written, not computed by the kernel.
3. The moved cases still kill the mutants they were added for (PR #15 F1 and AQ1).
4. The test split loses no test, and the one TypeScript deletion asserted nothing else.
5. Every index entry survives the regrouping unreworded. The protocol map matches the files.

## Verification

- **Case list, both kernels.** I added throwaway dump hooks in detached worktrees at
  `origin/main` and `d387b93`. Each hook writes the canonical encoding of the case list
  each test iterates, plus the indexed `base`, `full_queue` and `crowd` states. On `main`
  those states come from the fixture; on the branch two of them are built. The four files
  (main and branch, Elixir and TypeScript) are identical: 231,571 bytes, sha1 `07900d7`.
  The three built cases were the last three fixture cases on `main` (indices 56 to 58), so
  appending them keeps the order. The rest of the fixture is unchanged apart from
  `description` (checked with Python `==`). The PR quotes 352,832 bytes; it encoded a
  different shape (a resolved state per case), so that number is not comparable to mine.
- **Differential inputs.** The canonical encoding of the 1,000 seeded cases is identical on
  both sides (2,433,661 bytes, sha1 `f78ad7c`). The op pool is still built from the `base`
  cases in order, and the 65 built ops are still last.
- **Mutants** (`mix test --force` and `node --test`, reverted afterwards). Removing
  `- due` from the pending-jobs budget fails `composition known answers` in both kernels,
  on `pending-jobs-bound-is-the-final-queue`. Removing the row sort fails in both kernels:
  in Elixir on `changes-sorted-by-target-over-32-rows`, plus the differential; in
  TypeScript, known answers plus the commit-boundary test.
- **Hand-written expectations.** The expected values are literals made with test-local
  helpers (`uuid`, `queued`, and an ascending `1..40` list), never with `compose` or
  `Canonical`. Padding ids to 12 digits makes numeric order match canonical-text order, so
  the ascending list is a real independent answer.
- **Tests.** ExUnit runs 113 tests on `main` and on the branch. The test-name sets are
  identical: 49 `test "…"` declarations, the rest generated. I sorted every line of the old
  `contracts_test.exs` against the four new files: nothing dropped, and one comment line
  was extended into the new cross-file pointer. `nominal_ids_test.exs` stays `async: false`
  and gains the two constructor tests. TypeScript goes from 34 tests to 33. The deleted
  `index.test.ts` contained a single `assert.equal(KERNEL_ID, 'loka-kernel')`.
- **Indexes.** The markdown link sets of `docs/decisions/README.md` (17 links) are
  identical, and so are those of `docs/reviews/README.md`, except for one added link.
  Sorted bullet lines are identical in both files, so the entries only moved. The added
  link points to the legacy repository at `997a7a8`, `docs/rewrite-v3/reviews/`, and that
  path exists. Every file in `docs/reviews/` is indexed.
- **Protocol map.** The table lists every file under `protocol/`. Each row's coverage and
  spec sections match that schema's own `description`. The fixtures column matches the
  files: `residency.json` rows carry a `fixtures` field, `command_id.json` and
  `capability_lock_hash.json` are read by the portable-ABI tests, and `invalid.json` is
  read by both kernels.
- **WORKFLOW and lessons.** Three edits, all correct and short. The sweep step links the
  lessons. The `npm ci` directories match the loop in `bin/check_all.sh`. The worktree/PR
  rule for self-review is in place. The lessons line "expected errors come from the schema
  text or a separate oracle, never from the validator" restates AGENTS.md "Writing tests".
- **Audit.** The one deletion is a change detector; `KERNEL_ID` is still used by
  `mobile/app/App.tsx` and the lint rule tests. The deferred follow-ups (`@safe` repeated,
  the hub id literal in `@ents`) are reasonable to leave.
- **`bin/check_all.sh`** exits 0 on `d387b93` (clean detached worktree, full TS section).

## Findings

### F1 (should-fix) `protocol/fixtures/composition.json:2`: a host cannot rebuild the three cases from the fixture

The PM kept the built cases in the tests, which is sound: both kernels must match the same
hand-written answers. But `protocol/residency.json:54,61` names this file as *the*
conformance fixture for `state_delta_composition` and `invariant_checks`. The description
says only that three cases "are built from a pattern … by both tests". It does not give
their ids, the id scheme, the states or the expected answers. The PR body says the
description "names the three cases"; it does not. Scenario: a third host, or an R6 host
harness, runs every case in the JSON and passes. It never runs the three budget and
sort-order boundaries, which catch PR #15's F1 mutant and an unsorted row list over 32
targets. Its author learns what to add only by reading Elixir or TypeScript test code.
Fix: extend `description` by about three sentences, one per case. Suggested wording:

- ids are `<pp>000000-0000-4000-8000-<n, 12 digits zero-padded>`;
- `budget-before-first-op-fault`: state `base`; `job.schedule` of `d1…0` at due 30, then
  64 schedules `f2…1` to `f2…64` at due 100, all job `lantern/0.1.0/schedule/bram`,
  writer group 0; expected fault `budget_exceeded`;
- `pending-jobs-bound-is-the-final-queue`: clock 6, jobs `f0…1` to `f0…1024` pending at
  due 3; schedule `f1…0` at due 20, then complete `f0…1`; expected two rows, `f0…1`
  completed and `f1…0` pending at 20;
- `changes-sorted-by-target-over-32-rows`: clock 0, entities `e0…1` to `e0…40` in hub
  `10…0`; transfers to room `20…0` in order 40 down to 1; expected 40 containment rows
  ascending by entity.

## Parallel PR #19 (conflicts only)

- `docs/decisions/README.md` conflicts (`git merge-tree` confirms). Whichever PR merges
  second must: take #19's new opening sentence; put #19's reworded ADR-074 bullet under
  "Post-R3"; put the new `owner-decisions-r3-open-questions` link in the R3 owner-decisions
  line. #19's opening says ADR-070 to ADR-074 are now in document 16, so the "Proposed"
  labels on the ADR-071/072 and ADR-073 bullets become stale once both PRs land.
- `protocol/README.md`: #19 adds `host_adapters` and `differential` to
  `capability.schema.json`. The capability row ("capability versions, the lock, residency")
  still reads correctly, so no edit is needed. No other overlap.

## Re-review (fix round 1): `54688e7`

Scope: F1 only. The fix changes one line, the `description` in
`protocol/fixtures/composition.json`, and nothing else.

**F1: fixed.** I rebuilt the three cases and the `full_queue` and `crowd` states in Python,
using only the new description and `delta.schema.json` (its job-ref example gives the
field names for "lantern 0.1.0 schedule bram"). The result equals `main`'s fixture
entries under Python `==`: cases 56 to 58 and both states. Round 1 showed those entries
are byte-identical to what both tests build, so the description matches the tests. The
description also says that `d1…0` already exists in `base`, which I confirmed, and that
every host must run these cases.

Verdict: **APPROVE**.
