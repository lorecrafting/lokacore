# D8 integration checkpoint on published D11

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
