# Review: generated keys for New, names in Hierarchy rows

- PR: #694 `editor/auto-keys` (loka-wfrgk.101)
- Reviewed commit: `688f398cadd4b53c5bd73be80d9939b859791d11`
- Governing: [Author preview](../system/cartridge.md#author-preview); the brief and PM recommendation in
  `br show loka-wfrgk.101`; [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: authored none of the slice; detached review worktree
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (two runs)
- Verdict: **CHANGES REQUIRED**

## Must be true (written before the diff)

1. A generated key never names an existing definition, template or file, and no New writes into one or selects it as new.
2. Two New of one kind before the recompile get distinct keys.
3. The card bar offers only kinds the world's capabilities allow; a starter refusal still shows.
4. Row names come from the compile and are never written; a `~` or missing name shows the key alone.
5. The new card is selected; New room from here still asks the direction and links both ways.

## Checks that held

- `created` (mapwire.ts:31-41): a rerun on an existing file returns `files: []`, so it alerts and selects nothing.
- `made` on an existing key (scratch doors_sampler copy): a plain rerun of `new items item_1` writes nothing, so `made`
  throws `no items/item_1.json was made` (mapedit.ts:159); `--extends guard` on an existing NPC is refused. No clobber.
- Card bar: Room.tsx:52-57 `allowed(..., capabilities)` is unchanged; the palette's refusal alert stays (mapwire.ts:38).
- `names` (story_counts.ts:73) reads compiled `text` only; `~` filtered; `named` shows the key alone.
- Palette kind to graph kind: every NEW kind maps to its artifact.ex ref kind (cutscene to scene, areas to room).
- CI runs `tools/author-panel/test/*.test.ts` (ci.yml:241-243), so mapwire.test.ts is gated.
- Claim reruns: the mapwire.ts:39 cite matches the code; dropping `minted.add` (mapedit.ts:174) turns author_mapedit
  "two New item in a row ... item_1 then item_2" red (2 fail), restored green (22 pass).

## Mutants

`bin/mutate_diff.sh origin/main` at the head: 9 red-narrow, 14 SURVIVED, 2 NOT-UNIQUE. The handback (run on ca7fab391)
listed 6 BASELINE-RED (unrun) rows on App.tsx:293-294 and maptemplates.tsx:50; that does not hold at this head: App.tsx:293 is red-narrow, App.tsx:294
(3 rows, the rewritten `go` prompt line) and maptemplates.tsx:50 SURVIVED.
The 10 mapwire.ts SURVIVED rows are not selected by the sweep; five rerun by hand against `test/mapwire.test.ts`
(lines 33, 34, 40, 66, 77) all go red. maptemplates.tsx:50 has no importing test.

## Findings

1. **Blocker**, tools/author-panel/src/mapwire.ts:77-81 with mapedit.ts:147-152. New room from here keys from
   `shown.nodes` and the browser-only `minted`; neither holds a room whose file exists but is not in the last good
   compile (page reload while the compile is broken or held). `grow` checks only the source exit, and the starter
   merges into an existing file: scratch probe on a doors_sampler copy, `loka new rooms room_1 --from hut west`,
   then `loka new rooms room_1 --from lane up`, wrote `lane.exits.up` and `room_1.exits.down` into the old room_1
   with no refusal; the panel then selects the old card as new. Same precondition for New NPC/item here in an area
   room (mapwire.ts:66-71): with root `npcs/npc_1.json` absent from the graph, `new npcs npc_1 --area wing` wrote a
   second `areas/wing/npcs/npc_1.json`, a duplicate key. Breaks must-be-true 1 (the brief's "never collides").
   Fix: before `new`, `grow` and `made` refuse when a `<kind>/<key>.json` already exists anywhere in the cartridge, with a test.
2. **Should-fix**, tools/author-panel/src/maptemplates.tsx:50. The npc/item kind choice moved out of tested
   `freeKey` into a .tsx no test imports (mutant `===`->`!==` SURVIVED). Swapped, an NPC template's child skips item keys,
   takes an existing `<template>_1` NPC's key, and the starter refuses the drop (`--extends`: the file exists).
   Should-fix, not blocker: the failure is a loud refusal with no write. Fix: pass `t.dir` and map it in mapedit.ts where author_mapedit pins it.
3. **Nit**, tools/author-panel/src/App.tsx:293-294: the `.catch` alert on a thrown `created` and the rewritten `go`
   line are untested (3 SURVIVED rows on :294).
4. **Nit**, kernel/ts/test/author_mapedit.test.ts and test/mapwire.test.ts share module `minted` state, so a
   reordered or `--test-only` run can shift expected keys (disclosed in the PR).

## Deviations

- `~template` keyboard path removed: the brief keeps `~` only "where a prompt remains"; the map New has none. Accepted.
- New text/behaviours still prompt: no graph node holds their keys. Accepted; owner may revisit.
- `minted` client-only (mapedit.ts:167): accepted for created and made (the starter never rewrites their file); not for grow (finding 1).

## Re-check at 486a279f2157e6977b6f2cbe2f81971b6d0b8afc

Fix commits bf4316830, 0a6d0f0b3, 3ec31f232, 486a279f2 only. CI at head (`gh run list --commit`): ci success,
book-e2e success. Verdict: **APPROVE WITH NOTES**.

- Finding 1 (blocker): **resolved.** `newRefused` (kernel/ts/play/guard.ts:96-112), called from `create`
  (write.ts:180), refuses a `<dir>/<name>` that any file (`placed`, root or area) or area bundle (`bundled`) holds,
  compiled or not. Both probes are in the new author_mapedit test: `grow(b, 'south', 'room_9')` onto an uncompiled
  `rooms/room_9.json` is refused with both files unchanged; `made(c, 'npcs', 'npc_9')` with `c` in area yard is
  refused and writes no `areas/yard/npcs/npc_9.json`. Kind-to-folder: cutscene to `scenes/` and areas to `rooms/`
  plus the area's folder or bundle, matching Starters `dir_of` and the starter's area room. A key of another kind
  stays free (`made(start, 'items', 'npc_9')` passes), so no legitimate New is refused.
  Hand mutants against author_mapedit.test.ts, each red: drop the file check (2 fail), drop areas->rooms (1), drop
  cutscene->scenes (2), ignore the dir (1), drop the area-folder check (2). Baseline 23 pass.
- Finding 2: **resolved.** `childKey` (mapedit.ts:179) holds the npc/item mapping; swapping it turns the
  "dropped template's child" test red (1 fail).
- Nits 3 and 4 stand (not required).
- Out of scope: `bin/loka new` on the command line has the same gap (PM files it separately).
