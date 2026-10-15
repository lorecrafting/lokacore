# Save second opinion: Homestead hs-5, the mobile Eat receipt with `applies`

- Branch `toolbox/hs-5`, exact head `45450614`. No PR (draft batch `toolbox/batch-homestead-a`). Beads loka-kgd.108.4. First review: [2026-10-15-hs-5-review.md](2026-10-15-hs-5-review.md).
- Why: the fix changes the mobile local-story save path ([WORKFLOW Review count](../WORKFLOW.md)).
- Governing: [save.md "Narration reconstruction" (:971-980)](../system/save.md), [storage lessons, Recovery and retry](../lessons/storage.md), [Cooking (hs-5)](../system/mechanics.md#cooking-homestead-row-hs-5), and the hs-5 brief (`status_applied` fires from a meal).
- Verdict: **CHANGES REQUIRED** (findings 1 and 2).
- Written 2026-10-15 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. The mobile host accepts every Eat that the kernel accepts for loader-accepted content. If it cannot, the loader refuses that content.
2. The receipt check refuses narration that the kernel would not write.
3. Reopen goes through `openGame`. A failed COMMIT leaves no rows. A lost ack replays once.
4. A refusal is typed `save_corrupt`, and the save file is kept.
5. The tests use real SQLite and fail when the check is broken.

Items 3 and 4 hold. Item 1 fails (finding 1). Items 2 and 5 hold only in part (finding 2).

## Findings

1. **Blocker: lawful content turns an honest Eat into `save_corrupt`.** Cite: `mobile/authority/local-story/food-receipt.ts:21-34`.
   - The receipt copies the food rule by hand. Lines that the proposal adds after the food rule are missing from that copy.
   - Probe C, real SQLite: add a reaction on `status_applied` `fed` that runs `status.apply spoiling`. The loader accepts it.
   - The Eat commits with `[meal, fed.applied, spoiling.applied]`. The next `openGame` fails with `save_corrupt` ("invalid committed Eat").
   - This slice makes that composition possible. `decision.ts:219` gives food `status` events, and the brief requires `status_applied` to fire.
   - It is the failure that [storage.md:24-27](../lessons/storage.md) records: a validator rejecting lawful content.
   - `mechanics.md:3348` documents only the release-rename limit, so this is not a recorded known limit.
   - Probe E shows the same failure class: `alternates` on `narration.fed.applied` also gives `save_corrupt`. Line 0 had this limit before this slice.
   - Fix (question 4): [save.md:973-974](../system/save.md) binds only line 0, the item's authored key. `checked` already requires a string key on every line (`session.ts:73-74`). So drop the tail check, as the perform and read receipts do, and keep line 0. A shared food-rule helper would still miss lines added by reactions and by `vary()`, so it is not safer.
2. **Blocker (a mutant survives): order is untested.** Cite: `mobile/authority/local-story/kitchen.test.ts:36-38`. It uses one distinct status (`fed`, listed twice).
   - Mutant M2: accept any unused `applies` status, each once, in any order. It survived kitchen, food, status and r9c (`node --test`, exit 0, 9/9).
   - Failure: a check that ignores order passes the suite.
   - This finding goes away if finding 1 removes the tail check.
3. **Nit: an omitted status line is accepted.**
   - Probe B shows a silent refresh, `[meal, spoiling.applied]`, which is correct. Because a silent refresh must pass, a forged `[meal]` with the status lines removed passes too.
   - This affects narration only. The status rows come from the delta.

## Disposition proof

- Must-be-true item 4: `session.ts:60-69` throws `save_corrupt` with `newGame` offered. That path has no unlink or delete, so the file is kept.
- Baseline at 45450614: the four mobile Eat tests pass (9/9), and kernel `test/kitchen.test.ts` exits 0.
- Probe A: two distinct statuses give `[meal, fed, spoiling]` and the save reopens. Six forgeries are each refused: reorder, duplicate, extra, missing first, repeat, meal line repeated.
- Probe D: a meal that cures and applies `fed` while `fed` is not active. The cure does nothing and the applied line lands. Cure-wins was not exercised.
- Mutants, in a detached worktree; each was reverted.

| Mutant | Result |
|---|---|
| M1 `:18` no dedup | killed (duplicate forgery) |
| M2 order ignored, each status once | **survived** |
| M3 `:33` line-0 check skipped | killed (`[fish_seen, fed]`) |

- Claim reruns:
  - First review: "5 forged cases, all throw". Backed by the baseline run.
  - First review: "R4 order ignored: killed". Not backed. Resetting `next` also breaks dedup, so R4 was killed by the duplicate forgery. M2 isolates order, and it survives.
  - First review: "`applied` is schema-required" (`cartridge.schema.json:2761-2765`). Confirmed.
