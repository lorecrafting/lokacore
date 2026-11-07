# Review: Editor E6c part two, Reaction and Action inspector cards (PR #668, loka-wfrgk.46)

- PR: [#668](https://github.com/lorecrafting/lokacore/pull/668), branch `editor/e6c2-reaction-action`
- Reviewed commit: `6a8db78c47d968106822048caf8ef12fb14626e9`
- Governing: [gui-editor design §4.5](../rnd/gui-editor-design-2026-11-04.md), [owner editor plan](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md) (cards hold no logic, the generic list only shrinks), [E6b review](2026-11-05-e6b-npc-item-review.md) and [E6c review](2026-11-05-e6c-rules-review.md) (the bar), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at the reviewed head (`gh run list --commit 6a8db78c...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: not reported. The PR body is PR #667's text (`dev_set_level`), not this slice's.

## Verdict: CHANGES REQUIRED (one should-fix, no blockers; the code is sound)

## Must be true (written before the diff)

1. Every edit goes through `useCard` (`POST /change`, `/undo`); the cards hold no logic, which lives in tested `card.ts`/`action.ts` functions.
2. An action has `outcomes.failure` exactly when it has `check` (`scripted_actions.ex:109`, OUTCOME_MISMATCH); an `extends` child is left alone.
3. Each gate matches the compiler: the card offers no field that cannot compile and hides none that can.
4. The baseline drops exactly the rows a bespoke part now draws.
5. Each new branch has a test that fails when it breaks.

## Checks that held

- Real Chrome walk on a copy of `toolbox_showcase`, dark (the panel has no light theme):
  - Reaction `letter_late`: a Steps `value` edit compiled; Undo restored the file byte-identical. Add `silent` and Add `when` (`{"op":"all","items":[]}`) each compiled; Remove restored the sha and re-offered the field.
  - Action `fish`: Remove check dropped `check` and `failure` together and compiled; Add check revealed only; filling luck (`fish`, 40) wrote the check and the paired failure `{steps:[],narration:{actor:{prose:"~"},participants:{}}}` and compiled.
- Gates against the compiler: `card.ts:423` (`scripted_actions.ex:125`), `:424` (`action_tips.ex:40`), `:425-426` (`resolve.ex:415`), `:432` (`replenish.ex:58-64`), `:433` (`scripted_actions.ex:87-91`), `:434` (`zones.ex:56-61`). Pairing `action.ts:14-19` matches `scripted_actions.ex:108-112`.
- Baseline: the 44 removed rows equal the registry moves; `accessibility`, `command`, `input`, `name` and the policy create/delete rows stay generic and stay in the baseline.
- `elixir bin/red_controls.exs` exits 0 with `ok editor gate: action-card` and `reaction-card`.

## Mutants

`bin/mutate_diff.sh origin/main` at the head: 27 run, 23 red-narrow, 4 SURVIVED, no BASELINE-RED, no TIMEBOX.
- The 4 survivors change cite numbers in comments (`card.ts:424`, `:425`, `:432`, `:433`): equivalent. The developer's "5 survived" counted `:423`, which here went red on `author_mapedit` test 8 ("a template dropped on a room..."): a comment-only change cannot change behaviour, so that test is flaky.
- All 12 `action.ts` rows are red-narrow. The developer's 12 BASELINE-RED did not reproduce; the harness rightly refuses to score a red baseline and is not at fault. A Beads issue for the flaky `author_mapedit` test 8 and the flow-graph timing tests is needed (PM files it).
- `Action.tsx:24`, `:25`, `:27`, `Reaction.tsx:20`, `:21`: red on the panel smoke test, backing the developer's hand kill of `Action.tsx:25`.

Hand mutants against `card.test.ts`, both red: `action.ts:14` without `'extends' in doc ||`; `card.ts` `reactions.when` gate key renamed.

## Findings

1. **Should-fix: the PR body is #667's.** It carries no `/code-review` result, mutation table, composition record or walk for this slice, so none of its claims can be rerun. Fix: replace it with this slice's body and run `/code-review medium` in the fix round.
2. **Nit, `Action.tsx:28` (via `card.ts` `addable`): Add offers `command`, `input` and `accessibility`.** They reveal a field the form never draws, and `source.ScriptedAction` (additionalProperties false) refuses them on a scripted action. Author-side only.
3. **Nit, `card.ts:430`:** the `NEEDS` parameter is named `world`, but `:432` receives the whole `cartridge.json`.
4. **Nit, `Action.tsx:25`:** a `command` draft mounts `Generic`, which calls `useCard` a second time. Harmless today (one fetch more).

Accepted, not findings:
- `Reaction.tsx:29`: `zone` is held until a room is set, the same hold the E6c review accepted.
- `card.ts:434`: no gate on `reactions.after`; its refusals depend on content (`delayed.ex:36,49`), so a gate would hide valid values.
- `Action.tsx:26`: pairing on every change is the compiler's rule (`scripted_actions.ex:109`) and was walked.
- Composition (step 7) and Book UI (step 8): not applicable; panel code, no Book change.

Walk caveat: the Book preview iframe showed a broken page, so "Edit in Book" was not walked.
