# Review: Dialogue choice tree on the Dialogue card (loka-wfrgk.53)

- PR: #675 `editor/dialogue-choice-tree`
- Reviewed commit: `b1bbfbfdb2611ddbfc7dad5b3401c022d2075322` (merge-base `06b531362`)
- Governing: [design §4.4](../rnd/gui-editor-design-2026-11-04.md) (choice tree, gate badges, refused rename),
  [WORKFLOW review stance](../WORKFLOW.md#review-stance); session card bar: a card never offers or writes what the
  compiler refuses
- Independence: Fable, authored none of the slice; detached worktree `review-675`
- CI at head (`gh run list --commit`): graph-diff success, ci success, book-e2e success
- Developer's `/code-review medium`: reported in the PR body (reviewed dfee2db1d, fixed in a4084ef51)
- Verdict: **CHANGES REQUIRED**

## Must be true (written before the diff)

1. Every field the choice add menu offers, on every choice shape, compiles; every refusal names a compiler rule.
2. Capability-gated choice fields (`owned()`) are hidden without their capability; fields without one stay offered.
3. A choice key is never renamed (links and saves name it); `order` is never offered.
4. The tree draws every choice field (Body or Links), so `dialogues.choices` may leave the generic baseline.
5. The gate never leaves an author unable to repair a dialogue from the card.

## Checks that held

- `refuseChoices` rules match: accept+quest (dialogues.ex:367), accept+hand_over (:368), receive+hand_over (:386),
  then_failed needs check (dialogue_links.ex:45), patrol ends the talk (:393), name/riddle hidden skill
  (skills.ex:157-158). `refuseRemove`: last choice (dialogues.ex:315), the riddle's choice_id (:288).
- OWNERS rows: escort (escort.ex:10 `owned "escort"`), receive→containment (dialogues.ex:383). Patrol
  (patrol.ex:153-175) and payment (dialogues.ex:406-417) call no `owned()`: the "no capability" claim holds.
- `order` never offered; Rename shows only the refusal text, no rename path exists; sitting/exchange reveal-only
  (loka-wfrgk.53.1, ruled). Body draws every non-link field, Links draws then/then_failed.
- Dialogue.tsx:30,36 survivors: equivalent. `key={resets}` remounts on any value change, so start and step are
  unobservable.

## Findings

1. **Blocker** `kernel/ts/play/allowed.ts:35-38`: no `dialogues.choices.check: 'check'` row. A cartridge without
   check@1 is offered `check` on a choice (probe: caps `{}`, menu includes `check`); the compiler answers
   UNDECLARED_CAPABILITY at check_kinds.ex:26, pinned by content_choice_checks_test.exs:40-41.
2. **Blocker** `kernel/ts/play/choice.ts:21-43`: the check choice's `@plain` rule (check_kinds.ex:18,151-157) is not
   modelled. On a choice with `check` the menu offers accept, asked, escort, exchange, hand_over, lesson_payment,
   once, patrol, payment, receive, sitting, story_point; each gives OUTCOME_MISMATCH. `check` is also offered on a
   quest or riddle dialogue, which the same rule refuses.
3. **Blocker** `kernel/ts/play/choice.ts:21-43`: patrol combinations (patrol.ex:160-168) not modelled. A patrol
   choice is offered escort, payment, receive, hand_over, lesson_payment, and a choice on a quest dialogue is offered
   `patrol` (probe); by the same gap the Mechanics menu offers `quest` beside a patrol choice (Dialogue.tsx:47-48).
   Each gives OUTCOME_MISMATCH.
4. **Should-fix** `kernel/ts/play/choice.ts:21-43`: `lesson_payment` beside `payment` (skills.ex:275 `!o["payment"]`)
   is offered both ways; the compiler refuses it.
5. **Should-fix** `tools/author-panel/src/edit/cards/Dialogue.tsx:34`: useGated refuses any change whose result
   still fails. Scenario: `{choices:{a:{then_failed:'x'}, b:{receive:{}, hand_over:{}}}}` (hand-edited or from
   main). Fixing `a` still returns `b`'s refusal and vice versa, the per-field Remove included, so no edit in the
   card is accepted. More than a nit. Fix: refuse only a new refusal, e.g. `why && why !== refuseChoices(base.draft)`.
6. **Should-fix** branch not mergeable: a trial merge of `origin/main` (2eaa8bcf4, #672) conflicts in
   `tools/author-panel/src/edit/cards/Room.tsx` (main's RoomForm `blocks`, used by Entity.tsx:82, against `extra`;
   `calendar?` type against `useSource`) and `docs/TOOLBOX.gen.md`. Green CI does not cover the merged state; merge
   main keeping `blocks` and `calendar`, rerun panel.test.

Nits: `asked: false` on the riddle answer is refused (choice.ts:38) but compiles (dialogue_asked.ex:32 matches
`true` only); `key={resets}` collapses open choices; revealed entries survive removal; the banner survives Undo;
Nested repeats shell.ts's fold. All author-side, acceptable.

## Mutants

`bin/mutate_diff.sh origin/main` at the head (after `npm ci` in tools/author-panel; the first run was BASELINE-RED
for missing `axe-core`): 41 run, SURVIVED 3, red-narrow 38, the PR's table. Survivors Dialogue.tsx:30 and :36 are
equivalent (above); Room.tsx:196 is loka-wfrgk.56 (ruled). Findings 1-4 are missing rules, which no mutant of
the diff reaches; the fix must add a test per rule with the compiler's verdict as the expected value.
