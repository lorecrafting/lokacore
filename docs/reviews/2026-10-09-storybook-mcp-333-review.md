# Review: Storybook MCP addon, Tidewave trial, smoke vitest config move (PR #333)

- PR #333, branch `chore/storybook-mcp`, head `4216ce62`. Beads loka-zs7. Tooling/config slice; no `docs/system` section governs it.
- Governing: [owner decision](../decisions/owner-decision-storybook-mcp-2026-10-09.md), [web preview, Storybook](../web-preview.md#storybook), [CHECKS storybook lane](../CHECKS.md), [WORKFLOW review stance](../WORKFLOW.md).
- Verdict: **CHANGES REQUIRED** (two should-fix, no blocker).

## Must be true

1. No LAN device and no foreign web page (DNS rebinding) can reach code execution on the owner's machine (Tidewave `project_eval`/`browser_eval`, `/tidewave/ws`).
2. Tidewave stays out of every non-interactive run: `storybook build`, the smoke, MCP `test-run`, the nightly `storybook:live`.
3. The moved vitest config still selects the storybook lane, with a real red control; nothing else picks up the root `vitest.config.mts`.
4. The `window.name` script and the 74px strip touch only Storybook dev, not the game or the Metro web preview.
5. The decision record quotes the owner verbatim; index newest first.

## Proof (Storybook of this head on :6806, `--host 0.0.0.0`; LAN IP 192.168.0.68)

- (1) Tidewave holds. `/tidewave/mcp` tools/list from LAN IP: 403 (remote IP check, `vite-plugin.js` `checkSecurity` on `/tidewave`; `X-Forwarded-For: 127.0.0.1` does not bypass it, `socket.remoteAddress` wins). Loopback with `Host`/`Origin: rebind.evil.test`: 403 (any Origin rejected). `/tidewave/ws`: loopback + `Origin: localhost:6806` 101; `Origin: evil.test` 403; LAN IP 403. `/tidewave/config` LAN 403.
- (1) Storybook `/mcp` is open: LAN tools/list 200; loopback with foreign Host and Origin 200; LAN `test-run book-tip--shown` returned `Passing Stories`. A path outside the story index (`book/model.ts`) is refused (`No stories found`), so no arbitrary code. See S1.
- (2) `storybook build` of this head: `grep -ril tidewave` finds nothing. `previewHead` called directly (`DEVELOPMENT`): 1394 chars with toolbar.js; with `VITEST=true`: empty, backing `main.ts:12`. `storybook:live` is not covered: S2.
- (3) `bin/docs_only_red_controls.sh` passes; with `app\/vitest\.config\.mts$|` removed from `bin/ci_scope.sh:13` it fails `smoke vitest config change runs Storybook smoke: want run, got skip`. `npm test` is `node --test` and the app `tsconfig.json` includes only `*.ts/*.tsx`, so nothing else reads the root config. No other `.mts` lost type-checking in `.storybook`.
- (4) `git grep -i 'tidewave\|window.name'` outside docs: only `.storybook/main.ts`, `.mcp.json`, `package.json`.
- (5) Both quotes match `br show loka-zs7` (double space kept). Index line is first, newest first.
- PR body reports `/code-review medium`. Cites rerun: `docs_only_red_controls.sh:34` and `main.ts:78` (ws 101/403) backed; `main.ts:76` is not (N1).

## Findings

- **S1 should-fix** `mobile/app/package.json:15` (`--host 0.0.0.0`) with `mobile/app/.storybook/main.ts:96`. Any LAN device, or any web page the owner opens through DNS rebinding (Host is not checked), can call `/mcp`: run `test-run` repeatedly (Vitest + Chromium on the owner's machine, outside `bin/check_lock.sh`, so it can collide with a pre-push smoke), list changed working-tree stories, and read component docs. addon-mcp registers `/mcp` itself in `experimental_devServer` (`preset.js:1541`) with no host or address check, and a `main.ts` preset runs after it, so no confirmed in-config hook exists. Smallest fix: `storybook` binds localhost and a `storybook:lan` script adds `--host 0.0.0.0` for phone sessions; or the owner records the risk as accepted.
- **S2 should-fix** `mobile/app/.storybook/live.ts:15` spawns `storybook dev`, so `withTidewave` (`main.ts:12`) is true in `storybook:live` (nightly, `.github/workflows/book-e2e.yml:37`). That run now loads https://tidewave.ai/tc/toolbar.js (a network dependency for the Live check), patches console, and rewrites `100vh` heights to `calc(100vh - 74px)` (`main.ts:132-135`) for the Live click-throughs, so the check tests a layout the game does not have. `web-preview.md` ("the build and smoke leave it out") is true but incomplete. Fix: `live.ts` spawns with an env flag that `withTidewave` checks.
- **N1 nit** PR body cites the addon registration at `main.ts:76`; it is `main.ts:96`.
- **N2 nit** Upstream: `/tidewave/config` answers 200 to a loopback request with a foreign `Host`, so a rebinding page can read `root` (the checkout path). Information only; note for the slim replacement.
- **N3 question** The 74px rewrite also applies when the designer judges full-height pages in dev Storybook; are polish screenshots taken from dev or the build?

## Fix round 1 (head `f20afdb9`)

Scope: `f20afdb9` only (package.json scripts, `live.ts`, `main.ts:12-13`, web-preview, decision record).

- S1 **fixed**. `package.json:15` binds 127.0.0.1; `:16` `storybook:lan` keeps 0.0.0.0, and web-preview and the record say it exposes `/mcp` (owner choice, paraphrased). Storybook on :6806 with `--host 127.0.0.1`: LAN IP `/mcp` 000 (refused). Loopback with `Host: rebind.evil.test:6806`: 403 `Invalid host`, because Storybook checks Host when bound to a specific address (with 0.0.0.0 it answered 200 above). So rebinding is blocked by default. `http://localhost:6806` (as in `.mcp.json`) reaches `/mcp` and `/tidewave/mcp` (200 via 127.0.0.1); `/tidewave/ws` with the localhost origin 101. Residual: under `storybook:lan` both LAN and rebinding reach `/mcp`. The owner accepted that for phone sessions (should-fix risk, accepted).
- S2 **fixed**. `LOKA_NO_TIDEWAVE=1`: `previewHead` empty; without it, 1394 chars with toolbar.js. `npm run storybook:live` at this head: exit 0, 9/9 Live stories `ok`. `live.ts` binds 127.0.0.1 and fetches `localhost`; that resolved.
- N1 fixed in the PR body; N3 answered there.

Verdict: **APPROVE**.
