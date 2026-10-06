# C4 pack response/flight — provisional save/protocol second opinion

**CHANGES REQUIRED.** Independent reviewer authored none of C4.

- Exact source: `252eb45624a27d5eb90c89a2eff7159e09f9b613`.
- Evidence head: `11fa757947061b4fa077847d85c3a05b1cb100cf`.
- Base: published C3 `1b269871275c900343f9e2dcfcadc5c856880589`; this is provisional v029/API1.25 work, not a successor publication approval.
- Governing [brief](../briefs/chapter-one/chapter-one-c4-hound-behavior-brief-2026-10-05.md), [mechanics](../system/mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract), [protocol](../system/protocol.md#c4-pack-encounter-and-flight-composition), [save](../system/save.md#c4-pack-and-flight-recovery), [Book](../system/book-ui.md#c4-pack-response-and-enemy-flight-details), [storage lessons](../lessons/storage.md), [contract lessons](../lessons/contracts.md) and [workflow](../WORKFLOW.md#review-stance).

## Required behavior

Attack admits exact bounded co-present current-generation members once. One
selected opponent rotates per occurrence; live members cannot disappear or rejoin
without legitimate intervening evidence. Wounded flight binds the selected hound,
legal departure, threshold, generation and actual round clock; it retains the
same pelt. Same-clock population dispatch preserves that flight in either real
job-ID order. Custody, flight slot, encounter, jobs, HP/RNG, head and receipt commit
atomically. Cold recovery/retry accepts lawful history and refuses contradictory
current rows or receipt chains without writing bytes. Final release answers await
D1 integration and independent re-pin.

## Findings

| ID | Severity | Exact-source location | Controlled failure |
| --- | --- | --- | --- |
| C4-S1 | blocker | `kernel/ts/src/foundation/creation.ts:158`; `kernel/ts/src/runtime/invariants_creation.ts:116`; Elixir creation/independent twins | A fresh current slot2 hound at HP8 with no encounter is transferred from home to its area neighbor and assigned `last_flight_at=64800` in the same group, retaining generation1/member/no replacement. Both final composers accept and both independent observations return true; final TS runtime `apply` adopts the invented flight. The exception to C3's complete-birth guard proves only one transfer, origin and pack metadata, without selected encounter/round/flight authority. Bind the final stamp exception to an actual flight occurrence and reject the standalone shape. |
| C4-S2 | blocker | `kernel/ts/src/foundation/compose.ts:218`; `kernel/ts/src/foundation/creation.ts:175`; independent and Elixir twins | In real SQLite, Attack slot2 then elapsed64800→64950 rotates to wounded slot4. Elapsed64950→65100 flies slot4 legally; identical input ending65101 returns `evaluator_error`, preserving the old state. Both portable composers reject the successful flight operations followed by a lawful time.advance65100→65101 with encounter `precondition_failed`. Departure/slot proof compares the flight stamp with the whole proposal's final horizon instead of the actual occurrence clock, rejecting a lawful flight before the elapsed endpoint. |
| C4-S3 | should-fix | `docs/evidence/2026-10-06-c4-hound-behavior/README.md:20` | The frozen evidence tree contains only this README, although it says the failed broad gate is retained and lists restored red controls. There are no raw check/control logs or hash manifest at this evidence head. Retain and hash actual outputs, or accurately mark them unavailable; this reviewer cannot verify the claimed retained run or mutation failures. |

All three are open. The developer was sent both portable controlled inputs and
the real-SQLite reproduction. Source was not edited during this review.

## Independent checks

- **39 TS/kernel/SQLite/Book tests** and **seven Elixir foundation tests** pass,
  including literal foreign-plan, live-drop, wrong-cursor and stale-rejoin refusals.
  The new S1/S2 controls expose gaps those existing tests do not catch.
- **18 additional independent disk-backed forgeries** return `save_corrupt` with
  unchanged bytes: roster deletion/rejoin, primary/cursor, generation, flight
  clock/future clock/custody, pelt custody, current round job, receipt actor/context/
  run/command identity, flight transfer/slot/group and RNG.
- **12 real COMMIT/connection-close/reopen/retry probes** pass: Attack and actual
  flight, plus the equal-time flight/population boundary in both naturally
  allocated job orders, each with definite deferred-constraint failure, uncertain
  absent outcome and committed-but-lost acknowledgement. Memory stays old while
  pending, another input is fenced, disk recovers all old/all new, and exact replay
  changes no rows or receipt count. Same-clock flight retains its original pelt
  and leaves the active roster once.

Ponytail/correctness review: existing encounter/job, population slots and changed-row
receipt transaction suffice; no extra framework is requested. Fix the two missing
proof boundaries and retained-evidence claim. Published D1 integration, successor
release/hash/ID answers, final schema controls/full gate and scoped save carryover
remain later gates. No native, browser preview or owner save was used.
