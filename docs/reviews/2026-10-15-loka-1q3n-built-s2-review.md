# Review: Built rooms S2, raise the hut (loka-1q3n)

- Branch `toolbox/br-s2`, commit reviewed `b911cfa256d9ab5ec07887d0eb1471901223258b`, base `toolbox/batch-built` `7dc077ee`.
- Governing: [mechanics.md, Built rooms](../system/mechanics.md#built-rooms-toolbox-row-s2-foundation), [save.md, Built rooms](../system/save.md#built-rooms), [protocol.md refusals](../system/protocol.md), brief `loka-kgd.109` FABLE BRIEFS (COMMON, S2, rulings 1, 2, 3, 9).
- Verdict: **CHANGES REQUIRED** (one blocker, cheap fixture fix).

## Must be true (written before the diff)

1. Build is a service@1 benefit; site_taken and construction_full refuse after price, keys in both kernels; ops are payment plus one `entity.create`, built origin, owner = actor, minted id.
2. Hydrate overlays rooms from created rows; no reader call-site edits; exits_resolve unchanged.
3. Load refuses save_corrupt for each forged row (site, direction, blueprint list, one per site, max_total, owner, id), each with a test that fails when its check goes.
4. Both kernels' creationValid and initialPair built branches, and the independent invariants, agree and are pinned by the shared fixture.
5. Replay mints the same id; offer refusal equals press refusal.

## Mutants (detached worktree, restored)

Killed: created.ts direction, one-per-site, site blueprint list; creation.ts and creation.ex built owner; initialPair built branch (TS, Elixir); site exit overlay (mobile built.test.ts); initialPair no-origin (`origin?.` to `origin.`).
Survived: invariants_creation.ts:173 built provenance to `true`; invariants_creation.ex:295 `built_provenance?` to `true`; invariants_creation.ts:213 containment clause (and `.ex:271`, per handback); knowledge.ts:63 `at.has(to)` dropped.

## Findings

1. **Blocker**: protocol/fixtures/corpse_creation.json:1890, :1959. The cases "built room by an unknown owner" and "of a non-blueprint definition" have no `counterfeit`, so the independent built-provenance checks in both kernels never meet their planted violation. A regression that makes `built_provenance?` always true leaves a forged-owner create unflagged by the invariant and the suite green. Fix: add `counterfeit` results to both cases; add a counterfeit with a containment row to "built room has exactly its identity row" (:1631) for the rows_match clause.
2. Should-fix: handback claim "corpse_creation (blueprint kind, owner)" covers the compose side only; the invariant side is not backed (finding 1).
3. Nit: knowledge.ts:26. No check stops an authored room at the site's direction cell (cartridge_knowledge.ts:63 only rejects duplicate authored coordinates; SITE_EXIT_CONFLICT checks only the site's exits). A cartridge with knowledge@1 and a site gets two map rooms on one cell. Defer to Beads.
4. Nit: knowledge.ts:63 `at.has(to)` has no test (survived). A link to a built room whose site has no map position would name an unlisted room.

## Judged, not findings

- Pre-plot raise refused `invalid_state` without a message key: correct per protocol.md:337 (every matching action's policy fails); the brief's permission_denied contradicts the contract.
- builtValid vs unbuildable overlap (load vs admission) and build.ts:20 scan per render (created rows are few): acceptable.
- Missing browser screenshot (walkthrough harness blank page): noted, not a finding.
- No developer `/code-review` result reported in the handback: nit, run in the fix round.
