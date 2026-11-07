# Review: dialogue cookbook and the asked marker, PR #560 (loka-vduxr.12, kernel_api 1.138)

- PR [#560](https://github.com/lorecrafting/lokacore/pull/560) `engine/dialogue-patterns` at `5130febef55268f79facbd1e30744829e789f5e2`.
- Governing: `br show loka-vduxr.12`, [`asked` and its composition record](../system/mechanics.md), [book-ui, dialogue choices](../system/book-ui.md), [review count](../WORKFLOW.md).
- Reviewer: independent; authored none of the work.
- **Verdict: APPROVE WITH NOTES.** No blocker. Two [small should-fixes](../WORKFLOW.md#small-should-fix), no fix round; a second opinion is still required.
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff completed, success.
- **Second opinion: yes**, against the developer's no. [Review count](../WORKFLOW.md#review-count) names "protocol ... contracts" with no additive carve-out, and this PR adds fields to `protocol/gameview.schema.json` and `protocol/dialogue.schema.json` with a pin bump. The risk is low (optional, view-only, the save holds only a fact), but the rule decides.

## Must be true

1. The spec is amended in the same PR (`mechanics.md`, `book-ui.md`).
2. The mark is set only when the choice's steps apply, survives a reload, and only a fact reaches the save.
3. It never refuses; only available options carry it; the option stays pressable.
4. No silent overwrite of an author's fact; `asked_when` is not a source field.
5. Capability-locked cartridges compile correctly or refuse clearly.
6. Many marks do not break the view's query budget.
7. Old saves and cartridges without `asked` are unaffected.
8. Copying a pattern and replacing placeholders works as the page says; no story prose.
9. The engine changes only for the marker.

All hold, except that 8 holds for compile and play but not for lint (first finding).

## Findings

**should-fix** `docs/guides/dialogue-cookbook.md:424,428,432,444`. `curse_taken`, `curse_cured`, `heal_taken` and `bell_heard` write state with neither a narrate step nor `"silent": true`. The page compiles clean, but `mix loka.lint` reports all four, and [area-authoring](../guides/area-authoring.md) tells the writer to run it. Copied into `cartridges/toolbox_showcase`, they fail `test/loka/content_lint_test.exs:409`, which allows nothing beyond the baseline. Probe: adding `"silent": true` to the four clears those findings and still compiles. Fix: those four `"silent": true` lines. A lint assertion in the page test could also hold it, but is optional.

**should-fix** `mobile/authority/local-story/__tests__/dialogue_cookbook.test.ts:288-289`. The heal asserts only `conditions.length`. Mutant: the page's `per_tick` at `dialogue-cookbook.md:395` flipped to `-1`: 9 pass, 0 fail, so a heal that hurts is shipped as the pattern the page promises at `:368`. This mutant is page content, not diff engine logic, so it is not the step-3 blocker. Fix: one assertion line, the view's `conditions[0].per_tick` equals `1`.

**nit** `kernel/ts/src/mechanics/dialogue/shared.ts:247`. Mutant: `asked` also spread onto unavailable options, green on the cookbook test. Correct today (probe: taken `learn_knack` with `asked` shows `available: false`, no mark). Failure: the regression reaches any non-Book client, since `Npc.tsx:60` hides it. Fix: leave the page alone (a mark on a one-time choice never shows); the learn test adds `asked` through `compile(edit)`, as the failed-check test does, so `view()`'s `validate` catches it: the schema allows the field only on the available branch.

**nit** `docs/guides/dialogue-cookbook.md:176`. The label section reads `errand_done`, whose facts block is in the quest section at `:80`; copied alone it stops at "Nothing defines the fact `errand_done`". The diagnostic is clear; one sentence on the page saves the trip.

**question** `mobile/app/book/actions.tsx:84`. The mark is colour only, so a screen reader hears no difference; the words would be the owner's. `book-ui.md:508` asks for exactly this look and no ruling I found forbids it. Axe passes. The PR has no screenshots and routes the look to a designer, while the [designer record](../decisions/owner-decision-designer-opus-2026-10-21.md) has no per-slice design review: owner or PM to say whether non-visual wording is wanted.

## Checks, with proof

- **Prose:** every player-facing word on the page is a placeholder; no story prose. The stories add no new words.
- **Copy and replace:** all 64 placeholders replaced by multi-word text with an apostrophe and a comma: compiles with empty stderr, plays with a reload. Each section alone with the area and base files compiles (quest with its quest file). `resource.adjust` in a reaction and in choice steps is refused, so `:368`'s "no instant heal" is true.
- **Capability lock:** no `fact` or no `dialogue`: a clear refusal at the choice. No `policy`: compiles and plays through a reload, as a hand-written choice policy does, so no bypass.
- **Marks played:** passing check sets the fact, kept across the hand-off and reload; failed check does not. Accept, reminder, do and hand-in on the quest all set theirs; five facts survive reloads. An `extends` child gets its own fact, not the abstract parent's. A `.scene` sidecar compiles with the mark.
- **Refusals:** cross-dialogue collision (`a_b`+`c`, `a`+`b_c`) refused; hyphen and uppercase ids are refused by the schema; malformed `asked` draws schema diagnostics, no crash.
- **Budget:** view-only (`choiceView` from `view/view.ts:81`), one `holds` leaf per available marked option against `LIMITS.query_steps` 32768; `holds` does not throw. Closed by trace, not by a load run.
- **Old saves:** the seven `mobile/app/stories/live/*.sql` diffs are the one pin line each. A definition with no `asked_when` adds nothing (`selection.ts:112`); an unset fact reads unmarked, the path every fresh save takes.
- **Mutants** (run singly, null controls green: cookbook 9, lint 20). `bin/mutate_diff.sh origin/main`, rc 0: 14 mutants, 7 run; 4 red; `asked_field.ex:6` doc text survives (equivalent); `Npc.tsx:60`, `actions.tsx:84` survive only because node tests do not import stories. Narrow, red: `asked_field` keeps `asked_when`; `>` to `>=` on length; skip riddle; skip taken; drop the `asked_when` put; drop the fact's player scope; `check_kinds` entry; `@engine_facts` entry; `selection.ts` inverted; `shared.ts` drops the mark; lint drops `asked` (the PR's "1 failure" reproduced). `"enum" => [true, false]` is green on the cookbook, red on `content_source_schema_test.exs`. Book, by vitest on the two story files (null 6 pass): always prose, `asked = false`, `asked = true`: each red on `Asked option`. Survivors: the nit above, and appending the mark before the steps instead of after, equivalent because a choice's steps have no halting step and none reads the mark.
- **PR-body claims rerun:** cookbook 9 pass, lint 1-failure mutant, `protocol/fixtures` diff is only `invalid.json`: all back the body. `/code-review medium` is reported.
- **Composition record:** present; `dialogue_asked.ex` names no other mechanic or content. Over-engineering: none beyond the redundant `o.available` guard the PR already lists.

## Merging with #556 and #557 (scratch merges on their heads `f64e07373`, `ec50c76eb`)

- #556: only `contracts.gen.ts` and `system-graph.gen.json` conflict; regenerated: cookbook 9 pass.
- #557: `compiler.ex` (`@engine_facts` and size line, keep both), `source.ex` (two hunks, keep both), `source-kinds.gen.md`; regenerated: cookbook 9 pass.
- Whichever lands second: `kernel_api` takes main+1. After #557, the page's `.scene` sentence (`:7-8`) and "id order" (`:12-13`) go stale because of `choice_order`; the PR lists only the first. `once` plus `asked` on one choice compiles, yet the mark can never show (`once` makes the option unavailable): refuse the pair or say so, in whichever lands second.

Not run: the full suite; a screenshot look; a view load run.
