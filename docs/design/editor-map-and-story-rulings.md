# Map and Story in the left column: design rulings for E3a and S2

Decided, one pass, inside the [authoring editor plan](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md) (the map is always visible, zoomable, may grow to fill the column; no modes; the map selects without playing), the [GUI editor design](../rnd/gui-editor-design-2026-11-04.md) section 3 (what the Map draws, what E3b edits) and the [story map design](../rnd/story-map-design-2026-11-05.md) (sections 5, 5d, 6, 7, 10; its eight recommendations are accepted). Nothing there is reopened. Colour, type, size and icons are the [editor chrome rulings](editor-chrome-rulings.md): section 4 already rules the room, hull, chip and path marks and is not repeated here. Values: `chrome` in [tokens](../../mobile/app/book/tokens.ts). Nothing of this enters the Book.

Both slices draw in the one Map slot of the left column (`tools/author-panel/src/left.tsx`, `MapSlot`), chosen by the existing Map | Story segment. Measured on the merged E2 shell in Chrome at 1440 × 900: the slot is 280 × 192 at the column's default width; the column ranges 220 to 480.

## The slot (both slices)

| Ruling | Why | Test |
|---|---|---|
| **Height.** A divider between the hierarchy and the slot, the column's own `Divider` (drag, arrow keys, double-click resets): default 240, min 160, max the column with the hierarchy's tab strip left (the hierarchy list may reach zero rows). Persisted with the layout; Map and Story share it | The plan's "can grow to fill the column" with the shell's one resize idiom; no second control | Drag the divider to the top: the slot fills the column under the tab strip; reload keeps the height; double-click returns 240 |
| **Header.** One `size.header` row: the segment at the left; the view's own controls after it; nothing at the right (the column is 220 at its narrowest). Under the view a one-line footer in `type.label` `dim` with counts (below) | The 32 px row is the chrome's; counts in the footer leave the header for controls | At column width 220 the header's controls do not wrap or clip |
| **Empty and waiting.** Before the first `/story`: `Waiting for the watcher.`; a refused model: the refusal sentence in `refusal` with `circle-alert`. One line, no button | Chrome section 5 empty states | A `/story` 4xx shows one line and no map |

## E3a, the map

Data the map needs, named here and chosen by the developer (one read, no new protocol): every room with its `exits` (direction, target, barrier, hidden), its area (the folder of its file), the `layout.json` rows, `reachReport`'s `unreachable.rooms` and `behind_lock.rooms`, the Book's current room (`here`) and the rooms the Book's session has visited (the same set the Book's own Map draws). Exits are the graph; layout is only where to draw.

```
 ┌ homestead ───────────┐
 │ ┌──────┐   ┌──────┐  │        ┌──────┐
 │ │croft │───│yard  │──┼────────│lane… │   edge: 1 px strong, one line per reciprocal pair
 │ └──────┘   └──┬───┘  │        └──────┘
 │             ┌─┴────┐ │  ╱▲ up stub       ╌╌╌ hidden exit (dashed)
 │             │cellar│ │  ─┼─ barrier tick  ──▶ one-way (arrowhead)
 │             └──────┘ │
 └──────────────────────┘
```

| Ruling | Why | Test |
|---|---|---|
| **Grid.** A layout unit is a 64 px cell at zoom 1; a room is a 48 × 24 rounded rect (`chrome.radius`) centred in its cell. These and the marks below are drawing constants in one `const` block at the top of `Map.tsx`, exempt from the space tokens as `DiscoveredMap`'s are; colours only from `chrome` | A room box is one dense row high; 16 px between boxes keeps an edge readable | Two rooms at `x` 0 and 1 draw 64 px apart at zoom 1 |
| **Label.** The room's key in `type.code`, not scaled with zoom, clipped to the box with `…` (mono: 7.2 px per character at 12 px). At zoom under 1 labels hide, except the selected, current and hovered room, which always carry their full key in a label pill over the drawing. The full key, title and exits are in the room's accessible name and in a `<title>` | At 280 px the map is a locator and the hierarchy the index; three rooms always readable is what the eye needs | At zoom 0.5 a room with no state shows no label; the selected one shows its whole key |
| **Overview.** Below zoom 0.5 a room is a 6 px disc in `strong` (hollow dashed when unreached); hulls and their labels stay | 200 rooms at 15 × 15 cells need zoom 0.27 to fit 264 px: the shape and areas are what remain legible | At zoom 0.3 every room is a disc and every hull label is drawn at 11 px |
| **Exits.** One 1 px `strong` line per reciprocal pair, box edge to box edge, straight even when the layout contradicts the direction. A one-way exit (no reciprocal) ends in an arrowhead at its target. A barrier draws a 6 px tick across the midpoint, the barrier key in the title. A hidden exit is dashed | Exits are the graph, layout is a drawing: a contradiction stays visible for E3b's drag. The tick is the Book minimap's barred-exit mark | A pair draws one line; an exit with `barrier` draws a tick; an exit with `hidden` draws dashed |
| **Levels.** One `z` at a time; a stepper in the header (`chevron-up`, the level number in `code`, `chevron-down`), shown only when rooms span levels. An `up` or `down` exit is a 12 px stub from the box's top-right or bottom-right corner at 45°, ending in a 5 px triangle pointing up or down (the Book's stair nodes lean the same way). Selecting a room on another level switches the level | Stacking levels in 280 px is unreadable; the Book's Map shows one level with a stepper too | A room at `z` 1 is not drawn at level 0; selecting it from the hierarchy switches the stepper to 1 |
| **Unplaced.** Rooms without a layout row are chips in an `Unplaced (N)` strip under the drawing, hollow dashed (the unreached chip style); a strip only when N > 0 | Nothing is hidden; E3b's drag places them from the strip | A room absent from `layout.json` appears in the strip and nowhere in the SVG |
| **Hulls.** One rounded rect per area per level, the bounding box of its rooms padded `space.lg`, `chrome.radius`; label at its top-left inside in `type.label` `fg`; areas by sorted id, drawn before rooms. Overlaps draw both | A rectangle is predictable and cheap; the hull's fill at 0.12 reads through an overlap | Two areas whose rooms interleave draw two hulls, both labels visible |
| **Reach.** Always on, no toggle: an unreachable room is hollow with 1 px dashed `dim` stroke and `dim` label; a room behind a lock carries a 14 px `lock` at its right end at zoom 1 and above. Footer: `64 rooms · 9 areas · 2 unreached · 3 behind lock · 3 unplaced` (zero counts omitted) | "No modes"; chrome section 4's unreached mark, not colour alone | A room in `unreachable.rooms` draws dashed and its accessible name ends `, unreached` |
| **Path and here.** Visited rooms take the `fg` stroke, the current room the `map-pin` and semibold label (chrome section 4). When `here` changes to a room outside the viewport the map pans to show it (`motion.quick`); a manual pan or zoom holds until the next move | The Book moving is the owner's own act; following it costs nothing they did not ask for | Step the Book into an off-screen room: its pin is inside the viewport |
| **Zoom and pan.** Wheel pans; Cmd/Ctrl-wheel and pinch zoom about the cursor; drag on empty ground pans; `+` `-` zoom by 1.25, `0` fits the level; `zoom-in`, `zoom-out`, `maximize` buttons in the header. Limits 0.25 to 3; the content's box always keeps one cell inside the viewport. Fit is the opening state. Wheel moves are instant; key, button and fit moves take `motion.quick`, cuts under reduced motion | Trackpad idiom; limits so the map cannot be lost | Pan past the edge: the last cell stays visible; `0` after any zoom shows the whole level |
| **Click.** Click selects `{file, kind: 'room', key}` and plays nothing; double-click is Go to room (the console states a refusal in its sentence); Alt-click is `POST /open`; a `Go here` button sits in the header while a room is selected. Selection from the hierarchy, Book or inspector inks the ring, switches level and pans only if the room is outside the viewport | The plan: map and hierarchy select, the Book plays; the Story triad is the same | Click: selection set, no step recorded; double-click: one `dev_go_to_room` step |
| **Keyboard.** The SVG is `role="group"` named `Area map, level N`. Tab enters on the selected room (else the current, else the first by sorted key). Arrows move to the nearest room within 45° of that direction on the level; PageUp and PageDown change level; Enter selects; Shift-Enter is Go here; `+` `-` `0` as above; Esc returns to the segment. The focused room draws a 2 px `accent` rect offset 2 (the chrome's ring, drawn in SVG because `outline` on SVG is unreliable) | One geometry rule, deterministic, reaches a disconnected room | Right arrow from `square` lands on the nearest room east; Enter sets the selection |
| **Screen reader.** Each room is a `role="button"` in the SVG named `<key>, <title>, <area>, level N, exits: north to <key>, up to <key>` plus `, unreached` / `, behind a lock` / `, here` / `, selected`; DOM order is area then key. Hulls, edges and stubs are `aria-hidden`. A live region announces `level N, M rooms` on a level change | The rooms are the list; no duplicate structure to drift | Axe at error level passes; a room's name lists every exit |
| **Light and dark.** Every mark from `chrome.light` or `chrome.dark` by `.dark` on `<html>`; hull hues from `chrome.area` | Chrome section 1 | No hex in `Map.tsx`; the owner walk screenshots both |
| **Left to E3b** ([loka-wfrgk.7](../rnd/gui-editor-design-2026-11-04.md)). Drag (writes the layout row, places an unplaced room), draw and delete edges, one-way toggle, barrier drop, new room from here, move to area, hover card | Section 3's split | E3a's map has no pointer handler that writes |

## S2, the Story list and Trace

```
 PART ONE  THE DRY WELL            32 px header, label role
 ▾ 12  The stone speaks        ~    beat: 28 px, swatch, n, title, status word
     ⚑ thera_stone                  node: 28 px, kind icon, key, badges at right
     ◌ meet_thera        ⚠ 2  ~1    refusal count, ~ count
 ▸ 13  Night at the well     missing
 ▸ Unplaced (14)
 ─────────────────────────────────
 Trace  saw_sphere               ×   lower section, at most half the slot
   set at   thera_stone  · beat 12
   read at  gate_scene   · beat 15 (dashed)
```

| Ruling | Why | Test |
|---|---|---|
| **One tree.** Parts (`size.header`, `type.label` uppercase) hold beats (28 px rows) hold the nodes bound to them (28 px, indented 16); a trailing `Unplaced (N)` part holds nodes bound to no beat, collapsed. Expanded parts and the scroll position survive a reload. Without `outline.json` the list is the Unplaced part under one `dim` line, `No outline.json; every node is unplaced.`, no button | The screen-reader form of Flow (design section 10); useful before an outline exists | A planted model with no outline renders N node rows; collapsing a part and reloading keeps it collapsed |
| **Beat row.** A 16 px status swatch at the left carrying the chip rule of chrome section 4 (built: `surface` and `strong`; `~`: `warningSoft` and `warning`; missing: hatched; unreached: hollow dashed), then `n` in `code` `dim`, the title in `body`, and at the right the status word in `type.label` `dim` (`~`, `missing`, `unreached`; built says nothing). A missing beat's row names the missing ref in its title attribute and accessible name | A 28 px chip across a row is heavy; the swatch keeps the pattern, the word keeps it not colour alone | A `missing` beat shows a hatched swatch and the word `missing`; a `built` one shows no word |
| **Node row.** Kind icon 14 px (chrome section 6's set), key in `code`; badges at the right: `circle-alert` in `refusal` with the count of diagnostics whose `rel` is the node's file, `~` with its count in `warning`; an unreached node's text is `dim` with `, unreached` in its name. A node with refusals carries their words in its `title`; the inspector's console lists them on select | Design section 6; `title` is the lean hover for S2 (S3's hover card replaces it) | A node whose file has two diagnostics shows `2` beside the alert icon and `2 refusals` in its name |
| **Seeds.** A `Seeds` part after the outline's parts: rows `seed <n> · no payoff` and `payoff <n> · no seed` in `warning` with `triangle-alert`; absent when both lists are empty | The owner's first question (which seeds have no payoff) as rows, not a sentence | A planted `unpaid` entry renders one warning row |
| **Click.** Click selects `{file, kind, key}` (hierarchy, map, inspector follow); double-click opens the prose at the node's first `~` (E5); Alt-click `POST /open`. Selection from elsewhere expands the node's part and scrolls its row into view; a room selected on the map inks nothing in the list (S3) | Design section 7's triad | Select a scene in the hierarchy: its row is visible and `aria-selected` |
| **Trace.** A `route` ghost button (14 px, `Trace <key>`) on fact, quest and story-point rows, shown on hover and focus as the hierarchy's Play is; `f` on the focused row; Cmd-K `trace <key>`. Trace opens the lower section of the slot: header `Trace <key>` with `×`, contents per design 5d as rows; at most half the slot, scrolling. A Trace row is a node row: click selects it and the list expands and scrolls to it. Tracing sets no selection. Esc or `×` closes; one lower section at a time (Trace, Knowledge or Pacing) | Follow-a-fact inking across the graph is Flow's (S3); in S2 following is reading the Trace | Trace a `read_only` fact: a `never set` row; click a `set at` row: that node is selected and visible |
| **Knowledge and pacing.** The same lower section: pick a beat row's `Knowledge` ghost button to list `knows` / `may know` / `not yet`; the pacing panel lists parts with word counts, the thin part first, in `warning`. Each is one line of `dim` caveat at the top (`assumes the beats in outline order`) | One place for panels; the caveat is the design's honest limit | The knowledge panel for beat N on a planted two-choice set lists the fact under `may know` |
| **Keyboard.** `role="tree"`: Up and Down move, Left collapses or goes to the parent, Right expands, Enter selects, `f` traces, Esc closes the lower section then returns to the segment. Shift-Enter and Backspace (first outbound and inbound) arrive with S3's hover card, where their buttons live | Every shortcut has a button; S2 has no place for two more | Keyboard only: reach a beat, expand it, select a node, trace a fact, close it |
| **Cmd-K.** Entries `beat <n> <title>`, `story: <key>`, `trace <key>`; choosing one expands, scrolls and focuses the row (and opens Trace for the third) | Design section 7 | `beat 12` in the palette focuses that row |
| **Light and dark.** `chrome` only; the kind icons `strokeWidth={1.5} absoluteStrokeWidth`; the hatched swatch uses `line` over `bg` in both schemes | Chrome sections 1, 4 and 6 | No hex in the Story files; the owner walk screenshots both |

## Proposed checks

- An ast-grep rule over `tools/author-panel/src/**`: no string literal matching `#[0-9a-f]{3,8}` and no `fill`, `stroke` or `color` attribute whose value is a literal (the chrome rulings' check, widened to the map and story files).
- Axe at error level over the map and the list in the panel's smoke run; until one exists, the owner walk includes one keyboard-only pass over each.

## Known limits

- The arrow-key rule (nearest within 45°) can skip a room that an exit reaches at a steep angle; the exit is still in the focused room's name and one more arrow reaches it.
- Labels hide under zoom 1, so at the prologue's size in a 280 px column most keys are read from the hierarchy, the hover pill or by widening the column.
- `title` tooltips are not keyboard-reachable; the accessible name carries the same words until S3's hover card.
