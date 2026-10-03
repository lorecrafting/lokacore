# Owner decision: R6 plan approved — 2026-09-30

Relayed verbatim by the PM (Claude Code) from the owner's chat. No checker can verify this
quote against the chat.

Context: the PM summarized PR #58, then answered the owner's question about drift between the
offline and online engines from [ADR-074](adr-074-ts-first-proposal.md) and a Fable review
(recommendation: approve as written, keep route (a)/(b) deferred to the ADR-074 trigger, no
plan change). The PM asked: "do you approve #58 now?"

Owner's words:

> yes approve

Effect:

- The [R6 slice plan](../../ROADMAP.md#proposed-r6-slices) (P1 before S1, then S1 to S6 and Gate R6)
  is approved; R6 development may start.
- Nothing else is decided. ADR-074's route (a)/(b) choice stays deferred to its trigger.
  Not yet put to the owner: evaluating candidate A (one TypeScript kernel behind a BEAM Port)
  at the trigger, and the Realm rule that online differences use new `server_only` keys or
  overlays, never a changed portable `key@version`.
