# Review: Book treatments T1 (spirit extracted, reverie added), PR #611 (loka-wfrgk.9)

- PR [#611](https://github.com/lorecrafting/lokacore/pull/611) `editor/t1-treatments` at `3ee04bd4a78679b4c9633878eb09887020bfaf1e` (merge-base `22261da3c`).
- Scope: contract slice. Optional `treatment` (`reverie`) on a modal `SceneDefinition` (`protocol/scene.schema.json:63`, `schemas/source/defs.schema.json`) and on `SceneView` (`protocol/gameview.schema.json:2167`, `contracts.gen.ts`); kernel_api 1.154 to 1.155; regenerated sampler fixture, transcript and story saves; the Book's `TREATMENTS` registry, `ScenePage.tsx`, `useArrival`, the silent room.
- Governing: [book-ui.md Book treatments](../system/book-ui.md#book-treatments), [rulings](../design/book-treatments-rulings.md) (amended `0bd4539a2`), [owner decision](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md#book-treatments), [design doc §11](../rnd/gui-editor-design-2026-11-04.md), [AGENTS.md Writing tests](../../AGENTS.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci success, book-e2e success, graph-diff success.
- `/code-review medium` is reported in the PR body.

## Must be true (written before the diff)

1. `treatment` is `enum ["reverie"]` on the modal SceneDefinition branch and on SceneView, both `additionalProperties: false` kept; an untreated scene carries no key; kernel_api one above main; regen consistent; an artifact without the key (toolbox_showcase) is unchanged.
2. Spirit is a registry row only: revival's look, chrome and muffle behave as on main.
3. No clock ever sends Continue; only the engine's offered button advances.
4. The contrast check iterates the registry, holds parity with the schema enum plus the implicit spirit, keeps every text role at 4.5:1 on the four palettes and two same-polarity blends; night 0.08 fails `dark.warning`.
5. Inside a reverie: no running head, no status row, no footer (catching up included); reduced motion and Flashes off unchanged; a screen reader has line and Continue at once; Continue's kept place is invisible, not pressable, not focusable.
6. Sound: bed, weather and music fade over `motion.bed` on the turn in; nothing plays inside (page turns and Continue included); the opening action's cues are dropped for good; the next bed opens after the turn out; the selection haptic stays.
7. A fault shows the scene plain; the sampler lives in `scene_sampler`; no capability code names content.

## Checks that held

- (1) `scene.schema.json:63` and `gameview.schema.json:2167` carry the enum; the non-modal oneOf branch does not (no step op). `scene/shared.ts:41` spreads `...(s.treatment && {treatment})`. `world.ts` 1.154 to 1.155; `scene_sampler/cartridge.json` `at_least` 1.155; `cartridge_scene_hash.json` adds only `rope_reverie` and its fact; `scene.jsonl` changes only `content_hash`; seven story saves re-pinned; `toolbox_showcase` and its fixtures untouched. `scene.test.ts` pins the view (`treatment: 'reverie'`) by hand and refuses `dream`; `content_scenes_test.exs` refuses `dream` at the compiler.
- (2) `heldLayer.ts:22` keeps the precedence (`treatment ?? fatal ?? vignette ?? glow`); `UnderInk.tsx` `ghost`/`wash` logic for spirit is the same sequence as main; `Body.tsx:74`, `Book.tsx:267`, `Leaf.tsx:32` gates reduce to main's for `spirit`.
- (3) `card.ts:128` `cardClock(timer, () => done(true), ...)`: `done` sets shared values and `setFull`, never presses; `ScenePage.tsx:58` the only `press` is Continue's `onPress`.
- (4) `heldLayer.test.ts` loops `Object.keys(TREATMENTS)` over 4 palettes + 2 blends and walks both schemas for `treatment.enum`. Independent computation (`#f6e6b4` over `#10151e`, `#d0712a`): 0.06 gives 4.65, 0.08 gives 4.42.
- (5) `Body.tsx:74` RunningHead off; `Book.tsx:267` Bottom null (catching up included); `Leaf.tsx:32` Storm draws nothing in a scene; `card.ts:122` `ReduceMotion.Never`; `card.ts:119` reader completes at once; `ScenePage.tsx:19` `kept` = pointerEvents none, aria-hidden, no-hide-descendants, inert, over `shown` at opacity 0.
- (6) `sound.web.ts` `settleRoom` silent branch fades bed and weather, `fade(ms)` music with `clearTimeout(fading)`; `:40` unlock guards `!room.silent`; `useCueSounds.ts:28,39,42` quiet `'silent'`, no turn sound, cues silent; `cues.ts:266` `advance(silent ? [] : ...)`; `ContinueButton` uses `usePress('selection')` (haptic only).
- (7) `presenter.ts:257` clears treatment under a fault; sampler at `cartridges/scene_sampler/scenes/rope_reverie.json`; `heldLayer.ts` names no cartridge content.
- Mutants: `bin/mutate_diff.sh origin/main` (30 min): 34 mutants, 33 run, red-narrow 31, SURVIVED 2 (`Book.tsx:267` `||` to `&&` #1, #2), NOT-UNIQUE 1 (`card.ts:125`). Fewer survivors than the PR's table (its `UnderInk.tsx:99`, `card.ts:103/110/118` rows are red here). By hand (`bin/mutate.sh`), all six red: `tokens.ts` night 0.06 to 0.08 (heldLayer.test.ts: the red control); `Book.tsx:267` drop `!!p.screen.treatment` (treatment.test.ts: PR claim rerun, holds, clears the two survivors); `sound.web.ts:40` drop `!room.silent` (sound_room.test.ts: PR claim rerun, holds); `card.ts:107` drop `setFull(true)` (effects_turn.test.ts); `heldLayer.ts:22` fatal before treatment (heldLayer/treatment/page_life); `presenter.ts:257` drop the fault guard (treatment.test.ts).
- Stories (`ChapterPages.stories.tsx` ReverieArriving / ReverieShown) assert Continue absent while arriving and visible after `lag + duration + settle`, as the rulings say; book-e2e is green at this head. No screenshots are attached to the PR (nit below).
- Cross-slice (not findings here): PR #610's `GET /schema/<dir>` reads `schemas/source/defs.schema.json` at request time, so `treatment` is served once both merge; vduxr.51's text key hooks `words.ts` `worded.note` on the text function, which `ScenePage` calls (`p.text(scene.line)`), so no T1 change is needed.

## Findings

No blocker, no should-fix.

**nit** `mobile/app/book/ScenePage.tsx:44`: the key is `scene.key:index`, so a fault mid-rise does not remount `Scene`; `useArrival` keeps `full` false and the treated `Pressable` is gone, so for up to `lag + 2400 ms` Continue is drawn plain but invisible and inert, and a tap no longer completes it. The clock's `done(true)` then shows it. Converges; the PR body's "remounts the page plain" (ScenePage.tsx:63 note) is inaccurate. Adding `p.treatment` to the key would make the note true.

**nit** `mobile/app/book/UnderInk.tsx:135-136`: the doc comment says a treatment's layer fades out "when it ends over `motion.palette`". True of spirit; the reverie's layer leaves with the turn (book-ui.md "gone with the turn off its last"), since `ScenePage` remounts per line. One clause.

**nit** PR #611 body: a Book UI slice with no screenshot of the reverie by day and by night; the stories exist and book-e2e passes, so the rulings' numbers stand in for the picture.

**nit** (known, PR body) `mobile/app/book/card.ts:107`: the rise is not paused in the background; book-ui.md says it should be. Not re-raised.

## Verdict

APPROVE WITH NOTES. Record branch `review-611`.
