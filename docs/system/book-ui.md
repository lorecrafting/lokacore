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

## Page column

On a screen wider than a tablet (a desktop browser), the Book is a centred column no wider
than a tablet (the page column [token](../../mobile/app/book/tokens.ts)), with the paper colour on
both sides (owner, 2026-10-30). Everything the Book draws stays in that column: the page, its
foot, the footer, the status line, the say field and overlays; only the night sky spans the
window, and it draws on a dark page only in a room open to the weather (the room's `exposed`
tag, [cartridge](cartridge.md): a sheltered room at night keeps its dark page with no stars over
it; owner 2026-11-16). A phone, narrower than the column, fills the screen.

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
fixture, person or item detail page; an action with no fixture, person or item target is not
drawn, and content must give it one. A quest offer draws on its target's page, reading its authored label. On hold: a skill check (perception, lore) may add a sentence,
fixture or furniture to the description paragraph itself, never a block of its own. The minimap
and joystick, the status line and the say field sit outside the scrolling page and keep their own
rules below. A passage below that draws anything else on the World page is superseded; where the
Book still draws it, the passage names the Beads item that removes it.

One exception in play (owner, 2026-10-31): the `+ item` pop, one aria-hidden transient under the log's last
line after a pickup or a buy, reserving no layout, not in the record, in the small type. Its words are
the view's item names, two items on one line, a long name wrapping, and a page turn removes it. The
log follows to its end, so the pop is seen on a full page. It does not rise under reduced motion. The
log line stays the record.

In Build only (author preview, `?dev=1`; PM, 2026-11-23): the [ghost lines](#author-mode-dev-only)
under the title, one line each, never in the record or the save.

Under-ink layers (night sky, lamp glow, low-health vignette, lightning, wind flutter) are paper, not
parts: they draw no block, hold no words and take no touch.

## World and status entry

World is one current-room page ([room page anatomy](#room-page-anatomy)). Its centred title (owner, mvl8eti4yeoe: rooms centre their title; every detail page keeps a left-aligned one) remains fixed above the scrolling authored
description, the people and items sentences and, last, the event log (no word field in
single-player, [Word bar](#word-bar)). World draws no verb line, [unavailable card](#unavailable-actions) or
notice entry: every action, available or refused, draws on its target's fixture, person or item
page, a pair through its [pick list](#item-details-and-takedrop) (owner 2026-10-23, quoted: "all
actions on targets [...] should be in the target detail page, or item detail page, and not in the
main room page").
World draws no door card: Open and Unlock work from the
[joystick](#minimap-map-and-presentation-controls) (the Map has no door or movement actions, owner 2026-10-30), and a door's state shows on the minimap: World
draws no door state line (a walk into a shut door still logs its refusal, [Minimap](#minimap-map-and-presentation-controls)) (owner 2026-10-23, reversing pass-1 R4; quoted: "the 'locked' door
would show in the minimap joystick thing, not in the main description or event log page").
Close and Lock are not drawn (owner 2026-10-30, option C, paraphrased: doors you open stay open;
Lock returns later for property in the paid books; [Verbs the Book does not draw](#verbs-the-book-does-not-draw)).
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
every member stays reachable (PM ruling 2026-10-23); a name without words draws as its `name`. Every entity that is not an
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
World scrolls to its end as its log grows, as a person's page does, while the reader is at the end; a
reader scrolled up to an earlier line stays put until they press anywhere on the page, which follows its own result.
Standalone exit directions, adjacent-sight listings and redundant navigation/
Look headings are omitted using structured outcome/TextKeys, never English matching. Under the owner's
explicit per-room clearing direction, the World event log scopes
to the actual room: after a confirmed accepted action changes place, clear the old-room log
before adding genuine new movement/quest/authored consequences. An accepted Look action (the room title's tap) starts the room's log over the same way, as if the player had just arrived: the old lines go, then Look's own lines (owner 2026-11-06, paraphrased). The room shown is the one the
committed receipt places the player in, never the exit's destination: an arrest (a wanted player
walking in on an arresting guard) turns the World page to the cell, and its log carries the move's
lines in receipt order (arrest line, then the reaction's charge). A death outside a combat round (a bleed or drain tick, drowning, in a press or an elapsed settlement) first shows the [dead page](#effects-sound-and-haptics) in the room the player died in, its log kept and ending with the death receipt's lines in receipt order (the tick, the fall line, the penalty line, `world.death.narration.woke`); only Let go turns the World page to the recovery room, whose cleared log opens with those same lines, never dropped by the room change, or holds them in the spirit state when the view carries `revival` (owner 2026-11-05, option B, paraphrased; loka-kgd.210). Such a settlement ends any away-recap holding, its earlier held lines go with the old room's log, and its own lines never enter a recap (Beads `loka-3w3q`, `loka-x6t.26`). Each narration record of a
receipt is its own log line, in record order; the Book never joins records into one line, and
the `words.ts` outcome word ("Time passes.") draws only for a receipt with no narration at all
(pass-1 UO). No card, note or banner. Attempts, pending/refused/stale
results, rerenders, same-room NPC actions, Leave and section navigation do not clear it. Active
save status/error UI remains accurate; NPC histories stay independently bounded. Map
draws no event log: the log lives on World only (pass-1 UF1); it draws no exit or door lines either
([Minimap](#minimap-map-and-presentation-controls)).
The World minimap/joystick sits outside
the scrolling body, with status beneath it, inside the existing safe area.

A projected Read place action keeps its exact detail target and authored label and follows
the canonical [notice-detail rules](#notice-board-details).

The enabled status/resources tap opens Contents. It lists exactly **Character**, **Skills**, **Inventory**, **Map**, **Journal**, **Settings**. There is no Menu button or extra World navigation
row. Character shows existing projected resources and position, without unrelated index links.
Inventory separates held items from worn slots; Journal uses projected quest text;
Settings retains Start over and its confirmation/error handling, and holds the
[Sound, Music, Haptics and Flashes](#effects-sound-and-haptics) on/off controls. Contents and every
section it opens draw no status line (owner, 2026-10-30, loka-8lpm; the [page foot](#detail-page-order)
rule). A section opened from Contents returns with **Back to Contents** (one page back), and Contents
returns with **Back to World**; a section opened another way (Character from a status icon, the map
from the joystick or footer) says **Back to World** and clears the stack to World; an Inventory
restored on reopen sits on Contents and returns with **Back to Contents**. A page a section opens returns to that section (an item page's Leave to Inventory).
A room change, death, combat, a new chapter, Start over and an accepted Take still clear
straight to World; an accepted Drop does too, except from a Contents section, where it returns to
that section ([Take/Drop](#item-details-and-takedrop)).

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

## Unavailable actions

(Owner, 2026-10-30, Beads `loka-uzt6`, `loka-3751`.) A grayed unavailable card shows only when the
player could change the outcome: an action the GameView lists unavailable (Take too heavy,
a [shop line](#npc-dialogue-and-action-details) not afforded, a blocked exit, a refused pick row, teach card or spell word) is the same
[Action card](../BOOK-UI-COMPONENTS.md) reading its plain label, never `label: reason`. A permanent
refusal, one the player cannot change, hides its card: its reason is on the hidden list beside
`reasonSentence` ([reasons.ts](../../mobile/app/book/reasons.ts), `hides`; today an Attack on a person who
cannot be hurt), and the card returns as its ordinary card once the action turns available. An Attack in a sanctuary is the deliberate exception (owner, 2026-11-01): the player cannot change it, but it teaches a rule of the world and a vanishing core verb can look like a bug, so on an attackable NPC's page, sitting or standing, the card stays gray with one authored sentence, the text key `combat.sanctuary`, the same for every sanctuary, as its hint and its logged refusal. A worn
item's Take (`not_present`) stays hidden as before. The shown card is
exposed as disabled, stays focusable and pressable, and carries its reason sentence as its hint; once
pressed its accessible name is its shown text, the label then the reason sentence (label in name), and the
hint is dropped, so the reason is read once.
A press sends nothing to the engine (a sanctuary's Attack excepted, so its refusal is logged): the card grays (the Note style) and shows the reason beneath
the label as one sentence (`reasonSentence`:
`It's too heavy to carry.`, `You can't afford it.`, `You can't do that here.`, with no reason
`You can't do that.`, otherwise the [novel-prose](#line-placement) fallback), which its own polite region reads once. The card follows
the latest GameView under [live action freshness](#live-action-freshness): a new reason clears the gray,
and an action that turns available becomes its ordinary card. A walked blocked exit (joystick) shows
and announces the same sentence. Web: `aria-disabled` is set on the node, never the prop, which
would also set the native `disabled` and drop the press.

## Minimap, Map and presentation controls

The World endpaper minimap sits in the footer: a center dot, existing compass paths/rings,
barred-exit ticks and offered up/down stair nodes. Holding enlarges it; dragging highlights an
existing direction and releasing attempts that exit. Returning to center cancels; a short tap
opens Map; a terminated gesture walks nowhere. Release keeps the action/context captured at
drag start and follows [live action freshness](#live-action-freshness), never a new target after redraw. An unavailable exit announces its projected reason
as one sentence ([unavailable actions](#unavailable-actions)) and logs the refusal without movement. The barred-exit tick tells a closed door from a locked
one ([MapDrawing](../../mobile/app/book/MapDrawing.tsx), owner 2026-10-23). Release (or an arrow key)
toward a shut door presses its offered Unlock, else Open, one action per release; with neither it
logs one line naming the door ("The door to the south is locked.", "above"/"below" for up/down)
and walks nowhere. Close and Lock are not drawn ([Verbs the Book does not draw](#verbs-the-book-does-not-draw)).
An authored Knock is an action on the door fixture's page. The engine's exit Knock has no control
yet (no cartridge declares one), so an offered one fails the stranded-verb check. The footer's
screen-reader exit actions name a shut exit's reason too ("Go west, locked").
Direction/reason appears opposite the finger. The existing
tip explains hold/drag/tap; Got it, a map tap or walking dismisses it, persisted separately with
memory fallback. The accessible Map activation opens the section; the footer and its keys are
the Book's only movement and door controls. Gesture/drawing details remain in
[joystick](../../mobile/app/book/joystick.ts) and [footer](../../mobile/app/book/Footer.tsx).

Map is a scrolling projection, distinct from the enlarged joystick, drawn as dots and lines
([DiscoveredMap](../../mobile/app/book/DiscoveredMap.tsx), owner 2026-10-30, loka-wz6f). It holds
no movement, door or room cards and no Go; the footer walks and works doors. Releases
without discovery metadata draw no map and keep the current place line.

The [discovery contract](mechanics.md#d10-discovered-places-observations-and-knock-selected-contract)
is installed: Map draws a filled dot for each visited room at its authored level/position and a
line for each link whose two endpoints were visited, as known static connections without a current
traversal claim. The current room's dot is ringed, told by shape as well as colour. Each exit of a
visited room that leads nowhere visited yet (`map.unexplored`) is a short line to an open, muted
dot; an up or down one leans aslant. An open dot stands for the exit only, never the unvisited
room, its name, an NPC or an item; nothing is drawn merely because the cartridge contains it or
adjacent sight names it. No room name is written inside the drawing: tapping a dot puts its room
title in the caption under the map, an open dot's "Unexplored"; changing level clears the caption.
Every dot is a touch-sized button named by its room title (", current place" on the ringed one), an
open dot "Unexplored, <direction> of <room>". A level stepper shows when rooms span levels.

Under the drawing the page keeps the current place line, "No way out" when the room has no exits,
and no Where ([Verbs the Book does not draw](#verbs-the-book-does-not-draw)).

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
A page's local returns (Leave, Back to World, Back to Contents, Back to board, Close) sit in its page foot, below the scrolling content, nearest first, and the foot's last
control ends the page; offered actions never do. Item, notice, board, NPC and shop pages, Contents and its
sections draw no status line or compass (owner pick mvlrlvappy4w, 2026-10-23;
loka-8lpm): a pending save shows
as one dim **save not confirmed** line in the foot under Leave, and the catching-up line and a
fault show there as on every page. Combat and World keep the
[status line](#world-and-status-entry). World, a scene, a chapter title, the ancestry choice and combat have no
foot. A control that opens a child stays in the content: Resume dream as a Control, and a person's **Look** and a container's **Look inside** as Action cards, last after the page's other cards, that send nothing (owner, 2026-10-30, loka-hvfj). An NPC or item detail's history belongs to the page visit: it starts empty when the page opens and is dropped when it closes by any route (Leave, a Back control, Contents, Map, a room change, death); a line shows at most once on one page ([line placement](#line-placement)). Combat closure and the notice-board readable restore are the exceptions in their sections.

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
  alewife, is here.`); a refusal with no sentence of its own reads `You can't do that—locked.`, and so does an
  [unavailable card](#unavailable-actions)'s sentence
  Dialogue: speaker, speech verb, the
  listener when there is one, a comma, then the spoken line in double quotes. To the player:
  `Nell says to you, "Well, stranger?"`; to the room: `Nell says, "Ale's a penny."`; the player:
  `You say, "Ware."`, `You whisper to the jailer, "Ware."`, `You shout, "Ware!"`. The Book's own
  echo uses say, whisper and shout; an authored line chooses its own verb. The quoted line starts with a
  capital and its closing stop sits inside the quotes; a line ending in `?` or `!` takes no added
  comma or period. Never the colon form (`Nell: ...`) and never a bare quotation with no speaker.
  An authored line that already attributes itself (`"Gate's shut," says the guard.`) is kept as
  written. A dialogue line whose narration binds a `speaker` and whose authored text is a bare
  quotation reads `<Speaker> says, "..."`, or `<Speaker> says to you, "..."` when the player is
  addressed; the Book never adds a speaker the binding does not name.
- A line the Book composes itself, not authored narration, dialogue or an engine line's
  `line_words.ts` sentence, is a **narrated event** (owner, 2026-10-30, Beads `loka-lsqi`): one
  second-person sentence in the present tense (PM, 2026-10-30), drawn in the one narrated style ([LogLines](../BOOK-UI-COMPONENTS.md#component-catalogue)'s
  doc comment), never `Label: value`. The kinds: a refusal (`You can't do that—locked.`); a
  changed journal (`You make a note in your journal.`); a skill the reply taught (`You learn
  Cooking.`) or raised (`Your Cooking improves.`), in place on the teacher's page; a restored cue
  (`You remember what you heard earlier.` before the cue); a failed Start over (`Start over
  fails.` then the reason). A new kind joins this list. The lint `mobile-book-log-prose` refuses a
  colon label in a log line builder.
- A **page's own note and caption** takes the same rule as a log line, and its surface decides the words
  (owner, 2026-11-19, Beads `loka-bptw`): never `Label: value`. A bare value stands where the surface
  already says what it is (the Map's current place is the room's title alone, as the room page's title
  is); otherwise it reads as a short sentence (`Time left: 3 days` becomes `3 days left`; `Fare: 4p`
  becomes `It costs 4p to cross.`). A quest's hint is the authored hint text alone, set as a note under
  its quest; a patrol's next waypoint reads `Then <room>.` A colon between two joined values is not a label (`Recover belongings
  from Mill, the millstone`) and is unaffected. The lint `mobile-book-log-prose` covers the page
  builders (`labels.ts`, `model.ts`, `notices.tsx`, `offers.ts`) too.
- A vessel's liquid amount reads in words, never a count or unit label (owner, 2026-10-30, Beads
  `loka-ikat`), from quantity against capacity: `Empty.`; a third or less `Nearly empty, a little
  water left.`; between `Half full of water.`; two thirds or more `Nearly full of water.`; exact
  capacity `Full of water.` Only exact 0 reads empty and only exact capacity reads full. A light's
  fuel takes the same bands with the noun `fuel` and its state after a comma: `Nearly full of fuel,
  lit.`, `Empty, unlit.` (owner, 2026-10-30, Beads `loka-nkcr`). One helper words both
  (`amountWords`, `mobile/app/book/pick.ts`) on the item page; a liquid also on a twin row's note. A
  Fill, Pour or Drink log line is its sentence, then the level it left in the vessel it binds (Pour:
  the receiver) as a second sentence from the same helper: `You drink. The waterskin is half full
  of water.` The level comes from the line's own bindings (`remaining`, `capacity`, loka-tc2e), so
  an older line keeps its level; the vessel is named definite (`the waterskin`); a line binding no
  vessel the view names keeps its sentence alone.
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
scope, including an authored Read alias. Unavailable offers are [unavailable cards](#unavailable-actions); absent offers
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
and its visible detail route after the chapter card. A board child restores its parent
board beneath it. This creates no command or receipt. A missing current-room target restores
no notice route; scene/combat precedence still applies. Ordinary unclassified narration
continues to follow the existing World recovery rule.

A readable detail's exact-subject scripted actions appear only in its Notice actions. Available controls
follow nonempty history; Leave sits in the page foot (on a person's page in conversation, Leave the
conversation, per the [conversation rule](#npc-dialogue-and-action-details)); unavailable controls are [unavailable cards](#unavailable-actions) with their real reason.
Available and unavailable controls use the same catalog action-label resolver
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
shows title, description, then Look and Leave. **Look.** Outside a conversation a **Look** Action card
ends the person's page, the last card, before Leave; it sends nothing, and opens their Look page, an anchored
detail of the person's page as the [Inside](#item-details-and-takedrop) page is of its container
(owner, 2026-10-30, loka-aqnc). It draws the person's name as title, their description as prose, then
what they visibly bear in the fixed order condition, worn, carried. Condition is one prose sentence from the person's
EntityView `band` (loka-ysbt), worded by the hp band phrase the status line uses: **<Name> looks to
be hurt.** A person with no band (no hp of their own) draws no sentence. The frame needs `band.<key>`
text that is a bare state phrase ("hurt", "covered in blood"), as the status and combat lines also
do; a verb phrase ("is hurt", "has a few bruises") reads wrong in all three. Worn is one sentence,
**<Name> wears a scorched apron and a badge.**, from EntityView `worn` (loka-oc5i), shown with or
without theft. Carried is one sentence, **<Name> carries a flask and a knife.** Both are joined as
the [room's who-is-here sentence](#room-page-anatomy) is (articles, serial comma and "and", plurals
collapsed), each item an inline link opening its item page; GameView has no pronoun, so each names
the person (loka-dgko). With nothing worn or carried that sentence is not drawn, and no Note stands in.
Carried means the person's directly held items offered under `world.theft`, less their shop stock
and less their worn items (by id), so no item is named twice. The page draws no actions; its foot is a local **Close**
that returns to the person's page and sends nothing, and it goes with the person, carrying or not. A person's page draws no Give an item… card: a gift is
given from the item's own Give to… (owner pick mvlymuams73l). **Trade** shows while the
person's shop has a row; it opens the child buy page **<Name> can sell you…**, as a notice opens
from its board, and its Leave returns to the person. The buy page holds one **shop line** per stock
row, then the purse Note
**You have <n>p.** under the list, the visit history, then a **Sell** card (no ellipsis), drawn
only while the player holds something the person will buy. Sell opens the child sell page
**<Name> will buy…** (owner pick mvlynyikyw57): one shop line per thing the GameView offers to sell
to this person, at its price, then the purse and history; Leave
returns to the buy page. It lists only what the engine marks sellable (wider sale lists are
loka-x6t.117). A buy or sale keeps its page open, with no page turn and no return to the person (owner,
2026-10-23): its own line is quiet ([line placement](#line-placement)), drawn on neither page and kept in
the room log; the purse redraws on both pages, and the lists redraw (a sold-out row takes its refused form;
a thing sold leaves the sell list). A row that goes moves focus to
the page title. Shop stock is not listed
as carried on the person's Look page. Each service is a shop line
of its authored label; the claim and cancel of an order are shop lines under a **Your order** Section
title after the order line, and show only while an order is open (either is offered, or either
is refused for a reason other than `service.no_order`); while Your order shows, the commission
line is not drawn.

**Shop lines** (owner, 2026-10-30, Beads `loka-ck8k`). A buy, sell or service row is one line of
[novel prose](#line-placement), never a card or button: a sentence with its price, closed by a
period, whose noun is the underlined link in the room links' style; the whole line is the press
target (a `Tap` line). A good reads `A cob of bread, 4p.` with "cob of bread" linked; a service reads
its authored label, `Order a knife, 3p.`, the label linked (the GameView projects no service noun).
Its accessible name is the shown text, then the action and the price in words (label in name):
`A cob of bread, 4p. Buy for 4 pennies.`, `… Sell for 1 penny.`; a service's label is already its
action, so `Order a knife, 3p. 3 pennies.`. A refused line reads the same plain sentence and follows
[Unavailable actions](#unavailable-actions) (grayed, its reason sentence beneath, both read in its
name). Leave, Back, Trade and Sell stay controls and cards. The purse Note shows on the NPC page only when a priced service is drawn,
after the description; pennies show nowhere else on a detail page, and "can't afford" stays a
bare reason (pass-1 E15). It shows
no past conversation log on a fresh visit to the page or after Leave the conversation; lines since that visit began or that Leave are the only
history. Answering (a `choose` press) puts that page **in conversation**, and it stays so after a one-reply
answer closes the kernel choice: the choice's options sit immediately after the latest
chronological dialogue/event entry **inside** the scrolling content; no Talk card and no other
action card shows; the foot is a single **Leave the conversation**. An option the view marks `asked` (one already taken) keeps its card and press; its words take the note style in italic, and its accessible name adds the words.ts asked words after the label. Action and dialogue choice labels are bare imperatives without a trailing period (an ellipsis is not a period); a quoted spoken line keeps its punctuation. Content lint refuses an authored choice that only leaves (a Leave or Close label with no effect beyond its narration) in a talk with more than one choice; the page's own Leave control ends the talk (loka-x6t.21). A talk has one exit, the foot (owner, 2026-10-30, loka-512o): an authored choice whose whole label is the Book's **Leave** or **Close** is never drawn among the choices; Leave the conversation sends that choice itself, so its narration and effects stand. The conversation belongs to
that page visit (the Book's latch, not the NPC): leaving the page any other way (Contents, Map,
Back to World) ends it, and reopening the person shows their actions again. This supersedes the
viewport-bottom dock. The ordinary long log remains scrollable, and newly appended results keep
current options reachable. Same-room NPC actions retain the route, mounted scroll area and
animation token; they do not flip the book or reset scrolling for each result. There is no
overlay or saved transcript.

After a confirmed accepted NPC action changes the actual projected journal, append the
[narrated event](#line-placement) `You make a note in your journal.` within that NPC's chronological history, visually distinct from
authored dialogue. Preserve meaningful authored narration. Pending/refused/stale/fault results
add no false event; rerenders and receipt retry do not duplicate it. This is local presenter
metadata, not story prose, a new game event or transcript persistence.

There is one foot control and no separate Close: **Leave** outside a conversation (local World
navigation, no engine verb) and **Leave the conversation** inside one. When a matching
authored exit choice (above) or `close_choice` is actually offered, Leave the conversation invokes it (the authored exit first) under
[live action freshness](#live-action-freshness) and, only after confirmation, returns to that
person's page with their actions offered again, its history fresh but for the exit's own narration
(**You take your leave.**), never to World; an absent speaker (the targetless
close of a departed NPC) returns to World. An unconfirmed/refused/faulted close retains the detail
and honest save/error UI; a retry keeps its original context. Without a matching closable choice
(the kernel already closed a one-reply answer), Leave the conversation is local: it ends the
conversation on the page, sends no engine verb and preserves any unmatched saved choice. Routine `choice_closed` fallback narration is suppressed
structurally; meaningful authored/quest consequences and genuine errors remain. Sections retain
Back to World. Item Leave remains local navigation.

[Branching dialogue](mechanics.md#branching-dialogue) on the conversation page: an option whose condition fails is not drawn, and a card gone stale is refused `invalid_state` and redrawn. A reply that leads on draws the next prompt and its options after the reply; the foot stays Leave the conversation. When a reply leads on to the same person's earlier options, their prompt draws again as authored. When nothing is left, the talk ends after the reply and the page keeps the reply. A hand-off to someone else in the room turns the page to that person, who then speaks; a hand-off to someone in another room ends the talk after the reply.

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

**Barter offers.** A service offer with price 0 shows its authored label alone ("Knife for two pelts"), with no price, never "free", and its name is that label; unavailable, it is an [unavailable line](#unavailable-actions) reading the same label. The label names the inputs.

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
without a line. A shop line's reason is always a word from `words.ts` `reason()` ("not now",
"too heavy to carry"), never a code with its underscores replaced; a buy refused `not_owned`
stays "sold out", and one refused `insufficient_resource` reads "can't afford" (`buyReason`).
A shop reason from the cartridge is a lowercase fragment with no period.

## Item details and Take/Drop

Inventory separates Held from Worn slots, including empty slots. Held items of one kind — the
same authored `words.plural` text, as the room's sentence groups them (`two crows`, count words to
nine, digits after) — draw as one row: the kind's first member's name, then the count and its plural
as the row's [EntityLine](../BOOK-UI-COMPONENTS.md#component-catalogue) note, which draws below the
name (`an egg`, note `3 eggs`); the count is a digit, as the room's sentence counts past nine. The row
opens that first member's page, so the count is what keeps every grouped item reachable; a kind with
one member draws its own row with no note. An item whose words declare no `plural` never groups,
since its kind is only its name and two such items can share a name and differ in state. A grouped
row offers no inline consume control: consuming one of a stack is reached through the item page's
ordinary offered action, which is one engine verb per press and keeps the confirmation, refusal and
narration routing the Book already has (PM, 2026-11-18, for the owner to overrule; loka-x6t.132).
Held/worn item
taps resolve the same detail; item pages follow [detail-page order](#detail-page-order), with current legal item/container/equipment actions, plus local **Leave** back to the page it was opened from ([grammar](../BOOK-UI-COMPONENTS.md#grammar)). An available loose item therefore offers Take
and Leave; Leave sends no engine verb. Confirmed accepted `taken` returns to World with the engine's take line ([line placement](#line-placement)),
the item named as the player saw it. Under the PM's explicitly adopted Drop symmetry, confirmed accepted `dropped` also
returns to World with the engine's drop line; an item opened from a Contents section (Contents › Inventory › item) returns instead to that section, Contents beneath it, as its Back would (loka-8lpm), and a cold reopen of a Read restores Contents, Inventory, each holder's page with its Inside or Look page, then the book. Held items
open their same item detail from Inventory, with existing offered Drop/other actions
and Leave, without invented Use/Equip actions, Take while held, or a custom gesture.
Authored narration takes precedence and meaningful consequences remain. Pending, refused, stale or failed attempts announce no success.
Retry retains original action/target context and appends each confirmed Take/Drop event only once.
**Inside.** A container whose contents are reachable (an open lid, or a corpse or lidless container with contents) never lists them on its item page: a **Look inside** Action card follows its options, sends nothing and opens its **Inside** page, an anchored detail of the item page as the dream page is of its bed (owner, 2026-10-30, loka-mo0p); an accepted Open on the item page turns straight to it. That page draws the container's name as title, the section title **Inside** and one Entity line per directly held item, each opening that item's own page; an empty one draws one Note, **There is nothing inside.** A container's Inside page then draws, as Action cards, the item page's own Put into actions for held items (the same actions, admission and invocation; owner, 2026-10-30, loka-2qk5); an accepted Put stays on the page, now listing the item. Open, Take from and a person's actions stay on their item or person page. A lidded container's foot is its engine Close as offered, an Action card (**Close a seed sack**): accepted, the lid shuts, this page goes and the item page shows Open; refused or pending, the page stays. A lidless container's or a corpse's foot is a local **Close** that returns to the item page and sends nothing. A contained item's Leave returns to the Inside page. The page goes when its container goes, when the lid closes, when the contents stop being reachable (an emptied corpse), and on a room change, death or Map as every detail does; a cold reopen of a contained Read restores item page, Inside page and item page.
When Take removes an item from a corpse's Contents, the confirmed result returns to
that corpse's Inside page (its item page once the corpse is empty), where the take line is quiet ([line placement](#line-placement)), and keeps
Back to World available. The taken item appears in Carrying. An unavailable corpse
closes its detail through the ordinary stale-route rule; no success is inferred. A living NPC's directly held items, offered under `world.theft`, are the carried sentence of their [Look page](#npc-dialogue-and-action-details) (not Inside, never a list on the person's page), each link opening the ordinary item detail; there the theft card reads **Lift** (a `LABEL` word, never Take) with one Note **<Name> is holding it.** above it, so the verb and the line name the risk before the press (pass-1 E14, owner 2026-10-21); a corpse or container keeps its **Inside** page and Take. A worn item's page, opened from the worn sentence, draws neither its refused take (`not_present`) nor that Note until stealing exists; the theft lane is the item's listing in the person's `contents` (the Book has no theft flag), and there a worn item keeps Lift and the Note (loka-oc5i).

A container with a lid (cartridge item `barrier`, loka-x6t.121) draws its state as a note (**Closed**, **Open**) and, while closed, no Look inside: Open is one of its own cards (first group), an accepted Open logs **Opened.** in the item page's history and turns to the Inside page (owner, 2026-10-30, loka-mo0p), where Close is the foot (above), so the item page shows **Opened.** and **Closed.** with Open again; a refused or pending Open stays on the item page; Close is offered while open, on both pages, and nothing closes on Leave; Unlock appears only when the lid has a `key_item`. Take from and Put into a closed container are refused by the engine (`not_present`, `exit_closed`), so the page never lists them.

An item action advertised unavailable is an [unavailable card](#unavailable-actions) under its
actual catalog label; pressed, `too_heavy` reads **It's too heavy to carry.** and `over_load` (the
load is full) **That's more than you can carry.** (pass-1 R3); `permission_denied` reads **It's not
yours.** Available actions retain their existing buttons. The card follows the latest GameView,
including Take aliases and Contents, and becomes Take when shedding held load makes Take legal. An item or NPC page with nothing to do
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
- **Cast a spell…** on a target's page: one row per aimed spell the GameView offers on it, labelled with the spell's word (`lux`). The cast-with-target command is engine row loka-x6t.109; until it lands no target lists one.
- **Give an item…** is not drawn: a person's page has no Give card (owner pick mvlymuams73l, 2026-10-23); the item's Give to… gives.
- **Give to…** on a held item's page, its reverse (PM 2026-10-23, for symmetry with Use on…): one row per person the GameView lists in a Give pair with this item, labelled with the person's projected name.

Rows keep the GameView's order. When one list holds pairs of more than one scripted action, each row reads the scripted action's authored label and the other object ("Douse with the bucket", "Fill from the trough" on the cart; "Douse the cart" under Use on…), so two pairs of one tool never read alike. Two things that share a name stay two rows, each bound to its own EntityId, never merged, with no invented suffix: a row shows the item's projected state (empty, full) as its quiet note when the GameView projects one, otherwise the rows stay identical in listed order (PM 2026-10-23). A row's accessible name is its shown label, then the action ("bucket, douse the cart"). Unavailable rows: a use pair refused `cooldown` is one [unavailable](#unavailable-actions) row under the tool's name; under Use on…, one row per scripted action, `Fish in`, whatever its targets; a refused aimed spell is an unavailable row under its target's name; any other refused use pair and every refused Give pair is no row. An option whose list would have no row is not drawn, and the Book never infers usability; an option shown with only unavailable rows still draws.

The option is an Action card that sends nothing: a press opens its list in the page's flow directly beneath it, and focus moves to the first row; the option reads as expanded while open. The option again, Escape from anywhere in the list, or the device's Back (Android back, browser back) closes it unsent and returns focus to the option; Back closes an open list before it leaves the page (PM 2026-10-23). Device Back is not built yet: the Book has no Back handling on native or web (loka-x6t.113); until then the option and Escape close the list. One list is open at a time: opening another closes the first. Leaving the page by any route closes it, and a reopened page starts closed. A redraw keeps the list open with the latest rows; when it would be empty the option goes and focus moves to the page title.

A row press (or Enter on a focused row) sends that pair under [live action freshness](#live-action-freshness); nothing sends while an action is pending, and the list stays as it is. A confirmed accepted pick closes the detail page back to World and adds the receipt's authored narration to the World log once; without narration the Book writes one line from [`words.ts`](../../mobile/app/book/words.ts) with the original projected names: **You give an apple to the farmer.** (Give), **You douse the cart with the bucket.** (a use pair: the scripted action's authored label, first letter lowercased, then target and tool), **You cast lux on the cart.** (a spell). The existing [Announcements](#announcements) region reads it; the list adds no live region of its own. A refused pick keeps the page, closes the list, returns focus to the option, and the refusal shows as a refused line in that page's history; a stale pick redraws and nothing acts. An item the pick consumes follows the [consumed-item](#item-details-and-takedrop) line rule, which already ends in World. Put keeps its concrete pair button.

**Aimed spells off the target's page** (owner 2026-10-23, loka-x6t.109.5; PM approved as built 2026-10-23). The Skills page's Spells block draws one pick option per aimed spell the GameView offers on some target, labelled with the spell's label and **Cast on…** ("Flamma, cast on…"); its rows are that spell's targets, labelled with each target's projected name, a refused one an [unavailable](#unavailable-actions) row (`The lantern`), and an accepted pick turns to World with its line as above. During a live fight the Combat page draws each live foe's option last among its cards, naming the foe by its projected name (**Cast a spell on the goblin…**, owner 2026-11-02, loka-kgd.204); an accepted pick stays on Combat while the fight goes on, and its narration goes to the combat log, never the World log. When the foe dies its option goes with it. Open item: two foes of one name read alike.

**Equipment and skills.** A weapon's or shield's page shows its projected slot, attack or block
figures ("2–4 damage", or "2 damage" when the two are equal) and skill requirement, read from the projection, never renderer literals or inferred
names; a carried weapon is visibly distinct from a wielded one, and a description grants no use.
How the Skills page shows learned skills is the [skill tree rule](#skill-tree-details).
A worn item a curse holds on keeps Remove in its list as an [unavailable card](#unavailable-actions)
whose press shows the engine's reason as its sentence; the Book never hides it.
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
[running head](../BOOK-UI-COMPONENTS.md#component-catalogue) appear (a scene's [treatment](#book-treatments) may hide more);
ordinary details, Leave/Back, Contents and position controls are hidden or disabled. A chapter
title page shows its chapter label, title and the running head only: no Back to World, and Contents and position are
locked as in a scene. It turns itself about 4 s from appearing; a tap anywhere
skips, and its clock pauses while the app is in the background. With a screen reader active it keeps an
explicit Continue and does not turn itself. The theme cut plays into the next page; it fades out as it ends. A chapter
title reached with a scene waits until that scene ends. Dismissing the card is presentation
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
browser's save-file lock reads "Loka is already open in another tab." On web, that lock and the
save worker's timeout (Safari; its sentence stays "The save could not be opened.") add a
**Try again** Control that reloads the page to open the save again in a fresh worker; while the
cause stays (the other tab open) the same sentence returns, with no count or extra words
(loka-hcnlh.19.2). Every other cause offers only the permitted Start over (loka-x6t.25).
[words](../../mobile/app/book/words.ts) owns the sentences. Those
boundaries live in [session](../../mobile/packages/game-view/session.ts),
[app](../../mobile/app/App.tsx) and [save error](../../mobile/app/SaveError.tsx).

A cartridge's ending is its last scene, then its last declared chapter's title page; the Book adds no ending page and no words of its own.

## Book treatments

A treatment is a named, designed whole the Book draws over a host: a cartridge selects one by name and sets only its bounded parameters, never a colour, a layer, a timing or a combination of parts ([owner decision](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md#book-treatments); [rulings](../design/book-treatments-rulings.md)). Each is designed once, here, for contrast in every palette, reduced motion, Flashes off and a screen reader; its parts are the Book's kit. Its layer takes the top slot of the [under-ink chooser](../BOOK-UI-COMPONENTS.md#design-tokens), so no fatal hold, vignette or glow shows with it, and two treatments never show at once. A new treatment, or a parameter on one, is a designer ruling with its contrast numbers, never a cartridge's.

| Treatment | Hosts | Parameters | Spec |
|---|---|---|---|
| `spirit` | revival, implicitly (not selectable on a scene: its kit needs revival's lines and seconds) | none (`lines` and `seconds` are revival's data) | [Spirit state](#effects-sound-and-haptics) |
| `reverie` | a modal scene's optional `treatment` | none | below |

**Reverie.** A scene told as a bright dream (owner 2026-11-04, paraphrased: bright and luminous, only Continue, lines at their own pace, silence). **Look.** A held under-ink layer inside the page column, set with the turn onto the scene's first line and gone with the turn off its last, in every mode: ivory by day and dawn, pale gold at dusk and night; every text role keeps 4.5:1 (its look and timing are in the [catalogue](../BOOK-UI-COMPONENTS.md#design-tokens)). Still: no breathing, no glow. Storm draws no light on it. The night sky stays as the hour draws it. **What shows.** Only the scene's current line, in the ink as plain prose, and Continue. The running head, the status row and the whole footer (catching up included) are not drawn. **Pacing.** Every line turns the page, as in any scene. The line starts a moment after the page lands and rises slowly from the paper to full ink; Continue's place is kept from the start and settles in once the line is full, until then not drawn, not pressable and not focusable. A tap anywhere on the page before then completes the line and shows Continue at once and sends nothing; only Continue advances, and the Book never advances by itself. Reduced motion and Flashes off: the same, since a slow opacity rise is neither motion nor a flash. Backgrounded, the arrival pauses; a reopen lands on the current line and it arrives again. **Screen reader.** The line and Continue show at once; the page's title focus lands on the line and reads it once; Continue's name is its label. **Continue.** The engine's offered button and its label, drawn as the scene's [ContinueButton](../BOOK-UI-COMPONENTS.md#component-catalogue), solid; the press keeps its selection haptic. **Sound.** Silence: on the turn into the reverie the room's bed, weather and any music fade out over the bed cross-fade; nothing plays inside it, its page turns and Continue included; the next page's bed opens over the bed cross-fade after the turn out. **Ends.** A fault shows the scene plain with the footer's fault, as the spirit state does; the scene's own precedence is unchanged.

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
way. The region is text only, so motion settings do not apply to it. The one exception is an
[unavailable card](#unavailable-actions)'s own polite region: its press sends nothing and writes no log line, so it reads its sentence there. A sanctuary's gray Attack alone sends its press: the engine refuses it, the world does not change, and the refused line in the log tells the player and is read, not the card's region.

## Effects, sound and haptics

Values, roles and the wash's contrast exemption: the catalogue's
[design tokens](../BOOK-UI-COMPONENTS.md#design-tokens). An effect names which thing changed; none
delays a tap, moves text the eye is on, or reaches the live region.

**Press.** A pressable answers on press-in, before the command returns: an action card and a
letter tile lift; a Control, Continue, the page foot, a Tap and an entity name change ink; the
Contents button, a status icon and a map place thin; a chip lifts and, once chosen, holds its
pressed colour. The map's level arrows have no press look, nor has the say field's shield, which
only closes. An unavailable card does not lift; its reason dries. A press gives the selection haptic
on commit, never on press-in, so a scroll stays silent; a Tap, the Contents button, a status icon
and a map place give none. A chip's comes after its choice applies, so turning Haptics off is silent.

**Ink drying.** A line entering the log in this redraw dries in; a narrated event follows its line
by a beat. A refused line dries like any other, a repeat's count does not re-dry, an away recap
dries once, and history never does. Under reduced motion a line dries as a plain cross-fade.

**Status icon.** A status arriving scales up in its icon, and one ending fades. A permanent status
has no arrival effect. Under reduced motion an arriving icon just appears.

**Running head.** A changed objective cross-fades. A resolved one settles to secondary ink, then
out, and the next dries in; a failed one fades through secondary ink, then out.

**Blow wash.** A hit point loss during combat washes the paper once under the ink, and the hit point
value dries in the wash's colour and back, with the thud and the heavy haptic. The page swells 1.5%
at the wash's peak, with no layout change or reflow (owner, 2026-10-31). Reduced motion halves the
wash and removes the swell; Flashes off removes both, leaving the value, thud and haptic.

**Falling.** The player's death is a committed fact from the receipt, never a view diff, a rendered line or a room name. It is one S4: pending cues clear, music and beds cut at once, and one heavy haptic is the last thing felt: in a fight the thud's own, which is never cut; outside one, the death cue's. In a fight the fatal blow's wash falls to the fatal hold (the reddest the dim and warning ink bear at 4.5:1; its look is in the [catalogue](../BOOK-UI-COMPONENTS.md)) and holds there, still, with no pulse and no fade, until the page turns; the screen's edges hold a deeper bloodshot red, feathered inward and gone before the page margins, so no ink sits on it (owner 2026-11-02, loka-kgd.204; Flashes off: no peak, the hold rises over the settle time; reduced motion: the same still edges, the half wash, no swell, over the hold set at once). A death outside a fight has no blow, so no peak: the fatal hold and edges arrive with the turn to the dead page below and rise over the settle time, in every mode (reduced motion: set at once). The death sound plays once (for now the book's close: no Falling cue is recorded yet). There is no countdown: the held red says the player is dead, and the closed Combat page's one foot, or the dead page's, reads **Let go** ([Closure](#live-combat-response-m6-a)), which goes to World as Back to World does, or, when the view carries `revival`, to the Spirit state below. Waking has no chord: the page lands on the palette of the current in-game hour, because death does not move the clock, and the current room's bed returns. No palette change marks the fall. ([Designer rulings](../design/effects-batch-2-rulings.md).)

**Dead page.** A player death outside a fight (a bleed, drain or status tick, drowning; in a press or an elapsed settlement) shows the same death as a fight's closed Combat page, on the World page (owner 2026-11-05, option B, paraphrased; loka-kgd.210). A death whose receipt closes an encounter, whatever killed, is the Combat page's ([Closure](#live-combat-response-m6-a)), never this. **Where.** The World page of the room the player died in, its title kept from the view before the death receipt (as the Combat page keeps its encounter title), though the receipt has already moved the player: the recovery room is not drawn until Let go. **What shows.** The room title; the room's log, kept, ending with the death receipt's lines in receipt order (the tick, the death line, the penalty line, the waking line), as the Combat page shows every closing line (a later receipt's lines wait, unread, for Let go); and one foot control, **Let go** (`LABEL.letGo`). The room's paragraphs are not drawn, and, as in the spirit state, the status row, running head, minimap and joystick, say field and Contents button are not drawn, catching up included. **The death line.** The receipt's own fall line, no new words: `world.death.narration.player_died` (default `world.combat.narration.player_died`), or `world.water.drowned` for a drowning. **Look and sound.** Falling above: the fatal hold and edges, held still until the page turns; one heavy haptic from the death cue; music and beds cut. **Turn.** From any page, World, a detail or conversation, Map, Journal, Character or Contents, the Book turns to the dead page with the death; already on that room's World page, the page does not turn and the layout changes in place. Focus goes to the title; the live region reads the death lines once. **A second death** before Let go (a tick in the room the player now is in) changes nothing on the page: title, log and lines stay the first death's, and its receipt's lines wait, unread, with every later line; its cue and haptic play as any death's (Falling), the held red already there with no new peak (loka-kgd.218). **Let go.** Local, no engine verb: the turn to the World page of the room the player is now in, through the existing room-change flow, its log cleared then opened with every waiting line in receipt order (both deaths' after two; World and status entry); with `revival`, into the Spirit state below, its held lines starting at the receipt's. **A scene or chapter.** World time runs in scenes ([owner rules](owner-rules.md)), so a tick can kill inside one; a scene's progress survives death ([save](save.md)). The dead page shows first; Let go then shows the scene or chapter card the view carries, and the spirit state does not begin (as a scene arriving ends it). **Reopen.** Nothing is stored: a reopen before Let go shows the World page of the recovery room, solid, as after a Combat closure. A fault ends the dead page the same way.

**Spirit state.** Built (loka-kgd.205); its open items settled 2026-11-04 ([rulings](../design/spirit-state-rulings.md)). Only when the view carries [`revival`](mechanics.md#death1--corpse-custody-and-same-body-return-m5-b-foundation) (else Let go goes to World as above), Let go, from the Combat page or the dead page, turns to the World page of the room the player is now in, in the spirit state. Its clock starts when that page lands, in wall-clock time, never from the receipt; nothing is stored. **Look.** A held under-ink layer, the highest in the chooser, so no fatal hold, vignette or glow shows with it: the spirit blue (pale by day and dawn, deep at dusk and night; its look is in the catalogue) under the page's ink, its foot included, inside the page column, never over the night sky; every text role keeps 4.5:1 ([tokens](../BOOK-UI-COMPONENTS.md#design-tokens)). It arrives with the page turn, set, in every mode; still, with no breathing. Opaque cards stay solid. Storm draws no light on it. **What shows.** The room title, its paragraphs drawn as plain prose (no link looks, nothing pressable), the log, and in the foot one Action card, the rise card, the Book's only control. The status row (line, icons, experience rule), running head, minimap and joystick, say field and Contents button are not drawn. **Lines.** The return receipt's lines (the waking line, a greeting) and any line arriving meanwhile are held, as the away recap holds lines, and go to the log in order at the rise. The revival lines dry into the log one by one: with n lines over `seconds`, line k (from 0) at k × `seconds` / (n − 1) after the page lands, so the first is at once and the last at zero (one line: at once); they stay in the log after the rise and are read once by the live region as log lines. **The rise card.** Before zero it is the unavailable form, its label plain, with the [status icon's](#conditions-details) countdown ring at its leading edge draining from full to empty over `seconds` (steps under reduced motion); a press sends nothing, gives warning and reads no sentence. At zero the ring is gone and the card is available; the Book does not rise on its own. Focus on the card stays on it; focus anywhere else does not move, so zero makes no announcement of its own (the last revival line marks it). Its accessible name is its label, the same at every tick; before zero it is disabled with the whole seconds remaining as its value (on the web, where a button carries no value, as its description: "4 seconds", "1 second"), read when focus lands, never announced per tick. **Rise.** A press sends nothing (no engine verb) and gives the selection haptic. The layer fades out over the palette cross-fade time (a plain fade under reduced motion; Flashes off the same, being no flash); the page does not turn; every hidden control returns at once, with no arrival effect; the held lines go to the log; focus goes to the room title. **Sound.** The room's bed returns on landing through `mix.muffle` and opens over the bed cross-fade at the rise; no other cue; thunder stays muffled. **Interruptions.** Backgrounded, the clock runs on: on return the page shows what is due then, its due lines in order, each drying once. A reopen shows the World page solid, its unplayed lines gone. An encounter, a chapter or a scene arriving ends the state at once, solid, with the held lines logged and the rest of the revival dropped. Catching up keeps the spirit layout (no joystick, no status line); a fault ends the state the same way, and the normal Book shows with it.

**Fight music.** A fight's opening plays a stinger into a lean loop on the music bus, and beds go silent; a fight within the fight gap of the last, or a reopened one, plays the loop alone. A foe falling cuts the loop into a short fanfare, then the room's bed returns. Flight or a quiet end lets the loop fall away with no fanfare. Death cuts it (Falling). A blow dealt plays one impact under the music; the player's own miss, read from the receipt's attack event, plays one whisper; a blow that moves no band, a dodge and a block add no sound, until events can tell them apart, and never from a rendered line.

**Beds.** Each room plays its tag's one loop on the ambience bus, or `wild`, or silence; the same tag across rooms carries on, a new tag cross-fades, and the background stops it. S3 and S4 sounds duck it; the paper turn does not.

**Exploration music.** The first entry since launch to a tag may play its one piece, at most once in a long gap. Waking in a room spends its tag's piece: only the bed returns. It never loops, plays out, lowers beds by `mix.bedUnderMusic`, and only a fight, a chapter or death cuts it.

**Level wash.** A level washes the paper once under the ink in the gilt colour, on whatever page shows, with no swell. It covers what `Page` draws, foot included; the running head and status row sit outside `Page` and stay unwashed, on every page. It shares the Flash limit with the blow wash; when both land together the level has it and the blow keeps value, thud and haptic. Reduced motion halves it; Flashes off removes it, leaving the gilt line, sound, haptic and experience rule.

**A level is never dropped.** A level arriving while an S3 plays takes the pending slot from any other S3. A level in the same view as a foe falling leads: its note and haptic come first, the fight-won haptic yields, and the fanfare waits out the settle hold. The engine's level line comes before a `level_reached` reaction's own line, so an ability is named after the level that opened it. A page turn or a chapter card in the same beat holds a pending level until it ends, and a page curl holds the level's haptic to the curl's end. A `level_reached` rule whose `when` fails or that says nothing leaves the level line at the end.

**Flash limit.** At most one full-page luminance change per second, never three in any second; a
later blow or level in that second keeps the value, thud and haptic, so a flurry never peaks twice in a second.
Flashes and reduced motion are separate.

**Chapter card.** Over the leaving page's picture, blurred, the card's label, title and rule dry in
one after another. The theme cut plays with the medium haptic. With no picture (reduced motion, a
failed or late snapshot) there is no blur and the label, title and rule appear together; the cut
stays. Only a chapter index change plays this, once as [Chapters](#chapters-scenes-and-recovery) says.
The card goes without its paper only while that picture lies under it; leaving, it has its own paper,
so its ink never shows over the next page. It does not curl in, so its haptic comes with the cut.

**Gilt.** A line that marks the player's own gain arrives gilded and settles to its own ink: a
skill learned or improved, or a level, recognised by `levelling.level_up` and never by its words, in the log; a quest resolved, on its Journal title at the Journal's next
opening, once. The Character page's level line stays gilt while points wait to be spent. No failure
is gilt, and gilt is never the only sign. Reduced motion is a plain fade in the line's own ink.

**Lamp glow.** While a flame is lit and the shown palette is dusk or dark, a glow sits at the page's
lower outer corner, in the dark palette's action colour fading out over 40% of the page width, in
over the palette cross-fade, out over the settle. Away from an exposed room it flickers; reduced
motion holds it steady. It lights no sound and no haptic. It is under the ink, draws no block, takes
no touch and is no part of the room page's anatomy.

**Map ink.** A room or link new since the Map last showed draws on over the settle; silent. The
first opening after launch draws nothing. Reduced motion: it appears.

**Page life.** A new choice's answers lift in one after another, never again on a redraw; under
reduced motion they appear together. A person arriving in the room dries in; one leaving fades, takes
no touch while fading, then the paragraph closes; both silent. At the danger hit point band a
vignette of the ink colour breathes at the page's edges up to the faint opacity (steady under reduced
motion), silent. A right riddle answer stays in its place in the warning colour for a held moment,
then settles, with one note; a wrong one sends the tiles back, silent, never gilt. On a night page
two groups of stars twinkle in opposed phase (still under reduced motion). A dream's page carries a
faint dusk tint. A travel, known by the sent expedition's confirmed room change, turns five quick
sweeps over one snapshot with one riffle and a light haptic after it (one fade under reduced motion).
Under-ink layers draw no block and take no touch.

**First times.** The first pickup, first quest and first level of a playthrough are one step
stronger: the warning colour held for a moment on the line that says so, one tier louder, one haptic step up. The view alone decides:
empty hands and worn before a pickup, an empty journal before a quest, level 1 before a level.
Nothing is saved for it.

**Event sounds.** A sound marks what the hand did or how the player's story moved, never what the
world did. Pressed or moved: the page turn, a pickup flick (a take that turns the page plays the flick alone,
and a buy plays coin instead, so one action is one sound), coin, a blow's thud. The story: level, new skill, quest resolved, quest failed, skill
improved (rate limited), quest gained, the chapter cut, and a tick when a debuff lands on the
player, since it marks the player's own state (a buff is silent). **Silent:**
hint change, knowledge, fact,
rumour and reputation, a new map room, a generic narrated event, saves, loading, errors, empty
states, senses, status ticks and expiry, and an NPC's background life.

**Haptics.** The kind for each event sits in the catalogue's tokens; refused and unavailable give
warning, a save error or fault gives error once. Never two within the shortest gap. A haptic due
during a curl is dropped, not held: its sound has already played, and a buzz after the curl reads as
a second event. Reduced motion leaves them on. Web uses the browser's vibration where supported, the
device build is a silent stub until mobile resumes, and no device proof is required before then.
A preview or Storybook build also marks each haptic with a pulse: a ring round the Book column,
outside the page turn, naming the kind, taking no touch or focus and hidden from screen readers. A
player's build never has it.

**Settings.** Sound, Music, Haptics and Flashes follow the Reading size and precede Start over, in
that row pattern, each on by default and kept on the device, not in the save. Sound and Haptics
preview themselves on change; Music and Flashes do not. Music governs every piece of music: the theme cut, fight music and exploration music. Sound governs every other sound, beds and weather included. Turning either off stops what it governs at once; turning Music on again during a fight starts the loop, nothing else. Reduced motion follows the system,
with no control of its own.

A Credits row after Flashes opens a read-only child page, one line for each distinct credit in the
sound manifest, with Back to Settings.

**Queue.** One chapter or death interrupts and clears the queue. One large cue plays with one
pending, and a third of the same key replaces the pending one. Small cues of one key coalesce into
one. A page turn cancels the leaving page's effects; the arriving page's start after its picture
deadline. A merged cue fires once.

**Storm.** On an exposed World page in a storm, at random 20 to 60 s apart and never within the Flash limit's gap of a wash, an under-ink layer of the light palette's paper rises and leaves; thunder follows 1 to 3 s after, with a heavy haptic only on a room entry's first. Reduced motion or Flashes off keep the thunder and draw no light. Indoors there is no light and the thunder and weather layer pass through `mix.muffle`, no haptic.

**Wind.** On an exposed World page, on the change to wind and once per room entry, the top outer corner's paper lifts twice; no ink moves, nothing under reduced motion.

**Lever and latch.** A lever's completion is one clunk and a medium haptic, without page motion. An exit newly shown dries in the Footer, with a latch and a light haptic only when the player's own action opened it. Both read the event, never a label. A lever is a cartridge's authored custom event with the key `lever`.

## Author mode (dev only)

The `?dev=1` dev-cartridge page only ([author preview](cartridge.md#author-preview)); no player
rule above changes, and nothing here is drawn by a component in `mobile/app/book/`: it is laid
over the Book from `mobile/app/author/`, with its words there too. The one exception is the
author seam (owner ruling 2, [builder mode §9](../rnd/in-game-builder-mode-2026-11-19.md)): `book/Text.tsx` exports
`authorSeam`, whose hook the author preview alone sets, to see each Book line and add to that
line's own text element (never a wrapper). Unset, every line renders exactly as without it; a
release build holds none of the code that sets it, and the plain dev preview never sets it. No
other Book file names the seam or imports author code (lint `mobile-book-author-seam`). Looks: [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue);
reasons and limits: [prose in the Book rulings](../design/prose-in-the-book-rulings.md).

- **Edit in place.** A click plays. Outside Build, on a fine pointer, a double-click on a line's
  words (not on a link or card in it, nor inside a text field) opens Build's own field on that line
  (decisions 1 and 5, [builder mode §9](../rnd/in-game-builder-mode-2026-11-19.md); there is one
  prose editor), in its place, nothing reflowing, captioned `<file>:<line>  Enter saves · Esc cancels`; on a coarse pointer (touch) two acts a
  touch target tall, Save and Cancel, stand in that caption's place, and Return still saves (owner
  2026-11-25, paraphrased). The field keeps the line's drawn height; the one caption or acts row
  under it is the only thing that moves the content below. It holds the source words unbound (slots
  and `~` as written; a speaker-joined line only its quoted words). One line, soft-wrapped: Enter
  or leaving the field saves, Esc cancels and returns focus to the line, no break is ever
  inserted, a pasted break or tab is a space, unchanged words write nothing, an empty field stays
  open saying `Empty. Write ~ to leave it unwritten.`
- **Confirming.** The new words show at once; nothing marks the line while the compile runs. A
  refused compile marks the line unconfirmed (accessible name adds `unconfirmed`) until a good
  compile, and the console badge reads `The Book shows unconfirmed words (N)`, listing each
  line's `file:line` and refusal.
- **Put it back.** No key puts a write back: Build's Undo and the notebook's Recent do (below).
  Cmd-Z (Ctrl-Z) presses the strip's Undo while it shows (slice 6.5b, ruling 7); with no Undo
  showing it does nothing. Inside a field it is the field's own undo.
- **Walk keys** (Build, a hardware keyboard; [builder mode §5](../rnd/in-game-builder-mode-2026-11-19.md)).
  `]` and `[` walk the page's unwritten lines (wrapping), `}` and `{` every line Build draws as a
  field but a choice's label (titles are their pencils'); the landed line scrolls into view and
  takes focus, and Enter or Space opens its field. The jump never leaves the page; elsewhere is the
  Checks sheet's still-to-write rows. No key fires in a text field (the say field too) or with a
  modifier. The panel's own shortcuts pressed with the Book focused still reach the panel; nothing
  the panel sends reaches the Book any more (its relays ended with the E5 field; the panel retires
  at 6.8).
- **Counts** are in the panel's console, Build on or off: `~ 2 of 5 here · 41 in cartridge`, the
  page's unwritten lines (`2 of` only while a walked-to line has focus) and the cartridge's.
- **Changed on disk (409).** The field keeps the draft; under it: `Changed on disk since you
  opened it.`, their words, and Keep mine (writes the draft over their line, found again) or Take
  theirs; only Open source when their line is not found exactly once. It opens unasked when a
  pushed change alters the field's line.
- **Behind the compile** (a Checks row naming a line this page does not draw, whose words `/open`
  no longer finds, a 404: the page was drawn before the last compile). Under that row, in a row of
  its own (the No-field note's look and timing), read politely: `Changed since the last compile:
  this page is behind the cartridge.` (placeholder words, the owner's to replace). Nothing opens.
- **Hold** shows in the panel header (a toggle and `Held · N waiting`), on the Build strip and
  (6.2a) on the Notebook's Tools tab, never in the Book; leaving the page releases a Hold it set.
- **Build** (the in-game builder, [builder mode §4.1, §5](../rnd/in-game-builder-mode-2026-11-19.md)).
  A strip a touch target tall sits above the Book, outside its page and chrome row, in the Book's
  current palette, night included, as do its sheets. It carries the Build switch (a switch named `Build`, its on state shown by more
  than colour) and a polite live status: `Held · N waiting` while the server holds compiles, else
  nothing. Last on the strip (6.2a), after its buttons, the last compile's timing: `<kind> <compile> +
  <publish> [+ <load>] = <total> ms`, marked over budget by colour and by its spoken name (`Last edit
  timing, within|over <budget> ms`); a Book opened with no compile since shows none. Turning Build on or off changes no game state; leaving Build closes every sheet. A
  builder field holds compiles from its focus to its commit (Enter, blur, a picker closing) and
  releases only a Hold it took; tabbing to the next field keeps it. With no field focused, a
  compile reloads the Book as usual: Build, the open sheet and its scroll are kept beside the place
  and come back after the reload. The plain dev preview and a release draw no strip.
- **Safe areas** (phone). The page draws under the notch and home bar (`viewport-fit=cover`); the
  document behind the Book is painted the Book's current paper, night included, so no light band
  shows at an edge or in an overscroll. The Build strip pads its top and sides by the safe-area
  insets; a sheet risen from below pads its bottom by the home-bar inset.
- **Build: in-place field** (slice 1.3, [builder mode §4](../rnd/in-game-builder-mode-2026-11-19.md);
  the unwritten look is owner ruling 9 in its §10). In Build a line that draws one description
  whole is a button named `<words>, edit` (`Unwritten <field>, edit` when unwritten; either adds
  `, unconfirmed`); a link in it keeps its own press, and Enter or Space on the focused line opens
  it. A **tap** (not a double-click) opens the field on that line, nothing reflowing, with Edit in
  place's caption under it. What it holds, save, Esc, Empty and the 409 notice with its two
  buttons are Edit in place's and Changed on disk's above. Unwritten lines never show `~`
  (ruling 9): an unwritten line is a blank ruled line of its own height with its field name
  (`description`) on it; its field opens empty with the hint `Unwritten: <field>`, and leaving it
  empty keeps `~`. A line the last compile refused carries Confirming's unconfirmed mark. Looks:
  [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue).
- **Build: Undo, Checks, keep my place** (slice 1.4, [builder mode §4.1, §5](../rnd/in-game-builder-mode-2026-11-19.md)).
  The strip wraps to more rows when its items do not fit; looks:
  [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue).
  - **Undo.** After each saved Build write a button `Undo` shows on the strip for 5 s; a later write
    restarts it for that write. A press hides it at once and puts back exactly that write; success
    says nothing (the line's old words return). A refused or unsent put-back shows, politely,
    `<file> changed since; not put back.` and an `Open source` button, until the next write. No redo.
  - **Checks.** While Build is on the strip carries a button `Checks`, then ` · N refused`,
    ` · N not confirmed`, ` · N unwritten` for each nonzero count, in that order (never `~`, ruling 9;
    this replaces §4.1's `~ 4 here · 41`). It opens the Checks sheet, or closes it when open. Rows, in
    that order: `<file>: <path>: <words>` per refusal (`cartridge` when it has no file), `<key>: not
    confirmed`, `<key>: unwritten`. A row whose key this page draws as a field closes every open
    sheet (on a phone one left open would cover the line) and opens that field; any other key opens its source, a refusal its file, both leaving the sheet
    open; a refusal with no file is plain text, not a control. No rows: one line, `Nothing to
    check.` (placeholder words, the owner's to replace). Below them (6.3a, the panel's Still to
    write), one row per source file still holding `~` (GET `/todo`, asked again per compile),
    naming the file, its count of `~` lines still to write, and its placeholder lines in dim under it;
    the file opens its source. `Nothing to check.` shows only when both lists are empty.
  - **Keep-my-place notice.** While the replay of the recorded path stands refused, a second strip
    row reads, politely, `Couldn't keep your place: step N, <step>, was refused.` (`step N was
    refused.` when the step has no name), with Build on or off, and offers `Drop it and go on`;
    `Back to checkpoint`, only once a checkpoint was jumped to from the panel, replays the last
    one; `Start in this room`, only after a Build write, starts over in the room of the last
    write. It goes when the game starts over or a later replay is not refused.
- **Build: sheets, the title pencil, the Room sheet** (slice 2.1, [builder mode §4.3, §4.9, §5,
  ruling 7](../rnd/in-game-builder-mode-2026-11-19.md)). Looks:
  [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue).
  - **Sheets.** A sheet has a Back button, the breadcrumb of the sheets under it (their titles
    joined ` › `), and its title, a header that takes focus whenever a new sheet comes on top; its
    body scrolls, from its start when it comes on top. Sheets stack, at most four: opening a fifth
    replaces the top one (the palette excepted, below), opening one already lower moves it to the top, and Back closes only the
    top one (a Flow walk first steps back along its trail, Flow walk below). Closing the last returns focus to what opened the first. The stack and the top
    sheet's scroll survive a reload; leaving Build closes every sheet.
  - **Sheet foot** (6.2b, the panel's source footer). A sheet that draws one source file (a Room,
    Person or Item sheet) ends its body with that file's path; a sheet titled by its path (the
    generic sheet) or drawing no single file has none. Above it (6.3a, §4.9) every sheet of one
    deletable definition (Room, Person, Item, and the generic sheet of a file under a folder; never
    a root file) ends with `Delete <key>`, as Room sheet edits run it.
  - **Sheet head** (parity gaps, loka-hcnlh.71; the panel's inspector header). Once a story has arrived, a sheet of one
    definition (Room, Person, Item, and the generic sheet of a file that defines one; a bundle
    member by its ref, as it has no file of its own) starts its body, above the refusal line, with
    the definition's ref, then one line of its counts from the last story, `N unwritten · N
    diagnostics` (placeholder words; both always shown, zero included), then, only when the story
    finds it unreachable from the start, an unreached line (placeholder words). Unwritten counts the
    `~` lines still to write that the definition's own file and the `text.json` keys it names hold,
    as Checks counts a file's (6.3a), not the panel's rows of them; never `~` (ruling 9). A sheet of
    no definition (a root file's) heads with its file's path alone, as the panel does. The head is
    read only, nothing in it pressable.
  - **Two layouts** (ruling 7). Where the window holds the full page column with a docked sheet
    beside it (the page column and half of it again), the sheet docks at the Book's right edge,
    half a page column wide, not modal, and the Book beside it keeps its full column, unless
    the notebook column is open too (Wide layout below), and stays playable. In a narrower window it rises over the Book's lower half, modal, with a grip (a
    button named `Full height`, expanded when full): a drag up makes it full height, a drag down
    from full halves it, from half closes it as Back does, and a tap or Enter toggles the height.
    A sheet slides in from the side it docks on (from below on a phone); under reduced motion it
    cuts in. Closing never animates.
  - **Wide layout** (6.5a, ruling 7; the panel's columns, column-folds). The breakpoint is Two
    layouts' (`DOCK.at`, the page column and half of it again; no other). From it:
    - **Notebook column.** The strip's `Notebook` opens the notebook as a column docked at the
      Book's left edge, half a page column wide, not modal, never in the sheet stack; pressed
      again, or its own `Close` in Back's place in its header, it closes. Left to right: the
      column, the Book, a docked sheet. The column stays open while sheets open, stack and close
      beside it; a sheet it opens docks at the Book's right edge, and Back closes only sheets.
      Its header (title `Notebook`, then the tabs) takes focus when it opens; closing returns
      focus to `Notebook`, which shows selected while the column is open. Its open state, tab and
      scroll survive a reload as the stack does; leaving Build closes it. It slides in from the
      left and closes as a sheet does.
    - **The Book** takes what the open column and sheet leave, its page column still centred and
      at most a page column wide: with both open in a window under two page columns it narrows,
      down to half a page column (a phone's width) at the breakpoint, and lays out as on a phone
      of that width. It stays playable, links and walk keys included.
    - **Crossing the breakpoint.** Narrowing closes the column (a focus inside it goes to
      `Notebook`); open sheets stay and rise over the Book. Widening opens nothing.
    - Below the breakpoint nothing changes: the Notebook is a sheet and every sheet rises over
      the Book.
  - **Device size** (the panel's phone and tablet sizes). The builder follows the window: a
    window, or the browser's responsive device mode, at a phone's width is the phone layout (sheets rising, the Notebook a sheet),
    so no control previews the Book at a phone's width inside a wide window, where it would sit
    beside docked sheets no phone shows (designer ruling 2026-11-26; the owner may overrule).
  - **Open source** (6.5a, the panel's source footer). At every width, never only when wide, as
    the changed-on-disk notice's `Open source` already is:
    - The Sheet foot's path is a button named by the path; a press asks the owner's editor to
      open that file (`/open`). A refusal shows under it, politely, until the next press: `Not
      opened: <why>` (placeholder words, the owner's to replace); success says nothing.
    - Alt-click (Option-click) on a Book line, a fine pointer, Build on or off, opens its source
      once (one `/open` per click), with Sheet foot's refusal line on the strip.
  - **Title pencil.** In Build the room page's own title is followed by a pencil button named
    `Edit <title>`, which opens that room's sheet (2.2 adds the name pencil). An unwritten title shows its field
    name `title`, as Build's in-place field draws an unwritten line.
  - **Room sheet.** Titled by the room's title. At its top, under the sheet head and the refusal line, a summary line (6.3a, §4.3 item 2):
    `dark · N variants · N exits` (`1 variant`, `1 exit`), each absent part left out (its look
    in the catalogue); the dark and variants parts are actions opening the room's `def:` sheet, the
    exits plain (their rows are below). The area is not in it: the `Area` field holds it. Then a row
    per exit, `<dir> → <room>`, with `Door` and `Lock` (a new closed or locked barrier on both faces,
    under a generated `barrier_N` key), `One-way` (drops the way back) and `Delete` (removes both
    ways); Door and Lock are greyed, with one reason shown once, on an exit that already has a
    barrier or has no way back. Then `＋ <dir>` for each side with no exit (for
    a room on the map grid, also none toward a cell another room holds): it makes a new room
    there, keyed `room_N`, in this room's area, linked both ways, every word unwritten. Then an
    `Area` field, shown holding the room's area, and `Move to area`, which moves the room to the
    typed area (empty: the root). Then `Fields`, opening the room's `def:` sheet. Last, `Delete <key>`. A room with an unwritten title shows its
    key wherever the sheet names it (title, breadcrumb, exit rows, `Edit <key>`; ruling 9), never
    `~`.
  - **Room sheet edits.** One runs at a time; a press while one runs does nothing. A refusal (the
    server's words, or `<key>: no source file` for a room with none) shows, as an alert, at the
    sheet's top until the next press. When Delete would take other files, the foot reads `Also
    deletes <files>` with `Delete all` and `Keep`; any other press on a sheet answers Keep first,
    then does its own edit. The server's refusal names a deleted room's referrers. Once read (6.3a, §4.9), Delete reads
    `Delete <key> · N referrers`, N counted by the same rule as the server's delete gate (find.ts
    `users()`, `extends` included); while N > 0 it is greyed, its reason the count, and still pressable,
    so the server's refusal names the referrers. A deleted room's sheet closes wherever it sits in the stack. Labels here are
    placeholder words, the owner's to replace.
- **Build: Add here, the Person and Item sheets, Contents, unwritten links** (slice 2.2,
  [builder mode §4.4, §4.9, ruling 9](../rnd/in-game-builder-mode-2026-11-19.md)). Every edit here
  runs, refuses and answers a pending Delete question as Room sheet edits do. Looks:
  [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue).
  - **Add here.** On the Room sheet, after the `＋ <dir>` row: `＋ Add here`, then `Person`,
    `Item` and one button per template (abstract person or item), named by its key. Each makes a
    new thing placed in this room, keyed `npc_N`, `item_N` or `<template>_N`, every word
    unwritten, and opens its sheet on top.
  - **Name pencil.** In Build a page title that is exactly one person's or item's name (unless it
    is this room's own title) is followed by a pencil named `Edit <key>`, which opens its Person or Item sheet. Two
    things drawn in the same words get none.
  - **Person and Item sheets.** Titled by the key. A summary line names where it starts: `Room ·
    <key>`, `Person · <key>` or `Item · <key>`. A person then has a `Room` field and `Move`; an item
    has `Room`, `Person` and `Item`, which pick the holder's kind, then a field named by that kind
    and `Move`. The field shows the current holder while its kind is the current one, else empty.
    Move with the field empty does nothing; a key no definition of that kind holds is refused
    without a write. A thing a spawn places shows `Spawned by <template>` instead, with no field.
    A placed thing also offers `Delete placement` (6.3a; removes where it starts), then `Fields`
    (its `def:` sheet), then the Delete foot.
  - **Contents (minimal).** While Build is on the strip carries a button `Notebook` before
    `Checks`; it opens the Notebook sheet, or closes it when that is the top sheet. One row per
    kind a starter exists for, each with `New <kind>`; a kind whose key is the author's (text,
    behaviours) has a field named by the kind before it, and New with it empty does nothing. New
    makes the kind's starter under a free key (or the typed one); a person or item opens its
    sheet, any other kind stays on Contents. Under each kind's row, in a row of its own, its JSON
    source files the latest story names, sorted by path; a file opens its `def:<file>` sheet
    (Build: the generic sheet) on top. A file that defines rooms is followed by `Go to <room>` per
    room (6.3a), which plays from that room.
  - **Story (5.4b, [builder mode §4.8](../rnd/in-game-builder-mode-2026-11-19.md#48-the-story-on-a-phone)).**
    The Notebook sheet has four tabs, `Contents`, `Story`, `World` (6.1a) and `Tools` (6.2a); the open tab is marked selected. Story
    shows the refusal line, then `Facts` and `Pacing`, then each part (`Part n Title`) with a number
    field and `Add beat`, its beats (`n Title`, `· unwritten` where the panel marks it `~`, `· missing`
    when unbuilt), each beat's bound definitions, Seeds as plain lines that are not buttons, and
    `Unplaced (n)`. A row is marked built, missing or unreached, with its refusal count, and never
    `~`. Open and selected are one state: the first press on a part or beat opens and selects it, a
    press on the selected row shuts and deselects it, and a press on an open row that is not
    selected only selects it. A definition row is selected without opening. Only the selected row
    shows its acts, in rows of their own under it. A definition offers `Go there` (the room a
    placement edge, `.room` or `.items`, joins it to; none, no Go there), `Sheet` (a room's, person's
    or item's own sheet, else its file's generic sheet), `Source` (only beside a room's, person's or
    item's own sheet: its file's generic sheet, the panel's Alt-click), `Trace` (a fact's
    setters, then its readers, each naming a definition opening its sheet), `Consequences` and,
    for a node the Flow draws, `Flow` (the walk centred on it). A
    beat offers a title field with `Retitle` (empty removes the title), `Remove` (no confirm: the
    Undo chip covers it), `Knowledge` (the facts set before it, as words) and `Bind…`, a fold of
    `Bind <short>` per short ref. A part offers a title field with `Retitle` (empty removes the
    title) and `Remove` (its beats with it). `Add part` follows `Pacing`: it appends an untitled
    part, or with no outline asks /new for the starter; it is hidden while the last compile
    refused outline.json. Each edit is one gesture with one Undo. Facts, Pacing, Trace,
    Consequences and Knowledge open as sheets.
    - **No story yet.** Until a story arrives, or while the compile is refused, the tab shows the
      refusal line (if any) and one plain line saying there is no story yet, never a blank tab.
      With a story but no parts (no outline file, or none in it), it shows that plain line under
      `Add part` (placeholder words), which writes the first part. A sheet opened
      from it with no story says Nothing here.
  - **World (6.1a-b).** The refusal line, then a row of the world's root files that were read, in
    the order `cartridge.json`, `facts.json`, `resources.json`, `attributes.json`, `text.json`; a
    file absent or not yet read is not listed. A file opens its `def:<file>` sheet on top (on the
    generic sheet; `text.json` has no block). Then (6.1b) a row of the world files, populations,
    transports and barriers (never checkpoints or cheats), chosen as Contents chooses a kind's
    source files: those the latest story names, sorted by path, so a file the story compiles no
    node from (an abstract one) is not listed (open item). Each opens its `def:<file>` sheet on
    top, drawn with the World block. Once `cartridge.json` is read, a row of
    `Turn on <key>`, one per capability in the registry the cartridge lacks, in registry order:
    a press writes it into `requires.capabilities` at its registry version, one write that one
    Undo takes back, no confirm; it leaves the row after the reread. A write sent from an old read
    is refused as the generic sheet's are, never overwritten.
  - **Tools (6.2a-b, [builder mode §4.3 item 3, §5](../rnd/in-game-builder-mode-2026-11-19.md)).**
    First a row of the tab's readers, `Play`, `State`, `Why`, `Step` and `Numbers` (6.2b); the open
    one is marked selected, `Play` at first. Then the open reader's rows. None but Play changes the
    game. With no game or no state yet, State, Why and Step show one plain line saying so.
    **Play** (6.2a): the refusal line, then in order:
    - `Hold`, a toggle shown selected while on; it sets and releases only its own hold, never a
      field's.
    - A name field and `Save checkpoint`, which saves this play's steps under the name; it is
      greyed until the name is valid and there is a step. An invalid name shows the name rule as a
      plain line under it. While any checkpoint fails, the row ends `N checkpoint(s) fail`.
    - One row per saved checkpoint, listed afresh each time the tab opens and after a save:
      `Replay <name>`, `Pin` (selected for the pinned one) and its verdict. Replay replaces this
      play with the checkpoint's steps; a refused read or a file with no steps changes nothing and
      says so on the refusal line. Pin marks the checkpoint a fresh Book (no steps yet) replays
      once on load, in the Book as in the panel; pressing the pinned one unpins it. With none saved,
      one plain line says how to make one, never a blank.
    - A minutes field (60 by default) and `Advance`; `Go to room` with a room key; `Set fact` with a
      fact key and value; `Set level` with a level, an attribute key and points. Each act is greyed
      until its fields are filled. Advance and each cheat is one recorded step; a refusal says why
      on the refusal line, and an accepted one clears it (never repeating an older stop note).
    - **State** (6.2b): the game as the view shows it now, each a heading over its lines: the room,
      people, held things, pools (`<key> <current>/<maximum> <band>`), statuses, the clock, a
      pending choice's prompt over its options, quests (`<quest> <state>`) and facts
      (`<key>: <value>`, `unset` when it has none, a value still at its default marked so). A
      heading with nothing under it shows `none`, never a bare heading.
    - **Why** (6.2b): under a heading, each action and dialogue this room offers, as a button; none
      offered is one plain line. A press asks why that one is or is not on offer now and shows the
      answer under the buttons, its key as the heading, the pressed button marked selected: one
      line per condition, `yes`, `no` or `depends on the target`, then its words, a nested
      condition indented one step; a `no` line in the danger tone. Under the lines, `Full report`, a
      toggle shown selected while open, folds the answer's whole report as indented JSON (the panel's
      Full report); a new answer comes with it shut. A refused ask says why in the
      danger tone. The answer holds only for the state it was asked on; any change drops it.
    - **Step** (6.2b): what the last step did. Before the first step one plain line says to take
      one; past 400 steps one plain line says Step is off and to jump to a checkpoint, with no ask.
      Otherwise a heading `Step N` (with the step's command and outcome once told), the time the
      ask took (marked slow past 2 s, never hidden), then three headed lists, each with its count:
      the facts it changed (`<key> <from> → <to>`), the quests it changed, and every rule whose
      trigger matched: its ref, a button opening its sheet when the last story names its file (the
      panel's select), then its verdict, the verdict alone in the danger tone when the rule did not
      fire; with no sheet, one plain line of both, wholly in the danger tone when it did not fire. An empty list shows `none`; the
      rules show `asking…` until the answer comes, then `none matched`. It asks once per step; a
      step taken with the notebook shut still pairs with the state before it. A refused ask says
      why in the danger tone.
    - **Numbers** (6.2b): `Run`, which asks the watcher's balancing reports; while they run a plain
      line stands in its place. A failure, and a report older than the cartridge in the Book, each
      say so in the danger tone. Then the reports under `Pools`, `Levels` and `Fights` headings,
      each table row one line ([looks](../BOOK-UI-COMPONENTS.md#component-catalogue)); a section
      with nothing to measure says so in one plain line.
  - **Flow walk (5.5b, [builder mode decision 9 as amended](../rnd/in-game-builder-mode-2026-11-19.md)).**
    `flow:<ref>`, one sheet titled `Flow <key>`; not the panel's canvas shrunk. In order: the
    walk's trail, when it has more than one step (its keys joined ` › `, under the header); a
    `Filters…` fold (expanded while open), followed while shut by each filter that is on, so a
    filter hiding nodes always shows and one press turns it off; open, every Flow filter as a
    toggle, on marked selected. A filter hides its lane's nodes from every band, never the centre.
    The filters on are kept from walk to walk until the Book reloads. Then `Leads here` (the nodes
    with an edge into the centre), the centre, `Unlocks` (the nodes it leads to); a band with no
    nodes is not drawn. For a fact the bands are its thread, as Trace's: `Set by`, then `Read by`.
    A band's node is `<kind> <key>`, a press re-centres the walk on it, with `Sheet` when /story
    named its file. The centre offers `Sheet`, each person and item an edge joins it to (opening
    their own sheets) and `Go there: <room>` for each room. A press on a node already on the trail
    cuts the trail back to it (never a loop). Re-centring keeps the walk one sheet: the stack
    neither grows nor reorders, and the body starts at its top. Back, and the grip's drag down
    from half height (Back, Two layouts), step back one trail step; on the first they close it. With
    the docked layout (Two layouts) the walk adds two hops: `Two steps out` above `Leads here`
    (what leads to those nodes) and below `Unlocks` (what those nodes lead to), each node a band
    node, the filters applied; the phone draws none. With no story the sheet says Nothing here.
  - **Unwritten links.** In Build a link whose words are unwritten draws as an unwritten line
    does (Build: in-place field): a blank ruled line with the caption `name`, never `~`, named
    `Unwritten name, open`. It keeps its own press. Out of Build every link draws as before.
  - Labels here are placeholder words, the owner's to replace.
- **Build: the generic sheet** (slice 2.3, [builder mode §6.4](../rnd/in-game-builder-mode-2026-11-19.md)),
  `def:<file>`: any source file's fields, drawn from its kind's schema. Every write runs and refuses
  as Room sheet edits do; it is sent with the file as the
  sheet read it, so a file changed since is refused, never overwritten. Looks:
  [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue).
  - **Sheet.** Titled by the file's path. Until the file is read the body is empty. Then its root
    fields, each a block indented one step deeper than the field holding it.
  - **A block** shows the field's name, then its value. A field that holds fields (an object or a
    list) is folded: its name is a button that opens or closes it, closed at first. A field the
    schema does not require, and every list item, has `Remove`, which deletes it. An optional
    constant (a flag such as `hidden`) is a switch instead: `On` writes it, `Off` deletes it, and
    the one that holds is picked; a required constant shows its value as plain text.
  - **Objects.** The fields present, in the file's order, then `Add…` while the schema has fields
    the file lacks; it opens or closes a list of their names. A pick writes that field's least
    valid value (a definition's own starter value where it has one); a field with none shows
    empty and is written when it is first entered. A map ends with a `Key` field and `Add`, which
    adds an entry under that key; an empty key or one already present adds nothing.
  - **Lists.** Each item, with `Remove`, then `Move up` (every item but the first) and `Copy`
    (a duplicate after it); a file that is itself a list has neither. Last, `Add item` appends a
    least valid item.
  - **Picks.** An enum or a boolean is one button per option, a union one button per branch
    (named as the panel names them), the present one picked; a press writes it, and a union then
    shows the picked branch's own fields. A union offers only the branches the compiler takes in
    the file's kind, plus the one present (slice 5.3); a switch is one write that sets the new tag
    and keeps the fields the two branches share. A union that only constrains (a missing or second
    subject) draws nothing; the compiler reports it.
  - **Typed fields** (a string, a number, a text's words, a definition's key) show the present
    value on a ruled line and write when they lose focus, only when changed; a number field that
    does not read as a number writes nothing. Each fits the sheet's width, however deep its block.
  - **Add mechanic…** (slice 2.3b; root fields only, after `Add…`). The fields that are mechanics
    are never in `Add…`; they are in `Add mechanic…`, which opens or closes their list and is not
    drawn while the list would be empty. First the absent mechanics this cartridge allows for the
    kind, a pick written as an `Add…` pick; then the absent ones it refuses, greyed, each with why:
    `needs X in cartridge.json` (several joined by ` + `) or `needs another field first`. A greyed
    row whose only lack is capabilities in the registry is pressable: it writes them on in
    `cartridge.json` (`requires.capabilities`, each at its registry version) and then the field,
    one gesture that one Undo takes back and a refusal undoes whole; it asks no confirm. Its reason
    reads as an action. Any other greyed row is disabled, its reason greyed with it. A turned-on field with no least value shows empty, as an `Add…` pick's
    does, and stays shown through the page's reload after the write (on web, for the browser
    session) until it is written or removed. `Remove` on a mechanic takes only its field off; the
    capability stays on. `Remove` on a field shown empty and never written hides it, writing
    nothing.
  - **Combat and Schedule blocks** (slice 2.4; root fields only, chosen by the field's registry
    row). On a person's sheet `hp`, `attack` and `daily_schedule`, and on an item's sheet `weapon`,
    are each drawn by a block; every other field is drawn as above.
    - **Combat.** The field's block as above; `hp` has nothing more. Under a present `attack` or
      `weapon`, folded or open, `Run fights` asks the fight report: for an attack the person's own
      rows, for a weapon every target's (the weapon in the player's hand). While it runs,
      `running the fights…` stands in for the button and the last answer is gone. The answer is,
      per target, its name, its verdict, then its no-build table: a header row, then one row per
      level, each row one line of its cells joined by ` · `. Or one line saying why there are
      none: the report's own reason, `not a fight target…`, `no fight targets in this world`, or
      the request's error. The answer stays until the next write anywhere; an answer that arrives
      after a newer run or write is dropped. The table never scrolls sideways or clips: a row
      wider than the sheet wraps, so its cells are read in the header's order.
    - **Schedule.** The day's hours in hour order, each one row: its number on a short ruled line,
      its room or cases as the form draws them, and `Remove`. The number moves the hour when it
      loses focus, only when changed, to a whole number below the cartridge's hours per day (24
      when it names none) that is not already an hour. A refused move shows its reason as any
      refused write does (`an hour is a whole number`, `an hour is below N`, `already N`), writes
      nothing and keeps the typed value, so leaving the field again refuses again. Last,
      `Add hour` writes the first free hour, sending the person to the room in their own file;
      with no room there, or every hour taken, it is a disabled greyed row with
      `place the NPC in a room first, or the day is full`.
  - **World block** (6.1a, [`world_card.ts`](../../kernel/ts/play/world_card.ts)). In
    `resources.json` and `attributes.json`, a root entry's `Add` writes the World card's new entry
    for that key instead of the least value. Elsewhere, a field that names a resource or an
    attribute gets one pick per key of the read root file under its typed field, the present one
    picked; a press writes it. A typed value naming no key is refused without a write
    (`no <kind> <key>`). While that root file is unread the field is free text.
    - **Long-list pick** (loka-hcnlh.66; the panel's type-ahead picker, `Pick` in
      [World.tsx](../../tools/author-panel/src/edit/cards/World.tsx)). A field naming a room, an
      item, a person or a transport (`pickable` in `world_card.ts`; in a list such as `rooms` or
      `allies`, each item's field) offers the keys the latest good compile holds of that kind that
      this file may name: any room, and no other area's item, person or transport (`reachable`,
      the panel's list). With none known (no compile yet) the field is free text and refuses
      nothing. Whatever the count, such a field refuses at the field, as below, never at the
      sheet's top; only its picks differ. Six keys or fewer: every key is a pick, as a resource's
      is. More: no picks until a keystroke in the field; from then until a write, or until the
      field loses focus holding its present key, the row under the field holds, first, while the
      typed text is not empty and no key equals it, the refusal `no <kind> <text>` (the panel's
      words, `npc` for a person); then the matches, case ignored: the key equal to the text, then
      the keys starting with it, then the others containing it, each group in the list's order,
      at most six; then, when more match, one plain line `+N more`, N the matches not shown
      (placeholder words). An emptied field matches every key.
    - A match press writes that key at once, one write that one Undo takes back: the field shows
      it and the row goes. Leaving the field writes the typed text only when a key equals it; any
      other text sends nothing and stays in the field with its refusal, so leaving again refuses
      again, until the next keystroke or a match press. A match pressed after typing (the press
      that takes the focus from the field) writes only that key: the typed text is not sent
      first, even when it is a key itself (`room_1`, then a press on `room_12`), and no refusal
      for it shows.
    - On a phone, focusing a long-list field raises the sheet to full height (the grip's) and
      scrolls the field to the top of the body, so the field, the refusal and the first matches
      sit above the keyboard; the docked sheet only scrolls. Each match is named by its key. The
      refusal is read (politely) when the field loses focus holding that text, never per
      keystroke.
    - Open items: the panel marks a picker's name `stale` while the last compile is refused (its
      keys are the last good compile's); the Book does not yet. A refusal at a sheet's top scrolls
      away with the body on any long sheet (a sheet-wide question; the long-list pick refuses at
      the field).
  - Labels here are placeholder words, the owner's to replace.
- **Build: ghost lines and See as…** (slice 2.5, [builder mode §4.5](../rnd/in-game-builder-mode-2026-11-19.md)).
  Looks: [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue).
  - **Ghost lines** (Build only; the one Build exception to the
    [room page anatomy](#room-page-anatomy)). On the room page, after the title and before the
    description, each person, item, description variant, detail action or way into a dialogue
    that this room holds and the page does not show is one line: `<words> · <reason>`, the reason
    `hidden: until …`, `only when: …`, `not here now` or `not offered now`. They sit under the
    fixed title (the seam's only room-level anchor), every ghost its own line (owner, 2026-11-23,
    paraphrased: make every ghost line visible), each cut to one line with an ellipsis. The owner
    accepts the trade-off: the fixed header grows by one touch target per ghost. A ghost's tap
    opens its sheet (its person's, item's or room's, else its definition file's); a ghost with no
    sheet is not pressable and its label does not say edit. Ghost lines are never in the log or
    the save, and leaving Build removes them.
  - **Room sheet ghosts.** On the Room sheet of the page's own room, after the exit rows, every
    ghost is a row, `<words> · <reason>`, wrapping whole so the reason is never cut, opening its
    own sheet as its ghost line does; a variant's row opens no sheet (it is this one).
  - **See as…** A variant's row carries only `See as`. A press redraws the room's words with that variant's
    words, writing nothing, and the strip shows a chip, `Seeing: <reason> · Back`, whose press
    ends it. A same-room act does not end it, nor do the clock's pulses. Any write, a hear (a live
    message), the Build toggle, a tap on a line, a new room, new words in force or a new game end
    it. A tap on a line while See as is on only ends it, so the true words show before any field
    opens. It never writes to the save.
  - Labels here are placeholder words, the owner's to replace.
- **Build: the Build map** (slice 4.2, [builder mode §4.7](../rnd/in-game-builder-mode-2026-11-19.md)).
  Looks: [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue). While Build is on the
  strip carries `Map` between `Notebook` and `Checks`; it opens the map sheet, or closes it when
  that is the top sheet. The map is the builder's drawing of every placed room in the story's
  layout, not the player's discovered [Map](#minimap-map-and-presentation-controls), which keeps
  its rule against actions.
  - **The drawing.** One level at a time, titled `Map · level N`: each room a box at its cell
    showing its key (cut with an ellipsis; no key when the box cannot hold one), each exit between
    two rooms on the level a line from centre to centre under the boxes, the current room ringed
    (told by shape as well as colour, as on Map). It opens on the current room's level, fitted, and
    follows the current room until a level step; Go here makes it follow again, refitted.
  - **Controls.** A row above the drawing: `⌃` `⌄` step up or down a level, fitted; they show only
    when the placed rooms span levels, and at the top (bottom) level `⌃` (`⌄`) is disabled. `−` `+`
    zoom about the drawing's centre; `⤢` fits. A one-finger drag on empty ground pans, two fingers
    pinch about their midpoint, and on the web the wheel zooms about the cursor. The view never
    leaves the level: at least one cell of it stays on screen.
  - **Touch** (designer ruling, 2026-11-24, after Map's touch-sized dots; the PM may overrule).
    Every room box is a button at least a touch target in both axes: its target is its whole cell,
    centred on its box. The least zoom, `⤢` and the first fit included, makes a cell a touch target
    wide, so no two targets overlap and fitting never shrinks a box below one. A level that does
    not fit at that zoom is shown at it, centred on the current room when that room is on the
    level, else on the level's middle, and the author pans. A press on a room that moves past a
    tap's slop pans and selects nothing.
  - **Selection.** A tap selects a room and never plays. A bar under the drawing reads
    `<key> — selected`, then `Go here` (play starts in that room, as `Start in this room` does) and
    `Sheet` (its Room sheet opens on top). On a phone the bar shows without scrolling the sheet at
    half height. A selected room that is renamed or deleted is no longer selected.
  - **Unplaced.** Rooms with no cell are a row under the drawing: `Unplaced (n):`, then one button
    per key; a press selects that room as a tap on its box does.
  - **Edits** (slice 4.3). After `Sheet` the bar carries `Join…` (when the room is on the level
    shown), `Move…` (when it is placed), `Area…`, and `＋ up` `＋ down` for each free side up or
    down. On the drawing a `＋` sits in each free cell north, east, south or west of the selected
    room; a side is free when the room has no exit that way and no room holds the cell. A tap on
    `＋` grows `room_<n>` there, in the room's area, with the exit and its way back, and selects it.
    - `Join…` and `Move…` arm the map: the bar's words read `<key> — tap a room to join` or
      `<key> — tap an empty cell`, read politely when they change; its acts are `Cancel` alone and
      the `＋` hide. In Join… a tap on another room writes the exit toward it (the larger offset's
      side, east or west on a tie, as the panel's Shift-drag) and the way back; a tap on the room
      itself writes nothing and Join… stays armed. In Move… a tap on an empty cell writes the room's
      layout row; a tap on a room does nothing. A write ends the mode.
    - An unplaced room picked from its row reads `<key> — tap an empty cell`; a tap on an empty cell
      places it there (on a map with no placed room, every room is laid out, as the panel's first
      drop).
    - `Area…` shows the Room sheet's Area row under the bar's words, then `Cancel`.
    - `Cancel`, Esc or the sheet closing ends a mode, writing nothing. Every act of the bar, `Cancel`
      included, shows without scrolling the sheet at half height on a phone.
    - Each gesture is one step on the strip's Undo chip. The chip and the selection outlast the
      reload a structural compile brings. A refusal shows at the sheet's top; a refused put-back on
      the strip.
    - A moved room's exits keep their directions: a line runs centre to centre even when the
      layout contradicts its direction ([E3a Exits](../design/editor-map-and-story-rulings.md)),
      so it may slant; a line is never hidden by a box that is not one of its two rooms.
  - **Keys** (6.5b, the panel's map keys). While focus is on the ground or a room in it and no mode is
    armed: an arrow selects the nearest room that way on the level shown (from the
    selection, else the current room, else the first), Enter selects, Shift-Enter is `Go here`,
    PageUp and PageDown step a level up or down (none past the last), `+` (`=`) and `-` zoom by one
    step, `0` fits. On a focused room Enter and Space are its press. A key with Cmd, Ctrl or Alt is
    the browser's. A click on the ground focuses it, drawing no ring (the focus rule); Tab draws it.
  - Not in 4.3: a long-press drag (`Move…` stands in) and the minimap's open gesture.
  - Labels here are placeholder words, the owner's to replace.
- **Build: the Dialogue sheet** (slice 5.1a, [builder mode §4.6, §6.4](../rnd/in-game-builder-mode-2026-11-19.md)).
  A JSON dialogue's `def:<file>` sheet is [the generic sheet](#author-mode-dev-only) with its
  `choices` drawn by a block of its own; every write runs and refuses as the generic sheet's do.
  Looks: [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue).
  - **Gate.** Before a dialogue write is sent it is checked against the compiler's dialogue rules
    (the panel's gate): a write that would add a refusal is not sent, and its reason shows on the
    sheet's refusal line as any refused write's does. A write the rules cannot judge goes to the
    server, which validates it.
  - **Choices.** One folded block per choice, in the file's order, named by its key; last, a
    `Choice key` field and `Add choice`, which adds a least choice (its label and narration `~`)
    under the trimmed key and clears the field. An empty key adds nothing; a refused key (not
    lowercase letters, digits and `_`, or already present) shows why and keeps the typed key.
  - **A choice** opens to `Rename`, `Remove choice` and `Flow` (the walk centred on this dialogue, a
    choice being no node of its own; only once /story has named the dialogue's file), then its fields present, then `Add…` with
    the absent fields the compiler takes for it. A key is the choice's id, so `Rename` changes
    nothing and only shows why. `Remove choice` removes it, but not
    a dialogue's last choice nor its riddle's answer, which show why instead. A field the compiler asks at play (`sitting`, `exchange`) is revealed
    empty, never written, by its pick.
  - **Links.** `then`, and `then_failed` when the choice has a check (or already holds one), each a
    fold reading `<field>: <dialogue>` (or `none`). Open, it lists this cartridge's dialogues that
    may be linked, then `end`, the linked one picked, then `Clear` when one is linked. A pick the
    rules refuse shows why; `Clear` removes the field.
  - **Nested set.** Under a link to a nested set: `Open <key>`, which opens that file's sheet on top,
    then the set's prompt and each choice's label, read-only. A set inside an area bundle shows none.
  - **Add dialogue.** A person's sheet ends with `＋ Add dialogue`: it makes `dialogue_N` from the
    starter, spoken by that person (its `npc` and its `roles` name them, as the compiler requires),
    then opens its sheet on top.
  - Not in 5.1a: the conversation in Build (§4.6's icon row and in-place words), `.scene`
    dialogues and their line rows.
  - Labels here are placeholder words, the owner's to replace.
- **Build: the conversation** (slice 5.1b, [builder mode §4.6](../rnd/in-game-builder-mode-2026-11-19.md)).
  In Build, a waiting talk on the Book page gains three things; outside Build it draws as without
  them. Looks: [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue).
  - **Words.** The talk's prompt and each choice label edit in place, as a description does. A JSON
    label saves through its line (`/line`, then `/edit`); a `.scene` label through one `/restructure`
    reword of its `- ` line (decision 11: `/set` takes no label). A label whose key repeats in the
    scene, or whose source is gone, opens no field; a label changed on disk shows the
    changed-on-disk notice with their words, or `Open source` when the choice is gone.
  - **The icon row.** Under each choice label, inside its card, one row: `✎ words`, `◇ when`,
    `↦ does`, `→ goes`. An icon is lit when the choice has that field, dim when it does not; words
    is always lit. words turns the label into its field in place (the row goes while it is open).
    when, does and goes open the dialogue's sheet with that choice's fold open (every other choice
    folded) at the field, or at its `Add…` when absent; goes opens the `then` fold, which is always
    drawn (`then_failed` when only that is set). A `.scene` choice has words only.
  - **The card still plays.** A tap on the card plays the choice; the label takes no press of its
    own, and neither an icon nor the open field is the card's press.
  - **The header line.** Under the person's title, while their talk waits: `Offered when: <the
    policy in words, or always> · repeats` with `⚙→`, which opens the sheet at `policy`; then
    `＋ Add choice` (JSON: the sheet at `choices`; `.scene`: a least choice after the last top-level
    choice's block) and, for a `.scene`, `＋ Add line` (new words after the last line before the
    first choice). A refused add shows its reason.
  - **The reading page stays first.** Nothing here covers or reorders the conversation's lines:
    the header sits between the title and the first line, and the icon row inside its own card.
  - Not in 5.1b: an authored label key (not `choices.<key>.label`) gets no row; the sheet does not
    scroll to the choice; `repeats` is constant.
  - Labels here are placeholder words, the owner's to replace.
- **Build: scene rows** (slice 5.2, [builder mode §4.6, §5](../rnd/in-game-builder-mode-2026-11-19.md),
  [scene-structure rulings](../design/scene-structure-rulings.md)). On a `.scene`'s sheet, and on a
  scene definition's sheet for its `.cut` twin, each line of words is a row. Looks:
  [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue).
  - **Rows.** A row shows the line's words as written (case and quotes kept), indented by its
    depth. A tap, or Enter on the row, opens its acts beneath it; again closes them. On a scene's
    sheet a `page P` caption sits above each page's first row; the `---` end mark is bare.
  - **Acts.** A `.scene` line: `Add after line N` (opens the kinds that line may be followed by),
    `Move up line N`, `Move down line N`, `Remove line N`. A page's first line: `Add page after page
    P`, `Move up page P`, `Move down page P`, `Join page P`, `Remove page P`; each later line `Split
    page P at line N`. An act the shown bytes refuse is greyed with its reason and sends nothing.
    Each act is one `/restructure` and one Undo.
  - **Keys** (rulings §5). With focus on a row or its acts, never inside an input: Alt-ArrowUp and
    Alt-ArrowDown move the line (or page), Alt-Enter opens Add. After a move the row keeps focus
    and its acts stay open at its new place; an added row takes focus at its `~` field.
  - **A selected act.** Where acts are picks (a trigger's kind, value and outcome; an enum's
    values; a link's target; the Notebook tabs), the current one is drawn selected and announced as
    selected; the others stay acts.
  - **A modal scene's trigger.** `on` draws as picks: kind, value and, for a story point, outcome.
    A quest's outcome is typed and written on leaving the field; a refused one tells why. A switch
    writes the whole new `on`; `~ <quest>` names the quest it left. A scene that is not modal keeps
    `on` in the form; the treatment stays in the form.
  - **ScenePage.** In Build a `.cut` line is captioned `page P` and edits through the seam's field.
  - Not in 5.2: a current trigger value that is not offered is not drawn; a speaker line is always
    greyed; a new cutscene makes no `.cut` and the Notebook lists no scene files; only a page's first
    line edits in ScenePage; the scenes create row; Esc does not close the Add menu.
  - Labels here are placeholder words, the owner's to replace.
- **Build: the Rules block** (slice 5.3, [builder mode §4.6, §6.4](../rnd/in-game-builder-mode-2026-11-19.md)).
  A reaction's, action's or quest's `def:<file>` sheet is [the generic sheet](#author-mode-dev-only);
  its Policy, Steps, Trigger and Check fields are unions drawn as its Picks. Looks:
  [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue).
  - **Branch names.** Each branch is named by its tag (`op`, `event` or `kind`) or its definition's
    name; never `option N` where the branch has a tag of its own (a `wait` step reads `wait`).
  - **Later rules.** A `wait` step starts the steps that run later: above that step's whole item
    (its name and Remove included), a dashed rule and `later rules`; the steps below it are the
    later rule's. No other step draws it.
  - **Check and failure.** On a scripted action a check and its failure outcome come and go
    together: the write that adds `check` also writes the failure outcome (its words `~`), the one
    that removes `check` removes it; one `/change`, one Undo. An action whose `extends` parent may
    hold either is left as written.
  - **One definition's fields.** Once an action has `command` or `outcomes`, its `Add…` and `Add
    mechanic…` offer only that definition's fields; a new action, with neither, is offered both.
  - Not in 5.3: a dialogue's `policy` (its row stays todo); a failure outcome added or removed by
    hand against its check is rewritten silently to match, with no reason shown.
  - Labels here are placeholder words, the owner's to replace.
- **Build: the palette and keys** (slice 6.5b, [builder mode §5, ruling 7](../rnd/in-game-builder-mode-2026-11-19.md);
  the panel's Cmd-K palette, whose rows are `kernel/ts/play/palette.ts`'s). Looks:
  [author-mode marks](../BOOK-UI-COMPONENTS.md#component-catalogue).
  - **Opening.** While Build is on, Cmd-K (Ctrl-K) opens the palette as a sheet on top, titled
    `Commands`; its query field, not its title, takes the focus (the one exception to the header
    rule). With four sheets open it drops the lowest, never the sheet it was opened over. Esc,
    Back or a row closes it; focus then follows the stack rule (the sheet under it, else what had
    focus before the first sheet).
  - **Rows.** At most 50, ranked as the panel's: every command, the definitions (`<key> · <name> ·
    <kind>`), `/find`'s text keys (`<words> · <key>`, asked once per typing pause) and the lines
    still to write, read as Checks reads them (`<key>: unwritten · <file>`, never `~`, ruling 9);
    a query starting `~` narrows to those; then the Story's rows. A row runs as the Builder gesture it names: a command
    its act, a definition its sheet, a line its source, a
    beat the Story in Contents, a Story row its sheet. A command with nothing to act on is not
    listed: Delete only while the sheet the palette was opened over draws a deletable definition
    (never a root file), Undo and `Undo the last map edit` only while the strip's Undo shows. A room
    command with no room selected opens the Map to pick one.
  - **Keys in it.** Up and Down move the active row (the first when the list changes), shown with
    the selected act's fill and `aria-selected`; Enter runs it; Tab reaches each row as a button.
  - **Cmd-E** (Ctrl-E) opens the source of the top sheet's definition (POST `/open`); a sheet with
    no file does nothing. Cmd-K, Cmd-Z and Cmd-E are Build's only while Build is on; off, the Book's
    and the browser's.
  - Labels here are placeholder words, the owner's to replace.
- **No field.** A double-click on a line that is not words, or on words two keys draw alike
  (either key's field would write the other's line), opens nothing; a note under it, in a
  row of its own (the lines below move down by its height while it shows and back when it goes,
  with no motion; a note never covers a line, loka-wfrgk.39), until the next click or key, read politely: `A choice label is its key. Alt-click opens the scene.`,
  `The engine writes this line.`, else `Not a line of words. Alt-click opens its source.`
- Nothing here animates but a sheet coming in (above); the scroll to a landed line is instant under
  reduced motion.

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
They never fabricate an action result, pickup echo or journal narrated event.

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
or menu was open and when reopening a saved encounter. The page shows
committed combat narration, and renders only currently available Stand and directionless Flee actions as complete typed
invocations. The kernel still permits Look and Scan in a fight; the page offers neither (Look:
owner 2026-11-04; the [hotbar](#combat-hotbar) holds skills and spell words, not Look). The combat restriction is applied after all
ordinary contributions, so no blocked action or alias is exposed by a hidden ordinary page.
Attack initiates combat from the NPC page; it is not usable again during an open encounter
and is not shown on the combat page.
Flee lets the engine choose a random currently legal exit; success shows the actual resulting
room. Stand, Flee, a bandage and each foe's pick lists appear as a vertical dialogue-style list below the log inside
the same ScrollView; the player's skills and untargeted spell words are the page's one fixed strip, the
[Combat hotbar](#combat-hotbar) (owner 2026-11-05). No unavailable or future skill actions are invented. World time continues
while the combat page is open.

**Rounds.** The page follows its newest line as other growing pages do (Page: it follows the end
while the reader is there; a reader scrolled up to an earlier round stays put until they press), so a round's lines
land in view above the action cards. Each round's lines (one committed receipt: an elapsed round,
or one press's receipt) are one block at the log's line pitch with no gap between lines, and rounds stand apart by one
blank line (one log line height; owner 2026-11-04), as the prompt line parts rounds in a MUD log; no rule glyph, heading
or words mark a round.

Combat takes precedence over ordinary navigation until the encounter closes. **Opening.** The
receipt that opens an encounter (a move's or Sleep's `engage`, Attack, a cast's fight-back)
draws all of its narration in the combat log (and the World log), so the page opens with the engage line as its
first log line, which names the foe ("You attack a boar!" / "A boar attacks you!", loka-kgd.202). The
page title names who opened the fight, in the cartridge's words (`combat.title_you_attack` {target},
`combat.title_attacks_you` {attacker}, each bound to the foe's short name as the engage line binds it; owner 2026-11-02, loka-kgd.204 notes: "title like 'You attack
a boar!' / 'A boar attacks you!'"; loka-kgd.207). It is kept for the encounter, its closed page too, and
reads **Combat** when the opener is unknown (an old save, a fallen pack opener after a reload, a
cartridge without the keys or the foe's name words). Nothing else names the foe above the log: no foe
name, band phrase or target line (owner 2026-11-02, loka-kgd.204); the log opens the page, and each live foe's **Cast a spell on** list ("Cast a spell on the goblin…") comes last among the cards. Your own bleeding and condition lines draw nowhere on the Combat page: they stay
on the status icon row and Character, so a reader never takes your wound for the raider's
(pass-1 C2b, as loka-x6t.15). **Closure.** On
every committed closure (opponent death, player death and inn return, successful Flee, any
other end) the Combat page stays the shown page, as a one-reply conversation does: its log ending with the closing
lines (every line of the closing receipt, whatever its key), no action cards, and one foot Control
[**Back to World**](../BOOK-UI-COMPONENTS.md#component-catalogue), or **Let go** when the
receipt says the player died ([Falling](#effects-sound-and-haptics); owner-approved label 2026-11-02). The status line and its icons are hidden while Let go shows (owner 2026-11-04); after a fight you survived it stays locked as during the fight. The tap is local (no engine verb)
and shows the World page of the room the player is now in (the return room after death, in the
[spirit state](#effects-sound-and-haptics) when the view carries `revival`; the room fled to) through the existing room-change flow. Time runs meanwhile; later ambient and room lines go to
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
return reads there, once). This replaced the earlier
persistent action strip ([owner combat-page decision](../decisions/owner-decision-m6-a-combat-pane-2026-10-04.md));
the [Combat hotbar](#combat-hotbar) (owner 2026-11-05) brings back a strip for skills and spell words only, and the
cards stay in the scroll.

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

GameView `conditions` lists every active [status](mechanics.md#status-effects-over-time-toolbox-row-1) on the body with its authored label, end, next tick and per-tick change; `bleeding` keeps its own field and lines. A condition label is authored lowercase, like a position word (`poisoned`, `blessed`); an icon's tooltip and name show it as authored and the Character page capitalises it as it does the position. A condition's line is the label, the time remaining and the signed per-tick amount with its pool key, joined by " · " ("poisoned · 4m remaining · -1 HP each 60s"); a permanent condition has no time part, one without a tick no amount, and the sign is always in the text. A duration or cadence under two minutes shows in seconds ("40s"), under two hours in whole minutes ("60m"), otherwise in whole hours ("12h", "24h"; never "1440m"; pass-1 UN). The bleeding line uses the same durations ("bleeding · 6m remaining · 1 HP each 60s"). The Character page lists each line, its label capitalised, after the bleeding line; the Combat page draws none of them ([combat rule](#live-combat-response-m6-a)). The status icon row shows one round icon per condition and one for bleeding, buffs and debuffs told apart by their look; a tap opens Character; the Character page keeps the full list. Bleeding is an icon, never text on the status line, with the debuff look; its tip is the label and time ("bleeding, 37s remaining"), its name the bleeding line's parts joined by ", " then the polarity and action ("bleeding, 37s remaining, 1 HP each 60s, debuff, opens Character"), and it has no ring until `bleeding` carries a duration (never back-computed). Up to six icons show; seven or more show five and a +N disc, on every width. The row sits below the status line and its experience rule, centred, and takes no height while no icon shows; bleeding first, then debuffs, neutral and buffs, each group in condition order, so the threats stay in view ([rulings](../design/status-line-rulings.md)); a hold (a hover or keyboard focus on web) shows the label and time joined by ", " ("fed, 48m remaining"), and an icon's name adds the polarity and the action ("fed, 48m remaining, buff, opens Character"; no polarity for a neutral condition; the disc's hold shows the hidden labels in row order and its name lists them, "+2 more, fed, refreshed, opens Character"). The row adds no announcement: a new condition is read once by its log narration. An arrival behind the disc gets no pop, an icon revealed from behind it appears without the pop, and an icon pushed behind it leaves without the expiry fade, which marks an ending only. While the status line is locked the icons are named pictures, not buttons, dim like the Contents button (the neutral look). A timed icon wears a countdown ring round its disc: a track and an arc for the share of its duration still to run ([look](../../mobile/app/book/StatusIcon.tsx)), clockwise from 12 o'clock, recomputed from projected time; between updates the arc drains linearly to its new share over the real time since the last update, at most 1 s (display only; presentation keeps no gameplay clock), and jumps without motion on first show and on a refresh; under reduced motion it steps; while locked the ring dims with its icon ([look](../../mobile/app/book/StatusIcon.tsx)) and still drains; at its end only the track shows, and a permanent condition has no ring. Each icon is a drawing of what the status is, keyed by its label, to the frame in StatusIcons' doc comment ([look](../../mobile/app/book/StatusIcon.tsx)); a label with no drawing shows its polarity's fallback ([rulings](../design/status-line-rulings.md#below-the-line-smaller-drawn-loka-x6t134)). The presenter reads projected state and never computes or writes an effect, tick or cure; applied, tick and expired lines come from their receipts' narration and appear once. No new control: a cure is the ordinary Eat of a held item whose `cures` lists the condition.

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

The level-up rush is ruled in [level-rush-rulings](../design/level-rush-rulings.md).

GameView `levelling` carries `{level, experience, from, next, unspent, level_up}` from [experience and levelling](mechanics.md#experience-and-levelling-toolbox-row-4) (`from` the threshold of the current level, `next` absent at the top level; the `gained` line is a Log line like the level-up line), and `attributes` values already include allocated points, so a spent point reads as the attribute itself ("STR 11"), with no separate line. Everything shows on the Character page, except the experience rule: a thin rule under the status row, no number and not read aloud (owner, 2026-10-31). It fills on a gain and falls with no flash on a loss. A level, one or more, runs it to full, holds it gilt, then returns it to the new fraction. Reduced motion cuts its width. A launch's first draw does not animate; returning from a page without the status line runs it from the value last drawn. After the ancestry line: "Level 2", or with unspent points "Level 2, 1 point to spend", "Level 2, 2 points to spend" (plural by count). Last line of the resource block, plain like pennies with no band: "xp  30 / 50" (the next threshold), "xp  120" at the top level. Last block before the foot: one Action card per authored attribute, "Raise STR", "Raise CON" and so on, each sending the one offered `raise_attribute` action with that attribute as its input; the cards show only while the action is offered (a point to spend) and go with the last point, never a disabled card. A Raise follows ordinary freshness, pending-save fencing and receipt replay; a pending save shows as the foot's **save not confirmed** line, so the page adds no note of its own. A level-up is the receipt's authored line once in the log, before a `level_reached` reaction's own line, else at the end of that step's lines, with no banner; the level line, xp line, attribute values and derived lines change together when the receipt is confirmed. The presenter never counts experience, levels or points.

## Lore details

The Journal page says "Nothing written yet." only when it has no quests, no known topics and no [Chronicle](#chronicle-details) day; after its quests, it shows **Lore** (a section title) when GameView `topics` is non-empty: each known topic's authored label, one per line, in projected order, then for each GameView `deduction` its topics' labels joined by " + " and its card. The card is the deduction's offered action when the current place offers it; when the place lists it unavailable, the [unavailable card](#unavailable-actions) with the action's own reason; otherwise the unavailable card with the reason "You can't do that here." Pressing the card performs the scripted action as any place action; the topic it grants then joins the list and the deduction disappears. Badges are topics and are listed with them. Nothing shows when no topic is known. ([Lore codex](mechanics.md#lore-codex-and-deduction-toolbox-row-46); wording proposed, designer to approve: Beads `loka-x6t.14`.)

## Chronicle details

The Journal's last section, **Chronicle**, shown when at least one entry exists ([Chronicle](mechanics.md#chronicle-toolbox-row-fd6)): one block per day in ascending order, headed "Day N" as the Away recap's Tap heading (name adds ", show" or ", hide"); the latest day open, earlier days collapsed; open, each distinct line once in first-seen order with " (N times)" after a repeated line (the recap's grouping), ordinary lines in the ordinary log look, a milestone's line in the page's prose look, one step larger, its accessible name the line followed by ", story point" (a line is a milestone when any of its occurrences that day is one). Lines are the receipts' narration less the engine's routine lines (the keys of
`mobile/packages/game-view/line_words.ts`) and a talk's opening prompt (`dialogue.<npc>.prompt`,
which the conversation page and the room log show; the Chronicle stays as before the narration
batch); the Book adds no words but the heading, the count and the accessible name. Opening the Journal reads the receipts once; the page is not live-updated while open (a press returns to World anyway). A Chronicle day counts as written for "Nothing written yet." ([Lore details](#lore-details)).

## Verbs the Book does not draw

The GameView may offer these; the Book draws no control for them, on any page:

- Say and Shout in single-player ([Word bar](#word-bar); owner, loka-evzt 2026-10-30).
- Close and Lock on doors in single-player (owner 2026-10-30, option C, paraphrased: doors you
  open stay open; Lock will matter later for property in the paid books, perhaps as a
  press-and-hold on the joystick, not built). Open and Unlock stay on the
  [joystick](#minimap-map-and-presentation-controls).
- Where (PM 2026-10-30): the Map rings the current room and a tapped dot names its room.

Any other World-level action (a door verb or an action with no target) with no control fails the
Book harness's stranded-verb check, which lists this section (`UNDRAWN_VERBS`).

## Combat hotbar

The Combat page's one fixed strip (owner 2026-11-05, paraphrased: Inked style, fixed at the page's bottom,
four slots, author order for v1, the list from the last slot, no captions). Its look is the
[Inked icon style guide](../design/icon-style-guide.md); this section is what it holds and does.

**Why a strip here and cards everywhere else.** The [combat-page decision](../decisions/owner-decision-m6-a-combat-pane-2026-10-04.md)
put every action in the scroll because a card carries a target and a reason sentence and belongs beside the line
it answers. A skill or an untargeted spell word has neither: it is the same press every round, and the player's hand
rests on it while the log grows. So the hotbar is fixed under the scroll on the Combat page only; Stand, Flee, a
bandage and each foe's **Cast a spell on…** list stay cards in the scroll ([Live combat response](#live-combat-response-m6-a)),
and no other page gets a strip. The scroll ends above the strip, so its last card and the newest line are never
under it.

**Slots.** Four, left to right, in the GameView's order (the cartridge's authoring order; configurable later,
loka-x6t.111). They fill from the player's offered untargeted scripted actions (the GameView `actions` with no
target that are not the page's own verbs: stand, flee, bandage, cast, look, scan, move), then the untargeted
learned words of `spell_words`, available or [unavailable](#unavailable-actions) alike (a barred skill keeps its
place; a vanished one gives it up). The first three take the first three slots; the fourth is the opener. A slot
with nothing to hold shows the style guide's empty form: not focusable, no name, so the row keeps its positions.
No skill and no word: no strip (the page is as before the hotbar). An aimed spell (cartridge `aimed`) is never a
slot: it stays in its target's **Cast a spell on…** list ([Word bar](#word-bar)).

**The opener.** The fourth slot opens the skill and spell list (loka-x6t.110) over the cards as a
[PickList](../BOOK-UI-COMPONENTS.md): every untargeted skill and spell word, slots included, each in its ActionCard
form (available, or unavailable with its reason sentence), in the same order. It shares the page's one-open-list
state, so opening it closes a foe's list and the reverse; it opens at the scroll's end and the page follows it.
The opener is never barred or cooling; with nothing beyond the three slots it still opens (the list is the
long form of the strip, with the words the strip omits). Escape or a second press closes it.

**A press.** Ready: sends the slot's invocation as its card would (the scripted action; or the GameView's
wordless twin of Cast with that word); the receipt's lines land in the log and the page keeps the strip. Barred:
exposed disabled, still focusable and pressable; the press sends nothing and shows the slot's `reasonSentence`
once, as an unavailable card does. Cooling: barred until the cooldown ends; the engine refuses an early press
(action `cooldown`), and the Book never lets one through to be refused.

**Cooldown timing.** The wedge shows the share of the cooldown already elapsed and reaches full ink at the end;
the presenter keeps no clock and projects from the confirmed view's `time`, as the condition ring does
(ConditionView `ends_at`, `duration`). The GameView gives the same pair on the slot's entry: an AdvertisedAction or
SpellWord refused `cooldown` carries `ends_at` and `duration` (kernel_api 1.159, [protocol](protocol.md#gameview);
the pair is together or absent, and absent when the end would overflow), and CombatView carries the round
`interval`. The wedge's share is `(time - (ends_at - duration)) / duration`, clamped to 0..1. A cooling entry with
no pair (the overflow case) shows the barred form with its reason word. The Book never estimates a cooldown from
the cartridge or from the last press.

**Rounds left (designer, 2026-11-05, loka-x6t.138).** No visible count anywhere: not in the glyph frame (no digit,
[icon style guide](../design/icon-style-guide.md#grid)), no caption or badge under the slot (owner 2026-11-05: no
captions), no count on the opener's list rows. The wedge is the slot's only visible clock, read as the condition
ring is: a share, not a number. The count exists only as the cooling slot's
`accessibilityValue`: `min` 0, `max` `ceil(duration / interval)`, `now` `ceil((ends_at - time) / interval)`, so a
screen reader says the slot's name, its reason word and "n of m". A ready slot, a barred slot and a cooling entry
with no pair carry no value.

**Keyboard and screen reader.** The strip is one group named by its label key (a `LABEL` key, proposed:
`LABEL.hotbar`), after the scroll's last card in the Tab order; slots left to right; empty slots skipped; Enter or
Space presses; the opener's list takes Tab, Shift-Tab, Enter, Space and Escape as a PickList does. Each slot is a
button named by its action's text (the key's words, no caption); a barred or cooling slot adds its reason word
to the name and exposes disabled, as [unavailable actions](#unavailable-actions) do. A cooldown ending is silent (no
announcement; the ink is back); a refused press reads its reason sentence once in the polite region, as cards do.

**Word bar and chips.** No chip row in the game-world pane (owner 2026-10-23); the hotbar is the only in-fight
place a spell word is cast from, and the Skills page's **Spells** section ([Word bar](#word-bar)) is unchanged
outside a fight. Spell words cast from the hotbar follow the Word bar's send rule; their lines land in the Combat log.
loka-x6t.69's engaged-state chips are superseded by the hotbar.

## Word bar

The World page has no Word block (owner, mvl9qy5ut2x2). Saying is never a chip row (owner,
wordbar1 2026-10-23). Single-player draws no say icon and no word field, on any page, even
while the GameView offers `say` or `shout` (owner, loka-evzt 2026-10-30, paraphrased: no
conversation icon until the online Realm). Whisper is hidden on every page until loka-x6t.115
(owner pick mvlrlvappy4w, 2026-10-23).

A spell word is cast from the Skills page. While `cast` is offered, its **Spells** section
(under that section title) lists each learned untargeted spell word of the GameView's
`spell_words` as an [ActionCard](../BOOK-UI-COMPONENTS.md) `word, cast` (`lux, cast`), the
castable ones first, then each refused one in its [unavailable](#unavailable-actions) form; an
unlearned word is never listed; no word, no Spells section. A press sends the GameView's wordless
twin of Cast with that word; an accepted cast turns to World, where its line lands
([Line placement](#line-placement)), as an aimed pick does; a refused press stays on Skills.
An aimed spell (cartridge `aimed`, loka-x6t.109) is never a Spells line: the GameView offers it
on each admitted target's entry (`command: cast`, `target_ids: [target]`) and the Book lists it in
that page's **Cast a spell…** pick list ([World](#world-and-status-entry), owner 2026-10-23).
In a fight the same untargeted words also fill the [Combat hotbar](#combat-hotbar)'s slots and its
opener's list, with the same send; the Skills page's section is unchanged.

The one-word field ([SayField](../../mobile/app/book/SayField.tsx)) is kept, with no opener, for
the Realm's room speech; its rules (sends, the bad-word Note, chips that only fill, closing) are
its doc comment's. Each send is the GameView's wordless twin of its action; a sent word that opens
a conversation turns to it.

An accepted `say`, `whisper` or `shout` whose receipt
carries no narration gets one log line from `words.ts`, the Book's own echo of what was sent:
**You say, "Ware."**, **You whisper to the jailer, "Ware."**, **You shout, "Ware!"** (pass-1 R5; prose form, [Line placement](#line-placement));
a receipt with narration draws that instead. Beyond this echo the Book never writes the typed
word anywhere; only its writer sees it.

## Skill tree details

On the Skills page, skills without a profession draw one line each: the label, then " — learned" with no requirement, or while its projected `qualified` is false " — learned, unqualified. <requirement>" (pass-1 H3). After them, each profession in first-listed order is a SectionTitle, then its listed boxes in GameView order: acquired as body text "Whittling, level 2 — learned" (", level N" only when projected; no requirement: a qualified learned box has nothing left to meet) or, while its projected `qualified` is false, "Whittling, level 2 — learned, unqualified. <requirement>" (pass-1 H3); an NPC's teach card for a learned skill is the GameView's unavailable action and draws as an [unavailable card](#unavailable-actions), never dropped (pass-1 R2); locked as a Note "Carving — locked. <requirement>"; any other unacquired box as a Note "Joinery — not learned. <requirement>" (the same Note). The Book draws only listed skills: a hidden box and an empty profession draw nothing. After the professions comes the [Spells](#word-bar) section, when the Word bar draws one. With no skill, profession or Spells section the page draws one Note, the same line Character draws when nothing is known. It opens from Contents, returns as Journal does and draws no status line; the status icon still opens Character.

A row with a projected `rank` reads "<label> — <rank label>" in place of ", level N". One skill says one line per reply. Taught: its `learned`, else its rank's `reached`, else "You learn X." A rise on a taught skill: its rank's `reached`, else "Your X improves." A rise on an untaught skill: its rank's `reached`, else nothing. A skill first shown untaught says nothing. The sound follows the line.

An NPC's lesson line names the teacher while the skill is open to learn: "Aldous teaches Blade." while its projected `qualified` is true, else "Aldous teaches Blade. <requirement>". A locked skill reads "You cannot learn Blade yet. <requirement>"; a learned one "You know Blade." with no requirement (nothing is left to meet, pass-2), or while unqualified "You know Blade but cannot use it yet. <requirement>"; the reply that taught it adds the narrated event "You learn Blade." in place (loka-x6t.24; second-person prose, never a colon label, loka-lsqi).
