# Owner decision: short references in cartridge source (R5 S2b) — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify this quote against the chat.

What the PM proposed (summary): the cartridge compiler accepts short references in source
(`"to": "well_lane"` instead of a full DefinitionRef object) and expands them to the full
DefinitionRef at compile time. Compiled artifacts stay byte-identical (every known answer
unchanged, frozen fixtures untouched); full DefinitionRef objects still work; an unknown
short reference fails with UNRESOLVED_REFERENCE naming the file and field path; at least one
existing cartridge is converted as proof with its hash unchanged, and a full-reference case
stays covered by a test; the field's schema determines the reference kind and a short
reference is the definition's local key, with same-key-across-kinds ambiguity impossible by
construction or a diagnostic; tests use hand-written expected values.

Owner's words:

> Ok add it

Result: slice R5 S2b in [the roadmap](../ROADMAP.md) R5 row; the rule is in
`Loka.Content` (lib/loka/content.ex) and `Loka.Content.Checks.expand/2`.
