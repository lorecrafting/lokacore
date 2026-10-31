# Review: the save pin names the kernel_api, PR #519 (loka-daha)

- PR [#519](https://github.com/lorecrafting/lokacore/pull/519) `fix/daha-pin-kernel-api` at `2caee4d1bbbbb13c71b9ad04453e59505bf4cc6e`, diff `origin/main...2caee4d1b` (merge base `eadb1b0f3`, kernel_api 1.125).
- Governing: "BRIEF loka-daha" and PM rulings 2026-10-30 (`br show loka-daha`); [save.md](../system/save.md) Opening a story and refusals table; [cartridge.md](../system/cartridge.md) `requires.kernel_api`; [forward development](../decisions/owner-decision-forward-development-2026-10-05.md) (never silently deleted, migrated or retargeted; Start over allowed); [dialogue hub decision](../decisions/owner-decision-dialogue-hub-2026-10-09.md) item 2 (narrowed).
- Reviewer: independent; authored none of the work. First of two reviewers (save change, [WORKFLOW](../WORKFLOW.md)).
- Verdict: **APPROVE WITH NOTES** (no blocker, no should-fix; three nits).

## Must be true (written before reading the diff)

1. Every new pin (first save and Start over) carries `INSTALLED.kernel_api`; no writer builds a pin without it.
2. `openStory` compares it by equality before loading anything: older, newer and absent all refuse `pinned_release_missing` with in-place `newGame`, never `save_corrupt`.
3. A refused save's bytes are unchanged; Start over replaces in place and the new pin names the installed kernel_api.
4. A save made under the installed kernel_api reopens, whatever the host's `kernel_version`.
5. Web and native hosts reach the same `openStory`; no host builds the pin.
6. A later kernel_api bump refuses older saves with no `at_least`, hash fixture or transcript change.
7. save.md narrows the dialogue-hub `save_corrupt` line; the PR cites both records; the three `'1.0'` test hosts read the kernel's version.

Results: all hold. `first()` (`authority.ts:178`) is the only pin builder (`store.ts:206` writes the meta it is given; `load` and `replace` take `first()`); the check (`authority.ts:98`) runs after format/pin-parse and before `load`. App.tsx native (`:92`) and web (`:212`) both go through `createSession` -> `localSession` -> `openStory`.

## Evidence

- Focused at head: release_pin 4/4, saves 15/15, start_over 15/15, recovery 8/8, death 4/4.
- Real refusal: main's `mobile/app/stories/live/green.sql` (a `loka-save-v2` save written by main's code, no `kernel_api`) loaded into SQLite and opened by the head's `openStory` on the showcase release: `pinned_release_missing`, `pinned.kernel_api` undefined, file bytes unchanged; `newGame()` -> `{kind:'replaced'}`, new pin `1.125`, 0 receipts; reopen -> `open`. The head's `green.sql` opens `open`.
- Future bump: `world.ts:108` set to `1.126` (no cartridge change): showcase loads, cartridge 20/20, cartridge_rooms 5/5, release_pin+saves 19/19, the head's `green.sql` -> `pinned_release_missing` (pinned 1.125), bytes unchanged, Start over `replaced`. Reverted.
- `bin/mutate_diff.sh origin/main`: 3 red-narrow (`authority.ts:98` `!==`->`===`, `&&`->`||`, `||`->`&&`), 1 NO-TESTS (`App.tsx:49`). A first run was BASELINE-RED from missing Elixir deps in the scratch worktree (mix), not the PR; rerun after linking deps.
- Hand mutants (red): drop the comparison -> exactly release_pin tests 1-3 fail, 31 pass (release_pin+saves+start_over; the PR's claim reproduces); `kernel_api ?? INSTALLED` -> test 3 only; compare to `host.kernel_version` -> 4/4 fail; drop `kernel_api` from `first()` -> 14 fail incl. saves PIN.
- CI on `2caee4d1b` (one `gh run list --commit`): graph-diff success; ci and book-e2e in progress.

## Findings

1. **Nit, PR body ("`git grep numeric_profile` finds only authority.ts, saves.test.ts and DIFFERENCES.md").** Rerun: it also finds the seven `mobile/app/stories/live/*.sql`. The conclusion (no schema or protocol type carries the pin, so no kernel_api bump) still holds; correct the sentence.
2. **Nit, `mobile/authority/local-story/release_pin.test.ts:47-52`.** The pin tests write `loka-save-v1` saves (`first()`), while every shipped save is `loka-save-v2`, whose Start over goes through `replaceable()`'s header reconcile. Verified by hand above (main's v2 save: `replaced`, reopen `open`); no failing case found, so no test asked.
3. **Nit, `mobile/app/App.tsx:49`.** NO-TESTS row for the author-preview save name; dev-only, `__DEV__`-guarded at `:47`. Accept.

Other checks: `/code-review medium` result reported in the PR. Docs match the brief (save.md `:14-25`, `:37`, `:62`; cartridge.md `:22`, `:40`). Tests use literal expected kinds and the fixture hash; the PIN's `INSTALLED.kernel_api` is the kernel's input, not the authority's output.

## Second opinion (independent; findings written before reading the record above)

- Same head `2caee4d1bbbbb13c71b9ad04453e59505bf4cc6e`. Verdict: **CHANGES REQUIRED** (one blocker, test-only).
- Must be true: (1) every pin writer adds `kernel_api`; (2) every open path compares it by equality **before** `load` (no replay, nothing written): absent, older, newer -> `pinned_release_missing`, Start over in place; (3) `save_corrupt` only for damage; (4) a same-kernel_api save reopens under any `kernel_version`; (5) nothing deleted, migrated or retargeted.
- Adversarial paths checked: app update mid-session, fenced/unknown COMMIT, Start over and `reopen` (`session.ts:93`, the only `openStory` call outside tests) all reach `authority.ts:98`; the pin is one JSON column, so a crash cannot leave a half pin (a half save from an old build refuses at the pin, still Start over in place); downgrade (newer save) refuses with Start over per the PM's equality ruling; live `.sql` changes are only the `kernel_api` key (all 7 verified); `stories.test.ts` catches stale story saves after a later bump; `lib/` writes no save.
- `bin/mutate_diff.sh origin/main`: 0 mutants run (3 rows BASELINE-RED, 1 NO-TESTS). The baseline was red because this scratch worktree lacked the Hex deps (`chapter.test.ts` needs `boundary`); the PR did not cause it. The three `authority.ts:98` rows are covered by the hand mutants here and in finding 1.
- Reran: drop the comparison -> 31 pass, 3 fail (PR claim holds); `kernel_api: host.kernel_version` in `first()` -> red. CI on the head: ci, book-e2e, graph-diff success.

### Findings

1. **Blocker (reviewer.md step 3, swapped-order mutant green), `mobile/authority/local-story/release_pin.test.ts:66` and `:70` (the cases at `:56-59`).** Mutant: move the kernel_api refusal from `authority.ts:98` to after `if (!loaded) ...` (`:102`). release_pin 4/4 and saves 15/15 stay green, because every case is a current save with only its pin edited, so `load` succeeds. That order is the bug this slice fixes: an older save the current kernel cannot load reports `save_corrupt`, and `load`'s `execSync(SCHEMA)` writes derived tables before the refusal. Fix (verified, either works): in the no-kernel_api case set edit to `"json_remove(pin, '$.kernel_api'); DELETE FROM head"` (head: green; mutant: red at `:66`, actual `save_corrupt`, expected `pinned_release_missing`; this one tests the reply kind), or `...; DROP TABLE trace` (mutant: red at `:70`, 'a refusal writes nothing').
2. **Nit, PR body `numeric_profile` grep:** also matches the 7 live `.sql` (as finding 1 above).

### Second opinion: fix re-check at `a66f939778d844c06a3eea7a7c349f6923a68f7b`

- Verdict: **APPROVE**. Finding 1 is resolved and the nit is waived (it is in the PR body only).
- `release_pin.test.ts:59-63`: the no-kernel_api case now runs `json_remove(pin, '$.kernel_api'); DELETE FROM head`. At the head, release_pin passes 4/4. Under the order mutant (the kernel_api refusal moved after `if (!loaded)` at `authority.ts:102`), 3 pass and 1 fails, in the test at `:66` (assertion `:70`): actual `save_corrupt`, expected `pinned_release_missing`.
- `SaveError.tsx:13`: "This save was made with a different version of the game." `pinned_release_missing` is raised only at `authority.ts:98`. Both causes there are true to the text: the pinned content release is not installed, or the kernel_api differs. No test or doc quotes the old text.
- Both records are carried on the head (`d914004bd`, `0f0dbc740`, `511aafc1e`). Their record content equals `review-519-b` at `bca464d61`.
- CI on the head when checked: ci and book-e2e in progress, no result yet.
