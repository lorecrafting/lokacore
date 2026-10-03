# C1 journal review — PR #138

Reviewed head: `eea9fa250c1b2bb8767c80f026b8dfdcfdb30cff`; base: `297a3b1ae027315d0a8b06c28246fa02f4a8ee74`.

Verdict: **APPROVE**. Findings: none. Open review items: none.

Review depth: normal. Governing clauses: [quest@1](../system/mechanics.md#quest1-rulesquestts-kerneltssrcquestts), [GameView](../system/protocol.md#gameview), [cartridge compiler/development cartridge](../system/cartridge.md), archived [06 §§2/41](../archive/spec/06-quests-dialogue-actions-scripting.md) and [04 §15](../archive/spec/04-command-event-effect-protocol.md), [room-view need #7](../design/room-view/README.md), and the settled c1-journal brief.

## Requirements derived before implementation review

- QuestJournal has five required TextKey stages and optional outcome map with valid Key names; both compiler/loader kernels validate every journal text against the catalog.
- GameView selects text without persisted state, event, op or outcome changes: active current possession is live; event-earned objectives_complete survives drop; terminal explicit outcome text overrides the state with state fallback when absent.
- A quest lacking journal retains exactly quest/state/title; journal optionality preserves existing artifacts and state pins.
- New Ferry-derived journal cartridge supplies hand-checkable lifecycle and outcome examples and real SQLite reopen agrees with literal and headless views; the existing Lantern source/artifact/release/trace pins remain unchanged.
- Shared Checks cleanup preserves behavior; continuationId cleanup is settled deferred because the mandatory rule purity check rejects the proposed inline cast. Settled generator 10 and seed remapping preserve existing literal expectations while admitting the journal fixture.
- Composition is a read-only projection through existing quest objective policy/custody/dialogue vocabulary, never content-specific engine branches.

Permission scope: the PM selected a fresh Codex primary plus separate Sol opinion under delegated owner authority while Opus quota is unavailable, bounded by the C1 mechanics continuation decision. This is PM judgment, not an invented verbatim owner model instruction. I authored none of this PR; this initial record does not imply approval.


## Review result

The whole base-to-head diff was reviewed against the requirements above. `view.ts:165` remains a player-only read projection; its `holdsNow` call uses the existing objective policy/custody evaluator, and terminal outcome lookup has the required state fallback. No content names enter the engine logic. The two loader changes reuse existing text validation; journal strings need no reference expansion. Schema optionality preserves existing quest/view shapes. The generated definition changes are exactly DiagnosticCode description, QuestDefinition, QuestJournal and QuestView; `cartridge.schema.json` changes only DiagnosticCode description. Prior loader and invalid fixture rows are preserved byte-equivalent as parsed data.

Tests cover distinct plausible breaks using literal quest texts/states/diagnostics, real invocation admission and real SQLite close/reopen. The hand-written Python oracle extends the frozen Ferry known answer rather than obtaining expected output from a kernel. Simulator generator 10, metadata/report text and seed remapping follow the settled scope extension; prior fault anchor expected outcomes/revisions/clocks are unchanged. `quest.ts`, proposal/composition and authority/store production behavior are untouched.

Ponytail Review: **Lean already. Ship.** Existing helpers and type declarations suffice; no dependency, speculative abstraction or removable custom machinery found.

## Independent verification

All commands below ran through `mise exec --` where applicable. Focused checks were used because the PM verified all six CI jobs successful on the exact reviewed SHA; this reviewer did not rerun the full check line or independently query GitHub CI.

- Effective first Node selector run: journal, simulator, authority journal and authority fault suites, **40 passed, exit 0** (`c1-journal-primary-focused.log`). The supplied command additionally named absent cartridge_loader/contracts selectors; those did not add tests. Existing actual loader/schema selectors were run separately below.
- `node --test --test-reporter=spec kernel/ts/test/cartridge.test.ts kernel/ts/test/validate.test.ts kernel/ts/test/quests.test.ts kernel/ts/test/quest_delivery.test.ts`: **79 passed, exit 0** (`c1-journal-primary-boundaries.log`).
- `mix test test/loka/content_journal_test.exs test/loka/cartridge_cross_kernel_test.exs test/loka/core/contracts_test.exs test/loka/cartridge_loader_test.exs`: **14 passed, exit 0**; the final absent loader selector added no tests (`c1-journal-primary-elixir.log`). Compiler known-answer, cross-kernel walk and contract fixtures actually ran.
- `npm run typecheck` in kernel/ts: **exit 0** (`c1-journal-primary-typecheck.log`).
- `python3 test/loka/cartridge_journal_hash.py`: **exit 0**, regenerated fixture byte-identical, SHA-256 `6c7e6fa0fe3b9cd85702d7a74da83ee1d9b7888d3f33109ba8e64100d0dd452a`.
- Base/head path comparison independently found **202 existing cartridge/hash/mobile/trace paths untouched**, including the pinned Lantern release. This proves no existing pin file changed; it is not a claim that this reviewer recompiled every old source cartridge.

## Independent mutation controls

Both mutations were made only in a throwaway detached checkout and restored before final green checks. No mutant was committed.

| Mutation | Command | Observed red control |
|---|---|---|
| `view.ts:175`: replace `holdsNow(...)` with false, so journal ignores current possession | `node --test --test-reporter=spec kernel/ts/test/journal.test.ts` | exit 1; Lantern take shows literal `quest.lantern.find` instead of expected `quest.lantern.return` (`c1-journal-primary-mutant-active-possession.log`) |
| `lib/loka/content/quests.ex:52`: omit journal rows from text validation | `mix test --force test/loka/content_journal_test.exs` | exit 2; missing catalog stage compiles successfully instead of literal UNRESOLVED_REFERENCE, 1 of 3 tests fails (`c1-journal-primary-mutant-elixir-journal-validation.log`) |

After restoration: `node --test --test-reporter=spec kernel/ts/test/journal.test.ts mobile/authority/local-story/journal.test.ts` **5 passed, exit 0**; `mix test --force test/loka/content_journal_test.exs` **3 passed, exit 0**. Git diff confirmed both mutated production files restored exactly.

Developer-provided evidence, reviewed but not represented as independent executions: all-cartridge recompilation, eight behavior controls and eleven schema mutants with zero survivors. The schema sweep script and summary cover all five required stages, closed journal/map schema constraints, outcome key pattern and optional acceptance; independent literal schema fixtures passed above. No new checker requiring a separate planted checker violation is introduced.

## Settled scope and limits

The new Ferry-derived `ashmere_journal` proves journal text while `lantern_proof` stays pinned. Existing continuationId wrapper cleanup stays deferred because the inline cast violates the mandatory rule purity check; no weakened check is requested. Outcome choice-set validation remains deferred with the spec trigger; state fallback is required and tested. No extra own-property guard is demanded: the production canonical decoder/loader path supplies null-prototype dictionaries. Phone UI rendering/device interaction is outside this slice and was not exercised.

The separate Sol opinion is independent and is to be appended by the PM; no claim about its verdict is made here. Record and index are handed to the PM for batching, with no review push or shared-branch change.

## Independent Sol second opinion

Verbatim read-only second opinion, run concurrently with the primary review at the same exact head:

```text
verdict: APPROVE
head: eea9fa250c1b2bb8767c80f026b8dfdcfdb30cff
findings: No findings

Reviewed the entire base-to-head diff against governing specs and the settled brief, including correctness, contracts, test quality and simplicity.

Validation passed: four focused journal tests, three new loader diagnostics, ten invalid-schema cases, fixture/hash and generated-contract consistency, and targeted simulator replays. Existing fault representatives retain their source cartridges; anchor remaps preserve first-command behavior. Frozen pins remain unchanged.

Material limits: read-only review; no mutation testing, SQLite reopen execution, Elixir test execution or full-check reruns. Relied on PM’s verification that all six CI jobs succeeded at this exact head.
```

## PM disposition

Both opinions approve `eea9fa250c1b2bb8767c80f026b8dfdcfdb30cff`; no findings remain. The PM independently verified all six GitHub jobs successful at that exact reviewed head. This review/index-only commit is subject to final exact-head CI before merge. The permission-scope paragraph describes authorization separately from the completed review verdict above.
