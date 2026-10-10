# Book UI component language

This is the implementation map for the [Book UI specification](system/book-ui.md),
which owns player-facing behavior. It describes reusable pieces in the current
shared React Native/web Book client. It is not a second source of gameplay rules or
a claim that every existing page has finished visual polish.

## Agent rules for Book UI code

For every agent writing `mobile/app/book/` or its stories ([audit](reviews/2026-10-09-ui-architecture-audit.md)).

1. Build from the house components in the [catalogue](#component-catalogue); a new one needs a real consumer and its row here in the same slice.
2. A state the catalogue lists is a prop on that row's component, never a sibling the page draws.
3. An unavailable action is `<ActionCard label reason />`, never a `Text` with `why(...)` in it.
4. An empty state or "save not confirmed" is a `Note`.
5. Control, section and dialog words come from `LABEL` in [`labels.ts`](../mobile/app/book/labels.ts), in components, tests, the walkthrough and story routes.
6. Every value comes from [`tokens.ts`](../mobile/app/book/tokens.ts): a palette role, a `type` style (weight, italic and underline included), a `space`, `size`, `radius` or `opacity` token; no raw number, colour, font or percentage.
7. Authored words come from the cartridge through the presenter; Book adds no world words.
8. A story renders the real component, one story per catalogue state, and draws nothing by hand.
9. A story whose behaviour matters (a tap, a refusal) has a `play` test asserting its outcome.
10. `ast-grep scan` (the `mobile-book-*` rules) and `catalogue.test.ts` pass before handoff; a new rule has a red control.

## Where each fact lives

- **Values** (colours, type, space, size, radius, opacity, motion, sound): [`tokens.ts`](../mobile/app/book/tokens.ts) and nowhere else; the [Tokens story](../mobile/app/stories/Tokens.stories.tsx) renders it live.
- **Look and states** of every component, and the token roles: this page, one row per component.
- **Interaction** (what shows when, what a tap does, returns, freshness): [Book UI](system/book-ui.md). It names no token, colour or size.
- **Working examples:** `npm run storybook` in `mobile/app` ([how](web-preview.md#storybook)); one `stories/<Row>.stories.tsx` per row, one story per state. A story carries no rule beyond a one-line link to its row.
- **References:** the two mocks in [docs/design](design/README.md); the owner's rulings in [decisions](decisions/README.md).
- Every pressable's box is at least `size.touch` in both axes. A text pressable (`Tap`: entity lines, verb lines, the room title, the status position) takes no visible height for it: its box is `minHeight: size.touch` with `paddingVertical: space.md` and an equal negative margin, so the shown line keeps the page rhythm and the hit area bleeds `space.md` onto the paper around it. The bleed is a target only where nothing paints over it: whatever renders later (the next line in a run, the scroll area under the fixed title, the row under the status position, the block under a Worn item or the water Surface line) takes the overlap. A Tap's guaranteed target is its shown box plus its uncovered bleed: a body line inside a run 28 px (`type.body.lineHeight`), a line with one covered side 36 px (a run's end, a Worn item, the Surface line, the status position), the room title 40 px, the full `size.touch` where the paper around it is free; never under WCAG 2.5.8's 24 px. A non-pressable line touching a Tap (a Worn slot label) lends it the bleed: a tap there opens the nearest line. Cards, tiles and Controls (`size.card`, `size.touch` with their own padding) keep their height visible; only `Tap` bleeds. Every text role reads at 4.5:1 on `bg` and `card` in all four palettes. Every control's accessible name follows the [label-in-name rule](system/book-ui.md#minimap-map-and-presentation-controls): its shown text first, then its suffix.
- A change lands in one place: a value in tokens, a rule here, a behaviour in Book UI; code and its story follow in the same slice.

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
off, consolidated; the [Tokens story](../mobile/app/stories/Tokens.stories.tsx) renders them live.

- **Colour.** Four complete palettes with the same roles: `light` (the paper by day), `dawn`
  (the paper under the mock's dawn tint, rose over slate, with the day's ink), `dusk` (the mock's
  dusk tint's violet-navy bottom stop with lamp ink: dusk deepens into the night without a flip) and
  `dark` (the mock's moonlit `.ph.moon` page, the lamp's amber as `action`, under the
  [Night sky](#component-catalogue)). The mock's twilight is a sky gradient over the page; a flat
  palette keeps its hue, never a brown or grey stand-in. Roles: `bg`, `fg` (ink), `dim`, `line`, `card`, `action`, `danger`,
  `warning`. Use roles, never a hex value. `action` marks what can be pressed; `danger` and
  `warning` are the projected bands, barred ways and refusal tags, never decoration. The text
  roles (`fg`, `dim`, `action`, `danger`, `warning`) are each at least 4.5:1 on `bg` and on
  `card` in every palette; `line` is a hairline, not text. Which palette shows follows the
  in-game solar phase, per the [day and night rule](system/book-ui.md#world-and-status-entry):
  phase `day` shows `light`, `dawn` `dawn`, `dusk` `dusk`, `night` `dark`; any other phase, a
  cartridge without a calendar, or no GameView (the save-error screen) shows `light`; never the
  device's light or dark setting.
- **Type.** IM Fell English for titles and letter tiles, EB Garamond for prose, logs and status,
  IM Fell English SC (bundled) for small-caps controls, section titles,
  status labels, tags, speakers and the running head. Use a named style
  from `type`; do not set a font size, line height or letter spacing in a component.
- **Space, size, radius.** Margins, gaps and padding come from `space`; touch, card, rule
  and minimap sizes from `size`; corners from `radius`. `space.md` is also `Tap`'s vertical
  bleed: (`size.touch` − `type.body.lineHeight`) / 2, the one value that gives a body line a
  44 px hit area with no visible padding; change either token and recheck it. Map drawing geometry
  (`MapDrawing`, `DiscoveredMap` layout, `joystick`) is exempt: its numbers are a drawing,
  not spacing.
- **Focus.** On web, keyboard focus draws a `size.focus` `action` outline `size.focus` outside the
  focused element, on `:focus-visible` only (the mock's rule): a tap or a click draws no ring; a
  Tab does, and so does an arriving page's title focus after keyboard use. One document-wide rule
  (`useFocusRing`, recoloured by the Book's shown palette), never a per-component style; a device
  draws no ring.
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
  `lum(fg) < lum(bg)` differs between the shown palette and the target. `motion.meteor` is the
  Night sky's one shooting star; `nightSky.star` its colour. The mock's other Effects-panel
  effects and its "Archive, not in v1" group have no tokens and wait for their own owner decisions.

## Component catalogue

Each component lists its form, states, rules and story. A new mechanic reuses one of
these; a new component needs a real consumer and its entry here in the same slice.
"Story" names its story file; "Polish" names what the polish phase changes.

| Component | Form and rules | States | Story |
|---|---|---|---|
| Page | One shell for every page: `space.page` margin, blocks `space.block` apart (a run of rows of one kind is one block: entity lines and a room's exit warnings touching, log lines and cards `space.sm` apart, the mock's `.ents`, `.ev` and `.toc`; a heading is its own block; Combat's name, bleeding, condition and opponent lines are one block of touching lines, then the log, then the cards); `type.pageTitle` header in `fg` with the arriving focus (a page without a title gives its first block the focus); a section heading (Inside, Held, Worn, Where) is `SectionTitle`, `type.sectionTitle` `fg`, a header. The Room's title is the fixed variant: `type.roomTitle`, centred, `space.xl` above, `space.md` plus `space.xs` (title padding, scroll top padding) to the first block, outside the scroll; only it is pressable (the Look tap). A page that grows at the end (dialogue) scrolls to its end. A page with no game behind it (the save error) is the centred variant: its blocks sit in the vertical middle of the paper. The running head sits above the Page, drawn by the body, not the Page: above every page, World, details, sections, scene, chapter title and combat included, except Journal (which lists the same text): the projected journal text (no presenter copy) of the first quest in journal order that is `active` or `objectives_complete` and has journal text; none when no quest qualifies. `type.runningHead` `dim`, not pressable, wrapping rather than cutting authored words. | scrolling title, fixed title, no title, centred | `stories/Page.stories.tsx` |
| PageFoot | The page's local returns, Controls centred in a row `space.lg` apart under a `line` hairline, `space.md` above, `space.xl` beside and below; outside the scroll, above the status line. | one return; two (nested item) | `stories/PageFoot.stories.tsx` |
| Room page | The Page's fixed title (the Look tap, per the [room rule](system/book-ui.md#world-and-status-entry); named `<title>, look`); then the prose in `type.body` as one block, a new paragraph at every blank line of the authored text, paragraphs `space.lg` apart (the mock's `.prose p`); its exit warnings as one block of notes, entity lines, verb lines and the log. | title tappable or plain | `stories/RoomPage.stories.tsx` |
| Fixture link | Inline in prose; ink colour with a dotted underline at the platform's thickness (solid where the platform has no dotted line; no thickness token, since no platform's `Text` sets one). | linked, or plain prose when no detail is projected | none until a projection consumer |
| Entity line | MUD line: the name in `type.named` (weight 500 with a dotted underline; solid where the platform has none), then the rest ("is here."). The whole line is the touch target; its visible height is the text's own (`type.body` line, then the note), the 44 px hit area is `Tap`'s bleed, so consecutive lines touch at the body line pitch and the Page's `space.block` alone separates a run from a paragraph. A carried-item note follows in `dim`. Also every list row that opens a detail: held and worn items, Inside, notices, boards, Contents entries. Its name is the shown text in order (name, rest, note) then ", open", on every row. | none | `stories/EntityLine.stories.tsx` |
| Note | A line that is not pressable and carries no action: `type.body` in `dim`, one string. Every empty state ("Nothing to do here.", "You are carrying nothing.") and "save not confirmed" is a Note, never a `Text` the page styles. | empty state; save not confirmed | `stories/Note.stories.tsx` |
| Verb line | A room's offered place action: `type.body` with `type.italic` in `action`, in the room's list after the entity lines. | available only | `stories/VerbLine.stories.tsx` |
| Action card | A detail page's offered action or dialogue choice, and the Character page's `Raise STR`-style cards, one per authored attribute while `raise_attribute` is offered ([levelling details](system/book-ui.md#levelling-details)) (never an accent text link): `card` fill, `size.rule` `line` border, `radius.card`, minimum height `size.card`, label `type.body` `fg`, `space.md` vertical and `space.lg` horizontal padding. The card carries no outer margin: cards stack in one list `space.sm` apart (the list's `gap`), and that list is one block of its page, so a card never adds to the page's block gap. | available; unavailable (no Button): `ActionCard label reason`, a non-action note (the Note's look) reading `label: reason`, or the label alone when no reason is projected, per the [detail rules](system/book-ui.md#notice-board-details), never a disabled card and never a note the page draws | `stories/ActionCard.stories.tsx` |
| Continue button | A scene or chapter continuation: `fg` fill, `bg` label in `type.control` centred, `radius.card`, minimum height `size.card`, `space.md` vertical and `space.lg` horizontal padding (the card's), so the label never touches the fill's edge when the button is not stretched. | available | `stories/ContinueButton.stories.tsx` |
| Chapter card | The chapter title page's one block, centred on the paper (the Page's centred variant): the chapter label ("Chapter one", a presenter word from the chapter index) in `type.chapterLabel` `dim`, the title in `type.chapterTitle` `fg`; label and title together are the page header, one accessible node named by its visible text in order ("Chapter one The Missing Child"), with the arriving focus; then a `dim` rule `size.chapterRule` wide and `size.rule` high; label, title and rule `space.sm` apart, the rule `space.sm` further; the mock's `.chapter` without its fleuron, subtitle and auto-dismiss. The Continue button follows as the next block, centred, not stretched. Nothing on it is pressable but Continue. | shown | `stories/ChapterPages.stories.tsx` |
| Control | Local navigation that is not an offered action (Leave, Leave the conversation, Back to World, Back to board, Back to container, Back to map, Close, Resume dream, Continue conversation, Got it, Start over, Backspace, Clear): `type.control` in `fg`, at least `size.touch` both ways, `space.md` horizontal padding, so two Controls side by side (Backspace, Clear) never run together. Start over is a Control wherever it appears (Settings, a fault, the save-error screen): its confirmation carries the weight, never `action` or `danger`. | enabled; disabled: `dim` at `opacity.disabled` | `stories/Control.stories.tsx` |
| Log line | `type.log`, one `Text` per line. Narration in ink; a system line (Journal updated, a detail note) in `dim` italic; a refused line starts with a reason tag (`type.tag`, `danger`, `size.rule` border, `radius.tag`, `space.xs` horizontal padding): always the reason word, even when the cartridge sentence beside it repeats it (the tag is the scannable kind, the sentence the authored words; the mock's `.why`). The tag is its own `Text` beside the sentence's `Text` in one row (`space.xs` apart, baseline-aligned, the sentence wrapping beside the tag), never nested inside it, so iOS and Android draw its border too. A speech line (a `size.speechBar` `line` bar, `space.lg` indent, the speaker in `type.speaker`) waits until the log projects a speaker. | none | `stories/LogLines.stories.tsx` |
| Footer | Two `line` hairlines `size.footerRule` wide flanking the minimap (`size.minimap` at rest, zoom per [minimap rules](system/book-ui.md#minimap-map-and-presentation-controls)), `motion.quick`. The footer block sits under a `line` hairline; `space.sm` between rule, map and rule. The minimap's geometry is a drawing, its colours are roles: a path and its ring in `dim`, the lit path and its ring in `fg`, your dot in `action` (the mock's `.mm-cur`), a barred way (stub, tick, stair node) in `danger`; so at night the exits stay quieter than you. | at rest, held | `stories/Footer.stories.tsx` |
| Tip | First-run tip: an `fg` bubble (`radius.card`, `space.md`/`space.lg` padding, centred, within `space.page` of each edge) with `bg` text in `type.small` and a Got it Control drawn on ink (label `bg`). | shown | `stories/Tip.stories.tsx` |
| Status line | One centred line in `type.small` `dim`, never wrapping, items joined by " · " (groups `space.sm` apart, each " · " belonging to the item after it): the sky glyph, position, bleeding and the condition items ([rule](system/book-ui.md#conditions-details); a loss in `danger`, a gain in `dim`), then the pools. The sky glyph is the sun by solar phase while it is up (`dawn` ☼, `day` ☀, `dusk` ☉) and the moon by lunar phase at `night` (`new` ●, `waxing_crescent` ☽, `first_quarter` and `waxing_gibbous` ◐, `full` ○, `waning_gibbous` and `last_quarter` ◑, `waning_crescent` ☾; no lunar phase ☾): ink is the moon's dark side, waxing lit on the right. Any other phase, or no calendar, shows the earthly branch. The glyph's accessible label is the time in words (`day 3, 18:05, dusk, waxing crescent moon`); day and hour are not shown. Only hp, ma and mv show, separated by an en space (U+2002, the mock's `&ensp;`) as text, never a margin, so the shown words lead the button's name unchanged; pennies and any other count stay off the line ([status rule](system/book-ui.md#world-and-status-entry)); resource keys in `type.label`; band colours per the same rule. Too wide, the position and condition items end in an ellipsis, the longer giving up more (their labels stay whole); the glyph and the pools never shrink. Position and pools are controls; their names follow the [label-in-name rule](system/book-ui.md#minimap-map-and-presentation-controls) (`standing, change position`; `hp 30/30 ma 10/10 mv 60/60; hp normal; opens Contents`). | enabled; locked (scene, combat, chapter title page): `dim`, not pressable, the Contents button included; pending: a Note "save not confirmed" centred under the line; resource tones: `normal` in `fg`, `warning`, `danger`; only pennies: the button says `character`; narrow (360 px with bleeding) | `stories/StatusLine.stories.tsx` |
| Letter tile | `card` fill, `line` border, `radius.card`, `size.touch` square, `type.tile`; the bank wraps centred with `space.sm` gaps (the mock's `.bankl`) and a used tile keeps its place; the answer line, the bank and its Controls and Submit card sit `space.block` apart as one block of the NPC page. Name: the letter, then its place (`N, tile 2`). | free; used: `opacity.disabled`, not pressable | `stories/LetterTile.stories.tsx`; the bank: `stories/Riddle.stories.tsx` |
| Page turn | See [Page turn](#page-turn). | turning, settled | `stories/PageTurn.stories.tsx` |
| Night sky | Over the whole Book while the shown palette is `dark` (the `night` phase; it appears as the dusk cross-fade ends and goes with the dawn cut), taking no touch, focus or screen-reader node, like the page turn's leaving leaf: a fixed scatter of faint `nightSky.star` points (a drawing: 36, 1 to 2 px, opacity .2 to .65, the same sky every night) and, on average every 9 s, one shooting star, a `nightSky.star` streak falling down-left over `motion.meteor` and fading out (the mock's `.moon` meteor). Decoration, never information: nothing in the game reads from it. | night; reduced motion: the stars only, no shooting star | `stories/NightSky.stories.tsx`; over a page: `stories/RoomPage.stories.tsx` At night, palette `dark` |

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
  focus moves to its title, or to its first block when it has none. The leaving page and the
  curl take no touch, keyboard or screen-reader focus, so input is never blocked and nothing hidden is announced. The leaving
  page's picture is prepared before the turn, so the first web turn curls too. If the picture is still not ready within `motion.quick`, the page changes at once
  without a curl (the sound still plays); the leaving page never covers the arriving page
  longer than that.
- **Reduced motion.** When the system asks for reduced motion, the pages cross-fade over
  `motion.fade` instead, with no curl.
- **Sound.** The paper page-turn sound plays on every page turn at `sound.pageTurn.volume`,
  including the reduced-motion cross-fade; only the Sound setting silences it. It is on
  by default; Settings has a Sound on/off control kept on the device. Until a short recorded
  CC0 page-turn sample (under 1 s, bundled) is found and replaces it, the mock's synthesised
  sound plays, as the [PageTurn story](../mobile/app/stories/PageTurn.stories.tsx) does.

## Delivery cadence

Delivery follows the [Book interaction delivery rule](WORKFLOW.md#book-interaction-delivery); the
cross-page consistency pass is part of [E3's browser walk](briefs/chapter-one/chapter-one-e3-r10-browser-gate-brief-2026-10-05.md), and a smaller one repeats at later chapter gates.
