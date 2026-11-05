# Review: retire hunger and thirst (PR #618, loka-vduxr.61)

- PR: [#618](https://github.com/lorecrafting/lokacore/pull/618), branch `toolbox/retire-hunger`
- Reviewed commit: `690143828a7c0653d9af1d8a4b26b99410661002`
- Reviewer docs push (small should-fix, PM ruling 2): `755a23712` (docs only; CI for that head not reported here)
- Governing: [WORKFLOW review stance](../WORKFLOW.md), [mechanics.md Consume](../system/mechanics.md), [MECHANICS-TOOLBOX G13, W25](../MECHANICS-TOOLBOX.md), owner words in Beads `loka-vduxr.61`
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 690143828a7c...`): ci success, book-e2e success, graph-diff success.
- `/code-review`: reported in the PR body.

## Must be true (written before the diff)

1. No cartridge declares a hunger or thirst pool; a guard fails if one returns.
2. Bread gives `well_fed` (hp +1, mv +5 per 1200 for 3600); stew a longer `well_fed`; water gives `refreshed`.
3. Labels `condition.well_fed` and `condition.refreshed` match `statusGlyphs.ts` on `polish/status-icons`.
4. Potion and liquid cures still resolve and still work.
5. G13 and W25 dry are marked retired with the owner's words; the old sampler moves to a test fixture with no live pointer to the old path.

## Checks that held

- `fed.test.ts`: tick counts follow "tick strictly before ends_at" (3600/1200 = 2, 7200/1200 = 5); expected values are hand-computed.
- Labels: `statusGlyphs.ts` lines 22 and 50 on `origin/polish/status-icons`.
- Guard red control: a planted `thirst` pool in `buffs_sampler/resources.json` failed `content_no_needs_test.exs`; reverted.
- Cures: bitters (showcase_traps) and salve (scars) pass; `content_liquid_cures_test.exs` still rejects an unresolved cure.
- `test/fixtures/drain_cartridge/needs_sampler`: matches the `test/fixtures/reward_storage` precedent; no `cartridges/needs_sampler` path remains.
- check_docs: 880 docs, 0 broken; regen clean.

## Mutants

`bin/mutate_diff.sh origin/main`: 0 mutants, matching the handback. Hand mutants against `fed.test.ts`, all red: `now >=` to `now >` in job.ts (3/3 fail); tick only the first pool (2/3); `refreshed` resource mv to hp (1/3).

## Findings

- Nit (author-side guard): `test/loka/content_no_needs_test.exs:7` checks only `resources.json` and only the names hunger and thirst; a pool renamed `food` would pass. Owner rule: author-side guards are nits.

## Stale claims (other slices, PM ruling 3; not fixed here)

- `docs/design/status-line-rulings.md:3,19,26`; `mobile/app/stories/StatusLine.stories.tsx:261,268`; `mobile/app/book/combat.test.ts:17,49`
- `docs/world-parameters.md:38` (W12)
- `cartridges/toolbox_showcase/text.json:1461` and `docs/showcase/hub-and-first-districts.md:79` (hub sign "hunger", owner prose)
- `docs/briefs/aimed-targets/README.md:55-56`; `docs/design/effects-and-sound-plan.md:345`; `docs/design/provisional-story-mechanics.md:172-173`; `docs/game-design/abilities-design-2026-10-23.md:372`

## Verdict

APPROVE WITH NOTES.
