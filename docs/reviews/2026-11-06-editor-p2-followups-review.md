# Review: Editor P2 follow-ups (PR #688, loka-wfrgk.84.1, .88, .90, .93)

- PR: [#688](https://github.com/lorecrafting/lokacore/pull/688), branch `fix/editor-p2-followups-2026-11-06`
- Reviewed commit: `f5855adb521c2d7adca2fd497b116493067125fa`
- Governing: [Author preview](../system/cartridge.md#author-preview), [E6d review](2026-11-05-e6d-story-review.md) (card bar), [editor walk P2 review](2026-11-06-editor-walk-p2-review.md), [AGENTS.md Writing tests](../../AGENTS.md), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at the reviewed head (`gh run list --commit f5855adb5...`): ci success, book-e2e success, graph-diff success.
- `/code-review`: reported in the PR body.

## Verdict: CHANGES REQUIRED

## Must be true (written before the diff)

1. The menu offers a field only where the compiler accepts it, both ways, each gate citing the compiler.
2. `capacity` only on a non-template container (entities.ex:227-232, death.ex:122,137).
3. `block_chance` only on an `off_hand` item in a world with `combat.narration.block` (skills.ex:231-232, 246-257).
4. A choice's `policy` needs the `policy` capability (dialogue_links.ex:11-14, policies.ex:25-26).
5. A targetless offer is never written (quests.ex:63-66); a picked target is.
6. A field's blur still commits; the #685 save queue is unchanged in behaviour; no double write.

## Findings

1. **Blocker (.90, test catches nothing)**: `tools/author-panel/test/panel.test.ts:516-541` with `tools/author-panel/src/edit/Generic.tsx:199-200,213`. The new test passes on the unfixed `onBlur` (its own named break), against AGENTS.md "a test that passes on the broken code: fix or delete it". Hand mutant at :213 dropping the `contains` clause (a button blur into a field outside the card no longer commits, the developer's own /code-review fix) stays green. The change does not reach the cause the PR names (the queued timer reads `latest` late); field-to-field keeps the same exposure, and the bead's walk ran at throttle 4, never tried. Save queue (`queued`, `send`, `post`, `back`) is untouched; the only behaviour change is Add then type as one write and one Undo. Fix: revert :199-200, :213 and the test, keep .90 open and drop it from title and body so the merge does not close it. Alternative: a red control on unfixed code (focus and input in one task via `page.evaluate`) plus a test for the `contains` clause.
2. **Should-fix (follow-up bead acceptable)**: `kernel/ts/play/allowed.ts:85-86` with the card seed `capacity: 1`. A container already holding two items gets capacity 1 and the compile refuses with CAPACITY_EXCEEDED (entities.ex:250-253); the card chose that value, not the author.
3. **Nit (open item)**: `kernel/ts/play/allowed.ts:72`. `items.slot` is offered on a template; death.ex:137 refuses it. `barrier` is likewise ungated for non-containers and templates (entities.ex:229). Pre-existing; follow-up bead.
4. **Nit**: `kernel/ts/test/editor_crud.test.ts:188-192`. With `apart(all, unready(edited))` the walk no longer compiles capacity, block_chance or a picked offer target, so "offered implies compiles" for the new gates has only the allowed.test rows.

## Checks that held

- .88: `tools/author-panel/src/right.tsx:38` scopes every picker by `reachable` (from #686, 58fbf137f, on main). quests.ex:63-66 is the targetless refusal, held by `unready`. Claim holds.
- Partial target `{kind:'npc'}` and `{}` fail the schema, so `fresh` holds them.
- Hand mutants, all red-narrow (allowed.test, story_card.test): template clause dropped at allowed.ts:86; narration clause dropped at :89; `===` to `!==` at :89 (PR claim rerun); OWNERS :54 renamed; `!` dropped at unready :149.
- `bin/mutate_diff.sh origin/main` (10 mutants): 7 red-narrow (allowed.ts:86 x3, :89 x2, :146, :149); 3 BASELINE-RED Generic.tsx:213 (panel dev servers). The PR reports all 10 BASELINE-RED for its run and the same 7 red-narrow by hand; consistent. Its hand table discloses Generic.tsx:213 #2 SURVIVED, matching finding 1.

## Fix round at 63db41c37

Commits a58e506f2, 63db41c37 only. CI at the head (`gh run list --commit 63db41c37…`): ci success (attempt 2, kernel rerun for loka-lvo9i, not this diff), book-e2e success, graph-diff success.

### Verdict: APPROVE

- Finding 1, resolved: `Generic.tsx` and `panel.test.ts` match the merge base af742b449 apart from the .84.1 `unfed` to `unready` rename; .90 is out of the title and body and stays open.
- Finding 2, resolved: `kernel/ts/play/card.ts:347-348` seeds capacity at `max(1, held)`; `held` (:369) counts `.location.item` edges into the selection's graph ref (`tools/author-panel/src/right.tsx:39`), the same set entities.ex:242-253 counts (templates have no `.location.item` edge). Test `kernel/ts/test/allowed.test.ts:109` uses hand-written expectations. Hand mutants, all red: path check dropped from `held`; `Math.max(1, held)` to `held`; seed reverted to `1`. Disclosed limit (an item placed since the last good compile is not counted) accepted: the next compile reports it, and nothing is written silently wrong at seed time beyond that window.
- Findings 3 and 4: filed as loka-wfrgk.84.2.
