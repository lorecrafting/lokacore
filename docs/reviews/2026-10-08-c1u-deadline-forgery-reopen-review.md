# Review: loka-c1u deadline forgery reopen tests (PR #310)

- PR: #310, branch `fix/c1u-deadline-forgery-reopen`
- Commit reviewed: `4dd2af4218441af8464c5ef087b5f30df2220686`
- Governing: [mobile size-debt second opinion, finding 1](2026-10-07-mobile-size-debt-save-second-opinion.md)
  (M5, M8); AGENTS.md "Persistence shape (ADR-072)"; [storage lessons](../lessons/storage.md).
- Verdict: **APPROVE**

## What must be true

1. Each test forges a real saved SQLite `receipt` row, then reopens from the database.
2. Without the targeted check, reopen accepts the forgery (no earlier refusal masks it).
3. The assertion is the typed `save_corrupt` result, not any thrown error.
4. Test-only: no production code changed.

## Checks

- Diff touches only `mobile/authority/local-story/chandlers_debt.test.ts` (+60).
- Both tests `UPDATE receipt SET response=?` on the SQLite row, assert exactly one row matches
  first, then call `openStory(...).kind === 'save_corrupt'`. A throw fails the test.
- Baseline `node --test chandlers_debt.test.ts`: pass 8, fail 0.
- M5 (trust `changed(...)` removed from `deadline-receipts.ts:216`): only
  "reopen refuses an expiry receipt with a forged trust event" fails; actual `'open'`.
- M8 (`deadline-save.ts:163` `activated(...)` replaced by `void activated;`): only
  "reopen refuses an accept receipt that schedules its due job at another time" fails; actual
  `'open'`.
- Actual `'open'` under each mutant proves the forged value is otherwise accepted (item 2).
- Code restored after each mutant; worktree clean.

## Findings

None. Repeated setup chain (`move`/`invoke`/`answer`) and `until: 237601` follow the file's
existing tests; no helper needed. Further untested forgery checks are settled under Beads loka-mkm.
