# Review: developer token rules (PR #89)

PR #89 at `cd70db5`. Short review (docs/config only, no mutation testing). Verdict: **APPROVE WITH NOTES**.

## Must be true (derived before the diff)
- Sections developer.md names exist in WORKFLOW.md: Loop steps 3 and 5, Token hygiene, Git hygiene: yes.
- Step 5 does not contradict step 6 ("same reviewer"), Git hygiene (merge, never rebase; main checkout is the PM's) or the Why line: holds.
- Each fact once; developer.md fix instructions still work for a fresh developer: partly (F1).
- Everything the developer file tells the developer to use is available to it: no (F2).

## Findings
1. **should-fix**, `.claude/agents/developer.md:5-17` and WORKFLOW.md step 5: a fresh fix developer gets the same file as a slice developer. The file says "open the PR", run `/ponytail-review` and `/code-review`, and "Scope: exactly the brief"; the only fix-mode paragraph is at the end. Scenario: fresh developer given brief + record + findings reads "Before handing off ... open the PR" and opens a second PR or reruns self-review. Fix: one sentence, "if the PR exists and you are given findings, do only the last paragraph".
2. **should-fix (question if the harness grants advisor regardless)**, `developer.md:8,14-17`: the new text tells the developer to make "one early advisor call", but `tools:` (line 4) lists no advisor and reviewer.md likewise. Scenario: restricted-tool subagent cannot call it, so the rule is dead text. Fix: add `advisor` to `tools:` or drop the sentence.
3. **nit**, WORKFLOW.md:66-67: "about 220k tokens" gives the PM no source for the number. Name it (the developer's last token usage in the subagent result) or say "PM's estimate".
4. **nit**, WORKFLOW.md:71-72: the line is about 300 characters, the insert was not rewrapped (every other line is at most about 130).
5. **nit**, `developer.md:~45`: "two fix attempts" / "fix round 2" counters are lost with a fresh developer; the restated finding list must say the round number. Say so in step 5.

Checked, no finding: step 6, Git hygiene (merge not rebase, PM-owned main checkout), AGENTS.md (outline line 121 is consistent; no conflicting fact), Why line (consistent with step 5).

## Fix round 1 re-check (scoped to the fix commit)
- F1 fixed (`developer.md:45-46`). Nit: "follows only this paragraph" points at the skip paragraph itself, the findings paragraph is the next one; say "the next paragraph". Not blocking.
- F2 accepted: harness grants advisor regardless of `tools:`; the token audit shows developer advisor calls (Q 2, R 1, N 2).
- F3 fixed (step 5 names the token-count source). F4 fixed (rewrapped, no line over 100). F5 fixed ("name the round (1 or 2)").
- Direct callers: step 6 and the Why line unchanged and consistent.

Verdict: APPROVE (one non-blocking wording nit).
