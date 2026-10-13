# Review: toolbox rows 24 and 25, property ownership and bank (loka-kgd.127)

- Branch `toolbox/m11-property`, head `19b6c6bff0bc8a22f333b0ce7f28ed7d43092f94`, diffed against `23f7d115` (`toolbox/batch-m11`). No PR (batch model). Installed `kernel_api` 1.81 to 1.83.
- Governing: [Property and bank](../system/mechanics.md#property-and-bank-toolbox-rows-24-and-25) and [its declarations](../system/cartridge.md#property-and-bank-declarations) (added here), [B8](../system/mechanics.md#b8-mauds-immediate-services-selected-contract), [escrow 20a](../system/mechanics.md#escrow-custody-toolbox-row-20a), [G7](../system/mechanics.md#access-locks-toolbox-row-g7), [W26](../system/mechanics.md#npcs-use-doors-toolbox-row-w26) (PM rule: a walking NPC is refused by any G7 traverse/enter lock without evaluating it), Beads `loka-kgd.127` (brief). Mobile save depth: the parallel second opinion.
- Hosted CI at review time: `book-e2e` success, `ci` in progress.
- Verdict: **CHANGES REQUIRED** (two blockers).
- Written 2026-10-13 UTC in Claude Code by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. Property is content only: entitlement `owns_hut`; hut `locks.enter`, chest `locks.get`/`locks.put` read it; key by an existing writer or lying in the hut (stated).
2. Deposit: fee to provider, `amount` body to vault, account + `amount`; withdraw: refused `invalid_state`/`service.no_funds` when the account is short, nothing moves; fee, vault to body, account − `amount`.
3. Player + vault + providers conserved; the deposit chains on the levels the fee left.
4. Both loaders: 1.83 floor; account a bounded int player fact from 0, written by no other benefit or engine writer; vault an NPC holding the currency; one vault and currency per account.
5. Offers call the same `transition`; the Book shows no wrong benefit text.

## Proof

- Green at head: `node --test` property, access_locks; `mix test` content_property.
- Mutants (each restored with `git checkout`), all killed: withdraw ignores the balance (`service/shared.ts:256` drops `next !== current + by`: d-f fails); deposit not chained on the fee (`paid.levels` dropped: d-f and h fail); vault transfer dropped from the ops (d-f fails); TS floor 83 to 82 and clash check dropped (g fails each); Elixir floor `[1,83]` to `[1,82]` and `vaults/1` returning `[]` (content_property fails each); content mutant: hut enter lock removed (a, b and c fail).
- Hand-checked literals: 30 − 10 = 20; deposit 20 − 1 − 10 = 9, vault 20 + 10 = 30, account 10; withdraw at B 9 − 1 + 10 = 18, vault 20, account 0; sum 40 at each step.
- Thief test buys first, so a lock read with the player as actor would admit the thief: the open-door wait pins the PM rule.

## Findings

1. **blocker** `kernel/ts/src/content/cartridge_services.ts:141`, `lib/loka/content/services.ex:258`: neither loader refuses an account another engine writer owns (brief: "named by no other kind of benefit or writer"). Run: property_sampler with a skill `pick` (`growth [50]`) and all four bank accounts set to `uses_pick` (int 0..50, default 0, player) compiles and loads; `gameView` then throws `precondition_failed` for the whole view, and a deposit faults `evaluator_error` (`fact.ts` `ownership`). Fix: refuse an account in the engine-owned set (skill `skill_`/`uses_`, scene, patrol) in both kernels, with a twin case.
2. **blocker** `mobile/app/book/offers.ts:30`, `mobile/app/book/Npc.tsx:181`: `'amount' in s.benefit` is true for deposit and withdraw, so the Book labels read "Deposit — 1p; up to +10 MV, capped". The PM wants this fixed in this slice; the head has no mobile/app change.
3. **nit** `kernel/ts/src/content/cartridge_services.ts:141`: no check that the account maximum (or the vault pool's maximum) is at least `amount`; a `savings` maximum of 5 with `amount` 10 loads and every deposit refuses `service.unaffordable` forever. The deposit-past-maximum and purse-full branches of `service/shared.ts:256` are untested.

## Questions

1. Fee before amount on withdraw (`service/shared.ts:56`): a purse of exactly 11 deposits 10 and is left with 0; every later withdraw refuses `service.unaffordable`, so the savings are out of reach. Spec-conformant ("Admission: the fee"); PM to accept as a known limit or order the fee after the payout.

## Checks asked by the PM

- Dropped pre-payment withdraw check: the account bound gives `invalid_state`/`service.no_funds` (test f, mutant killed); fee-first order as specified (question 1). Offer parity: shared `transition`, tested for no_funds and unaffordable.
- Conservation: totals constant in the test; `transfer` now chains `levels` and rechecks bounds on the chained values (B3, commerce and transport callers pass `{}` and keep their old result).
- Twins: floors, account shape, vault currency and the clash agree; both miss finding 1.
- Schema: two new oneOf branches; `invalid.json` adds a missing account, vault and amount, amount 0 and 1000001, and an extra `fact` key, across both kinds; no frozen fixture changed.
- Developer claims rerun: vault starts with 20 pennies (`npcs/vault.json`); e1_obligations size allow 550 with the bank branch (diff).
