# Review: toolbox row 20a, escrow custody (loka-kgd.124)

- Branch `toolbox/m11-escrow`, head `891131e25071dbb407db43258894cb1073ff91fc`, diffed against `a43968d8` (`toolbox/batch-m11`). No PR (batch model). Installed `kernel_api` 1.77 to 1.79.
- Governing: [Escrow custody](../system/mechanics.md#escrow-custody-toolbox-row-20a) (added here), [escrow declarations](../system/cartridge.md#escrow-declarations), [B8 services](../system/mechanics.md#b8-mauds-immediate-services-selected-contract), [composition](../system/architecture.md#building-mechanics-by-composition), archived C3-M02 (`docs/archive/LATER-MECHANICS.md:113`), Beads `loka-kgd.124` (brief).
- Hosted CI at review time: `ci` and `book-e2e` in progress (`gh run list --commit`; the PM watches it).
- Verdict: **APPROVE WITH NOTES** (no blocker; one should-fix test gap).
- Written 2026-10-13 UTC in Claude Code by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. An accepted use is one proposal, writer group 0: payment, one `entity.transfer` body to custody room per selected input, then `fact.assign` true. Nothing written on any refusal.
2. Admission order after the quote: order open (`invalid_state`/`service.order_open`), then inputs (`not_owned`/`service.missing_inputs`), then Give protection, then payment.
3. Inputs: directly body-held only (not bagged, not worn), EntityId order, first `quantity`.
4. GameView offer and invocation share `transition`, so their refusals agree; a fault stays a fault in both.
5. Loader twins: 1.79 floor, item inputs, room custody, quantity at most the inputs, no shop-offer input, both text keys; a cartridge without escrow unchanged (`service.already_paid`).
6. Cold reopen accepts the use_service transfer; a replay returns the receipt; no new event, row or command.

## Proof

- Green at head: `node --test` escrow, service, durability, cartridge_services, e1_services, validate; mobile escrow and service; `mix test` content_escrow, content_services.
- Order, ops and grouping read at `kernel/ts/src/mechanics/service/shared.ts:44-55,94-118`. Worn items sit in slot holders, so `selected` (`containment/stock.ts:16`) excludes them. Mobile reconcilers checked: only `commerce-save.ts:66-73` inspects a use_service transfer, and only for shop-offer items, which the loader refuses.
- Mutants (throwaway worktree, each restored): count `< quantity - 1` killed (escrow.test.ts fails); `giveRefused` skipped killed; Elixir shop-offer check dropped killed (content_escrow fails). Open check moved after `escrowed()` **survived** TS and mobile (finding 1).
- Schema sweep (in-memory over `DEFS.ServiceBenefit` escrow node): all three `required`, `minItems`, `maxItems`, quantity `minimum`/`maximum` killed. `type`/`custody $ref` survivors match house practice (no ServiceBenefit type fixtures exist); `additionalProperties` is implied by `properties` in `validate.ts:94`, so that mutant is equivalent. `invalid.json` +415 lines is 9 cases, one per bound; the 17-ref `too_many_items` case is about 100 lines. Proportionate.
- Malformed escrow (missing custody, missing quantity, items a string) gives Elixir SCHEMA_VIOLATION diagnostics, not a crash.
- Literals hand-checked: 10 − 3 → 7/3; three held → 2 vault, 1 held; broke at 2 < 3; `give_allowed: false` on ore_b → `invalid_state`, pennies 10.

## Findings

1. **should-fix** `kernel/ts/test/escrow.test.ts:126-130`: the spec's admission order (open order before inputs, `mechanics.md` Escrow Admission (1)-(2)) is not pinned. Moving `escrowed()` above the open check (`shared.ts:45-48`) passes every test, because each retry holds two ore. Scenario: a player with an open order who holds no ore sees "Bring two lumps of ore" (`not_owned`), brings two and is then refused `order_open`. The dropped red control is testable after all. The transition is pure, but the order shows in the refusal code. Fix: right after `w = r.world` (one ore held), assert that the offer reason and a use give `invalid_state`/`service.order_open`.
2. **nit** `mobile/authority/local-story/escrow.test.ts:102`: `run(commission(), 'rejected')` does not assert `invalid_state` (acceptance h). Any rejection code passes.

## Departures (accepted)

- Repeated input DUPLICATE_DEFINITION: present in both kernels and specified in cartridge.md; tested in both kernels.
- `fact_changed` on accept: an entitlement emits it today (`fact.ts:255-274`), and the spec now names it.
- `containment_cycle` as a fault in `rule.ts:7-9` and `view/services.ts:64-66`: consistent with `budget_exceeded`.
- `kernel_api` 1.79 with G7 at 1.78: the PM resolves `world.ts` at merge.

## Fix round 1 (head `3fe7445f7f997415ebfa1e92281d1ba6f89964fc`)

- Scope: one commit on `891131e2`, tests only (`kernel/ts/test/escrow.test.ts`, `mobile/authority/local-story/escrow.test.ts`).
- Finding 1 **resolved**: `escrow.test.ts:130-132` asserts the offer reason `invalid_state`/`service.order_open` and a refused use with one ore held. The open-check-after-`escrowed()` mutant now fails (`service.missing_inputs` where `service.order_open` is expected); restored.
- Finding 2 **resolved**: `mobile/authority/local-story/escrow.test.ts:102-104` asserts `error` `{ code: 'invalid_state' }`.
- Green at the new head: `node --test kernel/ts/test/escrow.test.ts`; mobile `escrow.test.ts`.
- Verdict: **APPROVE**.
