# E2 S4 creatures and transport review

- PR #319, branch `e2/s4-creatures-transport`, exact head `740311031f7c1cd559aee7946ecca65031e8a700`. Hosted CI green.
- Reviewer: fresh independent Opus. Author of none of the work.
- Governing: [slice plan](../briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md) S4, exit criteria 2, 4 and 5, "Rules for every slice"; [E2 brief](../briefs/chapter-one/chapter-one-e2-r9c-interactions-brief-2026-10-05.md) rows :67, :69 and :70; PM brief for S4, including the unqualified Bandage ruling and the D1 route pin.
- **Verdict: APPROVE WITH NOTES.**

## Requirements written before reading the diff

1. A refused input leaves `state.rng` unchanged. An accepted missed roll draws exactly the prescribed number of times, compared with a literal.
2. Every committed intermediate state is reopened from the real SQLite file before its next consumer. The replay applies once and changes no row.
3. No loot is minted. The `old_coin` and bandage IDs are kept through every custody hop. No route credit carries across death or retry.
4. While Wren is separated, there is no `missing_child` credit. Rejoin is offered only beside her.
5. Every D1 step-4 assertion carries the pointer message, and a bleeding check at `transport/shared.ts:55-60` fails there first.
6. The DEX 9 state is set in the test, not in content. Dropping the qualification check makes the test fail on the refusal.
7. Only the two new files change. No content, oracle, `kernel/ts/src` or existing test is edited. Assertions use action keys, GameView fields, text keys and literal state, never rendered copy.

Every item holds, with the two notes below. `git diff --stat` shows two new files only.

## Mutants (throwaway detached worktree, removed; full kernel 909 and app 608 tests)

| Mutant | Result |
|---|---|
| D1: `\|\| !!world.state.bleeds?.[body]?.active` added to `transport/shared.ts:59` | Only the new D1 test fails, at authority `:211` (offer), with the pointer message. Kernel suite green. |
| Separated counts as following (`mechanics/policy.ts` `escort_state`) | Only the new family 4 test fails, at authority `:303`. Kernel suite and every other app test green. S5 may use it. |
| Crow acquisition names `world.body` (`crow/job.ts:103`) | The new families 6-7 test fails, **and so does** `kernel/ts/test/transcripts.test.ts:24` (ashmere `population.jsonl` replay). |
| Bandage `.usable` → `.acquired` (`bleed/rule.ts:76`) | Only the new kernel DEX test fails, at `:155` (offer). With `:155` removed it fails at `:157` (refusal). |
| Retry or failure keeps the old cursor (`expedition/sequence.ts:84`, `:177`, `:236`) | The new family 4 test stays **green**. Linked `kernel/ts/test/c6_expedition.test.ts:112` and `local-story/c6_expedition.test.ts:285` fail. |

## Findings

1. **should-fix**: `mobile/authority/local-story/r9c_creatures_transport.test.ts:257-259` (header), `:292`, `:315`.
   - The header claims the test catches a retry that keeps the failed attempt's route cursor.
   - The watch fails at cursor 0, so a carried cursor looks the same as a reset. The cursor mutant above stays green in this test.
   - The PR coverage table lists "no stale route credit" as **new**, but this test does not sense it.
   - Fix: drop the cursor claim from the header and mark the cursor-reset half **linked** to `c6_expedition.test.ts:112` and the authority `:285`. The other choice is to reach cursor ≥ 1 before the fatal round.
2. **should-fix**: PR #319 body, Red controls row "Crow acquisition credits the body (`crow/job.ts:103`) → new families 6-7 test only".
   - This is false: `kernel/ts/test/transcripts.test.ts:24` also fails.
   - S5 reads this table to choose a planted defect that the focused suite misses, and this mutant does not qualify.
   - The new authority assertion is in another layer, so it is not a duplicate. Only the claim needs correcting.

## Deviations judged

- **`sqliteHost` instead of `elapsedHost`: accept.** `elapsedHost` is `sqliteHost` plus an unrelated `openGame` on a different bundle (`__tests__/elapsed-host.test.ts:74-82`).
- **Oracle-corrected IDs: accept.** An independent sort of `r9c_interactions_ids.json` gives `fenwort_07`, `_05`, `_12` and `bandage_10`, `_01`, `_09`. This agrees with the lowest-EntityId rule in `mechanics.md:857`.
- **`hill_folk`: accept.** `cartridge.json:25-31` gives `dark_sight` with a CON modifier, so DEX and INT stay at 10.
- **Dropped per-plan crow cap claim: accept.** The cap is linked, and the existing cap tests fail under the cap mutant.
- The crow origin guard at `crow/shared.ts:74-80` is filed separately and is not a finding here.
