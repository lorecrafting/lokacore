# D8 integration checkpoint on published D11

Latest verified source: `b65762f08250b114e959e5dbc73aa8f6811f0ab0`; full local
gate exit0. Release v039/API1.34,208 starting IDs. D8 schema/conservation/browser
proof and independent reviews remain pending; no PR or publication.

Preserved D8 source merged published main `80a9a00b9df00fa5370dcefbaba7ee7888781fb6`
with merge commit `6209b8c6`. D8 is not independently approved or published.

## Independent release derivation

`protocol/fixtures/generate_missing_child_v039.py` starts from the frozen published
D11 v038 answer, changes the release to v039/API1.34, and adds only independently
retained D8 crow definitions/text absent from frozen v035. It excludes the trace's
test clock, entry and relocated coin. The compiler is not used to generate expected
content or IDs. The ID oracle hashes the declared allocation labels independently;
crow bundles omit the companion pelt label. Frozen predecessors are unchanged.

Result: `ashmere_missing_child@0.0.39`, API1.34, SHA-256
`e604180806f19b6afa9ca2dc1e69e663c0c4057f8f7f04c5a42560d4289d94a3`,
208 starting IDs. The focused compiler test independently matches the complete
artifact bytes and hash.

## Checks actually run

- `mise exec -- node --test kernel/ts/test/crow.test.ts kernel/ts/test/crow_composition.test.ts mobile/authority/local-story/crows.test.ts`: exit0, 20 passed.
- `mise exec -- mix test test/loka/content_missing_child_test.exs test/loka/core/crow_composition_test.exs`: exit0, 15 passed.
- `mise exec -- npm run typecheck --prefix kernel/ts`: initial exit2, one test fixture cast error; corrected, final run pending in full gate.
- `mise exec -- bin/check_all.sh`: exit2 at Elixir suite, 389/393 passed. Three current-release compiler tests retained v038 references (now updated to v039, rerun pending). The spawned-bundle composition fixture parity failure remains open at `test/loka/core/spawned_bundle_test.exs:192`; later gate stages did not run.

The first focused run exposed an obsolete whole-population count and a SQLite
fixture initialized with ancestry already selected without its required receipt.
The count detector was removed. SQLite proof now creates an unselected world and
commits ancestry via the actual authority, preserving production receipt refusal.
The green SQLite suite covers cold reopen/replay, intention/corridor/delivery/return,
crow death, failed COMMIT/lost acknowledgement and forged occurrence refusal.

## Remaining before review/publication

Finish full gate and resolve any failures; run actual red controls and schema mutant
sweep; retain 30-day cap/conservation proof; perform isolated browser Book proof
including refresh, full nest and Shoo; fresh independent primary and required second
opinion review; checks green on exact final head; PR publication and PM merge. Browser,
red controls and independent approval have not been claimed. Owner save bytes were
untouched. Mobile remains paused and UI blur remains deferred.

Self-review of this integration diff: Ponytail found no new framework/dependency;
correctness found and fixed ancestry fixture receipt setup, removed the stale count
change detector, and corrected the feature evidence path. Full original D8 source
review remains pending and includes proposal/protocol/save surfaces.

## Bounded parity fix checkpoint

The frozen C3 population fixture declares `pelt` without runtime-only `loot_role`
metadata. D8's TypeScript final birth guard incorrectly treated this as a bundle
with no companion; Elixir correctly read the declared `pelt`. The guard now reads
the member's declared `pelt`/`hide` reference directly. Frozen fixtures remain
unchanged. Ponytail/correctness self-review found no additional machinery needed;
missing companion, HP and slot refusals remain covered by existing behavior tests.

- Existing TypeScript spawned-bundle behavior suite on the prior code: exit1 (red control).
- After the fix, `mise exec -- node --test kernel/ts/test/spawned_bundle.test.ts kernel/ts/test/crow.test.ts`: exit0, 15 passed.
- `mise exec -- mix test test/loka/core/spawned_bundle_test.exs`: exit0, 5 passed.
- Sole post-fix `mise exec -- bin/check_all.sh`: exit8. All 393 Elixir tests passed, then Credo failed at `lib/loka/core/compose_encounter.ex:214` (`cancel_binding?` complexity13/max9 and ABC39/max30). Later gate stages, including full TypeScript/headless simulation, did not execute.

Next concrete blocker: simplify the existing D8 `cancel_binding?` additions while
preserving cancellation binding checks; rerun the required gate after that change.
The scoped parity fix is complete; publication and remaining proof stay pending.

## Bounded cancellation complexity fix

`cancel_binding?` now uses ordered guarded function clauses for crow, bleed, water
and encounter bindings. The previous branch precedence and every identity,
generation and exclusive-field check are preserved. `mix xref callers
Loka.Core.ComposeEncounter` confirms the composition caller. Ponytail/correctness
self-review selected ordinary function clauses without a new helper abstraction.

- Red control: temporarily refuse valid encounter cancellation; `mise exec -- mix test --force test/loka/core/encounter_composition_test.exs` exits2, 3/6 pass. Original source restored before the fix.
- Fixed focused `mise exec -- mix test --force test/loka/core/encounter_composition_test.exs test/loka/core/crow_composition_test.exs test/loka/core/bleed_test.exs`: exit0, 14 passed.
- Sole post-fix full gate: exit1. All393 Elixir tests and Credo passed. The size checker now blocks at `lib/loka/core/compose.ex` (385 lines/limit340; `apply_op` line245 is42/limit40) and `lib/loka/core/invariants.ex` (342 lines/limit340). Later stages did not run.

Next bounded work is to resolve these actual size failures by extracting existing
cohesive D8 composition/invariant logic without relaxing limits or checks. All
remaining browser/schema/simulation/independent review and publication proof is
still pending.

## Bounded composition size fix

Crow CAS/base now use existing `ComposePopulation`; crow replay participates in
existing `InvariantsPopulation.holds?`. The row-shape checks use ordinary private
clauses. Module summaries were shortened. No module, dependency, size allowance
or semantic exception was added. Ponytail/correctness self-review verified the
original transition map, exact expected-row/member/generation checks and shapes.

- Red control removes relocated crow expected-row equality: `mix test --force test/loka/core/crow_composition_test.exs` exits2, 4/5 passed; stale-crow-job-cas fails as intended. Restored before final proof.
- Focused crow/spawned-bundle/general composition: exit0, 22 passed.
- Sole full gate rerun: exit8, all393 Elixir tests passed, then Credo flagged the initially extracted shape case. Converted that case to guarded clauses afterward.
- Final focused crow/general composition: exit0, 17 passed.
- Final `mix credo --strict`: exit0, no issues.
- Final `elixir bin/check_size.exs`: exit0; all existing limits retained.

Full gate has not been rerun after the final shape-clause fix. Resume with the
required full gate, then resolve any later TS/lint/schema/headless proof failures.
Browser, schema sweep, 30-day conservation and independent reviews remain pending.

## Full gate on final population extraction

`mise exec -- bin/check_all.sh` on source `05cdf719`: exit1. All393 Elixir tests,
Credo, Elixir size, portable contract/feature generation, lint, docs, Beads planted
controls and TypeScript typecheck passed. The full TypeScript suite ran (including
headless simulation), with one reported failure:

`kernel/ts/test/deer.test.ts:79`, “independent active genesis IDs include all three
deer pairs and control jobs”: `oak_deer/deer` expected
`639d7e64-e7d3-8a5f-b6eb-e5f1a4cd6afc`, actual
`c3f1e7f3-1f5e-8f0f-906f-387e9fcd61ad`.

The active genesis allocation moved when crow source was added; inspect the
independent active ID answer and D8 v039 allocation oracle before updating that
current-release test. Frozen predecessor fixtures must remain unchanged. Later
kernel red controls, TypeScript size and final formatting did not execute because
npm test failed. No D8-specific schema sweep/30-day proof was begun: the requested
full-gate prerequisite was not green. No browser, PR or review was started.

## Corrected independent v039 ID oracle

The old active deer test first read frozen v038 IDs. Switching it to v039 exposed
an error in this new generator: companion allocation was selected by a `pelt`
field, whereas independently retained compiled bundle declarations use `item`.
That omitted four hound companion labels. The generator now uses declared `item`
presence; crow bundles still allocate no companion. The corrected v039 oracle has
**208 initial IDs**, replacing the earlier erroneous 204 count. Content version,
API and artifact hash are unchanged. Frozen predecessor fixtures are unchanged.

- Deer focused run against the flawed v039 oracle: exit1, exact allocation mismatch.
- Corrected `mise exec -- node --test kernel/ts/test/deer.test.ts kernel/ts/test/crow.test.ts`: exit0, 28 passed, including the existing deer 30-day conservation replay.
- `mise exec -- mix test test/loka/content_missing_child_test.exs test/loka/core/crow_composition_test.exs`: exit0, 15 passed.
- Existing crow expected-row red control remains recorded above; no redundant new test was added.
- A full gate started on `13e76021` before discovery of the flawed oracle was stopped on PM instruction to avoid a known failure; process exit143. It had passed the Elixir suite/Credo/size before stopping during planted contract controls. This is an interrupted run, not a green gate.

Resume with a full gate on the corrected oracle. D8-specific schema sweep and crow
30-day cap/nest/coin conservation remain unperformed. The existing deer 30-day
proof does not certify crow conservation. Browser and independent review remain
pending. All working files are committed, with no retained mutant or gate process.

## Gate after corrected 208-ID oracle

`mise exec -- bin/check_all.sh` on clean source `8aa70155`: exit1. All393
Elixir tests, Credo and Elixir size passed. First failure was
`bin/red_controls.exs:135`: “refusing to overwrite red-control file:
`tmp/red-features.json`”. This ignored planted file was left by the earlier
explicitly interrupted gate. Confirmed it is the script's own exclusive temporary
fixture and removed it; tracked source remained clean. No gate result is claimed
past that failure. Resume with a full gate from this cleaned checkpoint.

Schema sweep, crow 30-day proof, browser and independent review remain pending.

## Uninterrupted full gate after residue cleanup

`mise exec -- bin/check_all.sh` on source `6b02eeda`: **exit1**. Elixir393 tests,
Credo, Elixir size, contracts/features, lint/docs/Beads and planted controls,
TypeScript typecheck, full TypeScript tests (including headless simulation) and
kernel admission red controls passed. First concrete failure is TypeScript size:
`kernel/ts/src/foundation/compose.ts`, 329 lines against limit300. All failures:

- `kernel/ts/src/foundation/compose.ts:1: file, 329 lines, limit 300`
- `kernel/ts/src/foundation/compose.ts:134: function applyWorld, 42 lines, limit 40`
- `kernel/ts/src/foundation/compose.ts:187: function crowTransition, 42 lines, limit 40`
- `kernel/ts/src/foundation/compose_job.ts:48: function bindingValid, 56 lines, limit 40`
- `kernel/ts/src/foundation/compose_rows.ts:14: function read, 42 lines, limit 40`
- `kernel/ts/src/mechanics/combat/rule.ts:10: function decide, 41 lines, limit 40`
- `kernel/ts/src/mechanics/crow/behavior.ts:1: file, 560 lines, limit 300`
- `kernel/ts/src/mechanics/crow/behavior.ts:89: function dropped, 72 lines, limit 40`
- `kernel/ts/src/mechanics/crow/behavior.ts:314: function shoo, 49 lines, limit 40`
- `kernel/ts/src/mechanics/crow/behavior.ts:420: function runCrow, 141 lines, limit 40`
- `kernel/ts/src/runtime/created.ts:97: function houndValid, 41 lines, limit 40`
- `kernel/ts/src/runtime/decision.ts:1: file, 306 lines, limit 300`
- `kernel/ts/src/runtime/invariants.ts:1: file, 301 lines, limit 300`
- `kernel/ts/src/runtime/invariants.ts:199: function delta_preconditions_hold, 47 lines, limit 46`
- `kernel/ts/src/runtime/invariants_encounter.ts:144: function job, 46 lines, limit 40`
- `kernel/ts/src/runtime/invariants_encounter.ts:191: function bindingValid, 45 lines, limit 40`
- `kernel/ts/src/runtime/proposal.ts:1: file, 321 lines, limit 300`
- `kernel/ts/src/runtime/proposal.ts:217: function react, 64 lines, limit 45`
- `kernel/ts/src/view/action_lists.ts:1: file, 333 lines, limit 325`
- `kernel/ts/test/deer.test.ts:1: file, 527 lines, limit 525`

The gate ran to completion without interruption and cleaned its temporary files.
No source fix is claimed for these size failures. Final formatting stages remain
unrun. Resume by splitting existing cohesive crow composition/job/behavior/reaction
and invariant logic into the established modules; retain all limits and safety
checks. D8-specific schema sweep, crow30-day conservation, isolated browser proof,
independent reviews and PR remain pending because the gate is not green.

## TypeScript size refactor checkpoint

All20 recorded TS size violations are resolved, with every existing allowance
unchanged. Crow intent/shared/interaction/due-job phases now have cohesive files;
CAS lives in the existing population composer. Job row types live beside row
sections; independent delta replay and proposal adoption have focused modules;
combat offer projection follows existing per-mechanic view modules. No protocol,
release/hash/ID answer, validation or custody rule changed.

- Full TS size check: exit0, no violations.
- TS typecheck: exit0.
- Existing crow CAS red control (temporarily remove expected-row comparison): exit1; restored.
- Focused crow/composition/spawned-bundle/character-choice/real SQLite suite: exit0, 45 passed.

Ponytail/correctness self-review retained allocator order, source custody, job
binding/cancellation, return phases, FIFO budget/writer groups, independent replay
and save refusal. Splits use concrete existing operations without a generic
framework. The proposal adoption import cycle contains only calls after module
initialization; focused real execution verifies that path. Final full gate remains
pending on this source; schema/conservation/browser/review work remains pending.

## Full gate after TypeScript size refactor

`mise exec -- bin/check_all.sh` on clean source
`b65762f08250b114e959e5dbc73aa8f6811f0ab0`: **exit0**. Every stage completed:
Elixir393 tests, Credo, generated contracts/features, compiler and lint red controls,
docs/Beads checks, TypeScript typecheck/full suite including headless simulation,
kernel admission red controls, TS size/red controls and final formatting. No
allowance was raised. The gate restored its own planted files normally.

Next required work: D8 schema mutant sweep; controlled30-day live-crow cap4,
nest-cap8 and coin/property conservation proof with red controls; isolated Book
browser Drop/carry/follow/nest recovery/full-nest/Shoo/refresh proof; fresh
independent primary review and save/protocol/proposal second opinion; final pushed
head CI and PM merge/publication. No source review or publication approval claimed.

## D8 schema and controlled conservation checkpoint

- In-memory direct guard sweep: exit0,57 mutants killed,0 survivors (`schema-sweep.ts`).
- Source schema subset sweep: exit0,11 closed-object/required-discriminator mutants rejected (`schema-subset.exs`). Source schemas/generation were never rewritten.
- Controlled30-day replay: exit0,736 due steps; max4 live crows, max1 nest root (within8), exactly one independently pinned coin ending in the original nest. A fifth live crow with real HP makes the unchanged checker fail: exit1,5 versus4.
- Actual capacity9, wrong-holder and stale-Shoo source mutations: each exit1 on existing crow behavior tests; all source restored.
- Missing acquisition source-custody precondition survived all11 old focused kernel tests. One new controlled regression models another committed transfer moving the exact coin before acquisition; the mutant faults elapsed instead of completing harmlessly (exit1). Original guard restored; final kernel/composition/real-SQLite suite exit0,21 passed.

Compact redacted outputs are retained beside these scripts and hashed in
`SHA256SUMS`. The30-day replay certifies ordinary capped wandering/return and one
exact coin; full-nest8/fallback behavior is separately covered by focused tests
and the planted capacity9 mutation. Browser proof remains pending. One new test
changed after the prior green gate, so a final full gate on this checkpoint is
required before source PR/review. No owner save access or native work occurred.
