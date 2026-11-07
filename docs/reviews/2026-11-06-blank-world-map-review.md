# Review: a blank world's first room is placed on the map

- PR: #692 `editor/blank-world-map` (loka-wfrgk.103)
- Reviewed commit: `85a58ad5c50a272626ce6858e0c1e2a169e5c39d`
- Governing: [cartridge.md layout completeness](../system/cartridge.md) (:1547, every room exactly once),
  `lib/loka/content/layout.ex:62` (`requirements/2`, layout needs knowledge@1),
  [WORKFLOW review stance](../WORKFLOW.md#review-stance); author-error guards are nits (PM ruling on areamap.tsx:176)
- Independence: authored none of the slice; detached review worktree
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (9 findings, disputed or left open; see below)
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. `bin/loka new cartridge` writes knowledge@1 and `layout.json == [{start,0,0,0}]`; the result compiles.
2. An Unplaced chip dropped on an empty map writes a row at 0,0,0 and the result compiles.
3. Card bar, two ways with layout.ex:62: no map gesture writes a layout.json the compiler refuses for a missing
   capability; it adds the capability or refuses with the reason.
4. The two-way cite exists on both sides (layout.ex comment; templates/starters/mapedit comments).
5. Existing cartridges and the starter tests still compile; rows are written for concrete rooms only (abstract
   rooms are removed by Extends before the completeness check).
6. New tests assert literal expected values, with a red control per test.

## Checks that held

- 1: templates.ex:82 literal row, knowledge in caps; content_starters_test.exs:29 asserts the literal and compiles.
- 2: areamap.tsx:175 `!l.level.length` -> `ed.first()` -> mapedit.ts:82 `new {kind: layout}` ->
  `Starters.write` with caps `~w(knowledge)` (templates `kind("layout")`) and `with_rows` from x=0.
  author_mapedit.test.ts:480 asserts `[[{start,0,0,0}], 1]` literally.
- 3: map cells (`at`) come only from the compiled artifact (`kernel/ts/play/story.ts:168`), which required
  knowledge@1 to compile, so `place`/`grow` cannot write a knowledge-refused row. A pre-fix world with no
  layout, or a refused one, has no cells, so the drop goes through `first`, which adds knowledge
  (starters.ex:190). Both ways hold; not a blocker.
- 4: layout.ex:61 names the three writers; templates.ex:57, starters.ex:189, mapedit.ts:80 name layout.ex.
- 5: `cartridges/` untouched; `places/1` (starters.ex:146) drops abstract rooms; the "every room a row" rule is
  forced by cartridge.md:1547, not a developer choice. Slice tests green at head (53 Elixir, 21 TS).
- Open /code-review items: starters.ex:124 parse cost is one JSON read per room per starter run (nit at most);
  starters.ex:188 an abstract Unplaced chip is impossible (story rooms come from compiled `c.rooms`, abstract
  removed); mapedit.ts:82 a world without an entry never compiles, so never reaches the map (bundled entry is
  covered at content_starters_test.exs:341). None blocks.
- PR claims rerun: "starters_test:224 goes red without `with_capabilities(~w(knowledge))`" (held, mutant b);
  "map.test.ts drop test goes red when the `first` branch is dropped" (held, sweep row areamap.tsx:175).

## Mutants

`MUTATE_MINUTES=30 bin/mutate_diff.sh origin/main`: 6 mutants, 6 run, exit 1.

| Mutant | Result | Red test |
|---|---|---|
| starters.ex:124 `1 -> 2` | red-narrow (compile error) | - |
| templates.ex:75 `1 -> 2` | red-narrow | content_starters_fresh_test.exs:88 |
| templates.ex:76 `1 -> 2` | red-narrow | content_starters_extends_test.exs:16 |
| templates.ex:82 `0 -> 1` | red-narrow | content_starters_fresh_test.exs:167 |
| areamap.tsx:175 `&& -> \|\|` | red-narrow | map.test.ts "Unplaced chip dropped on an empty map" |
| areamap.tsx:176 drop `if (!l.v.view) return;` | SURVIVED | PM ruling: crash guard, nit |

Matches the PR table (the PR's two BASELINE-RED areamap rows ran red-narrow/SURVIVED here).

Hand mutants (`bin/mutate.sh` style, restored after):

| Mutant | Red test |
|---|---|
| a. `places/1` keeps abstract rooms | content_starters_extends_test.exs:60, :90 |
| b. `with_layout` drops `with_capabilities(~w(knowledge))` | content_starters_test.exs:224 |
| c. `Templates.cartridge` drops `"layout.json"` | content_starters_test.exs:29 and five more |
| d. mapedit.ts:82 `kind: 'layout'` -> `'rooms'` | author_mapedit.test.ts:480 |

## Findings

- nit, `tools/author-panel/src/areamap.tsx:176`: `if (!l.v.view) return;` has no red mutant (sweep SURVIVED).
  Scenario: a level with cells but no view is an author-panel invariant break, so a crash would be the symptom;
  kept per PM ruling.
- nit, `tools/author-panel/src/areamap.tsx:175`: after an author removes `knowledge` from a compiled world,
  the kept artifact (`kernel/ts/play/live.ts:269` `map.keep`) still shows cells, so `place` writes a row to an already-refused
  layout.json and the footer shows the compiler's UNDECLARED_CAPABILITY. Author-side; the refusal names the
  reason, so item 3 holds.
- nit, `lib/loka/content/starters.ex:124`: `rooms/1` parses every room file on every starter run; a malformed
  room file now stops every starter kind, not just `layout`. Author-side.

Nothing to fix before merge.
