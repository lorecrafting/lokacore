# Review: lawful escort parting, PR #555 (loka-vduxr.23, kernel_api 1.137)

- PR [#555](https://github.com/lorecrafting/lokacore/pull/555) `engine/escort-separation` at `8348092a3fd78a8bcace47470ad079a4562be819`.
- Governing: `br show loka-vduxr.23`, [reopen principle](../lessons/storage.md), [save pin](../system/save.md). PM ruling, owner may overturn: a following escort whose NPC dies is separated.
- Reviewer: independent; authored none of the work. List below written before reading the diff.
- **Verdict: CHANGES REQUIRED.**
- CI at this head (`gh run list --commit`): ci 41308604165, book-e2e 41308604139, graph-diff 41308636805, all success.

## Must be true

1. Every state accepted commands reach reopens, and the next Move does not throw. **Fails on retire (B1).**
2. Separation is an expected-compared following to separated, keeps identity, lands in the same decision, on NPC death, departure or quest end.
3. A forged or unbound row is still `save_corrupt`; the row binds to the latest receipt.
4. Completed stays terminal, with the quest proven resolved by the completing choice.
5. A pin bump gives an older save an explicit refusal. **Lost on merge (S1).**
6. No Elixir and TypeScript divergence; no player line without an authored key.

## Findings

- **Blocker B1**, `mobile/authority/local-story/escort-save.ts:88` with `kernel/ts/src/mechanics/quest/lifecycle.ts:120`. Lawful play bricks the save. Repeatable exchange quest (harvest sampler, infirmary, escort capability; `Source.compile` returned `{:ok,_,[]}`; `lib/loka/content/escort.ex` has no refusal): `a_offer` accept, `child_escort` rescue, `b_turn_in` exchange (row separated, quest resolved, reopen fine), harvest twice, `a_offer` accept (retire and activate). Move in session works. Reopen returns `save_corrupt`: `original()` reads the retired instance, which is gone. Quest keys `92776260-...`, row `quest_instance_id` `36aabe48-...`. Control without the escort opens. On main this shape bricks earlier, at the exchange. The PR body lists it as open and not reproduced. More sites than l.88: with l.88 and l.89 blanked reopen throws at `escort-save.ts:52`; with l.52 blanked too it is still `save_corrupt`, so a further check remains, not located (candidates: `latest()`, `dialogue-receipt.ts:186` `escortEvidence`). `terminal()` l.97 reads the same missing row for a completed escort; not played. By the reopen principle the check goes, unless the compiler refuses an escort on a repeatable quest.
- **Should-fix S1**, `kernel/ts/src/runtime/world.ts:108`. `origin/main` (`50cbbd6ad`, dev cheats, #546) is also 1.137 at `world.ts:110`. `git merge-tree` is clean, so the merge keeps 1.137: a save from main at 1.137 reopens under a changed kernel with no refusal, against [save.md:19](../system/save.md) (a contract change bumps the pin). Nothing catches it: `bin/pm_merge.sh:48` only asks for a record, and equal pins never conflict. Merge main and bump to 1.138 with the seven sql pins.

## Rulings asked for

- `if (completed.length)` deletion loses nothing: a completed row forged back to following or separated without a new receipt is still `save_corrupt`.
- Stuck state: none reached lawfully. `following()` throws only on a failed `original()`, which needs a missing quest or choice row; the sweep separates first (`parted` is true on an undefined quest, `partings` does not call `following`).
- `shared.ts:212` with l.72: a separated row is final and blocks later starts by that actor on any quest. Line 72 is unchanged by this PR. No brick. Owner question, not a finding.
- One-decision window, `proposal.ts:117`, `shared.ts:113`: harmless. Start whose own reaction fails the quest: reopen fine, Move separates, the child does not move, reopen fine.
- Stalled quest lines: child dead leaves the quest active until an author reacts; the sweep says nothing. Owner question: the prologue has one escort, no live case. `objectives_complete` keeps following and l.70 refuses Complete and Rejoin, disclosed in the PR.
- Authored lines: the sweep emits no event or line; no runtime literal added.

## Played at this head, reopen then Move

Child killed, keeper killed, npc.move, quest failed, placed row: the PR's table at `escort.test.ts:418-494`, read: each case plays, reopens, moves and reopens; mutants below prove it bites. Not rerun with my own play. Own scratch: quest resolved by reaction, deadline expiry, start window, all pass. Retire fails (B1).

## Tests

`bin/mutate_diff.sh origin/main`, MUTATE_MINUTES=8: 2 SURVIVED, 17 TIMEBOX, 1 NOT-UNIQUE; the PR ran narrow mutants instead. Both survivors (`shared.ts:123`) red by hand against the escort tests: the sweep's one-hop lookup misses them. Null control green. Hand-written against kernel and authority `escort.test.ts`, all red-narrow: quest clause `!== 'active'`, drop `!living`, co-location false, partings `'separated'`, travel guard removed, drop `?? parting(p)`, held filter, `=== 'completed'` inverted, `!same(op.value, escort)` false, terminal l.96, l.99, l.101, l.103, l.104. One survivor: delete `escort-save.ts:71`, equivalent (`receipt!.response` throws, reopen still refuses). Expected values in the table are literal; frozen fixtures untouched. No over-engineering found; `size: allow 610` accepted.

## Claims rerun

- `git grep -l escort -- cartridges` prints nothing: backed.
- "quest resolved by reaction: save_corrupt on main": at `2d781bfee` it throws `save_corrupt`: backed.

`/code-review medium` is reported, with fixes through `8348092a3` not re-reviewed. Composition record present; no capability code names content.

Not done: `terminal()` on a retired completed escort played; a walkthrough; the full suite.
