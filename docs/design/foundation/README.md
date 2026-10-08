# Book design foundation (2026-10-07)

The design system's base: [tokens](../../../mobile/app/book/tokens.ts), the
[component catalogue and page-turn rules](../../BOOK-UI-COMPONENTS.md#design-tokens), the
[page curl shader](../../../mobile/app/book/page-curl.sksl) and the [specimen](specimen.html).
The owner approved it as spec and sample alongside E2; applying it in app code is the
[polish phase's](../../decisions/owner-decision-chapter-one-polish-order-2026-10-07.md) job.
Owner direction (paraphrased): take the base design from the
[Chapter 1 mock](../ui-exploration/chapter-one-playable.html) with every effect off, plus its
page curl and paper sound; the mock overrides live values where they differ; interaction
rules do not change. This page is the audit and the mock-against-live record.

## Audit of the live Book (main `294062aa`, `mobile/app/book`, `App.tsx`, `SaveError.tsx`)

- **Raw colours:** 6 hex literals, all in [`paper.ts`](../../../mobile/app/book/paper.ts); none elsewhere.
- **Raw numeric style literals:** 57 in 10 files outside `paper.ts` (`Footer.tsx` 18, `pages.tsx` 11,
  `DiscoveredMap.tsx` 10, `Book.tsx` 5, `Menu.tsx` 4, `MapDrawing.tsx` 4, `SaveError.tsx` 2,
  `Body.tsx`, `Combat.tsx`, `Turn.tsx` 1 each). About 18 are drawing geometry (`MapDrawing`,
  the Map's room cards, the footer label placement) and stay exempt. Six font-style literals
  (italic, weight 500, small caps, underline).
- **Sizes in use:** font 15, 17, 18, 22, 26, 32; spacing 5, 8, 10, 12, 14, 24; durations 160, 320.
- **Duplicates:**
  1. `small` small-caps style defined twice: `Book.tsx:33` and `Footer.tsx:22`.
  2. `Tap` plus an inline `{ ...prose, color: paper.accent }` re-draws `Act`/`Leave` 11 times
     (`pages.tsx` 103, 193, 309, 397, 407; `notices.tsx` 73, 87, 106, 156; `Menu.tsx` 83, 194).
  3. Bare 44px `Pressable`s beside `Tap`: `Book.tsx:306`, `Book.tsx:320`, `Footer.tsx:122`,
     `Footer.tsx:225`, `DiscoveredMap.tsx` 26, 39, 83, 117.
  4. The page shell rebuilt: `NpcPage` (`Menu.tsx:128`, title 32) and `Combat` (`Combat.tsx:16`, title 26).
  5. The detail-history renderer twice: `pages.tsx:168` and `Menu.tsx:143`.
- **Inconsistent with the written rules or each other:**
  1. Local controls in ink while siblings use accent: Back to container `pages.tsx:186`,
     Close `DreamPage.tsx:34`, Resume dream `DreamPage.tsx:47`, Back to map `DiscoveredMap.tsx:123`.
  2. Held items (`pages.tsx:298`) open details but look like plain prose; worn items use accent.
  3. The locked status Contents button (`Footer.tsx:225`) keeps the accent colour.
  4. Riddle letter tiles (`Menu.tsx:79`) are one glyph wide, under 44px across.
  5. `ScenePage` passes an empty title (`pages.tsx:420`), so it draws an empty header.
  6. `Turn` (`Turn.tsx:9`) ignores the system's reduced-motion setting.

No defect changes what a tap does, navigation or returns; each item above is presentation
for the polish phase.

## Mock against live

Mock values are computed through the mock's cascade (its phone text is 18 × 0.86 = 15.48px,
so `em` sizes resolve against that).

| Token | Mock | Live | Note |
|---|---|---|---|
| Light palette `bg fg dim line action` | `.ph` | same | `paper.ts` already matches |
| `card` | `#e4decd` | none | new: action cards, tiles |
| `danger` / `warning` | `--p-bad`, `.foot .mid` | `accent`, `mid` | renamed by role |
| Dark palette | `.ph.unlit, .ph.lamp` | none | new |
| `type.body` | 18 / 1.55 | 18 / 28 | same |
| `type.log` | 17 (0.95em) | 18 | smaller |
| `type.roomTitle` | 22.4 / 1.1 | 26 | smaller |
| `type.pageTitle` | 31 / 1.05 | 32 (Combat 26) | one size |
| small caps | IM Fell English SC, 11–14 | EB Garamond `small-caps`, 15 and 17 | third font to bundle |
| `type.small` (status) | 13 | 15 small caps | body face |
| `space.page` | 24 (22 top) | 24 | 22 → 24 |
| `space.block` | 14 | 8 (`Sheet` gap) | wider |
| `space.sm` | 6 (7 in the footer) | none | |
| room title padding | 18 / 10 | 24 / 10 | → `space.xl` / `space.md` |
| `size.touch` | 38–48 | 44 (height) | 44 both axes; the spec wins over the mock's 38–40 |
| `size.minimap` | 44 | 56 | |
| `size.footerRule` | 92 | flex | fixed width |
| `radius.card` | 7, 9, 10 | none | one value |
| `opacity.disabled` | 0.45 (tiles 0.25) | none | one value |
| `motion.quick` | 0.15–0.18 s ease | 160 linear | |
| `motion.turn` | curl, 720 ms in-out quad | swing, 320 ms ease-out cubic | the curl replaces the swing |
| `sound.pageTurn` | synthesised `pageSound` | none | new |

Adopted from the mock: the paper palette and its dark counterpart, both fonts and the small-caps
face, the type scale, hairline rules, spacing, the page layout, MUD entity lines, the log, the
footer and status line forms, action cards, the page curl and its paper sound.
Left out (no tokens or entries): paper grain and edges, pressed ink, wear, ink drying, twilight,
candle, weather and sky, page flutter, burns and spells, pickup pop, damage flash, chapter and
level-up cards, gilt words, low-health blur, the moon palette, the lamp glow, the damp variant
of the page sound, the travel riffle, and every "Archive, not in v1" item. The mock's text
drawer, chips and shop rows have no live consumer.

## Proposed checks (developer slice, after `paper.ts` is retired)

1. ast-grep rule in `lint/rules`: no string matching `#[0-9a-fA-F]{3,8}` or `rgb(` in
   `mobile/app/book/**` or `mobile/app/*.tsx` outside `tokens.ts`.
2. ast-grep rule: no numeric literal as the value of `fontSize`, `lineHeight`, `letterSpacing`,
   `padding*`, `margin*`, `gap`, `rowGap`, `columnGap`, `borderRadius` or `minHeight` in
   `mobile/app/book/**`, except `MapDrawing.tsx`, `DiscoveredMap.tsx` and `joystick.ts`.
3. ast-grep rule: no `fontFamily` string literal outside `tokens.ts`.
4. A unit test: every `color.light` and `color.dark` role meets WCAG 4.5:1 on `bg` for
   `fg`, `dim`, `action`, `danger`, `warning` (today light `warning` passes on `bg`, 4.74,
   and fails on `card`, 4.4: no warning text may sit on a card).
5. A compile check: `page-curl.sksl` compiles with `RuntimeEffect.Make` once
   `canvaskit-wasm` is a dependency.

Each needs a red control in its slice.
