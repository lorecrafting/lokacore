# Review: WORKFLOW and Beads housekeeping

- PR #301, branch `docs/housekeeping-2026-10-07`, head reviewed `c910e337629fb2feae565f857a783c644103ac40`.
- Governing: owner-approved content 2026-10-07 (PM brief), [AGENTS.md Simplicity](../../AGENTS.md), [WORKFLOW Token hygiene](../WORKFLOW.md#token-hygiene), [WORKFLOW Beads Rust](../WORKFLOW.md#beads-rust).
- Scope: docs and tracker only; no mutation testing.
- Verdict: **APPROVE WITH NOTES**.

## Must be true (written before the diff)

1. The plugin/`CLAUDE.md` rule and the ~220k threshold keep their meaning after the move; step 5 still states when to reuse vs replace the developer.
2. Each fact lives in one place.
3. `stage:` labels match each issue's notes; `--complete` passes; no local paths or wisp IDs.
4. loka-coq cites E1-D5 and its `file:line`.

## Evidence

- Moves: plugin rule moved verbatim (WORKFLOW.md:317); threshold text equal apart from "read from" (:318-319). Step 5 (:96-97) keeps "small" and "past that"; `#token-hygiene` resolves to `## Token hygiene` (:287), which holds the new list (:315-321).
- Duplicates: `220k`, `prompt cache`, `stage:` each appear once outside reviews and archive.
- `python3 bin/check_beads_export.py --complete`: exit 0. No `/Users/` paths. The only `-wisp-` match is the existing B6 decision file name `pm-decision-b6-wisp-2026-10-05.md`, not a wisp ID.
- Stage labels: .5–.9 are `stage:integrated` and each note says "Closes when #288 merges"; .9 names loka-coq.
- loka-coq: P1 bug; cites E1-D5 and `world.ts:119-120`, matching the finding in `2026-10-07-e1-guard-refusals-review.md` (local slice branch `99b16202`). `invocation.ts:173` and `receipt-history.ts:28` check out against the code.

## Findings

1. nit, `.beads/issues.jsonl` loka-coq: `invocation.ts:50` points at the `invoke` signature; the "never decided again" check is at :61. Scenario: an investigator opens :50 and does not see the claimed guard.
2. nit, `.beads/issues.jsonl` loka-e1-r9-certification-2rz.1: labelled `stage:integrated`, but its note has no closing condition ("Closes when #288 merges"), unlike .5–.9. Scenario: the PM does not know whether .1 closes with #288 or waits for the re-split.
3. nit, WORKFLOW.md:165: "Active issues carry one `stage:` label", but the in_progress parent `loka-e1-r9-certification-2rz` has none. Scenario: a reader of the board cannot tell what stage the parent is in.
4. question: the cited record `2026-10-07-e1-guard-refusals-review.md` is not on origin yet (origin #288 head `f7c616af`); it is only on the local slice branch. Until #288 is pushed, the loka-coq evidence link does not resolve for other readers.
