# Review: room fixtures batch slices 1-3, fixture pages, detail title, World guard (loka-x6t.120, PR #464, kernel_api 1.120)

- Branch `toolbox/batch-room-fixtures`, reviewed head `7bef2a27a78a51573badb637d7c1160699ed7df9` (slices 1-3 plus the bed/transport recipe fix). The later head `d945fce18` (merge of main) is not reviewed; it does not touch the finding below.
- Governing: [docs/briefs/room-fixtures/README.md](../briefs/room-fixtures/README.md), owner decision `owner-decision-room-page-anatomy-2026-10-23.md` (on main), [book-ui.md fixture rule](../system/book-ui.md), AGENTS.md "Writing tests", [WORKFLOW review stance](../WORKFLOW.md).
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- Verdict: **CHANGES REQUIRED** (one blocker).

## Must be true (written before reading the diff)

1. Slice 1: a linked non-readable notice opens its page and sends no command; a readable one opens and reads; a card press performs once and the page stays.
2. Slice 2: no detail recipe in `view.actions`; a NoticeView for every visible detail a recipe targets (bed and transport pages included), none for an untargeted plain detail; an unavailable card lists its reason and the perform is refused alike.
3. Optional `title` (TextKey) is UNRESOLVED_REFERENCE-checked and at floor 1.120 in both kernels, with a `loader_floors.json` case red in each; `world.ts` is `1.120`.
4. `world_lists_no_fixture_action` is registered and checked each sim step.
5. Without a title the page falls back to the kind title or the description; no save impact.
6. Slice 3: titles in the showcase, hash and transcript shas re-pinned as one, lint findings with red controls.
7. Hosted CI is green on the head.

1, 2, 4, 5 and 6 hold. 3 and 7 do not (finding 1).

## Findings

1. **Blocker**: `protocol/fixtures/loader_floors.json:447`, `:1712`, `:1917` (the three `toolbox_showcase` cases, floors 1.58, 1.104 and 1.105). Slice 3 gives 35 showcase details a `title` (floor 1.120), but these cases only strip the older features, so the showcase at 1.58 / 1.104 / 1.105 is refused with KERNEL_API_RANGE_INVALID. Proof: hosted `ci` run 40078000377, job `elixir` failure, `Loka.LoaderFloorsTest` "each fixture floor" (MatchError at `test/loka/loader_floors_test.exs:35`), `ci-green` failure; locally the same test is red at the head, and `kernel/ts/test/loader_floors.test.ts` is red too (0 pass, 1 fail). Instrumented run names exactly the three showcase cases. Fix: add the title-strip edits to those cases (what `untitled()` does in `test/loka/content_showcase_test.exs`). Consequence: the PR body's "m10-m12 caught by LoaderFloorsTest" is not backed, because that test was red before any mutant; rerun the Elixir and TS title-floor mutants once it is green.
2. **Nit**: PR body "Hosted runs on e7c4a2ac1" is stale; the runs on `7bef2a27a` were cancelled after `elixir` failed.

## Developer open items, rated

- `lint.ex:186` (a link in one variant passes for all): nit. A state whose prose does not link the detail still reaches it from its World line (book-ui.md "A standalone notice opens ... from its World line when the selected description does not link it").
- `lint.ex:196` (board children, kept notices): nit, no change.
- `notice_boards.ts:35` (two `actions(id)` calls): nit, pure and cheap.
- `cartridge_variants.ts` truthiness vs Elixir `is_map_key`: dismissed. TextKey's pattern `^[a-z][a-z0-9_.]*$` (`protocol/text.schema.json:9`) forbids an empty title. The Elixir `{_, {_, [], r}}` pattern is the file-root path, used the same way in `remarks?`.
- `notices.tsx:86` (an unavailable readable treated as a fixture): dismissed. `reads()` does not filter on `available`, so a listed but refused Read still counts as a readable; only an unlisted Read falls through to the fixture path.
- Floors guard TS-only: dismissed. 1.120 is in both ladders and `Loka.LoaderFloorsTest` covers the Elixir side (shown by the restricted run under Verified). The invariant is TypeScript by design, because GameView is TypeScript.

## Verified

- sim.ts:271 is a false alarm. `view` (`sim.ts:224`, `gameView(before)`) and the offer maps (`resolved(before, ...)`) both read the world before the step.
- Bed/transport fix: mutants killed. Dropping `...recipes` beside the ride fails `transport.test.ts` "keeps its card beside the ride"; dropping it beside the bed fails `fixture_pages.test.ts` "bed detail keeps its card".
- Mutant on the page condition: dropping `!a.command ||` at `notice_boards.ts:35` fails 4 tests in `fixture_pages.test.ts`.
- Title floor, with the loop restricted to the 1.120 case in a throwaway edit: green at base in both kernels. Removing `titled` from the ladder turns `Loka.LoaderFloorsTest` and `loader_floors.test.ts` red. The floor is guarded in both kernels once finding 1 lets the loop reach that case. The unrestricted mutant runs were invalid, because the suite was red at base.
- Save impact: none, as claimed. `detailTitle` falls back by `??`, so a cartridge without titles is unchanged. The size allowances (`sim.test.ts` 579, `sim.ts` 561) each give their reason. `put` was pinned under loka-kgd.185 (cap 13) per the PM ruling.

## Slices 4-6 (Book anatomy and guard, asides retired, storylets retired)

Commits reviewed: `2f0b60e53`, `06921cc5f` (slice 4), `616dfecaa` (slice 5), `38705ef4d`, `c92eebf2d`, `6ba602b37` (slice 6). The PR head is `6ba602b37fd7eae5a11cd341132246ecd293756d`. The PM-ruling fixes are not pushed yet. Governing texts: the owner room-page anatomy call (loka-x6t.127, recorded in `docs/system/book-ui.md` at the PR head), owner calls "Remove both" (asides) and "Retire them" (storylets), `docs/briefs/room-fixtures/README.md`.

Verdict: **CHANGES REQUIRED**.

### Must be true

1. The World page draws only the title, the description with fixture links, people, items and the log. The exit warning and Continue conversation are the two listed exceptions (loka-x6t.127).
2. The guard test fails when any removed block comes back.
3. A cue logs once per visit, after narration, in projected order, and the dedupe resets on a room change.
4. A notice is reached only through its prose link, and a linked readable reads.
5. Asides and storylets are gone from both schemas, both kernels, the view and the samplers. A cartridge that still declares them is refused at load in both kernels, with a clear diagnostic.
6. No save, migration, hash or transcript change.
7. The docs carry no residue.
8. Hosted CI is green on the head.

1-6 hold. 7 and 8 do not.

### Findings

1. **Blocker**: hosted `ci` 40083445133, job `sim (showcase)` fails. `✖ 400 fixed showcase sequences ...` gives `actual: [ 'flee: commits a change with no narration line' ]`, which is check 4 at `kernel/ts/test/sim_batch.ts:122`. Slices 4-6 do not touch `sim_batch.ts` or combat, so a changed sequence path now reaches a flee that is not narrated. Per the PM ruling, the fix is to narrate flee in the kernel, not to pin it in `SILENT`. `ci-green` fails. A local `npm run test:sim:showcase` at the head also exits 1.
2. **Blocker**: hosted `book-e2e` 40083445152, job `storybook` fails at `tsc -p .storybook`. `mobile/app/stories/RoomPage.stories.tsx:61` passes `cueLine(hammering, ...)`, but `hammering` (`:56`, `as const`) has `direction: 'east'`, a plain string where the type wants the branded `Key` (TS2345). Slice 4 (`2f0b60e53`) added the story. The storybook smoke build cannot run, so `book-e2e-green` fails. The `e2e` and `walk` jobs pass.
3. **Should-fix**: the PR body does not report slices 4-6. It has no runs, no mutant table, no `/code-review` result and no 390 px screenshot of the showcase loft, which brief acceptance 4 requires. Line 3 cites the hosted runs on `e68b0d52e`, not on the head.
4. **Should-fix** (PM ruling, pending): `docs/system/book-ui.md:49` and `docs/design/interaction-patterns.md:22` still name "storylet card". The other PM rulings are also not at the head yet: lever_hall solved feedback as a log line, and the refused Read reason on a linked readable.
5. **Nit**: `mobile/app/book/presenter.ts:197`. The comment "Asides are present tense ..." now sits above a `cueLines` call, but asides are retired, so it describes code that no longer exists.
6. **Nit**: `docs/system/cartridge.md` under "Storylet declarations" has a doubled blank line after the retired note.

### Developer open items, rated

- `cartridge_variants.ts:11` (the title floor skips blueprint details): dismissed. `BlueprintDefinition` has no `details` property (`protocol/cartridge.schema.json`), so there is no blueprint detail to title.
- `lint.ex:180` (pages lint skips in-room recipes and nested room files): nit. The lint is an authoring aid, and a missed title falls back to the kind title. Revisit with loka-kgd.194.5 bundles.
- `logs.ts:100` (identical cues merge into one line): accepted. Dedupe by line text is the once-per-visit rule; two sources with the same words read as one line.
- `protocol/invariants.json:188` (`world_lists_no_fixture_action` is TS-only): dismissed. GameView is TypeScript, as the slices 1-3 ruling says.
- `notice_boards.ts:35` (double derive): nit, pure and cheap. Same rating as slices 1-3.

### Verified

- Slices 1-3 blocker fixed (`a16a54709`). `test/loka/loader_floors_test.exs` and `kernel/ts/test/loader_floors.test.ts` pass at the head, and the hosted `elixir` and `kernel` jobs succeed.
- Guard red controls in `mobile/app/book/room_anatomy.test.ts`, 5 of 5 killed:
  - restoring the cue Note block, ActionCards over `g.place`, or unlinked notice titles fails test 1;
  - dropping the `noted` check, or dropping its reset, fails test 3.
- Engine mutants, both killed. Re-admitting a scene `on` that names neither room nor detail kills each:
  - TS: `placed === 1` at `cartridge_scenes.ts:57` fails `detail_scene.test.ts` "a loaded action scene must name its room and detail".
  - Elixir: `placed != 1` at `scenes.ex:169` fails `content_refusals_test.exs`.
- Load refusal is clear in both kernels: asides are UNKNOWN_FIELD at the field and a storylet target is SCHEMA_VIOLATION at `target.kind`. TS and Elixir twins exist in `voices.test.ts`/`content_voices_test.exs` and `craft.test.ts`/`content_craft_test.exs`, and `invalid.json` adds the retired cases. kernel_api is not bumped, which the PM ruling permits.
- Focused runs at the head pass: TS voices, craft, detail_scene, light and loader_floors; mix voices, craft, refusals and loader_floors, 24/24.
- No save, migration, hash-fixture or transcript file changed in `e68b0d52e..6ba602b37`. The storylet draw was a pure function of the world (`pick`), so no state is lost.
