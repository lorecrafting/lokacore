# Second-opinion review: quest offer names its fixture or NPC, PR #529 (loka-vx2v, kernel_api 1.129)

- PR [#529](https://github.com/lorecrafting/lokacore/pull/529) `engine/quest-offer-target` at `f25bdb2ce576570e5fdfbae961f1aa80c55684e7`, diff `origin/main...f25bdb2ce`.
- Required because the slice touches protocol contracts ([Review count](../WORKFLOW.md)). Governing: `br show loka-vx2v`; [room page anatomy](../system/book-ui.md#room-page-anatomy); [mechanics.md](../system/mechanics.md) `accept_quest`; [protocol.md](../system/protocol.md); [cartridge.md](../system/cartridge.md) (:1121-1123).
- Reviewer: independent; authored none of the work. The [first record](2026-10-31-loka-vx2v-review.md) was read only after these findings, to avoid duplicates.

## Must be true (written before reading the diff)

1. A targeted offer is never in `view.actions`: a detail target lists on its NoticeView or board notice with `target:{kind:'none'}`; an NPC target lists on that entity's entry with `target_ids:[]`.
2. Listed exactly when admitted: absent or dead gives no entry and `unsupported_capability`; unseen gives no entry and `invalid_state`; a supplied target on an NPC offer gives `unsupported_capability`.
3. The `accept_quest {actor_id, quest}` command shape is unchanged.
4. A dialogue `accept` reads no offer target.
5. The compiler refuses a targetless offer (`SCHEMA_VIOLATION` at `quests/<key>.offer.target`) and a bad reference (`UNRESOLVED_REFERENCE`); the loader keeps `target` optional.
6. `kernel_api` 1.129 in INSTALLED only; no frozen fixture changes.
7. Reach counts an offer only if its target room or NPC is reachable; the sim still emits `accept_quest`.
8. The Book draws the authored label on the target's page.

All eight hold, with the limits under "Not run".

## Findings

**nit** `kernel/ts/test/quests.test.ts:429`. The test says the offer "is on that NPC", but no offer test puts a second occupant in the room. The speaker filter at `kernel/ts/src/view/action_lists.ts:79` stays green across the quest, dialogue, notice, fixture and transcript tests when removed; it goes red only in the talk tests, over 55 files. Failure: a later split of the talk and offer filters could list one NPC's offer on every occupant with no offer test failing, and a probe with the filter removed shows that listing. One added occupant and one assertion close it, in a later touch of that file.

**question** `lib/loka/content/quests.ex:60-89`. Should an offer target refuse a roomless population-template NPC? The compiler accepts it by reference; `kernel/ts/play/reach.ts:86` excludes roomless NPCs, so reach should report the quest unreachable. No shipped offer does this. Read, not run.

No new blocker or should-fix. Not repeated from the first record: the unavailable targeted offer with no card (open as `loka-xy1js`), the `acceptRefused` policy target, the `rule.ts:181` comment.

## Evidence, run at the reviewed head

- Agreement, both kinds: NPC here is listed on the entity only and accepted; item as NPC and unknown NPC are dropped with `unsupported_capability`; dark room NPC is unlisted with `invalid_state` and invariants hold; a failing policy gives `available:false` and `invalid_state`.
- Compiler reach: 13 malformed targets (missing room, detail or npc; integers; empty; bad kind; string; extra field; null; wrong-kind reference) all gave clean diagnostics with no crash; a full reference compiles. All 10 cartridge offers carry targets.
- Replay: transcripts for the errand quest, ferry dialogue, ferry schedule and scene are identical once `content_hash` is masked.
- Sim, seeds 1-400: `accept_quest` sent and accepted on errand (25/13), scene (36/19), journal (38/26), chapters (25/14), ferry (32/22). `kernel/ts/test/sim.ts` has no `notice_boards` branch, and no shipped offer targets a board child; scripted board actions share that gap.
- Contracts and fixtures: `elixir bin/contracts.exs --check` clean. The changed hash fixtures are chapters, errand, ferry, journal, scene and penalty; none is listed `FROZEN` in `bin/regen.sh`. `test/loka/cartridge_journal_hash.py` at the head reproduces its fixture byte for byte. Seven `mobile/app/stories/live/*.sql` change only the saved `kernel_api` (two sampled, plus a grep for the version), a regenerated stamp.
- Hand mutants, all red in focused runs: `quest_offers.ts` `living` dropped, same-room check false, detail room check true, `priority: 100` (`fixture_pages.test.ts`); `actions.ts` `(a.quest && a.speaker)` to `||` (`quests.test.ts`); `invariants_view.ts:105` same change (`quests.test.ts`); `action_lists.ts` entity target scope removed, `targetsFor` line removed; `reach.ts` detail clause true; `resolve.ex` npc expand clause removed (`content_errand_test.exs`); `buttons.ts:232` removed (`fixture_page.test.ts`).
- PR claims rerun: the `(a.quest && a.speaker)` mutant and the cites `kernel/ts/src/commands/quest_offers.ts:32` and `mobile/app/book/buttons.ts:232` are backed. The `/code-review` result is reported, with its range stopping at `e48c8b12d`.

Not run: `bin/mutate_diff.sh` (first record ran it at `8dd7f0ea2`; only the sampled mutants here). Read from code only: combat restriction and running scene remove `accept_quest`; a dark detail is not visible; a pending dialogue keeps offers; reopen rebuilds `entityIds` through `place`, so offers derive from the cartridge.

CI at `f25bdb2ce`: graph-diff, ci and book-e2e completed success.

Verdict: **APPROVE WITH NOTES**.
