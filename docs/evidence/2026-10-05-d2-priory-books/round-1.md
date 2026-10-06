# D2 public Priory books — round 1 fixes and D5 integration

Exact source `de756710ea10322bd36ec339bd1d9abf1850067b`, unpublished branch
`chapter-one/d2-priory-books`. Fix `827abc72` follows both preserved independent
review records; the source merges published D5/main
`363d01f0cdb0526bf91e440846061ab1fbf90a6d`. Independent scoped rechecks, hosted CI
and publication: null. Browser, native and owner-save proof: null. No preview,
native simulator/build, owner save or other worktree was changed.

## Findings and observed controls

- [D2-P1](../../reviews/2026-10-05-d2-priory-books-primary-review.md) is implemented:
  actual Book captures the invocation pending at mount and restores that accepted
  Read's exact projected item/parent route once beneath chapter Continue. Existing
  scene/combat and unavailable-target checks remain authoritative. The actual Book
  hook/subscription regression uses real SQLite lost COMMIT acknowledgement for
  Ward and Bell in an open held chest, executes BookView's Continue and requires
  the literal parent/item route. Subsequent World return and pulse leave World.
  Removing the completion route yields actual `[]`, exit 1; restoration passes.
- [D2-S1](../../reviews/2026-10-05-d2-priory-books-save-second-review.md) is implemented:
  one file-backed SQLite test uses frozen Items input plus one readable item and
  necessary API/container declarations. No topic, fuel, vessel, service, patrol or
  exchange masks its replay gate. Legitimate Take/Read reopens; replacing only its
  narration key with another declared key returns `save_corrupt` with identical
  file bytes. Removing only the readable-item replay gate returns `open`, exit 1;
  restoration passes. The save implementation remains unchanged.

Independent closure remains the reviewers' decision; their original verdicts are
preserved. Mutants were restored before exact-source checks. [Hashes](ROUND1-SHA256SUMS),
[verification](ROUND1-SHA256SUMS.verify) and [capture](round-1-capture.py) bind the
redacted raw outcomes.

## Source checks and pins

| Check | Result |
|---|---|
| `mise exec -- bin/check_all.sh` on exact source | Exit 0; 349 Elixir tests, full active contracts/features/kernel types/tests/sim/lint/size/docs/Beads checks and planted controls |
| `TEST_REPORTER=dot mise exec -- npm test` in `mobile/app` on exact source | Exit 0; 500 outcomes including the unchanged existing skip |
| App `mise exec -- node_modules/.bin/tsc --noEmit` on exact source | Exit 0 |
| Integrated D2/D5/App focused cases | Exit 0; 28/28 |
| Book/presenter/Lantern/SQLite before re-pin | Exit 0; 35/35 |
| Current compiler/chapter/Priory/patrol cases | Exit 0; 7/7 |
| Restored round-1 Book/SQLite cases | Exit 0; 9/9 |

Combined chapter `0.0.27`, API1.24, SHA-256
`2fda0a7f0a571c080c3d9d3969324a1a4920881ea48adab178684fc9330f94de`,
127 initial IDs. The [independent Python oracle](../../../test/loka/cartridge_missing_child_v027_hash.py)
starts from published D5's reviewed fixture and literal D2 additions; compiler and
kernel supply no expected answers. Active App/simulator/compiler/D2 inputs use v027.
Published D5 and older provisional D2 v026 fixtures remain byte-identical.

## Self-review and coordination

Correctness review checked confirmed settlement identity, once-only restoration,
chapter order, projected parents, scene/combat precedence and no target fallback.
The save control forges a schema-valid declared narration key; historical replay
causes its refusal. D5 room sources and ordinary ward-stone behavior are preserved.
Three-way catalog union and active App/compiler pins resolve integration conflicts.

Ponytail Review: lean reuse; no new dependency/framework. Two item-route helpers
move out of model.ts to item-pages.ts to keep the existing source size ceiling;
model exports stay stable, and the renderer allowlist adds only that local filename.
Changed mobile source size and formatting pass without raising allowances.

B9 overlap remains Book.tsx/model.ts plus prior Body/Menu/pages/presenter changes;
this fix adds item-pages.ts. No Page union, pagesAfter behavior or GameView schema
changes. Raw Story narration/save inspection stays unchanged. C3/B9 successor
release/API/hash/IDs need PM sequencing. Independent rechecks, hosted exact-head CI
and browser interaction remain proof gaps.
