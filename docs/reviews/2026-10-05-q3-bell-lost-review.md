# Q3-B bell-first prior/lost — independent primary review

PR #196, source head `a7810adb7a2da2db56eb0bb51f393d196b4b9103`. 2026-10-05. **CHANGES REQUIRED.** I authored none of this PR.

## Requirements derived before the diff

From [architecture](../system/architecture.md#building-mechanics-by-composition), [mechanics](../system/mechanics.md), [cartridge](../system/cartridge.md), [save](../system/save.md), [Book UI](../system/book-ui.md), the [Q3 brief](../briefs/chapter-one/a1-q3-bell-lost-sol-brief-2026-10-05.md) and [PM adoption](../decisions/pm-decision-q3-bell-prior-lost-2026-10-05.md): public all-hours Aldric and reciprocal Chapel Nave/Bell Tower/Belfry access offer Q3 only after eligible Q2; exact admitted Belfry Ring writes bell/prior once; ordered fact-change reactions resolve Q3/prior and fail pre-meeting active Q2/lost atomically; an evidenced Q3 resolution starts the durable three-line scene without a story point. A meeting before Ring preserves both Q2 returns. Cold reopen must accept every committed intermediate state and reject contradictions, including missing Ring evidence. New typed forms need valid schema, compiler/loader short refs and API gating. The Book must route the exact detail action and retain truthful scene/narration and freshness behavior.

## Finding

- **R196-1 — blocker — `protocol/scene.schema.json:26`.** `SceneDefinition.on` now requires only `outcome`, without requiring exactly one of `story_point` or `quest`. A controlled call to generated TypeScript `validate('SceneDefinition', value)` returned `[]` both when `on` had neither trigger and when it had both. Thus a directly validated artifact can claim an unstartable or ambiguous scene while passing the frozen protocol contract. The source compiler has an extra check, but the contract itself must reject both shapes. Add both invalid fixture cases and a red schema mutant control for the required exclusive shape.

## Verification and simplicity

Focused kernel bell tests: 5 passed; real rollback-journal SQLite bell tests: 4 passed; focused Elixir content/contract tests: 8 passed. Kernel and mobile TypeScript checks and headless Node sim passed. Removing reaction Q3 resolution made three bell-path tests fail; bypassing Ring receipt verification made the `ring_receipt_missing` cold-open case fail. Both mutants were restored. Native checks remain paused by the owner decision. The diff reuses recipe, quest lifecycle, reaction delivery and scene facts; no distinct over-engineering finding. No PR code was edited.
