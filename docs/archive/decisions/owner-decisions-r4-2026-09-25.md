# Owner decisions: R4 minimal — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's answers to a
multiple-choice question in chat. No checker can verify these quotes against the chat.

1. Story source format. Asked: YAML (new dependency + code rejecting anchors/aliases, tags,
   duplicate keys, YAML 1.1 booleans) or JSON (built into Elixir, strict, every JSON file is
   valid YAML 1.2). Owner chose: "JSON now, YAML later (Recommended)".
2. Byte cap on a compiled artifact at the ingestion boundary (checked before decoding).
   Owner chose: "4 MiB (Recommended)".
3. The 00a §12 hello fixture uses component vocabularies not yet frozen (rooms/NPCs in R5,
   quests/dialogue in R7/R8). Owner chose: "Only the locked parts (Recommended)": R4 compiles
   its manifest, facts, capability lock, policies and actions; the full hello fixture compiles
   after R5/R7 freeze the rest.
4. Pilot an R4 slice through Foundry's manual lane. Owner chose: "No, not this time (Recommended)".
