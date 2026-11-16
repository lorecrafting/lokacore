# Review: Field guide B, Add menus with descriptions and the generated field guide (loka-wfrgk.102.3)

- PR: #697 `editor/field-guide-b`
- Reviewed commit: `c460f2315621d831750cfff0895135e412f33516`
- Governing: [WORKFLOW review stance](../WORKFLOW.md#review-stance), AGENTS.md "Writing tests",
  Beads loka-wfrgk.102 (the reader is the owner, a non-programmer writer; a misleading guide is a must-fix)
- Independence: I wrote none of this slice. I worked in a detached review worktree.
- CI at head (`gh run list --commit`): ci passed (42370613037), book-e2e passed (42370613202)
- Developer's `/code-review`: reported in the PR body
- Verdict: **APPROVE WITH NOTES** (one should-fix, in the generated page only)

## Must be true (written before the diff)

1. Each Add menu offers exactly the old options, and choosing one runs the same add path.
2. The menu works from the keyboard, and the trigger and items have accessible names.
3. Descriptions come only from the schema: the field's own description, else its `$ref` target's.
4. List items show their description.
5. docs/FIELD-GUIDE.gen.md is generated, and a stale page fails the check in CI.
6. Tests use planted inputs with expected values the code does not compute.

## Checks that held

- Options and add path: at every caller (Action, Dialogue, Entity, Quest, Reaction, Room, World, Choices), the `fields` arrays and `reveal` functions are unchanged; `adding()` wraps the old `adder`.
- Keyboard: cards.test.ts:39 opens the menu with Enter, finds the option by typeahead (`textValue`) and picks it with Enter. The trigger is `type="button"`, so it cannot submit the form, and it has `aria-label="Add a field"`.
- Schema only: a script compared TS `described` (card.ts:86-90) with the Python guide over all 267 top-level kind fields and found 0 differences.
- The stale page check runs in CI (ci.yml:67) and on every bin/regen.sh run (:28); source_reference_test.exs:201 plants samplers and a stale page.

## Mutants

| Mutant | Result |
|---|---|
| card.ts:89 `&&`->`\|\|` (mutate_diff) | red-narrow |
| card.ts:89 drop return (mutate_diff) | red-narrow |
| dropdown-menu.tsx:21 `4`->`5` (mutate_diff) | red-narrow, killed only by the unrelated perf test "flow graph opens within 300 ms"; the handback said BASELINE-RED |
| Generic.tsx:165 `onSelect` skips `reveal` (manual) | red, cards.test.ts |
| Generic.tsx:271 `about` returns undefined (manual) | red, cards.test.ts |
| templates.tsx:69 description hidden (manual) | red, cards.test.ts |

## Findings

1. **should-fix** bin/source_reference.py:140 merges every shape's `properties` into one table.
   - `actions` has two closed shapes (`additionalProperties: false`): source.ActionDefinition (command, input, accessibility) and source.ScriptedAction (aliases, outcomes, cooldown, craft, check).
   - The page lists them in one table with no shape marker, and `target` shows only ScriptedTarget, because the last shape wins.
   - Scenario: the owner adds `cooldown` to the command action cartridges/build_sampler/actions/buy_plot.json, as the guide suggests. The compiler refuses it as UNKNOWN_FIELD.
   - Fix: one table per shape, as source-kinds.gen.md does.
2. **nit** The area bundles (`areas/<name>.json`, :124) are skipped. Only examples are lost, and no sampler has areas today.
3. **nit** card.ts:87 has no `items.$ref` fallback, so behaviours.params and structures.variants show an empty cell. The cell is empty, not wrong.
4. **nit** No test covers the single-file kinds (facts, attributes, resources, cartridge) or the World and Choices `about` wiring.
5. **nit** The `*_sampler` glob also reads untracked local scratch copies, so `--check` can differ locally from CI.
6. **nit** The PR body cites the field merge as :138; it is at :140.
