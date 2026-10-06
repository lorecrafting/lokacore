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
