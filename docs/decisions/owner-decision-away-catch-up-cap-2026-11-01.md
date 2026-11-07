# Owner decision: away catch-up is capped — 2026-11-01

Written 2026-11-01 by the developer of Beads `loka-qhvgq`, from the PM's relay of the owner's answers.
The owner's words are paraphrased.

Owner, 2026-11-01 (paraphrased): the world catches up at most a short stretch however long the player
was gone, and the rest is skipped. The default is one in-game day; a cartridge may set a different cap.
A long open session must not be affected. Old saves may Start over before launch: no upgrade path, and
save migrations stay on the release list. Measure before pruning job rows, and drop pruning if cold open
is fast at a month, three months and a year with the cap alone. The goal is under about 3 s, and bounded
save growth, at any absence.

## Effect

[Durable elapsed sessions](../system/save.md#durable-elapsed-sessions) states the cap and how a skipped
span is recorded; `time_policy.away_cap_hours` is the cartridge's setting.
