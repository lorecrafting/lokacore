# Book treatments: design rulings for loka-wfrgk.9 (T1)

Decided, one pass, inside the [authoring editor plan](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md#book-treatments) and the [design's audit changes](../rnd/gui-editor-design-2026-11-04.md#11-audit-changes-2026-11-04); the plan is not reopened. The reverie's brief is the owner's (2026-11-04, on loka-wfrgk.9, paraphrased): bright and luminous; only Continue shows; lines arrive at their own pace; silence. The spec is [Book treatments](../system/book-ui.md#book-treatments); the values are in [tokens](../../mobile/app/book/tokens.ts); this record holds the reasons and the numbers.

No new component or page type. Reverie reuses the scene page (`ScenePage`), `ContinueButton`, the held under-ink layer (`UnderInk`, `heldLayer.ts`) and the spirit state's chrome hiding.

## Rulings

| Question | Ruling | Why |
|---|---|---|
| What a cartridge sets | One treatment name; only that treatment's bounded parameters | The plan; a named whole is designed once for every palette and mode |
| `spirit`'s kit | `spirit.day`/`spirit.night` at `opacity.spirit`, the top chooser slot, the hidden chrome (status row, running head, minimap, joystick, say field, Contents), plain prose, no Storm light, the rise card with its countdown ring, the held lines, `mix.muffle`. Behaviour and look unchanged | It is today's revival presentation, renamed into the registry. Its spec stays in [Spirit state](../system/book-ui.md#effects-sound-and-haptics); the treatments table links to it |
| `spirit`'s parameters | None. `lines` and `seconds` stay revival's data | They are content, not look |
| `spirit` on a scene | Not selectable; the scene `treatment` enum is `["reverie"]` | Its kit needs `lines` and `seconds`, which a scene lacks |
| `reverie`'s parameters | None this slice. A later one (for example `pace`) is a closed enum or bounded integer with a designed default, and the contrast check covers every value | No consumer asks for a knob; the owner's "own pace" is the Book's designed pace |
| Look | A held under-ink layer, by polarity as spirit: ivory `#fffbf0` at 0.8 on light and dawn, pale gold `#f6e6b4` at 0.06 on dusk and dark. Still. Inside the page column; night sky untouched | Bright by day is the brief. At night any visible lift sinks `dim` and `warning` below 4.5:1 (pale gold 0.08 gives `dark.warning` 4.41), so the night form is the most the ink bears: a faint warm lift, not bright |
| Chooser | The top slot, shared with spirit; they never coexist (a scene ends the spirit state) | One layer at a time keeps 4.5:1 |
| Hidden | Running head, status row, the whole footer (catching up included) | "Only Continue shows"; the spirit state already hides the footer the same way |
| Pacing | The line starts `motion.reverie.lag` (400 ms) after the page lands, rises from the paper to `fg` over `motion.reverie` (2400 ms); Continue then shows over `motion.settle`; its place is kept so nothing moves | "At their own pace" within the engine's one line per Continue; the Book never presses Continue (ancestry and spirit precedent) |
| Impatience | A tap anywhere before Continue shows completes the line and shows Continue; sends nothing | The chapter title's tap-to-skip precedent |
| Reduced motion, Flashes off | Unchanged | An opacity rise has no movement and no peak |
| Screen reader | Line and Continue at once; title focus reads the line once | The chapter title keeps an explicit Continue for readers the same way |
| Kept place (PR #611) | The kept place is Continue itself, drawn but invisible, not pressable and hidden from touch and focus, so a wrapped label reserves its own height; a shift on wrap is a bug | The spec says nothing moves; a fixed card height breaks it at large type |
| Exit (PR #611) | No fade out: the layer goes with the page turn off the last line, as it came with the turn in | The turn is the transition; a second fade over it would muddy it |
| The opening action's cues (PR #611) | Dropped for good, every kind: its sounds, their haptics, its washes and flashes, its first-time gilt. Never held for the end, never played at the open. The press's own selection haptic stays | The reverie replaces that moment; a held clang after the dream would land out of context. The log and status row still carry what happened |
| Sound | Bed, weather and music fade over `motion.bed` on the turn in; no sound inside, page turns and Continue included; the next bed opens after the turn out. The selection haptic stays | "Silence" is about sound; a haptic is felt |
| Words | None new. Continue's label is the engine's offered button | No chrome word is needed |

## Contrast numbers (WCAG 2, every text role)

| Palette | Paper under reverie | `fg` | `dim` | `action` | `danger` | `warning` | Worst |
|---|---|---|---|---|---|---|---|
| light | `#fbf7eb` | 15.26 | 6.15 | 8.76 | 9.75 | 5.96 | 5.96 |
| dawn | `#f9f4eb` | 14.77 | 7.54 | 8.56 | 9.53 | 7.20 | 7.20 |
| dusk | `#38334d` | 9.45 | 5.07 | 6.52 | 6.37 | 4.81 | 4.81 |
| dark | `#1e2227` | 12.03 | 5.60 | 7.56 | 7.04 | 4.63 | 4.63 |
| light/dawn mid-blend | `#faf5eb` | 14.99 | 6.75 | 8.63 | 9.61 | 6.48 | 6.48 |
| dusk/dark mid-blend | `#2b2a3a` | 10.80 | 5.43 | 7.13 | 6.80 | 4.79 | 4.79 |

Before reverie the worst roles are light 5.12, dawn 5.61, dusk 5.61, dark 5.29. The night cap is about 0.07; open owner question: if a brighter night is wanted, it needs a darker night `warning` and `dim`, a palette change (not this slice).

Continue is opaque (`fg` fill, `bg` label: 11.0 to 13.8), so the layer does not touch it.

## Toolbox row and its check

Each treatment is a toolbox row (summary, hosts, parameters, sampler, showcase). Reverie's sampler is a `scene_sampler` scene with `treatment: "reverie"`; spirit's is today's revival sampler and showcase. Stories: one per state (reverie arriving, reverie with Continue shown, on light and on dark).

The developer's check must:

1. Iterate the Book's treatment registry, not a written list, and fail when a name in the scene schema's `treatment` enum (plus implicit `spirit`) has no registry entry, or the reverse.
2. For each treatment, each of the four palettes and the two same-polarity mid-blends, assert every text role (`fg`, `dim`, `action`, `danger`, `warning`) at least 4.5:1 on `mixInk(bg, ink, peak)` for that palette's polarity, and for each value of each parameter once parameters exist.
3. Assert one held layer at a time with the treatment on top, given fatal, low health and a lit lamp.
4. Red control: `opacity.reverie.night` at 0.08 fails `dark.warning`.

## Developer brief must carry

- The chooser takes a treatment name (`spirit`, `reverie` or none) in place of the `spirit` boolean; revival maps to `spirit`.
- Reverie draws only on a scene whose view carries `treatment: "reverie"`; a scene without it is unchanged.
- The Continue gate is presentation only: no timer ever sends the scene's button.
