# Post-D10 architecture audit and maintenance disposition

Read-only Round 1 inspection at `347f7d474a87bc13a178637fd3d4141e8746f1b0`;
record assembled against published main `6f2cf9ea05f4808c11c243b07002b96cbd5f7be3`.
This preserves the completed audit and subsequent repair evidence; it is not a new
audit of the later head or E1–E3 certification. The
[architecture audit decision](../decisions/owner-decision-chapter-one-architecture-audit-2026-10-05.md)
sets its scope. One reproduced defect is resolved; the four remaining entries are
post-E3 evolution risks, with no additional current defect reproduced.

## ARCH-D10-01 — lawful interleaved receipt rejected on reopen: resolved

The audited deer recovery validator interpreted every decrease in writer-group
number as a sight handoff. An accepted combat round and its paired bleed tick can
legally share a group across intervening population jobs. An unchanged v042
chapter played through real invocations and temporary SQLite reopened at 68300,
committed 68400, then returned `save_corrupt` on cold reopen. The literal witness
and retained failed/passing output live in the
[repair evidence](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-deer-bleed-recovery/README.md).

Resolved by [PR #265](https://github.com/lorecrafting/lokacore/pull/265), merge
`d0c3797b`: delete the duplicate global order inference, retain deer producer
checks, and use existing exact receipt replay. The
[independent review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-deer-bleed-recovery-review.md)
verified 14 SQLite checks and four forged-group controls, including mixed
bleed/sight cancellation; refusal preserves file bytes. The
[committed regression](../../mobile/authority/local-story/deer_bleed_recovery.test.ts)
replaces the disposable audit script. No new red control is needed for this
closed finding. [PR #269](https://github.com/lorecrafting/lokacore/pull/269)
separately corrected the paired-job completion invariant;
[its review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-job-complete-owned-run-second-opinion.md)
records that distinct repair and reuses the recovery checks.

## Post-E3 maintenance candidates

The PM owns scheduling and evidence-linked Beads entries under the
[follow-up policy](../decisions/owner-decision-beads-audit-followups-2026-10-06.md).
These entries authorize no implementation or check removal. Priority orders the
maintenance candidates, not new release blockers.

### ARCH-D10-02 — explicit recovery ownership (first)

[Receipt recovery](../../mobile/authority/local-story/receipt-save.ts) reaches
general [receipt replay](../../mobile/authority/local-story/receipt-history.ts)
through [liquid validation](../../mobile/authority/local-story/liquid-save.ts),
whose applicability includes several unrelated mechanics. ARCH-D10-01 shows the
cost of separately interpreting replayed consequences. The remaining risk is
that a future mechanic misses the replay trigger or duplicates its semantics.

After E3, when recovery next gains a consumer, consider moving the existing
replay invocation to the recovery coordinator while preserving applicability and
row validation. Reuse the population-only applicability proof and forged-group
controls in the repair review. Minimal red control: bypass replay for that
population-only profile and require its malformed history to be refused by the
test. Delete another validator only after its distinct corruption controls still
fail against weakened replay; no generic recovery framework is proposed.

### ARCH-D10-03 — exhaustive durable target mapping (second)

[The row map](../../kernel/ts/src/runtime/rows.ts) accepts arbitrary string keys;
[apply](../../kernel/ts/src/runtime/apply.ts) skips a change with no mapped
section. No current target omission was found. A future registered target could
be composed yet omitted from adoption when its row mapping is forgotten.

After E3, before the next durable target, consider a type-exhaustive mapping of
non-clock `MutationTarget` kinds with an explicit clock case. Minimal red control:
remove an existing mapping and require typechecking to fail. Preserve changed-row
writes and structural sharing; reuse the consumer's real SQLite reopen check.

### ARCH-D10-04 — visible host-neutral authority gate (third)

The real SQLite authority regressions are under `mobile/authority/local-story`,
outside the default kernel test selection in
[check_all](../../bin/check_all.sh). The active
[Book browser lane](../../.github/workflows/book-e2e.yml) and kernel simulator
cover different boundaries. ARCH-D10-01 passed gameplay admission and failed only
at authority recovery; this establishes a concrete coverage boundary, not a
claim that all authority checks or browser checks are absent.

Consider an explicit portable authority lane in the separately reviewed
[post-E3 check-tier change](../decisions/owner-decision-tiered-ci-after-chapter-one-2026-10-06.md).
Minimal red control: route an authority/recovery source change away from its
required lane and make the classifier test fail; reuse the existing SQLite
forgery controls within that lane. Preserve the headless engine simulator,
[native pause](../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md)
and [UI deferrals](../ROADMAP.md#c1-carry-checkpoints).

### ARCH-D10-05 — coordinated compiler/loader admission lists (fourth)

[Compiler checks](../../lib/loka/content/compiler.ex) and the
[loader's definition-map and validation stages](../../kernel/ts/src/content/cartridge.ts)
require manual coordination as definitions grow. No new compiler/loader
divergence was reproduced. The maintenance cost is reviewing each new definition
across these lists and its separate semantic checks.

After E3, when adding a definition, prefer a small exhaustive table or an existing
contract-derived list where it removes repetition. Minimal red control: omit that
definition's admission hook and require an independently malformed source/artifact
case to fail the check. Keep independent compiler and loader trust-boundary
validation; do not build a shared interpreter solely to unify their structure.

## Limits and preserved boundaries

The earlier simulator input-mutation gap is separately closed by the
[reviewed input-purity change](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-sim-input-purity-review.md).
This audit reproduced no further deer/sight/fatal/knowledge runtime defect. It
does not prove their absence or replace current E2/E3 acceptance. Recommendations
preserve canonical job order, strict unrelated-writer conflicts, atomic proposals,
commit-before-adopt, structural sharing and explicit save-pin refusal without
silent deletion. No native run, UI fuzzing, owner-save access or refactor occurred
in this documentation work. Ponytail review: reuse the recorded proofs and
smallest existing owners; no new runtime machinery.
