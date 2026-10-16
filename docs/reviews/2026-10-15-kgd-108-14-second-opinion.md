# Second opinion (save): loka-kgd.108.14 hidden elites stay secret

- Branch `toolbox/kgd-108-14`, exact head `6e540bb77204bae612fa488cf94be4761833e209`, base `37a569da`; scope the save fix of round 1 (`875112c1..6e540bb7`). No PR (batch model), so no `/code-review` result to check in a PR body; the handback cites one (CR 2,4,5 disputed, CR6/CR8 open).
- Governing: [review count](../WORKFLOW.md) (second opinion for a save change); [storage lessons](../lessons/storage.md); first review [2026-10-15-kgd-108-14-review.md](2026-10-15-kgd-108-14-review.md) finding 1; brief `br show loka-kgd.108.14`.

## Must be true (written before the diff)

1. Every row the engine writes reloads, pending and chosen: `choice_ids` = `offered` at the opening, a hub reopen copies it (`behavior.ts:90`).
2. Reload refuses a row the engine cannot write (unknown id, reorder, duplicate, empty, a dropped choice that no concealed lesson explains) as `save_corrupt`, file bytes unchanged.
3. Row check (`dialogue-save.ts`) and choose-receipt check (`dialogue-receipt.ts`) apply one rule; every `checkRow` caller (skills, topics, riddle saves) inherits it; no other full-set `choiceIds` equality remains.
4. A cartridge change between save and reload is refused explicitly, never a silent deletion.

Holds: 1, 3, 4. 2 holds for `choice_ids` itself; see finding 2 for `choice_id`.

## Evidence (detached worktree, each mutant reverted)

| Check | Result |
| --- | --- |
| M1 `checkRow` back to full-set equality | `hidden_skill.test.ts` reopen test fails, `save_corrupt` |
| M2 receipt back to full-set equality | same test fails (chosen case) |
| M3 drop `ids.length > 0` | `dialogue_openable.test.ts` fails |
| M4 drop the `hidden` condition | `dialogue_openable.test.ts` fails |
| M5 delete the `openable` clause from `checkRow` | green: 76/76 in hidden_skill, local_story, chandlers_debt_rows, wren_riddle, story_points |
| P2 save with carving hidden, reload a cartridge without `hidden` | `pinned_release_missing`, bytes unchanged (pending and chosen) |

Claims rerun: "`openable` matches `concealed`" holds (`skills.ts:38-41`: hidden with prerequisite; `openable` is the static superset). The comment at `hidden_skill.test.ts:100` saying receipt replay refuses forged rows first holds (M5 green). `choiceIds(` has no caller left outside `selection.ts`.

## Findings

1. **Should-fix.** `mobile/authority/local-story/dialogue-save.ts:117` (and `dialogue-receipt.ts:62`): nothing tests the refusal side of the call site. M5 deletes the clause and every test stays green, because the 4 forged rows at `hidden_skill.test.ts:103` are refused by `receiptHistory`. That replay runs only for cartridges with exchange, liquid, knowledge and similar features (`exchange-save.ts:15`, `liquid-save.ts:21`). Scenario: on a skills cartridge without those features, a refactor drops the clause; a row with an unknown id or with `leave` removed then reloads with no test failing. Fix: call `checkRow` directly with two forged rows (no SQLite needed).
2. **Nit.** `dialogue-save.ts:119-121`: a resolved row is not required to have `choice_id` in `row.choice_ids`. Probe: row `['whittle']`, `status: resolved`, `choice_id: 'learn'` passes `checkRow`, and `dialogueDetail` does not check membership either. The engine never writes this row (`rule.ts:78`). Before the fix, full-set equality implied membership. It grants nothing new: at base, a full-ids row resolved to `learn` below the prerequisite already passed the static checks (no save path rechecks `learnable`). Fix: `|| !row.choice_ids.includes(row.choice_id)` in the resolved branch.

Judged, not findings: a forged row that drops a lesson the player had qualified for only hides an option and grants nothing; where replay runs, replay re-derives the row. A hub reopen copies the narrowed ids, which stay openable. The riddle and topics callers inherit `checkRow`; riddle-save compares the receipt op to the row field for field.

Round 0 verdict at 6e540bb7: APPROVE WITH NOTES.

## Fix re-check at b39793f5

Scope: commits 6e540bb7...b39793f5 only, the code they touch and its direct callers.

| Disposition | Proof |
|---|---|
| 1 fixed: direct test `hidden_skill.test.ts:138` | M5 (drop `openable` from `checkRow`, `dialogue-save.ts:117`) now red: the new test fails. M8 (drop `openable` from the receipt check, `dialogue-receipt.ts:62`) red: same test. Unmutated file: exit 0. |
| 2 fixed: `includes` at `dialogue-save.ts:120` | M7 (drop the `includes` clause) red: the new test fails on the forged `choice_id: 'learn'` row with ids `['whittle']`. |

Dispute (no `includes` on the receipt side, `dialogue-receipt.ts:62`): accepted. The receipt evidence requires `row.choice_id === p.choice_id` (`dialogue-receipt.ts:109`), so membership holds wherever `checkRow` ran on the row. `checkRow` runs before the receipt check in skills-save, riddle-save and topics-save, and in `dialogueSave` for escort and custody cartridges. The deadline callers (`deadline-save.ts:201,273`) do not run `checkRow`, but finding 2 was a nit with nothing granted beyond base, and the general gap of replay behind content gates is already loka-b60.

Worktree clean after the mutants (`git status` empty).

Verdict: **APPROVE** at b39793f5.
