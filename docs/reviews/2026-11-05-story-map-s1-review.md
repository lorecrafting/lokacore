# Review: Story map S1, the story model (PR #620, loka-wfrgk.18)

- PR: [#620](https://github.com/lorecrafting/lokacore/pull/620), branch `editor/story-map-s1`
- Reviewed commit: `74472199a154db9577f0ae2548d59e615f8f2188`
- Governing: [story-map design §4, §5c, §11 row S1](../rnd/story-map-design-2026-11-05.md), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 74472199a...`): ci success, book-e2e success, graph-diff success.
- `/code-review`: reported in the PR body.
- PM rulings accepted, not raised: (a) a beat with diagnostics stays `built`; (b) the CLI carries no diagnostics; (c) the skip lives in `SourceFiles.paths` and the schema in its own module.

## Must be true (written before the diff)

1. Edges: `then` and `then_failed` (not `end`) and `choice_resolved` targets; statuses follow §5c: `missing` when a beat binds no node or an unknown node, `~` when a bound node has a todo, `unreached` only when every bound node is unreached, otherwise `built`.
2. The compiler ignores `outline.json`: the artifact is byte-identical with or without it, valid or not.
3. Bad outline JSON is a watcher refusal carried in the model, never a compile error.
4. GET /story is read-only, behind E1's Host check, and leaks nothing cross-origin (same posture as GET /source).
5. The ETag changes when the body changes; 304 on a match.
6. `bin/loka story`: exit 2 on usage, 1 on a compile failure, 0 with JSON.

## Checks that held

- Byte identity: `test/loka/content_test.exs:94` asserts the frozen `@hello_artifact` with a valid outline and with `{not json`.
- Cross-origin probe (served `scene_sampler`, `Origin: http://evil.example`): `/story` 200 with no `access-control-*` header; `/story?callback=x` 404; `/source` has the same headers. No leak.
- ETag is the sha256 of the body, not the artifact hash in §11. This is justified, since an outline edit changes the body but not the artifact.
- `bin/loka story` exits 0 on every `cartridges/*/` given as an absolute path.
- Cites rerun: `live.ts:267` and `content_test.exs:94` match the PR body.

## Mutants

`bin/mutate_diff.sh origin/main`: 66 mutants, 63 run; 62 red-narrow, 1 red-narrow timeout. NO-TESTS: `outline_schema.ex:9,16,36`, which the handback clears with hand mutants. No TIMEBOX rows. This matches the handback.

These hand mutants SURVIVED: `story.test.ts` and `live.test.ts` stay green.

## Findings

1. **Blocker**, `kernel/ts/play/story.ts:177`. Deleting `!nodes.length ||` survives. A beat written outline-first with `nodes: []` would then read `unreached` (`every([])` is true) instead of `missing` (§5c). Add a fixture beat with no nodes.
2. **Blocker**, `kernel/ts/play/story.ts:181`. Changing `every` to `some` survives. A beat with one reached node and one unreached node would read `unreached`; §5c says "every bound node". Add a mixed beat.
3. **Blocker**, `kernel/ts/play/live.ts:267`. Passing `[]` instead of `last.diagnostics` survives. GET /story would then serve no diagnostics by node, which S2's badge relies on (ruling a). Assert a diagnostic in the route test.
4. **Should-fix**, `kernel/ts/play/story.ts:233`. `compiled(source)` gets no `resolve()`, unlike `check.ts:81` and `sim.ts:174`. `cd cartridges && ../bin/loka story scene_sampler` exits 1 with "scene_sampler is not a directory", because mix runs from the repo root.
5. Nit, `kernel/ts/play/live.ts:260`. `stale()` fires on every push (diagnostics, publish, lint), so the model rebuilds up to about three times per compile, not once. The output is still correct because of the body ETag.
6. Nit, `kernel/ts/play/story.ts:63` and `:150`. `in d.choices` matches prototype keys: a `choice_resolved` on `constructor` draws a false edge. This is author-side.
7. Nit, `kernel/ts/play/story.ts:125` (via `add` at :96). A diagnostic whose file maps to no node (a root file) is dropped from the model.
8. Nit, `kernel/ts/play/story.ts:27`. `isOutline` accepts shapes the schema rejects (extra keys).
9. Question, `kernel/ts/play/live.ts:260`. During a Hold, the model pairs the held artifact with live todo, outline and diagnostics. §7 says "Hold keeps the last model". Is that intended for S1?

## Verdict

CHANGES REQUIRED: findings 1 to 3 (surviving mutants on the §5c status rules and on the diagnostics feed), and 4.

## Re-check at `bc8f06b9fab8b9dd003fd3a5da6ff8bc2c6b8a0f`

Fix commits 47d2e64b9, 59a97678d and bc8f06b9f. CI at that head (`gh run list --commit bc8f06b9f...`): ci success, book-e2e success, graph-diff success.

The spec check: §5c (design doc line 269-270) says unreached means "every bound node is in `reachReport.unreachable`". So a beat with one reached node and one unreached node is `built`, which the fix pins.

Each mutant below was run against `story.test.ts`, `live.test.ts` and `write.test.ts`, and each one was RED:

| Finding | Mutant | Result |
|---|---|---|
| 1 | drop `!nodes.length \|\|` (story.ts status) | 1 fail |
| 2 | `every` to `some` | 1 fail |
| 3 | `/story` gets `[]` instead of `last.diagnostics` (live.ts:269) | 1 fail |
| 4 | `compiled(source)` without `absolute()` | 1 fail |
| Q9 | delete the `if (last.held) map.keep(...)` branch | 1 fail |
| Q9 | a release (`held` push) does not mark the model stale | 1 fail |
| Q9 | `keep` with no `existsSync(artifact)` guard | 1 fail (write.test ENOENT) |
| Q9 | `build` ignores the kept model | 2 fail |

Attempts to break the Hold snapshot, all of which held:
- A Hold during a compile cannot interleave. In `author.ts` `build()`, the diagnostics push and `publish()` run synchronously after `spawnSync`, so the Hold request is handled only after the compile's pushes have marked the model stale. `keep` then builds the model from the artifact on disk, which is the newest one unless the build was parked.
- A compile during a Hold, whether parked or failed, pushes while `last.held` is set. `keep` then returns the existing model, so the new diagnostics wait for the release.
- A release with nothing changed: the `held:false` push marks the model stale, and the rebuild gives the same body, so the same ETag and a 304.
- A Hold with no artifact yet keeps no model. A GET then reads the missing file and gets a 500, as it did before the fix.

Finding 5 (rebuild on every push): fixed, since `stale()` now fires only on compile, diagnostics or held pushes. Nits 6 to 8 are open, as nits.

Verdict after re-check: APPROVE WITH NOTES (nits 6 to 8).
