# Review: Field guide A, plain-English field help for prologue Part 1 kinds (loka-wfrgk.102 A)

- PR: #695 `docs/field-guide-a`
- Reviewed commit: `152dc5aa5d11a239064eeff5e7f8ba93659dc4c3`
- Governing: [WORKFLOW review stance](../WORKFLOW.md#review-stance), AGENTS.md "Writing tests",
  Beads loka-wfrgk.102 (the reader is the owner, a non-programmer writer; a misleading description is a must-fix)
- Independence: I wrote none of this slice. I worked in a detached review worktree.
- CI at head (`gh run list --commit`): ci passed, book-e2e passed, graph-diff passed
- Developer's `/code-review`: reported in the PR body (two runs)
- Verdict: **CHANGES REQUIRED** (one misleading description)

## Must be true (written before the diff)

1. The PR changes only descriptions: no type, enum, required, pattern or `$ref` changes, so no behavior changes.
2. Each rewritten description says what the engine does with the field, in plain words, with no spec cites or code names.
3. The guard fails on planted jargon or a spec cite, and on a field with no description, for every kind Part 1 uses.
4. The generated schemas/source still matches the generator.

## Checks that held

- Descriptions only: I stripped every `description` from the protocol and source schemas at the merge base and at head; the result showed 0 diffs (PR claim rerun 1).
- Accuracy: I read all 687 changed descriptions, weighting policy ops, steps and triggers, and those past line 800.
  I checked these against the engine, and all were accurate:
  - disposition `engage` (disposition.ts:109-134);
  - the `daily_schedule` room key;
  - the `item_acquired` emitters;
  - the `choice_opened` emitters;
  - `identified` bonuses;
  - `clock_hour`.
- Guard red controls:
  - Planting "(06 §5)" on `Connection.to` (protocol/room.schema.json:21) failed with `Connection.to: cites the spec`.
  - Removing that description failed with `Connection.to: no description`.
- Focused tests (PR claim rerun 2): content_source_schema_test and system_graph_test, 18 passed.
- Disputed /code-review items:
  - The fixed-string test of `SystemGraph.cites` (system_graph_test.exs:57) is acceptable. It tests the parser, and the assertions on the real graph remain.
  - The hardcoded prose help is a nit (finding 3).

## Mutants

`bin/mutate_diff.sh origin/main` at head gave 4 mutants, all red-narrow. This matches the handback.
Note that all four are `and`/`or` swaps inside description strings (compiler.ex:177,181 and source_schema.ex:86,87). Only the byte-for-byte generator test kills them, which is expected for a slice that changes descriptions only.

## Findings

1. **blocker** (the brief: a description that misleads about what a field does is a must-fix)
   protocol/step.schema.json:866: the mend `escrow` description copies the reward escrow text from :630.
   - It says ready_after, output, cancel refunds and an immediate trade apply.
   - Mend's escrow allows only items, quantity and custody (`additionalProperties: false`, step.schema.json:868-889).
   - Its items move to the custody room when the player pays (kernel/ts/src/mechanics/service/shared.ts:56,61,148).
   - A delayed order exists only for entitlement and build (shared.ts:170).
   - Scenario: the owner writes a mend expecting a delayed order the player can cancel; neither exists.
2. **nit** Room `tags`: "which also set the cost of moving in" is true only when `world.movement.terrain` gives that tag a fare.
3. **nit** lib/loka/content/source_schema.ex:84-90: the TextKey help is hand-written beside the pattern.
   - It already omits "must start with a letter".
   - Scenario: the pattern changes and the help keeps the old rule.
4. **nit** test/loka/content_source_schema_test.exs:69: the `defp gaps/2` clauses (:49, :69) are split by `jargon/2`, which gives a compile warning.
   CI compiles only lib with warnings as errors, so CI stays green.
5. **nit** Some jargon the guard does not catch remains:
   - "EntityId order" and "breadth first" (walks);
   - "authored instance" (witness);
   - "MAJOR.MINOR.PATCH" (DefinitionRef);
   - "emote.performed" (NPC emote step).

Settled, so not raised: the system graph's spec-link loss (loka-wfrgk.102.1).
