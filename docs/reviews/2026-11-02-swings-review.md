# Review: Swings, PR #591 (loka-kgd.200)

- PR [#591](https://github.com/lorecrafting/lokacore/pull/591) `combat/swings` at `de5d3c3fc766b315d02e0528a4524358abd4b580`.
- Governing: [mechanics.md Swings](../system/mechanics.md#swings-loka-kgd200), [cartridge.md Swing declarations](../system/cartridge.md#swing-declarations); the PM's rulings (a) to (d) from the brief.
- Reviewer: independent; I authored none of the work.
- CI at this head (`gh run list --commit`): ci success (41480852465), book-e2e success (41480852428), graph-diff success.
- The PR body reports the developer's `/code-review medium` result.

**Verdict: CHANGES REQUIRED.**

## Must be true (written before the diff)

1. Without `attacks`, or with 1, a cartridge keeps its bytes, hash, receipts and GameView. The budget stays 8 and `allyFits` stays `draws <= 6`.
2. Each swing makes its own hit draw (`roll < chance`), meets its own defense, and makes its own damage, crit and resistance rolls. Damages sum. Sleep and the hp cap apply once, as one hp loss.
3. Each opportunity writes one `attack_result`: `hit` is true when any swing hit, and `loss` is the total. `prevented_by` is set only when there is one swing. Wear and wake happen once.
4. The summary line appears only when n > 1 and at least one swing hit. It comes before the strike line, with `_all`, `_one` or plain, and binds `{count}`, `{hits}` and (npc/ally) `{attacker}`.
5. The budget is 8 + 4(n − 1) per opportunity, added when that opportunity begins. The ally needs at least 2 draws remaining.
6. Ranged weapons with `attacks` > 1 are refused (ruling b: compiler only).
7. Ruling (a): swings stop at the killing swing, with no further rolls or draws.

## Findings

- **B1, blocker.** `kernel/ts/src/mechanics/combat/swings.ts:49`. The loop runs all `count` swings, and the loss is applied only after the loop (`round_attack.ts:69`), so swings continue after the target is dead. This violates (7). A pinned case: in `showcase_combat.test.ts` combat 9 r3, the comment reads "Sword 0 hits 2, 0 hits 3, 92 misses". A has 3 hp and dies on the second swing, yet a third swing still draws, and the test asserts `combat.player_volley` (2 of 3) where stopping gives 2 of 2 (`_all`). Required fix:
  - Stop once the running sum × the sleep multiplier reaches `aboveFloor`.
  - Amend `mechanics.md:2889`, which says "makes n swings".
  - Re-derive the seeded oracles by hand: combat 4, 8 (purse), 9 and the walks.
  - PM to rule on `{count}`: swings made or declared.
- **S1, should-fix.** `round_flow.ts:254`. No test or transcript reaches `ally_volley*`. Combat 4 emits Gil's `ally_volley_one` (53 miss, 43 hit), but nothing asserts it. Mutant: pass `{}` instead of `named(...)` for `s === 'ally'`. `diku`, `showcase_combat` and `transcripts` stay green (25/0), so a Gil line with an unbound `{attacker}` would ship.
- **S2, should-fix.** `docs/showcase/combat-district.md:170`. The step table now differs from the build, and it is marked "pre-swing story" instead of being updated. Examples:
  - row 5 says "derived damage is 3 (2 + …)", but the sword is now 1..2;
  - the tilt_yard paragraph says "2 + 4 = 6 … two blows".

  A playtest run against the table fails. Update it in the B1 reseed.
- **N1, nit (ruling d).** `mechanics.md:2896` (the Sampler bullet with the showcase numbers) repeats `cartridge.md:1202` and `combat-district.md`.

## Probes

- **Opt-out bytes: holds.** No cartridge other than showcase and diku_sampler changed. `toolbox_showcase_hash.json` is the only hash fixture that changed. Budget 8, `r.budget - 2` = 6.
- **Budget at max: holds** (worked on paper). 10 swings on both sides: budget 8 + 36 + 36 = 80; nominal draws 1 + 20 + 40 = 61. Drop rolls draw outside `r`, in `deathSequence`.
- **Summary for 0, 1, some and all hits: holds.** Covered by `diku.test.ts` tests 7 and 8.
- **Death, condition and credit order: holds.** Volley line, strike line, condition and death are spliced by event index. Combat 4 credits Gil's kill.
- **Showcase pit kill: holds.** `walk_combat` has no goblin death, but combat 9 pins both pit kills (`[0,0,3]`, experience 70 and 80).
- **Oracles: partly holds.** `MISS`, `FOE_FIRST` and the diku raws are in `numeric-vectors.json`. `ROUND_2` and the no-purse state are not. I re-derived them in Python as 36 and 13 xoshiro steps from [1,2,3,4], and the rolls ROUND_2 cites (58, 49, 19, 69, 10) reproduce. B1 reseeds them.

## Mutation

`bin/mutate_diff.sh origin/main` on this head gave 50 mutants: SURVIVED 21, red-narrow 29. These are the same rows as the handback table (run on `b5af2300c`), and the handback cleared each survivor by hand.

My own narrow mutants:
- Damage not summed: diku fails 2.
- Volley `{attacker}` dropped: diku fails 1.
- Ally `{attacker}` dropped: survives (S1).

PR claims rerun: the CI run IDs match; `combat.ex:181` is `one_shot`'s `n > 1`.

## Re-check: fix round 1 (head `04ec85e70`, commits `3ce9a82d8` and `04ec85e70`)

**Verdict: APPROVE.** CI on the head is green, as the coordinator reported; I did not rerun `gh run list` for this head.

- **B1: withdrawn.** The owner overruled ruling (a) on 2026-11-02: every declared swing rolls and the hp loss is capped. `mechanics.md:2889` now says so. No code changed. Combat 9 matches the ruling (A at 3 hp, swings of 2 and 3, loss capped at 3).
- **S1: fixed.** `showcase_combat.test.ts:162` now pins Gil's `ally_volley_one` bindings. The new `said` field in `showcase_fixture.ts:64` is additive; existing callers of `act` still read `lines`. Red control: dropping the ally's `{attacker}` at `round_flow.ts:254` fails 1 of 14 tests.
- **S2: fixed.** I checked the `combat-district.md` steps 4, 5, 6, 8 and 9 and the tilt_yard paragraph against the combat 9 pins (`[3,6,5]`, `[3,3,4]`, `[3,0,3]`, `[0,0,3]`). They agree.
- **N1: fixed.** The Sampler bullet at `mechanics.md:2896` now links to the combat district instead of repeating it.
- **Budget case: holds.** In `combat.test.ts:333`, moving `r.budget +=` after the loop fails 1 of 16 tests.
