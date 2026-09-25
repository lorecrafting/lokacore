# Independent review: PR #11 "R3 PR 6a: R3B feature envelopes; lanes, CommandId and auto-merge decisions"

- Reviewed commit: `018ccbf` (branch `r3-pr6a-envelopes`)
- Reviewer: Claude Opus 5.5 (fresh agent; authored none of the work)
- Date: 2026-09-24
- Depth: short for the docs commits; test-the-tests for the contract commit, per
  [WORKFLOW.md](../WORKFLOW.md) "Review stance"
- Checks run in a throwaway detached worktree at `018ccbf`: `mix test` 69/69, kernel/ts
  `npm test` 22/22, `elixir bin/contracts.exs --check` exit 0, then ten schema/registry
  mutants (below). CI green on all five jobs (PM verified).

## What must be true (derived from the spec before reading the diff)

From 14 §R3B and its freeze paragraph, the R5/R7/R8 build lists, 21 §1, §24, §26 and the
sections of 21 for each named envelope, 06 §33-§34, 05 §4, §5 and §25:

1. Every 14 §R3B bullet has a machine-readable kind (12 bullets; slashes may split).
2. Each kind is versioned, referenceable and registered, so R4-R6 cannot invent
   incompatible shapes; exact field vocabularies are not designed here.
3. No unstable anonymous map: until a kind freezes, nothing may carry unvalidated fields.
4. Each kind's freeze milestone follows 14 §R3B: R5 for ActionRecipe/InspectableDetail/
   Connection/Barrier and other foundation-world shapes *before portable world rules depend
   on them*; R7 for narrative/Scene/consequence shapes; InstancePlan when pulled; R8 for
   living-world/population/commerce/service/world-event, each with first use.
5. Both validators enforce the contract against hand-written expected errors, and each
   check fails when the rule it guards is broken.

## Verdict: CHANGES REQUIRED

Requirements 1 to 3 hold; 4 holds except one entry (F2); 5 fails for the envelope's
`required` list (F1). Both fixes are one line each. The docs part is accurate.

## Findings

### F1 (blocker) `protocol/feature.schema.json:46`: the envelope's required fields are untested

Mutant M9 sets `FeatureEnvelope.required` to `[]`: `mix test --force` 69/69 and TS 22/22
stay green, so `{}` (and `{"kind": "barrier"}`, mutant M7) validate as feature envelopes. The
whole point of R3B is a *versioned* envelope; an envelope without `version` is exactly the
ambiguity 14 §R3B forbids, and nothing would catch its reintroduction. The ponytail pass
removed the fixture that covered this ("repeated existing `missing_property` coverage"); the
existing coverage is for other contracts, not this `required` list. Same gap for
`FeatureRegistryEntry.required` (line 78; mutant M10 drops `freeze`, all green), so a new
registry entry without a freeze milestone would pass the Elixir registry test.
Fix: one fixture, e.g. `{"contract": "FeatureEnvelope", "value": {}, "errors": [{"path":
"/kind", "code": "missing_property"}, {"path": "/version", "code": "missing_property"}]}`,
and one registry entry value omitting `freeze` (or fold it into the existing line 39 case).

### F2 (should-fix) `protocol/feature_registry.json:35`: `consequence_operator` freezes at R7, but R5 needs it

14 R5 builds "minimal ActionRecipe/ComposedAction execution over registered consequences",
and 14 §R3B freezes ActionRecipe at R5 "before portable world rules depend on them". A
compiled ActionRecipe declares "typed consequences" (21 §7) and "MUST NOT become an untyped
effect list". Scenario: the R5 slice freezes `action_recipe` v1 and reads this registry,
which says consequence operators stay unfrozen until R7; R5 must then either invent operator
shapes outside the registry (the incompatible-shape risk R3B exists to prevent) or leave
`consequences` open (the anonymous map it forbids). 14 §R3B's "R7 freezes each
narrative/Scene/consequence shape" reads naturally as narrative consequences (R7's "typed
quest outcome/consequence grammar"); the general rule is freeze at first use, which is R5.
Fix: `"freeze": "R5"` (later operators register with their own first use).
`narration_spec` at R7 is defensible (R7 build list names NarrationSpec; a minimal R5
ActionRecipe can omit narration), so it is not a finding.

### N1 (nit) `docs/ROADMAP.md:36`: the lane layout cites a decision that says "PR 4", not 4a/4b

The roadmap links the owner decision for "PR 3, PR 4a and PR 6a run in parallel", but the
verbatim record (item 1) says PR 3, PR 4 and PR 6a, and moving generated docs and the
residency matrix to 6b is recorded only in commit `f0da509`. Still three parallel lanes, so
consistent with the owner's choice; an auditor comparing the two sees an unsupported split.
Either say "PM split, not an owner decision" beside 4a/4b or leave as is.

## Checked and fine

- Decision record: `diff` against the PM source is empty (byte-identical); linked from
  `docs/decisions/README.md`.
- WORKFLOW PM row and step 7 match decision item 3 exactly (verdict, nothing open, every CI
  job green, merge commit; owner decisions, open after fix round 2 and Astra relays still go
  to the owner). No other doc (AGENTS.md, `.claude/agents/`) still says merges wait for the
  owner's OK; AGENTS.md "merge commits, never squash" agrees.
- ROADMAP arithmetic: R3 6 -> 8 (PR 4 and PR 6 each split); 8 + 3 + 8 + 6 + 5 + 4 = 34.
  Residency matrix and generated docs stay inside R3 (6b), so Gate R3 is unaffected.
- Coverage: all 12 14 §R3B bullets map to the 19 kinds. Every citation resolves to real
  text: 21 §3.4, §4 NarrationSpec, §5 Connection/Barrier, §6 InspectableDetail/
  DescriptionVariant, §7 ActionRecipe, §11 consequence vocabulary, §12 SpawnBundle/
  PopulationPlan, §13, §14 (CapacityPolicy/ServiceJob), §19 InstancePlan/SceneSpace, §20,
  §21; 05 §6 (ActionRecipe/ComposedAction row), 05 §25 subsections; 06 §33 (SceneInstance,
  SceneDefinition).
- Freeze milestones otherwise match 14 §R3B and the R5/R7/R8 build lists.
- The Elixir test compares registry kinds and the enum to a hand-written list, not to each
  other only; it names a real break (enum and registry drifting).
- Mutants caught: M1 drop `additionalProperties: false` and M3 version type `number`
  (schema subset rejects at compile); M2 drop `minimum` (Elixir and TS fail); M4 kind removed
  from enum only, M5 freeze `R6`, M8 drop spec `minLength` (Elixir fails; M8 also TS).
  M6 (a valid but different freeze value) survives by design: that is a decision, and a
  test for it would be a change detector.
- No over-engineering: one schema file, one registry, five fixtures, one test.

## Views on the developer's open questions

1. **Envelope body.** Agree. `additionalProperties: false` with no body is the only reading
   that satisfies "no unstable anonymous map" without designing fields; at freeze the
   envelope becomes a oneOf discriminated on `kind`, which the subset already supports.
2. **Kind granularity.** Agree. ActionRecipe/ComposedAction is one term in 21 §7 and 05 §6;
   commerce is one "typed commerce/merchant contract" in R8; Service/Capacity versus
   ServiceJob are separate R8 build items (composition primitives versus durable job model),
   and ServiceJob is runtime state like SceneInstance. Adding kinds later is additive.
3. **ReactionRule at R8.** Agree as the planned milestone ("typed ReactionRule evaluation" is
   R8). Caveat: 06 §33 lets a reaction start a scene; if an R7 slice needs one, 14 §R3B's
   "freeze with first use" freezes it then, and that slice updates the registry.
4. **Consequence operators.** Yes, freeze at R5; see F2.
5. **Identity.** Acceptable, with evidence: "reference" is DefinitionRef (an R3A contract in
   `protocol/identity.schema.json`, `kind` an open snake_case pattern that all 19 values
   satisfy), and "registration" is `feature_registry.json` plus `FeatureRegistryEntry`.
   Operator-level registration fields (21 §11 "Every operator declares target types, allowed
   scopes, ...") are field vocabulary, frozen with each kind. Runtime identity for
   SceneInstance and ServiceJob is per-kind field vocabulary too (06 §33 lists `id` and
   `definition_ref` in its representative state), so leaving it to R7/R8 is within 14 §R3B.
   Not a spec gap.

## Re-review (fix round 1)

- Reviewed commits: `11bb5d7`, `b4803f5`, `b966814` (head `b966814`); scoped to the fixes
- Checks in a throwaway detached worktree at `b966814`: `mix test --force` 69/69, kernel/ts
  22/22, `elixir bin/contracts.exs --check` exit 0

### Verdict: APPROVE

- **F1, fixed (`11bb5d7`).** Two fixtures in `protocol/fixtures/invalid.json`: `{}` against
  FeatureEnvelope expects `missing_property` at `/kind` and `/version`, and a registry entry
  without `freeze` expects `missing_property` at `/freeze`. Expected errors are hand-written.
  Re-ran the mutants: M7 (`required: ["kind"]`), M9 (`required: []`) and M10 (registry
  `required` drops `freeze`) each now fail one Elixir test and one TypeScript test.
- **F2, fixed (`b4803f5`).** `consequence_operator` freezes at R5; nothing else in the
  registry changed, and the registry test still passes.
- **N1, fixed (`b966814`).** The roadmap now says the decision predates the PM's later 4a/4b
  split. Accurate; the verbatim decision record is untouched.

Nothing open.
