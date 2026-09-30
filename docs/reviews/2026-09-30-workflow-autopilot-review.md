# Review: workflow "Keep going" (the PM runs steps 2 to 7 without asking at each step)

- PR: #63 (`workflow-autopilot`)
- Commit reviewed: `f3b48a6`
- Reviewer: `reviewer` subagent (Opus), independent; docs-only slice, short review, no mutation testing.
- Verdict: **APPROVE WITH NOTES**

## What must be true (from the brief and the cited docs, before reading the diff)

1. Step 1 still needs the owner's OK on the plan before anything runs.
2. The owner still gets owner decisions, spec conflicts (AGENTS.md:17 "stop and ask") and
   anything open after fix round 2 (steps 6 and 7).
3. Merge conditions are unchanged: merge commit, APPROVE / APPROVE WITH NOTES with nothing
   open, every CI job on the head green ([auto-merge decision](../decisions/owner-decisions-r3-lanes-2026-09-24.md) §3).
4. AGENTS.md rules untouched: merge commits (AGENTS.md:135), `--no-verify` only with the
   owner's OK (AGENTS.md:134), no force-push (WORKFLOW Git hygiene).
5. Reviewer independence unchanged: a fresh reviewer, the PM does no review steps.
6. The fact is stated once; no conflict with Token hygiene.

## Checks

- 1: holds; the paragraph starts "Once the owner has approved the slice plan" (WORKFLOW.md:29).
- 2: holds; WORKFLOW.md:31-33 lists all three. The decision's "Astra relays" item is superseded
  by [review-flow decision](../decisions/owner-decisions-review-flow-2026-09-30.md) ("no owner relay").
- 3: holds; "merge" at WORKFLOW.md:31 is step 7, whose green-CI gate (WORKFLOW.md:71-73) is
  not restated or relaxed.
- 4, 5: holds; no rule touched; reviewer spawn and re-review stay steps 4 and 6.
- 6: Token hygiene has nothing contrary; "report at the end" matches step 7's "then tell the
  owner" (WORKFLOW.md:73). See N1 on restatement.

## Findings

- **N1 (nit)** `docs/WORKFLOW.md:31-32`: the owner-decision and open-after-round-2 stop list
  now appears three times (here, WORKFLOW.md:69, WORKFLOW.md:74). Scenario: a later edit adds
  a stop to step 7 only; the "stops only for" list here then licenses the PM to run past it.
  A pointer ("what steps 1, 6 and 7 and AGENTS.md reserve to the owner, or an action outside
  this workflow") keeps one source.
- **N2 (nit)** `docs/WORKFLOW.md:33`: the parenthetical reads as the definition of "outside
  this workflow". Scenario: pre-push fails on a flake, the PM treats `git push --no-verify` as
  inside the workflow (it is neither destructive nor outward-facing) and does not stop,
  though AGENTS.md:134 needs the owner's OK. The "owner decision" item arguably covers it;
  naming AGENTS.md owner-OK rules removes the doubt (N1's wording does both).

## Fix round 1: `29d55c4`

- **N1: fixed.** `docs/WORKFLOW.md:31-33` now points to steps 1, 6, 7 and AGENTS.md instead
  of restating the list; the spec-conflict stop is kept via AGENTS.md:17 ("stop and ask").
- **N2: fixed.** The `--no-verify` push is named as an AGENTS.md owner-reserved example; the
  exhaustive-looking parenthetical is gone and "an action outside this workflow" stays.
- Nothing else touched. Verdict: **APPROVE**.

## Round 2: `0b5b10c` (escalation ladder, "Critical" definition)

Checked: the "Critical" list keeps a spec conflict (AGENTS.md:17) and a `--no-verify` push
(AGENTS.md:134) with the owner; the step 7 merge gate (`docs/WORKFLOW.md:72-73`) is untouched.

- **S1 (should-fix)** `docs/WORKFLOW.md:71` vs `docs/WORKFLOW.md:76-77` and
  [auto-merge decision](../decisions/owner-decisions-r3-lanes-2026-09-24.md) §3: step 6 now
  sends anything open after fix round 2 up the ladder first, and the ladder (`:31-33`) lets a
  model "settle" it; step 7 and the owner decision still send it to the owner. Scenario: a
  reviewer blocker is still disputed after round 2; a Fable subagent calls it invalid; the PM
  treats it as settled and never tells the owner, against §3. The owner's "maximum autonomy"
  words are not recorded anywhere: add an owner-decision record amending §3 (verbatim or
  marked paraphrased) and make step 7 match step 6, or keep round-2 leftovers going to the owner.
- **S2 (should-fix)** `docs/WORKFLOW.md:30-33`: nothing says a ladder answer is advice to the
  PM only. Scenario: the PM asks codex Astra whether a reviewer finding holds, Astra says no,
  the PM records the finding closed and merges on APPROVE WITH NOTES "with nothing open". A
  model's answer then stands in for the fresh reviewer's verdict (step 6) and, for critical
  matters, reads like approval. One sentence fixes both: "A ladder answer advises the PM; it
  never changes a reviewer's finding or verdict and never counts as the owner's OK; critical
  matters go to the owner directly."
- **N3 (nit)** `docs/WORKFLOW.md:35`: "a `--no-verify` or force-push" lists force-push as
  owner-approvable; Git hygiene and step 5 say never force-push. Say "a `--no-verify` push"
  and leave force-push forbidden.

Verdict: **CHANGES REQUIRED** (two should-fix: S1, S2; one nit).
