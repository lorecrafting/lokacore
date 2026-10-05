# FEN-01: first south search route — independent review

- PR: [#184](https://github.com/lorecrafting/lokacore/pull/184) — first four south-fen search rooms and selectable clue details.
- Source head reviewed: `c1764bddf3ee9af91941f541bb71c7902411c020`.
- Reviewer: fresh independent Codex reviewer; authored none of the source change.
- Verdict: **CHANGES REQUIRED**.

## Acceptance derived before reading the diff

The [active cartridge specification](../system/cartridge.md#source-layout), [Book UI](../system/book-ui.md#notice-board-details), [FEN-01 decision](../decisions/pm-decision-fen01-south-search-2026-10-05.md), [archived room geography](../archive/spec/00a-chapter-one-content.md#the-fen-22), [no-wait direction](../decisions/owner-decision-no-wait-opening-2026-10-05.md) and [copy delegation](../decisions/owner-decision-copy-delegation-2026-10-04.md) require:

1. Ferry Landing → south Reed Path → south Reed Bank → west Willow Shade → south Drowned Oak, with every reciprocal exit and no onward exits outside this slice. The established village/inn route remains usable.
2. Reed Path's fox prints and Reed Bank's tracks are visible, targetable optional details at every hour. Existing detail/Read offers preserve their target and authored text in Book; inspection grants no quest, discovery credit, fact, item or reward.
3. The slice introduces geography and observation only: no Wren, Q2, populations, swim/tide gate, new mechanic or required waiting. It composes through the installed room/detail mechanics.
4. The active chapter and app use exact version `0.0.6` with independent canonical artifact/hash and ID answers; an older exact pin is refused without changing its save until explicit Start over.
5. Tests demonstrate these behaviors with independently chosen answers; realistic route/detail regressions make the checks fail. Historical release answers stay unchanged.

## Findings

**FEN01-R1 — should-fix — new clue headings reuse action labels.**
`cartridges/ashmere_missing_child/rooms/reed_path.json:12` and
`cartridges/ashmere_missing_child/rooms/reed_bank.json:12` omit `readable.title`.
On the actual Book route, opening the fox prints renders **Inspect fox prints** as the
page heading; opening the tracks renders **Inspect tracks**. Projection therefore uses the
same key for identity and action. The [Book title clause](../system/book-ui.md#notice-board-details)
requires an authored noun distinct from the action label; the cartridge specification's
fallback preserves older fixture content rather than supplying a noun for these new details.
Author noun title bindings/catalog entries for both clues while preserving the Inspect
labels, update the independent current-release artifact/hash answers and dependent hash
literal, and check the rendered heading separately from the invocation/body. No new mechanic
or presenter change is needed.

## Verification

- Independently confirmed all six source-head checks completed successfully at the exact
  reviewed SHA: `changes`, `elixir`, `typescript`, `sim`, `lint`, `bundle`.
- `mise exec -- node --test --test-reporter=spec mobile/app/book/notice_board.test.ts mobile/app/chapter.test.ts mobile/authority/local-story/missing_child.test.ts`: 13/13 passed, including the reciprocal Book walk, existing Elspeth directions, real five-rat Maud/storage consumer and byte-preserving old-pin refusal before explicit Start over.
- `mise exec -- mix test --force test/loka/content_missing_child_test.exs`: 1/1 passed with no compiler warnings in the known-answer result.
- The independent Python oracle regenerated both v006 fixtures byte for byte. Separately checked canonical/hash consistency and compared v005/v006 after normalizing version references: only rooms/text change; four rooms and Landing's south exit are added, and existing text remains intact. Historical answers are unchanged.
- A temporary real-Book controlled walk traversed the whole reciprocal route and entered both clue details across 24 consecutive game hours. All legs and both clues stayed available; each inspection left persisted facts, quests, created entities and containers unchanged, and neither clue body entered the World log. A separate heading check reproduced FEN01-R1 with actual headings `Inspect fox prints` and `Inspect tracks`.
- Independent red control 1: remove only Drowned Oak's north return exit in source. The compiler known-answer test failed (exit 2, assertion mismatch, 0/1 passed).
- Independent red control 2: bind fox prints to the tracks body in the bundled fixture, recomputing canonical bytes and its valid hash. The new south-search Book test failed (exit 1, expected fox body absent, 0/1 passed).
- Restored both mutations exactly and reran the focused suites: Node 13/13 and compiler 1/1 passed. Temporary controls are removed. No Metro, Simulator, DeviceHub or preview was operated; these headless checks do not claim native layout evidence.

## Correctness and Ponytail review

The selected geometry matches the archived reciprocal subset and contains no onward route,
clock gate, new population, Q2/discovery writer or rescue promise. Existing primitives own all
movement, detail targeting, Read narration and receipt/save behavior. The oracle declares
geometry/detail semantics independently rather than taking compiler output; the new route test
checks independently chosen destinations and body text, and the new pin test controls a real
older SQLite save. Both planted breaks are detected. FEN01-R1 is the only open finding.

Ponytail Review: **Lean already. Ship.** No unnecessary abstraction, dependency or duplicate
machinery found; the finding is resolved through the existing optional title field.
