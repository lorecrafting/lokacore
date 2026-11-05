# Review: editor world picker and New world (loka-vduxr.65)

- PR: #640 `editor/world-picker`
- Reviewed commit: `13dbda83b640deddf095d8535c4d86b178ac1732` (base main `0a8889a75`)
- Governing: [cartridge.md#author-preview](../system/cartridge.md#author-preview) (`GET/POST /world`, Host/Origin
  guard, `.tmp`+rename writes), [WORKFLOW review stance](../WORKFLOW.md#review-stance),
  [editor chrome rulings](../design/editor-chrome-rulings.md) (32 px toolbar, 28 px rows, Esc closes a popover),
  [designer record](../decisions/owner-decision-designer-opus-2026-10-21.md)
- Independence: Fable, authored none of the slice; detached worktrees `review-640` (mutants) and `review-640-b`
  (own author stack on ports 29006/29008/29009, real Chrome via Playwright `channel: 'chrome'`)
- CI at head (`gh run list --commit`): ci success, book-e2e success
- Developer's `/code-review medium`: reported in the PR body (six findings fixed)
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. No write, undo, Hold, `/new` or compile reaches the old cartridge or anything outside `cartridges/` after a switch.
2. A New world name cannot traverse (`..`, `/`, encoded, case, symlink, an existing file); a copy follows no symlink.
3. `foreign()` (Host/Origin) runs before `/world`; a switch is refused while a write or `/new` is in flight.
4. The blank world compiles clean; nothing of this lands in a player build.
5. Tests pin behavior with independent expected values; mutants on the new logic die.

## Checks that held

- Trust boundary: `NAME` regex (`worlds.ts:12`) and `sibling()` refuse `../x`, `a/b`, `A`, `%2e%2e`, `rv%5Fblank` (400);
  `real()` is `lstat` so a planted symlink sibling or a file is 404/409; `RV_BLANK` on macOS is 409. `--from` outside
  the listed siblings is 400. The copy (`copy.ex`) `lstat!`s every entry (a link raises), skips `checkpoints`, refuses
  an existing target. All folders I made landed only under `review-640-b/cartridges/` (`git status`).
- In flight: `t.busy` stays raised after the 200, so a second `POST /world` and `POST /change` are 409 and `seen()`
  is silent; `leave` fires on `finish` with `realpathSync(source)`; `foreign()` precedes `editor.route`. During a live
  switch the second POST and a `/change` got "fetch failed" (server already gone), nothing landed.
- Player build: nothing under `mobile/app` imports `kernel/ts/play`; the panel is `?dev=1` only.
- Chrome walk: picker opens (list, Title + id, New world form with blank/copy select); switch to `hello_sampler`;
  blank `rv_blank` compiled, lint clean; copy `rv_copy` of `rooms_sampler` created; browser pattern refuses the bad
  names, server 409 "rooms_sampler exists". Wording and sizes match the chrome rulings (28 px rows, Esc closes).
- PR-body claims rerun: `editing.ts:73` `realpathSync(source)` → `source` and `author.ts` dropping
  `writeFileSync(remembered, …)` both fail `world_picker.test.ts`.
- `sh bin/author_red_controls.sh` passes (two-argument usage, watcher dies, stale artifact).

## Mutants

`bin/mutate_diff.sh origin/main`: 66 mutants, 13 run, exit 1. editing.ts:73 ×4, write.ts:212 ×2, loka.new.ex:82
red-narrow; copy.ex:18/20/32/43/52/53 reported SURVIVED, but a hand rerun with `bin/mutate.sh` against
`test/loka/content_starters_copy_test.exs` kills all six (the tool's xref mapping, not a gap). 53 NO-TESTS
(`author.ts`, `worlds.ts`, `world.tsx`: the test spawns the server instead of importing). Own narrow mutants, all
red against `world_picker.test.ts`: `real()` without the `cartridge.json` check; the final `t.busy++` deleted;
`make !== true` → `make === undefined`.

## Findings

- **Should-fix** `lib/loka/content/starters/copy.ex:43` (also `:26-36`): only the top-level `"id"` is rewritten;
  long-form refs `"cartridge_id": "rooms_sampler"` in `cartridge.json` `entry` (line 23) and `rooms/*.json` exits
  keep the source id. New world → copy of `rooms_sampler` (the default world `bin/author.sh` opens) comes up
  "not compiled" with five `Nothing defines the room …` errors (`mix loka.compile cartridges/rv_copy …`). 1 of 110
  cartridges uses the long form today; the Elixir fixture has no `cartridge_id`, so the test misses it. Rewrite
  `"cartridge_id": "<from>"` in every copied file (or refuse a source that holds it) and add that line to the fixture.
- Nit `kernel/ts/play/live.ts` checkpoint PUT routes do not consult `busy`: a Hold checkpoint in the
  finish→exit window lands in the old cartridge's `checkpoints/` (inside `cartridges/`, so not a boundary breach).
- Nit `kernel/ts/play/editing.ts:74` `'finish'` not `'close'`: a client that disconnects before the 200 flushes
  leaves `busy` raised with no restart; the owner reloads the tab.
- Nit `docs/guides/writing-the-game.md` says `[a-z0-9_]+`; `worlds.ts` and the panel use `[a-z][a-z0-9_]{0,63}`,
  `mix loka.new` caps at 32. Pick one and state it.
- Nit `kernel/ts/play/worlds.ts` lists the frozen `lantern_proof` as a switch target and copy source.
- Toolbox nit `bin/mutate_diff.sh:104-124` reports false SURVIVED for `copy.ex` (narrow command maps to no test).

Developer's open items: (1) `author.ts:56` old world shown after a failed first compile: nit, consistent with
"a failed compile keeps the last good artifact"; the header already shows the new title. (2) `bin/loka:18` no
`exec`: not a finding, the 75 loop needs the shell. (3) `world.tsx:16` untested: accept, the panel has no runner
(precedent in earlier panel slices).

No blocker: nothing writes outside the chosen cartridge.
