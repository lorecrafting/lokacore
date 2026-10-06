# Book UI component language

This is the implementation map for the [Book UI specification](system/book-ui.md),
which owns player-facing behavior. It describes reusable pieces in the current
shared React Native/web Book client. It is not a second source of gameplay rules or
a claim that every existing page has finished visual polish.

## Grammar

Start from the existing page type. World shows the room title and authored
description with inline links for fixed room fixtures, then separate present
player/NPC and loose-item paragraphs when projected. Each linked subject opens
its detail when the current projection supplies that route; general scenery
links await a real projection consumer. Fixtures stay in the room, while Take
is an item action only when offered. The exact [room-page rule](system/book-ui.md#world-and-status-entry)
governs visibility and placement. A child detail returns to its parent; Leave/Back changes
only the local route unless the current offered action explicitly says otherwise.
The [canonical detail order](system/book-ui.md#detail-page-order) is identity,
authored description and projected state, nonempty chronological detail history,
then current options. A page without history needs no log heading. Combat and scenes
own their distinct foreground flows under the same Book shell. Room history does
not absorb detail-local combat, dialogue or notice results.

An action shown to the player comes from current `GameView`/`ActionSet` through the
presenter. It retains the exact target, context and freshness token. A page never
grants a benefit by opening, rendering, changing tabs or inventing a local button.
Pending, refused and uncertain saves do not display a committed result. Authored
words remain in the cartridge; Book owns layout and navigation.

## Current reusable pieces

| Piece | Current implementation | Use |
|---|---|---|
| Paper, typography and tone | [`paper.ts`](../mobile/app/book/paper.ts), `prose`, `titleStyle`, `note` in [`pages.tsx`](../mobile/app/book/pages.tsx) | Shared palette, fonts and text hierarchy; use current tokens rather than new per-mechanic colors. |
| Touch and action controls | `Tap`, `Act`, `Leave` in [`pages.tsx`](../mobile/app/book/pages.tsx) | Accessible touch target, confirmed offered action and local return. |
| Page shell and navigation | `BookView`/`Body` in [`Book.tsx`](../mobile/app/book/Book.tsx), `Page`/`pagesAfter` in [`model.ts`](../mobile/app/book/model.ts), `Turn` | World/detail stack, foreground precedence, return and transition. |
| Shared reading layout | `Sheet`, `RoomPage`, `ThingPage` in [`pages.tsx`](../mobile/app/book/pages.tsx) | Scrolling identity, prose, history and action list. |
| NPC and choice | `NpcPage`/`NpcDetail` in [`Menu.tsx`](../mobile/app/book/Menu.tsx) | Dialogue, quests, shop offers and exact speaker-local results. |
| Board and notice | `NoticeEntries`/`NoticePage` in [`notices.tsx`](../mobile/app/book/notices.tsx) | Board → notice → board → World and confirmed Read on entry. |
| Combat | [`Combat.tsx`](../mobile/app/book/Combat.tsx) | Foreground combat log and currently legal response list. |
| Current scene and chapter | `ScenePage`/`ChapterPage` in [`pages.tsx`](../mobile/app/book/pages.tsx) | Modal scene continuation and chapter acknowledgement. |
| Action/log adapter | [`presenter.ts`](../mobile/app/book/presenter.ts), [`logs.ts`](../mobile/app/book/logs.ts), `buttonsOf` in [`model.ts`](../mobile/app/book/model.ts) | Fresh offers, receipt-bound detail narration and recovery. |

These are current code locations, not an instruction to wrap every mechanic in a
new component. If a piece moves, update this map in the same UI change.

## Choose a pattern for a mechanic

| Player interaction | Start with | Check in the mechanic brief |
|---|---|---|
| Talk, quest choice or shop offer | NPC detail and offered action list | Exact speaker, available/refused choice, detail-local result, Leave and reopen. |
| Inspect, take, equip or use an item/container | Item detail and nested `Page` route | Exact item/custody, contents parent return, current actions and load refusal. |
| Read a notice or a book | Readable/notice detail | Confirmed Read on entry when specified, no duplicate Read, saved text and parent return. |
| Fight or flee | Combat foreground page | Combat-only response set, isolated log, closure and restored World route. |
| Continue a current modal scene or chapter | `ScenePage`/`ChapterPage` | Confirmed continuation or acknowledgement; no premature consequence. |
| Resume B9's planned bed dream | Ordinary bed → dream detail nesting; component still to be built | Saved cursor/choice, local Close to bed, Resume after reopen and ordinary World access ([selected rule](system/book-ui.md#b9-bed-and-resumable-dream-details)). |
| Show room travel or status | World/status shell | Confirmed room, legal exits, current time/status and no optimistic move. |

Use the [Book UI rules](system/book-ui.md) for each pattern's exact behavior.
The B9 dream is a selected future consumer, not a capability of the current
`ScenePage`.
When a mechanic genuinely needs a new interaction, amend that specification first,
identify the real consumer, and add the smallest reusable page/control that serves
it. Do not create a new screen merely because a mechanic has a new name.

## Delivery cadence

The [Book interaction delivery rule](WORKFLOW.md#book-interaction-delivery)
governs each mechanic brief, same-slice `book-ui.md` changes and immediate
navigation/correctness fixes. Keep visual implementation notes here. At [E3's Chapter 1 browser
walk](briefs/chapter-one/chapter-one-e3-r10-browser-gate-brief-2026-10-05.md),
compare the full journeys for spacing, labels, touch/keyboard access, log placement,
page return and repeated controls, then make a focused reviewed polish pass. Repeat
a smaller consistency pass at later chapter gates. Native checks and the known blur
carry remain deferred under the [mobile pause](decisions/owner-decision-web-first-mobile-pause-2026-10-05.md).
