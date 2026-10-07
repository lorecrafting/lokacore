# Independent review: C6 expedition delta invariant

- Reviewed integrated head: `e40e9f9d16f3c8e8cb08ee50589f243858f9bf5e`
- Base: published main `95ff7bb1`
- Scope: C6 spec context, expedition delta precondition binding, simulator regression, and retained gate evidence
- Initial verdict: **CHANGES REQUIRED**

## Review

The published base already contains the C6 S27 gameplay contract and expedition row lifecycle, so the correction does not introduce a new mechanic. The added mechanics sentence documents the oracle behavior. The implementation adds the two required bindings in the existing `deltaPreconditions` target walk: `link()` uses `expected`/`value`, and `initial()` reads `state.expeditions[quest_instance_id]`. `target()` already keys expedition operations by quest instance. The existing `compose_expedition` check still rejects illegal lifecycle steps and preserves actor/body/quest/attempt bindings; the adopted-state check still verifies the final changed row. The shared `seen` map checks sequential writes to the same target against the preceding transition.

The simulator test executes a legal Start through the real kernel and requires the oracle to accept it, then changes the prior-row expectation and requires the invariant to reject it. The retained `skip-check-mutant.log` shows the false-prior assertion failing when the new invariant branch is bypassed.

- **E1-C6-1, should-fix — `docs/evidence/2026-10-06-e1-expedition-invariant/README.md:16`:** The README claimed five focused simulator/C6 tests passed, while its linked `focused.log` contained only the single legal-Start regression. The retained artifact did not support the stated count.

The retained full-gate receipt identifies code source `3b14592d`, reports exit 0, includes 402 ExUnit tests and TypeScript checks, and is covered by the hash manifest. All three artifacts in the initial manifest verified. The retained focused regression and mutant logs contain no home/temp paths, device labels, UDID/serial labels, or team/signing identifiers. Ponytail review: two small bindings reuse the existing checker and sequential target walk; the regression is necessary; no over-engineering found.

## Fix round 1 — `f594282465187fa6eb44a343d7750d6a5a3713d5`

Verdict: **APPROVE**. E1-C6-1 is closed: `focused-suite.log` records the five-test suite; the README links that artifact and separately labels `focused.log` as the single-test regression. I reran `mise exec -- node --test test/c6_expedition.test.ts test/sim_mechanics.test.ts`: 5/5 passed. All four retained output hashes verify, including the new suite log; the red-control log still shows the test failing with the invariant branch bypassed. The privacy scan is clean for all four logs. `mise exec -- elixir bin/check_docs.exs` passed (792 docs, 0 broken links, 0 unreachable); `git diff --check 95ff7bb1 f5942824` passed. The fix changes evidence documentation only. E1 certification remains pending; this correction awards no route credit. No open findings.
