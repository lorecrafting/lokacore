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
| Paper, typography and tone | [`palette.ts`](../mobile/app/book/palette.ts) (`usePalette`, `prose`, `note`), `pageTitleStyle` and `sectionTitleStyle` in [`pages.tsx`](../mobile/app/book/pages.tsx) | The shown palette from the [design tokens](#design-tokens) and the text styles built on it. The shared title base `titleStyle` is private to `pages.tsx`; a title uses one of the two exports, or `type.roomTitle` for the room. |
| Touch and action controls | `Tap`, `Act`, `Leave` in [`pages.tsx`](../mobile/app/book/pages.tsx) | Accessible touch target, confirmed offered action and local return. |
| Page shell and navigation | `BookView`/`Body` in [`Book.tsx`](../mobile/app/book/Book.tsx), `Page`/`pagesAfter` in [`model.ts`](../mobile/app/book/model.ts), `PageTurn` | World/detail stack, foreground precedence, return and transition. |
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
| Resume B9's bed dream | [`DreamPage.tsx`](../mobile/app/book/DreamPage.tsx), ordinary bed → dream detail route | Saved cursor/choice, local Close to bed, Resume after reopen and ordinary World access ([selected rule](system/book-ui.md#b9-bed-and-resumable-dream-details)). |
| Show room travel or status | World/status shell | Confirmed room, legal exits, current time/status and no optimistic move. |

Use the [Book UI rules](system/book-ui.md) for each pattern's exact behavior.
The installed B9 dream uses its own anchored detail page; modal `ScenePage` keeps
its foreground precedence under the [scene contract](system/mechanics.md#scene1-mechanicsscenerulets).
When a mechanic genuinely needs a new interaction, amend that specification first,
identify the real consumer, and add the smallest reusable page/control that serves
it. Do not create a new screen merely because a mechanic has a new name.

## Design tokens

[`tokens.ts`](../mobile/app/book/tokens.ts) is the single source of the Book's colours, fonts,
type styles, spacing, sizes, radius, opacity, motion and sound. Its values are the
[Chapter 1 mock's](design/ui-exploration/chapter-one-playable.html) base page with every effect
off, consolidated; the [foundation notes](design/foundation/README.md) list each mock value
against the live one and the [specimen](design/foundation/specimen.html) shows them.

- **Colour.** Four complete palettes with the same roles: `light` (the paper by day), `dawn`
  (a cool grey-blue paper), `dusk` (a warm umber page with lamp ink) and `dark` (the mock's unlit
  paper, without its glow). Roles: `bg`, `fg` (ink), `dim`, `line`, `card`, `action`, `danger`,
  `warning`. Use roles, never a hex value. `action` marks what can be pressed; `danger` and
  `warning` are the projected bands, barred ways and refusal tags, never decoration. The text
  roles (`fg`, `dim`, `action`, `danger`, `warning`) are each at least 4.5:1 on `bg` and on
  `card` in every palette; `line` is a hairline, not text. Which palette shows follows the
  in-game solar phase, per the [day and night rule](system/book-ui.md#world-and-status-entry).
- **Type.** IM Fell English for titles and letter tiles, EB Garamond for prose, logs and status,
  IM Fell English SC (bundled) for small-caps controls, section titles,
  status labels, tags, speakers and the running head. Use a named style
  from `type`; do not set a font size, line height or letter spacing in a component.
- **Space, size, radius.** Margins, gaps and padding come from `space`; touch, card, rule
  and minimap sizes from `size`; corners from `radius`. Map drawing geometry
  (`MapDrawing`, `DiscoveredMap` layout, `joystick`) is exempt: its numbers are a drawing,
  not spacing.
- **Motion and sound.** Only the plain state changes in `motion` and the page turn's sound;
  no decorative animation. `motion.palette` is the slow cross-fade between palettes (light
  changes need more than `motion.fade`). Text stays readable through a change: every frame
  keeps each text role at least 4.5:1 on `bg` and `card`. So a palette change cross-fades
  only when ink and paper keep their polarity (ink darker than paper in both palettes, or
  lighter in both: `light`/`dawn`, `dusk`/`dark`); every polarity flip (`light`/`dawn` to
  `dusk`/`dark` or back, including a skipped phase) switches at once, as under reduced
  motion. No fade of either kind can pass a flip: ink and paper must cross in luminance.
  Shape: `useShownPalette` interpolates every role linearly per frame (no layers, no opacity)
  and calls `setShown(target)` at once when there is no curve or when
  `lum(fg) < lum(bg)` differs between the shown palette and the target. Effects from the mock's Effects panel and its "Archive, not in
  v1" group have no tokens and wait for their own owner decisions.

## Component catalogue

Each component lists its form, states, rules and real consumer. A new mechanic reuses one of
these; a new component needs a real consumer and its entry here in the same slice.
"Live" names the code that draws it today; "Polish" names what the polish phase changes.

| Component | Form and rules | States | Consumer (live) |
|---|---|---|---|
| Page | Page margin `space.page`, blocks `space.block` apart, `type.pageTitle` header in `fg`; a section heading inside a page (Inside, Held, Worn) in `type.sectionTitle` `fg`. The running head sits above every page, World, details, sections, scene, chapter title and combat included, except Journal (which lists the same text): the projected journal text (no presenter copy) of the first quest in journal order that is `active` or `objectives_complete` and has journal text; none when no quest qualifies. `type.runningHead` `dim`, not pressable, wrapping rather than cutting authored words. One shell for every detail and section. | none | `Sheet` [`pages.tsx:219`](../mobile/app/book/pages.tsx#L219); running head `RunningHead` [`pages.tsx:50`](../mobile/app/book/pages.tsx#L50), placed by `Body` [`Body.tsx:41`](../mobile/app/book/Body.tsx#L41) and `Combat`. Polish: `NpcPage` [`Menu.tsx:121`](../mobile/app/book/Menu.tsx#L121) and `Combat` [`Combat.tsx:31`](../mobile/app/book/Combat.tsx#L31) rebuild it; fold them in. |
| Room page | Fixed centred `type.roomTitle` (the Look tap, per the [room rule](system/book-ui.md#world-and-status-entry)); then prose in `type.body`, entity lines, verb lines and the log. | title tappable or plain | `RoomPage` [`pages.tsx:110`](../mobile/app/book/pages.tsx#L110) |
| Fixture link | Inline in prose; ink colour with a `size.underline` dotted underline (solid where the platform has no dotted line). | linked, or plain prose when no detail is projected | room description; no live projection yet |
| Entity line | MUD line: the name in weight 500 with the dotted underline, then the rest ("is here."). The whole line is the touch target. A carried-item note follows in `dim`. Also every list row that opens a detail: held and worn items, Inside, notices, Contents entries. | none | `Here` [`pages.tsx:187`](../mobile/app/book/pages.tsx#L187). Polish: held items [`sections.tsx:128`](../mobile/app/book/sections.tsx#L128) show no affordance; worn items and Inside rows are `action` links. |
| Verb line | A room's offered place action: italic `type.body` in `action`, in the room's list after the entity lines. | available only | place actions via `Act` [`pages.tsx:174`](../mobile/app/book/pages.tsx#L174) |
| Action card | A detail page's offered action or dialogue choice (never an accent text link): `card` fill, `size.rule` `line` border, `radius.card`, minimum height `size.card`, label in `type.body` ink. | available only; an unavailable action is a non-action note with its real reason, per the [detail rules](system/book-ui.md#notice-board-details), not a disabled card | `Act` [`pages.tsx:90`](../mobile/app/book/pages.tsx#L90), `Choice` [`Menu.tsx:25`](../mobile/app/book/Menu.tsx#L25). Polish: these are accent text links today (audit duplicate 2). |
| Continue button | A scene or chapter continuation: `fg` fill, `bg` label in `type.control`, `radius.card`, height `size.card`. | available | `ChapterPage` [`sections.tsx:233`](../mobile/app/book/sections.tsx#L233), `ScenePage` [`sections.tsx:244`](../mobile/app/book/sections.tsx#L244). Polish: both draw an `action` text link today. |
| Control | Local navigation that is not an offered action (Leave, Back to World, Back to board, Back to container, Back to map, Close, Resume dream, Continue conversation, Got it, Start over): `type.control` in `fg`, at least `size.touch` both ways. A section return sits centred below a `line` hairline. Start over is a Control wherever it appears (Settings, a fault, the save-error screen): its confirmation carries the weight, never `action` or `danger`. | enabled; disabled: `dim` at `opacity.disabled` | `Control` [`pages.tsx:71`](../mobile/app/book/pages.tsx#L71): Back to World and Back to board [`Book.tsx:215`](../mobile/app/book/Book.tsx#L215), Start over in Settings, a fault [`Book.tsx:243`](../mobile/app/book/Book.tsx#L243) and `SaveError`. Polish: `Leave` [`pages.tsx:99`](../mobile/app/book/pages.tsx#L99) and Continue conversation are `action` prose, Back to container [`pages.tsx:270`](../mobile/app/book/pages.tsx#L270) is `fg` prose, Got it [`Footer.tsx:135`](../mobile/app/book/Footer.tsx#L135) is its own pressable. |
| Log line | `type.log`. Narration in ink; a system line (Journal updated, a detail note) in `dim` italic; a refused line starts with a reason tag (`type.tag`, `danger`, `size.rule` border, `radius.tag`). A speech line (a `size.speechBar` `line` bar, `space.lg` indent, the speaker in `type.speaker`) waits until the log projects a speaker. | none | room log [`pages.tsx:135`](../mobile/app/book/pages.tsx#L135); detail history `logLines` [`pages.tsx:232`](../mobile/app/book/pages.tsx#L232), used by `ThingPage` and [`Menu.tsx:143`](../mobile/app/book/Menu.tsx#L143), one renderer twice |
| Footer | Two `line` hairlines `size.footerRule` wide flanking the minimap (`size.minimap` at rest, zoom per [minimap rules](system/book-ui.md#minimap-map-and-presentation-controls)), `motion.quick`. The first-run tip is an `fg` bubble with `bg` text (`type.small`) and a Got it control. | at rest, held, tip shown | `Footer` [`Footer.tsx:35`](../mobile/app/book/Footer.tsx#L35) |
| Status line | One centred line in `type.small` `dim`, items joined by " · ": time, position, bleeding, resources. Resource keys in `type.label`; band colours per the [status rule](system/book-ui.md#world-and-status-entry). Position and resources are controls. | enabled; locked (scene, combat, chapter title page): `dim`, not pressable, the Contents button included; pending: "save not confirmed" | `Status` [`Footer.tsx:228`](../mobile/app/book/Footer.tsx#L228) |
| Letter tile | `card` fill, `line` border, `radius.card`, `size.touch` square, `type.tile`. | free; used: `opacity.disabled`, not pressable | `Riddle` [`Menu.tsx:67`](../mobile/app/book/Menu.tsx#L67). Polish: tiles are narrower than 44 today. |
| Page turn | See [Page turn](#page-turn). | turning, settled | `PageTurn` [`PageTurn.tsx:51`](../mobile/app/book/PageTurn.tsx#L51) |

Not adopted from the mock (no live consumer): the text drawer and its command chips, topic
chips, shop price rows and scene pick cards.

## Page turn

[`page-curl.sksl`](../mobile/app/book/page-curl.sksl) is the single source of the curl: one Skia
runtime shader that web (CanvasKit) and device (Skia) both run through
`@shopify/react-native-skia`. Its uniforms are the leaving page's picture, page size, eased
progress, direction and the paper colour, which is the shown palette's `bg`
passed in by the driver. The curl draws over the live arriving page: it paints the leaf and,
where the arriving page shows, only the roll's shadow, never a picture of the arriving page.
There is no second CSS or WebGL curl.

- **Direction.** A page that opens turns forward (`direction` 1); a return turns back (-1),
  as the [presentation rule](system/book-ui.md#minimap-map-and-presentation-controls) says.
  Stable-route updates do not turn.
- **Timing.** `motion.turn` (about 500 ms, tuned on a device): the driver eases progress 0 to 1
  over its duration with its easing. A new turn replaces a running one. Every `motion.*.easing`
  name is one the driver knows; an unknown name is an error, never a silent default.
- **Input.** The arriving page is live from the first frame, opens scrolled to its top, and
  focus moves to its title. The leaving page and the curl take no touch, keyboard or
  screen-reader focus, so input is never blocked and nothing hidden is announced. The leaving
  page's picture is prepared before the turn, so the first web turn curls too. If the picture is still not ready within `motion.quick`, the page changes at once
  without a curl (the sound still plays); the leaving page never covers the arriving page
  longer than that.
- **Reduced motion.** When the system asks for reduced motion, the pages cross-fade over
  `motion.fade` instead, with no curl.
- **Sound.** The paper page-turn sound plays on every page turn at `sound.pageTurn.volume`,
  including the reduced-motion cross-fade; only the Sound setting silences it. It is on
  by default; Settings has a Sound on/off control kept on the device. Until a short recorded
  CC0 page-turn sample (under 1 s, bundled) is found and replaces it, the mock's synthesised
  sound plays, as in the [specimen](design/foundation/specimen.html).

## Delivery cadence

Delivery follows the [Book interaction delivery rule](WORKFLOW.md#book-interaction-delivery); the
cross-page consistency pass is part of [E3's browser walk](briefs/chapter-one/chapter-one-e3-r10-browser-gate-brief-2026-10-05.md), and a smaller one repeats at later chapter gates.
