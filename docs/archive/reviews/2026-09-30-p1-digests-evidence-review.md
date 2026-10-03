# Review: R6 P1 intent digests() on iOS Hermes (iPhone 11)

- PR: #68 (`r6-p1-digests-evidence`), commit reviewed `5533fbc` (base `001c4c9`).
- Scope: docs/evidence only. No mutation testing (no code changes). Depth: short.
- Verdict: **APPROVE WITH NOTES** (one nit).

## What must be true (written before reading the diff)

1. The raw device log shows `digests()` over all 8 rows of
   `protocol/fixtures/intent_digest.json` with 0 mismatches. It also shows the items (3 cases)
   and dusk (1 case) re-runs passing.
2. The wiring calls the real `digests()` on the real fixture. An empty or unloaded fixture
   cannot print a pass that looks like the real one.
3. `SHA256SUMS` verifies and does not list itself.
4. No UDID, ECID, serial, device or owner name, team id, certificate, provisioning id, home or
   worktree absolute path, or container UUID appears in the diff, commit message or PR body.
5. The ROADMAP P1 edit is accurate. It presents this evidence as what closes the S3
   precondition.

## Checks

1. Met. `p1run.txt:3-6`: 4 run cases PASS. `p1run.txt:7-14`: 8 digest rows PASS, named exactly as
   the 8 fixture rows. Then `rows=8 mismatches=0` and `done mismatches=0`. Counts match
   `invocation_cases.json` (3 + 1) and `intent_digest.json` (8). The PR changes no kernel,
   protocol or mobile file against `001c4c9`.
2. Met. `dev-App.tsx.txt:34-40` imports `digests` from `kernel/ts/src/known_answers.ts` and
   passes it `intent_digest.json` `cases`. The only change from PR #67's wiring is this block
   plus two imports (diffed). `digests()` (`known_answers.ts:58-68`) compares by exact string
   equality. A rejected identify is encoded and never equals a hex digest. An empty fixture
   would print `rows=0` and no row lines, so it cannot pass as this log. A missing fixture
   fails the bundle build. The Node red control exists at `invocation.test.ts:43`.
3. Met. `shasum -a 256 -c SHA256SUMS` on the extracted tree gives 3 × OK. The file lists
   neither itself nor its verify file. `dev-metro.config.diff` is byte-identical to PR #67's.
4. Met. Grepped the diff, commit message and PR body. The only UUID is the test `CONTEXT`.
   Placeholders are `<device>` and `<team>`. `../lokacore-p1-digests` is relative. None of the
   other listed identifiers appear.
5. Met. The "must also pass" clause becomes "and so did `digests()` ... [evidence]". The S3
   precondition sentence stays and both of its parts now point to passing evidence.

## Findings

- **nit** `docs/evidence/2026-09-30-p1-digests-iphone11/README.md:20-22`: the statement that
  rows 1 and 2 share a digest is true (`38b7d24e…`). It is also incomplete. The label test
  (`dev-App.tsx.txt:37`, `x.includes(c.intent_digest)`) also matches the `actual` digest in a
  mismatch message. Failure scenario: a target-order bug makes row 3 return row 4's digest
  (`e575…`), and row 4 prints FAIL even though it passed. Coverage is not weakened: the
  `mismatches=` count comes from `digests()` itself, and the README says the count is
  authoritative. Only the explanation of the labels is narrower than the truth. The fix is to
  say that any row whose expected digest appears in a mismatch message is labelled FAIL.
