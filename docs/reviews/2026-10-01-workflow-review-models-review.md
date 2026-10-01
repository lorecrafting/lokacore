# Review: WORKFLOW Models line (Opus drafts, Fable stand-in)

PR #86, commit reviewed `ae95fc9f318c153828d3fa48273fb4dcbcdafb35` (docs-only; no mutation testing). Verdict: **APPROVE WITH NOTES**.

Must be true: no contradiction with Models paragraph, role table, Loop step 2, escalation ladder; each fact once; the owner instruction marked paraphrased; stand-in never replaces the independent review.

Checked: no contradiction. Cross-vendor stays "beside, never instead of" our own review (the stand-in only replaces codex). Fix re-reviews excluded matches "narrow fix check". Fable stays rare (kernel heads only, quota-gated).

Findings (nits only):
1. nit, docs/WORKFLOW.md:26: the Fable stand-in is an exception to "Fable only as a rare backstop" (line 17) and to the table's "Fable rarely" (line 13), but neither points to it; and the line sits after the Explore sentence, away from the cross-vendor sentence it modifies (lines 18-25). Move it beside the codex sentence or add "(or the stand-in below)".
2. nit, docs/WORKFLOW.md:26: "an Opus subagent drafts briefs" vs table line 11 (PM: briefs) and Loop step 2 "Brief (PM)". Not a contradiction (PM decides), but say "the PM has an Opus subagent draft".
3. nit, docs/WORKFLOW.md:26: "kernel slice heads" is undefined; step 2 says "kernel or contract-freeze slice". Reuse that wording.
