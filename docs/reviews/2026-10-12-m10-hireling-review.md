# Review: M10 toolbox row 22a, hireling orders (loka-kgd.116)

- Written 2026-10-12 08:20 UTC in the Pi harness by anthropic/claude-opus-5-5 (role reviewer, Pi session 01a12f30).
- Branch `toolbox/m10-hireling`, head `b62d2a6716aa2b6cf114434ce3767c57ba5487f1` (spec `709dfe39`, code `b62d2a67`), diffed against `eb848f07` (`toolbox/batch-m10`, G8 merged). No PR (batch model). Installed `kernel_api` 1.70 to 1.73.
- Governing: [Hireling orders](../system/mechanics.md#hireling-orders-toolbox-row-22a) and [Group declarations](../system/cartridge.md#group-declarations) (amended here), [Group primitive](../system/mechanics.md#group-primitive-toolbox-row-g8), toolbox row 22, Beads `loka-kgd.116` brief. PM defaults accepted (attack order = fight fact, never opens combat; fee and wages in 22b; new `hireling_sampler`; dismiss resets facts by authored assigns): not reopened.
- Hosted: `ci` and `book-e2e` in progress at writing (`gh run list --commit`); the PM watches.
- Verdict: **APPROVE** (no findings).

## Must be true

1. `world.group` gains only optional `stay` and `fight`, each a bool pair fact at `["player"]` like `member`; `member` stays required; nothing new is stored.
2. `travel` (Move, Flee, transport) skips a member whose `stay` is true; undeclared `stay` keeps G8.
3. With `fight` declared the member ally turn needs `fight` true; undeclared keeps G8; listed allies read neither fact.
4. `ally` (Attack refusal, GameView offer, kill credit) still reads membership only.
5. Both kernels: UNRESOLVED_REFERENCE / SCHEMA_VIOLATION at `.cartridge.world.group.<key>`; floor 1.73 with either field, 1.70 with `member` only; the loader exempts all three group paths from the per_subject scope rule.
6. No engine order names or numbers; group_sampler and Chapter 1 unchanged.

## Proof

- Diff matches 1 to 6 and reuses G8: `member` gains a key parameter (`kernel/ts/src/mechanics/escort/shared.ts:124`), `travel` one filter term (:145), `allyOf` one conjunct (`combat/shared.ts:99`); `ally` untouched; no duplicate follow or ally logic. Sampler numbers live in content.
- Focused runs at head: TS `hireling`, `group` (untouched), `escort` 15/15, `validate` 10/10; Elixir `content_group_test` 2/2, `contracts_test` 9/9; `bin/contracts.exs --check` clean. Totals match the developer's 25 and 11.
- Mutants, each reverted, each red: TS `travel` ignores stay (a, c); `allyOf` requires fight when undeclared (group.test Bram); `allyOf` ignores fight (b); scope exemption member only (sampler load); TS floor never 1.73 (f); TS shape check member only (f). Elixir (`mix test --force`): floor `[1, 70]`; `pair_fact` skips fight; floor ignores stay; `put_ref` for stay dropped.
- Import cycles: no import line changed in `kernel/ts/src`; `madge --circular` over `kernel/ts/src` lists the same 89 cycles at base and head (none new; no escort or dialogue cycle added).

## Findings

None.

## Departures

None claimed; none found.
