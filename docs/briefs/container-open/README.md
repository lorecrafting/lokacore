# Containers need Open first (loka-x6t.121), 2026-10-23

Owner (live polish session 2026-10-23, picks mvlyeu65dq5l + mvlyfl1mckw6, quoted): "Yeah make they need to open it
first, becfause it can have other options like 'take' the whole sack, or 'cast' a spell on it"; approval today: "also
work on the containers need open first issue". Container page: title, description, the container's own cards (Open,
Take, Cast a spell…), Leave last; Open reveals the contents list (each entry opens its item page); no Unlock unless the
container has a lock. Drafted by Fable (PM asked for a contract-level read: save, view, loaders), PM edits. Read the
[brief kit](../../guides/brief-kit.md) for every slice. Handoff threshold: 220k (WORKFLOW token hygiene).

Batch branch `toolbox/batch-container-open`. Beads: slice 1 loka-x6t.121 (the issue itself); slice 2 only on the
owner's answer to open question 1 (a child issue then).

## The finding that shrinks this row

The designer's finding ("the engine has no open/closed state for containers; open/close/lock/unlock exist only for
doors") is wrong for the engine and right for the seed sack. barrier@1 already puts a lid on an item:
`items/<k>.json` `barrier: <barrier key>` (cartridge.md:275 "Only receptacles may declare `capacity` or a lid
`barrier`"; mechanics.md:64 barrier@1 "`target_id` (the barrier on that item, a container's lid; c1-locks)"). The
showcase strongbox and hall strongbox have one (`cartridges/toolbox_showcase/items/strongbox.json:14`
`"barrier": "strongbox_lid"`, `barriers/strongbox_lid.json`). With a lid:

- State is per container, in the save, persistent across visits and saves: `barrier.transition` rows
  (`kernel/ts/src/mechanics/barrier/rule.ts:47-65`; `barrierState`, `lookups.ts:59`, reads `state.barriers`, else the
  authored `initial`). Nothing resets on Leave; nothing resets on a room change.
- Closed hides contents in the GameView: `view/view.ts:198-220` `inside()` lists only what is under opened containers
  (`:210` `opened(world, c, body)`); the entity still carries `state: 'closed'` (`:243`). Pinned today by
  `kernel/ts/test/locks.test.ts:195` (sewing box: `state: 'closed'`, actions `[open, take]`, no `contents`; after
  open `state: 'open'`, `[close, take]`, `contents: [key]`).
- Open/Close are offered on the lidded item only when `transition` would accept them (`view/action_lists.ts:165-168`
  door branch, `lidded` `:265`, `usable` `:295`; `advertise` `:194` aims the verb at the item, `target_ids: [id]`).
  Lock/Unlock need the barrier's `key_item` held, else `not_owned` and not listed (`barrier/rule.ts:93-96`): a lid
  with no `key_item` never shows Unlock. That is the owner's "no Unlock unless the container has a lock" for free.
- Take from a closed container is `not_present` (custody walk `reach`, `lookups.ts:67`, fails on a closed lid;
  mechanics.md:91-94); Put into one is `exit_closed` (`containment/shared.ts:231-232`). Take of the whole sack
  (contents counted even behind the lid, mechanics.md:111) and Give of the whole sack are unchanged. A spell aimed
  at the sack (loka-x6t.109) targets the item, not its contents: unchanged.
- Open costs no logical duration: only a recipe's `duration` emits `time.advance` (mechanics.md:378); doors, Take and
  Open are untimed. There is no turn to spend.
- Held containers follow the same rule: a closed held sack lists no contents in Inventory (`within`, `view.ts:157`,
  calls `inside` for held items too) until opened once; the state then persists while held.
- Loaders, both kernels, already check an item's barrier (`kernel/ts/src/content/cartridge_barriers.ts:38-45`;
  `lib/loka/content/barriers.ex:142`). No schema, kernel_api, floor, save migration or Elixir change. No new engine
  flag: `barrier` on the item is the opt-in, `initial` is the default state.
- The Book already does the owner's page: the lid's state draws as a note under the description (`skills.tsx:134`,
  "Closed"), Open is a card in the first group (book-ui.md:246 detail-page order lists
  Open among the verbs on the thing itself), an accepted `opened` stays on the page (`received.ts:46` `CHANGED` has no
  `opened`, so no return to World), reads "Opened." in the page log (`words.ts:60`) and the next GameView draws Inside
  (`Menu.tsx:73` `inside()`, after the cards, before Leave; `:98` `ThingPage`). `c1.test.ts:102` pins that opening a
  container keeps its page and a closed ancestor drops a child page. The strongbox page is the live precedent.

So the row is content: give the seed sack a lid. The seed sack is the only showcase container with contents and no lid
that the owner has looked at (`items/sack.json`, holds `seed_01`). Other lidless receptacles with contents: `crate`
(candle_04, candle_05), `yard_crate` (yard_candle_02); lidless and empty at start: `hoard_chest`, `strongroom_chest`,
`nest`, `trough`, `plot`, `croft_plot`, the two corpses (fixed room containers; never lidded). Candidates are open
question 1.

## Design: pick and alternatives

**Pick: a lid on the sack, nothing new in the engine.** Author `barriers/sack_tie.json` (`initial: closed`, no
`key_item`, no `opens_when`) and `items/sack.json` `barrier: sack_tie`; the engine and the Book do the rest (facts
above). Open persists (save row), never closes by itself, Close is offered when open (as on the strongbox), Take/Put
through a closed sack refuse, taking or giving the whole sack works, the carried sack opens once. Cost: one content
slice plus the showcase hash regen and the three Book routes that tap the seed straight from the sack page.

Alternative A, Book-only Open (a per-visit latch in the presenter): no engine or content change, but the contents stay
in the GameView (the Inside rows exist, a screen reader and the stale-route rule see them), it resets per visit, and it
costs the Book a state it never had. The designer's finding rejects it; the owner's words ("need to open it first") name
a world fact, not a page fold. Rejected.

Alternative B, a new container `open` boolean (a `closable` flag, `container.open`/`container.close` ops, a save row
kind, GameView field, kernel_api bump, both loaders, a floor case): duplicates barrier@1 one field at a time and adds a
second spelling of "closed" the custody walk would have to learn. Rejected: the lid is that state.

Alternative C, a lid on every showcase receptacle: crates, chests, nest, trough, plots and corpses would all demand Open.
Corpses, plots, a trough and a nest have no lid in fiction; the chests and crates might. Not the owner's pick; open
question 1, slice 2 if yes.

Settled answers, in the owner's terms: per-container state in the save, yes, persists across visits and saves; Open
costs no time; it does not close again until the player presses Close (no Close on Leave); Take/Put/Give into a closed
container refuse (`not_present` / `exit_closed`; Give of the whole container is allowed); a carried container needs one
Open, then stays open; the view exposes `state: 'closed'` and no `contents`; refusal lines are the existing ones (the
Book's Take note for `not_present` and `exit_closed` already exist, no new words); cartridge authoring is the existing
item `barrier`; no migration (old saves of the showcase are refused by the hash pin as after every content merge,
pre-production rule); no kernel_api bump; no Elixir change.

## Slice 1: loka-x6t.121, the seed sack gets a tie (S, content + Book glue)

Lane: content (hosted PR on the batch branch). Read `docs/SHOWCASE.md`, `docs/lessons/mobile.md` (stories:views). Both
halves land in one slice because `npm run stories:views` replays the Book routes against the regenerated hash: the
route edit and the hash regen cannot be split without a red draft head.

Goal. `cartridges/toolbox_showcase/barriers/sack_tie.json` following `strongbox_lid.json` minus `opens_when`:
`keywords: ["sack_tie"]`, `short: "barrier.sack_tie.short"`, `initial: "closed"`. `items/sack.json` adds
`"barrier": "sack_tie"` (the `barrier` capability is already required, `cartridge.json:35`). `text.json` adds
`"barrier.sack_tie.short": "the sack's tie"` (the lid's short is unused on an item page; it exists because the schema
requires it, room.schema.json:764-769). Regenerate `protocol/fixtures/toolbox_showcase_hash.json`
(`bin/regen_hash_fixture.sh cartridges/toolbox_showcase protocol/fixtures/toolbox_showcase_hash.json`), replace the old
sha in the seven `cartridges/toolbox_showcase/transcripts/*.jsonl`, then `npm run stories:views` (mobile/app) after
the route edit below, which rewrites `mobile/app/stories/live/*.sql` and `stories/views/*.json`.

Book routes (`mobile/app/stories/routes.ts`): `sack` (`:49`) stays the walk to the yard and the tap on
`'seed sack, open'`; `'item-container'` (`:86-92`) and the `'sack-contents'` route (`:134`) gain `'Open a seed sack'`
(the card's label is `label(a.label)` + " " + the thing's name, `buttons.ts:67`, as `'Take a turnip seed'`) before
`'A turnip seed, open'`; `'item-too-heavy'` (`:93`) stays closed (it shows the too-heavy note, not Inside).
`mobile/app/stories/Live.stories.tsx:102-116` `SackContents`: tap `'Open a seed sack'` after the title focus, find the
log line `Opened.`, then the existing seed taps. `docs/showcase/homestead-district.md:97` `sack` row: "(tie, starts
closed; holds `seed_01`)".

Spec text, book-ui.md "Item details and Take/Drop" (`:399`), after the first paragraph, for the designer's batch pass:
"A container with a lid (cartridge item `barrier`, loka-x6t.121) draws its state as a note (**Closed**, **Open**)
and, while closed, no Inside: Open is
one of its own cards (first group), an accepted Open keeps the page, logs **Opened.** and the next GameView adds the
Inside list; Close is offered while open and nothing closes on Leave; Unlock appears only when the lid has a
`key_item`. Take from and Put into a closed container are refused by the engine (`not_present`, `exit_closed`), so the
page never lists them." mechanics.md:94 stays as is (a container without a barrier is open).

Files to touch (outline signatures):

```
cartridges/toolbox_showcase/items/sack.json              add "barrier": "sack_tie"
cartridges/toolbox_showcase/barriers/sack_tie.json       new (keywords, short, initial)
cartridges/toolbox_showcase/text.json                    add barrier.sack_tie.short
protocol/fixtures/toolbox_showcase_hash.json             regen
cartridges/toolbox_showcase/transcripts/*.jsonl          sha re-pin (7 files)
mobile/app/stories/live/*.sql, stories/views/*.json      regenerated by stories:views
mobile/app/stories/routes.ts
 49: const sack = [go('north', 'west', 'south'), 'seed sack, open'];
 86:   'item-container': [...sack, 'A turnip seed, open', 'Take a turnip seed', 'seed sack, open', 'Put a turnip seed in a seed sack']
 93:   'item-too-heavy': [...sack],
134:   'sack-contents': [...sack],
mobile/app/stories/Live.stories.tsx
102: export const SackContents: StoryObj = { ... play: tap('seed sack, open') ... tap('A turnip seed, open') ... }
kernel/ts/test/showcase_homestead.test.ts
524: const put = (w: World, k: string, c: string) =>
526: const yard = () => walk(fresh(WORLD), 'north', 'west', 'south');
528: const sowable = (clock: number) =>            // take(take(play(yard(), ...), 'seed_01'), 'watering_can')
555:   const seed = take(yard(), 'seed_01');        // homestead 13
563:   refused(take(yard(), 'seed_01'), {...})
608:   const open = Object.entries(...)             // a local named `open` already exists: name the helper `untie`
623:   w = play(w, { type: 'open', target_id: id(w, 'item', 'strongbox') }).world;   // the pattern to copy
675:   const tenant = walk(take(yard(), 'seed_01'), 'north', 'up');
docs/showcase/homestead-district.md:97, docs/system/book-ui.md:399
```

Tests that must fail first (red on the content alone, before the test edits): `showcase_homestead.test.ts` 13, the
sandbox strongbox test and the croft tenant test take `seed_01` from the yard sack (`:529`, `:555`, `:563`, `:675`) and
go `not_present`; `mobile/app/stories.test.ts` (E5) holds the live saves and views byte-exact; the `SackContents` play
finds no `'A turnip seed, open'`.

Acceptance (`showcase_homestead.test.ts`; expected values are literals and `locks.test.ts:195`'s shape):
1. Fresh yard: the sack's EntityView has `state: 'closed'`, no `contents`, and its actions' `action_key`s include
   `open` and `take` and neither `close` nor `unlock` (break: lid missing, or a keyless lid listing Unlock). The
   `gameView(w)` validates against `protocol/gameview.schema.json`.
2. `take seed_01` from the fresh yard is `not_present`; `put` of a held item into the closed sack is `exit_closed`
   (break: custody or the put lid check skipping an item barrier).
3. After `open {target_id: sack}` (`opened`): `state: 'open'`, `contents` is exactly `[seed_01]` with
   `container_id` the sack, `close` offered; the seed then takes. Walk north and back south: still `open` (break: a
   view-only or per-visit state).
4. `take` of the whole closed sack by a body that can carry it: unchanged refusal `too_heavy` (20000 g; the lid adds
   no new refusal; break: a lid making the sack `not_present` to itself).
5. The four existing takes pass again with one `open` before them (a helper `untie(w)` beside `put`, `:524`).
6. Both kernels compile the showcase with no new diagnostic; `transcripts.test.ts` replays; the fixture's sha256 equals
   `mix loka.compile`'s; `stories.test.ts` is green after `stories:views`.
7. Screenshot, 390 px: the Farm Yard sack page closed ("Closed" note, Open card, the too-heavy Take note, Leave; no
   Inside), and after Open ("Open" note, Close, Inside with the seed). Hand both back.

No mutants beyond rows 1-3 (content; the engine conditionals are already pinned in `locks.test.ts` and
`barrier_sampler.test.ts:57`). Realm checklist: all n/a or met by barrier@1 (actor from the command; player-scope
nothing new; shared-world lid state, as doors).

Stop and ask if the Book draws the sack page in a different order than the owner described (cards, then Inside, then
Leave: `ThingPage`, `Menu.tsx:98-140`), if a showcase transcript steps into the sack (none found), or if
`stories:views` cannot replay `'Open a seed sack'` (then quote the label the harness lists).

## Slice 2 (conditional on open question 1): lids on the crates and chests (S, content)

Same shape as slice 1 for each container the owner names (`crate`, `yard_crate`, `hoard_chest`, `strongroom_chest`):
one barrier file each (`initial: closed`, no key unless the owner wants one), the item's `barrier`, text key, hash
regen, one `open` in each test that takes from them (`grep -n "candle_04\|candle_05\|yard_candle_02\|hoard_chest\|
strongroom_chest" kernel/ts/test/showcase_*.test.ts mobile/app/stories/routes.ts` before starting), showcase doc rows.
No Book or spec text. Acceptance: slice 1's rows 1-3 and 5-6 per container. Not briefed further until the answer.

## Risks

- The showcase hash moves, so the bundled save (`loka-showcase.db`) is refused with Start over after the merge, as after
  every content merge (loka-4hik.1 ruling). Accepted, pre-production.
- `stories:views` byte-exact outputs (E5) change for every live story, not only the sack ones, because the sha is in
  each save; the review reads the sack rows only and trusts the regen for the rest.
- A player who carries the closed sack sees no seed in Inventory until they open it on the sack's page; the page's
  "Closed" note and the Open card are the only hints. Accepted (the strongbox reads the same today).
- `homestead 13` grows one step; its red-first run proves the lid, nothing else changes in the sow flow (the seed
  returns to the sack by `item.move`, which ignores lids: `replenish seed_return`, homestead-district.md:158).

## Open questions for the owner

1. Which other showcase containers get a lid now: the chandler's `crate` and the `yard_crate` (candles inside), the
   `hoard_chest` and `strongroom_chest` (empty at start)? Corpses, plots, nest and trough stay open.

Owner answer 2026-10-23: yes, `crate`, `yard_crate`, `hoard_chest` and `strongroom_chest` get lids (slice 2), folded into this branch as a second commit; corpses, plots, nest and trough stay open.
