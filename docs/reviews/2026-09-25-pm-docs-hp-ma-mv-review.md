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

## Owner follow-up, DikuMUD figures (`4ddec9d`)

Checked against `sneezymud/dikumud` (fetched with `gh api .../contents/<file>`):

- Quote: appended verbatim with its context line; the record's unverifiability note covers it.
- Reading: "make it closer to DikuMUD, and if we can find out, LEgendMUD" asks for Diku as
  the base with LegendMUD figures where known. Taking Diku's starting numbers over the
  mockup's 300/120/200 is a fair reading, the record says it supersedes that answer, and
  it keeps a path for LegendMUD figures the owner confirms.
- Figures (`graf` in `limits.c`, starting age 17 from `age()` in `utility.c`):
  `mana_limit` 100; `move_limit` graf(17; 70,160) = 70 + 2*90/15 = 82; `hit_gain`
  5 + 2*5/15 = 5; `mana_gain` 4 + 2*2/15 = 4; `move_gain` 18 + 2*4/15 = 18. HP: `do_start`
  sets base 10, `advance_level` adds `con_app` hitp plus a class roll (mage 3-8 ... warrior
  10-15), `hit_limit` adds graf(17; 4,17) = 5. `movement_loss` inside 1, city 2, field 2,
  forest 3, hills 4, mountains 6, swimming 4; `do_simple_move` charges the average of the
  two rooms' costs and refuses with "You are too exhausted." when MV is short. All match.
- 00 §4 amendment, Terrain and Resources rows, and the room-view status line all read
  20/100/82; no Markdown doc still gives 300/120/200 as the default.
- `elixir bin/check_docs.exs`: 0 broken links, 0 unreachable.

Findings:

3. **should-fix** `docs/spec/00-first-cartridge-design.md:320`: the Regeneration row still
   says "doubled resting; halved hungry", while the decision now says sleeping, resting and
   sitting add Diku's position bonuses (`limits.c`: HP/MV +1/2 sleeping, +1/4 resting, +1/8
   sitting; MA +100%/+50%/+25%; hungry or thirsty cuts gain to a quarter). An R7 positions
   developer following 00 builds a doubling the decision replaced. Align the row with the
   decision, or say which one governs.
4. **nit** `docs/decisions/owner-decision-hp-ma-mv-2026-09-25.md:38`: HP 20 is not a Diku
   constant but a pick inside Diku's level-1 range (about 18-30 before the constitution
   bonus; 20 is the mage/cleric end), and 00:283 calls it "DikuMUD's starting maximums". Say
   it is a chosen representative value.
5. **nit** same file, line 43: Diku's average is C integer division (floored: inside to city
   costs 1, not 1.5). Say "floored" so R8 does not round differently.

Verdict: **APPROVE WITH NOTES**.
