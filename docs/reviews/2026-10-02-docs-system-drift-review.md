# Review: docs/system pointer drift after the smoke.ts split — 2026-10-02

PR #124 (`docs-system-drift`), commit reviewed `5cf415e` (includes the PM merge of main). Docs only;
no mutation testing (WORKFLOW Review stance).

**Verdict: CHANGES REQUIRED**

## Must be true (written before reading the diff)

1. No non-test `smoke.ts` pointer left in docs/system, the active ROADMAP rows or docs/world-parameters.md.
2. Every changed `path:line` lands, at the PR head, on the code its sentence describes.
3. Only words a pointer forces change; the PM rulings (save.md:23, architecture.md:87, world-parameters P1/P2) match the code.
4. `bin/check_docs.exs` green; docs/archive, reviews and decisions untouched.

## Checks

- Every target opened at `5cf415e`. Correct: `session.ts:23`, `:24`, `:27`, `:27-28`, `:61`, `:66` (narration line without a key is `save_corrupt`, `:66-71`), `:83`, `:161`; `presenter.ts:148` (screen returns the log), `:155` (the press that throws, retry kept); `actions.ts:147` `resolved`, `:180` `refusal`, `:245` `admission`, `:267` `lists`; `quest.ts:74` `earned`, `:110` `resolution`; `cartridge_refs.ts:152` `refStage`; `localSession` `satisfies GameSession` (`session.ts:167`).
- `git grep smoke.ts` over the three scopes: none. `ROADMAP.md:18` "smoke controller" is the Done SM2 row (history, not active).
- `elixir bin/check_docs.exs`: 259 docs, 0 broken, 0 unreachable. Only the 8 listed files change.

## Findings

- **F-1 should-fix** `docs/system/architecture.md:87`, `:97`, `:98`: all three `App.tsx` lines miss. `:29` is a comment about the one Lantern story (`localSession` is imported at `:11`, called at `:34`); `:26` is a comment (`loka-lantern.db` is `:31`); `:39` is `deleteDatabaseSync` (the device-clock latency is `:44`). A reader following any of them lands on unrelated code; fixing pointers is this PR's purpose.
- **N-1 nit** `docs/system/protocol.md:172`: `dialogue.ts:79` is the closing `*/`; `choiceView` is `:80` (the old `:78` was also inside the comment).
- **N-2 nit** `docs/world-parameters.md:76`: P1 `model.ts:75` is `ANIMALS`; `branch(t)` with `3600` and `% 24` is `:77`-`:78`.
- **N-3 nit** (developer-flagged) `docs/world-parameters.md:77`: the last cell "comment admits 'Lantern's claim limit'" is now false; no such comment exists in `mobile` or `kernel/ts/src`. A reader looking for that comment to fix finds nothing. The "should come from" cell (calendar, `world.wait` W16) stays true as the home if Wait returns; keep it. Drop only the comment clause, a word the `removed` pointer forces.

## Fix round 1 re-check (bd938e9)

**Verdict: APPROVE.** Only the fix commit was reviewed; it changes 4 docs files, no code.

- F-1 fixed: `App.tsx:11` imports `localSession`, `:31` is `NAME = 'loka-lantern.db'`, `:44` is the `performance.now()` latency host.
- N-1 fixed: `dialogue.ts:80` is `choiceView`.
- N-2 fixed: `model.ts:77-78` is `branch` with `3600` and `% 24`.
- N-3 fixed: the "Lantern's claim limit" clause dropped; the W16 cell kept.
- Extra: `save.md` `presenter.ts:145` is the 200-line log splice, `:153` is `retry ??= b.label`; both match their sentences.
- `bin/check_docs.exs` green.
