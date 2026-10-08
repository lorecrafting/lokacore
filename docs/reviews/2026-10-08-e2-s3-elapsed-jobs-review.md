# Review: E2 S3 elapsed jobs (families 3 and 5 on r9c_interactions)

- PR #316, branch `e2/s3-elapsed-jobs`, exact head reviewed `e095655aac7fc139055171e101e01c5368fc9650`. Hosted CI green.
- Reviewer: fresh independent Opus. Governing: [E2 slice plan](../briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md) S3, exit criteria 2 and 5, "Rules for every slice"; [E2 brief](../briefs/chapter-one/chapter-one-e2-r9c-interactions-brief-2026-10-05.md) rows 66 and 68; `mechanics.md` schedule@1 `job_complete_owned_by_run`; `save.md` Durable elapsed sessions, Commit/fence/reconcile.

## Verdict: APPROVE WITH NOTES

## Requirements written before reading the diff
1. Rows 66 and 68 run in the real kernel. Durable steps run through `openStory` and real SQLite, with a cold reopen before each next consumer, and a replay that changes no row.
2. Money ledger player+Peg+Maud = 50 at every step, final 0/33/17, meal stock 3, cask 3. These literals come from content.
3. Water changes only through Fill and Drink, and Pour conserves it. Torch + oil = 14400 - burned.
4. Elapsed delivery advances the clock and runs due jobs while the dream checkpoint is open. `dream_seen` and quest resolution happen only at the final ack, once, and also once after replay.
5. Equal-time continuations run in `(due_time, job_id)` order in both orders and keep `job_complete_owned_by_run`.
6. RNG stays `[1,2,3,4]` when nothing draws. Combat pins are labelled and their draw counts justified.
7. Each press is taken from GameView by key. No content, fixture or source edits. Scope rules hold.

## Check against the list
- 1-7 hold. The diff touches only the two new test files (`git diff --stat`). Authority `invoke` (`mobile/authority/local-story/r9c_elapsed_jobs.test.ts:77-99`) cold-reopens, compares the encoded state, replays the invocation and compares `state_row`. `elapse` (:144-156) does the same for windows.
- Both orders are real. The Willow pass (own population job before sight) and the Oak pass (sight first) are asserted at `kernel/ts/test/r9c_elapsed_jobs.test.ts:418`. My mutant R1 below fails **only** in the Willow pass, so the two passes are not one order asserted twice.
- View to invocation: Buy is pressed from the shop row (`buy.available`, projected `price`), and dialogue Choose from the pending-choice option (`available`, `patrol`). This matches the protocol: `choose` is a pending-choice answer (`protocol.md` ActionSet, "answers to a pending choice") and Buy is a shop row. The established pattern does the same (`e1_world.ts:69`, `commerce.test.ts:298`, `e1_watch_rounds.ts:25`). The aliased keys `rent_lantern_room`, `eat_lantern_meal`, `drink_lantern_ale`, `dream_next` and `dream_choose` are read from the view. View-to-invocation checking is not weakened.

## Mutants (detached worktree, source restored after each)
| Mutant | Kernel new file | Authority new file |
|---|---|---|
| M1 (dev) `runtime/proposal.ts:253` `cmp(a,b)`→`cmp(b,a)` | red (:434, order only) | green (expected: Oak order only) |
| M2 (dev) `service/shared.ts:105` drop `...consumed.ops` | red | red |
| R1 (mine) `population/behavior.ts:142` sight ignores whether the player is still beside the deer | red at :419, `conflicting_write` (Willow pass) | **green** |
| R2 (mine) `patrol/sequence.ts:93,181` paused rows travel and join without awaiting | red at :375 | red |

## Findings
- **nit** `kernel/ts/test/r9c_elapsed_jobs.test.ts:213`: the comment says "each exit's offer equals its keyed admission, lit and dark", but in the dark only the refused `down` is invoked. The torch is relit at :231 before `up` is pressed. Failure: a defect where darkness refuses movement while GameView still advertises `up` as available passes this test. The linked `light.test.ts` covers it, so either narrow the comment or press `up` while dark.
- **nit** `mobile/authority/local-story/r9c_elapsed_jobs.test.ts:297-305`: the durable deer test covers only the Oak order and does not assert which order it is in. R1 shows that a Willow-order defect survives the durable file. Acceptance 6 is met at the kernel layer. S5 should not count this file as both-order coverage.

## Disputed code-review findings (PR body)
1. `'s3'` scope as a regression pin: **agree**. The order relation is asserted (:418), so drift fails loudly.
2. `newId` restarting on reopen: **agree**. It follows `crows.test.ts`, and the invocation counter `n` survives reopen (closure), so IDs never repeat.
3. Duplicate walker/helpers: **agree**. The brief bars a shared file.
4. Walker owner inference: **agree**. Every pressed key resolves to one offer here, and the `rest` duplicates are both targetless.
5. Runtime about 4 s: **agree**, acceptable.
