# M1-B1 round-one proof inventory

Review base: `a0dfaba044f5cbe004743233fa8e93388e5b6258`; review records fast-forwarded at
`2d23372974bbf75505817b25bdbef9263fc2dbb8`. Findings and scope:
[primary, separate Sol and PM disposition](../../../reviews/2026-10-04-m1-b1-driver-review.md).
Governing policy: [durable elapsed](../../../system/save.md#durable-elapsed-sessions).

The 55 original hashed artifacts and both original manifest/verification files in the parent
directory remain byte-identical; their original manifest verifies. That historical source manifest stays historical. This directory adds current
source hashes and round-one evidence; neither manifest hashes itself or its verification report.

- M1B1-01: the actual shared Game finite-horizon case mutates caller targets and nested input
  after admission. Original bounded data completes saved at literal time 864000, and the next
  valid Look saves. Empty input is checked by literal empty own keys, independent of object prototype.
- B1-01: a different identified press during catching_up conflicts without releasing the first
  attempt; a matching retry retains its original id/context. Invalid/cyclic input refuses before
  snapshotting or accounting. Unknown-save pending retains the existing original retry behavior.
- B1-02: actual committed elapsed plus ordinary-command trace still replays byte-identically;
  malformed unterminated tail fails preflight without any state draw. Complete legacy NDJSON stays supported.
- B1-03: real SQLite missing columns produce typed corruption at open and after unknown metadata
  or gameplay COMMIT. Explicit recovery preserves a newer valid run, including valid, malformed,
  malformed-format and absent original header witnesses. Changed malformed witnesses refuse without
  writes; a genuine header read error remains pending. Terminal v1 upgrade/no-prior-checkpoint
  recovery waits while the controlled database's native SQLite authorizer denies ROLLBACK, then
  replaces only after closure succeeds. No production test hook or broad save validator was added.

Eight scoped mutants each survive the original same-layer three-file suite (exit 0), fail the
amended suite (exit 1), and restore exact source/test bytes. `mutations.json` identifies each
mutated source and restored hash; paired logs retain actual failures. `terminal_closure` bypasses
only reconciliation's rollback confirmation, leaving actual SQLite denied ROLLBACK in force.
All expectations are controlled literals; no source-text assertions or implementation-derived answers.

Checks, with scopes kept distinct:

- Original baseline: 47/47 PASS (`old-green.log`). Initial new assertions: 27 cases, 22 PASS/5 FAIL,
  before the first fixes (`initial-regressions-red.log`).
- Earlier focused driver/session/trace/fault/Startover/recovery run: 73/73 PASS. After closure
  preservation, the existing driver/session fault subset passed 29/29. These precede the last
  upgrade eligibility refinement and do not claim to test final bytes.
- Current-byte shared driver/session/trace: 29/29 PASS; the isolated new closure case: 1/1 PASS.
  Final current-byte driver/session/trace/real-fault run: 53/53 PASS, including genuine failed and
  committed-but-unknown COMMIT, SQLITE_FULL, actual process kill, reopen and trusted CLI replay.
- Kernel `npm run typecheck` and mobile `npx tsc --noEmit`: both exit 0. Source-size check: exit 0.
  Final required full check is the normal pre-push run; its terminal result is reported in the PR.

Ponytail review: no new dependency, serializer, clock abstraction, schema framework, test hook or
whole-world copy. The existing bounded canonical-copy seam is shared; the concrete session
admission helper lives in invocation.ts to preserve the source-file size limit. Checkpoint column
inspection and recovery header checks stay at their existing store/authority boundaries.

Correctness self-review: inspected the actual diff and session Start over callers. Fixed both
caller-owned retention and differing-intent retry, preflighted framing before dispatch, and kept
operational SQL errors distinct from proven checkpoint corruption. The newly uncovered terminal
upgrade path now binds its loaded valid run before the first checkpoint and preserves closure;
its own v1→v2 transition is legitimate. Refused openings keep their original raw witness. Explicit
v1 without clocks stays unchanged. All four findings are fixed; independent scoped rechecks remain required.
