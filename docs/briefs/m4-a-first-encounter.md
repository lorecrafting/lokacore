# M4-A brief: first cellar encounter contract

Branch: `m4-first-encounter`. **Planning/specification only**, under [PM first-encounter decision](../decisions/pm-decision-first-encounter-2026-10-03.md) and [delegation](../decisions/owner-decision-autonomous-mechanics-2026-10-03.md). Planning base `e7bcf4541bce17866eb9cbc000e38ba5a8bf254d` contains the reviewed M queue publication; integrate final Gate/main before push. Active planned clauses: [mechanics](../system/mechanics.md#combat1--first-live-encounter-m6-a), [save](../system/save.md#combatdeath-persistence-m4m5), [Book UI](../system/book-ui.md#combat-interaction). [Literal contract](../spec/conformance/first-encounter.md) is the independent expected-result source for later implementations.

Deliver one bounded decision/contract for Maud's real cellar rats; reconcile minimum RNG, initiative, eligibility, flee, sleep/wake and death ordering. Record actual entity-HP/corpse persistence gaps and reachable chapel prerequisite. Deliberate PR136 departures are explicit. The [current reconciliation](../decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md#current-mechanics-policy) retains this untrained/unarmed profile and frozen A/B/C; actual armed/defense consumers add supplemental answers. No claim S1 rewards/objectives or live combat are completed.

Allowed: decision/index/owner-rules, planned active-spec clauses, source-linked conformance Markdown/oracles, this brief and minimal queue/roadmap links. Excluded: executable schema/registry/generated contracts, code, runtime fixtures, new tests, builds, native evidence, simulator/save changes and paid services. Do not freeze speculative event field names, delta operation syntax or final M1/M2/M5 save shape. No unused attack resolver/framework.

## Distinct future regression controls

These belong in M5/M6's eventual implementation briefs, **not new tests in M4-A**. Apply each mutant to the old same-layer suite first; add only missing focused behavior tests with literal expectations.

| Plausible break | Independent control |
|---|---|
| Always draw damage, even after a miss | Oracle A ends at S5 after the second-round miss |
| Fixed rat damage draws another value | Oracle A reaches S3 after round1 |
| Dead rat still retaliates | Oracle B preserves player HP10 and RNG S2 |
| Revival resumes the old opportunity | Oracle C preserves rat HP6 and RNG S3 |
| Accuracy comparison becomes inclusive | Controlled chance20 with roll20 misses |
| Position/target refusal advances RNG | After settled elapsed time, rejected attack adds no gameplay/RNG mutation; normal refusal receipt remains allowed |
| Flee alias pays ordinary price or triggers retaliation | An ordinary1-MV exit costs2, moves once and makes old job harmless |
| Round budget exhaustion adopts a partial draw | Zero budget refuses/faults with unchanged RNG/state |
| Closed/replaced job harms the next fight | Old occurrence changes no RNG/HP/job successor |
| Corpse exists only in memory or loses worn/nested custody | Real changed-row commit/reopen preserves identity, sorted roots and nested parents |
| Unknown death COMMIT permits more work/duplicates corpse | Existing reconciliation restores one atomic occurrence before more input |
| Menu blocks response while world time continues | Actual offered Stand/Flee remains reachable under danger |

Later M5/M6 briefs also own the [production recovery, corpse-route and finite-rat credit controls](../decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md#future-acceptance-references). They must prove actual equipment-free chapel→cellar recovery before lethality; production recovery is not suppressed by the zero-recovery oracle setup. No such control has run in this planning PR.

Review acceptance: independently check the retained RNG values and arithmetic against frozen vectors, admission/refusal semantics, complete escape paths, atomic death ordering, planned/installed distinction and truthful dependency/source claims. Normal documentation/required hooks and exact-head CI precede one fresh independent planning review. No additional code reviewer or invented test result substitutes for that review. Ponytail/correctness self-review must inspect the actual diff.

M5 first resolves entity HP and durable corpse/initial custody, then atomic shrine return and actual recovery along the merged chapel approach; M6 adds actual scheduling/Attack/Stand/Flee presentation only after M1/M2/M5 contracts exist. Shared protocol/foundation/save edits serialize; this docs-only planning can run beside M1-A code.
