# Review: editor coverage A, CRUD matrix, card round-trip, route-caller tests

- PR: #684 `test/editor-coverage-a-2026-11-06` (loka-wfrgk.83)
- Reviewed commit: `2d7562db6d2e79f5de8e390edd988971b4758f17`
- Governing: [GUI editor design §4, §7](../rnd/gui-editor-design-2026-11-04.md),
  [AGENTS.md, Writing tests](../../AGENTS.md), [WORKFLOW review stance](../WORKFLOW.md#review-stance);
  author-error guards are nits
- Independence: authored none of the slice; detached review worktrees
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **CHANGES REQUIRED** (three should-fixes change test logic, so a fix round per [small should-fix](../WORKFLOW.md#small-should-fix))

## Must be true (written before the diff)

1. The kind list comes from `registry.json`; a new kind with no New goes red.
2. Every exemption and gap row is rerun, so a fixed gap goes red until its row is dropped.
3. Round-trip expected bytes are the files' own, read before the run, over every card file.
4. Server routes are read from source; each needs a client caller or a written reason.
5. Each new check fails on its planted violation.

## Checks that held

- Planted kind `widgets.size` in `registry.json`: red, `widgets create: not in new.json` (1).
- Typo `items.capacty` in a GAPS key: the rows test goes red. `ask('drop'` for `ask('delete'`: `POST /delete` uncalled.
  Both PR claims are backed (5).
- Round-trip bytes come from a tmp copy read before any write; `cards()` covers 2197 of 2199 JSON files (3).
- Edit gaps are rerun and go red with "drop its GAPS row" (`editor_crud.test.ts:166-183`).
- `bin/mutate_diff.sh origin/main`: 0 mutants (test-only diff), as the handback says.
- Narrow product mutants (run against the files that import the module):
  `card.ts:18` `constAsDefaults: 'always'`, red on `editor_roundtrip.test.ts` alone; `write.ts:135` delete
  journals `after: before`, red on `editor_crud.test.ts` alone (`bin/mutate.sh`, `red-narrow`).
  `card.ts:53` dropping number-only diffs survives `editor_roundtrip.test.ts` (finding 3); older suites catch it.
- CI cost: kernel job 542 s on this head against 264-452 s on 14 recent green runs; mobile runs in parallel
  (524 s), so wall clock grows about 18 s. The 900 s timeout leaves 358 s. PR lane is right; nightly would miss
  the regressions these tests exist for.
- Route scan (`editor_routes.test.ts:66-77`) misses a route written as a `switch` case, `Map` or array; the
  servers have no route table, so the scan of today's forms is accepted.
- Verb presence (a kind with no Delete) is already the §7 generator gate (`editor_generic_baseline.txt`).

## Findings

1. should-fix, `kernel/ts/test/editor_crud.test.ts:130,202`: create and delete GAPS rows are never rerun.
   Planted `'rooms delete'` and `'emotes create'` rows stayed green. A create gap also drops the kind from
   `made`, which hides its edit and delete runs. Scenario: loka-wfrgk.86 lands a palette New for `scenes`, the
   row stays, and scenes' edit and delete stay unchecked for good. Fix: a gapped create goes red when `new.json`
   offers it; a gapped delete is attempted and goes red when it succeeds.
2. should-fix, `kernel/ts/test/editor_crud.test.ts:161-183`: every kind is created before the edit pass, and `/new`
   locks each kind's capabilities in `cartridge.json` (`lib/loka/content/starters.ex:70-81`). So every
   capability-gated field compiles. With emotes not created, `items.ambient` and `rooms.ambient` went red
   (`needs capability emote`). Scenario: the loka-wfrgk.85 class, where a fresh cartridge's room card offers
   `ambient` and the compiler refuses it, while this test stays green. Fix: edit each kind in a cartridge holding
   only that kind's New, or record the gated fields as known.
3. should-fix, `kernel/ts/test/editor_roundtrip.test.ts:137,148`: an edit whose commit writes nothing is skipped,
   and the floor needs only 31 of 60 writes. Mutant `card.ts:53` (`|| typeof draft === 'number' ? []`) stays green
   on this file. Scenario: `diff` drops every number edit; the test's "a commit drops the edit" check stays silent.
   Fix: an edit whose ops are empty fails unless its leaf is a known refusal (or count skips per type).
4. nit, `kernel/ts/test/editor_roundtrip.test.ts:31-38`: area bundles (`areas/*.json`, here
   `speech_sampler/areas/village.json`) are not card files, so a bundle round-trip is not covered.
5. nit, `kernel/ts/test/editor_crud.test.ts:162`: `cartridge.*` and `layout.*` fields are never edited by the
   matrix (the round-trip test opens the root files for a no-change save and one-leaf edits, not add-menu values).
6. nit, `kernel/ts/test/editor_routes.test.ts:112-114`: a `fetch` whose `method` is not a literal counts as GET.
   That fails loudly except on routes that also answer GET (`/world`, `/checkpoints/*`), where a dropped POST
   or PUT caller would pass.

## Questions

- `editor_routes.test.ts:13-38`: the methods in `ROUTES` are hand-written and not checked against the servers.

## Fix round: `2d7562db6..9135d71ba`

- Reviewed commit: `9135d71ba9c7c02d0377541f061167a90ab92680` (one commit, test files only). CI at head: ci success, book-e2e success,
  graph-diff success.
- Verdict: **APPROVE**
- 1, fixed (`editor_crud.test.ts:188,256`): planted `'emotes create'` and `'rooms delete'` rows now go
  red with "works now, stale gap: drop its GAPS row".
- 2, fixed (`editor_crud.test.ts:200-201`): each kind is edited in a fresh copy of the scaffold. With the
  `items.ambient` row dropped, it goes red with "needs a capability ... (`emote`)".
- 3, fixed (`editor_roundtrip.test.ts:143,156`): the `card.ts:53` number-drop mutant goes red on this
  file alone ("a commit dropped these edits").
- 4, fixed: `cards()` uses guard.ts `rootFile`, which includes `areas/*.json`.
- 6, fixed (`editor_routes.test.ts:110-138`): a planted `fetch('/__author/world', { method: verb })` goes red
  with "fetch calls with a method this scan cannot read", and `uncalled` stays empty.
- New gap rows (8 × loka-wfrgk.85 capability fields; `items delete` and the other loka-wfrgk.87 deletes): each is
  rerun and goes red once it works (control above), so they cannot go stale. At head, all of them still fail.
- CI cost: the kernel job took 459 s at `9135d71ba` (900 s timeout, 441 s headroom); mobile (498 s) is the
  critical path. Locally the CRUD file takes 245 s. Keep the tests in the PR lane; nightly would let an editor
  regression merge.
