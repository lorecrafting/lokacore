# Review: inline words field on every card words row (loka-wfrgk.100.1)

- PR: #690 `editor/card-words-field`
- Reviewed commit: `4bb30a4d0d7e4541e541c9598cc5b048ce7af58b`
- Governing: [cartridge.md Editor write path](../system/cartridge.md) (`GET /line`, `POST /edit`, `was` guard, 409),
  [gui-editor-design ruling 11](../rnd/gui-editor-design-2026-11-04.md) (:232, choice labels not edited),
  [AGENTS.md Writing tests](../../AGENTS.md), [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: authored none of the slice; detached review worktree
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (three runs)
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. The card writes through `GET /line` and `POST /edit` only; no new route, no bypass of `worded()`.
2. The field's text is `/line`'s `words`; nothing is posted that the author did not type (no placeholder, no default).
3. One `/edit` per commit, on Enter or blur only; Esc restores the read words and posts nothing.
4. `was` is the bytes `/line` returned; a 409 keeps the draft and shows theirs; after a 200 the next save carries
   the new `was`; an in-flight save is not overwritten by a second one.
5. 400 and 409 keep the draft and show the server's reason.
6. No field is offered where `worded()` refuses (scene `- ` labels, key lines).
7. Tests use literal expectations against the real server; no change detectors; no fixtures the test does not need.

## Checks that held

- 1, 2: `fields.tsx:50-58` `api`/`lineOf`; `TextKey` renders `inline(formData)` (`fields.tsx:44`), scene lines
  `l.text` minus `* ` (`Scene.tsx:59`); the room test asserts exact file bytes and only `/edit`.
- 3: `fields.tsx:123-130` blur and Enter call `save()`, Esc `setDraft(at.words)`; `busy` ref (`:84`) makes
  Enter-then-blur one post (test `words.test.ts:63`).
- 4, 5: `{...mine}` carries `/line`'s `file,line,was` (`:91`); 409 → `conflict()` shows theirs, draft kept (test `:118`);
  200 → `read(draft, true)` refreshes `was`; `readOnly={out}` while out (`:120`).
- 6: `sceneLines` keys `* ` lines only, so `- ` labels get no field; dialogue `choices.<slug>.label` shows its key
  (`fields.tsx:36`). Scene-step choice `label` is a TextKey distinct from `choice_id` (`protocol/scene.schema.json`),
  so its words edit changes no key and the server accepts it: a follow-up (loka-wfrgk.100.4), not a blocker.
- 7: expected values are hand literals and fixture bytes; `page.route` holds or refuses a request, no module mocks.
- Claim reruns: `:118` "`mine !== at` mutant (fields.tsx:86) is red" and `:157` "TextKey guard `&&` → `||` is red":
  both red-narrow here (table below). `:91` "removing `readOnly={out}` is red": red-narrow.

## Mutants

`bin/mutate_diff.sh origin/main` in the review worktree: 41 mutants, 1 red-narrow (Room.tsx:211), 40 BASELINE-RED:
the four-file narrow command timed out under load in my environment (the same four files pass 38/38 when rerun), so
those rows count as unrun, not green. Hand sweep with `bin/mutate.sh` against `words.test.ts` (full: all four panel files):

| Mutant | Result |
|---|---|
| fields.tsx:120 `readOnly={out}` → `readOnly={false}` | red-narrow |
| fields.tsx:87 `choice === 'empty'` → `'never'` (skip the empty refusal) | **SURVIVED** |
| fields.tsx:123 drop `theirs \|\|` from onBlur | red-narrow |
| fields.tsx:86 `mine === at` → `mine !== at` | red-narrow |
| fields.tsx:36 `&&` → `\|\|` | red-narrow |
| fields.tsx:91 post `was: draft` (break the `was` guard) | red-narrow |
| fields.tsx:76 drop the `kept` return | red-narrow |

## Findings

1. **should-fix** `tools/author-panel/test/words.test.ts` (gap at `fields.tsx:87`). The survivor above: clear a words
   field and blur. Today `saving()` returns `'empty'` and nothing is posted; if that branch regresses, `/edit` is posted
   with `words: ''` and the server writes `""` (or a bare `* `) over the player's words (`prose.ts:23-24` and the
   literal branch accept an empty string). One test case: clear the generic card's field, blur, assert zero `/edit`
   posts and the "Empty. Write ~" message. About ten lines, no logic change: fix in place or file in Beads.
2. **should-fix** `tools/author-panel/src/edit/cards/Scene.tsx:54`. `li key` includes `l.text`, and `load()` reruns
   on every `changes` push for the file (`:27-29`). Scenario: the scene card holds a dirty draft for line n; the same
   line is saved in the Book (or outside) → the key changes → `WordsField` remounts → the draft is gone with no
   conflict shown. The file is never clobbered, but typed work is lost where the `was` guard would otherwise have
   shown Keep mine / Take theirs (the `kept` guard at `fields.tsx:76` already handles the words-prop change once the
   key is stable). Fix: key by `l.key ?? l.n`. One line, but a behavior change: the developer's call whether to land
   it now or with loka-wfrgk.100.4 (which lists the remount as a focus loss only).
3. **nit** PR body line 11 says "POST /edit refuses it" for dialogue labels; line 52 of the same body says the server
   writes JSON labels. The second is right (`prose.ts:25` refuses scene `- ` lines only); the record should not claim
   a server refusal.
4. **nit** `fields.tsx:77`/`:58` (developer-listed, overlaps 100.4): after a 200 save of `~` on an inline or scene line,
   `read(draft, true)` resolves by words and `located()` may refuse as ambiguous, leaving `at` stale, so the next save
   is a 409 whose `conflict()` finds nothing (no Keep/Take). No words lost; left to 100.4.

## Disposition

Merge after finding 1's test lands (or is filed) and the developer decides finding 2; neither changes the write path.
No full-suite sweep run. Worktree `review-690` removed after this record.
