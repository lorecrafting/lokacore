# D6 water depths — final save/protocol second opinion

Exact source head: `3245550d31fdcc44be4468789ca91d6100488986`; integrated published main: `f014aa26a0d0cb8dca7ae0d2fcada0ac128d0c4f`. Independent reviewer; authored none of D6. Verdict: **APPROVE**. This supplements the fresh primary review and supersedes only the provisional save opinion for this final head.

## Requirements derived before diff

The [D6 brief](../briefs/chapter-one/d6-water-depths-brief-2026-10-05.md), [protocol](../system/protocol.md#d6-water-movement-and-corpse-selection) and [save](../system/save.md#d6-water-and-owned-corpse-recovery) require one original absolute deadline and bound occurrence, expiry before equal-time input, one atomic drowning/corpse/Chapel result, generation-safe free Surface, and exact selected owned underwater corpse roots transferred once. Reopen must retain deadline and historical custody; failed or uncertain COMMIT must fence input, while corrupt typed rows refuse without save deletion. New schemas and v035/API1.30 answers require independent literals and must leave frozen older fixtures intact.

## Findings and proof

No finding in this scope. The final carryover adds historical `recover_corpse` custody evidence to `commerceSave` for a legitimately bought torch, with exact source, destination, outcome and group; `liquidSave` replays the original accepted history, including the quote at its original revision and every root. The final `job.cancel` schema conditional retains the encounter ID requirement for combat and permits the bound water generation form. Water occupancy, cause and job contracts retain strict typed validation; the prior [provisional save opinion](2026-10-06-d6-water-save-second-review.md) covers the original failure and corruption matrix.

- `mise exec -- node --test mobile/authority/local-story/water.test.ts mobile/authority/local-story/water_chapter.test.ts`: 10/10 pass after `mix deps.get` in this isolated review checkout. These use real SQLite for entry/surface/expiry/recovery reopen, genuinely failed and both uncertain COMMIT outcomes, replay, malformed rows, forced overload, selected corpses, and bought-torch custody.
- Independent red control in a detached throwaway checkout: remove only the `recover_corpse` custody branch in `commerce-save.ts`; the bought-torch cold-reopen test fails `save_corrupt`. The throwaway checkout was removed; final source is unchanged. The retained final evidence also shows the `job.cancel` requiredness removal fails the frozen combat fixture.
- Independently recomputed canonical SHA-256 over the v035 fixture value: `560e16712f3c04538343e9a3ac767604093656bc527864360ccad6a8ab719581`; v035 declares API `1.30`, has 190 distinct starting IDs, and this D6 diff adds only v035 and water fixture files under `protocol/fixtures/`. Earlier frozen chapter fixtures are untouched.
- Retained [final evidence](../evidence/2026-10-06-d6-water-final/README.md) reports the full local gate, 2/2 isolated Book browser paths, bought-torch green/red and schema green/red; its SHA256SUMS verification succeeds. Hosted exact-head CI and publication remain PM gates.

Ponytail Review: the final custody branch uses the existing receipt replay and shop custody loop; no extra ledger, schema framework or compatibility adapter was introduced. This review commit changes only this record and the index.
