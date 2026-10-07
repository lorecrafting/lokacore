# Current baseline Round 2 independent review — 2026-10-06

Fresh independent reviewer; authored none of the candidate. Reviewed local branch
`docs/astra-round2-history`, exact source head
`ab10c69fca54d53c9107ab26cf049190e6e36c2c`, against its parent
`bfee1fd8bef340a9a8294440a325ebe54c98b86e`. No hosted PR is claimed.
Scope: the 19 Markdown files in this documentation reconciliation and their
contract, evidence and navigation destinations.

Governors: [active system](../system/README.md),
[forward development](../decisions/owner-decision-forward-development-2026-10-05.md),
[documentation audit](../decisions/owner-decision-chapter-one-docs-audit-2026-10-05.md),
[mobile pause](../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md)
and [delivery workflow](../WORKFLOW.md).

## Requirements

Active guidance must distinguish installed A–D behavior from open E1–E3 proof,
retain genuine unresolved carries and owner-save safeguards, and route obsolete
assignment/status text to clearly labelled history. Archived text must retain its
meaning and destinations. Release applicability omissions cannot imply exemption
or certification. Forward development permits replacing obsolete pins with
independent current answers; it does not authorize silent save deletion, migration
or retargeting. Browser/Node results cannot become native verification claims.

## Verdict: CHANGES REQUIRED

**BASE-R2-01 — should-fix — reconcile the dialogue carry with its installed consumer.**
`docs/ROADMAP.md:108` still uses “First speaker with two simultaneously eligible
dialogues” as a future trigger and explains it using the retired sampler's single
graph. That trigger has already occurred: current v042 permits Aldric's terminal
flavor and active ledger service together, and Maud's terminal flavor with her
cellar offer/turn-in. `docs/system/cartridge.md:1304` describes their explicit
labelled bindings; `docs/evidence/2026-10-06-d9-integration/README.md:82` records
reviewed route and SQLite cold-reopen proof preventing flavor from shadowing
services. `kernel/ts/src/mechanics/dialogue/selection.ts:40` selects an explicitly
bound definition when provided and otherwise the first eligible graph in key
order; `:72` projects the labelled bindings.

A PM using the cleaned roadmap to prepare E1 would still route this already
consumed case to an unspecified future slice or reopen a selection policy already
used by the chapter. Replace the obsolete trigger with the installed behavior and
its proof, and retain only a precisely named remaining ambiguity/proof obligation
if one exists. Do not erase an unresolved case merely because labelled selection
exists. The historical triage row can remain unchanged in its dated record.

## Verification and assessment

- `mise exec -- elixir bin/check_docs.exs`: **764 docs, 0 broken links,
  0 unreachable**. `git diff --check ab10c69f^ ab10c69f`: passed.
- Independently checked **278** relative Markdown heading fragments in all changed
  documents against heading slugs and explicit anchors: none unmatched. Checked
  **26** inbound fragments to the three shortened roadmap/checklist/queue entry
  points: none unmatched. The attributes, schedule, M4 contract and archived
  room-map repairs resolve, as do retained mechanics aliases.
- Compared all three new archives with their source documents at the parent:
  after removing the history banner and normalizing relative link destinations,
  their complete texts are identical. Only location-relative navigation changed;
  dated status, decisions and evidence claims were preserved.
- The app imports the v042 oracle; its manifest and `INSTALLED` agree on API1.37.
  The artifact has 57 rooms and its allocation oracle has 211 IDs. Independent
  SHA-256 of the oracle's canonical bytes matches the documented hash.
- Compared the v042 lock to the JSON planning matrix: exactly `escort@1`,
  `expedition@1`, `knowledge@1`, `patrol@1` and `water@1` are missing. Compared
  JSON capability rows to Markdown tables: exactly `bleed@1`, `food@1` and
  `transport@1` are omitted. The caveat accurately carries both discrepancies to
  E1 and does not certify the incomplete matrix.
- The live roadmap retains E1–E3, fixture retirement, UI/native, time/protection,
  scene, quest/job-acquisition, selector, equipment and container carries. Its
  fixture follow-up preserves independent answers, retry/reopen, exact pin refusal,
  saved bytes and explicit Start over. The changed checks text correctly separates
  the Node foreign-world fix from older Hermes evidence.
- Ponytail Review: **Lean already. Ship.** The archive wrappers and retained heading
  aliases preserve navigation with no new machinery or competing release pin.
  The single correctness finding needs a bounded prose correction.

No new runtime/checker code or tests are introduced; mutation checks are not
applicable to this documentation-only diff. No browser/native session or owner
save was accessed. Fixture migration and E1–E3 acceptance remain outside this
review's completion claim.
