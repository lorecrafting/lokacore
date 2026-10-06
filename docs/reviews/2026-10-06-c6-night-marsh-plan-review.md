# C6 Night in the Marsh planning review — 2026-10-06

Planning head reviewed: `c1bfb0fb8d396c005db4c21c0ff909ea42ca0b5d` (local, no PR). Reviewer authored none of the plan. Verdict: **APPROVE WITH NOTES**. No open findings.

## Independent requirements before the diff

The owner no-wait rule requires a player-started, all-hours S27 with no night, tide, respawn or teacher wait. A real survival attempt must retain causal player Move/Flee credit, fail on departure or actual death, recover without blocking the main path or corpse, and pay once. Existing C4 hounds remain ordinarily passive; C5 bleeding can arise only from real combat. D1 swim is already freely teachable before S27, and D6 makes that lesson usable. The proposed extension needs bounded typed attempt state, exact projection/direct admission, one transaction and historical save proof. The Book must show honest stage, failure and completion. This is a planning review; it cannot claim source, release, browser or save proof.

## Review

- The five listed edges exist in the published room graph: Hound Run west→Reed Bank, Reed Bank west→Willow Shade, Willow Shade south→Drowned Oak, Drowned Oak north→Willow Shade, Willow Shade east→Reed Bank. Adder Nest is connected east of Hound Run and can contain a no-credit Flee detour. Exits north/south/east out of the five-room footprint remain ordinary traversable exits that fail only the attempt.
- Start at the existing gnawed-bones detail, optional Drowned Oak shelter after entry three and safe Reed Bank finish are precise. Wrong in-footprint movement preserves the cursor; accepted next-edge movement alone advances it. Random C4 Flee can either earn the first west edge or detour east without assuming its destination. No wait, hound kill or compulsory bandage gates the route.
- The selected new `ExpeditionAttempt` has actor/body, quest occurrence, command-bound attempt identity, cursor, shelter and terminal status. Movement, fatal return and reward each have a named writer and atomic group. The fixed chapter route stays in content; no saved room tags or general objective interpreter are proposed. This fits the composition rule and existing receipt/changed-row authority.
- C5 status danger is downstream of a real C4 hit; S27 Start adds no strike or spawn and ordinary C4 passivity remains. Failed-attempt Restart replaces the attempt identity, while a completed quest cannot restart or pay a second −1. Fact-selected Sedge acknowledgement does not remotely grant the already independent D1 lesson or alter D6 water admission.
- Book and save clauses require current admission, honest confirmed receipts, cold reopen at each stage and failure, real SQLite fault/reconciliation, exact historical causes, release refusal and retained owner-save bytes. Mobile/native work remains paused and the headless simulation remains in scope.

## Notes and scope gate

The brief's literal cases are future acceptance targets, not proof. C5 final publication, exact predecessor and release/hash/ID re-pinning, implementation red controls, source self-review and fresh source reviewers remain required. The archived night window and remote swim reward are superseded explicitly by the owner no-wait rule and the published D1 lesson. No planning correction is requested.

Docs-only review: no runtime tests or planted-code mutation apply. I inspected the authored room JSON and the existing C4, D1, D6, C5 and owner rules. The plan adds no dependency or speculative framework, so the Ponytail check found nothing to remove.
