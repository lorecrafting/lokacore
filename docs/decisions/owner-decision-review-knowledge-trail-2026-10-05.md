# Owner decision: retain review knowledge for future mechanics

The owner wants important project history, including issues found in reviews, kept
as cross-referenceable evidence for later mechanics, system layers and Book UI rules.
This is a paraphrase of the owner's 2026-10-05 direction during Beads migration
planning, not a decision to install Beads.

Keep the original review finding and its disposition in the reviewed Git record.
When it reveals a lasting behavior rule, update the owning active specification
(including `book-ui.md`) and link back to the finding. When it reveals a recurring
implementation hazard, add a concise area lesson with its evidence link. When a
deterministic check can prevent recurrence, encode and red-control that check. Track
unfinished work with a link to the originating record, whether the task tracker is
the current roadmap or a later adopted tool. Do not duplicate full review text in
the task tracker or turn every one-off finding into a general rule.

The [delivery workflow](../WORKFLOW.md#review-knowledge-trail) owns the handoff step;
review records and their [index](../reviews/README.md) remain the historical source.
