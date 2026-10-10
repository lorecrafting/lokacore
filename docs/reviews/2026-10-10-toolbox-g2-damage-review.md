# Review: damage kinds, resistances and critical hits, toolbox row G2 (loka-kgd.18)

- Branch `toolbox/m3-damage`, head `da0ee8f6094495b98cc2386c76047f3dba15804c`, diff `716f1ecb...da0ee8f6` (23 files); no PR yet (joins #351). Protocol schema and `kernel_api` change, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row G2 and slice process](../MECHANICS-TOOLBOX.md#toolbox-slice-process), [mechanics.md G1 tags](../system/mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1), brief and PM rulings in Beads `loka-kgd.18`.
- Hosted CI on the head: ci and book-e2e, both success.
- Verdict: **CHANGES REQUIRED** (two should-fix).

## Must be true

1. A crit is decided inside the round's 8-draw budget; a seeded fight shows one doubled hit at the fixed chance.
2. Resistances are per NPC definition and per kind, in percent, clamped; silver and iron against one fire-resistant wight give hand-fixed HP.
3. Material comes from the wielded item, and only when the striking profile is that item's own attack (PM ruling).
4. Opt-in: Chapter 1 and the corpus are unchanged.
5. Elixir compiler parity, and a `kernel_api` 1.44 floor at every new field site in both kernels, each site with a red test.

## Proof

- Focused runs green: `damage`, `combat`, `combat_content`, `combat_contracts`, `loot` and `tags` (TS); `content_damage`, `content_combat`, `content_loot`, `content_tags` and `content_chapters` (Elixir).
- HP numbers checked by hand: 18, 15, 15/10, 19/17, clamps 20/10. The seeded fight 15, 5, 0 also checks out. An independent Python xoshiro128** gives first rolls 60, 0, 9 and 10, and the fight sequence 49, 64, 27, 6, 90.
- Mutants caught: M1, crit `<` changed to `<=`; M2, the upper clamp dropped.
- **Mutant survived:** M3, `...items` dropped from the loader floor (`cartridge_combat.ts:41`). `damage.test.ts` stays green.
- Opt-in: the diff touches only `cartridges/damage_sampler`, and `cartridge_chapters_hash.json` is unchanged.
- Fixtures: the four `silver`→`gold` rows keep their `not_in_enum` intent, because `silver` is now legal.
- Trial merge into `a4c01778`: 4 files conflict, all of them append-at-tail or generated.
  - `invalid.json`: 8 hunks, skills rows against G2 rows.
  - `mechanics.md` and `cartridge.md`: 1 hunk each, both tail sections.
  - `system-graph.gen.json`: regenerate it.
  - No conflict in the combat code. The `status()` signature is unchanged, and both sides set `kernel_api` 1.44 (PM: shared).

## Findings

1. **should-fix**, `kernel/ts/src/mechanics/combat/round_attack.ts:219-224`: `tags: wielded?.tags` is added to whichever profile strikes, but the ternary already tells `weapon.attack` apart from `player_attack`.
   - Failure: a player wields a silver item with no `weapon` block, or with an unusable skill, and punches. The wight still takes silver -50, which the PM ruling forbids.
   - The sampler depends on this. `items/silver_sword.json` and `iron_sword.json` have no `weapon` block, so the silver-vs-iron acceptance runs on `player_attack`.
   - Fix all of these:
     - put tags only on the weapon branch;
     - give both swords `weapon` blocks with a usable skill;
     - recheck the HP rows;
     - update `mechanics.md:1800` ("whichever profile strikes") and the `Resistances` description at `protocol/entity.schema.json:362`;
     - add one unarmed-or-unskilled-with-silver row that expects the iron result.
2. **should-fix**, `kernel/ts/src/content/cartridge_combat.ts:41`: the TS floor for `weapon.attack` has no red test (M3 green; this is the developer's open item). Failure: a refactor drops the item site, and a 1.43 artifact with a weapon `kind` or `crit` loads. Fix: add one loader row in `damage.test.ts`; it is cheap once the swords carry real weapon profiles.
3. **nit**: no `/code-review` result is reported; carry it into the #351 body.
4. **nit**: `docs/MECHANICS-TOOLBOX.md:87`: the row status was not flipped. The slice process puts the flip in the same PR.

## Re-check: fix round 1 (head `120c9d6d709673f36f6087272bfacceaa5d578bc`)

Scope: fix commit `120c9d6d` and merge `b8ba3dde` (from `a4c01778`). Hosted ci and book-e2e are green (per PM).

- Verdict: **APPROVED**.
- **Finding 1 fixed.** `round_attack.ts:220-223`: tags now ride only on `{...weapon.attack, tags}`, and the unarmed branch returns `player_attack` bare. The `mechanics.md` Material bullet and the `Resistances` description now match. The farmer + silver row (expected 18) catches the old behaviour, which would give 15. Red control M4 (tags put back on the unarmed profile) fails `damage.test.ts`.
- **Finding 2 fixed.** Loader rows each add one G2 field to a stripped sampler, including weapon kind and weapon crit. M3 (`...items` dropped, `cartridge_combat.ts:41`) now fails. The Elixir twin works too: M5 (`weapon_attacks` dropped, `combat.ex`) fails `content_damage_test.exs` (0/1).
- **Ancestry deviation accepted.** `choose_ancestry` (fighter knows `swords`, farmer does not) reuses an existing mechanic to make the weapon skill unusable. It affects only the sampler. HP rows are unchanged because the swords mirror the unarmed profile.
- **Merge kept both sides.**
  - `invalid.json` has 792 cases. That is 752 at base, plus 26 from the batch and 14 from G2. The four `*_tag_unknown` cases use `gold`.
  - The `mechanics.md` and `cartridge.md` diffs against `a4c01778` are pure additions (the G2 sections). The only removed line is the Tags bullet, replaced by the version that adds `silver`.
- **Focused tests green:**
  - TS: damage, combat, combat_content, combat_contracts, loot, tags, skill_growth, reactions_sampler, contracts.
  - Elixir: content_damage, content_combat, content_tags, content_chapters, content_skill_growth.
- Nits 3 and 4 remain open for #351 (`/code-review` result, row status flip).
