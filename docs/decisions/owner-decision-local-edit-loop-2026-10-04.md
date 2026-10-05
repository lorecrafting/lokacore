# Owner decision: short local edit cycles — 2026-10-04

The owner: “yes we need short edit cycles that dont go through CI and reviews and stuff, something we can do locally and keep iterating.”
The PM also relayed (paraphrased) that related small WIP edits should be batched into one coherent
PR before full checks, independent review and CI; unrelated kernel and save contract changes keep
their own PR review scope.

The PM verified a separate iOS Debug Simulator served by Metro: a temporary visible Book UI text
edit appeared through Fast Refresh, then was reverted, leaving the worktree clean. The Release
Simulator remains separate on its own device and save. The PM relayed (paraphrased) the owner's
later preference: they test on Debug/Metro, with Release kept closed except for automated
milestone proof when needed.

The PM also relayed (paraphrased): Metro serves one source worktree at a time. At a playable
checkpoint, the PM switches it to the active feature worktree, then subsequent edits use Fast
Refresh. A content pin or save identity change requires explicit **Start over**, never a silent
save reset or re-pin.

Apply this to local TypeScript/UI work during a slice. Focused tests and Fast Refresh serve the
edit loop; full checks, independent review and CI apply to the PR before merge, as specified in
[WORKFLOW](../WORKFLOW.md#local-edit-loop). Native dependency or configuration changes need a
native rebuild. This uses local tools and no paid service or EAS.
