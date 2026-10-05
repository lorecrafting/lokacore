# A3 Green finale — primary independent review

Local draft PR `chapter-one/a3-green-finale`; base `ec3ab73d`, source commit
`9327b56e`, exact integrated head reviewed
`6a8be6d157d4287148673c36e8c546022534adc1`.

**Verdict: CHANGES REQUIRED.** Authored none of the reviewed source.

## Derived requirements

- [A3 cartridge contract](../system/cartridge.md#a3-green-finale-planned): one voluntary
  detail-backed Begin for each of five legal actor-owned pairs; acknowledged matching
  bell; no automatic start or early exports.
- [Scene contract](../system/mechanics.md#scene1-mechanicsscenerulets) and
  [bound Continue](../system/protocol.md#actionset-and-admission): scene and shown line
  bind every current Continue, including direct commands; exact replay keeps its receipt.
- [Green recovery](../system/save.md#green-finale-recovery-planned-a3) and
  [Book flow](../system/book-ui.md#chapters-scenes-and-recovery): final acknowledgement
  atomically ends the scene, stores the literal memories/marker and one local report;
  lawful intermediate saves reopen observationally and UI confirms only saved state.

## Findings

**A3-P1 — blocker — current bell scenes retain unbound Continue.**
`kernel/ts/src/mechanics/scene/rule.ts:14` only checks the binding for action-started
scenes or when either input field is present; `protocol/command.schema.json:551`
still requires only `type` and `actor_id`. On the bundled v0.0.17 lost/prior route,
after Ring shows bell line 1, fresh commands `{type: "continue", actor_id}` advance
1→2→3 without observing the new line. Shared Command validation reports zero errors.
The same bypass can acknowledge the bell end and make Begin eligible. This contradicts
the [brief](../briefs/chapter-one/a3-green-finale-sol-brief-2026-10-05.md)'s closed
bound shape and retirement of development-only empty-input compatibility. Require
both fields for every live Continue, update actual callers, and add a current bell
regression that rejects fresh unbound input without changing the saved line.

## Verification and simplicity

- Focused kernel/authority scene, chapter and finale tests: **14/14 pass**; five
  kernel routes and lost/prior real-SQLite finale line/end reopen included.
- Book model, live-actions and presenter tests: **32/32 pass**. Traced the actual
  detail recipe, bound Button input, ScenePage precedence and chapter transition.
- Independent throwaway-worktree mutation removing completion-marker assignment:
  both new finale behavior tests fail (chapter remains 0; SQLite reopen is
  `save_corrupt`). Restored source: **3/3 pass**; throwaway worktree removed.
- Separate read-only controlled v0.0.17 route confirms A3-P1 above. Existing focused
  green tests do not detect its non-action-scene omission path.
- Ponytail Review: **Lean already. Ship.** No complexity findings. Correctness
  verdict remains CHANGES REQUIRED.

Native/browser acceptance and full publication checks are not claimed here. The
separate save/protocol opinion owns additional receipt-corruption review findings.
