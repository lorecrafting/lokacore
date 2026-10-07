# E1 creatures, populations and loot batch review

- Scope: local branch `e1/creatures-loot` (not pushed), exact head
  `258159f8ab4834400c1dfa6df2b7438820110bc7`; batch diff `c04aef98..258159f8`
  (developer `8433a224` merged with PR #288 head `c04aef98`). Beads `loka-e1-r9-certification-2rz.5`.
- Governing: [E1 R9 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md),
  [architecture E1 witness rules](../system/architecture.md#e1-exact-candidate-proof-policy)
  (new paragraph lines 306-321), AGENTS.md Writing tests.
- Verdict: **CHANGES REQUIRED** (spec text, E1-C1; code and recorder otherwise sound).

## Requirements written before the diff

1. Each of the 26 claimed paths is credited only by an accepted committed step in a real-SQLite
   case, re-derived in replay and present in the step receipt.
2. Dynamic entities (spawned NPCs, corpses, loot) need provenance, not presence or definition inventory.
3. Loot is credited only through population provenance (spawned by that member, bundle item, moved
   member to corpse by the receipt).
4. d9 is credited only where its cause event fires and the plan's suppression row is committed;
   only the prior endings qualify.
5. No `any`/`not` descendant credit.
6. Spec text names mechanism kinds, not content, and agrees with presence, causation and replay rules.

## Checks

- Spec paragraph: names only schema kinds (`entity_died`, `population.slot`, `population.control`,
  `population.suppress`, `fact_changed`, `replacement_delay`, `duration`, `tick_every`); consistent with
  the "separate provenance evidence" clause it fills. Corpse, population, loot and bleed sentences grant no
  family credit and the code matches them. The reaction sentence fails, see E1-C1.
- `node --test test/e1*.test.ts`: 38/38 pass. `npm run typecheck`: exit 0.
- Recorder `e1_cases.ts`: exit 2, 24/24 cases pass, `gaps.authored_obligations` = 125. Set diff against
  the 157 list: the 26 creatures paths and 6 debt choice paths removed, 0 added; all 26 credited.
- d9 paths are credited only in `lost-prior`, `rescued-prior` and `stays-prior`; never in fox endings.
  The `when` root is a single `fact_compare`; no children are credited. No `any`/`not` crediting.
- Loot (`hound_pelt`, `deer_hide`) is credited only by `creatures` through the spawned-member branch.
- Mutation (throwaway worktree, removed): 20 guards removed or weakened in `e1_creatures.ts`; 19 fail
  `e1_creatures.test.ts` on their named plant (victim, corpse/victim room, corpse definition, generation,
  replacement due, slot receipt, bundle NPC, loot definition/holder/receipt, bleed refresh/ends/source/loss,
  suppression prior/cause/when/receipt). A 21st mutant (non-suppress step counted as satisfied, line 185)
  fails the `other op` plant. Survivor: `applied.some(Boolean)` at line 196 (E1-C2).
- Withhold-only gaps (re-suppression after expiry, bleed opened and refreshed in one step, corpse moved
  in the same step, `when` read after the step): each can only leave a path pending, none grants credit;
  no case needs them. Acceptable; no extra code warranted.
- Over-engineering: none found; `capture`/`planted` are local and used.

## Findings

- **E1-C1 blocker** `docs/system/architecture.md:316-321`: read literally, a `fact_changed` reaction with
  no `population.suppress` step satisfies "every named plan newly gains suppression" vacuously, so the text
  credits its definition and `when` root whenever the policy holds after the step. Scenario: v042
  `a_resolve_bell`, `b_lost_before_meeting`, `c_resolve_silence` (all on `fact_changed`) would be witnessed
  with no effect proof. This is broad credit, and the text differs from the code, which withholds any
  reaction that has a non-suppress step (`kernel/ts/test/e1_creatures.ts:185,196`). Fix the text only, for
  example "a reaction whose apply steps are all `population.suppress`"; do not loosen the code.
- **E1-C2 should-fix** `kernel/ts/test/e1_creatures.test.ts:240-273`: no plant covers the `every` guard
  at `e1_creatures.ts:196`; mutant `applied.some(Boolean)` stays green. Scenario: a two-suppress-step
  reaction with one plan already suppressed would credit its definition and root. Add one plant (second
  suppress step whose plan is already suppressed). Not reachable in v042.
- **Question** `kernel/ts/test/e1_creatures.ts:190`: the suppression row names the cause event, not the
  reaction; two reactions on one event suppressing one plan could both be credited. Not reachable in v042.
