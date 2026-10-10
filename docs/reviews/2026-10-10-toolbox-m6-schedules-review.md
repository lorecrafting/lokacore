# Review: toolbox row W10, conditional schedules (loka-kgd.56, batch M6)

- Branch `toolbox/m6-schedules`, head `867b3d9dcfb4754b1a4e7d44af7711665fe76652`, base `f3d561e6`, 33 files. No PR; handoff in Beads `loka-kgd.56`. Record kept: the slice adds `NpcDefinition.schedule_cases` and `ScheduleCases` to `protocol/entity.schema.json` and raises `kernel_api` to 1.47 ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [row W10](../MECHANICS-TOOLBOX.md#ranked-toolbox); [mechanics.md W10](../system/mechanics.md#conditional-schedules-toolbox-row-w10); [cartridge.md declarations](../system/cartridge.md#conditional-schedule-declarations).
- Hosted CI on the head: ci and book-e2e, both success (`gh run list --commit`).
- Trial merge into `origin/toolbox/batch-m6` `33f49e91` (row 14 merged): conflicts in `docs/MECHANICS-TOOLBOX.md`, `docs/system/cartridge.md`, `docs/system/mechanics.md` (both rows append a section) and two generated files (regenerate).
- Verdict: **CHANGES REQUIRED**: one blocker, three should-fix, one nit.

## Must be true

1. An hour's job takes the room of the first case whose `when` holds, else the fallback.
2. The case reads committed state at the job's due time: replay gives the same room, and a fact set earlier in the same wait is seen.
3. The goal is narration only, and only when the case moves the NPC out of the player's room.
4. Plain schedules and every existing cartridge compile to the same bytes. Source may not author `schedule_cases`.
5. The compiler and the loader refuse the same things: room, goal, leaf references, case order and hour, and the 1.47 floor.

## Proof

- (4) All 44 base cartridges compiled at `f3d561e6` and at the head: byte-identical. `source.ex:249` removes `schedule_cases` from the source schema.
- (2) `proposal.ts:284` drains with `at = now(p)` (`:129`), which applies the earlier jobs' ops. Clock override `behavior.ts:45`; test 3 kills the no-override mutant.
- (5) Elixir mutants all killed (`content_schedules_test.exs`): `ordered?` always true, `split` drops the head instead of the fallback, floor 1.46. TS hour check is covered by the loader test row. The TS loader reads only the stored form; a list hour is a schema violation there (`daily_schedule` stays `DefinitionRef`). Parity holds.
- (3) Mutant `rule.ts:91` player in any room → killed. Rows 1 and 4 see finding 1 and should-fix 2.
- loka-kgd.13: no shared code touched. `proposal.ts` is not in the diff; the goal uses the existing job narration push (`proposal.ts:287`), and kgd.13 changes `react()`.
- No size allowance changed: no budget file in the diff stat.
- Re-run claims: same bytes (above); "drain passes no steps" (`proposal.ts:284` calls `schedule.decide(at, run, m)`): confirmed.

## Findings

1. **blocker**, `kernel/ts/src/mechanics/schedule/behavior.ts:47`: mutant `find` → `findLast` passes. Every test hour has one case, so the row's defining rule "first holding wins" is untested. Failure: `[{child_lost→green}, {true→woods}, garden]` sends Maud to the woods. Fix: one `fresh(change)` row with two holding cases.
2. **should-fix**, `kernel/ts/src/mechanics/schedule/rule.ts:91`: mutant drop `from !== room` passes. Failure: Maud is already on the Green with the player and the case holds; "Maud hurries to the Green." prints while she stands still. Fix: one test case.
3. **should-fix**, `behavior.ts:46`: mutant that drops `target` passes. The spec says `subject: "target"` leaves read the NPC; no test reads one. Fix: a case with a `target_present` or tag-target leaf.
4. **should-fix (doc)**, `docs/system/cartridge.md` (Conditional schedule declarations) and `docs/system/mechanics.md:2041`: actor = player is a trap. Under W6 the player is looking at the NPC, so the rooms match; for a schedule the player is usually elsewhere. Failure: `npc_present child` meant "the child is home" reads the player's room, and no diagnostic warns. The author contract (cartridge.md) does not state the limit. The mechanics.md list omits `light_off` (`policy.ts:92`, the player's light). Fix: state the full list (`npc_present`, `target_present`, `has_tag {subject: room}`, `light_off`) in cartridge.md. Refusing those leaves inside cases is a better design but not required.
5. **nit**: no PR, so no `/code-review` result is reported (the commit `867b3d9d` names the fixes). Report it in the batch PR.

Question (PM): row 14 (`33f49e91`) also claims `kernel_api` 1.47. Two features at one floor is fine only if both ship in the same batch merge.

## Fix re-check (c5e37f8a)

- Commits reviewed: `c0e02e6f`, `c5e37f8a` (tests in `kernel/ts/test/schedule_cases.test.ts`, `docs/system/cartridge.md`, `docs/system/mechanics.md`). Focused run on the head: `schedule_cases.test.ts` green.
- F1: done. Mutant `behavior.ts:47` `find` → `findLast` is now killed by "the first holding case wins when two hold".
- F2: done. Mutant `rule.ts:91` dropping `from !== room` is now killed by "the goal is not narrated when the NPC is already in the case room".
- F3: done. Mutant `behavior.ts:46` dropping `target` is now killed by "a case's target leaf reads the NPC". `target_resolution` is added through the test's `fresh(change)`; the sampler is unchanged.
- F4: accepted. cartridge.md now states the full leaf list, including `light_off`, with an example and a "use a fact" hint. mechanics.md links to that list instead of copying it (AGENTS.md one-place rule).
- F5: open. Carry the `/code-review` result into the batch PR.
- Developer's out-of-brief `/code-review` findings, triaged; none blocks:
  1. `daily_schedule` text does not name the fallback: note. The `schedule_cases` and `ScheduleCases` texts say it.
  2. `placeOf` copies the world for an hour with no cases: note. One shallow copy per job; no behaviour effect.
  3. The NPC is looked up twice and there is no kind guard: note. `scheduleOf` guards the kind, and `placeOf`'s only caller is `scheduledJob` on an NPC job.
  4. `Schedules.split` runs on every kind: note. It matches only a `daily_schedule` key; all 44 existing artifacts are byte-identical.
  5. A tenth `api()` copy: note. This follows the house pattern (`barriers.ex`, `quests.ex`, `derived.ex`, ...); consolidating them is separate housekeeping.
  6. Schedule checks run inside `Calendar.check`: note. `compiler.ex:62` always runs it (`|| %{}`), so no check is skipped.
  7. The goal line prints in a dark room: note. Population sight narration does not check light either (`mechanics/population/`), and the spec models the goal on it.
  8. The job drain has no per-command step budget: note. It is a documented known limit, shared with population sight and combat rounds.
- Hosted CI on `c5e37f8a`: ci `38069859130` and book-e2e `38069859115`, both success.
- Re-check verdict: **APPROVE WITH NOTES**. F1-F4 closed; F5 (nit) carries to the batch PR.
