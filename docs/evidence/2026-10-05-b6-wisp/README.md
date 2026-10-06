# B6 Wisp proof

Final source: `e7aeace7f369254e3fb4b3f197dc1b641b6e6e87` on
`chapter-1/b6-wisp-ward`, after published B7 main
`547f809ccdd587498dee86cb14822f564efee642`. v023/API1.21 artifact:
`e7333f694e6ec2c9f02a39944d994d4452f26fffc5534ff217346504471e4c71`;
103 initial IDs, independently derived from reviewed B7 v022. B4 and B5 are installed.
Headless proof only; hosted CI, native/Hermes/browser proof and independent B6 reviews: null.

## Checks and invocation proof

- `bin/check_all.sh`: exit0 on the final source, 340 Elixir tests and all active
  kernel/headless simulation, generation, docs, purity, size and planted controls;
  `full-active.log`.
- `mise exec -- node --test` over Wisp, Wisp contracts/loader, old Wren riddle and
  Book riddle: exit0, 24 passed, `focused.log`.
- Entire headless `mobile/authority/local-story/*.test.ts` and `mobile/app/book/*.test.ts`:
  exit0, 451 passed, one existing skip, `broad-story-book.log`. Exact source was
  `34dfa745d40ee9266819457b316f91bd9bf39032`; the final cleanup only removes a
  redundant comment and passes the same already-read row into composition dispatch.
- App `npx tsc --noEmit`: exit0, `app-types.log`. Node and actual SQLite versions:
  `runtime.json`; no device timing claim.
- `q1-offered-invocations.log` records current production Q1-ready offers, the
  unlabelled Elspeth invocation with omitted selector, actual report and active Q2.
  `selector-scope.log` passes unchanged Q1/report/Study scenarios together with
  the labelled Wisp/ward controls. `focused.log` includes real Book confirmation
  of Seek, riddle answers and the exact `c_aldric_ward` button/source/history.

## Distinct regressions and red controls

Literal fixtures cover positive threshold equality, malformed contracts, exact
actor/source/quest/revision/prior associations, single increments, writer conflict
and mandatory third-answer closure. Gameplay checks narrow dark visibility,
malformed input, immediate sitting reset, effective-light refusal, retained S4,
idempotent knowledge and a forged live co-located speaker. File-backed SQLite tests
cover reopen at counts0/1/2/closed/resolved, real failed or uncertain COMMIT at
wrong/third/correct transitions, exact retry, corrupt associations and unjustified grants.
The actual association validator is checked directly against actor/source/quest
forgeries so a later save validator cannot mask a broken guard.

`behavior-red-controls.json` retains 14 actual source mutations, all killed. Each
records the older same-layer suite and new focused status. The wrong-success branch
is already caught by old Wren tests; no dedicated duplicate regression was added.
Elixir's foreign-source guard removal fails the literal portable answer while its
older composition suite stays green; `elixir-source-red.log` and
`elixir-restored.log` retain failure and restoration. Every mutation restored source.

The schema sweep covers all46 new/changed bounds, required entries and closure
constraints, including topic projection and compiled topic map keys. Both kernels
agree:28 removals are caught by independent invalid fixtures; the other18 make the
schema invalid under the supported generator subset and are rejected by actual
`bin/contracts.exs`. Results: `schema-mutants.json`, `schema-elixir-results.json`,
`schema-generator-results.json` and their logs. No unexplained survivor remains.
Replay scripts are retained beside the results; run from repository root in an
isolated checkout, never concurrently with another source/check process.

## Review and limits

Ponytail Review removed duplicate opening-receipt reads and reused ActionSet,
choice/receipt, visibility and player Boolean facts. No new dependency, table,
source-size allowance or `runtime/proposal.ts` change. The actual-diff correctness
pass restored immutable saved-role bindings after a mapping-drift regression and
added a declared-key guard, then bounded exact Talk selection through authored
labels after the broad suite exposed Q1 routing drift. The full old scenarios pass
unchanged. Independent primary and save/protocol review remains required.

Ward currently has the Wisp grant and public Aldric consumer; later Read/topic
consumers must supply their own provenance. No backward development-save adapter,
wait/night gate, spell effect or general topic graph was introduced.

All retained logs pass capture redaction. `SHA256SUMS` hashes retained artifacts;
`verify.txt` records verification. Neither checksum file lists itself.
