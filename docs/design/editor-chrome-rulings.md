# Editor chrome rulings (2026-11-05)

Designer ruling for loka-wfrgk.15, before E2 (loka-wfrgk.10, the three-column shell). Scope: the
editor's chrome in `tools/author-panel` (dev only), the Map (E3a) and the Story map. The Book strip
inside it is the Book and keeps its own rules. Plan: [authoring editor decision](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md),
[GUI editor design §11](../rnd/gui-editor-design-2026-11-04.md), [Story map §10](../rnd/story-map-design-2026-11-05.md).
Values live in [`tokens.ts`](../../mobile/app/book/tokens.ts) under `chrome`; this page names roles only
where it can, and gives each value's reason.

## 1. Type and density

| Role | Face | Size / line | Use |
|---|---|---|---|
| `chrome.type.body` | `chrome.sans` (system UI) | 13 / 18 | rows, fields, buttons, feed lines |
| `chrome.type.label` | `chrome.sans`, semibold, uppercase, tracking 0.06em, `dim` | 11 / 16 | panel headers, group headings, captions |
| `chrome.type.code` | `chrome.mono`, `font-variant-numeric: tabular-nums` | 12 / 16 | ids, keys, file paths, timings, lint codes, kbd chips |
| `chrome.type.prose` | the Book's `font.body` (EB Garamond) | 15 / 22 | the player's words only: a prose field in the inspector |

- The chrome is a tool, not the Book: no Book face anywhere except `chrome.type.prose`. Today's panel set
  the Book faces on everything; E2 replaces that.
- Density: a row, an input and a button are `chrome.size.row` (28) tall; a panel header `chrome.size.header` (32).
  Spacing reuses the Book's `space`: `xs` (4) inside a control, `md` (8) between controls and as row
  side padding, `lg` (12) panel padding, `xl` (16) between groups. Radius `chrome.radius` (6);
  the Cmd-K palette 8; kbd chips 4.

## 2. Colour and theme

- The chrome follows the OS scheme, never the solar phase. Set `.dark` on the panel's `<html>` from
  `matchMedia('(prefers-color-scheme: dark)')`, with a `change` listener, and set
  `color-scheme: light | dark` with it (native scrollbars and form controls follow). The Book strip
  is an `<iframe>`, so the class cannot reach it; the Book keeps its solar palette.
- The chrome is a neutral warm grey, not paper, so the Book strip is the only paper on screen.
- Fills: `bg` (panels, the map), `surface` (inputs, inspector cards, popovers, Cmd-K), `sunken` (the
  well behind the strip, collapsed rails). `line` is a hairline, never text. `strong` is a control's
  border, at least 3:1 on `bg` and `surface` (light 3.23 / 3.53, dark 3.59 / 3.16).

Contrast of every text role (WCAG ratio), light mode:

| Text | on bg | on surface | on sunken | on accentSoft | on own soft fill |
|---|---|---|---|---|---|
| fg | 15.79 | 17.21 | 14.06 | 13.82 | 14.12 / 14.17 / 14.67 (outside / refusal / warning) |
| dim | 6.41 | 6.99 | 5.71 | 5.61 | 5.96 (warningSoft) |
| accent | 5.84 | 6.36 | 5.20 | 5.11 | |
| outside | 6.25 | 6.82 | 5.57 | 5.47 | 5.60 |
| refusal | 6.13 | 6.69 | 5.46 | 5.37 | 5.50 |
| warning | 5.62 | 6.13 | 5.01 | 4.92 | 5.23 |
| ok | 5.48 | 5.97 | 4.87 | 4.79 | |
| onFill | 6.36 on accent, 6.69 on refusal | | | | |

Dark mode:

| Text | on bg | on surface | on sunken | on accentSoft | on own soft fill |
|---|---|---|---|---|---|
| fg | 12.94 | 11.39 | 14.11 | 10.24 | 10.55 / 10.92 / 9.91 |
| dim | 6.17 | 5.43 | 6.72 | 4.88 | 4.72 (warningSoft) |
| accent | 7.10 | 6.25 | 7.75 | 5.62 | |
| outside | 7.69 | 6.77 | 8.39 | 6.09 | 6.27 |
| refusal | 7.38 | 6.50 | 8.05 | 5.85 | 6.23 |
| warning | 8.56 | 7.53 | 9.33 | 6.77 | 6.55 |
| ok | 8.27 | 7.27 | 9.02 | 6.54 | |
| onFill | 7.75 on accent, 8.05 on refusal | | | | |

Every text role is at least 4.5:1 on every fill it is used on.

E2 replaces the `--book-*` mapping. `main.tsx` sets both palettes as inline variables,
`--chrome-light-<role>` and `--chrome-dark-<role>` (inline, so never a `.dark` rule that sets the same
variable: inline wins). In `index.css` the `:root` block maps each kit variable to
`var(--chrome-light-<role>)` and the `.dark` block to `var(--chrome-dark-<role>)`:

| shadcn variable | chrome role |
|---|---|
| background / foreground | bg / fg |
| card, popover (and their foregrounds) | surface (fg) |
| primary / primary-foreground | accent / onFill |
| secondary, muted | sunken |
| muted-foreground | dim |
| accent (the kit's hover fill) / accent-foreground | accentSoft / fg |
| destructive | refusal |
| border / input | line / strong |
| ring | accent |

Add theme colours `outside`, `outside-soft`, `refusal-soft`, `warning`, `warning-soft`, `ok`,
`sunken` and `area-1` to `area-6`. Remove the comment "No .dark class is ever set".

## 3. Semantic colours

Colour is never alone: every state carries an icon or a word, because `accent` and `outside`, and
`refusal` and `ok`, fall together under protan and deutan vision.

| Meaning | Look |
|---|---|
| Selection | a selected row fills `accentSoft`, text stays `fg` |
| Focus | `:focus-visible` only: a 2 px (`space.hair`) `accent` outline at full opacity, offset 2 px; inside a clipped 28 px list, offset -2 px (inset). Replaces the kit's `outline-ring/50` and `ring-ring/50` |
| Feed row, you | no colour: the line in `fg`, the word `you` in `dim` |
| Feed row, outside | a 2 px `outside` bar at the row's left edge, and the word `outside` in `outside`, weight 600 |
| Refusal | at the field only: a 1 px `refusal` border, then under the field a `circle-alert` icon, the compiler's message in `refusal` and its fix as an `accent` link; the draft stays in the field |
| Warning | `warning` text with `triangle-alert`, on `warningSoft` where it is a badge: lint, `~` chips, unconfirmed words in the inspector, stale pickers, a timing over budget |
| Hold | the header badge `Held · N waiting` in `warning` on `warningSoft`, with a `pause` icon; the toggle shows pressed |
| OK | `ok` with a `check` icon: compiled, a timing within budget |

Consistency with the Book's [author-mode marks](prose-in-the-book-rulings.md): the same meaning
keeps the same role name on each side. Inside the Book an unconfirmed word and a `~` line stay the
Book's `warning`, a landed line the Book's `action`, the Book's focus ring its `action`; in the
chrome they are the chrome's `warning` and `accent`. A compiler refusal is shown only in the chrome,
in `refusal`; the Book's `danger` is never used for it.

## 4. Area hulls (Map, E3a) and Story map chips

The Map follows the chrome scheme, not the Book's tokens (the E3a brief said "on Book tokens";
this overrides it). Rooms: `surface` fill, `strong` 1 px stroke; a room on the shown path a
`fg` stroke; the selected room a 2 px `accent` ring; the current room a `map-pin` icon and a
semibold label.

Area palette, `chrome.area.light` / `chrome.area.dark`, six hues from Okabe-Ito and Tol: amber,
sky, indigo, green, purple, rose. Each is at least 3:1 on `bg` (light 3.00, 3.03, 11.17, 5.19,
4.82, 3.58; dark 7.23, 7.06, 3.00, 3.03, 3.10, 4.17), and every pair stays at least 19 apart
(CIE ΔE2000) under normal, protan, deutan and tritan simulation in both modes.

- Area n takes `area[i mod 6]`, i its index among area ids sorted. Areas 7 to 12 reuse the hues
  with a dashed stroke; beyond 12 the area's name label carries identity.
- Hull: the hue at 0.12 opacity (light) or 0.18 (dark) as fill, a 1.5 px solid stroke in the hue;
  the area label in `fg`. Hulls and chips sit on `bg`, never `surface` (three dark hues fall
  below 3:1 on `surface`).

Story map chips, 28 px tall, on `bg`; the kind is shown by its icon (Story map §10), the state by
fill and border:

| State | Look |
|---|---|
| built | `surface` fill, 1 px solid `strong` border, `fg` text |
| `~` | `warningSoft` fill, 1 px `warning` border, the label prefixed `~` |
| missing | 45° hatch in `line` over `bg`, 1 px dashed `dim` border, `fg` text |
| unreached | no fill (hollow), 1 px dashed `dim` border, `dim` text |

A chip's area shows only as a 3 px band in its area hue on the chip's left edge; it never fills.

## 5. Layout chrome

- **Dividers.** 1 px `line`. The drag handle's hit area is `chrome.size.handle` (8) centred on it; on hover
  or drag it shows a 2 px `accent` line and the `col-resize` cursor. Double-click restores the
  default width. Each divider is `role="separator"` with `aria-orientation="vertical"` and
  `aria-valuenow`, focusable: Left and Right move 16 px, Shift with them 64 px. Left column default
  280, min 220, max 480; right column default 360, min 280, max 560; the centre keeps at least the
  strip's width at 0.75.
- **Collapse.** Cmd-\ (left) and Cmd-/ (right), and a `panel-left-close` / `panel-right-close`
  button in each header. A collapsed column is a 28 px `sunken` rail of its panels' icons (each
  opens the column at that panel). Widths and collapse are remembered in localStorage.
- **Panel header.** `chrome.size.header`, `bg`, a 1 px `line` below. Title in `chrome.type.label`; tabs are text
  in `chrome.type.label`, the selected one `fg` with a 2 px `accent` underline, the rest `dim`. Header
  buttons are 24 px square, ghost, with a 16 px icon and a tooltip naming the shortcut.
- **Centre.** The `sunken` well: a 32 px toolbar (phone / tablet segmented toggle, the reload badge
  in `accent`, the Hold toggle and badge, the timings in `chrome.type.code`, each `ok` or `warning` against
  its budget) above the Book strip at 0.75 scale, centred.
- **Cmd-K palette.** `chrome.size.palette` (560) wide, top at 15vh, `surface`, 1 px `line` border, radius 8,
  shadow `0 8px 24px` black at 0.12 (light) or 0.5 (dark); backdrop black at 0.2 (light) or 0.5
  (dark). A 40 px input with a `search` icon; result rows 28 px with `chrome.type.label` group headings and
  the path in `chrome.type.code` `dim` on the right; the active row `accentSoft`. Kbd chips `chrome.type.code` at
  11 px, 1 px `strong` border, radius 4. It fades in over `motion.quick`; no motion under reduced
  motion. No match: one line "No match." in `dim`.
- **Empty states.** One `dim` line saying how to get content there, and at most one button. No
  illustration, no icon larger than 16 px.
- **Keyboard focus.** Every control is reachable by Tab in reading order (left, centre, right);
  focus shows as ruled in section 3. Esc closes the palette or a popover and returns focus to
  where it was.

## 6. Iconography

- lucide-react, already installed (`components.json` names it); no other icon source.
- 16 px (`chrome.size.icon`) in headers, buttons and rails; 14 px inline in a row.
- Always `strokeWidth={1.5} absoluteStrokeWidth`, round caps and joins (lucide's default): about
  the drawn line of the Book's status glyphs (2.5 in a 24 box at 14 px is about 1.46 px).
- Icon colour follows its text (`currentColor`); an icon alone has an `aria-label` and a tooltip.
- Story map kinds use the icons named in Story map §10 (`flag`, `scroll`, `message-circle`, `film`,
  `zap`, `hand`, `tag`, `book-open`, `user`).

## Proposed checks (for E2)

- A node:test over `chrome`: every text role at least 4.5:1 on `bg`, `surface` and `sunken` in both
  modes, `strong` at least 3:1 on `bg` and `surface`, each `area` hue at least 3:1 on `bg`.
- No hex colour literal in `tools/author-panel/src` outside `index.css` and the token mapping.

## Known limits

- An added area can shift the hues of the areas sorted after it.
- On the Story map areas 7 to 12 share their bands with areas 1 to 6 (a 3 px band cannot be dashed); the hull and label tell them apart.
- `dim` on `warningSoft` in dark mode is 4.72:1, the lowest pair; keep `dim` text off badges.
