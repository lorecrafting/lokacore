# Review: M9b toolbox row 17, ranged first strike (loka-kgd.110)

- Branch `toolbox/m9b-ranged`, head `93122bf523a8fe4e795ad1d23574df7f638a5f54`, diffed against `d461c38e` (`toolbox/batch-m9b`). No PR (batch model). `kernel_api` 1.67 provisional (PM at merge).
- Governing: [Ranged first strike](../system/mechanics.md#ranged-first-strike-toolbox-row-17) and [Ranged weapon declarations](../system/cartridge.md#ranged-weapon-declarations) (added here), [combat@1](../system/mechanics.md#combat1--first-live-encounter-m6-a), toolbox row 17, owner answer 2 ([record](../decisions/owner-decision-mechanics-toolbox-2026-10-08.md#answers-to-the-open-questions)), [world parameters](../decisions/owner-decision-world-parameters-2026-10-02.md), brief and PM rulings in Beads `loka-kgd.110` (ammo is a pool until `loka-kgd.83`; the shot applies whoever opened the fight; a ranged weapon never strikes in melee). Not reopened.
- Hosted `ci` and `book-e2e` green on the head (`gh run list --commit`, reviewer).
- Verdict: **APPROVE WITH NOTES** (no blocker, no should-fix; two nits).
- Written 2026-10-12 05:08 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. A shot only in round 1, only with a wielded `weapon.ranged`, usable skill, at least 1 in the ammo pool, standing and `statusAllows` attack; it uses the weapon's profile plus row 2 bonuses.
2. A shot spends exactly one ammo by an existing `resource.adjust`; no new op, event, job or save row; no RNG at Attack; budget unchanged.
3. The foe's round-1 opportunity is skipped iff the shot happened (hit or miss), in the ordinary round and for the pack's selected member; order, cursor, successor and ally turn unchanged.
4. After round 1, or without a shot, a ranged weapon never strikes (unarmed profile, no materials).
5. Any opener (Attack, engage, spell `fightBack`) gets it; both loaders refuse ranged below 1.67, without `shot_hit`/`shot_miss`, or with an unknown pool; Chapter 1 and other samplers unchanged; numbers live in the cartridge.

## Proof

- Focused runs green at head: TS `ranged`, `damage`, `combat`, `c4_pack`, `targets`, `combat_content` (47 pass); Elixir `content_ranged_test`, `content_combat_test`, `content_damage_test` (7 pass).
- Mutants (reverted), each red on `ranged.test.ts`: `r.shot ||` dropped from the pack skip (`round_flow.ts:134`); `row.round === 1` to `<= 2` and `>= 1` to `>= 0` (`round_attack.ts:241`); `usable && (!ammo || shot)` to `usable` (`round_attack.ts:244`); `r.shot` dropped from `narrate` (`round.ts:96`); TS floor `1.67` to `1.66` (`cartridge_combat.ts:85`). Elixir (`mix test --force`): floor `[1, 67]` to `[1, 66]` and `shot_miss` dropped (`combat.ex:109-115`) red.
- Probes (scratch, deleted): pack round 2 and 3 strike unarmed with arrows kept at 1 (point 4 in a pack; the gate is shared in `attackProfile`, so no pack-only mutant exists); `validate('GameView')` is `[]` with the bow wielded and `ranged` present; loader gives UNKNOWN_FIELD for an extra `ranged` member, SCHEMA_VIOLATION for missing `ammo`, UNRESOLVED_REFERENCE for an `item`-kind ammo ref.
- Developer claim rerun: removing `additionalProperties: false` (`entity.schema.json:1102`) does **not** survive: `elixir bin/contracts.exs` and the Elixir compile fail ("outside the schema subset"). See nit 2.
- Developer-noted items judged: GameView copies the weapon and `gameview.schema.json:490,632` refs `WeaponProfile`, so `ranged.ammo` is schema-covered, no GameView code changed, other cartridges unchanged: no finding. The Elixir clause `%{"ammo" => a}` (`checks.ex:275`) matches any string `ammo`, as `scene` and `liquid_source` already do; `ammo` is the only such schema field and text is not expanded: no finding.
- Edges: spell `fightBack` and engage open at `round` 1 through the same path (no new branch); pack skip includes flight, as the spec states. World numbers: chance, damage, pool size and text are content; one ammo per shot is the mechanic's unit (spec-fixed, as one item under `loka-kgd.83` would be), not a world parameter.
- Fixtures: two new `invalid.json` cases; no expected answer or frozen fixture changed. Tests use hand-checked sampler literals.

## Findings

1. **nit**, Beads `loka-kgd.110` handoff comment (no PR): the developer's `/code-review` result is not recorded. Fix: add it to the handoff note.
2. **nit**, Beads `loka-kgd.110` handoff ("removing additionalProperties survives in TS"): the mutant is killed by the schema subset (`bin/contracts.exs`, Elixir compile). Fix: correct the claim; no code change.
