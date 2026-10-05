# Q2-A — first Missing Child search lead: independent review

PR [#187](https://github.com/lorecrafting/lokacore/pull/187).

- Source head reviewed: `85742097dd90193a97ea75963c99e8a25fc9b040`.
- Reviewer: fresh independent Codex agent; authored none of the implementation.
- Initial verdict: **CHANGES REQUIRED**; blocker Q2A-R1 raised. Scoped closure is recorded below.

## Acceptance derived before reading the diff

Governing sources: [PM adoption](../decisions/pm-decision-q2-a-first-search-2026-10-05.md), [cartridge source](../system/cartridge.md#source-layout), [reactions](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), [quest](../system/mechanics.md#quest1-mechanicsquestrulets-kerneltssrcmechanicsquestlifecyclets), [Notice projection](../system/protocol.md#notice-board-projection), [Book detail order and recovery](../system/book-ui.md#notice-board-details), [live freshness](../system/book-ui.md#live-action-freshness), and [committed receipts](../system/save.md#opening-a-story).

1. Only exact `first_lead/report` resolution starts Q2, atomically with Q1. Typed source-instance evidence must agree with quest, outcome, actor and player scope. Any existing Q2 instance, including terminal states, prevents restart. Legacy triggers retain their actor semantics; activation uses quest ownership, source-event causation, root correlation, FIFO delivery and existing budgets. A fault rolls back the entire proposal.
2. Only explicit Study tracks at Reed Bank, with Q2 active and `fen.tracks_found` false, assigns that player fact. Arrival, examine and Read grant nothing. Study adds no check, cost, duration or cooldown. The truthful journal changes from Reed Bank to Fox Hollow while Q2 remains active and Wren remains unfound, without rescue, turn-in, reward or fabricated completed state.
3. Exact-subject recipes appear solely on the readable Notice, including a board child, with actual availability/refusal and shared admission/invariants. The Book shows description, nonempty chronological history, actions and Leave in order. Entry invokes Read; Study uses the shared button, captured freshness and retry path, with empty wire targets for a no-target recipe. Modal and room membership rules remain intact.
4. Confirmed Study narration belongs once to its receipt-linked original detail even when replayed after movement or a newer unrelated receipt. Cold reopen recovers structured Command/root action-completion evidence, restores original history once, and opens only a currently projected detail (with its parent board). Missing/mismatched evidence yields the specified corruption path; unrelated receipts retain ordinary routing. No new persisted transcript, row or dispatcher is introduced.
5. Compiler and loader resolve both new quest references, enforce owner/type/trigger/API1.8 constraints, and share generated tagged contracts. Historical semantic and release fixtures remain frozen except the explicitly adopted diagnostic change. Current release/hash/allocation answers are independently derived, App pins 0.0.9, and the preceding exact pin is refused intact until explicit Start over.
6. Tests use controlled behavior and independent literal answers, and fail on realistic production mutations. The composes-with statement holds without chapter-specific engine branches or unnecessary machinery. Native/device proof remains outside this overnight review.

## Findings

**Q2A-R1 — blocker — `mobile/authority/local-story/save.ts:142`: malformed Study event evidence bypasses typed save recovery.** After a successful Study receipt commits, remove its response's `events`, set it to `null`, or remove an event's `payload`, then reopen through `localSession`. `narration()` dereferences `d.events`/`e.payload` while classifying combat before reaching `receiptDetail` at line 147. It throws a TypeError instead of the promised malformed-receipt error. `checked()` (`mobile/authority/local-story/session.ts:84`) maps only SyntaxError or `malformed JSON` errors to `save_corrupt`; the session therefore has no game, no typed corruption cause and **no Start over**. This violates the [adopted receipt-evidence recovery](../system/save.md#opening-a-story): missing/mismatched readable-recipe evidence must retain explicit corruption recovery.

Independently reproduced all three forms with real rollback-journal SQLite after the actual Q1 report and Study flow. Each observed result was `{game: false, kind: null, startOver: false}`; the messages were the `some`/`type` property TypeErrors. A disposable behavior assertion expecting `{game: false, kind: "save_corrupt", startOver: true}` failed. The existing malformed-Study test keeps the event array and payload objects well formed, so its current passing cases miss this failure. Validate the bounded receipt evidence before unsafe classification and retain the existing typed error path; add controlled malformed-container/payload cases without converting storage/I/O errors to corruption.

No other correctness or scope finding. Exact quest/outcome matching, evidenced source actor/scope, terminal/local duplicate skips, quest event ownership, cause/root correlation, ordered mixed consequences and whole-proposal rollback agree with the contract. The content grants only the guarded first lead; the journal and prose retain active Q2 and unfound Wren. Standalone/board-child Notice projection, shared buttons and captured freshness preserve empty wire targets and exclude Study from World. Real SQLite replay after a newer receipt retains Study's original detail identity; current-room cold restoration and cross-room history are distinct.

Ponytail Review: no over-engineering finding. The change reuses the queue, allocator, activation, admission, button builder and receipt query, with no new dependency, dispatcher, save row or transcript. The required correction belongs in the existing receipt trust boundary. The composes-with statement holds; no chapter-specific kernel branch was found.

## Reviewer validation

| Check | Result |
| --- | --- |
| Focused Node suite: `first_search`, authority `missing_child`, Book `notice_board`/`live_actions`/`presenter`/`combat`, and `chapter` | Exit 0; 63/63 passed before controls and again after restoration |
| Compiler and shared validators: `mix test --force` on `content_first_search`, `core/first_search_contracts`, and `content_missing_child` | Exit 0; 3/3 passed |
| Neighboring kernel suites: `reactions`, `cartridge`, `cartridge_rooms`, `cartridge_items` | Exit 0; 111/111 passed |
| `elixir bin/contracts.exs --check` | Exit 0; generated contracts agree |
| Independent Python chapter generator | Exit 0; reproduced `fae0e07e0117707365b7739c1597de0e50c25ef31f0207f0730b741f0de3ab01` and IDs byte for byte |
| Retained developer evidence | All 27 SHA-256 entries verified; reviewed 21 behavior controls and 15 schema controls against their logs/literal fixtures, distinguishing schema-compiler refusals from validator data failures |
| Exact source-head CI | All six jobs successful at `85742097`: changes, lint, bundle, Elixir, TypeScript and simulation |

The adopted tagged-union diagnostic is the only changed historical invalid-fixture answer; historical semantic/release pins remain unchanged. New tests use independent literals and controlled behavior with existing real SQLite/Book helpers. Old-pin refusal and explicit Start over passed in the actual chapter suite.

## Independent test-the-tests controls

Two plausible production mutations were planted separately in this disposable detached worktree and never committed:

1. Skip only **active** Q2 instances instead of every prior instance (`mechanics/reaction.ts`). The eight-test search suite fails on a terminal row: observed a fresh `quest.activate`, expected no operations (exit 1; 7/8 passed).
2. Keep the receipt query's parameter shape but ignore exact `command_id` selection (`local-story/save.ts`). The twelve-test authority chapter suite fails the older Study replay after newer unrelated Read: original Tracks history is empty instead of the literal Study line (exit 1; 11/12 passed).

Both mutations and the additional malformed-evidence probe were fully restored. The tracked production/test diff was empty before committing only this record and its index. Normal commit/push hooks are retained. No Metro, Simulator, DeviceHub, preview or owner-save operation was run; no native rendering/touch proof is claimed.

## Independent Astra second opinion

The PM ran a fresh read-only Codex Astra opinion on the exact source head. Its answer is reproduced verbatim.

```text
VERDICT: CHANGES REQUIRED

Q2A-01 | blocker | mobile/authority/local-story/save.ts:142
A committed Study receipt with missing/null events, or an event lacking payload, throws TypeError before receiptDetail validates its evidence. Reproduced with real in-memory SQLite: localSession returns no game, no save_corrupt classification, and startOver:false, stranding the save. Guard the event structure before scanning and route malformed readable-recipe evidence through save_corrupt recovery. Add these cases to the corruption tests.

Verification/limits: 12 focused tests passed; independently reproduced 3/21 behavior red controls and all 15 schema controls. Checked validator parity, compiled chapter/hash/allocation pins, and previous-save refusal. No files changed; no device or file-backed reopen rerun.
```

## Scoped fix round 1 — primary review

- Fix source head reviewed: `c8186f663cfb293e2a3de0b180ad62428f56c062`.
- Current primary verdict: **APPROVE**. Q2A-R1 closed; no open findings.
- Scope: the two-file fix, `narration()` and its direct authority/session/Book consumers. Unaffected implementation was not reopened.

**Q2A-R1 closed — `mobile/authority/local-story/save.ts:137`.** The array/payload check runs before the combat scan and receipt-detail scan. Malformed event evidence now throws the existing `malformed JSON` error, which `checked()` classifies as `save_corrupt` with the in-place new-game recovery. SQLite read errors still propagate through the existing storage handling. The updated ten-case regression keeps the prior identity/root/subject/duplicate evidence cases, adds the three reported structural forms, and asserts typed refusal, explicit Start over and an empty fresh journal with literal expected results. Ponytail Review: the two-line guard uses native checks and the existing trust boundary; no unnecessary machinery.

| Scoped reviewer validation | Result |
| --- | --- |
| Authority `missing_child`, `start_over`, `lineage`, `faults`; Book `notice_board`, `presenter` | Exit 0; 79/79 pass, including the real exclusive-lock narration read, receipt identity/replay and confirmed detail recovery |
| Independent file-backed cold-reopen probe after actual Q1 report and Study | All three forms (missing events, null events, missing payload) return no game, `save_corrupt`, and Start over available. Refusal preserves state rows and lineage/run identity. Explicit Start over keeps the file, clears the failure, opens Ferry Landing on 0.0.9 with an empty journal and a new run. SQLite journal mode is `delete`. |
| Independent removal of the array check | Exit 1; regression fails with absent corruption kind, expected literal `save_corrupt` |
| Independent removal of the payload-shape check | Exit 1; regression fails on missing payload with absent corruption kind, expected literal `save_corrupt` |
| Restored ten-case corruption regression | Exit 0; all cases pass and tracked source/test diff is empty |
| Exact fix-source CI | All six jobs successful at `c8186f66` |

The temporary probe and both production mutations were restored before the record-only commit. Normal commit/push hooks remain enabled; the disposable detached worktree is removed after pushing. No preview, Metro, Simulator, device or owner-save operations were used.

## Independent Sol scoped fix recheck

The PM ran a fresh read-only Codex Sol opinion on the exact fix source head. Its answer is reproduced verbatim.

```text
VERDICT: APPROVE
Head: c8186f663cfb293e2a3de0b180ad62428f56c062

Findings: None. Q2A-R1 / Q2A-01 is closed.

Verification:
- The save.ts:137 guard validates event structure before unsafe classification and preserves typed corruption recovery.
- Independently exercised missing/null events and missing payload through real in-memory SQLite and localSession: no game, save_corrupt, startOver:true. Null event/payload and nonstring event type also recover correctly.
- Explicit Start over clears the failure and old receipts, restores an empty journal, and permits a subsequent saved action.
- Older Study narration retains its original command/detail identity after newer unrelated Read; exact replay adds no receipt.
- A real SQLite narration-read failure remains a storage error without Start over or receipt deletion.
- Nine focused tests passed. Removing the guard through an in-memory module hook made the updated corruption test fail on absent save_corrupt (exit 1).
- Tests exercise behavior with controlled receipt damage and literal recovery expectations. No Ponytail Review finding.

Limits:
Scoped fix and direct callers only. No files changed, no file-backed reopen rerun, no full CI/check suite verification, and no device, preview, Simulator, Metro or owner-save operations.
```
