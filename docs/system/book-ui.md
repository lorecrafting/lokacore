# Book UI

Canonical presentation behavior for rebuilding the phone book. The host boundary lives in
[architecture](architecture.md#book-presenter); action admission, freshness and state come
from [GameView](protocol.md#gameview). This specification changes presentation, not rules,
authority, content, receipts or save formats.
The [Book component guide](../BOOK-UI-COMPONENTS.md) maps these rules to the current
shared client; the [delivery workflow](../WORKFLOW.md#book-interaction-delivery) requires
interaction-rule updates in the mechanic slice that needs them.

Governing direction: [C1 touch](../decisions/owner-decision-touch-resumption-2026-10-03.md),
[room/details polish](../decisions/owner-decision-c1-playtest-polish-2026-10-03.md),
[dialogue, Contents and pickup polish](../decisions/owner-decision-c1-dialogue-contents-polish-2026-10-03.md),
[journal, Leave, position and detail-flow polish](../decisions/owner-decision-c1-journal-position-polish-2026-10-03.md),
and [detail-page order](../decisions/owner-decision-detail-page-order-2026-10-05.md).
Original feedback lives in those records; independent reviews and retained interaction proof
are indexed in [reviews](../reviews/README.md). Touch acceptance follows
[C1 slice 12](../decisions/owner-decision-chapter-one-plan-2026-10-02.md#12-c1-touch-the-phone-draws-the-new-gameview).
The owner-directed C1 human acceptance and deferred UI validation are recorded once in
[the gate UI-deferral record](../decisions/owner-decision-c1-gate-ui-deferral-2026-10-03.md);
its carries are scheduled in [ROADMAP](../ROADMAP.md#c1-carry-checkpoints).

## World and status entry

World is one current-room page. Its centered title remains fixed above the scrolling authored
description, projected entities, offered place actions and event log. Tapping that title invokes
the current offered Look under the [live action freshness rule](#live-action-freshness); it invents no refresh command. The [current sampler](cartridge.md)
projects authentic Look under the
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

A projected Read place action keeps its exact detail target and authored label and follows
the canonical [notice-detail rules](#notice-board-details).

The enabled status/resources tap opens Contents. It lists exactly **Character**, **Equipment &
Inventory**, **Map**, **Journal**, **Settings**. There is no Menu button or extra World navigation
row. Character shows existing projected resources and position, without unrelated index links.
Equipment & Inventory separates held items from worn slots; Journal uses projected quest text;
Settings retains Start over and its confirmation/error handling. Section returns say
**Back to World**, clear the detail stack to World, and do not pop to Character or Contents.

Resource-band phrases come from cartridge text (`band.<key>`); projected tones map to the paper
palette without presenter thresholds. Status shows the hp band phrase only on hp and colors every
projected resource. With a cartridge calendar, status shows the confirmed day and displayed time,
plus structured solar and lunar phase labels when authored. It updates from confirmed GameView
time after actions, elapsed delivery and reopen, without settling elapsed on render. Historical
cartridges without an expanded calendar retain the earthly branch under the
[untimed Lantern decision](../decisions/owner-decision-untimed-lantern-2026-10-02.md).

Only World's current-position label is a distinct position tap target. Each tap directly invokes
the next currently offered legal action in standing → sitting → resting → sleeping → standing
order, skipping unavailable/absent actions. If none is offered, position stays informational.
The button follows [live action freshness](#live-action-freshness); pending/refused/stale results never advance the
shown position optimistically. This opens no detail page or Contents and does not turn the
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

For the planned A3 finale, Continue carries the scene identity and line shown when
drawn. A changed line or scene remains stale even if the presenter obtains a fresh
invocation id; the Book redraws the actual saved line. An exact accepted retry retains
its receipt and presentation context. The Green's Begin epilogue appears as one
ordinary action only when eligible; rendering, arrival and reopening do not press it.

A pending retry keeps its original invocation, token, receipt and presentation context; this
rule never refreshes an already-sent invocation or weakens authority freshness/admission.

## Minimap, Map and presentation controls

The World endpaper minimap sits between hairlines: a center dot, existing compass paths/rings,
barred-exit ticks and offered up/down stair nodes. Holding enlarges it; dragging highlights an
existing direction and releasing attempts that exit. Returning to center cancels; a short tap
opens Map; a terminated gesture walks nowhere. Release keeps the action/context captured at
drag start and follows [live action freshness](#live-action-freshness), never a new target after redraw. An unavailable exit announces its projected reason
and logs the refusal without movement. Direction/reason appears opposite the finger. The existing
tip explains hold/drag/tap; Got it, a map tap or walking dismisses it, persisted separately with
memory fallback. The accessible Map activation opens the section; Go-direction actions use the
same offered exits. Gesture/drawing details remain in
[joystick](../../mobile/app/book/joystick.ts) and [footer](../../mobile/app/book/Footer.tsx).

Map is a scrolling current-room projection, distinct from the enlarged joystick. It shows
exits and unavailable reasons, adjacent authored sight/entity names, door names/states and
currently offered door/place actions. It invents no discovered multiroom coordinate map.

In the web Book, unmodified Arrow Up/Down/Left/Right walk north/south/west/east and
Page Up/Page Down use offered up/down exits. Keyboard movement uses the same captured
exit, refusal and freshness path as the footer. A missing exit does nothing. Keys act only
on World when no scene, combat, pending save, catch-up or fault owns the flow. Editable
controls and dialogs keep their keys; handled movement keys do not scroll the page.

Full detail openings turn the arriving page forward; local World return turns backward. Ordinary
NPC results and direct position changes are stable-route exceptions below. The existing paper palette, bundled IM Fell
English/EB Garamond fonts, explicit button labels/roles, section headings and minimum 44px button
height remain. World minimap and status stay outside the body scroll, respecting the safe area.
Implementation details live in [book](../../mobile/app/book/Book.tsx),
[pages](../../mobile/app/book/pages.tsx) and [paper](../../mobile/app/book/paper.ts).

## Detail-page order

Detail pages show title/identity, authored description and projected item state, then their
chronological event log only when entries exist, then currently offered options in the same
scrolling content. An empty log has no heading or placeholder. NPC, item, notice, board and
combat details follow this order; World retains its [room-page order](#world-and-status-entry).

## Notice-board details

Every readable notice opens its own detail page. A standalone notice, including Ferry Landing’s
Landing notice, opens directly from World and invokes its captured Read offer. Its Leave
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
options. Entry shows the message immediately when Read confirms; no second Read option is
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
follow nonempty history and precede Leave; unavailable controls show their real reason.
Opening the detail always invokes Read, never Study. Detail membership stays UI-only: a
no-target recipe sends `target_ids: []`. These controls use the shared offer-to-button builder,
freshness and retry path. Confirmed readable-recipe narration routes to the receipt-linked
detail, including replay after leaving its room, without World fallback. Recovery restores the
latest such narration once to its original history and opens a route only when that detail is
currently projected. A newer unrelated narration receipt cannot provide detail identity.

## NPC dialogue and action details

Tapping an NPC opens full details using its actual projected name, authored description and
actions. Description comes first. Talk/Leave/other offered actions follow it initially; as
dialogue grows, the offered controls sit immediately after the latest chronological dialogue/
event entry **inside** the scrolling content. This supersedes the viewport-bottom dock. The
ordinary long log remains scrollable, and newly appended results keep current options reachable.
Same-room NPC actions retain the route, mounted scroll area and animation token; they do not
flip the book or reset scrolling for each result. There is no overlay or saved transcript.

After a confirmed accepted NPC action changes the actual projected journal, append the neutral
italic **Journal updated** event within that NPC's chronological history, visually distinct from
authored dialogue. Preserve meaningful authored narration. Pending/refused/stale/fault results
add no false event; rerenders and receipt retry do not duplicate it. This is local presenter
metadata, not story prose, a new game event or transcript persistence.

There is one **Leave** control and no separate Close. When a matching `close_choice` is actually
offered, Leave invokes it under [live action freshness](#live-action-freshness) and returns to World only after confirmation.
An unconfirmed/refused/faulted close retains the detail and honest save/error UI; a retry keeps
its original context. Without a matching closable choice, Leave is local World navigation and
preserves any unmatched saved choice. Routine `choice_closed` fallback narration is suppressed
structurally; meaningful authored/quest consequences and genuine errors remain. Sections retain
Back to World. Item Leave remains local navigation.

An absent pending speaker uses its actual continuation without invented NPC data. Live results
stay in their original detail even when retried elsewhere. Available choices/actions use the
freshness token captured when drawn; scenes and queued chapters retain precedence.

Descriptions use the explicit optional EntityView/ContentView `description` TextKey under the
[projection amendment](../decisions/pm-decision-description-projection-2026-10-03.md). Current
NPC/item room, held, worn and reachable-content projections supply their authored binding;
resolve that key using the existing cartridge text boundary. Older snapshots without the field
and absent speakers get no invented body, inferred name suffix or substituted room-line text.
Player descriptions are required when real player entities/descriptions are projected; there is
currently no player-presence UI.

## Item details and Take/Drop

Equipment & Inventory separates Held from Worn slots, including empty slots. Held/worn item
taps resolve the same detail; item pages follow [detail-page order](#detail-page-order), with directly nested
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

An item action advertised unavailable with `too_heavy` appears as a non-action note using its
actual catalog label and **too heavy to carry**. It invokes nothing; available actions retain their
existing buttons. The note follows the latest GameView, including Take aliases and Contents,
and disappears when shedding held load makes Take legal.


Successful Take/Drop are the specific exceptions to item-page retention. Other same-room item actions
retain the page and route their results to that item's local chronological history while the
item remains projected; leaving the room or losing the item closes
obsolete details. Equipment & Inventory item taps keep existing reachable held/worn behavior.

Put appears as a concrete pair button using projected source/destination names and IDs.
Each button captures its projection freshness and follows the normal GameSession invocation
and confirmed receipt routing. There is no separate storage session or recipient selector.

Quest completion updates its journal and confirmed narration. A terminal side quest
never implies that the whole story has ended. World shows no whole-story completion
hint until an explicit main-story terminal signal has an authored consumer (M20-A/finale);
storage, travel and other quest actions remain available under their normal rules.

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

## Text clarity

Scrolling content must remain readable with the existing authored text, fonts and fixed title.
Source/screenshot diagnosis found body blur at fresh revision 0 before Take; the owner's timing
remains a report, not proof that pickup caused it. Opaque scrolling surfaces and removing a
settled page's persistent 3D transform are supported UI candidates. Actual cause and resolution
need later native before/after proof; no unsupported prop, native plugin or dependency patch.

## Future boundaries

Other-player presence requires a real projection and UI scope; no fabricated player rows.
Attack/skill controls wait until GameView offers them; there are no placeholders or invented
character data. Reading-time safety and interruption integration remains
future work under the [reading-time decision](../decisions/owner-decision-reading-time-2026-10-03.md).
Give needs both item and recipient targets. The current touch item-action projection supplies
only its item target, so it must not offer or dispatch that incomplete Give. Complete offered
Give invocations remain valid; engine mechanics are unchanged. Touch recipient selection is an
explicit carry: implement it when a touch flow can supply a recipient from actual projected
valid targets, with its own approved scope. The inspected unsupported-capability rejection was
one incomplete Give; later moves were accepted. Preserve genuine errors and meaningful history
rather than hiding errors or clearing same-room history. Carries remain in the [roadmap](../ROADMAP.md). Further cosmetic polish is deferred under the [C1 UI-deferral record](../decisions/owner-decision-c1-gate-ui-deferral-2026-10-03.md).

## Combat interaction

The installed first-fight interaction follows [Live combat response](#live-combat-response-m6-a).
Functional combat pages remain separate from deferred cosmetic polish.

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
the route as Conversation with speaker-keyed history and the real targetless Leave; unrelated
vanished things and player movement keep ordinary route removal. No NPC is invented.

The existing save-not-confirmed status reflects unknown save state, independently of a retained
clock attempt. A separate catching-up note describes time settlement. Errors keep the confirmed
view and existing recovery affordance. The Book reports confirmed recovery to the App through
its Shell callback; [App lifecycle](architecture.md#elapsed-session-driver) owns wakeups.

The session snapshots only validated bounded invocation data, including target_ids and input,
so caller mutation cannot change the retained attempt or its completion context. During
catching_up, a different identified intent returns conflict while the original attempt and
status remain retained; a matching retry uses its original identity/context. Pending unknown
save retries keep the existing original-attempt behavior for any subsequent press.

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

Combat takes precedence over ordinary navigation until the encounter closes. Committed
closure or opponent death returns to the World; successful Flee and player death show the
resulting room through the existing room-change flow. A pending save keeps the confirmed
encounter and existing retry behavior; a refusal remains visible on the combat page. The UI
never presents an unconfirmed hit, death, escape or encounter end as committed. Results
narrate once through the existing subscription and cartridge text. Combat narration belongs
only to the combat page and its retained history, never the World room event log, including
closure, death, Flee and reopening a save after any of them. Routing uses structured committed
receipt metadata, never rendered prose; ordinary room events remain in the World log even
when delivered in the same receipt as combat. This replaces the earlier
persistent bottom strip; see the [owner combat-page decision](../decisions/owner-decision-m6-a-combat-pane-2026-10-04.md).

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


## Message return details

Confirmed Vesper and Elspeth return lines appear once in their original NPC detail
history, after description and before options, including cold reopen. Pending, refused
and stale replies never print success. Existing live freshness preserves an unchanged
choice across elapsed-only redraws; changed custody, continuation, room or speaker
refuses stale and redraws truthfully. The journal and Green description use committed
quest/status truth, without a new UI mode.


## Escort details

Wren's escort and Rejoin choices and Elspeth's rescued turn-in use ordinary NPC details,
current shared availability and freshness. Confirmed lines appear once under their own
original speaker after description and before options, including receipt recovery on reopen.
Pending/refused/stale replies never narrate success. Journal and Green/Elspeth variants read
committed following/separated/rescued/stays state; there is no new UI mode.

## Selected S2 Book behavior (pending implementation)

Peg's offered choice says the actual on-time deadline before or at 151200, says
late-only afterward through 237600, and explains an elapsed unaccepted offer at
237601 or later. Aldric's public S2 delivery appears only when the exact bound
ledger is directly held and the actor-owned S2 is eligible. The journal and NPC
history use confirmed quest, fact and receipt truth for on-time, late or expired
outcomes; a stale displayed choice can refuse safely after due work, without a
false success entry. Neither the page nor reading suspends the clock or demands a
Wait. See the [selected S2 mechanic](mechanics.md#s2-chandlers-debt-selected-contract-pending-implementation).
These controls await B2 implementation.

## B3 shop detail

Peg's NPC detail presents the current [authored shelf](cartridge.md#pegs-b3-shelf)
with exact prices and Buy/Sell controls only for eligible item identities. Sold-out,
unaffordable and too-heavy offers state their current reason; no control promises
an unavailable exchange. The ordinary live-action freshness token and command
admission recheck the same offer when tapped. Only a confirmed receipt adds purchase
or sale narration to Peg's history and refreshes pennies, custody and inventory.
Stale/refused/fenced results never claim success. Leave retains the existing NPC
detail behavior and the world clock continues while the page is open.

## C1 teaching and defense details

**API1.18 interaction contract.** Tobin's NPC page offers the current bound
lesson, its authored price and immediate result under ordinary Talk/Choose/Leave,
with no new trainer screen or idle-wait control. The swords lesson comes first and
the next conversation offers dodge. Already acquired teaching is unavailable and
cannot suggest a replacement gift. Learning and qualification are described
separately: the Character page lists each declared acquired skill and its current
qualified/unqualified status plus the authored requirement. Unlearned status does
not imply a combat benefit. Current chapter STR/DEX are shown from GameView. The
Character page reads `attributes` and `skills` from confirmed GameView data, filters
skills by `acquired`, and shows each authored label, requirement and current qualification.
Known attributes or acquired skills suppress the empty Character placeholder.

The gifted sword and actual Peg equipment use ordinary item detail, Wear and Remove.
Show their authored slot/profile or block chance, plus the skill requirement where
needed; carrying a sword is visibly distinct from wielding it. Read numbers and labels
from the projected cartridge data, never renderer literals or inferred item names.
No active Dodge button, skill percentage bar, proficiency rank or future skill appears.
A held sword offers Wear; its worn item offers Remove. Its detail describes the declared
wield slot, attack chance/damage and projected skill label/requirement. Shield detail
shows the off-hand slot and authored block chance. These descriptions do not grant use.

The existing combat page narrates committed dodge/block prevention once using the
structured attack-result supplement and authored text; an accuracy miss has its own
ordinary narration. Pending, stale, refused and faulted actions never claim paid
training, acquisition, gift or defended damage. Reopen/retry retain confirmed lesson
history in Tobin detail and combat history in combat detail through the existing
receipt routing; ordinary World events remain separate. Shared action freshness and
combat/scene precedence continue to govern all offers and raw invocation admission.
The ordinary NPC controls open swords first, then dodge after the committed swords
lesson. After both grants there is no lesson control. The focused Book scenario clicks
these actual controls and cold reopens after each lesson, recovering the returned
committed line once under Tobin; it also checks Character and equipment detail data.
This headless component/authority proof supplies no browser layout or native claim.

## B5 herbs and Wick details

Willow Shade's patch detail shows its current finite supply and Harvest for one
real eligible item; empty or too-heavy stock states the current refusal. The
ordinary inventory may also Take those same room items. Wick's public NPC detail
explains the exact authored herb/reward quantities, offers explicit Accept or
Reaccept only when the funded exchange can begin, and offers Turn in for an
active ready occurrence. The journal distinguishes active, resolved and optional
reacceptance without promising regrowth or tomorrow's stock. All controls use
shared confirmed projection/admission and ordinary live-action freshness.

Only a confirmed exchange updates inventory, contribution/faction, journal and
Wick history. Refused/stale/fenced outcomes never claim reward or completion.
Drop, stored herbs or corpse custody explain retrieval through the existing item
and recovery controls. Exhausted or given-away finite supply is an honest optional
unavailable exchange, never a chapter-blocking wait. No bandage-use or herbalism
control is exposed before its later real consumer lands.

## B4 light details

**API1.19 interaction contract.** [B4](mechanics.md#b4-light-and-darkness-selected-contract) uses the existing
inventory and item detail pages. The confirmed item view supplies remaining fuel,
capacity and effective lit state; the detail displays `Fuel <remaining> of
<capacity>, lit/unlit`. Ignite, Douse and Refuel occupy the ordinary item action
list. Worn torches keep these controls alongside Remove. The presenter owns no
fuel arithmetic, automatic ignition or clock.

Refuel names the exact directly held compatible bottle on its button (`Refuel
<source> from <supply>`) and sends ordered targets `[source_id, supply_id]`, with
no amount input or extra selector. The source item owns the control and its committed
detail history; the bottle is a bound participant, so its own page does not list
another item's Refuel. Authored aliases follow the projected semantic `command`,
while their `action_key` remains the invocation identity. Narrowed target or
input contracts are checked by keyed authority admission before a light control
is offered as available. No eligible supply means no Refuel button.
Wear/Remove and Put/Take retain their existing places. Confirmed receipts refresh
source, supply and World; stale/refused/fenced results never narrate success.

The dark World description keeps traversable compass/stair exits, inventory and
recovery controls usable. It displays no hidden detail links, readable entries or
Scan identities. Owner-corpse detail and ordinary accessible belongings remain
usable in darkness. After the same torch is lit directly held or worn, the authored
masonry detail is visible; Douse, exhaustion or Put into the satchel removes it on
the next confirmed view. Existing freshness handles a control selected before
elapsed exhaustion. No required waiting, darkness modal or new native control.

The focused Book interaction scenario buys the source and supply at Peg, selects
Ignite on the torch, enters the optional shaft and opens masonry, then Douses and
returns up. The same item detail selects Refuel from its named bottle. Put into the
satchel removes the masonry link; Take restores only remaining illumination.
Cold owner-corpse recovery follows the ordinary World/item pages and Take controls.
The headless [Book check](../../mobile/authority/local-story/light_book.test.ts) pins the ordered
participants, worn controls and confirmed fuel display contract; physical/browser
interaction evidence belongs to the release's later verification record.

## B7 water details

**Selected, pending implementation.** Well Lane's actual well detail offers Fill
with an exact currently eligible vessel destination. Inventory and reachable
item details show confirmed liquid kind, quantity/capacity and authored unit
label, and offer Drink or Pour to a distinct eligible owned vessel. Distinguish
the original and spare waterskin with authored names; retain exact IDs through
target selection rather than resolve an ambiguous keyword automatically.
Ordinary empty/full/incompatible/carrying refusals use the shared projected
availability and admission reason. No fake well room, text amount field or new
management screen is required. Local Leave remains navigation only.

Use the existing ActionInvocation/freshness boundary for the exact displayed
source/receiver and view context. Revalidate after time/custody/quantity changes;
a stale pair never silently substitutes another skin. Pending/unknown saves
show no optimistic quantity or success log. Confirmed liquid narration uses a fixed authored sentence followed by a compact
quantity line (for example `Water · 1 quarter-litre`) from that committed Text's
`kind`, `unit_label` text-key bindings and integer `quantity`. This bounded B7
presentation adds no text-template language or catalog placeholder substitution;
missing bindings produce no invented amount. The saved command routes Fill back
to its exact source detail, and Pour/Drink to their source vessel.
Confirmed action narration reflects
the receipt's actual transferred/consumed kind and amount; refresh/reopen uses
saved state. Book owns neither liquid math nor a consumption effect producer.
## C2 watch patrol details

**Local source independently approved; publication pending.** [C2](mechanics.md#s3-finite-watch-patrol-c2-selected-contract)
uses ordinary Tobin NPC details, Talk/Choose, World movement and Journal. Tobin's
page presents Start rounds, Continue rounds, Rejoin or Restart only from the typed
current state; C1 lessons remain available at his actual location. The journal names
the original leader's actual room, next route destination, unique checkpoint progress
and together/awaiting/paused/failed/completed state. Awaiting explicitly says to walk
the shown ordinary exit; it offers no second leader departure. Paused arrival says
Rejoin is still required, while failure says return to Tobin and Restart now.

Show unavailable reasons from shared kernel admission and maintain Close/Leave.
Capture the exact attempt/cursor/status with each drawn control under existing live
action freshness. Pending, refused, stale and faulted results claim no movement,
credit or trust. Only committed narration appears, once, including after lost reply
and reopen. No new watch page, immunity while reading, countdown, nighttime wait,
optimistic follow or timer-driven movement is added. The focused browser proof
covers shared Start→leader departure→player join→pause/Rejoin→success controls,
committed narration, resolved checkpoint Journal and a fresh-save cold reopen under
the [C2 staged browser-proof decision](../decisions/owner-decision-c2-staged-browser-proof-2026-10-05.md).
Browser death/Restart remains an explicit gap to close in the Chapter 1 E3 browser
walk, or sooner if practical. Actual fatal/Restart is proved separately by real-host
SQLite; native UI verification remains deferred under the mobile pause. The
previously failing terminal save has
[twice-reopened browser evidence](../evidence/2026-10-05-c2-watchmans-rounds/README.md#preserved-terminal-reopen-after-published-web-fix)
after the published Web SQLite fix. Browser fatal/Restart remains the separate
E3 gap; native UI verification is not claimed.

## B6 Seek, retry and ward details

[B6](mechanics.md#s4-all-hours-wisp-b6-selected-contract) uses the shared
Book at every hour. Marsh Light shows truthful darkness, known return exits and
its authored glow marker with Seek Wisp; reveal the actual wisp detail only after
confirmed discovery. A lit carried source explains unavailable Seek/Talk/answer
through the same confirmed admission result. Ordinary dark objects stay hidden.

Wisp detail follows description → committed history → offered controls. Explicit
Accept leads to the existing letter-bank controls with committed attempts/limit;
wrong lines stay with the original speaker. At the third wrong line, discard the
old tile buffer and show Ask Wisp again immediately, with an active quest journal.
Fresh Talk resets the sitting, never the quest or learned facts. Close remains
available through stale light, departure, death, scenes and save recovery under
existing precedence; stale invocations retain their sent answer for exact retry.

After confirmed success the journal names the ward discovery and the declared ward
label appears once. At public Aldric, Ask about ward is absent before knowledge,
then independently selectable beside eligible debt/bell conversations; opening it
must target its authored dialogue rather than Talk's first eligible key. Its reply
is informational and promises no spell. Cold reopen restores the exact committed
wrong/success speaker line once, using that invocation's receipt; never borrow an
unrelated latest receipt or treat selected tiles as a grant.

## C3 living hound and loot details

**Selected, pending implementation.** [C3](mechanics.md#c3-bounded-living-hounds-selected-contract)
projects each co-present living hound as its own existing NPC detail/action target,
with its exact EntityId and current HP condition. Shared blueprint names may be
the same; selecting an entry binds that instance, never the first definition match.
Departure/death prunes its detail route and stale Attack revalidates presence/life;
a different generation cannot inherit the old invocation. Adjacent Scan includes
living spawned members through ordinary movement sight. HP0 hounds are absent.

Attack opens the existing Combat page, with C1 defenses and only its current
Stand/Flee/Look/Scan controls. Committed death closes once; the room then exposes
the real public hound corpse and its ordinary Contents/Take path. Successful Take
shows that exact pelt in Carrying, with committed custody narration once. Refused,
pending or faulted commands claim no spawn, kill or loot. Reopen uses structured
receipt routing, keeping combat history on Combat and Take history on item detail.
No ecology status screen, countdown, Skin verb or next-day instruction is needed.
An all-hours fresh-game Book walk uses existing initial hounds in either allowed
room, following adjacent sight now when home is empty. Required story, loot/corpse
recovery and that walk never require waiting for respawn, wandering or darkness.

## C4 pack response and enemy flight details

**Selected, pending implementation.** [C4](mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract)
uses the existing NPC Attack and Combat page. Each hound entry/detail retains its
exact runtime target. GameView projects the current primary and actual active
opponents so identical template labels never select another instance; no raw UUID
needs to appear in prose. Committed admission narration names the assisting
members, and their own attack results demonstrate real help. Flight names the
departing member and real direction/destination; a primary change identifies the
new target. Neither presenter nor elapsed redraw chooses a helper or moves one.

While any opponent remains, keep Combat precedence and its current Flee/Stand/
Look/Scan ActionSet; do not reveal Attack/Move/equipment or hide Flee behind an
old NPC conversation. Flee retains current cost/standing refusal semantics.
Final withdrawal/death/escape restores World and ordinary actions from saved
state. Enemy flight grants no Carrying entry or corpse; only actual death exposes
the ordinary real corpse/pelt Take path. All hounds remain passive during ordinary
reading, room entry and corpse recovery at every hour.

Pending-save fences and typed refusal/fault remain visible with no premature
success. Membership/flight/primary narration routes once to retained Combat
history, including same-receipt closure and cold reload. Stale Attack/detail
targets revalidate after due settlement; a clock redraw cannot resurrect a dead,
departed or replaced member. Prove real helper attacks, flight, whole-pack Flee,
lethal loss/owned recovery and exact loot through Book; native work remains paused.

## D1 ferry and Sedge details

World opens the present boarding detail at Boathouse or Fen Isle Landing. Its
canonical detail page places confirmed history before the current **Board** or
**Return** offer, showing the exact fare or an actual owned-corpse waiver and
unavailable reason from the shared transport admission. The control captures
the endpoint, route and base quote; the authority derives destination and
effective charge. Accepted crossing appends one bound result,
returns to World in the destination and refreshes confirmed money, room and
follower state. Pending, stale and refused attempts claim no crossing or charge;
double tap/replay yields one move. The ordinary Book back/Leave path remains open.

Sedge's present NPC detail offers her direct **Learn swim — free** dialogue choice
before S27. It shows acquired and current qualification separately, and a
confirmed grant once; repeat interaction cannot promise a new grant. History
belongs to the original Sedge choice and survives cold reopen. The existing
World, NPC detail, dialogue, Character skill and detail stack patterns suffice.
The browser Book route covers boarding, lesson, exploration, return, refresh and
safe corpse recovery. Browser refresh is separate from real SQLite fault proof;
native builds/sessions remain paused.

## B8 Maud and bed details

**Implemented locally, publication pending.** Original Maud's detail follows the canonical
[detail order](#detail-page-order), with authored description, nonempty committed
history, then current S1 dialogue and separate Room/Meal/Drink service offers.
Each offer states its projected exact price and declared benefit, including
capped MV recovery and availability reasons. Sold-out,
already-paid, full-MV and unaffordable offers cannot appear actionable. Existing
Leave, scene/combat precedence, live freshness and pending-save fence remain.
Services do not steal S1's first-eligible Talk/turn-in, open a synthetic dialogue
or create success merely by rendering the menu.

Accepted service narration stays in Maud's history and refreshes confirmed
pennies/MV/availability once, also after lost reply, cold reopen and exact replay.
Pending/refused/stale/fault outcomes claim no purchase or recovery. Bed rental
narration points upstairs; the actual Inn Rooms bed detail shows confirmed free
or paid text and offers the existing ordinary Rest only when entitled and
currently admitted. This control emits the existing targetless Rest invocation;
its bed identity belongs to the local detail route, not a new command target.
Rest uses position's existing stable-route behavior and
confirmed outcome. It never narrates a dream or sleep for rental. Ordinary
position controls remain accessible without payment; Leave returns to World.
No optimistic balances, local entitlement flags, recovery-rate bonus, time
pause or new store/UI framework is introduced.

## D2 held book details

Planned [D2](mechanics.md#d2-held-books-and-public-priory-selected-contract) uses
ordinary item detail order and custody projection. World → book detail → Take
confirms the existing return to World. Contents → Equipment & Inventory → held
book detail offers explicit Read; opening that item sends no Read. For an open
held container, tapping its projected child pushes the child's full detail onto
the existing stack. Back to the immediate container pops locally without a command;
Leave/Back to World clears the stack. No new document/page-navigation system is added.
Closed/locked ancestors expose no child Read or invented text.

Read follows shared `buttonsOf`, `actionContext`, freshness, pending-save and exact
retry handling. The confirmed one-page text appends to that exact item's history,
then current options; the item page stays open. Pending/refused/stale/fault attempts
show no learned topic or invented page text. Character shows the projected known
topic labels; re-rendering or visiting Character never grants them. Intentional new
Read can repeat text; replay of one invocation appends once. Authority clock and
NPC schedules continue while a player browses these local pages.

After chapter Continue on cold reopen, recover the latest committed Read to its
original book history and currently reachable item route, including the projected
open held-container parents. If custody no longer permits that route, retain exact
history identity without opening an obsolete detail or copying text to World.
The confirmed-route requirement also applies when uncertain Read settles after Book
mounts: restore its exact target once beneath chapter Continue with scene/combat
precedence. The actual component regression is traced in the
[D2-P1 review](../reviews/2026-10-05-d2-priory-books-primary-review.md).
Ordinary notice entry keeps its existing automatic Read behavior. Ash/Hale have
separate touch cards at the declared overlap; a departed novice's pending context
retains its original identity and follows normal refusal/Leave rules.

## B9 bed and resumable dream details

**Selected, source pending.** [S10](mechanics.md#s10-lantern-rest-and-dream-b9-selected-contract)
uses World→actual Inn Rooms bed→Dream nesting. The paid bed's accepted ordinary
Rest may open its first dream at the confirmed first beat. Rental, menu opening,
unpaid Rest or a pending save never does. First Rest commits beat1 even if
presentation is deferred; the bed shows Resume dream once safely available.
Resume is a local route, not a world-level shortcut or synthetic room.

The dream is a detail page in canonical title/description, nonempty committed
history, current options order. It shows the saved narration, then at the choice
only Follow the fox/Wake, then the selected final line and Acknowledge. Choice
selection alone claims no memory. Close returns to the real bed; Leave bed returns
to World. Contents/World access, ordinary position controls, real travel and S2
delivery stay usable. Close changes only the local route; the durable cursor and
choice remain. Cold reopen offers Resume through the actual bed rather than forcing
the dream. Moving away, combat/harm/return or modal precedence exits unavailable
presentation to the actual current context and preserves its checkpoint.

Every captured control retains actor, anchor, scene, shown beat and exact choice
identity/revision where applicable. Freshness cannot be refreshed across a branch,
beat, room, choice or modal/combat change. Refusal redraws saved truth; pending
uses the original invocation and context and shows save not confirmed. Confirmed
final acknowledgement displays the once-only memory and truthful resolved S10
journal, also after lost reply/replay/reopen. There is no optimistic dream_seen,
clock pause, body/map switch, second event transcript or presenter gameplay writer.

## D4 home details and carried-food Eat

**Selected plan; not implemented.** [D4 declarations](cartridge.md#d4-homes-and-orchard-declarations)
use ordinary exits, inspectable details and NPC dialogue. Orchard trees expose
Forage only through the existing exact Harvest offer; Carrying's actual apple
detail exposes its declared Eat action and capped MV benefit only when admitted.
No apple or benefit appears from menu opening or pending save. Confirmed Eat
removes that identity from Carrying/load, closes the consumed item/Carrying route
and returns to World. Route its confirmed narration to the existing World log,
not to the now-inaccessible item history: `eaten` overrides the submitted item
page as a live result destination. Resolve narration by the reply's exact
`command_id` even though Eat emits no event; never substitute the latest unrelated
receipt. Append the committed line once, deduplicating by that command ID across
lost acknowledgement and exact replay. Pending/refused/faulted Eat adds no success
line or forced World return; full-MV or stale-custody refusal redraws saved truth.
Depleted orchard feedback reflects actual custody, including ordinary Take/Drop.

Cold reopen with Eat as the latest saved narratable result restores that exact
receipt line in the World log after the ordinary chapter entry, while the apple
remains absent. Validate its original command/actor/item/terminal transfer and
narration binding through [Eat receipt recovery](save.md#d4-finite-food-and-terminal-custody-recovery).
The recovered record deliberately has no `detail_id`; never reopen a consumed
item page or reroute to orchard trees, another item or NPC. Replay restores this
same World result without another log append, benefit or custody transition.
Use existing receipt selection and log lifetime; no new transcript/table or
persistent page route is introduced.

Refresh/reopen renders truthful cottage/cot and Green variants without moving
Elspeth or Wren. Scheduled absence never becomes a required wait. Browser proof
traverses all three additions, meets Gareth/Ada on controlled schedule states,
Forages, stores/retrieves, Eats, exhausts stock and refreshes after each boundary.
Use an isolated current-build browser save under the web-first policy; Node and
real-SQLite proof are separate. Native/owner-save proof remains paused.

## D5 Deep Fen detail pages

[D5](mechanics.md#d5-dry-deep-fen-exploration-selected-contract) uses the existing
World exits, adjacent sight, NPC details and [notice-detail flow](#notice-board-details).
The ward stone opens its exact ordinary Read offer; only confirmed narration
appears in its detail history, and local Back returns to World. Examine/Read
never claims message custody, topic learning or child return credit. Landscape
text describes dry footing and natural den light, without a bottom, far Scan,
fishing, drift or nest action that the actual projection cannot offer. The
original separated Wren exposes ordinary Talk/Rejoin in the den without gear.
