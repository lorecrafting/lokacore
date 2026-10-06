# Web SQLite recovery investigation — preserved WIP

Base: published main `5cb9562c`. Work stopped after the PM relayed the owner's
instruction to prioritize the eventual mobile version and skip Web-only work.
This branch is retained for reassessment; it is not independently reviewed or published.

The proposed host facade and its integration are Web-only. It pages SELECT reads in
64-row batches and forwards other connection operations, leaving native opening and
existing authority SQL/validation intact. Governing section:
[Hosts](../../system/architecture.md#hosts).

## Existing evidence

The disposable browser proof imported a real SQLite save produced by the existing
chapter authority: 2,400 accepted Look commands, Elspeth Talk and Accept. Its accepted
history's native worker result (after the separately returned first row) was
1,065,517 bytes, over the 1,048,572-byte payload capacity. [Seed](seed.json).

- Two cold opens through the paged facade preserved receipt count 2,402, head revision
  2,402, clock 64,800, RNG, world rows, projection and nonempty Elspeth narration:
  [first](cold-open.json), [repeat](cold-reload.json), [screenshot](cold-reload.png).
- The old bulk browser control failed with `Sync operation timeout` at the exact
  accepted-history query in `receiptHistory`, through `liquidSave`, `receiptRecovery`,
  `load` and `openStory`. Its query and stack are [captured](bulk-red.json).
- The return from the red control encountered the separate OPFS access-handle
  contention error: [capture](after-red.json). A later fresh-tab capture was blank
  before the component settled; fresh-tab success is not claimed.
- The initial per-row `getEachSync` proposal failed with `Array buffer allocation failed`
  during rapid seeding and during a 2,402-receipt cold open. A first paged reload also
  reported timeout while source/test mutations were still occurring; its cause is
  unverified. These failing variants are retained here rather than counted as passes.

[Browser harness](browser-proof.tsx.txt) and [controlled seed generator](make-seed.mts.txt)
are retained as source artifacts. They were temporary proof tooling, never production
entry points. The disposable SQLite files are preserved outside the repository; no
owner browser save, owner preview or native simulator was accessed.

## Checks already run

- App TypeScript check: passed on final paging source.
- App suite: 461 tests, 460 passed, one skipped, zero failed.
- New focused real-SQLite test verifies a >1 MiB aggregate, bound parameters,
  descending order, final partial page, empty/null and PRAGMA behavior:
  [green](focused.log).
- Old focused suite passes the bulk-read mutant (459 passed, one skipped); the new
  focused test fails it with timeout: [red](bulk-mutant.log). Thus it catches a distinct
  Web boundary regression.
- The full active line passed on the earlier row-iterator variant. The final-source
  full check was stopped at owner steering during kernel tests after earlier checks
  and kernel typechecking passed; final full-line green is not claimed.
- The existing native App test's stale chapter pin was independently repinned to the
  frozen v023 canonical SHA-256, checked with Python hashlib; no fixture changed.

Self-review: no new dependency, SQL parser, authority API or native behavior change.
The facade is specific to the browser host. Pagination preserves current SELECT shapes
and their parameters, with deterministic ORDER BY covered by controlled input. Each
64-row page, including any single row, still must fit the Web bridge buffer. OFFSET
paging can add cold-open work as history grows. These limits remain explicit; this WIP
is not a general Web storage redesign.

The reusable findings concern growing durable receipt history and recovery transport
budgets. The 1 MiB worker buffer, shared-buffer allocation pressure, facade and browser
harness are specific to Expo Web and do not establish an equivalent native defect.
