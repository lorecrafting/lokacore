# Review: c1-numbers, W1, W2, W13 to content (move cost and condition bands)

- PR: #131, branch `c1-numbers`
- Commit reviewed: `79721f3` (commits `6dffe6d` split, `1315265` spec, `4f6d161` code and schemas,
  `12c937e` docs close, plus a main merge).
- Reviewer: fresh Opus. Full depth on the three schemas, `view.ts`, `movement.ts`, both loaders
  and the spec commit.
- Governing: plan `docs/decisions/owner-decision-chapter-one-plan-2026-10-02.md` §3 slice 2 and
  triage 21; the c1-numbers brief and the PM's rulings (optional fields with engine defaults, no
  hash change, `band.<key>` text only for authored bands, tones `normal|warning|danger`,
  `RESOURCE_SPEC_INVALID` reused, split `cartridge_refs.ts` only; owner-rules.md edit and
  `docs/decisions/README.md:84` stay).
- **Verdict: APPROVE WITH NOTES**

## Must be true (written before reading the diff)

1. Without `world`, a move costs 1 mv when the cartridge declares mv, else nothing. With
   `world.movement.cost`, the move pays exactly that `{resource, amount}`. An unpayable move is
   `insufficient_resource` with no ops (no partial charge). GameView exits use the same rule.
2. The band is the first row of the table in effect (pool `bands`, else `world.bands`, else the
   04 §15 default) where `100 × (current − minimum) ≥ cut × (maximum − minimum)`. maximum = minimum
   gives the top row. The default tones are `normal` 100-80, `warning` 70-40, `danger` 30-0.
3. Both loaders report the same codes for a malformed table: unsorted, duplicate cut, last cut not
   0 or duplicate key gives `RESOURCE_SPEC_INVALID` at the table. A missing `band.<key>` text or a
   cost on an undeclared pool gives `UNRESOLVED_REFERENCE`. Schema bounds give `SCHEMA_VIOLATION`.
   A short cost resource expands to the full DefinitionRef.
4. The compiler writes `world` and `bands` only when the source has them. All 13
   `cartridge_*_hash.json` files, the compiled fixtures, `lantern-traces.json` and the transcripts
   do not change. Only the three named frozen `invalid.json` cases change.
5. Commit 1 moves code only and edits no test.
6. The spec commit names each clause it amends and the decision it supersedes. owner-rules.md says
   only what the plan decided.
7. Mobile: a type-only fix plus a neutral fallback for an unknown band key. No new drawing.

## Check against the list

1. Holds. `fare` (`movement.ts:72`) passes the authored cost or `{mv, 1}` to `pay`, a single
   cost, so nothing is charged on refusal. The view's exits call `fare`.
2. Holds (`view.ts:105`). The default table and its tones match 04 §15 as amended.
3. Holds. TS (`cartridge_refs.ts` `pools`/`bands`) and Elixir (`resources.ex` `check`/`ordered?`)
   apply the same rules. The Elixir path skips `:invalid` specs and a rejected catalog. I found no
   input where the two kernels disagree: an empty `world {}` makes the source v2 in Elixir and loads
   in TS, the same as `calendar`. I recomputed every new `cartridge_loader.json` case's
   `content_hash` with Python: all 10 match, so each case reaches the reference stage.
4. Holds. No hash, compiled fixture, trace or cartridge file is in the diff. In `invalid.json` only
   the three named cases change; the loader fixture's description gains a provenance note.
5. Holds. `recipes`/`contributions` in `cartridge_recipes.ts` match the removed text exactly,
   apart from `export` and the `Checks` alias. The call site is unchanged.
6. Holds. The 00 §4 and 04 §15 amendments name the plan (§3 slice 2, triage 21) and, for 04,
   the superseded condition-bands decision. All links resolve. owner-rules.md matches the plan:
   per-pool tables and a cartridge default, with "never a cartridge threshold" superseded by
   triage 21.
7. Holds (`pages.tsx:32`, `Book.tsx:160`).

## Mutants (throwaway detached worktree, full install; all reverted)

Code: 15 mutants, 15 red. `>=`→`>` in the band test, pool and world precedence swapped, the
`some_cuts` tone, default cost 2, authored cost ignored, and in each kernel the gap,
unique-key, duplicate-cut, text and cost-pool rules removed. The TS loader mutants fail the
named `cartridge_loader.json` case (for example `band_table_gap`). The Elixir ones fail
`content_road_test`.

Schemas (sample, `contracts.gen.ts` regenerated each time): ConditionBand `required` without
`tone`, BandTable without `maxItems`, BandTone without `warning`, `at_percent` without `minimum`,
`movement` `required` without `cost`, ResourceView `required` without `tone`: all red in both
kernels (`invalid fixtures fail with exactly the listed errors`). WorldSettings without
`additionalProperties` is red only because the subset flattener rejects it at compile time.

`bin/check_all.sh` at `79721f3`: exit 0.

## Findings

- **N-1 (nit)** `docs/system/cartridge.md:30` cites `resources.ex:99`, which is `defp specs`. The
  sentence is about the lock gaining `resource@1` and `schedule@1`. On main this cited `:53`,
  `def requires`, which is now `:91`. In the same way, `docs/world-parameters.md` W11
  `resources.ex:99-115` was `:53-69` on main and should be `:91-107`. A reader who follows either
  pointer lands 8 lines too low. `bin/check_docs.exs` passes because it checks only the file and
  the range.
- **N-2 (nit)** `mobile/app/book/pages.tsx:32` `band()` fallback: no test covers it (the developer
  declared this; `pages.tsx` imports react-native). `bands` is now `Record<string, …>`, so tsc no
  longer catches a direct `bands[key][0]`. If that index comes back, a cartridge band such as
  `winded` crashes the status line at `Book.tsx:160`. c1-touch replaces this code, so I am not
  asking for a test now.

No blocker or should-fix.

Codex Sol review: appended by the PM.

## Codex Sol first review (79721f3), verbatim

APPROVE

no findings
