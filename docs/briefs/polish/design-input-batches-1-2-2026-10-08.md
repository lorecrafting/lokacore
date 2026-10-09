# Design input: batches 1, 2a, 2b (designer, 2026-10-08)

Read from the `lokacore-preview` worktree at `7c61d4d5` and the `polish/storybook` worktree
(`e1a53976`). Plan: `docs/briefs/polish/storybook-plan-2026-10-08.md` (A-F); owner G1-G5 all
"yes, the recommendation". Rules are linked, not copied: catalogue = `docs/BOOK-UI-COMPONENTS.md`,
interaction = `docs/system/book-ui.md`, values = `mobile/app/book/tokens.ts`. Line numbers are
`7c61d4d5` unless marked.

Batch 0 (in flight) already owns: `Control` `disabled`, the token contrast test, `web-preview.md`
"Storybook" section, `storybook:smoke`. Nothing below redoes them.

## Tokens: what changes (designer writes `tokens.ts`; nothing else in code is a value)

No new token name is needed for batches 1, 2a or 2b. Two edits, both mine:

| Edit | Value | Role | Needed by |
|---|---|---|---|
| `type.small` gains `fontVariant: ['oldstyle-nums']` | as written | status line and tip numerals (plan D14; mock `.foot` `font-variant-numeric`) | 2b |
| `tokens.ts:4` comment: drop the foundation-README reference | points at `BOOK-UI-COMPONENTS.md#design-tokens` only | archive (G2) | 1 |

Candidate removal, decided by a 2a fact: `size.underline` (1.5). React Native `Text` has no
underline-thickness style on any platform; if the developer confirms RNW has none either, the
catalogue row says "dotted underline (platform thickness)" and the token goes (designer edit, same PR).

Later batches (listed so nobody invents them): `size.focus: 2` (D15, batch 5, web only);
`size.chapterRule: 80` (G4, batch 6; the card's title is `type.pageTitle`, its label
`type.runningHead` in `dim`, the rule in `dim`, its button the Continue button). Mock `.chapter b`
is 32.5/1.05 against `pageTitle` 31/33: one size, no `type.chapterTitle`.

Sequencing: I commit the `type.small` edit on `main` (or as the first commit of 2b) before 2b
starts; 2a needs no token change.

---

## Batch 1: docs consolidation (plan A + E4)

### 1. `book-ui.md` -> catalogue moves (exact)

Each move: the sentence leaves `book-ui.md` (or loses its look words) and the fact lands in one
catalogue row. After the moves, E4's grep is empty.

| `book-ui.md` lines | Today | Becomes in `book-ui.md` | Lands in catalogue |
|---|---|---|---|
| 79-81 | "Band colours (`warning`, `danger`) mark only the condition pools hp, ma and mv; pennies and any other count always show in the normal tone, never `warning` or `danger`." | "Band tones mark only the condition pools hp, ma and mv; pennies and any other count show plain." | Status line row, States: "resource tones: `normal` in `fg`, `warning`, `danger`; only hp, ma, mv carry a band" |
| 87-93 | phase -> palette mapping, device setting, Settings override, motion link | "The Book's look follows the confirmed GameView solar phase per the [palette rule](../../BOOK-UI-COMPONENTS.md#design-tokens); the Book reads the phase label and computes no hours. There is no Settings override ([owner decision](../../decisions/owner-decision-design-foundation-2026-10-07.md))." | Colour bullet: "Phase `day` shows `light`, `dawn` `dawn`, `dusk` `dusk`, `night` `dark`; any other phase, a cartridge without a calendar, or no GameView (the save-error screen) shows `light`; never the device's light or dark setting." |
| 126 | "sits between hairlines" | "sits in the footer" | Footer row already has the hairlines |
| 165-167 | "...section headings and a minimum 44px touch target in both axes remain. Colours, fonts and sizes come from the [design tokens]." | "Explicit button labels/roles and section headings remain." | Head rule (new, under "Where each fact lives"): "Every pressable is at least `size.touch` in both axes." |
| 169-170 | "Implementation details live in book, pages and tokens." | delete | the Story column replaces code pointers |
| 232 | "italic **Journal updated** event" | "neutral **Journal updated** event, visually distinct from authored dialogue" | Log line row already names the system line (`dim` italic) |
| 320 | "shows the `light` palette (no GameView, so no phase)" | "has no GameView, so no phase" | Colour bullet (above) |

`book-ui.md:7-9` keeps its link to the catalogue. Lines 106-121 say "token" meaning the
freshness token: E4 must not ban the word.

### 2. Catalogue edits (`docs/BOOK-UI-COMPONENTS.md`)

- Lines 1-6: keep; add the head below as the first section.
- Lines 30-45 "Current reusable pieces": delete (the Story column replaces it).
- Lines 70-72 and 156: replace the foundation-README and specimen links with the Tokens story
  (`mobile/app/stories/Tokens.stories.tsx`) and the PageTurn story; the sound sentence at 156 ends
  "...plays, as the PageTurn story does."
- Lines 109-123: rename the fourth column "Story"; each cell becomes
  `` `stories/<Row>.stories.tsx` `` plus the live "Polish:" note until that row's slice lands
  (2a/2b delete their notes). Row names and files: Page, RoomPage, FixtureLink (no story: "none
  until a projection consumer"), EntityLine, VerbLine, ActionCard, ContinueButton, Control,
  LogLines, Footer, StatusLine, Tip (new row, split from Footer: the bubble is its own component),
  LetterTile, PageTurn, Tokens.
- Add the Tip row: "First-run tip: an `fg` bubble (`radius.card`, `space.md`/`space.lg` padding,
  centred, within `space.page` of each edge) with `bg` text in `type.small` and a Got it Control
  drawn on ink (label `bg`). State: shown." Remove the tip sentence from the Footer row; add to
  the Footer row: "the footer block sits under a `line` hairline; `space.sm` between rule, map
  and rule."
- Action card row: drop "label in `type.body` ink" ambiguity -> "label `type.body` `fg`,
  `space.md` vertical and `space.lg` horizontal padding, `space.sm` between cards".
- Entity line row: "dotted underline (`textDecorationStyle: 'dotted'`; solid where the platform
  has none)". Keep or drop `size.underline` per the 2a fact above.
- Log line row: add "one `Text` per line; a refused line's tag has `space.xs` horizontal padding".

Head text, verbatim (replaces nothing; new section after line 6):

```markdown
## Where each fact lives

- **Values** (colours, type, space, size, radius, opacity, motion, sound): [`tokens.ts`](../mobile/app/book/tokens.ts) and nowhere else; the [Tokens story](../mobile/app/stories/Tokens.stories.tsx) renders it live.
- **Look and states** of every component, and the token roles: this page, one row per component.
- **Interaction** (what shows when, what a tap does, returns, freshness): [Book UI](system/book-ui.md). It names no token, colour or size.
- **Working examples:** `npm run storybook` in `mobile/app` ([how](web-preview.md#storybook)); one `stories/<Row>.stories.tsx` per row, one story per state. A story carries no rule beyond a one-line link to its row.
- **References:** the two mocks in [docs/design](design/README.md); the owner's rulings in [decisions](decisions/README.md).
- Every pressable is at least `size.touch` in both axes; every text role reads at 4.5:1 on `bg` and `card` in all four palettes.
- A change lands in one place: a value in tokens, a rule here, a behaviour in Book UI; code and its story follow in the same slice.
```

### 3. `docs/design/README.md`, verbatim (new file; replaces `ui-exploration/README.md`)

```markdown
# Book design references

Two owner-approved HTML mocks. Open them in a browser; they load Google Fonts and html2canvas
from a CDN, their prose is placeholder and their rules are not the engine's.

- [chapter-one-playable.html](ui-exploration/chapter-one-playable.html): the base. The live Book's values are its `.ph` page with every effect off ([design foundation decision](../decisions/owner-decision-design-foundation-2026-10-07.md)); restored 2026-10-07 from its [published artifact](https://claude.ai/artifact/7jbp2SbLek8SNimVYzQcVk).
- [room-view.html](room-view/room-view.html): the style reference (the 2026-09-24 direction; same palette and type, it differs only in effects).

"Effects off": the mock's Effects panel and its "Archive, not in v1" group (paper grain and edges,
ink shadows, lamp glow, moon palette, drop capitals) are not adopted; the page curl and paper
sound are. Each effect waits for its own owner decision.

Rules: [component catalogue](../BOOK-UI-COMPONENTS.md). Values: [tokens](../../mobile/app/book/tokens.ts).
Behaviour: [Book UI](../system/book-ui.md). Earlier explorations and the foundation audit: [archive](../archive/README.md).
```

### 4. Archive moves (`git mv` to `docs/archive/design/`, same relative layout)

- `docs/design/foundation/README.md`, `docs/design/foundation/specimen.html`
- `docs/design/room-view/README.md`
- `docs/design/room-view/explorations/` (8 HTML + `moodboard.md`)
- `docs/design/ui-exploration/README.md` (its provenance sentence is in the new README above)

Stays: `docs/design/README.md` (new), `ui-exploration/chapter-one-playable.html`,
`room-view/room-view.html`, `provisional-story-mechanics.md` (not UI).

Links to fix (check_docs resolves every tracked `.md` link and requires reachability):
`README.md:21-22` -> one line to `docs/design/README.md`; `docs/system/future.md:39`;
`docs/BOOK-UI-COMPONENTS.md:71-72,156`; `docs/archive/decisions/owner-decision-sm2-scope-2026-10-01.md:9`;
`docs/archive/decisions/owner-decision-hp-ma-mv-2026-09-25.md:24`; `docs/archive/ROADMAP.md:59`
(path becomes `../design/room-view/README.md` from inside the archive); `docs/archive/README.md`
gains one line: "design/: the 2026-09 UI explorations, the room-view direction and the
2026-10-07 foundation audit; the live references are in docs/design". The three moved READMEs
must be linked from that line (reachability). Foundation README's check 5 (specimen mirrors
tokens) is dropped with the specimen; its heading list and mock-against-live table stay as
history. `tokens.ts:4` comment: designer.

### 5. Tokens story (`mobile/app/stories/Tokens.stories.tsx`, title `Docs/Tokens`)

Reads `tokens.ts` exports with `Object.entries`; no copied values.
- Palettes: four columns, one swatch per role; under each text role (`fg`, `dim`, `action`,
  `danger`, `warning`) its ratio on `bg` and on `card`, computed by the contrast function batch 0
  adds for the token test (import it; do not write a second one). Below 4.5 renders in `danger`.
- Type: every `type.*` style set in a sample line, with name, size, line height and spacing
  read from the object; the toolbar palette applies.
- Space, size, radius: a bar or square per key, labelled.
- Motion and sound: a table (name, duration, easing); no animation.
No play function except: every `motion.*.easing` is a key of the driver's easing map (E6 if batch 0
leaves it to batch 1).

### 6. `Catalogue.mdx` (`mobile/app/stories/Catalogue.mdx`, title `Docs/Catalogue`)

```mdx
import { Meta, Markdown } from '@storybook/addon-docs/blocks';
import catalogue from '../../../docs/BOOK-UI-COMPONENTS.md?raw';
<Meta title="Docs/Catalogue" />
<Markdown>{catalogue}</Markdown>
```
`.storybook/main.ts` `stories` adds `'../stories/*.mdx'`. Relative links inside the rendered
page open nothing in Storybook; one leading line says so. No link rewriting.

### 7. Check E4 (developer; proposed shape)

In `bin/check_docs.exs` (it already reads every tracked `.md`): fail when
`docs/system/book-ui.md` matches
`~r/\b(type|space|size|radius|motion|opacity|color)\.[a-z]|#[0-9a-fA-F]{6}\b|\b\d+ ?px\b|`(light|dawn|dusk|dark|fg|bg|dim|line|card|action|danger|warning)`/`.
Red control in `bin/docs_red_controls.sh`: a copy of book-ui.md with one planted "44px" line fails.

### Files to touch (outline)

Docs only, plus `.storybook/main.ts` (`stories` array) and two new story files. No component file.

---

## Batch 2a: leaf components + E3

Code names equal catalogue rows. `Act` is renamed `ActionCard` everywhere (Body, Combat,
DreamPage, Menu, notices, sections, Riddle); `Leave` is deleted (every Leave is a `Control`).
`Tap` stays the private touch primitive (RoomTitle, Position, EntityLine); it is not a row.
New file `mobile/app/book/lines.tsx` holds `EntityLine` and `LogLines`.

### ActionCard (`pages.tsx`, replaces `Act` at 90-97)

- Props: `{ b: Button; press: (b: Button) => void }` (unchanged from `Act`; the Button carries
  the label). No `note` prop: no live consumer; an unavailable action stays a `note(c)` Text.
- State: available only.
- Tokens: `card` fill, `line` border `size.rule`, `radius.card`, `minHeight: size.card`,
  `paddingVertical: space.md`, `paddingHorizontal: space.lg`, label `type.body` `fg`, left
  aligned. Siblings `space.sm` apart (the parent's `gap`, or `marginTop` on the card).
- Consumers (all `Act` sites except the two below): `pages.tsx:269-271` ThingPage actions;
  `Menu.tsx:56` Choice answers, `:98-104` Submit (lands after 2b, see overlaps), `:150-154`
  NPC actions, `:257-258` services; `notices.tsx:169-175` offerControl (a Tap+accent link today
  -> `<ActionCard b={button} press={(b) => p.press(b, id)} />`); `DreamPage.tsx:31-33`;
  `Combat.tsx:52-59`; `sections.tsx:71` ancestry, `:158,171` Ways move and door, `:210-212,218`
  Map place and Where (and `sections.tsx:156` `marginTop: 12` -> `space.lg`).
- Settles D7.

### VerbLine (`pages.tsx`, new)

- Props: `{ b: Button; press: (b: Button) => void }`.
- State: available only.
- Tokens: `Tap` (`size.touch`), `type.body` with `fontStyle: 'italic'`, colour `action`.
- Consumers: `pages.tsx:174-183` placeActions; `Body.tsx:44` water Surface.
- Settles D4.

### ContinueButton (`pages.tsx`, new)

- Props: `{ label: string; onPress: () => void }`.
- State: available.
- Tokens: `fg` fill, label `type.control` `bg`, `radius.card`, `minHeight: size.card`,
  centred text, `minWidth: size.touch`.
- Consumers: `sections.tsx:237-239` ChapterPage (`label="Continue"`), `sections.tsx:254`
  ScenePage (`label={p.next.label} onPress={() => p.press(p.next)}`).
- Settles nothing in D; prepares G4 (batch 6).

### Control conversions (`Control` exists; `disabled` from batch 0)

`pages.tsx:99-106` Leave (delete the component; call sites `pages.tsx:277`, `Menu.tsx:156`,
`notices.tsx:155`), `pages.tsx:129-131` Continue conversation, `pages.tsx:272-276` Back to
container, `DreamPage.tsx:34-36` Close, `DreamPage.tsx:48-50` Resume dream,
`DiscoveredMap.tsx:111-118` Back to map. The level stepper `DiscoveredMap.tsx:48-66` keeps its
glyph pressables (drawing file, lint-exempt) with `44` -> `size.touch`. These Controls sit inline
until batch 3's PageFoot (G3) moves them. Not 2a: `Menu.tsx:92-97` Backspace/Clear (2b, Riddle),
`Footer.tsx:133-145` Got it (2b).

### EntityLine (`lines.tsx`, new)

- Props: `{ name: string; rest?: string; note?: string; label: string; onPress: () => void }`.
  `label` is the accessibility label, required (today's words: `${name}, open`,
  `${name}, ${carrying}, open`, a notice's title); no default, so no wording changes.
- State: one.
- Tokens: `Tap`; line `type.body` `fg`; the name `fontWeight: '500'`,
  `textDecorationLine: 'underline'`, `textDecorationStyle: 'dotted'`; `rest` follows in the same
  Text; `note` below in `type.body` `dim` (`note(c)`).
- Consumers: `pages.tsx:191-206` Here (`rest="is here."`, `note` = carrying);
  `pages.tsx:279-283` Inside rows; `Menu.tsx:195-199` Contents rows; `notices.tsx:74-79`
  (remaining count as `rest=" (n)"`; keep the string as today), `:82-90`, `:104-111` boards;
  `sections.tsx:128-132` held, `:138-140` worn. Held items stop looking like plain prose and worn
  items stop being accent links: both become the same line.
- Settles D3.

### LogLines (`lines.tsx`, new) and the typed refused line

- Props: `{ lines: readonly DetailLine[] }`.
- States: narration (`type.log` `fg`), system (`{ text, event: true }`: `type.log` `dim`
  italic), refused (`{ kind: 'refused', reason, text }`: a tag in `type.tag` `danger` with
  `size.rule` `danger` border, `radius.tag`, `space.xs` horizontal padding, then the text in
  `type.log` `fg`). One `Text` per line; no joining with `\n`.
- `logs.ts:32` `DetailLine` gains the refused variant; `Logs.log: string[]` becomes
  `DetailLine[]`. The one producer: the barred-exit refusal, `model.ts:115` `refused()` returns
  the typed line and `Book.tsx` passes it through. Presenter only; no kernel or save change. If
  the `string[]` ripple through tests exceeds the slice, LogLines ships with narration and system
  only and the tag waits for a named follow-up; the catalogue row is written either way.
- Consumers (six renderers): `pages.tsx:135` room log (`marginTop: 12` -> `space.lg`),
  `pages.tsx:235-240` `logLines` (delete; callers `pages.tsx:266`, `Menu.tsx:143`),
  `Combat.tsx:22-26`, `notices.tsx:133-140` (keep its description filter, then `LogLines`),
  `DreamPage.tsx:25-29`, `sections.tsx:198-202` Map log.
- Settles D5.

### Stories (one file per row, `title: 'Book/<Row>'`, hand props; a `button()` fixture
helper in `stories/fixtures.ts` builds a `Button` from `presenter.ts`)

ActionCard: short, two-line label, list of six, with an unavailable note beside it.
VerbLine: one; three in a room. ContinueButton: chapter, scene. Control: every label in the
catalogue list (batch 0 has enabled/disabled). EntityLine: NPC with carried note, item, held,
worn, Inside, notice with remaining count, Contents row. LogLines: narration, system line,
refused with tag, 30 lines, empty. Each story's play: the one button is clickable and the
`fn()` fires; a11y is the smoke's job.

### Check E3 (lint widening; `lint/rules/mobile-book-raw-values.yml`, `lint/tests/...-test.yml`)

Keys regex: `^(fontSize|lineHeight|letterSpacing|padding\w*|margin\w*|gap|rowGap|columnGap|borderRadius|borderWidth|minHeight|minWidth|width|height|opacity)$`
(exclude `flex`, `zIndex`, `tabIndex`, `top/left/right/bottom`: layout and drawing).
`fontFamily` string literals. Files add `mobile/app/stories/*.tsx`, `mobile/app/.storybook/*.tsx`;
`ignores`: `MapDrawing.tsx`, `DiscoveredMap.tsx`, `joystick.ts`. `Footer.tsx` `SPOT`/`AWAY`
(152-158) move to `joystick.ts` beside `ZOOM` (they are drag geometry), so `Footer.tsx` is fully
linted (this move is 2b's: it edits Footer.tsx). Red control: the test yml's `invalid` list gains
`{ padding: 8 }` and `{ fontFamily: 'Georgia' }`.

### Fidelity items 2a settles: D3, D4, D5, D7. Leaves for 5: D1, D2, D6 (`Sheet` gap, batch 3).

### Outlines of files 2a touches

```
pages.tsx          35 Tap | 71 Control | 90 Act -> ActionCard | 99 Leave (delete) | 110 RoomPage
                   135 room log | 174 placeActions | 187 Here | 219 Sheet | 235 logLines (delete) | 251 ThingPage
lines.tsx (new)    EntityLine | LogLines
Menu.tsx           25 Choice | 121 NpcPage | 191 ContentsPage | 232 ShopOptions | 252 ServiceOptions
notices.tsx        66 NoticeLink | 99 NoticeEntries | 119 NoticePage | 161 offerControl
DreamPage.tsx      11 DreamPage | 41 DreamResume
sections.tsx       51 AncestryPage | 117 CarryingPage | 151 Ways | 188 MapPage | 233 ChapterPage | 244 ScenePage
Combat.tsx         11 Foes | 31 Combat
Body.tsx           35 Body (line 44)
DiscoveredMap.tsx  44 levelBar | 100 roomDetail
logs.ts            32 DetailLine, 33 Logs
model.ts           115 refused
Book.tsx           43 pressBook / the `refused` handler only if the typed line ships
lint/rules/mobile-book-raw-values.yml, lint/tests/mobile-book-raw-values-test.yml
```

---

## Batch 2b: footer family

### StatusLine (new file `mobile/app/book/Status.tsx`, moved from `Footer.tsx:193-295`)

- Props: today's `StatusProps` (`Footer.tsx:196-207`), unchanged. Export `StatusLine`
  (rename from `Status`; `Book.tsx:6` import, `Book.tsx:184` call).
- States: enabled; locked (`dim`, not pressable, Contents included: today's
  `Footer.tsx:246,252` behaviour); pending ("save not confirmed", full width); bleeding
  (`danger`); calendar line or branch glyph.
- Tokens: one centred wrapping row, `type.small` `dim` (now with old-style numerals); items
  separated by a `dim` " · " Text with `space.sm` gap (replaces `columnGap: 14` at
  `Footer.tsx:214`); resource keys `type.label`; resource tones `band()`; Contents label
  `action` when enabled. The resource group's inner `'  '` separator (`Footer.tsx:275`) becomes
  `space.sm` margin.
- Pennies tone: `model.ts:132-133` already restricts bands to hp, ma, mv. 2b verifies
  loka-49n 5 against it and adds the story; a fix only if the story shows a toned pennies value.
- Settles D10, D14.

### Tip (`Footer.tsx:126-148`, own export)

- Props: `{ dismiss: () => void }`. State: shown.
- Tokens: bubble `fg` fill, `radius.card`, `paddingVertical: space.md`,
  `paddingHorizontal: space.lg`, `alignSelf: 'center'`, `marginHorizontal: space.page`; text
  `type.small` `bg`; Got it is `Control` with `onInk` (label `bg`), right-aligned inside the
  bubble, label "Got it" (`type.control` is small caps; the lowercase string at `Footer.tsx:144`
  goes).
- `Control` gains `onInk?: true` (one consumer; `pages.tsx:71`): this is the one 2a/2b touch on
  `pages.tsx`, see overlaps.
- Settles D11.

### Footer (`Footer.tsx:35-73`)

- Props unchanged. States: rest, held, tip.
- Tokens: rules `width: size.footerRule` (replace `flex: 1` at `:23`), `height: size.rule`;
  row `columnGap: space.sm` (`:59`), centred; map box `size.minimap` (`:62`); zoom
  `motion.quick.duration` (`:122`). The footer block (`Book.tsx:177-204` Bottom): `padding: 8`
  -> `paddingTop: space.sm`, `paddingHorizontal: space.xl`, `paddingBottom: space.lg`,
  `borderTopWidth: size.rule`, `borderTopColor: c.line`. `Said` (`:159-171`) unchanged;
  `SPOT`/`AWAY` move to `joystick.ts` (E3).
- Settles D9.

### LetterTile and Riddle (new file `mobile/app/book/Riddle.tsx`, moved from `Menu.tsx:65-109`)

- `LetterTile` props: `{ letter: string; used: boolean; label: string; onPress: () => void }`.
  States: free; used (`opacity.disabled`, `disabled`, not pressable; it keeps its place in the
  row so the bank does not reflow).
- Tokens: `card` fill, `line` border `size.rule`, `radius.card`, `width`/`height: size.touch`,
  `type.tile` `fg`, centred. Bank row: `flexWrap`, `gap: space.sm` (replaces `space.lg` at
  `Menu.tsx:74`).
- `Riddle` keeps its props and buffer; exports so its story can render "answer in progress".
  Backspace and Clear (`Menu.tsx:92-97`) become `Control`s in a row; Submit stays `Act` in 2b and
  is renamed by 2a's pass (see overlaps). `Menu.tsx:7-19` import block gains `Riddle` from
  `./Riddle.tsx`; `Menu.tsx:36` `marginTop: 12` -> `space.lg` is 2a's (Choice).
- Settles D12.

### Stories

StatusLine: plain, calendar with solar and lunar, warning hp, danger hp, bleeding, pennies
normal, locked, pending. Tip: shown (play: Got it fires `dismiss`). Footer: rest, held (play:
pointer down on the map), tip, barred exit, up and down nodes, night (set the palette global).
LetterTile: free, used. Riddle: full bank of 12, answer in progress (play: pick two tiles, the
answer text shows them; Backspace removes one).

### Fidelity items 2b settles: D9, D10, D11, D12, D14. Leaves D16 (minimap stroke by palette) for 5.

### Outlines of files 2b touches

```
Status.tsx (new)   StatusProps | calendarLine | StatusLine | shown | Position   (from Footer.tsx 193-295)
Footer.tsx         23 rule | 35 Footer | 116 responder (122) | 126 Tip | 152 AWAY, 153 SPOT (move out) | 159 Said
Riddle.tsx (new)   Riddle | LetterTile   (from Menu.tsx 65-109)
Menu.tsx           7-19 imports only
joystick.ts        receives SPOT, AWAY beside ZOOM
Book.tsx           6 import | 177 Bottom (182 padding, 184 StatusLine)
pages.tsx          71 Control: `onInk?` prop only
model.ts           132 toneOf (verify, likely no change)
mobile/app/book/__tests__/polish-book.test.ts  70,169 find `Footer` by type.name: unchanged
```

---

## 2a / 2b file overlaps (the plan said "different files"; three are shared)

| File | 2a | 2b | Resolution |
|---|---|---|---|
| `pages.tsx` | ActionCard, VerbLine, ContinueButton, delete Leave/logLines, Here, room log | `Control` `onInk?` (one prop, lines 71-88) | 2b's edit is inside `Control` only; 2a does not touch `Control`. Merges cleanly unless both reformat the file. |
| `Menu.tsx` | Choice (36, 56), NpcPage (143-156), ContentsPage (195-199) | import block (7-19) and the Riddle block leaves (65-109) | 2b moves Riddle out; 2a leaves 65-109 alone. Merge 2b first; 2a then renames `Act` -> `ActionCard` in `Riddle.tsx:98` as part of its rename pass. |
| `Footer.tsx` | none (E3 lint would flag SPOT/AWAY) | everything | 2b moves SPOT/AWAY to `joystick.ts`; 2a's lint widening lands with `Footer.tsx` already clean, so merge 2b before 2a, or 2a's lint PR waits on 2b. |

`Book.tsx`: 2b (Bottom padding, StatusLine import); 2a only if the typed refused line ships
(the `refused` handler). `sections.tsx`, `notices.tsx`, `DreamPage.tsx`, `Combat.tsx`,
`Body.tsx`, `DiscoveredMap.tsx`, `lines.tsx`: 2a only. `Status.tsx`, `Riddle.tsx`,
`joystick.ts`: 2b only.

Order that avoids every conflict: 2b merges first (M), 2a rebases (one rename line in
`Riddle.tsx`, lint rule sees a clean `Footer.tsx`). Both may be developed in parallel.

## Proposed checks (developer slices, each with a red control)

1. E4 book-ui look-word grep in `check_docs.exs` (batch 1).
2. E3 widened raw-value lint (2a) as above.
3. E1 (batch 3, noted now so 2a/2b name files to match): catalogue row -> `stories/<Row>.stories.tsx`
   exists, and every export of `book/*.tsx` except `MapDrawing`/`DiscoveredMap` internals is
   imported by a story.

## Open questions for the owner

None. The three judgement calls here are the designer's and are decided above: Got it sits
inside the tip bubble in `bg`; no `note` line on action cards until a consumer exists; the
chapter card reuses `type.pageTitle` rather than a new size.
