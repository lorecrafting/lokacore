# Web SQLite bounded reads — save/recovery opinion

Verdict: **APPROVE**. No findings or open items.

Reviewed exact source head `812a9367cb7b04c574d87658a078914f7516630a`
against published main `5cb9562cb1293d2ac3569e6f28fe8d0684f87e87`.
Fresh independent reviewer; authored none of the source change. This separate
save/recovery opinion supplements the primary review.

## Contract applied

- [Hosts](../system/architecture.md#hosts): Web-only paging retains authority
  query parameters/order; native opening remains unchanged; reload/reopened-tab
  saves retain their current build.
- [Save](../system/save.md#opening-a-story),
  [receipts](../system/save.md#receipts) and
  [commit/fence/reconcile](../system/save.md#commit-fence-reconcile): exact history,
  confirmed transactions before adoption, operational read errors and typed
  corruption refusal, with no silent replacement/deletion.

## Verification

The synchronous page loop cannot interleave same-tab gameplay. Current ordered
queries retain their ORDER BY and bindings through the subquery; accepted history
requires contiguous revisions and exact replayed state. OPFS contention still
fails explicitly; paging changes neither handle ownership nor transactions.

- Focused Web test: pass; independently planted bulk-read and overlapping-page
  (`offset += 63`) mutants: fail; restored source: pass.
- Disposable real-SQLite probe through `webDb`: accepted revisions 1–132;
  history pages 0/64/128; reopened projection and Elspeth Accept narration;
  genuine failed COMMIT retains all prior state; lost acknowledgement retains
  all next state, and exact retry replays without another receipt.
- Later-page operational read failure propagates; duplicate accepted revision
  returns `save_corrupt`. Both refusal probes preserve the SQLite file bytes.
- All 18 retained [evidence](../evidence/2026-10-05-web-sqlite-stream/README.md)
  hashes verify. Reload/fresh-tab witnesses retain 2,402 receipts, head/clock/RNG,
  world/projection and narration. Reviewed supplied app-suite and active-check
  summaries; independently verified the corrected v023 SHA-256 literal.

Ponytail Review: **Lean already. Ship.** Actual diff review found no correctness
or persistence-safety issue. Each page/single row must still fit the worker byte
buffer; OFFSET work grows with history. These documented limits remain.

Read at the reviewed revision: `AGENTS.md`, storage/mobile/evidence lessons,
`WORKFLOW.md`, reviewer instructions, architecture and relevant save sections.
Temporary probes/mutations were removed. Native testing, owner saves, hosted CI,
push and merge were outside this review.
