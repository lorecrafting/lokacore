# Browser SQLite worker deadline — second opinion

Reviewed `fix/web-sqlite-sync-deadline` at exact
`482f6837585c580d3a8cdcdef124bfff938dfce7`, against source base
`747c252dc25b37046d482c4a51493d16d70e0378`. Fresh independent Codex reviewer;
authored none of the patch. Supplements the [primary review](2026-10-06-web-sqlite-sync-deadline-review.md).

```text
Verdict: APPROVE
Findings: none
```

Required behavior from [save confirmation and reconciliation](../system/save.md#commit-fence-reconcile)
and [refusal](../system/save.md#opening-a-story): healthy replies must survive fast CPUs;
silence must stop at an elapsed deadline in pause and fallback modes; version/source drift
must refuse before changing installed bytes; uncertain SQL cannot be retried or adopted
without confirmation, and saves cannot be silently replaced.

The actual installed bridge gives each request separate shared buffers. The monotonic
five-second deadline at `mobile/app/patch-sqlite-web.cjs:40` replaces both iteration caps;
its periodic check at line 47 retains pause/fallback behavior. A timeout throws through
the existing transaction boundary: failed COMMIT remains uncertain until rollback and
receipt confirmation; memory adoption still follows confirmed storage. No SQL retry,
pin change, save reset or new persistence path appears in the source delta.

Independent verification at the reviewed head:

- Pinned `mise exec -- node --test --test-reporter=spec sqlite-web-worker.test.ts
  sqlite-web.test.ts ../authority/local-story/faults.test.ts
  ../authority/local-story/saves.test.ts ../authority/local-story/recovery.test.ts`
  from `mobile/app`: exit 0, **50/50 passed**. Real SQLite checks cover failed and
  unknown COMMIT, lost acknowledgement/replay and pin/format refusal.
- Disposable copies of the actual patched bridge: restoring the SDK CPU limit fails
  both worker-mode tests (healthy pause reply refused; silent fallback hits the
  eight-second watchdog). Removing the deadline also fails both modes at the watchdog.
  Both control runs exit 1; temporary copies were removed.
- Independent version drift to `57.0.4`, duplicate loop and changed deadline each
  refuse patching with exit 1 and exactly unchanged worker bytes. Baseline tests
  exercise applying the real patch twice successfully.
- All four retained [evidence](../evidence/2026-10-06-web-sqlite-sync-deadline/README.md)
  hashes verify, including the full-gate output. Browser and full-gate logs were
  inspected; those runs were not independently repeated. `git diff --check` passes.

Ponytail Review: **Lean already. Ship.** No additional machinery to remove.

Limits: controlled delay/silence executes installed Expo source with real Node workers;
it does not inject OPFS faults in a browser. Synchronous waiting still occupies its
thread; periodic clock checks do not guarantee real-time scheduling. No native work,
owner-save access, source edit, push or merge occurred. Only this record and index change.
