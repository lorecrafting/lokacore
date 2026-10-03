# Owner decision: P1 merges on Node; its iPhone 11 Hermes run is batched — 2026-09-30

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No
checker can verify it against the chat.

Provenance: the PM settled this sequencing earlier on 2026-09-30, as
[ADR-074 §3](adr-074-ts-first-proposal.md#3-the-proposal) allows (a device sample runs at R6P). The
owner's resume message the same day restated it and told the PM to put the ROADMAP P1-row
amendment in the P1 PR.

Owner (paraphrased): P1 merges on its Node proof; the iPhone 11 Hermes run is batched and must
pass before S3 merges (Gate R6 at the latest); S1 does not wait for it.

Effect:

- The [ROADMAP P1 row](../ROADMAP.md#proposed-r6-slices) carries this sequencing. Related records:
  the [R6 plan record](owner-decision-r6-plan-2026-09-30.md) and the
  [one-phone decision](owner-decision-android-descope-2026-09-30.md). It keeps
  [ADR-074 §3](adr-074-ts-first-proposal.md#3-the-proposal)'s Node-plus-device host conformance;
  only its timing changes.
