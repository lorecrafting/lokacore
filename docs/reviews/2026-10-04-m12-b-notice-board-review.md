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
