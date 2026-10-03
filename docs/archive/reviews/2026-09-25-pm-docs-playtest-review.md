# Review: playtest-and-tune owner decision; every cartridge gets the pools (PR #48)

- PR: #48, branch `pm-docs-playtest`, commit reviewed `70636c5`
- Reviewer: Opus 5.5 (docs-only slice with a small spec amendment: short review, no mutation testing)
- Verdict: **APPROVE WITH NOTES**

## What must be true

1. Both owner decision records quote the owner verbatim with the standard unverifiability
   note, and each stated effect stays within the owner's words plus the PM proposal the
   owner accepted.
2. The ROADMAP row, the WORKFLOW Review stance change and the 00 §4 amendment match the
   records, and no other doc still says existing cartridges keep their behaviour or that
   the installed-content rule starts at R6.
3. `elixir bin/check_docs.exs` passes.

## Checks

- Playtest record: both owner messages quoted verbatim (typos kept), standard note present,
  PM proposal summarised between them. Effects: stage scope (numbers, UI, changed and new
  mechanics) is the proposal plus the owner's addition; short review for number and
  UI-styling PRs is the proposal's "lighter review" (no Astra matches Astra being reserved
  for PM-judged foundational work); the installed-content rule starting at the first release
  to real players is the proposal. Known answers "re-derived independently and listed in the
  PR" agrees with AGENTS.md "Expected values never come from the code under test".
- HP/MA/MV record: the owner's follow-up question is quoted verbatim; the PM ruling answers
  it, names the sentence it replaces, and bounds it (development cartridges are not installed
  content; an artifact without `resource@1` loads with no pools). "v2 cartridge" matches the
  `cartridge-v2` source format.
- 00 §4: "cartridges built before the pools existed keep their behaviour" is replaced by the
  compiler default plus the no-`resource@1` case; matches the record.
- WORKFLOW Review stance and ROADMAP row match the playtest record. Decisions index line added.
- Repo-wide search (excluding `docs/reviews/`) for "keep their behaviour", "existing
  cartridges", "installed content", "never break" and R6-start wording on format
  compatibility: the only hits are the two records (the superseded parenthetical is marked as
  replaced) and the new ROADMAP row. 07 §26 and 10 §22/§28 set no start release, so nothing
  else needs amending.
- `mise exec -- elixir bin/check_docs.exs`: 130 docs, 0 broken links, 0 unreachable.

## Findings

- **nit** `docs/ROADMAP.md:54`: "the owner plays on the phone" is not in the owner's words or
  the PM summary in the record. It follows from R6P being the device proof, so it is harmless,
  but a reader checking the row against the record will not find it there. Either add "on the
  phone" to the record's proposal summary (if the PM proposed it) or drop it from the row.
