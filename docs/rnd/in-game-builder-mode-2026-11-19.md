# The in-game builder: authoring inside the game screen (design, owner-approved 2026-11-19)

Owner ask, 2026-11-19 (paraphrased): everything the desktop author panel's left and right panes do
should also be possible inside the game screen, on a phone, in a builder mode. The panes stay as
conveniences on a big screen (superseded the same day: the panel retires at full parity, section 10
ruling 8). Small edit icons next to titles, descriptions and dialogue; a map you
can build rooms on; tapping into an item or NPC shows builder menu items for what a builder adds;
creating an NPC and adding its dialogues there. Text shown in the game is edited in place. The owner
asked where the "other stuff" lives: metadata, behind-the-scenes mechanics, story maps, dialogue
triggers.

Name (owner 2026-11-19): **the in-game builder**. Its switch on the game screen is **Build**.

Status: **approved by the owner 2026-11-19**, revision 2 plus the owner's answers. Section 9 holds the
decisions as ruled (every recommendation taken; 9 and 11 amended), section 10 the rulings, including the
retirement of the desktop panel at full parity (rulings 6 to 8). Phases 0 and 1 are being split into Beads. Line cites are main at `6f6214621`. Section 11 says which cites I opened
myself and which came from two read-only inventory passes.

## 1. Decisions at a glance

| Question | Decision |
|---|---|
| How a phone tells play from edit | A **Build** toggle (a mode). In Build, links and cards still play. A tap on a line's plain words (which does nothing in Play) opens that line's field in place. One pencil sits on each page's **title** and opens the thing's sheet. No pencil per body line (section 4.2 has the arithmetic). |
| The layers | Three, as the draft proposed, but placed differently. **Words** are edited in place on the page. Each thing's **sheet** holds everything that thing owns, hidden data included. The **notebook** holds what belongs to no one thing. The notebook and every summary live in Build chrome, outside the scrolling page. There are no chips on the page and no new Contents section (section 4.3). |
| The "gear" question | There is no gear. A thing's sheet *is* its gear: the title pencil opens it. Dialogue triggers live in the conversation's Build header and on the sheet. World-wide rules live in the notebook (section 4.3). |
| Hidden things | **Ghost lines**, drawn by the builder from the compiled cartridge the dev Book already holds (`mobile/app/author/shown.ts:1-3`). A "See as…" control previews a variant without touching the save. |
| Where the code lives | `mobile/app/author/build/`, React Native, behind the same gate as today's author mode (`panel.tsx:34-40`). Shared logic moves to `kernel/ts/play/` first, the way E4a moved the card logic. |
| How it reaches the Book | Through **one dev-only seam** in `mobile/app/book/Text.tsx`. Every Book word passes through that file (lint `mobile-book-text`). The seam is empty in a release. Today's author mode is a DOM overlay (`inbook.ts:42-46`, `:125` `contentEditable`) and cannot run natively. This needs an owner ruling (section 9, decision 2). |
| Generic forms | A small React Native renderer of our own, over the existing schema walker (`kernel/ts/play/ui_schema.ts`). Validation stays on the server (`/change` and the compiler), so no Ajv runs on the phone. A probe slice confirms this choice before it is built (section 6.4). |
| Talking to the server | The same author routes the panel uses (section 6.5). One new read route at most (ghost data, only if the dev artifact proves short). The phone phase adds a pairing token. |
| Parity, enforced | The registry gains a `book` surface per schema-path row, with a shrink-only `todo` baseline. A second checked list (`parity.json`) covers what the registry cannot: map gestures, story beats, checkpoints, cheats, Why, Step, Numbers, Find, worlds and Hold. Appendix A is that list's first draft. |
| Phase order | Probes and gate, then the Build shell, then sheets and things, then the **real phone**, then the map, then talk and story, then the notebook's tools. Ruling 4 puts the phone after things; the draft had it seventh. |

## 2. What this reverses, and what it must not

Ruling 1 (section 10) reverses "the Book never shows forms" (`docs/rnd/gui-editor-design-2026-11-04.md`
section 3, ruling 13) for Build only. Four more standing rules collide with the draft. Each is a decision
in section 9 rather than a silent change:

1. **"No modes"** (`docs/decisions/owner-decision-authoring-editor-plan-2026-11-04.md:35-37`: "There
   is no edit-mode toggle"). A phone has no double-click, Alt or hover, so one tap must mean either
   play or edit. The owner asked for a builder *mode*. Recommendation: reverse it on the game screen,
   and keep "no modes" in the desktop panel (decision 1).
2. **E5: "no component in `mobile/app/book/` gains a prop, a state or a word"**
   (`docs/design/prose-in-the-book-rulings.md:5`). That held because author mode is a DOM overlay. A
   native screen has no DOM to query, so pencils and fields need a hook inside the Book's tree
   (decision 2).
3. **Contents is a fixed list** (`docs/design/interaction-patterns.md`, Sections: "a further section
   without an owner decision"). The draft's section 3 added a Contents page and its section 3a a notebook.
   Both cannot stand. The notebook lives in Build chrome (decision 3).
4. **No chips or boxed tags inside a page** (`interaction-patterns.md`, section 5; room anatomy,
   `docs/system/book-ui.md:35-68`). The draft put chips under the room title. They move to the sheet's
   header (decision 4).

What does not change: the write path, the `was` checks, the journal and undo, `~` placeholders,
hand-written prose, the compiler as validator, and "a card never offers what the compiler refuses"
(`docs/HANDOFF.md:17`).

## 3. What exists to build on (read 2026-11-19)

- **Author server** (`kernel/ts/play/live.ts`, `write.ts`, `prose.ts`, `scene_card.ts`, `editing.ts`).
  Reads: `/events` (SSE), `/story`, `/checkpoints`, `/todo`, `/numbers`, `/fights`, `/find`,
  `/source`, `/schema/<dir>`, `/line`, `/world`, `/templates`, `/journal`. Writes: `/open`, `/why`,
  `/hold`, `/change`, `/edit`, `/set`, `/restructure`, `/delete`, `/move`, `/undo`, `/new`, `/world`,
  and PUT `/checkpoints/<name>` (route table in Appendix B). It binds `127.0.0.1` (`live.ts:269`).
  It refuses a Host other than localhost, and refuses a cross-origin non-GET, but **a POST with no
  Origin header passes** (`editing.ts:16-23`). There is no token. Writes answer after the rename and
  do not wait for the compile (`write.ts:75-79`). Text-only changes skip the compile as an overlay
  (`author.ts:85-97`).
- **Shared card logic** in `kernel/ts/play/`: `card.ts` (add menus, `blocked`, `placement`,
  `branchOf`, `minimal`, `cardMenu`…), `ui_schema.ts` (the walker), `edit_model.ts`, `room_card.ts`
  and `world_card.ts`. None imports React or the DOM. But `card.ts` imports `rules.ts` and `allowed.ts`
  (`card.ts:5`, `:425`), which load JSON through import attributes (`rules.ts:2`, `allowed.ts:2`).
  `edit_validator.ts` pulls in Ajv, and `scene_card.ts` pulls in `node:fs`. **Nothing in `mobile/app`
  imports `kernel/ts/play` today**, and whether Metro bundles these modules is unmeasured (slice 0.1).
- **The panel's map, story and verdict logic has no DOM.** `map.ts` has no imports.
  `mapedit.ts` imports only `map.ts`. `storylist.ts` and `verdicts.ts` show no `document`, `window`
  or `fetch`. `isolation.test.ts:28-45` forbids `mobile/app` from importing `author-panel`, so each
  module moves to `kernel/ts/play/` before the builder may use it.
- **Today's in-Book author mode is DOM-only.** `inbook.ts` finds lines with
  `querySelectorAll('[dir="auto"]')` (`:46`), edits through `contentEditable` (`:125`) and injects a
  `<style>` (`:321`). Words map to text keys by their shown words (`words.ts:187` `worded`, bound in
  `panel.tsx:41-44`). Two lines with identical words share one binding (known limit,
  `prose-in-the-book-rulings.md:36-38`).
- **The dev Book holds the compiled cartridge**, not only the view: `shown.ts` reads scripted actions,
  dialogues and facts "from the cartridge, not the view: a failing policy is exactly what hides one from
  the view" (`shown.ts:1-3`). This is the source for ghost lines.
- **The Book's pages** (`model.ts:51-66`, dispatch `Body.tsx:90-172`): World (`RoomPage`,
  `Body.tsx:203`), NpcDetail (person and conversation, `Npc.tsx:280`), Item (`Menu.tsx:244`), Inside
  (`Menu.tsx:170`), Shelf and sale (`Shelf.tsx:112`), Notice and board (`notices.tsx:131`), Dream,
  ScenePage (`ScenePage.tsx:42`), Chapter (`sections.tsx:276`), Dead, Ancestry, the six sections
  (Contents `Menu.tsx:37`, Character, Skills, Carrying, Map `sections.tsx:202`, Journal, Settings) and
  Credits. Combat appears in the model (`model.ts:63`) but its draw site was not traced.
- **Gate today**: `tools/author-panel/src/edit/registry.json` has 277 rows keyed by **schema path**
  (`kind.field`). Each row is `{create, edit, delete}`, either `generic` or a component path.
  `bin/toolbox_page.exs:192-281` checks that every schema path has all three verbs and that each path exists. It also holds the
  generic set equal to `test/loka/editor_generic_baseline.txt` (282 lines), shrink-only.
  `kernel/ts/test/editor_crud.test.ts:27-60` drives create, edit and delete for every kind through the routes.

## 4. The experience at 390 px

### 4.1 Entering and leaving Build

Build is a quill toggle in the Book's chrome row, outside the scrolling page, where the status line
sits. It shows only on a dev host (the author-mode gate). Turning Build on changes no game state. The
game keeps running: you walk, talk and fight as in Play. Leaving Build closes every sheet. If a field
holds an unsaved draft, it saves first (commit on blur, as everywhere).

In Build, one **Build strip** sits between the chrome row and the page, at `size.touch` height. It is
the only addition outside the page. It holds:
- the quill (on), the **notebook** button and the **Undo** chip (for 5 s after a write);
- the status, which reads `compiling`, `Not compiled: 2 refusals`, `Held · 3 waiting` or nothing;
- a count badge, `~ 4 here · 41`, that opens the notebook's Checks tab.

```
 390 px ─────────────────────────────────────
 │ ≡  Mill Lane                    ☾  ✎ │  chrome row (status line, quill on)
 │ ✎ Build   ▤ Notebook   ↶ Undo  ~4·41 │  Build strip (44 px)
 │───────────────────────────────────────│
 │ Mill Lane                          ✎  │  page title + its pencil (44×44)
 │ The lane narrows between the mill and │  plain words: tap = field in place
 │ a row of shuttered cottages. A water- │  (links in it still play)
 │ wheel turns somewhere behind the wall.│
 │ ┆ A cat, if you could see it (hidden: │  ghost line (Build only)
 │ ┆ perception 3)                       │
 │ Nell is here.                         │  link: plays (opens Nell's page)
 │ A sack of flour lies here.            │
 │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
 │ You hear the wheel creak.             │  log
 │                                       │
 │  + Add here                           │  Build only, after the page's last part
 └───────────────────────────────────────┘
```

### 4.2 Taps: what plays and what edits (settled)

The arithmetic rules out the draft's "a pencil beside every authorable line, in a gutter, with no
layout shift". At Standard size a body line is 28 px and a log line 26 px (`book/tokens.ts:130-131`).
A target is 44 px (`size.touch`, `tokens.ts:166`). Pencils beside each line in a run would overlap
their neighbours by 16 px or more. A gutter takes 44 of the 342 px measure (390 − 2 × `space.page`
24, `tokens.ts:163`), which is 13 % narrower and reflows every page.

The rule instead:
- **A link, card or control plays**, exactly as in Play: a name, a fixture, an exit, a choice card,
  Leave. The player's taps keep working in Build.
- **A tap on a line's plain words opens its field in place.** These are the words no player pressable
  covers. In Play such a tap does nothing, so Build takes nothing from play. One exception: a treated
  ScenePage wraps the whole page in a pressable that completes the reveal (`ScenePage.tsx:75-82`).
  There the word's press wins, and a tap on bare paper still completes. The line takes the Tap bleed
  (`docs/BOOK-UI-COMPONENTS.md`, "Where each fact lives"), which guarantees its shown line height: 28 px
  for a body line and 26 px for a log line, both above WCAG 2.5.8's 24 px. It is the E5 field, opened
  by a tap in Build. Outside Build, on a pointer device, the same field still opens on a double-click,
  so the desktop panel keeps "no modes" (decision 1).
  DreamPage and Riddle press only their own controls (`DreamPage.tsx:52`, `:83`; `Riddle.tsx:73-90`).
- **One pencil per page, on the title**, opens that page's thing's sheet. The title alone gains
  right padding of `size.touch` in Build, so only a long title rewraps. Nothing else moves.
- **A choice card** gets one trailing icon row in Build (section 4.6): **words**, when, does and
  goes. Cards are 48 px tall (`size.card`), so each icon is a full target. A tap on the card itself still plays the
  choice, so the label is edited from the **words** icon, which turns the label into its field in
  place.
- **A line that is not words** (an engine line, a key line) answers a tap with the existing no-field
  note (`book-ui.md`, Author mode, "No field").
- **No hidden gestures.** Every long-press or drag has a visible button that does the same thing.
  This is the lesson of the Shift-drag exit join (loka-wfrgk.123).

People and items are reached the way the owner described: tap the name (it plays and opens the
person's page), then that page's title pencil opens the person's sheet. "Tapping into an item or NPC
shows builder menu items" is exactly this path.

### 4.3 Where everything lives: the layers, settled

The rule: **words live where the player reads them. Everything a thing owns lives on that thing's
sheet. Only what belongs to no one thing lives in the notebook.**

1. **On the page, in place: shown words.** Room names and descriptions, room lines, a person's or
   item's description, detail prose, notices, dialogue lines and prompts, choice labels (their key
   stays fixed, `docs/design/scene-structure-rulings.md` section 2), and scene pages. A tap on the words opens the
   field. Each field holds the source words unbound (E5's rule).
2. **The thing's sheet: everything else that thing owns.** Keywords, placement, mechanic blocks,
   conditions, variants, exits, its reactions, its dialogues and their triggers, referrers, delete and
   move. It opens from the page title's pencil, or from any notebook row. The **summary the draft drew
   as chips under the title** becomes the sheet's header line: `dark · sanctuary · 2 variants ·
   1 reaction · 3 exits`. Each word jumps to its block. Reasons: the page stays the room anatomy, the
   summary is one tap away, and nothing on the page is a chip.
3. **The notebook: what belongs to no one thing.** A full-screen overlay from the Build strip, drawn
   by the builder, not a Book section. Its tabs:
   - **Contents**: every definition by kind, New, and Find with referrers. This stands in for the Hierarchy, the Project tab and the palette.
   - **Story**: the outline list (section 4.8).
   - **World**: `cartridge.json` settings, facts, resources, attributes, chapters and capabilities.
   - **Checks**: refusals, the `~` list and unconfirmed words.
   - **Recent**: the journal with put-back for each entry.
   - **Tools**: checkpoints, Go to room, Set fact, Set level, Advance time, State, Why, Step, Numbers and Hold.

   Every row either goes there in the game, by moving you (Go to room) or opening the page, or opens
   its sheet.

Why three layers and not two. The owner's examples split cleanly. Words are where the eye already is.
Behind-the-scenes mechanics belong to a thing, and a sheet is the one place a phone can show a long
form. Story maps, world numbers and test tools have no single page to hang on. A gear per page would be
a second door to the same sheet, and it would leave world-wide data with no home.

**Dialogue triggers** live in two places, each the natural one:
- In the conversation, a Build header line reads `Offered when: hour ≥ 18 · once`. It is the
  dialogue's `policy` and trigger, and it opens that block on the dialogue's sheet.
- On the person's sheet, each dialogue row carries its trigger summary.

A reaction, which is a trigger on an event rather than on talk, lives on the sheet of the thing it watches:
"Reactions on this room / person / item". A reaction that spans zones lives in the notebook's
Contents under Reactions.

### 4.4 Page by page

| Page (`Body.tsx` branch) | In place | Title pencil opens | Add here offers |
|---|---|---|---|
| World (`RoomPage`) | title, description, details' prose (via its fixture page), room lines, authored log lines (cues) | Room sheet: header summary, exits (direction, target picker, one-way, door, lock), details, variants, tags, dark, sanctuary, sound, site, cues, actions, reactions on this room, the people and items placed here (including hidden ones), referrers, move to area, delete | exit (new or existing room), item here, person here, detail, action here, reaction on this room |
| NpcDetail (person) | name, description, room line | Person sheet: placement (home room, or spawn template), dialogues with triggers, keywords and ask, disposition, perception, the Combat block, the Schedule block, the shop and services blocks, drops, variants, reactions on this person, delete | dialogue (`.scene`), reaction on this person, shop row, service |
| NpcDetail (conversation) | prompt, each line, each choice label | Dialogue sheet (section 4.6) | choice, line, page (`.scene`) |
| Item (`thing`), Inside (container) | name, description, readable words | Item sheet: placement (room, person or container), mechanic blocks (container, weapon, edible, readable, vessel, fuel…), variants, reactions on this item, delete | reaction on this item, an item inside (container) |
| Notice and board | notice title and body | Notice sheet (the detail or item behind it) | notice on this board |
| Shelf and sale | none (prices are numbers) | the seller's Person sheet, opened at the shop block | shop row |
| ScenePage (modal scene) | each `.cut` page | Scene sheet: Trigger block, control, treatment, pages (add, move, split, join, remove) | page after |
| Chapter | chapter title | World sheet, opened at the chapter row | (none) |
| Dream | dream lines | the dream's scene sheet (not traced; see section 11) | (none) |
| Dead, Credits, Ancestry, Settings | none of these are authored per place | none | none |
| Character, Skills, Journal, Carrying | none (or quest words through Journal) | Journal: the quest's sheet per quest; Skills: the skill's sheet per skill | (none) |
| Map (section) | none | (none) | the Build map replaces it in Build (section 4.7) |
| Combat | not traced | the foe's Person sheet at the Combat block (proposed) | (none) |

### 4.5 Hidden and conditional content

The game hides what the player cannot perceive. The builder must still reach it, in place.
- **Ghost lines.** Things defined here but absent from the view draw as faded lines in the paragraph
  where they would sit, in `dim` with a dashed left rule (`size.speechBar` wide, as the `~` bar). Each
  names why it is absent: `(hidden: perception 3)`, `(only when: night)`, `(behind a lock)`. A tap
  opens its sheet. Ghost lines are computed from the compiled cartridge by a pure function in
  `kernel/ts/play/` (`ghosts(view, cartridge, here)`). That function covers people and items placed here, variants
  whose condition is false, exits behind locks, and scripted actions and dialogues the view does not
  offer (`shown.ts` already lists the last two). A ghost line is in Build only. It is not in the log
  and takes no Tap bleed from a real line.
- **See as…** On the Room sheet, a variant row has `See as`. The Book redraws the room's words with
  that variant's text through the overlay only, and the Build strip says `Seeing: at night · Back`.
  The save is untouched. This rule fails safe: any write or page change ends See as.
- **Conditions** (a `when` policy) show as one sentence on the row (`when: hour ≥ 18 and has
  lantern`). The Policy block edits them on the sheet.

### 4.6 Dialogue and scene editing (inside the conversation)

A conversation in Build:

```
 │ Nell                               ✎  │  title pencil → Person sheet
 │ Offered when: always · repeats     ⚙→ │  Build header line → dialogue's policy block
 │ "You're the one from the mill?"       │  tap words → field
 │ ┌───────────────────────────────────┐ │
 │ │ Yes, I'm looking for work.        │ │  card plays
 │ │ ✎ words ◇ when ↦ does → goes      │ │  Build icon row, 4 × 44 px targets
 │ └───────────────────────────────────┘ │
 │ ┌───────────────────────────────────┐ │
 │ │ ~                                 │ │  new choice, born with ~
 │ │ ✎ words ◇ when ↦ does → goes      │ │
 │ └───────────────────────────────────┘ │
 │  + Add choice    + Add line           │
```

- **words** opens the label's field in place. A `.scene` label writes through `/set`. How a JSON
  dialogue's label is written is the open `.100.4` question (`docs/HANDOFF.md:95-98`: the panel card
  refuses it at `fields.tsx:39`, while `prose.ts:14-25` would accept it through `/edit`). The builder
  follows the owner's answer there (decision 11).
- **when** opens the choice's Policy block, **does** its Steps block (`narrate`, `set_fact`,
  `give`…), and **goes** its `then` or `then_failed` (a picker of this dialogue's sets, or `end`).
  Each opens the dialogue sheet scrolled to that choice. An icon with content is drawn in `action`,
  and an empty one in `dim`.
- `.scene` dialogues use the existing line routes: `/edit` for words, `/set` for a choice label, and
  `/restructure` for add, move and remove of lines and choices with their blocks
  (`scene-structure-rulings.md` sections 1 and 3). The dialogue sheet lists the scene's lines as rows with
  Move up, Move down and Remove, which mirrors the panel's Scene text card (`SceneRows.tsx:49-106`).
- **Creating a person and their dialogue** (the owner's example). Room page, `+ Add here`, then
  Person. `POST /new npcs` runs with the room filled in, and the new `~` person appears on the page. Tap
  them, then their title pencil. The Person sheet opens, with `+ Add dialogue`, which creates a `.scene` with
  `npc:` set. You land in the conversation in Build, with one `~` prompt and `+ Add choice`.
- **Modal scenes** (`.cut`) draw as numbered page breaks on ScenePage. A page tap edits words, and
  the scene sheet holds Add page after, Move, Split and Join (`ScenePages.tsx:11-84`).

### 4.7 The map (Build)

In Build, the Map section and the minimap's open gesture show the **Build map**. It is the builder's
own drawing of every room from `layout.json`, not the player's discovered map. The player's map keeps
its rule against action cards (`lint/rules/mobile-book-map-no-actions`).

```
 │ Map · level 0          ⌃ ⌄   − + ⤢   │
 │      ┌────┐                          │
 │      │yard│───┐        ＋            │  ＋ = new room that side
 │      └────┘   │      ┌────┐          │
 │            ┌──┴─┐────│mill│ ＋       │
 │      ＋    │lane│    └────┘          │
 │            └────┘ ●here              │
 │ Unplaced (2): ⬚ cellar  ⬚ loft       │
 │───────────────────────────────────────│
 │ lane — selected                       │  bottom action bar for the selection
 │ Go here  Sheet  Join…  Move…  Area…   │
```

- A tap selects a room. It never plays. **Go here** is a button (the panel's double-click,
  `mapsvg.tsx:96`).
- `＋` on each free side and on up and down makes a room that way (`POST /new rooms` with `from`, the
  panel's grow handles at `mapsvg.tsx:104-154`).
- **Join…**: tap a second room, and both exits are written. This replaces Shift-drag. **Move…**: then
  tap an empty cell. A long-press drag does the same as a shortcut. The exit row on the Room sheet
  holds one-way, door, lock and delete.
- Two-finger pinch zooms and one-finger drag on empty ground pans. `⤢` fits.
- Unplaced rooms are a strip: select one, then tap a cell to place it.
- The view math and edits are the panel's (`map.ts` `View`/`fit`/`zoomAt`, `mapedit.ts`), moved to
  `kernel/ts/play/`. Drawing is plain React Native `View`s, as the Book's own `MapDrawing.tsx`
  draws (`MapDrawing.tsx:5-13`: `View`, no SVG dependency).

### 4.8 The story on a phone

The notebook's **Story** tab is the panel's Story list in list form (`storylist.tsx`). It shows
parts, then beats, then the definitions bound to each beat, each marked built, `~`, missing or
unreached, with a refusal count. It also shows Seeds. Row actions: Go there, Sheet, Trace (a sheet listing
setters and readers) and Consequences. Beat edits are Add beat, Bind, Retitle and Remove
(`storylist.tsx:160-187`), done with rows and fields instead of prompts. Knowledge at a beat, and
Pacing, are sheets. **Flow** (the graph) stays `panel-only` at first: a 143-chip graph with hover
cards does not fit 390 px, and the list carries the same edges as rows. A phone graph is its own later
design question.

### 4.9 Creating, deleting, moving

- **Create**: `+ Add here` on any page, `＋` on the map, `New` per kind in the notebook's Contents,
  and `+ Add <block>` on any sheet. Everything is born with `~` (owner rule). Creation that asks for a
  name uses one field with the server's name refusal shown under it.
- **Delete**: on every sheet's foot, `Delete <key>`, with the referrer count. The confirm lists the other
  files that would go (the palette's delete, `author.ts:20-37`, given a home). Rows and blocks delete
  with their own Remove.
- **Move**: Room sheet, `Move to area…` (`POST /move`). Item and person placement are pickers on their
  sheets. Moving a room on the grid is a map action.
- **Rename a key** stays out (GUI design ruling 9).

## 5. Interaction rules

- **Sheets.** A sheet rises from the bottom to half height, so the Book above shows the thing it
  edits, live. Dragging it up makes it full height. Sheets stack: Person, then Dialogue, then choice,
  then its Steps. Each stacked sheet shows a breadcrumb (`Nell › greet › Yes, I'm…`), and Back closes
  only the top sheet (Android back, and a swipe down, do the same). The stack is capped at four. A
  fifth sheet replaces the top one. A sheet is drawn on `card` paper with Book type roles, and its
  words live in `mobile/app/author/` (never `LABEL`).
- **Commit points** are the existing ones: Enter, blur, or a picker closing. Never per keystroke.
- **Undo.** The Build strip's Undo chip shows for 5 s after each of your writes and undoes exactly that
  write (`/undo` with its journal id). The notebook's Recent tab is the history, with put-back on any
  entry, `you` or `outside`. A refused put-back says `<file> changed since; not put back.` There is no
  redo (GUI design 5.4).
- **Conflicts.** A field's 409 opens E5's notice: their words, Keep mine and Take theirs. A sheet
  block's 409 reloads the block and shows the field it was editing, with both values. A pushed `changed`
  for an open sheet's file reloads that sheet, unless one of its fields has focus, in which case the
  notice opens.
- **Compile latency** (structural compiles took 0.8 to 18 s in one owner session; the server's
  `Message.timings`, `live.ts:53`, records each).
  - Text edits never wait: the overlay shows them at once.
  - A structural write never blocks the next write: each answers after its rename. The written
    block shows `compiling` until the SSE message answers, then shows refusals at their fields by JSON
    path (GUI design 5.5).
  - **Auto-hold, only while a text field has focus.** A structural compile rewrites the artifact and
    reloads the Book (GUI design section 11, `author.ts:71-75`, `metro.config.js:38-44`; not re-read).
    A reload under a focused field would lose its draft, so the builder holds (`POST /hold`) from
    focus to commit, and the strip shows `Held · N waiting` meanwhile. The hold is not kept for an
    open sheet. A held structural change blocks later text overlays (GUI design section 11), which
    would freeze the live Book above the sheet, so with no field focused the Book reloads as usual.
    The builder-state restore (next rule) brings the sheet stack back.
  - Measure before tuning (slice 0.2): it is unknown whether the 18 s was the compile, `mix
    loka.new`'s start, Metro rebundling or the keep-my-place replay of a long path.
- **Builder state survives a reload.** The sheet stack and its scroll are kept beside the place
  (`place.ts`), so after the catch-up reload you are back on the same page with the same sheet.
- **Keep-my-place failures.** After a structural edit, the replay of your recorded steps can be
  refused (an exit removed, a person moved). The Build strip then reads `Couldn't keep your
  place: step 14, go north, was refused.` It offers three actions, so you are never stranded:
  - **Drop it and go on** (the existing `drop`, `place.ts` `dropStep`, the panel's
    `sections.tsx:49-51`);
  - **Back to checkpoint** (the pinned one);
  - **Start in this room**, which is Go to room on the room you were editing.
- **Accessibility.**
  - Every builder control is at least `size.touch` in both axes. The plain-word field target uses the
    Tap bleed: its shown line height guaranteed (28 px body, 26 px log), above WCAG 2.5.8's 24 px.
  - In Build, each editable line is a button named by its words, then `, edit` (the label-in-name
    rule). The title pencil is `Edit <title>`, and a ghost line is `<words>, hidden: <reason>, edit`.
  - A sheet is modal (`accessibilityViewIsModal`, focus to its title). Closing it returns focus to the
    pencil or line that opened it.
  - Compile results are announced politely through the Book's existing `screenReader.ts`.
  - Nothing animates under reduced motion: sheets cut in.
  - A hardware keyboard keeps E5's `[ ] { }` walk and Enter-to-open in Build.
- **Looks.** Book tokens only: `card` paper, `fg`, `dim`, `action`, `warning`, `refusal`, type roles,
  `space`, `size` and `radius`. There is no new hex. The designer writes the sheet, pencil, ghost-line and
  Build-strip rulings in `docs/design/` as part of phase 1. The builder must look like the Book.

## 6. Architecture

### 6.1 Component structure

```
mobile/app/author/build/          (dev only; required only under the author gate)
  Build.tsx        toggle, Build strip, sheet stack host, auto-hold, state across reloads
  seam.ts          implements the Book seam: which words are editable, opens fields, draws pencils/ghosts
  Field.tsx        the in-place field (RN TextInput in the line's type role), /edit and /set, 409 notice
  Sheet.tsx        bottom sheet + stack + breadcrumb
  sheets/          Room, Person, Item, Dialogue, Scene, Reaction, Action, Quest, World (bespoke)
  blocks/          Policy, Steps, Trigger, Check, Picker, Combat, Schedule, OfferTable, FactsTable
  Generic.tsx      the RN schema renderer (6.4)
  Notebook.tsx     Contents, Story, World, Checks, Recent, Tools
  Map.tsx          the Build map
  server.ts        typed fetch helpers for /__author routes (the panel's source.ts, ported)
  parity.json      the non-schema parity list (6.7)
```

### 6.2 The seam into the Book (decision 2)

`mobile/app/book/Text.tsx` is the one place every Book word passes (`Text.tsx:1-10`; lint
`mobile-book-text` forbids React Native `Text` elsewhere). It gains one dev-only check. If an author
seam is installed, the seam may add press and accessibility props to the same `Text`: `onPress`, and
an accessibility role and name. It never wraps the line in a `View`. On native, a `View` around a
nested inline `Text` breaks the sentence's inline links. This follows the existing `worded` hook pattern, a
mutable object in `book/` that only the author preview sets (`words.ts:183-187`, set at
`panel.tsx:41-44`). In a release the seam is `undefined`, so the cost is one property read per line.
The seam holds no words and draws nothing itself. The builder's components do the drawing. Page
titles reach the seam the same way (they are `Text`), which is where the pencil mounts. `+ Add here`
and ghost lines are drawn by the seam after the page's last `Text` of each paragraph kind. Exactly how
the seam learns "paragraph kind" without a prop is the slice 1.1 design question. If it needs one
prop, the designer and owner rule on that prop.

A new lint rule, `mobile-book-author-seam`, allows the seam's import only in `Text.tsx` and `words.ts`,
with a red control. The E5 DOM field (`inbook.ts`) is retired once the Build field reaches parity on
the web (decision 5). Until then the two coexist: double-click still works in the desktop panel.

### 6.3 Reuse of `kernel/ts/play`

The builder imports the same modules the panel does: `card.ts`, `ui_schema.ts`, `edit_model.ts`,
`world_card.ts` and `room_card.ts`. It never imports `edit_validator.ts` (Ajv) or `scene_card.ts`
(`node:fs`). Slice 0.1 proves Metro can bundle the needed set, including the JSON import attributes.
If it cannot, the fix is a build-time JSON copy or a re-export file, not a fork. Before their builder
slice, these move out of the panel into `kernel/ts/play/`, each as its own slice with the panel
re-pointed: `map.ts` and `mapedit.ts` (phase 4), `storylist.ts` and `verdicts.ts` (phase 6). The
ghost function is new and pure, in `kernel/ts/play/ghosts.ts`.

### 6.4 The generic renderer

The panel's long tail renders through rjsf with the house walker's claims (`Generic.tsx:5-9`,
`:225-232`; fields `fields.tsx:226-237`). rjsf is DOM-bound: its core Form renders a `<form>`
(`@rjsf/core` `Form.js:1283-1287`, `tagName`), and it requires a validator (Ajv codegen, untested
under Hermes). What a React Native renderer must replace:
- objects, as folded blocks with Add… and Remove (already `card.ts` `addable`, `cardMenu`);
- arrays, with add, remove, move up and down, and copy (rjsf's array templates);
- `string`, `integer` (282 schema lines), `number` and `boolean` (19) inputs;
- `enum` (69) and `const` (321) as one-of pickers;
- `anyOf` (50) and `oneOf` (7) branch switching, which the panel already routes to its own `Rules` field;
- `if`/`then`/`else` resolution per kind (44 `if`), via `card.ts` `branchOf`;
- `$ref` following (depth 3, `ui_schema.ts:10`, `:44-51`).

The claimed fields are `TextKey` (the in-place field), `DefinitionRef` and `ConditionKey` (Picker),
`Policy` and `Step` (blocks), `Hidden`, `Combat` and `Schedule`. Counts are matching lines in
`schemas/source/` (30 files, about 196 `$defs`), not occurrences. Recommendation: write our own,
about the size of the panel's `Generic.tsx` plus templates, with validation on the server. Slice 2.3
starts with a half-day probe: render the 282-row generic baseline's kinds with it, and compare
against an rjsf custom-theme spike if the probe stalls. Adding rjsf to `mobile/app` would also need
`isolation.test.ts`'s shared-package list widened (`isolation.test.ts:28-33`).

### 6.5 Talking to the author server

It uses the same origin as today: the Book's preview server proxies `/__author/*` to the author server
(`mobile/app/preview-server.cjs:39-51`). Reads come from `/source`, `/schema`, `/find`, `/todo`,
`/journal`, `/story`, `/templates` and `/checkpoints`. Writes go to `/edit`, `/set`, `/change`, `/restructure`,
`/new`, `/delete`, `/move`, `/undo` and `/hold`. Pushes arrive on `/events` (SSE). Book-side test tools
(Go to room, Set fact, Set level, Advance, Jump, Drop, Why's trace) call `place.ts` directly in the
same JS context. The postMessage bridge is for the panel's iframe only and is not needed. **New
routes:** none planned. If slice 2.5 finds the dev artifact lacks something ghosts need, that one read
route gets a reviewer.

### 6.6 Keeping it out of player builds

The builder rides the existing gate. `inbook.ts` is `require`d only when
`EXPO_PUBLIC_LOKA_DEV_CARTRIDGE === '1'` (`panel.tsx:39-40`), and Metro throws on a dev cartridge in
production (`metro.config.js:29-45`, `App.tsx:56-57`). `build/` is required the same way, from the
same line. The seam is only installed under `devClock`. Today's pin is a source-text match
(`prose_rules.test.ts:110-123`). Phase 1 adds the behavioural check the rules prefer: export a release
web bundle and assert that a sentinel string from `build/` is absent. Two red controls go with it:
require `build/` unconditionally and watch the test fail, then install the seam in a release.

### 6.7 The parity gate extension

- **Registry, `book` per row.** Each of the 277 schema-path rows gains `book: {create, edit, delete}`.
  Each value is a path under `mobile/app/author/build/`, `generic` (the RN renderer) or `todo`.
  `bin/toolbox_page.exs` checks each path exists and holds the `todo` set equal to
  `test/loka/builder_todo_baseline.txt`, which only shrinks (the same mechanism as
  `editor_generic_baseline.txt`, `toolbox_page.exs:213-239`). Red controls go into
  `bin/red_controls.exs`: drop a `book` key, name a missing file, add an unlisted `todo`.
- **`parity.json`, everything that is not a schema path.** Appendix A's rows, each holding `id`, the panel
  home (a file) and the book home (a file or `panel-only: <reason>` or `todo`). The same exs checks that
  files exist and that `todo` only shrinks. "Parity reached" (ruling 3) means both `todo` sets are
  empty.
- The gate proves a named surface exists, not that it works. `editor_crud.test.ts` already proves
  the routes for every kind. The builder's own checks are 6.9.

### 6.8 The security model for the phone phase

Today, loopback is the trust boundary. A LAN phone breaks that. Proposed:
- **Off by default.** `bin/loka dev --watch --lan` binds the preview server (today `127.0.0.1:19006`,
  `preview-server.cjs:86`) on the LAN address. The author server stays on loopback, behind the proxy.
- **Pairing token.** At start it makes a random 128-bit token, prints it, and shows it as a QR in the
  desktop panel. The phone opens `http://<lan>:19006/?dev=1&pair=<token>`. The preview server sets an
  `HttpOnly; SameSite=Strict` cookie and drops `pair` from the URL. The proxy forwards to the author server only with a valid
  cookie, and adds a header the author server requires whenever the request did not come from loopback.
  This covers every method, GET and SSE included: `/source` reads files.
- **Close the missing-Origin gap.** In `--lan` mode a non-GET with no Origin is refused
  unless it carries the token (`editing.ts:22`). A native app's fetch sends no Origin.
- **The token dies** when the process restarts, and `--lan` turns off after 8 idle hours.
- **No TLS** on the home LAN (decision 8): a LAN observer could read the token. A native dev build
  later sends the token as a header from its dev config. EAS is never used (owner rule).
- **Unknown for 3.1: a second port.** If the phone's browser takes the dev bundle from Metro's own
  port instead of through the preview server, that port is an unauthenticated LAN exposure serving
  the whole dev bundle and cartridge. Slice 3.1 must show that only the token-guarded port listens
  on the LAN (a scan from a second device), or put Metro behind the same guard.
- This phase gets a separate reviewer and a red control per guard: a wrong token, no cookie, a LAN Host
  without a token, and a POST without Origin.

### 6.9 Testing (what proves each phase)

- **Shared logic** (ghosts, the generic renderer's model, map edits after the move): `node:test` in
  `kernel/ts/test/`, on controlled inputs with literal answers. For example, a room with a perception-3
  NPC yields exactly one ghost row with reason `perception 3`.
- **Gate**: red controls in the exs test (6.7). **Release exclusion**: the bundle sentinel test (6.6).
- **Components**: one Storybook story per state the doc comment lists (Book rule 5). `play` asserts
  the behaviour that matters: a tap on plain words opens a field, a tap on a link plays.
- **Routes** are already covered by `kernel/ts/test` and `editor_crud.test.ts`. The builder adds no
  route tests unless it adds a route.
- **Each slice ends with one owner walk** at 390 px in the desktop preview (and on the phone from phase
  3), plus a screenshot pair (light and dark) in the PR.
- No mutation runs on builder polish (HANDOFF rule). Mutation checks apply to the gate, the seam and
  the LAN guards.

## 7. Phases and slices

One slice at a time. **R** marks a slice that needs a separate reviewer: engine, save, contract,
compiler-facing or security. **D** marks a designer review of the UI. Sizes: S is under a day of
agent work, M is a day or two.

**Phase 0: probes and the gate.** Decides the two unknowns before anything is drawn.
| Slice | Size | Acceptance |
|---|---|---|
| 0.1 Bundle probe: import `card.ts`, `ui_schema.ts`, `edit_model.ts` into the web Book under the dev gate; log `cardMenu` for the current room | S | The dev web Book prints the room's add menu. The release bundle is unchanged in size, within a stated tolerance. If it fails, the doc records the fix chosen |
| 0.2 Latency measure: ten structural edits of each kind (field change, `/new` room, `/new` npc, delete) with `Message.timings` and reload time | S | A table in this doc's section 8 that splits compile, `mix`, Metro and replay. No code merged beyond any timing marks |
| 0.3 Parity gate: `book` keys (all `todo`), `parity.json` from Appendix A, exs checks, both baselines, red controls | M | `bin/toolbox_page.exs --check` passes. Each of the four red controls fails it. Every existing registry reader still passes with the nested `book` object: `editor_crud.test.ts`, `red_controls.exs`, the panel's runtime reads (Add here, `book-ui.md` Author mode) and `toolbox_page.exs` |
| 0.4 Move `registry.json` (and `new.json`) out of `tools/author-panel/src/edit/` to a shared place (for example `kernel/ts/play/registry.json`); panel, gate and tests re-pointed | S | The builder may read it without breaking `isolation.test.ts` (`:40-44` rejects any `author-panel` import). The panel's Add here and Add… menus are unchanged (owner walk) |

**Phase 1: the Build shell.** You can edit any shown word on a phone-width page.
| Slice | Size | Acceptance |
|---|---|---|
| 1.1 Seam in `Text.tsx`, `mobile-book-author-seam` lint, release-bundle sentinel test (**R**, **D**) | M | Release: seam absent (sentinel test) and lint red control fails. Dev: a seam that only counts lines reports the room page's lines |
| 1.2 Build toggle and strip, auto-hold while a field has focus, builder state across reload (**D**) | S | Toggling changes no game state. A structural compile that lands while a field has focus waits until the field commits. One that lands with a sheet open reloads the Book and the same sheet comes back, scrolled where it was |
| 1.3 The in-place field on a plain-word tap, `/edit`, `/set`, 409 notice, unconfirmed mark | M | At 390 px: tap the description, change a word, Enter. The Book shows it at once. A 409 shows Keep mine and Take theirs. A link tap still plays |
| 1.4 Undo chip, Checks tab (refusals, `~`, unconfirmed), keep-my-place failure notice with its three actions | S | Undo restores the last write. A removed exit on the recorded path shows the notice. Each of its three actions leaves you on a live page |

**Phase 2: sheets and things.** The owner can build a room's contents on the phone screen.
| Slice | Size | Acceptance |
|---|---|---|
| 2.1 Sheet and stack, title pencil, Room sheet: summary header, exits, delete, move to area (**D**) | M | From the room page: add an exit to a new room, make it one-way, delete it, all from the sheet |
| 2.2 `+ Add here`, Person and Item sheets with placement; New in a minimal notebook Contents | M | Add a person here, then open their sheet and move them. The person appears on the page as `~` |
| 2.3 Generic RN renderer (probe first) and Add mechanic… with greyed rows that turn a setting on | M | Every kind in `editor_generic_baseline.txt` opens a sheet that writes one field and removes it. Spot-check five kinds by hand |
| 2.4 Combat and Schedule blocks (the panel's bespoke two) | M | An NPC's attack and schedule edit and the fight rows update (`/fights`) |
| 2.5 Ghost lines and See as… (`kernel/ts/play/ghosts.ts`) | M | A room with a perception-gated NPC shows one ghost with its reason. A tap opens the NPC's sheet. See as at night redraws the words and the save hash is unchanged |

**Phase 3: the real phone** (ruling 4: after things).
| Slice | Size | Acceptance |
|---|---|---|
| 3.1 `--lan`, pairing token and cookie, Origin gap closed, idle expiry (**R**) | M | The owner's phone browser, paired, edits a word. A second device without the token gets 403 on GET `/source` and on POST `/edit`. Each guard has a red control |
| 3.2 Phone walk fixes (keyboard covering fields, safe areas, sheet drag) (**D**) | S | Owner walk on the phone: phases 1 and 2 acceptance repeated on the device |

**Phase 4: the map.**
| Slice | Size | Acceptance |
|---|---|---|
| 4.1 Move `map.ts` and `mapedit.ts` to `kernel/ts/play/`; panel re-pointed | S | Panel map unchanged (owner walk). The module's own tests move with it |
| 4.2 Build map: draw, select, Go here, levels, zoom and pan, unplaced strip | M | Every room of the showcase level draws. Go here moves you |
| 4.3 Map edits: `＋` grow, Join…, Move…, place unplaced, area | M | Grow a room, join it back, move it a cell, and undo each from the chip |

**Phase 5: talk and story.**
| Slice | Size | Acceptance |
|---|---|---|
| 5.1 Conversation in Build: header line, choice icon row, add choice and line, Dialogue sheet (JSON dialogues: choices, links) | M | Create a person, then a dialogue, then two choices, one linking to a set, in Build on the phone |
| 5.2 `.scene` rows: move, remove and add through `/restructure`; `.cut` pages on ScenePage | M | The panel's scene structure acceptance (`scene-structure-rulings.md` section 6) done from the phone |
| 5.3 Policy, Steps, Trigger and Check blocks; Reaction, Action and Quest sheets | M | A reaction on this room with a `when` and two steps compiles and fires in play |
| 5.4 Move `storylist.ts` to `kernel/ts/play/`; notebook Story tab with beat edits, Trace and Consequences | M | Add, bind, retitle and remove a beat. Trace a fact to its setters |
| 5.5 Flow focus walk (decision 9 as amended): centred node, leads-to above, unlocks below, re-centre on tap with breadcrumb, fact threads, filters as toggles; widens toward the canvas on a wide screen (**D**) | M | On the phone: from a dialogue choice, walk to the fact it sets, then to every reader, and open one reader's sheet. The panel Flow's filters each change what the walk shows |

**Phase 6: notebook tools, parity and the panel's retirement** (rulings 6 to 8).
| Slice | Size | Acceptance |
|---|---|---|
| 6.1 World tab: `cartridge.json` settings, facts, resources, attributes, chapters | M | Add a fact and set its default. A greyed mechanic turns on from here |
| 6.2 Tools tab: checkpoints (save, replay, pin, verdicts via the moved `verdicts.ts`), Go to room, Set fact, Set level, Advance, State, Why, Step, Numbers, Hold | M | Each row of Appendix A's Tools group works on the phone |
| 6.3 Find with referrers, Recent (journal), world picker | S | `todo` sets in both baselines are empty, so parity is reached (ruling 3) |
| 6.4 Retire the E5 DOM field (decision 5) | S | `inbook.ts` is deleted. The desktop panel edits words through the Build field. E5's tests are ported or deleted, with a reason for each |
| 6.5 Wide layout (ruling 7): the sheet docks beside the Book past a breakpoint, the notebook can stay open as a column; keyboard paths (Cmd-K palette over Contents and commands, undo, walk keys) (**D**) | M | In a desktop window: a sheet and the notebook open side by side with the Book still playable; every palette command of the panel (`shell.ts:113-130`) has a palette row |
| 6.6 Port the panel's browser tests (`tools/author-panel/test/*.test.ts`) to the builder, one break per test kept or retired with a reason | M | Each kept test names its break and has a red control against the builder |
| 6.7 Owner walk: one whole authoring session in the builder alone (ruling 8) | S | The owner's yes, and any friction filed and fixed |
| 6.8 Retire the panel: delete `tools/author-panel`, its CI jobs and docs; `book` becomes the registry's only surface (**R**) | S | CI green without the panel; the registry gate checks `book` alone; no doc links to the panel |

**Phase 7: builder mode for players.** R&D only, gated on hosting (ruling 5). No slices.

**Risks.**
- The seam (1.1) touches every line in a release. A careless seam costs frame time on the player
  path. Measure before and after on the long-log fixture.
- Compile latency: if 18 s is the compile itself, the auto-hold makes the Book lag behind the
  sheet. Slice 0.2 decides whether a faster partial compile is worth an R&D item.
- Keep-my-place replays long paths slowly (GUI design section 11). The notebook's checkpoints are the remedy.
- Long sheets (Combat numbers, schedules) at 390 px need a design pass (designer, 2.4).
- The phone keyboard covers half the screen, so the in-place field must scroll above it (3.2).
- Duplicate shown words keep sharing one binding until the line-key fix (loka-wfrgk.100.8) lands.

**Unknowns to measure first**: Metro and Hermes bundling of the card modules (0.1), where the 18 s
goes (0.2), whether the dev artifact carries enough for ghosts (2.5's first hour), and the generic
renderer's real size (2.3's probe).

## 8. Measurements

To be filled by slice 0.2. Until then the only latency figure is the owner session's 0.8 to 18 s
(unattributed).

## 9. Owner decisions (ruled 2026-11-19: every recommendation taken, 9 and 11 as amended below)

| # | Decision | Recommendation |
|---|---|---|
| 1 | Reverse "no modes" for the game screen: a Build toggle. The desktop panel keeps "no modes": outside Build, on a pointer device, a double-click on words opens the same field | **Yes.** A phone has no double-click or Alt. A mode is what the owner asked for. The panel's rule still serves a mouse, and one field serves both |
| 2 | One dev-only seam in `mobile/app/book/Text.tsx` (and at most one prop if 1.1 proves it needed), confined by a new lint rule. This narrows E5's "no prop, state or word in `book/`" | **Yes.** It is the only native-ready way to put pencils and fields on Book lines. The `worded` hook is the precedent |
| 3 | The notebook is builder chrome, not a Contents section | **Yes.** Contents stays the player's fixed list |
| 4 | The room's hidden-data summary sits in the sheet header, not as chips on the page | **Yes.** It keeps the room anatomy and the "no chips" rule, at a cost of one tap |
| 5 | Retire the E5 DOM field once the Build field reaches parity on the web | **Yes** (slice 6.4). Two prose editors would drift. The panel's Book frame runs the same Build field |
| 6 | Generic forms: our own RN renderer, with validation on the server, rather than rjsf with a native theme | **Own renderer**, confirmed by 2.3's probe. No Ajv under Hermes, and no new dependency in `mobile/app` |
| 7 | Auto-hold only while a text field has focus. Open sheets survive reloads through the builder-state restore | **Yes.** Holding for a whole sheet would freeze the live Book (a hold blocks text overlays). Holding for a field protects the one thing a reload would lose: a draft |
| 11 | `.100.4`: may a JSON dialogue's choice label be reworded through `/edit`? (`HANDOFF.md:95-98`) | **Yes, ruled.** The owner already decided it on 2026-11-06 (ruling 11 reversed, `gui-editor-design-2026-11-04.md:234`: a choice's key is fixed, its words free); a JSON choice's label is its own field (`choices.<key>.label`), and `/edit` accepts it (`kernel/ts/play/prose.ts:14-25`). The panel card's refusal (`tools/author-panel/src/edit/fields.tsx:39`) is stale and goes; the builder's **words** icon rewords it |
| 8 | LAN security: an opt-in flag, a pairing token in a cookie, idle expiry, no TLS on the home LAN | **Yes** for the home network. Revisit before any shared network |
| 9 | **Amended by the owner:** a Flow graph that works on a phone, not panel-only | **A focus walk**, built with talk and story (phase 5): one node centred, what leads to it above, what it unlocks below; tap a neighbour to re-centre (breadcrumb back); tap a fact for its set/read thread; every node opens its sheet or goes there; the panel's filters as toggles. On a wide screen it widens toward the canvas. Not the desktop canvas shrunk |
| 10 | Phase order as in section 7 (phone after things, then map) | **Yes.** It follows ruling 4. The map is the largest slice group and benefits from real-phone gestures |

## 10. Owner rulings already made (2026-11-19, paraphrased)

1. **The in-game builder may show forms.** The ruling "the Book never shows forms"
   (`gui-editor-design-2026-11-04.md` section 3) is reversed for Build mode only.
2. **React Native components**, native-ready, rendered on the web first.
3. **The desktop panel takes fixes only** until the in-game builder reaches parity.
4. **A real phone (on the LAN) after the "things" phase.** Until then, phone width in the desktop
   preview.
5. **No builder mode for players** unless the game is hosted and can compile for them. That stays R&D.
6. **Feature parity is 100%.** Every panel function gets a builder home; `panel-only` is not an allowed
   value in the parity gate (Appendix A's `panel-only` rows need a builder design before phase 6 ends).
7. **The builder is responsive**, phone to desktop window: on a wide screen the sheet docks beside the
   Book, the notebook can stay open as a column, the Flow walk widens toward a canvas, and the panel's
   keyboard paths (Cmd-K palette, undo, walk keys) carry over. "Open source" in the external editor stays.
8. **The desktop panel (the sidebars) retires** at parity, because the builder is the form factor the
   game is played in. The gate: the parity check's `todo` is zero, the panel's browser tests are ported
   to the builder, and the owner completes one authoring walk in the builder alone. Then
   `tools/author-panel` is deleted, not left to rot, in the same phase that retires the E5 DOM field
   (slice 6.4). Until then ruling 3 holds: the panel takes fixes only.

Standing: the owner writes every player-facing word, agents build structure only, and new things are
born with `~` (`docs/decisions/owner-decision-handwritten-prose-2026-10-31.md`). The owner is the
sole author, so guards against author error are nits. Slices are small and one at a time, with a
separate reviewer only for engine, save, contract, compiler-facing or security work.

## 11. What changed from the draft, and what I did not verify

**Overturned from the first draft:**
- *A pencil beside every authorable line in a gutter, with no layout shift.* The arithmetic in 4.2 rules it out.
  Plain-word taps and title pencils replace it.
- *Chips under the room title.* They break room anatomy and "no chips", so they move to the sheet header.
- *A Contents page in the Book (§3)* contradicted the notebook (§3a) and the fixed Contents list. The
  notebook is chrome.
- *"Builder mode adds no route at first"* stays true for data. The phone phase adds a token guard,
  and ghosts may need one read route.
- *"Card logic is shared, so a second renderer can reuse all of it."* Mostly true, but the builder
  cannot reuse today's in-Book editor (DOM), and the map, story and verdict logic still sits in the panel.
- *The registry "per capability".* It is per schema path, and much of the panel (map, tools, story)
  is not in it. Hence `parity.json`.
- *The phone as phase 7.* The draft contradicted itself: its §6 put the phone seventh, while its §7
  recorded the ruling as "after phase 3 (things)". Ruling 4 wins, so the phone is phase 3 here,
  right after things.
- Added: auto-hold, builder state across reloads, keep-my-place failure actions, Delete's home, and
  the security model.

**Cites I opened myself:** `editing.ts:14-24`, `panel.tsx:32-44` and `:170-190`,
`isolation.test.ts:28-45`, `shown.ts:1-60`, `inbook.ts` DOM lines, `Text.tsx`, `words.ts:175-215`,
`tokens.ts:130-166`, the imports of `card.ts`, `rules.ts`, `MapDrawing.tsx`, `map.ts`, `mapedit.ts`,
`storylist.ts` and `verdicts.ts`, `@rjsf/core` `Form.js`, and the design docs cited. **Every other `file:line`**
(routes, panel functions, registry and gate lines, page dispatch, preview-server, Metro) came from two
read-only inventory passes and was not re-opened.

**Not verified:**
- I ran no app, compile or test.
- Whether Metro bundles `card.ts` (0.1).
- Where the 18 s goes (0.2).
- Where Combat and Dream draw.
- Whether the dev artifact carries variant conditions and perception for ghosts.
- That the Book reloads on a structural compile (taken from GUI design section 11).
- The exact count of generic schema shapes: the counts are matching lines, not occurrences.
- Whether `/world` and `/story` have side effects (handlers not read).

---

## Appendix A: parity inventory (panel function → builder home)

From the code of `tools/author-panel/src` (9,923 lines, 76 files). "Sheet" is a thing's sheet; "NB"
is the notebook. Where a cite is a range, it names the handler.

**Left column**
| Panel function | Panel cite | Builder home |
|---|---|---|
| Hierarchy (definitions by kind), select | `App.tsx:107-115`, `left.tsx:36` | NB Contents |
| Play from here (room) | `left.tsx:41-50` | NB Contents row: Go there |
| `+` New menu, per-kind `+`, starter descriptions | `left.tsx:63-130` | NB Contents New; `+ Add here` |
| World button (cartridge.json) | `left.tsx:57-61` | NB World |
| Project tabs | `project.tsx:28-60` | NB tabs |
| World picker: list, switch, new (blank or copy) | `world.tsx:13-120` | NB Tools: Worlds |
| Map, Story and Flow segment | `left.tsx:215-233` | Build map; NB Story; Flow is panel-only (decision 9) |

**Centre**
| Panel function | Panel cite | Builder home |
|---|---|---|
| Phone or tablet size | `centre.tsx:32-45` | panel-only: the builder *is* the device size |
| Last-edit timing | `centre.tsx:11-24` | Build strip status (timings on long press) |
| Hold (button, Cmd-., palette) | `centre.tsx:52`, `prose.tsx:11-42` | Auto-hold plus NB Tools Hold |
| Map: level, drag lock, zoom, fit, Go here | `areamap.tsx:226-249` | Build map header and action bar (drag lock: panel-only, since no drag is needed on touch) |
| Unplaced strip, drop to place, first room | `areamap.tsx:170-181`, `:254-274` | Build map strip |
| Click select, double-click go, Alt-click source | `mapsvg.tsx:95-96` | tap select, Go here; open source is panel-only (no editor on a phone) |
| Drag room to cell | `mapsvg.tsx:210-233` | Move… (and long-press drag) |
| Shift-drag join | `mapsvg.tsx:225-229` | Join… |
| Wheel, pan, keys | `mapsvg.tsx:157-268` | pinch and drag; keys kept for a hardware keyboard |
| `+` grow handles | `mapsvg.tsx:104-154` | `＋` on free sides |
| Template chips (abstract NPC or item onto a room) | `maptemplates.tsx:14-52` | `+ Add here`: Person or Item "from template" |
| map-grow, map-area, map-npc, map-item | `mapwire.ts:66-95` | `＋`; Room sheet Move to area; Add here |
| map-unlink, one-way, door, lock | `mapedit.ts:85-144` | Room sheet exit row |
| map-undo | `mapedit.ts:225-231` | Undo chip |
| Story list: select, uncovered only, keys | `storylist.tsx:195-287` | NB Story |
| Trace, Consequences, Knowledge, Facts, Pacing | `storylist.tsx:113-184`, `storylower.tsx` | NB Story row sheets |
| Add, bind, retitle, remove beat | `storylist.tsx:160-187` | NB Story |
| Flow graph, search, filters, follow, hover card | `flow*.tsx` | panel-only (decision 9) |

**Right column and console**
| Panel function | Panel cite | Builder home |
|---|---|---|
| Inspector header: ref, `~`, diagnostics, unreached | `right.tsx:27-66` | Sheet header |
| Card picker by file | `right.tsx:98-120` | Sheet by kind |
| Compile status, lint notes, last compile | `sections.tsx:34-72` | Build strip status, NB Checks |
| Drop this step and continue | `sections.tsx:49-51` | Keep-my-place notice |
| Failed checkpoint count | `sections.tsx:24-32` | NB Tools checkpoints |
| `~` counts, unconfirmed words, open source | `prose.tsx:45-100` | Build strip badge, NB Checks (open source is panel-only) |
| Change feed (you or outside), put back | `right.tsx:72-95` | NB Recent |
| Source footer (Alt-click) | `sections.tsx:238-253` | panel-only: a phone has no editor |
| Advance time | `sections.tsx:108-130` | NB Tools |
| Checkpoints: save, list, replay, pin, verdicts | `sections.tsx:132-200`, `verdicts.ts` | NB Tools |
| Go to room, Set fact, Set level | `cheats.tsx:8-85` | NB Tools |
| Write tab (`~` by file) | `sections.tsx:204-235` | NB Checks |
| State tab | `reading.tsx:42-68` | NB Tools State |
| Why tab | `reading.tsx:91-129` | NB Tools Why; also a "Why not offered" row on a ghost line |
| Step tab | `steptab.tsx:17-72` | NB Tools Step |
| Numbers | `numbers.tsx:134-158` | NB Tools Numbers |
| Find, referrers | `reading.tsx:131-190` | NB Contents Find; Sheet referrers |

**Inspector cards** (each row of `registry.json` gets its own `book` surface. This lists the cards.)
| Panel card | Panel cite | Builder home |
|---|---|---|
| Generic card, Add… menu, undo | `Generic.tsx:116-276`, `AddMenu.tsx` | Generic RN renderer, Add mechanic…, Undo chip |
| WordsField (prose, 409) | `fields.tsx:121-160` | In-place field |
| Room card: words, exits, add exit, add-here, mechanics | `cards/Room.tsx:65-190` | Page words; Room sheet; `+ Add here` |
| Entity card: words, Combat, Schedule, placement | `cards/Entity.tsx:22-171` | Page words; Person and Item sheets |
| Action, Quest, Reaction cards, Rules blocks | `cards/Action.tsx`, `Quest.tsx`, `Reaction.tsx`, `blocks/Rules.tsx` | Sheets with Policy, Steps, Trigger and Check blocks |
| Dialogue card: words, links, choices (add, rename, remove, fields, open) | `cards/Dialogue.tsx`, `Choices.tsx` | Conversation in Build; Dialogue sheet |
| Scene text: reword, rows, keys, choice words | `cards/Scene.tsx`, `SceneRows.tsx`, `SceneChoiceWords.tsx` | Conversation in place; Dialogue sheet rows |
| Modal scene: pages, trigger, treatment | `ScenePages.tsx`, `Trigger.tsx`, `Scene.tsx:226-253` | ScenePage in place; Scene sheet |
| World card: cartridge.json, roots, world files | `cards/World.tsx:37-160` | NB World |
| Combat block (run fights) | `blocks/Combat.tsx:23-44` | Combat block on the sheet |
| Schedule block | `blocks/Schedule.tsx` | Schedule block on the sheet |

**Palette and keys**
| Panel function | Panel cite | Builder home |
|---|---|---|
| Palette (Cmd-K): definitions, text keys, `~`, beats, flow items | `palette.tsx`, `shell.ts:113-175` | NB Contents search (one field over the same items) |
| Delete the selected definition | `shell.ts:113`, `author.ts:20-37` | Sheet foot Delete |
| Undo (palette) | `author.ts:40-48` | Undo chip, NB Recent |
| new-<kind> for 28 kinds | `edit/new.json`, `mapwire.ts:30-41` | NB Contents New |
| Cmd-E open source | `App.tsx:200-205` | panel-only |
| Column folds and dividers | `shell.ts:45-60`, `columns.tsx` | panel-only (layout) |
| `[ ] { }` walk, Cmd-Z | `prose_rules.ts:74-102` | kept for a hardware keyboard; Undo chip on touch |

## Appendix B: author server routes (from the inventory pass)

| Route | Handler | Builder use |
|---|---|---|
| GET `/events` (SSE) | `live.ts:251-255` | overlay, diagnostics, `changed`, timings |
| GET `/story` | `live.ts:248` | NB Story |
| GET, PUT `/checkpoints[/<name>]` | `live.ts:88-117` | NB Tools |
| GET `/todo`, `/numbers`, `/fights`, `/find` | `live.ts:204-215` | Checks, Numbers, Combat block, Find |
| POST `/open` | `live.ts:170-177` | panel-only |
| POST `/why` | `live.ts:179-187` | NB Tools Why and Step |
| GET `/source`, `/schema/<dir>`, `/line`, `/world`, `/templates`, `/journal` | `write.ts:238-264` | sheets, field 409, worlds, templates, Recent |
| POST `/hold` | `editing.ts:45-51` | auto-hold |
| POST `/change`, `/delete`, `/move`, `/undo`, `/new` | `write.ts:86-205` | sheets, map, Undo |
| POST `/edit` | `prose.ts:31-44` | in-place field (`was` is the line text) |
| POST `/set`, `/restructure` | `scene_card.ts:46-82` | choice labels, scene rows and pages |
| POST `/world` | `worlds.ts` (not read) | NB Tools Worlds |
