# M12-B notice board — independent protocol/save second opinion

PR [#182](https://github.com/lorecrafting/lokacore/pull/182). This reviewer authored none of the implementation. This record covers the protocol/save second opinion; the [primary review](2026-10-04-m12-b-notice-board-review.md) covers its separate findings.

## Initial source review

Source head: `0b8cb02139ab8f973b90769b20343b99c74538ca`.

**Verdict: CHANGES REQUIRED.**

Requirements derived before reading the diff: [GameView notice projection](../system/protocol.md#notice-board-projection) must remain bounded and descriptive; [board membership](../system/cartridge.md#notice-board-metadata) must name distinct ordinary readable siblings and resolve titles in both compiler and loader; exact current offers authorize [Read](../system/mechanics.md#readable1-mechanicsreadablerulets), including aliases. [Cold restore](../system/book-ui.md#notice-board-details) must use committed resolved Read identity without issuing a command, changing the save format/writer, or duplicating narration.

**R182-S1 — should-fix — `mobile/authority/local-story/save.ts:142`.** After a valid committed Read, set `receipt.command` to invalid JSON (`{broken`) and reopen. The added `JSON.parse` throws a `SyntaxError` that `session.checked` does not classify as `save_corrupt`; the session therefore lacks its in-place Start over offer. Extending the malformed-command test with that input reproduced the missing typed cause. Normalize the parse failure through the existing corruption boundary and cover invalid JSON.

Verification: ten focused kernel/projection, Read/SQLite recovery, alias and narration-routing tests passed. Removing Read target validation and allowing duplicate board membership each failed its focused test. Compiler/loader checks, projection bounds, preserved older fixtures, independent chapter IDs/hash construction and unchanged save writer/format otherwise aligned. Ponytail Review found no unnecessary machinery.

## Scoped fix re-review

Source head: `1a9967cbecffe457f602e63ad001a2935845db12`.

**Verdict: APPROVE for this second opinion. R182-S1 closed; no open findings.**

The fix in `mobile/authority/local-story/session.ts:76` recognizes `SyntaxError` at the existing narration-validation boundary and preserves its typed `save_corrupt` cause and in-place new-game operation. Other storage exceptions still propagate through their existing handling. The receipt decoder, save format and writer remain unchanged.

The new real-SQLite regression confirms that invalid stored Read JSON on the current release refuses opening, offers explicit Start over, and preserves the pin before reset. For a v003 save opened with v004, pin selection still returns `pinned_release_missing` before narration parsing; the old pin remains untouched until explicit Start over. Both recovery paths preserve the existing database and an unrelated retained table; reset pins the literal v004 hash.

Verification at the exact source head:

- `mise exec -- node --test mobile/app/book/readable.test.ts mobile/authority/local-story/readable_alias_book.test.ts mobile/authority/local-story/narration_routing.test.ts mobile/authority/local-story/recovery.test.ts mobile/authority/local-story/saves.test.ts mobile/authority/local-story/start_over.test.ts`: 46 passed, zero failed or skipped.
- Independently revert only the new `SyntaxError` classification: the new invalid-Read-JSON regression fails. Restore the source: the focused Read suite passes and the source diff is empty.
- Read the changed boundary and its direct narration/open/session-recovery paths. Ponytail Review: lean already; one existing guard handles the parse failure without new machinery.

Work ran in an isolated review worktree. No developer code was changed in the review commit; no Simulator, Metro or owner save was operated. Full source-head CI is the PM's merge gate and was not rerun here.
