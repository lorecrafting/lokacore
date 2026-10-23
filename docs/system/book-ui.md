# Book UI

Canonical presentation behavior for rebuilding the phone book. The host boundary lives in
[architecture](architecture.md#book-presenter); action admission, freshness and state come
from [GameView](protocol.md#gameview). This specification changes presentation, not rules,
authority, content, receipts or save formats.
The [Book component guide](../BOOK-UI-COMPONENTS.md) maps these rules to the current
shared client; the [delivery workflow](../WORKFLOW.md#book-interaction-delivery) requires
interaction-rule updates in the mechanic slice that needs them.

Governing direction: the owner's rulings on [touch and resumption](../decisions/owner-decision-touch-resumption-2026-10-03.md),
[room and detail polish](../decisions/owner-decision-c1-playtest-polish-2026-10-03.md),
[dialogue, Contents and pickup polish](../decisions/owner-decision-c1-dialogue-contents-polish-2026-10-03.md),
[journal, Leave, position and detail-flow polish](../decisions/owner-decision-c1-journal-position-polish-2026-10-03.md)
and [detail-page order](../decisions/owner-decision-detail-page-order-2026-10-05.md).
Original feedback lives in those records; independent reviews and retained interaction proof
are listed in the generated [review index](../reviews/README.md). The per-mechanic detail
sections of retired chapters were removed on 2026-10-22; the rules they shared are stated below,
and their text is at [the last commit that held them](https://github.com/lorecrafting/lokacore/blob/c88762e38eb9c3747f1de0b87e6536d58424c24e/docs/system/book-ui.md).

## World and status entry

World is one current-room page. Its left-aligned title remains fixed above the scrolling authored
description, projected interactibles, offered place actions, event log and, last, the
[Word block](#word-bar), so a pressed verb's result line sits within a screen of the verb and the
word rows never push it below the fold (pass-1 UA). A place action the GameView advertises
unavailable draws in the verb list, after the available verb lines, in the Action card's
unavailable form `label: reason` (`Fish in: not yet`; `cooldown` reads **not yet**), never
dropped (pass-1 R2); a World page with only unavailable verbs draws no "Nothing to do here." Note.
A closed or locked exit's door actions (Open, Unlock) draw on World as Action cards after the
place verb lines, with the Map's labels; the Map keeps them too (pass-1 R4, owner 2026-10-21).
The description
may contain underlined touch links for projected room fixtures: scenery, fixed doors or
exit cues, and other room-bound subjects. A fixture link stays within the authored prose,
whether it appears mid-sentence or at the end of the last paragraph; the Book does not
move it into a separate entity list or force a paragraph break. A fixture is
immovable room content: it cannot be taken, dropped, stored or otherwise removed
from the room. A removable object is a loose item in the item group instead.
The link opens a detail only when the current GameView supplies a visible,
current-room identity and detail route (for example, an offered place action
with an exact inspectable target). The Book does not infer visibility, identity,
detail or an action from bracketed prose alone. If that projection is absent,
the words remain ordinary prose until a mechanic adds the required projection
and admission contract. The selected room-description variant itself must omit
concealed fixture or exit text until the game reveals it; the Book cannot hide
an authored phrase after receiving it.

Below the description, present players and NPCs have their own paragraph/list, and
loose room items have a separate paragraph/list, NPCs first. Every entity that is not an
NPC or player goes in the item list, so none is dropped or listed twice. Each projected subject can open its
own detail. An item's Take option appears only when currently offered; an NPC or
player uses its own offered interactions. Omit an empty group. Player presence is a
future projection; the current Book has NPCs and items only. This distinction is
presentation and custody, not a new entity kind: fixture, actor and item actions still
come from the current GameView/ActionSet and its captured freshness context.

Tapping the room title invokes
the current offered Look under the [live action freshness rule](#live-action-freshness); it invents no refresh command. The [current sampler](cartridge.md)
projects authentic Look under the
[sampler capability repair](../decisions/owner-decision-sampler-development-look-2026-10-03.md).
Cartridges that do not offer Look retain a fixed text title.
Only the body scrolls, so description and entities may leave view while the title stays visible.
Standalone exit directions, adjacent-sight listings and redundant navigation/
Look headings are omitted using structured outcome/TextKeys, never English matching. Under the owner's
explicit per-room clearing direction, the World event log scopes
to the actual room: after a confirmed accepted action changes place, clear the old-room log
before adding genuine new movement/quest/authored consequences. The room shown is the one the
committed receipt places the player in, never the exit's destination: an arrest (a wanted player
walking in on an arresting guard) turns the World page to the cell, and its log carries the move's
lines in receipt order (arrest line, then the reaction's charge). Each narration record of a
receipt is its own log line, in record order; the Book never joins records into one line, and
the `words.ts` outcome word ("Opened.") draws only for a receipt with no narration at all
(pass-1 UO). No card, note or banner. Attempts, pending/refused/stale
results, rerenders, same-room NPC actions, Leave and section navigation do not clear it. Active
save status/error UI remains accurate; NPC histories stay independently bounded. Map
retains movement, adjacent sight and legal door actions, and draws no event log: the log lives
on World only (pass-1 UF1). An exit's door state line ("The hut door: open", the cartridge's door name capitalised) draws only when no
exit card already carries that state as its reason; the door's action cards stay (pass-1 UF2).
A closed or locked door's Open/Unlock cards draw on World as well, in the
[World order](#world-and-status-entry) (pass-1 R4). The
World minimap/joystick sits outside
the scrolling body, with status beneath it, inside the existing safe area.

A projected Read place action keeps its exact detail target and authored label and follows
the canonical [notice-detail rules](#notice-board-details).

The enabled status/resources tap opens Contents. It lists exactly **Character**, **Inventory**, **Map**, **Journal**, **Settings**. There is no Menu button or extra World navigation
row. Character shows existing projected resources and position, without unrelated index links.
Inventory separates held items from worn slots; Journal uses projected quest text;
Settings retains Start over and its confirmation/error handling, and holds the
[page-turn sound](../BOOK-UI-COMPONENTS.md#page-turn) on/off control. Section returns say
**Back to World**, clear the detail stack to World, and do not pop to Character or Contents.

Settings opens with the **Reading size**: Standard, Large or Larger, one chosen, kept on the
device (not in the save) and Standard until changed. It scales the reading text (prose, entity
and action lines, the log, speakers, Controls, tags, the running head, titles, letter tiles,
small text and status labels) by the step (×1, ×1.15, ×1.3) times the device's text size, never
above ×1.5; icons and the map stay fixed, and the device's text size reaches the Book only
through this factor. Rows that no longer fit wrap, never truncate. Every text role scales with
the Reading size, titles and the status line included; the status line may take a second line,
the pools never split.

Resource-band phrases come from cartridge text (`band.<key>`); projected tones map to the paper
palette without presenter thresholds. Status shows the hp band phrase only on hp. The status line
shows only the condition pools hp, ma and mv, with their band tones; pennies and any other count
stay off the status line and show plain in Character (owner, polish pick mv1j35ltxddx): a
count (pennies, ash: any resource other than the pools hp, ma and mv named above; no new field) draws its current value alone
(`pennies  10`, `ash  0`; two spaces after the key, like `xp  30 / 50`), never `current / maximum`; a banded pool keeps `hp  10 / 10` (pass-1 UI). With a
cartridge calendar, status shows the sky as one glyph from the confirmed solar and lunar phase
labels (the sun by its phase while up, the moon by its phase at night, per
`StatusLine`'s doc comment ([Status.tsx](../../mobile/app/book/Status.tsx))); the confirmed day, displayed time
and phase words are its accessible label, not shown. With an authored weather table
([derived sky](mechanics.md#derived-sky-weather-season-and-tide-toolbox-row-31)) the day's
weather shows as a word after the glyph in the same item (`☀ rain`; trap 12: the sign is in the
words), and the label adds weather, season and tide (`day 1, 00:00, night, full moon, rain,
autumn, high tide`); season and tide are not shown (proposed wording, pending designer approval,
loka-kgd.30). It updates from confirmed GameView
time after actions, elapsed delivery and reopen, without settling elapsed on render. Historical
cartridges without an expanded calendar retain the earthly branch under the
[untimed Lantern decision](../decisions/owner-decision-untimed-lantern-2026-10-02.md).

The Book's look follows the confirmed GameView solar phase per the
[palette rule](../BOOK-UI-COMPONENTS.md#design-tokens); the Book reads the phase label and computes
no hours. There is no Settings override
([owner decision](../decisions/owner-decision-design-foundation-2026-10-07.md)).

Only World's current-position label is a distinct position tap target. Each tap directly invokes
the next currently offered legal action in standing → sitting → resting → sleeping → standing
order, skipping unavailable/absent actions. If none is offered, position stays informational.
The button follows [live action freshness](#live-action-freshness); pending/refused/stale results never advance the
shown position optimistically. A confirmed change writes one World log line: its authored narration, else "You stand up.", "You sit down.", "You settle down to rest." or "You lie down to sleep.". This opens no detail page or Contents and does not turn the
ordinary World page. Position in all details is informational; modal scenes expose no position
shortcut. Movement and position admission remain kernel-owned.

## Live action freshness

Buttons and gestures capture the offered action and interaction context when drawn or granted.
Before a fresh invocation, the presenter may refresh the token only if no player invocation
has been confirmed since capture and the exact action remains available: same action key, ordered target IDs and structured input, same actor and room, and
unchanged pending choice/continuation, scene, combat and detail membership context. Movement also retains its
projected destination and door state; position controls retain their drawn position. Elapsed-only
clock/resource updates therefore do not strand unchanged controls. A changed room, unavailable
exit, departed target, altered choice or other changed interaction context keeps its old token:
the authority refuses the stale invocation, the Book redraws and nothing acts. No substituted
target, extra movement or optimistic success is permitted. The clock and schedules keep running.

A scene's Continue carries the scene identity and line shown when
drawn. A changed line or scene remains stale even if the presenter obtains a fresh
invocation id; the Book redraws the actual saved line. An exact accepted retry retains
its receipt and presentation context. An epilogue's begin action appears as one
ordinary action only when eligible; rendering, arrival and reopening do not press it.

A pending retry keeps its original invocation, token, receipt and presentation context; this
rule never refreshes an already-sent invocation or weakens authority freshness/admission.

## Minimap, Map and presentation controls

The World endpaper minimap sits in the footer: a center dot, existing compass paths/rings,
barred-exit ticks and offered up/down stair nodes. Holding enlarges it; dragging highlights an
existing direction and releasing attempts that exit. Returning to center cancels; a short tap
opens Map; a terminated gesture walks nowhere. Release keeps the action/context captured at
drag start and follows [live action freshness](#live-action-freshness), never a new target after redraw. An unavailable exit announces its projected reason
and logs the refusal without movement. Direction/reason appears opposite the finger. The existing
tip explains hold/drag/tap; Got it, a map tap or walking dismisses it, persisted separately with
memory fallback. The accessible Map activation opens the section; Go-direction actions use the
same offered exits. Gesture/drawing details remain in
[joystick](../../mobile/app/book/joystick.ts) and [footer](../../mobile/app/book/Footer.tsx).

Map is a scrolling projection, distinct from the enlarged joystick. Releases without
discovery metadata retain the current-room exit/door projection.

The [discovery contract](mechanics.md#d10-discovered-places-observations-and-knock-selected-contract)
is installed: Map draws only
visited rooms at their authored level/position and links whose two endpoints were visited.
Remote visited links are drawn as known static connections without a current traversal
claim; only exits from the actor's current room show live availability/refusal from
ordinary Move admission, including any ingress rule.
The current-room marker and a level stepper are visible; a room detail names that known
room and its known exits. While a room detail is open, Back to map is the page's nearest return,
beside Back to World. An unvisited endpoint, NPC or item is never drawn merely because
the cartridge contains it or adjacent sight names it. Existing current-room exit and door
controls retain live admission. Where labels distinguish currently visible `here`,
`last seen` with the saved place/time, and `unknown`; a hidden co-located NPC does not
become `here`, and a stale observation is never phrased as a current location. Each known
NPC's Where control reads "Ask where <name> is"; only a living known NPC has one, a dead one
none (pass-1 UF3; the kernel leaves the dead out of `known_npcs`, GE6).
Knock appears on the actual local door's context card and uses its exact direction and
freshness token. It leaves that card and Map reachable after its reply.

In the web Book, unmodified Arrow Up/Down/Left/Right walk north/south/west/east and
Page Up/Page Down use offered up/down exits. Keyboard movement uses the same captured
exit, refusal and freshness path as the footer. A missing exit does nothing. Keys act only
on World when no scene, combat, pending save, catch-up or fault owns the flow. Editable
controls and dialogs keep their keys; handled movement keys do not scroll the page.

Full detail openings turn the arriving page forward; local World return turns backward. Ordinary
NPC results and direct position changes are stable-route exceptions below. The turn's form,
reduced-motion fallback and sound follow the [page-turn entry](../BOOK-UI-COMPONENTS.md#page-turn);
it never delays or blocks input. Explicit button labels/roles and section headings remain. World minimap and status stay outside the
body scroll, respecting the safe area.

Label in name (WCAG 2.5.3, PM decision 2026-10-08): a control's accessible name starts with its
shown text exactly as rendered (a run of whitespace counts as one space; nothing precedes it),
then a comma and what the tap does or where it goes: an entity, notice, board, Contents or
section row ends ", open"; the room title ", look"; the position word ", change position"; the
resources end "; opens Contents" after the hp band phrase. A control that shows no text (the
minimap at rest, "Map") names its destination alone, and the lit exit leads the name while a drag
shows it. A control whose shown text is its whole name (Leave, Got it, an action card) adds nothing.

## Detail-page order

Detail pages show title/identity, authored description and its [asides](#aside-details), projected item state, then their
chronological event log only when entries exist, then currently offered options in the same
scrolling content. Options list in one fixed order (pass-1 UR): first the verbs that act on the
thing itself (Read, Eat, Drink, Wear, Light, Open, Talk, Attack, a recipe), then the verbs that
move it (Take, Lift, Drop), then the verbs that store or hand it over (Put into <container>,
Give), then asks and services; a corpse's Take from it precedes Put into it. Within a group the
GameView's order stands. An empty log has no heading or placeholder. NPC, item, notice, board and
combat details follow this order; World retains its [room-page order](#world-and-status-entry).
A page's local returns (Leave, Back to World, Back to board, Back to container, Back to map,
Close) sit in its page foot, below the scrolling content and above the status line, nearest first;
offered actions never do. World, a scene, a chapter title, the ancestry choice and combat have no
foot. A control that opens a child (Resume dream, Continue conversation) stays in the content.

## Notice-board details

Every readable notice opens its own detail page. A standalone notice opens directly from World and invokes its captured Read offer. Its Leave
option returns to World. Its page title is an authored noun distinct from the action label.
Read text never enters the room event log.

A projected notice board opens locally from World, with its title and selected description,
nonempty chronological detail log, then its ordered notice options. Notice Read offers are
shown through their detail entry rather than repeated as World actions. A notice option uses the
current available place offer with exactly that notice ID and inspectable-details target
scope, including an authored Read alias. Unavailable offers show their reason; absent offers
are not actionable. Neither English labels nor cartridge internals determine membership.

Tapping a notice pushes its detail and invokes that captured offer. Its title and selected
description precede the confirmed message and any nonempty detail-local history, then
options. Entry shows the message immediately when Read confirms, unless its plain text is the
description already shown, which is not shown twice; no second Read option is
shown. A pending entry can be retried by returning and opening it again. Body text comes only
from confirmed Read narration; pending, refused, stale and replayed attempts never invent or
duplicate it. Back to board pops to the board, then Back to World clears the board. Opening
a board or returning/backing creates no command or receipt; entering a notice invokes its one existing
Read. Room changes prune these routes; elapsed-only redraws retain them. Scene/combat
precedence and live action freshness apply unchanged. These local pages add no pause,
deadline extension or persisted transcript. On cold reopen, the resolved Read target from
the existing committed receipt restores its message once to that notice’s detail history
and its visible detail route after the chapter Continue. A board child restores its parent
board beneath it. This creates no command or receipt. A missing current-room target restores
no notice route; scene/combat precedence still applies. Ordinary unclassified narration
continues to follow the existing World recovery rule.

A readable detail's exact-subject recipes appear only in its Notice actions. Available controls
follow nonempty history; Leave sits in the page foot (on a person's page in conversation, Leave the
conversation, per the [conversation rule](#npc-dialogue-and-action-details)); unavailable controls show their real reason.
Available controls and unavailable notes use the same catalog action-label resolver
and its existing human-readable fallback. Never display an action TextKey as prose.
Opening the detail always invokes Read, never Study. Detail membership stays UI-only: a
no-target recipe sends `target_ids: []`. These controls use the shared offer-to-button builder,
freshness and retry path. Confirmed readable-recipe narration routes to the receipt-linked
detail, including replay after leaving its room, without World fallback. Recovery restores the
latest such narration once to its original history and opens a route only when that detail is
currently projected. A newer unrelated narration receipt cannot provide detail identity.

## NPC dialogue and action details

Tapping an NPC opens full details using its actual projected name, authored description and
actions. Description comes first. Outside a conversation the page offers the person's actions as
cards straight after the description: Talk, shop, [Ask about](#fd7-ask-details) and service offers; the foot is Leave. A page
with any priced offer (a shelf, a bank, a priced service) draws one Note **You have <n>p.**
after the description, before the shelf rows, from the projected pennies; it is the only place
the balance is written, and "can't afford" stays a bare reason (pass-1 E15). It shows
no past conversation log on a fresh visit to the page or after Leave the conversation (the log
shows again inside a new conversation); lines since that visit began or that Leave are the only
history. Answering (a `choose` press) puts that page **in conversation**, and it stays so after a one-reply
answer closes the kernel choice: the choice's options sit immediately after the latest
chronological dialogue/event entry **inside** the scrolling content; no Talk card and no other
action card shows; the foot is a single **Leave the conversation**. Action and dialogue choice labels are bare imperatives without a trailing period (an ellipsis is not a period); a quoted spoken line keeps its punctuation. The conversation belongs to
that page visit (the Book's latch, not the NPC): leaving the page any other way (Contents, Map,
Back to World) ends it, and reopening the person shows their actions again. This supersedes the
viewport-bottom dock. The ordinary long log remains scrollable, and newly appended results keep
current options reachable. Same-room NPC actions retain the route, mounted scroll area and
animation token; they do not flip the book or reset scrolling for each result. There is no
overlay or saved transcript.

After a confirmed accepted NPC action changes the actual projected journal, append the neutral
**Journal updated** event within that NPC's chronological history, visually distinct from
authored dialogue. Preserve meaningful authored narration. Pending/refused/stale/fault results
add no false event; rerenders and receipt retry do not duplicate it. This is local presenter
metadata, not story prose, a new game event or transcript persistence.

There is one foot control and no separate Close: **Leave** outside a conversation (local World
navigation, no engine verb) and **Leave the conversation** inside one. When a matching
`close_choice` is actually offered, Leave the conversation invokes it under
[live action freshness](#live-action-freshness) and, only after confirmation, returns to that
person's page with their actions offered again, never to World; an absent speaker (the targetless
close of a departed NPC) returns to World. An unconfirmed/refused/faulted close retains the detail
and honest save/error UI; a retry keeps its original context. Without a matching closable choice
(the kernel already closed a one-reply answer), Leave the conversation is local: it ends the
conversation on the page, sends no engine verb and preserves any unmatched saved choice. Routine `choice_closed` fallback narration is suppressed
structurally; meaningful authored/quest consequences and genuine errors remain. Sections retain
Back to World. Item Leave remains local navigation.

An absent pending speaker uses its actual continuation without invented NPC data. Live results
stay in their original detail even when retried elsewhere. Available choices/actions use the
freshness token captured when drawn; scenes and queued chapters retain precedence.

Several present NPCs that share a name are each their own detail and action target, bound to
their exact EntityId, never the first definition match. Departure or death prunes the route; a
different generation never inherits an old invocation.

Descriptions use the explicit optional EntityView/ContentView `description` TextKey under the
[projection amendment](../decisions/pm-decision-description-projection-2026-10-03.md). Current
NPC/item room, held, worn and reachable-content projections supply their authored binding;
resolve that key using the existing cartridge text boundary. Older snapshots without the field
and absent speakers get no invented body, inferred name suffix or substituted room-line text.
Player descriptions are required when real player entities/descriptions are projected; there is
currently no player-presence UI.

**Barter offers.** A service offer with price 0 shows its authored label alone ("Knife for two pelts"), with no " — " and no parentheses, never "free"; its unavailable form is "Knife for two pelts: <reason>". The label names the inputs.

**Hostile refusal.** The Book cannot tell hostility from refusal codes (`invalid_state` also
means a full load or an open encounter), so the NPC EntityView carries `hostile: true` while
the person's [disposition](mechanics.md#standing-and-disposition-toolbox-rows-15-and-g11) is
hostile (a derived read, absent otherwise) and, when the cartridge authors
`disposition.refuse` (a TextKey, optional; compiler and loader admit it as `engage`), its key
as `refusal`. While `hostile` is projected the page shows the description, then one
[Note](../BOOK-UI-COMPONENTS.md#component-catalogue) in place of Talk: the `refusal` line, or
without one the sentence [words](../../mobile/app/book/words.ts) owns ("<Name> will have
nothing to do with you."). No Talk, shelf or Ask about card is drawn; services and lessons
stay as offered; the foot is Leave. The authored line names the mood, never the cause
("Nell turns her back on you.", not what the player did); hostility ending redraws the actions
without a line. A shelf row's reason is always a word from `words.ts` `reason()` ("not now",
"too heavy to carry"), never a code with its underscores replaced; a buy refused `not_owned`
stays "sold out", and one refused `insufficient_resource` reads "can't afford" (`buyReason`).
A shelf reason from the cartridge is a lowercase fragment with no period.

## Item details and Take/Drop

Inventory separates Held from Worn slots, including empty slots. Held/worn item
taps resolve the same detail; item pages follow [detail-page order](#detail-page-order), with directly nested
reachable contents and current legal item/container/equipment actions, plus local **Leave** back to World. An available loose item therefore offers Take
and Leave; Leave sends no engine verb. Confirmed accepted `taken` returns to World and adds a
pickup event using the original projected item name: **You pick up <name>.** Under the PM's explicitly adopted Drop symmetry, confirmed accepted `dropped` also
returns to World with the original projected name: **You drop <name>.** Held items
open their same item detail from Inventory, with existing offered Drop/other actions
and Leave, without invented Use/Equip actions, Take while held, or a custom gesture.
These replace generic Taken/Dropped fallbacks; authored narration takes precedence and
meaningful consequences remain. Pending, refused, stale or failed attempts announce no success.
Retry retains original action/target context and appends each confirmed Take/Drop event only once.
When Take removes an item from a corpse's Contents, the confirmed result returns to
that corpse detail, puts the named pickup line in its local history once, and keeps
Back to World available. The taken item appears in Carrying. An unavailable corpse
closes its detail through the ordinary stale-route rule; no success is inferred. A living NPC's directly held items, offered under `world.theft`, list under **Held** (not Inside), as Entity lines that open the ordinary item detail; there the theft card reads **Lift** (a `LABEL` word, never Take) with one Note **<Name> is holding it.** above it, so the verb and the line name the risk before the press (pass-1 E14, owner 2026-10-21); a corpse or container keeps **Inside** and Take.

An item action advertised unavailable with `too_heavy` appears as a non-action note using its
actual catalog label and **too heavy to carry**; one refused because the load is full reads
**more than you can carry** (kernel code `over_load`) (pass-1 R3). `resource.short` reads "need <n> <key>"; `permission_denied` reads "not yours". It invokes nothing; available actions retain their
existing buttons. The note follows the latest GameView, including Take aliases and Contents,
and disappears when shedding held load makes Take legal. While any such note shows, the page
draws no "Nothing to do here." Note: an unavailable action is still something to read (pass-1 UH3). The
same holds on an NPC page: its shop price rows and service rows, available or not, keep the Note off
(pass-2).


Successful ordinary Take/Drop are the specific exceptions to item-page retention; corpse-content
Take follows the corpse-detail rule above. Other same-room item actions
retain the page and route their results to that item's local chronological history while the
item remains projected; leaving the room or losing the item closes
obsolete details. Inventory item taps keep existing reachable held/worn behavior.

Put appears as a concrete pair button using projected source/destination names and IDs.
Each button captures its projection freshness and follows the normal GameSession invocation
and confirmed receipt routing. There is no separate storage session or recipient selector.

A held tool's page shows one card per use pair (G4) the GameView lists available on it, in listed order, labelled with the recipe's authored label and the target's projected name ("Quench a cart" on the bucket), never the tool's own name; the target's page shows none. Pressing it sends the listed action key with target_ids [target, tool] and no input; the page stays and the result joins its history. A pair the GameView does not list, or lists unavailable, shows no card: held pages list only available actions, the `too_heavy` note above and any item action refused with `cooldown` ("Fish in: not yet" on the rod resting between casts; pass-2, designer to check wording) being the exceptions; the Book adds no availability rule. ([Use X on Y](mechanics.md#use-x-on-y-toolbox-row-g4))

A held item's page shows one card per Give pair the GameView lists available, at Give's place among its actions, in GameView order, labelled "Give", the item's and the recipient's projected names ("Give an apple to the farmer"). Pressing it sends give with target_ids [item, recipient]. A refused pair, or no one present, shows no card and no note. A confirmed given returns to World and adds **You give an apple to the farmer.** once with the original names; authored narration takes precedence. Pending, refused or stale presses claim nothing. ([Give pairs](mechanics.md#give-pairs))

**Equipment and skills.** A weapon's or shield's page shows its projected slot, attack or block
figures and skill requirement, read from the projection, never renderer literals or inferred
names; a carried weapon is visibly distinct from a wielded one, and a description grants no use.
How Character shows learned skills is the [skill tree rule](#skill-tree-details).

**Fuel and light.** An item with fuel shows `Fuel <remaining> of <capacity>, lit/unlit` from the
confirmed view; Ignite, Douse and Refuel sit in its ordinary action list, beside Remove when worn.
A two-item action names both items on its button (`Refuel <source> from <supply>`); the item that
owns the control keeps the history, and the bound participant's page does not repeat it. The
presenter owns no fuel arithmetic or clock. A dark room keeps exits, inventory and recovery
usable and shows no hidden detail link, readable entry or Scan identity.

**Liquids.** A vessel's page shows the confirmed liquid kind, quantity and capacity with its
authored unit, and offers Fill, Drink or Pour only to exact eligible vessels; two vessels keep
their authored names and IDs, never an ambiguous keyword resolved for the player. A confirmed
liquid line is the authored sentence, then a compact quantity line (`Water · 1 quarter-litre`)
from the receipt's bindings; a missing binding invents no amount. Fill routes to its source
detail, Pour and Drink to their source vessel. The Book owns no liquid math.

**Held readables.** Opening a held book sends no Read; Read is an explicit option. Its confirmed
text joins that item's history and the page stays. A child of an open held container pushes its
own detail; Back to container pops locally without a command; Leave or Back to World clears the
stack. Closed or locked ancestors expose no child Read. Cold reopen restores the latest committed
Read to its original history, opening a route only when custody still reaches it.

**Consumed items.** An action that consumes the item (Eat, a bandage) removes it from Carrying,
closes its page and routes its confirmed line to the World log, or to Combat while an encounter
is open, matched by the reply's exact command ID even when it carries no event, appended once
across lost replies and replay. Cold reopen restores that line where it went and never reopens
the consumed item's page. Pending, refused or faulted attempts add no line and force no return.

Quest completion updates its journal and confirmed narration. A terminal side quest
never implies that the whole story has ended. World shows no whole-story completion
hint until an explicit main-story terminal signal has an authored consumer (M20-A/finale);
storage, travel and other quest actions remain available under their normal rules.

## Chapters, scenes and recovery

A declared chapter opens a title page on launch and on index change, once per presenter session.
A modal scene takes precedence: only its persisted current line, offered Continue and the
[running head](../BOOK-UI-COMPONENTS.md#component-catalogue) appear;
ordinary details, Leave/Back, Contents and position controls are hidden or disabled. A chapter
title page shows its chapter label, title, Continue and the running head only: no Back to World, and Contents and position are
locked as in a scene. A chapter
title reached with a scene waits until that scene ends. Chapter Continue dismisses presentation
only. Same-room ordinary updates do not repeat or drop the chapter title.

A once-only choice before play (the ancestry choice) sends the exact offered invocation and is
never chosen by default on render, elapsed update or refresh. No time passes and no catch-up
shows while it is on screen; the first time shown after it is the start time. It shows the
authored differences and actual effects, never a promise the rules do not keep. Pending, stale
or refused presses claim no choice; once confirmed, Continue, refresh or death never reopens it.

A resumable dream is a detail nested under its real anchor (a bed): accepted Rest may open it,
Close returns to the anchor and changes only the local route, and after a cold reopen the anchor
offers Resume dream instead of forcing the dream. Leaving, combat or a scene exits the dream and
keeps its saved point. Its controls keep the beat and choice they were drawn with.

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
replacement remounts the book. Save-open errors expose only existing permitted recovery. The
save-error screen has no GameView, so no phase; it shows a headline and at most
one plain sentence under it, never a raw kind or code and never the headline repeated; the
browser's save-file lock reads "Loka is already open in another tab."
[words](../../mobile/app/book/words.ts) owns the sentences. Those
boundaries live in [session](../../mobile/packages/game-view/session.ts),
[app](../../mobile/app/App.tsx) and [save error](../../mobile/app/SaveError.tsx).

## Text clarity

Scrolling content must remain readable with the existing authored text, fonts and fixed title.
Source/screenshot diagnosis found body blur at fresh revision 0 before Take; the owner's timing
remains a report, not proof that pickup caused it. Opaque scrolling surfaces and removing a
settled page's persistent 3D transform are supported UI candidates. Actual cause and resolution
need later native before/after proof; no unsupported prop, native plugin or dependency patch.

## Announcements

Proposed for designer approval (loka-x6t.43). One polite live region, outside the page turn, reads
each new batch of World, combat and refused lines once, as shown and in log order. A refused line
reads "<reason>, <sentence>". History, redraws, page turns and a reopen are never read again. A
repeated line is read again. Condition changes arrive as log narration, so they are read the same
way. The region is text only, so motion settings do not apply to it.

## Future boundaries

Other-player presence requires a real projection and UI scope; no fabricated player rows.
Attack/skill controls wait until GameView offers them; there are no placeholders or invented
character data. Reading-time safety and interruption integration remains
future work under the [reading-time decision](../decisions/owner-decision-reading-time-2026-10-03.md).
A refusal reads as the kernel reports it: preserve genuine errors and meaningful history
rather than hiding errors or clearing same-room history. Whisper needs a word, so the NPC page offers no Whisper card; whispering is the [Word bar](#word-bar)'s.

## Combat interaction

The installed first-fight interaction follows [Live combat response](#live-combat-response-m6-a).
An NPC a [spell](mechanics.md#spell-effects-toolbox-row-29b) kills gets no "leaves" line in the Book log (Beads `loka-y6yg.44`).

## Shared elapsed status/completion boundary

Game offers typed state updates (confirmed projection and elapsed/catch-up/save status) and
terminal completion of the retained invocation, with identity and settled pre-command view.
Immediate terminal calls are not repeated as completion notifications. Catching up means time
settlement; pending means an unknown save. The Book consumes one subscription per Game with cleanup/lifetime guards. Each confirmed
boundary processes ambient arrivals/departures and new narration once, including consecutive
boundaries in one React batch. Ordinary background updates redraw without a page flip, preserve
same-room detail/scroll and chapter acknowledgment, and clear action-only return routing.
They never fabricate an action result, pickup echo or Journal updated event.

Terminal completion must match the original retained invocation and bounded Button/detail/item
context. Compare with its settled pre-command projection. Synchronous invokes can emit
prerequisite states first; use that confirmed settled observer frame so ambient changes already
shown are not repeated. Consume each terminal result once, without retaining a World or growing
completion ledger. When an open thing matches the pending speaker and that NPC departs, retain
the route as Conversation with speaker-keyed history and the real targetless Leave the
conversation, which returns to World (the speaker is absent); unrelated
vanished things and player movement keep ordinary route removal. No NPC is invented.

The existing save-not-confirmed status reflects unknown save state, independently of a retained
clock attempt. A separate catching-up note describes time settlement. Errors keep the confirmed
view and existing recovery affordance. The Book reports confirmed recovery to the App through
its Shell callback; [App lifecycle](architecture.md#elapsed-session-driver) owns wakeups.

The session snapshots only validated bounded invocation data, including target_ids and input,
so caller mutation cannot change the retained attempt or its completion context. During
catching_up, a different identified intent returns conflict while the original attempt and
status remain retained; a matching retry uses its original identity/context.
A conflict, invalid or unauthorized reply logs one plain sentence, never the reply kind or a
code in brackets; [words](../../mobile/app/book/words.ts) owns the sentences. Pending unknown
save retries keep the existing original-attempt behavior for any subsequent press. A press
refused after a catch-up gets no "what changed" sentence: the catch-up's own lines (rounds, a
death, an expiry) already precede the refused line in order, and the refused line carries its
reason word.

A timed hazard (submersion) shows its remaining time from the confirmed projection on every page
it covers; the authority owns the deadline and the presenter keeps no clock and never renews
time. The way out (Up) shows on each of those pages while it is offered, bound to the captured
offer under ordinary freshness; an old view never promises rescue, and expiry redraws the truth.

## Live combat response (M6-A)

An attackable present NPC offers deliberate Attack. An active encounter automatically opens
and foregrounds its own full Book page, like dialogue, including when another ordinary page
or menu was open and when reopening a saved encounter. The page names the opponent, shows
committed combat narration, and renders only currently available Stand, directionless Flee
and Look actions as complete typed invocations. The shared kernel ActionSet also permits Scan;
its existing phone presentation deferral remains. The combat restriction is applied after all
ordinary contributions, so no blocked action or alias is exposed by a hidden ordinary page.
Attack initiates combat from the NPC page; it is not usable again during an open encounter
and is not shown on the combat page.
Flee lets the engine choose a random currently legal exit; success shows the actual resulting
room. All offered combat actions appear as a vertical dialogue-style list below the log inside
the same ScrollView, not a fixed strip. No unavailable or future skill actions are invented. World time continues
while the combat page is open.

Combat takes precedence over ordinary navigation until the encounter closes. **Opening.** The
receipt that opens an encounter (a move's or Sleep's `engage`, Attack, a cast's fight-back)
routes all of its narration to the combat log, so the page opens with the engage line as its
first log line; the opponent block always shows, so the page is never blank. The opponent block
leads with the opponent lines, each the name and its hp band phrase joined by " — " ("the
raider — hurt", the cartridge's `band.<key>` words the status line uses; no number, the hp
band stays on the locked status line; the opponent's band is a GameView field, engine slice
loka-y6yg.49); the target suffix follows the name, before the dash ("the raider (your target) — hurt"). Your own bleeding and condition lines draw nowhere on the Combat page: they stay
on the status line and Character, so a reader never takes your hunger for the raider's
(pass-1 C2b, as loka-x6t.15). **Closure.** On
every committed closure (opponent death, player death and inn return, successful Flee, any
other end) the Combat page stays the shown page, as a one-reply conversation does: its opponent
block of names only, without the band phrase or the target suffix (nothing is left to aim at), its log ending with the closing
lines (every line of the closing receipt, whatever its key), no action cards, and one foot Control
[**Back to World**](../BOOK-UI-COMPONENTS.md#component-catalogue) (the existing label; no
new words). The status line stays locked as during the fight. The tap is local (no engine verb)
and shows the World page of the room the player is now in (the inn after death, the room fled
to) through the existing room-change flow. Time runs meanwhile; later ambient and room lines go to
the World log. A new encounter replaces the ended page; nothing is stored, so reopening a save
after a closure shows the World. A pending save keeps the confirmed
encounter and existing retry behavior; a refusal remains visible on the combat page. The UI
never presents an unconfirmed hit, death, escape or encounter end as committed. Results
narrate once through the existing subscription and cartridge text. Combat narration belongs
only to the combat page and its retained history, never the World room event log, including
the engage line, closure, death, Flee and reopening a save after any of them. Routing uses
structured committed receipt metadata (an encounter present after the receipt that the settled
pre-command view lacked, or gone after it), never rendered prose; ordinary room events remain
in the World log even when delivered in the same receipt as combat, except the closing receipt,
whose lines all stay on the ended page (the arrival room's description after a Flee or inn
return reads there, once). This replaces the earlier
persistent bottom strip; see the [owner combat-page decision](../decisions/owner-decision-m6-a-combat-pane-2026-10-04.md).

A committed dodge or block reads once from the structured attack result and authored text; a
miss has its own line. During an encounter a held item's legal combat use (a bandage on a bleed)
is one Action card beside Stand, Flee and Look, sending the exact item and current effect; other
item controls stay hidden and Flee is never displaced.

## Letter-bank riddle details

A pending riddle's clue, ordered tiles and answer controls follow the NPC description and
committed detail history. Tile selection is bounded by the projected bank, including repeated
letters, with Backspace, Clear and Submit. The unsent tile buffer is local, never saved.
Submit uses the ordinary Choose button and answer input. Refresh across elapsed-only redraw
requires the same continuation, speaker, choice and bank; a pending retry retains its original
invocation and answer. Wrong and correct narration stays in the bound speaker's detail.
Request committed narration by the sent invocation's command ID even when it has no events;
never borrow the latest unrelated receipt. Cold reopen restores the committed detail line
once, including after a successful answer removes the pending choice. Scene/combat precedence
and typed save-corrupt handling remain in force.

## Conditions details

GameView `conditions` lists every active [status](mechanics.md#status-effects-over-time-toolbox-row-1) on the body with its authored label, end, next tick and per-tick change; `bleeding` keeps its own field and lines. A condition label is authored lowercase, like a position word (`poisoned`, `blessed`); an icon's tooltip and name show it as authored and the Character page capitalises it as it does the position. A condition's line is the label, the time remaining and the signed per-tick amount with its pool key, joined by " · " ("poisoned · 4m remaining · -1 HP each 60s"); a permanent condition has no time part, one without a tick no amount, and the sign is always in the text. A duration or cadence under two minutes shows in seconds ("40s"), under two hours in whole minutes ("60m"), otherwise in whole hours ("12h", "24h"; never "1440m"; pass-1 UN). The Character page lists each line, its label capitalised, after the bleeding line; the Combat page draws none of them ([combat rule](#live-combat-response-m6-a)). The status icon row shows one round icon per condition, buffs and debuffs told apart by their look, five icons then a +N disc; a tap opens Character; the Character page keeps the full list. The row sits above the status line, in condition order; a hold (a hover or keyboard focus on web) shows the label and time joined by ", " ("fed, 48m remaining"), and an icon's name adds the polarity and the action ("fed, 48m remaining, buff, opens Character"; no polarity for a neutral condition; "+1 more, opens Character" for the disc). While the status line is locked the icons are named pictures, not buttons, dim like the Contents button (the neutral look). A timed icon wears a countdown ring round its disc: a track and an arc for the share of its duration still to run ([look](../../mobile/app/book/StatusIcon.tsx)), clockwise from 12 o'clock, recomputed from projected time; between updates the arc drains linearly to its new share over the real time since the last update, at most 1 s (display only; presentation keeps no gameplay clock), and jumps without motion on first show and on a refresh; under reduced motion it steps; while locked the ring dims with its icon ([look](../../mobile/app/book/StatusIcon.tsx)) and still drains; at its end only the track shows, and a permanent condition has no ring. Icon glyphs are placeholders until loka-x6t.63. The presenter reads projected state and never computes or writes an effect, tick or cure; applied, tick and expired lines come from their receipts' narration and appear once. No new control: a cure is the ordinary Eat of a held item whose `cures` lists the condition.

## Away recap

Proposed for [designer](../decisions/owner-decision-designer-role-2026-10-07.md) approval; wording pending designer (Beads `loka-x6t.14`). When GameView carries `recap_after` ([away recap](mechanics.md#away-recap-toolbox-row-w27)), the presenter holds the World-log lines of each elapsed settlement (ambient arrivals and departures and receipt narration, each receipt line on its own) from its first background update until the elapsed status is no longer catching up. If the status is then ready, the held lines are not empty and the settlement spanned at least `recap_after` of logical time, they become the away recap; otherwise (a shorter settlement, or a pending, error, fault or replaced status) they go to the World log in order, as without the field. The recap opens the World page, after the fixed title and before the room prose: one block, collapsed to its heading "While you were away", whose accessible name adds ", show" or ", hide"; tapped open, it lists each distinct line once in first-seen order, with " (N times)" after a line seen more than once ("The poison burns in your veins. (11 times)", "Maud leaves. (6 times)"). The page below is unchanged and ends in its status line, which shows the present state. The next press removes the recap; a press while time still catches up ends the settlement's holding, so its lines go to the World log in order before the press's own; a second long absence before any press adds its lines to the same recap; when the player's room changes, held lines and a shown recap are dropped with the old room's log. Nothing is stored, so a recap shown before the app closed is gone after a reopen; on a cold reopen with the field authored, catch-up waits until the Book has subscribed, so that absence's settlement gives its recap. Lines routed to a detail, a conversation or the combat log keep those routes. Without `recap_after` (Chapter 1) nothing changes.

## Worn affects details

GameView `attributes` carries each attribute's current value, which already includes the [affects](mechanics.md#item-slots-and-affects-toolbox-row-3) of worn items, and `worn`, their nonzero sum (absent at zero); `worn` sums identified items only, so an [unidentified](mechanics.md#unidentified-items-toolbox-row-27) worn item moves the value but adds no note. The Character page's attribute line appends it in parentheses with its sign: "PER 14 (+4 worn)", "STR 8 (-2 worn)"; without `worn` the line is unchanged ("PER 10"). The sign is always in the text. The presenter never adds or computes an affect; Wear and Remove are the ordinary equipment actions, and a second ring is worn on the finger slot like any item.

## Levelling details

GameView `levelling` carries `{level, experience, next, unspent}` from [experience and levelling](mechanics.md#experience-and-levelling-toolbox-row-4) (`next` absent at the top level), and `attributes` values already include allocated points, so a spent point reads as the attribute itself ("STR 11"), with no separate line. Everything shows on the Character page; the status line adds nothing. After the ancestry line: "Level 2", or with unspent points "Level 2, 1 point to spend", "Level 2, 2 points to spend" (plural by count). Last line of the resource block, plain like pennies with no band: "xp  30 / 50" (the next threshold), "xp  120" at the top level. Last block before the foot: one Action card per authored attribute, "Raise STR", "Raise CON" and so on, each sending the one offered `raise_attribute` action with that attribute as its input; the cards show only while the action is offered (a point to spend) and go with the last point, never a disabled card. A Raise follows ordinary freshness, pending-save fencing and receipt replay; a pending save shows on the status line as on every page, so the page adds no note of its own. A level-up is the receipt's authored line once in the log, at the end of that step's lines, with no banner; the level line, xp line, attribute values and derived lines change together when the receipt is confirmed. The presenter never counts experience, levels or points.

## Displayed name details

When GameView carries actor_name, the Character page's first line is its authored text, uncapitalised, with no label; it suppresses the empty placeholder. A title or disguise change shows as the new name once its receipt is confirmed; the only log line is the receipt's authored narration. Without actor_name the page is unchanged.

## Sense cues details

GameView `cues` lists the [sense cues](mechanics.md#sense-cues-sound-smell-and-heat-toolbox-row-g6) reaching the player's room, nearest first. The World page shows one quiet line per cue, in that order, as one block after the room's entity lines: the authored text, then " from the " and the direction key when the cue comes from another room ("Hammering from the east"), the text alone when it comes from this room ("Heat beats out from the forge."). Two cues with the same text and direction are two lines. The sense is in the authored words, never an icon or a colour alone; the line is not pressable and its accessible name is its text. No cues, no block. The presenter never walks exits or decides what reaches the player.

## Aside details

GameView `place.asides`, a notice's `asides` and an NPC's `asides` are quiet lines: the character's own mind noticing more ([passive skill voices](mechanics.md#passive-skill-voices-toolbox-row-fd2)) or a present person's remark ([companion remarks](mechanics.md#companion-remarks-npc-asides-toolbox-row-fd10)). Each is one Note, in projected order, as one block directly after its owner: room asides after the authored description, on World before the exit warnings, on a detail before its projected item state; on World the present people's asides, in listed then authored order, form one block right after the people, before the loose items; on an NPC's page its asides come right after its description. The skill or speaker is in the authored words, never a label, icon or colour; the line is not pressable, carries no touch link (link markup shows as plain words) and its accessible name is its text. No asides, no block. Darkness is the engine's omission: a dark room carries no `place.asides`, while a perceived NPC's asides arrive and show; the presenter never decides which aside holds.

## Lore details

The Journal page says "Nothing written yet." only when it has no quests, no known topics and no [Chronicle](#chronicle-details) day; after its quests, it shows **Lore** (a section title) when GameView `topics` is non-empty: each known topic's authored label, one per line, in projected order, then for each GameView `deduction` its topics' labels joined by " + " and its card. The card is the deduction's offered action when the current place offers it; when the place lists it unavailable, the unavailable card with the action's own reason; otherwise the unavailable card with the reason "Not here". Pressing the card performs the recipe as any place action; the topic it grants then joins the list and the deduction disappears. Badges are topics and are listed with them. Nothing shows when no topic is known. ([Lore codex](mechanics.md#lore-codex-and-deduction-toolbox-row-46); wording proposed, designer to approve: Beads `loka-x6t.14`.)

## Chronicle details

The Journal's last section, **Chronicle**, shown when at least one entry exists ([Chronicle](mechanics.md#chronicle-toolbox-row-fd6)): one block per day in ascending order, headed "Day N" as the Away recap's Tap heading (name adds ", show" or ", hide"); the latest day open, earlier days collapsed; open, each distinct line once in first-seen order with " (N times)" after a repeated line (the recap's grouping), ordinary lines in the ordinary log look, a milestone's line in the page's prose look, one step larger, its accessible name the line followed by ", story point" (a line is a milestone when any of its occurrences that day is one). Lines are the receipts' authored narration; the Book adds no words but the heading, the count and the accessible name. Opening the Journal reads the receipts once; the page is not live-updated while open (a press returns to World anyway). A Chronicle day counts as written for "Nothing written yet." ([Lore details](#lore-details)).

## FD7 ask details

An NPC that the GameView lists an available `ask` on shows, after its other action cards and before services, one card per known topic (GameView `topics`, projected order) labelled "Ask about" and the topic's authored label. Pressing it sends `ask` with that topic; the answer or the person's knows-nothing line joins the page's history as narration, the page stays, no conversation opens. A topic granted by the answer adds its card at once. No known topics, no cards and no note; a hostile, absent or unlisted person shows none, as Talk. ([Ask about a topic](mechanics.md#ask-about-a-topic-toolbox-row-fd7))

## Word bar

While the GameView offers `say`, `shout` or
`cast` and no combat, scene or conversation is open, the World page shows a Word block last in
its scrolling body, after the log (pass-1 UA; [room order](#world-and-status-entry)): the **Word** section title, then rows of
[Chips](../BOOK-UI-COMPONENTS.md), each row under a Note-look title. Say: one chip per
cartridge phrase (GameView `phrases`). Whisper to <name>: the same phrases, one row per present
NPC that lists an available `whisper`. Two present people with one shown name share that title; the Book does not number them. Shout: the same phrases. Cast: one chip per learned spell
word (GameView `spell_words`, never an unlearned one); a word the GameView refuses is an
unavailable chip with a `word, cast: reason` line under the row. Each chip's name is the word, then
how it is spoken (`ward, say`, `ward, whisper to the elder`, `ward, shout`, `ward, cast`); a press
sends that action with `{word}`. A word that opens a conversation turns to it, as Talk does.
While `say` is offered, with or without phrases, a **Type a word** Control opens one text field (named
**A word**, up to 32 characters, no autocorrect or autocapitalize) and a **Say** Control;
Enter or Say sends `say` with the typed word. A word that is not 1 to 32 letters is not sent and
shows the Note **One word, letters only.** An accepted `say`, `whisper` or `shout` whose receipt
carries no narration gets one log line from `words.ts`, the Book's own echo of what was sent:
**You say "ware".**, **You whisper "ware" to the jailer.**, **You shout "ware".** (pass-1 R5);
a receipt with narration draws that instead. Beyond this echo the Book never writes the typed
word anywhere; only its writer sees it.

## Storylet card details

GameView `storylet` names the one place action the [storylet deck](mechanics.md#storylet-deck-toolbox-row-fd3) draws for the player here this hour. The World page shows it as one Action card, its own block directly before the verb lines, never among them, so the hour's one pick is told from the place's standing verbs; available or unavailable it keeps that block (pass-1 R2). The card reads the recipe's authored label alone, never a heading, prefix ("Opportunity:"), icon or colour; unavailable, it is the `label: reason` note of the Action card row, never a disabled card. Pressing it performs the action as any place action under [live action freshness](#live-action-freshness): its result, including a failed check, is the receipt's narration in the log, and a scene it starts opens as any [scene](#chapters-scenes-and-recovery). A new room or hour redraws the page: the card may change or go, silently (no live region; it is page content as the entity lines are); a press drawn under the old pick is refused and the Book redraws, never a substituted card. Its accessible name is its label, role button. No pick, no block; at most one card. The presenter never draws or filters storylets.

## Skill tree details

Skills without a profession draw one line each: the label, then " — learned" with no requirement, or while its projected `qualified` is false " — learned, unqualified; <requirement>" (pass-1 H3). After the xp line and before the Raise cards, each profession in first-listed order is a SectionTitle, then its listed boxes in GameView order: acquired as body text "Whittling, level 2 — learned" (", level N" only when projected; no requirement: a qualified learned box has nothing left to meet) or, while its projected `qualified` is false, "Whittling, level 2 — learned, unqualified; <requirement>" (pass-1 H3); an NPC's teach card for a learned skill is the GameView's unavailable action and draws in the Action card's unavailable form `label: reason`, never dropped (pass-1 R2); locked as a Note "Carving — locked; <requirement>"; any other unacquired box as a Note "Joinery — not learned; <requirement>" (the same Note). The Book draws only listed skills: a hidden box and an empty profession draw nothing.

An NPC's lesson line reads `locked` in place of `not learned` while the skill's projected `locked` is true. A learned skill's lesson line ends at "currently qualified." with no requirement while its projected `qualified` is true: nothing is left to meet (pass-2).

## Mount details

Riding shows nowhere but the horse's saddled description variant and the mv fare; a non-road exit while mounted is the ordinary barred exit ("East: not now", no Go). No indicator, icon or status line text.
