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
[detail-page order](../decisions/owner-decision-detail-page-order-2026-10-05.md)
and the detail-page redesign (owner pick mvlrlvappy4w, 2026-10-23: no status line on detail
pages, the shop page, one Talk card, services grouped by order, Whisper hidden) and its follow-ups
(owner picks mvlyb5x2m9i3, mvlymuams73l, mvlynyikyw57: no filler lines, Talk then Trade, no Give
an item…, the shop's buy and sell pages).
Original feedback lives in those records; independent reviews and retained interaction proof
are listed in the generated [review index](../reviews/README.md). The per-mechanic detail
sections of retired chapters were removed on 2026-10-22; the rules they shared are stated below,
and their text is at [the last commit that held them](https://github.com/lorecrafting/lokacore/blob/c88762e38eb9c3747f1de0b87e6536d58424c24e/docs/system/book-ui.md).

## Room page anatomy

The rule every World-page passage obeys ([owner decision](../decisions/owner-decision-room-page-anatomy-2026-10-23.md)).
The scrolling World page is, top to bottom, and nothing else:

1. The room title.
2. The description paragraph. Its only pressables are fixture and furniture links in the prose,
   each opening its own detail page, where that thing's actions live.
3. The people paragraph (players and NPCs), each name opening its detail page.
4. The items paragraph, each name opening its detail page.
5. The room event log, the full record: every line lands here ([line placement](#line-placement)).
   Ambient lines (sounds from the next room, weather changes, room events, NPCs acting or emoting,
   arrivals and departures), the player's own lines and refusals, combat lines, the lines a
   detail page also shows and the [away recap](#away-recap) (one collapsible entry; its heading is
   the log's only pressable). An exit's projected warning (D6 water entry) is logged once when
   the player moves through that exit, after the movement line; World draws no warning block.

No loose actions, verbs, asides, chips, cards, notes or other blocks. An action lives on a
fixture, person or item detail page. On hold: a skill check (perception, lore) may add a sentence,
fixture or furniture to the description paragraph itself, never a block of its own. The minimap
and joystick, the status line and the say field sit outside the scrolling page and keep their own
rules below. A passage below that draws anything else on the World page is superseded; where the
Book still draws it, the passage names the Beads item that removes it.

## World and status entry

World is one current-room page ([room page anatomy](#room-page-anatomy)). Its centred title (owner, mvl8eti4yeoe: rooms centre their title; every detail page keeps a left-aligned one) remains fixed above the scrolling authored
description, the people and items sentences and, last, the event log (words go through the
[say field](#word-bar)). World draws no verb line, refused `label: reason` note or
notice entry: every action, available or refused, draws on its target's fixture, person or item
page, a pair through its [pick list](#item-details-and-takedrop) (owner 2026-10-23, quoted: "all
actions on targets [...] should be in the target detail page, or item detail page, and not in the
main room page").
World draws no door card: Open and Unlock work from the Map and the
[joystick](#minimap-map-and-presentation-controls), and a door's state shows on the minimap: World
draws no door state line (a walk into a shut door still logs its refusal, [Minimap](#minimap-map-and-presentation-controls)) (owner 2026-10-23, reversing pass-1 R4; quoted: "the 'locked' door
would show in the minimap joystick thing, not in the main description or event log page").
The description
may contain underlined touch links for projected room fixtures: scenery, fixed doors or
exit cues, and other room-bound subjects. A fixture link stays within the authored prose,
whether it appears mid-sentence or at the end of the last paragraph; the Book does not
move it into a separate entity list or force a paragraph break. A fixture is
immovable room content: it cannot be taken, dropped, stored or otherwise removed
from the room. A removable object is a loose item in the item group instead.
The link opens a detail only when the current GameView supplies a visible,
current-room identity and detail route (a notice whose `key` is the
link's target); the link opens that detail's page, and a readable one also invokes its captured Read (Notice-board details). The Book does not infer visibility, identity,
detail or an action from bracketed prose alone. If that projection is absent,
the words remain ordinary prose until a mechanic adds the required projection
and admission contract. A notice, board, bed, transport or counted harvest reaches its page only
through its link in the selected description; one the description does not link
draws nothing on World. The selected room-description variant itself must omit
concealed fixture or exit text until the game reveals it; the Book cannot hide
an authored phrase after receiving it.

Below the description, present players and NPCs form one sentence and loose room items
a second, NPCs first (owner, mvl9864n2qi8, mvl9q99wzm29): names joined with a serial
comma and "and" before the last, the first name capitalised, ending "are here." ("A and B
are here."; "A is here." for one), for example "Aldous, Bess, and the cook are here." With cartridge name words a person shows its bare name, one shared 'the' per run of adjacent definite
names, written again after a proper name ('The carpenter, Aldous, and the cook are here.') ('Aldous, Bess, the carpenter, chandler, and cook are here.'; owner 2026-10-23);
loose items share 'a' or 'an' the same way, written again when the word changes ('A wooden bench, knife, and an
orange are here.'; owner 2026-10-23), and written again on a name ending in the same word as the one before it ('A stick and a stick are here.'; 'A cowering goblin and a goblin are here.'; owner 2026-10-30);
same-kind entities with a plural collapse into one link, 'two crows', count words to
nine, digits after; the link opens the first member, and after Take the sentence recounts ('Five eggs are here.'), so
every member stays reachable (PM ruling 2026-10-23); a name without words draws as its `name`. Combat foe lines take the definite
form, one line per foe. Every entity that is not an
NPC or player goes in the item sentence, so none is dropped or listed twice. Each name is
its own inline link named "<name>, open" that opens its detail (a tap, or Enter or Space on a keyboard); the commas, "and" and "are here."
are not pressable. An item's Take option appears only when currently offered; an NPC or
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
World scrolls to its end as its log grows, as a person's page does.
Standalone exit directions, adjacent-sight listings and redundant navigation/
Look headings are omitted using structured outcome/TextKeys, never English matching. Under the owner's
explicit per-room clearing direction, the World event log scopes
to the actual room: after a confirmed accepted action changes place, clear the old-room log
before adding genuine new movement/quest/authored consequences. The room shown is the one the
committed receipt places the player in, never the exit's destination: an arrest (a wanted player
walking in on an arresting guard) turns the World page to the cell, and its log carries the move's
lines in receipt order (arrest line, then the reaction's charge). A death outside a combat round (a bleed or drain tick, in a press or an elapsed settlement) is the same: the World page turns to the recovery room and its cleared log opens with the death receipt's lines in receipt order (the tick, `world.death.narration.player_died`, the penalty line, `world.death.narration.woke`), never dropped by the room change; such a settlement ends any away-recap holding, its earlier held lines go with the old room's log, and its own lines never enter a recap (Beads `loka-3w3q`, `loka-x6t.26`). Each narration record of a
receipt is its own log line, in record order; the Book never joins records into one line, and
the `words.ts` outcome word ("Time passes.") draws only for a receipt with no narration at all
(pass-1 UO). No card, note or banner. Attempts, pending/refused/stale
results, rerenders, same-room NPC actions, Leave and section navigation do not clear it. Active
save status/error UI remains accurate; NPC histories stay independently bounded. Map
retains movement, adjacent sight and legal door actions, and draws no event log: the log lives
on World only (pass-1 UF1). An exit's door state line ("The hut door: open", the cartridge's door name capitalised) draws only when no
exit card already carries that state as its reason; the door's action cards stay (pass-1 UF2).
The World minimap/joystick sits outside
the scrolling body, with status beneath it, inside the existing safe area.

A projected Read place action keeps its exact detail target and authored label and follows
the canonical [notice-detail rules](#notice-board-details).

The enabled status/resources tap opens Contents. It lists exactly **Character**, **Inventory**, **Map**, **Journal**, **Settings**. There is no Menu button or extra World navigation
row. Character shows existing projected resources and position, without unrelated index links.
Inventory separates held items from worn slots; Journal uses projected quest text;
Settings retains Start over and its confirmation/error handling, and holds the
[page-turn sound](../BOOK-UI-COMPONENTS.md#page-turn) on/off control. Contents and every
section it opens draw no status line (owner, 2026-10-30, loka-8lpm; the [page foot](#detail-page-order)
rule). A section opened from Contents returns with **Back to Contents** (one page back), and Contents
returns with **Back to World**; a section opened another way (Character from a status icon, the map
from the joystick or footer, an Inventory restored on reopen) says **Back to World** and clears the
stack to World. A page a section opens returns to that section (an item page's Leave to Inventory).
A room change, death, combat, a new chapter, Start over and an accepted Take or Drop still clear
straight to World.

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
shown position optimistically. A confirmed change writes one World log line: its authored narration, else the engine's position line ([line placement](#line-placement)). This opens no detail page or Contents and does not turn the
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
and logs the refusal without movement. The barred-exit tick tells a closed door from a locked
one ([MapDrawing](../../mobile/app/book/MapDrawing.tsx), owner 2026-10-23). Release (or an arrow key)
toward a shut door presses its offered Unlock, else Open, one action per release; with neither it
logs one line naming the door ("The door to the south is locked.", "above"/"below" for up/down)
and walks nowhere. The reader actions name the reason too ("Go west, locked").
Direction/reason appears opposite the finger. The existing
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
beside the section's own return ([Contents](#world-and-status-entry)). An unvisited endpoint, NPC or item is never drawn merely because
the cartridge contains it or adjacent sight names it. Existing current-room exit and door
controls retain live admission. Where labels distinguish currently visible `here`,
`last seen` with the saved place/time, and `unknown`; a hidden co-located NPC does not
become `here`, and a stale observation is never phrased as a current location. A last-seen
answer gives the time since in the [condition durations](#conditions-details) ("Maud: last
seen at Inn yard, 2h ago."), "just now" under two minutes. Each known
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

Detail pages show title/identity, authored description, projected item state, then their
chronological event log only when entries exist, then currently offered options in the same
scrolling content. Options list in one fixed order (pass-1 UR): first the verbs that act on the
thing itself (Read, Eat, Drink, Wear, Light, Open, Talk, Attack, a scripted action), then the verbs that
move it (Take, Lift, Drop), then the verbs that store or hand it over (Put into <container>,
Give to…), then asks, Trade and services (a person's page orders its own cards,
[rule](#npc-dialogue-and-action-details)); the thing's own pick options (Use an item…, Use on…, Cast a
spell…, [rule](#item-details-and-takedrop)) close the first group in that order; a corpse's Take from it precedes Put into it. Within a group the
GameView's order stands. An empty log has no heading or placeholder. NPC, item, notice, board and
combat details follow this order; World follows the [room page anatomy](#room-page-anatomy).
A page's local returns (Leave, Back to World, Back to Contents, Back to board, Back to map,
Close) sit in its page foot, below the scrolling content, nearest first, and the foot's last
control ends the page; offered actions never do. Item, notice, board, NPC and shop pages, Contents and its
sections draw no status line, compass or say icon (owner pick mvlrlvappy4w, 2026-10-23;
loka-8lpm): a pending save shows
as one dim **save not confirmed** line in the foot under Leave, and the catching-up line and a
fault show there as on every page. Combat and World keep the
[status line](#world-and-status-entry). World, a scene, a chapter title, the ancestry choice and combat have no
foot. A control that opens a child (Resume dream, Look inside) stays in the content. An NPC or item detail's history belongs to the page visit: it starts empty when the page opens and is dropped when it closes by any route (Leave, a Back control, Contents, Map, a room change, death); a line shows at most once on one page ([line placement](#line-placement)). Combat closure and the notice-board readable restore are the exceptions in their sections.

## Line placement

Owner and PM rulings 2026-10-24 ([narration log brief](https://github.com/lorecrafting/lokacore/blob/3a0af6b75d34c7ee7fac55837038ab3833562dd0/docs/briefs/narration-log/README.md)). The
engine emits every line; the Book only words and places it. An engine line's sentence comes from
`mobile/packages/game-view/line_words.ts`, first person when the player acted, third person
otherwise; an authored line keeps its own text, except an `emote.performed` line: its sentence is the emote's authored form that the reader's line selects (`others`; `to.you` when the reader is the target; otherwise `to.others`), worded by `line_words.ts` with `{actor}` and `{target}` filled in and capitalised as a sentence.

- Every line lands in the room event log: narration, refusals, arrivals and departures, combat
  lines and a detail page's lines. Read text is the one exception ([Notice-board details](#notice-board-details)).
- One display table, keyed by event key and the open page, gives each line one treatment:
  **in place** (the open page's history and the room log), **log** (the room log only) or
  **quiet** (the room log only, compacted; no text on the open page). Quiet so far: the player's
  own buy and sale on the buy and sell pages, and the player's own take and put on an open
  container's item or Inside page (a corpse included). Any other line whose receipt routes to the open page is
in place; every other line is log. The page's own redraw (purse, list, contents) is the
  feedback. Another person's action is never quiet.
- A page never draws the room log, so no line shows twice on one page.
- Every log line reads as novel prose (owner, 2026-10-30, Beads `loka-r9mr`): no colon label
  (`Name: ...`) anywhere in the log. A found person reads `Nell is here.` or `Nell was last seen
  at the Landing, 2m ago.`; an appositive name closes with a comma before its verb (`Bess, the
  alewife, is here.`); a refusal with no sentence of its own reads `You can't do that—locked.`
  Dialogue: speaker, speech verb, the
  listener when there is one, a comma, then the spoken line in double quotes. To the player:
  `Nell says to you, "Well, stranger?"`; to the room: `Nell says, "Ale's a penny."`; the player:
  `You say, "Ware."`, `You whisper to the jailer, "Ware."`, `You shout, "Ware!"`. The Book's own
  echo uses say, whisper and shout; an authored line chooses its own verb. The quoted line starts with a
  capital and its closing stop sits inside the quotes; a line ending in `?` or `!` takes no added
  comma or period. Never the colon form (`Nell: ...`) and never a bare quotation with no speaker.
  An authored line that already attributes itself (`"Gate's shut," says the guard.`) is kept as
  written; the Book never parses quotes to add a speaker. Authored dialogue that is a bare
  quotation is a content fix (Beads `loka-548k`), not a Book rewrite.
- A vessel's liquid amount reads in words, never a count or unit label (owner, 2026-10-30, Beads
  `loka-ikat`), from quantity against capacity: `Empty.`; a third or less `Nearly empty, a little
  water left.`; between `Half full of water.`; two thirds or more `Nearly full of water.`; exact
  capacity `Full of water.` Only exact 0 reads empty and only exact capacity reads full. A light's
  fuel takes the same bands with the noun `fuel` and its state after a comma: `Nearly full of fuel,
  lit.`, `Empty, unlit.` (owner, 2026-10-30, Beads `loka-nkcr`). One helper words both
  (`amountWords`, `mobile/app/book/pick.ts`) on the item page; a liquid also on a twin row's note. A
  Fill, Pour or Drink log line is its sentence alone; the open page's redraw shows the new amount.
- Compaction: a quiet line merges into the room log's last line when both have the same key, the
  same bindings and actor, the same pressed card target (the stock row or item), the same page
  visit, and no other line lies between. The merged line is the sentence once with " (N times)"
  after it, as the [away recap](#away-recap) groups ("You buy it. (3 times)"). The merge reads
  structured fields, never rendered words. A new visit or any other line ends the run.
- Quiet is visual only. The live region reads each quiet line in full on every press
  ([Announcements](#announcements)).
- A refusal on a detail page draws in that page's history and in the room log, and is read once.
  A refusal is never quiet.
- Each room speaks from its own point of view ([record](../decisions/owner-decision-room-point-of-view-2026-10-24.md); the player's lines are built, the other-actor lines "<Name> leaves north." and "<Name> arrives from the south." are a target: Beads `loka-glj8` follow-up).
  A room change clears the old room's log; the arrival lines then open the new room's log in
  receipt order. A plain move logs nothing new for the player in the room left (others there see
  "<Name> leaves north."); the room reached opens with "You arrive from the south." (others:
  "<Name> arrives from the south."). The direction is the destination's exit that leads back to
  the origin (its reciprocal face, as `cartridge_barriers.ts` finds it), never a blind opposite;
  with no way back the line is "You arrive."; up and down read "from below" and "from above". A
  flight's "You flee north." stays the last line in the fight room's log; the room reached opens
  with "You run in from the south." (same direction rules; "You run in." with no way back). A death in combat: "You fall." and the
  fight's last lines stay in the fight room's log; the recovery room's log opens with "You wake at
  the inn." Room
  text the World page already draws (the title and description) is not repeated in its log.

Later, not this batch: a verbose or brief setting that shows quiet lines in place.

## Notice-board details

Every projected detail opens its own page from its prose link; a readable one invokes its captured Read on entry, a plain fixture shows its description and its offered cards. Every readable notice opens its own detail page. A notice, board, bed, transport or harvest opens only from its prose link; a standalone readable notice also invokes its captured Read offer. Its Leave
option returns to World. Its page title is an authored noun distinct from the action label.
Read text never enters the room event log.

A projected notice board opens locally from its prose link, with its title and selected description,
nonempty chronological detail log, then its ordered notice options. A notice option uses the
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

A readable detail's exact-subject scripted actions appear only in its Notice actions. Available controls
follow nonempty history; Leave sits in the page foot (on a person's page in conversation, Leave the
conversation, per the [conversation rule](#npc-dialogue-and-action-details)); unavailable controls show their real reason.
Available controls and unavailable notes use the same catalog action-label resolver
and its existing human-readable fallback. Never display an action TextKey as prose.
Opening the detail always invokes Read, never Study. Detail membership stays UI-only: a
no-target scripted action sends `target_ids: []`. These controls use the shared offer-to-button builder,
freshness and retry path. Confirmed readable-scripted action narration routes to the receipt-linked
detail, including replay after leaving its room, without World fallback. Recovery restores the
latest such narration once to its original history and opens a route only when that detail is
currently projected. A newer unrelated narration receipt cannot provide detail identity.

## NPC dialogue and action details

Tapping an NPC opens full details using its actual projected name, authored description and
actions. Description comes first. A person's carried-item line (EntityView `carrying`) follows the
description as a Note; World never draws it. Outside a conversation the page offers the person's actions as one
ordered list of Action cards straight after the description and history (owner pick
mvlrlvappy4w, mvlymuams73l, 2026-10-23): **Talk**, then **Trade**, the [pick
options](#item-details-and-takedrop) Use an item… and Cast a spell…, Lift or Take, [Ask
about](#fd7-ask-details), then the services. The foot is Leave. The Talk card reads **Talk**;
its accessible name stays the offer's label ("Talk to Nell"). Several Talk offers draw one Talk
card, the first available one; with none available the page draws nothing in its place, no
filler line and never "Talk: not now" (owner pick mvlyb5x2m9i3): a person with nothing to do
shows title, description, then Look and Leave. **Look.** Outside a conversation a **Look** Control
ends the person's page, after the cards and before Leave, and opens their Look page, an anchored
detail of the person's page as the [Inside](#item-details-and-takedrop) page is of its container
(owner, 2026-10-30, loka-aqnc). It draws the person's name as title, their description as prose, then
what they visibly bear in the fixed order condition, worn, carried (condition and worn wait on
loka-ysbt and loka-oc5i and draw nothing until then; no placeholder). Carried is one sentence,
**<Name> carries a flask and a knife.**, joined as the [room's who-is-here
sentence](#room-page-anatomy) is (articles, serial comma and "and", plurals collapsed), each item an
inline link opening its item page; GameView has no pronoun, so it names the person. With nothing
carried it draws no sentence and no Note. Carried means the person's directly held items offered
under `world.theft`, less their shop stock. The page draws no actions; its foot is a local **Close**
that returns to the person's page and sends nothing, and it goes with the person, carrying or not. A person's page draws no Give an item… card: a gift is
given from the item's own Give to… (owner pick mvlymuams73l). **Trade** shows while the
person's shop has a row; it opens the child buy page **<Name> can sell you…**, as a notice opens
from its board, and its Leave returns to the person. The buy page holds one buy card per stock
row ("Cob of bread — 4p"; refused, "Cob of bread — 4p: can't afford"), then the purse Note
**You have <n>p.** under the list, the visit history, then a **Sell** card (no ellipsis), drawn
only while the player holds something the person will buy. Sell opens the child sell page
**<Name> will buy…** (owner pick mvlynyikyw57): one card per thing the GameView offers to sell
to this person, with its price ("Cob of bread — 1p"), then the purse and history; Leave
returns to the buy page. It lists only what the engine marks sellable (wider sale lists are
loka-x6t.117). A buy or sale keeps its page open, with no page turn and no return to the person (owner,
2026-10-23): its own line is quiet ([line placement](#line-placement)), drawn on neither page and kept in
the room log; the purse redraws on both pages, and the lists redraw (a sold-out row takes its refused form,
"Cob of bread — 4p: sold out"; a thing sold leaves the sell list). A row that goes moves focus to
the page title. Shop stock is not listed
as carried on the person's Look page. Each service is its own Action card
with its authored label; the claim and cancel of an order sit under a **Your order** Section
title after the order card, and show only while an order is open (either is offered, or either
is refused for a reason other than `service.no_order`); while Your order shows, the commission
card is not drawn. The purse Note shows on the NPC page only when a priced service is drawn,
after the description; pennies show nowhere else on a detail page, and "can't afford" stays a
bare reason (pass-1 E15). It shows
no past conversation log on a fresh visit to the page or after Leave the conversation; lines since that visit began or that Leave are the only
history. Answering (a `choose` press) puts that page **in conversation**, and it stays so after a one-reply
answer closes the kernel choice: the choice's options sit immediately after the latest
chronological dialogue/event entry **inside** the scrolling content; no Talk card and no other
action card shows; the foot is a single **Leave the conversation**. Action and dialogue choice labels are bare imperatives without a trailing period (an ellipsis is not a period); a quoted spoken line keeps its punctuation. Content lint refuses an authored choice that only leaves (a Leave or Close label with no effect beyond its narration) in a talk with more than one choice; the page's own Leave control ends the talk. A talk with a single authored choice keeps its own Leave (loka-x6t.21). The conversation belongs to
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

An absent pending speaker uses its actual continuation without invented NPC data. World draws no
control for it: the choice waits on the speaker's page, the conversation page opens on a reopen,
and a talk to anyone else closes it. Live results
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
nothing to do with you."). No Talk, Trade or Ask about card is drawn; services and lessons
stay as offered; the foot is Leave. The authored line names the mood, never the cause
("Nell turns her back on you.", not what the player did); hostility ending redraws the actions
without a line. A buy page card's reason is always a word from `words.ts` `reason()` ("not now",
"too heavy to carry"), never a code with its underscores replaced; a buy refused `not_owned`
stays "sold out", and one refused `insufficient_resource` reads "can't afford" (`buyReason`).
A shop reason from the cartridge is a lowercase fragment with no period.

## Item details and Take/Drop

Inventory separates Held from Worn slots, including empty slots. Held/worn item
taps resolve the same detail; item pages follow [detail-page order](#detail-page-order), with current legal item/container/equipment actions, plus local **Leave** back to the page it was opened from ([grammar](../BOOK-UI-COMPONENTS.md#grammar)). An available loose item therefore offers Take
and Leave; Leave sends no engine verb. Confirmed accepted `taken` returns to World with the engine's take line ([line placement](#line-placement)),
the item named as the player saw it. Under the PM's explicitly adopted Drop symmetry, confirmed accepted `dropped` also
returns to World with the engine's drop line; an item opened from a Contents section (Contents › Inventory › item) returns instead to that section, Contents beneath it, as its Back would (loka-8lpm), and a cold reopen of a Read restores Contents, Inventory, each holder's page with its Inside or Look page, then the book. Held items
open their same item detail from Inventory, with existing offered Drop/other actions
and Leave, without invented Use/Equip actions, Take while held, or a custom gesture.
Authored narration takes precedence and meaningful consequences remain. Pending, refused, stale or failed attempts announce no success.
Retry retains original action/target context and appends each confirmed Take/Drop event only once.
**Inside.** A container whose contents are reachable (an open lid, or a corpse or lidless container with contents) never lists them on its item page: a **Look inside** Control follows its options and opens its **Inside** page, an anchored detail of the item page as the dream page is of its bed (owner, 2026-10-30, loka-mo0p); an accepted Open on the item page turns straight to it. That page draws the container's name as title, the section title **Inside** and one Entity line per directly held item, each opening that item's own page; an empty one draws one Note, **There is nothing inside.** It draws no actions (Open, Close, Take from and Put into stay on the item page) and its foot is a local **Close** that returns to the item page and sends nothing. A contained item's Leave returns to the Inside page. The page goes when its container goes, when the lid closes, when the contents stop being reachable (an emptied corpse), and on a room change, death or Map as every detail does; a cold reopen of a contained Read restores item page, Inside page and item page.
When Take removes an item from a corpse's Contents, the confirmed result returns to
that corpse's Inside page (its item page once the corpse is empty), where the take line is quiet ([line placement](#line-placement)), and keeps
Back to World available. The taken item appears in Carrying. An unavailable corpse
closes its detail through the ordinary stale-route rule; no success is inferred. A living NPC's directly held items, offered under `world.theft`, are the carried sentence of their [Look page](#npc-dialogue-and-action-details) (not Inside, never a list on the person's page), each link opening the ordinary item detail; there the theft card reads **Lift** (a `LABEL` word, never Take) with one Note **<Name> is holding it.** above it, so the verb and the line name the risk before the press (pass-1 E14, owner 2026-10-21); a corpse or container keeps its **Inside** page and Take.

A container with a lid (cartridge item `barrier`, loka-x6t.121) draws its state as a note (**Closed**, **Open**) and, while closed, no Look inside: Open is one of its own cards (first group), an accepted Open logs **Opened.** in the item page's history and turns to the Inside page (owner, 2026-10-30, loka-mo0p), so Close shows the line on the item page, now with Look inside; a refused or pending Open stays on the item page; Close is offered while open and nothing closes on Leave; Unlock appears only when the lid has a `key_item`. Take from and Put into a closed container are refused by the engine (`not_present`, `exit_closed`), so the page never lists them.

An item action advertised unavailable with `too_heavy` appears as a non-action note using its
actual catalog label and **too heavy to carry**; one refused because the load is full reads
**more than you can carry** (kernel code `over_load`) (pass-1 R3). `resource.short` reads "need <n> <key>"; `permission_denied` reads "not yours". It invokes nothing; available actions retain their
existing buttons. The note follows the latest GameView, including Take aliases and Contents,
and disappears when shedding held load makes Take legal. An item or NPC page with nothing to do
draws no filler line ("Nothing to do here.", "<Name> has nothing to say just now."): title,
description, then Leave (owner pick mvlyb5x2m9i3, 2026-10-23).


Successful ordinary Take/Drop are the specific exceptions to item-page retention; corpse-content
Take follows the corpse-detail rule above. Other same-room item actions
retain the page and route their results to that item's local chronological history while the
item remains projected; leaving the room or losing the item closes
obsolete details. Inventory item taps keep existing reachable held/worn behavior.

Put appears as a concrete pair button using projected source/destination names and IDs.
Each button captures its projection freshness and follows the normal GameSession invocation
and confirmed receipt routing. There is no separate storage session or recipient selector.

**Pick a second thing.** An action that needs a second object never draws one card per pair; its page draws one option that opens a list of the GameView's pairs, and a pick sends one (owner 2026-10-23, quoted: "you click that option and it opens a list and you pick an item and then the item detail closes with an echo the log"). There are four such options drawn, each a `LABEL` word ending in an ellipsis:
- **Use an item…** on a target's page (an item, a person, a notice or a fixture with a page): one row per carried tool the GameView lists in a use pair (G4) on this target, target_ids [target, tool], labelled with the tool's projected name.
- **Use on…** on a held tool's page: one row per target the GameView lists in a use pair with this tool, labelled with the target's projected name.
- **Cast a spell…** on a target's page: one row per aimed spell the GameView offers on it, labelled with the spell's word (`lux`), as the say field's chips name it. The cast-with-target command is engine row loka-x6t.109; until it lands no target lists one.
- **Give an item…** is not drawn: a person's page has no Give card (owner pick mvlymuams73l, 2026-10-23); the item's Give to… gives.
- **Give to…** on a held item's page, its reverse (PM 2026-10-23, for symmetry with Use on…): one row per person the GameView lists in a Give pair with this item, labelled with the person's projected name.

Rows keep the GameView's order. When one list holds pairs of more than one scripted action, each row reads the scripted action's authored label and the other object ("Douse with the bucket", "Fill from the trough" on the cart; "Douse the cart" under Use on…), so two pairs of one tool never read alike. Two things that share a name stay two rows, each bound to its own EntityId, never merged, with no invented suffix: a row shows the item's projected state (empty, full) as its quiet note when the GameView projects one, otherwise the rows stay identical in listed order (PM 2026-10-23). A row's accessible name is its shown label, then the action ("bucket, douse the cart"). Unavailable rows: a use pair refused `cooldown` is one row in the Action card's unavailable form (`rod: not yet`; under Use on…, one row per scripted action, `Fish in: not yet`, whatever its targets); a refused aimed spell reads `lux: need 1 ash`; any other refused use pair and every refused Give pair is no row. An option whose list would have no row is not drawn, and the Book never infers usability; an option shown with only unavailable rows still draws.

The option is an Action card that sends nothing: a press opens its list in the page's flow directly beneath it, and focus moves to the first row; the option reads as expanded while open. The option again, Escape from anywhere in the list, or the device's Back (Android back, browser back) closes it unsent and returns focus to the option; Back closes an open list before it leaves the page (PM 2026-10-23). Device Back is not built yet: the Book has no Back handling on native or web (loka-x6t.113); until then the option and Escape close the list. One list is open at a time: opening another closes the first. Leaving the page by any route closes it, and a reopened page starts closed. A redraw keeps the list open with the latest rows; when it would be empty the option goes and focus moves to the page title.

A row press (or Enter on a focused row) sends that pair under [live action freshness](#live-action-freshness); nothing sends while an action is pending, and the list stays as it is. A confirmed accepted pick closes the detail page back to World and adds the receipt's authored narration to the World log once; without narration the Book writes one line from [`words.ts`](../../mobile/app/book/words.ts) with the original projected names: **You give an apple to the farmer.** (Give), **You douse the cart with the bucket.** (a use pair: the scripted action's authored label, first letter lowercased, then target and tool), **You cast lux on the cart.** (a spell). The existing [Announcements](#announcements) region reads it; the list adds no live region of its own. A refused pick keeps the page, closes the list, returns focus to the option, and the refusal shows as a Note in that page's history in the unavailable form; a stale pick redraws and nothing acts. An item the pick consumes follows the [consumed-item](#item-details-and-takedrop) line rule, which already ends in World. Put keeps its concrete pair button.

**Aimed spells off the target's page** (owner 2026-10-23, loka-x6t.109.5; PM approved as built 2026-10-23). The Character page's Spells block draws one pick option per aimed spell the GameView offers on some target, labelled with the spell's label and **Cast on…** ("Flamma, cast on…"); its rows are that spell's targets, labelled with each target's projected name, a refused one in the unavailable form (`The lantern: need 1 ash`), and an accepted pick turns to World with its line as above. During a live fight each foe line on the Combat page draws that foe's **Cast a spell…** option; an accepted pick stays on Combat while the fight goes on, and its narration goes to the combat log, never the World log. When the foe dies its option goes with it. Open item: with two foes, the two options read alike (the foe's name is in each row's accessible name, not the option's).

**Equipment and skills.** A weapon's or shield's page shows its projected slot, attack or block
figures ("2–4 damage", or "2 damage" when the two are equal) and skill requirement, read from the projection, never renderer literals or inferred
names; a carried weapon is visibly distinct from a wielded one, and a description grants no use.
How Character shows learned skills is the [skill tree rule](#skill-tree-details).
A worn item a curse holds on keeps Remove in its list, unavailable, with the engine's reason
("Remove: it will not come off."); the Book never hides it.
An item's authored `equip` words name its Wear and Remove buttons and their lines ("Wield the
training sword", "You take up the training sword."). With none, a wield-slot item reads **Wield**
and answers "You take it up." and "You put it away."; any other slot reads Wear and answers "You
put it on." and "You take it off.". A cure's authored `edible.label` names its verb the same way
(**Apply** a poultice); an authored narration line always wins over these defaults.

**Fuel and light.** An item with fuel words its amount and lit state from the confirmed view
([line placement](#line-placement)); Ignite, Douse and Refuel sit in its ordinary action list,
beside Remove when worn.
A two-item action names both items on its button (`Refuel <source> from <supply>`); the item that
owns the control keeps the history, and the bound participant's page does not repeat it. The
presenter owns no fuel arithmetic or clock. A dark room keeps exits, inventory and recovery
usable and shows no hidden detail link, readable entry or Scan identity. A dark room without an authored dark
description arrives as the place key `place.dark`; the Book words it "It's too dark to see..."
unless the cartridge texts that key (owner wording, loka-x6t.36; `mobile/app/book/words.ts`).

**Liquids.** A vessel's page shows the confirmed liquid kind, quantity and capacity with its
authored unit, and offers Fill, Drink or Pour only to exact eligible vessels; two vessels keep
their authored names and IDs, never an ambiguous keyword resolved for the player. A confirmed
liquid line is the authored sentence, then a compact quantity line (`Water · 1 quarter-litre`)
from the receipt's bindings; a missing binding invents no amount. Fill routes to its source
detail, Pour and Drink to their source vessel. The Book owns no liquid math.

**Held readables.** Opening a held book sends no Read; Read is an explicit option. Its confirmed
text joins that item's history and the page stays. A child of an open held container pushes its
own detail; its foot is Leave alone, which pops locally without a command to the page the item
was opened from (the container's Inside page, the person holding it, or inventory), and Back to World clears
the stack. There is no Back to container: it went to the same page (loka-x6t.94). Closed or locked ancestors expose no child Read. Cold reopen restores the latest committed
Read to its original history, opening a route only when custody still reaches it.

**Consumed items.** An action that consumes the item (Eat, a bandage) removes it from Carrying,
closes its page and routes its confirmed line to the World log, and also to Combat while an encounter
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
replacement remounts the book. Save-open errors expose only existing permitted recovery, plus a
retry where a retry can clear the cause. The
save-error screen has no GameView, so no phase; it shows a headline and at most
one plain sentence under it, never a raw kind or code and never the headline repeated; the
browser's save-file lock reads "Loka is already open in another tab." That lock alone, on web,
adds a **Try again** Control that reloads the page to open the save again; while the other tab
stays open the same sentence returns, with no count or extra words. Every other cause offers only
the permitted Start over (loka-x6t.25).
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

One polite live region, outside the page turn, reads each new batch of room-log lines once, in
log order. The room log is its one source: it already holds detail-page, combat, refused and quiet
lines, so a page history or the combat log is never read as well. A quiet line is read in its plain
form on every press; its " (N times)" count is visual only ([line placement](#line-placement)). A refused line
reads "<reason>, <sentence>". History, redraws, page turns and a reopen are never read again. A
repeated line is read again. Condition changes arrive as log narration, so they are read the same
way. The region is text only, so motion settings do not apply to it.

## Future boundaries

Other-player presence requires a real projection and UI scope; no fabricated player rows.
Attack/skill controls wait until GameView offers them; there are no placeholders or invented
character data. Reading-time safety and interruption integration remains
future work under the [reading-time decision](../decisions/owner-decision-reading-time-2026-10-03.md).
A refusal reads as the kernel reports it: preserve genuine errors and meaningful history
rather than hiding errors or clearing same-room history. Whisper waits for loka-x6t.115 ([Word bar](#word-bar)).

## Combat interaction

The installed first-fight interaction follows [Live combat response](#live-combat-response-m6-a).
An NPC a [spell](mechanics.md#spell-effects-toolbox-row-29b) kills gets no "leaves" line in the Book log (Beads `loka-y6yg.44`).
A status-skipped blow tells one Combat line: the status's authored `narration.skipped`, else, proposed for the designer, "<Name> is too <label> to do anything." ("You are ..." for the player; Beads `loka-x6t.30`).

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
reason word. A refused line is plain log prose, ink italic, with no tag or chip (no chips in the
game-world pane, owner pick mvlyp3gphp2t, 2026-10-23); its reason word stays in its accessible
name, "<reason>, <sentence>", as [Announcements](#announcements) reads it. Proposed for designer approval (loka-x6t.17, owner Q13 option A): a refusal that
carries a `cause` (GameError or an exit's reason, `RefusalCause`) takes the cause's word as its
reason word and the cause's sentence before the code's ([words](../../mobile/app/book/words.ts)
`reason`, `refusedSentence`): a move while sitting reads **not standing**, "You are not
standing.", never "The way north is not standing." or "not now".

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
draws all of its narration in the combat log (and the World log), so the page opens with the engage line as its
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
narrate once through the existing subscription and cartridge text. Combat narration draws on the
combat page and its retained history and also lands in the World room event log, the full record
(owner 2026-10-24), including the engage line, closure, death and Flee; a closure that changes room
leaves the fight's lines (including "You flee north." or "You fall.") in the fight room's log, and the room reached
opens with its own arrival line ("You run in from the south.", "You wake at the inn.") ([line placement](#line-placement)). Routing to the combat page uses
structured committed receipt metadata (an encounter present after the receipt that the settled
pre-command view lacked, or gone after it), never rendered prose; ordinary room events draw
only in the World log even when delivered in the same receipt as combat, except the closing receipt,
whose lines all draw on the ended page too (the arrival room's description after a Flee or inn
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

GameView `conditions` lists every active [status](mechanics.md#status-effects-over-time-toolbox-row-1) on the body with its authored label, end, next tick and per-tick change; `bleeding` keeps its own field and lines. A condition label is authored lowercase, like a position word (`poisoned`, `blessed`); an icon's tooltip and name show it as authored and the Character page capitalises it as it does the position. A condition's line is the label, the time remaining and the signed per-tick amount with its pool key, joined by " · " ("poisoned · 4m remaining · -1 HP each 60s"); a permanent condition has no time part, one without a tick no amount, and the sign is always in the text. A duration or cadence under two minutes shows in seconds ("40s"), under two hours in whole minutes ("60m"), otherwise in whole hours ("12h", "24h"; never "1440m"; pass-1 UN). The bleeding line uses the same durations ("bleeding · 6m remaining · 1 HP each 60s"). The Character page lists each line, its label capitalised, after the bleeding line; the Combat page draws none of them ([combat rule](#live-combat-response-m6-a)). The status icon row shows one round icon per condition, buffs and debuffs told apart by their look, five icons then a +N disc; a tap opens Character; the Character page keeps the full list. The row sits above the status line, in condition order; a hold (a hover or keyboard focus on web) shows the label and time joined by ", " ("fed, 48m remaining"), and an icon's name adds the polarity and the action ("fed, 48m remaining, buff, opens Character"; no polarity for a neutral condition; "+1 more, opens Character" for the disc). While the status line is locked the icons are named pictures, not buttons, dim like the Contents button (the neutral look). A timed icon wears a countdown ring round its disc: a track and an arc for the share of its duration still to run ([look](../../mobile/app/book/StatusIcon.tsx)), clockwise from 12 o'clock, recomputed from projected time; between updates the arc drains linearly to its new share over the real time since the last update, at most 1 s (display only; presentation keeps no gameplay clock), and jumps without motion on first show and on a refresh; under reduced motion it steps; while locked the ring dims with its icon ([look](../../mobile/app/book/StatusIcon.tsx)) and still drains; at its end only the track shows, and a permanent condition has no ring. Icon glyphs are placeholders until loka-x6t.63. The presenter reads projected state and never computes or writes an effect, tick or cure; applied, tick and expired lines come from their receipts' narration and appear once. No new control: a cure is the ordinary Eat of a held item whose `cures` lists the condition.

## Away recap

Proposed for [designer](../decisions/owner-decision-designer-role-2026-10-07.md) approval; wording pending designer (Beads `loka-x6t.14`). When GameView carries `recap_after` ([away recap](mechanics.md#away-recap-toolbox-row-w27)), the presenter holds the World-log lines of each elapsed settlement (ambient arrivals and departures and receipt narration, each receipt line on its own) from its first background update until the elapsed status is no longer catching up. If the status is then ready, the held lines are not empty and the settlement spanned at least `recap_after` of logical time, they become the away recap; otherwise (a shorter settlement, or a pending, error, fault or replaced status) they go to the World log in order, as without the field. The recap is one entry in the room event log, written when the settlement settles, after the lines already logged; later lines follow it. It is collapsed to its heading "While you were away", whose accessible name adds ", show" or ", hide"; tapped open, it lists each distinct line once in first-seen order, with " (N times)" after a line seen more than once ("The poison burns in your veins. (11 times)", "Maud leaves. (6 times)"). The status line shows the present state. The entry stays in the log until the room changes; a press while time still catches up ends the settlement's holding, so its lines go to the World log in order before the press's own; a second long absence before any other line adds its lines to the same entry; when the player's room changes, held lines and the entry are dropped with the old room's log. Nothing is stored, so a recap shown before the app closed is gone after a reopen; on a cold reopen with the field authored, catch-up waits until the Book has subscribed, so that absence's settlement gives its recap. Lines routed to a detail, a conversation or the combat log keep those routes. Without `recap_after` (Chapter 1) nothing changes.

## Mechanic renderings

One row per mechanic whose Book rendering is a short rule: worn affects, displayed name, sense cues, Ask about a topic, storylet card and mount.

| Mechanic | Rendering |
|---|---|
| <a id="worn-affects-details"></a>Worn affects | GameView `attributes` carries each attribute's current value, which already includes the [affects](mechanics.md#item-slots-and-affects-toolbox-row-3) of worn items, and `worn`, their nonzero sum (absent at zero); `worn` sums identified items only, so an [unidentified](mechanics.md#unidentified-items-toolbox-row-27) worn item moves the value but adds no note. The Character page's attribute line appends it in parentheses with its sign: "PER 14 (+4 worn)", "STR 8 (-2 worn)"; without `worn` the line is unchanged ("PER 10"). The sign is always in the text. The presenter never adds or computes an affect; Wear and Remove are the ordinary equipment actions, and a second ring is worn on the finger slot like any item. |
| <a id="displayed-name-details"></a>Displayed name | When GameView carries actor_name, the Character page's first line is its authored text, uncapitalised, with no label; it suppresses the empty placeholder. A title or disguise change shows as the new name once its receipt is confirmed; the only log line is the receipt's authored narration. Without actor_name the page is unchanged. |
| <a id="sense-cues-details"></a>Sense cues | GameView `cues` reach the player as log lines ([room page anatomy](#room-page-anatomy), part 5): one plain line per cue, the authored text, then ' from the ' and the direction when it comes from another room, logged once the first time it shows during a room visit, after that update's narration and arrivals, in projected order; a room change starts a new visit. The sense is in the words, never an icon or colour. |
| <a id="fd7-ask-details"></a>Ask about a topic (FD7) | An NPC that the GameView lists an available `ask` on shows, after its other action cards and before services, one card per known topic (GameView `topics`, projected order) labelled "Ask about" and the topic's authored label. Pressing it sends `ask` with that topic; the answer or the person's knows-nothing line joins the page's history as narration, the page stays, no conversation opens. A topic granted by the answer adds its card at once. No known topics, no cards and no note; a hostile, absent or unlisted person shows none, as Talk. ([Ask about a topic](mechanics.md#ask-about-a-topic-toolbox-row-fd7)) |
| <a id="storylet-card-details"></a>Storylet card | Removed: storylets are retired ([storylet deck](mechanics.md#storylet-deck-toolbox-row-fd3)), so there is no storylet card and no pick to show. |
| <a id="mount-details"></a>Mount | Riding shows nowhere but the horse's saddled description variant and the mv fare; a non-road exit while mounted is the ordinary barred exit ("East: not now", no Go). No indicator, icon or status line text. |

## Levelling details

GameView `levelling` carries `{level, experience, next, unspent}` from [experience and levelling](mechanics.md#experience-and-levelling-toolbox-row-4) (`next` absent at the top level), and `attributes` values already include allocated points, so a spent point reads as the attribute itself ("STR 11"), with no separate line. Everything shows on the Character page; the status line adds nothing. After the ancestry line: "Level 2", or with unspent points "Level 2, 1 point to spend", "Level 2, 2 points to spend" (plural by count). Last line of the resource block, plain like pennies with no band: "xp  30 / 50" (the next threshold), "xp  120" at the top level. Last block before the foot: one Action card per authored attribute, "Raise STR", "Raise CON" and so on, each sending the one offered `raise_attribute` action with that attribute as its input; the cards show only while the action is offered (a point to spend) and go with the last point, never a disabled card. A Raise follows ordinary freshness, pending-save fencing and receipt replay; a pending save shows as the foot's **save not confirmed** line, so the page adds no note of its own. A level-up is the receipt's authored line once in the log, at the end of that step's lines, with no banner; the level line, xp line, attribute values and derived lines change together when the receipt is confirmed. The presenter never counts experience, levels or points.

## Lore details

The Journal page says "Nothing written yet." only when it has no quests, no known topics and no [Chronicle](#chronicle-details) day; after its quests, it shows **Lore** (a section title) when GameView `topics` is non-empty: each known topic's authored label, one per line, in projected order, then for each GameView `deduction` its topics' labels joined by " + " and its card. The card is the deduction's offered action when the current place offers it; when the place lists it unavailable, the unavailable card with the action's own reason; otherwise the unavailable card with the reason "Not here". Pressing the card performs the scripted action as any place action; the topic it grants then joins the list and the deduction disappears. Badges are topics and are listed with them. Nothing shows when no topic is known. ([Lore codex](mechanics.md#lore-codex-and-deduction-toolbox-row-46); wording proposed, designer to approve: Beads `loka-x6t.14`.)

## Chronicle details

The Journal's last section, **Chronicle**, shown when at least one entry exists ([Chronicle](mechanics.md#chronicle-toolbox-row-fd6)): one block per day in ascending order, headed "Day N" as the Away recap's Tap heading (name adds ", show" or ", hide"); the latest day open, earlier days collapsed; open, each distinct line once in first-seen order with " (N times)" after a repeated line (the recap's grouping), ordinary lines in the ordinary log look, a milestone's line in the page's prose look, one step larger, its accessible name the line followed by ", story point" (a line is a milestone when any of its occurrences that day is one). Lines are the receipts' narration less the engine's routine lines (the keys of
`mobile/packages/game-view/line_words.ts`) and a talk's opening prompt (`dialogue.<npc>.prompt`,
which the conversation page and the room log show; the Chronicle stays as before the narration
batch); the Book adds no words but the heading, the count and the accessible name. Opening the Journal reads the receipts once; the page is not live-updated while open (a press returns to World anyway). A Chronicle day counts as written for "Nothing written yet." ([Lore details](#lore-details)).

## Word bar

The World page has no Word block (owner, mvl9qy5ut2x2): every word is sent through the one-word
field. Saying is never a chip row (owner, wordbar1 2026-10-23). While `say`, `shout` or `cast` is
offered and no combat, scene or conversation is open, the
[status line](#world-and-status-entry) ends with a say icon named **Say to the room** (expanded while open; [look](../../mobile/app/book/Status.tsx));
a tap opens the one-word field ([SayField](../../mobile/app/book/SayField.tsx)) under the line with **Say**, **Shout** and **Cast** Controls, each only while that action is offered. A press sends that action with the typed word and closes the field; Enter sends the first; Escape (from the
field, a Control or a chip) or the icon closes it unsent; a new room or a fight closes it, and a
return to the room does not reopen it. When it closes, focus goes back to the control that opened it. A tap anywhere outside the open field, its Controls and
its chips (the page, the footer, the status line, the icon's own spot) also closes it unsent and
presses nothing beneath: a second tap is needed to act there (owner, mvl9rtp93gex). The cover
that takes that tap is not focusable, so a screen reader still closes with the expanded icon or
Escape. Whisper is hidden on every page until loka-x6t.115 (owner pick mvlrlvappy4w, 2026-10-23). Each send is the GameView's wordless twin of the action, so it stays live. A word that is not 1 to 32 letters is not sent, keeps the field open and
shows the Note **One word, letters only.** Nothing sends while an action is pending. A typed word that opens a conversation turns to it.

Known words are [Chips](../BOOK-UI-COMPONENTS.md) under the open field, each named by its word: on
the status line, the cartridge phrases (GameView `phrases`), then each learned spell word the
GameView offers to cast here (`spell_words`, only while Cast is offered; never an unlearned or a
refused one). A chip press only fills the field (and
clears the bad-word Note); it never sends. A refused spell word is no chip: the Character page
lists it under a **Spells** section title in the Action card's unavailable form `word, cast: reason`
(`lux, cast: need 1 ash`); no refused word, no Spells section.
Cast in the say field is for untargeted words only: a spell aimed at a thing is a row of that
thing's **Cast a spell…** [list](#item-details-and-takedrop) ([World](#world-and-status-entry), owner
2026-10-23). An aimed spell (cartridge `aimed`, loka-x6t.109) is never a chip or a Spells-section line: the GameView offers it on each admitted target's entry (`command: cast`, `target_ids: [target]`) and the Book lists it in that page's Cast a spell… pick list.

An accepted `say`, `whisper` or `shout` whose receipt
carries no narration gets one log line from `words.ts`, the Book's own echo of what was sent:
**You say, "Ware."**, **You whisper to the jailer, "Ware."**, **You shout, "Ware!"** (pass-1 R5; prose form, [Line placement](#line-placement));
a receipt with narration draws that instead. Beyond this echo the Book never writes the typed
word anywhere; only its writer sees it.

## Skill tree details

Skills without a profession draw one line each: the label, then " — learned" with no requirement, or while its projected `qualified` is false " — learned, unqualified. <requirement>" (pass-1 H3). After the xp line and before the Raise cards, each profession in first-listed order is a SectionTitle, then its listed boxes in GameView order: acquired as body text "Whittling, level 2 — learned" (", level N" only when projected; no requirement: a qualified learned box has nothing left to meet) or, while its projected `qualified` is false, "Whittling, level 2 — learned, unqualified. <requirement>" (pass-1 H3); an NPC's teach card for a learned skill is the GameView's unavailable action and draws in the Action card's unavailable form `label: reason`, never dropped (pass-1 R2); locked as a Note "Carving — locked. <requirement>"; any other unacquired box as a Note "Joinery — not learned. <requirement>" (the same Note). The Book draws only listed skills: a hidden box and an empty profession draw nothing. After the Raise cards comes the [Spells](#word-bar) section, while a spell word is refused.

An NPC's lesson line names the teacher while the skill is open to learn: "Aldous teaches Blade." while its projected `qualified` is true, else "Aldous teaches Blade. <requirement>". A locked skill reads "Blade: locked. <requirement>"; a learned one "Blade: learned." with no requirement (nothing is left to meet, pass-2), or while unqualified "Blade: learned, unqualified. <requirement>" as on Character (loka-x6t.24).
