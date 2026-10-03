# Independent review: PR #22 "Pre-R4 sweep: docs, protocol, CI"

- PR: [#22](https://github.com/lorecrafting/lokacore/pull/22), branch `sweep-docs`
- Commit reviewed: `8cd606c` (10 commits plus a merge of `main`)
- Reviewer: Claude Opus 5.5, fresh agent; authored none of the work.
- Depth: proportionate. Docs, protocol descriptions and CI layout; no intended behavior change.
- Checks: `bin/check_all.sh` in a detached worktree at `8cd606c`, exit 0 (`contracts.exs
  --check`, all red controls, `node --test` 33, `check_docs` 89 docs / 0 broken / 0
  unreachable, Prettier, mobile `tsc`, kernel red controls). CI green on all 5 jobs.

## What must be true

1. Protocol edits change descriptions only: parsed schemas minus `description` are equal;
   the error registry parses to identical values; generated TS and docs regenerated.
2. Every sentence removed from AGENTS.md or ELIXIR-CONVENTIONS still holds somewhere, or was
   stale.
3. New process text (WORKFLOW Astra, developer.md) matches how the work is actually done.
4. ROADMAP, README map and the reviews index are accurate and every link resolves.
5. The CI TypeScript job runs the same commands in the same directories; pre-push treats
   every TypeScript input as one.

## Verdict: APPROVE WITH NOTES

No blocker, no should-fix. Two nits, one question, one merge conflict with PR #24.

## Verified

- **Protocol.** `action.schema.json`, `delta.schema.json`: parsed JSON with every
  `description` stripped is equal to `main`. `error_registry.json`: parsed values identical
  to `main` (only `§` became `§`). `contracts.gen.ts` and `contracts.gen.md` match
  (`--check` green). The cited source `owner-decisions-r3-open-questions-2026-09-24.md`
  item 1 is "Ambiguous target order", as the new description says.
- **AGENTS.md (1748 → 1716 words).** Each removal is stated elsewhere or was stale:
  - "use the Elixir outline script once it exists": no such script exists or is planned in
    ROADMAP/WORKFLOW; a stale forward reference.
  - "Planned: native mobile builds only when mobile code changes": now true;
    `.github/workflows/mobile.yml` runs on PRs touching `mobile/**`, `kernel/**` or itself,
    and on `workflow_dispatch`. The new text says so.
  - Reviewer eligibility (Fable, Opus, other vendors such as Codex): the linked ruling
    `owner-decision-reviewers-2026-09-24.md` (Opus l.19, Codex l.32-35); "prefer Fable
    for design judgment": WORKFLOW.md l.13-19.
  - "Every Markdown file must be reachable … every relative link must resolve": folded into
    the `check_docs.exs` bullet, which matches the script (`bin/check_docs.exs` l.2, l.52).
- **ELIXIR-CONVENTIONS.** "Structural sharing" is in AGENTS.md l.36 and l.60. ADR-072 is
  accepted (decisions README, document 16), so dropping "proposed" is correct.
- **WORKFLOW Astra section** matches the practice in the records: prompts sent once CI is
  green, answers relayed verbatim (e.g. `2026-09-24-r3-pr2-contracts-review.md` l.196,
  `2026-09-24-r3-gate-review.md` re-check), findings merged into the fix list.
  **developer.md**: moving "work in your own worktree" to the start matches WORKFLOW Git
  hygiene (l.77); nothing else changed.
- **ROADMAP.** R3 marked done, linking the gate record whose final verdict is "Gate R3: PASS
  WITH NOTED GAPS". The R5 row keeps 7 + 1 slices, as in ADR-074 §6 (26 slices, 8.48–9.20M);
  the three additions quote the new owner record accurately ("If you think those would all
  help yes please do it"). The invariants bullet now points at `protocol/invariants.json`.
- **README map.** All links resolve (`check_docs`); paths exist (`lib/loka/core`,
  `kernel/ts`, `mobile/{app,authority,features,packages}`, `bin/check_all.sh`). ROADMAP,
  spec, WORKFLOW and protocol are the first four lines, which is the right start. The
  room-view link moved here from `docs/reference/README.md`; it stays reachable.
- **Reviews index.** All 22 records are linked. For every line, the PR number and each
  commit it names appear in the record (scripted). Verdicts spot-checked against the
  records: r3-pr1 (APPROVE WITH NOTES twice), r3-pr6a (CHANGES REQUIRED → APPROVE),
  size-limits (CHANGES REQUIRED → … → `24c72ea` APPROVE WITH NOTES), maint-cleanup (APPROVE
  WITH NOTES → APPROVE), sweep-elixir (APPROVE WITH NOTES), all correct. The six commits
  that the old index named and the new one does not (`2c0d824`, `3786ea3`, `3c422a2`,
  `4e8f40b`, `aa58475`, `eb6dd03`) each appear in their record.
- **IMPORT.md.** Only the directory description and the ADR-073 log entry change, replacing
  "proposed" with the accepted status; no amendment is added, removed or changed.
- **Lessons files.** Only the "moved verbatim from AGENTS.md" note is dropped from each header.
- **CI TypeScript job.** Same commands as on `main`: mobile `npm ci` + `tsc --noEmit` still
  in `mobile/app` (now one step with `&&`); kernel step unchanged; Prettier, both size steps
  in the root as before; `bin/kernel_red_controls.sh` `cd`s to `kernel/ts` itself
  (`bin/kernel_red_controls.sh` l.3), so calling it from the root is the same run.
- **pre-push / check_all.sh.** The added inputs are all read by the TS half of
  `check_all.sh`: `bin/kernel_red_controls.sh`, and the root `package.json`/`package-lock.json`,
  which install Prettier. The `--no-ts` comment is now accurate.

## Findings

- **N1 (nit)**: `docs/reviews/README.md:5` says findings and dispositions "are in the
  records". For PR #1 they are not: `2026-09-24-r2-foundation-review.md` has findings but no
  dispositions, and the old index line said "findings and their disposition are in the PR".
  Scenario: a reader following the index for how F1-F11 of PR #1 were settled finds nothing
  in the record. Fix: append "(PR #1: dispositions in the PR)" to that line.
- **N2 (nit)**: `AGENTS.md` CI bullet: `mobile.yml` runs only on `pull_request` and
  `workflow_dispatch`, not on pushes to main; "when `mobile/` or `kernel/` changes" is true
  for PRs only. Scenario: someone expects a native build after a direct push to main and
  gets none. Low stakes; optional.
- **Q1 (question)**: `docs/ROADMAP.md:42`: R5 gains a `loka play` CLI in its first slice, a
  lint lockdown and a feature map, but its slice count and estimate are unchanged. Intended
  as covered by "re-estimate after the first two R5 slices"? No change asked.

## Conflict with PR #24 (`ts-test-types`, `f3d83b7`)

`git merge-tree` of the two heads: one textual conflict, `docs/decisions/README.md`. Both PRs
append a line to "Post-R3". Resolution: keep both lines. `bin/kernel_red_controls.sh` merges
cleanly, and this PR's pre-push list already includes it.
