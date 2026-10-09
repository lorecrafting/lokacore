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
test:e2e`. The tester.army e2e runner starts and stops its own preview, uses a fresh browser
profile, and checks a saved move after reload. Each run gets a free preview port from the runner
and a free Metro port from `preview-server.cjs`; set `LOKA_PREVIEW_PORT` or `LOKA_METRO_PORT`
to fix one. It does not touch the usual preview at 19006 or its save. Install its
browser once with `mise exec -- npx e2e-web install chromium`. The test uses no model or API
key, and telemetry is disabled.
Its pretest also runs the controlled worker deadline check governed by
[the save boundary](system/save.md#commit-fence-reconcile), with
[delayed/silent-worker red controls and browser proof](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-web-sqlite-sync-deadline/README.md).

The default `e2e run` is headless. To watch the configured browser live and save a video,
run `mise exec -- npm run test:e2e -- tests/book.e2e.ts --headed --video`.
The runner also accepts `--video retain-on-failure` to keep recordings only for failed tests
([official e2e debugging guide](https://e2e.tester.army/docs/debugging)). The deterministic suite needs no model. Exploratory tests that use agent actions require an already authorized provider or subscription, or a local model. The official e2e overview describes the distinction between exact steps and model-driven agent steps.

The current suite contains one deterministic saved-move-after-reload check. It is setup proof for the browser runner, not chapter route/UI coverage. Chapter closure follows the [browser E2E loop](decisions/owner-decision-chapter-closure-e2e-loop-2026-10-05.md).

## Storybook

The Book UI's components and pages render in Storybook from `mobile/app`:
`mise exec -- npm run storybook` serves **http://localhost:6006** on this computer only; for a phone
session, `mise exec -- npm run storybook:lan` serves every interface, so a phone on the same network
opens `http://<this computer's LAN address>:6006` (and reaches `/mcp` too). The toolbar picks the
palette and a phone viewport. `mise exec -- npm run storybook:smoke` type-checks, builds and runs
every story headless (render, play function, axe at error level); CI runs it in `book-e2e.yml`
([checks](CHECKS.md)). Install its browser once with `mise exec -- npx playwright install chromium`.
The `Live` stories run the real Book over the local authority, restored from a checkpoint save
(`stories/routes.ts`, written by `npm run stories:views`); they need the dev server's isolation
headers (and a secure context: `localhost`, not a LAN address), so the smoke skips them. `mise exec -- npm run storybook:live` starts a dev server on a free
port, runs every Live story and its click-through headless, then a sidebar switch (one database
open after it) and a second tab on the same origin (Storybook's sqlite keeps no saves), and stops it (about 50 s warm,
85 s on a first run, so `book-e2e.yml` runs it nightly rather than the pre-push hook).
What each component looks like and does: [the component catalogue](BOOK-UI-COMPONENTS.md).
`bin/preview_update.sh` brings the preview checkout (`~/dev/lokacore-preview`) to `origin/main`, runs
`npm ci` only for a changed `package-lock.json` and restarts Storybook, the web preview and (if running) Expo on
8081 by listening PID; servers already serving it keep running. `bin/polish_session.sh start|close` serves a
[live polish session](WORKFLOW.md#live-polish-session) on 6006, then pushes it, opens its PR and serves the
preview again. The PM starts the owner's servers only with these scripts, never as a Claude Code background task (a Storybook started that way died twice, exit 144). `LOKA_SB_PORT`, `LOKA_PREVIEW_PORT`, `LOKA_METRO_PORT` and `LOKA_EXPO_PORT` move the ports.

**Agents** ([owner decision](decisions/owner-decision-storybook-mcp-2026-10-09.md)): the dev server
answers MCP at `/mcp` (`@storybook/addon-mcp`): list and read components and stories, story-writing
instructions, previews, and `test-run` (play function and axe for chosen stories; it runs outside
the check lock, so not during a smoke or `bin/check_all.sh`). The repo's
`.mcp.json` points Claude Code at the owner's http://localhost:6006/mcp (approve it once per
machine). Those tools see only the checkout that server serves, so an agent testing its own
worktree runs Storybook on another port and calls that port's `/mcp` instead. For the browser
console and clicks, use the Claude in Chrome extension on the same URL.

## Polish queue

The Loka picker (`mobile/app/.storybook/picker/`, [design input](briefs/polish/design-input-p1-2026-10-09.md)):
**Pick** in the toolbar or `P`, click an element (shift-click up to four), write in the Polish
panel on the right, `⌘↩` sends. `storybook dev` only, loopback only. Each send appends one line to
`.polish/picks.jsonl` in the served worktree (gitignored): `{id, time, note, story: {id, title},
palette, viewport, elements: [{chain, box, computed, text, role, name, testId, shot}]}`, the crop at
`.polish/shots/<id>-<i>.png`; Close batch and Keep going append `{id, time, type: 'close' | 'keep-going'}`.
Agents answer in `.polish/status.jsonl` through `bin/polish_status.sh`: `{id, time, state: working |
done | stopped, model, summary, sha}`, `{id, time, state: 'moved', beads, summary}` or `{time, type:
'suggest-close', reason}`; the panel polls it. Outside a session, [`/polish-intake`](../.claude/commands/polish-intake.md) moves waiting
picks to Beads. `mise exec -- npm run storybook:picker` runs the picker end to end on a dev server with
its own queue directory (about a minute; nightly in `book-e2e.yml`).
