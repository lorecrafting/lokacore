# B3 inherited Credo cleanup review

Local draft branch: `tooling/b3-credo-cleanup`. Reviewed source head:
`0e0a0105f19ee60196de5aacd183a09d0d75a8b9`; base `1ecf0ce2`.

## Requirements derived before the diff

- Preserve the shop compiler/loader contract: reject invalid prices, duplicate or absent/non-owner offers, and missing participating balance declarations ([shelf](../system/cartridge.md#pegs-b3-shelf)).
- Preserve compiler failure accumulation, artifact results and deterministic diagnostics ([compiler](../system/cartridge.md#compiler)). Preserve existing stage and raw diagnostic ordering through this behavior-preserving refactor.
- Clear inherited Credo complexity without changing public API, mechanics, fixtures or adding machinery ([checks](../CHECKS.md)).

## Verdict and proof

**APPROVE.** No findings; no open items. Independent reviewer authored none of the source change.

- The extracted API/funding helpers preserve the original predicates, nil/invalid fallback and short-circuit evaluation. `Enum.concat/1` keeps every check group in the original order; no check, diagnostic, fixture or public API was changed.
- `mise exec -- mix credo --strict`: exit 0, no issues. `mise exec -- mix test --force test/loka/content_test.exs test/loka/content_sampler_test.exs test/loka/content_missing_child_test.exs`: exit 0, 29 passed. Existing tests use literal diagnostics and independently pinned artifact answers; no tests were added or weakened.
- Independent transient probes: 15 shop cases passed against literal diagnostic-code lists, including nil manifest, absent shop, absent/unknown/invalid resource, zero versus missing/nil funding, nonzero gain/regen, old/current API, missing stock and simultaneous errors in original order. Twelve raw compiler comparisons to the base matched across three cartridges and missing/invalid/null manifests, including compiled cartridge structure and unsorted diagnostic order. These comparisons supplement the literal cases and existing known answers.
- Two in-memory source mutations in the detached review worktree, never written to tracked source or committed: omitting explicit funding validation fails the existing shop test (3/4 pass; exit 2); dropping `Checks.check` from the compiler fails seven existing content tests (16/23 pass; exit 2). Reloading exact source requires no mtime cache. The unmutated forced run is green and both source files remain byte-identical to the reviewed head.
- Ponytail Review: **Lean already. Ship.** Small private extractions and an existing standard-library concatenation; no new dependency or abstraction layer.

Local focused proof only; accumulated publication checks and hosted CI remain the PM's publication gate.
