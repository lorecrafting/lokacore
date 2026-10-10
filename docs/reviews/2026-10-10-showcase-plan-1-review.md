# Review: showcase plan 1, hub, body, world and social districts (loka-y6yg, PR #364)

- PR #364, branch `docs/showcase-plan-1`, head `9d4ae991b1b2fbaca87f8ca078f0182ea41e96b0`; docs only. Checked against `origin/toolbox/batch-m6` `4207a0ba` (PR #363). Record kept at the PM's request.
- Governing: [SHOWCASE.md](../SHOWCASE.md#how-a-batch-adds-a-district), [owner decision](../decisions/owner-decision-showcase-2026-10-10.md), the [mechanics.md](../system/mechanics.md) rows the brief cites.
- `elixir bin/check_docs.exs`: 0 broken. Hosted CI on the head: ci `38083350022`, book-e2e `38083350046`, graph-diff `38083354108`, all success.
- Verdict: **CHANGES REQUIRED**: two blockers, seven should-fix, five nits.

## Must be true

1. Every field and behaviour the brief names exists on main + M6 with that meaning.
2. Each guided step's expected outcome follows from the engine rules, so a test can assert it.
3. Each step names a matrix row that exists; slice A builds and passes alone, and slice B does not break it.
4. Nothing needs M7 rows or engine work nobody has filed.

## Findings (brief = `docs/showcase/hub-and-first-districts.md`)

1. **Blocker, brief:295-298, 327, 356.** `wat_letter` is gated on `quest_state objectives_complete`, but a `current_state` objective is never stored. Only `post_activation_event` completes the quest (mechanics.md quest@1; `quest/lifecycle.ts:193,216`; `policy.ts:57` reads the stored state). As written, Wat never offers the talk, so steps 12 and 13 cannot run, and step 10's "objectives_complete on the take" is wrong. The step 10 hints are wrong as well: while the letter is held, the Journal shows the `objectives_met` stage, so the active hints at 5 and 10 minutes never show (W23 known limit). Fix: either objective `post_activation_event {item_acquired: letter}`, or gate on `active` as `ashmere_scene/dialogues/bram.json` does, then restate step 10.
2. **Blocker, brief:279-282, 354.** In `nell_rumour`, the checked choice `press` assigns the topic fact `topic_fire_known` inside a two-choice hub dialogue. The compiler rejects this with `OUTCOME_MISMATCH` (`cartridge_dialogues.ts` `once()`; the check is not exempt). I reproduced it: `persuade_sampler` plus a player-bool topic fact assigned by its checked choice gives `OUTCOME_MISMATCH dialogues/guard.choices.persuade.sequence[0].op`. Fix: make `nell_rumour` single-choice (`press` only, policy also `not topic_fire_known`), or grant the topic from a reaction on `check_passed {check: press_nell}`.
3. **Should-fix, brief:330, 358.** The quest's journal `outcomes` `delivered`/`burned` never match. The dialogue resolves the quest with the choice id as its outcome (`dialogue/rule.ts:211`), so the outcomes are `deliver` and `burn`, and the Journal falls back to the `resolved` text. Rename the keys.
4. **Should-fix, brief:65-66, 84.** Slice A's hub has the exit south to `village_green`, a room slice A does not define, so the build fails with `UNRESOLVED_REFERENCE`, and "lists three exits" is false in slice A. Slice B should add the south exit.
5. **Should-fix, brief:47, 276, 347.** No currency pool exists. Nell's shop needs one (Peg uses `pennies`, start 10, `standing_sampler/resources.json`). Without it, step 1 "Costs 4" cannot be bought.
6. **Should-fix, brief:360; SHOWCASE.md row "deadlines x schedules x away recap".** Two problems:
   - Nothing produces "the quest's late outcome line": the deadline job carries no narration (`quest/job.ts:33`), and reactions have no narration field.
   - The recap block is Book-side (`mobile/app/book/recap.ts`, pinned in `mobile/app/book/recap.test.ts`). The kernel only pins `recap_after` (`recap_after.test.ts`), so `showcase_social.test.ts` cannot hold this cell.

   Fix: drop the late line and pin the cell in a Book test.
7. **Should-fix, brief:229-230, 292-294, 309-312.** Once slice B adds Tam, one `wait` that crosses his 10:00 mill entry on two days faults `conflicting_write` (open bug loka-j2mo). Reproduced on `rumour_sampler`: a wait from 15:00 day 1 to 16:30 day 2 faults on `knows_mill`, and the same span split at 16:30 day 1 is accepted. World step 8 (a winter day, day 7) and step 9 (day 3) then fail. Fix: the brief names loka-j2mo and requires waits of at most one day until it is fixed.
8. **Should-fix, brief:182, 184, 187 with 127-133, 228.** `shore_steps`, `cliff_top` and `tide_pools` are tagged `exposed`, and the `clock_hour` exposure and drought rules take no room. On a frost, rain, gale, heat or drought day, the step 7 wait from 12:00 to 20:00 on the shore applies a condition, which breaks the hp 7 and other expected outcomes. Fix: either pin a `clear` day for the world tests or drop the tag.
9. **Should-fix, brief:207-209, 223, 190-191, 232-234.** Description variants are first-match. On `shore_steps` the season variants always match, so the rain variant and the high-tide variant that step 2 expects can never show. The `tide_pools` sandbox's "one variant per weather, season and tide phase" can only ever show the weather variant. Fix: order the variants (tier, then high tide, then the rest) or combine them with `all`.

### Nits
- brief:132: `entity_entered_room` requires `room` (reaction@1 table), so `the_fold` needs its own rules; the "room omitted" option does not exist.
- brief:34-38: the capability list lacks `behavior` (schedules) and `combat` (the Warden's `attack` and `engage`).
- brief:158: "mv +5" holds only if mv is below 100. Bread at the pool maximum restores nothing (row 1), and moves cost 1 mv while regeneration refills it. State mv, or drop the number.
- Step labels brief:227, 351, 353, 354 ("visit tiers", "dialogue checks", "locks (pick and force)", "schedule cases x sky") name no matrix row; add the rows or use existing ones.
- The PR body has no `/code-review` result (run it in the fix round).

## Open questions, answered
- hp floor 1: fine. A fall stops at 1 (row 30), and ticks saturate at the pool minimum (row 1).
- `time_window` wraps: the schema says "wrapping at day end", and `policy.ts:60` implements it. `{from: 20, to: 5}` is valid; `{20, 23}` means 20:00 to 22:59.
- Chilled arithmetic checks out under row 1 (a refresh moves only `ends_at`): ticks at 09:00 (hp 9) and 11:00 (hp 8), refreshes at 08:00 and 09:00, end 41400 (11:30), expiry with no cure.

## Scope
No M7 row is needed: the Warden's engage uses combat@1 and G11, both installed. The only engine dependency is loka-j2mo (finding 7), which is filed. Other spot checks pass on M6: garment tags and `wearing`, `status_active`, `npc` entrant filter, `modifies`, deadline `after`, dialogue `check` with `rating`/`npc`, `fact_compare {npc}`, topics and deductions, `recap_after_minutes`, `schedule_cases`, `hidden_until`, `climb`, `sky` four fields, `visited_count`, `alternates`, `opens_when`, `buy_discount.friendly`, `disposition`.
