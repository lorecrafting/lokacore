# Room fixtures batch (loka-x6t.120 fixture actions, loka-x6t.125 asides, loka-x6t.127 room anatomy), 2026-10-23

Owner (live polish session 2026-10-23, quoted): "we shouldn't have impromptu actions like that, yet, in the world main
pane. If we want to gather sometime it shoudl be an item, or a furtniture fixture in the roomd escription, adn they
have to click in to the detail page before they can do an action on it, like 'gather' or 'harvest'"; "wait no random
one off room actions, unless its on a description room fixture/furniture, or npc/pc and item"; Chop wood: "nah keep
chop wood" (a woodcutting skill is loka-ikch.1, later). Asides: "What are asides, we should get rid of asides, and if
we want more 'depth' in the room it has to be in the descrioption as a clickable fixtgure or 'furnitre'" (both kinds,
FD2 and FD10). Room page anatomy, set in stone: `docs/decisions/owner-decision-room-page-anatomy-2026-10-23.md`
and book-ui.md "Room page anatomy" (both on the session branch `polish/session-2026-10-23`, commit f8e3f884c, merged
before slice 4): title, description with fixture links, people, items, event log, and
nothing else; every action on a fixture, person or item page; everything ambient a log line.
Drafted by Fable (contract changes: room schema, kernel_api, the GameView rule for recipe offers, the aside removal),
PM edits. One draft batch branch, `toolbox/batch-room-fixtures`; slices run in order on it, each its own commits. Read
the [brief kit](../brief-kit.md) for every slice. Handoff threshold: 220k (WORKFLOW token hygiene).

Beads: slice 1 loka-x6t.120.1 (Book), slice 2 loka-x6t.120.2 (engine), slice 3 loka-x6t.120.3 (content and lint),
slice 4 loka-x6t.127 Book half plus the Book half of loka-x6t.125, slice 5 loka-x6t.125 engine half. The PM files the
children.

Run order: 1 (Book, S) -> 2 (engine, M, record) -> 3 (content, S) -> 4 (Book anatomy, M) -> 5 (asides engine, M,
record). Slice 1 first because the Book today presses a linked fixture's first available offer on tap
(`notices.tsx:76`): once slice 2 projects the hearth, that tap would gather ash at once. Slice 4 needs the anatomy text
on `main` (the PM merges `main` into the batch after the session branch merges). Slices 2 and 5 change schemas and
need a `docs/reviews` record at merge. The PR is marked ready only after slice 5.

## Design (settled)

- **Rule.** A cartridge action recipe whose `target.kind` is `detail` (96 recipes in 30 cartridges: the 95 scanned plus
  `fish_croft`) is offered only on its target detail's page (`NoticeView.actions`), never in `view.actions`. Engine
  verbs with target `none` (wait, rest, stand, sit, sleep, look, scan, flee, say; `commands/verbs.ts`) stay in
  `view.actions` as the Book's chrome and position controls already draw them (`model.ts:107` `notVerb`, `:127`),
  never as World lines. Use recipes draw as pairs on items (row G4), aimed spells on their target entity
  (loka-x6t.109), services and talks on NPC entries: already off World. No recipe has no target (`jq .target.kind`
  over `cartridges/*/recipes/*.json`: detail 96, spell 9, storylet 3, use 12).
- **Storylets (FD3).** The World card violates the anatomy and the showcase declares none (`storylet_sampler` only).
  Slice 4 removes the card; the engine keeps `GameView.storylet` and the pick, which the Book no longer draws. Whether
  a storylet is re-anchored on a person or fixture page (a `target.on` the pick projects on) or FD3 is retired is an
  owner call (open question below); until then the sampler's kernel tests keep the mechanic honest.
- **Page.** The kernel projects a NoticeView for every visible current-room detail some recipe of the actor's set
  targets (today only readable, perception, harvest, bed, transport and the expedition detail get one,
  `notice_boards.ts:27-35`). Its cards are the recipe offers; its title is a new optional authored `title`
  (room.schema.json InspectableDetail, kernel_api 1.120), falling back to the description as today
  (`detailTitle`, `notice_boards.ts:128`). The GameView schema needs no change for it (NoticeView already has `key`,
  `title`, `description`, `actions`).
- **Book.** A fixture link in the prose opens the detail page; only a readable notice's tap also invokes its captured
  Read (book-ui.md Notice-board details, kept as approved in #458). The page's cards and their narration routing
  (`detail_id`, `buttons.ts:272`, `presenter.ts:99`) already work for notice actions. Pressing a card keeps the page
  (as Study does); a return-to-World after the action is a designer call, not in this batch (loka-x6t.124 covers the
  unannounced page line). World draws no entry for a detail the description does not link (anatomy): content links
  every page-bearing detail in the prose, and the lint says so.
- **Asides.** Removed entirely (loka-x6t.125): the reader, both schemas' `asides` (room, detail, NPC) and the GameView
  fields, both compilers' walks and floors, the Book's logging. The `skill_compare` leaf stays (kitchen, craft and
  voices recipes use it). Showcase depth: the lever hall's two asides ("The north door's bolts stand drawn.") duplicate
  the pull narration (`narration.lever_bolt`) and the door state the minimap shows (owner 2026-10-23, book-ui.md:40-44):
  dropped, no fixture needed. `voices_sampler` is reworked (asides removed; it stays the `skill_compare` and opposed
  lore check sampler, floor 1.91 kept by the leaf). `remarks_sampler` is retired (its only point was NPC asides; group
  membership has `group_sampler`; NPC remarks may return as talk or emotes, loka-kgd.193).
- **Sense cues (G6).** Ambient, so log lines: slice 4 logs each cue once per room visit when it first shows, as the
  aside logging did, and removes the block after the items (the once-per-visit set and ordering code of
  `logs.ts:98-130` is repurposed, not rewritten).
- **Retired cartridges.** None to update: `cartridges/` holds the showcase and samplers only (Ashmere is deleted,
  loka-4hik). Samplers get no `title` on disk (fallback = description); only their tests move with the offer.
- **Elixir.** GameView is TypeScript-only; the compiler takes the field (schema, text-key check, floor), the lint and
  the aside removal.
- **Save.** None: projection rules plus content. The showcase hash fixture changes once, in slice 3 (titles added,
  lever hall asides dropped), with the sha replaced in 7 transcripts and 2 live `.sql` as every content slice does.
- **kernel_api.** 1.119 -> 1.120 for `title` (slice 2). The aside removal gates nothing (a cartridge declaring
  `asides` is SCHEMA_VIOLATION as any unknown field): no further bump, the FD10 floor case goes with its sampler, the
  1.91 case stays on the leaf.
- **Guards.** Engine (slice 2): a registered invariant, no `view.actions` entry resolves to a detail recipe, checked
  per sim step across the showcase. Book (slice 4): the World page renders no pressable, card, note or block outside
  the five parts for a view that carries every superseded thing this batch closes; the two items still open (exit
  warning notes, Continue conversation) join that test with their own removal items.

## Facts the briefs rest on

- World list: `kernel/ts/src/view/action_lists.ts:66-126` `lists()`; `place` filters `!detailRecipe(world, a)`
  (`:345-348`: true only for a readable or perception target); `notice(id)` lists `noticeOffer` (`:314-322`:
  expedition at the detail, harvest, or `detailAt(world, a) === id` with readable or perception) plus
  `liquidActions(id)` (liquid offers carry `command`, `view/liquid.ts:82`); `here(a)` (`:73-77`) already requires a
  detail target to be in the body's room and visible. `detailAt` (`commands/actions.ts:208`) is defined for every
  detail recipe. `advertise()` emits `command` only for light verbs, harvest, expedition and aimed cast
  (`commanded`, `:178-180`): a recipe perform on a detail draws as `{action_key, label, target:{kind:'none'},
  input:[], available}` with no `command`.
- Pages: `kernel/ts/src/view/notice_boards.ts:18-56` `noticeViews(world, actor, here, actions, steps)`: the
  condition at `:27-35`, `asideView` (`:44`, `:57-66`, `:104`), `transportActions` (`:112-124`) already returns
  `actions(id)` for a plain detail; `detailTitle` (`:128-135`). `view.ts:99-100` passes `actions.notice`; `:109` the
  storylet; `:125-138` place asides; `:184-189` NPC asides.
- Invariant: `view/invariants_view.ts:34-72` `gameview_agrees_with_admission`; `advertised()` (`:159-200`) already
  searches `notices[].actions` for a `perform`. Registry `runtime/invariants.ts:34` CHECKS, `:123`;
  `protocol/invariants.json`; `kernel/ts/test/sim.test.ts:172` requires every registered invariant checked per step.
- Schema: `protocol/room.schema.json:129-170` InspectableDetail (`aliases`, `description`, `variants`, `asides` `:152`,
  `rating`, `readable {label,text,title}`, `harvest`, `perception`, `bed`, `transport`); no detail-level `title`; Room
  `asides` `:468`; `Aside` def `:643-679`. `protocol/entity.schema.json:787-795` NpcDefinition `asides`.
  `protocol/gameview.schema.json:573` EntityView `asides`, `:1114` PlaceView `asides`, `:2235` NoticeView `asides`,
  `:1490` `cues`. `protocol/fixtures/invalid.json:29960-30260` aside cases (`npc_asides_empty` and the room/detail
  ones). `test/loka/loader_floors_test.exs:139-144` scans every schema for `kernel_api at least 1.N` and requires a
  `protocol/fixtures/loader_floors.json` case (shape at `:2294-2305`; voices 1.91 case `:1264-1275`, remarks 1.107 case
  `:2206-2214`).
- Floors: `kernel/ts/src/content/cartridge_variants.ts:18-20` (`voices` = aside parts or a `skill_compare` leaf;
  `remarks` = NPC asides), `:32-52` ladder (top `words` 1.118); `lib/loka/content/variants.ex:31-49` `need/2`
  (`voices = voice?(defs) or aside?(defs)`, `:65-74` `aside?`). `kernel/ts/src/runtime/world.ts:108` `kernel_api: '1.119'`.
- Aside reader and walks: `kernel/ts/src/mechanics/description_variant/rule.ts:62-75` `asides`;
  `content/cartridge_refs.ts:131-142` `asideParts`, `:181` (policy nodes), `:274` (text keys);
  `content/cartridge_standing.ts:27-29` (asides on a spawn template). Elixir: `room_parts.ex:15,34-35,52-59,106`,
  `entities.ex:88-100,194,220`, `npc_fields.ex:40`, `standing.ex:54-55`.
- Text keys: Elixir `lib/loka/content/room_parts.ex:128-150` `details/2`, `detail_text` checks `description` and the
  `readable` keys (UNRESOLVED_REFERENCE at `rooms/<room>.details.<key>.<field>`); TS `cartridge_refs.ts:76-92`
  `parts()` and the `TEXT` table (`:192-200`, `readable: ['label','text','title']`).
- Lint: `lib/loka/content/lint.ex:36-44` `findings/1` (per-file `file/3` plus cross-file `talk`, `labels`, `items`,
  `fills`); `:59-62` the readable-title lint. `test/loka/content_lint_test.exs:319` pins the showcase at
  `lint_baseline.txt` (204 lines, 0 title findings); `:132-135` runs only `Lint.labels` on every cartridge, so a new
  lint hits samplers only when run by hand. `docs/CHECKS.md:108` lists the lints.
- Book, notices: `mobile/app/book/notices.tsx` `noticeOffer` (`:48-62`: Read from `view.actions` with scope
  `inspectable_details` and `target_ids [id]`, else the notice's own `actions`), `control` (`:64-73`), `kept`
  (`:76`), `read` (`:77-80`: open then press), `proseLinks` (`:84-95`), `NoticeLink` (`:97-118`), `NoticeEntries`
  (`:126-146`), `history` (`:155-165`, asides lead it), `NoticePage` (`:170-206`, cards via `offerControl`
  `:218-240`), `foot`. Buttons for notice actions: `buttons.ts:255-275` (`detail_id: n.id`; `target.kind 'none'`
  with no input passes). Prose link regex `model.ts:138`; a link's accessibility label is `"<words>, open"`
  (`polish_style.test.ts:216`). Consumers: `Body.tsx:11,152-153`.
- Book, World page: `pages.tsx:126-175` RoomPage (`warnings()` `:197-210`, `Here`, `p.details` = NoticeEntries,
  `storylet()` `:217-231`, `placeActions`, the log); `place.tsx` `placeActions` (verb lines and refused `label: reason`
  notes); `buttons.ts:176-193` `placeOffer`, `refusedPlace`, `placeButtons`; `model.ts:107-135` `notVerb`, `group`
  (`position` `:126`, `place` `:127-129`); `lines.tsx:149-185` `Here` (people, items, then the cue block `:177-181`),
  `model.ts:34-35` `cueLine`; `logs.ts:63` `asided`, `:94`, `:98-130` `asidesOf`/`asideLines` (once per room visit,
  after narration and arrivals, reset on room change); `presenter.ts:40,120,197-198`. Walk harness `walk.ts:100-108`
  filters World verbs. Stories: `RoomPage.stories.tsx:14-15,93-112` (Asides story, imports voices and remarks text).
- Book tests touched: `storylet.test.ts:36,49,76,107`; `refused_verbs.test.ts:45,66,95,120`;
  `polish_style.test.ts:44,87,149` (aside logging and blocks), `:181-240` (signpost prose link); cue lines in
  `d9.test.ts:7`, `polish.test.ts:314`, `presenter.test.ts`.
- Spec: `docs/system/book-ui.md` World and status entry (`:25-63`, the fixture paragraph `:46-63`), Detail-page order
  `:242-261` (`:245` "a notice's asides first"), Notice-board details `:263-304`, Sense cues details `:706-708`, Aside
  details `:710-712`, Storylet card details `:758-760`; the session branch marks the superseded passages.
  `docs/system/mechanics.md:207` inspectable_detail, `:216` readable@1, `:1118` ("and no room aside"), `:2254-2266`
  FD2 (the leaf paragraph `:2258` stays), `:2304` sense cues Book bullet, `:3199-3217` FD3, `:3775-3786` FD10;
  `docs/system/protocol.md:336-339` NoticeView `key`, `:355` `actions` of the place; `docs/system/cartridge.md:1906`
  (asides declarations), `:1908` (NPC asides); `docs/MECHANICS-TOOLBOX.md:177` FD3, `:184` FD2, `:200` FD10.
- Showcase: 41 detail recipes on 35 details in 30 rooms; every one is linked in its room's description
  (the loft prose carries a touch link `hearth` to the `hearth` detail, `room.loft.description`, `text.json:1464`) and none is readable, perception or harvest. The
  11 readable signs are all linked; no bed, transport, harvest or board detail exists in the showcase. Lever hall:
  `rooms/lever_hall.json` room-level `asides` (2), text keys `aside.lever_hall.dial_true`, `aside.lever_hall.levers_drawn`
  (`text.json:54-55`); the wheels' readouts are detail variants already. `cartridge.json` `at_least` 1.119. Hash
  fixture `protocol/fixtures/toolbox_showcase_hash.json` (`sha256`); its sha also sits in
  `cartridges/toolbox_showcase/transcripts/{knowledge,liquid,food,service,light,readable,commerce}.jsonl` and
  `mobile/app/stories/live/{loft-map,reeve-asked}.sql`. `npm run stories:views` (`mobile/app/package.json:15`,
  `stories/scenarios.ts`) regenerates `mobile/app/stories/views/*.json` from the bundled showcase (`item-fuel.json`
  and `map-two-levels.json` list `gather_ash` under `actions` today).
- Sampler page details outside the showcase: `fast_travel_sampler` (2 transports), `harvest_sampler` (1),
  `replenish_sampler` (1 harvest); boards and beds in the search fixture of `notice_boards.test.ts` (kernel only).
- Engine test sampler: `cartridges/spells_sampler` (`at_least` 1.100): room `tower` with details `hearth`
  (`gather_ash`) and `sigil` (`trace_sigil`), both linked in `room.tower.description`. Edit it in-test, never on disk.
- Aside samplers and tests: `cartridges/voices_sampler` (`at_least` 1.91; `rooms/hall.json` room aside + two on
  `carved_door`; `npcs/sage.json` has variants, no asides; recipes `study_runes`, `read_glyphs` with `skill_compare`);
  `cartridges/remarks_sampler` (`at_least` 1.107; Hal and Bram asides, `dialogues/hal_talk.json`). Tests:
  `kernel/ts/test/voices.test.ts:70,98,132`, `remarks.test.ts:96,130,155`, `test/loka/content_voices_test.exs:10`,
  `content_remarks_test.exs:9`, `content_showcase_test.exs:105-112` (strips lever hall asides for a floor case),
  `kernel/ts/test/showcase_fixture.ts:185-187` (same), `showcase_traps.test.ts:235-270` (asserts the hall asides),
  `light.test.ts:331,344,359` (uses an aside to prove darkness hides it).
- Tests that read a detail recipe from `view.actions` (all move to the notice entry in slice 2):
  `kernel/ts/test/target_present.test.ts:66` (coil_rope), `resources.test.ts:153,276` (pray),
  `attributes.test.ts:143` (pray), `variants.test.ts:81` (shove); `mobile/app/book/word_bar.test.ts:189`
  `b.tap('Gather ash')` on the spells sampler; `mobile/app/walkthrough/toolbox_showcase.walk.ts:185`
  `await tap('Gather ash')`. `spells.test.ts:64` and `showcase_magic.test.ts:120,137` perform directly: unaffected.
- Showcase docs naming the gather: `docs/showcase/magic-district.md:15,38,113-114`.

## Slice 1: loka-x6t.120.1, a fixture link opens its page (S, Book)

Lane: Book. Read `docs/BOOK-UI-COMPONENTS.md` agent rules, `docs/lessons/mobile.md`. Existing components only.

Goal. In `mobile/app/book/notices.tsx`: a notice the description links opens its page on tap and presses nothing,
unless a Read offer for it is in `view.actions` (the `offers` branch of `noticeOffer`): then today's open-and-read
stays. `NoticePage` is unchanged: the cards come from `detail.actions` through `offerControl`. Unlinked notices keep
today's World entries until slice 4 removes them.

Files in: `mobile/app/book/notices.tsx`, a Book test (`polish_style.test.ts` beside the signpost cases at `:181-240`,
or a new `fixture_page.test.ts`), `mobile/app/stories/NoticePage.stories.tsx` (one state: a fixture with cards, from
a hand view), `docs/system/book-ui.md`. Out: engine, kernel tests, cartridges.

Acceptance (hand view: a notice `{id, key:'hearth', title, description, actions:[{action_key:'gather_ash',
label:'actions.gather_ash', target:{kind:'none'}, input:[], available:true}]}`, place description with a touch link `hearth` to the
`hearth` detail, no `read` in `view.actions` for it; text keys in the test's catalog):
1. The prose shows the link `hearth, open`; tapping it opens the notice page (title text, description, a Gather ash
   card) and sends no command (break: today's `read()` presses the first available offer, so the tap sends
   `gather_ash`).
2. Tapping Gather ash sends `{action_key:'gather_ash', target_ids:[], input:{}}` once; the page stays open.
3. The same notice with `available:false, reason:{code:'insufficient_resource'}` draws a `label: reason` card, not
   pressable (one assertion through the existing `offerControl` path).
4. A readable notice linked in prose still opens and reads at once (the existing signpost tests stay green).
5. Screenshot, 390 px, the fixture page with its card.

Spec text, book-ui.md fixture paragraph (`:53-58`), replace "(a notice whose `key` is the link's target, with its
captured Read offer)" with "(a notice whose `key` is the link's target); the link opens that detail's page, and a
readable one also invokes its captured Read (Notice-board details)". Notice-board details,
first paragraph: "Every projected detail opens its own page from its prose link; a readable one invokes its captured
Read on entry, a plain fixture shows its description and its offered cards." Designer: one pass per UI batch (routing
table); no per-slice design review.

Stop and ask if a hand view cannot exercise `proseLinks` (then build on `compiled('cartridges/spells_sampler')` after
slice 2 instead and reorder 2 before 1, re-pointing `word_bar.test.ts` in slice 2).

## Slice 2: loka-x6t.120.2, fixture pages in the kernel, detail `title`, the World guard (M, engine)

Lane: engine, after slice 1. Read `docs/lessons/contracts.md`, `docs/lessons/mechanics.md`. At the M ceiling: no
showcase content (slice 3), no Book components (slice 1), no refactor of `lists()`, no aside work (slice 5).

Goal. Every detail recipe is offered on its target's NoticeView only; any visible current-room detail some recipe
targets is a NoticeView; InspectableDetail gets optional `title`; kernel_api 1.119 -> 1.120; an invariant guards World.

Engine surfaces:
- `view/action_lists.ts`: `detailRecipe` is true for every detail target (`detailAt(world, a) !== undefined`);
  `noticeOffer` matches `detailAt(world, a) === id` for any detail (keep the expedition and harvest arms).
- `view/notice_boards.ts:27-35`: a detail is projected also when `actions(id)` holds a recipe offer (an entry with no
  `command`, as `commanded()` emits one for every non-recipe offer) or the expedition one; `detailTitle` reads
  `detail.title` first. A detail with only liquid offers and none of the kinds gets no new page (no sampler has one:
  no case; say so in the handback if one exists).
- `protocol/room.schema.json` InspectableDetail: `title` (`text.schema.json#/$defs/TextKey`), description "...
  kernel_api at least 1.120 (loka-x6t.120) ..." so the floors test finds it; one example. `kernel/ts/src/contracts.gen.ts`
  via `elixir bin/contracts.exs`.
- Loaders, both kernels: `title` resolves in the catalog (UNRESOLVED_REFERENCE at `rooms/<room>.details.<key>.title`;
  Elixir `room_parts.ex detail_text`, TS the twin check `cartridge_refs.ts`); floor `{titled, [1, 120]}` on top of
  both ladders (`variants.ex need/2`, `cartridge_variants.ts`), counted in `used`; `world.ts` `kernel_api '1.120'`;
  one `loader_floors.json` case on `cartridges/spells_sampler` (edits: `rooms/tower.json` `details.hearth.title` =
  `"detail.hearth"`, an existing key; without: null), compiler and loader KERNEL_API_RANGE_INVALID.
- Guard: a new invariant `world_lists_no_fixture_action` in `protocol/invariants.json` and `runtime/invariants.ts`
  CHECKS: every `view.actions[].action_key` resolves to an Offered with no detail target. Feed it as
  `gameview_agrees_with_admission` is fed (`resolves` maps keys to commands; add the detail-target keys the same way,
  or pass the set); `sim.test.ts:172` must list it as checked per step.
- Consumers: `target_present.test.ts:66`, `resources.test.ts:153,276`, `attributes.test.ts:143`, `variants.test.ts:81`
  read the offer from the detail's notice entry (one shared `noticeAction(view, key)` helper in a test fixture file;
  the assertions themselves unchanged). `mobile/app/book/word_bar.test.ts:189`: `b.tap('hearth, open')`,
  `b.tap('Gather ash')`, `b.tap(LABEL.leave)`; `toolbox_showcase.walk.ts:185` the same three taps;
  `refused_verbs.test.ts:120` reads the Chop wood refusal on the oak's page (`oak, open`); `npm run stories:views`
  (gather_ash moves from `actions` into `notices` in `item-fuel.json`, `map-two-levels.json`).
- Spec: mechanics.md (inspectable_detail@1 section, `:207`, new paragraph): "A recipe whose target is a detail is
  offered only on that detail's NoticeView `actions` (loka-x6t.120); `view.actions` never lists it. A detail some
  recipe of the actor's set targets is projected as a NoticeView while visible in the actor's room, titled by its
  authored `title` (room.schema.json, kernel_api 1.120) or, without one, its description. Engine verbs and quest
  offers stay in `view.actions` for the Book's chrome; the invariant `world_lists_no_fixture_action` holds it."
  protocol.md `:355`: after "without the door verbs, `wear` or `remove`" add "or any recipe aimed at a room detail
  (those are its NoticeView's `actions`, mechanics.md inspectable_detail@1)".
  cartridge.md after `:1906`: "A detail may carry `title` (TextKey; UNRESOLVED_REFERENCE at
  `rooms/<room>.details.<key>.title`), the page title the Book shows for it; it needs `kernel_api` at least **1.120**
  in both kernels (KERNEL_API_RANGE_INVALID; `lib/loka/content/variants.ex`, `kernel/ts/src/content/cartridge_variants.ts`).
  `mix loka.lint` requires it, and a prose link to it, on a detail some recipe targets (loka-x6t.120)."

Acceptance (`kernel/ts/test/fixture_pages.test.ts`; `spells_sampler` edited in-test: `at_least` 1.120,
`details.hearth.title: 'detail.hearth.title'` with text "The cold hearth"; `gameView(w)` validated against the schema):
1. In the tower: `view.actions` has no `gather_ash` or `trace_sigil`; `view.notices` has the hearth
   `{key:'hearth', title:'detail.hearth.title', actions:[{action_key:'gather_ash', label:'actions.gather_ash',
   target:{kind:'none'}, input:[], available:true}]}` and the sigil with `title:'detail.sigil'` (the fallback) and its
   `trace_sigil` card (break: the World card stays; no page; the fallback lost).
2. `perform gather_ash` is accepted (ash 1) and `gameview_agrees_with_admission` holds with that view and decision.
3. A third detail added in-test that no recipe targets and that is not readable, perception, harvest, bed or
   transport is not in `notices` (break: every detail becomes a page).
4. A recipe whose policy fails lists on its detail as `available:false` with the policy's reason (edit `gather_ash`'s
   policy to `level_compare {at_least: 5}`: code `invalid_state`); the perform is refused alike.
5. `world_lists_no_fixture_action` is false for a view whose `actions` carries `gather_ash` (hand-built from case 1's
   view) and true for the projected one; red control: restore the old `detailRecipe` once, the invariant fails on the
   tower view and the sim.
6. Readable, perception, harvest, bed, transport and expedition pages unchanged: `notice_boards.test.ts`, the
   harvest, dream and ferry tests stay green with no edit beyond the notice-entry helper.
7. Loaders, both kernels: `details.hearth.title: 'detail.missing'` -> UNRESOLVED_REFERENCE at
   `rooms/tower.details.hearth.title` (TS path form as its neighbours); floor case 1.120/1.119 in `loader_floors.test.ts`
   and `loader_floors_test.exs`; schema mutant sweep on `title`.
8. `word_bar.test.ts`, `refused_verbs.test.ts:120` and the kernel consumer tests pass after their re-point;
   `npm run stories:views` output committed.

Stop and ask if the sim harness cannot carry the detail-target set to the new invariant without a new observation
field (then the guard is a per-cartridge sweep test in `fixture_pages.test.ts` over `compiled('cartridges/*')` start
rooms, and say so); if a liquid-source detail exists in a sampler and would gain a page; or if the sim's coverage
assertions (`PICKED` in `sim.test.ts`) drop because the generator draws from `view.actions` only (then add the
notices' actions to its pick pool in this slice).

## Slice 3: loka-x6t.120.3, showcase fixture titles, lever hall asides out, the lint (S, content)

Lane: content, after slice 2. Read `docs/SHOWCASE.md`.

Goal. `cartridges/toolbox_showcase`: `title` on each of the 35 recipe-target details, text keys `detail.<key>.title`,
a definite noun phrase like the sign's "The loft slate" (hearth -> "The hearth"; the levers and wheels distinct:
"The first lever", "The second wheel"; `horizon` -> "The horizon"; `cellar_flags` / `flagstones` -> "The flagstones";
`grate_lock`, `strongbox_lock`, `hall_strongbox_lock` name the lock, not the box). The 35 (room: detail):
carpenter_shop saw_bench; cell grate_lock; church lectern; farm_kitchen hearth; glade oak; holding_croft croft_hearth,
croft_pool; holding_lane plot_stakes; lever_hall lever_a, lever_b, lever_c, wheel_1, wheel_2, wheel_3; loft hearth;
loft_attic attic_hearth; moot_hall hall_cupboard, hall_lectern, hall_strongbox_lock; pawn_alley barrels; sapper_cellar
cellar_flags; sapper_stair flagstones; sea_cave cleft; shore_steps horizon; still_room hearth, knucklebones; the_fold
fold_bones, fold_hearth, fold_post; tide_pools pool_cleft; tollhouse iron_door, strongbox_lock, tollhouse_door;
vault_yard yard_barrels; woodstore store_bar. Delete `rooms/lever_hall.json` `asides` and `text.json:54-55`
(loka-x6t.125; the pull narration and the minimap's door state carry that depth). `at_least` 1.120. Regenerate
`protocol/fixtures/toolbox_showcase_hash.json` (`bin/regen_hash_fixture.sh cartridges/toolbox_showcase
protocol/fixtures/toolbox_showcase_hash.json`), replace the old sha in the 7 transcripts and 2 live `.sql` files,
`npm run stories:views`. Chop wood stays on the oak (owner). `showcase_traps.test.ts:246-269`: drop the aside
assertions (the door state is already asserted by the exits); `showcase_fixture.ts:187` and
`content_showcase_test.exs:112`: the aside strip becomes a no-op, remove the line.

Lint (`lib/loka/content/lint.ex`, a cross-file check beside `items`/`fills`): a detail that bears a page (a recipe's
`target.kind: detail`, or `readable`, `harvest`, `perception`, `bed`, `transport`, `notice_board`) must be linked
(`[words](<detail key>)`) in its room's `description` or one of its `variants`, and a recipe-target detail must have a
`title`: `"rooms/<room>.json: details.<detail> has a page and no prose link"` and `"rooms/<room>.json:
details.<detail> is a recipe target (<recipe key>) and has no title"`. Unit test in `test/loka/content_lint_test.exs`
with one invalid fragment per finding and the valid form beside it; the showcase baseline test stays at zero new
findings (all 46 showcase page details are linked today). `docs/CHECKS.md:108`: add "a detail with a page is linked
from its room's prose, and a recipe's target detail has a title" after the readable clause.

Docs: `docs/showcase/magic-district.md:38` (the recipe sits on the hearth's page), `:113-114` (gather from the
hearth page, then the lantern); any other district doc that describes one of the 41 recipes as a World card
(developer greps `docs/showcase` for each label). Hand back the 35-row title table (room, detail, title) for the
designer's batch pass.

Acceptance: both kernels compile the showcase with no new diagnostic; `kernel/ts/test/transcripts.test.ts` replays;
the fixture's sha256 equals `mix loka.compile`'s; the lint unit tests' red controls (title removed; link removed) fail;
`mix loka.lint cartridges/toolbox_showcase` reports nothing new; the web Book's loft shows "hearth" as a link and its
page titled "The hearth" with the Gather ash card (screenshot, 390 px). No new kernel test (a title is a deliberate
decision; the hash fixture is the pin).

Stop and ask before changing any detail description or alias, and if a title needs a word the description does not
support (name the detail).

## Slice 4: loka-x6t.127 (Book) and loka-x6t.125 (Book), the World page is the five parts (M, Book)

Lane: Book, after slice 3 and after the anatomy text (f8e3f884c) is on the batch. Read book-ui.md "Room page
anatomy" and its decision record, `docs/BOOK-UI-COMPONENTS.md` agent rules,
`docs/lessons/mobile.md`. Deletion first; existing components only.

Goal. The World page draws title, description (fixture links), people, items, log, and nothing this batch still
owns:
- World verb lines and refused `label: reason` notes go (`place.tsx` deleted; `placeActions`, `refusedPlace`,
  `placeButtons` and `group().place` trimmed to what the chrome still needs: `look`, exits, doors, `position`,
  `flee`, `continue`, `choice`, `word`). A detail recipe's refusal already draws on its page (slice 1 case 3).
- The storylet card goes (`pages.tsx:169,217-231`); `GameView.storylet` is not drawn. The walk harness
  (`walk.ts:100-108`) stops filtering for World verbs it no longer finds.
- `NoticeEntries` goes (`notices.tsx:126-146`, `Body.tsx:152`): a notice, board, bed, transport or harvest reaches
  its page only through its prose link (`proseLinks`); `kept()` and the EntityLine/ActionCard fallbacks in
  `NoticeLink` go with it (a board's children inside the board page keep `NoticeLink`). `restoredNoticePages` stays.
- Sense cues: the block after the items (`lines.tsx:177-181`) goes; each cue logs as one plain line (`cueLine` text,
  ink as narration) the first time it shows during a room visit, after that update's narration and arrivals, in
  projected order, reset on a room change: the `logs.ts:98-130` once-per-visit machinery, renamed from asides to
  cues (`asided` -> `noted`), never a second copy.
- Aside logging goes: `logs.ts` `asidesOf`, `presenter.ts:120,197-198` aside calls, `notices.tsx:155-165` `history`
  drops `detail.asides`; the Book reads no `asides` field anywhere (slice 5 removes the fields).
- `RoomPage.stories.tsx` Asides story (`:93-112`) and its `voices`/`remarks` text imports go; one story state shows a
  cue in the log.

Tests: `storylet.test.ts:36,49` become the guard's storylet rows; `:76,107` (send and stale redraw) move their
assertions to the kernel's `storylet.test.ts` if not already there (they are at `:112,205`), else delete.
`refused_verbs.test.ts:45` deleted, `:66,95` kept, `:120` as slice 2 left it. `polish_style.test.ts:44,87,149`
deleted and replaced by the cue tests below; `:181-240` kept. Cue tests in `d9.test.ts:7`, `polish.test.ts:314`,
`presenter.test.ts`: re-point to the log line.

Acceptance (`mobile/app/book/room_anatomy.test.ts`, hand views; literal strings from the test's catalog):
1. Guard. A view carrying an available target-none recipe action (`gather_ash`), an unavailable one, `storylet` set to
   it, two cues, place and NPC asides, an unlinked notice with a Read offer, an unlinked board, bed and transport
   renders a World page whose pressables are exactly: the title (Look), the prose fixture links, the people and item
   links; no `VerbLine`, no `ActionCard`, no `Note`, no `EntityLine` outside the two sentences, the storylet label
   absent, the aside texts absent from the page (break: any one of the removed blocks restored). The exit warning
   notes and the Continue conversation control are listed in the test as the two parts still open (loka-x6t.127
   follow-ups) and asserted present until their items close.
2. Cues. On entering a room with cues ["Hammering", east] and ["Heat beats out from the forge."], the log gains
   "Hammering from the east" then "Heat beats out from the forge." once, after the room's narration and arrivals; a
   re-render or a cue that stops and starts again logs nothing new; leaving and returning logs them again (break: logged
   twice, before the narration, or lost on return).
3. Linked fixtures only. A readable notice linked in prose opens and reads from the link; the same notice unlinked
   draws nothing on World (the lint owns the content side).
4. Screenshot, 390 px, the loft on the showcase: title, prose with links, people, items, log; nothing between.

Spec text (book-ui.md; the designer marked the superseded passages at `:25-63` place verbs, `:706-708` cues, `:710-712`
asides, `:758-760` storylet card): delete the superseded passages and their "removal item" notes; Sense cues details
becomes "GameView `cues` reach the player as log lines (room page anatomy, part 5): one plain line per cue, the
authored text, then ' from the ' and the direction when it comes from another room, logged once the first time it
shows during a room visit, after that update's narration and arrivals, in projected order; a room change starts a
new visit. The sense is in the words, never an icon or colour." Aside details: deleted (slice 5 removes the fields;
until then the Book ignores them). Storylet card details: "The Book draws no storylet card (room page anatomy); the
pick is projected and not shown until FD3 is anchored on a person or fixture page or retired (owner call)." Notice-board
details: a notice, board, bed, transport or harvest opens only from its prose link; the World-line sentences go.
mechanics.md `:2304` (cues Book bullet) and `:3205`/`:3217` (FD3 GameView and Book bullets): the same facts in one
line each with a link. `docs/MECHANICS-TOOLBOX.md:177` FD3 status: "engine only; Book card removed (anatomy), anchor
or retire pending". The designer confirms the text in the batch pass (single writer).

Stop and ask if removing `NoticeEntries` leaves a Book test on a sampler with an unlinked bed, transport or harvest
(fast_travel_sampler, harvest_sampler, replenish_sampler) with no way to reach the page: then link it in that
sampler's prose in this slice (a content edit of a sampler is mechanical; name the room) rather than keep a fallback.

## Slice 5: loka-x6t.125 (engine), asides removed from the contract and both kernels (M, engine)

Lane: engine, after slice 4. Read `docs/lessons/contracts.md`. Deletion; no replacement feature.

Goal. No `asides` anywhere: schemas, loaders, the reader, the view, the samplers, the docs.
- Schemas: `room.schema.json` `Aside` def `:643-679`, Room `asides` `:468`, InspectableDetail `asides` `:152`;
  `entity.schema.json:787-795`; `gameview.schema.json:573` (EntityView), `:1114` (PlaceView), `:2235` (NoticeView);
  `protocol/fixtures/invalid.json` aside cases (`:29960-30260`); `contracts.gen.ts` regenerated. No floor phrase
  remains, so `loader_floors_test.exs` drops the 1.107 case with `remarks_sampler`; the 1.91 case stays
  (`voices_sampler` keeps `skill_compare`).
- TS: `description_variant/rule.ts:62-75` `asides` deleted; `view.ts:125-138` (place) and `:184-189` (NPC) stop
  reading it; `notice_boards.ts` `asideView` and its two call sites; `cartridge_refs.ts` `asideParts` `:131-142` and
  its uses `:181,274`; `cartridge_variants.ts:18-20` (`voices` = the `skill_compare` leaf only; `remarks` rung gone);
  `cartridge_standing.ts:27-29`.
- Elixir: `variants.ex:33,65-74` (`aside?` gone, `voices = voice?(defs)`); `room_parts.ex:15,34-35,52-59,106`;
  `entities.ex:88-100,194,220`; `npc_fields.ex:40` (`asides` out of the list); `standing.ex:54-55`.
- Samplers: `voices_sampler` reworked (asides out of `rooms/hall.json` and `carved_door`; text keys
  `aside.hall.lore`, `aside.door.lore`, `aside.door.glance` out; `at_least` stays 1.91 for the leaf);
  `remarks_sampler` deleted with `kernel/ts/test/remarks.test.ts`, `test/loka/content_remarks_test.exs` and its
  floor case. `voices.test.ts:70,98` keep the lore growth, scholar variant and decipher-action assertions and lose
  the aside ones; `:132` and `content_voices_test.exs:10` keep the `skill_compare` reference, owner and floor cases.
  `light.test.ts:331,344,359`: the aside is replaced by nothing (the dark description assertions already prove the
  hiding); `showcase_traps.test.ts` as slice 3 left it.
- Docs: mechanics.md `:2254-2266` FD2 becomes the `skill_compare` leaf's section (keep `:2258` and the leaf's
  ownership, floor and sampler lines; the asides bullets go; `:1118` drops "and no room aside"); `:3775-3786` FD10
  replaced by two lines: retired by the owner 2026-10-23 (loka-x6t.125), remarks may return as talk or emotes
  (loka-kgd.193); cartridge.md `:1906` (asides clause out, the leaf and its floor stay), `:1908` deleted; book-ui.md
  Aside details deleted and `:245` "(a notice's asides first)" removed; `docs/MECHANICS-TOOLBOX.md:184` FD2 ->
  "leaf only; asides retired (loka-x6t.125)", `:200` FD10 -> "retired (loka-x6t.125)". The PM adds the
  owner-rules line for the decision record.

Acceptance:
1. Both kernels refuse a room, detail or NPC `asides` field as SCHEMA_VIOLATION at its path (one case each in
   `invalid.json`, or the loader tests of `voices.test.ts`/`content_voices_test.exs` by in-test edits); the schema
   mutant sweep on the three removed properties and the removed `Aside` def passes.
2. `gameView` of the voices hall at lore 2 has no `asides` anywhere and validates; the sage's scholar variant and the
   decipher action are unchanged.
3. The showcase compiles unchanged in both kernels (its hash fixture does not move: slice 3 already dropped the
   content); `transcripts.test.ts` replays; the showcase sim passes.
4. `mix xref callers` and `ast-grep -p 'asides'` over `kernel/ts/src`, `lib/loka`, `mobile/app` (excluding
   `contracts.gen.ts` history) find no reader; `grep -rn asides protocol cartridges` finds nothing.
5. `loader_floors.test.ts` and `loader_floors_test.exs` pass with the remarks case removed; the voices 1.91 case still
   fails its red control (leaf present below 1.91).

Stop and ask if the `skill_compare` leaf's floor is not expressible without the aside walk (`nodes()` in
`cartridge_refs.ts`, `RoomParts.conditions`), or if a test outside the listed ones reads `asides`.

## Follow-ups (not in this batch; loka-x6t.127 children)

- Exit warning notes (`pages.tsx:197-210` `warnings()`, GameView `exits[].warning`, no spec): the anatomy admits them
  neither as a block nor as a fixture; candidates are a log line on arrival or the minimap's exit. Designer ruling,
  then one S Book slice.
- Continue conversation control on World (`pages.tsx:165-167`, a pending `choice` whose speaker is not present):
  belongs to the speaker's page or the Journal. Designer ruling.
- Away recap block and the NPC carried-item Note under the people sentence: owner calls pending (loka-x6t.127).
- FD3 storylets: anchor the pick on a person or fixture page (`target.on`, projected as that page's card) or retire
  the mechanic with its sampler. Owner call; one engine row either way.
- NPC remarks as talk or emote lines (loka-kgd.193).

## Risks

- Between slices 2 and 3 the showcase fixture pages are titled by their description sentence (shown twice on the
  page); between 2 and 4 World still draws the (now empty for the showcase) verb list and the cue block. The draft PR
  is marked ready only after slice 5.
- The sim's generator may stop reaching the detail recipes if it picks from `view.actions` only; slice 2's stop rule
  covers it. Narration coverage (`sim_narration_baseline.txt`) may shift the same way.
- Samplers stay untitled, so sampler-based Book tests open pages titled by a description sentence. Accepted.
- Removing `NoticeEntries` makes an unlinked sampler bed, transport or harvest unreachable in the Book; slice 4's stop
  rule links them in the sampler prose. The lint keeps the showcase linked.
- A fixture page action narrates into the page's history with nothing announcing it (loka-x6t.124, separate).
- Whether a card press on a fixture page should return to World (as Give and the pick lists do) or stay (as Study
  does) is a designer ruling for the batch pass; this batch keeps today's stay.
- FD3 is left without a presenter until the owner's call; the kernel tests keep it honest, no player sees it.
