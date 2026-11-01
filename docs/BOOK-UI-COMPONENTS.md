# Book UI component language

This is the implementation map for the [Book UI specification](system/book-ui.md),
which owns player-facing behavior. It describes reusable pieces in the current
shared React Native/web Book client. It is not a second source of gameplay rules or
a claim that every existing page has finished visual polish.

## Agent rules for Book UI code

For every agent writing `mobile/app/book/` or its stories ([audit](https://github.com/lorecrafting/lokacore/blob/9b94cb5f094175727ff8cd7f7b26db44775c7a4d/docs/reviews/2026-10-09-ui-architecture-audit.md)); [where each fact lives](#where-each-fact-lives) says where values, looks and behaviour go.

1. Build from the [catalogue](#component-catalogue); a new component needs a real consumer and its doc comment and index line in the same slice.
2. A state a component's doc comment lists is a prop on that component, never a sibling the page draws: an unavailable action is `<ActionCard label reason />`, a page's empty state or "save not confirmed" is a `Note`.
3. Control, section and dialog words come from `LABEL` ([`labels.ts`](../mobile/app/book/labels.ts)) in components, tests, the walkthrough and story routes; authored words come from the cartridge through the presenter, never from the Book.
4. Every style value is a token: a palette role or a `type`, `space`, `size`, `radius` or `opacity` entry (weight, italic and underline included); no raw number, colour, font or percentage.
5. A story renders the real component, one per state its doc comment lists, draws nothing by hand, and asserts any behaviour that matters (a tap, a refusal) in `play`.
6. `ast-grep scan` (the `mobile-book-*` rules) and `catalogue.test.ts` pass before handoff; a new rule has a red control.

## Where each fact lives

- **Values** (colours, type, space, size, radius, opacity, motion, sound): [`tokens.ts`](../mobile/app/book/tokens.ts) and nowhere else; the [Tokens story](../mobile/app/stories/Tokens.stories.tsx) renders it live.
- **Use, rules and states** of every component: its doc comment, on the export in `mobile/app/book/` (and `SaveError.tsx`; [index](#component-catalogue)). Cross-component guidance and the token roles: this page.
- **Interaction** (what shows when, what a tap does, returns, freshness): [Book UI](system/book-ui.md). It names no token, colour or size.
- **Working examples:** `npm run storybook` in `mobile/app` ([how](web-preview.md#storybook)); the `Story:` file a doc comment names, one story per state. A story carries no rule beyond a one-line link to its component.
- **References:** the two mocks in [docs/design](design/README.md); the owner's rulings in [decisions](decisions/README.md).
- Every pressable's box is at least `size.touch` in both axes, except an inline link inside a sentence (the room's name links, [Book UI](system/book-ui.md)): it is one line of `type.named` text, as WCAG 2.5.8's inline exception allows. A text pressable (`Tap`: entity lines, verb lines, the room title, the status position) takes no visible height for it: its box is `minHeight: size.touch` with a bottom padding of its bleed (below) and an equal negative bottom margin, so the shown line keeps the page rhythm and the hit area bleeds onto the paper below it, never above, so the next line in a run never covers this one's shown line and a press anywhere on a shown line opens that line (owner, loka-462d). The bleed is a target only where nothing paints over it: whatever renders later (the next line in a run, the scroll area under the fixed title, the row under the status position, the block under a Worn item or the water Surface line) takes the overlap. A Tap's guaranteed target is its shown box plus its uncovered bleed: a body line inside a run, a Worn item, the Surface line and the status position their shown line (28 px at Standard), the room title 38 px (pageTitle 30 + its 8 below), the full `size.touch` for a line with free paper below (a run's last line); never under WCAG 2.5.8's 24 px. Cards, tiles and Controls (`size.card`, `size.touch` with their own padding) keep their height visible; only `Tap` bleeds. Every text role reads at 4.5:1 on `bg` and `card` in all four palettes. Every control's accessible name follows the [label-in-name rule](system/book-ui.md#minimap-map-and-presentation-controls): its shown text first, then its suffix.
- A change lands in one place: a value in tokens, a component rule in its doc comment, a cross-component rule here, a behaviour in Book UI; code and its story follow in the same slice.

## Grammar

Start from the existing page type. World obeys the [room page anatomy](system/book-ui.md#room-page-anatomy): title, description, people, items, log, nothing else; a mechanic's action goes on a fixture, person or item page, its ambient output in the log. World shows the room title and authored
description with inline links for fixed room fixtures, then separate present
player/NPC and loose-item paragraphs when projected. Each linked subject opens
its detail when the current projection supplies that route; general scenery
links await a real projection consumer. Fixtures stay in the room, while Take
is an item action only when offered. The exact [room-page rule](system/book-ui.md#world-and-status-entry)
governs visibility and placement. A child detail returns to its parent; Leave/Back changes
only the local route unless the current offered action explicitly says otherwise.
Every detail page follows the [detail-page order](system/book-ui.md#detail-page-order). Combat and scenes
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
| Talk, quest choice or service | NPC detail and offered action list | Exact speaker, available/refused choice, detail-local result, Leave and reopen. |
| Trade | The NPC's Trade card, its buy page and the buy page's Sell page ([rule](system/book-ui.md#npc-dialogue-and-action-details)) | Exact row and price, refused reason, the page stays after a trade, Leave back to the person. |
| Inspect, take, equip or use an item/container | Item detail; an open container's `InsidePage` ([`Menu.tsx`](../mobile/app/book/Menu.tsx)), ordinary item → inside detail route ([rule](system/book-ui.md#item-details-and-takedrop)) | Exact item/custody, Look inside, local Close to the item page, contents parent return, current actions and load refusal. |
| Read a notice or a book | Readable/notice detail | Confirmed Read on entry when specified, no duplicate Read, saved text and parent return. |
| Fight or flee | Combat foreground page | Combat-only response set, isolated log, closure and restored World route. |
| Continue a current modal scene, or a chapter card under a screen reader (otherwise the card turns itself and a tap skips) | `ScenePage`/`ChapterPage` | Confirmed continuation or acknowledgement; no premature consequence. |
| Resume a bed dream | [`DreamPage.tsx`](../mobile/app/book/DreamPage.tsx), ordinary bed → dream detail route | Saved cursor/choice, local Close to bed, Resume after reopen and ordinary World access ([rule](system/book-ui.md#chapters-scenes-and-recovery)). |
| Use, give or cast with a second thing | Pick list on the target's or the held thing's page ([rule](system/book-ui.md#item-details-and-takedrop)) | Rows only from GameView pairs, option hidden when empty, pick returns to World, refused pick keeps the page. |
| Show room travel or status | World/status shell | Confirmed room, legal exits, current time/status and no optimistic move. |

Use the [Book UI rules](system/book-ui.md) for each pattern's exact behavior.
A resumable dream uses its own anchored detail page; modal `ScenePage` keeps
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
  `warning`. Use roles, never a hex value. `action` marks what can be pressed; `danger` marks
  what is barred. They are distinct hues in every palette (plum/rose against oxblood/amber), each
  >=4.5:1 on `bg` and `card`. Every `type` role has a lineHeight and scales with the Reading
  size; `space` is 2/4/6/8/12/16/24. The text
  roles (`fg`, `dim`, `action`, `danger`, `warning`) are each at least 4.5:1 on `bg` and on
  `card` in every palette; `line` is a hairline, not text. Which palette shows follows the
  in-game solar phase, per the [day and night rule](system/book-ui.md#world-and-status-entry):
  phase `day` shows `light`, `dawn` `dawn`, `dusk` `dusk`, `night` `dark`; any other phase, a
  cartridge without a calendar, or no GameView (the save-error screen) shows `light`; never the
  device's light or dark setting.
- **Type.** IM Fell English for titles and letter tiles, EB Garamond for prose, logs and status,
  IM Fell English SC (bundled) for small-caps controls, section titles,
  status labels, tags, speakers and the running head. Use a named style
  from `type`; do not set a font size, line height or letter spacing in a component. The
  [Reading size](system/book-ui.md#world-and-status-entry) scales every role with a size (font
  size and line height each rounded): read them through `useType()`. Every Book `Text` sets
  `allowFontScaling={false}`.
- **Space, size, radius.** Margins, gaps and padding come from `space`; touch, card, rule
  and minimap sizes from `size`; corners from `radius`. `Tap`'s bleed, below only, is
  `size.touch` − the scaled `type.body.lineHeight`, never negative: 16 px at Standard, 12, 8
  and 2 px at Large, Larger and the cap, so a body line keeps a 44 px hit area with no visible
  padding. Map drawing geometry
  (`MapDrawing`, `DiscoveredMap` layout, `joystick`) is exempt: its numbers are a drawing,
  not spacing.
- **Focus.** On web, keyboard focus draws a `size.focus` `action` outline `size.focus` outside the
  focused element, on `:focus-visible` only (the mock's rule): a tap or a click draws no ring; a
  Tab does, and so does an arriving page's title focus after keyboard use. One document-wide rule
  (`useFocusRing`, recoloured by the Book's shown palette), never a per-component style; a device
  draws no ring.
- **Motion and sound.** Only the effects named in
  [Effects, sound and haptics](system/book-ui.md#effects-sound-and-haptics); no other decorative
  animation. `motion.palette` is the slow cross-fade between palettes (light
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
- **Effect tokens.** Press: `motion.press`; a lifted card blends `line` into `card` at
  `opacity.press` and rises `size.rule`; an ink press goes from `action` to `fg`. Ink drying:
  `motion.dry` from `dim` to the line's colour; a narrated event starts `motion.dry.lag` later.
  Status icon: `motion.pop` from scale `motion.pop.from`; expiry `motion.fade`. Item pop: rises
  `motion.pop.rise` over `motion.pop`, holds `hold`, leaves over `out` (`outEasing`). Gilt: `warning`
  for `motion.settle.hold`, then `motion.settle` to the line's colour. Running head:
  `motion.dry` across, `motion.settle` to `dim` then out. Chapter card: `motion.card.auto` before it turns itself, `motion.card`, blur sigma
  `blurFrom` to `blurTo`, each of label, title and rule `stagger` apart. Sound, `mix` and `haptic`
  hold levels and kinds; the sound table names each sound's haptic. Queue: small cues of one key merge
  within `mix.coalesce`; `motion.flash.gap` is the Flash limit.
- **Blow wash.** `opacity.wash` under the ink over `motion.flash`: `action` on `light` and `dawn`,
  `danger` on `dusk` and `dark` (amber `action` reads as lamplight, not harm). The page scales to
  `motion.flash.swell` at the peak. Reduced motion: `opacity.washStill`, no swell. The hp value dries in the same role and back to `fg`. Exemption from the 4.5:1
  rule above, for the wash's half second only: at its peak `fg` stays above 7:1 and `action` and
  `danger` above 5:1, while `dim` and `warning` dip to about 3.8:1 (opacity 0.08 would keep them
  at 4.5:1 and barely show). Combat is the only place the wash appears.
- **Falling.** The held wash is `opacity.faint`; with Flashes off it fades in over `motion.settle`.
- **Fight music.** Stinger `sound.fightIn`, loop `sound.fightLoop` (`gap` is the fight gap), fanfare `sound.fightWon`, blow dealt `sound.impact`. A blow taken dips music by `mix.dip` with `mix.duck`'s times. Foe falling: the loop cuts over `motion.quick`; a fall-away fades over `motion.palette`. The band press is `motion.press`.

## Component catalogue

Each exported Book component carries its spec in a doc comment on its export: a one-line form,
then bullets `- Use:` (when it is the right piece), `- Rules:` (only what the code cannot show:
never wraps, the screen-reader name, its consumers), `- States:` (one story per state) and
`- Story:` (its story file). `Use:` and `Story:` are required; `Rules:` and `States:` appear when
they say something; the comment wraps at 100 columns and restates no style the code sets.
Behaviour stays in [Book UI](system/book-ui.md), which a comment links and never copies. Storybook
renders the comment on the Docs page of the story whose meta names the component, and every comment
on the Docs/Component specs page (`mobile/app/stories/Specs.mdx`). This index has one line per
export, the file under `mobile/app/`, generated from the doc comments by `bin/regen.sh`;
[`catalogue.test.ts`](../mobile/app/catalogue.test.ts) fails when a comment is missing or the table is stale. A new mechanic reuses one of these;
a new component needs a real consumer, its comment and its line here in the same slice.

| Component | File | Story |
|---|---|---|
| `Blow` | `book/Blow.tsx` | CombatPage |
| `Body` | `book/Body.tsx` | RoomPage |
| `RoomPage` | `book/Body.tsx` | RoomPage |
| `Book` | `book/Book.tsx` | Live |
| `BookView` | `book/Book.tsx` | RecoveryPages |
| `Chip` | `book/Chip.tsx` | Chip |
| `Row` | `book/Chip.tsx` | Chip |
| `ReadingSize` | `book/Chip.tsx` | Chip |
| `EffectSettings` | `book/Chip.tsx` | Chip |
| `Foe` | `book/Combat.tsx` | CombatPage |
| `Combat` | `book/Combat.tsx` | CombatPage |
| `DiscoveredMap` | `book/DiscoveredMap.tsx` | MapPage |
| `DreamPage` | `book/DreamPage.tsx` | ChapterPages |
| `DreamResume` | `book/DreamPage.tsx` | NoticePage |
| `Footer` | `book/Footer.tsx` | Footer |
| `Tip` | `book/Footer.tsx` | Tip |
| `GiltLine` | `book/GiltLine.tsx` | LogLines |
| `Gradient` | `book/Gradient.tsx` | UnderInk |
| `HapticPulse` | `book/HapticPulse.tsx` | HapticPulse |
| `ItemPop` | `book/ItemPop.tsx` | LogLines |
| `MapDrawing` | `book/MapDrawing.tsx` | Footer |
| `ContentsPage` | `book/Menu.tsx` | SectionPages |
| `ThingPage` | `book/Menu.tsx` | ItemPage |
| `InsidePage` | `book/Menu.tsx` | ItemPage |
| `Item` | `book/Menu.tsx` | ItemPage |
| `NightSky` | `book/NightSky.tsx` | NightSky |
| `NpcPage` | `book/Npc.tsx` | NpcPage |
| `NpcDetail` | `book/Npc.tsx` | NpcPage |
| `PageTurn` | `book/PageTurn.tsx` | PageTurn |
| `Riddle` | `book/Riddle.tsx` | Riddle |
| `LetterTile` | `book/Riddle.tsx` | LetterTile |
| `RunningHead` | `book/RunningHead.tsx` | Page |
| `SayField` | `book/SayField.tsx` | SayField |
| `ShelfPage` | `book/Shelf.tsx` | NpcPage |
| `StatusLine` | `book/Status.tsx` | StatusLine |
| `StatusIcons` | `book/StatusIcon.tsx` | StatusIcon |
| `Tooltip` | `book/StatusIcon.tsx` | StatusIcon |
| `Text` | `book/Text.tsx` | Note |
| `UnderInk` | `book/UnderInk.tsx` | UnderInk |
| `ActionCard` | `book/actions.tsx` | ActionCard |
| `PickLists` | `book/actions.tsx` | PickList |
| `Cards` | `book/actions.tsx` | ActionCard |
| `VerbLine` | `book/actions.tsx` | VerbLine |
| `ContinueButton` | `book/actions.tsx` | ContinueButton |
| `JournalPage` | `book/journal.tsx` | SectionPages |
| `EntityLine` | `book/lines.tsx` | EntityLine |
| `Note` | `book/lines.tsx` | Note |
| `LogLines` | `book/lines.tsx` | LogLines |
| `AwayRecap` | `book/lines.tsx` | AwayRecap |
| `Here` | `book/lines.tsx` | RoomPage |
| `Heard` | `book/lines.tsx` | Heard |
| `Fault` | `book/lines.tsx` | Live |
| `NoticePage` | `book/notices.tsx` | NoticePage |
| `Tap` | `book/pages.tsx` | VerbLine |
| `Control` | `book/pages.tsx` | Control |
| `Page` | `book/pages.tsx` | Page |
| `PageFoot` | `book/pages.tsx` | PageFoot |
| `SectionTitle` | `book/pages.tsx` | Page |
| `CharacterPage` | `book/sections.tsx` | SectionPages |
| `AncestryPage` | `book/sections.tsx` | SectionPages |
| `CarryingPage` | `book/sections.tsx` | SectionPages |
| `MapPage` | `book/sections.tsx` | MapPage |
| `SettingsPage` | `book/sections.tsx` | SectionPages |
| `CreditsPage` | `book/sections.tsx` | SectionPages |
| `ChapterPage` | `book/sections.tsx` | ChapterPages |
| `ScenePage` | `book/sections.tsx` | ChapterPages |
| `SkillDetails` | `book/skills.tsx` | SectionPages |
| `Professions` | `book/skills.tsx` | SectionPages |
| `RaiseCards` | `book/skills.tsx` | SectionPages |
| `ItemDetails` | `book/skills.tsx` | ItemPage |
| `SaveError` | `SaveError.tsx` | RecoveryPages |

**Pick list** (owner 2026-10-23; `PickLists` in `book/actions.tsx`, its rows from
`book/pick.ts`; Cast a spell… joins it with the cast-with-target command). Composed of
existing pieces, no new token: the option is an available `ActionCard` that takes a local press
instead of a `Button` and carries `accessibilityState.expanded`; while open, its rows render
directly beneath it as a `Cards` stack of `ActionCard`s (available) and the `ActionCard`
unavailable form (its plain label; a press shows the reason, [Book UI](system/book-ui.md#unavailable-actions)), inset `space.lg` from the option so they read as its
children. No chevron or other glyph: the label's ellipsis says it opens. At phone width rows take
the full inset width, a long name wraps and never truncates, and the open list stays in the
page's scroll; opening scrolls the first row into view. Web keyboard: Tab and Shift-Tab move
through the rows in order, Enter or Space picks, Escape or the device's Back closes; screen readers hear the option's
name with its expanded state, then each row's name. Behaviour: [Book UI](system/book-ui.md#item-details-and-takedrop).
States for its story: closed; open with available rows; open with an unavailable row; scripted actions
mixed in one list; pending.

**Fixture link** (no component until a projection consumer): inline in prose; ink colour with a
dotted underline at the platform's thickness (solid where the platform has no dotted line; no
thickness token, since no platform's `Text` sets one); linked, or plain prose when no detail is
projected.

Not adopted from the mock (no live consumer): the text drawer and its command chips, topic
chips and scene pick cards. The mock's shop price rows are not adopted either: a stock, sale or service row is an
`ActionCard` in its line form (`link`), a prose line in `Cards lines` ([shop lines](system/book-ui.md#npc-dialogue-and-action-details), owner 2026-10-30).

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
- **Sound.** The paper page-turn sound (`sound.pageTurn`) plays on every page turn,
  including the reduced-motion cross-fade; only the Sound setting silences it. It is on
  by default; Settings has a Sound on/off control kept on the device. Samples are human-made,
  placeholders too ([owner decision](decisions/owner-decision-human-made-content-2026-10-31.md));
  a synthesised sound never ships, and with no sample the turn is silent.

## Delivery cadence

Delivery follows the [Book interaction delivery rule](WORKFLOW.md#book-interaction-delivery); a
cross-page consistency pass repeats at each milestone gate.
