# Review: all-reviews-on-Opus owner decision, #41/#42 ledger (PR #43)

PR #43 (docs only), commit reviewed `50c8e78`. Reviewer: Opus, fresh. Mutation testing
skipped (docs only). Owner quotes are unverifiable by design.

**Verdict: APPROVE WITH NOTES.**

## What must be true

1. The decision record quotes the owner verbatim with the standard unverifiability note,
   and its effect does not exceed the quote.
2. WORKFLOW's review lever states the suspension and links the decision; no other active
   instruction (WORKFLOW, `reviewer.md`, AGENTS.md) still tells the PM to spawn a Fable reviewer.
3. The Fable slots the decision names match the review-lever decision's remaining slices.
4. The ledger lines match the existing format, the roles and models that actually ran, and
   pass the dev-evidence test.

## Checks

- Quote present verbatim with the standard note; the effect (all reviewers on Opus until the
  owner says otherwise, Astra unchanged) is a fair reading.
- Fable slots: the lever listed facts/conditions (done in S3, #40), ActionRecipe, simulation,
  R6 authority and save, GameView; the decision lists the four that remain. Matches.
- `reviewer.md` defaults to `model: opus` and never mentions Fable; AGENTS.md does not either.
  Fable is chosen only by the PM per WORKFLOW, so the WORKFLOW note is the switch that matters.
- Ledger: #41 has PM and reviewer only (PM-authored docs, like #38/#39); its commits and
  #42's review commits carry Opus 5.5 trailers, so `opus` is right for every line. Every PM line
  in the ledger is `opus` with `unknown` tokens; these follow suit. Token values not
  independently verifiable.
- `mix test test/loka/core/registries_test.exs`: 16 passed. `elixir bin/check_docs.exs`:
  123 docs, 0 broken links. `elixir bin/check_size.exs`: clean.

## Findings

- **nit** `docs/WORKFLOW.md:13` and `docs/WORKFLOW.md:23`: the role table still reads
  "Opus; Fable for design judgment" and the Astra sentence says Astra runs "beside the Fable
  review". A PM who reads the table or the Astra rule alone could still spawn Fable or wait
  for a Fable review that will not happen. Either add "(suspended)" to the table cell or leave
  it; the note sits in the same paragraph, so this is cosmetic.
- Not a finding: `docs/WORKFLOW.md:104` names "Fable on semantic freezes" as a counterweight
  to same-model blind spots and `docs/ROADMAP.md:63` budgets Fable for about six slices. Both
  are rationale and estimate, not instructions; the suspension is temporary. While it lasts,
  the Astra relay is the only cross-model check on the four remaining foundational slices.
