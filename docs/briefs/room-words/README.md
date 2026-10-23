# Room words batch (loka-x6t.105, loka-6qi), 2026-10-23

Owner (live polish session 2026-10-23, quoted): "okay lets just do the engine work on that then", "ok go ahead".
Drafted by Fable (contract change: GameView and content format), PM edits. One draft batch branch,
`toolbox/batch-room-words`; slices run in order on it, each its own commits. Read the
[brief kit](../brief-kit.md) for every slice. Handoff threshold: 220k (WORKFLOW token hygiene).

Run order: 1 (x6t.105 engine), 3 (6qi engine), 2 (x6t.105 Book), 4 (6qi content), 5 (6qi Book).
Slices 2 and 5 both edit `mobile/app/book/lines.tsx` and are never in flight together.
The schema and kernel_api changes need a `docs/reviews` record at merge (`bin/pm_merge.sh:43-47`).

## Facts the briefs rest on

- Room sentence: `mobile/app/book/lines.tsx` `Present` joins `text(e.name)`; `e.name` is the `short`
  TextKey projected by `viewOf` (`kernel/ts/src/view/view.ts:232`, `describeEntity(..., 'short')`; W6
  `short_variants` apply, which is how W15 recognition hides a name). Combat foe names: `kernel/ts/src/view/combat.ts:32`.
  No bare name, article or plural exists in either kernel or the content format (`protocol/entity.schema.json`;
  loaders `kernel/ts/src/content/cartridge_refs.ts:194-196`, `lib/loka/content/entities.ex:9`).
- Signpost: every showcase signpost is a readable room detail linked in prose (the touch link `signpost` to `sign_social`,
  compiler `TOUCH_LINK_MISSING`). The kernel projects it as a `NoticeView` (`kernel/ts/src/view/notice_boards.ts`)
  without the detail key; the Book strips prose links (`mobile/app/book/model.ts:136 plain`) and draws the signpost
  as an `EntityLine` in `NoticeEntries` (`mobile/app/book/notices.tsx`). Missing piece: the detail `key` in GameView.
- Versions: `kernel/ts/src/runtime/world.ts:108` `kernel_api: '1.117'`; floors in `cartridge_variants.ts` /
  `lib/loka/content/variants.ex` plus `protocol/fixtures/loader_floors.json`. An optional GameView-only field needs
  no bump (`docs/system/protocol.md:392`).

## Slice 1: loka-x6t.105-engine, notice `key` in GameView (S)

Lane: engine. Read `docs/lessons/contracts.md`.

Goal. The Book may draw the touch link `signpost` to `sign_social` as a fixture link only when the GameView names that detail
(book-ui.md fixture paragraph). Give `NoticeView` and `NoticeBoardView` a required `key` (the authored detail Key).
No kernel_api bump, no floor, no Elixir code (GameView is TS-only).

Files in: `protocol/gameview.schema.json` (NoticeView, NoticeBoardView: `key` `action.schema.json#/$defs/Key`,
required, examples), `kernel/ts/src/view/notice_boards.ts` (`key: detail.key` in `noticeViews`, `noticeBoards` and each
board child), `kernel/ts/src/contracts.gen.ts` (`elixir bin/contracts.exs`), `protocol/fixtures/notice_board_contracts.json`,
`kernel/ts/test/notice_boards.test.ts`, `docs/system/protocol.md`. Out: `mobile/`, cartridges, Elixir, kernel_api.

Acceptance:
1. `gameView(w)` on the search fixture: the standalone notice and each board child carry `key` equal to their
   authored detail key; a board child's key is its own (extend `notice_boards.test.ts:95`). Break: key omitted, or the
   board's key copied onto children.
2. A `notice_board_contracts.json` case with a keyless NoticeView is invalid in both kernels
   (`notice_boards.test.ts:26`, `test/loka/core/notice_board_contracts_test.exs`).
3. `gameView` output validates against the schema.
4. Schema mutant sweep on the `required` addition.

Spec text (protocol.md GameView, after the EntityView `description` paragraph): "NoticeView and NoticeBoardView
carry `key`, the authored detail Key, so a presenter can match a touch link in the selected description
(a touch link, cartridge.md touch links) to the projected current-room detail; the Book draws a fixture link only on
that match (book-ui.md fixture rule). Bodies stay off the wire." In book-ui.md's fixture paragraph replace "(for
example, an offered place action with an exact inspectable target)" with "(a notice or board whose `key` is the
link's target, with its captured Read offer)".

Stop and ask if the Book's story views (`mobile/app/stories/views/*.json`) are schema-validated by a test (then the
required `key` breaks the Book lane; add `key` to those views in this slice only if it is a mechanical edit).

## Slice 2: loka-x6t.105-book, signpost as an in-prose fixture link (S)

Lane: Book, after slice 1. Read `docs/BOOK-UI-COMPONENTS.md` agent rules, `docs/lessons/mobile.md`.

Goal. A description's touch link to `key` draws as an inline link when `key` matches a projected `view.notices[].key`
whose Read is offered and that has no `bed`, `transport` or `remaining`; pressing it does what `NoticeLink` does
(open `{kind:'notice', id}` then press Read). That notice draws no `EntityLine` in `NoticeEntries`. Any other link
stays plain words. A notice the description does not link keeps its World line. Boards, beds, transports, harvest
counts: unchanged.

Files in: `mobile/app/book/pages.tsx` (`paragraphs` splits on the link regex), `mobile/app/book/lines.tsx` (export
`Present`'s inline link as `NameLink`, shared with the Here sentence: label "<words>, open", Enter/Space),
`mobile/app/book/notices.tsx`, `mobile/app/book/polish_detail.test.ts:409-417`,
`mobile/app/walkthrough/toolbox_showcase.walk.ts` ('The inn signpost, open' becomes 'signpost, open'),
`mobile/app/stories/routes.ts:86`, story views with `notices` (add `key`), one RoomPage story (linked signpost),
`docs/system/book-ui.md`. Out: kernel, cartridges, boards.

Acceptance:
1. Description "A green with a signpost." whose `signpost` is a touch link to `sign_social` + notice `{key:'sign_social'}` with available Read: a
   pressable "signpost, open" in the prose; no signpost EntityLine; press pushes the notice route and invokes Read.
2. No matching notice: no pressable, the words remain.
3. Notice present, description without its link: the EntityLine stays.
4. A harvest notice (`remaining`) linked in prose keeps its line.
5. Read unavailable: the prose word is plain and the unavailable Action card stays (book-ui.md pass-1 R2).
6. Enter on the prose link opens it.
7. Screenshot: Village Green, 390 px.

Spec text (book-ui.md fixture paragraph, after "If that projection is absent..."): "A readable detail the selected
description links, whose `key` the GameView projects with an offered Read, is a fixture link in the prose and draws
no separate World line; a notice the description does not link, a board, a bed, a transport or a counted harvest
keeps its World entry (loka-x6t.105)." Notice-board details: "opens from its prose link, or from its World line when
the selected description does not link it".

Stop and ask before extending the rule to boards, beds, transports or harvests, and if a showcase room's description
variant drops the link (report which rooms).

## Slice 3: loka-6qi-engine, entity name words (M)

Lane: engine, after slice 1 (shared schema and `contracts.gen.ts`). Read `docs/lessons/contracts.md`, `docs/lessons/mechanics.md`.

Goal. One optional object on an NPC or item, `words {bare, article?, plural?}`: `bare` the TextKey of the name
without article, `article` `"a"|"an"|"the"` (absent for a proper name), `plural` the TextKey of the plural bare name.
The engine composes no English; the GameView copies `words`. kernel_api 1.117 to 1.118.

Contract surfaces:
- `protocol/entity.schema.json` ItemDefinition and NpcDefinition: `words` (required `bare`, `additionalProperties:false`).
- Loaders: `words.bare` and `words.plural` checked as `short` is (`cartridge_refs.ts:194-196`; `entities.ex`
  `definition_texts`). Floor 1.118 at the top of the `variants` ladder in both kernels; one `loader_floors.json` case on
  `cartridges/items_sampler` by edits only, so no sampler hash changes.
- `world.ts:108` 1.118; `elixir bin/contracts.exs`; `docs/system/cartridge.md` ("Name word declarations" after
  "Entity variant declarations"), `docs/system/protocol.md` GameView.
- GameView: `EntityView`, `ContentView` (`viewOf`) and the combat `foe()` get optional `words`, copied only while the
  selected short is the base `short` (a holding `short_variants` entry sends no words).

Acceptance:
1. Loader, both kernels, red controls: unresolved `words.bare`/`words.plural` is `UNRESOLVED_REFERENCE` at
   `.words.bare`; `article: "some"` and `words` without `bare` are `SCHEMA_VIOLATION`.
2. Floor case at 1.118/1.117 reports `KERNEL_API_RANGE_INVALID` in compiler and loader.
3. View: an entity with `words` projects them verbatim; one without projects no `words`; an NPC whose
   `short_variants` entry holds projects none (break: recognised name leaks before recognition); combat opponent and
   `active_opponents` carry `words`. `gameView(w)` validates.
4. Schema mutant sweep; mutants on the `=== e.short` guard and the floor branch.

Spec text: cartridge.md "Name words (loka-6qi; kernel_api at least 1.118): an NPC or item may declare `words {bare,
article?, plural?}` ... text keys checked as `short`. `short` stays the phrase narration binds; `words` exist for
presenters that compose a sentence from several names." protocol.md GameView: "EntityView, ContentView and the combat
opponent carry `words` copied from the definition while the selected short is the base `short`; a holding
`short_variants` entry omits them."

Stop and ask if `validate.ts` cannot express the shape, or if a sampler needs `words`.

## Slice 4: loka-6qi-content, showcase name words (S)

Lane: content, after slice 3. Read `docs/SHOWCASE.md`.

Goal. `cartridges/toolbox_showcase`: `words` on every NPC (`bare` + `article`; a proper name `bare` only) and on every
item whose `short` another item shares (eggs, logs, candles, yard candles, turnips, ore, feast, grain, eel, cots:
`bare`, `article`, `plural`); `text.json` keys; `cartridge.json` `at_least` 1.118; regenerate
`protocol/fixtures/toolbox_showcase_hash.json` (see HANDOFF lesson: `mix loka.compile` then split canonical and sha256).
Hand back a table of entities given `words` (bare, article, plural).

Acceptance: showcase compiles with no new diagnostic in either kernel; transcripts still replay; each NPC's `article`
equals the article its `short` opens with. Stop and ask before changing any `short` text.

## Slice 5: loka-6qi-book, room and combat sentences from name words (M)

Lane: Book, after slices 2 and 4.

Goal (book-ui.md "Below the description"). In `Present`:
- People: GameView order kept; an entity with `words` shows `bare`; one "the" before the first name whose `article`
  is "the"; the article is shared only within a run of adjacent definite names and is written again after any name without it (owner 2026-10-23: "The carpenter, Aldous, and the cook are here."): "Aldous, Bess, the carpenter,
  chandler, and cook are here." Without `words`: `text(name)` as today.
- Items: unchanged, each keeps its own article.
- Plurals: entities with equal `name` and a `plural` collapse into one link "two crows" (count words two to nine in
  `labels.ts`, digits from 10), opening the first member; `is`/`are` by the number of links, a collapsed group plural.
- Combat (`Combat.tsx` `Fight`): a foe with `words` reads definite ("the goblin (your target) — hurt"); one line per
  foe, no merging.

Files in: `lines.tsx`, `labels.ts`, `Combat.tsx`, `polish.test.ts`, `polish_style.test.ts`, `combat.test.ts`,
`RoomPage.stories.tsx` (Crowded with the shared article; a plural story), `views/room-npcs-items.json` (add `words`),
`docs/system/book-ui.md`.

Acceptance (literal):
1. [Aldous, Bess, carpenter{the}, chandler{the}, cook{the}]: "Aldous, Bess, the carpenter, chandler, and cook are
   here.", five links "<bare>, open".
2. [carpenter{the}, Aldous, cook{the}]: "The carpenter, Aldous, and the cook are here." (break: "the" not restarted after a proper name)
3. An NPC without `words` keeps its `name` among the others.
4. Items: "An apple, an axe, a wooden bench, and an iron anvil are here." unchanged.
5. "Two crows are here." (one link, first id); "Three crows and a hen are here."; "A crow is here."
6. Combat: "the goblin (your target) — hurt"; a foe without `words` keeps today's line.
7. Mutants on the shared-article flag, the 9/10 count edge and `is/are`.
8. Screenshot: a room with people, 390 px.

Spec text (book-ui.md, replacing "Each name keeps its authored article until the cartridge supplies bare-name words
(loka-6qi)."): "With cartridge name words a person shows its bare name, one shared 'the' per run of adjacent definite
names, written again after a proper name ('The carpenter, Aldous, and the cook are here.') ('Aldous, Bess, the carpenter, chandler, and cook are here.'; owner 2026-10-23);
a loose item keeps its own article; same-kind entities with a plural collapse into one link, 'two crows', count words to
nine, digits after, opening the first; a name without words draws as its `name`. Combat foe lines take the definite
form, one line per foe."

Stop and ask before merging foe lines, before numbers above nine as words, and if the collapsed-link target is disputed.

## Risks

- A holding `short_variants` NPC gets no `words`, so one sentence can mix bare and phrased names. Accepted.
- A shared "the" over singular nouns can read as one person with several roles ("the carpenter, chandler, and
  cook"); "are here" and the separate links keep it readable. Per-run sharing pinned by slice 5 case 2.
- Collapsed plural links open an arbitrary member; content keeps distinct-state items on distinct `short`s.
