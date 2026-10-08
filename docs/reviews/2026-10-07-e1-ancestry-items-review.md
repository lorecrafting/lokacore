# E1 ancestry and static entity witnesses — independent review

**APPROVE.** No findings.

Reviewed local branch `work/e1-ancestry-items`: source
`cb16cff616f820182f5eb4c7e1bbef664bab32df`, evidence head
`8ab9880c3dd292af4069b84dfd471f9c1bc4c055`. This reviewer authored none of
that work. Governing sources: [E1 proof policy](../system/architecture.md#e1-exact-candidate-proof-policy),
[E1 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md),
[workflow](../WORKFLOW.md) and [evidence](https://github.com/lorecrafting/lokacore/blob/4c1bb174b603e16f425b21a7752c576939bcf1db/docs/evidence/2026-10-07-e1-ancestry-items/README.md).

Requirements derived before the code review: credit only an accepted new ancestry
selection matching its committed row; bind a static item transfer to the exact
prior/resulting holder and receipt event; bind a newly opened dialogue's static
NPC target; exclude offers, genesis possession and generated entities; retain
exact source/check identity and leave unsupported paths pending.

The diff satisfies those requirements. `e1_identity.ts` checks static candidate
IDs, entity kind and absence from created rows before transfer/NPC credit. The
static map is built from non-template declarations by `runtime/fresh.ts`; no
created entity is inferred from an authored template. Transfers require changed
custody, a matching delta and acquisition/drop event. Ancestry requires an absent
prior selection and exact `character.select` row. Accepted talk requires a new
pending continuation binding its target. The helper is included in the check
digest. Fey selection is registered, with literal SPI/faction assertions and cold
reopen. The two existing dialogue assertions still check their complete dialogue
path expectations while permitting separately witnessed NPC paths.

Independent controls in an isolated worktree:

- Removing the prior-holder comparison caused the item test to fail on false
  bandage credit for unchanged custody (exit 1).
- Removing the absent-prior-selection check caused the ancestry test to fail on
  false `fen_born` credit for unchanged selection (exit 1).
- Restored `e1_identity.test.ts`: **3/3 passed** (exit 0), including real SQLite,
  cold reopens and semantic replay. Temporary mutations were fully restored.
- All **15 evidence checksum entries** and each report trace digest verified;
  six traces total **138 steps**. The report retains **536 scoped authored gaps**.

Author evidence records 15 focused checks and typecheck/docs/size passing, plus
the distinct missing-binder control (old 12 pass, new three fail). Short fen and
hill captures are explicitly limited; their inherited case labels do not claim
completed ending/topology coverage. No combined source proof is inferred from
the comparison with the earlier inventory.

Ponytail Review: lean already; no added dependency, runtime writer or general
registry. Full integrated checks, final candidate review, 10,000-sequence proof,
browser/native rows and E1 certification remain pending.
