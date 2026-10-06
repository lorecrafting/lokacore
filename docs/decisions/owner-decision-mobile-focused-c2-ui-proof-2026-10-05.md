# Owner decision: mobile-focused C2 UI proof — 2026-10-05

Owner instruction: “if not mobile skip it.” Apply that direction to C2
Watchman’s Rounds verification; avoid further web-only SQLite overflow/stress work
or repeated browser fatal setups that do not help the mobile product.

The C2 browser gate covers shared Book Start, leader-only departure, player join,
explicit pause/Rejoin, committed success narration, resolved checkpoint Journal
and a fresh-save cold reopen. The
[fresh browser proof](../evidence/2026-10-05-c2-watchmans-rounds/README.md#fresh-shared-book-proof-and-scoped-deferrals)
closed those interactions. Actual five-rat combat left the player alive at 6/10 HP;
browser death/Restart remains unproved and is not counted as a successful route.

Actual fatal attempt reset, shrine return, immediate Restart and cold reopen remain
proved by the existing real-host SQLite tests. Native fatal/Restart UI verification
is deferred until the owner resumes the
[mobile verification lane](owner-decision-web-first-mobile-pause-2026-10-05.md).
No native or Hermes proof is claimed by browser/headless checks.

The preserved terminal browser save still times out during web SQLite startup.
That web-only history/worker issue remains explicitly deferred; its save was not
reset or repaired, and this decision does not claim it reopens or the worker limit
is fixed. The C2 gameplay contract and reviewed source are unchanged. This record
amends only the C2 browser verification clause in
[Book UI](../system/book-ui.md#c2-watch-patrol-details).
