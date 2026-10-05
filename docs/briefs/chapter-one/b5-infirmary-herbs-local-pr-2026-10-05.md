# B5 Infirmary Herbs — local draft PR

Branch: `chapter-one/b5-infirmary-herbs`. Assignment base: `340025a0`;
corrected B3 source merged from `9c7e537` before B5's independent pins.
Hosted PR, hosted CI, independent B5 source reviews and native/browser proof: null.
The exact implementation head is supplied in the developer handoff.

## Result and contract

[Selected contract](../../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract),
[authored tuning](../../system/cartridge.md#b5-herb-and-bandage-stock),
[typed composition](../../system/protocol.md#b5-harvest-and-exchange-composition),
[recovery](../../system/save.md#b5-stock-and-repeat-recovery) and
[Book](../../system/book-ui.md#b5-herbs-and-wick-details).

The chapter now exposes the public Cloister/Infirmary route, Wick and Willow Shade's
finite patch. Harvest and ordinary Take use the same real stock. Optional acceptance,
exact bound turn-in and immediate explicit reacceptance conserve authored identities;
final carrying admission counts outgoing herbs as well as incoming bandages. Separate
contribution records only faction gain actually awarded. No wait, restock or issuance
was added.

Chapter `ashmere_missing_child@0.0.19`, API1.17; independent
[artifact](../../../protocol/fixtures/missing_child_v019_hash.json) SHA-256
`de1588f1fdfb47e66ec09a3c8d6b78fb53589153fcc3a679028a49b5f93b5442` and
[86 initial IDs](../../../protocol/fixtures/missing_child_v019_ids.json), derived by
[Python's JSON/SHA-256 and the numeric profile](../../../protocol/fixtures/generate_missing_child_v019.py).
The compiler is compared to that independent payload. The app advances its bundled
release and retains explicit save-pin refusal; it never rewrites an old pin.

## Composition and safety

Containment owns stock selection and conserved transfers. Quest owns latest occurrence
and terminal-only `quest.retire` immediately paired with fresh `quest.activate`.
Dialogue owns exact item/occurrence bindings and atomic lowering. Fact owns bounded
adjustment; the host owns changed-row retirement/commit/adoption. GameView and Book
read confirmed truth. `runtime/proposal.ts` is untouched.

Cold save validation reuses kernel admission/lowering against existing receipts at each
original revision, starting from the saved lineage seed, then checks current rows. This
handles lawful B2/S9 faction order, ordinary post-reward custody and retired occurrences
without a second ledger. This recovery-only linear replay has no phone timing claim.
Existing COMMIT fences and exact retry are retained.

## Focused proof

All commands use the pinned mise toolchain. The provisional lane defers full
`bin/check_all.sh`, broad schema sweep and hosted CI to the accumulated publication head.

- Kernel and Book: finite stock, deterministic ID/equality/refusal, four immediate
  exchanges, contribution saturation/unrelated loss, exact/stale occurrence and custody,
  final-load equality/reducing overload/one-gram-over refusal, exact displayed targets.
- Real rollback-journal SQLite: each active/resolved/reaccepted occurrence; exact receipt
  retry; accepted herb Drop/retrieval; later bandage Drop; both B2/S9 orders; genuinely
  failed COMMIT and successful lost acknowledgement for exchange and retirement;
  malformed contribution, occurrence, omitted transfer and forged current custody,
  refused without repair. Saved random lineage seed and explicit Start over also reopen.
- TS and scoped mobile production typechecks; focused compiler and loader invalid stock/tuning; TS/Elixir composition
  known answers and randomized differential; required contract examples; generation,
  source purity/import lint, active size and documentation checks.

The six mechanic mutants survived the old focused suite, then each failed the new
focused suite: omitted outgoing transfer, wrong harvest selection, omitted final carrying,
cap based on global faction, reset cumulative contribution and stale occurrence binding.
Additional red controls removed Harvest's required target, bypassed receipt replay and
allowed standalone retirement; each exited 1 and was restored.

Self-review fixed saved-seed replay, exact static participant validation and bound-stock
revalidation without substituting a newly lower ID. The saved-seed mutant also fails its focused random-lineage reopen check.
Ponytail Review: Lean already. Ship.
No new dependency, generic barter interpreter, history store or item creation path.

Inherited publication carry: `mix credo --strict` still reports B3's
`lib/loka/content/commerce.ex:12` (`shop`, ABC51) and
`lib/loka/content/compiler.ex:41` (`checks`, ABC31). B5's own findings are fixed. The PM
accepted this scoped disposition; these remain for accumulated publication.

Broad mobile typecheck is unavailable with the current installed dependencies:
`@e2e-dev/web` and `e2e` are missing in untouched `e2e.config.ts`/`tests/book.e2e.ts`.
A temporary config excluded only those E2E files and the existing test exclusions;
all production sources typecheck. No native or browser run was attempted.

## Independent review fix round 1

Primary `B5-P1`/`B5-P2` (record commit `eab3a8f9`) and save/protocol
`B5-S1`/`B5-S2` (`d77332eb`) remain open for scoped independent recheck.
P1/S1 describe the same elapsed replay defect.

- Accepted trusted elapsed receipts now use `stepElapsed`, including the saved run ID
  check. A real clock tick from 64800 to 64801 survives physically closing/reopening a
  file-backed SQLite connection before S9, then the actual harvest/exchange consumer.
- Static dialogue roles preserve their bound identities. B5 compares its continuation's
  participant set to the accepted quest binding and lowers to that original NPC; the
  existing generic pinned-role test and a B5 mapping-drift test both pass.
- Each kernel's independent precondition checker requires immediate activation of the
  same quest/scope with a fresh instance and the same writer. Literal forged-success
  observations reject standalone and each mismatched pairing.

Reintroducing player-only elapsed replay and static-role re-resolution makes the named
regressions fail. Removing each kernel's retire pairing check also fails the literal
invariant observations; individually dropping the TS quest/scope/fresh-ID/writer checks
fails its corresponding observation. All mutations are restored. Ponytail and correctness
self-review: scoped fixes, no new ledger, repair or dependency.
