# Review: Builder Story tab creates the outline and edits parts (PR #820, loka-hcnlh.45)

- PR #820, branch `builder/45-outline-create`. Reviewed at `bcb33e55e959ee0fc651ff55e9aaeef3791e3354`.
- Governing: brief `br show loka-hcnlh.45`; [book-ui.md, Story tab](../system/book-ui.md) (lines 1125-1144, with the PM-decided paragraph on parts); [AGENTS.md "Writing tests"](../../AGENTS.md).
- Why a record: PM brief. The slice changes the editor gate registry and its red controls.
- CI at the head (`gh run list --commit bcb33e55e…`): graph-diff, ci and book-e2e all success.
- `/code-review medium`: reported in the PR body. It says book-ui.md lacks the part text, but commit `75ee5168d` added it. I read those hunks myself; the spec matches the code.
- Verdict: **CHANGES REQUIRED** (one blocker, a one-assertion fix).

## Must be true (from the spec and brief, before the diff)

1. With no outline, `Add part` asks `/new` for the starter (`{"parts":[{"beats":[]}]}`). That gives one part.
2. `Add part` appends an untitled part. It is hidden while the outline.json compile is refused.
3. A picked part row offers a title field, `Retitle` (empty removes the title) and `Remove` (beats included). Each is one gesture with one Undo.
4. Seeds and Unplaced offer no part edits.
5. After a successful Remove, the pick and the part-keyed drafts clear. A refused Remove clears nothing.
6. The registry rows flip to `story.tsx` and the baselines empty. The red controls still go red for the right reason.
7. The wording follows the spec, and placeholder words are marked.

## Checks run (detached worktree at the head)

- `bin/mutate_diff.sh origin/main`: **0 mutants**, exit 0. The handback reports 1 (`story.tsx:176`, BASELINE-RED), which this run does not reproduce. The DROP pattern needs a line ending in `;`; `story.tsx:174` (`await ed.dropPart(part);`) ends in a comment.
- Hand mutants (`bin/mutate.sh`, narrow runs of `author/story.test.ts` and `test/author_mapedit.test.ts`):
  - drafts filter `'part:'`→`'beat:'` (`story.tsx:179`): red;
  - `partOf(doc, part)` → `void doc` (`outlineedit.ts`, titlePart): red;
  - `const shown = … ?? undefined` → `const shown = undefined` (`story.tsx:172`): **SURVIVED**. See Finding 1.
- Red controls: `bin/red_controls.exs`: all 38 `editor gate` controls ok. With full output, I spot-checked notyet-generic, notyet-grown, book-accepted and todo-unlisted. Each exits 1 with its expected message. todo-unlisted also prints a consequent not-yet line (harmless).
- Claims rerun: `story.test.ts:418` (Seeds offers no edits), `author_mapedit.test.ts:473` (the part gestures), `outlineedit.ts:46` and `mapedit.ts:304-306` all hold. Undo of every part gesture is covered by the byte-identical undo-all test (`author_mapedit.test.ts:623`).
- Starter path, refused-compile hiding (`story.tsx:252`) and the `busy` guard against a double `/new`: correct.
- Panel (`tools/author-panel/src`): edits the outline generically. No conflict.
- Screenshots: none in the PR. Open item for the PM.

## Findings

1. **Blocker**, `mobile/app/author/build/story.tsx:172,187`; tests at `story.test.ts:364-416`.
   - Every part test types a title before `Retitle`. No test opens a titled part and presses `Retitle` (or reads the field) untouched.
   - The mutant `shown = undefined` stays green. Under it, an untouched `Retitle` on a titled part sends `''`, and `titlePart` deletes the title. The field also opens blank.
   - Fix: one test that picks a titled part, checks the field shows the title, presses `Retitle` and asserts the title is kept.
2. **Nit** (native only; the web reloads on each write), `story.tsx:177`. After Remove, the open/shut folds keep their old `part:<i>` ids, so the next part opens or shuts in the removed part's place. The `ponytail:` comment owns it. Accepted.
3. **Nit** (native only), `story.tsx:173-179`. A draft typed after Remove and before Undo lands on the shifted part. A stale uncontrolled number input (`number:part:1`) can show a number whose draft is gone, so Add beat is refused with NaN. That is a misleading refusal; nothing wrong is written.
4. **Nit** (dev-listed, author-side): an untouched Retitle rewrites the same title; a whitespace-only title is saved; Add part on a hand-broken outline.json shows a raw TypeError.
5. **Nit**, handback: the mutate_diff table (1 mutant) does not match a clean run (0).
