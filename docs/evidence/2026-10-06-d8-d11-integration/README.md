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
204 starting IDs. The focused compiler test independently matches the complete
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
