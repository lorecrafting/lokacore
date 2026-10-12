# Review: toolbox row 22b, hireling wages (loka-kgd.118)

- Branch `toolbox/m10-wages`, head `e367be89f52a23aa99f0321514507ddeb73c6e85`, diffed against `8ce408ac` (`toolbox/batch-m10`). No PR (batch model). Installed `kernel_api` 1.74 to 1.75.
- Governing: [Hireling wages](../system/mechanics.md#hireling-wages-toolbox-row-22b) (added here), [group declarations](../system/cartridge.md#group-declarations), [hireling orders](../system/mechanics.md#hireling-orders-toolbox-row-22a), [replenish](../system/mechanics.md#replenish-toolbox-row-19b), the fresh-world paragraph of [mechanics.md](../system/mechanics.md) (clock-0 wage row), Beads `loka-kgd.118` (brief; PM decision 2026-10-12: a wage cartridge births the player's wage-resource row at fresh clock 0, as for service and transport currencies).
- Hosted CI at review time: `book-e2e` success, `ci` in progress (`gh run list --commit`, reviewer; the PM watches it).
- Verdict: **APPROVE WITH NOTES** (no blocker; two should-fix test gaps).
- Written 2026-10-12 09:53 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. Wage: one world job, first due at fresh clock + `every`, fixed grid at `at + every`, a crossed due returned as `next`; each due settles once however elapsed time is chunked.
2. Pay in EntityId order every living member, all or nothing, against a running balance; the paid set is a prefix (purse stays at least its minimum, NPC row stays at most its maximum); ops are adjusts threaded through levels, not two transfers.
3. Unpaid living members get `member` false and nothing else; dead members are neither paid nor dismissed; no members means only the reschedule.
4. Hire fee is `lesson_payment` with zero `skill.acquire`; a broke player is refused before any write.
5. 1.75 floors (wage; skill-less `lesson_payment`) and the conserved wage resource (gain 0, no regen) are checked by both kernels; schema refuses `amount`/`every` below 1 and extra keys.
6. A cartridge without `wage` keeps its ids; the player has a real wage-resource row at clock 0.

## Proof

- Green at head: `node --test` hireling, group, replenish, training_contracts, practical_skills_contracts, ledger, validate (all pass); `mix test` content_group, content_training, content_practical_skills, core/contracts (all pass); `elixir bin/contracts.exs --check` clean.
- Mutants (each restored and compared with `git diff --quiet`; TS under `perl -e 'alarm 300'`, Elixir with `mix test --force`):
  - killed: next due at `row.due_time + every` (2 fail); purse adjust not threaded (`{}` levels, test f fails); unpaid keeps `member` (2 fail); `living` filter dropped (test g fails); clock-0 wage row removed from `fresh.ts` `started` (9 fail); replenish `regrid` crossed `<=` to `<` and replenish `row.due_time + every` (replenish.test.ts fails each); Elixir wage floor `[1,75]` to `[1,73]` and fee floor to `[1,73]` (content_group fails each); schema `every` minimum removed (core/contracts fails on the `every: 0` invalid case).
  - survived: see findings 1 and 2.
- Literals in `kernel/ts/test/hireling.test.ts` hand-checked: 10 −3 fee → 7/3; days 1, 2 → 4/6, 1/9; day 3: 1 < 3, unpaid, hired false; two hirelings 7 → 1, 6/6; 4 → Hal only (1, 9, Ivy 6 dismissed); Hal at 100 ends the prefix, both dismissed, player 7.
- Diff holds only row-22b hunks (26 files; generated files regenerate identically).

## Findings

1. **should-fix** `kernel/ts/src/content/cartridge_combat.ts:88`, `lib/loka/content/combat.ex:111-112`: each branch of the conserved check is untested. The only case names `hp`, which has `regen` and no `gain`, so dropping `r.gain !== 0` or `r.regen` (TS, 12/12 pass) or the Elixir `"gain" => 0` match (3/3 pass) stays green. Scenario: a later edit drops the gain test and a `gain: 1` wage resource loads, minting coins hourly. Fix: in `kernel/ts/test/hireling.test.ts:322` and `test/loka/content_group_test.exs:74` add two cases: `coins` with `gain: 1` and `coins` with a `regen`, each SCHEMA_VIOLATION at the wage resource.
2. **should-fix** `kernel/ts/src/mechanics/escort/job.ts:46-47`: the bounds are untested at equality. `>= minimum` to `> minimum` and `<= maximum` to `< maximum` both stay green (12/12): no case pays the purse down to exactly its minimum or an NPC up to exactly its maximum. Scenario: the first mutant dismisses Hal when the player holds exactly 3 coins. Fix: in the two-hireling test (`hireling.test.ts:287`) add a due with player 6 → both paid to 0, and Hal at 97 → 100.

## Departures

1. `escort/job.ts`, not `wage.ts`: accepted. `ts-rule-module-imports` constrains only `mechanics/*/rule.ts` imports and admits `<dir>/job.ts`, so this matches bleed, status, quest and containment. The lint test gained the valid case.
2. `regrid` extracted from `runReplenish`: accepted. The ops are the same and in the same order (transfers, `job.complete`, `job.schedule`, or `next`); replenish tests pass and both replenish mutants are killed.
3. `fresh.ts` doc comment shortened to stay at 310 lines: accepted. The meaning holds, and "currency rows" covers the wage row.
4. Elixir `put_ref` for `wage.resource` not added: accepted. `Checks.expand` already expands a binary `"resource"`; the compiled artifact has the full DefinitionRef.
5. "firstWage before firstReplenish" untestable: accepted. `firstWage` mints nothing without `wage`, so no current cartridge's ids can change; the spec's id claim holds by construction.

## Checks asked by the PM

- Threaded adjust and running balance: yes (killed mutant). Max-row cap: present; equality untested (finding 2).
- Unpaid: only `fact.assign member false` via `assigned` with subject; stay, fight and room untouched.
- Dead skipped: yes (killed mutant). Fixed grid with `next`, settle once: yes (killed mutant, test c).
- 1.75 floors are twins for the wage and the skill-less fee: yes (TS tests and Elixir mutants).
- Conserved check covers gain ≠ 0 and regen in code, in both kernels; tests do not separate them (finding 1).
- Clock-0 row: specified in `docs/system/mechanics.md` (fresh-world paragraph and the "Fresh row" bullet). No Elixir twin is needed: there is no Elixir world builder (rules are TS only, ADR-074). No fixture; the hireling hire test pins it (mutant killed).
