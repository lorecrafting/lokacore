# Owner decision: a dedicated combat page

Date: 2026-10-04. Status: owner direction, implementation under M6-A (first live fight).

Owner direction (paraphrased): combat belongs in its own pane, like dialogue. Combat
narration stays exclusively in that pane, including after closure, death, escape or reopening;
it must never enter the World room event log. Offered combat actions form a vertical list
below the narration inside the same scrolling page, as dialogue actions do. This currently
means available Stand and Flee; Attack initiates the encounter from NPC detail, and no inert
Attack button appears on the active combat page. Flee is one
directionless action: the engine chooses among legal exits and the resulting room shows
where the character escaped; its mechanic is governed by the separate
[random Flee decision](owner-decision-m6-a-random-flee-2026-10-04.md).

This supersedes the proposed persistent bottom strip. The normative interaction and
navigation behavior lives in [Book UI: live combat response](../system/book-ui.md#live-combat-response-m6-a).
The page consumes the existing projected encounter, action invocations and committed
narration; the page presentation adds no clock or pause behavior.
