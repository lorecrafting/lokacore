# PR #199 — Book browser save/reopen E2E

Reviewed source head: `810c7a4167a0e365b849d7c218d50398f6737b37`.

Verdict: **APPROVE**. No findings.

Requirements derived before diff review: the browser preview must run the real Book and local Story authority, and a confirmed action must survive a page reopen through its origin-scoped SQLite save ([architecture](../system/architecture.md#hosts), [save](../system/save.md#commit-fence-reconcile), [web preview](../web-preview.md)). The automated test must use its own browser origin so it cannot touch the owner's normal preview save; the web-first pause excludes native verification ([owner decision](../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md)). A dedicated CI job should run the deterministic test without a model, API key or telemetry.

Review: the test drives the actual Book from Ferry Landing through Map to Well Lane, then `app.restart()` closes the page and reopens it in the same browser context, retaining OPFS. It requires Well Lane again after chapter Continue. `app.clearState()` creates a fresh context before the test. The runner starts the proxy on loopback port 19106 with Metro on 19107; normal preview remains on 19006/19007. The browser workflow uses no secrets and the runner's model-free assertions. Dependency changes are locked, development-only packages; no unnecessary abstraction or duplicate helper was found (Ponytail Review: Lean already. Ship.).

Validation in a disposable detached worktree: `npm ci`, browser install and `npm run test:e2e` passed (1 test). Red control: changed the app's database name to include `Date.now()`, so page reopen cannot load the prior save; the test failed at its final Well Lane assertion. The mutation was restored and the worktree had no source changes. At review time, the exact-head browser CI job was queued; merge still requires its green result under [WORKFLOW](../WORKFLOW.md#loop).
