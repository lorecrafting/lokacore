# D7 provisional local proof — 2026-10-06

Source base: published `e9db5bdf` plus reviewed D7 planning policy. The authored chapter still declares version `0.0.32`; successor release/API/hash/genesis IDs remain unpinned until D6 publishes and D7 integrates the latest main. No owner save, native device, or mobile app verification was used.

| Check | Result |
| --- | --- |
| `mise exec -- mix test test/loka/content_deer_test.exs --force` | 3 passed: compiled short refs, invalid role/narration source, and sight-on-hound refusal |
| `mise exec -- mix test test/loka/core/compose_test.exs test/loka/core/liquid_test.exs --force` | passed: Elixir/TypeScript differential retained |
| `mise exec -- npm run typecheck` in `kernel/ts` | passed |
| `mise exec -- npm run test:nosim` in `kernel/ts` | 694 passed |
| `mise exec -- npm run test:sim` in `kernel/ts` | 19 passed, including simulator red controls |
| `mise exec -- node --test mobile/authority/local-story/deer.test.ts` | 5 passed on real SQLite: pending/flight replay, round handoff, forged binding refusal, death custody, and COMMIT fault matrix |
| `mise exec -- bin/check_all.sh` | 370/371 passed after review fixes; only the intentionally unadvanced independent chapter pin failed |

Controlled source mutations restored after each red run:

- Removed `runSight` generation comparison: the stale generation test failed with an unwanted transfer and slot write.
- Duplicated `transferRoots` in the fatal sequence: the deer death test failed with an evaluator fault.
- Removed `closeEncounter`'s round cancellation: sight-first test failed because the round remained pending.

The local authority suite also found a transport-only test fixture that retained new deer template items after deleting populations. The fixture now removes those items and its focused test passes. The broad authority suite reached 407 passing tests and two failures: that fixture before its correction, and a Book test requiring the paused mobile app dependency install. Mobile app verification remains deferred by the owner decision. The kernel's `gameView` and Take checks cover the living deer, flight departure, and corpse hide inventory here.

## Provisional review fixes

The primary review found that a validly formed `sight` on the hound/pelt bundle passed compiler and loader admission but was rejected by cold sight validation. A controlled Fen Hounds source case and hash-correct loader case now require the deer/hide pair for any sight plan; both pass. Removing the loader role check makes the hash-correct Hounds sight test fail ([red output](red-loader.log)).

The [schema sweep](schema-sweep.py) changed each new required or bound guard one at a time, regenerated the TypeScript contracts, and ran the literal [deer wire tests](../../../kernel/ts/test/deer_contracts.test.ts). [Retained output](schema-sweep.log): **31 mutations, 29 fixture reds, 2 generator rejections, 0 survivors**. The two generator rejections are removal of closed-object guards, which the supported schema subset rejects before contract generation. Original schemas and generated code were restored and checked clean after the run.

The new real-SQLite fault matrix covers sight flight and fatal hide custody under definite failed COMMIT, uncertain absent COMMIT, and committed COMMIT with lost acknowledgement. Each case checks prior memory, changed rows and receipt count, cold reopen, same-intent replay, and exact deer/slot/hide outcome. Five focused authority tests pass. A planted omission of later `population_slots` writes made the sight/lost case reopen as `save_corrupt` ([red output](red-save.log)); the mutation was restored and the focused suite passed. Native and mobile app checks remain paused.

Retained raw logs and sweep script are hashed in [SHA256SUMS](SHA256SUMS), with [verification output](SHA256SUMS.verify.txt) beside it.
