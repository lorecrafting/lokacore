# Review: PR #19, maintenance: apply ADR-074 to the spec; enforced trigger; R3 owner decisions

- **PR:** #19, branch `maint-adr074-amendments`, head `e7b1625` (four commits on `main`).
  CI green on all five jobs. Reviewed by a fresh Fable reviewer that authored none of it
  (design judgment for the spec amendments; test-the-tests for the one new check).
- **Verdict: CHANGES REQUIRED**, no blocker. Four should-fix items, about a dozen lines in
  all: one planted case and two fixtures the new check and schema bounds lack, one
  sentence in 14 §R9 that contradicts 09 §5 and 15 DET-02 as amended by this same PR, and
  README §5/§7 still calling the kernel choice open. Everything else traces.
- Line numbers are at `e7b1625`. Parallel PR #20 is noted at the end; conflicts only.

## 1. Written before the diff: what must be true

1. Every text change under `docs/spec/` maps to a crosswalk row marked Amend or Replaced in
   ADR-074's appendix, and says what that row says: `portable_capability` rules are
   TypeScript-only until the first planned server consumer; the portable semantic
   foundation keeps both kernels and its differential now; TypeScript host conformance
   (Node, Android Hermes, iOS Hermes; Node-recorded bytes replayed on device; 10,000
   fresh sequences on Node per fast CI run; a device sample at R6P) is retained; the R5
   simulation and the R9/R11 Lab run the TypeScript kernel headless on Node and do not
   fire the trigger; the compiler stays Elixir; R14 needs the Elixir port and differential
   before its playthrough gate; the route choice waits for the trigger.
2. Rows marked Retained, Note only, Unchanged or Unaffected have no text change, or a
   change that only restates the row's own gloss.
3. `protocol/` changes are additive (optional fields on the portable variant only);
   `conformance/` and every frozen fixture are untouched; historical results stand.
4. Each document 16 entry cites an owner record that contains an acceptance, in 16's
   heading-plus-Status form.
5. The trigger check fails on a `portable_capability` with an `elixir` host adapter and no
   differential, and on a declared differential whose file does not exist; passes with an
   existing file and for TypeScript-only adapters; the red control catches a neutered
   check; every new schema bound has a fixture that fails when the bound is removed
   ([contract lessons](../lessons/contracts.md)).
6. AGENTS.md stays within its 2,500-word budget and links rather than restates; the
   ROADMAP estimate equals ADR-074 §6; the owner records are verbatim-style and the
   IMPORT.md compiler rule says what the record says.

## 2. Verified

- **Crosswalk tracing (1).** Every spec hunk maps to an Amend/Replaced row: 16 ADR-004
  (l.160) and ADR-068 (l.861); envelope §3 (l.63); 02 §1 (l.59); 07 §4 (l.198) and §13
  (l.484); 09 §5 boot modes (l.149, l.165) and §10 (l.279); 14 R5 (l.407), R9 (l.564), R10
  (l.645), R14 (l.764); 15 DET-02 (l.71), DET-08 (l.101), SCR-10 (l.570); pre-release-proof
  P6 (l.65); README §5 (l.205) and §6 (l.212). Each says what its row says, no more, with
  the one exception in S4 below. IMPORT.md l.56-75 lists all of them.
- **Retained / note-only rows (2).** 05 §6 last paragraph (l.300), 09 §31 (l.929-946), 10
  l.482, INDEX l.232, 07 §14 l.521 and the R-MILESTONES R1 row (l.18) are unchanged and
  read as R1 history, which ADR-074 keeps. 09 §1a's Determinism row (l.77) is listed
  Retained but was edited; the edit is the row's own gloss ("run on the TS kernel on Node
  and devices"), so nothing to fix beyond the IMPORT.md wording (N3). Grep of `docs/spec`
  for "both kernels", "differential", "cross-host", "Elixir and TypeScript", "dual" and
  "Candidate C" found no rule contradicting ADR-074 outside the README paragraphs in S3:
  04 §20 and 15 l.722 are protocol-message agreement (crosswalk: unaffected);
  `conformance/numeric-profile.md` l.27 "both kernels" is the foundation, which stays
  dual; 14 §R1 and 07 §4 candidate descriptions are the R1 procedure.
- **Frozen inputs (3).** No file under `docs/spec/conformance/` or `protocol/fixtures/`
  changed except two added rows in `invalid.json`; `capability.schema.json` adds two
  optional properties to the portable variant only, with one example; `contracts.gen.ts`
  gains the same two optional fields; `docs/residency.gen.json` is byte-identical because
  no registry entry declares adapters (`elixir bin/contracts.exs --check` exits 0 in the
  worktree). The envelope's recorded results are untouched (l.63 says so).
- **Document 16 (4).** The five entries use 16's heading + `**Status:**` + body form. The
  cited records were read: ADR-070, `owner-decision-a2-2026-09-23.md` OD1 "Yes, prep
  decision file" to the question whether the Pixel 3a stands in under ADR-070's text;
  ADR-071, `owner-decisions-2026-09-24.md` item 4 "yes please go ahead" to "Accept C with
  the checkpoint risk recorded", with the quick-A3 record; ADR-072,
  `owner-decisions-r3-open-questions-2026-09-24.md` item 3 "Yes, accept it
  (Recommended)"; ADR-073, `owner-decision-r2-2026-09-24.md` item 2 "yes please amend to
  flatten and not use umbrella"; ADR-074, `owner-decision-adr-074-2026-09-24.md` "accept,
  go with the typescript first approach". Each is an acceptance of the decision named.
- **The trigger check (5), planted on a registry copy** via `--check PATH` with `movement@1`
  edited: `host_adapters: ["elixir"]` and no differential, exit 1 with the ADR-074
  diagnostic; `differential: "test/loka/core/nope_test.exs"` (well-formed, absent), exit 1
  with the diagnostic; `differential: "test/loka/core"` (a directory), exit 1; duplicate
  `["elixir","elixir"]`, exit 1; `["typescript","elixir"]` with an existing file and
  `["typescript"]` alone pass the trigger (they exit 1 only on the expected staleness of
  the generated matrix, a different message). The red-control block reports `ok` against
  the real script and `FAIL` when `if trigger != [] do` is neutered, because it requires
  the diagnostic string (`bin/red_controls.exs:161-162`), not just a non-zero exit. Fixture
  suites: the new `invalid.json` rows fail on `rust` and on the `differential` pattern, and
  the `host_adapters` on `server_only` row fails on `unknown_property`, in both validators
  (86 Elixir, 34 TypeScript). Mutations: `minItems` removed and `maxItems` 2→9 in both
  validators leave both suites green (S2); the enum control (`rust` admitted) fails both.
- **AGENTS.md and ROADMAP (6).** 1,748 words of 2,500 (`bin/check_docs.exs` passes, 83 docs,
  0 broken, 0 unreachable). The Candidate C bullet summarises and links ADR-071/074; the
  CI line and the tests rule follow the crosswalk. ROADMAP "26 slices after R3 ... 8.5 to
  9.2 million subagent tokens" matches ADR-074 §6's 26 slices and 8.48–9.20M; R3's 8
  slices match. The owner records quote the options and the chosen option; IMPORT.md
  l.82-86 states the dotted-name rule exactly as item 2 of the record (dots to
  underscores, collision is a compile error, 64-character limit after mapping) and keeps
  ascending id with no spec change, as item 1 says.

## 3. Findings

### S1 (should-fix) `bin/red_controls.exs:140-167`: the red control plants only the missing-differential case

The check has two conditions, declared and present (`bin/contracts.exs:105`). The planted
entry omits `differential`, so a mutation that keeps the declaration test and drops the
presence test (`is_nil(e["differential"])` in place of `not File.regular?(...)`) passes
the red control. Scenario: an R14 slice declares
`"differential": "test/loka/core/movement_differential_test.exs"` and never writes the
file; `contracts --check` stays green and the trigger is unenforced. Fix: a second
planted entry with a well-formed path to a file that does not exist, same diagnostic.

### S2 (should-fix) `protocol/capability.schema.json:108-109`, `kernel/ts/src/contracts.gen.ts:132`: `minItems` and `maxItems` have no fixture

Both suites stay green with `minItems` deleted and with `maxItems` at 9 (verified in both
validators). Scenario: `minItems` is dropped in a later edit, `host_adapters: []` validates,
and `bin/contracts.exs:124` emits `[]` into `docs/residency.gen.json` against its own rule
"null, never []" (`bin/contracts.exs:90`). Fix: two `invalid.json` rows on the portable
variant, `host_adapters: []` and three entries, with the expected error codes.

### S3 (should-fix) `docs/spec/README.md:205` and `235`: the kernel choice is still described as open

Line 205, as amended, says in one paragraph "No execution strategy is selected before its
applicable gates pass" and "C was selected (ADR-071)". §7 item 1 (l.235) still says "none
is selected before the spike". Both contradict the ADR-071 entry this PR adds to
document 16 (16:875-879). Scenario: an agent reading README §7 for the open choices
treats the kernel choice as open and reopens it, which AGENTS.md forbids doing silently.
Fix: state the accepted direction (C, TypeScript-first) and, separately, what remains
outstanding: ADR-071's deferred rows are accepted risk, not an unmade choice.

### S4 (should-fix) `docs/spec/14-implementation-plan.md:564`: 14 §R9 names Node as the only pre-trigger host

"over the hosts that run the rules (before the ADR-074 trigger, the TypeScript kernel
headless on Node ...)" defines the pre-trigger host set as Node alone, while 09 §5
(l.165), 15 DET-02 (l.71) and the envelope note (l.63), all amended by this PR, require
Node, Android Hermes and iOS Hermes with Node-recorded bytes replayed on device. Two
normative documents disagreeing is a defect (AGENTS.md). Scenario: the R9 runner is built
Node-only, Gate R9 passes as written, and DET-02 has no runner for the device replay.
Fix: "the TypeScript hosts, Node plus the Hermes replays; the Lab's headless Node run is
authoring, not server hosting".

### N1 (nit) `docs/decisions/adr-071-072-proposal.md:3-6`, `adr-074-ts-first-proposal.md:1-5`, `docs/decisions/README.md:7,10`

The ADR-071/072 status now says "entered document 16" while the same paragraph still says
"these enter document 16 only at the next contract amendment; document 16 is not edited
here". ADR-074's title is still "Proposed" and its status line says "Accepted" twice. The
decisions README says at l.3 that ADR-070 to 074 entered 16 and at l.7 and l.10 still
labels 071/072/073 "Proposed".

### N2 (nit) `bin/contracts.exs:104`: unplanted branch

`Enum.uniq(adapters) != adapters` has no planted case and shares the diagnostic with the
differential branch. A duplicate adapter is harmless to the trigger; delete the branch,
or plant it if kept (over-engineering count: one).

### N3 (nit) `docs/spec/IMPORT.md:66`: 09 §1a is listed "retained" but its text changed

The Determinism row (09:77) was edited; IMPORT.md should say amended (to the crosswalk's
own gloss) so the record matches git history.

### Note: PR #20

PR #20 also edits `docs/decisions/README.md` and `docs/reviews/README.md`; both will
conflict textually with this PR (and this record's index line). It does not touch
`protocol/fixtures/invalid.json`, `capability.schema.json` or `bin/`.

## 4. Cross-vendor review (Astra), relayed by the owner: agreement

- **A1** (README l.205, l.233-238, kernel choice described as unresolved): agree; it is S3
  here. I rate it should-fix rather than nit because the PR's own edit at l.205 puts the
  contradiction inside one paragraph, and README §7 is where an agent looks for what is
  still open.
- **A2** (red control covers a missing differential, not a well-formed path to a missing
  file; should require the diagnostic text): agree with the first half, it is S1. The
  second half is already true at `e7b1625`: `bin/red_controls.exs:161` requires the
  `movement@1: duplicate host adapter, or elixir without` string, and with the check
  neutered the script's output is the stale-matrix message, which the control rejects
  (verified). Nothing to add there.

## Cross-vendor review (Astra), relayed verbatim by the owner

Reviewed commit `e7b1625`, independently of the review above.

```text
VERDICT: APPROVE WITH NOTES

FINDINGS:
A1 [nit] docs/spec/README.md:233 (at e7b1625) — The “Intentionally unresolved evidence gates” subsection still describes the kernel/binding choice as unresolved and prohibits treating it as settled before its evidence gate passes. Meanwhile, lines 205 and 212 now record Candidate C’s selection and ADR-074’s TypeScript-first direction. Line 205 also retains the unqualified pre-selection gate wording — the entry-point documentation blurs “implementation strategy selected with accepted risks” with “R1 measurement gates passed,” potentially prompting agents to reopen selection or stop already-authorized work. Explicitly distinguish the accepted ADR-071/074 implementation direction from the failed/unmeasured evidence that remains outstanding; do not relabel that evidence as passed.

A2 [should-fix] bin/red_controls.exs:145 (at e7b1625) — The new control exercises an omitted differential field, but not a supplied, syntactically valid path whose file does not exist. The invalid schema fixture checks path syntax, not filesystem existence — replacing the File.regular? requirement with a metadata-presence check would leave these controls green while allowing a dangling differential declaration. Add that second negative case and require the ADR-074 diagnostic, not merely a nonzero exit caused by stale generated files. The current production predicate in bin/contracts.exs:106 does reject both missing metadata and nonexistent files by inspection; this is a regression-coverage gap, not a demonstrated bypass in e7b1625. Existing CI logs confirm that the missing-field control fires; I did not independently execute the nonexistent-path case.

REMAINING CONTRADICTIONS:
- docs/spec/README.md:205,233–238 — the current selection-status wording described in A1 needs reconciliation with accepted ADR-071/074. This is not a remaining requirement to implement Story rules in both kernels before the trigger.
- No other substantive ADR-074 contradiction identified. The explicitly retained R1 procedures, historical results, foundation differential, client/server protocol obligations, and future Story/Realm reuse requirements are not contradictions.

OWNER DECISIONS NEEDED: none
```

## Re-review (fix round 1)

Head `7b5f5b0` (`74cb10f` merges `origin/main` with PR #20; `7b5f5b0` is the fix commit).
Scoped to the fix commit, the two README merge resolutions, and mutants on S1/S2. Line
numbers are at `7b5f5b0`. The owner waived an Astra re-check; this is the last gate.

**Verdict: APPROVE.** Every disposition verified; all four mutants die.

- **S1, fixed.** `bin/red_controls.exs:151` plants two entries on the registry copy:
  `movement@1` with no differential and `barrier@1` with the well-formed absent path
  `test/loka/core/absent_test.exs`; l.166 requires the ADR-074 diagnostic for both
  pins. Mutants: the presence test at `bin/contracts.exs:104` replaced by a declaration
  test (`is_nil(e["differential"])`) → control reports FAIL (barrier passes the check);
  the halt at l.107 neutered → FAIL. The real check: `ok`, `--check` exits 0.
- **S2, fixed.** `protocol/fixtures/invalid.json:117-118` add `host_adapters: []`
  (`too_few_items`) and three entries (`too_many_items`) on the portable variant. Mutants
  in both validators: `minItems` removed → 7/8 Elixir, 32/33 TypeScript; `maxItems` 2→9 →
  same. Baseline 8/8 and 33/33 (counts changed with PR #20's test split, merged in
  `74cb10f`).
- **S3 and Astra A1, fixed.** README §5 (l.205) drops "No execution strategy is selected
  before its applicable gates pass" and states the accepted direction (C on a quick A3,
  ADR-071) with its failed phone checkpoint row and unmeasured rows as accepted risk
  deferred to R6P and R10; §6 item 1 (l.235) is now "portable kernel evidence": direction
  decided, evidence open, B evaluated if a deferred measurement fails because of the
  Hermes kernel, matching 16's ADR-071 entry; l.238 follows. IMPORT.md l.74 records it.
- **S4, fixed.** 14 §R9 (l.564): "the TypeScript hosts: Node plus the Android and iOS
  Hermes replays; the Lab's headless Node run is authoring, not server hosting", which
  agrees with 09 §5, 15 DET-02 and the envelope note. IMPORT.md l.69 records it.
- **N1, fixed.** The three ADR files drop "Proposed" from their titles; ADR-071/072's
  paragraph now says they entered document 16; ADR-074's status line says "Accepted" once.
- **N2, fixed by deletion.** The duplicate-adapter branch is gone; `bin/contracts.exs:103-104`
  is now two plain filters with one diagnostic. Duplicates in `host_adapters` need no
  guard: `maxItems: 2` bounds the list, `"elixir" in ...` is unaffected by repetition,
  and the only effect of `["elixir","elixir"]` is a cosmetic row in the generated
  residency matrix, which is documentation and would be caught in review of the registry
  change that declared it.
- **N3, fixed.** IMPORT.md l.66 says 09 §1a's Determinism row was amended to the
  crosswalk's gloss.
- **Merge `74cb10f`.** `docs/decisions/README.md`: PR #20's regrouped sections kept, PR
  #19's changes applied inside them (the "Proposed" labels dropped, the R3 open-questions
  link added, the ADR-074 line reworded); diff against the `main` parent shows only
  #19's intended changes. `docs/reviews/README.md`: 19 bullets on each parent, 20 on
  HEAD (main's set plus this record's line); no entry lost.
- `bin/check_docs.exs`: 86 docs, 0 broken, 0 unreachable.
