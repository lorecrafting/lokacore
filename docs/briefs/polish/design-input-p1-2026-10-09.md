# Design input: batch P1, Loka picker + polish panel (Beads loka-x6t.3)

Developer tool inside Storybook, not Book UI. Owner words and PM rulings: Beads loka-x6t,
loka-x6t.3; lane: [live polish session](../../WORKFLOW.md#live-polish-session).

## Separation rule

- The addon never imports `mobile/app/book/tokens.ts` or any `book/` module, and never adds a
  node to the story's layout: the preview overlay is `position: fixed`, max z-index,
  `pointer-events: none` except while picking. The Tidewave 74 px strip goes with Tidewave;
  stories get `100vh` back.
- Manager side (panel, toolbar) uses only `storybook/theming` roles (`theme.color.secondary`,
  `.positive`, `.warning`, `.negative`, `theme.textMutedColor`, `theme.appBorderColor`,
  `theme.background.app`, `theme.typography.size.s1/s2`, `.fonts.mono`). `manager.ts` already
  maps the base roles to the Book's light palette; positive/warning/negative stay Storybook's
  defaults, so status colour reads as tool, not page.
- Preview side (overlay) has no theme; it uses two plain values: `#1EA7FD` (Storybook blue,
  separate from every Book palette) and `#FFFFFF`. No other raw colour in the addon.

## 1. Picker overlay (preview iframe)

- **On/off.** Toolbar TOOL button "Pick" (crosshair icon, active state = `barSelectedColor`,
  like the viewport tool); key `P` (unused by Storybook; the preview forwards keydown).
  Turning Pick on opens the Polish panel if hidden. `Esc` clears the pending pick; a second
  `Esc` (nothing pending) turns Pick off. Pick stays on after a submit.
- **While picking** a transparent capture layer takes every pointer event: no click reaches
  the story (a tap would turn the page). Pick off = Storybook as today.
- **Hover.** Outline `2px solid #1EA7FD` at 60 % alpha, no fill, on the hovered element's
  border box (`getBoundingClientRect`, rounded). Label chip, 11 px `ui-monospace`, white on
  `#1EA7FD`, padding 2 px 6 px, radius 2 px, placed above the box's top-left (flipped to below
  when the box top < 20 px; clamped inside the 414 px viewport): `EntityLine › Tap · 382×28`.
  The chain is the React dev fiber owner chain, named components only (RNW `View`/`Text`/
  `Pressable` and Storybook decorators dropped), root-most first, at most 4 deep.
- **Click** pins the element: outline 2px solid 100 %, fill `#1EA7FD` at 12 %, chip gains the
  pick number `1`. **Shift-click** adds up to 4 elements (`2`..`4`); plain click replaces.
  Click on a pinned element unpins it.
- **No note box in the iframe.** The composer lives in the panel (section 2), which is full
  height beside a 414 px story, so nothing ever covers the picked element and a tall pick
  (whole Page) still works; the manager focuses the textarea on pick. The pinned outline stays
  until send or `Esc`.
- **Keys in the composer.** `Cmd/Ctrl+Enter` sends; `Enter` is a newline; `Esc` clears the
  pending pick and text. An element is optional: a feel request ("make it calmer") is text only.

## 2. Polish panel (manager addon panel, `panelPosition: 'right'`)

Set in `manager.ts`; Storybook keeps the owner's dragged width (no API for it). Tab title
`Polish`, with ` · n working` while n > 0. One column, top to bottom:

- **Header (sticky, 40 px).** Left: session pill, 12 px: green dot + branch name
  (`polish/2026-10-09`) when `bin/polish_session.sh` serves a session; grey dot + "No session ·
  picks go to Beads" otherwise. Right: **Close batch**, outline button 28 px high, only while a
  session runs. Click = inline confirm in the same row: "Close batch · 7 items?  Close  Cancel";
  disabled while any item is `working` (`polish_session.sh close` refuses a dirty tree).
- **Conversation (scrolls; newest at bottom; autoscroll only when already at bottom).**
  - Owner item: 3 px left rule in `theme.color.secondary`, padding 8 px 10 px.
    Row 1: element chip(s) (mono 12 px, `appBorderColor` border, 24×24 thumbnail at left) +
    story title in muted 12 px. Row 2: prompt, 14 px. Row 3 (12 px muted): status dot + word ·
    model badge · summary · short sha (mono). Clicking a chip re-pins that element in the
    composer (a follow-up). Clicking the thumbnail toggles the full crop at panel width.
  - Status words and dots: `received` hollow grey; `working` pulsing `secondary`; `done`
    `positive` + one-line summary + `abc1234`; `Beads loka-xxx` `warning` + reason;
    `stopped` `negative` + reason (agent could not, PM note). Model badge: `SONNET` / `FABLE`,
    10 px uppercase, 1 px border, no fill; shown from `working` on (the PM routes first).
  - PM message: full-width card, 1 px `warning` border, label `PM` in muted small caps, text
    ("suggest closing: review load is at 12 items"), buttons **Close batch** (opens the same
    inline confirm) and **Keep going** (dismisses). Any other PM note: same card with
    `appBorderColor`, no buttons.
  - Empty state (session running, no items), centred muted 12 px: "Press P or Pick, then click
    anything in the story. Shift-click adds elements. Type a feel request without picking."
  - No session: same list; new items show `queued for Beads`, then `Beads loka-xxx` after
    `/polish-intake`. Composer stays usable.
- **Composer (sticky bottom).** Pending chips row (each with ×), textarea 3 rows growing to 8,
  hint line 11 px muted "⌘↩ send · esc clear · ⇧click adds an element", **Send** button
  (primary). `fable:` / `quick:` are typed prefixes; no control for them.

## 3. Payload

| Owner sees in the item | Sent to the agent (queue JSON) only |
|---|---|
| prompt; element chain; W×H; thumbnail; story title; `light · iPhone 11` | note, pick id, time; story id; palette; viewport name + size; per element: chain, box (x y w h), computed padding/margin/font-family/size/line-height/colour/background, `innerText` (≤ 200 chars), accessible role + name, `data-testid` if any; crop PNG path (box + 24 px, device pixel ratio 2) |

The owner never sees computed styles or JSON; a `Copy JSON` affordance is not needed.

## Proposed checks (developer slice)

- ast-grep: no `import` from `book/` under the addon directory.
- Overlay off: the story's `#storybook-root` boxes are identical with the addon loaded and
  not (one smoke assertion).
- Raw colour literals in the addon: exactly the two overlay constants; the manager files use
  theme roles only.

## For the owner

1. Composer in the panel, not a floating note box over the story (so a pick never gets
   covered). OK?
2. `P` as the Pick key; `Esc` twice to leave Pick.
3. Close batch disabled while an item is `working` (PM can still close by hand).
4. Screenshot: if the in-page crop needs a small dependency (html-to-image), take it; a
   server-side re-render would not match a Live story.

Owner 2026-10-09 (paraphrased, Beads loka-x6t.3): all four as recommended; Pick button + `P`,
shift-click up to 4, Esc clears; small screenshot via dev-only html-to-image; Close batch disabled
while an item is working.
