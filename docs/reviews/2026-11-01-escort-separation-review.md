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

## Re-check at 4ab5b92b4 (`4ab5b92b4d4deb0f07eb5798499a8d41940f41cd`)

Fix commits only. Verdict: **CHANGES REQUIRED**. CI at this head: ci, book-e2e, graph-diff success (`gh run list --commit`); PR CLEAN.

### Blocker B2: a repeatable quest's non-exchange Complete still bricks the save

`mobile/authority/local-story/dialogue-receipt.ts:160-162`, reached from `escort-save.ts:49`. `resolution` reads the current quest row. After re-acceptance that row is the new active instance, so a Complete's receipt reads as uncommitted.

Played on the head with a temporary test, removed afterwards: repeatable exchange quest, Complete choice without `exchange`; take coins, offer, rescue, move, `keeper_home`, choose: escort completed, quest resolved; reopen OK; `keeper_offer`, accept: quest active, escort completed; **next reopen throws `save_corrupt`** (`session.ts:94`).

The compiler accepts this content (`mix test`, temporary test on `harvest_sampler`: `{:ok, []}`). `exchanges.ex` `dialogue_choices` calls `valid_choice?` only for `exchange: true` choices, so the commit message of `0ed43539d` is wrong: `valid_choice?` refuses `escort` only on the turn-in choice, and `escort.ex` `agrees?` requires the quest on the dialogue. The same fixture with `exchange: true` gets `OUTCOME_MISMATCH`, so the control is live. The start dialogue and this Complete compile together too (`{:ok, []}`; a wrong start quest gets `UNRESOLVED_REFERENCE`). B2 is B1 not closed: the same retire, reached through a file fix commit `6d2cd9c6e` touched. The comment at `escort-save.ts:19` ("The quest row is not read") is false on this path.

No test covers it: `escort.test.ts:563` is the turn-in form. Required: a play, re-accept, reopen test of this form, and the fix. A trial of the fix passed the case end to end: for `option.escort`, skip the current-row check and take `instance_id` from the receipt's `quest.transition` (the remaining evidence checks bind it). Alternatively refuse `escort` on any choice of a repeatable quest's dialogue at compile, which would need the save check kept narrow and a spec line.

### Dispositions

- B1 (retire brick), turn-in form: fixed. Rerun: resolve, re-accept, reopen, move, restart, reopen, move: pass (`escort.test.ts:563`).
- S1 pin collision: resolved, 1.138 against main's 1.137.
- `proposal.ts:121` kept and pinned: deleting it fails `schedule.test.ts` "a root over a job budget names its limit".
- Over-budget with a following escort naming `pending_jobs` before `events`: does not matter. The limit is a side value never in the result (`proposal.ts:37`), read only as trace data (`delivery.ts:68`, `invocation.ts:151`, `save.ts:135`). The fault and its kind are the same. No finding.

### Refusals under `docs/lessons/storage.md:41-45`

No accepted command reaches any listed refusal. The reach is `committedDialogue` under `escort-save.ts:49`, not on the developer's list (B2).

- Several rows or wrong actor; body mismatch: a Story has one character, and `bodyOf` is fixed.
- Bad shape: every write is `escort.transition`, composed.
- NPC not an npc: entities are static; no op deletes one.
- NPC not in a room, by reading: `containment/react.ts:97-117`, `schedule/rule.ts:150-157`, `patrol/sequence.ts:152`, `population/behavior.ts:157`, `population/settle.ts:303`, `combat/behavior.ts:100` all name rooms; `death/sequence.ts:68,195,219` moves corpse, items and the player's body, and an NPC's death leaves it placed. No null destination exists. `refused` gives `not_present` to a roomless NPC, so it cannot start.
- No matching ChoiceRow after re-accept: resolved rows are never closed or deleted, and the rerun restarts with a new continuation.
- Row against latest receipt, receipt without row, effect without transition: `commit.ts:50` is the only receipt writer, and `transition` emits whenever `option.escort` is set.

### Narrow mutants (null control green, each reverted)

| Mutant | Result |
|---|---|
| `proposal.ts` drop the early return | killed, `schedule.test.ts` |
| `shared.ts:139` drop `retired` | killed, kernel escort |
| `shared.ts:77` drop `following` | killed, kernel escort |
| `escort-save.ts` `start?.row.choice_id` check weakened | killed, local-story escort |
| `shared.ts:219` no parting | killed, kernel and local-story |

Not done: NPC placement played beyond the first round's child-killed and `npc.move` cases; `bin/mutate_diff.sh` rerun; a non-escort non-exchange resolving choice on a repeatable quest (`resolution` serves it too, reached only through `movesItem` at `dialogue-save.ts:27`; not checked whether main behaves the same).
