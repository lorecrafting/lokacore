# Review: Story map S3, the Flow graph in the left slot (loka-wfrgk.18.7)

- PR: #657 `editor/s3-flow`
- Reviewed commit: `157062904637069907f5f9cd4e1b527804da0668` (base origin/main)
- Governing: [editor-map-and-story-rulings, S3](../design/editor-map-and-story-rulings.md#s3-the-flow-graph) and its
  Known limits; [story-map-design](../rnd/story-map-design-2026-11-05.md); [WORKFLOW review stance](../WORKFLOW.md#review-stance);
  owner rule: author-side edge-case guards are nits
- Independence: Fable reviewer, authored none of the slice; two detached worktrees (one for the in-place mutation run,
  one clean head), own watcher (19108) and panel vite (19109), real Chrome via browser-use on `cartridges/toolbox_showcase`
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (ten findings, fixed in the head)
- PM rulings applied, not re-litigated: `.tsx` survivors and the missing panel smoke/axe accepted (loka-wfrgk.41);
  survivors in `flow.ts` (logic, not the `F` drawing constants) and `flowread.ts` are not accepted
- Verdict: **CHANGES REQUIRED** (one blocker: the pure-logic modules are untested where it matters; the rest small)

## Must be true (written before the diff)

1. Third radio `Map | Story | Flow`, `Layout.map: 'flow'`, persisted; Flow never changes the layout on its own.
2. The map's view engine (`zoomAt`, `keep`, `M`), zoom 1 on open, `0` fits, discs below 0.5, labels pinned.
3. Grid 160 × (144 × 28, pitch 32); no-outline note; empty lanes absent; `F` block holds the drawing numbers.
4. Chips are `<button>`s shaped by lane; two edge classes with arrowheads; loops as back arcs and counted.
5. Fold shared with Story; cell cap 12 with `+N`; filters remove and persist; search dims and does not persist.
6. Click selects and inks 1 hop; ground click clears ink, keeps selection; follow persisted, accent edges, footer first.
7. Hover card on focus at once and hover after 300 ms, Tab in, Esc first, no `title` on chips.
8. Double-click opens the prose at the first `~`; Alt-click is `POST /open`.
9. Keyboard model as the row says; Esc clears one thing per press down to the segment.
10. DOM order column, lane, stack; names end in edge counts; live region for compile, follow, filter.
11. Chrome classes only; `flow:*` measures with `BUDGET.flowOpen` 300 and `flowUpdate` 100; `layout()` pure.
12. No layout dependency; S4 buttons stubbed; `ICON` swap in the list.

## Checks that held

- Chrome, showcase (327 story nodes, no outline): group `Flow, 0 parts, 327 nodes`, three layer columns, the
  no-outline note; footer `327 nodes · 250 edges · 1 loop · 0 hidden`; 53 chips and 4 stubs drawn, none with `title`;
  arrowheads render (`context-stroke`). Fit gives discs. Hover card between 150 and 550 ms. Keyboard: Tab passes the
  header buttons then lands on the first chip with its card; Right, Down, Shift-Enter (count stub), Home, End, Tab into
  the card's `Open`, Esc back. `/` + `aldous` leaves 3 of 252 lit. `f` on `cellar_disarmed`: footer
  `following cellar_disarmed · …` first, live `following cellar_disarmed: 1 setters, 3 readers`, 4 accent paths; Esc
  three times (card, follow, segment radio). Filter `reaction`: 0 reaction buttons in the DOM, footer
  `119 nodes · 56 edges · 1 loop · 208 hidden`, live `208 nodes hidden`, button `~ Filters, 1 active`,
  `Layout.flow.filters` persisted. Light (`prefers-color-scheme` emulated) and dark both render from chrome classes.
- Measured: `flow:fetch` 148 / 180 / 48 ms, `flow:layout` 1.5–3.5 ms, `flow:commit` 16–66 ms; badge 31 ms on open,
  17–69 ms on update, under both budgets.
- `bin/mutate_diff.sh origin/main` (own run): SURVIVED 229, red-narrow 78, NO-TESTS 4, NOT-UNIQUE 2; per file matches
  the PR table. No TIMEBOX rows.
- Three new lint rules fire on their plants; `bin/lint_red_controls.sh` only adds the flow plant file in full mode and
  the `mobile-* | author-panel-*` skip in `--core-only`; the other controls are unchanged.
- Reran two PR claims: cap `12 -> 13` is killed (holds); `flow.ts:213 >= red` is not backed (survives, see B1).

## Findings

### Blocker

- **B1. The pure logic is untested where it decides what is drawn.** Hand mutants that the suite keeps green:
  `flow.ts:96` layer depth `1 -> 2`, `flow.ts:107` `needs words` filter `> 0` dropped, `flow.ts:213` loop path
  `> -> >=`, `flow.ts:224` self-line skip `|| -> &&`, `flowread.ts:12` `focusInk` `< -> <=`, `flowread.ts:46`
  footer `following` `&& -> ||`, `flowread.ts:71` card rows cap `0 -> 1`, `flowread.ts:105` PageUp dropped. Per the
  PM ruling these need node:test cases in `kernel/ts/test/author_flow.test.ts` with expected values written by hand
  on a small planted model. Survivors the fix round must kill (the `F` constants at `flow.ts:10–21` may take
  `mutate-skip: drawing constant`, except `cap`, `rows`, `dim` and `hoverDelay`, which the spec states):
  - `flow.ts` 53 (`cmp`), 63 and 107 (`problem`, `needs words`), 81, 93, 96 (`layers`), 132, 137, 138 (cells),
    147, 151, 156, 157, 159 (cell order and cap edge), 185, 194 (edge counts in the name), 212–216 (`path`: loop,
    same column, forward), 224, 239 (`linesOf`: self skip, collapsed-part edge to the count stub), 256 (`edges`).
  - `flowread.ts` 12 (hops), 29, 34 (search: empty, by fact, by path), 46 (footer), 56, 63, 66–69, 71–72 (card verb,
    rows, dedupe, conditions, anchors, cap and `more`), 84 (grid rows), 97, 99, 100, 105, 106, 108 (`step`: missing
    id, part lookup, PageUp/PageDown, Backspace), 115 (`entry`), 123 (`flowItems` facts), 133, 135, 136, 138, 139
    (`flowGo` collapse, expand, unfollow, other id).

### Should-fix

- **S1. Double-click equals Alt-click** (`flow.tsx:182–183`, both `p.open(key)` = `ask('open', { key })`). Spec
  Click row: double-click opens at the node's first `~`. Double-click a dialogue with three `~`: the editor opens at
  its top. Pass the first placeholder's line as `sections.tsx:223` does, or record the deferral in Known limits.
- **S2. `focusInk` walks through anchors** (`flowread.ts:12–14`): hop 2 crosses a room, NPC or item ref, which is
  not a node. `Expand` on an action that names `aldous` inks every action, dialogue and reaction touching `aldous`.
  Keep hops on lane refs (facts included). The test kills `flowread.ts:12`.
- **S3. The hover card stays after the mouse leaves** (`flowcard.tsx:62` → `flow.tsx` `hover` only cancels the
  timer). Pan across the graph by mouse: the last chip's 280 px card stays over the graph and the Book strip until
  Esc or a click. Close on leave when the card came from hover and the chip is not focused.
- **S4. A palette story row leaves Flow** (`App.tsx:193`): in Flow, Cmd-K a dialogue flips the slot to Story.
  Spec Where row: Flow never changes the layout on its own; Focus row: a selection from elsewhere inks and pans.
  Keep `map: 'flow'` and select when Flow is shown. Small; the PM may defer with S1.
- **S5. Deviations not in the spec.** No area band, no outline minutes, lane growth pushes lower lanes,
  Shift-Enter into a collapsed part lands on the count stub, node:test not vitest: accepted, but
  `editor-map-and-story-rulings.md` still states the first two. Add a Known-limits line per deviation.

### Nits

- N1. PR body cites `flow.ts:57 0 -> 1` and `flow.ts:156 0 -> 1`: no `0` at those lines at the run commit.
- N2. `flowcard.tsx:158` renders an empty `<p>` when a chip has no state words (seen on `aldous_lesson`).
- N3. `lint/rules/author-panel-raw-colours.yml` misses `stroke={'red'}`; the hex scan covers only hex.
- N4. `flowframe.tsx:140–141` puts a column's stubs after every lane's chips: a `+N` reads after the next lane.
- N5. `flow.tsx:34` `since: 0`: the first open dots every file changed since page load, not the last burst.

### Questions and notes (no severity)

- `flow.tsx:144` says `N beats changed` for layer columns without an outline; wording only.
- `flowread.ts:40` `inked` is O(ink × drawn); 66 ms commit on a filter toggle at 327 nodes, inside the budget.
- `flow.tsx:89` `v.now.current!`: wheel before the first measure would throw; author-side, no scenario found.
- `useMeasured` under StrictMode's double effect shows the update budget on first open (31 ms with a 148 ms fetch);
  dev-only.
- Design opinion: footer `following` first, Esc chain, filter popover, card placement over the hierarchy and both
  themes read well. The no-outline layering leaves 16 px between a chip's right edge and the next column, so every
  inter-column edge is one near-vertical band (fit and zoom 1 screenshots); edges are read from the card, not the
  picture. That is the dagre question the spec reserves for the owner walk; a column gap in `F` is the cheaper try.
