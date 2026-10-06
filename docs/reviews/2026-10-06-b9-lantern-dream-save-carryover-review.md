# B9 Lantern dream — integrated save/protocol carryover review

**APPROVE. No findings.** Independent reviewer authored none of B9 source.

- Initially reviewed source: `066bfda44dfe2947467d1a36eb93ee0c80d7fe68`.
- Final scoped source: `7bc3f745658b6727ce252c639ea9116a637c833a`.
- Final evidence-only head: `a39d698c4399b352c19f150d3992b18d2db9ca7f`.
- Published D2 predecessor: `4bcb2eafd0a984c611b71c3e4dc1e0d26defd533`;
  D2 publication-status integration is bookkeeping only.
- Earlier [save/protocol review](2026-10-05-b9-lantern-dream-save-review.md)
  and corrected [primary review](2026-10-05-b9-lantern-dream-primary-review.md)
  retain their original exact-head scope. This review checks the actual combined source.
- Governing [brief](../briefs/chapter-one/b9-inn-dream-brief-2026-10-05.md),
  [Rest/dream mechanics](../system/mechanics.md#s10-lantern-rest-and-dream-b9-selected-contract),
  [protocol](../system/protocol.md#b9-rest-occurrence-and-dream-composition),
  [save](../system/save.md#b9-dream-recovery),
  [Book](../system/book-ui.md#b9-bed-and-resumable-dream-details) and
  [workflow](../WORKFLOW.md#review-stance).

## Required behavior and source review

Paid entitlement must precede one accepted actor/body/room-bound Rest; credit,
S10 activation and initial checkpoint are atomic. Choice selection retains its
bound scene/branch and grants no memory; only final acknowledgement ends the
scene and resolves S10. Dormant dream choices preserve ordinary Read/play.
Cold recovery validates revision-ordered causal receipts and current rows;
unknown COMMIT fences input/elapsed, and exact retry never duplicates effects.

The existing accepted-history verifier and receipt-recovery entry point match
published D2. D2 topic/Read recovery tests and source remain unchanged. B9's
Rest producer/delivery, bound scene eligibility/sequence and dream receipt routing
match the corrected provisional B9 source. Ordinary dialogue/finale validators
exclude scene-owned choices without removing their accepted-history checks.
History replay recomputes each exact decision at its historical revision and
compares the complete final state, preserving lawful later book/drop/travel and
dream progress rather than inferring historical custody from today's room.

## Independent checks

- **17 focused tests pass:** real-SQLite dream, Maud services and Priory Read,
  plus dream wire fixtures. Existing integration cases include every dream
  checkpoint/both branches, eight uncertain-COMMIT outcomes, replay, elapsed,
  same-body fatal return, and first/already-known Read faults/recovery.
- **14 independently selected disk-backed cold-open forgeries** return
  `save_corrupt` with identical file bytes: Rest command actor, receipt actor,
  receipt scope, command/invocation identity, event scope/correlation/room;
  dream choice body/anchor/full scene reference; final Continue scene reference,
  memory scope and end-event cause. Each database connection was closed and
  reopened after alteration.
- **Three independent composed routes pass:** dream choice → travel/Read →
  return/Resume/end; Read → paid Rest/dream/end; and committed-but-lost Read
  while the dream choice is dormant → retry/replay → legal return/end.
  Each includes cold reopen, reread and dropping the original book before
  returning. The dream remains at choice4, Wake persists, and final recovery
  yields slepttrue/seentrue/cursor-1/S10resolved with zero reports.
- **Two independent red controls fail in isolated source copies:** removing
  exact accepted-response comparison makes forged Rest cold-open as `open`
  instead of `save_corrupt`; removing DreamDraw `expected_revision` from its
  required fields makes the malformed wire fixture pass unexpectedly. Both
  original targeted checks pass afterward. No source mutation was retained.
- Independent Python canonical JSON/SHA-256 recomputation confirms the
  v028/API1.25 successor hash `424a4497cca18c9f00b333cc8489eb9e95ce52f5239d6a394e4fa25e3d1fb34e`;
  published v027 hash/ID fixtures remain byte-unchanged.
- `git diff --check 4bcb2eaf..066bfda4` passes. Normal review-record commit is performed by the PM because this sandbox
  refuses Git worktree index-lock writes; no hook bypass is authorized or used.

Ponytail Review: Lean already. Ship. Existing accepted-history, changed rows,
choice/fact/quest ownership and receipt-bound narration suffice; there is no
new ledger, compatibility adapter or duplicate verifier.

This verdict approves the exact combined source above. Hosted CI and publication remain separate gates. No owner save was used;
no browser/native session was run by this reviewer.

## Scoped source correction

**APPROVE** at `e3517e7efbb3e21a4cb5bd363980ef8f7f2db479`. The only
delta from the initially reviewed combined source replaces three explanatory
comment lines in `lib/loka/content/checks.ex` with one line to satisfy its existing
380-line limit. An independent Elixir parser comparison with location metadata
removed confirms identical executable AST. No save/protocol, cartridge/pin or
UI behavior changes. The scoped diff check passes; no repeated runtime test is
required for this comment-only correction.

## Scoped Book label correction

**APPROVE** at `7bc3f745658b6727ce252c639ea9116a637c833a` for save/protocol
carryover. Its five-file delta exposes the presenter's existing label closure
and uses it for unavailable Notice prose, alongside the governing Book rule and
literal vertical/browser assertions. The actual closure, buttons, captured inputs,
freshness, receipt owner and recovery paths are unchanged. Kernel, authority,
protocol, cartridge and hash/ID fixtures match `e3517e7e` exactly. Diff check
passes. Primary review owns the new visible-label test/control and browser proof;
no repeated save suite is warranted by this presentation-only change.

## Final evidence carryover

**APPROVE** through evidence-only head
`a39d698c4399b352c19f150d3992b18d2db9ca7f`. All 36 changed paths from the
final source are inside the B9 evidence directory; no executable source, active
specification, cartridge or pin changed. All **69** manifest hashes independently
match the exact committed bytes. Check metadata names final source `7bc3f745`
and records full-gate exit0; its retained log reports351 Elixir tests passed and
active TypeScript/boundary checks passing. The combined behavior/schema logs
retain17 observed red controls/restoration and73 schema controls with zero survivors.

The final source's retained Book check has26 passing tests; its old-production
label control fails the literal `Rest: not now` assertion. Web metadata/log
records both actual routes passed on that same final source, including paid Rest,
choice reload/Resume, Wake, acknowledgement and cold reload. The hashed
acknowledged-bed frame visibly shows `Rest: not now` and `Dream acknowledged.`
This inspects the developer's browser evidence, not a new reviewer browser run
or native lifecycle proof. No save/protocol finding remains open.
