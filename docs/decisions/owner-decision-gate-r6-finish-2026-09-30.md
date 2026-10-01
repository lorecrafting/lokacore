# Owner decision: what "finish" means at Gate R6 — 2026-09-30

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No
checker can verify it against the chat.

Owner (paraphrased): chose option A for the "finish" in Gate R6's airplane-mode demonstration
([14 §R6](../spec/14-implementation-plan.md#r6--offline-authority-and-save-system), Gate R6). On the
iPhone 11, a fixed tap script is played to an end state declared in advance, and the final save's
revision and world rows must equal a headless run of the same script. Finishing a real story is the
R6P gate's job, not this one.

Effect:

- [ROADMAP S6b](../ROADMAP.md#proposed-r6-slices) and its
  [runbook](../evidence/2026-09-30-gate-r6-iphone11/README.md) use that definition; the headless
  reference is in `mobile/authority/local-story/smoke.test.ts`.
