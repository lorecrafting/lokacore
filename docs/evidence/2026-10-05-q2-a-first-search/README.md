# Q2-A — the first Missing Child search lead

Elspeth's real Q1 report starts Q2 atomically. Study tracks on Reed Bank grants its first
lead while Q2 stays active and Wren remains unfound. Read and arrival grant no credit.

Governing clauses: [adopted PM decision](../../decisions/pm-decision-q2-a-first-search-2026-10-05.md),
[cartridge source](../../system/cartridge.md#source-layout),
[typed reactions](../../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts),
[Notice projection](../../system/protocol.md#notice-board-projection),
[Book details](../../system/book-ui.md#notice-board-details) and
[receipt recovery](../../system/save.md#opening-a-story).

## Inspected headless evidence

The developer started from reviewed main `bcdb6ef6478681e0ea31e51005a3e24054c8db83`.
The independently declared Python content answer derives chapter `0.0.9` / API1.8 and
SHA-256 `fae0e07e0117707365b7739c1597de0e50c25ef31f0207f0730b741f0de3ab01`.
Prior release fixtures remain unchanged. The real SQLite cutover scenario refuses the
immediately preceding `0.0.8` save with identical file bytes until explicit Start over.

| Actual check | Result |
| --- | --- |
| `mise exec -- bin/check_all.sh` | Exit 0; [retained full run](local-check-all.log), including 300 Elixir tests, kernel/app suites and repository red controls |
| Focused app suite: authority Missing Child, Book Notice/live actions/presenter/combat and chapter | 55 tests passed; real SQLite and controlled Book projections |
| `mise exec -- node --test kernel/ts/test/first_search.test.ts` | Eight tests passed, including whole-proposal rollback and mixed consequence order |
| `mise exec -- mix test test/loka/content_first_search_test.exs test/loka/core/first_search_contracts_test.exs` | Two tests passed |
| `mise exec -- npm run typecheck` in the kernel package | Exit 0, source/tests/play |
| Restored behavior after the first mutation sweep | Exit 0; [focused run](restored-focused.log) |

The normal pre-commit and pre-push hooks remain enabled. The PR/handoff records their final
committed head and outcome. No native rendering, touch, device or owner-save claim is made.
No Metro, preview, Simulator or DeviceHub was used.

## Deliberately broken controls

[Schema results](schema-mutants.json) record 15/15 killed mutations: every new required
entry, discriminator const, object/array type, additional-properties check and Notice item
schema. Seventeen literal shared cases exercise both validators. Missing discriminator declarations and invalid closed/type/item schema shapes are rejected
by the shared schema compiler before either generated pipeline runs. Required quest/outcome
fields fail the literal data fixtures in both validators. Two valid but wrong Notice schemas
(scalar actions and TextKey items) additionally fail the array/item data controls in both. The mutant record gives each compiler rejection reason. The PM approved
the discriminator disposition; the generated pipelines share the same schema shape guard.

[Behavior results](behavior-mutants.json) record 21/21 killed source mutations, each run
against a named realistic test and then restored. They cover exact trigger, evidenced actor,
scope, terminal/local duplicate skip, causation, event ownership, atomic rollback, preactivation
policy, track assignment, Notice-only buttons and admission, World exclusion, captured detail
freshness, exact receipt recovery and bound root/subject evidence. Individual red logs retain
the failed assertions; local paths and device identifier fields are redacted.

## Developer review dispositions

Ponytail Review removed an unrequested Notice-specific action count cap and its overlapping
negative fixture. Existing output budgets and AdvertisedAction validation remain authoritative.
The FIFO's first root event replaces a redundant nested event scan.
No dependency, dispatcher, persistence row, transcript or compatibility adapter was added.
The shared button builder and receipt query are the consumers of their new fields/argument.

The correctness pass fixed receipt parsing so unrelated outcomes retain ordinary routing,
updated older controlled presenter replies to supply their mandatory event arrays, and added
whole-proposal rollback plus mixed fact/activation ordering controls. The PM approved the
single existing invalid fixture diagnostic change to `unknown_variant` for the new tagged
apply union, preserving its malformed input and all unrelated historical fixture bytes.
No open developer finding remains; fresh independent review still follows the workflow.
