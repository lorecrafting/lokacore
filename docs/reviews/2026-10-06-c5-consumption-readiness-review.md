# C5 bandage supply and consumption readiness review

Reviewed head: `fe7ef9bd3cc6a90e37011fc271ff270ee23a3dc3` on `planning/c5-installed-consumption`.
Scope: planning brief and Beads export only; no source approval.

## Requirements

B5 supply must match the finite Wick herb exchange; B8 provider services must not be presented as actor-held consumption. D4 terminal Eat custody remains conditional on reviewed publication. C4 publication and adopted bleed/combat-use decisions must precede source GO. Controlled test literals must remain distinct from unselected production parameters.

## Verdict

**APPROVE.** No findings.

The exact two-file diff meets those requirements. Active mechanics B5 S9 exchange clauses conserve real herb/bandage identities; B8 meal/ale clauses debit provider stock/liquid without creating held food. D4 explicitly remains planning-only and identifies the first held-food consumer. C4 remains a separately planned prerequisite on the roadmap. The corrected brief and C5 tracker note retain source/adoption gates and do not select production numbers, change issue status/dependency edges or claim runtime proof.

Ponytail and correctness review: lean correction, no machinery or unrelated changes. Future C5 adoption must still satisfy the governing B5 immediate recovery/supply requirement before exposing a required bandage consumer; this provisional correction does not settle that design.

Validation: `python3 bin/check_beads_export.py` passed; `mise exec -- elixir bin/check_docs.exs` passed (637 docs, zero broken links or unreachable docs). Parsed before/after exports: only C5 notes and update timestamp changed. No tests or mutation controls required for this planning-only diff.
