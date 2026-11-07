# Status line: design rulings for loka-15g, loka-kgd.7, loka-x6t.63 and loka-x6t.134

Decided, one pass, before the prologue stacks fed, refreshed, cold, tired and bleeding at once (beats 9 to 41). The spec is [Conditions details](../system/book-ui.md#conditions-details); this record holds the reasons. No new component, token or page type: the status icon row ([StatusIcon.tsx](../../mobile/app/book/StatusIcon.tsx)), its Tooltip and disc, and the Character page carry it all.

## Rulings

| Question | Ruling | Why |
|---|---|---|
| Short form (kgd.7) | Bleeding leaves the text line and becomes a status icon, the debuff look. The line keeps only the sky glyph and weather, position and pools. No word is abbreviated | Conditions are already icons; bleeding was the one text item. An icon replaces the whole line, so nothing needs a short spelling |
| Bleeding's icon | Hold tip `statusTip`-shaped ("bleeding, 37s remaining"); its name is the bleeding line's parts joined by ", ", then the polarity and action ("bleeding, 37s remaining, 1 HP each 60s, debuff, opens Character"), as every icon name joins. No countdown ring until `BleedingView` carries a duration (PM protocol item); the presenter never back-computes one | The screen reader keeps every fact the old line said. A ring from a guessed duration would show a wrong share |
| Character page | Keeps the full bleeding and condition lines, unchanged | The full list lives in one place |
| Cap (15g) | Up to six icons show; seven or more show five and a +N disc. Same on every width | "First two" was written for text items and is superseded. Widths: [x6t.134](#below-the-line-smaller-drawn-loka-x6t134) |
| Precedence | Bleeding, then debuffs, then neutral, then buffs; projected (canonical) order within each group | The threats stay visible when the disc swallows the rest. `kind` is projected, so the presenter has no thresholds and the order is stable |
| +N disc | Tap opens Character (unchanged). Hold, hover or focus shows the Tooltip listing the hidden labels in row order; its name is "+2 more, fed, refreshed, opens Character" | Reuses Tooltip; no popover or new component |
| Announcing | A new condition is announced by its log narration only, through the one polite live region. The row adds no announcement | Announcements keep one source |
| Motion | An arrival behind the disc gets no pop, nor does an icon revealed from behind it. An icon pushed behind the disc leaves without the expiry fade, which stays reserved for an ending. Reduced motion: no pop (unchanged). Flashes off: unchanged, a scale is not a luminance change | The pop means "new" and the fade "ended"; neither a reveal nor a push is |
| Contrast | Buff glyph `fg` on `card` 12.2 / 12.6 / 10.3 / 9.5 (light / dark / dawn / dusk); debuff glyph `bg` on `fg` 13.1 / 13.8 / 11.5 / 11.0; neutral glyph `dim` on `card` 4.9 / 5.9 / 5.3 / 5.1; debuff border `danger` on `bg` 8.4 / 8.1 / 7.4 / 7.4; ring arc `fg` 13.1 / 13.8 / 11.5 / 11.0, track `dim` 5.3 / 6.4 / 5.9 / 5.9. The disc edge (`line` on `bg`, 1.35 to 1.53) is under 3:1 by design | The glyph and the debuff's solid fill tell the icons apart, not the edge |
| Icon frame (x6t.63) | Superseded by [x6t.134](#below-the-line-smaller-drawn-loka-x6t134) | |
| First icons | Bleeding, fed, refreshed, cold, tired (the prologue's five; hungry and thirsty were retired as statuses, owner 2026-11-04: food and drink now give a regen buff instead of curing a penalty); then every other label in use; then drawn buff, debuff and neutral fallbacks for any other label | What a player meets first |
| Wait for icons? | Superseded by [x6t.134](#below-the-line-smaller-drawn-loka-x6t134): the owner asked for drawn icons (2026-11-04) | |
| Icon naming | Ruled in [x6t.134](#below-the-line-smaller-drawn-loka-x6t134) | |
| Spirit and reverie | Keep hiding the whole status row, the bleeding icon included | [Spirit state](spirit-state-rulings.md); reverie as specified |

## Slice tests

- At 360 px (galaxyS25), Standard size, the five prologue states (bleeding, fed, refreshed, cold, tired) and a position: the status line is one line and the row under it shows five icons, bleeding first.
- Seven statuses: five icons and "+2"; the disc's name lists the two hidden labels. Red control: cap at seven.
- A buff arriving while the row is full: no pop; a debuff arriving pushes a buff behind the disc with no fade.
- Seven statuses down to six: the revealed icon shows without a pop.
- Spirit state and reverie draw no bleeding icon.

## Below the line, smaller, drawn (loka-x6t.134)

Owner, 2026-11-04 (paraphrased): put the status icons below the status line, make them smaller, and draw icons that show what each status is, not placeholders. No new component, token or page type; `size.statusIcon` changes.

| Question | Ruling | Why |
|---|---|---|
| Position | The row is the last child of the status block: line, experience rule, then the icons, then "save not confirmed" when pending. Centred in the page column, no added margin: each 44 px box's own air (11 px above and below the disc) is the spacing. With no icon showing (the last fade done) the row takes no height. The line moves 44 px when the first icon arrives or the last fade ends, with no animated height. The Tooltip still opens above its icon, now over the status line | Owner's ask. The experience rule belongs to the line it underlines. A reserved empty row is the gap the owner would see most often. The tip never takes a touch, so covering the line costs nothing |
| Size | Disc 22 px (`size.statusIcon`, was 28), glyph area 14 px (`size.statusIcon − space.md`, no new token), the box stays 44 px (`size.touch`) in both axes, columnGap 0 so the boxes abut and never overlap; no hitSlop. The ring follows the disc: 22 + 2 × (2 + 1) = 28 px, the rise card's ring too. "+N" stays `type.label` (11 px): one digit fits the 22 px disc; two digits may touch its edge, accepted | Smaller to the eye, the same to the thumb (WCAG 2.5.8, BOOK-UI-COMPONENTS touch rule). Six boxes take 264 px of the 328 px at 360 px (16 px footer padding); seven take 308, so the cap is for clutter, not width, and stays six |
| Drawings | Hand-authored SVG path `d` strings, one file in the Book (`mobile/app/book/statusGlyphs.ts`), keyed by the label text key, drawn by Skia `Path` (already installed; Gradient.tsx precedent), stroke only, in the look's ink. No new dependency (`react-native-svg` is not installed) | One family in one place; Skia already loads on native and web |
| Drawing frame | viewBox 0 0 24 24 drawn at 14 px; stroke 2.5 units (about 1.5 px), `fill: none`, round caps and joins; all geometry, stroke included, inside 3 to 21 (the path's centreline inside 4.25 to 19.75); at most four strokes, where a sun's rays, a snowflake's arms or an eye's lashes count as one; a distinct outline at 14 px; no letters, digits, emoji or fill. One family: the same stroke, corner rounding and weight on every icon | Matches the old 1.5 px line at the smaller size; a 3-unit margin keeps the stroke off the disc edge |
| Naming (schema) | The Book maps the projected `label` text key to a drawing; keys sharing a motif map to one drawing (`condition.cold`, `condition.chilled`). Bleeding is fixed in the Book. A label with no drawing gets its polarity fallback. **Not a contract change**: `label` is already in ConditionView. `ponytail:` upgrade to an `icon` name on StatusDefinition (a contract change, normal reviewer) if two statuses need one label's key differently or a second author arrives | Smallest option with one author and about forty labels. Supersedes "byLabel does not scale": the fallback makes a miss safe, and a check (below) makes it visible |
| Fallbacks | Buff: one upward chevron `M7 14l5-5 5 5`; debuff: one downward chevron `M7 10l5 5 5-5`; neutral: a ring `M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0`. The +N disc keeps its text | A plain sign of polarity, never a letter |
| Contrast | Unchanged: the ink and fills are the same, so the figures above hold. Each stroke is a graphic, needing 3:1 (WCAG 1.4.11); the lowest is the neutral `dim` on `card`, 4.9 | |
| Motion | Pop and fade unchanged; reduced motion and Flashes off unchanged. The row's height change is not animated | |
| Screen reader | Names, tips and labels unchanged; the drawing is `aria-hidden` (no `accessibilityLabel`), as the placeholder text was | The name already says what the status is |

### Drawings (designer, 2026-11-04)

The family is drawn in [statusGlyphs.ts](../../mobile/app/book/statusGlyphs.ts) to the frame above; the contact sheet (every drawing at 1× and 4× in its look, light and dark) is the review artefact, rendered from the file, not kept in the repo. Where a suggested motif did not read at 14 px the drawing changed; the list below is what is drawn. The developer wires the file into StatusIcon and adds the Storybook story (every drawing in each look, light and dark, at 360 px).

- **Prologue.** bleeding: a drop with a small drop beside it. fed: a bowl with two steam curls (warm, buff look). refreshed: a mug with a handle (the sprout read as a weed; a mug says "a drink"). cold (and chilled): a six-armed snowflake. tired: a closed eye, three lashes down.
- **Debuffs.** parched: a drop struck through (drought, not thirst: the showcase's `condition.parched`). hungry and thirsty: retired (First icons row), no drawing; the two paths still in statusGlyphs.ts go with the file's next edit. poisoned: a round vial, a bubble inside. burning: a flame. shocked: a lightning bolt. stunned: an inward spiral (three stars on an arc read as a frown). wet: a drop over a ripple. soaked: a drop over two waves. overheated: a thermometer. windburnt: three swept wind lines. afraid: a wide eye, small pupil, two tremble marks. cursed: a ghost with two eyes (the spiral went to stunned). hushed: a speech bubble struck through (the finger over lips had no silhouette). scarred: a line crossed by three stitches. gored: two flared horns, one U (one horn read as a feather). bruised: a plaster with its pad bar (the blotch read as a target). notched: an upright blade with a nick, cross-guard and grip. wanted: a notice with a pin and one line. word_travels: two arcs spreading from a dot.
- **Buffs.** well_fed: fed's bowl. hearty: a heart. well_rested: a crescent moon and a small star. blessed: a halo over a round head (rays read as a dish). mighty and might: two stacked upward chevrons. inspired: a four-point spark. warded: a shield. warm: a small sun.
- **Neutral.** hidden: an eye struck through. disguised: a domino mask. hound_dream: a paw print.
- **Never in the row** (statuses on things or NPCs): spoiling, rot, growing, growing_croft, withered, ruin, weathering, hen_fed, spent, furious. No drawing.
- **Keys the developer must map.** `condition.cold` and `condition.tired` are drawn but no cartridge defines them yet (the prologue is not authored); `condition.chilled` exists and shares cold's drawing. When the prologue's cold and tiredness statuses are authored, their label keys must be these, or the map gains their keys. Bleeding's key is `condition.bleeding` (its label text key).
- **Weakest reads**, for the owner's eye: fed's steam over the bowl can read as a smiling face; wanted reads as a clipboard; disguised reads as goggles; gored as a plain U. Everything else was recognised on the sheet at 1×.

### Slice tests (x6t.134)

- No status: nothing under the experience rule; the block's height equals the old line alone. One status: the row under the rule. Red control: reserve the row's height when empty.
- Each box measures 44 × 44 and boxes do not overlap; the disc 22. At 360 px six icons sit on one row.
- A mapped label draws its path; an unmapped buff, debuff and neutral label draw their fallbacks; bleeding draws its own drawing.
- The drawing is hidden from the screen reader; every icon name is unchanged (the existing name tests pass untouched).
- The rise card's ring at 28 px.

### Proposed check

A test that lists every status label in the cartridges and fails on one that has no drawing and is not on a short "never in the row" or "fallback on purpose" list, so a new status is drawn or knowingly left to its fallback.
