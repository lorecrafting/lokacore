# Review: m11 doors (row W26) schema validation, second opinion

- Branch `toolbox/m11-doors`, exact commit `787116e767eee0f90cd644cabe7ce895d6b57e62` (base `b89bb97b`); Beads `loka-kgd.125`. Second opinion because portable foundation contracts changed ([WORKFLOW Review count](../WORKFLOW.md)); scope: `lib/loka/core/contracts.ex`, `lib/loka/content/source.ex` (source hour schema), `protocol/`, `contracts.gen.*`. Another reviewer covers the rest.
- Governing: [cartridge.md NPC door declarations](../system/cartridge.md#npc-door-declarations) ("the source validator tries the walking case, then the reference"), [contract lessons](../lessons/contracts.md) (every `required` needs a failing fixture; guards in both kernels).
- **Verdict: CHANGES REQUIRED** (one missing test; validator code sound).

## Must be true (written before the diff)

1. Both kernels accept and refuse the same values, with the same paths and codes, for every protocol `anyOf`.
2. No valid fixture or example now fails; no invalid fixture now passes; touched expected answers follow the spec change (`when` optional, `walks` const true).
3. The source shorthand `{room, walks: true}` and a full DefinitionRef hour are both accepted; each malformed one is refused at the trust boundary with its own path.
4. Each new `required`/`const` fails a test when removed.

## Evidence

- 1: every protocol `anyOf` (38) has type-disjoint branches (scratch scan); the subset check refuses overlap (`schema_test.exs:75`, red control `bin/red_controls.exs:116`), so `contracts.ex:145-152` reduces to the old selection on protocol and matches `validate.ts:131-134`. Only the runtime source schema has two object branches, and only Elixir validates source. Probe of 7 anyOf values (FactValue null/"Bad"/object/true, TextValue [], StatusDefinition duration true): identical in both kernels.
- 2: `validate.test.ts`, `doors.test.ts` 17 pass; `contracts_test.exs`, `contracts/schema_test.exs`, `content_{doors,ferry,schedules}_test.exs` 98 pass; `bin/contracts.exs --check` exit 0. `invalid.json:22628` drops `/0/when missing_property` for `/0/walks const_mismatch`, per the spec; `population_plan_walks_false` pins the plan's const.
- 4 (necessity): no schema-only shape works with the old first-typed-branch rule: walking case first refuses full refs, DefinitionRef first refuses the shorthand; the 6-line change is the smallest.
- Mutants (`contracts.ex:150-152`): M1 first typed branch only, red (ferry "full schedule rooms"); M2 last branch's errors, red (doors walks false); M3 `all?`, red. `source.ex:244`: M4 `required ~w(room)` **green**; M5 `required ~w(walks)` **green**.

## Findings

1. **blocker** `lib/loka/content/source.ex:244`, untested. With M4 a lone hour `{"room": "ferry_landing"}` in `ashmere_ferry` (kernel_api 1.0) compiles to `schedule_cases` with no 1.47 floor (`schedules.ex` counts only lists), an artifact the loader rejects. With M5 `{"walks": true}` gives `UNRESOLVED_REFERENCE` target `"@:/"`. Fix: in `content_doors_test.exs` assert `{room}` is SCHEMA_VIOLATION at `.walks` and `{walks: true}` at `.room` (`missing_property`; head already does this, scratch probe).
2. **nit** `contracts.ex:152` with `source.ex:240-246`: a full DefinitionRef hour with one bad field (`key` missing or `"Bad"`) now reports UNKNOWN_FIELD on `cartridge_id`, `cartridge_version`, `kind`, plus missing `room`/`walks`, instead of the base's single `.key` error. Still refused; misleading to authors.
