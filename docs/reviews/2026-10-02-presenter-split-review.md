# Review: Presenter split (GameSession, the words move to the app, three lint rules)

- PR: #118, branch `presenter-split`, commit reviewed `b66a197`
- Reviewer: fresh Claude Code agent (Opus), authored none of the work
- Spec: [07 "The session boundary"](../spec/07-offline-storypacks-to-mmo.md#the-session-boundary);
  [owner decision](../decisions/owner-decision-presenter-split-2026-10-02.md) with its two addenda
  (paraphrased); 03 §14, 04 §16, 06 §43 as the brief cites them
- Verdict: **CHANGES REQUIRED** (one should-fix that changes what the player sees, one should-fix
  in a new check; no blocker)

## What must be true (written before reading the diff)

1. `mobile/authority` returns structured results only: no log line, label, echo or sentence is
   built there. The words, the log and the button grouping live in `mobile/app`.
2. One `GameSession` in `mobile/packages/game-view`: the generated protocol types plus its own
   lifecycle (a save that does not open, with its Start over) and reply types (`saved`,
   `stale_view`, `conflict`, `pending`, fault). It names no engine internal (Db, Story, World,
   Cartridge). The renderer gets `GameView` and sends `ActionInvocation`-shaped intents through it
   and never builds authority Commands (07).
3. The local authority implements it and keeps id and actor allocation, the pending retry of the
   same invocation (03 §14), the cartridge load and Start over. The shell (`App.tsx`) picks the
   session and holds every phone-only API (expo-sqlite, expo-font, `Alert`, kv-store).
4. The renderer (`app/book/`, `SaveError.tsx`) imports only React Native building blocks and the
   session package, and nothing from `kernel/`, `mobile/authority/` or `protocol/`.
5. A check keeps display text out of `mobile/authority` and a check enforces item 4. Each has a
   planted case that fails.
6. Nothing changes for the player except N-1, and #116 still holds: an unshowable save routes to
   SaveError at open, and the log is capped at 200 lines on every path.

## Checks run

- `npm test` (mobile/app): 145 tests, 144 pass, 1 skipped (the device-db case), exit 0.
- `bin/check_all.sh`: exit 0. `bin/lint_red_controls.sh`: exit 0, all three new rules red on their plants.
- Sizes: `smoke.test.ts` 500 -> 497, `authority.ts` unchanged, `Book.tsx` 232, `pages.tsx` 260,
  no `size: allow` added.
- CI: **none has run on `b66a197`**. GitHub reports the PR CONFLICTING: its base is `87a1246`
  (#116), before #114 merged. See the open items.

## Mutants (temporary, in a throwaway worktree, all reverted)

| Mutant | Result | Test that failed |
|---|---|---|
| Skip the `SENTENCE` lookup in `said` | red | "a move rejected for want of MV says the body is too exhausted" |
| Drop the 200-line splice in `screen()` | red | "the log stops growing in one room…", "refused drags do not grow the log without bound" |
| Session `invoke` mints a new id on a pending retry (`retry =` for `??=`) | red | "a pending press is retried with its own id…" and 3 more |
| Swap "leaves."/"arrives." | red | "an NPC who leaves while you stay is logged…" |
| Drop `checked(story)` at open (#116 routing) | red | 4 start-over and saves tests (damaged receipt index, null choice, …) |
| Presenter echo label `retry = b.label` (no `??=`) | red | the pending and failed-write tests |
| Drop `taken` from `OUTCOME` | red | "a scripted session survives a restart", "the log has story words…" |
| Drop `code: 'start_over_pending'` in `session.ts:146` | **green** | none (see N-1) |
| Lint plants: `'You are too tired.'` in the authority; renderer import of the authority session, `expo-sqlite/kv-store`, `require('expo-font')`, `import()` of the authority, a kernel re-export | red | the matching rule |
| Lint plant: `` `Go ${d}` `` in the authority | **green** | none (see F-2) |

## Simulator walk (acceptance 4)

The same Debug simulator build of the app (the PR has no native or dependency change) on an
iPhone 17 simulator, iOS 27. JS was served by Metro first from `origin/main`, then from
`b66a197`. Before each run the same old save was restored (it opens as `pinned_release_missing`)
and the hint store was cleared. Each run went by touch through SaveError, Start over and its
confirm, then look, the offer (talk), a drag west to the locked gate, north, east and east to the
shelter, take the lantern, back to the landing, talk to Bram, and the choice "Leave it with the
search party".

Result: the log words match main at every step. "The way west is locked.", "Taken.", the choice
prompt, "You hand Bram the lantern. He lifts it toward the reeds and calls the others in." and
"The story ends here. Start over is in Settings." all appear. Four state pairs (refused west,
take, talk, ending), compared below the status bar, are pixel-identical between main and the
PR. The first-run hints still show and clear through the shell-injected stores. Screenshots of
the PR run: [2026-10-02-presenter-split-walk/](2026-10-02-presenter-split-walk/). Not walked:
the second ending, Close, and the in-play Start over. Both endings and Close are covered by the
touch tests.

## Findings

### F-1: should-fix. A failed retry of a pending start over shows "start over not confirmed" instead of its error

`mobile/authority/local-story/session.ts:151` (`fail({ ...s.failed, message })`) carries over the
`code: 'start_over_pending'` that line 146 set. `SaveError.tsx:23` shows the code's words in place
of the message.

Scenario:
1. A start over's COMMIT outcome is unknown, so it becomes `start_over_pending`.
2. The player presses Start over again.
3. The fence settles and shows nothing was replaced, so `newGame` calls `replace()` again.
4. `replace()` throws on a definite failure, for example "disk I/O error".
5. `s.failed` is now `{ message: 'disk I/O error', code: 'start_over_pending' }`.

Main shows "(disk I/O error)". The PR shows "(start over not confirmed)". I reproduced the
resulting state with a probe test (`failed()` printed both fields).

This changes what the player sees, which the brief puts on its stop list. Fix: clear `code` in
that `fail` call. Add a red test built from the scenario: a pending start over, then a definite
failure on the retry, then assert that `failed()` has no code and carries the error message.

### F-2: should-fix. `mobile-authority-no-display-text` misses a word followed by an interpolation

`lint/rules/mobile-authority-no-display-text.yml:11`: the regex
`[A-Za-z]+ [A-Za-z]+|[A-Za-z]\.$` runs on each `string_fragment`. The fragment of
`` `Go ${e.direction}` `` is `"Go "`, which has no second word and no final full stop. Restoring
`buttonsOf`'s "Go …" label to the authority (one of the moved items the brief names) passes the
check: the planted line gave 0 hits.

Under the rule's own definition ("words separated by a space"), a word followed by a space and an
interpolation is display text. Fix: also match a word followed by a space at a fragment's end,
and add a `` `Go ${d}` `` invalid case to `lint/tests/`.

These are stated limits of the rule, not findings: `'Close'`, `` `> ${l}` `` and `` `(${kind})` ``
have no two words and are not caught.

### Nits

- **N-1** `mobile/app/SaveError.tsx:23`: no test covers the wording for a pending start over;
  the mutant that drops `code` stays green. The words were untested on main too (it asserted
  only `game() === undefined`), so this is not a regression.
- **N-2** `mobile/app/book/presenter.ts:126`: `as unknown as Intent` hides any field that `Intent`
  requires later. A single typed object literal would let `tsc` see it.

### Question (for the PM)

- **Q-1** `mobile/authority/local-story/smoke.test.ts:13` and `start_over.test.ts:19` import
  `app/book/presenter.ts`, so authority tests assert app words. The brief said to move the log
  assertions to `mobile/app/book/`. The developer declared this deviation with the `absent`
  precedent. Accept it or move them?

## Against "what must be true"

1. Met, except F-2's gap in the guard. The authority's remaining strings are Error messages, SQL
   and ids.
2. Met. `Game`/`GameSession`/`Reply`/`Failed` name no engine internal, and the re-exports are
   type-only, pinned by `mobile-session-contracts-only`. `pending()` and
   `invalid`/`unauthorized` are additions the presenter needs.
3. Met. `retry`/`lastId`/actor are in `session.ts:86-101`, and `App.tsx` holds `Alert`, fonts,
   SQLite and kv-store.
4. Met. A default `import RN` then `RN.Alert` is not seen, the same class as the rule's
   `ponytail:` note on `import * as RN`.
5. Met, with F-2.
6. Met on the walk and in the tests, except F-1.

Over-engineering: nothing to delete. The third rule (`mobile-session-contracts-only`) replaces
the brief's in-rule exception and is stricter than it.

## Open items for the PM

- Merge `main` into the branch (conflicts in the docs index and ROADMAP) and get every CI job
  green on the new head before merge. No CI has run on `b66a197`.
- `docs/system/` does not exist at this base, so the owner wish went in as an addendum. The
  owner-rules list entry is owed when the compaction PRs land.
- Codex Sol review: appended by the PM.
