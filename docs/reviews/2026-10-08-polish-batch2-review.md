# Review: polish batch 2 (PR #328, loka-bhb)

- PR #328 `polish/storybook-b2`, commit reviewed `c6a8707d`, base main `7006efec`.
- Scope: 2b footer family, 2a leaf components and check E3, the pre-production gate change, the finish
  round (naming rule, test helper, whole-tree lint). The look is the Fable designer's review.
- Governing: [pre-production gate](../decisions/owner-decision-preproduction-gate-2026-10-08.md),
  [WORKFLOW steps 4 and 7, Delivery lanes](../WORKFLOW.md#loop), [CHECKS](../CHECKS.md), plan
  `docs/briefs/polish/storybook-plan-2026-10-08.md` B, C, D, E3; PM naming rule (a pressable's name starts
  with its visible text exactly as rendered, then a suffix; applies everywhere).

## Must be true

1. `ci.yml` and `book-e2e.yml` trigger only on schedule and `workflow_dispatch`; no job skips by scope; each
   verdict job fails on any failed, cancelled or skipped job.
2. Pre-push refuses a dirty tracked tree before any check, runs the Storybook smoke for Book, story or
   `.storybook` changes, never alongside `npm test`; each has a red control that fails when broken.
3. `bin/check_all.sh` lints the whole tree with every rule and runs every rule's cases.
4. `bin/session_status.sh` prints each workflow's latest nightly, flags red, stays quiet when `gh` fails.
5. `bin/ci_base.sh` has no live caller. The decision record quotes the owner verbatim (Beads loka-bhb
   notes) and both supersession links exist.
6. Conversions keep each press target, handler and disabled state; every name leads with its shown text.
7. The typed refused line stays in the presenter: no kernel, protocol or save shape change.
8. The test helper does not weaken assertions; E3 fails on a planted literal and exempts only the drawings.

## Evidence

- 1: diff of both workflows; only `if:` left are `failure()` artifact steps and the verdict `always()`.
  Dispatched runs on `c6a8707d`: ci 37912415986 success; book-e2e 37912419292 failure (see B1).
- 2, 4: `docs_only_red_controls.sh` rc 0, `integration_red_controls.sh` rc 0. Mutants (each reverted):
  dirty-tree line deleted -> `FAIL pre-push dirty`; storybook lane without `book` -> `FAIL ci_scope Book .tsx
  change runs Storybook smoke`; red-nightly suffix dropped -> `FAIL session_status nightly`.
- 3, 8: `ast-grep scan --error . mobile/app/.storybook` rc 0; plant `{ padding: 8 }` in
  `.storybook/preview.tsx` rc 1 (rc 0 without naming the dir), in `Riddle.tsx` rc 1, in `MapDrawing.tsx`
  rc 0 (exempt). PR claim rerun: `fontSize` renamed in the rule -> `ast-grep test` rc 4 (backed). PR claim
  rerun: `.storybook` plant reported (backed).
- 5: `git grep` finds `ci_base`, `--auto`, `needs.changes` only in archived or superseded records; no `bin/`,
  `.claude/` or hook waits on checks. Owner words match loka-bhb notes lines 33, 35.
- 6, 8 (app mutants, focused unit files, base rc 0): EntityLine suffix dropped (`lines.tsx:26`) -> rc 1, 4+
  tests fail; refused tag from the raw code (`model.ts:121`) -> rc 1; LogLines tag not drawn -> story
  `RefusedWithTag` fails (vitest, 1 of 5).
- 7: no diff under `kernel/`, `protocol/`, `lib/`, `mobile/packages`; `Logs.log` is never persisted
  (`snapshot.ts`, authority have no `log` reader); no e2e matches a refusal sentence exactly.
- `/code-review medium` result is in the PR body.

## Findings

- **B1 blocker (merge gate).** Hosted book-e2e 37912419292 on `c6a8707d` fails
  `stories/PageTurn.stories.tsx:49` (`expected null not to be null`: no curl canvas within 1 s) in
  ChapterToSettings. The PR touches `mobile/authority/local-story/*.test.ts`, so decision point 3 requires a
  green hosted run. The branch changed that story's page (`sections.tsx:231` Continue is now
  `ContinueButton`) and `type.small`; the six latest hosted book-e2e runs (main and #327) passed it. Local
  A/B with 8 CPU hogs: head 6/6 pass, base `7006efec` 6/6 pass, so not reproduced locally and not proven
  a regression. Disposition: the PM reruns book-e2e on the head; a second red makes it a regression to fix.
- **S1 should-fix.** Pre-push runs the smoke outside the `check_all.sh` lock (`.githooks/pre-push:29`, lock
  taken in `bin/check_all.sh:24-37`): a push in one worktree runs the smoke while another worktree's
  check_all runs `npm test`, the pairing the briefs say times out (the developer's own smoke flake ran beside
  e2e). Take the lock for the smoke too.
- **S2 should-fix.** Naming rule ("applies everywhere") still broken: `Riddle.tsx:24` LetterTile shows "A",
  is named "Letter A, tile 1" (not in the PR's open items); `Status.tsx:118,123` "Position, standing" over
  "standing"; `pages.tsx:151` "Look, <room>" over the title; `Status.tsx:92` with `model.ts:148-151` names "hp 30/30, ma 10/10" over shown
  "hp 30/30  ma 10/10" (punctuation differs). A voice-control user saying the shown word does not hit the
  name's start. Fix, or the PM defers each by name with a Beads issue.
- **N1 nit.** `docs/system/owner-rules.md:196-198` keeps the admin backdoor but drops its source; the new
  record supersedes the required-checks record wholesale (`owner-decision-preproduction-gate-2026-10-08.md:30`).
  A reader concludes the backdoor went with it. Say it stays.
- **N2 nit.** E3 matches only a number whose direct parent is the pair (`lint/rules/mobile-book-raw-values.yml:21-27`):
  `{ marginTop: -4 }` and `{ gap: n ? 8 : 4 }` pass (probed). A fix must keep `opacity: x ? opacity.disabled : 1`.
- **N3 nit.** Negative assertions now skip object lines (`vesper_message.test.ts:174,193`,
  `wren_escort.test.ts:246,288`): an NPC line leaking as a refused or event line passes. Read `.text` too.
- **Question.** The storybook lane (`bin/ci_scope.sh:12`) skips `mobile/app/package.json` (a Storybook bump)
  and `mobile/packages/game-view/` (stories import it); with no PR runs only the nightly catches those.

## Verdict

CHANGES REQUIRED: B1 (red required hosted run), S1, S2. Nits at the developer's discretion.
