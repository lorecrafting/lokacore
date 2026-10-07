# Local Book preview

The browser preview runs the current Expo App, Book renderer, bundled chapter and local
Story authority. Start it from the source worktree to preview:

```sh
cd mobile/app
mise exec -- npm ci --no-audit --no-fund
mise exec -- npm run web:preview
```

Open **http://localhost:19006**. Keep that process running while editing the same
worktree. Metro watches the app, mobile authority, kernel and bundled fixture sources;
Book UI edits appear through Fast Refresh. An already-open game retains its loaded
session and cartridge. Reload the page to use changed rules; when the chapter pin has
changed, use the Book's confirmed **Start over** to begin on the new release. The local
header proxy listens only on loopback and supplies the
isolation headers required by SQLite. Metro's private port is 19007; use 19006 in the
browser. The browser save lives in origin-scoped OPFS, separate from the native save.

At a playable checkpoint, stop the preview process with Ctrl-C. In the new reviewed
source worktree, run the commands above; the browser URL stays the same. Current-build
play survives reload and a closed/reopened tab. Browser saves have no cross-build
migration promise.

`expo-sqlite` 57.0.3's browser worker needs an asynchronous first open before synchronous
session calls, plus the narrow install-time length, error-message and elapsed-time fixes in
`mobile/app/patch-sqlite-web.cjs`.
Its web support is alpha. On an SDK update, review that guard and repeat real browser
open, action, reload, tab reopen and Fast Refresh checks before using the preview.

Run the deterministic Book browser test from `mobile/app` with `mise exec -- npm run
test:e2e`. The tester.army e2e runner starts and stops its own preview on ports 19106 and
19107, uses a fresh browser profile, and checks a saved move after reload. It does not
touch the usual preview at 19006 or its save. Install its browser once with `mise exec --
npx e2e-web install chromium`. The test uses no model or API key, and telemetry is disabled.
Its pretest also runs the controlled worker deadline check governed by
[the save boundary](system/save.md#commit-fence-reconcile), with
[delayed/silent-worker red controls and browser proof](evidence/2026-10-06-web-sqlite-sync-deadline/README.md).

The default `e2e run` is headless. To watch the configured browser live and save a video,
run `mise exec -- npm run test:e2e -- tests/book.e2e.ts --headed --video`.
The runner also accepts `--video retain-on-failure` to keep recordings only for failed tests
([official e2e debugging guide](https://e2e.tester.army/docs/debugging)). The deterministic suite needs no model. Exploratory tests that use agent actions require an already authorized provider or subscription, or a local model. The official e2e overview describes the distinction between exact steps and model-driven agent steps.

The current suite contains one deterministic saved-move-after-reload check. It is setup proof for the browser runner, not chapter route/UI coverage. Chapter closure requires the route walk, exploratory pass, and owner-visible headed run or video described in the [workflow](WORKFLOW.md#local-edit-loop).
