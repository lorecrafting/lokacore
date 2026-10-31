# Review: polish session 2026-10-30, PR #527

- PR [#527](https://github.com/lorecrafting/lokacore/pull/527) `polish/session-2026-10-30` at `a12f382817170f2d2b05766735f63c465b78df51`, diff `origin/main...a12f38281`.
- Items: loka-3751, 512o, hvfj, e3xq, 462d, 2qk5, lsqi, evzt, wz6f; owner door ruling option C.
- Governing: [book-ui.md](../system/book-ui.md) (Minimap, Map and presentation controls; Verbs the Book does not draw; Word bar; Unavailable actions); AGENTS.md "Writing tests"; [WORKFLOW.md](../WORKFLOW.md) review stance. Owner approval in the live session is the design review.
- Reviewer: independent; authored none of the work.
- Verdict: **CHANGES REQUIRED** (four blockers: one product gap, three CI-red files).

## Must be true (written before reading the diff)

1. Every action the GameView offers has a Book control, or is listed in "Verbs the Book does not draw" with a dated ruling; the stranded-verb check enforces that list.
2. Doors: no Close or Lock control; the joystick presses Unlock, else Open; a refused door logs one line and walks nowhere.
3. Spells are cast from the Character page; an accepted cast returns to World; a refused word is the unavailable form with its reason.
4. Tap hit areas stay at least `size.touch` and do not overlap the next line upward; a11y names unchanged.
5. Tests dropped from pass1_ui3, polish_detail and arrest are covered elsewhere or describe removed behaviour.
6. The Map lint rules fail on a planted violation.
7. book-ui.md matches the code; rulings are dated and paraphrases marked.

Results: 2, 3, 6 hold; 5 holds for the Book tests but tests outside `mobile/app/book` were not updated (findings 2, 3); 7 holds with a nit; 4 is unproven (its story does not typecheck, finding 4); 1 does not (finding 1).

## Findings

1. **Blocker, `mobile/app/book/sections.tsx:165-175` (MapPage) with `mobile/app/book/model.ts:130`.** `group()` still sorts targetless room actions into `g.place`; on main MapPage drew them (`p.g.place.map(... ActionCard)`), at the head no page consumes `g.place` (Book.tsx:192 is the only `group()` caller). Failure: `penalty_sampler_hash` offers "Agree to find the den" (`accept_quest`, giverless quest) in the start room; no World, look, Contents or Map page draws it, so the quest cannot be accepted from the Book. The stranded check (`polish-book.test.ts:63-76`) covers door verbs only, so the suite stays green; `c1.test.ts:72,172` and `model.test.ts:51,91` assert on `g.place`, a field nothing draws. book-ui.md "Verbs the Book does not draw" does not list place actions. Fix is the PM's or owner's call: give place actions a home, or rule them undrawn in that section and drop `g.place`.
2. **Blocker, `kernel/ts/test/c6_source_acceptance.test.ts:198`.** CI `ci` run 41184452054 job kernel: expected `'Next checkpoint: Glade.'`, actual `'Your next checkpoint is Glade.'`. The lsqi colon sweep changed the wording; this test was not updated.
3. **Blocker, `mobile/authority/local-story/smoke.test.ts:402`.** Same run, job mobile: expected `'(start over: attempt to write a readonly database)'`, actual `{ text: 'Start over fails. attempt to write a readonly database', event: true }` (the presenter.ts start-over change).
4. **Blocker, `mobile/app/stories/SectionPages.stories.tsx:122` and `mobile/app/stories/NpcPage.stories.tsx:184`.** `book-e2e` run 41184451950, `storybook:smoke` tsc: TS2339 `Property 'open' does not exist on type '{}'` and TS2322 `Element[]` not assignable to `ArgsStoryFn`. Storybook never builds, so the ContentsEntries story, the only behavioural proof of the 462d Tap bleed, has not run in CI.
5. **Nit, PR body.** No `/code-review` result and no mutation table; only commit titles.
6. **Nit, `docs/system/book-ui.md:246-248`.** "...not drawn (...);" runs into a capitalised "An authored Knock", and "The reader actions name the reason too" follows the stranded-check clause with no subject it refers to.
7. **Note, `lint/rules/mobile-book-map-*.yml`.** Both rules ban `ActionCard` only; a `Control` or `Pressable` on MapPage would pass. Within the brief; no change asked.

## Evidence

- CI on `a12f38281` (`gh run list --commit`): graph-diff success; ci 41184452054 **failure** (kernel, mobile); book-e2e 41184451950 **failure** (storybook tsc).
- `bin/mutate_diff.sh origin/main` at the head (worktree with deps and `_build`): 98 mutants, 67 run: red-narrow 25, SURVIVED 42, NO-TESTS 15, BASELINE-RED 16. The BASELINE-RED rows (`received.ts`, `logs.ts`, `presenter.ts`) came from load (about 12) during the run: their 24 importer tests rerun alone pass 139/139. Survivors are mostly `DiscoveredMap.tsx` geometry and the `Menu.tsx:177-185` and `skills.tsx:159-186` guards, which are covered by stories, not node tests. The PR carries no table to compare against.
- Hand mutants, each run alone and reverted (`git status` clean after each):
  - `Footer.tsx:106` doorPick `['unlock']` only -> `keyboard.test.ts` red ("web keyboard uses offered exits ...").
  - `reasons.ts:18` HIDDEN empty -> `reasons.test.ts` red ("an unavailable card hides for a permanent refusal ..."); `hostile_refusal.test.ts` stays green.
  - `received.ts:190` drops "You learn" -> `pass2_book.test.ts` red.
  - `skills.tsx:159` `=== 'cast'` -> `!==` -> `word_bar.test.ts` red ("spell words: refused ones list their reason ...").
  - Stranded check: `UNDRAWN_DOOR_VERBS` without `close`, run over the 30 harness tests -> red: `door verb Close the hut door (north) has no control` (and arrest, doors sampler).
  - `Menu.tsx:179` lid `!== 'close'`, scoped `vitest run stories/ItemPage.stories.tsx -t Inside`: not run (the worktree's symlinked node_modules fails the vite import). Unverified.
- Map lint: `ast-grep test --skip-snapshot-tests --filter mobile-book-map` passes, so both rules fire on their invalid cases.
- Probe (book harness, `penalty_sampler_hash` start room): `group().place` = ["Agree to find the den"]; drawn World labels are "Hall, look", "standing, change position" and the Contents hp line; the look page and Map draw nothing more.
- PR claims rerun: "MapPage no-ActionCard lint" is backed (lint test above). "a Tap bleeds below only, so each Contents entry opens its own page" is not backed by any green run: its only behavioural test is the ContentsEntries story, which fails tsc (finding 4).
- Rated, no finding: spells (cast from Character, accepted cast returns to World, refused card with its reason; `word_bar.test.ts:87-122`); InsidePage lid foot and Put cards (code read plus the `Inside` story); the dropped pass1_ui3/polish_detail Map-Read tests (the signpost Read is still reachable through the fixture link); Knock claim (`gate_sampler` knock is an authored detail action; no cartridge declares an exit knock).
