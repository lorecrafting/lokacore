# Review: move forward, lessons first, then trim legacy history

- PR: #291, branch `docs/move-forward-trim`
- Commit reviewed: `e58abb76a589716f025923444b2145a2e304d467` (base `f8513671`)
- Reviewer: independent (authored none of the work)
- Depth: docs/process-only; no mutation testing (no code changed). Proportionately
  adversarial on deletion safety, quotes and merge with #288.
- Verdict: **APPROVE WITH NOTES**. Owner approval is still required before merge (PR body,
  [owner rules, Process](../system/owner-rules.md#process)).

## What must be true (written before reading the diff)

1. No file read by code, tests, checks, CI or hooks is deleted; `protocol/` and
   `docs/spec/conformance/` untouched.
2. Nothing ROADMAP, WORKFLOW, CHECKS, `docs/system`, owner rules or the E1–E3 briefs
   need as a governing or gate input is deleted; open work and its records stay.
3. Each new lesson is a failure class, a preventing rule and a permalink whose content
   supports it; no duplicate of an existing lesson or rule.
4. The owner is quoted verbatim; owner-rules and AGENTS amendments agree with the keep list.
5. Every link resolves: 0 broken / 0 unreachable; permalinks pinned to a commit on `main`.
6. The Beads change only drops dead `external_ref`s and passes the export check.
7. #288 still merges and its index lines survive.

## Checks

- Deletions: 3221 files, all under `docs/`; 0 under `protocol/`, `docs/spec/` or
  `docs/archive/spec/`. Every `docs/…` path named in `bin/ lib/ kernel/ test/ lint/
  mobile/ cartridges/ protocol/ .github/ .githooks/ mix.exs package.json` exists at the head,
  except two code comments rewritten to permalinks and test placeholders (`docs/x.md`,
  `docs/no_such_file.ts`) and a pre-existing invalid-fixture string. Invariant citations
  (`protocol/invariants.json`) need 7 archive spec files; all 25 are kept because
  `docs/spec/IMPORT.md` and `docs/system/future.md` link them.
- Governing docs: E1–E3 briefs unchanged; all their links are relative and resolve (E1 needs
  `docs/archive/spec/09`, kept). No plain-text reference in governing docs names a deleted file.
  UI-FUZZ-01/UI-PHONE-01 stay defined in the kept canonical deferral record.
- Lessons: sources read at `f8513671` for all 11 permalinks (process speed-up F-1/F-2/F-4,
  SQLite deadline, test-audit 51/2201 windows, pointer drift F-1, B4-S1 159 tests, C4-R3, C3
  plan equal-time order, M1-B1 shallow copy, C5-S1, DOC-E3-01, ARCH-D10-01); each supports
  its lesson. No overlap with existing lessons, WORKFLOW, CHECKS or AGENTS.
- Permalinks: 478 unique; every one resolves via `git cat-file` at `f8513671`, which is on `main`.
- `elixir bin/check_docs.exs`: 268 docs, 0 broken, 0 unreachable.
- Beads: 30 changed records, all closed, only `external_ref` removed, each target deleted;
  open records cite no deleted path; `python3 bin/check_beads_export.py` exit 0.
- `mise exec -- bin/check_all.sh` after `npm ci` (root, `kernel/ts`): exit 0.
- Trial merge with `origin/slice/chapter-one-e1-r9-certification` (`b24d0f63`): no textual
  conflict; check_docs 20 broken (union duplicates in `docs/reviews/README.md`), as the PR
  body says. The body's recovery (rewrite.py + awk dedupe) gives 0 broken / 0 unreachable;
  all 34 of #288's added index lines survive; Beads check passes; #288's evidence names no
  deleted path.

## Findings

- **should-fix** `docs/decisions/owner-decision-move-forward-2026-10-07.md:5-7`. Labeled
  "verbatim" but edited: the owner wrote "please propsoe … upserseded review records"; the record
  says "propose … superseded" (typos silently fixed, while "thnig"/"saround" are kept). Both
  excerpts are cut mid-message without `[…]` (dropped: "please delete all old branches we dont
  need," and "lean on the discarding side if we dont need it"). Failure: a later agent cites
  altered text as owner words ([WORKFLOW](../WORKFLOW.md) "owner words only verbatim").
  Fix: exact text with marked elisions. The PM ruling's source was not available to verify.
- **should-fix** `docs/system/owner-rules.md:3-4`. New text: "a record in the tree is in force
  only if listed here". 27 kept records have no owner-rules line, and 24 of them are in force
  under the decision record's own definition (linked from WORKFLOW, CHECKS or `docs/system`),
  e.g. `owner-decision-beads-rust-pilot`, `owner-decision-process-speedup`,
  `owner-decision-test-audit`, `pm-decision-d7-deer`. Failure: a reader of owner rules
  concludes the Beads pilot or the D7 contract is not in force. Fix: match the decision
  record's definition (listed here or linked from AGENTS, WORKFLOW, CHECKS or `docs/system`).
  The PR body's "three owner records" without a line undercounts; three
  (agent-token-hygiene, book-keyboard-navigation, room-interactables) have no normative link at all.
- **nit** `docs/lessons/contracts.md:40` and `docs/lessons/evidence.md:17`. C5-SO6 and
  E1-C6-1 are not in the linked sources (B4 save review, C4 primary review); they are in
  `2026-10-06-c5-final-primary-review.md` (deleted) and the kept
  `2026-10-06-e1-expedition-invariant-review.md`.
- **nit** (PR body, recovery step). `git diff --name-only --diff-filter=D` with rename detection
  lists 3214 files plus a rename-limit warning; `--no-renames` gives the full 3221. Recovery
  still reached 0 broken here, but `--no-renames` makes it deterministic.
