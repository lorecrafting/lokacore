# Owner decision: E2 slice plan and its open questions — 2026-10-07

(paraphrased) The owner approved the [E2 slice plan](../briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md)
and answered its four questions.

- **Plan.** S0 lets the E1 runner accept a second candidate; S1 builds the synthetic cartridge and
  its known answer; S2, S3 and S4 cover the scenario families; S5 is the closing proof; G is the
  docs-only gate PR.
- **(a) Browser rows** stay named pending: no harness loads a non-bundled artifact, and E2 adds no
  test-only browser load path.
- **(b) Gate touch.** E2 has nothing touchable, so the owner's gate check is a short report of the
  headless S5 run, not a play session.
- **(c) Early start.** S1 may start before E1 (#288) merges.
- **(d) Polish cost accepted.** During the polish phase, a mechanic change that breaks a synthetic
  answer updates that answer in the same slice.
