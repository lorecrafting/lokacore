# Review: c1-attributes (attributes@1, `stat_compare`, `resource_compare`)

- PR: #133, branch `c1-attributes`, commit reviewed `6556bcd` (CI green: changes, bundle, lint, elixir, sim, typescript).
- Reviewer: fresh Opus, independent. Full review (both kernels' loaders, policy, schemas).
- Inputs: brief `c1-attributes-brief.md` with the PM settlement (Q1-Q5 as recommended); plan §3 slice 3, triage 3, 9;
  `docs/system/{mechanics,cartridge,protocol}.md`; 06 §21 and 00 §4.3 amendments (commit 2, read first).
- **Verdict: APPROVE WITH NOTES.** No blocker, no should-fix. Three nits.

## Requirements written before reading the code

1. `attributes.json` = `{"attributes": {key: {start}}}` becomes AttributeSpec `{key, start}` (ResourceInt), an
   authored `key` is `UNKNOWN_FIELD`; the file makes the source v2; no engine default stats.
2. `stat_compare {attribute, at_least}` holds iff the attribute's `start >= at_least`; `resource_compare
   {resource, at_least}` holds iff the current (regenerated) value of the pool on the actor's body `>= at_least`;
   no body gives false. No comparator; `not`/`all` compose.
3. Both leaves and the `attribute` kind are owned by `attributes@1`, which is not auto-locked: without the lock,
   `UNDECLARED_CAPABILITY` in the compiler and the loader.
4. An unresolved `attribute`/`resource` is `UNRESOLVED_REFERENCE` at the leaf member, in both kernels; short refs
   expand.
5. No saved state, delta op, GameView field; every content hash, compiled fixture, trace pin and frozen fixture case
   unchanged; the `checks.ex` split changes no behaviour.

## Checks against the list

- 1-4: hold (code, fixtures, probes below). Elixir `Resources.attributes/1` reuses the per-entry validation;
  TS `World.attributes` via `byRef`; `policy.ts:59-67` `atLeast`; lock walk `cartridge.ts:189-191`; refStage
  `cartridge_refs.ts:165-166`; `@ref_fields` `checks.ex:20-21`; registry row `definitions`/`policies`.
- v1 `resource_compare` (`compiler.ex` `Checks.check(..., %{defs | "resource" => %{}})`): matches the TS loader,
  which sees no pools in a v1 artifact (Elixir test `content_attributes_test.exs:132`).
- 5: split commit `091c823` is a verbatim move of `requirements/3`, `range`, `pins`, `version`, `capability` into
  `Requires.check/3` (diffed both ways). All 13 `cartridges/*` compiled on `origin/main` and on `6556bcd`:
  byte-identical artifacts (bell, details, dusk, errand, facts, ferry, gate, green, hello, items, road, rooms,
  lantern_proof). No `cartridge_*_hash.json`, compiled fixture, transcript or trace file in the diff.
- Frozen fixtures: `invalid.json` 563 old cases unchanged, 10 added. `cartridge_loader.json`: 6 cases added; the
  header `description` gains one clause naming the new cases' derivation (only edit). Each new case's
  `content_hash` recomputed independently in Python (sha256 over sorted-key compact JSON of `cartridge`): all 6 match.
- Composes-with (emergence principles): `policy.ts` calls resource@1's `level` and `bodyOf`; the 06 §21 amendment
  requires reading the pool "as resource@1 derives it", so not a finding. No content named in capability code.
- Over-engineering: none found. `atLeast` is 6 lines; loading in `resources.ex` reuses `collect`/`diags`.
- `bin/check_all.sh` green at `6556bcd` (full install).

## Mutants (throwaway detached worktree, full install; each reverted)

| # | Mutant | Result |
|---|---|---|
| M1 | `stat_compare` `>=` to `>` | TS red |
| M2 | `resource_compare` `>=` to `>` | TS red |
| M3 | pool read on the actor id, not `bodyOf` | TS red |
| M4 | pool reads `spec.start`, not `level` | TS red |
| M5 | TS lock walk drops `attribute` (definition without the lock) | TS red |
| M6/M7 | TS refStage drops the `stat_compare` / `resource_compare` check (stat missing from content) | TS red |
| M8 | TS keyStage drops `attributes` | TS red |
| M9 | registry `attributes.policies` emptied (leaf evaluated without the lock), contracts regenerated | Elixir red, TS red (first TS run was green only because `contracts.gen.ts` was not regenerated: harness artifact, not a survivor) |
| M10 | Elixir attribute lock check dropped | Elixir red |
| M11 | Elixir AttributeSpec validation skipped (compiler/loader disagree on malformed `attributes.json`) | Elixir red |
| M12 | Elixir v1 sees the default pools | Elixir red |
| M13 | Elixir `@ref_fields` `stat_compare` dropped | Elixir red |
| M14 | file-level `additionalProperties: false` dropped in `Resources.file_schema/1` | **survives** (N-3) |
| M15 | TS `stat_compare` reads a missing attribute as 0 | survives; equivalent: refStage rejects an unresolved attribute before any evaluation |

Schema sweep sample (contracts regenerated per mutant): S1 `stat_compare` `at_least` not required, S2
`resource_compare` `at_least` unbounded, S4 `AttributeSpec.start` unbounded: red in both kernels; S3
`AttributeSpec` without `additionalProperties: false`: generator rejects (subset).

## Probes (Elixir compile of `ashmere_road` + `attributes@1`; TS load)

A `{"attributes": 5}` one SCHEMA_VIOLATION; B `start: "x"` one SCHEMA_VIOLATION, no cascading unresolved; C key
`Str` pattern_mismatch; D full ref of kind `resource` in `attribute` UNRESOLVED_REFERENCE; E `resource_compare` on
an attribute name UNRESOLVED_REFERENCE; F extra top-level key UNKNOWN_FIELD; G an attribute named `hp` with both
leaves on `hp` compiles and loads in TS; H truncated JSON INVALID_JSON; I `{"attributes": {}}` +
`stat_compare str` UNRESOLVED_REFERENCE. No compiler/loader disagreement found.

## Findings

- **N-1 (nit)** `docs/system/cartridge.md:31` cites `lib/loka/content/resources.ex:135`, a blank line at every
  commit of the PR; `def requires` is `:141`. `docs/world-parameters.md:33` W11 `:135-152` should be `:141-155`
  (`requires` and `specs`). The PR body says the c1-numbers N-1 is fixed at `:135 (def requires)`; it is not.
  Scenario: a reader following the pointer lands on the blank line before the `@doc`.
- **N-2 (nit)** `docs/world-parameters.md:42` W20 cites `policy.ts:43-42`, an inverted range from the mechanical
  shift; should be `:43-44` (the `time_window` hour and comparison).
- **N-3 (nit, pre-existing for `resources.json`)** `lib/loka/content/resources.ex` `file_schema/1`
  `"additionalProperties" => false` has no test for either file (M14 survives). Scenario: the line is dropped and
  `{"attributes": {"str": {"start": 14}}, "dex": {"start": 12}}` compiles silently without `dex`; a later
  `stat_compare dex` still fails closed (UNRESOLVED_REFERENCE), hence a nit.

Not raised: `protocol.md` `contracts.gen.ts:349`/`:350` land on `UnavailableReason`/`VersionedPolicy`; they
already did at `:347`/`:348` on `main` (pre-existing drift, shifted consistently).

## Conflicts with #132 c1-doors (in review separately)

Trial merge of `origin/c1-doors` into `6556bcd`: text conflicts in `docs/system/protocol.md`,
`docs/world-parameters.md`, `kernel/ts/src/contracts.gen.ts`; `protocol/fixtures/invalid.json` and
`docs/system/mechanics.md` auto-merge. The PR merged second regenerates the contracts
(`elixir bin/contracts.exs`), re-shifts the `policy.ts`/`world.ts`/`decision.ts` pointers, and checks that the merged
`invalid.json` parses and its suites pass.

Codex Sol review: appended by the PM.
