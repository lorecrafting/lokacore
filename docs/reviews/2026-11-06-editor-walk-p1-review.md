# Review: editor walk P1, dev save survives edits, palette New for every kind, Delete refused while named

- PR: #682 `fix/editor-walk-p1-2026-11-06` (loka-wfrgk.58, .59, .60; Delete for definitions)
- Reviewed commit: `b9cf33995b5fbf7408997632803a0ae5462870a1`
- Governing: [cartridge.md Author preview](../system/cartridge.md#author-preview) (save per kernel_api, one path
  guard, delete goes with the layout row), [save.md Opening a story](../system/save.md#opening-a-story) (a pin
  mismatch is refused, nothing written or deleted), [WORKFLOW review stance](../WORKFLOW.md#review-stance);
  author-error guards are nits
- Independence: authored none of the slice; detached review worktree
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. A release or test build never takes the dev path: `pinned_release_missing` stays a refusal with nothing written
   or deleted; the dev file name is distinct from `loka-showcase.db`.
2. The dev "start over" is a renewal of the one dev save, declared in the spec, and a failed start-over reaches the author.
3. `/delete` goes through the one path guard, takes a room's layout row with it, refuses a root file and refuses
   while another definition names the key.
4. Every starter kind the palette offers compiles as created; the palette offers exactly the starters.
5. Tests take expected values independent of the code under test.

## Checks that held

- Item 1: `devCartridge` is set only by metro.config.js under `LOKA_DEV_CARTRIDGE`, release throws; App.tsx:59 names
  `loka-dev[-frozen]-<kernel_api>.db`; dev-save.test.ts asserts the release load answers `pinned_release_missing` and
  fails on any `deleteDatabaseSync`.
- Item 2: cartridge.md:897-905 amended in the slice; App.tsx:245 drops `startOver()`'s return, but with no game the
  failure lands in `failed()` and the failed screen (session.ts:262-300), so it is not silent. The Place replay
  note is the only sign of the renewal; the spec says "without asking".
- Item 3: write.ts:109 `guarded(...)`; :112 refuses root files and `areas/<a>.json`, so a text key's Delete is a 400,
  not the file; :137-143 keeps the layout-row removal; `users()` finds refs by kind: probed facts, resources, npcs,
  rooms, `dialogues/wat_letter` (story_points/letter_fate) on the showcase artifact.
- Item 4: content_starters_test.exs pins new.json to `Starters.kinds() -- ["cartridge"]`, and the compile-every-starter
  test holds; starters add the capabilities they need (starters.ex:70-81), so nothing offered is refused.
- Item 5: find.test.ts and write.test.ts expectations are hand literals; panel.test.ts stubs the server (400) and
  hashes the fixture file itself; dev-save.test.ts asserts names and kinds, no computed expectations.
- Claim reruns: `node --test tools/author-panel/test/panel.test.ts` pass 20 (PR body); write.ts:114 and :128
  `400 -> 401` red by hand (PR body's hand table) — see Mutants.

## Mutants

`bin/mutate_diff.sh origin/main` at head: 47 mutants, 37 run, red-narrow 31, SURVIVED 6, NO-TESTS 10, no TIMEBOX.
Fewer survivors than the PR body's table (taken at 3663973b2): the E2E New/Delete test added since covers
tools/author-panel/src/App.tsx:290-296 and the write.ts 400 rows.

| row | where | mutant | disposition |
|---|---|---|---|
| SURVIVED | tools/author-panel/src/App.tsx:294 `===->!==` (x2) | `go` branch of the New prompt | equivalent under the stub: both branches send one `/__author/new`; not a gap |
| SURVIVED | tools/author-panel/src/author.ts:17 drop `!file` | author-side guard (no file selected) | nit, author error |
| SURVIVED | author.ts:21 drop `!sha256`, :25 `&&->\|\|`, :27 `===->!==` | narrow cmd runs find/write unit tests, not the E2E | PR hand table claims red against panel.test.ts; author.ts:21 rerun by hand with `--test-name-pattern='palette New'`: red-narrow |
| NO-TESTS | mobile/app/App.tsx:244 (x3), mobile/app/author/panel.tsx:82, :90 (x3), :95 (x3) | RN render lines | `mutate-covers: src` E2E and dev-save.test.ts cover the save path; render lines stay uncovered (accepted, no RN test harness) |

Hand mutants (`bin/mutate.sh`, narrow cmd = find/write unit tests):

| mutant | result |
|---|---|
| write.ts:114 `refuse(400` -> `refuse(401` | red-narrow (PR claim confirmed) |
| write.ts:131 drop `delete doc[section][key]` | red-narrow |
| write.ts:105 `ROWS` drop `'attributes'` | SURVIVED: no test deletes an attribute row (nit below) |
| find.ts `own` `endsWith` -> `\|\| includes` | SURVIVED, equivalent on the fixture (keys are terminal) |

## Findings

1. **Should-fix** `kernel/ts/play/find.ts:91-97` via `write.ts:116`: a `.scene` dialogue under `scenes/`
   (`bin/loka new scene` writes `scenes/<key>.scene`, source.ex:243 lowers it to `dialogues`) reaches `users()` with
   `section = 'scenes'`; `c.scenes` holds cutscenes, so `own` is undefined, `kind` undefined, and every referrer
   is dropped. Scenario: a story point's `then` (or an NPC's `dialogues`) names `dialogues/<key>`; palette Delete on
   the scene passes, the next compile refuses the dangling ref, Undo restores. Fix: look the key up in `dialogues`
   when the file's ext is `.scene` (the artifact kind, not the directory).
2. **Nit** `find.ts:79-86`: the `extends` scan reads only `<section>/*.json`; an area bundle extending the key
   (`areas/<a>/<section>.json` or a bundle row) is not seen. Author-side; the compile reports it.
3. **Nit** `mobile/app/App.tsx:59`: the removed "clear site data" hint. Pre-slice dev saves
   `loka-dev-frozen-<api>-<hash16>.db` stay in the OPFS six-file pool until one clear; with the pool full the
   first new-name open fails once. Say so in the PR body or the author guide, no code needed.
4. **Nit** `tools/author-panel/src/App.tsx:293`: the prompt reads "New rooms key" (the kind is the plural
   section). Editor chrome; the owner writes player-facing words only, but "New room" reads better.
5. **Nit** `kernel/ts/play/write.test.ts`: no case deletes an `attributes` row, so `ROWS` minus `'attributes'`
   survives; and `author.ts:17` (`!file`) is uncovered. One row-delete case closes the first.

## Disposition

APPROVE WITH NOTES. Finding 1 is a real data-path gap (Delete passes, compile refuses) but Undo recovers it and
the compile names the ref, so it is a fix round item or a follow-up Beads issue at the PM's call, not a blocker.
Nits are optional. No contract (save, protocol, kernel) is changed against its spec; the release path keeps
`pinned_release_missing` with nothing written or deleted.
