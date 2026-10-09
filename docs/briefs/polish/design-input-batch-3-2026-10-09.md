# Design input: batch 3 (Page shell, PageFoot, E1)

Designer brief input, read from `origin/polish/storybook-b2` 136e8681. Plan rows: B "Page", "PageFoot",
"Whole pages" (signatures only); F row 3; E1; D1, D6, D13. Owner: G3 yes (every local return in a page
foot), G4 later (batch 6), G5 no eyebrow. Paths below are `mobile/app/` unless rooted.

## 1. `Page` (pages.tsx; replaces `Sheet`)

Props (all drawing; behaviour stays in Book.tsx):

| Prop | Role | Consumer |
|---|---|---|
| `title?: string` | `type.pageTitle` `fg`, `accessibilityRole="header"`, `titleFocus`. Absent: no header drawn (D13); the page's first block takes `titleFocus` instead (ScenePage spreads it on its line Text). | every detail and section; ScenePage omits it |
| `fixedTitle?: boolean` | title sits outside the scroll in `type.roomTitle`, centred, block padding `space.xl` top (D1), `space.page` sides, `space.md` below (`titleStyle`). | RoomPage only |
| `onTitlePress?: () => void` | the Look tap: title wrapped in `Tap`, label `"<title>, look"`. Only the room title is pressable; a detail title never is. | RoomPage when `g.look` |
| `scrollToEnd?: boolean` | `onContentSizeChange` → `scrollToEnd({animated:false})` when true. | NpcPage: `p.log.length > 0` |
| `foot?: ReactNode` | rendered in a `PageFoot` under the scroll (see 2); nothing when absent. | every page with a local return |
| `children` | blocks inside one `ScrollView`, `contentContainerStyle={{ padding: space.page, gap: space.block }}` (D6: was `space.md`/`space.sm`). | |

Shell: `<View flex:1 bg={c.bg}>{fixed title}<ScrollView …/>{foot && <PageFoot>{foot}</PageFoot>}</View>`.
The running head is **not** a Page prop (drop the plan's `head?`): it is drawn once by `Body.tsx:42`
above whatever page shows, and by `Combat.tsx:40` because Combat renders outside Body (`Book.tsx:151`).
The Page story composes `RunningHead` + `Page`, as today.

Section heading: export `SectionTitle({children})` from pages.tsx = `Text` with `sectionTitleStyle`
and `accessibilityRole="header"` (today the four headings have no header role). Replaces
`pages.tsx:258` Inside, `sections.tsx:130,134` Held/Worn, `sections.tsx:210` Where. Delete the
`sectionTitleStyle` export once unused.

New tokens: none. D1 uses `space.xl`, D6 `space.block`, foot padding `space.md`/`space.xl`.

### Shells it replaces (file:line at 136e8681)

| Today | Becomes |
|---|---|
| `Sheet` users: `pages.tsx:246` ThingPage, `Menu.tsx:141` ContentsPage, `sections.tsx:37,63,86,128,196,226,234,248`, `notices.tsx:125`, `DreamPage.tsx:25`, `stories/Page.stories.tsx:16` | `Page`; delete `Sheet` (`pages.tsx:209-222`) |
| `Menu.tsx:78-86` NpcPage own ScrollView + title (gap `space.sm`, "not yet a Sheet") | `Page title scrollToEnd foot={Leave}`; drop `useRef`/`ScrollView` import |
| `Combat.tsx:39-47` own View + ScrollView + title (gap `space.sm`) | `<><RunningHead/><Page title="Combat">…</Page></>`; no foot (combat has no local return) |
| `pages.tsx:118-135,139-160` RoomPage own View + RoomTitle + ScrollView (`padding: space.page`, no gap; `marginTop` at `:130,:202`) | `Page fixedTitle title onTitlePress`; delete `RoomTitle`; `marginTop`s at `pages.tsx:130,202` go (gap does it) |
| `SaveError.tsx:22-31` centred View + `pageTitleStyle` Text (no header role, no focus) | `Page title={PLAIN…}` inside its SafeAreaView/PaletteContext; note and Start over as children (Start over is not a return: body, not foot); no vertical centring |
| `sections.tsx:248-253` ScenePage `Sheet title=""` (D13 empty header) | `Page` without `title`; line Text gets `titleFocus` |
| `Book.tsx:247-254` Fault | **stays**: it is a note beside the retry under any page's status line, not a page; making it a Page would hide the page the fault happened on. Plan row B's "Fault" consumer is withdrawn. |

One-offs the conversion removes (flag if they survive): `Menu.tsx:29` `marginTop: space.lg` on
Choice; `sections.tsx:156` `marginTop: space.lg` on each Way (gap covers both); `pages.tsx:130,202`.

## 2. `PageFoot` (pages.tsx)

Form: the mock's `.pg-foot`: a `line` hairline (`borderTopWidth: size.rule`) above a centred row
(`flexDirection:'row', justifyContent:'center', columnGap: space.lg`), padding `space.md` top,
`space.xl` sides and bottom; outside the scroll, at the page's bottom, above the status line.
Children: the page's local returns as `Control`s, nearest first. States: one return; two returns
(a nested item: Back to container, Leave). `Bottom` (`Book.tsx:183-190`) keeps its own hairline:
the mock has both (`.pg-foot` and `.base`).

Returns that move into the foot (Body already passes `world`/`back`):

| Page | Today | Foot |
|---|---|---|
| ThingPage `pages.tsx:256-257` | Back to container, Leave inline before Inside | `[back && Back to container, Leave]`; Inside now follows the cards in the body |
| NpcPage `Menu.tsx:104` | Leave inline (close_choice handler unchanged) | Leave |
| NoticePage standalone notice `notices.tsx:149-151` | Leave inline | Leave (`world`) |
| NoticePage board | `Bottom` Back to World (`Book.tsx:224-227`) | Back to World (`world`) |
| NoticePage notice under a board | `Bottom` Back to board | Back to board (`back`; add `back` to notices.tsx `Props`) |
| DreamPage `DreamPage.tsx:38` | Close inline | Close |
| Contents, Character, Journal, Carrying, Settings | `Bottom` Back to World | Back to World |
| Map | `Bottom` Back to World; `DiscoveredMap.tsx:113` Back to map inline inside the room detail | `[chosen && Back to map, Back to World]`: lift `selected` from `DiscoveredMap.tsx:16` to MapPage (`useState`, pass `selected`/`select`); DiscoveredMap loses its inline Control |
| Room, Scene, Chapter, Ancestry, Combat | none / Footer | no foot |
| Stay in the body (not returns) | Resume dream `DreamPage.tsx:50` (opens a child), Continue conversation `pages.tsx:125` (opens), Start over (Settings, SaveError, Fault), Got it (Tip) | unchanged |

`Book.tsx:215-240 navigation()`: the page branch goes; `Bottom` renders `Footer` only when `!p.page`
(and not ancestry/scene/combat), then the status line, catching up, fault. Tests that look for these
labels in the tree (order/position): `book/dream.test.ts`, `keyboard.test.ts`, `notice_board.test.ts`,
`item_detail.test.ts`, `polish_detail.test.ts`, `priory.test.ts`, `polish.test.ts`.

## 3. Spec text (designer writes these in the PR; shown here for the developer)

### `docs/system/book-ui.md`

Append to "Detail-page order" (after "World retains its room-page order."):

> A page's local returns (Leave, Back to World, Back to board, Back to container, Back to map,
> Close) sit in its page foot, below the scrolling content and above the status line, nearest first;
> offered actions never do. World, a scene, a chapter title, the ancestry choice and combat have no
> foot. A control that opens a child (Resume dream, Continue conversation) stays in the content.

"Notice-board details" line 211: "Available controls follow nonempty history and precede Leave;" →
"Available controls follow nonempty history; Leave sits in the page foot;".

"NPC dialogue and action details" lines 224-226: "Talk/Leave/other offered actions follow it
initially; as dialogue grows, the offered controls sit immediately after the latest chronological
dialogue/event entry **inside** the scrolling content." → "Talk and the other offered actions follow
it initially; as dialogue grows, they sit immediately after the latest chronological dialogue/event
entry **inside** the scrolling content, and Leave sits in the page foot."

"Minimap, Map and presentation controls" after "a room detail names that known room and its known
exits." (line 140): "While a room detail is open, Back to map is the page's nearest return, beside
Back to World."

Nothing else changes: Back to board → Back to World (199), Close → bed, Leave → World (785),
Back to container (749) keep their meaning. E4 holds: no token, px or colour above.

### `docs/BOOK-UI-COMPONENTS.md` catalogue rows

- **Page**: "One shell for every page: `space.page` margin, blocks `space.block` apart,
  `type.pageTitle` header in `fg` with the arriving focus (a page without a title gives its first
  block the focus); a section heading (Inside, Held, Worn, Where) is `SectionTitle`,
  `type.sectionTitle` `fg`, a header. The Room's title is the fixed variant: `type.roomTitle`,
  centred, `space.xl` above, outside the scroll; only it is pressable (the Look tap). A page that
  grows at the end (dialogue) scrolls to its end. The running head sits above the Page, drawn by
  the body, not the Page: … (keep the existing running-head text). States: scrolling title, fixed
  title, no title. Story `stories/Page.stories.tsx`." Drop the Polish note.
- **PageFoot** (new row after Page): "The page's local returns, Controls centred in a row
  `space.lg` apart under a `line` hairline, `space.md` above, `space.xl` beside and below; outside
  the scroll, above the status line. States: one return; two (nested item). Story
  `stories/PageFoot.stories.tsx`."
- **Room page**: "Fixed centred `type.roomTitle`" → "the Page's fixed title (the Look tap …)".
- **Control**: delete "A section return sits centred below a `line` hairline." (now PageFoot);
  Polish note: drop the done items (Leave, Back to container are Controls since batch 2).
- **Page turn / Input**: "focus moves to its title" → "focus moves to its title, or to its first
  block when it has none".

## 4. Stories (hand props; `stories/fixtures.ts` `button()` for cards)

`stories/Page.stories.tsx` (replace the composed `Page` helper with the real one):
- `WithRunningHead`, `LongRunningHead`, `NoRunningHead` (keep; title Settings, foot Back to World)
- `WithSectionHeadings`: SectionTitle Held + 2 EntityLines, SectionTitle Worn + EntityLine
- `LongTitle`: a two-line authored title, play: heading visible
- `FixedTitle`: `fixedTitle onTitlePress` + 40 prose lines; play: heading has name "X, look", still
  in the viewport after scrolling the content
- `NoTitle`: scene shape (one prose block + ContinueButton); play: no heading role
- `ScrollToEnd`: 30 `LogLines`, `scrollToEnd`; play: last line visible
- `WithFoot`: foot Leave; play: click → onPress once

`stories/PageFoot.stories.tsx`: `OneReturn` (Leave), `TwoReturns` (Back to container, Leave);
play: each button clickable, two buttons present. Whole-page stories: batch 4 (`screenFrom`).

## 5. E1 check: catalogue ↔ stories

`mobile/app/catalogue.test.ts` (the `npm test` glob `*.test.ts` already includes it), Node test:

1. For each table row of `docs/BOOK-UI-COMPONENTS.md` whose Story cell names
   `` `stories/<X>.stories.tsx` ``, `stories/<X>.stories.tsx` exists.
2. For each `export function <PascalCase>` in `book/*.tsx` (ast-grep
   `export function $NAME($$$) { $$$ }` or a regex), some `stories/*.stories.tsx` imports that name
   from `'../book/<file>'`. Exempt, each with a one-line reason in the test: everything in
   `MapDrawing.tsx` (a drawing); `Tap` (shown through VerbLine and the room title); the whole-page
   set until batch 4 (`RoomPage ThingPage NpcPage ContentsPage Item NpcDetail CharacterPage
   AncestryPage JournalPage CarryingPage MapPage SettingsPage ChapterPage ScenePage NoticePage
   NoticeEntries DreamPage DreamResume Combat DiscoveredMap Body BookView Book`), listed under a
   `// batch 4 empties this list` comment.
3. Red control (run once, state it in the PR): `git mv stories/PageFoot.stories.tsx /tmp` → (1)
   fails naming the row; delete `PageFoot` from the Page story import → (2) fails naming the export.

## 6. Outline of the files to touch (ast-grep outline, 136e8681)

- `book/pages.tsx`: 23 titleStyle · 24 pageTitleStyle · 25 sectionTitleStyle · 28 titleFocus ·
  37 Tap · 52 RunningHead · 74 Control · 106 RoomPage · 140 RoomTitle · 185 Here · 209 Sheet ·
  233 ThingPage
- `book/Menu.tsx`: 18 Choice · 68 NpcPage · 139 ContentsPage · 151 Item · 214 NpcDetail
- `book/Combat.tsx`: 13 Foes · 29 Combat
- `book/sections.tsx`: 27 CharacterPage · 54 AncestryPage · 83 JournalPage · 120 CarryingPage ·
  150 Ways · 187 MapPage · 224 SettingsPage · 232 ChapterPage · 240 ScenePage
- `book/notices.tsx`: 15 Props · 68 NoticeLink · 98 NoticeEntries · 115 NoticePage
- `book/DreamPage.tsx`: 13 DreamPage · 43 DreamResume
- `book/Book.tsx`: 133 BookView · 164 BottomProps · 178 Bottom · 215 navigation · 247 Fault
- `book/Body.tsx`: 36 Body · 54 PageBody · 88 sectionPage · 102 WorldPage
- `book/DiscoveredMap.tsx`: 11 DiscoveredMap (16 `selected` state) · 46 levelBar · 102 roomDetail
- `SaveError.tsx`: 17 SaveError
- `stories/Page.stories.tsx` (rewrite), `stories/PageFoot.stories.tsx` (new), `catalogue.test.ts` (new)
