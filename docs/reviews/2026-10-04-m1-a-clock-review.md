# M1-A elapsed authority contract review — 2026-10-04

PR [#153](https://github.com/lorecrafting/lokacore/pull/153), reviewed commit `7d6455af04fc5be7d9139c78e8f3660ce252ccc4`, merged base `d279a4ab6acb871ad246fe21811526e0ac168824`.
Fresh independent Codex primary; authored none of the implementation. PM confirmed all six exact-head CI jobs green before implementation review. Separate Sol review is a separate result.

**Verdict: CHANGES REQUIRED.** One should-fix test-discipline finding; no production correctness finding.

## Requirements derived before the diff

Read the [brief](../briefs/m1-a-clock.md), [adopted continuation policies](../decisions/pm-decision-mechanics-continuation-plan-2026-10-03.md), [elapsed contract](../decisions/pm-decision-m1-a-elapsed-contract-2026-10-04.md), active cartridge/mechanics/save/protocol clauses, frozen numeric profile, workflow/reviewer role and contract/storage/mobile/evidence lessons before implementation inspection.

- Optional elapsed policy has a positive canonical-safe integer rate, schedule ownership and API minimum 1.1. Omission preserves legacy behavior, artifact bytes and fixture meanings.
- Only the closed trusted entry accepts elapsed. Player invocation, actions and aliases cannot admit it; elapsed cartridges refuse Wait and nonzero-duration recipes. Ordinary resources/state changes and scene Continue-only player admission remain.
- Frozen UUIDv8 identity binds domain, durable run, world and both safe integer interval endpoints. No World run field or portable hash-shape change. Schema, nil/actor/world identity and derived-ID checks precede evaluation.
- Pure elapsed produces one root existing time.advance, no own event, narration, OS clock or RNG draw. Existing proposal ownership, due order, budgets, structural sharing and fault atomicity remain.
- Authority settles fences and checks durable run before receipt lookup; matched-run replay precedes clock admission. Changed rows and receipt commit before adoption, with existing failure/fence/reconcile behavior.
- Timer/anchor/lifecycle/sampler/UI, chronological recurrence and paused CLI trusted trace dispatch/run verification remain M1-B carries. Tests need distinct behavioral regressions, independent expected results and real storage faults.

## Findings

**M1A-01 — should-fix — `mobile/authority/local-story/elapsed.test.ts:51` at reviewed commit.** After losing a real successful COMMIT acknowledgement, `getFirstSync` throws a synthetic `Error('read unavailable')` before issuing any SQLite read. The test therefore does not exercise an actual receipt-read storage failure, contrary to AGENTS.md's real-storage-fault rule and the brief's real admission/receipt proof. Its green result establishes handling of the wrapper's error, while SQLite itself remains readable.

Replace this fault in the existing test with an actual reversible SQLite read failure selected by operation, preserve assertions that trusted and player delivery remain pending and memory stays at the prior clock, then restore storage and prove receipt reconciliation without another advance. Retain the removed-fence red control and update the affected evidence. No additional overlapping test is needed.

Reviewer demonstrated a bounded alternative: after the real COMMIT, rename the receipt table; normal receipt lookup then raises SQLite's actual missing-table error. Inspect the committed row directly under its temporary name, restore the table before reconciliation. All four authority tests pass with this mechanism; removing trusted delivery's fence makes the unknown-COMMIT test fail. Temporary test/source edits were restored and are not part of this record commit.

## Independent verification

- `mise exec -- node --test --test-reporter=spec kernel/ts/test/elapsed.test.ts kernel/ts/test/portable_abi.test.ts kernel/ts/test/schedule.test.ts mobile/authority/local-story/elapsed.test.ts`: **49 passed**.
- `mise exec -- mix test --force test/loka/content_ferry_test.exs test/loka/content_recipes_test.exs test/loka/core/portable_abi_test.exs`: **46 passed**.
- `mise exec -- elixir bin/contracts.exs --check`: **exit 0**.
- All three elapsed canonical/hash/UUID vectors independently verified using Python json/hashlib/uuid. All 88 retained evidence hashes and every restored-source manifest match reviewed bytes. Inspected the actual schema sweep and old/new mutation results, including discriminator generator rejection.
- Reviewer mutations removing the durable-run guard and derived-ID guard each fail their named behavioral test (**exit 1**); exact original bytes restored.
- `Host.random` omission is safe for run isolation: it controls world context/RNG only; `first` always obtains lineage/run via two required fresh `Host.newId` calls, including replacement. Existing new test exercises unchanged world context with a distinct durable run.
- Shared delivery helpers retain their previous bodies and both callers use them. No proposal algorithm, delta/state shape, dependency, timer or UI change. Existing receipt-integrity limitation remains the explicit [known difference](../system/DIFFERENCES.md), rather than an unclaimed result-digest guarantee.

Ponytail Review: **Lean already. Ship.** No unnecessary abstraction or dependency found. Open finding: **M1A-01**.
