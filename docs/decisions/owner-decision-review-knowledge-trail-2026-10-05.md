# Owner decision: retain review knowledge for future mechanics

The owner said during Beads migration planning on 2026-10-05:

> keep in mind that we would love to keep some important history of the project for example issues that surfaced in reviews etc as a substrate or data to build better mechanisms system or layers if possible, or to cross reference if  you think that's a good idea, or to accumulate things like book-ui spec or whatever else

Interpretation: retain important review history as cross-referenceable evidence for
later mechanics, system layers and Book UI rules. This does not adopt Beads.

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
