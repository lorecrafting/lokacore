# Review: loka-8mm world time starts at first entry (PR #323)

- PR #323, exact head `849ae3290d1a39a357dd5a5c803c7d05e3fcb0c0`, base `origin/main` (`c66efda9`).
- Reviewer: fresh independent Opus. Second opinion on save/reopen runs separately.
- Governing: [mechanics.md D11](../system/mechanics.md#d11-character-choice-selected-contract)
  (:43-44, :303) and M1-A (:584); [save.md](../system/save.md) M1-A (:229) and Durable elapsed
  sessions; [protocol.md](../system/protocol.md) Step order item 5; [book-ui.md](../system/book-ui.md)
  D11 (:458); [owner-rules.md](../system/owner-rules.md):44; superseded
  [2026-10-06 ruling](../decisions/owner-decision-d11-prechoice-elapsed-2026-10-06.md);
  [WORKFLOW Review stance](../WORKFLOW.md).

## Verdict: APPROVE

## Must be true (written before reading the diff)

1. On a cartridge with `ancestries` and no selection, `stepElapsed` refuses `invalid_state` with
   the world unchanged; malformed, foreign-context and wrong-id commands keep their old codes.
2. Without `ancestries` nothing changes.
3. One predicate decides "needs selection" for Step, ActionSet refusal and `stepElapsed`.
4. The driver credits no wall time before selection, on active pulses, across close/reopen and
   during unpulsed dwell; it does not fault on the picker; credit starts at the choice.
5. Old saves: explicit refusal, no clamp, migration or compatibility code; PR states it.
6. Spec amended in the same PR; old ruling marked superseded; designer sentence verbatim.

## Checks

- 1: gate at `kernel/ts/src/runtime/world.ts:171`, after validate, `identity` and command id,
  before owner lookup. 2, 3: `needsAncestry` (`actions.ts:55`) is false without `ancestries`; used
  by `step` (`world.ts:125`), `refusal` and `ClockDriver.capture` (`elapsed.ts:110`).
- 4: `capture` sets `d = 0` while selection is pending; `accounted(old, 0, …)` keeps target and
  re-anchors wall; `reserve` → `capture('active')` → `drain` persists the anchor before the choice
  commits. Book: Catching up only shows when target > clock (never on a new picker); `Fault` with
  Start over renders outside the picker gate (`Book.tsx:192`).
- 5: diff adds no compatibility code; PR body and decision record state case (a) `save_corrupt`
  for every v042 save with a pre-choice receipt, and case (b) "Time stopped: invalid_state".
- 6: all brief spec edits present; book-ui sentence matches the designer text; protocol anchors
  (`world.ts:114, :146, :162, :179, :207`) verified on the head.
- Tests: expected values literal (`68400`, `64800`, `64800 + 3000`); no fixtures or frozen answers
  touched; the removed movement assertion is still covered by the next test (`character_choice.test.ts:118-127`).

## Red controls (narrow, this head; logs `pr323-mutants.log`, `pr323-m3c.log`)

| Mutant | `character_choice.test.ts` | `r9c_elapsed_jobs.test.ts` (mobile) |
|---|---|---|
| Delete kernel gate line | red (accepted vs `invalid_state`) | green |
| Gate moved before validate/identity | red (`invalid_state` vs `not_found`) | n/a |
| Drop `needsAncestry` from driver `d` | green | red (`fault invalid_state` vs `ready`) |

Unmutated head: kernel 7/7, mobile 4/4.

## Findings

None.
