# C6 source checkpoint — 2026-10-06

Provisional source proof only. No final release/API/hash/ID pin, publication, browser,
native or owner-save proof is claimed. The final pin waits for the actual D8/D9
publication order. The owner save was not opened or changed.

The expedition now shares read-only admission between execution and projection;
completion reuses the existing checked fact assignment and bounded adjustment.
Receipt recovery checks exact transitions in small causal helpers. Actor checking
allows typed scheduled `run_job` receipts, whose payload has no actor field.

## Actual checks

- `mise exec -- node --test kernel/ts/test/c6_expedition.test.ts mobile/authority/local-story/c6_expedition.test.ts`: exit 0, six behavior/SQLite tests passed. The three additional `kernel/ts/test/c6_contracts.test.ts` tests also pass (nine focused tests total).
- The real SQLite route reopens at each ordered stage and optional shelter.
- A controlled real hound hit produces bleeding; its scheduled tick kills the
  player at stage three. The same body returns to Chapel with attempt failed,
  cursor zero. Cold reopen and the ordinary seven south exits plus east return
  to Hound Run preserve failure. Explicit immediate Restart binds a fresh attempt
  and reopens at cursor zero.
- A real deferred foreign-key failure at final-stage COMMIT leaves the entire
  prior world/head/rows/receipts. A lost acknowledgement after successful COMMIT
  cold-opens the entire completed world and single reward. Both fence memory
  while reconciliation reads fail. Retrying the original invocation completes
  once; receipt replay leaves stored rows and reward unchanged.
- `mise exec -- npm --prefix kernel/ts run typecheck`: exit 0.
- `mise exec -- npm --prefix kernel/ts run test:sim`: exit 0, 19 tests passed.
- TypeScript and Elixir size checks pass without raising limits. `mix credo --strict` reports no issues.
- `mise exec -- mix test --force test/loka/content_expedition_test.exs test/loka/core/compose_test.exs`: exit 0, 14 tests passed.
- Compiler proof checks expanded short references against five literal route edges and rejects a nonexistent physical direction.
- Contract proof covers 44 required fields and 18 bounds/tags/enums across the owned attempt, quest, command, delta and journal contracts. Each of these 62 cases removes its individual guard and observes the controlled malformed input become admissible. These are controlled schema mutations through the existing validator's explicit schema argument, without editing frozen fixtures.
- `mise exec -- bin/check_all.sh`: exit 1 at missing expedition feature-map
  spec/contracts/fixtures/invariants/implemented_in/transcript cells. Later gates
  did not run and are not claimed green.

## Actual red controls

Removing the fatal expedition invalidation passed the existing focused kernel
route/death suite, then failed the new fatal SQLite test: `active !== failed`.
Source was restored. Removing either exact-row or actor checking independently
failed the isolated receipt boundary regression with `Missing expected exception`;
source was restored before this checkpoint.

Removing the compiler's physical-edge guard retained successful valid source compilation,
then failed the new malformed-edge test (`assert {:error, diagnostics}` received an
accepted artifact; exit 2). It ran with `mix test --force`; source was restored.

## Remaining publication work

Full local gate and complete review of the changed schema surface; actual final predecessor integration and independent release pins;
final feature transcript and known answers; fresh independent reviews and CI on
the exact published head; browser/Book closure. The current full gate is blocked,
and C6 is not complete. Native work remains paused; UI blur remains deferred.

Ponytail/correctness self-review: route, reference and lifecycle checks retain their original ownership; existing modules own the Elixir size corrections. No dependencies or raised size/complexity limits were added. Independent review remains required.
