# Review: status icons below the line, smaller, drawn with Skia, PR #616 (loka-x6t.134)

- PR [#616](https://github.com/lorecrafting/lokacore/pull/616) `polish/status-icons` at `467452b84a9bee27f2f3e56df752edd95c49941d`.
- Governing: [status-line rulings](../design/status-line-rulings.md) "Below the line, smaller, drawn" and "Drawings"; [book-ui Conditions details](../system/book-ui.md#conditions-details); [AGENTS.md Writing tests](../../AGENTS.md); [designer record](../decisions/owner-decision-designer-opus-2026-10-21.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci success, book-e2e success, graph-diff success.
- `/code-review medium` is reported in the PR body.

## Must be true (written before the diff)

1. Status block order: line, experience rule, icon row, pending; the row takes no height when empty; spirit and reverie still hide it.
2. Disc 22, glyph 14, box 44, ring 28 (the rise card too); the +N disc keeps `type.label`.
3. Every drawing: stroke 2.5, round caps and joins, no fill, ink inside 3 to 21, at most four strokes, keyed by label text key; chilled shares cold; a label with no drawing gets its polarity's fallback.
4. Every cartridge status the row can show has a drawing; the check fails on an unmapped label.
5. Skia is imported only behind `canDraw()`; no new dependency; the glyph is `aria-hidden` and the icon keeps its name and tip.

## Checks that held

- (1) `Status.tsx:104-115` order; `experience_rule.test.ts` and `keyboard.test.ts` go red when the rule is moved below the row (hand mutant, 3 failures). `Book.tsx:264-268` returns null for spirit and treatment; `keyboard.test.ts:370` covers it. Plain story pins zero row height.
- (2) `tokens.ts:122` killed by the ring test (`mutate_diff` row). Ring 28 on the rise card is ruled ("the rise card's ring too"); the Tooltip over the status line and a two-digit +N touching its edge are ruled accepted.
- (3) A CanvasKit script over all 41 paths and the 3 fallbacks: every ink extent inside 3 to 21 (wanted's pin tight top is 4.5, ink 3.25, so the brief's 2.5 does not occur); `warm` has five `M` commands, rays counting as one by the ruling. All parse with `Path.MakeFromSVGString`.
- (4) Red controls: renaming `condition.afraid` and dropping `spoiling` from the never list each fail `status_glyphs.test.ts`.
- (5) `canDraw.ts`, lazy import, lint whitelist; `mutate_diff origin/main`: 20 mutants, 4 red-narrow, 16 SURVIVED, matching the PR table. Hand mutant swapping `glyphs[label] ?? fallback[look]` is red.
- Screenshots (light and dark): PrologueNarrow, SixNarrow, Overflow, Drawings, Combat bleeding. Row below the line, six 22 px discs fit at 360 px, drawings legible at 14 px, dark ink on debuff discs correct.

## Findings

1. Should-fix, `mobile/app/stories/StatusIcon.stories.tsx:289` (Drawings). 117 `Canvas` each keep a live WebGL context; Chrome caps about 16, so 101 report `isContextLost()` and their discs render blank (my screenshot shows only the last 16 drawn). The play asserts canvas count and path parsing only, so it stays green. The designer's contact sheet cannot be made from this story. Fix: `__destroyWebGLContextAfterRender` on the `Canvas` in `StatusGlyph.tsx:16` (Skia's static renderer draws through an OffscreenCanvas and releases the context), or split the story.
2. Should-fix, `mobile/app/stories/StatusLine.stories.tsx:141`. The story's bleeding label is `'bleeding'`; the view's is `'condition.bleeding'` (`kernel/ts/src/view/bleed.ts:49`). Bleeding, PrologueNarrow and SixNarrow show the debuff chevron where the prologue's first icon should be the drop; the ruled slice test "five icons, bleeding first" is judged on a wrong picture. One-word fix.
3. Should-fix, `mobile/app/book/StatusIcon.tsx:375` with `keyboard.test.ts:411`. The only runtime branch of the slice, the no-CanvasKit side of `canDraw() &&`, has no test: hand mutant `canDraw() && (` to `true && (` survives, and the diff-derived `=== -> !==` in `canDraw.ts:3` survives. A later edit that drops the gate makes the lazy Skia import run with no CanvasKit in a no-WASM browser. Add one case without `CanvasKit`: the disc has no glyph child.
4. Nit, `mobile/app/book/StatusIcon.tsx:375`. When CanvasKit fails to load on web (open item a), the disc is empty; name and tip stay. The same degrade the page curl accepts (`App.web.tsx:8`); native always draws. Accepted, noted.
5. Nit, `mobile/app/book/keyboard.test.ts:445`. Expected drawings are read from `fallback` and `glyphs`, so a buff and debuff fallback swap survives; the mapping is the intent and the contact sheet checks the pictures. Accepted.
6. Nit, `mobile/app/stories/StatusIcon.stories.tsx:14` and `StatusLine.stories.tsx:16`. The same `loadSkia` loader twice, and a third time in `screen.tsx:68`; export one.

Open items ruled: (b) ring 28 on the rise card is intended by the ruling; (c), (d) ruled accepted; (e) not a violation; (f) is finding 1; (g) the 16 survivors are path numbers and the two glyph constants, design data, acceptable.

## Verdict

CHANGES REQUIRED: findings 1 to 3, one fix round. Findings 2 and 3 are small; finding 1 changes the renderer.
