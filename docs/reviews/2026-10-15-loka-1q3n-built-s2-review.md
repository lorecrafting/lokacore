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

Killed: created.ts direction, one-per-site, site blueprint list; creation.ts and creation.ex built owner; initialPair built branch (TS, Elixir); site exit overlay (mobile built.test.ts); initialPair no-origin (`origin?.` to `origin.`); creation.ts blueprint kind to `true`.
Survived: invariants_creation.ts:173 built provenance to `true`; invariants_creation.ex:295 `built_provenance?` to `true`; invariants_creation.ts:213 containment clause (and `.ex:271`, per handback); knowledge.ts:63 `at.has(to)` dropped (equivalent: map_positions must cover every authored room, cartridge_knowledge.ts:66, so a built room always has its site's position). Elixir `.ex:271` containment not run here; the handback reports it uncaught.

## Findings

1. **Blocker**: protocol/fixtures/corpse_creation.json:1890, :1959. The cases "built room by an unknown owner" and "of a non-blueprint definition" have no `counterfeit`, so the independent built-provenance checks in both kernels never meet their planted violation. A regression that makes `built_provenance?` always true leaves a forged-owner create unflagged by the invariant and the suite green. Fix: add `counterfeit` results to both cases; add a counterfeit with a containment row to "built room has exactly its identity row" (:1631) for the rows_match clause.
2. Nit: knowledge.ts:26 (described, not run). No check stops an authored room at the site's direction cell (cartridge_knowledge.ts:63 only rejects duplicate authored coordinates; SITE_EXIT_CONFLICT checks only the site's exits). A cartridge with knowledge@1 and a site gets two map rooms on one cell. Defer to Beads.
3. Question: lib/loka/content/services.ex:289 compares `b in site["blueprints"]` raw; the TS loader (cartridge_services.ts:194) uses `same`. A source naming the blueprint in two ref forms (short in the service, full in the site) may get a spurious compiler diagnostic. The sampler uses one form.

## Verified

- Handback claims rerun: built owner (creation.ts, creation.ex) and "create with no origin faults (TS)": both killed, backed.
- Overlay: only created.ts:148, fresh.ts and knowledge.ts read `cartridge.rooms`/`map_positions` directly; movement, look and exits read the overlaid `world.rooms` (overlay mutant killed).
- Replay id: built.test.ts walkthrough replay and the mobile receipt replay. Offer and press parity: site_taken and pre-plot refusals.

## Judged, not findings

- Pre-plot raise refused `invalid_state` without a message key: correct per protocol.md:337 (every matching action's policy fails); the brief's permission_denied contradicts the contract.
- builtValid vs unbuildable overlap (load vs admission) and build.ts:20 scan per render (created rows are few): acceptable.
- Missing browser screenshot (walkthrough harness blank page): noted, not a finding.
- No developer `/code-review` result reported in the handback: nit, run in the fix round.
