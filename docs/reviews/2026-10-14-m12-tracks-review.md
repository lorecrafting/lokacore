# Review: m12 tracks and trails (toolbox row W13), main review

- Branch `toolbox/m12-tracks`, exact commit `03101ac0d1ca28222bf41e9d32bebfd718479241` (base `toolbox/batch-m12` `6642e7c1`); Beads `loka-kgd.136`; kernel_api 1.85. Batch lane, no PR. A separate second opinion covers the facts_typed widening.
- Governing: [mechanics.md Tracks and trails](../system/mechanics.md#tracks-and-trails-toolbox-row-w13), [cartridge.md Trail declarations](../system/cartridge.md#trail-declarations), `protocol/invariants.json` facts_typed, realm seams (`docs/decisions/owner-decision-realm-seams-2026-10-13.md`, on main, not yet on this branch), brief acceptance a-f and PM rulings 2026-10-14 (hold on any body; out-of-area park; instance-scope player trails).
- Hosted CI on the head: `ci` and `book-e2e` success (`gh run list --commit 03101ac0...`).
- **Verdict: APPROVE WITH NOTES.**

## Must be true (written before the diff)

1. Rooms are subjects only for the compiler-synthesized trail facts. Any other fact with a room subject still breaks facts_typed.
2. An authored write or declaration of a reserved `trail_*` fact is RESERVED_FACT in both kernels.
3. Without `world.trails`, `trail` or `hunts`, no op is written: Chapter 1 and every other sampler keep their bytes and hash.
4. Fresh iff exit != none and `now - at < fresh_for`, derived on read. A track check passes only on fresh and draws no RNG.
5. A hunt moves only through `npcPassage` (W26). It holds when a body is in its room. A cold trail falls back to the plain wander.
6. `once` keeps one write per room and plan in a proposal.
7. The 1.85 floor is the same in TS and Elixir. There is no new save section, and a cold mobile reopen accepts the room-subject rows.
8. Seams: no new `world.character` in mechanics, logical time only, and player trails at instance scope (world state).

## Evidence

- 1: `fact.ts:232-254` admits a room subject only when `trailFact` matches a plan's `trail_<key>_exit/_at` (with `trail`) or `trail_exit/_at` (some plan `hunts`). The invariants.json statement is 190 characters and matches `typedFact` (per_subject iff subject).
- 2: TS `expectedFacts` (`cartridge_position.ts:125`) merges `trailFacts`. Elixir `trails.ex:69-73` and `position.ex:108`. Both kernels test a declaration case and an authored-assign case.
- 3: `left` (`trail.ts:86`) returns [] without the opt-in. The diff touches no frozen fixture (only additions to `invalid.json` and the gen docs).
- 7: reviewer probe (not committed) on the mobile local-story save: move plus elapsed with the sampler, then a cold reopen. Four room-subject rows (`trail_at`, `trail_exit`, `trail_hounds_at`, `trail_hounds_exit`) reopen with no error. The diff adds no save or table change.
- 8: `git diff` adds no `world.character`, `Date`, `performance` or `Math.random` in `kernel/ts/src` or `lib`. Seams 1, 4, 5 and 9 are met. Seams 2, 3, 6, 7 and 8 are n/a for the reasons in the spec list, and I agree with them.
- Parity checks: TS runs `trails()` only for v2 (`cartridge_refs.ts:203-204`), while Elixir `Trails.check` runs for any format (`compiler.ex:101`). This is n/a: the v1 branch of `CompiledCartridge` has `additionalProperties: false` and no `world` or `populations`. The schema `trails` object requires `fresh_for` and `leads`, so neither kernel can read an undefined value. facts_typed has no Elixir runtime twin (`implemented_in` typescript; no `lib/` match), so on the Elixir side the twin is the synthesis and the reserve.
- Seam 1: the hold reads `world.knownEntities` kind `body` (`trail.ts:63-66`). That map is pinned world state (`fresh.ts:217`), not a per-viewer set.
- Composition: `lint/rules/ts-rule-module-imports.yml` adds only `../trail.ts` to the shared-module list. `trail.ts` names no mechanic and no content.
- PM claim reruns: hold at `trail.ts:66` confirmed (M3). Hosted CI green on the head confirmed.

## Mutants (detached worktree, focused files, all restored)

| # | Mutant | Result |
|---|---|---|
| M1 | `trail.ts:46` `<` to `<=` | red, 2 tests in `tracks.test.ts` |
| M2 | `fact.ts:254` drop `&& trailFact(...)` | red, `facts_typed admits a room subject for trail facts only` |
| M3 | `trail.ts:66` hold skipped | red, `a hunter in the player's room holds` |
| M4 | `settle.ts:162` `once(ops)` to `ops` | red, `two hounds leaving together write one row` |
| M5 | `trails.ex:102` floor `[1, 85]` to `[1, 84]` | red, `content_tracks_test.exs` 1/2 |
| M6 | `trails.ex:46` synthesis keyed on `trail => false` | red, 2/2 |

## Findings

- nit `kernel/ts/src/content/cartridge.ts:221`: the `lockStage` actions loop is reformatted with no behaviour change. This is churn outside the row (likely made for the size budget). Keep it or drop it.

No blocker. No should-fix.
