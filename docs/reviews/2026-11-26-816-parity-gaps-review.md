# Review: Builder parity gaps, story row sheets and inspector header (PR #816, loka-hcnlh.71)

- PR #816, branch `builder/71-parity-gaps`. Reviewed at `b7e2f42cf3a4c02030d3a8bb31e5f29c5477f62e`, including the fix commits after the self-review (`2a92de179`, `b7e2f42cf`).
- Governing: `docs/CHECKS.md:91` (parity rows); [in-game builder plan, Appendix A](../rnd/in-game-builder-mode-2026-11-19.md) (story-row-sheets, inspector header `tools/author-panel/src/right.tsx:27-66`); [book-ui.md](../system/book-ui.md) Room sheet :1019, Story row acts :1080, Why :1129, Step :1135; [BOOK-UI-COMPONENTS.md:84](../BOOK-UI-COMPONENTS.md); AGENTS.md:13 ("Amend docs/system before code, in one PR"); WORKFLOW.md "Book interaction delivery".
- Why a record: PM brief.
- CI at the head (`gh run list --commit b7e2f42cf…`): graph-diff, book-e2e, ci all success.
- `/code-review medium`: reported in the PR body (range to `aa1a3bea4`). I reviewed the two later commits by hand: both are correct.
- Verdict: **CHANGES REQUIRED** (one should-fix, the spec amendment).

## Must be true (from the spec, before the diff)

1. Clicking a story row opens that row's sheet, Alt opens its source, and the rows keep Trace and Consequences (bead .71, Appendix A). On touch, a `Source` button stands in for Alt.
2. Every node sheet's header shows the ref (or the file), the unwritten and diagnostics counts, and unreached, matching the panel's `right.tsx` header. A bundle member gets the header from its ref.
3. Step rule rows open the rule's sheet, as the panel's `steprows.tsx:66` does, using the explainer's full ref.
4. Any change to the Book interaction amends `book-ui.md` in the same PR.
5. Tones follow the role table: `danger` means barred.

## Checks run (detached worktree at the head)

- `bin/mutate_diff.sh origin/main`: 18 mutants, **18 red-narrow**, 0 BASELINE-RED. The handback's "BASELINE-RED 15" does not reproduce here, but its hand rerun (16/16 red) agrees with this run. Not a finding.
- Hand controls, which are also two PR-body claims rerun:
  - `reading.tsx:220` changed to `sheetOf(x.rule.split("/").pop())` makes "Step: a rule that looked opens its sheet" **red**.
  - `inspected.tsx:22` changed to `!file` makes "a bundle member: a ref, no file" **red**.
  - Both files restored; the suites are green again.
- A `def:` header on a bundle file cannot show the wrong ref: bundle members live in `bundled`, not in `files`.
- Panel parity (`right.tsx:27-66` against `inspected.tsx`): the ref, file, diagnostics and unreached all match. There are two differences:
  - the unwritten count sums placeholders (`inspected.tsx:24`, as the Story rows do), while the panel's `~` counts todo entries;
  - with neither a ref nor a file, the panel says "not in the last good compile" and the Book draws no header (`inspected.tsx:22`).

  Both are deliberate or harmless; see Finding 2.
- `b7e2f42cf`: compiled reaction keys are full refs (`protocol/fixtures/build_sampler_hash.json`), so `sheetOf(x.rule)` is correct.

## Findings

1. **should-fix.** `docs/system/book-ui.md` is not amended (AGENTS.md:13). The PR body says "no docs/system section covers the builder panel", but `book-ui.md` covers each surface this PR changes:
   - :1080: the Story row acts do not list the new `Source` act (`story.tsx:118-127`).
   - :1019: the Room sheet "at its top, a summary line"; the header now sits above it (`room.tsx:195`).
   - :1135: the Step rule rows are now buttons, and only the verdict is in the danger tone (`reading.tsx:220-226`).
   - :1129: the Why tab gains the Full report act (`reading.tsx:151`).

   Failure: the next slice built from the spec draws these surfaces without the PR's changes.
2. **nit.** `inspected.tsx:33`: unreached is drawn in `danger`. `danger` means barred (BOOK-UI-COMPONENTS.md:84), and the panel draws unreached in warning. The counts are always dim, while the panel tones counts that are not zero. The meaning of unwritten also differs: one todo entry holding 3 placeholders shows `~ 1` in the panel and `3 unwritten` in the Book. These should be a designer ruling, not a fix round.
3. **nit.** No screenshot shows the shipped Step rows. `71-step` predates `b7e2f42cf`. Risk: at 390 px, a long full-ref button beside its verdict may wrap badly. The fix push should carry a 390 px shot of the shipped Step rows.
4. **nit.** `field.test.ts:491` no longer checks that the `'Loft'` title comes before the summary. Its expected answer was loosened rather than updated to the new head.
5. **nit.** `story.test.ts:278-285`: the head test restores `known.story` by hand, without `finally` or `t.after`. If an assert fails, `known.story` stays undefined and later tests in the file fail too.

Accepted as author-side or pre-existing (developer's nits): `story.tsx:118`, `inspected.tsx:20`, `reading.tsx:221`, `reading.tsx:170`.

Player-facing words (`unwritten`, `diagnostics`, `unreached from the start`, `Full report`, `Source`) are the owner's placeholders: flagged, not rewritten.

## Fix re-check at `d361dad38` (commits `dd1742e5c`, `d361dad38`)

- CI at the head (`gh run list --commit d361dad38…`): graph-diff, book-e2e, ci all success.
- Finding 1, **resolved**. `dd1742e5c` amends the spec, and I checked each amendment against the code:
  - `book-ui.md`: the Sheet head bullet matches `inspected.tsx:17-35`:
    - ref, or a root file's path alone;
    - the counts always shown;
    - the unreached line only when the node is unreachable;
    - a bundle member by its ref.
  - Room summary "under the sheet head" matches `room.tsx:195`.
  - Story `Sheet`/`Source` matches `story.tsx:118-124`: Source is shown only beside a card.
  - Why `Full report`, shut on each new answer, matches `reading.tsx:151`.
  - Step rule rows match `reading.tsx:217-227`:
    - a ref act with the verdict alone in danger;
    - with no sheet, one plain line in danger.
  - `BOOK-UI-COMPONENTS.md:417-421` gives the looks.
- Finding 2, **resolved by ruling**:
  - (a) unreached is now `warning` (`inspected.tsx:33`);
  - (b) `N unwritten` counts the `~` lines, written into the Sheet head bullet;
  - (c) the counts stay dim.

  No test pins the tone: `warning` → `danger` stays green. That was already true before this PR and is a drawn style; noted, not a finding.
- Finding 3, **resolved**: a 390 px shot of the shipped Step row (a `…:reaction/square_topics` act, `fired` beside it, on one line). The PR body's Runs line still calls the Step shot pre-fix: the body is stale, not the code.
- Finding 4, **resolved**: `field.test.ts:491-492` checks `['Loft','L','1 exit','down → cellar']` again, with the title before the head and the summary.
- Finding 5, **resolved**: `story.test.ts:279` restores `known.story` with `t.after`.
- Re-check verdict: **APPROVE**.
