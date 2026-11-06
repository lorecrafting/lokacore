# Inked icon style guide (loka-x6t.131)

The owner picked **Inked** from the [exploration](ink-buttons-exploration.md) (2026-11-05, paraphrased):
a solid ink disc, a paper glyph, the cooldown as a wedge of ink returning. This guide is the Book rule for
the [combat hotbar](../system/book-ui.md#combat-hotbar)'s buttons and for every future action icon (a
skill, a spell word, an opener). Status icons keep their own look ([status-line-rulings](status-line-rulings.md),
[StatusIcon](../../mobile/app/book/StatusIcon.tsx)); the two share one glyph frame so a spell and the
condition it causes can share a drawing (`spell.flamma` and `condition.burning` do).

Every number below is a token or arithmetic on one ([tokens.ts](../../mobile/app/book/tokens.ts));
the exploration's constants in [inkButtons.tsx](../../mobile/app/stories/inkButtons.tsx) are the reference
drawing. The guide names the token; the code never repeats the number.

## Grid

| Part | Token | Rule |
| --- | --- | --- |
| Canvas | `size.touch + space.md` square | The disc plus the focus ring's width and offset (`size.focus` each) on every side; `aria-hidden`. |
| Disc | diameter `size.touch` | Centred; the whole pressable, so one disc is one touch target. No hitSlop: the gap is the rest. |
| Glyph box | `size.touch − 2·space.md` square, centred | The status glyphs' 24 box scaled up to it (`scale = box / 24`), as StatusIcon scales the same box down. |
| Gap between buttons | `space.xl` | Four buttons in one row, centred; the gap never shrinks to fit (fewer slots, not tighter ones). |
| Strip padding | `space.lg` above and below the canvases | The strip's height is one canvas plus the padding; the page's scroll ends above it. |

Why one frame for status and action glyphs: a glyph drawn once serves both (a condition's icon and the
spell that casts it), and the author learns one box. The hotbar's box is 28 to the status icon's 14,
so a glyph that is clear at 14 is clear here; the reverse is the test to pass
([drawn, smaller](status-line-rulings.md#below-the-line-smaller-drawn-loka-x6t134)).

## Glyph: box, stroke, corners

The frame is [statusGlyphs.ts](../../mobile/app/book/statusGlyphs.ts)'s, unchanged:

- An SVG path `d` in a 24 box; ink inside 3 to 21 (stroke centreline inside 4.25 to 19.75), so the glyph
  stands off the disc's edge by at least `space.md` after scaling. A glyph that touches the disc reads as a
  notch in the disc, not a drawing.
- Stroke 2.5 units, round caps and joins, no fill. The stroke is the status glyphs' so the two match in
  weight when they sit on one page; a heavier stroke blots at 28, a thinner one is the Ring variant the owner
  did not pick. Where a shape must read as solid (a blade), close the path and let the stroke's width carry it;
  a filled region would be the only fill in the Book's drawings.
- At most four strokes (subpaths), one idea. A fifth stroke is detail the 14 box loses.
- Corners: every join is round (the frame's `strokeJoin`); no angle between two strokes sharper than 45°,
  because a sharper join's round cap swells past the stroke and reads as a dot. Prefer arcs to polylines
  for curves (an arc stays smooth at every scale; a three-segment curve shows its joints at 28).
- Symmetry about the vertical axis where the idea allows (the blade, the ward); an asymmetric idea
  (a flame, a dot pattern) leans right, never left, so a row of glyphs reads as one hand.
- No letters, digits, emoji, arrows-as-text or filled regions; dots are allowed (`dot(x, y)`: a stroke of
  near-zero length with round caps).

## Tokens, day and night

The disc and glyph take palette roles only; the four palettes (light, dawn, dusk, dark) differ in value, never
in role.

| Part | Ready | Pressed | Cooling | Barred | Empty slot |
| --- | --- | --- | --- | --- | --- |
| Disc | `fg` | `fg` at `1 − opacity.press` | `dim` | `dim` | none |
| Wedge (ink returning) | none | none | `fg`, clockwise from 12 over the elapsed share | none | none |
| Wedge seam | none | none | `bg` stroke of `size.rule` on the wedge's two radii | none | none |
| Glyph | `bg` | `bg` (the disc thins under it) | `bg` | `bg` | none |
| Ring | none | none | none | none | `line` at `size.rule`, radius the disc's |

The seam is why the wedge reads: `fg` on `dim` is below 3:1 in every palette (measured 2.48 light, 1.96 dawn,
1.86 dusk, 2.15 dark), so the wedge's two edges are drawn in paper, which stands against both inks at 5:1
or better. The owner's words "the glyph goes dim" are met by the disc going `dim` under the paper glyph;
the glyph itself never changes ink, so it keeps its contrast while the button is off.

Measured contrast (WCAG, from `tokens.ts` on 2026-11-05):

| Pair | light | dawn | dusk | dark |
| --- | --- | --- | --- | --- |
| glyph `bg` on disc `fg` | 13.10 | 11.51 | 11.02 | 13.76 |
| glyph `bg` on disc `dim` | 5.28 | 5.88 | 5.92 | 6.41 |
| wedge `fg` on disc `dim` (why the seam) | 2.48 | 1.96 | 1.86 | 2.15 |
| focus ring `action` on paper `bg` | — | 6.67 | 7.61 | 8.65 |

The light palette's `action` on `bg` is the catalogue's; the document focus ring is the same for every
control ([palette.ts](../../mobile/app/book/palette.ts) `useFocusRing`), so the hotbar adds no ring of its own.

## States

| State | What the player sees | Why |
| --- | --- | --- |
| Ready | Solid `fg` disc, `bg` glyph. | The heaviest mark on the page says "pressable" at a glance under running prose. |
| Pressed | The disc's ink thins by `opacity.press` over `motion.press`, then recovers; no travel, no grow. | The Tap's press ([press.ts](../../mobile/app/book/press.ts) `useThin`); a disc that moved would jostle the row. |
| Cooling | `dim` disc; a `fg` wedge from 12 o'clock growing clockwise over the cooldown's elapsed share, its radii seamed in `bg`; the glyph stays `bg`. Full ink at the end, then the disc is ready with no flash. | The Ring countdown's direction (StatusIcon), so one clock reads the same above and below the log. Ink returning is the metaphor: the mark dries back in. |
| Barred | `dim` disc, `bg` glyph, no wedge. | Off without a clock: the shape differs from cooling (no wedge) so the two states never rely on hue. |
| Focused | The document focus ring: `size.focus` in `action`, offset `size.focus`, around the disc. | The canvas is sized for it; no second ring is drawn. On device there is no ring (no keyboard). |
| Empty slot | A `line` hairline ring on paper, nothing inside; not focusable, no name. | Keeps the four positions still as skills come and go; a vanished disc would shift its neighbours. |
| Opener (last slot) | Ready look with the opener's glyph: three dots on the horizontal midline (`dot(7,12)`, `dot(12,12)`, `dot(17,12)`). | The ellipsis idiom already means "opens a list" in the Book (a PickList's label ends in one); never a chevron or plus. It is never cooling or barred. |

Motion: the wedge sweeps linearly between confirmed views as the Ring drains
([StatusIcon.tsx](../../mobile/app/book/StatusIcon.tsx) `drainMs`): to the projected end over at most the
gap since the last view, never ahead of the clock. Under reduced motion the wedge steps at each confirmed view and
the press shows its thinned frame without the tween (the rule in `press.ts`: the state change still shows; only
travel goes). No pop on arrival, no fade on expiry: the strip's slots are still; only the disc's state changes.

Hit area: the disc's bounding square, `size.touch`. The seam, wedge and ring are drawing, never targets.

## Recipe: a new skill or spell icon

1. Name the idea in three words; if it needs more, pick a part of it (the ward is a shield outline, not a
   person behind a shield).
2. Draw in the 24 box on paper or in any SVG editor; keep ink inside 3 to 21; stroke 2.5 round; at most four
   subpaths; no fill. Check every join against the 45° rule and prefer `A` arcs to bent polylines.
3. Write the path as a `d` string on one line, keyed by the thing's text key, next to the status glyphs'
   drawings (one map per family, same frame): `'skill.blade': 'M10 15.5V7.5L12 4.5 14 7.5V15.5zM7.5 15.5h9M12 15.5v4'`.
   A spell that causes a condition reuses the condition's drawing by reference, never a copy.
4. Render it on the hotbar story at both scales (the hotbar's 28 and the status icon's 14) in day and night;
   it must read as its idea at 14 with no caption. If it does not, remove a stroke.
5. Check the barred and cooling frames: the glyph must still read on `dim` with the wedge behind it (the
   wedge passes behind the glyph, never over it).
6. No drawing yet: the slot shows the status glyphs' neutral ring (the fallback in
   [status-line-rulings](status-line-rulings.md#below-the-line-smaller-drawn-loka-x6t134)); the key still names the
   button. The missing-drawing check (below) lists it.

## Do and don't

| Do | Don't | Why |
| --- | --- | --- |
| One stroke weight, 2.5 in the 24 box. | Vary weight for emphasis. | The row reads as one hand; emphasis is the disc's state, not the glyph's weight. |
| Round caps and joins. | Butt caps, mitred corners. | The Book's drawings are pen strokes on paper, not a vector logo. |
| Paper glyph on an ink disc. | Ink glyph on paper, outlined discs, gradients, blurs, textures. | Those were explored (Ring, Seal, Bleed, Fade, Rough) and not picked; one look. |
| State by shape: wedge for cooling, no wedge for barred. | State by hue or opacity alone. | Colour-blind and night readers; the glyph keeps full contrast in every state. |
| Reuse a condition's drawing for the spell that causes it. | Draw a second, similar glyph. | One drawing per idea; the player learns it once. |
| Keep the glyph still. | Spin, pulse or bounce a glyph. | Combat lines land every round; a moving strip pulls the eye off the log. |
| Let the accessible name carry the word. | Caption the button. | Owner 2026-11-05: no captions; the key is the name. A caption would be the one word row in a wordless strip. |
| Four slots at `space.xl`. | Fit more by shrinking the gap. | The gap is the strip's whitespace; below `space.md` thumbs miss. |

## Accessibility

- Contrast: glyph on disc at least 5.2:1 in every state and palette (table above); the cooling wedge is
  bounded by paper seams, so its edge is 5:1 or better against both inks.
- Colour-free states: ready (solid), cooling (wedge), barred (no wedge), empty (ring only) differ by shape;
  the accessible name carries the state in words too (the hotbar spec's keyboard and screen reader rules).
- Reduced motion: no tween on the wedge or the press; the frames still change.
- Touch: one `size.touch` target per button; `space.xl` between them.
- The drawing is `aria-hidden`; the pressable owns the name and state.

## Proposed checks (developer slice)

- **Icon frame**: every `d` in the action glyph map keeps its ink inside 3..21 and has at most four
  subpaths (a path parser over the map, as the status glyphs' slice test does).
- **Missing drawing**: list every skill and spell word key in the showcase cartridge that has no drawing
  (fails on a new key until the drawing lands or the key is listed as fallback on purpose), as
  [status-line-rulings](status-line-rulings.md) proposes for conditions.
- **No raw value**: `lint/rules/mobile-book-raw-values` already covers the hotbar's files; the style guide
  adds nothing to it.
