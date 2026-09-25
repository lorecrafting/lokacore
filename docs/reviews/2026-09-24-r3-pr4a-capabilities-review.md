# Independent review: PR #12 "R3 PR 4a: capability registry, lock and manifests"

- Reviewed commit: `0995551` (branch `r3-pr4-registries`, one commit on `main` at `71ca477`)
- Reviewer: Claude Fable 5.1 (fresh agent; authored none of the work; Fable because the
  slice freezes the capability-lock format and extends the schema subset)
- Date: 2026-09-24
- Depth: full (contract freeze), per [WORKFLOW.md](../WORKFLOW.md) "Review stance"
- Checks run in a detached worktree at `0995551`: `bin/check_all.sh`, exit 0 when run in
  two parts (the fresh worktree had no `mobile/app/node_modules`, so the script stopped at
  its TypeScript gate; the TypeScript half was then run by hand): `mix test` 81/81,
  `elixir bin/contracts.exs --check`, xref cycles and compile-connected at zero, Credo
  strict, both size checks, `bin/red_controls.exs` including the new map control,
  `ast-grep test`, `ast-grep scan --error`, `bin/lint_red_controls.sh`, `check_docs`,
  `tsc` and `node --test` 24/24, kernel and TS-size red controls, Prettier, mobile `tsc`.

## What must be true (derived from the spec before reading the diff)

From 14 §R3A and Gate R3, 05 §3, §4, §6, §11, §12, §20, §22, 07 §12 and §15, 09 §21,
00a §1, 21 §28, 01 A5 and the frozen numeric profile:

1. The capability registry is machine-readable and enumerable; every entry has a key, a
   version and a portability in {portable, server_only, client_presentation_only}; the
   chapter-one set is the 37 capabilities of 00a §1, all at version 1 and all portable
   (00a §1 last line, 21 §28).
2. The lock pins exact capability versions and nothing else; it is canonical and
   reproducible; `capability_lock_hash` is SHA-256 over the canonical bytes under
   `loka-numeric-v1` (ASCII keys sorted by byte, duplicate keys rejected); the lock is part
   of the semantic hash, never signatures or catalog metadata (05 §3, §6, §11; 09 §21).
3. Residency follows the 05 §6 matrix: a portable capability is a portable semantic
   foundation or a portable capability implementation; server_only is a Realm-only semantic
   capability; client_presentation_only is client presentation; authority-host coordination
   and authoring/certification are never a capability's residency; unknowns stay null.
4. Manifests carry the 05 §3 fields with each version field separate, none standing in for
   another (05 §3 "Version vocabulary"); a deployment names one exact cartridge release and
   a profile (05 §22); a campaign pins exact releases (07 §15); `cartridge_id@version` names
   exactly one hash (05 §12).
5. The subset extension is closed: the checker rejects every form outside "map = object
   with no `properties`, `additionalProperties` as the value schema, optional
   `propertyNames: {pattern}` and `maxProperties`"; the two validators agree on map keys
   (pattern, count, JSON-pointer paths, error order); the generator emits a matching type;
   the new red control fails on its planted schema.
6. Expected values never come from the code under test; the known-answer hash is
   reproducible independently.

## Verdict: APPROVE WITH NOTES

All six hold. The registry, lock fixture and manifest examples were checked against 00a §1
by script: the same 37 `key@1` pins, in the spec's order, and the same five client
features and title. The known answer was recomputed here from the fixture's `value` with
Python `json.dumps(sort_keys=True, separators=(',', ':'))` and `hashlib.sha256`: the bytes
and `df07f06a4900fa8e7b9c5a9528d6350ab23983b76ffa270564c552f6bd4df0ee` match. The
`format` tag sits inside the hashed bytes, so a lock hash cannot collide with another
domain's hash of the same map. Nothing in the schemas goes beyond the spec except the two
normalized shapes noted in finding 2, both flagged by the developer as open questions.

Two should-fix findings, neither about wrong behavior: a test gap that lets the
chapter-one registry drift from 00a §1 unnoticed, and a spec-amendment record for the
normalized manifest shapes. Both are small.

### Differential (Elixir vs TypeScript)

31 hand-built values run through both validators with identical results, including: map
keys that are empty, `~`/`/` (pointer escaping `~0`/`~1`), `__proto__`, Latin-1, high-BMP
(`Ａ` U+FF21, U+E000, U+FFFF) and astral (`𝒶`, U+1F600) code points; 40-key maps (over
Elixir's 32-key sorted-map threshold) with mixed valid and invalid keys and values;
`maxProperties` at 0, exactly the limit, and one over; a map value that is null, an
object, an array, a string, a boolean, or an integer just outside the safe range; unknown
non-ASCII keys on an existing closed contract (`DefinitionRef`), which confirms the new
code-point ordering also fixes existing contracts; and every new manifest/capability
contract with malformed fields. The code-point comparator is Elixir's byte order for valid
UTF-8, so the two sorts are the same order by construction.

### Test the tests (mutants, each reverted)

| Mutant | Result |
|---|---|
| TS `cmp` back to `<` (UTF-16 code units) | 1 test fails (the astral/high-BMP fixture) |
| TS `cmp` compares length first | 1 test fails |
| TS `propertyNames` returns no errors | 1 test fails |
| Elixir map values not validated | 1 test fails |
| Elixir errors sorted by code then path | 1 test fails |
| Elixir key error reported at the map's path, not the key's | 1 test fails |
| Subset checker: `propertyNames` may carry another keyword | 1 test fails |
| Subset checker: `map?/1` always false (`propertyNames`/`maxProperties` on a closed object) | 2 tests fail |
| Registry: `commerce@1` changed to `server_only` + `realm_only_capability` (a valid entry) | **0 tests fail** (finding 1) |

The developer's seven mutants were not repeated. The new red control ("a map with declared
properties fails compilation") reported its planted case in `bin/red_controls.exs`.

## Findings

### Should-fix

1. **The chapter-one lock's portability is unchecked.**
   `test/loka/core/contracts_test.exs:47-54`, `kernel/ts/test/validate.test.ts:33-44`.
   Both tests prove every registry entry is a valid `CapabilitySpec` and every lock pin is
   registered, but not that the pinned capabilities are `portable`. Scenario: someone
   reclassifies `commerce@1` as `server_only` with `realm_only_capability` (a valid entry);
   `mix test` 81/81 and `node --test` 24/24 stay green, yet 00a §1 says every listed
   capability is portable and the `CartridgeManifest` example declares only
   `offline_private`, whose compilation must reject a server-only gameplay dependency (05 §6,
   07 §12). The compiler that would catch it is R4. The developer's "residency planted as
   `realm_only_capability` on portable entries" mutant only exercised the oneOf coupling.
   Fix: in the existing lock-coverage loop of each test, assert the matching registry
   entry's `portability` is `"portable"` (one line per kernel; the fixture's lock is the
   chapter-one lock, so the assertion is 00a §1's own sentence).

2. **Two normalized manifest shapes differ from the spec's written form and are recorded
   nowhere but the schema.** `protocol/manifest.schema.json:57-77` (`KernelApiRange` as
   `{at_least, below}` where 05 §3 and 00a §1 write `">=1.3 <2.0"`) and `:95-97`
   (`requires.capabilities` as a key-to-version map where the spec writes a list of
   `key@version` strings). Both are reasonable normalized forms and both are flagged as
   open question 5, but spec README §11 says amend first, then code, and R3 PR 1 recorded
   its freeze under IMPORT.md "Amendments since import". Scenario: the R4 compiler author
   reads 05 §3, emits `capabilities: ["movement@1"]` and a range string, and the manifest
   fails validation with no spec sentence saying which form is the normalized one.
   Fix: once the owner answers question 5, add one amendment line to
   [IMPORT.md](../spec/IMPORT.md#amendments-since-import) (or a sentence in 05 §3) naming
   the normalized manifest form and pointing at `protocol/manifest.schema.json`.

### Nits

1. Three spellings of "lowercase snake_case, at most 64": `CapabilityKey`, `ClientFeature`
   and `CampaignId` use `^[a-z][a-z0-9_]{0,63}$`; `CartridgeId`
   (`protocol/identity.schema.json:9-10`) uses `^[a-z][a-z0-9_]*$` plus `maxLength: 64`;
   `CapabilityVersions.propertyNames` (`protocol/capability.schema.json:29`) repeats the
   key pattern literally (unavoidable in the subset, as the developer noted). Pick one style
   for the new types.
2. `ContentHash` (`protocol/manifest.schema.json:16`) says a cartridge hash is `hash(v)` of
   one canonical value. 05 §11 lists several inputs (definitions, rule IR, asset and
   localization manifests, requirements and lock) and leaves their composition to R4. Say
   "SHA-256 as 64 lowercase hex digits" and leave how the input is formed to R4, so the
   description does not become an accidental commitment.
3. `CartridgeManifest.title` has `minLength: 1` (`protocol/manifest.schema.json:171-174`),
   which the spec does not ask for. Harmless; either keep it knowingly or drop it.
4. A key that fails `propertyNames` and a value that fails its schema report at the same
   JSON pointer (`lib/loka/core/contracts.ex:93-94`, `kernel/ts/src/validate.ts:94-97`):
   with a string value schema that also has a `pattern`, `{"b": "y"}` yields two identical
   `pattern_mismatch` errors at `/b`. Both kernels agree (no differential risk) and RFC
   6901 has no pointer to a key, so this is a design note: if a consumer ever needs to tell
   key from value, a distinct code (`invalid_property_name`) is the compatible way.

### Parallel PRs (#11, #13): conflicts to expect, no duplication seen

PR #13 also appends to the `ErrorCode` enum tail (`conflicting_write` vs this PR's
`too_many_properties`) and to `error_registry.json`, adds to `subset.schema.json`,
`invalid.json`, `contracts_test.exs`, `validate.test.ts`, and regenerates
`contracts.gen.ts` and `subset.gen.ts`; it also edits the `schema.ex` moduledoc paragraph
this PR rewrote. PR #11 touches `contracts.gen.ts`, `invalid.json` and
`contracts_test.exs`. All are textual conflicts between independent changes: whichever
merges second must rerun `elixir bin/contracts.exs` and the check line rather than resolve
the generated files by hand. Concept-wise nothing overlaps: #11's feature envelopes and
#13's command/delta/event/policy registries are exactly what this PR left out of
`CapabilitySpec`, and #13's invariant registry is where the deferred version-immutability
rule belongs.

## Views on the owner's open questions (PR description, 1-9)

In plain language, with whether the owner is really needed.

1. **Lock hash domain tag.** Accept. The tag `loka-capability-lock-v1` is inside the bytes
   that get hashed, so a lock's hash can never be mistaken for the hash of anything else,
   and changing the format later means a new tag, not a silent change. Engineering detail;
   the PM's default is fine.
2. **Lock contents (capability versions only).** Accept. The spec already says the lock
   pins exact capability versions and the manifest carries the other version pins (05 §3,
   §11); both end up inside the semantic hash anyway. Engineering detail.
3. **Residency reporting fields (adapters, fixtures).** Defer. There is nothing to report
   until host adapters and conformance fixtures exist (R4/R5); adding empty fields now would
   be invented shape. Engineering detail.
4. **Are policy, target_resolution and fact "foundation" or "capability"?** Not really an
   owner question. Plain version: are these three the rules of the game itself, or features
   built on top of the rules? 14 §R3A lists all three as constitutional contracts, the same
   tier as the delta/event/error semantics that 05 §6 puts in the "portable semantic
   foundation" row, so my answer is foundation. Nothing reads residency before the gate PR
   (6b) that emits the residency matrix; the PM can set it there.
5. **kernel_api range shape.** This one does need the owner, only because it changes a
   written form in the spec (05 §3 shows `">=1.3 <2.0"`), and spec changes are the owner's
   call. Recommendation: accept `{at_least, below}` as the normalized (compiled) form,
   keep the `">=1.3 <2.0"` string in authored YAML with the compiler translating, add no
   other range forms until a cartridge needs one, and record the answer per finding 2.
6. **Profile names for party, embedded instance, shared realm area.** Owner-adjacent
   (product naming) but not urgent: nothing before R4 uses them, and the spec says exact
   vocabularies freeze when first exercised (14 §R3B). Suggest the PM proposes the spec's
   own words (`party`, `embedded_instance`, `shared_realm_area`) when the first deployment
   of that kind is built, and adds nothing now.
7. **Size limits on lock, profiles, cartridges, client features.** A safety posture the PM
   can default with the owner's nod. Recommendation: no counts in the schemas now (the
   chapter-one lock has 37 entries; the canonical decoder already bounds nesting depth;
   nothing is downloadable before R4 and the PREP-03 store review). Put a byte cap on the
   download boundary in R4, where the untrusted input actually arrives.
8. **Deployment identity and overlays, campaign continuity fields.** Agree to leave out.
   Overlays are "separately hashed and certified" (05 §22) with no field vocabulary yet, and
   14 §R3B says such shapes freeze with their feature. Engineering detail.
9. **Deferred manifest fields (campaign, chapter, time_policy, activation groups, entry,
   continuity, locales).** Agree. 00a says its field names are illustrative until the
   feature freezes; `entry` and `locales` appear in 05 §3 too, but rooms and localization
   do not exist before R5 and 05 §18. Engineering detail.

Truly needing the owner: 5 (a spec deviation), and a nod on 6 and 7 when they come up.
The rest can take the PM's defaults.
