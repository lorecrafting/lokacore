# Review: open a save without replaying its receipts, PR #574 (loka-vduxr.34)

- PR [#574](https://github.com/lorecrafting/lokacore/pull/574) `engine/fast-open` at `50bc895e1e4d5d43946e5f352b958b6be90ffe8b`.
- Governing: [owner decision](../decisions/owner-decision-fast-cold-open-2026-11-01.md), [save.md What reopen proves](../system/save.md#what-reopen-proves), [reopen principle](../lessons/storage.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review medium` is reported in the PR body. `bin/mutate_diff.sh` not run (brief); three targeted mutants below.

**Verdict: APPROVE WITH NOTES.** Removing forgery detection is the owner's ruling and is no finding.

## Must be true (written before the diff)

1. A save from ordinary play, an app update or a crash opens and plays on; only a hand edit may change outcome.
2. A commit is one SQLite transaction, so a kill leaves the prior or the next revision, never a head without its receipt.
3. Replay never fed state, so prices, stock, history, Chronicle and refunds read what they read before.
4. Head clock and revision checks pass at the edges: no receipts, only rejections, fresh save, Start over.
5. Deleted tests guarded forgery only; changed expectations follow from the ruling.

## Findings

**Should-fix.** `docs/lessons/storage.md:24-28`. Says cold-reopen validation replays stored receipts. A developer adding a save check concludes open replays and leans on it. Should say: open does not replay (save.md What reopen proves); `receiptHistory` replays the exact stored receipts in tests and dev tooling and never re-infers order; a heuristic ordering validator refused lawful saves (keep the ARCH-D10-01 cite), so open infers no order. Also `:29-32` add that `coldReopen` now replays for determinism, and `:37` read "everything its rows and receipts' meaning depend on". `:41-45` stands.

**Nit.** Stale break names after trims, against AGENTS.md "Name the break": `service.test.ts:146` (unearned entitlement row), `food.test.ts:85` (food-only replay trigger), `infirmary.test.ts:141` (forged contribution, transfer receipt), `liquid.test.ts:174,206` (transition proof, forged earlier evidence). Each names a break the test no longer detects, so a reader believes it is still guarded.

**Nit.** `receipt-history.ts:54`, the kept revision check, is red only through one test in `food.test.ts`; `receipt_history.test.ts` does not pin it. Trimming that food case leaves head and receipts free to disagree with a green suite.

**Question.** `light.test.ts` and `patrol.test.ts` dropped mutations (missing fuel row, `$.lit`=1, patrol `cursor`). All were hand edits, so outside the line to defend; whether the kernel throws on them, which the principle would still refuse, was not run.

## Crash and ordinary play

- Writers audit: `commit.ts:50,71`, `store.ts:195-217`, `elapsed.ts:34`, first save. No path raises head without a receipt or writes a receipt above head.
- Reopen check after every commit, full local-story suite: 9,035 commits, no refusal, suite green. Calls `load`, not `checked`.
- SIGKILL at each SQLite write, then reopen and play on: move 12 writes, pulse 9, death 13; none refused; head always equals newest receipt. Mid-catch-up on the two-step `open_catch_up.test.ts` fixture through `localSession`: killed at each of 20 writes, heads 0 (8), 1 of 2 (9), 2 (3); head equals newest receipt each time; each reopened, finished and played a move.
- Start over, close, reopen, play, reopen: head 0, no receipts, opens, plays, head 1.

## Open items ruled

- `receipt-history.ts:65`: accept. A newest `look` carries no time evidence; lawful, and the check runs when evidence exists.
- `liquid-save.ts:6`: accept. Forged job actor only.
- `exchange-save.ts:5`: accept. Same predicate as main's `exchangeSave`, fuel clauses included; the relaxed deadline read differs only for a tampered save.
- `receipt-save.ts:22`: accept. `hasDevReceipt` took 1.3-6.7 ms at 600 receipts.
- `elapsed-host.test.ts:90`: accept. Sampler `coldReopen` keeps determinism covered.
- `commerce-save.ts:107`: filter is equivalent. A dropped elapsed row has no money ops or transfers, so the loop does nothing with it; only prices and custody read it, and those values never came from replay. NULL type arises from forgery only.
- `open_catch_up.test.ts:161`: follows from the ruling. `first` at revision 1 committed during the launch, so the refusal came from step 2, not open.
- `knowledge-save.ts:16`: new guard, no lawful hit in 9,035 reopens.

## Test the tests

Files that open a save, then the whole local-story suite for the survivor:

| Mutant | Result |
| --- | --- |
| drop revision compare, `receipt-history.ts:54` | green on 74 files; red on full suite (`food.test.ts`) |
| drop `at > clock`, `knowledge-save.ts:16` | red, D10 knowledge rows |
| clock `>` to `> clock + 1`, `receipt-history.ts:67` | red, head clock behind newest receipt |

## PR claims rerun

- `local-story` non-test code does not name `run_job`: holds (only a comment in `local_story.test.ts`).
- Hand mutants "MAX revision check", "knowledge guard", "clock compare" red: hold.
- Timing not reproduced: the PR's scratch saves are not available. My own 600-receipt showcase save opened in 150-189 ms under `openGame` on this machine; same order, different save.

Not checked: phone hardware; `checked` step after each commit; deleted tests beyond reading their hand edits.
