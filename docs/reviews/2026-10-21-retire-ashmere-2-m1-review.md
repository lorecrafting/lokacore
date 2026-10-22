# Review: Retire Ashmere 2, M1 delete bell/finale save code (loka-4hik.9)

- Branch `retire/ashmere-2-m1`, exact commit `108ce16d5e767a4ef1bc500e733d7cbe6454e31e`, base `f366e22ea4ce2b09bbaacdc8af5ab6657ac02d9f` (three-dot diff; the branch merges L3).
- Governing: [plan README](../briefs/retire-ashmere-2/README.md) (owner, quoted: "Fully gone now"), [full-plan.md](../briefs/retire-ashmere-2/full-plan.md) slice row M1 and its psv rows, [AGENTS.md pre-production](../../AGENTS.md) (save integrity, no silent save deletion), [Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent).
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- **Verdict: APPROVE WITH NOTES**

## Must be true (written before the diff)

1. The shipped app cannot open a save that bellSave or finaleSave validated. Release opens one fixed file pinned to the showcase hash, and the showcase has none of their keys.
2. For non-Ashmere content, `dialogueSave` and `receiptRecovery` behave as before. Only the bell/finale delegates and their exemptions go. No generic check is lost.
3. The exact Continue replay guard (`invocation.ts:57`) gets a test on scene_sampler that fails when the guard is broken. The guard moves before r9c_custody_terminal is deleted.
4. The retargeted tests (quest_started_at, detail_scene) take expected values from literals or the inline fragment, not from a kernel run.
5. No live import of a deleted module remains. Hosted CI is green on the head.

## Checks run

- 1 holds. `mobile/app/App.tsx:22` bundles `toolbox_showcase_hash.json`. `:47` uses the release name `loka-showcase.db`. `session.ts:93` opens only `{content_hash: bundled.sha256}`. `toolbox_showcase_hash.json` has 0 hits for `bell_of_ashmere`, `missing_child`, `prologue_completed`, `village_child_status` and `chapel_bell_rung`. The deleted guards returned at once without those keys: `bell-save.ts:13` and `finale-save.ts:164` at base.
- 2 holds. `lost` was always false for non-Ashmere content, so dropping it from `dialogue-save.ts:169,198` leaves the same check, and the check is now unconditional. `finaleSave` was a no-op without `prologue_completed`.
- 3 holds. Mutant A, `invocation.ts:57` `old = i.action_key === 'continue' ? undefined : receipt(...)`: killed at `scene.test.ts:130` (the replay loop; it fails with a UNIQUE receipt insert).
- Mutant C, drop `recipe.target.detail !== on.detail` (`cartridge_scenes.ts:75`): killed by `detail_scene.test.ts` test 1.
- Mutant D, `scene/shared.ts:64` `s.on.detail === undefined ||` -> `true ||`: survives `detail_scene.test.ts`. This is expected; see finding 3.
- quest_started_at was not run (two-file cap). By reading, the expected values are literals and `w.changes === 1` is asserted. `reopen(clock)` open and `reopen(clock + 1)` save_corrupt bracket `store.ts:155`, so an off-by-one or a dropped check fails.
- 5 holds. The grep for deleted module names finds comments only (finding 2). Hosted `ci` 39714739259 and `book-e2e` 39714739215 are success on `108ce16d`.
- Claim rerun: the handback's "Continue-replay guard in scene.test.ts:130 (red)" is backed (mutant A). The commit claim "exclusivity mutant caught by facts.test.ts:133" was checked only by reading: that test covers `all`/`any`/`not` over facts. It was not run.

## Findings

1. **nit**, loka-4hik.9 handback: it does not report the `/code-review medium` result the brief requires. Add it in the fix round or at merge.
2. **nit**, `mobile/authority/local-story/r9c_faults.test.ts:212,240,249` and `r9c_creatures_transport.test.ts:269` cite the deleted `r9c_custody_terminal.test.ts` and `bell_receipts.test.ts`. Slice Z deletes both files. No action unless Z slips.
3. **No home: scene trigger detail match** (`kernel/ts/src/mechanics/scene/shared.ts:64`). The rule is universal, but loaded content cannot reach a mismatch: the loader refuses `on.detail` other than the recipe's target detail (`cartridge_scenes.ts:75`, killed above). A test would have to step a cartridge the loader refuses. Do not add a test now. If the PM wants it, a Beads note can decide whether to keep the clause as defence in depth.
4. **No home: one report after reopening past the final acknowledgement.** This is already covered by composition: `story_points.test.ts:165` (captured once, survives restart, a replay adds no second report) and `detail_scene.test.ts` test 2 (one `story_point_reached` at the final acknowledgement). Report capture does not depend on the scene. No new test.
