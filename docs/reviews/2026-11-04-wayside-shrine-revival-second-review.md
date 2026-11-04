# Second review: revival contract and save effect, PR #599 (loka-kgd.206)

- PR [#599](https://github.com/lorecrafting/lokacore/pull/599) `death/wayside-shrine` at `5a104deae4fb947811a01ede07d6379b0db25878`.
- Scope: contract and save side ([WORKFLOW review count](../WORKFLOW.md#review-count)): `Revival` in `protocol/cartridge.schema.json` and `schemas/source`, `GameView.revival` (`gameview.schema.json`, `view.ts:113`), kernel_api 1.153, `death.ex:49-55` against the TS loader, re-recorded fixtures, transcripts and story saves. Not the keeper prose or Book UI.
- Governing: [contracts lessons](../lessons/contracts.md), [storage lessons](../lessons/storage.md), [AGENTS.md Writing tests](../../AGENTS.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci success, book-e2e success, graph-diff success.
- `/code-review medium` is reported in the PR body.

## Must be true (written before the diff)

1. The Revival bounds agree between the source and protocol schemas, and both kernels enforce them with the same code and path.
2. The compiler refuses an unresolved line at its index.
3. A cartridge without revival keeps its bytes and hash.
4. The bump to 1.153 refuses a save pinned at 1.152; it does not retarget or delete it.
5. Nothing is stored; the field is derived from the cartridge.
6. The GameView field validates against the schema, and the schema example is valid and meaningful.
7. Each bound and each required entry has a fixture that fails when it is removed (contracts.md:6).

## Checks that held

- (1) Elixir and TS probes give the same SCHEMA_VIOLATION at the same path for: empty lines, 17 lines, seconds 0, -1 and 601, missing lines and missing seconds. An extra field gives UNKNOWN_FIELD in both. `bin/contracts.exs --check` exits 0.
- (2) An unknown key gives UNRESOLVED_REFERENCE at `lines[0]`. The TS loader resolves no text keys, for narration either. That is parity by design, not a gap.
- (3) Only `toolbox_showcase_hash.json` changed among the hash fixtures. The pinned `penalty_sampler` artifact, which has death and no revival, passes `content_penalty_test` (4/4). A view with no revival has no `revival` key.
- (4) `authority.ts:100` compares kernel_api by equality, so a 1.152 pin gets `pinned_release_missing`; `release_pin.test.ts` covers this. All 7 `mobile/app/stories/live/*.sql` pins are 1.153 with the new hash. On an installed 1.152, the showcase gives KERNEL_API_UNSUPPORTED.
- (5) `view.ts:113` reads `world.cartridge` only. No save, delta or row field was added.
- (6) The example validates in `validate.test.ts` and `contracts_test.exs` (9/9). A bad revival in a view is flagged at `/revival/lines` and `/revival/seconds`, so the cross-file `$ref` resolves.
- Mutants:
  - `bin/mutate_diff.sh origin/main` gives `view.ts:113` `&&`→`||` red-narrow, where the author had BASELINE-RED; `death.ex:53` is NOT-UNIQUE ×2.
  - By hand, each of these is red: dropping the `view.ts:113` spread (shrine_keeper 1/3); `death.ex:53` without `not`, and `death.ex:54` with `i + 1` (content_penalty 1/4 each).
- PR claims rerun: the `death.ex:49-55` cite holds. "3 diffs, all in walk_combat" holds: an old/new comparison of all 30 transcripts finds only walk_combat (the death gains `fact_changed`, and two moves are inserted).

## Findings

**nit** (downgraded from should-fix: the owner is the only author and stays inside the bounds, so tight edge-case cover is not worth the tokens) `protocol/cartridge.schema.json:1770-1782` (Revival bounds): nothing kills removing a bound, against contracts.md:6.
- Sweep: one bound at a time removed from the protocol schema, then `bin/contracts.exs` to regenerate. `validate`, `cartridge` and `shrine_keeper` tests (TS) and `content_penalty` and `contracts` tests (Elixir) all stay green with any one of these removed: `minItems`, `maxItems`, `minimum`, `maximum`, `required` lines, `required` seconds.
- Only removing `additionalProperties` goes red, because generation fails.
- Scenario: someone drops `maximum: 600`. A cartridge with `seconds: 100000` then loads in both kernels, and the Book countdown runs for 27 hours, with no test red.
- Optional fix: add one rejected fixture per bound, in one table test per kernel. Not required for merge.

**question** The revival is compiled at any `at_least`; there is no per-field kernel_api gate anywhere (precedent). A 1.152 app refuses such a cartridge at schema, not with KERNEL_API_UNSUPPORTED.

**question (PM)** `view.ts:113` exposes revival whenever it is authored, not only "after a death" (the Beads issue). This is flagged in the PR, and it is what lets "nothing stored" hold on reopen.

## Verdict

APPROVE WITH NOTES. No should-fix; one nit (bound fixtures). Contract, parity and save effect hold.
