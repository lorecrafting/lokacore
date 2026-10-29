# Review: batch C1 final head (loka-ivjq.20 S7, loka-ivjq.2 F2)

- PR #490, branch `simplify/c1-loader`, reviewed head `13e0ebe5b74592ff53040e8a9a244d19d38f2baf` against `main`.
- Governing: `br show loka-ivjq.20` C1 PLAN (D1 kept checks, D2 drop duplicates, D3 one range check, D5 trust boundary, D9 enum unchanged), `br show loka-ivjq.2`, AGENTS.md, [WORKFLOW review stance](../WORKFLOW.md), [two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md).
- Reviewer: anthropic/claude-fable-5-1, independent, authored none of the work; the nine slice records on the branch were read after the must-be-true list.
- CI on the head (`gh run list --commit 13e0ebe5b…`): ci success (40825334938), book-e2e success (40825334995).
- Verdict: **APPROVE WITH NOTES** (one doc should-fix applied in place; follow-ups below for the PM).

## Must be true (written before reading the diff)

1. Every refusal the TS loader stopped emitting has an Elixir compiler twin with a test, or the plan drops it.
2. D5: the loader still refuses oversize, invalid JSON/UTF-8, unknown format, schema, hash mismatch, definition-key mismatch, lock mismatch and installed-host (kernel_api, pins, capabilities, client features, one-scope facts).
3. No helper left in `kernel/ts/src/content` without an importer; no test file asserting nothing; no `size: allow` marker left.
4. One `kernel_api` range rule (`Requires.range/2`) and no per-field floor in either kernel or in the schema.
5. Artifact change is only the gate_sampler `knock` → `knock_door` rename and re-pinned hashes.
6. No live doc says the loader performs a check it no longer performs.

## Evidence

1. Code sets: main's TS loader emitted 31 codes, head's 13. All 18 dropped (BARRIER_MISMATCH, BARRIER_UNREACHABLE_KEY, CAPACITY_EXCEEDED, CONTAINMENT_CYCLE, DUPLICATE_DEFINITION, EMPTY_TIME_WINDOW, FACT_DEFAULT_INVALID, FACT_TYPE_MISMATCH, INVALID_TIME_POLICY, KERNEL_API_RANGE_INVALID, OUTCOME_MISMATCH, RESERVED_FACT, RESOURCE_SPEC_INVALID, SITE_EXIT_CONFLICT, UNDECLARED_CAPABILITY, UNKNOWN_COMMAND, UNREACHABLE_DETAIL, UNRESOLVED_REFERENCE) are emitted in `lib/loka/content/` at head. Rule sample (18, each with its emit site and a test): combat narration refs `combat.ex:152` (`content_combat_test.exs:186`); recipe key vs command `recipes.ex:68` (`content_recipes_test.exs:163,172`), shared check key `:105`, check⇔failure `:157`; offers `commerce.ex:32`, funds `:34`, discount `:85`, stock `:59` (`content_prices_test.exs:24,33,67`); evidence without patrol `patrol.ex:47` (`content_patrol_test.exs:38`); barrier knock `barriers.ex:61`, hidden_until `:76`, shared lid `:102`, faces `:127`, unreachable key `:150` (`content_gate_test.exs:124-146`, `content_locks_test.exs:43,82`, `content_hidden_passage_test.exs:33`); reserved facts `scenes.ex:208` (`content_scenes_test.exs:156,168`); bounded int `standing.ex:60` (`content_standing_test.exs:24`); cycle/capacity `entities.ex:213-247` (`content_items_test.exs:113-135`); unreachable detail `room_parts.ex:187` (`content_rooms_test.exs:228`); undeclared capability `water.ex:33`, `combat.ex:166` (`content_combat_test.exs:138`). Holds.
2. `protocol/fixtures/cartridge_loader.json` (driven by `kernel/ts/test/cartridge.test.ts:60`) carries 2 CONTENT_HASH_MISMATCH, 11 SCHEMA_VIOLATION, 2 UNKNOWN_FIELD, 2 UNKNOWN_FORMAT, 2 INVALID_JSON, 5 ARTIFACT_DEFINITION_KEY_MISMATCH, 4 LOCK_MANIFEST_MISMATCH, 3 KERNEL_API_UNSUPPORTED, 2 PINNED_VERSION_UNSUPPORTED, 2 CAPABILITY_NOT_INSTALLED, 1 CLIENT_FEATURE_UNSUPPORTED; byte cap and non-UTF-8 at `cartridge.test.ts:70,85`; one-scope facts in `test/scoped_facts.test.ts`. Holds.
3. Nine modules, 548 lines; every export has an importer (`cartridge_barriers` → runtime/created, movement/sequence, play/reach; `cartridge_position` → play/reach; `cartridge_scoped_facts` → installed). Ten TS test files deleted, none left with empty bodies. No `size: allow`. Holds.
4. `KERNEL_API_RANGE_INVALID` is emitted only from `lib/loka/content/requires.ex` `range/2`; `recipes.ex` lost `api/1` and the `< [1,100]` floor; `protocol/fixtures/loader_floors.json` deleted; `cartridge_installed.ts:41` keeps only KERNEL_API_UNSUPPORTED. Holds.
5. Commit `1f10339c0`: `knock` → `knock_door`, `cartridge_gate_hash.json` regenerated, transcript lines differ only in `content_hash`, `reward_storage_invalid.json` drops `loader_code` (the loader no longer emits FACT_TYPE_MISMATCH). No story view or save file in the diff. The rename is forced by F2: main reserved `where`/`knock` only at `kernel_api >= [1,37]` (`recipes.ex:82` on main); with that floor gone the keys are reserved at any version. Holds.
6. `docs/system/cartridge.md:23` names the compiler. Two stale lines found and fixed in place (finding 1).

PR-body claims rerun: "each with its compiler twin and test" (sample above); "a recipe may not take a command name" (`recipes.ex:67-69`, test `content_recipes_test.exs:163`). Both hold.

## Tests of the tests

- `bin/mutate_diff.sh origin/main`: 24 mutants, 0 run. 21 NO-TESTS (the one-hop heuristic cannot see that `lib/loka/content/*.ex` is tested through the compiler), 2 BASELINE-RED (`recipes.ex:62,68`, caused by missing deps in the fresh worktree; green after `mix deps.get`), 1 NOT-UNIQUE (`cartridge_position.ts:12`). Each NO-TESTS line was read: all are capability or dispatch lines whose twin tests the slice records name (`dreams.ex:38` via `content_dreams_test.exs:156,223`; `death.ex:158` via `content_dusk_test.exs:96,116`; `combat.ex:138`, `levelling.ex:28` covered in the d1 record).
- Hand mutants via `bin/mutate.sh`, all red on the narrow file: `requires.ex` `>=` → `>` (`content_test.exs`); `recipes.ex:68` `or` → `and` (`content_recipes_test.exs`); `cartridge_installed.ts:41` `||` → `&&` (`cartridge.test.ts`); `cartridge.ts:41` `===` → `!==` (`cartridge.test.ts`).

## Findings

1. **Should-fix (applied, commit `51c7348ae`, 3 lines, docs only).** `docs/system/protocol.md:1279` "The loader rejects unknown room/NPC refs…" and `protocol/README.md:57` "the current loader refuses unmarked receptacles" named the TS loader for checks that live in `lib/loka/content/` (`knowledge`/refs and `entities.ex:221`). Scenario: an author writes a `cartridge.test.ts` case for an unknown NPC ref and it never fails. Now say "the compiler".
2. **Nit.** PR #490 body reports no `/code-review` result (AGENTS.md Simplicity); run it in the fix round or note it on the PR.
3. **Nit.** PR #490 body still says "Draft until slice F and the final-head review" while the PR is ready for review; drop the line at merge.

## Follow-ups for the PM

- Slice F record, open notes: `d10_knowledge.test.ts:108` plants no unknown room/NPC id; `fact.ts:209-210` unbounded-int guard has no direct runtime test.
- `bin/mutate_diff.sh`: a two-hop import option (or an Elixir rule that maps `lib/loka/content/*.ex` to `test/loka/content_*_test.exs`) so a content-compiler diff is not reported as 24 × NO-TESTS.
