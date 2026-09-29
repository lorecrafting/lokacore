# Gate R5 carries: independent review

- PR #57, reviewed head `e95e0c7dc99e0936ad9b458ccd959a8e9b7ed163` on 2026-09-28.
- Verdict: **APPROVE**. Findings: none.

## Contract checked before the diff

Document 04 §§5.1–5.4 and `protocol/invariants.json` require each admitted delta op to satisfy its preconditions against the preceding overlay, and require final containment to have one container per entity, no cycles, and no capacity overflow. Faults must discard the whole proposal. Document 14 §R5 and the Gate R5 row in `docs/ROADMAP.md` require this invariant to reject a fabricated success independently, containment validation to scale linearly, and a red control for an inherited GameView action key. The separate budget diagnostic carry and `knock`/map scope are outside this PR.

## Review evidence

- The TypeScript and Elixir implementations check the same admitted op families: fact, transfer, quest, choice, job, time, resource, cooldown, and barrier. They replay target values and cross-target conditions through each preceding op. The containment check validates the final overlay, including untouched base rows and capacity.
- Both kernels rejected a fabricated successful result for every fixture case whose expected fault is `precondition_failed`, `capacity_exceeded`, `containment_cycle`, or `nonfuture_job`; no case survived. Both rejected a cycle created by a proposed change to otherwise acyclic state.
- A 5,000/10,000/20,000 row valid containment chain passed in both kernels. TypeScript took 6/7/16 ms and Elixir 15/8/18 ms in local probes. These measurements support linear scaling at the requested sizes; they are not a device benchmark.
- In a throwaway detached worktree, bypassing transfer validation made the new fabricated-success test fail on `capacity-all-or-nothing` in both kernels. Reverting the GameView `Object.hasOwn` guard made its `constructor` test fail. The mutant worktree was removed.
- Local checks: 208 TypeScript tests passed, including 10,000 fresh simulation sequences; 11 Elixir composition tests passed; `git diff --check` passed. The changed source and test files satisfy their file-size limits. Existing differential composition tests compare the kernels on 1,000 generated deltas and 300 simulator proposals.

## Simplicity

The parallel invariant logic is needed to check composition independently in each kernel. The diff adds no new dependency, framework, or speculative interface. New tests use fixture answers or literal expected results and each exercises a failure distinct from ordinary successful composition.
