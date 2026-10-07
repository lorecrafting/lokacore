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


## Scoped fix round 1 — P1–P3 closed; P4 open

Exact source reviewed: `ec0f2dd3ac6acda1a0f0e8a9028e8c97642df45c`.
Scope: P1–P3 dispositions, changed direct callers and focused tests. No broad
re-review or second-opinion finding disposition is implied.

- **D8-P1 CLOSED.** Movement closure now composes the existing crow settlement with encounter closure/cancellation. The same live member resumes its checked return, the released coin stays in the original room, and ordinary home arrival clears the occurrence. Kernel Flee regression plus real SQLite paused/resumed reopen and invocation replay pass. Existing round closure remains unchanged.
- **D8-P2 CLOSED.** Compiler and loader now reject eligible definitions with container/capacity, wearable slot, barrier or protected-Give roles, while requiring room provenance. Controlled container, protected and wearable negatives pass through their actual compiler/loader boundaries; no new chapter literal was added to the engine.
- **D8-P3 CODE/INVARIANT FIX CLOSED.** Both independent invariants permit a changed member/generation only when the exact prior occurrence is idle, matching composition. Independent literal fixtures prove lawful replacement acquisition and reject active rebinding, including counterfeit successful invariant input. The full death→replacement→new-Drop SQLite scenario remains explicitly in P4.
- **D8-P4 OPEN.** The expanded suite proves all17 literal outbound/deposit/return/home checkpoints and10 failed-COMMIT/lost-acknowledgement cases, plus paused/Flee-resumed reopen. Recorded browser full-nest fallback is now supplied. Remaining proof: original nest moved/closed/full and Shoo SQLite checkpoints; death→replacement→new Drop reopen; failed/uncertain commits at those additional boundaries including combat pause/Flee resume; actual browser carrying, held refresh and Shoo. No browser observation was inferred from headless results.

Checks independently run: TypeScript kernel/loader/composition/real-SQLite24/24;
Elixir compiler/composition16/16. Reverted each P1 movement settlement, P2 safe-role
validation and P3 idle-generation exception separately: each focused regression
fails exit1. Restored source and reran the24-test suite green. Only this record and
its index change are committed. Ponytail/correctness scoped audit found no new
issue; existing settlement and validator patterns suffice.

Overall verdict remains **CHANGES REQUIRED**, solely for open primary finding
D8-P4. Final-head CI and required independent second-opinion closure remain PM
merge gates.


## Scoped P4 save proof — closed; browser open

Exact source reviewed: `efc7f5ebb112748e281f7b681162ccc4737d586c`.
Scope: the added P4 evidence script, its changed authority fixture/cases, and the
existing operation-based fault harness they use. P1–P3 were not reopened.

**P4 SAVE PORTION CLOSED.** Independently ran
`mise exec -- node docs/evidence/2026-10-06-d8-d11-integration/crow-p4-save.ts`:
exit0,25 additional cold reopens and20 actual failed-COMMIT/lost-acknowledgement
cases; the imported authority suite also passed6/6. Checked ordinary nest
Take/Close/eight-root Put and fallback states; Shoo, Attack/Flee, fatal combat,
replacement and generation2 Drop; pending memory stays unchanged, absent COMMIT
preserves prior rows where asserted, settled invocation/job replay changes no rows,
and cold-open state matches the committed state. The prior17 flight/home
checkpoints and10 fault cases remain present. No production code changed.

Independently ran the supplied `--red-control`: exit7, expected `open` versus
actual typed `save_corrupt` after changing the persisted exact coin-holder row.
The same cold-open checker therefore detects a real isolated storage mutation;
no source mutant or altered save was retained. All16 evidence hashes verify.
Ponytail/test-integrity check: bounded proof scenarios reuse actual invocations,
real SQLite and the existing operation fault mechanism; no additional finding.

**P4 BROWSER PORTION OPEN; overall CHANGES REQUIRED.** Full-nest fallback is
recorded as proved. PM reports a transient carrying label observation, which this
save-only recheck does not independently certify. Remaining browser obligation:
refresh during actual crow-held custody and confirm the same carried coin/crow
continues lawfully; demonstrate Shoo success releasing that exact coin once to
ordinary room Take, and truthful refusal/unavailability afterward. Retain the
observations on the isolated browser run, then obtain scoped primary closure and
checks green on the exact final merge head. Native work stays paused; owner save
and deferred blur remain untouched.


## Final scoped P4 browser review — APPROVE

Exact candidate reviewed: `e947251ec514344a02a46e242c663503e1695299`.
Scope: `mobile/app/tests/crows.e2e.ts`, its retained browser report/trace and
old-suite/red/restored-green results. Earlier P1–P3 and P4 save dispositions stand.

**D8-P4 CLOSED; overall APPROVE.** The test uses ordinary Book actions to obtain
the sole authored coin and Drop it at Green. The inspected report and trace show
the literal carrier visible before and after a real page restart, then actual
Shoo, committed release narration, disappearance of that crow's Shoo offer,
ordinary room coin with no carrying offer, the same state after another restart,
and ordinary Take followed by inventory visibility. This satisfies the remaining
held-refresh and successful/refused-projection obligations. Earlier real-clock
nest recovery/full-fallback evidence remains separate.

Inspected retained runner report: selected crow case passed,8975ms. Inspected
trace events corroborate the restart and locator interactions/assertions rather
than merely accepting the summary log. Report provenance names `41d25517`; the
candidate differs from that commit in application/kernel scope only by this new
crow test. Retained trace SHA-256:
`a0e78d348f309a6e8cde3d11a2d7a3ce4fce2dd349ea2c61afb73885dd96a556`.
Inspected raw mutation logs: removing the Shoo transfer leaves the old focused
Book move case green, fails the new case at line69 because the ordinary room coin
is absent, and restored source passes. Committed evidence hashes verify.

The test-owned stable clock controls the brief custody window without changing
production clocks or injecting world state. Frozen animation time makes the
screenshots unsuitable for visual-layout proof; readable screenshots are not
needed to establish these DOM/interaction behaviors. This is no closure of the
deferred UI blur or future E3 human gate. Ponytail/test-integrity review found no
additional issue. No source mutations or owner saves were touched by this recheck.

No open primary findings. Final merged head still requires the workflow's exact
head CI and merge-commit procedure; PM reports hosted checks green on this
candidate. This approval is D8 only.
