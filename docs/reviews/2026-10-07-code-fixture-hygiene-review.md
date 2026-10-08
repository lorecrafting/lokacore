# Review: code and fixture hygiene (PR #306)

- PR: #306, branch `chore/code-fixture-hygiene`, head `586c1287`, base `294062aa`.
- Reviewer: independent (Opus); authored none of it.
- Governing: [AGENTS.md "Writing tests"](../../AGENTS.md#writing-tests-every-change-every-agent),
  [contracts lessons](../lessons/contracts.md), [cartridge.md B4](../system/cartridge.md#b4-well-and-fuel)
  (successor pins kept as frozen answers), owner decision on forward development (fixture prune approved),
  audit findings F1, F2, F5, F6 (transcripts), F7, F8, F12.
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. No deleted fixture is read by a test, script, generator input, CI job, doc link or transcript pin.
2. `docs/features.json` and `protocol/README.md` name existing v042 fixtures; `features.gen.md` is generator output.
3. TypeScript brands and Elixir tag constructors are the same set before and after; `contracts.gen.ts` unchanged.
4. Every transcript still replays byte for byte; a transcript with no known answer fails, not skips.
5. Each converted content case still compiles its own mutation on a clean source; original red controls stay red.
6. F12 symbols have no caller outside their file or module.

## Evidence

- (1) `git grep` of every deleted basename: no reader. Only hits are `generate_missing_child_v019.py:50` and
  `v020.py:68`, which *write* the deleted ids files (outputs, not inputs). No dynamic name construction in
  `.ts/.ex/.exs/.py/bin/.github`. All 26 transcript pins resolve to a kept fixture (none to a deleted one).
  `check_docs.exs`: 285 docs, 0 broken links.
- (2) `elixir bin/features.exs --check` exit 0 (fails on a missing path or a hand-edited `gen.md`).
- (3) `elixir bin/contracts.exs --check` exit 0; `contracts.gen.ts` not in the diff; the removed test's
  logic run ad hoc at head: 35 brands == 35 Elixir constructors. `nominal?/1` equals the old match
  (`%{"type" => "string"}` with no enum/const) for every map.
- (4)-(6) `node --test` (no sim) green, `tsc` (src, test, play) green, `mix compile --warnings-as-errors`
  green, `mix test` 402 passed. Assertion and test counts unchanged in all 20 converted content files.
  F12 names: `git grep -w` finds uses only inside the defining file; `defp` compiles warning-free.
- CI on `586c1287`: all 7 checks pass (browser, changes x2, elixir, lint, sim, typescript).

## Mutants (throwaway, reverted)

| Mutant | Result |
|---|---|
| Delete `missing_child_v003_hash.json` | red: `readable.jsonl: no known answer` |
| `buyPrice` non-discount branch `base + 1` | red: `commerce.jsonl: replay differs` |
| `buyPrice` discount branch `+ 1` | green: no transcript buys at a discount (pre-existing coverage, not this PR) |
| `nominal?` drops the const check | red: nominal test, and `contracts.exs --check` |
| `contracts.ex` filter replaced by `s["type"] == "string"` | green (see nit 1) |
| `ContentSource.restore` of existing file is a no-op | red: 44 of 174 content tests |
| `barriers.ex` lockout check skipped (`and false`) | red: `content_locks_test` (`mix test --force`) |

## Findings

1. **nit** `test/loka/core/nominal_ids_test.exs:81`: the old test also caught the Elixir filter drifting
   from the TS one; now a change to `lib/loka/core/contracts.ex:47` that stops calling `nominal?` (mutant
   above: enum strings gain tag constructors) passes all 402 tests. Low impact: a removed constructor
   that code uses fails compilation, and the shared call makes drift deliberate. No action required.
2. **nit** `test/loka/content_locks_test.exs:13`: comment describes the deleted private `compile/2`;
   it now sits above `src/1` and misdescribes it.
3. **Accepted** `test/test_helper.exs:28-33`: a case killed by the 60 s ExUnit timeout skips `after`,
   so later cases in that module run on a mutated copy. The run is already red from the timeout, so
   nothing is hidden; later list cases asserting only `{:error, _}` (e.g. `content_services_test.exs:35`)
   could pass vacuously, which adds noise only. Cross-module isolation holds (one copy per module, `on_exit`).
4. **question** The brief mentions 4 disputed code-review findings "in the PR description"; the PR body,
   comments and reviews on GitHub contain none, so they were not assessed.

Transcripts: the `text.includes(pin)` filter cannot skip silently: no match leaves `kat` undefined and
`assert.ok` fails (mutant 1). CLI replay stays covered by `kernel/ts/test/play.test.ts:119`.
Over-engineering: none; `ContentSource` replaces 10 private helpers with one 40-line module.
