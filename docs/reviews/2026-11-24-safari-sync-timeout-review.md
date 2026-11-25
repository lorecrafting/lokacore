# Review: Safari save, OPFS pool warm-up and Try again on a sync timeout (PR #792, loka-hcnlh.19.2)

- PR #792, branch `fix/safari-sync-timeout`, head `708ea32108cda42c5ab6ea78975dcbbbf4322a41`.
- Governing: [book-ui.md, Chapters, scenes and recovery](../system/book-ui.md) (save-open errors, line 735-742); [web-preview.md](../web-preview.md) (the SQLite web patch); brief in `br show loka-hcnlh.19.2`.
- CI at head (`gh run list --commit 708ea3210…`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body.
- Verdict: **CHANGES REQUIRED**.

## Must be true (written before the diff)

1. An existing save opens unchanged: the warm-up never touches the pool header or the data, and it leaves the file at its exact size.
2. A crash during the warm-up loses no data.
3. The warm-up runs on every WebKit engine (Safari, and iOS Chrome, Firefox and Edge) and on no Chromium engine.
4. The patch is idempotent. A stale install refuses it. Every path that serves the Book runs it.
5. Try again on a timeout is a reload only: it destroys nothing, and Start over stays as it was.
6. The tests go red when the warm-up is dropped or weakened.

## Checks run (throwaway worktree at head)

- `bin/mutate_diff.sh origin/main`: 3/3 red-narrow (`SaveError.tsx:15`, `:53` twice). The `.cjs` patch is outside its globs, so I wrote hand mutants for it.
- Hand mutants on `patch-sqlite-web.cjs`, run against `sqlite-web-pool.test.ts`:
  - Red: truncate dropped, `truncate(size + 1)`, warm write dropped, the gate's `&&` changed to `||`, `replace` in place of `replaceAll`. These include the PR's red controls, rerun.
  - Survived: headroom of 1 MB, and headroom of 8 MB.
- Patch run twice on a scratch install gives the same sha. A different warm-up text throws `Reinstall expo-sqlite`. A pool edited after the patch throws as well.
- UA gate (`patch-sqlite-web.cjs:117`), run in node:
  - true: CriOS, FxiOS, EdgiOS, Mac Safari.
  - false: desktop Edge, Android Chrome, Firefox.
- Playwright WebKit 2359, persistent profile, preview on 19606/19607:
  - Patched: `look` saves in 19 ms, and again after a reload.
  - Unpatched pool, the PR's red control rerun: the open fails with `Sync operation timeout` and the screen shows "Try again", with no Start over.
  - Patched pool put back and the page reopened: the save opens. The revision went from 142 to 218, so no data was lost.
- Crash between the warm write and the truncate, simulated with the sqlite3 CLI: a db with 32 MB of zeros appended passes `integrity_check` and takes a write. The file stays 33.5 MB.
- The header is untouched, because the write lands past the end of the file. The truncate is exact: the off-by-one mutant went red.

## Findings

1. **should-fix**, `mobile/app/package.json:8`: `web:preview` does not run the patch; only `author` (line 9) gained it. The owner's preview checkout runs `bin/preview_update.sh:26`, which serves `npm run web:preview` and runs `npm ci` only when the lockfile changes. This PR changes no lockfile. `bin/worktree_setup.sh` also clones main's unpatched `node_modules`. So after the merge, Safari on the owner's preview, and the 3.2 phone walk if it uses that preview, still gets `Sync operation timeout`. Fix: give `web:preview` the same `node patch-sqlite-web.cjs &&` prefix.
2. **should-fix**, `mobile/app/sqlite-web-pool.test.ts:124`: the test grows the save by only 1 MB, so a headroom cut from 32 MB to 1 MB or 8 MB stays green. Scenario: someone shrinks it to save quota. CI passes, and Safari saves stall in play after 1 MB of growth, where there is no Try again. Fix: one write that ends near 31 MB past the size.
3. **should-fix**, `docs/system/book-ui.md:739-742`: "That lock alone … adds a Try again … Every other cause offers only the permitted Start over" contradicts `SaveError.tsx:15`. The PR says the designer is updating it, but I found no bead or PR for that. The spec change has to land with or before this merge.
4. **nit**, `mobile/app/patch-sqlite-web.cjs:119-124`: a crash between the write and the truncate leaves 32 MB of zeros. The next warm-up truncates back to that bloated size, so the bloat stays and builds up by 32 MB per interrupted open. This is a quota leak with no data loss.
5. **nit**, `docs/web-preview.md:36-38`: the patch summary does not name the WebKit warm-up.
6. **nit**: the PR body has no `mutate_diff` table.

## Open questions

- WebKit's quota cost: each open reserves 32 MB on each of the six pool handles. On a near-full iPhone the write throws, the catch skips the headroom, and the save opens as before. Real Safari has not been run.
