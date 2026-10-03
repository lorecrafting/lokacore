# Review: docs compaction PR 1 (`docs/system/`, DIFFERENCES, future list)

- PR: #117, branch `docs-compaction-1`, commit reviewed `f6a512b` (base `87a1246`).
- Reviewer: Claude Opus 5.5, independent; authored none of the work.
- Brief: `compaction-brief.md`, PR 1 part, and the owner decisions of 2026-10-02.
- Verdict: **CHANGES REQUIRED**. Six should-fix, five nits. The branch also needs a merge of `main`
  (Gate R6P, #114) as a new commit (no rebase, no force-push), which F-1 requires anyway.

## What must be true (written before reading the diff)

1. `docs/system/` totals at most 80 KB, and no file is over 15 KB. It has a `README.md` index and
   covers architecture (the boundary map), protocol, save, cartridge, mechanics and the active
   owner rules as one list with no history.
2. Each claim matches the code at the base SHA. Where the code and the spec disagree, the doc
   follows the code and DIFFERENCES.md lists the case.
3. The generated docs and the conformance and `protocol/` files are linked, not restated.
4. No file moves, no ROADMAP or AGENTS.md change, and README.md links the set. Those changes
   belong to PR 2.
5. The base contains #114, as the brief requires, so the owner-rules list is current.

Step 3 (test the tests) is skipped: the slice is docs only.

## Sizes

70,647 B in total, which meets the 80 KB target. The largest file is `protocol.md` at 13,671 B,
which meets the 15 KB target. The PR body's per-file table is from before `f6a512b`: it gives
protocol.md as 13,653 B and save.md as 7,861 B, and save.md is now 7,964 B.

## Claims checked (about 60, at `f6a512b`)

These claims are correct:

- **Save path:** `openStory` refusal order and the format regex; `corrupt` regex; receipt fields
  and the replay/conflict rule (`authority.ts:175`); a fault gets no receipt (`:187`); commit
  order (`store.ts:217`); `transaction`, `rollback`, `reconcile` and the fence (`save.ts:48`); the
  STRICT schema and unique keys; `load` rebuilds only sections that have rows; `newGame` drops the
  receipts and recreates `save`/`head`.
- **Story points and trace:** report capture (`:236`); `deliver` ordering and dispositions; trace
  cap 5000 and observation cap 1000; the smoke log of 200 lines; the fixed seed and context and
  the `-dirty` version (`smoke.ts:33-37`); every quoted test name exists.
- **Protocol:** 37 capabilities, all `portable_capability`; 18 invariants; the `identify` order;
  the intent digest; the `TARGETS` slots; job CommandId over `due_time` (`proposal.ts:262`);
  `LEGAL`/`DOOR`; resource `current`; `LIMITS`; policy leaves and `time_window`; `normalize`;
  `MAX_DEPTH` 128; the 11 BANDS; `resolved` ActionSet order.
- **Mechanics:** barrier `MOVES` and `exit_locked`; containment refusal order; movement `fare` and
  `passage`; recipe check draws (8) and cooldown/advance; dialogue `blocked` and `talks`; the
  `run_job` refusal.
- **Architecture and cartridge:** the boundary table (all eight `use Boundary` lines); strict
  mode; the red control; the `contracts.exs` differential guard; compose differentials and peer;
  sim `FRESH = 10_000`; App latency on `hermes_ios`; `INSTALLED` (8 + 10); engine pool defaults;
  Lantern rooms, gate, fact, choices, pools and start 21600.

The wrong claims are in the findings.

## DIFFERENCES.md

All 13 rows are real on the code side. I read rows 2, 3, 4 and 10 against the spec text as well:

- 04 §5.4 line 334
- 04 §5.3 line 313
- `SHOWN` covers only `move` and `perform`
- 03 §14 lines 595-633

The untimed Lantern is not a missing row: `pre-release-proof.md:41,59` was amended with the
decision. Slim gates is a process rule, so it is F-1, not a row. For the presenter boundary, see
F-6.

## Findings

**F-1 (should-fix): the owner-rules list is stale.** `docs/system/owner-rules.md:96-120`. The base
`87a1246` is before #114 (`7807b16`, merged), so
`owner-decision-slim-gates-2026-10-02.md` is missing. That record says:

- a gate is the owner's play, one Astra audit and a checklist;
- one reviewer;
- no Opus+Astra double review of docs-only gate PRs.

The brief requires a base after #114. Failure: an agent that takes `owner-rules.md` as the rule
list runs the old gate. Fix: merge `main` and add the line.

**F-2 (should-fix): the corrupt-file path is described wrongly.** `docs/system/save.md:19` and
`:81-82`.

- Row 19 says `save_corrupt` gives a new game "in place; reports survive" for every cause.
- Lines 81-82 say `report` rows stay "unless the report table is corrupt", which suggests the new
  game goes on without them.

The code does this:

- For NOTADB, a corrupt page, or a damaged report table or index, `replace` throws
  (`store.ts:139-143`, SQLite corrupt), so `newGame` replaces nothing.
- The host's Start over then deletes the whole file (`smoke.ts:250-256`, `:287-291`).
- Pending reports and the old trace go with the file (`start_over.test.ts:89`).

Only a parse-level corruption gets a new game in place.

**F-3 (should-fix): the reopen refusal cause is wrong.** `docs/system/save.md:22` says "a receipt
response that is not a DecisionResult". The code refuses a receipt response that is not valid
JSON (`smoke.ts:187`, `/malformed JSON/`). A response that is valid JSON but the wrong shape still
opens, and only its replay is a `conflict` (`authority.ts:176`).

**F-4 (should-fix): `stale_view` is overstated.** `docs/system/save.md:40-41` and
`docs/system/protocol.md:56` say any token other than the current one is `stale_view`. The code
treats only tokens that start with `view:` that way (`authority.ts:121`). Any other token is
admission metadata and is decided normally.

**F-5 (should-fix): DIFFERENCES row 12 misdescribes the cartridge.** `docs/system/DIFFERENCES.md:20`
says the Lantern "adds a `shelter` room behind `old_gate`". No room was added: `shelter` is the
spec's lantern shelter, east of the reed bank (`rooms/reed_bank.json`). The gate makes the landing
west exit lead into it (`rooms/landing.json:8-10`), so the map loops. The disagreement is real,
but the owner reads the wrong one.

**F-6 (should-fix, owner question): the DIFFERENCES header contradicts its rows.**
`docs/system/DIFFERENCES.md:3-5` says deferrals an owner decision carries go only to future.md.
Rows 3, 4, 9 and 11 are carried, and they also appear in `future.md:16-17,68-69`. Under the
header rule, the presenter boundary (`App.tsx:23` imports the smoke controller; there is no
`GameSession`) is correctly left out. Under the practice of the rows, it is missing. Pick one
rule and apply it.

**N-1 (nit): fault test coverage understated.** `architecture.md:105` says "SIGKILL after COMMIT".
The test kills before and after (`faults.test.ts:4-5`).

**N-2 (nit): restated conformance doc.** `protocol.md:24-42` restates `numeric-profile.md`, but
`README.md:26-29` says it is not restated. It is frozen, so drift is unlikely. A link plus the
citations is enough.

**N-3 (nit): restated generated list.** `protocol.md:87-88` lists the fault codes, which repeat
`EVALUATION_FAULTS` (`contracts.gen.ts:347`). `cartridge.md:80-84` repeats the CompiledCartridge
key list. Link `contracts.gen.md`.

**N-4 (nit): facts stated twice.**

- Resource regeneration: `protocol.md:112` and `mechanics.md:72`.
- Recipe cooldown admission: `protocol.md:158` and `mechanics.md:92`.
- Lantern stats and gate: `cartridge.md:113-114` and `owner-rules.md:21-26`.

**N-5 (nit, question):** `owner-decision-ts-test-types-2026-09-25.md` (type-check the TS tests)
is not in owner-rules. Is it still a rule, or only a CHECKS item?

## Fix round 1 (head `281c910`): APPROVE

Scope: only the fix commits and the hunks they touched (`git diff 3c5e802..281c910`). The merge
of `main` (`3c5e802`) is a new commit, not a rebase.

| Finding | Commit | Result |
|---|---|---|
| F-1 | `667ae47` | Fixed. `owner-rules.md` gains the slim-gates line, and it matches the record. |
| F-2 | `5c52209`, `281c910` | Fixed. `save.md` gives `save_corrupt` two rows: parse damage gets a new game in place, and SQLite corruption makes `newGame` throw. The New game section names the file deletion (`smoke.ts:292` is `remove()`), the test names exist, and the P4A-2 carry is on the ROADMAP SM2 row. |
| F-3 | `5c52209` | Fixed. The cause is now malformed JSON (`smoke.ts:187`), and `gameView` is at `:179`. |
| F-4 | `5c52209` | Fixed. `save.md` and `protocol.md` now limit `stale_view` to `view:` tokens (`authority.ts:121`). |
| F-5 | `241a006` | Fixed. Row 9 now describes the existing shelter and the loop (`rooms/landing.json:8`). |
| F-6 | `241a006` | Fixed by the PM ruling. Rows 3, 4, 9 and 11 moved out, and each is covered in `future.md` or on a ROADMAP row. The header rule and the rows now agree. Rows 6 and 7 are marked as code bugs, and both carries are on the "R7/R8 for chapter one" row. |
| N-1 to N-4 | `50f17ae` | Fixed. The restatements are replaced by links, and the anchors resolve. |
| N-5 | `667ae47` | Kept, with a reason: the owner decision is enforced (`bin/check_all.sh:28`), so the rule line is correct. |

Rulings on the two deviations:

- **(a) New DIFFERENCES row 5: accepted.** The disagreement is real: 23 §11 (`:157`) says
  "Completion-at-least-once persists despite local rollback/reset", but Start over deletes the
  whole file (`smoke.ts:292`). Only the index-only case is carried, and the rest is a PM decision,
  not an owner decision. So it belongs on the owner's list under the header rule.
- **(b) Citations stay at `87a1246`: accepted.** `git diff 87a1246..281c910` outside `docs/`
  changes only `README.md` (one line), so every code citation still holds at the head.

Also checked:

- The one-line ROADMAP addition (the `kernel_version` carry) is a PM-ruled carry, not a shrink of
  done rows, so it does not take PR 2's work.
- Sizes are 70,212 B in total and the largest file is 12,382 B, which meets both targets.
- `check_docs` passes.
- No new findings.
