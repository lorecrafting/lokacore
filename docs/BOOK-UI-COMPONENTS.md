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
type styles, spacing, sizes, radius, opacity, motion and sound. Its `chrome` export is the editor's, never drawn in the Book
([editor chrome rulings](design/editor-chrome-rulings.md)). Its values are the
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
  (`size.experienceRule`) and minimap sizes from `size`; corners from `radius`. `Tap`'s bleed, below only, is
  `size.touch` − the scaled `type.body.lineHeight`, never negative: 16 px at Standard, 12, 8
  and 2 px at Large, Larger and the cap, so a body line keeps a 44 px hit area with no visible
  padding. Map drawing geometry
  (`MapDrawing`, `DiscoveredMap` layout, `joystick`) is exempt: its numbers are a drawing,
  not spacing.
- **Experience rule.** `size.experienceRule` (2 px) under the status row: `line` track, `fg` fill.
  A gain or loss moves over `motion.dry`. A level: full over `motion.dry`, `warning` for
  `motion.settle.hold`, then `fg` at the new fraction over `motion.dry`.
- **Focus.** On web, keyboard focus draws a `size.focus` `action` outline `size.focus` outside the
  focused element, on `:focus-visible` only (the mock's rule): a tap or a click draws no ring; a
  Tab does, and so does an arriving page's title focus after keyboard use. One document-wide rule
  (`useFocusRing`, recoloured by the Book's shown palette), never a per-component style; a device
  draws no ring.
- **Under-ink layers.** A layer that stays under the ink (`opacity.spirit`, `opacity.reverie`, `opacity.fatal`, `opacity.faint`, `opacity.glow`) keeps every
  text role at 4.5:1 at its peak in every palette it shows on and on a same-polarity mid-blend of two. Only one shows at a time, highest first:
  a [treatment's](system/book-ui.md#book-treatments) layer (spirit or reverie, never both), the fatal hold, the low-health vignette, the lamp glow; together they would break the 4.5:1 rule.
  The fatal hold's rim (`opacity.bloodshot`, a `size.bloodshot.spread` band then `size.bloodshot.blur`) counts with it at the page margin (`space.page`), where the ink starts.
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
- **Level wash.** `opacity.wash` in `warning` under the ink over `motion.flash`, on every theme. Reduced motion: `opacity.washStill`. No swell.
- **Blow wash.** `opacity.wash` under the ink over `motion.flash`: `action` on `light` and `dawn`,
  `danger` on `dusk` and `dark` (amber `action` reads as lamplight, not harm). The page scales to
  `motion.flash.swell` at the peak. Reduced motion: `opacity.washStill`, no swell. The hp value dries in the same role and back to `fg`. Exemption from the 4.5:1
  rule above, for the wash's half second only: at its peak `fg` stays above 7:1 and `action` and
  `danger` above 5:1, while `dim` and `warning` dip to about 3.8:1 (opacity 0.08 would keep them
  at 4.5:1 and barely show). The level wash shares this exemption for its half second, in `warning`: at its peak `fg` stays above 7:1, `action` and `danger` above 4.5:1, while `dim` dips to about 3.75:1 and `warning` to about 3.6:1 over a held layer.
- **Lightning.** The second exemption from the 4.5:1 rule, for at most 700 ms: at `opacity.afterimage`, `fg` stays above 7:1 and `action` and `danger` above 5:1, while `dim` dips to 4.25:1 and `warning` to 4.03:1 on dusk, and `warning` to 3.95:1 on dark. No other role falls below 4.5:1. It draws with no other held layer under it.
- **Room sound and sky.** Bed cross-fade `motion.bed.duration`; exploration gap `sound.explore.gap`; lightning stays `motion.flash.gap` from a wash; wind corner `motion.flutter`; the light is `color.light.bg` at `opacity.afterimage`, up over 60 ms, away over 1200 ms.
- **Falling.** The held wash is oxblood (`color.light.action`) on every paper at `opacity.fatal.day` on light and dawn and `opacity.fatal.night` on dusk and dark, still (no pulse, no fade), with a bloodshot rim at the screen's edges: `opacity.bloodshot`, a solid `size.bloodshot.spread` band feathered in over `size.bloodshot.blur`, held with the wash; with Flashes off it rises over `motion.settle`, under reduced motion it is set at once. The sound is `sound.death`. The spirit state's layer is `spirit.day` on light and dawn and `spirit.night` on dusk and dark, at `opacity.spirit`, set with the page turn and faded out over `motion.palette` at the rise; its bed plays through `mix.muffle` until the rise.
- **Reverie.** `reverie.day` at `opacity.reverie.day` on light and dawn, `reverie.night` at `opacity.reverie.night` on dusk and dark, set with the turn; the line rises from the paper to `fg` over `motion.reverie`, `motion.reverie.lag` after the page lands; Continue then shows over `motion.settle`. No sound.
- **Fight music.** Stinger `sound.fightIn`, loop `sound.fightLoop` (`gap` is the fight gap), fanfare `sound.fightWon`, blow dealt `sound.impact`. A blow taken dips music by `mix.dip` with `mix.duck`'s times. Foe falling: the loop cuts over `motion.quick`; a fall-away fades over `motion.palette`.

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
| `Foot` | `book/Combat.tsx` | CombatPage |
| `Combat` | `book/Combat.tsx` | CombatPage |
| `CreditsPage` | `book/CreditsPage.tsx` | SectionPages |
| `DeadPage` | `book/DeadPage.tsx` | DeadPage |
| `DiscoveredMap` | `book/DiscoveredMap.tsx` | MapPage |
| `DreamPage` | `book/DreamPage.tsx` | ChapterPages |
| `DreamResume` | `book/DreamPage.tsx` | NoticePage |
| `ExperienceRule` | `book/ExperienceRule.tsx` | ExperienceRule |
| `Footer` | `book/Footer.tsx` | Footer |
| `Tip` | `book/Footer.tsx` | Tip |
| `GiltLine` | `book/GiltLine.tsx` | LogLines |
| `Gradient` | `book/Gradient.tsx` | UnderInk |
| `HapticPulse` | `book/HapticPulse.tsx` | HapticPulse |
| `Hotbar` | `book/Hotbar.tsx` | CombatPage |
| `HotbarList` | `book/Hotbar.tsx` | CombatPage |
| `HotbarGlyph` | `book/HotbarGlyph.tsx` | CombatPage |
| `ItemPop` | `book/ItemPop.tsx` | LogLines |
| `Leaf` | `book/Leaf.tsx` | CombatPage |
| `LevelWash` | `book/LevelWash.tsx` | LevelWash |
| `MapDrawing` | `book/MapDrawing.tsx` | Footer |
| `ContentsPage` | `book/Menu.tsx` | SectionPages |
| `ThingPage` | `book/Menu.tsx` | ItemPage |
| `InsidePage` | `book/Menu.tsx` | ItemPage |
| `Item` | `book/Menu.tsx` | ItemPage |
| `NightSky` | `book/NightSky.tsx` | NightSky |
| `NpcPage` | `book/Npc.tsx` | NpcPage |
| `NpcDetail` | `book/Npc.tsx` | NpcPage |
| `PageTurn` | `book/PageTurn.tsx` | PageTurn |
| `RightWord` | `book/Riddle.tsx` | Riddle |
| `Riddle` | `book/Riddle.tsx` | Riddle |
| `LetterTile` | `book/Riddle.tsx` | LetterTile |
| `RunningHead` | `book/RunningHead.tsx` | Page |
| `SayField` | `book/SayField.tsx` | SayField |
| `ScenePage` | `book/ScenePage.tsx` | ChapterPages |
| `Scene` | `book/ScenePage.tsx` | ChapterPages |
| `ShelfPage` | `book/Shelf.tsx` | NpcPage |
| `StatusLine` | `book/Status.tsx` | StatusLine |
| `StatusGlyph` | `book/StatusGlyph.tsx` | StatusIcon |
| `StatusIcons` | `book/StatusIcon.tsx` | StatusIcon |
| `Ring` | `book/StatusIcon.tsx` | StatusIcon |
| `Tooltip` | `book/StatusIcon.tsx` | StatusIcon |
| `Storm` | `book/Storm.tsx` | Storm |
| `Text` | `book/Text.tsx` | Note |
| `Unavailable` | `book/Unavailable.tsx` | ActionCard |
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
| `Heard` | `book/lines.tsx` | Heard |
| `Fault` | `book/lines.tsx` | Live |
| `NoticePage` | `book/notices.tsx` | NoticePage |
| `Tap` | `book/pages.tsx` | VerbLine |
| `Control` | `book/pages.tsx` | Control |
| `Page` | `book/pages.tsx` | Page |
| `PageFoot` | `book/pages.tsx` | PageFoot |
| `SectionTitle` | `book/pages.tsx` | Page |
| `Here` | `book/people.tsx` | RoomPage |
| `CharacterPage` | `book/sections.tsx` | SectionPages |
| `AncestryPage` | `book/sections.tsx` | SectionPages |
| `CarryingPage` | `book/sections.tsx` | SectionPages |
| `MapPage` | `book/sections.tsx` | MapPage |
| `SettingsPage` | `book/sections.tsx` | SectionPages |
| `ChapterPage` | `book/sections.tsx` | ChapterPages |
| `SkillDetails` | `book/skills.tsx` | SectionPages |
| `SkillsPage` | `book/skills.tsx` | SectionPages |
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

**Author-mode marks** (no component; laid over the Book from `mobile/app/author/` at `?dev=1`,
never in `mobile/app/book/`; behaviour: [Book UI](system/book-ui.md#author-mode-dev-only), reasons:
[rulings](design/prose-in-the-book-rulings.md)). Existing tokens only, in the Book's current palette.
The prose field: the line's own type role at the reading size, its own wrap and width, `fg` on
`card`, the focus ring (`size.focus`, `action`), caret `action`, browser selection; its caption and
any no-field note `type.label` in `dim` on `card`, the note's buttons (Add here's fields) `action`, no
border. Unconfirmed words: a static wavy underline in `warning`
(never dotted: that is the fixture link). A `~` line: a `size.speechBar` bar in `warning` in the
left page margin over the line's full height, `action` on the landed line. The changed-on-disk
notice: `type.label` in `warning`, its buttons `type.control` in `action`, each a touch target tall.
Build's tap field (builder 1.3): the line's own type role and width on page paper, a `size.rule`
rule in `action` beneath it; an unwritten line in Build: a blank line of the line's own height
ruled `size.rule` in `line`, its field name in `type.small` `dim`. The Build strip (and the
keep-my-place notice, a second row of the same look): `bg`, a `size.rule` rule in `line` beneath,
`space.md` padding and gaps; its buttons (Build, Undo, Open source, the Checks badge, the notice's
three) `type.control` in `action`, each a touch target in both axes, no border or fill; its status
and notices (Held, not put back, couldn't keep your place) `type.small` in `warning`. The Checks
sheet: `card` paper, rows `type.small` with `space.md` sides; a row that goes somewhere is a touch
target tall in `action`, a plain row and `Nothing to check.` `fg` with `space.md` padding. Builder
sheets (2.1): `card` paper; docked, half a `size.column` wide with a `size.rule` `line` rule on its
Book side, from a window `size.column` and a half wide (so the Book keeps its full column and the
sheet is about a phone's width); on a phone, absolute over the Book's lower half or all of it, a
`size.rule` `line` rule on top, no scrim. The grip: a touch target in both axes holding a
`size.touch`-wide bar four `size.rule` tall in `line`. The header row: Back `type.control` in
`action`, the breadcrumb `type.small` in `dim`, `space.md` sides; the title `type.control` in `fg`.
It slides in over `motion.quick`, none under reduced motion. The title pencil: `✎` in
`type.control` `action`, after the title, inline, a touch target in both axes. Room sheet rows,
`space.md` sides and gaps, wrapping: the summary `type.small` `dim`; an exit's words `type.small`
`fg`, a touch target tall; every act (One-way, Delete, ＋, Move to area, Delete room, Delete all,
Keep) `type.control` in `action`, a touch target in both axes, no border or fill; the Area field
`type.small` `fg` taking the row's free width, a `size.rule` rule in `action` beneath it as Build's
tap field; the refusal `type.small` in `danger` (a barred edit); the also-deletes question
`type.small` `fg`. Builder 2.2: the Add here row is a Room sheet row, `＋ Add here` `type.small`
`fg`, its buttons acts; the Person and Item sheets and the Notebook sheet use the same rows, their
summary and `Spawned by` lines `type.small` `dim`, the holder and name fields as the Area field;
the strip's Notebook button is a strip button. The name pencil is the title pencil. An unwritten
link in Build: the unwritten line's look (a `size.rule` `line` rule, its field name `type.small`
`dim`). The generic sheet (2.3) uses the same rows: each nested block indented `space.md` more;
a field's name `type.label` in `dim`; fold names, `Add…` and its field names, Remove, On/Off, Move
up, Copy, Add item and every option or branch button are acts; a required constant's value
`type.small` `fg`; the typed fields and the map's Key field as the Area field, shrinking to the
free width (`minWidth: 0` in a row) so the rule never runs past the sheet. Contents' file names
are acts, wrapping in a Room sheet row under their kind's row. `Add mechanic…` and its allowed
names are acts; a greyed row is a touch target tall with no border or fill, its name
`type.control` in `dim` and its reason `type.label` beneath, in `action` when the row can be
pressed, else `dim`. Builder 2.4: Combat's `Run fights` is an act; `running the fights…`, which
stands in for it, and the answer under it (a target's name, its verdict, each table row, a
why-not line) are `type.small` `fg`, one per line in one column with `space.md` sides, a row's
cells joined by ` · ` and wrapping at word gaps, with no columns and no sideways scroll (a row wraps on a 384 px docked sheet or a 390 px phone).
Schedule's hours are Room sheet rows; an hour's number is the Area field at a fixed width that
holds two digits, not the free width; Remove and `Add hour` are acts, and `Add hour` greyed is the
greyed row, disabled. Builder 2.5: a ghost line is `type.small` in `dim` on page paper,
left-aligned at the page column's full width, one line cut with an ellipsis, a touch target tall, a `size.speechBar` dashed bar
in `dim` at its left and `space.sm` before its words (dashed and `dim`, never the `~` line's solid
`warning` bar in the margin). A ghost row is a Room sheet row: its words and reason `type.small` `dim`,
wrapping whole, a touch target tall; a variant's row only `See as`, an act. The `Seeing: … · Back` chip is a strip button.
Builder 4.2: the strip's `Map` is a strip button. The Build map sheet's rows are Room sheet rows;
its controls row is right-aligned, each glyph an act, a disabled one `type.control` in `dim`. The
drawing: the sheet's full width on `card` paper with a `size.rule` `line` frame, square, but never
so tall that the selection bar falls below a phone's half-height sheet. A room box is the map's cell
box at the zoom, `card` fill, a `size.rule` border in `dim`, its key `type.label` `fg` centred; a
selected box is `action` filled, its key in `bg`. The current room's ring is Map's: a
`size.speechBar` border in `action`, in `fg` on a selected box so the ring still shows. An exit is a
`size.rule` bar in `dim` (Map's line), never the `line` hairline, which is under 3:1 on `card`. The
unplaced row: `Unplaced (n):` `type.label` `dim`, each key an act. The selection bar: a `size.rule`
`line` rule above it, `space.sm` above its words, `<key> — selected` `type.label` `fg` with
`space.md` sides, `Go here` and `Sheet` acts. No raw widths: rules and rings are `size` tokens.
Builder 4.3: a `＋` handle is a button the size of the free cell it sits in (at least a touch
target, as a room's), no fill or border, its `＋` `type.control` in `action` centred. `Join…`,
`Move…`, `Area…`, `＋ up`, `＋ down` and `Cancel` are acts in the bar's row. Armed (Join…, Move…):
the prompt takes the selected line's place in the same `type.label` `fg`, the selected box keeps its
`action` fill, the handles go and the row holds `Cancel` only. An unplaced room picked shows the
Move… prompt over its usual acts (`Go here`, `Sheet`, `Area…`). Area…'s field
is the Room sheet's Area row between the words and `Cancel`. A refusal is the Room sheet's refusal
line at the sheet's top; a refused put-back is the strip's `warning` line.
Builder 5.1a: the Dialogue sheet is the generic sheet; a choice is a fold. `Rename`, `Remove choice`,
`Add choice`, a link's fold (`then: <key>`), each link pick, `Clear` and `Open <key>` are acts; the
`Choice key` field is the map's Key field, its placeholder `type.small` in `dim`. A link and its
nested set are each indented `space.md` more; the set's prompt and labels `type.small` in `dim`,
one per line, wrapping. `＋ Add dialogue` on the Person sheet is an act.
Worst pair: `warning` on `card`,
4.75 (light).

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
