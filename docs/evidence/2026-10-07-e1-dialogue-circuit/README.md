# E1 training and social circuit checkpoint

Source `bc22d4335b614cb13d09f22ca1725d3f1ad9d5e0` adds a fresh v042
`dialogue-circuit` route, its recorder/replay registration and source digest input.
The governing clause is [E1 exact candidate proof policy](../../system/architecture.md#e1-exact-candidate-proof-policy).
Six lessons, authored payments, the original rusty sword, eighteen selected
conversation choices, and cold reopens execute through the real SQLite authority.
The clean-source [trace](case.jsonl) contains 75 committed commands; semantic
replay passed. The [summary](summary.json) binds its exact source/check/policy.
The unit test uses placeholder source identity solely for its controlled input;
the separate clean-source trace uses the actual source identity.

Against the [integrated checkpoint](../2026-10-07-e1-integrated-checkpoint/README.md),
the trace adds 46 authored witnesses, thirteen dialogue families and seventeen
previously missing choices. Combining these witnesses would leave 195 authored
paths, five dialogue families and fourteen choices pending. This is a comparison
of retained witnesses, not a run of the integrated recorder. Skill-acquisition
sequence paths remain pending under the existing witness rules.

Checks and their recorded exit statuses:

- `mise exec -- node --test kernel/ts/test/e1_dialogue_circuit.test.ts`: 0, one test.
- Omit Ash's talk/choice via [mutant.diff](mutant.diff), then run all 27 existing
  E1 tests (`kernel/ts/test/e1*.test.ts`, excluding the new test): 0. Run the new
  test with that same mutant: 1, missing literal `ash/leave`. Restore source and
  rerun the focused test: 0. The mutation was applied before formatting; the
  retained failure's source line numbers reflect that earlier layout.
- `mise exec -- npm --prefix kernel/ts run typecheck`: 0.
- `mise exec -- elixir bin/check_docs.exs`: 0.
- Clean-source focused capture plus `replayCase`: 0.

Author correctness review checked ancestry avoids prelearning haggle, Swords
precedes Dodge, schedules keep the NPCs present, payments use literal expected
balances, and every credited choice actually executes. Ponytail Review: lean
already; the route reuses the existing authority and witness implementation.
No mechanics, candidate fixtures or witness rules changed.

The parent integration will run `bin/check_all.sh` and the full recorder. Fresh
independent review is pending (the author could not allocate a reviewer because
the agent limit was reached). No 10,000-sequence final proof, browser/native proof,
PR, push or E1 certification is claimed. Checks and trace bytes are covered by
[SHA256SUMS](SHA256SUMS) and [verification](SHA256SUMS.verify).
