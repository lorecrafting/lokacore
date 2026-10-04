# Owner decision: simulator-first mechanics validation — 2026-10-04

Owner instruction, verbatim:

> No need for manual native testing for teh clock/lifecycle changes, just rely on simulator, we can defer device testing for way later

## PM interpretation and validation routing

Current mechanics use automated/headless checks and actual Simulator checks as appropriate to the consumer. Manual native or physical-device proof is not a per-mechanic publication blocker. Batch preview refreshes at playable checkpoints; each slice still delivers a real consumer, runs required per-PR checks and receives fresh independent review under the [workflow](../WORKFLOW.md). Simulator evidence must be actual, not inferred from passing unit tests.

Physical-device testing is deferred substantially later, before eventual public-release readiness; no exact date or gate is selected here. Historical C1 acceptance and device carries remain their recorded evidence/history. Future physical-proof work is routed later, not declared completed or permanently waived. This instruction supersedes an earlier guideline when it would demand manual native/device testing now; it does not remove relevant functional Simulator checks or authorize changing the owner's installation/save.

Effect: current clock/lifecycle and subsequent mechanics validation follows this routing; the [queue](../NEXT-MECHANICS.md) links it. No source, test, native build or save change is made by this record.
