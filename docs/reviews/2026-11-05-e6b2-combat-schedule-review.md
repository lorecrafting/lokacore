# Review: Editor E6b.2, bespoke Combat and Schedule blocks (PR #672, loka-wfrgk.42)

- PR: [#672](https://github.com/lorecrafting/lokacore/pull/672), branch `editor/e6b2-combat-schedule`
- Reviewed commit: `e85c3a4a810019aa35f135ffcc313235861008f7`
- Governing: [gui-editor design §4.2, §4.3 and §7](../rnd/gui-editor-design-2026-11-04.md), [E6b review finding 3](2026-11-05-e6b-npc-item-review.md) (offer only what compiles, express all the compiler accepts), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at the reviewed head (`gh run list --commit e85c3a4a...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body; the disputed double-commit finding is ruled below.
- Merge: a trial merge with origin/main `f74802703` is clean.

## Verdict: CHANGES REQUIRED (two should-fixes, no blockers)

## Must be true (written before the diff)

1. The Combat block draws hp, attack and weapon next to this NPC's fight rows (§4.2).
2. The Schedule block lists hours down the side, with a real-room picker per hour and a `when` per case (§4.3).
3. The card offers only what compiles, and it still expresses everything the compiler accepts.
4. A baseline line is removed only where the registry names a bespoke component that draws that path.
5. Writes produce only hour keys from 0 up to `hours_per_day - 1`, and only room keys the compiler accepts.

## Checks that held

- **Gates match the compiler both ways.**
  - `kernel/ts/play/allowed.ts:45` (`daily_schedule` unless `spawn_template`) matches `lib/loka/content/calendar.ex:123-131`.
  - `kernel/ts/play/allowed.ts:46` (`weapon` only on `slot: wield`, owner skill) matches `lib/loka/content/skills.ex:197-201`.
- **Hour keys.**
  - `rehour` uses the schema's `propertyNames` pattern and refuses an hour at or above `perDay`, as `calendar.ex:115-120` does.
  - The default of 24 matches `calendar.ex:10`.
  - `hours_per_day` is read from top-level `calendar`, which matches `compiler.ex:81`.
- **Room picks.** These go through `refusePick` (`card.ts:206-210`), so a key that is not in the list never reaches the draft.
- **Baseline.**
  - The 12 removed lines are exactly `items.weapon`, `npcs.attack`, `npcs.hp` and `npcs.daily_schedule`, times create, edit and delete. Each has a registry row naming `blocks/Combat.tsx` or `blocks/Schedule.tsx`.
- **PR-body claims rerun.**
  - "schedule_cases has no row in registry.json or the baseline": 0 hits in each, confirmed.
  - The gate cites to `calendar.ex` and `skills.ex` are accurate.
- **Combat end to end.** Ran `bin/loka sim --seeds 2` on a copy of `toolbox_showcase`, before and after editing the warden's numbers.
  - The edit was hp 8/8, `damage_max` 3 and `chance` 100.
  - Both runs print `npc/warden: Wins half from level 1 (build none)`. Level 1 is the floor, so the sim summary is too coarse to show the change.
  - So this check is inconclusive. The write path is covered by the new warden compile test (`author_mapedit.test.ts:199`), which passes.

## Test the tests

`bin/mutate_diff.sh origin/main` produced 31 mutants:
- 2 were red-narrow (`allowed.ts:45`, `:46`).
- 29 were BASELINE-RED: `author_mapedit.test.ts` fails 5 of 19 tests unmutated in this worktree. This is reproducible, and it is finding 2.
- The PR's table (31 of 31 red-narrow) was run at `f2783`, not at the head.

Four hand mutants were run with `bin/mutate.sh` against `node --test test/blocks.test.ts`; all were red:

| Mutant | Result |
|---|---|
| `blocks.ts` rehour: drop `to !== from &&` | red |
| `blocks.ts` addHour: `h < perDay` to `<=` | red |
| `blocks.ts` fightOf: `:npc/` to `/` | red |
| `allowed.ts` weapon: `=== 'wield'` to `!== undefined` | red |

Three more hand mutants were run against the panel test "an NPC card draws its Combat and Schedule blocks":

| Mutant | Result |
|---|---|
| `Combat.tsx:52` `&&` to `\|\|` | red |
| `Schedule.tsx:50` drops the refusal (`return;`) | red |
| `Schedule.tsx:51` writes even when `to === h` | green |

The surviving mutant is equivalent: `commit` returns early when there are no ops (`src/edit/Generic.tsx:72`).

## Findings

1. **should-fix, `tools/author-panel/src/edit/blocks/Schedule.tsx:31`: no test guards the `stopPropagation`.**
   - Without it, the hour blur runs `put`, which posts with `was = sha0`. The blur then bubbles to `CardForm`'s `onBlur={card.commit}` (`Generic.tsx:124`).
   - In the same render, `saved` is stale and the `latest` ref is updated, so the second POST is not empty and carries the same stale `was`. `write.ts:69-72` answers 409, and the card shows a false "Changed outside: reloaded." and clears Undo.
   - The developer's red control stayed green because the panel test checks only the file bytes, and those are right either way.
   - Red control, run by the reviewer:
     - Three temporary lines were added after the `['0','1','13','15']` assert at `panel.test.ts`: wait 1.5 s, then assert that `getByText('Changed outside')` has count 0 and that Undo is enabled.
     - Green at the head.
     - Red (`changed outside`) with `e.stopPropagation(),` removed.
     - Both changes were reverted.
   - Fix: add those assertions. The `stopPropagation` itself is correct.
2. **should-fix, `kernel/ts/test/author_mapedit.test.ts:199`: the new warden compile test breaks the five tests after it.**
   - The run on main gives 18 of 18. At the head it fails 5 of 19, on two runs:
     - the test at `:282` fails with `read ECONNRESET`;
     - four later tests fail with "a symlink on the way to items/ox.json", because `:296`'s planted link is left behind.
   - With `--test-skip-pattern="showcase warden"` the head gives 18 of 18.
   - CI is green, so the failure depends on timing or environment. The likely cause: the 3.1 s `spawnSync` blocks the in-process `serve()`, and a kept-alive socket then resets.
   - Effect: a developer running the file locally sees red, and `mutate_diff` marks 29 of the 31 mutants BASELINE-RED.
   - This rerun does not back the PR-body claim "author_mapedit run alone (19/19)".
   - Fix: run the compile on its own, for example in its own test file or with async `spawn`.
3. **nit, `kernel/ts/play/allowed.ts:45-46`: the author-error guards are one-way.**
   - The gates hide the block, but they do not stop an author from later changing `slot` away from `wield`, or setting `spawn_template` on an NPC that has a schedule.
   - `Combat.tsx` also allows `damage_min > damage_max` (`skills.ex:199`).
   - The compiler refuses all three, so per the owner ruling these are nits.
4. **nit, `card.ts:206-210`:** `refusePick` accepts any key when the room list is empty. This only happens on a cartridge with no rooms.
5. **nits carried from the PR body (PM ruling):** `blocks.ts:9`, `blocks.ts:40`, `Entity.tsx:70`.

## Question

- `Combat.tsx` draws fight rows only for an NPC's `attack`, so the item `weapon` numbers sit beside no fight matrix.
  - §4.2 says "numbers beside the fight matrix".
  - The fight builds (`kernel/ts/play/fight.ts:40`) are not per weapon, so there may be no row to show.
  - Is the NPC-only reading intended?

## Not findings (PM rulings)

- Row-click to Map is follow-up loka-wfrgk.42.1.
- `schedule_cases` is edited inside the hour row.
