# Review: Loka picker + polish panel; remove Tidewave (PR #339)

- PR #339, branch `polish/picker`, head `afac4c52`. Beads loka-x6t.3 (epic loka-x6t). Dev tooling slice; full review (new dev-server endpoint).
- Governing: [design input P1](../briefs/polish/design-input-p1-2026-10-09.md); [live polish session](../WORKFLOW.md#live-polish-session); [web preview, Polish queue](../web-preview.md#polish-queue); [MCP decision](../decisions/owner-decision-storybook-mcp-2026-10-09.md); AGENTS.md "Writing tests".
- Verdict: **APPROVE WITH NOTES** (two should-fix, three nits; nothing blocks the first live session).

## Must be true (written before the diff)

1. The queue middleware answers loopback only (Host and Origin, `Origin: null` refused), serves no path a client names, bounds the body, and is absent from `storybook build` / smoke.
2. The picker never imports `book/`; the overlay is `position: fixed`, moves no story box, uses only `#1EA7FD` and `#FFFFFF`; the manager side uses theme roles.
3. Tidewave is gone everywhere the brief lists; `live.ts` and the Storybook MCP addon still run.
4. The three lint rules and the picker test fail on their plants and on narrow mutants.
5. Pick/`P`, hover chip (owner chain, max 4, size), click pins, shift-click up to 4, Esc clears then exits; composer in the panel; statuses, model badge, PM card, Close batch disabled while working.

## Proof

- (1) Probes on my `:7307` dev server (`LOKA_POLISH_DIR` in the scratchpad): loopback GET 200; `Host: rebind.evil.test` and `Host: localhost.evil.test:7307` 403 (Vite's own check); `Origin: null`, `http://evil.test`, `http://localhost.evil.test` 403; `Origin: http://localhost:7307` 200; `GET /polish/shots/../picks.jsonl` and `%2e%2e` 404; body `null` and `{"elements":"x"}` 400; a pick with a data-URL png -> `shots/<id>-0.png`, served back as `image/png`; `{type:'close'}` -> one line without `elements`. The id is server-made (`middleware.ts:97`), the shot route accepts `[\w-]+\.png` only (`:123`), the plugin is added only under `dev()` (`main.ts:12`, `:101`).
- (2) `ast-grep test --skip-snapshot-tests`: 19 passed. `bin/lint_red_controls.sh`: the three `mobile-picker-*` rules report on their plants (the `mobile-book-bleed-only-tap` miss is on main too: no plant there). `mobile-book-raw-values` without the new ignore flags 5 picker spots (px sizes the design input names), so the ignore is justified.
- (3) `grep -ri tidewave` outside `.beads`, archive, lessons and reviews: only the decision record's "replaced" note, the live-session decision and the design input. Lockfile: no `node_modules/tidewave`, `html-to-image` present. `.mcp.json`, `settings.json`, both agent tool lists clean.
- (4) `npm run storybook:picker` clean: `ok picker: ... EntityLine in book-entityline--item`. Mutants, each exit 1: `items.tsx latest()` `.at(-1)` -> `.at(0)` (status never shows `done`); `panel.tsx` `working(feed) > 0` -> `> 1` (`Close batch enabled while an item is working`); `overlay.ts` `!UNNAMED.test(nm)` -> `UNNAMED.test(nm)` (`chain ["Text"] lacks EntityLine`).
- (5) Playwright on `:7307` (`book-actioncard--list-of-six`): hover chip `ActionCard · 388×28` flipped below a box with top < 20; pinned mark `1 ActionCard · 388×28`, border `rgb(30,167,253)`, fill `rgba(30,167,253,0.12)`; a click then five shift-clicks -> 4 chips; `P` and Esc from the manager document and from inside the iframe (focus in the preview): on, clear, off. Panel: session pill, empty state, owner item with thumbnail + story title, `working · FABLE` pulsing dot, PM card with Close batch / Keep going, `done · FABLE · row tightened · abc1234`. `/code-review` result reported with dispositions.

## Findings

1. **should-fix**, `lint/rules/mobile-picker-overlay-colours.yml:8`, `lint/rules/mobile-picker-raw-colours.yml:9`: the hex alternative is anchored (`^#...$`), so a colour inside a longer string passes. Planted `extra.style.cssText = \`background:#ff0000\`` in `overlay.ts` and `{ border: '1px solid #fff' }` in a new manager file: 0 reports. `cssText` templates are this file's own idiom (`overlay.ts:14`, `:24-25`), so the design input's "exactly the two overlay constants" is not enforced where the next raw colour would be written. Fix: `#[0-9a-fA-F]{3,8}\b` unanchored, keep the `not` for the two constants (the valid cases still pass).
2. **should-fix**, `mobile/app/.storybook/picker/panel.tsx:109`: after every pin the composer takes focus (`panel.tsx:93`), and its Escape handler only clears. Owner pins, presses Esc (pins cleared), presses Esc again expecting Pick off (design input section 1, brief "Esc clears, second Esc exits"): Pick stays on, the next click in the story pins instead of acting. Measured: `esc1 in composer` chips 0 / layer `block`, `esc2 in composer` layer still `block`; the same keys with focus in the preview end `none`. Fix: when nothing is pending and the text is empty, `toggle(false)`.
3. nit, `mobile/app/.storybook/picker/items.tsx:59`: the owner item shows the story title but not `light · iPhone 11` (design input section 3, "Owner sees"); palette and viewport ride only in the JSON.
4. nit, `mobile/app/.storybook/picker/items.tsx:84` with `panel.tsx:21`: the PM card's Close batch renders without a session, and the header's confirm is gated on `feed.session`, so the button opens nothing. Only a `suggest-close` line left over outside a session reaches it.
5. nit, `mobile/app/.storybook/picker/overlay.ts:110`: "the build and the smoke never bundle it": Vite code-splits a static `import('html-to-image')` into a chunk; only the load is deferred. The PR's claim is about the string, which a hashed chunk does not carry. Comment only.

## Judged, no finding

- Nightly `storybook:picker` instead of the hook: a dev server + browser run of about a minute; the hook already runs smoke; the lint rules run in `check_all`. Fine.
- Pins not following scroll/resize: the pick's box and crop are taken at click time, only the outline drifts; re-pin after a scroll. Crop still rendering at send: `png: null`, the chain/box/text/computed stay. Neither blocks the first session.
- Fast shift-click (<150 ms between the two clicks) left one preview mark while the composer held two chips; at 150 ms and above both marks show. Not a human timing.
- `mobile-book-bleed-only-tap not reported` in `bin/lint_red_controls.sh` (full mode): pre-existing on main, for Beads.
