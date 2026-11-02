# Rush B2 level-up moment contract: second review

PR #575, `feat/rush-b2-moment`, commit `950ea477c17c2cb084744993d22bb803ed00e7b4`, on main `778b4a32e`. Scope by brief: the GameView contract only; no Book visuals.

Governing: `GameViewSnapshot` description in [`protocol/gameview.schema.json`](../../protocol/gameview.schema.json), [contract lessons](../lessons/contracts.md), [experience and levelling](../system/mechanics.md#experience-and-levelling-toolbox-row-4), [levelling details](../system/book-ui.md#levelling-details).

## Must be true (written before the diff)

1. An optional view field keeps `loka-gameview-v1`; required, removed or reinterpreted takes a new tag.
2. `levelling` is `additionalProperties: false`, so the schema must list the field the view emits.
3. `contracts.gen.ts`, the story views and the live saves are current with the schema and kernel.
4. No reader misbehaves on absence, above all `undefined === undefined` on a line key.
5. Every new bound has a fixture that fails when it is removed.
6. Save format and rows do not change; `kernel_api` is main+1 at merge.

## Results

| Item | Result |
| --- | --- |
| Tag | `level_up` is outside `required`, format const unchanged: additive, no new tag needed. |
| Generated | `elixir bin/contracts.exs --check` exit 0; `npm run stories:views` leaves the tree clean. All 33 views carry the key. |
| Absence | Only reader `mobile/app/book/logs.ts:49`. Probed: a keyed level line on an old view, or on a view with no `levelling`, stays a plain string. A keyless line on those views does read gilt (`undefined === undefined`), but `Text.key` is required in the schema and the type, so a conforming record cannot reach it. |
| Reachability | GameView is derived per projection (`mobile/authority/local-story/session.ts:111`), never stored. `level_up` is required in the cartridge's `world.levelling`, so absence is only a hand-built or old view. |
| local-story | Only `levelling.test.ts` changed. Save schema, state sections and `protocol/fixtures` untouched. All 7 live saves differ only in `kernel_api`. |
| Save effect | The bump refuses a 1.146 save as `pinned_release_missing` (`mobile/authority/local-story/authority.ts:100`), as every bump does. |
| Elixir | Produces no GameView; it only validates fixtures from the same schema. |
| CI on head | `ci`, `book-e2e`, `graph-diff`: success. |

## Mutants (narrow; validate, levelling, penalty, showcase_combat, local-story levelling, `contracts_test.exs` for row 1)

| Mutant | Result |
| --- | --- |
| `level_up` weakened to `{type: string}` | **Survives** (64 pass; Elixir 9 pass) |
| `level_up` removed from the schema | Killed, 6 kernel failures |
| `level_up` added to `required` | Killed, `invalid fixtures fail with exactly the listed errors` |
| View stops emitting it (`skills.ts:84`) | Killed, local-story `levelling.test.ts` |

## Findings

- **should-fix** `protocol/fixtures/invalid.json`: no GameView case for `level_up`. Scenario: a schema edit drops the TextKey pattern, a view with `"level_up": "Level Up!"` validates, and the surviving mutant shows no fixture notices; the contract lesson requires a failing fixture per bound. Fix: one case with a key that breaks the pattern.
- **should-fix, at merge** `kernel/ts/src/runtime/world.ts:110`: open PR #576 (head `9ae86a360`) also moves 1.146 to 1.147. `git merge-tree` of the two heads conflicts only in `docs/system-graph.gen.json`, so `world.ts` merges silently and `merge_resolve.py`'s keep-the-higher rule never runs. Scenario: the second merge keeps 1.147 with a different contract, and a save pinned by the first passes `authority.ts:100`. No check enforces main+1. The second to merge must take 1.148 and regenerate.
- **nit** `protocol/gameview.schema.json:1350`: the `levelling` description lists every other field but not `level_up`. Scenario: a reader of the schema cannot tell it is the Book's gilt key or that it is absent only in an old view.
- **nit** `kernel/ts/src/view/skills.ts:84`: the `level_up &&` false branch is unreachable, since `levelling()` returns only with a spec and that spec requires the key. Scenario: a test can never reach it.
- **nit** PR body: `LevelWash.tsx:23` is cited as the import from `Blow`; the import is at line 3, line 23 is the cue check. Scenario: a reader following the cite finds the wrong code. The rulings cites (lines 45, 46-47, 52) hold.

## Not checked

Book visuals, full suites, `bin/mutate_diff.sh` (by brief), Hermes hosts.

## Verdict

APPROVE WITH NOTES
