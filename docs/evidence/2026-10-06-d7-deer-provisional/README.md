# D7 provisional local proof — 2026-10-06

Source base: published `e9db5bdf` plus reviewed D7 planning policy. The authored chapter still declares version `0.0.32`; successor release/API/hash/genesis IDs remain unpinned until D6 publishes and D7 integrates the latest main. No owner save, native device, or mobile app verification was used.

| Check | Result |
| --- | --- |
| `mise exec -- mix test test/loka/content_deer_test.exs --force` | 2 passed: compiled short refs and invalid role/narration source |
| `mise exec -- mix test test/loka/core/compose_test.exs test/loka/core/liquid_test.exs --force` | passed: Elixir/TypeScript differential retained |
| `mise exec -- npm run typecheck` in `kernel/ts` | passed |
| `mise exec -- npm run test:nosim` in `kernel/ts` | 694 passed |
| `mise exec -- npm run test:sim` in `kernel/ts` | 19 passed, including simulator red controls |
| `mise exec -- node --test mobile/authority/local-story/deer.test.ts` | 4 passed on real SQLite: pending/flight replay, round handoff, forged binding refusal, death custody |
| `mise exec -- bin/check_all.sh` | 367/368 passed; only the intentionally unadvanced independent chapter pin failed |

Controlled source mutations restored after each red run:

- Removed `runSight` generation comparison: the stale generation test failed with an unwanted transfer and slot write.
- Duplicated `transferRoots` in the fatal sequence: the deer death test failed with an evaluator fault.
- Removed `closeEncounter`'s round cancellation: sight-first test failed because the round remained pending.

The local authority suite also found a transport-only test fixture that retained new deer template items after deleting populations. The fixture now removes those items and its focused test passes. The broad authority suite reached 407 passing tests and two failures: that fixture before its correction, and a Book test requiring the paused mobile app dependency install. Mobile app verification remains deferred by the owner decision. The kernel's `gameView` and Take checks cover the living deer, flight departure, and corpse hide inventory here.
