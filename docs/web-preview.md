# Local Book preview

The browser preview runs the current Expo App, Book renderer, bundled chapter and local
Story authority. Start it from the source worktree to preview:

```sh
cd mobile/app
mise exec -- npm ci --no-audit --no-fund
mise exec -- npm run web:preview
```

Open **http://localhost:19006**. Keep that process running while editing the same
worktree; Metro watches the app, mobile authority, kernel and bundled fixture sources
for Fast Refresh. The local header proxy listens only on loopback and supplies the
isolation headers required by SQLite. Metro's private port is 19007; use 19006 in the
browser. The browser save lives in origin-scoped OPFS, separate from the native save.

At a playable checkpoint, stop the preview process with Ctrl-C. In the new reviewed
source worktree, run the commands above; the browser URL stays the same. Current-build
play survives reload and a closed/reopened tab. A changed chapter pin may refuse an old
browser save; use the Book's confirmed **Start over** if a fresh preview game is wanted.
No cross-build preview save migration is promised.

`expo-sqlite` 57.0.3's browser worker needs an asynchronous first open before synchronous
session calls, plus the narrow install-time length fix in `mobile/app/patch-sqlite-web.cjs`.
Its web support is alpha. On an SDK update, review that guard and repeat real browser
open, action, reload, tab reopen and Fast Refresh checks before using the preview.
