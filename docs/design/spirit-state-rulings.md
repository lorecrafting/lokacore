# Spirit state: design rulings for loka-kgd.205

Decided, one pass, for Resurrection B (Book). The owner's brief (2026-11-02, on the Beads item, paraphrased): after death the player presses on and is at the return room; the Book reads translucent blue, ethereal; status bars and the direction pad are gone; one big button with a countdown; the room's lines tell the resurrection; on rise the Book turns solid and the controls return. The engine side is loka-kgd.206 (`world.death.revival {lines, seconds}`, presentation only, in the GameView when authored). The spec is [Spirit state](../system/book-ui.md#effects-sound-and-haptics), after Falling; this record holds the reasons, the proposed tokens and what the owner confirmed.

No new component, page type or sound. It reuses the World page, the held under-ink layer (`UnderInk`, `heldLayer.ts`), the foot Action card (the lidded container's Close is the precedent), the unavailable form, the status icon's countdown ring, the away recap's held lines and `mix.muffle`.

Owner items: 2 to 5 owner-confirmed 2026-11-04 (paraphrased), each the recommended option; 1 and 6 PM default, accepted.

## Rulings

| Question | Ruling | Why |
|---|---|---|
| When | Only with `revival` in the view; Let go from the Combat page or the dead page. Without it, Let go goes to World as today | Chapter 1 authors none; no behaviour change there |
| Where | The World page of the return room, not a new page | The room's lines are the content; no new page type |
| Clock start | When that page lands, wall-clock | The receipt arrives before Let go; a reader may hold the red for a while |
| Treatment | A held under-ink layer, top of the chooser, so fatal hold, vignette and glow do not show with it. Pale blue on `light`/`dawn`, deep blue on `dusk`/`dark`, as the blow wash splits by polarity. Still, no breathing. Inside the page column; the night sky is untouched; opaque cards stay solid | A layer keeps the hour's palette, so the rise needs no polarity cross-fade. Stacked with the glow it would fail 4.5:1. Breathing would read as the low-health vignette. Item 1, the strength (`opacity.spirit`) 0.6: PM default, accepted |
| Entering | Set with the page turn, in every mode (Flashes off and reduced motion included) | The turn is the change; nothing rises over a still page, so no flash |
| Storm | No light on a spirit page; thunder muffled | Storm's light cuts held layers; it would cut the tint |
| Hidden | Status row (line, icons, experience rule), running head, minimap and joystick, say field, Contents button. The page's links draw as plain prose | "One button". The anatomy keeps its parts, inert |
| The control | One Action card in the foot (the "big button"), the Book's only control | A foot Action card has precedent; a card is the large pressable. Item 2, the label **Rise** (`LABEL.rise`): owner-confirmed 2026-11-04 (paraphrased) |
| Countdown look | The status icon's countdown ring at the card's leading edge, draining over `seconds`; steps under reduced motion. No numerals | Existing pattern; no number widget |
| Before zero | The unavailable form: plain label, no lift, warning haptic, sends nothing, no sentence. Item 3, no early rise: owner-confirmed 2026-11-04 (paraphrased) | "With a countdown" reads as a wait. Consequence: Settings is out of reach for `seconds`, up to the schema's 600. Keep authored waits short (the showcase's 10) |
| At zero | The ring goes and the card becomes available; the Book never rises by itself. Item 4: owner-confirmed 2026-11-04 (paraphrased) | A turn the player did not ask for could land while they read |
| Line order | The return receipt's lines (`death.woke`, the keeper's greeting) and any ambient line are held and logged in order at the rise; the revival lines come first. Item 5: owner-confirmed 2026-11-04 (paraphrased) | Waking and a greeting before the resurrection is told reads backwards. Presentation only: the engine's order and the arrival split stand |
| Pacing | n lines over `seconds`: line k at k × `seconds` / (n − 1); first at once, last at zero; one line at once | The last line marks readiness for every reader, so no extra announcement |
| Revival lines in the record | They stay in the room's log after the rise | The log is the full record; no special removal |
| Rise | Local; selection haptic; layer out over `motion.palette` (reduced motion `motion.fade`; Flashes off the same); controls return at once with no arrival effect; held lines log; focus to the room title; the page does not turn | Same palette, so a fade is legal; a slow fade is not a flash |
| Sound | Bed returns on landing through `mix.muffle`, opens over `motion.bed` at the rise. No new cue (human-made assets only). Item 6, a recorded rise cue later, if wanted: PM default, accepted | Reuse; ethereal by muffling, not by a new sound |
| Screen readers | Revival and held lines read once as log lines. The card's name is its label; before zero it is disabled with the seconds remaining as its value, never announced per tick | Announcements keep one source |
| Backgrounded | The clock runs; on return what is due shows, each due line drying once, in order | Wall-clock by the engine's own wording |
| Reopen | Solid World; unplayed revival lines are gone | Nothing is stored, as Closure and the away recap |
| Fight, chapter or scene arriving | Ends the state at once, solid; held lines log; the rest of the revival drops | Combat and chapters take precedence |

## Proposed tokens

For the build slice to add to `tokens.ts` (the designer writes them with their consumer):

```ts
export const spirit = { day: '#c8dcf6', night: '#0b1e45' }; // the spirit state's layer: day on light and dawn, night on dusk and dark
// in opacity:
spirit: 0.6, // the spirit layer, held; every text role keeps 4.5:1
```

Both colours keep every text role at 4.5:1 on `bg` and `card` in their palettes even at full opacity. At 0.6 the paper reads `#d6e0ea` on light, `#d2daea` dawn, `#182245` dusk, `#0d1a35` dark; the worst roles are `warning` 4.77 and `dim` 4.93 on light, `warning` 4.98 on dark. The catalogue's Under-ink layers and Falling bullets gain the spirit layer in the same slice.

## Slice tests

- With `revival`, Let go from Combat and from the dead page lands on the tinted World page with only the rise card; without it, today's World page.
- Revival lines land at k × `seconds` / (n − 1) on a controlled clock; the card is unavailable until zero and available at it; no rise without a press.
- The return receipt's lines and an ambient line during the wait are absent before the rise and logged in order after it.
- An encounter opening mid-wait ends the state at once with the held lines logged.
- The layer chooser returns the spirit layer alone given a lit lamp and low health. Red control: return two.

## Proposed check

Extend the under-ink contrast test (effects batch 2, proposed check 1) to `opacity.spirit` over each palette with its spirit colour.
