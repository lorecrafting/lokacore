# Independent review: Gate R5 budget diagnostic contract and deferred mechanics

- PR #56, reviewed head `7bec84fa00c10e09e4416a93a75d62531489fb51`.
- Verdict: **APPROVE WITH NOTES**; one should-fix before merge.

## Requirements derived before reading the diff

Document 04 §§5.4–5.5 requires a whole-decision `budget_exceeded` fault and causal diagnostics without a truncated commit or leaked private facts. Document 11 §12 and ADR-075 §§2–3, 7 require observations to stay non-authoritative, use the appropriate closed IDs, and receive a registered name, closed data schema, and valid/invalid fixtures with their first producer. Document 00 §4.1 must place `knock` and map discovery/`where` according to the owner's deferral while preserving open/close at R5; document 14 §R10 covers chapter-one work.

## Finding

- **Should-fix — `docs/spec/04-command-event-effect-protocol.md:326`:** The unqualified “A budget exhaustion” rule requires a durable `evaluation.budget_exceeded` observation with all `ReplayIds`. A Builder `preview` can evaluate a disposable snapshot with isolated RNG (04 §5.5; 08 §30) and hit the same budget, but those contracts do not give it a `run_id`, `command_id`, or authority `revision`; ADR-075 §3 requires all three. A producer would have to invent IDs, emit an invalid observation, or silently omit the required diagnostic. Specify that the registered observation applies to replayable decisions with real `ReplayIds`, and say how a preview without them reports the limit locally without publishing an observation.

## Checks

- Compared the limit list and tie order with `docs/spec/conformance/composition-profile.json`: all eleven keys match in profile order. The closed `DecisionResult` fault remains unchanged; the diagnostic is separate and non-authoritative, with unavailable causal values `null` rather than invented.
- Checked the deferral against document 00 §11 and document 14 §R10: both mechanics belong to chapter one; open/close remains R5. The owner record identifies the decision as a PM relay rather than fabricating a verbatim quote.
- No implementation, schema, fixture, or test changed. The first-producer rule is consistent with document 11 §12 and ADR-075 §7. Mutation testing does not apply to this documentation slice. No unnecessary mechanism in the diff.

## Re-review — `90e18668f5edf96773eca172234bd1ff2f7f9dfc`

**APPROVE.** The should-fix is resolved. Document 04 §5.4 now requires a stored observation only for a replayable decision with genuine `ReplayIds`; a preview without them reports the limit in its local diagnostic and neither invents IDs nor emits an `ObservationRecord`. This matches ADR-075 §3's required IDs and the isolated, unpublished preview in documents 04 §5.5 and 08 §30. The closed fault, exact limit key, first-producer registration, and non-authoritative store remain intact. I reviewed the one-line fix and those direct spec cross-references; no new findings. Documentation-only change; no mutation test.

## Merge-head verification — `67b508d6900fc688d47f5bf00043bf10e1b67ec4`

**APPROVE.** The reviewed spec and owner-decision files are unchanged from `8d9c470`. The `docs/reviews/README.md` conflict resolution retains both PR #56's final approval and PR #57's approval. No new finding in this scoped head check.
