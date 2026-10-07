# E1 Maud service witnesses fold review

- PR: [#288](https://github.com/lorecrafting/lokacore/pull/288), branch `slice/chapter-one-e1-r9-certification`
- Scope: `b24d0f63..ff63b5982d0516328273be746e493931a536450b` (merge `f20b424e` of `83f446d0`, comment-only `ff63b598`)
- Governing: [architecture.md witness rules](../system/architecture.md) (service clause 287-292), [E1 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md) Acceptance 2/6 and red controls, [AGENTS.md](../../AGENTS.md) Writing tests
- Verdict: **CHANGES REQUIRED**

## Must be true (written before the diff)

1. Credit only an accepted `use_service` for the exact authored service, provider and quote.
2. Payer debit and provider credit agree between delta ops and before/after state.
3. Declared benefit committed: entitlement false-to-true fact transition; meal stock debit plus MV recovery; drink serving debit from the provider-held vessel plus MV recovery.
4. Offer, refusal or payment without benefit credits nothing; each required clause has a failing red control.
5. Amendment grants nothing inferred from nearby behaviour.

## Results

- Amendment 287-292 matches the neighbouring exact-transition rules; it grants no broad credit.
- Typecheck exit 0; `node --test test/e1*.test.ts` exit 0. The strict `entity()` (`e1_case_host.ts:229`) and `entityId()` (`e1_obligations.ts:350`) throw in no case. The recorder runs all 21 cases.
- Recorder on `ff63b598`: exit 2, `pending`, `gaps.authored_obligations` = 157, the three `/services/` paths witnessed.
- Mutants against `e1_obligations.ts` (focused test; survivors rerun against all `e1*.test.ts`):
  - Red (fail as required): force `committed`, drop the recovery check, drop the meal stock check, drop the `liquid.set` op check.
  - Green (survive): remove the whole payer-debit/provider-credit check (`:72-76`); remove the provider check (`:51`); remove the quote check (`:52`); remove the entitlement event check (`:92-101`); remove the before/after fact check (`:81-82`); remove the cask-holder check (`:118`); remove the liquid-kind check (`:123`).

## Findings

1. **blocker** `kernel/ts/test/e1_obligations.ts:72-76`: a test-only change can delete the payment clause, which the spec requires, and every e1 test stays green. Failure: a change that credits a service from benefit ops alone, for example a refund-path or free-service regression in the binder, is not detected. Plant a decision with the payer or provider `resource.adjust` op removed, and plant a mismatched `quoted_price`, in `e1_services.test.ts`.
2. **should-fix** `kernel/ts/test/e1_services.test.ts:71-78`: the wrong-provider control plants `provider_id = body`. The payment check rejects that first, so the provider (`:51`) and cask-holder (`:118`) clauses have no test of their own. The entitlement event (`:92-101`) and before/after fact (`:81-82`) clauses also survive because the test mutates only ops. Failure: deleting any of these clauses stays green. Add one planted violation for each clause, or delete clauses that are not needed.
3. **nit** `kernel/ts/test/e1_obligations.ts:124`: hard-coded `previous.quantity - 1`. The kernel debits the liquid's `drink_amount` (`liquid/shared.ts:127`). This is correct for v042 ale (`drink_amount: 1`) and fails closed elsewhere.
4. **nit** `docs/system/architecture.md:290`: "ale serving" names content. The benefit kind is `drink`.
