# Review: one cartridge format, drop v1 and `Topics.grants/2` (PR #635, loka-9x5y, loka-1b68q)

- PR: [#635](https://github.com/lorecrafting/lokacore/pull/635), branch `cleanup/compiler-simplify`
- Reviewed commit: `7d16589ece9e72a6a677bd594f2deb7a71c3e537` (merge-base `ffaef2766c`)
- Governing: [AGENTS.md Specification](../../AGENTS.md#specification-source-of-truth) (amend `docs/system` in the same PR), [cartridge.md](../system/cartridge.md) (format, `kernel_api` bump rule), [contract lessons](../lessons/contracts.md) (a fixture per `required`), [CHECKS.md `pm_merge`](../CHECKS.md) (a `kernel_api` change needs a review record), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 7d16589ec...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body.
- Verdict: **APPROVE WITH NOTES**. `kernel_api` 1.157 → 1.158 is warranted (the `CompiledCartridge` contract loses its v1 branch) and this record is the one `pm_merge` requires.

## Must be true (written before the diff)

1. `docs/system/cartridge.md` no longer describes v1 as a form the compiler emits.
2. `CompiledCartridge` is one object; every `required` property has an `invalid.json` case that fails when the property is dropped; `contracts.gen` is idempotent.
3. Every remaining cartridge compiles byte-identical at base and head (109 cartridges, 218 files).
4. Tests moved off `hello_sampler` keep the break they name.
5. `Topics.grants/2` duplicated `LeafRefs.steps` (`topic.grant` → topic) exactly, and `content_asks_test.exs:28` fails without the surviving check.
6. `cartridge_barriers.ts:34` keeps the `c.entry ?` guard (a cartridge built without an entry in `content_graph.test.ts`).
7. Nothing live names `loka-cartridge-v1` or `hello_sampler`.

## Checks that held

- Schema: the new `CompiledCartridge` equals the old v2 `oneOf` branch (same `required`, same property keys, `additionalProperties: false`); the loader rejects v1 with `UNKNOWN_FORMAT` (`kernel/ts/src/content/cartridge.ts:35`). `kernel/ts/src/runtime/world.ts:110` is `1.158`; every cartridge's `at_least` ≤ 1.157, `below` 2.0, so all stay installable.
- Byte identity reproduced: `mix loka.compile --allow-placeholders --json` over `cartridges/*/` at base (220 files) and head (218 files, 109 artifacts); `diff -rq` lists only `hello_sampler.artifact.json` and `hello_sampler.diags.json`, before-only.
- `cartridge_loader.json`: the cases carrying a hash now carry the `harvest_sampler_hash.json` sha; `cartridge_hash.json` has no consumer outside `docs/briefs` history.
- Barriers guard: `git diff 0ebcaa6b6 7d16589ec` is that one line; the final state equals `origin/main`.
- Grants redundancy: `LeafRefs.steps/0` (`leaf_refs.ex:35`) is merged into `Resolve.@ref_fields` and applied by `Steps`; the duplicate diagnostic was hidden by `Loka.Content.sorted/1`'s `Enum.uniq`. Red control: deleting `leaf_refs.ex:35` makes `content_asks_test.exs:28` fail, and the compile then *succeeds* with `topic: "nope"`, so `LeafRefs` is the sole remaining check.
- Old names: only `docs/features.json:466` and `docs/TOOLBOX.gen.md:49` ("since hello_sampler was retired") and the schema description's "v1 retired" sentence remain; all intended.

## Mutants

`bin/mutate_diff.sh origin/main` (own worktree at head): 9 mutants, 5 run: BASELINE-RED 2 (`cartridge.ts:35`), red-narrow 4 (`compiler.ex:62,62,94,126`), NO-TESTS 2 (`alternates.ex:16`, `trails.ex:84`), SURVIVED 1 (`population.ex:69`, a test-selection artifact). The PR body's table (NO-TESTS 7) differs in row classes but every row is red by hand; rerun here:

- `cartridge.ts:35` `!==` → `===`: `test/cartridge.test.ts` red.
- `population.ex:69` `elem(v2, 1)` → `elem(v2, 2)`: `content_deer_test.exs` 0/5 (ArgumentError in `Compiler.checks/5`).
- `alternates.ex:16` same mutant: `content_alternates_test.exs` 0/3. `trails.ex:84` same: `content_tracks_test.exs` 0/2.
- Contract sweep: `entry` removed from `CompiledCartridge.required`: `test/loka/core/contracts_test.exs` "invalid fixtures fail with exactly the listed errors" red.

## Findings

1. **Should-fix**, `docs/system/cartridge.md:33` and `:551`. The spec still says "v1 (manifest, facts, actions) is the R4 form" and "`UNKNOWN_FORMAT`: v1 or v2"; the PR changes no `docs/system` file, against AGENTS.md "amend `docs/system` before code, in one PR". Scenario: an author following the spec writes a roomless manifest-facts-actions cartridge and gets `SCHEMA_VIOLATION cartridge.entry missing_property` (`content_rooms_test.exs:194`) that the spec does not predict. Two sentences, no logic: a [small should-fix](../WORKFLOW.md#small-should-fix).
2. Nit, `docs/HANDOFF.md:7`: "`kernel_api` is 1.157" (PM-owned present-state line; update at merge).
3. Nit, PR body mutant table: row classes do not match a rerun at head (see Mutants); the claim that every row is red holds.

No blocker. Hand mutants in the review worktree were reverted (`git status` clean before this commit); the throwaway mutant worktree was removed.
