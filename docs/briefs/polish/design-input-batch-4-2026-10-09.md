# Design input: batch 4 (scenario fixtures, page stories, live stories)

Sources: `docs/briefs/polish/storybook-plan-2026-10-08.md` C and E5; `docs/BOOK-UI-COMPONENTS.md#component-catalogue`;
`docs/system/book-ui.md` (Detail-page order, Notice-board, NPC dialogue, Item, Combat, B3 shop, B8/B9 Maud and bed,
Letter-bank riddle, Chapters/scenes/recovery). Harness: `book()` in `mobile/app/book/__tests__/polish-book.test.ts:94`
(`tap`, `labels`, `map`, `sql`, `game`, `clock`); routes already translated to Book labels in
`mobile/app/walkthrough/chapter1.walk.ts` (`talk`, `moves`, `spell`, `search`, `childReturn`, `bell`, 2-chandlers-debt,
3-lantern-dream, wisp ward); kernel recipes `kernel/ts/test/e1_*.ts` (creatures/night_marsh for hounds, items for
containers, services/maud, optional_quests). Spike: `lokacore-spike` bb3faed6 (`stories/live/checkpoints.ts`,
`stories/Live.stories.tsx`). Batch 3 (26a7ac87) `mobile/app/catalogue.test.ts` EXEMPT whole-page list to empty:
RoomPage ThingPage NpcPage ContentsPage Item NpcDetail CharacterPage AncestryPage JournalPage CarryingPage MapPage
SettingsPage ChapterPage ScenePage NoticePage NoticeEntries DreamPage DreamResume Combat DiscoveredMap Body BookView Book,
plus SkillDetails/ItemDetails ("batch 4 shows it there"), plus the pinned missing `stories/RoomPage.stories.tsx`.

## 1. Page stories (C row "Pages"; 43)

Route = taps after `book(bundle('missing_child_v042_hash'))` (which already taps Continue past the chapter page when
needed). Ancestry `Fen-born` unless said. "Palette" = where a non-light palette is the point; every story takes all
four from the toolbar, and the smoke (E2) runs light|dark.

| Group | Story | Route / view | Palette note |
|---|---|---|---|
| Room | First room | Fen-born, Continue | all |
| Room | NPCs and items | after `search` steps 1-2 (Green, north north: fox drawing + Tracks) or Fen Isle rooms with Vesper+Wren | all |
| Room | With notices | Ferry Landing (Landing notice) or the market cross board | all |
| Room | Long log | after `search` complete (many system lines) | all |
| Room | Refusal line | a barred move (night marsh exit or Deep Fen water exit) | all |
| Room | At night | same view with `clock.wall` advanced past dusk (status shows the night time; prose unchanged) | dusk, dark: D16 minimap |
| NPC | Choice | Elspeth open, Talk | all |
| NPC | Riddle | Vesper after message (`childReturn` to `Talk to Vesper`), tiles shown, buffer empty | all |
| NPC | Shop | Road-born, north west, Peg Harrow open (shelf, Buy/Sell, one unaffordable reason) | all |
| NPC | Services | Widow Maud open (Room/Meal/Drink offers with prices and reasons) | all |
| NPC | Refused answer | Wisp after a wrong anagram (`Ask Wisp again`) : refused tag in the detail log | all |
| NPC | Closed conversation | Elspeth after the search quest turned in (no Talk, history only) | all |
| Notices | Board | market cross board open (ordered notice rows, remaining count) | all |
| Notices | Notice with Read | Landing notice open after Read (description once, read line) | all |
| Notices | Bed with Resume dream | `3-lantern-dream` after first Rest, Close: bed page shows Resume dream | all |
| Item | Plain | fox drawing open (Take) | all |
| Item | Container with Inside | hound corpse or trunk open (Inside rows, Back to container) | all |
| Item | Liquid / fuel / weapon | lantern (fuel), waterskin (liquid), the one weapon Chapter 1 projects | all |
| Item | Too heavy | trunk open: refused Take note with its reason (polish.test.ts:303 recipe) | all |
| Combat | One foe | marsh hound Attack (e1_creatures) | dusk/dark (night marsh) |
| Combat | Pack | two hounds present (e1_night_marsh) | dusk/dark |
| Combat | Bleeding | after a hit that bleeds; status shows bleeding; Bandage offered if qualified | dusk/dark |
| Map | Discovered 2 levels | chapel, up up, then `map()` | all |
| Map | Barred exits | marsh at night with barred water exits | dusk/dark |
| Map | Where | Where mode open | all |
| Other | Dream | at the choice: Follow the fox / Wake | dark (owner may want this one dark by default: question) |
| Other | Journal | 3 quests (search, Chandler's debt, Lantern room) | all |
| Other | Carrying empty | first room, Contents > Carrying | all |
| Other | Carrying held+worn | after fox drawing, ledger taken | all |
| Other | Character unknown | first room | all |
| Other | Character full | after Learn swim (Sedge) and a read book (D2): skills, known topics | all |
| Other | Contents | Contents page | all |
| Other | Chapter title | fresh game before Continue (G4 card later; story stays) | all |
| Other | Scene | chapel bell scene page 1 | all |
| Other | Ancestry | fresh game choices page | all |
| Other | Settings | Settings (Sound control, Start over Control) | all |
| Other | SaveError x3 | hand props: the three kinds; one with the lock sentence | all |
| Other | Fault | hand props | all |
| Other | Pending save | screen `pending` true (hand-set on a room view): status "save not confirmed", locked controls | all |
| Other | Catching up | the catching-up shell state, hand props | all |

Rules the stories inherit (no new rule text needed): Page shell and running head per catalogue "Page"; refused tag per
"Log line"; unavailable offers are notes, never disabled cards ("Action card"); status locked state on scene, combat,
chapter title. SaveError/Fault/pending/catching-up are shell states, not GameViews: hand props, like leaf stories.

## 2. Live stories

Checkpoints (9; each a `routes` entry in `checkpoints.ts`, SQL restored at load):

| Name | Route | For polishing |
|---|---|---|
| first-room | Fen-born, Continue (exists) | Room, footer, status, first tip |
| elspeth-asked | + Elspeth, Talk, "Will you look around…" | mid-conversation, running head on, Journal updated |
| vesper-riddle | `search`, `childReturn` to Talk to Vesper (riddle pending, no tiles pressed) | tiles, Backspace/Clear/Submit, wrong-answer tag |
| peg-shop | Road-born, north west, Peg Harrow | shop rows, Buy, pennies refresh |
| maud-paid-bed | `3-lantern-dream` through "Rent room — 3p", Leave | services, bed, Rest → dream |
| corpse-contents | hound killed, corpse present (e1_creatures) | container Inside, Take → Back to World |
| hound-combat | marsh at night, hound present, before Attack | Attack → combat page, Stand/Flee |
| chapel-map | chapel, up up (two levels discovered) | footer map press, Map page, Where |
| night-green | first room with `WALL` past dusk (checkpoints.ts already reads `process.env.WALL`) | dusk/dark palettes as the Book itself picks them |

Click-throughs (4 `play` functions on those checkpoints):

1. first-room: Elspeth open → Talk → choice → the NPC log gains the authored line and "Journal updated"; Leave → the
   running head shows the quest text (spike's `FirstRoom` play, extended).
2. vesper-riddle: a wrong word on the tiles → refused tag beside the sentence; Clear; spell LANTERN → correct narration,
   Submit gone.
3. peg-shop: Buy an affordable item → status pennies change, Carrying shows it; the unaffordable offer stays a note.
4. corpse-contents: Inside row → child detail → Take → returns to the corpse detail with Back to World.
(Optional 5: maud-paid-bed: Bed → Rest → Follow the fox → Acknowledge → Close → Resume dream on the bed.)

Live stories stay `tags: ['!test']` (dev server only); E1 counts the Book/BookView/Body imports in `Live.stories.tsx`.

## 3. Sidebar

- `Docs/Tokens`, `Docs/Catalogue` (exist).
- `Book/<Row>` one per catalogue row (exist; `Book/Riddle` is not a row: fold into `Book/LetterTile` or leave, PM call).
- `Pages/Room`, `Pages/NPC`, `Pages/Notices`, `Pages/Item`, `Pages/Combat`, `Pages/Map`, `Pages/Sections` (Journal,
  Carrying, Character, Contents, Settings, Ancestry), `Pages/Chapter and scene`, `Pages/Recovery` (SaveError, Fault,
  pending, catching up). Story names = the state column above ("First room", "Too heavy").
- `Live/<checkpoint>` ("Live/First room", …), one story per checkpoint; click-throughs are the story's `play`, not
  extra entries.
- `preview.tsx` `options.storySort.order: ['Docs', 'Book', 'Pages', 'Live']`.

## 4. What a page story must show

- Rendered through the real presenter: `screenFrom(view.json)` with `buttonsOf` and the cartridge text table; `press`
  is `fn()`; no hand-made words.
- Full page in a device-high frame (`Framed`, `Page.stories.tsx:17`) so the page scrolls as on a device; Room stories
  render `Body` (running head, room, footer, status), details render the pushed page with its running head.
- Palette from the toolbar only (existing `globals.palette`); no story hard-codes a palette. Night/combat/dream rows
  set `parameters.globals.palette` to dusk or dark as a default, still switchable.
- Viewports: keep iPhone 11 default, SE, Pixel 7; add one tablet (iPad mini 744x1133) to `preview.tsx` options so the
  centred page width and footer rules can be judged. Both orientations unneeded.
- Each story file: one comment line naming its C row and route; nothing else (rules live in the catalogue).
- `play` only where a state needs input (none expected; the fixtures hold the state).
- axe `test:'error'` and the label-in-name `afterEach` run on every page story: contrast in light and dark, every
  button's name starts with its shown text.

## Proposed checks (developer slice)

- E5 as written, plus determinism: `stories:views` run twice gives identical bytes (the spike uses `randomUUID` and
  `performance.now`; IDs and clocks must be fixed or stripped). Red: leave `randomUUID` in.
- `catalogue.test.ts` EXEMPT shrinks to Tap and MapDrawing only; the pinned `missing` becomes `[]`.
- Page story count equals the C "Pages" row (43 incl. recovery states): a node test over `stories/Pages*.stories.tsx`
  export names vs a list in the catalogue row. Optional; the catalogue row is the list.

## Open questions (owner)

- Dream page: dark palette by default in its story, or light like the rest?
- Tablet as a polish target at all (adds a viewport, nothing else)?
