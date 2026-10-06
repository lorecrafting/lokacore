# C1 Tobin training — independent primary implementation review

**Verdict: CHANGES REQUIRED.** Local PR: null. Exact source head reviewed:
`e8bf456ece3ca07df37b8014082d1a8174cb9186`, branch
`chapter-one/c1-tobin-training`, against corrected B5
`2df52d328adbfdea39a0cde623f6a9f34fffb186`. I authored none of the source or
planning work. Review-only detached checkout; no source change retained, merge,
push, native session or publication claim.

## Requirements derived before reading the diff

Read the [adopted brief](../briefs/chapter-one/chapter-one-c1-tobin-training-brief-2026-10-05.md),
[plan review](2026-10-05-c1-tobin-plan-review.md), repository role/workflow and
mechanics/storage/contracts/mobile/evidence lessons. The governing
[mechanics](../system/mechanics.md#c1-training-and-armed-defense-selected-contract),
[cartridge](../system/cartridge.md#c1-tobin-and-equipment),
[protocol](../system/protocol.md#c1-training-and-defense-composition),
[save](../system/save.md#c1-learned-skill-and-lesson-recovery),
[Book](../system/book-ui.md#c1-teaching-and-defense-details) and
[composition](../system/architecture.md#building-mechanics-by-composition)
clauses require:

- Immediate, ordered, optional swords/dodge lessons: opening Talk charges nothing;
  accepted Choose conserves the exact fee and grants one reserved membership plus
  the original sword where applicable, atomically. Membership denies repeats before
  payment/gift. Current qualification does not gate learning or erase acquisition.
- The real due round selects an authored sword profile only from qualified acquired
  wield custody. Held/nested/removed equipment gives no benefit. Accuracy, eligible
  dodge, eligible off-hand block and damage use strict comparisons and one bounded
  draw/query context; prevention stops later draws and damage. Existing sleep,
  initiative, death credit/closure, scheduling and combat admission remain intact.
- Changed-row saves, receipt retry, uncertain COMMIT and cold reopening preserve
  complete old/new results and accept lawful later gift custody. Historical grants
  bind exact commands, source/choice/roles, scoped causal events, fees and custody;
  contradictory evidence refuses as `save_corrupt` without rewriting.
- Character, item and Tobin controls consume confirmed typed projections/authored
  text; committed lesson/defense history appears once. No paid training or equipment
  gate enters required story or corpse recovery.
- Both compiler and loader enforce typed references, ownership, profiles and fees.
  Current release/hash/identity answers are independently pinned; active checks must
  pass before publication. No new foundation operation, persistence ledger or named
  content branch belongs in the kernel.

## Findings

### C1-PRIMARY-01 — blocker: lesson evidence accepts foreign event identities

At [skills-save.ts:28](../../mobile/authority/local-story/skills-save.ts), acquired
membership is justified through `committedDialogue`. Its existing
[choice evidence](../../mobile/authority/local-story/dialogue-receipt.ts) at lines
105–125 and gift evidence at lines 242–254 check causation/payload/actor, but omit
event correlation, world context and scope. The strengthened assignment evidence
checks those fields only on `fact_changed`; it does not protect the accompanying
`item_acquired` and `choice_resolved` events.

**Controlled failure:** accept the real SQLite swords lesson, alter only one of
`correlation_id`, `world_context_id` or `scope` on either its gift `item_acquired`
or `choice_resolved` event to a different valid UUID/player scope, then call
`openStory` on the unchanged state rows. All six independent cases return `open`.
The selected save contract requires `save_corrupt`: the grant must bind scoped
root cause and consequence, not just compatible payloads. This is a C1 obligation
at its new acquisition recovery boundary, even though the incomplete helper existed
before C1. Bind these identities to the exact lesson command/world/actor and add a
controlled same-layer regression for the missing event evidence.

### C1-PRIMARY-02 — blocker: seven new C1 failures stop the publication check

`mise exec -- mix credo --strict` exits **8** at the exact source head. Seven
new C1 diagnostics remain after the separately approved B3 cleanup:

- [skills.ex:35](../../lib/loka/content/skills.ex): `check`, ABC51 >30.
- [skills.ex:111](../../lib/loka/content/skills.ex): `lesson`, ABC43 >30 and
  cyclomatic11 >9.
- [compiler.ex:150](../../lib/loka/content/compiler.ex): `definitions`, ABC35 >30.
- [position.ex:63](../../lib/loka/content/position.ex): `reserved_names`, ABC32 >30.
- [requires.ex:33](../../lib/loka/content/requires.ex): `minimum_feature_api`, ABC31 >30.
- [checks.ex:318](../../lib/loka/content/checks.ex): `trees`, ABC31 >30.

**Failure scenario:** accumulate this source with approved B3-LINT and run the
required active publication/pre-push line; the strict Credo stage fails, so the
slice cannot meet its publication acceptance. The exact C1 source additionally
reports inherited `Commerce.shop` and `Compiler.checks` findings; those two are
outside this finding and already addressed by B3-LINT. The PM reported the same
seven C1 diagnostics on integration `ef7c8c21`. I inspected its compiler merge
resolution: `Enum.concat` retains `Skills.check` immediately after Commerce and
preserves diagnostic order. Resolve C1's diagnostics without disabling checks or
adding speculative abstractions, then run the publication gate on the accumulated head.

## Verification and test controls

All commands used `mise exec --`; output stayed in slice-specific scratch logs.
Exact-head focused runs, exit **0**:

- Kernel training/loader/combat/Flee/attributes/dialogue: **42 passed**. Adjacent
  combat actions/contracts/content/credit, reward/storage and death: **21 passed**.
  Kernel source/test/play typechecks pass.
- Real SQLite training and Book component interaction: **9 passed**. Adjacent
  combat, scheduled combat, death, reward/storage and storage faults: **38 passed**.
  App typecheck passes. These are headless component/authority results, not browser
  layout or native evidence.
- Compiler training/current chapter: **6 passed**; attributes/combat: **9 passed**.
  Actual source compilation matches the v020 canonical answer. Re-running the six
  training authority tests with `C1_ARTIFACT` set to that freshly compiled artifact
  passes, including all four training/shop/S2 orderings, real defended strikes,
  five-rat reward/storage, trained death and exact sword recovery.

**Independent source mutant:** replace skills' `usable: acquired && qualified`
with `usable: acquired`. The old focused combat/Flee/attributes/dialogue suite
still passes **35/35**; C1 training fails **2/5**. It observes learned-unqualified
projection `[true,false,true]` instead of literal `[true,false,false]`, and an
unqualified wielded sword leaves ratHP3 instead of literal5. Restoring the source
returns **5/5** green. No mutant or temporary probe is committed.

The six event-forgery probes above independently expose a gap in the existing
same-layer corruption cases. Existing tests otherwise exercise real rollback-journal
SQLite, failed COMMIT and both lost-acknowledgement outcomes, independent controlled
RNG/HP answers, ordinary Book controls, permanent membership and lawful later custody.
No source-text tests were added. The full schema mutation sweep, simulator and
accumulated publication suite remain the brief's publication obligations; this review
does not claim they ran. The normal review-record commit hook is the documentation check.

## Composition, correctness and Ponytail Review

The real consumer is complete: ordinary Tobin Talk/Choose grants feed actual sword
damage/dodge, and Peg's finite shield/iron-sword shelf feeds existing equipment slots.
Shared skills, payment, policy, receive/carry, scheduled round, death/credit and authority
ownership match the composition record. The resolver contains no Tobin/chapter/skill-name
branch, standalone Learn/Dodge verb, new state section or portable foundation operation.
Combat admission stays with the final shared ActionSet. The changed-row/replay design
retains the original transactional owner. The two findings concern incomplete causal
validation and a failing active check, not a missing playable consumer.

Ponytail Review: **Lean already. Ship.** No separate over-engineering finding;
no new dependency, redundant training ledger or speculative progression machinery.
This simplicity assessment does not override the two blockers. Both remain open;
the same developer should fix them and return the exact fix head for scoped review.
