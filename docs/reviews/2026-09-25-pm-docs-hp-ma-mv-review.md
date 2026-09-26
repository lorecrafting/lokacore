# Review: HP/MA/MV owner decision, S6a/S6b split, worktree location, #45 ledger (PR #47)

- PR: #47, branch `pm-docs-hp-ma-mv`, commit reviewed `ba2a538`
- Reviewer: Opus 5.5 (docs-only slice with a small spec amendment: short review, no mutation testing)
- Verdict: **APPROVE WITH NOTES**

## What must be true

1. The decision record quotes the owner verbatim, carries the standard unverifiability
   note, and its stated effect claims nothing beyond the three answers.
2. 00 §4 says: HP/MA/MV replace HP/stamina/spirit; 1 MV per room from R5, terrain costs R8;
   regeneration per game hour, derived from the clock; defaults 300/120/200, overridable by
   the cartridge. No other normative doc contradicts it.
3. ROADMAP R5 splits S6 into S6a/S6b with a correct slice count; the WORKFLOW, decisions
   index and #45 ledger lines follow the existing formats.
4. `elixir bin/check_docs.exs` passes.

## Checks

- Decision record: owner's request and three answers quoted verbatim, with the standard
  "No checker can verify these quotes" note; option texts are marked as the PM's summaries.
  The Effect line (pools, 1 MV move cost, regeneration in S6b; 00 wording amended) stays
  inside the answers.
- 00 §4: the amendment and the rows for water rooms, terrain cost, regeneration, resources,
  flee and the chapter-one Character tier all read HP/MA/MV. No "stamina" or HP/stamina/spirit
  pool remains in 00, 00a, 14 or 21 (21:328 lists "health, stamina" only as generic Resource
  examples; "Spirit"/SPI is the stat, not a pool). The room-view status line
  (`hp 300/300 ma 120/120 mv 200/200`) matches the defaults.
- ROADMAP: nine slices now listed (S1, S2, S2b, S3, S4, S5, S6a, S6b, S7), so `9 + 1` is right
  (the old `7 + 1` had missed S2b). S6b links the decision.
- WORKFLOW worktree line and the decisions index entry are consistent with practice and format.
- Ledger: two #45 lines (pm unknown, reviewer opus 54087), same shape as lines 1-39.
  `mix test test/loka/core/registries_test.exs`: 16 passed.
- `elixir bin/check_docs.exs`: 127 docs, 0 broken links, 0 unreachable.

## Findings

1. **should-fix** `docs/spec/00-first-cartridge-design.md:283`: the amendment says "every
   character has ... by default" and "from R5, moving to another room costs 1 MV", but drops
   two conditions of the option the owner accepted (decision record lines 15-16): at 0 MV the
   move is refused, and existing cartridges keep their behaviour and transcripts. Failure
   scenario: the S6b developer reads the normative 00 text, makes the pools and the move cost
   apply to every cartridge, and the first world's move deltas and frozen transcripts change,
   or the 0 MV case is left undefined. Add both clauses to the amendment.
2. **should-fix** `docs/design/room-view/README.md:51`: "Does moving cost `mv`, and if so is
   the cost per exit or per terrain?" is still listed as an open engine question, though this
   decision answers it (1 MV per room from R5, terrain in R8). The R6P UI slices take this
   README as input and would re-raise a settled question. Mark it answered with a link to
   the decision.

## Fix round 1 (`2c560d1`)

- Finding 1: fixed. The 00 amendment now says the move is refused at 0 MV and that
  cartridges built before the pools existed keep their behaviour and transcripts, matching
  the accepted option (decision record lines 15-16).
- Finding 2: fixed. The room-view README marks the `mv` question answered (1 MV per room from
  R5 S6b, terrain at R8) and links the decision; the link resolves.
- `elixir bin/check_docs.exs`: 0 broken links, 0 unreachable.

Verdict: **APPROVE**.
