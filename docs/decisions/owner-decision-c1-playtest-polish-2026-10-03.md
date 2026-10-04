# Owner playtest direction: room, NPC details and position controls — 2026-10-03

Owner feedback, verbatim:

> Okay theres like too much extreannous things in the room event log,For example North, and beyond norht: Well Lane. Ferry Landing.  Those text shouldnt be there, why are they there?And when clicking on Old Bram it should go into detail view just like items.  Instead ot just spits out in the room event log. Also back button in detail views should say "Back to Room" if it goes bakc to the room, most of them should go back to the room. Changing position options shouldnt be in the character detail view.  Changable position should be only by tapping the 'position' in the status bar in room view

> Or instaed of back to 'room' maybe back to 'world' is more appropriate

The latest label is **Back to World**. This is the first Gate C1 playtest polish batch after the twelve approved slices; it does not pass the gate or approve future mechanics.

## PM implementation interpretation

- Keep the room heading and authored description. Remove standalone exit directions/adjacent-sight listings from the room page and redundant navigation/place-title output from its event log. Map retains actual movement, adjacent sight and offered door actions; meaningful authored action consequences remain visible.
- Tapping an NPC opens a detail page, as for an item. NPC actions and pending dialogue/choices belong there rather than an inline room panel; preserve choice persistence and scene admission. Use only projected data and authored text.
- Detail pages returning to the main game view say **Back to World**, visibly and accessibly. Do not change a label without making its destination accurate. Preserve a specific label for any genuinely different destination.
- Only tapping the current position in the room status bar opens position controls. Character details retain position as information if useful, with no position-changing buttons. Other detail pages offer no position-changing shortcut; scenes continue to restrict input. All commands still come from the current ActionSet and captured freshness token.

The NPC detail direction supersedes the earlier inline NPC-menu choice for this presenter. The [architecture](../system/architecture.md#hosts) is amended before implementation; kernel, content, contracts and saves are unchanged.

PM review selection under the existing [C1 continuation delegation](owner-decision-touch-resumption-2026-10-03.md#pm-execution-choices-under-existing-delegation): fresh independent Codex primary plus separate Sol for this bounded polish batch while Claude quota is unavailable. This is a PM execution choice, not an owner model quote. Normal checks and actual Release Simulator interaction remain required; owner phone play, responsiveness and gate checklist remain Gate C1.

## Follow-up feedback direction

Latest owner wording, verbatim:

> Let me know when I can check the polishes and give additional feedback, we will probalby go through a few cycles of this before continuuing

PM interpretation: notify when a verified updated preview is available, then iterate UI
playtest, fixes and retest before further mechanics implementation. No fixed cycle count
or Gate C1 pass is claimed.
