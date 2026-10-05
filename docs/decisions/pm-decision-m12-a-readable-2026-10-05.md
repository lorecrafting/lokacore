# PM adoption: M12-A first readable details (2026-10-05)

Under the [mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md)
and [copy delegation](owner-decision-copy-delegation-2026-10-04.md), PM adopts the
bounded detail-only [readable contract](../system/mechanics.md#readable1-mechanicsreadablerulets),
its [source declaration](../system/cartridge.md#source-layout),
[exact action targets](../system/protocol.md#gameview) and
[World presentation](../system/book-ui.md#world-and-status-entry).

The two fixed consumers are the Ferry Landing notice and Drowned Lantern rumor board.
The labels are “Read the notice” and “Read the rumor board”; bodies are
“Keep the landing clear. Tie boats to the mooring post.” and
“Lost a tin whistle? Ask at the Drowned Lantern.” These are new authored copy.
Descriptions remain observational. No quest/fact/topic grant, pagination, runtime board,
modal, timer, save schema or gameplay writer is added. Reuse detail identity, current-room
presence, ActionSet admission, narration and normal receipts. The missing invariant is
agreement between exact projected detail/label and command eligibility; no content-name
exceptions are needed.

This release follows the [actual chapter cutover](owner-decision-actual-chapter-cutover-2026-10-05.md)
and advances `ashmere_missing_child` to 0.0.2. Bram is absent from the active chapter.
Clock advancement follows the [no-wait opening decision](owner-decision-no-wait-opening-2026-10-05.md).
Historical fixtures remain frozen. Current-build commit/replay and explicit pin refusal
remain required under the [preproduction rule](owner-decision-preproduction-compatibility-2026-10-04.md).
Fresh independent review and the contract second opinion precede merge; native preview
is batched by PM without operating the owner's Simulator in this source slice.
