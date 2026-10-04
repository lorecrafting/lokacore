# Book UI

Canonical presentation behavior for rebuilding the phone book. The host boundary lives in
[architecture](architecture.md#book-presenter); action admission, freshness and state come
from [GameView](protocol.md#gameview). This specification changes presentation, not rules,
authority, content, receipts or save formats.

Governing direction: [C1 touch](../decisions/owner-decision-touch-resumption-2026-10-03.md),
[room/details polish](../decisions/owner-decision-c1-playtest-polish-2026-10-03.md), and
[dialogue, Contents and pickup polish](../decisions/owner-decision-c1-dialogue-contents-polish-2026-10-03.md).
Original feedback lives in those records; independent reviews and retained interaction proof
are indexed in [reviews](../reviews/README.md). This round follows
[PR #143](https://github.com/lorecrafting/lokacore/pull/143); authorization does not claim its
new implementation or Gate C1 acceptance. Touch acceptance follows
[C1 slice 12](../decisions/owner-decision-chapter-one-plan-2026-10-02.md#12-c1-touch-the-phone-draws-the-new-gameview).

## World and status entry

World is one current-room page. Its centered title remains fixed above the scrolling authored
description, projected entities, offered place actions and event log. Tapping that title invokes
the current offered Look with its drawn freshness token; it invents no refresh command. The current
`ashmere_sampler@0.0.2` projects authentic Look under the
[sampler capability repair](../decisions/owner-decision-sampler-development-look-2026-10-03.md).
Cartridges that do not offer Look retain a fixed text title.
Only the body scrolls, so description and entities may leave view while the title stays visible.
Current entities are projected NPCs and items; tapping either opens its full detail. Standalone exit directions, adjacent-sight listings and redundant navigation/
Look headings are omitted using structured outcome/TextKeys, never English matching. Under the owner's
explicit per-room clearing direction, the World event log scopes
to the actual room: after a confirmed accepted action changes place, clear the old-room log
before adding genuine new movement/quest/authored consequences. Attempts, pending/refused/stale
results, rerenders, same-room NPC actions, Leave and section navigation do not clear it. Active
save status/error UI remains accurate; NPC histories stay independently bounded. Map
retains movement, adjacent sight and legal door actions. The World minimap/joystick sits outside
the scrolling body, with status beneath it, inside the existing safe area.

The enabled status/resources tap opens Contents. It lists exactly **Character**, **Equipment &
Inventory**, **Map**, **Journal**, **Settings**. There is no Menu button or extra World navigation
row. Character shows existing projected resources and position, without unrelated index links.
Equipment & Inventory separates held items from worn slots; Journal uses projected quest text;
Settings retains Start over and its confirmation/error handling. Section returns say
**Back to World**, clear the detail stack to World, and do not pop to Character or Contents.

Resource-band phrases come from cartridge text (`band.<key>`); projected tones map to the paper
palette without presenter thresholds. Status shows the hp band phrase only on hp, colors every
projected resource, and shows the game clock as its earthly branch under the
[untimed Lantern decision](../decisions/owner-decision-untimed-lantern-2026-10-02.md).

Only World's current-position label is a distinct position tap target. It opens only the
currently offered stand/sit/rest/sleep actions, including Stand when nonstanding. Position
in all details is informational. The position target does not open Contents, and modal scenes
expose no position shortcut. Movement admission remains kernel-owned.

## Minimap, Map and presentation controls

The World endpaper minimap sits between hairlines: a center dot, existing compass paths/rings,
barred-exit ticks and offered up/down stair nodes. Holding enlarges it; dragging highlights an
existing direction and releasing attempts that exit. Returning to center cancels; a short tap
opens Map; a terminated gesture walks nowhere. Release uses the action/freshness captured at
drag start, never a new target after redraw. An unavailable exit announces its projected reason
and logs the refusal without movement. Direction/reason appears opposite the finger. The existing
tip explains hold/drag/tap; Got it, a map tap or walking dismisses it, persisted separately with
memory fallback. The accessible Map activation opens the section; Go-direction actions use the
same offered exits. Gesture/drawing details remain in
[joystick](../../mobile/app/book/joystick.ts) and [footer](../../mobile/app/book/Footer.tsx).

Map is a scrolling current-room projection, distinct from the enlarged joystick. It shows
exits and unavailable reasons, adjacent authored sight/entity names, door names/states and
currently offered door/place actions. It invents no discovered multiroom coordinate map.

Full detail openings turn the arriving page forward; local World return turns backward. Ordinary
NPC results are the stable-route exception below. The existing paper palette, bundled IM Fell
English/EB Garamond fonts, explicit button labels/roles, section headings and minimum 44px button
height remain. Controls and status stay outside the body scroll, respecting the safe area.
Implementation details live in [book](../../mobile/app/book/Book.tsx),
[pages](../../mobile/app/book/pages.tsx) and [paper](../../mobile/app/book/paper.ts).

## NPC dialogue and action details

Tapping an NPC opens full details using only its projected name and actions. Meaningful authored
prompts/results append chronologically to a bounded presenter-session dialogue/action history.
The log alone scrolls above bottom-anchored currently offered choices/actions. Ordinary same-room
NPC actions retain the route, mounted scroll area and animation token; they do not flip the book
or reset scrolling for each result. There is no overlaid room panel or saved transcript.

**Leave** sits in that action area and clears the stack to World without a game command or
movement. It preserves a pending saved choice. It replaces the NPC/conversation Back bar;
section pages retain Back to World. The actual offered **Close** dialogue action remains distinct
from Leave and follows its engine semantics. Routine `choice_closed` output adds no generic
World exit echo; meaningful authored/quest consequences and genuine rejection/faults remain.

After Leave, a projected speaker can be tapped again. If the pending choice's actual speaker
is absent, a conversation entry opens its projected choices/Close without invented NPC data.
Live NPC results stay in their original detail, even when an unconfirmed save is retried from
another page. Ordinary renders or receipt retries do not duplicate committed history. Available
choices/actions use the freshness token captured when their buttons were drawn.

## Item details and Take/Drop

Equipment & Inventory separates Held from Worn slots, including empty slots. Held/worn item
taps resolve the same detail; item pages show the projected name/barrier state, directly nested
reachable contents and current legal item/container/equipment actions, plus local **Leave** back to World. The available brass lantern therefore offers Take
and Leave; Leave sends no engine verb. Confirmed accepted `taken` returns to World and adds a
pickup event using the original projected item name: **You pick up a brass lantern.** for this
sampler. Under the PM's explicitly adopted Drop symmetry, confirmed accepted `dropped` also
returns to World with the original projected name: **You drop a brass lantern.** Held items
open their same item detail from Equipment & Inventory, with existing offered Drop/other actions
and Leave, without invented Use/Equip actions, Take while held, or a custom gesture.
These replace generic Taken/Dropped fallbacks; authored narration takes precedence and
meaningful consequences remain. Pending, refused, stale or failed attempts announce no success.
Retry retains original action/target context and appends each confirmed Take/Drop event only once.

Successful Take/Drop are the specific exceptions to item-page retention. Other same-room item actions
retain the page while that item remains projected; leaving the room or losing the item closes
obsolete details. Equipment & Inventory item taps keep existing reachable held/worn behavior.

## Chapters, scenes and recovery

A declared chapter opens a title page on launch and on index change, once per presenter session.
A modal scene takes precedence: only its persisted current line and offered Continue appear;
ordinary details, Leave/Back, Contents and position controls are hidden or disabled. A chapter
title reached with a scene waits until that scene ends. Chapter Continue dismisses presentation
only. Same-room ordinary updates do not repeat or drop the chapter title.

The host-neutral retained narration lacks action/target context. As the bounded PM recovery
choice from the previous polish, unclassified restored consequences stay in World rather than
being guessed or lost. A restored pending choice uses its actual speaker detail. Current room
title/description TextKeys already rendered are omitted structurally. Choices, scenes, receipts,
retry and relaunch persistence remain owned by the existing session/save boundary; NPC history
is bounded in this presenter session and adds no persistence schema.

Pending save status says save not confirmed; no unconfirmed result is presented as success. A later
invocation retries the original attempt before acting on its new button, preserving original
NPC/item context. Fault details remain visible with Start over recovery. Settings Start over
requires destructive confirmation; failure retains the existing game/retry, while successful
replacement remounts the book. Save-open errors expose only existing permitted recovery. Those
boundaries live in [session](../../mobile/packages/game-view/session.ts),
[app](../../mobile/app/App.tsx) and [save error](../../mobile/app/SaveError.tsx).

## Future boundaries

Other-player presence requires a real projection and UI scope; no fabricated player rows.
Attack/skill controls wait until GameView offers them; there are no placeholders or invented
character data. Live world-clock, reading-time safety and interruption integration remains
future work under the [reading-time decision](../decisions/owner-decision-reading-time-2026-10-03.md).
Give needs both item and recipient targets. The current touch item-action projection supplies
only its item target, so it must not offer or dispatch that incomplete Give. Complete offered
Give invocations remain valid; engine mechanics are unchanged. Touch recipient selection is an
explicit carry: implement it when a touch flow can supply a recipient from actual projected
valid targets, with its own approved scope. The inspected unsupported-capability rejection was
one incomplete Give; later moves were accepted. Preserve genuine errors and meaningful history
rather than hiding errors or clearing same-room history. Carries remain in the [roadmap](../ROADMAP.md). Further owner playtest polish precedes mechanics.
