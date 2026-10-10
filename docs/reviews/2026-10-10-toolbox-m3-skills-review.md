# Review: skill growth by use and opposed checks, toolbox rows 5 and G5 (loka-kgd.19)

- Local branch `toolbox/m3-skills`, head `b7bce05ef80bd6a260fe3ade70402ce8622f5faa`, diff `origin/toolbox/batch-m3...b7bce05e` (32 files); joins draft batch PR #351. Protocol change (action, cartridge and room schemas, invalid fixtures), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox rows 5, G5, slice process and traps](../MECHANICS-TOOLBOX.md#toolbox-slice-process), [leaf-set rule](../system/mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1), [mechanics.md rows 5 and G5](../system/mechanics.md#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5), brief in Beads `loka-kgd.19`.
- Hosted CI on the head: ci 38027765942 and book-e2e 38027765924, both success.
- Verdict: **CHANGES REQUIRED** (one blocker: a mutant survives).

## Must be true

1. Five pick attempts raise `pick` until a harder lock opens; skill 5 passes a target rated 3 and fails one rated 7.
2. The opposed check draws no RNG; the level it reads is derived (taught base plus thresholds reached) and read before this attempt's use.
3. The use count is written only by skills@1 in both kernels; authored writes are refused; it stops at the last authored threshold (trap 6: no grind beyond authored ratings).
4. Every new field (`growth`, `rating`, `opposed`) has Elixir compiler parity, an API floor and invalid fixtures; opt-in, so Chapter 1 and corpus bytes do not change.
5. No new leaf unless a consumer needs it (G1 rule); mechanics.md section, composition record and rows flipped.

## Proof

- Baseline: `skill_growth.test.ts` 2 pass; `content_skill_growth_test.exs` 1 pass.
- Mutants caught: B, cap `>=` to `>` in `practised` (TS red); C, Elixir growth-order check removed in `skills.ex` (red); D, `uses_` dropped from the loader's reserved set in `cartridge_position.ts` (red on the RESERVED_FACT row). B and C rerun two of the tests' "Breaks:" claims; both hold.
- Mutant survived: A, `Number(membership(...)) +` deleted from `level()`.
- Corpus: no cartridge but `skills_sampler` in the diffstat; the widened `Checks.expand` clause keeps `attribute_threshold` behaviour.

## Findings

1. **Blocker.** `kernel/ts/src/mechanics/skills.ts:25`: the taught base (+1 for `skill_<key>`) is untested. Mutant A stays green because the sampler never teaches `pick`. Failure: a regression that drops the base makes a taught level-5 picker read 5 instead of 6, and nothing fails. Fix: one case with `pick` acquired, where the gate (rating 5) opens one attempt earlier, on the fifth.
2. **Nit.** `docs/system/mechanics.md:1797`: "counts that reach levels 2, 3 and so on above the base" is true only when the skill is taught. For the sampler's untaught actor they reach levels 1 to 5.
3. **Nit.** The developer's `/code-review` result is not reported. #351 lists kgd.19 only as "Coming"; add the result when the item joins the batch body.
4. **Question (not a finding against this slice).** Ancestry `faction` (`attributes/rule.ts:36`) and exchange `faction`/`contribution` are outside the compile-time write walk (`cartridge_position.ts` `writes`, `position.ex`). Their runtime `ownership()` refuses `uses_<key>` with precondition_failed, so the count stays unwritable. But an ancestry whose faction names `uses_pick` (a player int) compiles, then refuses `choose_ancestry` at runtime. The gap already existed for every reserved fact. Suggest a Beads follow-up, not a fix here.

## Decisions judged

- Count as reserved fact `uses_<key>`: sound. It is refused in authored recipe, reaction, dialogue and scene writes (both kernels' walk) and at runtime by `ownership()`. `skills-save.ts` matches only `skill_` keys. Its `fact_changed` is the same as `skill_<key>`'s today, so W1 adds no new exposure.
- Untaught growth by practice: matches the row 5 acceptance (sampler untaught). It is capped at the last threshold. Authors gate teaching through recipe policies.
- `opposed` without RNG, no `skill_compare` leaf (no consumer, G1 rule), 1.44 floor (PM ruling), Book half deferred to loka-kgd.23: accepted.
