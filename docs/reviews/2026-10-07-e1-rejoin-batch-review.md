# E1 escort rejoin and Elspeth talks batch review

- Scope: local branch `e1/rejoin-route` (not pushed), exact head
  `ce1aa5f9`; batch diff `cad4e3a3..ce1aa5f9` (PR #288 head `cad4e3a3`). Beads
  `loka-e1-r9-certification-2rz.8`.
- Governing: [E1 R9 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md),
  [architecture E1 witness rules](../system/architecture.md#e1-exact-candidate-proof-policy)
  (dialogue talk/choice, journal variant, [branch evidence](../system/architecture.md#e1-policy-branch-evidence)),
  AGENTS.md Writing tests and Simplicity.
- Verdict: **APPROVE**. No findings.

## Requirements written before the diff

1. No witness rule changes: only a route plus registration (`e1_cases.ts`, `e1.ts` `CHECK_FILES`).
2. `b_wren_rejoin` (definition, choice, root, five `all` items) is credited by an accepted talk whose
   before-state holds all five items, including `escort_state separated`, so a real death must precede it.
3. Journal active variant 0 (root plus two items) is credited only as the first satisfied variant whose
   exact text (`quest.missing_child.separated`) is in the GameView journal after an accepted command.
4. `b_elspeth_rescued`/`b_elspeth_stays` talks happen after the matching return commits and before
   ring or silence; each choice is accepted against its pending continuation.
5. Exactly those 23 paths leave the pending set; nothing is added; rejected or skipped steps credit nothing.

## Checks

- Diff touches no rule code; `journalVariantPaths` (`e1_obligations.ts:383`) is unchanged and selects
  the first holding variant with an exact-text match. After death the route asserts the `separated`
  journal (`e1_rejoin.ts:39`); the post-reopen accepted `move` commands then carry that journal.
- `rejoin` ends after the Elspeth talks with no bell step; `elspethStays` talks follow `childReturn('stays')`.
- Recorder (`e1_cases.ts`, v042 pin artifact): exit 2, 27/27 SQLite cases, witnessed 576 (553 + 23),
  dispositioned 0, authored pending 72. `comm` against the `cad4e3a3` list: 23 removed (exactly the
  brief's 8 + 3 + 6 + 6), 0 added.
- `node --test kernel/ts/test/e1*.test.ts`: 48/48 pass. `npm run typecheck` (kernel/ts): exit 0.
- Mutants (throwaway worktree, removed): drop the `inn` talk (fails on `b_elspeth_rescued/choices/inn`);
  drop the rejoin talk and its following-journal assert (fails, Elspeth sequence diverges from replay);
  drop the death (fails, the `separated` literal); drop the stays talks (fails on `b_elspeth_stays`).
  The rejoin-only drop with its assert kept fails on that literal.

## Declined code-review findings

- Six lines copied from `childReturn` (`e1_rejoin.ts:18-25`): accepted decline. Sharing the prefix needs
  a new parameter or split of a function used by five ending routes; a straight command script is simpler.
- Copied replay harness (`e1_rejoin.test.ts:35-60`): accepted decline. The same mkdtemp/caseHost/replayCase
  shape is in about fifteen existing E1 test files; consolidating it is a separate refactor outside the brief.
- One test per break per layer: no existing focused test names this route's 23 paths; `e1_cases` record
  runs are broad and do not count.
