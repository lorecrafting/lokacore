# Owner decision: live polish sessions in Storybook — 2026-10-09

The PM proposed a faster loop for polish: the owner's Storybook serves a session branch, and each
owner prompt is applied at once. Owner's words, 2026-10-09 (source: Beads loka-x6t):

> i like your faster process for tweaking the live polish session.  Okay go for it!

> instead of queue or clipboard lets see if we can make a faster process one where everytime i put in a prompt in the tool, you immediately tweak it and fix it, adn then a button to 'close batch' or whatever, for the fuller review etc, and maybe even a way for you to suggest that its time to close the batch, be liberal with batch sizes since we are in pre production, only stop batch when critical things or complexity is  way too much

The owner also asked for an own Tidewave-like element picker to replace Tidewave, with screenshot
baselines later (Beads loka-x6t.3). On models the owner added, 2026-10-09 (paraphrased): use a
lower model for small nits and Fable for overall design; the PM decides.

## Effect

- The [live polish session](../WORKFLOW.md#live-polish-session) lane: the designer writes the
  style code during the session, the owner's approval there is the design review, and "Close
  batch" sends the batch to one Opus reviewer quick pass and the pre-push hook before the PM merges.
- PM ruling on models: the PM classifies each picker prompt as a nit (designer on Sonnet) or a
  design item (designer on Fable), as the lane describes.
- `bin/polish_session.sh` and `bin/preview_update.sh` switch the owner's Storybook between the
  session and the preview checkout ([web preview](../web-preview.md#storybook)).
