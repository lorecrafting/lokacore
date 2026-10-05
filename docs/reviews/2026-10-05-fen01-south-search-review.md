# FEN-01: first south search route — independent review

- PR: [#184](https://github.com/lorecrafting/lokacore/pull/184) — first four south-fen search rooms and selectable clue details.
- Source head reviewed: `c1764bddf3ee9af91941f541bb71c7902411c020`.
- Reviewer: fresh independent Codex reviewer; authored none of the source change.
- Final verdict: **APPROVE** after scoped fix round 1; the initial source verdict was **CHANGES REQUIRED**.

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

## Scoped fix round 1 — 2026-10-05

- Source fix head: `673ec70c71d2b7cffb9be60088fe582bb7f7b4f8`.
- Verdict: **APPROVE**. **FEN01-R1 closed; no open findings.**
- Scope: the seven-file fix and its direct title projection, Book entry/detail rendering,
  independent artifact oracle and App save-pin dependencies; settled parts were not reopened.

Both room readables now bind authored noun titles, **Fox prints** and **Tracks**, while
retaining the separate **Inspect fox prints** and **Inspect tracks** action labels.
The existing projection and Book routes consume these fields without implementation changes.
The real-Book route test now checks each rendered heading with independent literal answers,
alongside its existing exact-body and return-route assertions. The independent oracle and
App expected pin use the updated content hash
`482e35cc9a5dc73ec43c3afbbd1f5950a648feb4c1029662d3cf6769a3f18b69`.

Verification:

- Focused Book/App/real-SQLite suites passed 12/12; compiler known-answer test passed 1/1.
- Python regeneration left the current hash and ID fixtures byte-identical. Independently
  checked canonical/hash consistency; comparison with the original reviewed artifact found
  only the two title bindings and their two catalog entries changed. ID answers are unchanged.
- Independent focused red control: temporarily make the Book detail heading use its offered
  action label while leaving noun entry labels intact. The south-search test failed exactly
  at the new heading assertion (`Inspect fox prints` versus `Fox prints`, exit 1).
  Restored the direct caller byte for byte; all 12 focused tests then passed again.
- All six checks on the exact fix SHA completed successfully: `changes`, `elixir`,
  `typescript`, `sim`, `lint`, `bundle`. No native preview tools were operated.

Scoped correctness review found no new failure scenario. Ponytail Review: **Lean already.
Ship.** The fix uses the existing title field and extends the existing behavior test.

## Independent chapter-pin/save second opinion

The separate reviewer authored none of the source or primary review. Its scoped results are reproduced below verbatim.

```text
APPROVE — scoped pin/save second opinion
PR #184, head c1764bddf3ee9af91941f541bb71c7902411c020
Findings: none.

Verified:
- test/loka/cartridge_missing_child_hash.py:116: independent generator exactly reproduces committed v006 hash and IDs; allocation follows the numeric-profile contract.
- Historical v005 hash/ID fixtures are unchanged from the PR base.
- mobile/app/App.tsx:14 bundles v006; its chapter save identity remains unchanged.
- mobile/app/chapter.test.ts:185: real SQLite v005 opening refuses pinned_release_missing with identical file checksum and no removal. Explicit Start over produces the v006 pin.
- mobile/app/App.tsx:169 routes refused-save recovery through the confirmation alert at :64.

Commands:
- mise exec -- python3 test/loka/cartridge_missing_child_hash.py
- git diff --exit-code -- protocol/fixtures/missing_child_v006_hash.json protocol/fixtures/missing_child_v006_ids.json
- mise exec -- mix test --force test/loka/content_missing_child_test.exs
- mise exec -- node --test mobile/app/chapter.test.ts mobile/app/book/notice_board.test.ts mobile/authority/local-story/missing_child.test.ts

Results: compiler KAT passed; 13 Node tests passed.
Red control: authority.ts:87 fallback to newest when the saved pin is missing made the focused old-pin test fail (save_corrupt versus pinned_release_missing). Restored guard; focused test passed.

Ponytail Review: Lean already. Ship.
Disposable worktree removed; no source/record push, native tools, or owner-save reset.
```

```text
APPROVE — scoped fix recheck
PR #184, head 673ec70c71d2b7cffb9be60088fe582bb7f7b4f8
Findings: none.

- test/loka/cartridge_missing_child_hash.py:44: independent generator reproduces committed v006 artifact and IDs byte for byte.
- Updated hash: 482e35cc9a5dc73ec43c3afbbd1f5950a648feb4c1029662d3cf6769a3f18b69.
- Artifact changes only the two readable.title bindings and their catalog text. v006 IDs and historical v005 fixtures remain unchanged.
- mobile/authority/local-story/authority.ts:87: exact-hash matching remains unchanged. A controlled real SQLite save on the prior v006 hash was refused as pinned_release_missing with identical file bytes; explicit Start over installed the updated pin.
- mobile/app/chapter.test.ts:185: existing v005 refusal still passes. App bundle opening pins the updated hash.

Validation: independent generator comparison; focused compiler KAT (1 passed); focused App/Book tests (3 passed); controlled prior-v006 SQLite refusal/Start over check passed.

No unintended source changes or review edits. Disposable worktree removed; no preview, Simulator, Metro, or owner-save operation.
```
