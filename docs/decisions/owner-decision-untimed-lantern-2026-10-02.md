# Owner decision: the Lantern has no wait and no schedule; the game clock stays — 2026-10-02

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

- **The Lantern has no wait and no schedule.** Bram stays at the landing. The proof is bringing
  Bram the lantern. Waiting as a player action (the phone's Wait page and buttons) waits for a later
  time-model slice.
- **The game clock stays,** and time is kept for later uses such as environmental effects. The
  phone's status line shows it as an earthly branch (below), not HH:MM.
- **Target rate for that later slice:** LegendMUD's tick, from an owner-supplied summary that was
  not checked against LegendMUD's own `help time`. One game hour is about 72 real seconds (one tick;
  the Diku/Merc lineage uses 60-75 s), so one 24-hour game day is about 28.8 real minutes (about 50
  game days per real day). The real-time clock is that later slice, not this one.
- **The engine does not change.** `wait`, schedule@1, calendar@1 and the due-job drain stay in the
  kernel as they are.

Later the same day the owner added (paraphrased):

- **The status line shows the double hour's earthly branch,** its glyph only, in place of HH:MM,
  on the traditional boundaries: 子 23:00-01:00, 丑 01-03, 寅 03-05, 卯 05-07, 辰 07-09, 巳 09-11,
  午 11-13, 未 13-15, 申 15-17, 酉 17-19, 戌 19-21, 亥 21-23. The accessibility label is English,
  for example "Hour of the Rabbit, five to seven" (Rat, Ox, Tiger, Rabbit, Dragon, Snake, Horse,
  Goat, Monkey, Rooster, Dog, Pig). Presenter only: the engine clock is unchanged.
- **The day follows the 60-day sexagenary cycle** (heavenly stem with earthly branch); game day 0
  (a new game) is 甲子. It is not shown now; a later status pane shows it, and its mapping is
  written then.

Effect: [pre-release-proof](../spec/pre-release-proof.md#concrete-proof-the-ferrymans-lantern) and
[ROADMAP](../ROADMAP.md) R6P row (slice Untime) and the R7/R8 for chapter one row (the time model).
