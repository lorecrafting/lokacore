# Owner decision: three Gate R6 review items carried to R6P — 2026-09-30

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No
checker can verify it against the chat.

Owner (paraphrased), on the [Gate R6 review](../reviews/2026-09-30-r6-gate-review.md):

1. **Kill during actions (Astra G2).** Gate R6 accepts the headless SIGKILL fault corpus, now run
   in the phone's rollback-journal mode, plus run 2's device kills between taps. Device evidence of
   a kill in the middle of a commit is carried to R6P's device proof.
2. **`evaluation.budget_exceeded` producer (Opus G1, Astra G3).** Carried to R6P, landing before the
   compiled Lantern cartridge, beside `target_resolution@1`
   ([04 §5.4-5.5](../spec/04-command-event-effect-protocol.md#54-bounded-causality-and-durable-waiting)).
3. **`kernel.decision_latency` producer on Hermes (Astra G4).** `protocol/event_registry.json` names
   the local authority as an R6 producer; it is carried to R6P with its phone timing evidence. The
   frozen registry is not edited.

Effect: the [ROADMAP R6P row](../../ROADMAP.md#slices) owns all three carries; the R6 row's
deferral list points there.
