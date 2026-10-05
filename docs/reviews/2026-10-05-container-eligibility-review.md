# Container eligibility — independent review

PR: #179. Source reviewed: `4b6345ac4a7278654843b0c711178853bf95de7f`.
Base: `60133d9eff38a946b96feadffba3bb30fcc77b9d`.

## Requirements recorded before reading the diff

Derived from system mechanics containment, cartridge compiler/loader, protocol composition,
[owner decision](../decisions/owner-decision-container-eligibility-2026-10-05.md), and contract lessons:

- Only item definitions explicitly declaring `container: true` accept child items. Capacity and lids never imply eligibility; absence denies it.
- Compiler and loader reject capacities/lids on ineligible items and initial placement inside an ineligible item, before world mutation.
- Put admission and projected destination pairs share eligibility and existing custody, lid, capacity, cycle and budget checks; refusal allocates no transfer/event.
- Composition independently prevents transfers into ordinary items. NPC/body custody and forced corpse custody remain valid.
- Historical artifact bytes and canonical/hash answers remain unchanged. Current fixtures and replay transcripts are separately named and independently derived; the bundled chapter advances to 0.0.3 with exact-pin refusal and no save reset/migration.
- New schema constraints have failing controls; mutation of core behavior must fail a focused test. No new capability, operation, or persisted custody field is needed.

## Verdict

APPROVE. No blocker, should-fix, or nit findings.

## Correctness and composition

- `kernel/ts/src/mechanics/containment/shared.ts:140`: the shared query rejects unmarked destinations before custody walks or transfer/event allocation. Projection calls that same query; existing lid, capacity, cycle, and shared-budget behavior remains covered.
- `kernel/ts/src/runtime/fresh.ts:109`: ordinary items receive effective capacity zero. `runtime/apply.ts` passes these derived capacities to composition, and the existing containment invariant checks them. NPC capacity and body/slot custody retain their existing paths. Validated corpse templates remain unlimited receptacles and hydrate from their pinned definition.
- `lib/loka/content/entities.ex:116` and `kernel/ts/src/content/cartridge_refs.ts:313`: corresponding compiler/loader guards reject contradictory capacity/lid fields and unmarked initial holders. Both death validators require explicitly eligible templates. No new operation, capability, persisted field, or content-specific rule branch.
- `protocol/entity.schema.json:174`: the optional field accepts literal true only. Source short-reference expansion and artifact reference checks remain in the existing pipeline.
- `mobile/app/App.tsx:14`: only the current chapter bundle advances; no save migration or deletion implementation changes. SQLite tests exercise cold reopen, exact-pin refusal and explicit replacement, including failed and uncertain COMMIT handling.

## Independent fixture and replay audit

Read the handwritten migration scripts and mechanically compared Git base objects against the reviewed tree. All eleven historical artifact files are byte-identical. All nine `containers_*hash.json` derivatives differ from their historical values only by explicit eligibility on the intended holders; Python stdlib independently verified their canonical JSON and SHA-256 answers.

The current chapter value differs from v0.0.2 only by versioned references and eligibility on trunk, storage chest, player corpse and rat corpse. Independently checked its canonical hash (`21f6115ddebbfad18b5b444522d1b881fb12e0c4400a32cafb5381587ef9011f`) and five representative allocation IDs (character, body, brass key, storage chest, cloak slot) using literal ordinals and Python SHA-256/UUID formatting. Historical transcript copies match base bytes exactly; all 24 command objects across containment, readable and combat are unchanged. The active transcript suite successfully replays them against their current pins. Historical encoding/hash checks remain active and assert current-loader refusal; no fallback loader or compatibility adapter was added.

## Checks and mutation controls

Commands used the pinned toolchain through `mise exec --`; routine logs stayed outside the repository.

- TypeScript: `node --test kernel/ts/test/{put,cartridge_items,container_history,death_content,death,transcripts}.test.ts` — 24 passed.
- Compiler and cross-kernel: `mix test test/loka/{content_items,content_death,content_locks,content_missing_child,cartridge_cross_kernel}_test.exs` — 21 passed.
- Mobile/SQLite: `node --test mobile/authority/local-story/{missing_child,saves,death}.test.ts mobile/app/{chapter,book/item_detail}.test.ts` — 25 passed.
- Independently removed the destination eligibility guard in `putRefused`: the focused authored-receptacle regression failed (exit 1).
- Independently replaced zero-capacity derivation with the old declared-only behavior: the same regression failed on the forged-transfer assertion (exit 1). Restored source: all five Put tests passed.
- Independently swept the generated ItemDefinition schema through the actual TypeScript validator with the committed literal cases: removing each of six required entries, eight bounds, and the true-only const was detected (15/15). No fixture expected answers were derived from the validator.
- Mutations were confined to a detached throwaway review worktree, restored before commit, and never committed. Only this record and its index entry are delivered. Normal pre-push checks are required for that delivery.

## Ponytail Review

Lean already. Ship. The shared guard and derived zero capacity reuse existing mechanisms; small compiler comprehensions preserve validation without adding an abstraction or dependency. The bulk additions are separately named frozen answers required by the approved historical/current split. Net: 0 lines proposed for removal.

No owner Simulator or save was operated. No open review items.

## Separate protocol/save opinion

```text
Verdict: APPROVE
Reviewed head: 4b6345ac4a7278654843b0c711178853bf95de7f
Findings: no findings.

Checks performed:
- Reviewed schema, compiler/loader parity, runtime capacity derivation, transfer composition, containment invariants, corpse hydration, release selection and save loading against the governing specs and owner decision.
- Node tests: cartridge_items, death_content, put, container_history, transcripts and local-story/saves: 33 passed.
- mobile/app/chapter.test.ts: 4 passed after installing pinned TypeScript; initial failure was missing dependency in the throwaway checkout.
- Mix tests: content_items_test, content_death_test, content_missing_child_test and cartridge_cross_kernel_test: 18 passed.
- Executed both independent Python fixture generators with writes intercepted: all 11 generated files exactly matched committed answers.
- Confirmed previously frozen hash fixtures remain unchanged and all three historical transcripts byte-match their base recordings.
- Controlled real SQLite: Missing Child 0.0.2 save refused as pinned_release_missing against 0.0.3; complete database bytes unchanged.
- Controlled real SQLite: forged current cloak-in-brass-key custody refused as save_corrupt; complete database bytes unchanged.
- git diff --check passed; tracked checkout remained clean; throwaway worktree removed.

Ponytail Review: Lean already. Ship.
```
