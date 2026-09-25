# Owner decisions: R3 open questions — 2026-09-24

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat. Both were asked as multiple-choice
questions; the owner's selected option is quoted.

1. **Ambiguous target order** (PR #13 open question 1; `TargetResolution` in
   [protocol/action.schema.json](../../protocol/action.schema.json)). Asked:
   > When a player types a command that matches several things ("take key" with two keys around), the game lists the choices in a fixed order, and "2.key" picks the second. Which order?

   Options offered: "By ID (Recommended)" — current behaviour, ascending id; or "Classic
   MUD order" — carried first, then room, then id. The owner chose:
   > By ID (Recommended)

   The contract stays as merged in PR #13: distinct ids in ascending code-point order.
2. **Dotted fact names** (PR #14 open question 1). Asked:
   > Story authors write fact names with dots, like `village.child_status`, but the engine's names can't contain dots. How should the story compiler handle that?

   Options offered: "Map with collision check (Recommended)" — the compiler maps dots to
   underscores; two authored names that map to the same key are a compile error, never a
   silent merge; the 64-character limit applies after mapping; or "Forbid dots". The owner
   chose:
   > Map with collision check (Recommended)

   Rule for the R4 compiler, recorded as an amendment in
   [docs/spec/IMPORT.md](../spec/IMPORT.md).
3. **ADR-072 accepted** ([proposal](adr-071-072-proposal.md); earlier hand-off in
   [owner-decisions-2026-09-24.md](owner-decisions-2026-09-24.md), item 3). Asked:
   > ADR-072 is the persistence design: the world lives in memory, rules only propose changes, and each action saves only the changed rows plus a receipt in one transaction. When it came up you said "idk i leave it up to you", and the assistant chose this design. The spec's decision register only lists decisions you've accepted. Should ADR-072 go in as accepted?

   Options offered: "Yes, accept it (Recommended)" or "Keep as proposal". The owner
   chose:
   > Yes, accept it (Recommended)

   ADR-072 enters [document 16](../spec/16-decision-register.md) as accepted.
