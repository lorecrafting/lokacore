# Owner decision: a status on a seen NPC says a line — 2026-10-21

Written 2026-10-21 in Claude Code by anthropic/claude-opus-5-5 (developer).

## Decision

- Owner (AskUserQuestion, 2026-10-21, quoted): "Line now, page later (Recommended)". A status that
  first lands on an NPC the player sees in the same room tells one line in the log now; showing the
  NPC's conditions on its page is later work (`loka-x6t.70`).
- PM ruling on the same row (paraphrased): the line is opt-in. A status declares
  `narration.observed`, a line about the NPC; without it an NPC holder stays silent, as before. The
  applied line keeps speaking to the player ("The frost bites through your clothes."), so the kernel
  never says it for an NPC; a status only an NPC ever holds (the showcase golem's) may point
  `observed` at its applied key.
- Items stay silent. Tick and expiry lines stay the player's own.
- Beads: `loka-kgd.176`. Spec: [row G3](../system/mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3).
