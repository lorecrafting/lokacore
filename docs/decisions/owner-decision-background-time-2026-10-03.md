# Owner decision: backgrounding does not pause the world — 2026-10-03

Recorded by Codex from this session, verbatim:

> Wait, lets not pause while backgrounded, because we want players to get used to the online version

## Decision and interpretation

Backgrounding the offline Story app does not pause its fixed-rate world clock. This supersedes the
background-pause recommendation in the [mechanics proposal](../design/provisional-story-mechanics.md#1-time-and-combat-pacing).
The purpose is to prepare players for the continuously running online world.

**PM interpretation:** combat, recovery, status durations, temporary death penalties and scheduled
NPC/world events all follow that same elapsed time. A character resting in safety can recover;
a character left in combat can take damage or die. Backgrounding grants no escape or immunity.

Mobile platforms can suspend app execution. This decision specifies gameplay continuity, not a
promise that code executes every second while suspended. On resume the future authority must
resolve the elapsed interval through the same ordered rules before admitting a new player action.
It must preserve intermediate damage, death and subsequent eligible recovery rather than simply
move the clock to the end and evaluate the final state. Elapsed time cannot be credited twice
across save/retry or another resume.

The [fixed-time restriction](owner-decision-fixed-time-2026-10-03.md) still forbids player-driven
skips. Resuming represents time that actually passed; it is not a skip command. The timing values,
menu/dialogue pause policy and treatment of a fully terminated app are not approved by this quote.
The proposal recommends keeping menus/dialogue on the running clock as well, pending that decision.

This is a requirement for the later time-model slice, not installed mobile behavior. That slice
must reconcile elapsed-time authority, persistence, due-job ordering and bounded catch-up in
`docs/system` and the applicable contracts before code. It does not expand Gate C1 scope.
