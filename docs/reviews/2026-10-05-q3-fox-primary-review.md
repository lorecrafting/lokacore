# Q3-F fox/silent bell — independent primary implementation review

2026-10-05. **APPROVE** of source at `f43e232a8109cfb2cdf1d4536cf63cc0623c9655`, carried through documentation-only head `37f37d17c482e13f26c5e8ad09558973d9c10320`. Local A2 integration; PR number pending. I authored none of the reviewed source. No open findings.

## Requirements derived before the diff

From [Q3-F](../system/cartridge.md#q3-f-fox-and-silent-bell), [bell recovery](../system/save.md#bell-choice-return-recovery), the [A2 brief](../briefs/chapter-one/a2-q3-fox-sol-brief-2026-10-05.md), and the [PM adoption](../decisions/pm-decision-q3-fox-silence-2026-10-05.md): the exact Belfry bell offers Silence only after an actor-owned rescued or stays Q2 terminal and while Q3 is active, the bell is unrung, and allegiance is unknown. A confirmed Silence assigns fox once, resolves Q3 through its own fact-change reaction, starts one two-line modal scene, preserves Q2 and the unrung bell, and emits no story point. Ring and Silence cannot reverse each other. Reopen must admit lawful prior and fox states, require the choice's own causal receipt and the original Q2 return evidence, reject contradictory rows with typed recovery, and survive uncertain COMMIT and exact retry. Book controls retain captured freshness, with no optimistic narration.

## Review and proof

The diff from the integrated B1 and keyboard base `aed621a8` changes cartridge content, the receipt validator, current release pins, and focused tests. The recipes share the exact bell target and use distinct terminal policies; the fox reaction and scene use the existing typed composition. The authority ties the fox receipt to the actor, command, detail, fact change, Q3 event, scene start, and current rows while retaining Ring and return validation. The bundled version is 0.0.15 under API1.13, with independently declared current hash and unchanged allocated IDs. The Book consumes the existing action and scene projection; its shared freshness tests cover withdrawn and changed-context controls. No chapter-specific kernel branch or new contract shape was introduced.

Focused results at the source head: kernel bell 7/7, real rollback-journal SQLite bell 13/13, Book live/model 21/21, Book presenter 11/11, and Elixir chapter content 1/1 passed. `git diff --check` passed. In a separate disposable clone, removing both Q2 terminal predicates made the active-Q2 Silence test fail; removing actor binding made the foreign-actor receipt test fail; removing the duplicate scene-assignment guard made the receipt corruption test fail. The source was restored after each mutation. The developer's full-check run is a separate merge gate; native verification remains paused by the owner decision.

Ponytail Review: **Lean already. Ship.** The content uses the installed recipe, reaction and scene primitives; the save code extends one existing validator without an extra abstraction. No blocker, should-fix or nit remains.
