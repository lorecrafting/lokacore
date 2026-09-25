# Owner decisions: parallel R3 lanes, CommandId, auto-merge — 2026-09-24

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

1. **Parallel R3 lanes.** The owner asked:
   > Anything we can do in parallel? Can we have parallel PRs? So we can finish quicker? Lets parallelize as much as possible to be as efficient as possible

   Offered three lanes (PR 3, PR 4 and the R3B envelopes split out of PR 6, all at once;
   then PR 5; then the gate review), four lanes (PR 4 also split), or the same lanes
   started only after PR #9 merges. The owner chose:
   > Wait for #9 first

   After PR #9 merged:
   > go ahead and start the three lanes

   Result: R3 runs as PR 3, PR 4 and PR 6a (R3B envelopes) in parallel, then PR 5, then
   PR 6b (gate review and docs tidy pass). [Roadmap](../ROADMAP.md) updated.
2. **CommandId derivation** (04 §3, 03 §14). Offered: reuse the IdSource recipe with its
   own tag, UUIDv5 (SHA-1), or defer to R6. The owner chose:
   > Reuse IdSource (Recommended)

   Rule for R3 PR 3: a UUIDv8 from the first 16 bytes of SHA-256 over the canonical JSON
   `["loka-command-v1", idempotency_scope_id, invocation_id]`, with the version and variant
   bits set exactly as IdSource does ([numeric profile](../spec/conformance/numeric-profile.md#frozen-v1-rules-r3)).
   Authority placement never enters it.
3. **Auto-merge.** About PR #9:
   > just auto merge it if you see its okay to merge, no need for my approval

   Then:
   > auto merge applies to all PRs going forward

   The PM merges a PR (merge commit) once its reviewer verdict is APPROVE or APPROVE WITH
   NOTES with nothing open and every CI job is green on the head. Owner decisions,
   anything open after fix round 2, and Astra relays still go to the owner.
   [Workflow](../WORKFLOW.md) step 7 updated.
