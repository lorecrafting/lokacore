# B7 waterskins and liquid actions — save/protocol second opinion

Local branch `b7-well-waterskin`; exact source
`d31b47d8b2474699348675d697b2fa26a34ba181`. Fresh independent reviewer;
authored none of the implementation or plan. Evidence-only successor
`0c987ca97da64c636f63875c680321c3f38fb805` identifies that same tested source.
Hosted CI, browser and native proof: null.

## Requirements

- [Liquid recovery](../system/save.md#b7-liquid-recovery) proves exact historical
  commands, actors, participants, custody, kind and quantities from authored rows;
  lawful later transfers remain valid and malformed evidence refuses intact.
- [Commit/reconcile](../system/save.md#commit-fence-reconcile) retains all prior or
  all next rows/head/receipt through failed and uncertain COMMIT, reopen and exact
  retry; input and elapsed work remain fenced until confirmation.
- [Portable composition](../system/protocol.md#b7-liquid-composition) checks exact
  whole-row preconditions, capacity/kinds, ordered writes and atomic conflict in
  both kernels, independently of composition's result.
- [Selected consumer](../system/mechanics.md#b7-well-and-waterskin-selected-contract)
  preserves shells and contents through shop, nesting, ground and corpse custody;
  checked liquid mass participates in existing carrying admission.
- [Explicit replacement](../system/save.md#new-game) restores an untimed physically
  damaged save while preserving timed-save identity and transaction/read fencing.
  [Current contracts](../system/protocol.md#contracts) retain independent release,
  API, hash and initial identity pins.

## Verdict

**APPROVE. No findings.** This opinion supplements the primary implementation review.

The new row uses existing changed-row SQLite persistence, writer groups and adoption.
Cold recovery shares accepted-receipt replay rather than adding another gameplay
writer. It binds ordinary command IDs to the stored invocation, replays trusted
elapsed through its existing boundary, compares full decisions and reconciles final
state. Exact quest/scope and commerce history remain part of the same reconstruction.
Missing event/command payloads retain typed corruption handling. The reset change
permits the untimed no-header case while keeping timed replacement witnesses and
closed-transaction confirmation.

## Verification

- Independent focused Node run: **73 passed**, one existing phone-capture test
  skipped. Files: liquid, recovery, Start over, faults, smoke, readable and portable
  liquid composition/contracts. Real SQLite covers intermediate rows, nested/drop/
  sale/buyback/corpse custody, genuine failed COMMIT, lost acknowledgement, replay,
  bounded quantity forgery, malformed evidence and physical index corruption.
- Independent Elixir run: **7 passed** across liquid composition/contracts and
  compiler tests, including independent literals followed by **300 randomized**
  two-kernel comparisons.
- Five temporary source mutations fail their focused controls: remove invocation
  binding; bypass timed replacement fencing; remove untimed corrupted receipt-index
  recovery; omit TypeScript or Elixir independent liquid precondition replay.
  Every mutation was restored. Restored targeted Node **4/4** and Elixir **7/7** pass.
- The stdlib generator reproduces both current pinned files byte for byte. Actual
  loader/newWorld matches all **96** independent IDs and API **1.20**; release
  `ashmere_missing_child@0.0.22`, SHA-256
  `0f744a6c12e8cde1c70cac454e16c733bf5ec27265fc6ad2cd7ad1b025e9dbf8`.
- Reviewed the developer's exact-source full active/Story/Book/typecheck evidence
  and schema sweep: **114 killed, zero survivors**. Those full checks were not
  rerun for this review-only commit. Headless checks make no native/browser claim.

Ponytail Review: **Lean already. Ship.** Necessary typed rows and independent guards
reuse current machinery; no added dependency, ledger or speculative abstraction.
The deliberate linear cold-recovery limit is documented beside its implementation.
No unnecessary test finding; new controls cover distinct realistic breaks.
