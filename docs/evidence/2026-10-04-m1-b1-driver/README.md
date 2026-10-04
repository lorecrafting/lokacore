# M1-B1 developer evidence — 2026-10-04

Developer-observed evidence for the [adopted B1 policy](../../decisions/pm-decision-m1-b1-durable-elapsed-2026-10-04.md) and [brief](../../briefs/m1-b1-clock-driver.md), based on reviewed M1-A merge `78425930581cede4ebfe8269beff66dac193734e`. This is author evidence, not independent review, CI or a merge claim.

## Behavior and actual storage

`focused-green.log`: `mise exec -- node --test mobile/authority/local-story/elapsed-driver.test.ts mobile/authority/local-story/faults.test.ts mobile/authority/local-story/observe.test.ts` passed **47 tests**. Controlled sessions use the existing ferry fixture with a test-only elapsed profile, rate 50 and start 64800, plus actual rollback-journal node:sqlite.

- Literal safe-boundary accounting, reopened 9ms + 11ms fractional accounting, backward-wall rebase, retained debt, ordered recurring boundaries, bounded turns, fixed input horizons, initial freshness and semantic departed-speaker refusal/Leave.
- Actual clocks initialize a same-pin v1 account without earlier credit; missing clocks refuse; malformed v2 rows/heads, including unsafe SQLite int64 values, refuse without replacing progress.
- Genuine deferred-FK failed COMMIT, successful COMMIT with lost acknowledgement and actual unavailable-table read errors, real SQLITE_FULL, and before/after-COMMIT subprocess SIGKILL. Assertions inspect checkpoint/head/receipt as wholly prior or next and verify reopen does not duplicate elapsed or lose debt.
- Closed metadata and gameplay witnesses distinguish terminal same-run checkpoint corruption from a real valid replacement. Last confirmed projection stays blocked; old input/clock cannot overwrite the replacement. Explicit Start over first proves transaction closure.
- A real committed local elapsed trace followed by an ordinary command replays byte-identically through the actual CLI. Record/header and elapsed/header run mismatches fail before execution. Ordinary measured=false player dispatch still refuses elapsed.

After that focused run, extending the existing timer/receipt case exposed a completed reservation remaining held. Its old suite still passed and its new assertion failed. The one-line release applies only to the matching valid receipt after durable-run checking; `reservation-restored.log` records the targeted case passing. The final normal pre-push and exact source CI validate the complete candidate separately.

## Mutation gap audit

[mutations.json](mutations.json) records **23 distinct controls**, their old exit 0/new exit 1 and the planted changes. Each programmatic mutation was tested against old same-layer tests before its new assertions and restored from saved bytes in `finally`. The last two controls are actual implementation gaps: the reservation bug above and a corrupted singleton key admitted when row count alone was checked. The existing malformed-row case now covers the latter using actual SQLite ignore_check_constraints; singleton-restored.log records its passing targeted run. Raw old/new outputs are retained; earlier runs precede final formatting and subsequent independent fixes. The final [source manifest](source-restored-sha256.json) records candidate bytes, not a claim that every earlier control used identical final bytes.

The controls cover unsafe product arithmetic, dropped fraction/debt, unlimited turns, skipped due boundaries, self-stale input, detached checkpoint writes, retry resampling, missing clocks, explicit-v2 target preservation, corrupt-as-pending, replacement misclassification, replay run binding, gameplay run/witness checks, private input/conflict, invalid evidence/remainder/wall/revision validation reservation release and singleton-key validation.

## Required observation schema sweep

[schema-sweep.json](schema-sweep.json): baseline existing examples and frozen invalid fixtures pass. Removing one required entry/type/bound at a time from cloned generated observation definitions gives **244 controls: 161 detected, 83 surviving**. Survivors comprise **56 inherited type removals** and **27 redundant discriminator-required entries** also checked by oneOf. No min/max/pattern/const/enum removal survives. This is runtime fixture-oracle detection; it makes no generator-mutant or full inherited type-coverage claim.

ReplayIds validation is unchanged; only its description is clarified. Normal `elixir bin/contracts.exs` and `elixir bin/features.exs` pass. No schema constraints/fixtures, extra validation tests or schema checker are added.

## Author reviews and limits

Ponytail Review: no removable machinery remains. One local driver uses existing receipts, transaction/fence handling, trusted stepElapsed and changed-row adoption. Small helper splits satisfy existing file/function caps; no dependency, configurable scheduler, event bus or whole-world copy/encoding is added. Correctness review fixed terminal completion status, gameplay closed-witness run/checkpoint checks, completed reservation release, singleton-key validation and unused imports.

B2 still owns actual lifecycle/UI/sampler consumption. No native compatibility/device proof, owner save, resource/calendar algebra, proposal cancellation change, broad trace migration or M1-B completion is claimed. Arithmetic uses exact checked Number decomposition without reducing the accepted safe profile.

Retained outputs are redacted before hashing. `SHA256SUMS` and its verification are beside the artifacts; neither hashes itself. Existing `docs/evidence/** -whitespace` protects their bytes.

## Final publication check correction

The first normal pre-push passed the nonmobile checks and failed the existing smoke test that still used v2 as an unsupported future save. Its input now uses v3, preserving the literal unsupported/no-reset assertions; the targeted case passes (`future-format-restored.log`). Remaining v2 test mentions are actual supported-format expectations. `prepush-first-failure.log` retains the real failure; a normal final pre-push rerun is required. No hook bypass or runtime relaxation was used.
