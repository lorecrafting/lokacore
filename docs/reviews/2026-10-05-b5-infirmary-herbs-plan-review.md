# B5 Infirmary Herbs — independent plan review

Reviewed local planning head `7faba899429cd1835bc18f46458cdcead9a39edc`
against local main `d41ec0d2a2c547fabf9b85128db8ef23b5c1470e`, 2026-10-05.
PR: null. I authored none of the reviewed work. This is a docs-only plan review,
not source, gameplay or durability proof.

**Verdict: APPROVE.** No findings.

## Requirements derived before the diff

The adopted [mechanics](../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract),
[stock](../system/cartridge.md#b5-herb-and-bandage-stock),
[composition](../system/protocol.md#b5-harvest-and-exchange-composition),
[save](../system/save.md#b5-stock-and-repeat-recovery),
[Book](../system/book-ui.md#b5-herbs-and-wick-details) and
[assignment](../briefs/chapter-one/b5-infirmary-herbs-brief-2026-10-05.md),
under the owner no-wait, composition and world-parameter rules, require:

- Real authored item identities and custody-derived finite stock; deterministic
  one-item harvest shares Take admission and never mints, deletes or refills items.
- Public all-hours patch/Wick access, optional funded acceptance and immediate
  explicit reacceptance with a fresh occurrence; no active-occurrence replacement
  or old continuation affecting the next occurrence.
- Exact directly held herbs and funded bandages, bound deterministic identities,
  final-load admission and one atomic conserved exchange with quest/fact effects.
- Separate cumulative S9 gain actually awarded under global faction bounds;
  saturation spends no allowance, unrelated loss resets none, capped exchanges
  still give bandages, and all tuning belongs to the cartridge.
- Ordinary storage/drop/death recovery and lawful cold reopen, revision-correct
  composed faction/custody evidence, exact retry, existing COMMIT fences and typed
  corruption refusal without repair or deletion.
- Shared confirmed projection/admission, honest journal/refusals, no required
  route stranded by finite supplies, and no premature bandage/herbalism controls.
- Actual dependency pins distinguished from future unknowns, linked governing
  decisions and source review/check obligations retained.

## Review evidence

I read the eleven changed documents per file, the current B2/B3 contracts and
briefs, and the actual fresh-world, carrying, dialogue binding, quest lifecycle
and B2 save-validator paths. The base manifest is chapter0.0.16/API1.14; its
v016 known-answer hash is
`739aad02c1328bd4348f7968df5b6dd1dfc71b96ae248714436f89b48038b48a`.
B3 is correctly treated as an adopted finite-shop design, without installed
source or an issuance seam. Future B5 release/hash/IDs/source/proofs remain null.

The twelve independently authored herbs and twelve funded bandages cover four
optional three-for-three exchanges. The literal carrying and contribution
examples are consistent, including equality, load reduction, global saturation
and a fourth reward after the contribution cap. Exact custody and occurrence
binding prevent historical acquisition credit or receipt replay from substituting
items or completing a different occurrence. Finite exhaustion is explicitly
optional; required later consumers must first adopt immediate supply/recovery.

The existing `deadline-save.ts` terminal-axis guard assumes the S2 adjustment
starts at the faction default and ends at the current saved axis. Thus lawful
S9→S2 or S2→S9 changes require extending that guard. The new save contract
expressly requires reconciliation of B2/S9/unrelated faction changes at their
own revisions and agreement with current rows; the brief includes local
store/load/receipt validators and historical faction replay. This obligation
is covered by the plan, not demonstrated by the current source. The source
review must verify both composed orders and retain forged-prior/current-row
refusals alongside the existing B2 ledger and payment protections.

Composition retains containment, dialogue, quest, bounded facts and the existing
authority transaction as their writers. Only the consumer's missing harvest,
multi-item binding/final-load and explicit repeat semantics are authorized;
no population, restock, generic barter or second history/stock ledger is proposed.

## Verification and simplicity

`git diff --check` passes. The documentation check passes with 517 documents,
zero broken links and zero unreachable documents after adding this record.
The normal review-record commit hook is run at handoff; its result is included
in the handoff. No gameplay mutation, native/browser session or full code check
line is required or claimed for this docs-only review. Source implementation
retains the assigned focused regressions, red controls, full local checks and
independent protocol/save reviews.

Ponytail Review: Lean already. Ship. No finding remains open.
