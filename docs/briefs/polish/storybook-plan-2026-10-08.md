# Storybook as the Book UI source of truth: plan (designer, 2026-10-08)

Read from `polish/ch1-batch1` (ba70abce) and the `polish/storybook` spike worktree (uncommitted:
`mobile/app/.storybook/*`, `stories/{Page,Control,PageTurn}.stories.tsx`, `storybook:smoke`).
Owner goals: Beads loka-bhb. References: the mock playable (base) and the effects lab (style).

## Inventory (what exists, what it duplicates)

| Source | Holds | Verdict |
|---|---|---|
| `mobile/app/book/tokens.ts` (112) | every value: 4 palettes, 3 fonts, 11 type styles, space/size/radius/opacity/motion/sound | keep; the one value store |
| `docs/BOOK-UI-COMPONENTS.md` (161) | grammar, "current pieces" map, pattern table, token rules, 13-row catalogue with states, page-turn rules | keep as the one rule store; drop "current pieces" (code map duplicates the catalogue's consumer column) |
| `docs/system/book-ui.md` (956) | interaction contract per mechanic, plus look sentences (palette-by-phase, tokens, 44 px, hairlines) | keep interaction only; look sentences move to the catalogue |
| `docs/design/foundation/README.md` + `specimen.html` | audit of a dead revision (`paper.ts`), mock-vs-live table, PALETTES copied from tokens | archive both (specimen duplicates tokens; the Tokens story replaces it) |
| `docs/design/ui-exploration/chapter-one-playable.html` | owner reference 1 (base) | keep |
| `docs/design/room-view/room-view.html` | owner reference 2 (style); same palette/type as the mock, differs only in effects | keep |
| `docs/design/room-view/README.md`, `explorations/*` (8 HTML + moodboard) | pre-decision galleries, stale GameView-needs table | archive to `docs/archive/design/` |
| `docs/design/provisional-story-mechanics.md` | story mechanics, not UI | out of scope, leave |
| `docs/decisions/*design*|designer*|polish-order*|book-ui-as-you-build*` | owner rulings | keep; cited from the catalogue head |
| `docs/web-preview.md` | preview and e2e; no Storybook | gains one "Storybook" section |
| `lint/rules/mobile-book-raw-values.yml` | hex and `fontSize` literals in book tsx | widen (E3) |
| Code | `pages.tsx` (Tap/Control/Act/Leave/RoomPage/Sheet/logLines/ThingPage), `Menu.tsx` (Choice/Riddle/NpcPage/Contents/Item/Shop/Service), `sections.tsx` (Character/Ancestry/Journal/Carrying/Map/Settings/Chapter/Scene), `Footer.tsx` (Footer/Tip/Said/Status/Position), `Body.tsx`, `Combat.tsx`, `notices.tsx`, `DreamPage.tsx`, `skills.tsx`, `SaveError.tsx` | see B |

Duplicates still live: accent text link drawn inline 14x (`pages.tsx:93,102,129,281`, `Menu.tsx:95,197`,
`notices.tsx:78,90,106,172`, `sections.tsx:239`, `DreamPage.tsx:34,49`), page shell rebuilt in
`Menu.tsx:132` and `Combat.tsx:41`, log rendered 5 ways (`pages.tsx:135,235`, `Combat.tsx:22`,
`notices.tsx:134`, `DreamPage.tsx:26`), bare 44 px pressables (`Footer.tsx:134,246`), raw spacing
(`Book.tsx:182`, `Menu.tsx:36`, `sections.tsx:156`, `pages.tsx:135,224`, `Footer.tsx:62,209`).

## A. Target structure (each fact in one place)

- **tokens.ts**: values only. Comments link to the catalogue; no rules.
- **BOOK-UI-COMPONENTS.md**: the catalogue (form, states, rules, story file per row), token roles,
  page-turn rules, and a new 8-line head "Where each fact lives" (tokens / catalogue / book-ui /
  Storybook / references). Each row's consumer column becomes "Story: `stories/<Row>.stories.tsx`".
- **book-ui.md**: interaction contract only (what shows, when, what a tap does, returns, freshness).
  Move out: the palette-by-phase paragraph, "colours, fonts, sizes come from tokens", the 44 px
  sentence, hairline wording. Rule: book-ui.md names no token, px or colour (check E4).
- **Storybook** (`mobile/app/stories/`): one `*.stories.tsx` per catalogue row, one story per state
  and scenario; `Docs/Tokens` story renders tokens.ts live (swatches with contrast ratios, type
  specimen, spacing) and replaces `specimen.html`; `Docs/Catalogue.mdx` embeds
  `BOOK-UI-COMPONENTS.md` as raw markdown (shown twice, written once). Stories carry no rules text
  beyond a one-line link to their row. Scenario fixtures: `stories/views/*.json` generated (C).
- **docs/design/**: `README.md` (10 lines: the two references, what "effects off" means, link to the
  decisions) + the two HTML references; everything else to `docs/archive/design/`.
- **Agents find things** through the catalogue head; `.claude/agents/designer.md` and
  `WORKFLOW.md#book-interaction-delivery` point at it and at `npm run storybook`.

## B. Component map (dependency order; names = catalogue rows)

| Target (file) | Props | States | Built from / consumers to convert |
|---|---|---|---|
| `Control` (pages.tsx) | label, onPress, disabled? | enabled, disabled | exists; add disabled. Convert `Leave`, Back to container (`pages.tsx:278`), Close/Resume dream, Continue conversation (`pages.tsx:128`), Got it (`Footer.tsx:134`), Backspace/Clear (`Menu.tsx:88`), level stepper/Back to map (`DiscoveredMap.tsx`) |
| `PageFoot` (pages.tsx) | children | one | the mock's `.pg-foot`: hairline + centred Controls; consumers `Bottom` (`Book.tsx:206`), every detail's Leave/Back (pending G3) |
| `ActionCard` (pages.tsx) | label, onPress, note? | available | `Act` on detail pages, `Choice` answers, notice offers (`notices.tsx:161`), dream, Ways, Combat responses, Submit; unavailable stays a `note` line |
| `VerbLine` (pages.tsx) | label, onPress | available | `Act` on the room (place actions, water Surface in `Body.tsx:44`) |
| `ContinueButton` (pages.tsx) | label, onPress | available | `ChapterPage`, `ScenePage` |
| `EntityLine` (lines.tsx, new) | name, rest?, note?, onPress, label | one | `Here` line (`pages.tsx:191`), held/worn rows, Inside rows, `NoticeLink`, board rows, Contents rows |
| `LogLines` (lines.tsx) | lines: DetailLine[] | narration, system, refused (tag) | the 5 log renderers; refused tag needs `logs.ts` to type the line (`{kind:'refused', reason, text}`), presenter only |
| `LetterTile`, `LetterBank` (Menu.tsx) | letter, used, onPress | free, used | `Riddle` tiles; `Riddle` keeps its buffer |
| `StatusLine` (Status.tsx, from Footer.tsx:196-295) | as `StatusProps` | enabled, locked, pending, bleeding, calendar/none | fix pennies tone (`model.ts toneOf`, loka-49n 5) |
| `Tip` (Footer.tsx) | dismiss | shown | fg bubble, bg text, Got it Control |
| `Footer` (Footer.tsx) | exits, lit, zoom | rest, held, tip | `size.footerRule` rules (token unused today) |
| `Page` (pages.tsx, replaces `Sheet`) | title, head?, fixedTitle?, scrollToEnd?, children | with/without running head | `Sheet` users, `NpcPage`, `Combat`, `RoomPage` (fixed title), `SaveError`/`Fault`; `ScenePage` loses its empty header |
| Whole pages | unchanged signatures (`screen`, `g`, `press`) | per C | Room, Npc, Notice/Board, Item, Combat, Map, Dream, Journal, Carrying, Character, Contents, Chapter, Scene, Ancestry, Settings, SaveError |

Not built (no consumer): fixture link, speech line, shop price rows, text drawer, effects.

## C. Story list

Leaf stories use hand-made props. Page stories use `screenFrom(view.json)`: a story helper that
builds a `Screen` from a saved GameView with the real `buttonsOf` (model.ts) and the cartridge
text table from `protocol/fixtures/missing_child_v042_hash.json`. The views are generated, never
hand-edited: `npm run stories:views` replays named routes through the existing Node harness
(`__tests__/polish-book.test.ts book()`, E1 recipes) and writes `stories/views/<name>.json`.
Chapter 1 is frozen, so they are stable; CI regenerates and diffs (E5).

| Component | Stories |
|---|---|
| Page | running head, long running head, none; with section headings; long title |
| Control | enabled, disabled, every label in the catalogue list |
| ActionCard | short, two-line label, list of 6, with note; unavailable note beside it |
| VerbLine | one, three in a room |
| ContinueButton | chapter, scene |
| EntityLine | NPC with carried note, item, held/worn, Inside, notice with remaining count, Contents row |
| LogLines | narration, system line, refused with tag, 30 lines, empty |
| LetterTile/Bank | free, used, full bank of 12, answer in progress |
| StatusLine | plain, calendar with solar+lunar, warning hp, danger hp, bleeding, pennies normal, locked, pending |
| Tip | shown |
| Footer | rest, held (play: pointer down), tip, barred exit, up/down nodes, night palette |
| PageTurn | forward, back, reduced motion (globals), dark paper |
| Tokens | palettes with ratios, type scale, spacing, motion table |
| Pages (per palette via toolbar) | Room: first room, with NPCs+items, with notices, long log, refusal line, at night; NPC: choice, riddle, shop, services, refused answer, closed conversation; Notice board, notice with Read, bed with Resume dream; Item: plain, container with Inside, liquid/fuel/weapon, too heavy; Combat: one foe, pack, bleeding; Map: discovered 2 levels, barred exits, Where; Dream; Journal (3 quests); Carrying (empty, held+worn); Character (unknown, full); Contents; Chapter title; Scene; Ancestry; Settings; SaveError (3 kinds, lock sentence); Fault; pending save; catching up |

## D. Fidelity gaps (mock `.ph`, effects off) → polish item (owner of the fix)

1. Room title padding 18/10: live `pages.tsx:150` uses `space.page` top → `space.xl` (token use).
2. Paragraphs: mock `.prose p` 0.7em apart; live one Text (`pages.tsx:124`) → split on blank lines, `space.lg` (RoomPage).
3. Entity name: dotted 1.5 px underline, weight 500; live solid (`pages.tsx:199`) → `textDecorationStyle: 'dotted'`, `size.underline` (EntityLine).
4. Verb lines italic accent; live upright (`Act`) → VerbLine.
5. Log: `type.log` 17, one line each, system dim italic; live prose 18 joined by `\n` (`pages.tsx:135`) → LogLines.
6. Detail gap 14 (`.pg`); live `Sheet` gap 8 raw (`pages.tsx:224`) → `space.block`.
7. Action cards (card fill, line border, radius, 48) replace accent links → ActionCard.
8. Page foot: hairline, centred, 14 px SC; live `Bottom` padding 8 raw, no rule → PageFoot.
9. Footer: rules 92 px (`size.footerRule`, unused; live flex), `.base` top hairline, padding 6/16/12, gap 7; live columnGap 8 raw → Footer tokens.
10. Status: items joined " · ", gap 6, label `.82em` SC; live columnGap 14, no joins (`Footer.tsx:209`) → StatusLine.
11. Tip: SC 12.5 px pill, fg on bg; live plain dim text and lowercase "got it" → Tip.
12. Letter tiles 44 square `card` → LetterTile.
13. Scene page draws an empty header (`sections.tsx:251`) → Page.
14. Old-style numerals in footer/status (`fontVariant: ['oldstyle-nums']` on `type.small`) → token.
15. Focus ring: mock 2 px accent outline on `:focus-visible`; live none → `size.focus` token, web only.
16. Minimap at night reads as a "+" (loka-49n) → MapDrawing stroke opacity per palette (drawing exempt from tokens, but colour must be a role).
17. Chapter card (small caps label, large title, 80 px rule) → pending G4.
Effects lab adds nothing that is not an effect (`x-paper` grain/edges, `x-ink` shadows, lamp glow,
moon palette, `x-curl` is adopted): stays out until an owner decision.

## E. Checks (developer slices, each with a red control)

1. Catalogue ↔ stories: a Node test reads each catalogue row's `stories/<Name>.stories.tsx` link and fails on a missing file; and every component exported from `book/*.tsx` (except MapDrawing internals) is imported by some story. Red: delete a story file.
2. `storybook:smoke` in CI (`mobile.yml`): every story renders, play passes, axe `test:'error'`; run twice with `VITE_LOKA_PALETTE=light|dark`. Dawn/dusk contrast by the token unit test (text roles ≥ 4.5:1 on `bg` and `card`, all four palettes).
3. Raw-value lint widened: keys `padding*|margin*|gap|rowGap|columnGap|borderRadius|minHeight|minWidth|lineHeight|letterSpacing|opacity` and `fontFamily` strings; files add `stories/*.tsx`, `.storybook/*.tsx`; exempt `MapDrawing.tsx`, `DiscoveredMap.tsx`, `joystick.ts`, and `Footer.tsx` `SPOT`/`AWAY` (drawing geometry, one comment).
4. `book-ui.md` has no look words: `grep -E '(type|space|size|radius|motion)\.|#[0-9a-f]{6}|[0-9]+ ?px'` is empty (docs check harness).
5. `stories/views/*.json` fresh: CI runs `stories:views` and fails on a diff.
6. Every `motion.*.easing` is a driver map key (loka-78r nit).
Dropped: foundation check 5 (specimen mirrors tokens) with the specimen.

## F. Slicing (one PR each; designer Fable brief+review, developer Opus, one fresh reviewer)

| # | Batch | Depends | Size | Parallel |
|---|---|---|---|---|
| 0 | Land the spike: `.storybook`, 3 stories, `storybook:smoke` in CI, web-preview.md section; fix or keep-filtered the PageTurn disposed-picture defect; E2, E6 | #325 merged | S | – |
| 1 | Docs consolidation (A): catalogue head, book-ui.md look moves, archive explorations/foundation/specimen, design README, Tokens story, Catalogue.mdx embed; E4 | 0 | S–M | with 2 |
| 2a | Leaf components: Control disabled, ActionCard, VerbLine, ContinueButton, EntityLine, LogLines (+ typed refused line), every consumer converted; stories; E3 | 0 | L | with 1 |
| 2b | Footer family: StatusLine file, Tip, Footer tokens, LetterTile/Bank, pennies tone; stories | 0 | M | with 2a (different files) |
| 3 | Page shell: `Page` replaces Sheet; NpcPage, Combat, RoomPage, SaveError, Fault on it; scene header fix; PageFoot (if G3 yes); page stories with hand props; E1 | 2a | M | with 4 prep |
| 4 | Scenario fixtures: `stories:views` generator, `screenFrom`, whole-page stories per C; E5 | 3 | M | with 5 |
| 5 | Fidelity polish D1-D16 by token/component, owner polishes in Storybook | 2a, 2b | M | with 4 |
| 6 | Owner-decided extras (chapter card, eyebrow) | G | S each | – |

## G. Owner decisions (recommendation first)

1. **Where rules live**: one catalogue table in `BOOK-UI-COMPONENTS.md`, embedded in Storybook (recommend); or per-component MDX in Storybook (splits rules over 13 files agents read raw).
2. **Archive the explorations**: moodboard, 8 galleries, room-view README, foundation README, specimen.html → `docs/archive/design/`; keep only the two references and the decisions (recommend yes; git keeps history).
3. **Every local return in a page foot** (hairline, centred Control, the mock's `.pg-foot`) rather than inline links in the body list (recommend yes: one place, thumb reach, matches the mock).
4. **Chapter title as the mock's chapter card** (small-caps label, large title, short rule, Continue) vs the current plain page (recommend the card; the 2026-09-25 ruling kept it for story-arc markers; needs `type.chapterTitle`, `size.chapterRule`).
5. **Detail-page eyebrow** (mock's accent small-caps kind label above the title) (recommend no: the running head holds that slot and it would add words).
