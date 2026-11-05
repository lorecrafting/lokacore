# Status line: design rulings for loka-15g, loka-kgd.7 and loka-x6t.63

Decided, one pass, before the prologue stacks hunger, thirst, cold, tiredness and bleeding at once (beats 9 to 41). The spec is [Conditions details](../system/book-ui.md#conditions-details); this record holds the reasons. No new component, token or page type: the status icon row ([StatusIcon.tsx](../../mobile/app/book/StatusIcon.tsx)), its Tooltip and disc, and the Character page carry it all.

## Rulings

| Question | Ruling | Why |
|---|---|---|
| Short form (kgd.7) | Bleeding leaves the text line and becomes a status icon, the debuff look. The line keeps only the sky glyph and weather, position and pools. No word is abbreviated | Conditions are already icons; bleeding was the one text item. An icon replaces the whole line, so nothing needs a short spelling |
| Bleeding's icon | Hold tip `statusTip`-shaped ("bleeding, 37s remaining"); its name is the bleeding line's parts joined by ", ", then the polarity and action ("bleeding, 37s remaining, 1 HP each 60s, debuff, opens Character"), as every icon name joins. No countdown ring until `BleedingView` carries a duration (PM protocol item); the presenter never back-computes one | The screen reader keeps every fact the old line said. A ring from a guessed duration would show a wrong share |
| Character page | Keeps the full bleeding and condition lines, unchanged | The full list lives in one place |
| Cap (15g) | Up to six icons show; seven or more show five and a +N disc. Same on every width | Six 44 px boxes take 294 px of the 328 px at 360 px; seven take 344. "First two" was written for text items and is superseded |
| Precedence | Bleeding, then debuffs, then neutral, then buffs; projected (canonical) order within each group | The threats stay visible when the disc swallows the rest. `kind` is projected, so the presenter has no thresholds and the order is stable |
| +N disc | Tap opens Character (unchanged). Hold, hover or focus shows the Tooltip listing the hidden labels in row order; its name is "+2 more, fed, refreshed, opens Character" | Reuses Tooltip; no popover or new component |
| Announcing | A new condition is announced by its log narration only, through the one polite live region. The row adds no announcement | Announcements keep one source |
| Motion | An arrival behind the disc gets no pop, nor does an icon revealed from behind it. An icon pushed behind the disc leaves without the expiry fade, which stays reserved for an ending. Reduced motion: no pop (unchanged). Flashes off: unchanged, a scale is not a luminance change | The pop means "new" and the fade "ended"; neither a reveal nor a push is |
| Contrast | Buff glyph `fg` on `card` 12.2 / 12.6 / 10.3 / 9.5 (light / dark / dawn / dusk); debuff glyph `bg` on `fg` 13.1 / 13.8 / 11.5 / 11.0; neutral glyph `dim` on `card` 4.9 / 5.9 / 5.3 / 5.1; debuff border `danger` on `bg` 8.4 / 8.1 / 7.4 / 7.4; ring arc `fg` 13.1 / 13.8 / 11.5 / 11.0, track `dim` 5.3 / 6.4 / 5.9 / 5.9. The disc edge (`line` on `bg`, 1.35 to 1.53) is under 3:1 by design | The glyph and the debuff's solid fill tell the icons apart, not the edge |
| Icon frame (x6t.63) | The 28 px disc (`size.statusIcon`) in a 44 px box, the ring outside it. A glyph is single-colour vector line art in a centred 16 px area, 1.5 px stroke, round caps and joins, in the look's ink; each a distinct silhouette; no text, letters or emoji | One frame for the family; ink from the look keeps every palette's contrast |
| First icons | Bleeding, hungry, thirsty, cold, tired (the prologue's five); then the showcase's fed and refreshed; then drawn buff, debuff and neutral fallbacks for any other label | What a player meets first |
| Wait for icons? | No. The build ships on the placeholders (debuff '−' for bleeding). Drawing the family is a separate exploration: escalated to the PM for a Fable designer | A new icon family has no precedent in the system |
| Icon naming | Open: how a status names its icon is a schema gap for the PM (perhaps a name from a closed Book set, as treatments are chosen). Not ruled here | Keying on cartridge text keys (`byLabel`) does not scale |
| Spirit and reverie | Keep hiding the whole status row, the bleeding icon included | [Spirit state](spirit-state-rulings.md); reverie as specified |

## Slice tests

- At 360 px (galaxyS25), Standard size, the five prologue states (bleeding, hungry, thirsty, cold, tired) and a position: the status line is one line and the row shows five icons, bleeding first.
- Seven statuses: five icons and "+2"; the disc's name lists the two hidden labels. Red control: cap at seven.
- A buff arriving while the row is full: no pop; a debuff arriving pushes a buff behind the disc with no fade.
- Seven statuses down to six: the revealed icon shows without a pop.
- Spirit state and reverie draw no bleeding icon.
