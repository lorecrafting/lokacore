# Q3-F fox/silent bell — independent save opinion

2026-10-05. **APPROVE** at integrated source head `f43e232a8109cfb2cdf1d4536cf63cc0623c9655`. I authored none of the source. This is the separate save opinion for A2 Q3-F; the primary implementation review owns the broader slice.

## Requirements derived before the source diff

From [Q3-F](../system/cartridge.md#q3-f-fox-and-silent-bell), [bell recovery](../system/save.md#bell-choice-return-recovery), the [A2 brief](../briefs/chapter-one/a2-q3-fox-sol-brief-2026-10-05.md), and [storage lessons](../lessons/storage.md): Silence is admitted only after a rescued/stays Q2 return with active Q3, exact actor/detail, unrung bell and unknown allegiance. It commits fox without changing Q2, child status or bell, resolves Q3/fox and starts exactly one two-line scene. The first terminal choice wins. A cold SQLite reopen must accept each lawful scene line and prior/Ring save, require the original Q2 terminal evidence and a command/actor/detail/event/row-bound Silence receipt, reject contradictory rows as typed `save_corrupt` without repair, and reconcile failed or uncertain COMMIT without early success narration or duplicate effects.

## Finding and disposition

**A2-S1 — should-fix, closed — `mobile/authority/local-story/bell-save.ts:174`.** At source commit `26348aa5`, `changed()` accepted a saved `chapel_allegiance` `fact_changed` event naming a different valid actor. In a separate clone, changing that event in a real SQLite receipt left `openStory` returning `open`, contrary to the actor-bound fox receipt contract. The integrated head binds the root allegiance and bell events to the saved actor, rejects a foreign actor on linked reaction events, and permits the legitimate omitted actor on reaction scene events. The added SQLite control rejects foreign actors on allegiance and scene events without modifying saved rows; lawful Ring and Silence reopens pass.

## Verification and simplicity

At `f43e232a`: real rollback-journal bell/save tests 13 passed, kernel bell tests 7 passed, and app chapter/pin tests 5 passed. These include rescued/stays cold reopens at both silent-scene lines and end, prior/lost preservation, cross-row corruption, exact replay, failed COMMIT and lost acknowledgement. In the separate clone, removing the actor predicate made the new foreign-actor test fail (`open` versus `save_corrupt`); the source was restored and the focused test passed. Earlier, removing the fox receipt requirement made the existing missing-receipt test fail the same way. No developer worktree or owner save was edited. Native checks remain paused by the owner decision.

Ponytail Review: **Lean already. Ship.** The fix adds one predicate at the existing receipt boundary; no unnecessary abstraction found. No open save finding.
