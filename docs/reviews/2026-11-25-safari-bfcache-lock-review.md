# Review: Safari save lock after leaving the Book, end the save worker on pagehide (PR #803, loka-hcnlh.19.5)

- PR #803, branch `fix/safari-bfcache-lock`. Reviewed at `f7ee0b7b340f9de3f888bb976517aa937fbeb315`.
- Governing: `br show loka-hcnlh.19.5`; [book-ui.md save-open errors](../system/book-ui.md) (line 739); [save.md lost/uncertain COMMIT](../system/save.md) (line 626); [PR #789 review](2026-11-24-dev-save-pagehide-review.md), Finding 1.
- Why a record: it patches the save driver (expo-sqlite's web module).
- CI at the head (`gh run list --commit f7ee0b7b3…`): graph-diff, book-e2e and ci all success.
- `/code-review medium`: reported in the PR body.
- Verdict: **CHANGES REQUIRED**.

## Must be true (written before the diff)

1. After the old page's pagehide, a new page can open the save: the worker that holds the OPFS handles has ended.
2. No committed write is lost and no COMMIT is cut; a cut transaction reconciles (save.md:626).
3. A page restored from bfcache never plays on with a dead worker.
4. Ending the worker adds no failure or stall to a plain navigation, reload or tab close. A save call after pagehide does not start a second worker, and it shows nothing false to the player.
5. The patch is idempotent and refuses an upstream it does not know. It composes with the #792 warm-up and runs on install, `npm run author` and `web:preview`.

## Checks run (detached worktree at the head; preview on 19660-19663)

- `node --test sqlite-web-pool.test.ts sqlite-web-worker.test.ts`: pass 7, fail 0.
- `bin/mutate_diff.sh origin/main`: `0 mutants (0 run)`, the same as the handback.
- My own red controls, each red (fail 1) with the clean file green: `terminate()` removed, the `persisted` guard inverted, `pagehide` replaced with `beforeunload`.
- Running the patch twice gives the same md5 for all three patched files, and #792's warm-up stays in. The `57.0.3` pin and the single-`create` count both throw on an unknown upstream. `postinstall`, `author`, `web:preview` and `pretest:e2e` all run the patch (`package.json:7-10`).
- Event order on a navigation and a reload, Playwright WebKit and Chromium: `pagehide`, then `visibilitychange hidden`, then `unload`. Both engines are the same.
- Cites rerun: `sqlite-web-pool.test.ts:188` is the call-after-pagehide line (backed). The claim "Ending the worker is what any plain navigation already does" is not backed: see Finding 1.

## Findings

1. **Blocker**, `mobile/app/patch-sqlite-web.cjs:147-149`: the worker ends before the page's hide pulse runs. `pagehide` fires before `visibilitychange`. React Native Web's AppState hears the `visibilitychange`, and `App.tsx:202` then calls `transition` → `hidePulses` → `pulse('pause')`. That pulse writes an elapsed checkpoint, and its first sync call (`transaction.ts:24`) spins for the full 5 s on the dead worker. Measured on Chromium with a playing Book:
   - `page.reload()` took 5021 ms to commit with the patch and 41 ms twice without it (the release block removed from node_modules only). The gap from pagehide to the end of the visibilitychange handler was 5009 ms with the patch and 30 ms without.
   - A same-origin navigation away showed the same 5 s gap.
   - The synthetic pagehide plus hidden sequence blocked for 5010 ms; with the visibilitychange alone (no pagehide) it took 31 ms.

   Failure: every reload of a playing Book, every navigation away from it and every tab close freezes the tab for 5 s, and the pause checkpoint that used to commit now fails. Nothing is cut mid-transaction (the spin comes before BEGIN), so the save stays intact. The test cannot catch this: it dispatches `pagehide` with no hide pulse after it. A fix must end the worker after the hide pulse, for example from a `window` (bubbling) `visibilitychange` listener once a pagehide has fired. The test should then make a save call in the hide pulse that comes after pagehide.
2. **Question**, same lines: on a bfcache restore, does `visibilitychange visible` come before `pageshow(persisted)`? If it does, `resume` (`App.tsx:156`) spins 5 s on the dead worker before the reload starts. Chromium headless would not bfcache the page even with the flag, so this was not reproduced. When pagehide fires and the page stays, the next tick freezes it for about 4.5 s, and then the Book shows the raw text "Sync operation timeout" with only Start over (measured). The spec says this only happens through bfcache.
3. Nit, `mobile/app/patch-sqlite-web.cjs:154`: an install that already carries an older release text gets a second pair of listeners, not a refusal. That is harmless (two terminates, two reloads). It is an author-side case.

Checked and fine: every app save call is synchronous (`store.ts:28-34`, `sqlite-web.ts`). The only async calls are `openDatabaseAsync` (`App.tsx:231`) and Storybook. A pagehide during the open leaves the promise pending, then the page is either gone or reloads. The listeners register once per page (`worker` is never reset). The elapsed catch-up commits once per tick task, so pagehide falls between transactions.

Open for the owner's iPhone (agents may not use it): (a) leave in the same tab and come back, then Back: no lock screen; (b) app switch and tab switch: no reload and no lost open field or sheet (that would be a pagehide on a switch); (c) the WebKit handle release after terminate: the Book opens on the first try, not after Try again; (d) after Finding 1's fix, reload a playing Book: no 5 s freeze.
