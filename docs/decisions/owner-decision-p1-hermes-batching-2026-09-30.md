# Owner decision: P1 merges on Node; its iPhone 11 Hermes run is batched — 2026-09-30

Relayed by the PM (Claude Code) from the owner's 2026-09-30 resume message, **(paraphrased)**:
the wording is smoothed, not quoted. No checker can verify it against the chat.

Owner (paraphrased): P1 may merge on its Node proof. Its iPhone 11 Hermes run is a batched
device step, done later, that must pass before S3 merges. S1 does not wait for it.

Effect:

- The [ROADMAP P1 row](../ROADMAP.md#proposed-r6-slices) carries this sequencing. It builds on
  the [R6 plan approval](owner-decision-r6-plan-2026-09-30.md) and the
  [one-phone decision](owner-decision-android-descope-2026-09-30.md), and keeps
  [ADR-074 §3](adr-074-ts-first-proposal.md#3-the-proposal)'s Node-plus-device host conformance;
  only its timing changes.
- If the Hermes run fails, rework is expected to be limited to P1 and S1/S2.
