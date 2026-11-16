# Review: editor walk C, schedule hour kinds, status duration, one-way Undo, last variant, Run fights

- PR: #683 `fix/editor-walk-c-2026-11-06` (loka-wfrgk.74, .75, .77, .78, .79; .76 handed back)
- Reviewed commit: `426935398d8ff251676bcdebb3c45a32b2c1d2c5`
- Governing: [cartridge.md, Author preview](../system/cartridge.md#author-preview),
  [GUI editor design §6, §11](../rnd/gui-editor-design-2026-11-04.md),
  [WORKFLOW review stance](../WORKFLOW.md#review-stance); card bar: never offer or write what the compiler refuses;
  author-error guards are nits
- Independence: authored none of the slice; detached review worktree
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **CHANGES REQUIRED**

## Must be true (written before the diff)

1. A card writes only the author's edits: a hidden branch and an integer value stay on disk as they were.
2. A card never writes what the compiler refuses, and never offers it.
3. A card's Undo takes back the newest journal entry that touched its file, only when the file is unchanged since.
4. Run fights runs one at a time, within a limit a real run fits.
5. Defaults invent no content (no ref cartridge, no room).

## Checks that held

- .75: "sanitized" is rjsf 6.11.1 `sanitizeDataForNewSchema` (`getStateFromProps` arg 6, set on leaf edits); it read
  `duration`'s `const` branch as an enum. Turning it off only removes a rewrite, so no valid value is now changed
  or dropped by it. `duration` is the only number | const union in `defs.schema.json`, and every card renders
  `CardFormBase` (Generic, Room.tsx:174, World.tsx:114), so the fix covers them all. The cost, stale fields after an
  if/then/else switch, reaches only the top-level kind switch and ReactionRule zone/event.
- .74: a cases hour as `untagged` writes it, `[{room: 'shepherd_hut'}, 'shepherd_hut']` in `wat.json`, compiles
  (`mix loka.compile`, exit 0). The panel E2E asserts the file on disk keeps hour 15.
- Claim reruns: `fallback` is `List.last` (schedules.ex:91, `ordered?` :95); "Run fights also pays for the pacing
  sim" holds: live.ts:214-220 runs `sim.ts` and `fight.ts` under one `Promise.all`, each with its own 90 s limit.

## Mutants

`bin/mutate_diff.sh origin/main` (30 min, exit 1): 37 mutants, 28 red-narrow, 1 red-narrow timeout, 3 survived,
5 TIMEBOX (Room.tsx:85 drop and `0->1`, :86 drop, mapedit.ts:246, :250; the handback covers these by hand).

- Generic.tsx:39 `6 -> 7` survived: equivalent. `a[7]` is `prevState`; `false` makes `state = {}`, so
  `canSanitize = shouldSanitize && deepEquals(rootSchema, state.schema)` (rjsf Form.js:321) is false as well.
  Deleting the line is red ('editing a status keeps its integer duration').
- Room.tsx:85 `> -> >=` and `&& -> ||` survived; the handback argues them equivalent, plausible, not
  proven here.
- Hand mutants: drop `!required.includes(k)` in `unlisted` (card.ts) red on 'an emptied optional list leaves the
  file'; drop `told.files?.forEach` (mapedit.ts:216) survived, finding 2.

## Findings

1. **should-fix**, kernel/ts/play/card.ts:249 with tools/author-panel/src/edit/blocks/Rules.tsx:53. Picking
   `permanent` for a status with `duration: 1800` makes `start` return undefined (no `cases` branch), `diff` emits a
   delete op on the required `duration`, and the compiler refuses the file: the card bar. card.test.ts:271 pins it
   (`start(duration, 1, 1800, defs) === undefined`). Fix: a `const` branch returns its `const`; a branch the card
   cannot build keeps `old`. origin/main did the same, but this PR rewrote `start` for untagged unions and the self-review
   filed it as open; it is not a nit.
2. **nit**, tools/author-panel/src/mapedit.ts:216. Dropping `told.files?.forEach(...)` keeps the .77 E2E green
   (survivor, below): every gesture reads the rooms it changes, so the line only matters for a file a `new` call made
   (mapedit.ts:147, :154): without it, the new room's or NPC's card offers no Undo of its creation. Untested.
3. **nit**, tools/author-panel/test/panel.test.ts:618. The hour test needs the NPC card test's hour 15
   (`'15 kind'`), so `--test-name-pattern` on it alone fails; the mutate rows for it depend on file order.
4. **nit**, kernel/ts/play/card.ts:242. A ref room switched to a key or to cases keeps only its key and loses its
   cartridge (card.test.ts:269 pins it); picking "room ref" changes nothing (keeps old). An author can see both.
5. **nit**, tools/author-panel/src/mapedit.ts:250. `newest` counts files a gesture only read: a card's Undo can
   take back a map gesture that did not write its file.

## .79, the limit

The limit fits the fights alone (46 s, about 2x headroom). Each Run fights click waits for the slower of the two
children, and the sim takes more than 300 s, so every click is killed at 90 s: the walk's 92 s. The cost to remove
is the sim on this route (a fights-only route), not a faster fight run. Question for the PM; not a blocker.

## .78 and the P2 PR

`git merge-tree` with `origin/fix/editor-walk-p2-2026-11-06` conflicts in Generic.tsx (three hunks: `useCard` split
into `useFile`/`useCard` beside `unlistedIn`; the `change`/`back` lines, where P2's `back` resets `latest`; the CardForm
wrapper, P2 `onBlur={() => setTimeout(card.commit)}` and `<Form key={rows}>` against this PR's onClick Remove commit and
`CardFormBase`), card.test.ts and panel.test.ts. mapedit.ts and mapwire.ts merge clean. Whoever merges second keeps
`CardFormBase` with P2's `key={rows}`, both handlers on the wrapper, and `unlistedIn` inside P2's `change`; P2's
module-level `undos` map then feeds Room.tsx:85 `Number(card.undo ?? 0)`.
