# Owner decisions for R3 — 2026-09-24

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

1. **IdSource** (spec 01 A8). Asked:
   > IdSource: UUIDv8 from SHA-256 of canonical JSON ["loka-id-v1", world_context_id, command_id, ordinal]?

   The owner answered:
   > i'll go with your recommendation

   Implemented in R3 PR 1: the two ids are strings and the ordinal is a non-negative safe
   integer; take the first 16 bytes of the SHA-256 of the canonical encoding, set byte 6
   to `(b & 0x0f) | 0x80` (version 8) and byte 8 to `(b & 0x3f) | 0x80` (RFC 9562
   variant), and format as a lowercase hyphenated UUID. The full rule, including ordinal
   allocation, is in the frozen [numeric profile](../spec/conformance/numeric-profile.md#frozen-v1-rules-r3).
2. **Freezing the numeric profile as `loka-numeric-v1`** (the parse, encode, depth, hash,
   budget, error-code and IdSource rules of R3 PR 1). The owner was told that
   `numeric-profile.md` was marked "proposed", that the developer had written out every
   rule the code now follows, and that changing any of them later means a new profile
   version and a save migration. After asking "what is this encoding profile thing?" and
   getting a plain explanation, the owner was asked:
   > Should I freeze it?

   and then "Approve freezing it as v1?" The owner answered:
   > okay yes

   Recorded in the [numeric profile](../spec/conformance/numeric-profile.md) status.
3. **Identity, scope and error contract choices** (R3 PR 2, PR #9). Asked the six choices
   with the PM's recommendations:
   > Q1 accept all ids as lowercase UUIDs (CommandId included, derived deterministically in
   > PR 3); Q2 accept lowercase snake_case segments ≤64 chars and plain MAJOR.MINOR.PATCH;
   > Q3 accept `audience_set` as 1–64 character ids, duplicates carry no meaning; Q4 accept
   > instance scope using `world_context_id`; Q5 drop `GameError.data` for now (adding it
   > later as optional is compatible, retyping a required `{}` is not); Q6 keep the
   > ErrorCode enum plus registry with the equality test (Astra dissented and preferred
   > deriving it).

   The owner answered:
   > with your recommendation

   Implemented in R3 PR 2 (`protocol/identity.schema.json`, `protocol/scope.schema.json`,
   `protocol/error.schema.json`, `protocol/error_registry.json`).
