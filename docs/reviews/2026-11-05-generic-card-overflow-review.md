# Review: generic inspector card fits on long text keys (loka-wfrgk.40)

- PR: #654 `editor/generic-card-overflow`
- Reviewed commit: `6fe53a4cc39c07078f1e55aa801ed97f26446f2b` (base origin/main)
- Governing: no `docs/system` section covers the editor panel; loka-wfrgk.3 (inspector fits its width, c44ba8152),
  [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: Opus reviewer, authored none of the slice; detached worktree `~/dev/worktrees.noindex/review654`,
  own watcher (19108) and panel vite (19109), real Chrome via browser-use
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (four findings, all fixed in the head)
- Test gap accepted by the PM (no panel browser smoke; follow-up filed as a child of loka-wfrgk.40): not a finding
- Verdict: **APPROVE**

## Must be true (written before the diff)

1. At the 280 px inspector minimum no card (generic or Room) scrolls sideways; long text keys truncate.
2. Room keeps c44ba8152's fit after its wrapper rule is removed.
3. No field layout that intentionally had two or more columns collapses.
4. Wide inspector and dark mode render the same way.

## Checks that held

- Measured at head, light and dark, right column 280 and 560: quest `carry_letter`, room `drill_yard`, dialogues
  `aldous_talk` and `wizard_awaiting_report`, barrier `strongroom_chest_lid`, action `pick_hall_strongbox` all have
  card scrollWidth = clientWidth (262/262, 542/542) and 0 descendants past the card's right edge.
- Red control: removing only `grid-cols-1` from `templates.tsx:60` gives quest 408/262 and Room 561/262, so the
  FieldTemplate change is what now covers Room (claim 2 holds; it also reruns the PR body's 408/262 claim).
- Columns: FieldTemplate's grid had no explicit columns before (one implicit `auto` track, label above input), so
  `grid-cols-1` changes only the track's minimum. The only multi-column grid in any card is Room's `Words` `dl`
  (`Room.tsx:164`, 3 columns), outside the form, unaffected. The removed `[&_.grid]` rule had forced every form
  grid to one column; no form grid had more.
- Screenshots: light/dark at 280 and 560 for `carry_letter`, `drill_yard`, `wizard_awaiting_report` in the
  reviewer scratchpad `review654/`; labels, inputs, Edit in Book buttons and array controls sit inside the card.
- `bin/mutate_diff.sh origin/main`: NO-TESTS 3 (`Room.tsx:146`, `templates.tsx:58`, `templates.tsx:60`), same as
  the PR body; covered by the browser red control above.

## Findings

None.
