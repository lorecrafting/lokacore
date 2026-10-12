# Review: balance tool 6, power curve by level and item sheet (loka-kgd.107.6 part B1)

- Branch `toolbox/m9b-power`, head `b2e7ab2c67ce91e57f810656798c568759c740ee`, diffed against `1aa26ad912e3f951b53f992d3c31e6a6ea297dba` (`origin/toolbox/batch-m9b`). No PR (batch model).
- Governing: [Content reports](../system/cartridge.md#content-reports) (amended here), [derived stats](../system/mechanics.md#stats-derived-from-attributes-toolbox-row-2), [levelling](../system/mechanics.md#experience-and-levelling-toolbox-row-4), [study](../rnd/balance-diagnostics-2026-10-11.md) §2 C1, §1 I1; brief in Beads `loka-kgd.107.6` Notes (B1 only).
- Hosted ci and book-e2e green on the head (`gh run list --commit`).
- Verdict: **APPROVE WITH NOTES** (no blocker; one should-fix, two nits).
- Written 2026-10-12 06:06 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. Every bonus is the engine's `derived` (floor, per-term and sum saturation), not a local copy.
2. Levels 1 to thresholds + 1 (level 1 alone without `world.levelling`); level L grants `points_per_level × (L − 1)`.
3. Final values clamp as mechanics.md row 2 says; a table without its authored base is skipped.
4. Item delta = bonus with the item worn alone at the starts minus the bonus at the starts, with affects combined as attributes@1 reads them.
5. Only slotted items, sorted by slot then ref; no world number invented; no engine, schema or kernel_api edit.

## Proof

- `power.ts:17-18` calls `derived` from `mechanics/attributes/shared.ts` with its own `read`; `derived` never touches World or actor on that path (shared.ts:106-117). Clamps (`power.ts:27-34`) match `bonused` (combat/round_attack.ts:253-264), `ceiling` (containment/shared.ts:52-56) and `maxima` (resource.ts:36-44); the hp key `<id>@<version>:resource/hp` matches the loaded artifact (real cartridges below report `hp_max`).
- Test literals hand-checked: hit `floor((10−13)/2) = −2` → 68; L2 STR 12 → 69; L3 → 70; damage 0/1/2; hp_max focused on CON `3×2` → 16, `3×4` → 22; ring STR 12 → hit −1−(−2) = +1, damage +1, hp +2; belt CON 11 STR 9 → hit 0, damage `floor(−1/2)` = −1, hp +2.
- Focused runs at head: `node --test test/power.test.ts test/derived.test.ts` 15 pass; `npm run typecheck` 0.
- Real cartridges (`mix loka.compile` to a scratch path, then `power.ts`), checked against mechanics.md: `levelling_sampler` 3 levels, damage [4,4]→[5,5]→[6,6], hp_max 10→11→12 (one point, STR/CON divisor 1); `affects_sampler` belt delta carry +2000, hp_max +4 (sampler: 2500 g stone lifts, hp 14), rings 0; `derived_sampler` level 1 only, STR start 5: hit 50, damage [1,1], carry 5000, hp 10 (matches the nimble sentence).
- Mutants (`test/power.test.ts`): killed: points × L, levels = thresholds count, first term not best, delta vs zero, hp bonus only, truncating local formula, `none` = `focused`, no slot filter, ref-only order. Survived: see finding 1.

## Findings

1. **should-fix** `kernel/ts/test/power.test.ts:19-45` (logic at `kernel/ts/play/power.ts:27-37`): no case reaches a clamp, the `carry_grams` table or the base-absent skip. Surviving mutants: drop the hit cap at 100, drop the damage floor at 0, drop the hp `minimum` clamp, `carry - b`, drop `base !== undefined` (a `carry_grams` table without `world.carry` then gives NaN). Scenario: someone removes `Math.min(100,` and the tool reports hit 120 where the engine caps at 100, with the suite still green. Fix: one more literal case with `world.carry`, a chance pushed over 100, a damage bonus under 0, an hp bonus under `minimum`, and a derived table without its base (absent from the output).
2. **nit** `kernel/ts/play/power.ts:74-75`: affects saturate one at a time, but the engine sums them and then saturates once (shared.ts:63-67, 36). Run: STR start 2147483647, item `[+1, −1]`, carry table `per_point 1` → tool delta −1, engine 0. Only at ResourceInt extremes. Fix: sum the modifiers for each attribute, then `saturate(base + saturate(sum))`.
3. **nit** `docs/system/cartridge.md:415-417`: the limits line leaves out active statuses (row 2c `modifies`), which the engine adds to attribute values. Fix: add "no statuses" to the ponytail line.

## Departures

- Spec in cartridge.md Content reports, not mechanics.md: accepted. The PM asked for it, it sits beside tool 5, and it links the mechanics sections rather than restating them.
- Tie rule dropped: accepted. `focused` reports only the maximum value, so which attribute wins a tie never changes the output.
- Loose `Obj` input: accepted. It matches `reach.ts`, and the CLI goes through `loadCartridge`, so real input is still validated.

## Re-check: fix commit `e9eb44008e451d33aef5ef279ccc5f952d12ac85`

- Written 2026-10-12 06:17 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).
- Scope: `d2fc6d17..e9eb4400` only (`d2fc6d17` is this record cherry-picked onto the slice).
- Verdict: **APPROVE**. All three findings fixed; nothing new.

1. should-fix, fixed: `kernel/ts/test/power.test.ts:131` adds a hand-written case. I checked its literals by hand: STR at the maximum with pivot 0 gives hit `min(100, …)` = 100; DEX 0 with pivot 2 gives damage −2 → [0, 1]; CON 0 with pivot 10 gives hp −10 → minimum 2; carry `max − 2147482647` = 1000 → 2000; no `world.carry` means the `carry_grams` table is left out. Re-run: all five mutants (drop the 100 cap, drop the damage floor, drop the hp minimum, `carry - b`, drop `base !== undefined`) now fail.
2. nit, fixed: `kernel/ts/play/power.ts:78` now does `saturate(base + saturate(sum))`, which matches `value`/`worn` in `mechanics/attributes/shared.ts` (allocated is 0 at the starts). Re-run: the old one-at-a-time loop fails the STR max `[+1, −1]` row. Still green: dropping the inner `saturate(sum)`. That only matters when a sum goes past the ResourceInt range, so no finding.
3. nit, fixed: `docs/system/cartridge.md:415` now says "no statuses".

Runs at the head: `node --test test/power.test.ts` 5 pass; `npm run typecheck` 0. Hosted ci and book-e2e green on `e9eb4400` (`gh run list --commit`).
