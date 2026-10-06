# Owner decision: C2 staged browser proof — 2026-10-05

Owner clarification (paraphrased): Web remains the active development and
playtesting surface until the game is complete; mobile follows later. Native
verification remains deferred under the existing
[mobile pause](owner-decision-web-first-mobile-pause-2026-10-05.md).

The [fresh C2 Book proof](../evidence/2026-10-05-c2-watchmans-rounds/README.md#fresh-shared-book-proof-and-open-gaps)
records Start, leader-only departure, player join, explicit pause/Rejoin, committed
success narration, resolved checkpoint Journal and a fresh-save cold reopen.
That focused interaction evidence is accepted at C2 slice scope. Actual five-rat
combat left the player alive at 6/10 HP, so **browser death/Restart remains a gap**,
not a successful fatal-recovery route. Close it in the Chapter 1 E3 browser walk,
or sooner if practical, before the
[chapter closure loop](owner-decision-chapter-closure-e2e-loop-2026-10-05.md) closes.

Actual fatal attempt reset, shrine return, immediate Restart and cold reopen are
proved separately by existing real-host SQLite tests. They do not claim browser,
native or Hermes UI verification.

The preserved terminal browser save still times out during Web SQLite startup.
That issue remains **open pending the separate Web SQLite fix**; it is not skipped
permanently, and its save has not been reset or repaired. This decision does not
claim the save reopens or the worker limit is fixed. C2 gameplay and reviewed source
are unchanged; only the staging of the
[Book UI proof](../system/book-ui.md#c2-watch-patrol-details) is amended.
