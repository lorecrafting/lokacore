# Mechanics lessons

Verified lessons from mechanics changes. The rules live in [building mechanics by composition](../system/architecture.md#building-mechanics-by-composition) and [mechanics](../system/mechanics.md).

- Check every committed intermediate mechanic state with the real save loader and the later delivery that consumes it. In M6-A, a scheduled opponent departure between Attack and its due round committed successfully, but cold reopen rejected the save; [PR #168's review and fix](../reviews/2026-10-05-m6-a-first-live-fight-review.md) and the [SQLite regression](../evidence/2026-10-04-m6-a-first-live-fight/README.md#review-round-1-lawful-scheduled-departure) cover reopen, COMMIT reconciliation and harmless due-time completion.
- Queries used while composing one command share that command's budget across candidate evaluations. Giving each random-Flee candidate a fresh policy-query counter let total work exceed the command limit; [the controlled regression](../../kernel/ts/test/combat_flee.test.ts) exhausts `query_steps` across candidates and requires an atomic fault. PR #168 records the corrected accounting and red control.
