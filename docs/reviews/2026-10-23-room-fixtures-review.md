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
- Floors guard TS-only: dismissed. 1.120 is in both ladders and `Loka.LoaderFloorsTest` covers the Elixir side once finding 1 is fixed. The invariant is TypeScript by design, because GameView is TypeScript.

## Verified

- sim.ts:271 is a false alarm. `view` (`sim.ts:224`, `gameView(before)`) and the offer maps (`resolved(before, ...)`) both read the world before the step.
- Bed/transport fix: mutants killed. Dropping `...recipes` beside the ride fails `transport.test.ts` "keeps its card beside the ride"; dropping it beside the bed fails `fixture_pages.test.ts` "bed detail keeps its card".
- Mutant on the page condition: dropping `!a.command ||` at `notice_boards.ts:35` fails 4 tests in `fixture_pages.test.ts`.
- Mutants on the title floor, in the Elixir ladder and the TS ladder: invalid. Both suites were already red at base (finding 1).
- Save impact: none, as claimed. `detailTitle` falls back by `??`, so a cartridge without titles is unchanged. The size allowances (`sim.test.ts` 579, `sim.ts` 561) each give their reason. `put` was pinned under loka-kgd.185 (cap 13) per the PM ruling.
