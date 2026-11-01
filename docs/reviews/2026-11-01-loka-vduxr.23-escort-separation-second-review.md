# Second opinion: escort separation, PR #555 (loka-vduxr.23, kernel_api 1.137)

- PR [#555](https://github.com/lorecrafting/lokacore/pull/555) `engine/escort-separation` at `8348092a3fd78a8bcace47470ad079a4562be819`.
- Governing: `br show loka-vduxr.23`, [storage lessons](../lessons/storage.md) (Recovery and retry, #544 rule), [escort recovery](../system/save.md#escort-and-alternate-return-recovery), [escort@1](../system/mechanics.md#escort1).
- Reviewer: independent; authored none of the work. View formed before reading any record.
- **Verdict: CHANGES REQUIRED.**
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff completed, success.

## Must be true

1. No state accepted commands reach, with an escort in any phase, gives `save_corrupt` on reopen or a permanent kernel throw. **Fails, blocker 1.**
2. A following escort is separated in the same decision by NPC death, departure or quest end; only Rejoin returns it. Holds.
3. Content with no escort: receipts unchanged. Holds; no group or op, and `reactions_sampler`, `permanent_tick` pass.
4. Reopen matches the session and the row binds to its receipt. Holds, apart from blocker 1.
5. A forged row is refused, or if loaded neither throws at launch nor persists corruption. Holds for identity and receipt forgeries; **see blocker 2** for the quest row beside a completed one.
6. Old saves get an explicit pin refusal. Holds: every story diff is `kernel_api` 1.136 to 1.137 in the pin; `release_pin` passes.

## Findings

**blocker 1** `mobile/authority/local-story/escort-save.ts:48` (`original()`, `:84-88`) with `kernel/ts/src/mechanics/quest/lifecycle.ts:120`, and `lib/loka/content/escort.ex:23`. A lawful save is refused for good.
Reproduced at this head with real saves: an escort `start` on a no-quest dialogue naming a repeatable exchange quest; accept, start, walk home, exchange turn-in (the sweep separates; reopen fine), re-accept. That decision's `quest.retire` deletes the quest row the escort row names; every command was accepted, the live session plays on (Rejoin refused `invalid_state`), and the next reopen throws `save_corrupt` on every launch.
The compiler accepts this shape: `Source.compile` gave `{:ok, _, []}` for the `repeatable: true` exchange quest with a `dialogues/healer_walk.json` escort start. `lib/loka/content/exchanges.ex:162` forbids `escort` only on the exchange's own dialogue. This is the PR's Open line "Not reproduced here"; it is now reproduced, and the bead's title and the #544 rule cover it. No shipped cartridge has escort content (`git grep -l escort -- cartridges` is empty), so nothing bricks today. By reading only, not run: main bricks earlier, at the turn-in.
Fix, either: compiler refuses an escort naming a repeatable quest (`escort.ex`, one clause and a refusal test), or `escort-save` and the kernel accept a retired quest row. Add the reopen case.

**blocker 2** `mobile/authority/local-story/escort-save.ts:96-106` (`terminal()`). Step 3: a green suite. `:96` is this PR's line. Each of these stays green on `escort.test.ts`, `kernel/ts/test/escort.test.ts`, `reactions_sampler`, `branching_forged`, `branching_reload`: `:96` to a bare `return;`; dropping `completed.length !== 1`; dropping `quest.state !== 'resolved'`; `quest.outcome` check to `false`. The forged-completed case (`escort.test.ts:571`) only reaches `latest()`. Scenario: a regression disables `terminal()`, and a forged quest row beside a completed escort loads while no test fails. Add one forged quest row red control ([storage lessons](../lessons/storage.md): each linked field), or delete `terminal()` if `latest()` is meant to be enough.

**nit** `kernel/ts/src/runtime/proposal.ts:120`. Dropping `if (!held.length) return;` survives: receipts do not change, but a no-escort decision then composes `now(p)` on every command for nothing. Only a timing test could see it; recorded only.

**nit** PR body Open cites `shared.ts:212` for "Rejoin refuses": that line closes `partings`. The refusal is in `refused()` at `shared.ts:58-83`. Other cites rerun and hold: `escort-save.ts:96`, `quest/lifecycle.ts:120`.

**nit** PR body: `/code-review medium` ran at `7f5387da5`; fixes through this head were not re-reviewed.

## Checked and fine

- Reload at each stage, each reopened and moved on: deadline failure in pulse catch-up beside a following row; lost COMMIT on the sweeping Move; `npc.move` holds following; completed then plain re-accept (no retire, two rows); forged mortal hp row refused at load, no launch throw.
- #544: no check removed here should stay; `escort-save.ts:44-45` survives because an NPC only ever transfers between rooms and entities are never deleted (read).
- #535: permanent saturated `hungry` beside a deadline, 100 hours by pulse: tick folded, quest failed, escort separated, two reopens OK. Fold and sweep landed in separate receipts, so same-decision interplay is reasoned: the sweep reads the final state after `jobs(p)`.
- Forged quest state: `failed` beside no escort row also opens, so the sweep signing a separated receipt on such a row is no new class of acceptance.
- Elixir: `compose_escort.ex` and `invariants_escort.ex` already allow following to separated; the story rule is TypeScript-only, no differential.
- `size: allow 610`: agreed; the file is 602 lines on one `setup()`.
- `reactions_sampler` fixture edit: justified, the sweep now reads a whole row. Composition record present.

## Mutants

Null control (comment) SURVIVED. Hand mutants, red: drop `?? parting(p)`; `held` empty; `held` inverted; `parted()` quest clause narrowed, off, each flip; `living` off; co-location off and flipped; `partings` status guard off; `separate` empty; `shared.ts:175`; `latest()` removed, `!same` off, revision order swapped; `:96` inverted. `bin/mutate_diff.sh origin/main` under `MUTATE_MINUTES=15`, exit 1: 5 SURVIVED (one hop; `shared.ts:123,125` cleared by the hand mutants above, `:136` not rerun), 14 TIMEBOX, 1 NOT-UNIQUE (`proposal.ts:122`); those rows not hand-run stay unrun.

## Re-check at 4ab5b92b4d4deb0f07eb5798499a8d41940f41cd

**Verdict: CHANGES REQUIRED.** One lawful, compile-accepted save is still refused for good.

CI as `gh run list --commit` shows this head: `ci` 41320483092, `book-e2e` 41320483124, `graph-diff` 41320489624, all success.

### Must be true

[Storage lesson](../lessons/storage.md): reopen refuses a row only when it does not parse or validate, identity does not bind, or the kernel would throw or hang. A state reachable by accepted commands must reopen. [save.md](../system/save.md) "Escort" lines 433-437 repeat it for the quest row: a repeatable quest's next acceptance deletes the row.

### Findings

**blocker** `mobile/authority/local-story/dialogue-receipt.ts:161` and `:163`. `resolution` still reads the current quest row, and `escortSave` reaches it for every escort choice (`escort-save.ts:49`), so a Complete's receipt stops verifying once its quest is accepted again.

Shape: a `repeatable: true` exchange quest Q, plus a second dialogue with `quest: Q` and a plain choice carrying `escort: {transition: complete, quest: Q, npc}`. `Source.compile` returns `{:ok, []}` with no warnings; the control (same dialogue without `quest`) gives `OUTCOME_MISMATCH dialogues/healer_home.choices.home.escort.quest`, so the choice was read.

Run with real saves: start, Complete (`completed`/`resolved`) reopens; re-accept is accepted (`completed`/`active`); reopen is `save_corrupt` at `session.ts:94`, permanently. `:161` fires with state `active`, outcome undefined, choice `home`.

Cause proved both ways: turning off only `:161`'s state and outcome clause still refuses, and so does adding `row.quest_instance_id ?? q![0]` at `:163`, because a plain choice has no such field and it falls back to the same current-row read; `:161` off with `:163` taking the instance from the receipt's own `quest.transition` reopens.

The stated reason is false. `0ed43539d` says `valid_choice?` "forbids escort on an exchange quest's dialogue". `lib/loka/content/exchanges.ex:59-60` applies `valid_choice?` only to a choice with `exchange`, so a sibling plain choice passes. `escort-save.ts:19` ("The quest row is not read") is false for the same call.

Fix, either: `resolution` proves the outcome from the receipt alone, which closes this and the no-escort path below (the `:161` off, `:163` from the receipt mutant reopens both runs); or compile refuses an escort choice on any dialogue of a repeatable quest (`escort.ex:22`, with a refusal test), which closes only the escort path. Add this reopen case either way.

Same refusal with no escort, pre-existing: a plain choice with a `skill.acquire` step on a sibling dialogue of the same repeatable exchange quest. Resolve reopens; re-accept is accepted (`active`); reopen is `save_corrupt`, through `skills-save.ts:28`. The run fails the same way at this head and at `origin/main` `8cfacdf7e`, and `Source.compile` accepts the shape at both with no warnings. `dialogue-save.ts:28` makes the same call for a custody transfer; read, not run. So this PR did not introduce the no-escort path, and it does not excuse the escort one: this slice's requirement is that no lawful escort save is refused. If the fix stays escort-only, file a Beads issue for the no-escort path.

**nit** PR body: `/code-review` ran at `0ed43539d`; `333537b75` and `4ab5b92b4` came after.

### First-round dispositions

| Finding | State at this head | Proof |
|---|---|---|
| blocker 1, repeat quest with a no-quest escort start | Fixed for that shape; a sibling shape remains, above | Same run as first round reopens at every stage |
| blocker 2, `terminal()` mutants survive | Moot, function deleted | `grep` hits nothing but a comment; save.md lines 433-437 rule a completed row needs only its own receipt |
| nit, `proposal.ts` early return | Fixed | Dropping `if (!held.length) return;` is now red |

### Long runs, reload after every command

- Repeatable exchange quest, 4 start cycles, 3 full repeats, 56 receipts: take, offers, start, following walk, turn-in and swap to separated, walk `ended`, re-offer, re-accept and retire, pulse, walk `retired`, Rejoin refused `invalid_state`, restart. No refusal; view and escort equal across each reload.
- Non-repeatable: following, complete, walk, keeper dead, child dead. No refusal. After the child's death, two `item.rat_corpse` entries swap order across reload. No escort logic is involved. Question, outside this slice: is that view order meant to be stable?
- Child killed while following, then separated and walked: no refusal. Deadline fail beside following, lost COMMIT on the sweeping Move, `npc.move` then Rejoin, fold beside sweep, forged quest rows beside following: all reopen.

### Old saves

A save with escort rows pinned at `kernel_api` 1.137 or 1.136 gets `pinned_release_missing` from `authority.ts:99-101`, the explicit refusal, not `save_corrupt`. Installed is 1.138. No newer pin was constructed.

### Mutants

Narrow, null control SURVIVED in both runs, no timebox rows.

Red: `shared.ts` start guard (two forms), `following()` retired guard, `escort-save.ts` start choice id, role binding, `latest`, `committedDialogue` loop, `escortEvidence` both clauses, `proposal.ts` early return, `restart` clauses in `compose_escort.ts` and `invariants_escort.ts` (each file's two clauses, against `escort_contracts.test.ts` as well).

Survived: `dialogue-receipt.ts:161` state and outcome clause. No test pins it; pin it if `:161` is kept.

Elixir `restart` was read against TypeScript and matches; not mutated. `bin/mutate_diff.sh` was not rerun for this scoped re-check.

## Re-check at `6f1822cbe9f38dad841276a7ce86827feb9fd972`

**Verdict: APPROVE WITH NOTES.** Scope: fix commit `d5b86b000` (`6f1822cbe` merges `origin/main` over it). CI at this head: `ci`, `book-e2e`, `graph-diff` completed success.

### Dispositions

| Finding | State | Proof |
|---|---|---|
| blocker C1, sibling Complete plus re-accept | Fixed | Probe: take, offers, `rescue`, `keeper_home` `home`, reopen, `keeper_offer` accept, reopen, move, reopen. All open |
| no-escort path, `skills-save.ts:28` | Fixed | Probe: skill choice on a repeatable exchange quest, resolve, reopen, re-accept, reopen. All open |
| `dialogue-receipt.ts:161` clause survives | Partly | Dropping the whole clause is red; each half alone survives, nit below |
| nit, `/code-review` head | Open | PR body still reports `0ed43539d` |

Elixir is untouched by the fix, so the compile result from the prior round stands.

### Forged repeatable saves

Answer: no throw at launch and no persisted corruption in any case run. Every open ended in a refusal (`save_corrupt`) or a save that played on and reopened; no other error type reached the launch.

- A cartridge with any `quest.exchange` replays history (`exchange-save.ts:27`). Forged quest row or receipt instance: `save_corrupt`, 9 cases; 2 more, a riddle row's instance alone, refuse earlier at `riddle-save.ts:113`. So forged repeatable saves load only when no quest has an exchange and the other `exchange-save.ts` triggers are absent.
- That shape, `repeatable` without `exchange`, skill, riddle and escort forms: quest row forged active, deleted or given a false outcome; receipt instance forged; row and receipts forged together. Those that load (and the same forged instances on one-time quests) then took close, offer, accept, turn-in, moves, a presenter screen and a reopen: no throw.
- Forged receipt instance alone on a riddle or escort, and row-plus-receipt on an escort: `save_corrupt`. On a one-time quest a forged receipt instance on a skill, and row plus receipts on a riddle, load at this head; state/outcome forgeries there still refuse.
- Pending riddle with forged instance, or quest row deleted or resolved: loads, both answers `rejected/invalid_state`, close accepted, move accepted, reopens. The sitting clears and no quest state changes.
- Restoring the row binding for one-time quests (`q[0]`) is red. The exact pre-fix `riddle-save.ts` fails only the repeatable riddle test in `escort_repeat.test.ts`; `riddle.test.ts` stays green, so that check's removal is needed for repeatable quests and unpinned for one-time ones.

### Mutants

Null control green. Run first on `escort_repeat`, `escort`, `riddle`, `branching_forged`, `branching_reload`; survivors again on the 57 test files naming forged saves, `skill.acquire`, riddles or `committedDialogue`.

Red: repeatable guard removed, whole state/outcome clause removed, `transition.instance_id` to the row's, `q[0]` binding restored, pre-fix riddle instance check restored (exact file).

Survived both runs: `state` half and `outcome` half of `:163`; `if (!d.quest)` removal at `riddle-save.ts:31`. Survived the first run only, not rerun: `transitions[0].outcome` (the event's own comparison repeats it), `resolved.length === 1`.

### Findings

**nit** `mobile/authority/local-story/dialogue-receipt.ts:163`: a one-time quest row forged `resolved` with another outcome is refused, and removing either half alone stays green. A later edit can drop one half unnoticed; the only effect is a forged save loading. Pin or delete.

**nit** `mobile/authority/local-story/riddle-save.ts:31`: removing `if (!d.quest)` stays green. Same exposure, forged row only.

**nit** PR body: `/code-review` ran at `0ed43539d`, before the fix commits.

**question** `kernel/ts/src/mechanics/dialogue/rule.ts:216`: only an `exchange` or `receive` acceptance retires the prior row, so a plain `repeatable` quest holds the old resolved row beside the new active one (dump: `homeward` resolved and active). Comments at `dialogue-receipt.ts:160`, `riddle-save.ts:30` and `escort/shared.ts:57` say the next acceptance retires it. Reopen passed in this shape, and `rule.ts` is unchanged by this PR. Is that shape meant to be lawful?

`bin/mutate_diff.sh` was not rerun for this scoped re-check. The prior long-run reload walks were not repeated, and an escort restart on a plain repeatable quest was not probed.
