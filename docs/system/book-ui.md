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

World shows the current place heading, authored description, projected entities and meaningful
consequences. Standalone exit directions, adjacent-sight listings and redundant navigation/
Look headings are omitted using structured outcome/TextKeys, never English matching. Under the owner's
explicit per-room clearing direction, the World event log scopes
to the actual room: after a confirmed accepted action changes place, clear the old-room log
before adding genuine new movement/quest/authored consequences. Attempts, pending/refused/stale
results, rerenders, same-room NPC actions, Leave and section navigation do not clear it. Active
save status/error UI remains accurate; NPC histories stay independently bounded. Map
retains movement, adjacent sight and legal door actions; the existing footer Map shortcut
and movement controls remain.

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

## Item details and pickup

Item details expose projected reachable contents and current legal item/container/equipment
actions, plus local **Leave** back to World. The available brass lantern therefore offers Take
and Leave; Leave sends no engine verb. Confirmed accepted `taken` returns to World and adds a
pickup event using the original projected item name: **You pick up a brass lantern.** for this
sampler. This replaces the generic Taken fallback; authored narration takes precedence and
meaningful consequences remain. Pending, refused, stale or failed attempts announce no success.
Retry retains original action/target context and appends a confirmed pickup only once.

Successful Take is the specific exception to item-page retention. Other same-room item actions
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

## Future boundaries

Attack/skill controls wait until GameView offers them; there are no placeholders or invented
character data. Live world-clock, reading-time safety and interruption integration remains
future work under the [reading-time decision](../decisions/owner-decision-reading-time-2026-10-03.md).
Give needs both item and recipient targets. The current touch item-action projection supplies
only its item target, so it must not offer or dispatch that incomplete Give. Complete offered
Give invocations remain valid; engine mechanics are unchanged. Touch recipient selection is an
explicit carry: implement it when a touch flow can supply a recipient from actual projected
valid targets, with its own approved scope. The inspected unsupported-capability rejection was
one incomplete Give; later moves were accepted. Preserve genuine errors and meaningful history
rather than hiding errors or clearing the log. Carries remain in the [roadmap](../ROADMAP.md). Further owner playtest polish precedes mechanics.
