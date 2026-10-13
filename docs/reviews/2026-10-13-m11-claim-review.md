# Review: toolbox row 20b, timed job claim and cancel (loka-kgd.126)

- Branch `toolbox/m11-claim`, head `526d6ab80246ae2ed664de369320f45adf4f7943`, diffed against `34477f46` (`toolbox/batch-m11`). No PR (batch model). Installed `kernel_api` 1.79 to 1.80.
- Governing: [Timed job claim and cancel](../system/mechanics.md#timed-job-claim-and-cancel-toolbox-row-20b), [claim and cancel declarations](../system/cartridge.md#claim-and-cancel-declarations), [escrow custody](../system/mechanics.md#escrow-custody-toolbox-row-20a), Beads `loka-kgd.126` (brief and PM rulings 2026-10-13: cancel leaves the job pending and inert; no refund; commission refuses `service.no_output` before inputs; timed escrow needs `schedule`; known limits; 1.80).
- Hosted CI at review time: `book-e2e` success, `ci` **failure** (kernel job, `kernel/ts/test/e1.test.ts:210`, finding 1).
- Verdict: **CHANGES REQUIRED** (finding 1 turns hosted CI red).
- Written 2026-10-13 by anthropic/claude-opus-5-5 (reviewer).

## Must be true

1. Offer and use go through one `transition`; claim checks no_order, not_ready, no_output, then payment; cancel checks no_order, ready, then payment. Claim moves the output only; cancel returns the first `quantity` inputs in custody in EntityId order; both set the fact false; no fee is returned.
2. A timed commission schedules one `order` job at now + `ready_after` in the same proposal. Ready = fact true and no pending `order` job of that service. A cancelled job stays pending, so a re-order is never ready before its own due time.
3. A commission with `output` refuses `not_found` `service.no_output` before inputs when the output is out of custody.
4. Both kernels: 1.80 floor for claim, cancel and timed escrow; `UNDECLARED_CAPABILITY` without `schedule`; claim and cancel must name a timed commission; output lies in custody. The schema refuses `ready_after` out of 1..31536000, `output` and `ready_after` apart, and claim or cancel without `service`.
5. Saves: pending and completed jobs survive a real-SQLite reopen; replay is the same.

## Proof

- Green at head: `node --test` escrow, validate, hireling; mobile `local-story/escrow.test.ts` (real SQLite); `mix test` content_escrow, content_services, core/contracts (12 pass); `node bin/check_ts_size.mjs` exit 0.
- Mutants (detached worktree, each restored): killed: due −1 (2 fail); commission no_output check skipped (1); `busy` ignores job status (2); cancel keeps the fact true (2); TS schedule capability check removed (loader test); Elixir floor 80→79 (content_escrow); Elixir output location check dropped (content_escrow). None survived.
- Schema sweep with `elixir bin/contracts.exs` regeneration: removing claim or cancel `kind` from `required` or removing `additionalProperties` is rejected by the subset compiler (`lib/loka/core/contracts/schema.ex:67`); range, `dependentRequired` and `service` cases are pinned by `protocol/fixtures/invalid.json`.
- Probes: a mobile reopen after the claim and after the cancel keeps the state. Commission 10−3 → 7/3; claim → 6/4 with the ore spent; cancel at C0+1800 → ore back, 6/4; the re-order is not ready at C0+3600 or C0+5399 and is ready at C0+5400. Hand-checked against the test literals.

## Findings

1. **blocker** `kernel/ts/test/e1.ts:24-54` (`CHECK_FILES`): the new `e1_order.ts` is missing. Hosted `ci` fails `check_hash covers every local module e1_cases.ts imports` (`kernel/ts/test/e1.test.ts:210`, actual `['e1_order.ts']`). Scenario: an edit to `e1_order.ts` leaves the E1 `check_hash` unchanged, so a stale E1 receipt passes. Fix: add `'e1_order.ts'` to the list and regenerate the receipt.
2. **should-fix** `kernel/ts/src/content/cartridge_services.ts:44-53`, `lib/loka/content/services.ex:199-201` (readiness `kernel/ts/src/mechanics/service/shared.ts:161-167`): neither kernel stops another entitlement service from sharing a timed commission's fact. Probe: an untimed `rent` (price 2, fact `ordered`) loads; pay `rent`, then `claim` is accepted at once, with no ore and no wait, and the sword goes to the body. Fix: both loaders refuse a timed commission fact named by any other entitlement (or `bed`); or the PM records it as a known limit.
3. **nit** `docs/system/mechanics.md:1512`: the quoted sampler line is not the toolbox text ("sword claimable after two hours; cancel path returns the ore"). Quote it as written or paraphrase without quotes.

## Developer reports judged

1. Label fixes `mobile/app/book/offers.ts`, `Npc.tsx`: accepted. Without them a claim offer renders "up to +undefined MV".
2. `kernel/ts/test/e1_order.ts` and the `e1_obligations` marker 545→548: accepted (a new witness module and three dispatch lines). The only gap is `CHECK_FILES` (finding 1).
3. Sampler 3600 s against the toolbox "two hours": accepted. The brief set 3600 and the cartridge owns the number.

## Checks asked by the PM

- Rulings implemented as stated: the job stays pending and completes inert (`schedule/rule.ts` writes only `job.complete`); no refund; no_output before inputs; `schedule` checked in both kernels (Elixir inside `output/4`, equivalent through `dependentRequired`); 1.80 floors; price minimum 1.
- Same-time-job lesson: the order job writes only `job.complete`, so order among same-time jobs cannot matter.
- Composition: `schedule/rule.ts` dispatches the `order` kind as it does `wage`. No capability code names a content key.
- `docs/lessons/storage.md`: the mobile test reopens the real SQLite store while pending and after completion and checks the replay.
