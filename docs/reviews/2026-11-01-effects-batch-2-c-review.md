# Review: effects batch 2 PR C, room beds, music, storm, wind, lever, latch, ending (loka-xz76e.6, kernel_api 1.138)

- PR [#558](https://github.com/lorecrafting/lokacore/pull/558) `effects/batch-2-c` at `40886df81b0a06e73c5ccedcf4e46a54a3e36d9a`, base `d11c208e7`.
- Governing: [rulings G6, G7, G8, Facts](../design/effects-batch-2-rulings.md), [book-ui Effects](../system/book-ui.md), [plan 6, 9, 14](../design/effects-and-sound-plan.md), [contract lessons](../lessons/contracts.md), [human-made content](../decisions/owner-decision-human-made-content-2026-10-31.md).
- Reviewer: independent; authored none of the work.
- **Verdict: CHANGES REQUIRED** (two blockers).
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff completed, success.

## Must be true

1. `place.sound` and `place.exposed` project from the room's `sound` field and `exposed` tag, absent otherwise, schema-valid, kernel_api bumped; no presenter literal names a room. **Holds.**
2. Every new schema bound has a failing fixture. **Fails: S2.**
3. Deed fields come only from the receipt's committed events: no protocol or save change, replay-stable, the player's own action, an event never a label. **Partly fails: B1, S4.**
4. G6: bed cross-fade, wild fallback, silence without a throw, background stops, duck rules, piece lowers beds, fight silent, death cut, Sound and Music groups, muffle on weather only; one piece per first entry and gap. **Code holds except S5; much is unpinned: B2.**
5. G7: World page only; lightning only on storm, exposed, foreground, motion on, Flashes on, a Flash-limit gap from a wash; thunder 1 to 3 s; heavy only on a room entry's first; lever and latch. **Fails: S3, N1; unpinned: B2.**
6. G8: no new page, field or words. **Holds** (rulings prologue table is structure only).
7. Audio human-made, licensed, exact credit, "not auditioned", within budget, nothing generated. **Holds:** 46 rows (CC0 32, CC BY 14, every CC BY credit says edited, every note says not auditioned), 38.9 MB total. Files were not listened to.
8. Tests pin behaviour with independent expected values and red controls. **Fails: B2, S1.**

## Findings

**blocker B1** `mobile/authority/local-story/narration.ts:43,76` with `mobile/app/book/received.ts:143` and `mobile/app/book/presenter.ts:78-87`. The miss whisper never fires in play (book-ui.md:772). `attacker_id` is an EntityId (`round_attack.ts:58-90`, `row.body_id`), compared with `s.world.character`, a CharacterId. In all showcase transcripts, 60 `attack_result` rows, none has attacker equal to the character. All 60 are in `elapsed` receipts on the clock path, which calls `lastNarration()` with no command id, so `deedOf` never runs and `s.deed` stays unset. `narration_routing.test.ts:195-238` passes only because a fake `world: { character: 'player' }` and hand payload share one identity. Fix: compare with the body (`bodyOf`, contract lessons), route clock-path deeds, test with a real attack event's identities.

**blocker B2** Green suite on core logic the brief named. Each narrow mutant below stays green on the test files importing the module (focused baselines all 0; run list in Disposition):
- `mobile/app/book/Storm.tsx:76` `flashes: true`: Flashes off draws lightning, a photosensitivity setting with no test.
- `Storm.tsx:73` storm check removed; `:85` light on a non-World page; `:96` wind without `exposed`, and without `still`; `mobile/app/book/Leaf.tsx:33` `world` always true.
- `mobile/app/book/received.ts:143` dropping `opened`, or `lever`: latch and lever die in play, `cues.test.ts` feeds the deed directly.
- `mobile/app/book/sound.web.ts:106` no muffle filter; `:115` no muffle dB.
- `sound.web.ts:213`, `:230` background keeps beds, starts a piece.
- `sound.web.ts:229` a piece over music: a chapter theme plays, the player enters a new tag, the piece steals the bus.

`room_sound.test.ts` stubs `./Storm.tsx`, so S1's move does not close this.

**should-fix S1** `mobile/app/book/__tests__/room_sound.test.ts`. Never runs: `mobile/app/package.json:13` globs `book/*.test.ts`, and nothing imports it; the hosted ci log has no "place.sound and place.exposed" line. It passes when run alone. Failure: the Book reads another field for the bed and CI stays green. Fix: move to `book/`.

**should-fix S2** `protocol/gameview.schema.json:1120-1127`, `protocol/room.schema.json:482`. No failing fixture for the new bounds, against [contracts.md:6](../lessons/contracts.md). Replacing `const: true` with boolean, and dropping either `$ref` Key, stay green on `validate.test.ts`, `place_sound.test.ts` and `room_sound.test.ts`; `protocol/fixtures/invalid.json` is unchanged. Failure: `exposed: false` or an empty tag passes the contract and flicker reads it. (Projection itself: three mutants, all red.)

**should-fix S3** `mobile/app/book/cues.ts:113`, `mobile/app/book/stormClock.ts:48`, `Storm.tsx:65`. The Flash limit runs one way: a strike waits for an earlier wash, but a wash never waits for a strike. Strike at t, bleed-tick `hp_loss` wash at t + 300 ms: two full-page luminance changes within a second, against book-ui.md:778 and :822 ("never within the Flash limit's gap of a wash"). `cues.ts` does not read the strike time.

**should-fix S4** `mobile/authority/local-story/narration.ts:66-80`, `mobile/app/book/cueDiff.ts:155`. `opened` and `lever` do not check the actor. A press whose receipt carries a world-driven `barrier_changed` or another's `action_completed`, plus any newly usable exit, plays the latch and light haptic; book-ui.md:826 says "only when the player's own action opened it". The `ponytail` at `cueDiff.ts:146` discloses this, the brief requires own action. Fix: the barrier reveals that exit, or a writer on the event, or amend the spec with the owner.

**should-fix S5** `mobile/app/book/sound.web.ts:228-231`, `mobile/app/book/useCueSounds.ts:16-18`. Ambush or chapter on room entry: the ambience effect runs before `useCues`, so a piece starts, `entered` is spent and `lastPiece` is set, then the fight or chapter steals the bus in the same commit. A throwaway rig run shows `p-inn` started, stolen by the stinger, and no piece on a later entry of that tag; the code then holds every other tag's piece for `sound.explore.gap`, 10 minutes, for a piece nobody heard. Fix: no explore on a view with `combat` or a new chapter.

**nit N1** `Storm.tsx:57`, `stormClock.ts:32`. Combat unmounts Storm (`Leaf.tsx`), so `entry`, `heardIn` and the wind's `seen` reset: after a fight in one room the next thunder buzzes heavy and the corner lifts again, against book-ui.md:822 "only on a room entry's first".

**nit N2** `docs/design/effects-batch-2-rulings.md:40`, G2. The rulings still say lever and latch read `action_completed`, Miss is silent, and `thunder` has `haptic: 'heavy'`; code has a custom `lever` event, a whisper and no field. book-ui.md:826 "dries in the Footer" is unbuilt (filed loka-0ngum).

**nit N3** `mobile/app/book/tokens.ts:154`. `motion.bed.duration`, and `easing` on `bed`, `afterimage` and `flutter`, are read by nothing (disclosed). Delete or read.

**nit N4** PR body "Music 33.1 MB" counts exploration pieces only; all music is 34.1 MB. Still under the 40 MB budget, which `bin/check_sounds.py` does not enforce.

## Checked, no finding

- Latch ordering: press sets deed and projection in one `finished`. Lever event shape (bare `key`) is correct.
- Music off spending the entry (`sound.web.ts:228`): matches G6's "not yet entered since launch".
- Showcase diffs add only room `sound` lines; hash fixture regenerated; all 30 transcripts differ only at `ids.content_hash` (1366 rows, compared by JSON path). Tags name no presenter literal.
- PR claim "no save-format or reconciliation change": no storage, save, SQLite or migration file in the diff.
- A death with no fight: the next view restores the bed (rig run).
- PR B is not merged; `place.exposed` is there for its flicker at `view.ts:138`, no merge issue seen.
- No `/code-review` gap: the body reports `/code-review medium`.

## Disposition: mutants at this head

Sweep `bin/mutate_diff.sh origin/main` (`MUTATE_MINUTES=20`): **no rows complete; stopped by hand at 11 minutes.** Setup took about 10 minutes, then the first `view.ts` row ran the kernel test files for over a minute, so all 174 queued rows count as unrun. It did show every queued file with a green local baseline: 178 mutants, 174 queued (66 `sound.web.ts`, 21 `narration.ts`, 21 `Storm.tsx`, 19 `stormClock.ts`, 11 `received.ts`, 8 `cueDiff.ts`, 8 `sound_rig.ts`, 7 `cues.ts`, 6 `Leaf.tsx`, 5 `tokens.ts`, 2 `view.ts`), 4 NOT-UNIQUE. The handback's "baseline red, not queued" for six of those files (58 of 178 with the NOT-UNIQUE rows) does not reproduce here. Its table (19 red, 28 survived, 73 not run) is therefore neither confirmed nor refuted by this sweep; the hand mutants below are the evidence. Its `Storm.tsx` and `Leaf.tsx` survivors match B2.

Hand mutants, red: `narration.ts` lever key, opened either half, miss hit, miss attacker, deed without id; `cueDiff.ts` latch not newly, latch any place, miss when landed, lever dropped; `sound.web.ts` bed muffled, gap ignored; `stormClock.ts` wash ignored, gap 0, heavy indoors; `view.ts` sound dropped, exposed dropped, exposed always. Survivors are B2 and S2; "in fight explores" and "fade ms" also survived, dropped here as masked by the bus check and cosmetic.

## Re-check at `24a4044b3d352871698a90a6b23d851c7d8205e9` (fix commits 59f630eff, 24a4044b3)

- **Verdict: APPROVE WITH NOTES.** No blockers; two [small should-fixes](../WORKFLOW.md#small-should-fix) and the PR body to file or fix. CI at this head (`gh run list --commit`): graph-diff, ci, book-e2e completed, success.

Dispositions:

| Finding | Result | Proof |
|---|---|---|
| B1 miss | Fixed | Body id compared, fires on the clock; real round in `combat.test.ts`; press path does not double fire (`finished` sets the projection, so `background` returns on the token). Reopen does not replay (`restoredLogs` sets `narrationId`, leaves `deed` unset). Latch reads `command.payload.type`; real `open` in `d10_knowledge.test.ts`. |
| B2 tests | Fixed, see R1, R2 below | 50 hand mutants: 43 red, 1 hang (not green), 6 survived. |
| S1 test location | Fixed | `book/room_sound.test.ts` sits in the npm glob and passes. |
| S2 fixtures | Fixed | `const` loosened and each `sound` `$ref` loosened in `contracts.gen.ts`: all 3 red on `validate.test.ts`. |
| S3 Flash limit | Fixed | `lightFell` and `step` both use `performance.now()`; dropping `struck`, or `lightFell`, red. |
| S4 latch | Fixed | Door verbs only; `action_completed` comes only from the scripted action's own command (`scripted_action/rule.ts:99`), press-gated. |
| S5 quiet | Fixed | Combat and new chapter spend nothing; each mutant red. |
| N1, N3, N4 | Closed | Sky stays mounted in `Leaf.tsx`; easings read through `curveOf`; PR body sizes corrected. |
| N2 | Open, designer's call | Not reopened. |

Findings:

- **R1 (should-fix)** `mobile/app/book/Leaf.tsx:29`: `exposed={!!v.place?.exposed}` to `exposed` stays green, though `room_sound.test.ts:42` claims place.exposed reaches the sky and asserts only the bed. Scenario: a dropped or swapped prop draws lightning and wind indoors, which book-ui.md:822 and :824 forbid, or none outdoors. One assertion in the Leaf test at `storm.test.ts:81`.
- **R2 (should-fix)** `mobile/app/book/sound.web.ts:238`: `settleRoom(motion.bed.duration)` to `settleRoom(0)` stays green. Scenario: a new tag cuts hard where book-ui.md:774 says it cross-fades. One assertion on the rig's `ramps`.
- **R3 (should-fix)** PR body lines 26, 27, 30: lists `cueDiff.ts`, `received.ts` and others as not queued and says "Not done: hand-written mutants", and "no code reads" the `afterimage` and `flutter` easings (`Storm.tsx:49-50` reads them); the reported 34 of 34 is not in the body. A merge reader is misled. Docs only.
- **Nit** `mobile/authority/local-story/deed-receipt.ts:9`: comment, and the hand-back, say a lineless miss on the clock stays silent with no record. `narration.ts:45` keeps it (`!deed`) and `combat_flow.test.ts` asserts that record reaches the cues. Unreachable today: every round miss has a line (`round_flow.ts:251`). A lineless press miss would fire twice: it leaves `narrationId` unset, so the next clock walk-back returns it as new (by reading, not run).
- **Nit** `mobile/app/book/received.ts:128,130`: dropping `attack_result` or `barrier_changed` from `telling` stays green and is equivalent today: rounds and door verbs always carry a line (`barrier/rule.ts:65`). Delete them, or test them with the first nit.
- **Nit** `mobile/authority/local-story/deed-receipt.ts:33`: `lock`, `unlock` unpinned; `close` and `lock` cannot show an exit. Keep `open`, `unlock` and pin `unlock`.
- **Nit** `mobile/app/book/cue_sounds.test.ts:200`: the lever comment is orphaned above the new test; its test is at `:226`.

Not checked: `bin/mutate_diff.sh` (hand mutants only, as scoped), audio by ear. Developer's 34 of 34 not rerun as such.
