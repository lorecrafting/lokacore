# Review: quest offer names its fixture or NPC, PR #529 (loka-vx2v, kernel_api 1.129)

- PR [#529](https://github.com/lorecrafting/lokacore/pull/529) `engine/quest-offer-target` at `8dd7f0ea2e960ee71c3c864bc803b3831dfe3158`, diff `origin/main...8dd7f0ea2` (main `68028bf74`).
- Governing: `br show loka-vx2v`; [mechanics.md](../system/mechanics.md) Quest@1 and the offered-actions section (:215-219); [book-ui.md](../system/book-ui.md) (:62, :214-223, :299, :405, :452); [composition record](../system/architecture.md#building-mechanics-by-composition).
- Reviewer: independent; authored none of the work.
- Verdict: **APPROVE WITH NOTES** at `f25bdb2ce` after re-check (below); first round **CHANGES REQUIRED** at `8dd7f0ea2`: one blocker (one test assertion), one should-fix, two nits.

## Must be true (written before reading the diff)

1. A targeted offer lists only on its fixture's NoticeView or its NPC's entity entry, never in `view.actions`; a bare offer (loader-level) stays there.
2. `accept_quest` is admitted only with the target in the room and alive (else `unsupported_capability`) and seen (else `invalid_state`); a dialogue choice's `accept` reads no offer target.
3. Every offered entry's exact invocation (`target_ids` absent or empty, input `{}`) resolves through keyed admission to `{type:'accept_quest', actor_id, quest}` and is accepted; a supplied target is refused `unsupported_capability`.
4. The Book draws the card on that page with the authored label, and no World card.
5. The compiler refuses a targetless offer (`SCHEMA_VIOLATION` at `quests/<key>.offer.target`) and an unresolved target (`UNRESOLVED_REFERENCE`); all 10 sampler offers migrated; the allow-list gone.
6. kernel_api 1.129 in INSTALLED only; command schema unchanged; no frozen fixture changed; no save or delta shape change.
7. Reach counts an offer only if its target room or NPC is reachable.

Results: 2-7 hold. 1 holds in the code, but its bare half has no test (the blocker). Composition record matches: the slice reads room, living, visible and the offer definition; no new event, op, state or save row; no capability code names content.

## Findings

**blocker** `kernel/ts/src/view/invariants_view.ts:105`, test gap. `(a.quest && a.speaker)` changed to `(a.quest || a.speaker)` or to `a.quest` stays green in `bin/mutate_diff.sh` and by hand across 17 files: every test that drives `sim.ts` or `offerMaps`, plus those naming an offer. Failure: with that change `offerMaps` lists a bare offer's key, so `world_lists_no_fixture_action` fails on a bare offer in `view.actions`, the one placement mechanics.md:219 allows and the loader accepts. A green suite is a blocker, and this SURVIVED row is on a diff line with no named red test. Fix: in `kernel/ts/test/quests.test.ts`, assert the invariant is true on `world(bare)` with its offer in `view.actions`; show the mutant red.

**should-fix** `kernel/ts/src/commands/actions.ts:253` against `kernel/ts/src/mechanics/quest/lifecycle.ts:152-165` (`acceptRefused`). An offer policy now reads a different target on each path. Probe, run: an NPC offer with `offer.policy {op:'target_present'}` on the errand artifact gives the page entry `{available:true}` (policy target is the speaker) while `acceptRefused` returns `invalid_state` (no target). The Book card works and the same quest's dialogue accept is refused. The compiler accepts this once the cartridge declares `target_resolution`. The `acceptRefused` docstring ("as accept_quest's admission refuses it") is now false, and mechanics.md:401-402 says only that the dialogue accept reads no offer target, not what an offer policy reads. No sampler offer has a policy, so nothing reachable today. Fix: state it in the docstring and mechanics.md, or pass one target on both sides. Small; may merge with a Beads item.

**nit** `mobile/app/book/buttons.ts:232`. An unavailable targeted offer draws no card, while book-ui.md:214-223 and :405 say an unavailable offer listed in GameView draws unavailable. Not a regression: the same filter hid it on base and hides every unavailable notice action. Unreachable with today's content. Beads follow-up, not this slice.

**nit** PR body is stale: "content half follows", "Draft", "Book-ui proposal awaiting designer approval", and its `/code-review` range stops at `e48c8b12d`. Also `quest_offers.ts:54` claims order is not pinned, and `priority: 100` goes red in `kernel/ts/test/fixture_pages.test.ts`, so the `mutate-skip` could go. Fix in the fix round.

## Open items ruled

- `kernel/ts/src/commands/actions.ts:194`, status-barred accept with the target absent gives `unsupported_capability`: that is the "not here" code. Dismissed.
- `kernel/ts/src/commands/quest_offers.ts:24,:29-32`, hand-built artifact with an unknown detail, NPC or room: falls to World or drops, no throw. The compiler refuses all three; same posture as `detailOf`. Dismissed.
- `lib/loka/content/quests.ex:69` and `lib/loka/content/resolve.ex:139`, malformed room, detail or npc: compiled, all `SCHEMA_VIOLATION` or `UNKNOWN_FIELD` first; no guard needed. Dismissed.
- `kernel/ts/src/view/invariants_view.ts:183`, `placeAgrees` unchanged against the brief: `accept_quest` routes through `entryAgrees`; both negative agreement tests hold. Deviation correct.
- `test/loka/cartridge_journal_hash.py` edit: generator not used by regen, retired by loka-273d. No action.
- Content: each of the 10 offers targets an existing detail or NPC with a prose link in its room. Hash fixtures changed for six samplers, no frozen file. `mobile/app/stories/live/*.sql` change only the saved `kernel_api` in the lock (one file checked in full).
- Over-engineering: none. Tests follow "Writing tests" (literal expected values, a named break each).

## Test the tests

`bin/mutate_diff.sh origin/main` at the head, in a throwaway worktree, inside the timebox: 36 mutants, all run, 34 red-narrow, 2 survived, no TIMEBOX rows. The PR body reports 39, 34 and 5 at `e48c8b12d`, an earlier commit; the handback's head table was not available to this review. Survivors:

| Row | Ruling |
| --- | --- |
| `kernel/ts/src/view/action_lists.ts:334` `&&` to `\|\|` | Cleared: red by hand in `kernel/ts/test/quests.test.ts` and `kernel/ts/test/quest_dialogue.test.ts`; green in `dialogue` and `fixture_pages`. |
| `kernel/ts/src/view/invariants_view.ts:105` `&&` to `\|\|` | Still green by hand: the blocker above. |

The two `quest_offers.ts:22-23` rows reported a `SyntaxError` line as their first failure, so both were rerun by hand: red in `quests` and `quest_dialogue`.

Hand mutants, all run narrow through `bin/mutate.sh`. Red: `quests.ex` inverted `is_map_key` clause; `quests.ex` missing-target diagnostic to `[]`; `resolve.ex` npc expand identity; `quest_offers.ts` `!living` dropped; `quest_offers.ts` room filter dropped; `actions.ts` `ok` without speaker visibility; `action_lists.ts` `targetsFor` line removed; `reach.ts` npc clause; `quest_offers.ts:54` priority 100; `buttons.ts` `detail_id` removed. Survived in `quests.test.ts` and `quest_dialogue.test.ts` but red in `dialogue.test.ts`: pre-existing `action_lists.ts:79` speaker filter (not in the diff, so no blocker).

PR claims rerun: the `quests.ex` and `resolve.ex` hand rows and `buttons.ts detail_id` are red, backed; cites `quest_offers.ts:54` and `buttons.ts:232` correct.

CI at the reviewed head: graph-diff, ci and book-e2e completed success.

## Re-check of the fixes at `f25bdb2ce576570e5fdfbae961f1aa80c55684e7`

Verdict: **APPROVE WITH NOTES**. Scope: fix commit `f25bdb2ce`, the code it touched and its direct callers.

| Finding | Disposition | Proof |
| --- | --- | --- |
| Blocker `invariants_view.ts:105` | Fixed | New test `world_lists_no_fixture_action allows an untargeted offer on the World card` asserts the offer is listed and the invariant true. Both the `\|\|` and `a.quest` mutants are red in `quests.test.ts`, run by hand. |
| Should-fix `acceptRefused` | Documented, by PM ruling; no logic change | The docstring and mechanics.md:402 read true: callers are dialogue only (`rule.ts:197`, `shared.ts:238`), `holds` is false with no target, and `present` (`commands/target.ts:78`) covers both a detail and an NPC. NPC case probed in the first round; detail case read from code, not run. |
| Nit `quest_offers.ts:54` | Fixed | `mutate-skip` gone; `priority: 100` red in `fixture_pages.test.ts`, run by hand. |
| Nit PR body | Fixed | No longer draft; the stale phrases are gone; states that the `/code-review` range stops at `e48c8b12d` and that later commits had only this review. |
| Nit `buttons.ts:232` | Open | Beads follow-up, not this slice. |

New **nit** `kernel/ts/src/mechanics/dialogue/rule.ts:181`: the comment says `invalid_state` "when accept_quest would refuse it". For a `target_present` offer policy, `accept_quest` now admits while this path refuses, so the comment misleads a reader; behavior is as ruled. One-line fix whenever the file is next touched.

CI at `f25bdb2ce`: graph-diff, ci and book-e2e completed success.
