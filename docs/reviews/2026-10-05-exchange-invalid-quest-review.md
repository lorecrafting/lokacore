# Exchange compiler invalid quest review

Local draft branch: `fix/exchange-invalid-quest`. Reviewed source head:
`e2d4b2a05294ac724f83cb16f7fc097b300a5a38`; base
`fd0cb2cad0a8d1601b2cfc65b791cb0ed10f289a`.

## Requirements derived before the diff

- Compiler stages consume only accepted definitions, preserve earlier rejection diagnostics, accumulate independent errors and return a typed failure instead of crashing ([compiler](../system/cartridge.md#compiler)).
- Valid quest exchanges retain their reference, quantity, funding and bound checks; rejection of an unrelated quest must not hide exchange diagnostics ([B5](../system/cartridge.md#b5-herb-and-bandage-stock)).
- Preserve accepted artifact semantics and deterministic diagnostics; reuse existing regressions when they already detect the break ([workflow](../WORKFLOW.md#review-stance), [test rules](../../AGENTS.md#writing-tests-every-change-every-agent)).

## Verdict and proof

**APPROVE.** No findings; no open items. Fresh independent reviewer authored none of the source change.

- `Compiler.collect/1` deliberately retains rejected definitions as `:invalid`. The comprehension at `lib/loka/content/exchanges.ex:12` skips these entries, matching the existing quest/room/dialogue traversal pattern. Accepted quests use the unchanged validation function, map traversal and flat diagnostic order. No source spec change is needed: this restores the documented compiler contract.
- `mise exec -- mix test --force test/loka/content_riddle_test.exs test/loka/content_journal_test.exs test/loka/content_missing_child_test.exs`: exit 0, 10 passed. `mise exec -- mix credo --strict`: exit 0, no issues. No tests or expected answers were changed; the existing focused tests already detect the regression.
- Independent temporary public-compiler probes for null, array, invalid JSON and duplicate-key quest files return the literal expected code/path lists. A rejected unrelated quest plus an oversized accepted exchange increment returns both errors in the documented sorted order. All five probes pass.
- Four raw compiler comparisons against the base match exactly for valid current chapter content and schema-accepted exchange quantity, increment and duplicate-stock failures, including artifact structure and unsorted diagnostic order. These comparisons supplement the literal probes and independent artifact known answers.
- Two in-memory mutations in the detached review checkout, never written to tracked source: reverting the changed line gives exit 2 and reproduces both existing riddle/journal `FunctionClauseError` failures (8/10 passed); dropping accepted-quest exchange validation gives exit 2 in the existing exchange test (9/10 passed). The exact source remains unchanged, and the restored focused run passes.
- Ponytail Review: **Lean already. Ship.** One standard comprehension fixes the shared traversal; no helper, dependency or duplicate test needed.

Local focused proof only; accumulated publication checks and hosted CI remain the PM's publication gate.
