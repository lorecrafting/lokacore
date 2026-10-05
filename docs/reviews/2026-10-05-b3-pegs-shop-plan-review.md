# B3 Peg's immediate shop — independent plan review

Reviewed local planning head `b6d91460651b5eeb30923a57363a3d3bdcd15c47`
against B2 base `ec3ab73d`, 2026-10-05. PR: null. I authored none of the
12 changed documents. This is a docs-only planning review, not implementation
or durability proof.

**Verdict: CHANGES REQUIRED.** One should-fix finding.

## Requirements derived before the diff

The governing mechanics, architecture, protocol, save and Book contracts, the
Missing Child B3 row and the adopted PM assignment require:

- A complete all-hours Buy/Sell consumer conserving exact pennies, item identity
  and finite stock, retaining B2's ledger and active-ancestor transfer guard.
- Cartridge-owned prices, stock, funding, mass and storage settings; generic
  mechanics without chapter/NPC literals or unnecessary issuance/restock machinery.
- Shared projection/admission for presence, exact custody, direct-body ownership,
  carrying, funding and quoted price; bounded, preconditioned atomic writes.
- Changed rows and receipt committed before adoption, legal composed states
  reopening, exact retry without duplication, typed refusal of malformed or
  contradictory saved truth, and the existing unknown-COMMIT fence.
- Book consumption through GameView/ActionInvocation and confirmed narration,
  with future light/liquid controls absent until their consumers exist.
- The actual B2 base pinned, future artifacts/proofs unknown, active contract and
  decision/index links, and no-wait/privacy/delivery requirements retained.

## Finding

**B3-R1 — should-fix — `docs/briefs/chapter-one/b3-pegs-shop-brief-2026-10-05.md:35`
(and `docs/system/save.md:444`).** The assignment says to reuse B2 save
reconciliation and add shop-row validation, but does not identify or authorize
changing B2's exclusive-payout balance assumptions. The actual base's
`mobile/authority/local-story/deadline-save.ts:97` requires the player to retain
its authored start when S2 has not been accepted; `:195` requires start plus only
S2's payout thereafter. Its on-time receipt check at `:172` also requires that
receipt's player debit/credit pair to start at the authored initial balance and
end at the current saved balance. `store.load` invokes this validator.

A legal first torch purchase before accepting S2 gives player17/Peg23/Aldric10;
the unchanged B2 validator rejects 17 as `save_corrupt`. Buy then on-time delivery
gives player27/Peg23/Aldric0, but B2 rejects both the historical player17→27 reward
and the current27 balance. On-time delivery then Buy gives the same legal final
balances, but its legitimate historical20→30 reward no longer ends at the current
balance. Shop-row validation alone cannot fix these paths. The blanket “each legal
intermediate state reopens” acceptance does not name this existing conflicting
consumer or put its validator in the implementation boundary.

Amend the recovery clause and brief to include B2's validator/receipt callers:
validate each historical payment against its own committed context and reconcile
current balances with all authorized penny transfers, preserving forged-prior,
wrong-recipient, missing-debit and contradictory-receipt refusal. Add literal
cold-reopen acceptance for Buy before S2 acceptance, Buy before/after the on-time
reward, and a Buy while S2 is active or has failed/expired. These paths must retain
the real ledger/quest outcome, all three balances and conservation without repair;
no compatibility adapter or additional stock ledger is needed.

## Verification and simplicity

I read the diff per document, the B2 implementation and scoped review records,
and the actual conserved payment, carrying/Give and fresh-item identity paths.
The finite shelf, same-ID buyback, ordinary satchel custody, content-owned tuning,
shared query boundary and exclusion of premature B4/B7 controls are coherent.
The decision, owner-rule, roadmap and brief-index links exist; B2 is an ancestor
at chapter0.0.16/API1.14, matching the v016 known-answer fixture. Future B3
release/hash/IDs/implementation/PR/checks remain null. No new engine literal or
independent gameplay writer is proposed.

`git diff --check` passes. The normal review-record commit hook runs the
Markdown documentation check; its result is recorded with the handoff. No
mutation tests, gameplay runtime probe, browser session or full active check line
were run for this docs-only review. The failure scenarios above follow the exact
base's explicit comparisons; they are not claims of a runtime experiment.

Ponytail Review: Lean already. Ship. The required fix belongs in the existing
save/receipt trust boundary; no speculative framework or duplicate stock state
is justified.

## Scoped fix recheck — 2026-10-05

**APPROVE** at planning head `51f5be1efff49966e7447cff036d39193c977f35`.
B3-R1 is closed. The recovery clause now explicitly extends all B2 S2 branches
and validates chronological accepted penny-transfer receipts from the authored
player/Peg/Aldric starts. It binds each historical payment to its own committed
balances and participants, then compares the final reconstructed balances with
saved rows. It retains missing/reordered/forged/unexplained transfer and
contradictory custody/outcome refusal, with no second money ledger or migration.

The brief explicitly names `deadline-save.ts` and its load/receipt callers,
identifies the obsolete exclusive-payout comparisons, and requires cold reopen
before S2 acceptance, before and after the on-time reward, while active, and
after late/expired outcomes. The independent literals are coherent: a 3p Buy
moves20/20/10 to17/23/10; adding the 10p S2 payout gives27/23/0. Reversing those
operations gives the same final balances while correctly preserving historical
player20→30 payout evidence instead of comparing it with the later27 balance.
Both complete orders conserve50p and preserve the original ledger/quest outcome.

I checked only the two changed clauses, their immediate S2/B3 contracts and the
original finding. `git diff --check` passes; the normal review-record commit hook
passes the documentation check. No runtime or mutation tests are required for
this docs-only fix; implementation and its protocol/save opinion remain ahead.
Scoped Ponytail Review: no new unnecessary machinery. No finding remains open.
