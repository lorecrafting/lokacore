# Round ink action buttons: exploration for the combat hotbar (loka-x6t.131)

Design input for the owner's hotbar session (after E5, loka-vduxr.53; with loka-x6t.110, .111, .69).
The sheet: Storybook `Docs/Ink buttons` (story `docs-ink-buttons--sheet`; day and night by the palette toolbar)
([mobile/app/stories/InkButtons.stories.tsx](../../mobile/app/stories/InkButtons.stories.tsx), drawing in
[inkButtons.tsx](../../mobile/app/stories/inkButtons.tsx)). Three showcase skills (`skill.blade`,
`spell.flamma`, `spell.ward`) by nine styles at hotbar size on a mock Combat page bottom; the fourth
button of each row (`~`) is its still cooldown or disabled frame.

**Picked: Inked** (owner 2026-11-05). The rule is now the [Inked icon style guide](icon-style-guide.md) and the
[Combat hotbar](../system/book-ui.md#combat-hotbar) section; the questions below are answered there (fixed strip,
four slots at `space.xl`, author order, wedge for cooling and no wedge for barred, the list from the last slot, no
captions). The sheet stays as the record of what was compared; the `Hotbar` story shows the pick in every state.

Constants every variant shares (so they compare on style alone): one touch target
(`size.touch`), the glyph in the status glyphs' frame ([statusGlyphs.ts](../../mobile/app/book/statusGlyphs.ts):
24 box, stroke 2.5, round caps) scaled to 28 px, every colour a palette role
([tokens](../../mobile/app/book/tokens.ts)), no animation.

## Variants

| Name | Idea | Trade-offs |
| --- | --- | --- |
| Ring | The status icon's kin: card disc, hairline `line` ring, `fg` glyph; cooldown is the Ring countdown's arc in `fg` (StatusIcon). | Most consistent with the status line; quietest, so it can read as a status rather than a control. Cooldown arc is the known idiom. Graphics contrast: `line` ring on `bg` is below 3:1 in both palettes; the glyph carries it. |
| Inked | Solid `fg` disc, paper glyph; cooldown is the ink returning as a wedge over a `dim` disc. | Best legibility at 44 px, strongest "pressable" weight. Four solid discs make a heavy band under prose. Wedge reads without colour. |
| Seal | Outline and glyph in `action`, paper inside; barred drops to `line` and `dim`. | Uses the action role as the catalogue defines it (pressable). Day's action is dark red on paper: fine; night's amber is loud beside `fg`. Disabled state depends on colour and weight, not shape: weakest for colour-blind reading. |
| Blot | Filled `action` disc, paper glyph; disabled goes `dim`. | Loudest; four amber discs at night compete with the running head. Disabled reads clearly (shape and hue both change). |
| Bleed | `fg` disc with a blurred copy under it; disabled at `opacity.disabled`. | The ink-into-paper feel the owner asked for. The halo costs one Skia blur per button and reads as a shadow on dark paper (night) rather than a bleed. Disabled by opacity only: weakest state. |
| Stipple | Dotted `fg` ring (dash effect); cooldown re-inks the dots clockwise. | The dither. Delicate and clearly hand-made; dots at 2.5 px stay separate at 2x and 3x. The cooldown arc is subtle (dot colour only). |
| Fade | `fg` disc dissolving into the paper at its edge (radial gradient). | Reads as a blur, not as a fade of ink; the softest edge of the set, and the glyph loses its frame. Not recommended as drawn. |
| Rough | Card disc, shaken outline and glyph (discrete path effect): woodcut. | Strong character, matches the "drawn" status glyphs. Random deviation means two buttons of one skill differ unless the seed is fixed (it is). Glyph legibility drops at 44 px; a heavier stroke would help. |
| Heavy | No disc: a 3.5 stroke glyph on paper inside a hairline; cooldown runs on the hairline. | Lightest band; keeps the page's paper. Touch target is invisible, so placement must be regular. Hairline is below 3:1; the heavy glyph carries it. |

Colour-blind safety: every cooldown and disabled frame changes shape or value, never hue alone,
except Seal and Blot (hue and value) and Bleed (value only). Day and night: all glyphs are `fg` on
`card`/`bg` or `bg` on `fg`, above 4.5:1 in both ([status line rulings](status-line-rulings.md)).

## Recommended two

1. **Inked**, with Stipple's dots as its cooldown rim if the owner wants the dither: the only variant
   that reads as a control at a glance in both palettes, and its wedge cooldown needs no colour.
2. **Ring**: the status line's own look, the Ring countdown already specified; cheapest to build and
   to keep consistent with status glyphs. Risk: it looks like a status, not a button.

Not recommended: Fade (reads blurred) and Blot (loud at night).

## Questions for the session, with a recommendation each

1. **Placement.** Fixed strip at the page bottom, or the last block of the scroll? Recommend a fixed
   strip under the paperless Combat page (owner 2026-10-04 ruled actions are cards in the scroll; a
   hotbar is the first thing that would not be). Needs an owner ruling.
2. **Count.** Recommend four, one hand's reach on a 390 px page at `space.xl` gaps; five fits, six
   crowds the gap to `space.md`.
3. **Configurable or fixed.** Recommend fixed by the author's order for v1 (loka-x6t.111's
   configuration later); the sheet's order is attack, bolt, guard.
4. **How a cooldown reads.** Recommend the wedge (Inked) or the arc (Ring), clockwise from 12 as the
   Ring countdown does; the glyph goes `dim` while it runs. Barred (no mana, no target) is a different
   state from cooling: recommend `dim` glyph with no arc.
5. **Where the spell and skill list opens.** Recommend the hotbar's last slot opens the list as a
   PickList over the cards (loka-x6t.110), never a chip row in the game-world pane (owner 2026-10-23).
6. **Captions.** The sheet captions each button with its key for review only; recommend no caption
   on the hotbar, the key read by the accessible name.
