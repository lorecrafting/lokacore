# Narration log batch (loka-kgd.185 every change narrates, loka-x6t.129 every line in the room log, loka-x6t.124 detail lines announced), 2026-10-24

Owner go 2026-10-24 (loka-kgd.185 comment, quoted: "Yes"), on the PM's rule (paraphrased): the engine owns the
words, the client owns placement, so a future telnet client and the Book show the same stream from the same engine.
The same comment says to narrate take, drop, give and put and to empty the pinned silent list. It overrides the
older kgd.185 note that moved about 6 keys to `SILENT` with the reason "Book fallback line". Drafted by Opus. PM
edits. One draft batch branch, `toolbox/batch-narration-log`. The slices run in order on it, and each slice has its
own commits. Read the [brief kit](../brief-kit.md) for every slice. Handoff threshold: 220k (WORKFLOW token hygiene).

Run order: 1 (engine, M) -> 2 (engine, M) -> 3 (Book, M). Slice 3 needs slices 1 and 2: until every change
narrates, "every line in the room log" leaves holes. The PR is marked ready only after slice 3.

## Design (settled)

- **The line is the engine's.** Each committed change narrates one `Text` record `{key, bindings, participants}`
  in `accepted(...)`'s narration (`runtime/decision.ts:303`). The record carries the engine key, the names it binds
  (`entity.short` TextKeys, as `item.recovered` does at `containment/recovery.ts:67-70`), and
  `participants.actor`. A client has to word the same line in the same way. It never decides whether a line exists.
- **Person is placement.** There is one record per change, for every viewer. A client words it in the first person
  when `participants.actor` is the viewer's body ("You take the rope.") and in the third person otherwise ("Bram
  takes the rope."). This is today's `combat.skipped` pattern (`words.ts` `lineWords`). The kernel delivers no
  per-observer line: `RecipeNarration.observers` is only text-checked (`content/cartridge_recipes.ts:61`). This
  batch adds no observer channel.
- **Where the sentences live.** One table of English sentences per engine key, in `mobile/app/book/words.ts`
  `lineWords`, as `combat.fled` does (commit 8063d2951, the precedent: kernel line and Book words in one commit).
  The kernel has no text interpolation and no catalog for engine keys (the compiler checks no engine key against
  cartridge text). A telnet client would word the same keys from the same table. Moving the table into a
  host-neutral module is a later row (open question 1). Authored narration still wins: an item's `equip` lines,
  theft's `narration.seen/unseen` and a recipe's narration keep their place, and no engine line is added beside
  them.
- **Book placement.** Every narration line, refusal line and arrival or departure goes to the room event log
  (`s.log`, through `world(s, away, lines)` so the away recap still holds background lines). A line whose receipt
  routes to an open detail page (`detail_id`, a shop, a conversation, an item page) is also drawn in that page's
  visit history. That page never draws the room log, so nothing is drawn twice on screen. Combat lines stay in the
  combat log only (open question 2).
- **Announcements (x6t.124).** The live region keeps one source, the room log (`presenter.ts` `heard`). Once
  detail lines are in `s.log`, a buy, a sale or an NPC reply is read once with no new code path. A second source
  (detail histories) would read each line twice. No new announcement code is needed.
- **Hash, transcripts, save.** None. Narration is outside the delta: `delta_digest` hashes `d.delta` only
  (`kernel/ts/play/run.ts:127`), no transcript carries narration, and no cartridge or `text.json` changes. So
  `bin/regen_hash_fixture.sh`, the 7 showcase transcripts and the live `.sql` keep their sha. If a slice edits any
  cartridge file after all, re-pin with `bin/regen_hash_fixture.sh cartridges/toolbox_showcase
  protocol/fixtures/toolbox_showcase_hash.json`, then replace the old sha in `cartridges/toolbox_showcase/transcripts/*.jsonl`
  and the live `.sql`, as the room-fixtures slice 3 did. Saved `NarrationRecord`s keep their shape. Old receipts
  without the new lines replay as before.
- **kernel_api.** No bump. No schema changes: `Text` and `DecisionResult.narration` exist.
- **Elixir.** No mirror. Story rules are TypeScript-only (AGENTS.md, Candidate C), and the Elixir kernel narrates
  no verb. `test/loka/lint_baseline.txt` is loka-kgd.184's and is not part of this batch.
- **Guard.** The showcase sim's check 4 (`kernel/ts/test/sim.test.ts:240-250`, `sim_batch.ts:111-127` `unnarrated`)
  is the red-first test for slices 1 and 2. A narrated key that is still pinned fails with "narrated now; remove it
  from the baseline". Each slice removes its keys and lowers the cap at `:244` to the remaining count.

## Slice 1: loka-kgd.185 part 1, take, drop, give and put narrate (M, engine and Book words)

Goal. `containment/rule.ts` `decide` adds one line to each accepted take, drop, give and put. Proposed keys:
`item.taken`, `item.dropped` (bindings `item`), `item.given` (`item`, `to`), `item.put` (`item`, `container`), all with
`participants.actor` (plus `recipient` or `container`). A stolen take keeps theft's authored line. The Book words
each key in `lineWords` ("You pick up X." and "You drop X." keep book-ui's wording, "You give X to Y.", "You put X
in Y.", third person "<Name> picks up X.") and deletes what the engine line replaces: the take, drop and give branches of
`received.ts` `fallbackLine`, `words.ts` `given`, and `OUTCOME` `taken`, `dropped`, `put`.

Files (outline signatures):

```
kernel/ts/src/mechanics/containment/rule.ts      (121 lines; decide is at its size: allow 58: add a helper, never raise it)
 34: export const decide: Rule<'containment'> = (world, command, mint, steps = { n: 0 }) => {
kernel/ts/src/runtime/decision.ts
303: export const accepted = <E>(world, outcome, ops, events, narration?: readonly Text[], rng = world.state.rng)
mobile/app/book/words.ts                          (279 lines)
 56: export const OUTCOME: Record<string, string> = {
133: export const given = (item: string, to: string) => `You give ${item} to ${to}.`;
185: export const lineWords = (
mobile/app/book/received.ts                       (180 lines)
 46: CHANGED = ['taken', 'dropped', 'given', 'eaten', 'bandaged']
110: export function named(b: Button, was: GameView) {
119: fallbackLine = (
kernel/ts/test/sim_narration_baseline.txt, kernel/ts/test/sim.test.ts:244, kernel/ts/test/containment.test.ts,
mobile/app/book/polish_detail.test.ts (:16, :123 take/drop return World)
```

Acceptance:
1. Red first: drop `take drop give put` from the baseline and set the cap to 9. The sim fails with four "commits a
   change with no narration line" findings, and passes after the kernel change.
2. `containment.test.ts`: each of the four accepted decisions carries exactly one line with the literal key,
   bindings and `participants.actor`. A stolen take carries only theft's line. A refusal carries none. Break: the
   helper attached to one branch only.
3. Book: a hand receipt `item.taken` whose actor is the viewer reads "You pick up the rope."; whose actor is an
   NPC id in `view.entities` reads "Bram picks up the rope.". Take and Drop still return to World with one line
   (the existing `polish_detail.test.ts` cases stay green with the fallback deleted).

Stop and ask if a corpse take (`pickup_name`, `logs.ts` `pickupLine`) would show two lines, or if `named` is still
needed after the fallback goes (then delete it with its caller, whisper's listener excepted).

## Slice 2: loka-kgd.185 part 2, the other nine keys narrate; the pin list goes (M, engine and Book words)

Goal. Each remaining pinned key gets an engine line when no authored line exists:
- `open`, and `close` with it (`barrier/rule.ts` `decide`): `barrier.opened` and `barrier.closed`, binding the item's short or the
  exit's direction. Read how a door's close narrates today (review 2026-10-23 container-open, `sim.test.ts:246`
  comment) and reuse that line if one exists.
- `wear`, `remove` (`equipment/rule.ts:36-41`): `equipment.worn` and `equipment.removed` (`item`) when `e.equip` is absent.
  Wield-slot words stay `WIELD`'s, keyed by the line.
- `stand`, `sit`, `rest`, `sleep` (`position/rule.ts` `decide`): `position.stood`, `sat`, `rested`, `slept`, put
  before any `engage` narration from sleep.
- `talk` (`dialogue/rule.ts:67` `talk`): narrate the opened choice's prompt key. `received.ts`
  `conversationLines` already skips the prompt when the narration has it, so it is not drawn twice.
- `move` (`movement/rule.ts` `decide` via `moveSequence`): `movement.moved` (`direction`). The Book's
  `withoutHeading` filter stays (open question 3).

The Book words each key in `lineWords` from today's `OUTCOME` strings ("You stand up.", "Opened." becomes "You
open the crate."), then deletes the `OUTCOME` entries the engine now covers. Delete
`sim_narration_baseline.txt`, the `pinned` parameter of `unnarrated` and its two filters, the cap, `SILENT.close`
with its lid check (`sim.test.ts:246-249`) and, if `SILENT` is then empty, `SILENT` too. Update the row 4 sentence
in `docs/CHECKS.md`.

Files (outline signatures):

```
kernel/ts/src/mechanics/barrier/rule.ts   47: export const decide: Rule<'barrier'> = (world, command, mint, steps = { n: 0 }) => {
kernel/ts/src/mechanics/equipment/rule.ts 27: export const decide: Rule<'equipment'> = (world, command) => {
kernel/ts/src/mechanics/position/rule.ts  14: export const decide: Rule<'position'> = (world, command, mint, steps = { n: 0 }) => {
kernel/ts/src/mechanics/dialogue/rule.ts  67: function talk(world: World, command: Command<'talk'>, mint: Mint, steps: Steps) {
kernel/ts/src/mechanics/movement/rule.ts  36: export const decide: Rule<'movement'> = (world, command, mint, steps = { n: 0 }) =>
kernel/ts/test/sim_batch.ts              104: export function changeKey(command: Command, d: DecisionResult): string | undefined {
                                         112: export const SILENT: Record<string, string> = {
                                         118: export function unnarrated(s: Pick<Summary, 'changed' | 'silent'>, pinned: string[]): string[] {
mobile/app/book/words.ts                  56: export const OUTCOME / 77: export const WIELD / 185: export const lineWords
kernel/ts/test/{barriers,equipment,position}.test.ts, a dialogue talk test, docs/CHECKS.md (row 4)
```

Acceptance:
1. Red first: empty the baseline with cap 0. The sim lists the nine keys, then passes after the kernel change.
   With `SILENT` emptied, `close` must also pass.
2. Per rule file, one kernel case for each verb: the literal key and `participants.actor`. An item with `equip` keeps only
   its authored line. Sleep into an ambush has the position line first, then the engage lines.
3. Book: one `lineWords` case per new key family, first and third person. The existing position and equipment
   Book tests stay green after the deleted `OUTCOME` entries.
4. `npm run test:sim:showcase` passes locally. Hosted `sim (showcase)` is green on the head.

Stop and ask if the move line shows on World next to the heading in a way the walk contact sheet makes worse, or
if a key needs a new binding that `TextValue` cannot carry (a protocol change).

## Slice 3: loka-x6t.129 and loka-x6t.124, every line in the room log; detail lines announced (M, Book)

Lane: Book. Read `docs/BOOK-UI-COMPONENTS.md` agent rules and `docs/lessons/mobile.md`. Use existing components
only. This slice needs the designer's spec text below first.

Goal. Today each line picks one target. Make the room log always get it, and an open detail page also get it.
There are three sites:
- `presenter.ts` `narrate` (background receipts): `world(s, away, lines)` always, then `to.push(...lines)` when routed.
- `received.ts` `received` (a press's reply): `lines` becomes "the detail history, if routed" plus the room log
  (through the held `away` log when one is open). Combat routing is unchanged.
- `presenter.ts` `pressed` pending path (`:178`): the same two targets.
`heard` is unchanged: it reads `s.log` only. Its comment and book-ui Announcements say why.

Files (outline signatures):

```
mobile/app/book/presenter.ts (297 lines)
 87: function world(s: Logs, away: Logs['away'], lines: string[]) {
 92: function narrate(s: Logs, last: NarrationRecord, now: GameView, away: Logs['away'], text: Say) {
153: function pressed(game: Game, b: Button, detail: string | undefined, s: Logs, text: Say): string {
216: function heard(s: Logs, view: GameView, was: Said | undefined): Said {
mobile/app/book/received.ts
 48: export function received(game: Game, reply: Reply, was: GameView, s: Logs, text: Say): string {
159: function detailRoute(
mobile/app/book/logs.ts (185 lines)
 44: export type Logs = {
 70: export function restoredLogs(game: Game, text: Say): Logs {
158: export function detailLines(s: Logs, id: string) {
mobile/app/book/live_region.test.ts (:30, :42), polish_detail.test.ts, a shop test, docs/system/book-ui.md, docs/design/interaction-patterns.md
```

Acceptance (hand views, local story authority):
1. A buy on a shop page: the shop history and the room log each have the buy line exactly once. The live region reads it
   once, and Leave shows it in the room log. Break: today's single-target routing (the room log lacks it, and
   the region reads nothing).
2. An NPC reply on its page: the same, with the speaker's history.
3. A background receipt for another character's action while a detail page is open goes to the room log
   only, and is read once.
4. Away recap: a receipt during an open settlement is held by the recap, not pushed to `s.log` directly
   (an existing recap test with a detail page open stays green).
5. A reopen (`restoredLogs`) reads no line again (existing `live_region.test.ts` cases).
6. Screenshot, 390 px: a shop page after a buy, and World after Leave with the line in the log.

Stop and ask if a receipt with a `detail_id` for a page that is not open must still be drawn when it next opens
(book-ui Notice-board details restore), or if a refused press on a detail page needs a ruling the designer has not
given.

## Designer rulings needed before slice 3 (spec text is the designer's)

Change these passages so they match the placement rule:
- `docs/system/book-ui.md` Detail-page order: "no line shows twice for one receipt" (it now shows on the page and in
  the room log, never twice on one page).
- `docs/system/book-ui.md` Room page anatomy, part 5: the log also carries the player's own lines, including the ones
  shown on a detail page.
- `docs/system/book-ui.md:111`: "the `words.ts` outcome word ("Opened.") draws only for a receipt with no narration at all",
  and `:418-423` ("**You pick up <name>.**", "**You drop <name>.**", "These replace generic Taken/Dropped fallbacks"):
  these are engine lines now, and the Book only words them.
- `docs/system/book-ui.md:168`: position fallbacks ("You stand up." and the others) become the engine's position lines.
- `docs/system/book-ui.md` Announcements (`:566-571`): it reads new room-log lines, which now include detail-page
  lines. It drops "World, combat and refused" (combat as open question 2 decides).
- `docs/design/interaction-patterns.md` Item detail, "Never appears: a second copy of a World line"; Room, "every
  ambient line appends" (every line); Feedback, "After an action you stay where you are"; Screen-reader
  announcements (remove "Gap: ... loka-x6t.124").
- Wording of the new engine keys (slices 1 and 2) in the third person, and whether "Opened." becomes a named
  sentence.
- A refusal on a detail page: today it is drawn on the page only. The default in slice 3 is to also add it to the room log, so it is
  announced. The designer confirms this or chooses a different rule.

## Open questions (owner)

1. Engine sentences live in the Book's `words.ts` for now. Should they move into a shared, host-neutral table before a
   second client exists? The default is no: a later row moves them.
2. Combat narration stays in the combat log only. Should a fight's lines also land in the room event log, so the room log is the
   full transcript? The default is no (book-ui combat rules, interaction-patterns Combat "Never appears").
3. A plain move: should the new room's log open with "You go north." (the MUD style without the room text), or
   should the Book hide the engine's move line and let the new page speak? The default is to show it.

## Risks

- Slices 1 and 2 change every take, drop, open and position receipt the Book walk draws. The walk contact sheet
  (`book-e2e.yml` `walk`) may change its wording. Check its screenshots at slice 2.
- Deleting `fallbackLine` branches before every key narrates would leave a silent receipt. Each slice deletes
  only the fallbacks for its own keys.
- The sim generator may not reach a key, for example a showcase `talk` with no dialogue. In that case "narrated
  now" never fires and a stale pin could stay. Slice 2 deletes the pin file, so this risk ends there.
- Room logs grow by the lines of every detail page. A long shop visit fills World's log. Accepted: it is the
  transcript the owner's rule asks for.
