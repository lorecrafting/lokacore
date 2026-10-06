# C4 over published D4 — independent save/protocol carryover

**CHANGES REQUIRED.** Independent reviewer authored none of the C4 or D4 source.

- Production source: `68be0345960d276fb49e229f0a7ab220cbe2ef1e`.
- Frozen evidence-only head: `ffb06130526abb3497afc1b25bb864ac0661eb94`.
- Published D4 parent: `536c80bc76882839465aecc330e22e891e1e137d`.
- Governing [C4 brief](../briefs/chapter-one/chapter-one-c4-hound-behavior-brief-2026-10-05.md), [save](../system/save.md#c4-pack-and-flight-recovery), [protocol](../system/protocol.md#c4-pack-encounter-and-flight-composition), [D4 save](../system/save.md#d4-finite-food-and-terminal-custody-recovery), [contract lessons](../lessons/contracts.md), [storage lessons](../lessons/storage.md), and [workflow](../WORKFLOW.md#review-stance).

## Finding

**C4-D4-S1 — should-fix — C4 schema bounds and required entries lack red fixtures.**
`protocol/cartridge.schema.json` adds `PopulationPlan.pack.flight_below_percent.minimum: 1`, but the focused C4 and combat contract tests survive its removal. In an isolated review checkout I removed that minimum, regenerated contracts, and ran `kernel/ts/test/combat_contracts.test.ts`, `c4_pack.test.ts`, `c4_pack_composition.test.ts`, and `c4_pack_flight.test.ts`: exit **0**, with no failure. I then swept all **23** new or changed required entries and bounds across cartridge, delta, GameView and population-slot schemas. Six deletions fail schema generation; **17 survive** generation and those focused fixtures. Survivors include the flight threshold min/max and required pack/narration fields, three delta roster caps, GameView roster min/max and member id/name, and the population flight-clock minimum. I restored every schema and generated contract; `elixir bin/contracts.exs --check` and a clean diff then passed. [Contract lessons](../lessons/contracts.md) require each new bound or required entry to have a fixture that fails when it is removed. Add minimal malformed contract inputs with independent expected errors and demonstrate the changed-schema sweep has no survivor. The current authored hounds use 25%, so this finding concerns the schema guards' regression proof, not an observed wrong flight in the bundled chapter.

## Verified carryover

The prior provisional [save/protocol findings](2026-10-06-c4-hound-behavior-save-second-review.md#scoped-fix-recheck--approve) remain closed in the integrated source. Final composition binds the selected current-generation member, actual same-group transfer and slot stamp to the round job's due clock. Encounter proof checks exact roster, primary/cursor and successor; replay of accepted receipts reconstructs the saved state from the pinned fresh release, so lawful later wandering, death, replacement, Take or Eat do not create future-state false positives. The authority commits changed rows, head and receipt in one SQLite transaction, adopts only after commit, fences uncertain outcomes and refuses a missing release pin before loading or deleting a save. D4 terminal consumed custody and ordinary hound pelt/corpse identity remain separate.

Independent checks at the source above:

- **28/28** focused pack, food, Book and real SQLite cases pass. A throwaway copy of the SQLite pack test loaded the actual v032 D4-integrated fixture and controlled two co-present members: both cold reopen/rotated flight and genuine failed-COMMIT/old-state/exact-retry cases pass **2/2**. The throwaway file was removed.
- Independent regeneration from the frozen D4 v031 fixture reproduces v032/API1.28 canonical bytes, SHA-256 `b8e7b783483c598e6a455d8c117674bd01b96aaab5edc80b6be8df9e3b8db2bd`, and all **167** unique genesis ID answers exactly. Published D4 fixture bytes are unchanged.
- All **25** retained raw evidence hashes verify. The final full gate records exit **0** with 367 ExUnit tests; the simulator records **18/18**, 503 sequences and 16,744 steps; the fresh browser Combat roster control passes and its roster-removal mutant fails. Earlier provisional selected-flight, pack-shape, dead-cursor, late-endpoint, helper-identity, even-flight and failed-COMMIT mutants are retained with restored green. These source and browser checks do not replace the missing new schema-bound red fixture.
- `git diff --check` passes for both the source integration and evidence-only commit. No developer source, native device or owner save was changed or used by this review.

Ponytail Review: lean already; the added fixtures can reuse the existing contract corpus and validator, with no helper or new framework. Correctness review found no other open save/protocol issue in this scope. Publication remains pending C4-D4-S1's fix and scoped recheck.

## Scoped schema fix recheck — APPROVE

Corrected source `749a1705d41ddd86273231ac8661793b7f5a19ce`, frozen evidence-only head `635363806f3529c987f7f1625dcb2bfe3b80a827`. **C4-D4-S1 is closed; no open save/protocol finding in this scoped recheck.** The original finding above remains the historical round-one result.

The new C4 contract cases use the frozen v032 pack and literal composition operations as valid inputs, then independently specify malformed threshold, missing declaration, 65-member roster, malformed CombatView member and negative flight-clock inputs. I reran the corrected TypeScript C4/combat line: **23/23** pass. The Elixir content/compiler and composition line passes **9/9** after installing the locked dependencies in the isolated review checkout. I independently executed the retained schema sweep: all **23/23** individual guard deletions fail, with the same six generator refusals and 17 named literal assertion failures recorded in the developer's log. The sweep restored every schema/generated file; `elixir bin/contracts.exs --check` and a clean checkout passed afterward.

All **29** frozen raw-log hashes verify. The corrected exact-source full gate records exit **0** with **368** ExUnit tests, and the prior v032/API1.28 canonical hash, all 167 ID answers, integrated SQLite reopen/failed-COMMIT behavior, browser roster red control and simulator proof remain unchanged by the scoped test-only source diff. `git diff --check` passes for the fix and evidence commits. Ponytail Review: four direct contract tests and the retained sweep use the existing validator and fixtures; no extra production machinery. No native device, owner save, developer source or developer branch was changed by this review.

## Final evidence redaction recheck — APPROVE

Production source remains `749a1705d41ddd86273231ac8661793b7f5a19ce`; final evidence-only head is `d4597c4c1c8a62e2e877d133c102f27a49ed3554`. The schema sweep capture script now redacts ordinary and Darwin scratch paths, worktree/home paths, device serial/UDID/ECID/name, signing team/certificate/provisioning values and app-container UUIDs. Its import is read-only, so the controlled redactor check can load the actual function without running the mutation sweep. Independently, all **19** controlled forms pass through that function, while bypassing it fails **19/19** with exit **1**. The retained sweep still records **23/23** red schema mutations; the script's mutation and restoration logic is unchanged from the independently rerun version above.

All **31** retained `.log` files appear once in `SHA256SUMS`, every digest verifies, and the inspected sweep/redaction logs contain no planted secret markers or raw scratch paths. The evidence commit changes only its script, controls, log, manifest and README; `git diff --check` and the docs check pass. No new save/protocol finding. This final evidence recheck supersedes the earlier 29-log evidence scope while preserving its historical source and results.
