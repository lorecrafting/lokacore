# Owner decision: the Lantern has no wait and no schedule; the game clock stays — 2026-10-02

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

- **The Lantern has no wait and no schedule.** Bram stays at the landing. The proof is bringing
  Bram the lantern. Waiting as a player action (the phone's Wait page and buttons) waits for a later
  time-model slice.
- **The game clock stays.** The phone's status line keeps HH:MM, and time is kept for later uses
  such as environmental effects.
- **Target rate for that later slice:** LegendMUD's tick, from an owner-supplied summary that was
  not checked against LegendMUD's own `help time`. One game hour is about 72 real seconds (one tick;
  the Diku/Merc lineage uses 60-75 s), so one 24-hour game day is about 28.8 real minutes (about 50
  game days per real day). The real-time clock is that later slice, not this one.
- **The engine does not change.** `wait`, schedule@1, calendar@1 and the due-job drain stay in the
  kernel as they are.

Effect: [pre-release-proof](../spec/pre-release-proof.md#concrete-proof-the-ferrymans-lantern) and
[ROADMAP](../ROADMAP.md) R6P row (slice Untime) and the R7/R8 for chapter one row (the time model).
