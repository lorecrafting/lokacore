# PM decision: B1 chapter calendar and Book status — 2026-10-05

Under the [autonomous mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md),
the PM adopts [B1](../briefs/chapter-one/b1-calendar-status-brief-2026-10-05.md) as the
M1-C consumer for the real Missing Child chapter. These are PM selections within the owner's
world-parameter and browser-first direction.

- The cartridge declares 3600 logical units per hour, 24 hours per day and 60 displayed
  subdivisions per hour; its fresh clock starts at 64800. The elapsed rate remains 50.
- The solar cuts start at 05:00 dawn, 07:00 day, 18:00 dusk and 20:00 night; night wraps to
  the first cut. The lunar cycle is 28 days, new at logical time 0, with eight consecutive
  3.5-day phases: new, waxing crescent, first quarter, waxing gibbous, full, waning gibbous,
  last quarter and waning crescent.
- Calendar fields cross the compiler and loader boundary. Schedule hours and time windows use
  the authored day. Optional sky cuts produce structured GameView status from confirmed time;
  the shared Book and CLI render it. Historical cartridges keep their existing clock behavior.
  The chapter authors the legacy gain interval while opted M2 fractional recovery keeps its
  separate `regen.every`.
- The pre-release `Calendar` and `time_window` contracts directly accept authored day lengths
  and multi-day starts. Prior fixture expectations limiting all windows to 0–23 and all starts
  to the first day were removed; current validation checks the bounds against the authored
  calendar at compile and load. This follows the owner's forward-development direction without
  adding a second calendar contract or policy leaf.
- B1 uses the existing elapsed authority, job queue, receipt and Game subscription. The
  [browser-first pause](owner-decision-web-first-mobile-pause-2026-10-05.md) rules out native
  Simulator/build proof in this slice. B2 owns deadline effects and expiry.

The active clauses are [mechanics](../system/mechanics.md#schedule1-behavior1-calendar1-mechanicsschedulerulets-kernelts-srcmechanicsschedulebehaviorts),
[protocol](../system/protocol.md#gameview), and [Book status](../system/book-ui.md#world-and-status-entry).
