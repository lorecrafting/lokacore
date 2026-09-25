# Owner decisions: Gate R3 (PR #16) — 2026-09-24

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

1. **Residency of `policy@1`, `target_resolution@1` and `fact@1`** (05 §6). The PM
   recommended `portable_capability` for their evaluators, with their AST, value and result
   contracts staying shared protocol foundations. The owner answered:
   > And for the capaability category, whatever you recommend

   Result: all three are `portable_capability` in `protocol/capability_registry.json`.
2. **Elixir types at Gate R3** (14 Gate R3, "Elixir portable/domain types and validators";
   Astra A2). The PM asked: Option A, amend the Gate R3 checklist so that for R3 Elixir's
   side is satisfied by the schema-driven validators plus generated nominal id types, with
   Elixir domain data types arriving with the first Elixir code that consumes them; or
   Option B, generate Elixir type declarations for every contract now. The owner answered:
   > A, go with your recommendation

   Result: the amendment recorded in [docs/spec/IMPORT.md](../spec/IMPORT.md#amendments-since-import).
