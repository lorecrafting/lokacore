# Review: web save closes on pagehide, Safari's lock offers Try again (PR #789, loka-hcnlh.19.1)

- PR #789, branch `fix/dev-save-pagehide`, head `091b21edb0c220920fd02b64f7b51a1d956cda89`.
- Governing: `br show loka-hcnlh.19.1` (fix scope: release the database on pagehide and before the dev reload; a plain other-tab state); [save.md lost/uncertain COMMIT](../system/save.md) (line 626).
- CI at head (`gh run list --commit 091b21edb…`): graph-diff success, book-e2e success, **ci failure** (`bin/toolbox_page.exs --check`: `builder_todo_baseline.txt` parity:story-beats/story-list not in main's baseline; the branch predates #788, rebase).
- `/code-review`: not reported in the PR body.
- Verdict: **CHANGES REQUIRED**.

## Must be true (written before the diff)

1. On pagehide the page really gives up the OPFS lock, so a reloaded or second page can open the save.
2. No committed write is lost; a cut transaction reconciles on reopen (save.md).
3. A page restored from bfcache never plays on a closed save.
4. Dev preview only, registered once per page (HMR re-executes App.tsx).
5. Safari's lock reads as the other-tab state with Try again; no other failure is mislabelled destructively.

## Checks run (throwaway worktree at head)

- `bin/mutate_diff.sh origin/main`: 1/1 red-narrow (`release-save.ts:11`, `&&`→`||`).
- Red controls, all red: WebKit alternative dropped from `locked()`; pagehide listener emptied; `persisted &&` dropped; reload made unreachable.
- Playwright WebKit, persistent profile, preview on 7319: tab B showed "Loka is already open in another tab" + Try again while A played (words.ts half confirmed). In one run, after `window.dispatchEvent(new Event('pagehide'))` in A, B's Try again **still showed the lock screen**; that the close actually ran was not confirmed. Later fresh-profile runs hit `Sync operation timeout` on every open, the same with the `releaseOnHide(...)` call removed (control build), so that is environmental; "close A, Try again opens" was not reproduced.
- Claims rerun: save_error red control backed. "Three reloads reopen the save" does not discriminate: a reload destroys the document and its worker, which frees the handles with or without `releaseOnHide`.

## Findings

1. **Blocker**, `mobile/app/App.tsx:235-240`, `mobile/app/release-save.ts:1-5`: `db.closeSync()` does not release the OPFS lock. expo-sqlite's `closeDatabase` (`node_modules/expo-sqlite/web/worker.ts:255-263`) only calls `sqlite3.close`. `AccessHandlePoolVFS` holds a sync access handle on every pool file from `isReady()` (`AccessHandlePoolVFS.js:295-317`) and releases them only in `vfs.close()` (`:214`, `:319`), which the worker never calls. Failure: Safari keeps the old page (and its worker) alive or in bfcache, and the new page still gets the lock. The finding rests on these source cites; the WebKit run above is consistent with it. The bead's text named the actual release: terminate the worker, which expo-sqlite's public API does not expose. The bfcache reload only exists because of the close, so it falls with it. A valid disposition: drop the App.tsx/release-save.ts half and keep the words.ts half, which the run confirmed.
2. Nit, `mobile/app/book/words.ts:43`: the anchored match is as tight as this layer allows (`WorkerChannel.ts:42,151` forward only `error.message`). Another WebKit InvalidStateError, e.g. a sync-handle call on a closed handle, would read "open in another tab", but its Try again is only a reload, so nothing is destroyed.
3. Nit: the PR body has no `/code-review` result.

Checked and fine: every save call is synchronous (`sqlite-web.ts`), so pagehide runs between calls, never inside a COMMIT. A transaction left open reconciles per save.md:626. The `devCartridge` gate is a build constant (`App.tsx:58-59`). Registration sits inside `g.loka_web_opening ??=`, so once per page.

Open item (not this PR: reproduced with the `releaseOnHide` call removed): headless WebKit gave a dead-end `Sync operation timeout` screen (no Try again, no Start over) on fresh profiles. Whether main shares it was not run.
