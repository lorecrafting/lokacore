# Second opinion: effects batch 2 PR C, room sound, exposed, deeds, and a live play (loka-xz76e.6, kernel_api 1.138)

- PR [#558](https://github.com/lorecrafting/lokacore/pull/558) `effects/batch-2-c` at `b3cd605e9186328e918471b2e63a9c8cf51f8dcc`.
- Governing: [review count](../WORKFLOW.md#review-count), [contract lessons](../lessons/contracts.md), [rulings G2, G6, G7, Facts](../design/effects-batch-2-rulings.md), [book-ui Effects](../system/book-ui.md).
- Reviewer: independent; authored none of the work. View formed before reading the first record.
- **Verdict: CHANGES REQUIRED.** The contract holds. One blocker, a test gap under the rule that a green suite on core logic blocks (two small tests fix it); four should-fixes in the Book.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.

## Must be true (written before the diff)

1. `place.sound` and `place.exposed` are pure projections of the current room definition: no world state, save row, delta or digest moves; stable across replay and reload; `exposed` only `true` or absent. **Holds.**
2. The compile path carries `sound`; the hash fixture differs only by `sound`; transcripts, live SQL and views differ only by content hash, `sound` and the kernel_api lock. **Holds.** Hash fixture: exactly 10 differences, all `/rooms/<room>/sound`. 56 fixture, transcript and view files are identical after stripping hashes and `sound`; 7 `stories/live/*.sql` after normalising kernel_api. No delta digest moved.
3. kernel_api bump only; cartridge `at_least` unchanged; a save pinned to old content is refused, not deleted. **Holds** by diff: no storage or migration file touched. Pin refusal is existing code, not rerun.
4. Deed fields come only from committed receipt events, are never persisted, a reopen or catch-up replays no lever, latch or miss; a miss is the player's own; no label read; a dodge and a block are silent. **Holds, except S1 on the sound side.** Reload straight after an own miss: no miss or thud replayed.
5. The presenter names no room; a tag without a file plays wild, no wild is silence; death cuts; the background stops. **Holds, except S2.**

## Findings

**blocker B1** `mobile/app/book/sound.web.ts:213`, `mobile/app/book/stormClock.ts:38`. Two guards stay green when broken. `inFight || muted.sound` to `inFight && muted.sound`: `useCueSounds` calls `ambience` on every view, so from a fight's second round the bed plays under the loop, against [book-ui Fight music](../system/book-ui.md) "beds go silent". `sound.test.ts` and `sound_room.test.ts` pass: `sound_room.test.ts:49` calls no `ambience` during the fight. A scratch test (fight open, then `ambience`) is green at the head and red on this mutant. Deleting `if (!s.world || away()) return;` in `roll`: thunder sounds on a card or a hidden tab, since a strike can precede the turn by up to 3 s; `stormClock.test.ts:81` only tests the strike.

**should-fix S1** `mobile/app/book/cueDiff.ts:154,156`. The player's own miss is swallowed by an ally's blow. `dealtCues` gives `blow_dealt` for any band move, so `landed` cannot tell "a second swing that landed" from another fighter's hit, against [book-ui Fight music](../system/book-ui.md) "the player's own miss ... plays one whisper". Reproduced twice live in Gate Yard: the round reads "You miss. The blow catches you. Gil's spear finds your foe." and plays `sfx-paper-thud` and `sfx-impact`, no `sfx-miss-01`. `cues.test.ts:499` pins the drop as correct with no ally case.

**should-fix S2** `mobile/app/book/useCueSounds.ts:17-23`. After a fatal blow the bed returns about 300 ms later, over the Combat card and its held wash, because the next view has no `combat`. [Rulings G2, Waking](../design/effects-batch-2-rulings.md): "Current room's bed fades in ... when the room page shows". Live twice: pause at the fall, then `play amb-inn` 297 ms and 328 ms later (the second with rain), the fatal card and Back to World still up. Rig tests cover the cut, not the return. The comment at `sound.web.ts:286` overstates: the next view restarts it at once.

**should-fix S3** `mobile/app/book/Storm.tsx:22,92`. The light layer stops at the foot, so a strike at night draws a hard horizontal edge across the Book. It uses plain `fill`; the other under-ink layers reach under the foot (`UnderInk.tsx:38`, `bottom: -foot`) for this reason. Measured on the Storm story: layer bottom 726 of 844, peak 0.12 of `#ebe6d7`. On `dark` paper (forced composite, same geometry) the page is visibly lit above the line and `#10151e` below it. In day palette the flash is nearly invisible (disclosed). Reachable only on a storm phase; see Q1.

**should-fix S4** `mobile/app/book/sound.web.ts:132,168`. New chapter tail fade is unpinned: `name === 'chapter'` to `!==`, and `ramp(level, 0, tail)` to `1`, and `alive() &&` to `||` all stay green. A chapter cut that ends abruptly, or a tail ramp on a stopped voice, reaches the player with no test failing. Against [book-ui](../system/book-ui.md) line 685: "it fades out as it ends".

**nit N1** PR body Open line cites `book/Leaf.tsx` for the flicker reading `place.exposed`; it is `UnderInk.tsx:95`. Rerun claim not backed by that file.

**nit N2** `mobile/app/book/stormClock.ts:18-19`: the doc comment for `stormClock` sits above `windEntry`, stacked on that function's own.

**nit N3** `mobile/packages/game-view/session.ts`: the `missed` comment says "missed or was prevented"; `round_attack.ts:72-73` never carries `prevented_by` on the player's own `hit: false`.

**question Q1 (owner or designer)** Storm, Wind and the weather layer's `wind`/`storm` cannot be met in the only bundled world. Rulings Facts say exactly `rain`, `wind`, `storm`, "content must use these names", so the literals are ruled, not a defect. `cartridges/toolbox_showcase/cartridge.json:93` has `clear, frost, rain, gale, heat, drought`: a gale on `fell_top` is silent and draws no flutter. The PR body does not say so. Rename `gale` to `wind` and add a `storm` phase, or accept that these are Storybook-only until the real game?

## Live play (web preview, audio calls logged from the page; nobody listened)

Played, correct, no console errors: first gesture unlocks bed and exploration once; inn, shore, village, wild, vault beds, new tag new bed and old paused about 1 s later, same tag no restart; first item, first quest, talk with choices, map; boar fight (stinger, loop, impact, won fanfare, bed returns, level up); flee (loop falls away); goblin miss with thud once per round; deaths and waking; Sound and Music off and on; Credits; Lever Hall (`sfx-lever-01` once per pull, `sfx-latch-01` once, none on the next step); natural rain muffled at the inn, unmuffled on Fell Top, stops in a fight.

Rendered: glow indoors flickers 0.075 to 0.080 with Flashes off, steady on exposed Fell Top, steady under reduced motion; low-health vignette 0.06 steady under reduced motion, no seam, not stuck; glow no seam. Fight, Flashes off: no peak, held 0.06; reduced motion: half wash. No text animated while read. Storm story: one real strike in 65 s, peak 0.12, 1.25 s, ink above it. Wind story: corner lifts 4 px, about 0.6 s, none indoors.

Seen, not this PR: the fatal wash on the Combat card ends at a hard edge at the footer rule (`Blow.tsx`, pre-existing).

Not reached: Storm and Wind in the app (Q1), only in Storybook; thunder and heavy haptic live; lever reload live (code: press path only); a real phone, audio by ear, haptics felt; Reading sizes.

## Test the tests

Official `bin/mutate_diff.sh origin/main`: no table. My own wall-clock limit killed its parent after about 47 of 205 rows, with row 48 (`sound_rig.ts`, `resumes` to 1) hung 16 minutes; so no comparison row by row with the handback's stopped run (19 red, 28 survived, 73 not run at 40886df81). A focused list on the core files stands in, `bin/mutate.sh`, narrow tests only:

| File | Red | Survived | Other |
|---|---|---|---|
| `deed-receipt.ts` | 17 | 0 | |
| `cueDiff.ts` | 6 | 0 | |
| `narration.ts` | 0 | 0 | 2 hung (killed, counted red), 3 not run |
| `view.ts` | 2 | 0 | |
| `received.ts` | 9 | 0 | |
| `heldLayer.ts` | 2 | 0 | 1 hung (timer leak), no verdict |
| `useCueSounds.ts` | 4 | 0 | |
| `stormClock.ts` | 15 | 4 | |
| `sound.web.ts` | 60 | 7 | |

Survivors beyond B1 and S4: `heardIn` -2, `>=` to `>` at the flash gap, `<=` at the piece gap (boundaries); `opts.fadeIn ? 1 : db` (first frame of a bed at full gain, inaudible in the rig); `!on || group === 'sound'` (a harmless extra settle). `Storm.tsx` and `Leaf.tsx` not swept; the body discloses their survivors.

Planted schema violations in `contracts.gen.ts`: `place.exposed` const removed, `place.sound` `$ref` removed, room `sound` `$ref` removed: 3 of 3 red on `kernel/ts/test/validate.test.ts`. No frozen answer touched beyond the hash and `sound` above. Tests follow AGENTS.md Writing tests.

## Claims rerun

- PR body audio sizes: exploration 33.07 MB, music 34.13, all 38.86 (47 files). Backed.
- PR body flicker cite: not backed (N1).

## Over-engineering, composition

Nothing to delete. No capability names a mechanic or one piece of content. `bleedingView` moved to `view/bleed.ts`, harmless. The first record's R4 and R5 are not reopened; it had not run the browser or mutants, and does not hold B1 or S1 to S4.
