# M1-B1 round-two recovery proof inventory

Reviewed source: `b1795facd8b2e32fdcf076332c80ad769633412b`. Complete scoped records and PM
policy were fast-forwarded normally at `c2a2e42a659061000cc481c3a05372d333236a50` before fixes:
[primary, separate Sol and PM scope](../../../reviews/2026-10-04-m1-b1-driver-review.md).
[Active recovery policy](../../../system/save.md#durable-elapsed-sessions) and existing
[B1 PM adoption](../../../decisions/pm-decision-m1-b1-durable-elapsed-2026-10-04.md) were amended
before code. The independent verdicts are preserved; this is author evidence, not approval.

All 55 original, 28 round-one and 4 pre-push-correction artifact hashes verify unchanged,
including their unchanged manifest/verification files. Those source manifests remain historical.
This additive current manifest has 24 source entries, including the newly touched Start over test.
Neither manifest hashes itself or its verification report.

- **M1B1-R1-01:** actual controlled 4096-byte NOTADB and corrupted head-page files open with
  save_corrupt and an explicit recovery offer. Explicit Start over yields working v2 at literal
  clock/target 64800, wall10000/remainder0, and a saved Look/one receipt. No absent metadata
  is dereferenced or invented. A flag records only proven SQLite opening corruption; closure
  and current corruption are re-proved before the existing host removal path applies.
- **Direct unreadable-header caller:** overwrite the controlled NOTADB file with a real supported
  SQLite save, literal run `bbbbbbbb-0000-4000-8000-000000000001`. The old offer returns pending
  while native SQLite authorizer denies ROLLBACK or SELECT, then stale_view when readable/closed.
  The replacement's run, head/target64800, wall10000/remainder0 and zero receipts remain intact;
  actual localSession Start over reopens that replacement without resetting it.
- **M1B1-R1-02:** already-loaded elapsed Game with one saved Look refuses same-run v3 as
  unsupported_save_format, malformed format or v2→v1 drift as save_corrupt. Literal original
  run2, head revision1/clock64800, wall10000/remainder0/target64800 and one receipt stay intact.
  Opening the v3 file offers no new game. Existing own v1→v2 upgrade and explicit v1 behavior pass.
- **Sol-R1-01 / B1-03:** a refused missing-column opening followed by a different valid run ID
  with malformed format/pin intact returns save_corrupt, never stale_view, with literal header
  preserved. Subsequent v3 is unsupported, with original revision0/clock64800 and no receipts.
  Supported valid replacement protection remains covered by the earlier real cases.

Actual commands/scopes:

- Old same-layer seven-file local-story baseline: exit0, 89/89 PASS; existing legacy NOTADB host
  recovery case alone: exit0, 1/1 PASS (`old-green.log`, `old-corrupt-callers.log`).
- Correctly prepared new regression suite on unchanged reviewed source: exit1, 22 cases,
  18 PASS/4 FAIL (`new-red.log`). Fixed session/Startover suite: exit0, 22/22 PASS.
- Four scoped mutants: original four-file suite exit0, amended suite exit1; exact source/test
  bytes restored in finally blocks. `mutations.json` records edits and restored source hash.
  Loaded-format mutation restores the old unconditional same-run permission and removes
  its loaded early refusal together; malformed-priority control removes only the format-first
  classification. Other controls remove the absent-meta guard or proven-corruption permission.
- Final current-byte same scoped suite as the primary recheck: `mise exec -- node --test` over
  local-story elapsed-driver/session/faults/observe/start_over/recovery/saves/elapsed and kernel
  play/transcripts: exit0, 114/114 PASS. Includes actual deferred-FK failed COMMIT, successful
  COMMIT/lost acknowledgement, SQLITE_FULL, blocked reads, before/after-COMMIT process kill,
  reopened state, complete legacy replay and actual trusted elapsed CLI replay.
- Kernel `npm run typecheck`, mobile `npx tsc --noEmit` and source-size check: exit0. Final full
  required check is the normal pre-push hook; its actual terminal result is reported in the PR.

Ponytail Review: Lean already. The bounded existing format predicate is shared by opening and
recovery; existing corruption/identity/reconcile/localSession seams do the work. One evidence
flag carries no run/header guess. No dependency, generic serializer/save validator, production
fault hook, new source allowance or whole-world work was introduced.

Correctness self-review inspected the actual diff and direct reset/completion callers. Proven
file corruption stays distinct from operational uncertainty and typed checkpoint shape faults;
new readable replacement authorization is refused. Format permission is exact supported equality
or the known loaded v1→v2 transition. Newer format precedes recovery permission and malformed
format precedes valid-run stale classification. Original snapshot, cyclic admission, catch-up versus
unknown-save retry, completion and trace behavior pass unchanged. All three current findings are
fixed; exact-head CI and fresh scoped primary/Sol review remain required before merge.
