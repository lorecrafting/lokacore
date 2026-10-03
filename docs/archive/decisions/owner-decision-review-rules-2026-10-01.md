# Owner decision: review rules and the PM's worktree — 2026-10-01

Relayed by the PM (Claude Code) from the owner's chat, **(paraphrased)**: the wording is
smoothed, not quoted. No checker can verify it against the chat.

Supersedes in part the [2026-09-30 review-flow decisions](owner-decisions-review-flow-2026-09-30.md)
("Astra for hard reviews (escalate freely)") and the escalation ladder's "codex Astra for a
hard review" in the [autonomy decision](owner-decision-autonomy-2026-09-30.md) (now Sol), and Fable as a
rare backstop in both (now only a codex stand-in).

## Astra scope

Owner (paraphrased): codex Astra runs only on gate reviews and on changes to
`kernel/ts/src/proposal.ts`. Reason: on slices D2 and G, Astra's first review added nothing
beyond the Opus review (D2: one wording fix; G: no findings).

## Sol on fix re-checks and other first reviews

Owner (paraphrased): every other core or contract first review uses codex Sol, and so does
every fix re-check.

## Fable as stand-in

Owner (paraphrased): Fable is used only if codex is out of quota: a Fable subagent then stands
in for it on a kernel or contract-freeze slice's head, never on fix re-reviews. Fable's rare
backstop role of the [2026-09-30 decisions](owner-decisions-review-flow-2026-09-30.md) and the
ladder's Fable rung end.

## Opus drafts, the PM decides

Owner (paraphrased): an Opus subagent drafts briefs and stage slice plans so the PM session
stays thin; the PM decides.

## The PM's persistent worktree

Owner (paraphrased): the PM uses one persistent worktree, `../lokacore-pm`. Its dependencies
are installed once; it is moved with `git checkout --detach <sha>`; `npm ci` re-runs only
when a lockfile changes; it is never removed. It holds the PM's commits and is codex's
read-only checkout. Developers still get their own worktree per slice.

Effect: [the workflow](../../WORKFLOW.md) (Models, Loop step 2 and the escalation ladder, Git
hygiene).
