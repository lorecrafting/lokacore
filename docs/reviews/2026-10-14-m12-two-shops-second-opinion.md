# Review: two shops save fix, save second opinion (loka-kgd.149)

- Branch `toolbox/m12-two-shops`, exact head `49ba7f136fb9599b9874d73c43f8aee5ebe9f2f3`, base `toolbox/batch-m12` `6642e7c1`. No PR (batch model).
- Governing: Beads `loka-kgd.149` brief; M11 batch review finding 1; [storage lessons](../lessons/storage.md); [Realm seams](../decisions/owner-decision-realm-seams-2026-10-13.md) checklist line 8; [reviewer stance](../../.claude/agents/reviewer.md). Supplements the [main review](2026-10-14-m12-two-shops-review.md); not coordinated with it.
- Verdict: **CHANGES REQUIRED**. One new branch has no test that fails when its check is skipped (reviewer.md step 3).
- Written 2026-10-14 by anthropic/claude-opus-5-5 (save second opinion).

## Must be true (cold-reopen integrity)

1. No legitimate history at two shops (buys and sells, plain and stock offers, same or different currency) is refused on reopen.
2. A buy or sell receipt that names shop A but whose money or item moved at shop B is `save_corrupt`.
3. Another shop's receipt carries no ops in this shop's currency unless both shops share it.
4. Where `receiptHistory` runs, its replay and `commerceSave` agree. Where it does not run, the stored rows still match every computed balance and custody.

## Probes (real SQLite, scratch test removed; harness copied from `two_shops.test.ts:28-130`)

| Probe | Result at head |
|---|---|
| Buy and sell at both shops, plain fisher shop | reopens |
| Buy and sell at both, fisher with stock offer (receiptHistory runs) | reopens |
| Buy naming the fishmonger, money credited to the fisher, penny rows changed to agree | save_corrupt |
| Shells shop's buy paid in pennies, rows changed to agree | save_corrupt |
| Shells shop's buy with two extra penny ops added, rows unchanged | save_corrupt (`:54`) |
| escrow_sampler (no shop): penny row forged; take receipt relabelled as a buy | save_corrupt (likely receiptHistory: services admit escrow_sampler to the gate; refuser not traced) |

## Mutants (`commerce-save.ts`, two_shops and the probe file; M4 also commerce, prices, property, escrow)

| Mutant | two_shops |
|---|---|
| `:43` guard deleted | red |
| `:44` `shopReceipt` never called | red |
| `:48` `? true` | red |
| `:46` credit `provider` instead of `seller` | red |
| `:54` `if (payments.length && money.length !== ...)` | **survived** (all 5 suites green; the D2 probe goes red) |

## Findings

1. **blocker**, `mobile/authority/local-story/two_shops.test.ts:205`: no test covers point 3. Under the `:54` mutant, a shells-shop buy receipt with two invented penny ops reopens, and a retry replays that forged response. `:54` is the only check here: with `commerceSave` turned off, the same probe also reopens, because this cartridge has no stock offer and no `buy_discount`, so `exchange-save.ts:15-25` skips `receiptHistory`. The rows stay correct, because balances come only from computed payments. Before this slice the mutant was equivalent (non-shop receipts get no payments only when they have no money ops), so only the new `: []` arm at `:50` exposes it. Fix: one forgery in the shells test that adds penny ops to invocation 2 and expects `save_corrupt`.
2. **question / follow-up, not this slice**: in a cartridge with no shop, `commerceSave` checks no buy receipt. A buy or sell cannot be accepted there, so such a receipt can only be forged. It changes no rows on reopen. Not run: when the gate leaves out `receiptHistory`, a forged row probably opens anyway. That is inferred from `loka-b60`, which reproduced the gate skipping `receiptHistory` on a cartridge outside it (Realm seams line 8). Follow-up under `loka-b60`; it does not block this slice. Where the gate admits the cartridge (escrow_sampler), the probe is save_corrupt.

## Claims rerun

- Commit `49ba7f13`: "the guard is the refuser today" (red control, guard deleted). Backed: the `:43` mutant goes red.
- Commit `49ba7f13`: "shells currency; one buy at each shop reopens (red control)". Backed: the `:48 ? true` mutant goes red on the shells test.
