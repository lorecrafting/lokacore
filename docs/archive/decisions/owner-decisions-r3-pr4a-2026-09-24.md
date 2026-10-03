# Owner decisions for R3 PR 4a — 2026-09-24

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

The PM asked two questions after the Fable review of PR #12:

1. **Kernel API range form** (05 §3). The spec writes the range as a string such as
   `">=1.3 <2.0"`; PR #12 stores it as `{at_least: "1.3", below: "2.0"}`, with authors
   still free to write the string form in authored files and the compiler normalizing it.
   Recommendation: accept, and record the normalized form in the spec by amendment.
2. **Size limits on downloaded content.** The spec sets no count limits on capability
   locks, profile lists or campaign cartridge lists. Recommendation: no count limits in
   the schemas now; a byte-size cap at the R4 download boundary.

The owner answered:
> yes to both
