# Review: validate a DecisionResult on commit (loka-kgd.191, PR #439)

- Branch `fix/kgd-191-validate-on-commit`, exact commit `364a450b7bc5cf555eb52268491c023e10251649`, base `30fbb6e5dd7058d646c0bc7ef98ffb8dea1b5b7d`.
- Governing: [save.md, Commit, fence, reconcile](../system/save.md#commit-fence-reconcile), [Review stance](../WORKFLOW.md#review-stance), [Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent); origin: [pack-sole-narration review](2026-10-22-pack-sole-narration-review.md) finding 2.
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- Verdict: **APPROVE WITH NOTES**.

## Must be true (written before reading the diff)

1. The check runs before any write on every commit path (player invoke and elapsed).
2. A valid result writes the same bytes as before.
3. An invalid result throws: no row, no fence, memory not adopted.
4. The same schema as reopen and replay (`DecisionResult`).
5. Existing refusals (failed or unknown COMMIT, mismatch or conflict replies) are unchanged.

## Checks run

- **1.** `commit` has one caller, `save.ts:53`. `save` has two callers: `invocation.ts:157` (player) and `delivery.ts:72` (`commitElapsed`). The only receipt `INSERT` is `commit.ts:50`. `persistElapsed` runs inside `transaction`. Holds.
- **2.** On base and head I ran the same script: a real `openStory` on node:sqlite, then `pick_lock` twice (accepted) and an unknown action (rejected, with a null Command). I took the sha256 of every table except `trace` and `observation`. Both gave `01879a10…5524927`, so the bytes are identical. `validate` is pure.
- **3.** `save.ts:54-58` traces `failed` and rethrows, and no fence is set. The new test pins this. Holds.
- **4.** Same schema name as `receipt-history.ts:49`, `delivery.ts:51` and `invocation.ts:61`. Commit checks every kind; reopen checks accepted rows only. The replay paths check every kind, so commit matches the strictest reader.
- **5.** `save.ts` is unchanged. All 80 `mobile/authority/local-story/*.test.ts` files pass on head (451 tests, exit 0).
- **Mutants** (commit.test.ts, all red, all reverted):
  - `invalid.length > 1` fails with `BEGIN IMMEDIATE`.
  - Throw replaced by `return false` (fence) fails with "Missing expected exception".
  - Check moved inside `transaction` fails with `BEGIN IMMEDIATE`.
  - `r.command` validated instead of `r.response` fails on the valid commit.
- **Tests:** the expected values come from the schema (`minItems 1`) and from the row that invoke wrote, not from commit's own output. The test has no mocks beyond the `execSync` tripwire.
- **PR cites rerun:** `save.ts:56`, `presenter.ts:169`, `receipt-history.ts:48-49`, `invocation.ts:165`, `delivery.ts:86` and `App.tsx:130` all hold. `/code-review medium` is reported.
- **Elapsed probe** (a scratch mutant in `delivery.ts` sets `narration: []` on an accepted elapsed response; probe removed):
  - On head, `game.pulse()` returns and emits `{kind:'error', message:'invalid DecisionResult; nothing was saved'}`, and 0 receipts are written. The cold reopen `openGame` throws that plain Error with no cause.
  - On base, the same mutant wrote the receipt, and the cold reopen opened `ready`, so the bad receipt was not refused.
  - Control without the mutant: `ready`, 1 receipt.
- **CI on head:** `gh run list --commit 364a450b7…`: ci, book-e2e and graph-diff all `success`.

## Findings

1. **nit**: the PR body says an elapsed commit throw stops the clock "with no player-visible fault slot". That is wrong. `session.ts:197-203` (`pulseOf`) catches the throw and emits `{kind:'error', message}`, `presenter.ts:56` sets `s.fault`, and `App.tsx:132` cancels the timer. The elapsed probe confirms it. Failure scenario: a follow-up gets filed for a gap that does not exist. Fix: correct the PR body.
2. **should-fix, follow-up**: an invalid elapsed result found during the open-time catch-up (`authority.ts:118`, `driver?.pulse('resume')`) now throws out of `openGame`. `localSession.reopen` (`session.ts:262-270`) records `{message, replace: false}` with no `newGame`, so `startOver` (`session.ts:277-278`) returns and does nothing. Each launch decides the same thing again. Failure scenario: a kernel bug yields a schema-invalid elapsed decision while the app is closed. The player then gets an open-failure screen with no Start over until an app update ships. Before this PR the same bug wrote a bad receipt and play went on. The save stays intact, which matches the session rule "an open that failed for another reason ... is never started over" (`session.ts:254`). So this is not fix-now: it needs a kernel bug, and a recovery offer is a design call beyond the brief. File a Beads follow-up.

## Rulings on the developer's open items

1. Clocked reservation held after a throw (`invocation.ts:165`): **follow-up**. It already happens for `COMMIT failed`. The save stays intact and a restart clears the reservation. Before this PR the same case left the save corrupt for good.
2. Elapsed throw during play: **no fix needed**. The player sees the fault slot (finding 1), nothing is written, and the clock stops (`App.tsx:132`) with no retry loop. The exposure is new only at open (finding 2, follow-up). Before this PR the bad receipt was written silently: the probe reopened it as `ready`, and a replay would answer `conflict` (`delivery.ts:51`).
3. Command not checked on commit (`receipt-history.ts:48`): **follow-up**. It is outside the brief, and the authority builds the Command itself.
4. Raw fault text (`commit.ts:37`): **follow-up** for the designer's batch pass. It uses the same wording as the existing `COMMIT failed; nothing was saved`, and it adds no new words-file entry.

Fix-now: none. Finding 1 is a PR-body edit; finding 2 goes to a Beads follow-up.
