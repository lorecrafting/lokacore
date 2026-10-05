# B3 Peg's finite shop — independent primary review

Local draft PR; hosted PR: null. Source head
`e530505061bb7195f034a286caaf3be213ea13c9`; exact integrated head reviewed
`340025a0ef5d3644e84ac23634b74dfa6d20d459`, against provisional A3 `6a8be6d1`
with A3's independently reviewed `05e72a3c` correction included.
Fresh Codex reviewer; authored none of this implementation.

**Verdict: APPROVE at `340025a0ef5d3644e84ac23634b74dfa6d20d459`.** No findings.
The separate save/protocol opinion and publication checks retain their own gates.

## Requirements derived before reading the diff

- [Mechanics](../system/mechanics.md#pegs-immediate-shop-b3-selected-contract):
  direct eligible custody, living co-located provider, current quote, conserved
  pennies and positive-load carrying admission precede every effect. Exact-ceiling
  Buy succeeds; stale, unavailable and protected-ancestor exchanges refuse atomically.
- [Shelf](../system/cartridge.md#pegs-b3-shelf): exactly four authored identities;
  custody supplies finite stock. Buyback returns the same item; the satchel already
  supports ordinary Put/Take. No issuance, restock or later-use controls.
- [Composition](../system/protocol.md#b3-shop-composition) and
  [recovery](../system/save.md#b3-shop-recovery): one changed-row transaction and
  receipt; retry changes nothing; chronological payments preserve lawful S2 states
  and reject forged transfer/custody evidence.
- [Book](../system/book-ui.md#b3-shop-detail): exact quotes and identities, current
  refusal reasons, live freshness, confirmed Peg history and refreshed inventory.

## Verification

- Pinned Node: the 12 focused commerce/contracts/SQLite/Book tests pass in 0.7 s.
  The related containment/resource/equipment/carrying/Book set passes 75 tests in
  1.25 s; the six existing B2 authority tests separately pass in 0.38 s.
- Pinned Mix: `mix test test/loka/content_missing_child_test.exs` passes all three
  compiler/current known-answer/source-rejection tests in 0.4 s after compilation.
- Independent throwaway-worktree controls: bypassing commerce carrying admission
  fails the overweight purchase test; omitting the payer debit fails the literal
  conservation test. Each mutant run exits 1. Restored focused tests pass 12/12;
  the throwaway worktree is removed. Reviewed source remains unchanged.
- Independent real-SQLite probes pass for confirmed Peg purchase history,
  obsolete-button refusal without duplicate success narration, and
  Wear/Remove/Drop/Take/Put/Sell/Buy/Give with cold reopen. A nested torch survives
  satchel sale and buyback; ordinary Give to Peg restores that exact torch's stock.
- Actual-diff review covers command identity/quote binding, shared offer query,
  conserved transfer, protected S2 ancestors, receipt retry, changed-row adoption
  and chronological S2 payment recovery. No chapter/NPC special case was added
  to the capability rule. Expected commerce balances and prices are literal.

Ponytail Review: **Lean already. Ship.** Existing payment, containment, carrying,
writer group and Book receipt paths are reused; no extra stock ledger, creation,
restock framework, dependency or speculative abstraction.

Full checks, broad schema mutation sweep, hosted CI and native verification are
not claimed; see the [source check note](../evidence/2026-10-05-b3-shop/README.md)
and [provisional workflow](../WORKFLOW.md#local-draft-pr-cadence).
