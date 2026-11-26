# Review: Phone checks in WebKit with an iPhone profile (PR #804, loka-hcnlh.61)

- PR #804, branch `test/phone-webkit`. Reviewed at `cd18be853cf3c1a2066ff56abfecf43c3a052a6a` (contains #803).
- Governing: [book-ui.md Author mode](../system/book-ui.md) (Two layouts, grip; Undo; + Add here), [book-ui.md Chapters, scenes and recovery](../system/book-ui.md) (save-file lock, Try again).
- Why a record: asked for by the PM brief (a tests-and-CI slice; no product source changed).
- CI at the head (`gh run list --commit cd18be853…`): graph-diff, book-e2e, ci all success; `phone` job success in 160 s.
- `/code-review medium`: reported in the PR body (two rounds).
- Verdict: **APPROVE WITH NOTES**.

## Must be true (written before the diff)

1. The page runs in WebKit at phone width with touch, so the sheet takes the narrow layout: modal, lower half, full width, with a grip.
2. Grip: a drag up fills, a drag down from full halves, from half closes; a drag is not read as a tap.
3. Save: actions persist over reloads; a second tab on the held save gets Try again, and Try again opens the save once the first tab is gone.
4. Each test fails when the behavior it names breaks; no product source changes.
5. `book-e2e-green` fails when `phone` fails or is cancelled.

## Checks run (detached worktree at the head; the suite's own `listen(0)` ports, not 196xx; nothing on 19005-19009 from this run)

- `node tests/phone.ts`: pass 6, fail 0, 69 s.
- `bin/mutate_diff.sh origin/main`: NO-TESTS 36, NOT-UNIQUE 2, 0 run (handback: 33; harness lines only).
- `bin/mutate.sh`, full command `node tests/phone.ts`:
  - `SaveError.tsx` `locked(f) ||` → `false &&`: red-full (developer's control, confirmed).
  - `mapedit.ts:103` far-face delete → `return [];`: red-full (developer's control, confirmed).
  - patched `expo-sqlite/web/SQLiteModule.ts` `worker?.terminate();` → `void 0;`: **SURVIVED** (Finding 1).
- Order probe: with + Add here moved last, it fails (30 s `waitFor` timeout). With the same order and a `load` wait around the Delete at `:286`, it passes 5/5 (Finding 2).
- Wiring: `book-e2e.yml` `book-e2e-green.needs` includes `phone`, and the verdict fails on `failure`/`cancelled`. Node's `spawn` drops `undefined` env values, so `CI` really is unset.
- Cites rerun: Metro `createFileMap.js:70` `watch = … !isCI` is backed. The `tests/steps.ts` 250 ms wait is backed (it sits at line 34; the PR says 35).

## Findings

1. **Should-fix**, `mobile/app/tests/phone.ts:129-130`: the comment claims the two reloads catch "a reload left holding the lock… (#803's pagehide)". Removing #803's `terminate()` leaves the suite green, because a reload or a close ends the worker with the document. Drop that clause. #803's own unit tests (`sqlite-web-pool.test.ts`) cover it.
2. **Should-fix**, `phone.ts:286`: the Delete is a structural compile, but nothing waits for its reload. Any test placed after it races the reload. This is the "unexplained" order dependence (proof above). It is not a flake today, since it runs last. Wrap it like `:280-282`; the ordering sentence at `:225` can then go.
3. **Nit**, `.github/workflows/book-e2e.yml` `phone`: it uploads nothing on failure (no screenshot or trace), so a hosted timeout, like the one on 5159b6d51, is diagnosed blind.
4. **Nit**, `phone.ts:43`: the detached servers outlive Ctrl-C, and also any outer group kill (`bin/mutate.sh` timeout). This only matters locally.
5. **Nit**, `phone.ts:260-261`, `:20`, `:102`: the unscoped textbox and Save only cascade a failure and never give a false pass. One shared artifact folder per worktree is fine. The 250 ms waits match `steps.ts`. Accepted.

Second-tab Try again (`:137-142`): it is sound against #803. `p.close()` ends the worker, and Try again reloads into a fresh one. It was green in the three runs where Try again was not mutated, and on hosted CI.
