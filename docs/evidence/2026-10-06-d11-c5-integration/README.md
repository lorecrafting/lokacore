# D11 integration over published C5 — 2026-10-06

Published C5 chapter `0.0.37`/API `1.32` is the frozen base at SHA-256
`d995ec92f0e7dcfd45d495504cd008176c04a3fa6c822e4a194b0b127be7fc65`.
The D11 successor is chapter `0.0.38`/API `1.33`, SHA-256
`69fddb2135ff438c7de008a27f7328426c3511db352890498662e819dad5743e`,
with 199 independently enumerated initial IDs. The v038 oracle starts from the
frozen C5 value, replaces only its version and API minimum, then adds hand-curated
CON/SPI starts, the four ancestry declarations and their text. The compiler's
complete output matches its literal canonical answer. Frozen v036 and v037
fixtures remain unchanged.

The attributes transcript retains its hand-checked selection delta digest
`04043094cf0568572e5593a49abb924367a18267d86195477bd8cefc191048bf`
and two event IDs, derived from ordinals 0 and 1 of the documented UUIDv8 input.
Only its content hash changed for the final C5-based artifact; replay passed.

- Focused TypeScript character and release tests: 9 passed. Typecheck passed.
- Focused Elixir chapter content tests: 16 passed. Real SQLite character choice,
  receipt, corruption refusal, failed COMMIT, lost acknowledgement, replay and
  cold reopen: 4 passed.
- Every example transcript replay passed. The local `bin/check_all.sh` gate passed
  after the C5 merge and Beads-only main merge.
- Isolated browser choice/effects/reload test: one passed. It observed Fen Swim in
  Well Bottom, Road Haggle at Peg's 2p quote and purchase, Hill dark sight in the
  unlit Mill Loft, and each choice after browser reload. Fey's faction value is
  checked through the SQLite receipt and cold reopen because Book does not show
  current faction.
- Contract fixture sweep: an in-memory mutation removed each of 18 new
  AncestrySpec, CharacterChoice, command, delta and target required/bounded
  guards, nine GameView choice guards, and the compiled ancestry-key pattern.
  The focused contract test failed for all 28 mutants and passed unmodified.

This record covers local integration proof. Fresh independent source and
save/protocol reviews, hosted exact-head checks and publication remain separate
workflow steps. No owner save, device or mobile native run was used. The active
headless engine simulation remains in the full gate; UI blur remains deferred.
