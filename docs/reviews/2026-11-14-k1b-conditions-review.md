# Review: K1b conditions as story nodes and the named leaf

Written 2026-11-14 19:05 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017 (role reviewer)

Head `1d9b1f9d2` on `story/k1b-conditions`, diffed against base `6db240794` (PR #730, loka-wfrgk.115.14).
Verdict: **CHANGES REQUIRED**. The direction, the ref shape and the picker gate are right; the
source walk has two holes in where a Policy can sit, and the picker's one-line wiring has no check
that can fail.

What must be true: (a) a `named` leaf is found at every source site a Policy may be written;
(b) each condition file is one node, one reader edge per naming pair, no edge to a node that does
not exist; (c) `from` is the naming definition, `to` the condition; (d) the synthetic ref satisfies
`DefinitionRefString` (`kernel/ts/play/reach.ts:30`) so `shell.ts:83`'s `fromRef` and `places()`
resolve it; (e) only the `named` branch's `key` field gets the condition picker; (f) each new test
fails on the break its header names.

Checked: `node --test kernel/ts/test/{conditions,condition_picker,story,card,ui_schema}.test.ts` —
38 passed. `bin/check_ts_size.mjs` on the five touched files — clean (both markers needed, both well
under 1.5x; no function limit raised). Mutants run by hand, each restored:
reader edge direction swapped → 3 red; edges dropped → 3 red; one node per use site → 3 red; the
`conditions/` folder skipped → 1 red; `isNamed` widened to any tagged branch → 1 red; the
`Rules.tsx` `isNamed` line deleted → **0 red** (finding 1).

1. **Blocker — the picker's wiring has no test that can fail.** Deleting
   `...(isNamed(branches[at]) && { key: { 'ui:field': 'ConditionKey' } })` (`tools/author-panel/src/edit/blocks/Rules.tsx:37`)
   leaves `ui_schema`, `card` and `condition_picker` all green (38 passed). The unit tests prove
   `isNamed` reads the tag const and `choices` filters on `kind`; nothing ties either to the branch
   form, so the slice's own third ruling (`docs/design/story-tooling.md` §2b K1, "the picker lists
   it") is untested, and a later edit putting the gate on the wrong branch is silent. Fix: export the
   branch uiSchema builder and assert in a `node:test` that the `named` branch's `key` is
   `{'ui:field': 'ConditionKey'}` while a `fact.adjust` branch has no `key` entry (a browser test is
   not needed for this).
2. **Major — reader edges are lost for an area bundle's member and for `cartridge.json`.**
   `conditionGraph` derives `from` through `placed(rel)` (`kernel/ts/play/conditions.ts:55-60`);
   `placed` returns undefined for `areas/<a>.json` (its `dir` is not in `dirs()`) and for a root file,
   so those files `continue` and their `named` leaves are invisible. Verified on a copy of
   `cartridges/speech_sampler` whose bundle reaction `miller_hears` takes `when: {op: named, key:
   trusts}`: `conditionGraph` returns `nodes: [condition/trusts], edges: []`, so the map answers "who
   reads this" with nobody. The same holds for the one Policy in a root file,
   `cartridge.json`'s `world.identity.name_variants[].when` (`schemas/source/defs.schema.json`
   `source.cartridge`). `story.ts` already computes the mapping (`bundled()`, `bundledRefs`); use it
   for a rel with no `placed()` owner.
3. **Major — an area-folder condition gets no node but still gets edges to itself.** The compiler
   accepts `areas/<a>/conditions/<key>.json` (`lib/loka/content/source.ex:255` classifies it
   `{:condition, key, []}`; the K1 record's finding 1 shows both folders reaching one map), but
   `CONDITION` (`conditions.ts:17`) anchors at `^conditions/`. Verified: a condition planted at
   `areas/ex/conditions/trusts.json` with a room naming it yields `nodes: [], edges: [{from:
   room/village_green, to: condition/trusts}]` — a dangling edge, and the key is not in the picker's
   list while the compile accepts it. Accept the folder form, or take the keys from the compiler's
   own classification.
4. **Major — the Flow map and the List draw no condition, and the Hierarchy's row is a dead end.**
   `flow.ts:26-33`'s `LANES` has no `condition` kind, so `layout()` drops both the node and its
   edges (`laneOf` undefined); `storylist.ts:56`'s `KINDS` excludes it, so the palette's `story:
   trusts` is a no-op (`reveal()` bails) and no `trace trusts` row is offered; and in the Hierarchy
   (`left.tsx:145`) the row's inspector has no card, because `story.files` holds no entry for a
   condition ref (`ownFiles` maps only artifact refs). The PR body discloses the Trace gap only. The
   §2b K1 ruling is "the Story map shows a condition as a node with its readers" — today that is the
   Hierarchy column alone. One lane entry plus a `KINDS` member, or a stated narrowing of the ruling.
5. **Minor — `conditions` in the `/story` payload is dead.** `story.ts:170` adds
   `conditions: conditions.nodes.map((n) => n.ref)`; no consumer reads it (the picker reads
   `context.nodes` filtered by kind, `storylist.ts:56`). Drop it, with its type addition.
6. **Minor — one `// Break:` names a mutant the fixture cannot produce.** The third test's header
   (`kernel/ts/test/conditions.test.ts:71-72`) claims a node synthesised per `named` leaf; `scene_sampler`
   has no `named` leaf, so per-leaf and per-site node mutants leave it green (verified). The test is
   not a change detector — it does kill "a node per file" — but its header misdescribes it; say that
   break, or plant a condition-less cartridge that names one.
7. **Nit — the `Rules` doc comment lost its function.** `Rules.tsx:27-32` describes `Rules` and now
   sits above `branchForm`; move it back onto `Rules`.
8. **Nit — the cartridge id comes from the first node.** `story.ts:147` derives it as
   `graph.nodes[0]?.ref.split(':')[0] ?? ''`; the artifact carries `manifest.id`/`manifest.version`
   (`kernel/ts/src/runtime/decision.ts:262` `refString` is the same join), and the `''` fallback
   yields `:condition/<k>`, which fails `DefinitionRefString`. Unreachable for a compilable cartridge
   (rooms are always nodes), so a robustness nit, not a defect.
9. **Nit — a reader edge would be drawn dashed and named "named".** `named` has no dot, so
   `flow.ts:39`'s `solid()` reads the edge as "depends on play", and `flowread.ts:70` would list the
   op string `named` in the hover's `depends`. Latent while finding 4 stands; worth settling with it.

Not findings. The reader-edge direction matches `reach.ts` (`from` the naming definition, `to` the
condition) and a chain shows, verified both ways. The synthetic ref is well formed
(`scene_sampler@0.0.1:condition/trusts`). `isNamed`'s tag-const rule keeps the gate on the single
`named` branch: no other `Policy` leaf has a `key` property in `defs.schema.json`, and `branchForm`
merges into one branch's uiSchema, so no sibling is touched. `held()` treats an unreadable condition
file as no leaves while the file still earns its node — the right call, since the compile reports it.
Duplicate `named` sites in one definition are two edges on one pair, which `trace()` collapses to one
row — no double count. The tests' expected refs are hand-written, not read back from the model.

CI at `1d9b1f9d2`: `ci`, `book-e2e` and `graph-diff` all completed successfully.

## RECHECK 2026-11-14 (fixes `1d9b1f9d2`, `ff5c0060b`)

Written 2026-11-14 19:27 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017

Verdict: **APPROVE**. Head `ff5c0060b`; nine findings, seven re-checked, all fixed.

| # | Finding | Disposition |
|---|---|---|
| 1 | Blocker: picker untested | Fixed. `branchForm` lives in `tools/author-panel/src/edit/blocks/branch_form.ts:6` and `test/rules.test.ts:5` imports it directly (no React render). Mutant I ran: replaced `isNamed(...)` with `true` → `only the named leaf keys on a condition` fails (`1d9b1f9d2`). |
| 2 | Major: bundle members had no `from` | Fixed. `todo.ts:23` `bundled()` maps `${section}/${key}` → `areas/<a>.json`; `conditions.ts:75-82` splits the key and pushes `refs.get(bundledKey)` over `value[section][member]`, so a member gets its own node ref as `from` (`kernel/ts/test/conditions.test.ts:98`). |
| 3 | Major: area-folder conditions | Fixed for discovery: `conditions.ts:16` `/^(?:areas\/[a-z0-9_]+\/)?conditions\/([a-z0-9_]+)\.json$/` yields the node (`test:82`). Residual nit, not re-opened as blocking: a key present both at `conditions/k.json` and `areas/a/conditions/k.json` produces the same node ref twice (probe: two `scene_sampler@0.0.1:condition/tide` entries); only reachable if the compiler accepts both, and no such cartridge exists. |
| 4 | Major: id source | Fixed. `story.ts:138-139` `cartridgeOf(c)` reads `c.manifest` → `<id>@<version>`; `conditions.ts:18` yields `<id>@<version>:condition/<key>`, the `DefinitionRefString` shape `reach.ts:30` and `shell.ts:80` `REF` accept, matching every other node ref. |
| 5 | Minor: Flow lane / depends | Fixed. `flow.ts:31` `condition` lane; `flowread.ts:71-73` maps a `named` edge to `key(e.to)` only when `fromRef(e.to)?.kind === 'condition'`; `fromRef` returns undefined on a non-matching ref, so no dereference of a missing node. |
| 6 | Minor: picker test | Fixed. `branch_form.ts:10-17` merges `...each[at]` then `key: {...each[at].key, 'ui:field': 'ConditionKey'}`, which is what `test:23-26` asserts. |
| 7 | Tests | Fixed. `npx tsx --test test/conditions.test.ts test/story.test.ts`: 22 tests, 22 pass, 0 fail; expected values are hand-counted literals. `test/rules.test.ts`: 2 pass. `sh bin/check_as_never.sh` exits 0. |

No `gh run list --commit ff5c0060b` runs at review time (branch not pushed).
