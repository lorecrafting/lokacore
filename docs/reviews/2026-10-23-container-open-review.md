# Review: containers start closed, Open reveals contents (loka-x6t.121 slices 1-2, PR #463)

- Branch `toolbox/batch-container-open`, reviewed head `7117731b241189da067aea102a47c0c6290131b3`. The announced follow-up (SILENT `close` scoped to lidded cartridges, open-lid save/load test) was not pushed when this review was done. It gets a check of its commits only.
- Governing: [docs/briefs/container-open/README.md](../briefs/container-open/README.md), [book-ui.md](../system/book-ui.md) (lid paragraph), AGENTS.md "Writing tests", [WORKFLOW review stance](../WORKFLOW.md), [two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md).
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- Verdict: **CHANGES REQUIRED**.

## Must be true (written before reading the diff)

1. Each lidded container (seed sack, hoard_chest, strongroom_chest, chandler `crate`, yard_crate) starts closed through a barrier lid with no key. Unlidded containers stay open.
2. A closed lid hides the contents. Take refuses with `not_present` and Put refuses with `exit_closed`. Open reveals the contents.
3. The shop still sells and restocks with the crate closed.
4. Every test, route, story, walk and walk doc that reads these containers opens them first.
5. Hash and transcript re-pins come from the content change only.
6. An open lid persists across save and load.
7. Hosted CI is green on the head.

1, 2, 3 and 5 hold. 6 holds by evidence: the checkpoint row in `sack-contents.sql` stores `"open"`, but no test pins it. 4 and 7 do not hold.

## Findings

1. **Blocker**, `mobile/app/walkthrough/toolbox_showcase.walk.ts:165`. The walk taps `strongroom chest, open` and then expects `Put a tallow candle`, but the chest is now closed. Hosted `book-e2e` run 40072380607 dead-ends: "no /^Put a tallow candle/; buttons: Open a strongroom chest | Leave". Fix: tap `Open a strongroom chest` first.
2. **Blocker**, `mobile/app/stories/Live.stories.tsx:110`. The SackContents play taps `Open a seed sack`. The `sack-contents` checkpoint (`mobile/app/stories/routes.ts`) now opens the sack itself, so no Open card is shown. `book-e2e` run 40072380607: "Unable to find a label with the text of: Open a seed sack". Fix: drop the tap from the story, or drop the Open step from the route checkpoint.
3. **Blocker**, `mobile/authority/local-story/food.test.ts:36`. The test does `put` into the chandler `crate`, which is now closed, and gets `exit_closed`. Hosted `ci` run 40072380575, job mobile. Fix: invoke `open` on the crate before `put`.
4. **Should-fix**, `kernel/ts/test/showcase_economy.test.ts:1`. The size allowance is raised from 585 to 650. The stated reason is shared Undercroft helpers, but the new growth is two lid tests, and one of them is a homestead test. A split costs no shared code. Fix: move both lid tests to their own file (for example `showcase_lids.test.ts`) and restore 585.
5. **Should-fix**, `docs/showcase/economy-law-district.md:136` (step 8, Put the knife in the chest) and `docs/showcase/homestead-district.md:194` (step 13, seed into the plot). Neither step tells the player to open the lid, so a player following the doc gets refused. Fix: add the Open steps.
6. **Should-fix**, save/load. No test reopens a saved world with the lid open. The follow-up says it adds one; it will be verified in the commits-only check.
7. **Nit**, `kernel/ts/test/showcase_economy.test.ts` ("the crate and the hoard chest start closed"). The assertion on `cartridge.barriers[...].initial === 'closed'` reads compiled config and adds nothing beyond the behaviour checks in the same test. It is close to a change detector; remove it.

No finding:
- The shop: replenish uses `item.move`, economy 5 passes with the crate closed, and buying comes from the chandler's custody.
- `item-too-heavy` no longer shows Inside. This is intended.
- The re-pins: 7 transcripts change the sha only, live `.sql` files change the sha only except the `sack-contents` open-lid row, `system-graph.gen.json` adds 5 barrier paths, and the hash changes `f9ca0707…` → `d2e12675…`.
- SILENT `close` (`kernel/ts/test/sim_batch.ts:112`) is acceptable because the baseline is at its cap. The follow-up narrows its scope.

## Checks run

- Local runs at the head, all exit 0 (`nice -n 10`): `showcase_economy`, `showcase_homestead`, transcripts, sim_narration and locks tests, `mobile` `stories.test.ts`, `mix test test/loka/content_showcase_test.exs`.
- Mutants, each regenerated and each killed (economy and homestead tests red): `hoard_chest_lid` initial open, `crate_lid` initial open, sack barrier removed.
- Hosted CI on the head: `ci` failure (mobile, finding 3), `book-e2e` failure (findings 1 and 2), graph-diff success, sim (showcase) and sim (fresh) success.
- The PR body reports `/code-review medium`. It lists the row 7 screenshots (390 px) as not done.
