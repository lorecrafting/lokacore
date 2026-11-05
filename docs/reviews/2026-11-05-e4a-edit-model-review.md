# Review: Editor E4a, edit model, schema walker, registry and strict gate (PR #642, loka-wfrgk.11)

- PR: [#642](https://github.com/lorecrafting/lokacore/pull/642), branch `editor/e4a-edit-model`
- Reviewed commit: `76f20e0198c1215c36e5a45090cc14080dfbe7ad`
- Governing: [gui-editor design §6, §7, §10, §11](../rnd/gui-editor-design-2026-11-04.md), [owner decision: authoring editor plan](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 76f20e01...`): ci success, graph-diff success, book-e2e success.
- `/code-review`: reported in the PR body (two passes).

## Verdict: APPROVE WITH NOTES

## Must be true (written before the diff)

1. The edit model is pure; apply then undo is byte-identical (`JSON.stringify(v, null, 2)`, key order, array slots) on the real cartridges.
2. `change` is all or nothing; `POST /change` writes nothing when any op is refused.
3. `write.ts` keeps E1's guards: `guarded`, `.json` only, `fresh` 409, serial `busy`, Hold untouched.
4. The gate lists every top-level field of every source kind plus every treatment; each needs three surfaces; generic equals the baseline; the baseline only shrinks against main; a stale, missing or escaping surface fails.
5. The walker claims by `$ref` and registry row and reaches `rooms/npcs/items.ambient`; its top-level fields are a subset of the gate's list (§11).
6. Expected values are independent of the code; each red control fails on its planted violation.

## Checks that held

- Focused run: 25 pass (PR body says 24). `npm run typecheck` clean. `mix test test/loka/red_controls_test.exs` 1 pass.
- Own red controls on the gate, in a throwaway worktree: a new `glow` on `source.RoomDefinition` and a new treatment `fever` each fail on create/edit/delete (exit 1); a planted main baseline lacking `rooms.name.edit` fails `not in main's baseline` (exit 1).
- Walker vs gate: all 147 top-level fields the walker claims (every kind, empty registry) are in the gate's 275 paths; `ambient` is reached for rooms, npcs and items (TextKey, Policy, DefinitionRef inside). Registry keys equal the gate's paths (the gate passes with no stale-path line).
- `write.ts:85-102`: only the apply loop changed; guards, `fresh`, `done`/`put` and `busy` are as on main. Atomicity holds because the doc is parsed fresh and written only after every op applied.
- Cites rerun: `edit_model.ts:24-25` and the 10 editor red controls (`elixir bin/red_controls.exs`: all ok) match the PR body.

## Mutants

`bin/mutate_diff.sh origin/main`: 62 mutants, 56 run, 56 red-narrow, 6 NOT-UNIQUE, 0 survived, no TIMEBOX. Better than the handback's table (61 / 54 / 2 survived), which the last commit fixed.

Hand mutants, all red: `edit_model.ts:81-85` re-add `keep(last)` after the following keys (test 1 and 2 fail); `edit_model.ts:57` undo groups replayed forward (test 1 fails); `ui_schema.ts:34` skip `then`/`else` (tests 1 and 3 fail); `toolbox_page.exs:247` drop `Path.safe_relative` (control `escape` fails); `:278` swap the difference's arguments (`grown` fails); `:206` drop treatments from the path list (`treatment` fails).

## Findings

1. **Should-fix, carried to loka-wfrgk.12 as its first commit**, `bin/toolbox_page.exs:222-224`. A failed `git show origin/main:<baseline>` yields `nil` and skips shrink-only. Confirmed: in the review worktree, where main lacks the file, `--check` with no argv 6 passes any baseline (exit 0). Acceptable only for this bootstrap PR, whose baseline is every path generic (825 = 275 x 3). Once merged, the `_ ->` branch must raise.
2. **Should-fix, carried to E4b as a named requirement**, `kernel/ts/play/ui_schema.ts:57-58`. A registry row whose path has no field (`layout`, `scenes`, `outline`, `cartridge`, `text`) is dropped (`field` is undefined), so a hand-built card for a root-level kind is never drawn.
3. **Should-fix, carried to E4b**, `ui_schema.ts:26`. A `$ref` seen once returns `{}`, so claims inside a recursive definition at depth 2 are lost (the test pins `out.kids === undefined`). E4b must show that no real kind loses a widget this way, or expand one level.
4. **Should-fix, carried to E4b (doc)**, deviation from §6: the modules live in `kernel/ts/play/`, not `tools/author-panel/src/edit/`. Accepted because the owner decision requires node:test cases and the panel has no runner; §6 needs a one-line amendment. The §7 check 3 Editor column is also not built: carried to E4b, which reads the registry anyway.
5. **Carried to E4b/E6 as named requirements**: treatment rows are never drawn (`uiSchema` has no treatment branch); `ui:field` holds a file name, rjsf's `fields` map must resolve it; rjsf honouring `ui:title` inside `anyOf` is unverified.
6. Nit, `kernel/ts/play/write.ts:99`. The comment says apply throws only `Refused`; `structuredClone` can throw on a non-JSON value. Unreachable from a JSON body; the 400 is still right.
7. Nit, `kernel/ts/play/edit_validator.ts:17`. `valid('defs', anything)` is `[]` (the defs file's root has no constraints). Nothing calls it yet; E4b wires the validator and should refuse `defs`.
8. Nit, `bin/toolbox_page.exs:248`. `File.regular?` follows a symlink, so `edit/X.tsx -> ../../App.tsx` passes `surface?`. Author-side.
9. Nit, `ui_schema.ts:36`. A node with both `anyOf` and `oneOf` loses the `oneOf`. No real schema has one. Author-side.

Disputed items, settled: `partial.X` first-wins is equivalent for every real kind (the partial and the full definition share the same `$ref`s); the catch-all 400 at `write.ts:99` stands (nit 6).

## Items for loka-wfrgk.12 (E4b)

Findings 1, 2, 3, 4 (doc amendment and Editor column), 5, 7.
