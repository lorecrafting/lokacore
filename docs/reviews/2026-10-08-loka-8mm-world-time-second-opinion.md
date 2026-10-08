# Review: loka-8mm world time starts at first entry, second opinion (save and reopen)

- PR #323, exact head `849ae3290d1a39a357dd5a5c803c7d05e3fcb0c0`; fresh independent Opus second opinion, save/reopen lens only.
- Governing: [save.md M1-A and Durable elapsed sessions](../system/save.md#m1-a-trusted-elapsed-receipts), [forward development :7-16](../decisions/owner-decision-forward-development-2026-10-05.md), [lessons/mechanics.md](../lessons/mechanics.md) (every committed intermediate state through the real loader).
- **Verdict: APPROVE WITH NOTES.**

## Must be true (written before the diff)

1. No committed pre-choice state of a new save holds clock or target above the birth clock.
2. The anchor at the choice is durable before the choice commits, so a reopen after the choice credits from the choice, not from an earlier picker anchor.
3. Failed or unknown COMMIT and receipt replay around the choice never credit picker time.
4. Old saves: explicit refusal (host code), no byte rewrite, no clamp, no compat code.

## Evidence (real SQLite, r9c_interactions, scratch tests not committed)

- Post-choice reopen (choice at wall 600000, reopen at 660000, twice): clock `67800`. Holds 2.
- Case (a), save made with both gates disabled (clock `70800`, 2 receipts), reopened on head: `openStory` kind `save_corrupt`; file SHA-256 identical before and after. No compat code in the diff.
- Case (b), forged checkpoint `target + 3000` before choice: resume pulse `{fault, invalid_state}`; `choose_ancestry` `{fault, invalid_state}`; target stays `67800` (no clamp). One rejected elapsed receipt row is appended (normal M1-A behavior, no existing bytes changed).
- Lost acknowledgement on the choice: `72800` live and reopened = 160 s after the reservation, correct.
- Mutants: credit `d` on resume before choice -> PR test red (`fault invalid_state`). Keep the old wall anchor before choice (no wall re-anchor) -> PR test and every related local-story elapsed/fault/choice file **green**; only my post-choice reopen probe red (`97800`).

## Findings

1. **should-fix** `mobile/authority/local-story/r9c_elapsed_jobs.test.ts:381`: the test never reopens after the choice before a post-choice pulse, so it does not check the save.md clause "re-anchors wall ... evidence". Failure: a change that skips checkpoint writes on the picker (a plausible optimization; today each 250 ms pulse writes a row) credits all picker time after a post-choice reopen (`97800` vs `67800`), and the suite stays green. Fix: close and reopen once after `chosen`, before the final pulse, and assert `67800`.
2. **nit** `mobile/authority/local-story/invocation.ts:91-95`: when a choice transaction fails, the retry keeps the held reservation and drains without capturing again. If no pulse runs between the attempts, picker time since the first reservation is credited (100 s gap: `72800` vs `67800`). The 250 ms active pulse and pause/resume re-anchor this in the app (`67800` with one pulse between), and it matches the spec text "starts at the selection invocation's reservation". Record only.

## Fix round 1 re-check (`b924d1f2`)

Scope: fix commit `b924d1f2` only (finding dispositions).

- Finding 1 (should-fix) **resolved**: `r9c_elapsed_jobs.test.ts:379-382` closes and reopens after `chosen`, before the first post-choice pulse, and asserts `67800`. Green at head. My mutant from the first round (keep the old wall anchor before the choice) is now red: `actual: 274800, expected: 67800`.
- Finding 2 (nit) **accepted as record only**: no code change; the app pulse and pause/resume reset the anchor, and this matches the spec text.
- Kernel forged-id assertion (`character_choice.test.ts:86-90`): outside the save lens, not reviewed.
- **Verdict: APPROVE.**
