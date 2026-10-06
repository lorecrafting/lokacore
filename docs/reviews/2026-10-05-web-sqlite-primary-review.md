# Web SQLite bounded reads — independent primary review

**Verdict: APPROVE.** Exact source/evidence head
`812a9367cb7b04c574d87658a078914f7516630a`, local branch
`fix/web-sqlite-stream`, against published main
`5cb9562cb1293d2ac3569e6f28fe8d0684f87e87`. Fresh independent reviewer;
authored none of the implementation. No open findings.

Requirements derived from [Hosts](../system/architecture.md#hosts) and
[Opening a story](../system/save.md#opening-a-story): Web opens asynchronously
before synchronous recovery; growing SELECT results cross the worker in bounded
pages without changing current query bindings, ordered results, validation or
storage-error handling; native connection behavior and saves remain isolated;
current-build cold reopen retains saved state and durable narration.

Reviewed all current authority `getAllSync` query shapes: SELECT expressions,
scoped receipts, nested EXISTS, bound LIMIT, ORDER BY revision/rowid and trace
rowid projections survive the outer SELECT. PRAGMA queries remain direct.
Method forwarding retains its receiver, parameters and exceptions; only the Web
session factory applies the facade. No schema, authority, receipt-validation,
transaction or native-opening change. The chapter test's replacement literal
matches an independent Python SHA-256 of the unchanged v023 canonical fixture.

Independent checks on the exact head:

- Pinned Node focused `sqlite-web.test.ts` and `chapter.test.ts`: 6/6 passed;
  app TypeScript check passed.
- Real SQLite controlled probes passed for exactly full pages, lowercase/leading
  whitespace SELECT, bound LIMIT/OFFSET, current trace rowid projection, forwarded
  writes/PRAGMA/transaction status and propagated SQL errors.
- In a disposable detached worktree, replacing paging with bulk reads failed the
  new test with `Sync operation timeout`; changing the offset increment from 64
  to 65 failed its independent ordered-row expectation. Restored source and
  removed the mutation worktree; source branch untouched.
- All 18 retained evidence hashes verified; inspected browser harness, seed,
  bulk failure, resumed reload/fresh-tab witnesses and fresh-tab screenshot.
  The 2,402-receipt browser captures preserve revision, clock, RNG, world/projection
  hashes and Accept narration. Browser runs are retained developer evidence,
  not an independently repeated browser run. Full active-check log inspected;
  no redundant broad run performed.

The documented limits remain: a 64-row page or single large row must fit the
worker buffer, and OFFSET increases cold-open work. This approves the current
authority query shapes and supplied recovery proof, not a general SQL adapter
or unbounded Web storage guarantee. Publication and any separate save opinion
remain their own gates. Ponytail Review: lean already; nothing to cut.
