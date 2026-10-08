# Review: loka-mkm forged deadline receipt checks on reopen

- PR #313, branch `fix/forged-deadline-receipt-tests`, head `e3b5e56d83ea2ec69e7251ede25452a462b18fe5`, base main `c44a44c3`. Hosted CI green.
- Reviewer: fresh independent Opus. Test-only slice (one file, +130 lines).
- **Verdict: APPROVE WITH NOTES**

## Must be true (written before reading the diff)

From [save.md "Selected S2 recovery"](../system/save.md#selected-s2-recovery), `save.md:19`, [storage lessons](../lessons/storage.md) line 20:

1. Each of the brief's 11 checks (S-a..S-f in `deadline-save.ts` `activated()`, R-a..R-e in `deadline-receipts.ts` `expires()`) has a test that forges one receipt field in a real saved SQLite row and asserts reopen returns `save_corrupt`.
2. Under its own single-condition mutant the test reopens `open` (no earlier check masks the forgery, so it does not pass for the wrong reason).
3. The test is not redundant with an existing test (the mutant survives the existing suite).
4. No production, fixture or bundle change.

## Checks

- Diff: test-only, `chandlers_debt.test.ts`; v016 bundle, real `openStory` on the SQLite file. Item 4 holds.
- Mutants re-run by the reviewer (throwaway worktree, each alone, restored): S-a, S-b, S-c, S-d, S-e, S-f, R-a, R-b, R-c, R-d, R-e. All 11 fail with actual `'open'`; with test names on S-a, S-b, S-d, S-e, R-a, R-c, R-e, each failed exactly its own test (diagonal). Items 1-2 hold.
- Extra mutant: `within()` `times[0] <= window.through + 1` turns the S-a test red (forgery at 151201 sits exactly one past `through: 151200`), so the boundary is pinned too.
- Overlap: S-e mutant against the full `mobile/authority/local-story/*.test.ts` suite with main's test file: 462 pass, 0 fail. Item 3 holds for the sample; the PR triage table covers the rest.
- Tests follow AGENTS.md "Writing tests": expected value `save_corrupt` is a literal, forged values are literals, no mocks, no new fixtures. `forge`/`only` helpers are the brief's permitted shape; no over-engineering.

## Findings

1. nit, PR #313 title/description: "the remaining forged B2 deadline receipt checks" overclaims; the description itself lists about a dozen further surviving mutants (`deadline-receipts.ts:156,175,194,198,205,79`, `deadline-save.ts:194-195`). The body enumerates them honestly, so this need not block; replace "reported to PM" with a link to follow-up `loka-2gr` so the claim is bounded.

No blocker or should-fix.
