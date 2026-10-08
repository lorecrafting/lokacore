# Review: loka-8mm world time starts at first entry (PR #323)

- PR #323, exact head `849ae3290d1a39a357dd5a5c803c7d05e3fcb0c0`, base `origin/main` (`c66efda9`).
- Reviewer: fresh independent Opus. Second opinion on save/reopen runs separately.
- Governing: [mechanics.md D11](../system/mechanics.md#d11-character-choice-selected-contract)
  (:43-44, :303) and M1-A (:584); [save.md](../system/save.md) M1-A (:229) and Durable elapsed
  sessions; [protocol.md](../system/protocol.md) Step order item 5; [book-ui.md](../system/book-ui.md)
  D11 (:458); [owner-rules.md](../system/owner-rules.md):44; superseded
  [2026-10-06 ruling](../decisions/owner-decision-d11-prechoice-elapsed-2026-10-06.md);
  [WORKFLOW Review stance](../WORKFLOW.md).

## Verdict: APPROVE WITH NOTES

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
- 5: diff adds no compatibility code. Case (a) code path: `liquid-save.ts:20-30` replays
  receipt history whenever the content has knowledge, water, population or services (v042 does),
  so every v042 save with a pre-choice receipt hits `receipt-history.ts:18-20` `SyntaxError`; open
  catches it at `authority.ts:104-107` and returns `save_corrupt` through `refuse`
  (`authority.ts:79`, adds only `newGame`, writes nothing); `SaveError.tsx:8,24` shows "damaged"
  with Start over. Case (b): "Time stopped: invalid_state" beside Start over. Both stated in the PR.
- No Elixir counterpart: `lib/` holds the content compiler only; `stepElapsed` and `ClockDriver`
  exist in TypeScript alone.
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
| Drop `capture('active')` in `ClockDriver.reserve` | n/a | red (`97800` vs `67800`) |
| Gate moved between `identity` and command-id check | green (also kernel `elapsed.test.ts`) | n/a |

Unmutated head: kernel 7/7, mobile 4/4.

## Findings

- **nit** `kernel/ts/test/character_choice.test.ts:86`: only the foreign-context `not_found`
  pins the gate order. Moving the gate between `identity` and the command-id check stays green, so
  a regression where a forged wrong-id elapsed before selection returns `invalid_state` instead of
  `permission_denied` would pass. The brief asked for one assertion, so not blocking; one more
  `deepEqual` with a wrong `id` would close it.

## Open item (owner-facing, not blocking)

- The brief's case (a) "plain reopen opens cleanly" does not occur on chapter one v042: effectively
  every existing chapter-one device save that showed the picker under the old build now opens as
  `save_corrupt`. Permitted by the forward-development policy and stated plainly in the PR and the
  decision record; the PM should carry it to the owner.
