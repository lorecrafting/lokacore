# Browser SQLite synchronous worker deadline

Base: published `main` at `747c252dc25b37046d482c4a51493d16d70e0378`.
Governing clause: [save commit/fence/reconcile](../../system/save.md#commit-fence-reconcile).

The existing Expo 57.0.3 install patch now replaces its CPU iteration timeout with
a five-second monotonic deadline, checking every 4096 spins. It preserves the
SDK pause and busy-loop fallback. Timeout reaches the existing save boundary;
there is no SQL retry or save reset.

## Checks actually run

- `NODE_NO_WARNINGS=1 mise exec -- npm run test:e2e`: exit 0. Its pretest runs the
  actual patched WorkerChannel with real worker threads: replies delayed 100 and
  250 milliseconds succeed, and a silent worker times out around five seconds,
  both with native Atomics.pause and with pause absent. All eight browser files
  and 14 browser tests pass, including saved movement/reload and chapter routes.
- `NODE_NO_WARNINGS=1 mise exec -- node --test --test-reporter=dot
  ../authority/local-story/faults.test.ts ../authority/local-story/saves.test.ts
  ../authority/local-story/recovery.test.ts`: exit 0, 47 tests passed.
- Restoring the SDK CPU loop: the existing `sqlite-web.test.ts` still passes
  (exit 0). The new generated-worker check fails (exit 1): pause mode refuses a
  healthy reply after about 74 milliseconds; silent fallback exceeds its
  eight-second watchdog. Removing the elapsed-deadline check also fails both
  modes via that watchdog (exit 1). These controls mutate the real patch output;
  temporary changes were restored before the green browser run.
- Version drift to 57.0.4 and a duplicate worker loop each refuse patching
  (exit 1), with input worker bytes preserved. Applying the actual patch twice
  succeeds in the behavior test.
- Changed-file Prettier, TypeScript size check and `git diff --check`: exit 0.

The full local gate is pending its serialized run. Correctness self-review found
no unresolved issue; Ponytail Review: Lean already. Ship.

## Limits and retained output

The controlled reply tests run on Node using compiled installed Expo source,
not delayed OPFS in a browser. Real browser checks use the runner's disposable
profile and ports 19106/19107. A synchronous silent worker can still occupy the
foreground thread until its deadline; clock checks are periodic. No native
verification ran and no owner save was accessed.

Sanitized raw output: [browser](browser.log), [authority](authority.log),
[red controls](controls.log). [SHA256SUMS](SHA256SUMS) covers these retained
bytes; [verification](SHA256SUMS.verify.txt) is kept alongside it.
