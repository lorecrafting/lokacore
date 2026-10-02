# Owner decision: condition bands for resources (slice G) — 2026-10-01

Relayed by the PM (Claude Code) from the owner's chat, **(paraphrased)**: the wording is
smoothed, not quoted. No checker can verify it against the chat.

Owner (paraphrased): use LegendMUD's health-condition scale, many named bands by percentage of
the maximum, MUD-style, in place of the three placeholder bands `hale`, `hurt`, `badly_hurt`.
Of the drafted tables, take option A, as a tribute to LegendMUD; credit it, but never use the
LegendMUD name in the UI or branding.

PM rulings, the owner not objecting:

- The spec fixes the one band table and the kernel computes the band; cartridges do not declare
  thresholds. The table lives only in [04 §15](../spec/04-command-event-effect-protocol.md#15-portable-game-view-projection) (amendment 2026-10-01).
- p is measured from the resource's minimum, not from 0 (the same for every pool today, whose
  minimum is 0).
- Every resource carries a band; the UI shows the band's phrase on hp only and colours every
  resource by its band (a reversible UI choice).
