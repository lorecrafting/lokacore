# Review: docs trim (Sonnet developers, CHECKS.md, ROADMAP archive, token hygiene)

- PR: #60 (`docs-trim`)
- Commit reviewed: `21dc3ca`
- Reviewer: `reviewer` subagent (Opus), independent; docs-only slice, short review, no mutation testing.
- Verdict: **APPROVE WITH NOTES**

## What must be true (from the brief, before reading the diff)

1. The developer subagent defaults to Sonnet; the PM passes Opus for kernel and contract-freeze
   slices; an owner-decision record exists and says honestly the owner's words are paraphrased;
   the WORKFLOW role table matches.
2. The AGENTS.md Checks list moves to `docs/CHECKS.md` word for word (only link paths rebased
   to `docs/`); AGENTS.md keeps a pointer and `bin/check_all.sh`; the budget in
   `bin/check_docs.exs` drops to 1400 and AGENTS.md fits it; the padded red control still fails.
3. Finished ROADMAP rows (R3, R4, observability, R5) and the estimate paragraphs move to
   `docs/ROADMAP-archive.md` unchanged; R6, early R7/R8, R6P and playtest rows untouched.
4. Report caps in both agent definitions; token-hygiene section and PM state-file rules in
   WORKFLOW, not contradicting existing text.
5. No stale reference to the moved content.

## Checks run

- Diffed the removed AGENTS.md lines against `docs/CHECKS.md`: identical except the new
  heading/intro, `bin/check_all.sh` line moved into the intro, and two links rebased
  (`docs/contracts.gen.md` to `contracts.gen.md`, `docs/features.gen.md` to `features.gen.md`).
  Nothing lost or altered.
- ROADMAP: the four removed rows and both estimate paragraphs appear verbatim in the archive;
  the remaining rows are untouched.
- `elixir bin/check_docs.exs` on `21dc3ca` in a detached worktree: 147 docs, 0 broken, 0
  unreachable, exit 0. AGENTS.md is 1265 words (budget 1400). The red control pads 3000 words,
  so it still fails.
- The decision record says "(paraphrased)" twice and that the verbatim words were not retained.

## Findings

1. **should-fix** `docs/WORKFLOW.md:75` against `.claude/agents/reviewer.md:36`: WORKFLOW says
   "Subagent returns are ... under 250 words", while reviewer.md allows 300. A reviewer that
   reads WORKFLOW (its definition says to) gets two caps, and the PM cannot tell which one a
   320-word or 280-word return breaks. Say "under 250 words (reviewer 300)" or point to the
   agent definitions.
2. **nit** `docs/decisions/README.md:5`: "This directory also holds the owner's decisions
   retained verbatim." The new record in that directory is paraphrased. Say "verbatim, or
   marked paraphrased".
3. **nit** `bin/check_all.sh:2`: the comment "(AGENTS.md, Checks)" now points at a stub; the
   list is in `docs/CHECKS.md`. It still resolves through the pointer, so low cost.

No other stale references: `developer.md:16` and `WORKFLOW.md:37` ("check line from AGENTS.md")
still resolve, because AGENTS.md names `bin/check_all.sh`. Token-hygiene "clear the session
after each merge" agrees with Loop step 5 (after a restart, a fresh developer gets the brief plus the findings).
