# Design input: loka-n5l, entity line tap target adds visible space

Owner, verbatim: "button should not have extra top and bottom margin or pdding, it makes the
space between items and paragraphs too big" (Live/First room, "Elspeth is here.").

## Cause

`Tap` (`mobile/app/book/pages.tsx:44-55`) sets `minHeight: size.touch` (44) with
`justifyContent: 'center'`. A one-line `type.body` child is 28 px, so every Tap shows 8 px of
empty paper above and below its text, on top of the page's `space.block` (14) gap. Paragraph
to entity line reads as 22 px; two entity lines sit 44 px apart instead of 28.

For the record, the mock is not a 28 px rhythm either: `.ents button` is `padding: 6px 0;
min-height: 40px; line-height: 1.4` (`docs/design/ui-exploration/chapter-one-playable.html:85`),
a 40 px row on a 25 px line. The owner's feedback on the app overrides it; the catalogue's
Page row already says entity lines are "touching".

## Decision (design-system terms)

Mechanism: **bleed, not height**. `Tap` keeps `minHeight: size.touch` and `justifyContent:
'center'` (the 44 px hit area is never cut) and adds `paddingVertical: space.md` with
`marginVertical: -space.md`. The padding is inside the pressable's box, so the hit area and
the web focus ring include it; the equal negative margin removes it from layout, so the
visible footprint is the child's own height (a 28 px `type.body` line stays 28 px; a line with
a note stays 28 + 28, `note` being `type.body` in `dim`). `space.md` = 8 = (`size.touch` − `type.body.lineHeight`) / 2, the one
value that makes a body line's hit area exactly 44 with no visible padding; no new token.

Not `hitSlop`: react-native-web 0.21 implements `hitSlop` only on the legacy `Touchable`
(`node_modules/react-native-web/dist/exports/Touchable/index.js`); `Pressable` and `View`
drop it, so the web hit area would stay 28 px. Padding + negative margin works on both
platforms and is one style, no measurement, no `onLayout`.

### Consumers (all through `Tap`; none changes its own code)

| Consumer | Child height | Visible footprint after | Hit box |
|---|---|---|---|
| `EntityLine` `mobile/app/book/lines.tsx:19` | 28 (+28 with a note) | 28 (56) | 44 (72) |
| `VerbLine` `mobile/app/book/actions.tsx:45` | 28 | 28 | 44 |
| Room title (Look) `mobile/app/book/pages.tsx:262` | 24 + `space.md` below = 32 | 32 | 48 |
| `Position` `mobile/app/book/Status.tsx:122` | 19 (`type.small`) | 28 (`minHeight` 44 − 16) | 44 |

`Position` is the one consumer whose footprint stays above its text (28 on a 19 px status
line, down from 44 today). The status row is `alignItems: 'center'`, so the line stays
centred; accept, it is a 9 px step down, not a new fault. A later slice may pass the room
title and status their own bleed if the owner sees it.

### Spacing (token names)

- Entity line, or verb line, to a paragraph above or below: `space.block` (14), the Page's gap;
  the bleed adds nothing visible. Today 22.
- Two entity lines in a run (NPCs, items, held, worn, Inside, Contents): 0; the pitch is
  `type.body.lineHeight` (28). Today 44.
- NPC run to item run in Here (`pages.tsx:185-200`, two Views): `space.block`.
- Entity line to its carried note: 0, the note's own `type.body` line (28), unchanged.
- Verb lines after the entity lines: one View (`pages.tsx:148`), so they touch at 28; nothing to do.

### Overlap of neighbouring hit areas

Allowed. Each 44 px hit box bleeds 8 px over whatever is around it, and whatever renders
later takes the overlap on both platforms: the next line in a run, the scroll area under the
fixed title, the row under the status position, the block under a Worn item or the water
Surface line. Measured guaranteed targets: a body line inside a run 28 px (its pitch), a line
with one covered side 36 px (a run's end, a Worn item, the Surface line, the status
position), the room title 40 px, a free-standing Tap 44 px. All above WCAG 2.5.8's 24 px;
the rule text in the catalogue says this, not "44 everywhere". A tap in the bleed zone opens
the line whose text it is nearest to, never the other one, because the bleed never crosses a
neighbour's text midline (8 < 14); a non-pressable line touching a Tap (a Worn slot label)
lends it the bleed.

## Catalogue rule text (docs/BOOK-UI-COMPONENTS.md)

Line 15, replace "Every pressable is at least `size.touch` in both axes" with:

> Every pressable's hit area is at least `size.touch` in both axes. A text pressable
> (`Tap`: entity lines, verb lines, the room title, the status position) takes no visible
> height for it: its box is `minHeight: size.touch` with `paddingVertical: space.md` and an
> equal negative margin, so the shown line keeps the page rhythm and the hit area bleeds
> `space.md` onto the paper around it. Touching Taps in a run overlap by that bleed; the later
> line wins the overlap, so a line in a run is a `type.body.lineHeight` (28 px) target, never
> under WCAG 2.5.8's 24 px. Cards, tiles and Controls (`size.card`, `size.touch` with their own
> padding) keep their height visible; only `Tap` bleeds.

Entity line row (line 115), after "The whole line is the touch target.", add:

> Its visible height is the text's own (`type.body` line, then the note); the 44 px hit area
> is `Tap`'s bleed, so consecutive lines touch at the body line pitch and the Page's
> `space.block` alone separates a run from a paragraph.

Design tokens, "Space, size, radius" (line 81), add one sentence:

> `space.md` is also `Tap`'s vertical bleed: (`size.touch` − `type.body.lineHeight`) / 2, the
> one value that gives a body line a 44 px hit area with no visible padding; change
> `type.body.lineHeight` or `size.touch` and recheck it.

No change to `docs/system/book-ui.md`: no interaction rule moves.

## Risks

1. **Focus ring.** `:focus-visible` outlines the pressable's border box (`palette.ts:80`), so
   a Tab onto an entity line draws a 44 px ring (+2 px offset) that overlaps the neighbouring
   lines' text by 10 px. Visible on web keyboard use only. Accept: a ring that shows the hit
   area is honest; if the owner dislikes it, the alternative (`outline` on the inner Text)
   needs a per-component rule, which the Focus token rule forbids.
2. **axe `target-size` in `storybook:smoke`** (`.storybook/preview.tsx:63`, `a11y: { test:
   'error' }`). axe-core is not installed in the local tree (`npm ls axe-core` empty), so I
   could not read the rule's default. If `target-size` runs: a lone Tap passes (44 px box);
   a run of entity lines (`stories/Page.stories.tsx:96-99`, `VerbLine.stories.tsx:28`) is the
   case to watch, since axe measures each target's unobscured rectangle and a middle line's is
   28 × width (the next sibling obscures its bottom 16 px), ≥ 24, so it should pass; if axe
   instead reports the overlap as a failure, the fix is a story-level `a11y` rule note, not a
   taller row.
3. **Hit-test order on native.** RN resolves overlapping siblings to the later one as well
   (reverse-order hit test); unverified on a device for this slice. A one-line check: tap the
   top 8 px of the second of two entity lines on Android and see the second open.
4. **Scroll content height.** Negative margins on the first and last child of the Page's
   ScrollView pull 8 px into the `space.page` padding; the hit area may extend 8 px into the
   page margin at the top and bottom. Invisible, fine.

## Proposed checks (developer slice)

- Story `Book/EntityLine` → add `Run` (three touching lines, one with a note) with a play that
  asserts the second line's `getBoundingClientRect().height` is 44 and the distance between
  the first and second line's text tops is `type.body.lineHeight` (28): breaks if the bleed is
  lost or the minHeight dropped. It also puts a run under axe in the smoke (risk 2).
- Same play, click at the second line's top edge + 4 px and expect the second `onPress`,
  not the first: breaks if hit-test order flips.
- ast-grep: no `marginVertical` with a negative literal outside `Tap`
  (`sg -p 'marginVertical: -$_'` restricted to `mobile/app/book`, allow `pages.tsx`): keeps the
  bleed in one place.

## Open questions

- Owner: is the room title's 48 px hit box (title line + its `space.md` under-padding + bleed)
  fine, or should the fixed title get no bleed? It shows nothing; only keyboard users see the
  ring.
