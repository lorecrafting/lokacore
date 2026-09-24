# Owner decisions for R2 — 2026-09-24

Relayed verbatim by the coordinating assistant (Claude Code, Claude Opus) from the
owner's chat. No checker can verify these quotes against the chat.

1. **R2 PR, and `boundary` approved as a dependency.** Asked whether to push the R2
   branch and whether `boundary` (Hex) may be added:
   > yes push, and keep adding, and also approve boundary as a dep.  Should we bootstrap the latest phoenix first? And then add boundary? since bootstrapping will have the dependency manifest file, up to you

   The assistant first chose a plain Mix umbrella without Phoenix for R2 (replaced by item 2) (it creates the same
   `mix.exs`/`mix.lock` manifest); Phoenix enters `loka_web` with the first transport
   work, per document 02 (Phoenix is a transport adapter only).
2. **One application, not an umbrella.** Asked which is better overall:
   > yes please amend to flatten and not use umbrella

   Recorded as [proposed ADR-073](adr-073-single-app.md).
