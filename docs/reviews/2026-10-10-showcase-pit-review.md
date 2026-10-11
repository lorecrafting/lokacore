# Review: showcase goblin pit, combat step 9 (PR #376, loka-y6yg.10)

- PR #376, branch `toolbox/showcase-pit`, head `b9e60232a1e77d96e5f03697c00c15bb72a3d1a2`. Hosted ci, book-e2e and graph-diff succeed at this head.
- Governing: [combat-district.md](../showcase/combat-district.md) step 9 (row at :182), "NPCs, items, dialogues, reactions" (goblins, `boar_gore`), "Manifest changes", the "Built" section; [SHOWCASE.md](../SHOWCASE.md) matrix row.
- Verdict: **APPROVE WITH NOTES** (two nits, no blocker, no should-fix).

## Must be true

1. Step 9 numbers as the plan gives them: the first Attack shows `helper_joined`. The second shows `primary_changed` and plays no round (clock and rng unchanged). Rounds give B 3 and hp 5; then B dies, hp 4, experience stays 60 (loka-lpq6); then A 3, hp 3; then A dies, hp 2, experience 70 and the encounter closes. Without the switch the first blow lands on A.
2. The manifest has `population` 1, `target_choice` true and `kills` goblin 10. The goblin template, bundle and plan match the plan.
3. The held-back tilt pack leaves no signpost or text promise.
4. No reaction keyed on combat events can fire in a room the pack can reach (`goblin_pit`, `drill_yard`, and its flight exits).
5. The hash fixture equals the compiler output.

## Proof

- (1, 2) `showcase_combat.test.ts` combat 9 pins every number above, with expected values from the plan row. The named files (`showcase_combat`, `showcase_world`, `sim`), `npm run typecheck` and `content_showcase_test.exs` pass at the head.
- (3) In `text.json` only `sign_combat`, `sign_hub` and the ear keys name goblins or a pack. `sign_combat` still says the tilt yard "has a second boar, a poultice and a draught". `SHOWCASE.md` has no tilt row.
- (4) `boar_gore` is the only reaction on `attack_result`. Its `npc_present` holds only in the actor's room (`policy.ts:169`, schema text). `boar` and `tilt_boar` have only a fixed `room`: no schedule, patrol or population. The pack's area is `[goblin_pit, drill_yard]`. Flight stays inside it: when `enemy_fled.south` is removed, the loader refuses the plan (`SCHEMA_VIOLATION populations/goblins.pack.narration`). Neither room has a tag, so the `*_hour` reactions cannot fire there. No other reaction names these rooms.
- (5) Regenerated with `mix loka.compile` on the clean tree: sha `eecab2c2…`, `git diff --quiet protocol/` clean.
- Red controls (content mutants, recompiled, combat 9 run each time). Removing `target_choice` turns combat 9 red. Removing the goblin `kills` entry turns it red. Goblin damage 2 turns it red. The first two rerun the PR body's claims, and the reruns back them.
- Deviation probe: `wander_interval` = `replacement_delay` = 86400 (legal: the TS check at `cartridge_population.ts:90` and `population.ex:71` agree). It keeps combat 9 green, so no test pins "never wanders". The trade-off: a daily interval puts goblins in `drill_yard` in free play (cosmetic: the yard is outside `boar_gore`'s reach) and brings a killed pack back the next day. The 100-day delay keeps the plan's "never wanders in play". For a one-pass showcase this is the safer choice. Accepted, no finding.

## Findings

1. nit, PR #376 body: no developer `/code-review` result is reported. Run it in the fix round, or record that it was run.
2. nit, `docs/showcase/combat-district.md:196`: the tilt pack is gated on `loka-kgd.79`. But the issue for this PR (`loka-y6yg.10`, titled "goblin pit + tilt yard sandbox pack") closes when it merges, and `loka-kgd.79` does not mention the tilt pack. Once `loka-kgd.79` lands, no open issue asks for `tilt_goblins`. File a follow-up blocked on `loka-kgd.79`, or add a note to that issue.

## Disposition

Mergeable as is. Both nits are Beads and PR-body actions; no code change is needed.
