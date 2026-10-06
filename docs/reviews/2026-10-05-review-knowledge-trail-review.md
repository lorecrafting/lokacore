# Review knowledge trail — independent documentation review

Local draft branch `docs/review-knowledge-trail`: preserve review evidence and link
reusable rules and deferred work to it; no hosted PR assigned at review time.
Reviewed source head `2cd18ef1b908464b107e4147c17d3fd4326f5507` against published
main `ac9b22757a82c4b4c3d60ddf8f94e5c98014bae4`.
Fresh independent reviewer; authored none of the proposed change.

**Verdict: CHANGES REQUIRED.** One should-fix finding, RKT-01.

## Acceptance derived before reading the diff

The owner requested retaining important history, particularly review issues, for
cross-reference and future mechanics, layers and Book UI rules. The preceding
Beads question was hypothetical; it authorized no tracker migration.

- Preserve original findings, dispositions and reviewed source heads in Git review
  records; link durable rules or deferred work to the original evidence.
- Keep active specifications authoritative, lessons limited to reusable hazards,
  and enforceable checks red-controlled, under the existing
  [delivery workflow](../WORKFLOW.md#loop) and
  [lesson policy](../../AGENTS.md#hard-won-lessons).
- Retain the owner's words verbatim and label interpretation, as required by
  [evidence lessons](../lessons/evidence.md); avoid unsupported Beads adoption,
  duplicated full findings, invented facts and private identifiers.
- Keep this change to documentation policy; no retrospective inventory, new
  tracker, implementation or additional review machinery is required.

## Finding

**RKT-01 — should-fix:**
`docs/decisions/owner-decision-review-knowledge-trail-2026-10-05.md:3`.
The owner decision records only a paraphrase. The linked evidence policy requires
owner decisions to be retained verbatim in a file. A later agent cannot distinguish
which of the detailed promotion/check/tracker instructions were the owner's words
and which operational choices implement the request, so this new history rule
starts with incomplete provenance. Retain the exact owner statement alongside the
clearly labeled paraphrase and operational interpretation. No Beads adoption should
be inferred. Open; no fix reviewed.

Owner words supplied to this reviewer by the PM (the reviewer did not inspect the
original conversation independently):

> keep in mind that we would love to keep some important history of the project for example issues that surfaced in reviews etc as a substrate or data to build better mechanisms system or layers if possible, or to cross reference if you think that's a good idea, or to accumulate things like book-ui spec or whatever else

## Verification

Read AGENTS.md, the workflow/reviewer policy, the reviews index, evidence lessons
and existing mechanics lessons before checking the four-file, 33-line addition.
The decision explicitly leaves Beads adoption open. Spec/Book UI, area lessons,
checks and unfinished tasks each link back to the evidence through one operational
handoff section. Index/rule summaries remain navigation; no full finding is copied.
No source, fixtures, retained review history or private identifiers are changed.

`mise exec -- elixir bin/check_docs.exs`: exit 0; 602 docs, zero broken links and
zero unreachable files at the reviewed source head. Inspected the new section
anchor and the existing Book UI and hard-won-lessons targets. `git diff --check`:
exit 0. Mutation testing is omitted under the docs-only review rule; full code
checks and hosted CI were not run by this reviewer.

Ponytail Review: lean already; no actionable simplification. The remaining issue
is evidence fidelity, not scope or complexity.

## Scoped fix round 1

Reviewed source head `99f757a0aaea5ec837b3f88963821b6fe4b72c93`, with only the
owner-decision diff from `2cd18ef1b908464b107e4147c17d3fd4326f5507` in scope.

**Final verdict: APPROVE. RKT-01 closed; no open findings.**

The decision now retains the full owner statement and explicitly labels the
following interpretation. Compared the statement with the owner words supplied
by the PM, including the original double space after “if” clarified in the
fix-round message; the review's initial PM-supplied quotation above had one space.
The boundary that this direction does not adopt Beads remains explicit. The
operational guidance and its existing consumers are unchanged.

Ran `mise exec -- elixir bin/check_docs.exs` in the source worktree at the exact
fix head: exit 0, 602 docs, zero broken links and zero unreachable files.
`git diff --check 2cd18ef1 99f757a0`: exit 0. Docs-only mutation testing remains
omitted. Ponytail Review: lean already; no actionable simplification.
