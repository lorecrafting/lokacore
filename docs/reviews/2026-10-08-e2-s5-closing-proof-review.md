# Review: E2 S5 closing proof (PR #321)

- Target: draft PR #321, branch `e2/s5-closing-and-gate`, head `266fa6b20761f96b1841845c179cb7a312181db9` (runner `source_sha` `7a734d92`; no non-docs diff between the two).
- Reviewer: fresh independent Opus. Lane: draft, no hosted CI; local runs only.
- Governing: [slice plan exit criteria 3-7](../briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md#exit-criteria-each-tied-to-its-clause), [save.md Commit, fence, reconcile](../system/save.md#commit-fence-reconcile), [E1 exact candidate proof policy](../system/e1-certification.md#e1-exact-candidate-proof-policy), [evidence lessons](../lessons/evidence.md), PM rulings and S4 UPDATE in the S5 brief.

**Verdict: APPROVE WITH NOTES**

## Must be true (written before reading the diff)

1. Fault rows on real SQLite: failed write, failed COMMIT, lost ack, kill before and after COMMIT. Each settles on the literal prior or next revision. Memory never runs ahead of the store. A cold reopen agrees. A same-payload retry applies once.
2. A failed write throws with nothing changed and no fence. An unknown COMMIT is fenced (`pending`) until reconcile (save.md:88-93).
3. The planted defect is reachable, green on the full focused kernel and authority suites, and red only on a named r9c scenario.
4. The report identity is recomputed from the retained `report.json`: exit 2, pending, verdict null, id, version, content hash, five receipts 0, 100 sequences, the four pending gates. SHA256SUMS verifies. No local paths are retained.
5. Coverage counts only what executes. Locked but unused is pending. Browser, Hermes and native rows are named pending.

## Checks run

- `shasum -a 256 -c SHA256SUMS`: exit 0. All 36 files listed, and the list does not include itself. A path grep (`/private/`, `/Users/`, `/tmp/`, `/var/folders`, `e2-s5-mutant`, `scratchpad`) finds only the grep's own command line.
- `report.json` recomputed: 36 capabilities, 47 commands, 9 gates. The identity matches the brief literals. Dot counts: `sqlite.log` 486 and `kernel.log` 915, with no other characters. Test counts: 12 authority `r9c_*` tests (4 in faults) and 9 kernel `r9c_*` tests. `r9c_faults.test.ts` is present at `7a734d92`.
- **Command coverage instrumented.** A stderr line at `runtime/world.ts` `evaluated` (non-refused) and at the `run_job` admit in `proposal.ts`, over the 21 `r9c_*` tests. Result: exactly 36 distinct commands, the README's executed list. The 11 named pending commands never reach a rule.
- **Planted defect (full-suite confirmation, `mutant.diff` at 266fa6b2).**
  - Kernel `**/*.test.ts`: 915/915 pass, including the kernel r9c family 4.
  - Authority `*.test.ts`: the only real failure is `r9c_creatures_transport.test.ts:306`. `mauds_cellar_book.test.ts` first failed because `mobile/app/node_modules` was missing from the worktree. After that was linked, it passed under the mutant.
- **Fault-row mutants** (`r9c_faults.test.ts` only; restored, rerun exit 0):
  - M1 `transaction.ts:30`: a failed write returns false (SQLITE_FULL treated as unknown). Red: F1 and F3 at `:158`. This confirms SQLITE_FULL is pinned as definite and unfenced.
  - M2 `invocation.ts`: the receipt replay is bypassed. Red: F1, F2 and F4. F3 is green, because elapsed replay does not use that path.
  - M3 `commit.ts`: the receipt is committed in a second transaction (a partial commit). Red: F1-F4 (`:187`, `:126`).

## Judgements

- SQLITE_FULL "fails outright, never fenced": agreed for this fault. save.md:88-89 and `transaction.ts:29-30` throw after a successful ROLLBACK, and the row asserts `stale_view` with the prior state (M1 red). The fence applies only when that ROLLBACK leaves the transaction open (`transaction.ts:31`), which this fault does not reach.
- "next" comes from a fault-free run on a byte copy, the same way as in `faults.test.ts`. The prior/next choice per row is literal, and the states are pinned by the family files. Accepted.
- F4 as paid ferry boarding (PM accepted): it is a cross-domain commit (body, fare, transport). Accepted.
- Carries:
  - C1: `report-check.log`, exit 0.
  - C2: the comment at `kernel/ts/test/r9c_elapsed_jobs.test.ts:213-214` matches the code (only the refused `down` is invoked in the dark; relit at :231).
  - C3: README:153-155 counts the Oak order once.
  - C4: README:144-146.
- Disputed `/code-review` items:
  - 6 (reference recomputed per row): agreed. The cost is small and `row()` stays self-contained.
  - 7 (F2 route duplicated): agreed. Importing `r9c_custody_terminal.test.ts` would register its tests. The imported `elapsed-host.test.ts` has no `test(` calls.
- The pre-push hook pass cache is real (`.githooks/pre-push:22-24`, the clean tree hash).

## Findings

1. **nit** `mobile/authority/local-story/r9c_faults.test.ts:5` and `docs/evidence/2026-10-08-e2-r9c/README.md:56`: "Every row: fenced calls answer pending" overclaims.
   - Pending is asserted only on the `failed` and `lost` rows (`:168-170`: F1 `:234-235`, F3 `:317`, F4 `:335`).
   - `full` never fences, and the deferred-FK `commit` rows reconcile inside the call (`:162`), so F2 and F4's failed COMMIT never shows `pending`.
   - This is correct behaviour under save.md, but a reader could take F2 and F4 as fence evidence.
2. **nit** `docs/evidence/2026-10-08-e2-r9c/README.md:117`: the transport row cites "F4 `r9c_faults.test.ts:315`". `:315` is F3's elapsed call; F4 is `:324-335`.

No blocker or should-fix findings. Fixing the nits is optional. The README is listed in SHA256SUMS, so a README edit must regenerate SHA256SUMS and the verify file. The test comment is not hashed.

## Fix round 1 and gate PR G (head `aa87cd04735f047652794a989bbf7d3fc328f743`)

Scope: `31a85fe7` (S5 fixes) and `4845cbbf` and `aa87cd04` (gate PR G, docs only). The `origin/main` merge `53ac4d7f` is not reviewed here.

**A. Fix re-check: APPROVE.**
- Nit 1 is closed. `r9c_faults.test.ts:5-8` and evidence `README.md:55-60` now say that only the unreadable-store and lost-ack rows fence and answer `pending`, that SQLITE_FULL never fences, and that a failed COMMIT settles inside the call. The comment is still 4 lines, so the cited lines (`:162`, `:168-172`, `:324-335`) still point to the same code. Since `266fa6b2`, the only code-side change is that comment.
- Nit 2 is closed: README:119 now cites F4 `:324-335`.
- Fable's notes:
  - The gates paragraph is relabelled "disposition pending", which is accurate.
  - The paired-job paragraph names six kernel tests, and all six exist. Their red status is taken from the [Fable audit](2026-10-08-e2-gate-fable-audit.md); I did not rerun it.
- Hashes: `shasum -a 256 -c SHA256SUMS` exits 0. The local-path grep finds nothing beyond `redaction-grep.log`'s own command line. `SHA256SUMS.verify` needed no change, because the file names are the same.

**B. Gate checklist (`docs/briefs/chapter-one/chapter-one-e2-gate-checklist-2026-10-08.md`): APPROVE WITH NOTES.** Governing: [WORKFLOW Milestone gate](../WORKFLOW.md#milestone-gate).
- Criteria 1-8 each link a slice PR, a review record or an evidence section. For criterion 8, exact-head CI is honestly stated as still to come.
- Criterion 5: I checked each cited line against the S2 review M1, M2 and M3 rows. `r9c_custody_terminal.test.ts` authority `:323` and `:308`, kernel `:288`, and `missing_child_bell.test.ts:136` all match. The S3 M2 row for `service/shared.ts:105` and the provenance row ("known untested", loka-zfq) are correct.
- Every carry has a row: the 11 commands, browser and native rows, the pending gates, the crow guard, forged deadlines, the paired-job invariant, loka-8mm and the recorder scope. The owner touch is a short report (owner answer (b)).
- ROADMAP: A1-A3, B1-B9, C1-C6, D1-D12 and E1-E3 make 33 slices, matching `MISSING-CHILD-PLAN.md:27-88`. With E2 done that is 32 of 33, which is correct. "E3 remains open" is correct, and the E2 slice list now lives once, in the checklist.
- The docs tidy pass claims are consistent with the diff.
- The review index in `aa87cd04` keeps main's lines, then this branch's three lines. Nothing was lost.

Finding:
1. **nit** `chapter-one-e2-gate-checklist-2026-10-08.md:34`: the cap half of "Omit provenance / cap" says "existing cap tests fail under the cap mutant (S4 review)". That review (`:47`) does not name the test either, so the guard has no test `file:line` anywhere. A reader cannot find which test catches the cap break.

Open: none blocking. Hosted CI on `aa87cd04` is still the merge condition.
