# Owner decision: autonomous PM, escalation ladder — 2026-09-30

Superseded in part (the ladder's Fable and codex Astra rungs; now codex Sol) by the
[2026-10-01 review rules](owner-decision-review-rules-2026-10-01.md).

Relayed by the PM (Claude Code) from the owner's chat, **(paraphrased)** at the owner's
request: the wording is smoothed, not quoted. No checker can verify it against the chat.

Amends §3 of the [R3 lanes decision](owner-decisions-r3-lanes-2026-09-24.md): "anything open
after fix round 2 ... still go to the owner" now goes up the ladder below first.

Owner (paraphrased): the PM should not ask permission for normal workflow steps; it keeps
going until the PR or slice is done, and only asks when something is critical. When a
decision is hard, it escalates to a higher model, first with the `advisor` tool and, if that
does not work, manually. Only if that also fails does it stop for a human. The design goal is
to be as autonomous as possible, with human intervention only when absolutely needed.

Effect ([workflow, Keep going](../../WORKFLOW.md#loop)):

- The PM runs a slice to its merge without asking at each step.
- Hard decisions go up a ladder: the `advisor` tool, then a higher model by hand (Fable, or
  codex Astra for a hard review), then the owner only if both fail or the matter is critical.
- A ladder answer is advice to the PM. It never changes a reviewer's finding or verdict and is
  never the owner's OK; the merge gate (APPROVE and every CI job green) is unchanged.
