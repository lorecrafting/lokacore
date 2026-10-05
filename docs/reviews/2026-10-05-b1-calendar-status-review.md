# B1 calendar and truthful status — independent review

Reviewed head `8efa48bce268c03ed393ca80c43f5c0e849e2957`, base `abb92527`.
PR number: pending. Fresh reviewer; authored none of the implementation.

**Verdict: APPROVE WITH NOTES.** No open correctness findings.

## Requirements derived before the diff

The [B1 brief](../briefs/chapter-one/b1-calendar-status-brief-2026-10-05.md),
[PM decision](../decisions/pm-decision-b1-calendar-status-2026-10-05.md), and active
[mechanics](../system/mechanics.md#schedule1-behavior1-calendar1-mechanicsschedulerulets-kernelts-srcmechanicsschedulebehaviorts),
[protocol](../system/protocol.md#gameview), [Book](../system/book-ui.md#world-and-status-entry),
and [save](../system/save.md) clauses require:

- Cartridge units determine day/time, schedule hours and half-open wrapping windows; jobs
  remain strictly next. Invalid calendar cuts, arithmetic and out-of-day references refuse
  at compiler and loader boundaries. Historical cartridges retain their installed clock.
- Confirmed GameView time determines authored solar/lunar status; the Book and CLI display it
  without advancing time on render. Absent optional sky data yields no invented phase.
- The chapter's start, elapsed rate, M2 fractional recovery, durable save/refusal behavior,
  current release pin and independent fixture answers remain coherent.

The schedule and policy changes consume one validated cartridge calendar; resource gain
uses its authored interval while opted fractional recovery keeps its own interval. No
chapter-specific rule was added to kernel mechanics.

## Verification and notes

- Focused TypeScript calendar/schedule tests: 21 passed. Focused Elixir calendar/resource
  tests: 3 passed; existing ferry/chapter compiler tests: 17 passed. Mobile chapter host and
  real SQLite bell/reopen tests: 12 passed.
- In a separate temporary clone, changing the inclusive phase test `cut.at <= at` to
  `cut.at < at` made `kernel/ts/test/calendar.test.ts` fail at the controlled cut and the
  chapter's 18:00 dusk cut. The reviewed source was untouched.
- **Ponytail nit B1-N1:** `lib/loka/content/compiler.ex:54` adds a single-use
  `final_checks` wrapper for the prior inline Position/Scenes expression. Inline it when
  convenient; about three lines can be removed. This has no behavioral effect.
- This review did not independently rerun `bin/check_all.sh`, the full schema mutant sweep,
  CI, or browser status interaction. Those remain separate PM/developer gate evidence.
  No native, device, owner-save or publication operation was performed.
