# Review: level-up rush B2, the level moment, PR #575 (loka-g5hh.2.6, loka-xpk3n)

- PR [#575](https://github.com/lorecrafting/lokacore/pull/575) `feat/rush-b2-moment` at `950ea477c17c2cb084744993d22bb803ed00e7b4`.
- Governing: [level-rush-rulings.md](../design/level-rush-rulings.md) (The level moment, Slice B2), [book-ui.md](../system/book-ui.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review medium` is reported in the PR body. `bin/mutate_diff.sh` not run (brief); 17 targeted mutants below.

**Verdict: APPROVE WITH NOTES.**

## Must be true (written before the diff)

1. `level_up` is additive and optional under `loka-gameview-v1`; `kernel_api` is main+1.
2. One line, one wash, one sound per reply whatever the thresholds crossed; the cue comes from the view diff.
3. Wash in `warning`, `opacity.wash`/`washStill`, no swell, first child of Page, under ink, on every page; Blow answers `hp_loss` only.
4. Level and blow share the Flash limit, level wins; Flashes off removes the wash only; the storm gap stays.
5. A chapter in the reply takes the moment: S3 cues go, line and rule stay. Death: no level wash.
6. Gilt by key, never by words; gained stays plain; the first level holds `motion.first.hold`.
7. Reopen neither replays nor loses the line; nothing new is saved.
8. No new player words.

## Checks that held

- (1) Optional is right: `GameViewSnapshot` keeps the tag for an optional field, and a required one takes a new tag. `kernel_api` 1.146 on main, 1.147 here. A view without `level_up` needs no test: `protocol/cartridge.schema.json` requires it once `levelling` is on, so it is unreachable from a valid cartridge. Probed anyway: the line stays plain, the cue, wash and sound still play, a keyless line never gilds.
- (2, 4, 5) Probed through `cuesOf` and `step`: two levels in one reply give one cue; level and blow in one reply give level `wash:true`, blow `wash:false`; level and chapter fire only chapter; a fatal reply fires `hp_loss` and `death`, no level.
- (3) Stories run in the browser: both reach peak about 0.18 and return to 0, `rgb(132, 85, 18)` (`warning`), pointer events none, first child, no transform.
- (6) Mutants below. The first level: `first` set only from level 1.
- (7) Restored line is drawn at once with no hold, no cue on the first view, not re-read. Killed mid-moment loses only the effects.
- Catch-up after absence: no cue (`was` undefined), line kept as words in the recap, by design.
- (8) Stories use neutral "Title" and "Continue"; no prose in the diff beyond authored keys.
- `rush_lines.test.ts:96` fix is not fitted: it asserts the real `SkillsPage` text. Red on main 778b4a32e, green here, red when the rank is removed from `SkillsPage`.
- Mutants, all killed: level leaves wash set, Blow on any cue, LevelWash on any cue, first at any level, log flattened, no first hold, gilt skips level, level line italic, wash ignores gap, level leaves the clock, reduced at full, wash unmounted, gild by `!=`, rank row, `level_up` dropped from `levellingView` (`levelling.test.ts`, with a precompiled artifact).
- Survivor, not a finding on its own: away log keeps objects, written with `as any`. The natural form, `away.log.push(...said)`, is TS2345 at `presenter.ts:110`. The gate is `bin/prepush.sh:34` (`MOBILE_TSC`); hosted CI does not typecheck `mobile/app`, so this holds only through the push gate.
- Fixtures: `protocol/fixtures` untouched. 33 `mobile/app/stories/views/*.json` change by +2/-1 each; the hunk read adds only `level_up` (generator `npm run stories:views`). No expected value moved in `levelling.test.ts` beyond the new field. `lib` and `cartridges/levelling_sampler` are unchanged, so the artifact compiled from main is the branch's.
- PR claims rerun: mobile tests red on main until this merges (held); `kernel_api` main+1 at `world.ts:110` (held).

## Findings

All nits; none blocks. Disposition: open for the developer or PM.

1. nit, `docs/system/book-ui.md:781`: says "the gilt colour" where the approved paste (rulings:169) says "`warning`". If gilt ever gets its own token, the doc points away from the code.
2. nit, `mobile/app/book/level_wash.test.ts:172`: comment claims "an away recap stays words" and the test asserts only the room log. The check is really tsc's at the push gate, not this test's.
3. nit, `mobile/app/stories/LevelWash.stories.tsx:45`: comment says "or swells the page"; the next line checks only pointer events. `level_wash.test.ts` holds the swell.
4. question, `mobile/app/book/cues.ts:163`: a level arriving while a blow plays and another is pending is dropped: no sound, wash or haptic; line and rule stay. Existing queue rule; the rulings name only the same-reply case. Scenario: two blows, then a killing level within 500 ms. Designer to decide if a level may be dropped.
5. question, `mobile/app/book/Combat.tsx:181`: `RunningHead` sits outside `Page`, so the level wash stops at the head band where the blow wash covers it. The mount is what the ruling prescribes; not seen in a story with the head. Designer's eye at next playtest.
