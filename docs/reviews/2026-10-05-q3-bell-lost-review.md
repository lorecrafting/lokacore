# Q3-B bell-first prior/lost — independent primary review

PR #196, source head `a7810adb7a2da2db56eb0bb51f393d196b4b9103`. 2026-10-05. **CHANGES REQUIRED.** I authored none of this PR.

## Requirements derived before the diff

From [architecture](../system/architecture.md#building-mechanics-by-composition), [mechanics](../system/mechanics.md), [cartridge](../system/cartridge.md), [save](../system/save.md), [Book UI](../system/book-ui.md), the [Q3 brief](../briefs/chapter-one/a1-q3-bell-lost-sol-brief-2026-10-05.md) and [PM adoption](../decisions/pm-decision-q3-bell-prior-lost-2026-10-05.md): public all-hours Aldric and reciprocal Chapel Nave/Bell Tower/Belfry access offer Q3 only after eligible Q2; exact admitted Belfry Ring writes bell/prior once; ordered fact-change reactions resolve Q3/prior and fail pre-meeting active Q2/lost atomically; an evidenced Q3 resolution starts the durable three-line scene without a story point. A meeting before Ring preserves both Q2 returns. Cold reopen must accept every committed intermediate state and reject contradictions, including missing Ring evidence. New typed forms need valid schema, compiler/loader short refs and API gating. The Book must route the exact detail action and retain truthful scene/narration and freshness behavior.

## Finding

- **R196-1 — blocker — `protocol/scene.schema.json:26`.** `SceneDefinition.on` now requires only `outcome`, without requiring exactly one of `story_point` or `quest`. A controlled call to generated TypeScript `validate('SceneDefinition', value)` returned `[]` both when `on` had neither trigger and when it had both. Thus a directly validated artifact can claim an unstartable or ambiguous scene while passing the frozen protocol contract. The source compiler has an extra check, but the contract itself must reject both shapes. Add both invalid fixture cases and a red schema mutant control for the required exclusive shape.

## Verification and simplicity

Focused kernel bell tests: 5 passed; real rollback-journal SQLite bell tests: 4 passed; focused Elixir content/contract tests: 8 passed. Kernel and mobile TypeScript checks and headless Node sim passed. Removing reaction Q3 resolution made three bell-path tests fail; bypassing Ring receipt verification made the `ring_receipt_missing` cold-open case fail. Both mutants were restored. Native checks remain paused by the owner decision. The diff reuses recipe, quest lifecycle, reaction delivery and scene facts; no distinct over-engineering finding. No PR code was edited.

## Separate save/protocol opinion

Verdict: REQUEST CHANGES
Reviewed SHA: a7810adb7a2da2db56eb0bb51f393d196b4b9103

S1 — blocker — mobile/authority/local-story/bell-save.ts:92
Ring evidence matches fact keys and terminal IDs without checking full references/scopes, event quest/actor, or retained command identity. After lawful Ring, changing its quest_resolved event to name missing_child, changing actor, or assigning the bell at another actor’s scope still returns open. Contradictory evidence must yield save_corrupt under “Bell-first return recovery.”

S2 — blocker — mobile/authority/local-story/bell-save.ts:39
The scene check rejects only zero. Saved scene_bell_rung values 4, -2, "bad", and 1.5 all reopen. The first three suppress the unfinished modal scene; 1.5 makes gameView throw TypeError. Validate the persisted scene value against its generated integer bounds before exposing play.

S3 — blocker — mobile/authority/local-story/bell-save.ts:43
After legitimate Q3 acceptance, deleting Q2’s quest row still returns open because the unrung branch never requires Q2. Q1 is already resolved, leaving accepted Q3 stranded and Ring permanently refused instead of offering typed corruption recovery.

S4 — should-fix — protocol/scene.schema.json:26
SceneDefinition now accepts both an outcome-only trigger and simultaneous quest/story_point triggers. The PR removes frozen scene_on_missing_story_point coverage. Compiler/loader checks remain safe, but generated contract validation accepts invalid trigger shapes. Restore contract-level rejection and the conformance control.

Evidence: Focused bell, return, escort, scene and readable-routing tests pass. Real delete-journal SQLite controls passed Ring replay, lost acknowledgement and genuinely failed COMMIT reconciliation. Three additional corruption assertions fail with open instead of save_corrupt. Removing the receipt guard makes the existing corruption test fail. Independent v013 pins reproduce; API1.11 refuses v013. Disposable checkout removed.

Ponytail: No over-engineering finding; tighten existing validation predicates.

## Primary scoped fix round 1 — 2026-10-05

Source head `45332c26293ca31d2ff21adf6c85ee2f8346776d`. **APPROVE** for the primary review; R196-1 is closed. This verdict covers the scene-trigger contract and its direct callers. The separate save/protocol opinion owns S1–S3 and its final disposition.

`SceneDefinition.on` now requires exactly one declared trigger. The closed-subset schema compiler validates the keyword's declared, unique keys; Elixir and TypeScript validators return `exclusive_properties` at `/on`; the generated TypeScript type has exclusive quest/story-point branches. Both lawful branches validate, zero and dual triggers fail, and the source compiler/loader scene checks retain lawful behavior. Focused Elixir schema/bell/scene tests: 75 passed; kernel bell tests: 5 passed; scene/cartridge tests: 81 passed; kernel typecheck passed. A controlled removal of `exactlyOneRequired` followed by contract regeneration made both Elixir and TypeScript fixture tests fail on the missing-trigger case. The mutant was restored; no source edits remain. No new contract finding or simplicity finding.

## Developer response — cross-row save follow-up

On the fix-round head `45332c26293ca31d2ff21adf6c85ee2f8346776d`, the save reviewer found that a genuine bell-first loss receipt still permitted current Q2 to be changed back to active when the child and meeting facts were also changed. The controlled real SQLite case returned `open` before this follow-up fix. Ring receipt recovery now always binds Q2's instance ID and requires the receipt's Q2 transition and child-status assignment to agree with the current lost branch in both directions. The same case returns `save_corrupt` without changing saved rows; lawful late Ring and lost states still reopen. The separate reviewer will recheck this response independently.

## Primary scoped regression check — 2026-10-05

Source head `bb56a9b073a2091aa5b78847ab7227e007d310ba`. **APPROVE** for the previously reviewed scene contract and its save receipt integration; R196-1 remains closed. The new bidirectional Ring evidence agrees with the save amendment. The existing direct `dialogueSave` caller still routes through `bellSave`; six focused real SQLite bell tests and mobile TypeScript checking passed. Removing both new receipt comparisons made the resurrected-Q2 control fail (`open` versus `save_corrupt`); both mutations were restored. Removing only the Q2 comparison left the current suite green. That comparison has a distinct late-Ring corruption case (a retained response with an extra Q2 transition but no child assignment), which I sent to the separate save reviewer for its S1–S3 disposition. No new primary-scope finding.
