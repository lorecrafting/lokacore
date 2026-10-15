# Review: Built rooms S2, save second opinion (loka-1q3n)

- Branch `toolbox/br-s2`, exact head `b911cfa256d9ab5ec07887d0eb1471901223258b`, base `7dc077ee`. No PR (batch model).
- Governing: Beads `loka-kgd.109` "FABLE BRIEFS 2026-10-15" COMMON + S2; [save.md Built rooms](../system/save.md#built-rooms); [storage lessons](../lessons/storage.md). Save rules only; the primary review covers the rest of the slice.
- Verdict: **APPROVE WITH NOTES**.
- Written 2026-10-15 by anthropic/claude-opus-5-5 (save second opinion).

## Must be true

1. A built room's only saved trace is its `created` identity row (origin `built`); hydrate derives room, exits and roomIds on every load; no room, exit or containment row is saved.
2. Load is `save_corrupt` for: unresolved blueprint/site, direction not in `site.directions`, blueprint not in `site.blueprints`, two rows on one site+direction, rows over `max_total`, unknown owner, `id` != row key.
3. Replay and cold reopen give the same room id and exits.
4. A failed COMMIT on the raise leaves all-prior rows; no silent deletion of the row.
5. Elixir and TS agree on `initial_pair?`/`initialPair` and provenance.

## Evidence

| Check | Result |
|---|---|
| Mutants in `kernel/ts/src/runtime/created.ts`: direction check skipped (:153), `max_total` ignored (:179), duplicate site+direction admitted, owner check true (`foundation/creation.ts`) | each fails `kernel/ts/test/built.test.ts` "a forged built row refuses the load" |
| Elixir mutant `creation.ex` built `initial_pair?` -> `true` | 13/15 in `corpse_creation_test.exs` + `compose_test.exs` (clean head 15/15) |
| Real raise, then `state_row` rows naming the hut id | only `created/<hut>` (no room, exit or containment row) |
| Free hut: a well-formed built row inserted after `buy_plot`, no `raise_hut` receipt | `save_corrupt`; file sha unchanged by the refused open |
| Created row deleted, refused open | file sha unchanged (no rewrite) |
| Real loader (openStory, node:sqlite) forged saves not in the tests: containment row placing the hut in the lane; created row deleted with the body inside the hut; created row deleted with the body outside | all three `save_corrupt` |
| Deferred-FK failed COMMIT and real `SQLITE_FULL` on `raise_hut` | rows and memory all-prior; retry raises once; cold reopen loads |

Elixir has no save loader, so the load refusals exist only in TS by design.

## Findings

1. nit, `mobile/authority/local-story/built.test.ts:40-42`. The comment says the test breaks when load admits a row whose direction the site does not declare. With the direction check removed (`created.ts:153`), this test stays green. Hydrate and `restorable` pass, and a later step in `store.ts` `load` refuses the forged east row. The kernel test covers the check. Failure scenario: someone treats this as the mobile red control and removes the kernel case. Fix: reword the comment.

No blockers.
