# Owner decision: fixed time, no player-driven time skips — 2026-10-03

Recorded by Codex from this session, verbatim:

> And no advancing game time, we have fixed time

## Restriction and interpretation

Player actions do not fast-forward game time. Remove the proposed instant rest-for-an-hour and
shrine retrieval time jump. Resting changes the recovery rate; it does not jump the clock or
expire penalties early. No player-selectable clock-speed or time-skip control is introduced.

**PM interpretation:** the world clock progresses at one fixed rate from elapsed time, independently
of which actions the player takes. This distinguishes normal clock progression from player-driven
advancement. The existing target of about72 real seconds per game hour comes from the
[earlier time-model decision](owner-decision-untimed-lantern-2026-10-02.md); it is not newly verified
LegendMUD timing and is not a running clock already installed in the mobile proof.

The [mechanics proposal](../design/provisional-story-mechanics.md#1-time-and-combat-pacing)
uses one clock for combat rounds, recovery ticks, scheduled events and temporary death penalties.
Its individual timings remain proposed. The later [background-time decision](owner-decision-background-time-2026-10-03.md)
supersedes background pausing: background elapsed time applies to the same clock and mechanics.
Menu/dialogue clock behavior remains a separate unapproved proposal.

The engine still needs internal logical-clock progression and its due-job processing. The existing
`time.advance` mechanism is not removed by this gameplay restriction: a later authority clock
driver uses it to represent elapsed time rather than a player-requested skip. Pure rules do not
read the wall clock, and replay still consumes explicit deterministic commands.

Installed behavior and Gate C1 scope remain unchanged. The later time-model slice must reconcile
recipe durations, player `wait`, resource timing and host clock driving in `docs/system` and the
applicable contracts before code; it must not leave an alternate command path that jumps time.
