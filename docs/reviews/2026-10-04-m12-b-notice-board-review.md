# M12-B nested notice board — independent review

PR [#182](https://github.com/lorecrafting/lokacore/pull/182), reviewed source head
`0b8cb02139ab8f973b90769b20343b99c74538ca`. Fresh reviewer; authored none of the change.

**Verdict: CHANGES REQUIRED.** M12B-R1 is a blocker; M12B-R2 is a should-fix. M12B-R3 is a nit.

## Requirements derived before reading the diff

- [Book UI](../system/book-ui.md#notice-board-details) and the [owner decision](../decisions/owner-decision-m12-b-notice-board-2026-10-05.md): Landing Read enters its own detail and shows confirmed text with Leave; board navigation is local, ordered children enter detail with Back to board, board Back to World, no second Read and no World narration. Detail order is title, selected description, nonempty history, options. Pending, stale, refused, replay, clock redraw, room changes, scenes and combat preserve their stated boundaries.
- [Cartridge](../system/cartridge.md#notice-board-metadata), [GameView](../system/protocol.md#notice-board-projection), [readable@1](../system/mechanics.md#readable1-mechanicsreadablerulets): bounded, distinct same-room readable siblings and authored titles; selected descriptions and IDs project without bodies. Only an exact current Read offer admits a command, including aliases. Accepted Read produces one authored narration and no gameplay state change. Receipts and the save writer remain authoritative; cold reopen recovers from the committed receipt.

## Findings

**M12B-R1 — blocker — `mobile/app/book/Book.tsx:106`, `mobile/app/book/logs.ts:45`.** After a confirmed Landing Read, kill/reopen the app and continue past the chapter title. The receipt line is restored into the notice's hidden detail map, but Book starts on World; no message is displayed. Opening the notice to see it sends another Read and shows two copies. This contradicts the [receipt redisplay rule](../system/save.md#narration-on-reopen) and the Book's cold-reopen clause. An independent real-SQLite Book control asserted visible restored text with one receipt and failed at that visibility assertion; all four existing Book notice tests passed. Restore a visible notice route or equivalent receipt-only display without issuing another Read.

**M12B-R2 — should-fix — `mobile/app/book/Book.tsx:206`.** A child notice shows a footer labeled **Back**. The owner's requested control is **Back to board**. In the Drowned Lantern child page the control's destination is correct, but its label omits the destination; the Book test currently asserts the shorter label. Use the requested label for nested children.

**M12B-R3 — nit — `protocol/README.md:55`.** The protocol map still calls v003 the bundled chapter after App switches to the v004 artifact. A reader following it selects the wrong current pin/fixture. Update that one line.

## Verification

- Focused Book/SQLite Read tests: 9 passed. Kernel notice projection/loader/schema tests: 3 passed. Elixir compiler/schema tests: 3 passed. Existing stale, alias, uncertain-commit, room-pruning and clock controls passed.
- An independent alias mutation selected the first exact offer even when blocked; the alias Book test failed. Source was restored. A separate temporary cold-reopen Book control failed as described in R1; it too was removed. The review worktree was clean before this record.
- Inspected compiler/loader membership and TextKey validation, literal fixture cases, projection, ActionSet Read enumeration, presenter routing and receipt SELECT. The save writer, format and gameplay proposal were untouched. No Simulator, Metro or owner save was operated. Exact-head CI green was reported by the PM; I did not rerun the full gate.
- Ponytail Review: lean already. Existing detail, action, receipt and page-stack machinery is reused; no actionable simplification or dependency finding.

## Round 1 scoped fix review — APPROVE

Reviewed exact source head `1a9967cbecffe457f602e63ad001a2935845db12` against
R1–R3, the changed code and its direct callers. **All three findings are closed.**

- **R1:** A cold reopen now places the restored Landing notice or board child beneath the
  chapter page. Continue exposes its confirmed body once with the correct return route,
  without another command or receipt. Missing current-room notice targets and active
  combat do not restore a route. The new real-SQLite Book test checks both notice shapes,
  whole receipt rows, World log isolation, Leave/Back and the route after Continue.
- **R2:** The child control is now labeled **Back to board** and still pops to the board;
  the Book test uses that exact accessible label.
- **R3:** The protocol map now identifies the bundled v004 artifact and IDs.

The fix also classifies a stored Read command's JSON `SyntaxError` as typed `save_corrupt`
at the existing session refusal boundary. The controlled SQLite test proves an older pin
stays explicitly refused until Start over and an intact unrelated table survives in-place
replacement. Storage I/O and lock errors still take their existing path. No save writer,
format, proposal or chapter pin changed.

Focused Book, chapter, session, recovery and saves tests passed **45/45**. I independently
restored the old chapter-Continue behavior and saw only the new cold-reopen test fail;
removing `SyntaxError` classification failed only the new corrupt-command test. Both
mutations were restored; the source tree was clean before this record. The developer's
fix evidence reports its full check and three red controls; I inspected the claims and
independently exercised two controls, without rerunning the full gate or using a device.

Ponytail Review: Lean already. Ship. The fix reuses presenter histories, page stack and
the existing refusal boundary; no actionable complexity finding. Correctness review found
no remaining failure in the scoped paths.
