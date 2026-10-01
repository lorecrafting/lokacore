# Review: Early R7/R8 plan (owner decision, ROADMAP slices) — 2026-10-01

- PR: #81 (`r78-plan`), commit reviewed: `c79e503`
- Depth: short (docs-only, [WORKFLOW, Review stance](../WORKFLOW.md#review-stance)); no mutation testing.
- Verdict: **APPROVE WITH NOTES**

## What must be true (written before reading the diff)

1. The record matches the owner's answers as relayed: five sequential kernel slices Q (quest@1), S
   (calendar/schedule/behavior with the due-job drain), R (reaction@1), N (narration@1), D
   (dialogue@1, scene@1 durable choice, 23 §3 milestone carry); Opus developer, full review,
   cross-vendor review on every slice head and core fix head; R5 deferrals move to "R7/R8 for
   chapter one" (after R6P, before R10); slice G = room-view GameView need 1 only.
2. Nothing from the old Early R7/R8 row is lost: due-job drain, milestone carry, the R5
   deferral list, `knock` and map discovery at R10.
3. Spec anchors and relative links resolve; slice counts add up.
4. No fact stated twice where a link would do; the record is marked paraphrased.
5. The Lantern proof ([pre-release-proof](../spec/pre-release-proof.md)) needs Q, S, R, N, D and none of the moved items.

## Checks

- Record vs answers: matches on all three questions (slices and order, process, R5 move, G after D). Paraphrase marked.
- Carries: due-job drain (ROADMAP:52, row S), milestone carry (ROADMAP:52, row D), R5 list moved verbatim (ROADMAP:54), knock/map R10 kept (ROADMAP:52). None lost.
- Anchors: every `#` anchor in the new table matches a heading in 03, 04, 06, 21, 23 and `design/room-view/README.md#gameview-needs`; `../protocol/gameview.schema.json` exists; `#early-r7r8-slices` matches the new heading. CI `elixir` (incl. docs checks) and `lint` pass.
- Counts: 3+1+11+9+3+6+4 = 37; row says 5 + 1 (G).
- Lantern needs: pre-release-proof:47,59,61,74 cover quest, schedule, reaction, narration, one durable choice; nothing needs keys, containers, equipment, attributes, EntityOrigin.

## Findings

**S1 should-fix — docs/ROADMAP.md:52.** The Early row still restates the due-job drain (04 §5.4, `run_job`, IdSource tag) and the milestone carry (declaration, `story.milestone_reached`), which rows S (ROADMAP:81) and D (ROADMAP:84) now also state. Failure: when one moves (e.g. the drain to another slice), the other goes stale and the ROADMAP contradicts itself. Fix: make the row "Slices below" plus the knock/map line; put the S4-record, 00a:689 and `authority.ts` links on rows S and D.

**N1 nit — docs/decisions/owner-decision-early-r7r8-plan-2026-10-01.md:17.** "a new `positions@1`": the id is `position@1`, already declared (`docs/spec/release-scope.json:134`, phase R5), and its deferral is on ROADMAP:54. A grep for `positions@1` finds nothing; "new" misleads.

**N2 nit — docs/ROADMAP.md:76.** "Each is a kernel slice ... cross-vendor review on every head" covers G, but the owner set that process for the five kernel slices; "every head" is broader than the record's "every slice head and core fix head". State "Q to D", and link to the record instead of rewording it.

**Q1 question — docs/ROADMAP.md:85.** Row G's Spec cites only the schema; the bands (`hale`, `hurt`, `badly_hurt`) appear only in `design/room-view/README.md:34`. Who owns the thresholds (cartridge `resource@1` config or kernel)? G will need that spec line first.
