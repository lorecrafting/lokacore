# D8 primary review — CHANGES REQUIRED

PR [#258](https://github.com/lorecrafting/lokacore/pull/258). Exact source reviewed:
`41e86ee7bd0ca71368fcfeaa92e8a5b1f0b61972`, against published D11 main
`80a9a00b9df00fa5370dcefbaba7ee7888781fb6`. Fresh independent reviewer; authored none
of D8. Review stopped at actionable blockers; no source approval or merge clearance.

## Requirements derived before the diff

From the D8 brief and active mechanics/cartridge/protocol/save/Book D8 clauses:

- One exact eligible room root from committed Drop; checked room→crow→original nest custody, no player acquisition credit or forbidden container/protected property.
- Generation/phase-bound jobs, ordinary adjacent bounded transport and return, harmless stale jobs, population ordering independence.
- Attack release and pause; every encounter close resumes a surviving crow or clears a dead one; death/replacement conserves property and admits legal later work.
- Changed-row/receipt atomicity and typed save refusal; every specified legal intermediate cold-reopens. Cartridge owns world values; frozen fixtures and independent new release/ID answers remain intact.
- Truthful Book carrying/Shoo/nest admission plus the required isolated browser interactions. Owner save untouched; native pause and deferred blur remain in force.

## Findings

1. **Blocker D8-P1 — combat escape strands the crow.** `kernel/ts/src/mechanics/combat/round.ts:83` only resumes return when a round closes combat; `kernel/ts/src/mechanics/movement/sequence.ts:50` closes it during Flee without resuming. Controlled real commands: Take coin, Drop, advance150, Attack carrier, Flee. All accepted; encounter becomes closed, crow remains `paused_return` even after the old round deadline. It never returns or accepts another Drop. Route every applicable encounter-close path through the crow settlement and prove Flee plus cold reopen.

2. **Blocker D8-P2 — forbidden allowlisted container loads.** `kernel/ts/src/content/cartridge_population.ts:134` and `lib/loka/content/population.ex:155` check only initial room location for eligible items. Controlled artifact: add `container: true, capacity: 2` to the allowlisted old coin, recompute the envelope hash; `loadCartridge` returns `ok: true`. Runtime intent then relies on that allowlist. This violates the declared no-container/safe-role admission and can transport descendants. Validate the promised safe item roles in compiler and loader with controlled negatives; retain literal chapter allowlist policy.

3. **Blocker D8-P3 — independent invariant rejects replacement reuse.** `kernel/ts/src/runtime/invariants_population.ts:50` and `lib/loka/core/invariants_population.ex:45` require identity/generation equality even when the prior row is idle. After a previously used crow dies and its slot receives generation2, the legitimate new Drop uses the old idle row as CAS expectation and the new member as value. Both composers deliberately permit that transition. Controlled literal fixture variation composes successfully, but `delta_preconditions_hold` returns false. Align independent invariant semantics and add a death/replacement/new-Drop regression with cold reopen.

4. **Blocker D8-P4 — required save and browser acceptance remains incomplete.** `mobile/authority/local-story/crows.test.ts:102` cold-opens four intention/flight checkpoints; it does not establish every specified return leg, nest moved/closed/full, Shoo, paused/resumed combat and replacement. Acquisition-only COMMIT fault coverage at line185 does not establish the newly required boundaries. `docs/evidence/2026-10-06-d8-d11-integration/README.md:280` leaves full-nest crow fallback, transient carrying/refresh and Shoo browser observations pending. Complete these explicit acceptance rows; do not infer browser proof from headless tests or approve pending cases.

## Checks and simplicity

- Focused kernel crow/composition and real SQLite suites:21/21 green on reviewed source and after restoration.
- In detached throwaway checkout, removed crow CAS comparison: composition test fails exit1 (`stale-crow-job-cas`). Restored.
- Changed nest room-count comparison from `< capacity` to `<= capacity`: existing full-nest behavior test fails exit1. Restored.
- Controlled reproductions above execute actual loader/command/composition behavior; no source-text assertions. No source edits retained.
- Read retained schema sweep, conservation, release/ID derivation and browser evidence. Hosted exact-head CI green was supplied by PM; this review does not replace final-head verification.
- Ponytail Review: no additional framework/dependency or actionable excess found in inspected implementation. Correctness fixes remain necessary.

Open: D8-P1 through D8-P4. The same reviewer should check the scoped fix commits.
