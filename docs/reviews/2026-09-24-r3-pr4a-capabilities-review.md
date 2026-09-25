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

## Cross-vendor review (Astra), relayed verbatim by the owner

Reviewed commit `0995551`, independently of the review above. The PM checked A1 against the spec before forwarding it: 07 §3 defines `party` and `shared_area`, and 09 §20 says these names reuse the canonical execution-profile vocabulary.

```text
VERDICT: CHANGES REQUIRED

FINDINGS:

A1 [should-fix] protocol/manifest.schema.json:24-27 (at 0995551380119e5a1d82cdfd2caa669cb977b41b) — ExecutionProfile rejects two profiles already explicitly named by the specification.
   Failure scenario: take an otherwise valid DeploymentManifest and change only profile to "party" or "shared_area" → [{"path":"/profile","code":"not_in_enum"}]. The same omission rejects these values in CartridgeManifest.supported_profiles.
   docs/spec/07-offline-storypacks-to-mmo.md §3 defines both exact spellings; docs/spec/09-cartridge-lab-certification.md §20 also explicitly selects them. Therefore the schema description and open question 6 incorrectly claim their names are unspecified.
   Add both enum members, regenerate the TypeScript contracts, and exercise valid manifests using each. Correct the invalid DeploymentManifest fixture that currently expects "party" to produce not_in_enum. This adds constitutional vocabulary, not multiplayer implementation.

QUESTIONS:

AQ1 — Is the exhaustive portability→residency mapping intended to become an explicitly approved policy? protocol/capability.schema.json makes server_only→realm_only_capability and client_presentation_only→client_presentation mandatory, and rejects null for both while accepting null for portable. I reproduced the null rejection. The known-class pairings are a reasonable interpretation of 05 §6’s responsibility boundaries, but that section does not explicitly prescribe this complete validation table or its asymmetric treatment of unclassified entries. Please distinguish the adopted implementation choice from a rule already stated by the specification. I would not demand an unrestricted cross-product: portable authoritative semantics living solely in a Realm evaluator would contradict the architecture. Without a demonstrated required counterexample, I am treating this as a policy-clarification question, not another correctness blocker.

VIEWS ON OPEN QUESTIONS 1–9:

1 — Accept the tagged lock hash. Independently reconstructed canonical UTF-8 is 545 bytes, with 37 capability keys and no trailing newline. Its SHA-256 is df07f06a4900fa8e7b9c5a9528d6350ab23983b76ffa270564c552f6bd4df0ee, exactly matching protocol/fixtures/capability_lock_hash.json. The format field supplies domain separation; do not include the resulting hash inside the lock being hashed.

2 — Accept capability→exact-version pins in the lock, with kernel_api, rule_ir and content_schema remaining separate manifest requirements. The schemas preserve these distinctions, also separating api_version, release version and client_features. Keeping Realm protocol_version out of the offline requirements is appropriate. R4 must resolve registry dependencies and bind both requirements and the resolved lock into the semantic artifact hash; schema validity alone does not establish registry membership or dependency closure.

3 — Accept deferring concrete adapter/fixture references until their implementation slices, and generated documentation/matrix output until the R3 gate. The gate report should distinguish declared residency from evidence that an implementation exists; missing bindings must not imply conformance. The expressly deferred version-immutability check is not a finding here, but it must precede the first certified/published dependency on a capability version.

4 — Keep the three null residencies for this PR rather than guess. Classify the actual responsibility being registered: shared value/result/AST contracts can be foundational, while their gameplay evaluators can be capability implementations. Being listed under R3A does not by itself settle the evaluator’s residency.

5 — Accept the half-open {at_least, below} representation as a deliberately selected minimal normalized range, not as something the example alone mandates. Explicitly approve the MAJOR.MINOR restriction. R4 should reject empty/reversed ranges and compare version components without lexical-order or unsafe-number errors; no generalized SemVer-range library is needed here.

6 — Fix A1: the existing names are "party" and "shared_area". “Embedded instance” does not justify inventing another ExecutionProfile solely from the prose; its relationship to hosting profile and placement/composition can remain an explicit later decision.

7 — No invented collection quotas are required to merge this contract slice. Choose resource limits before untrusted ingestion, at the responsible boundary. For deletion/simplification, replace repeated full chapter-one locks in ordinary manifest/schema examples with small representative locks; retain the independent 37-key hash fixture because it exercises the >32-key canonical-ordering case. Do not add caching or a larger registry framework merely to reduce small amounts of schema repetition.

8 — Accept the minimal pinned-release envelopes without speculative overlay, deployment-ID or continuity dictionaries. Before those features are exercised, specify typed fields and their hash ownership. Semantic overrides must receive the separately hashed/certified treatment required by 05 §22; they must not silently mutate the pinned cartridge.

9 — Accept the illustrative-field deferrals under R3B, provided each field freezes before its first dependent artifact or implementing slice. In particular, a compiler slice that needs entry or localization cannot postpone those contracts merely because the full chapter ships later. Continuing to reject unspecified fields is preferable to introducing an untyped escape hatch.

VERIFICATION:

Reviewed only 0995551380119e5a1d82cdfd2caa669cb977b41b; no repository or PR changes were made.

The map subset, Elixir validator, TypeScript validator and generator were inspected. I found no additional defect in map-versus-closed-object admission, schema-valued additionalProperties traversal/reference rewriting, generated Readonly<Record<string, T>>, empty-key pointers, ~ and / escaping, simultaneous key/value diagnostics, or inclusive maxProperties comparison.

Executed the unchanged TypeScript validator, verified against its Git blob hash, using validation-relevant schema slices from this commit: 13 map/lock cases, 14 count-boundary cases including limits 0, 1, 2, 32 and 33, and 512 Unicode diagnostic-order probes. Those passed their expected results. The profile rejection above was reproduced separately. Elixir and the generator were reviewed statically; BEAM was unavailable, so this is not a claim to have rerun the full suite or executed cross-kernel differential tests.

The new TypeScript comparator matches UTF-8 lexical ordering for valid Unicode scalar strings, including BMP-versus-astral ordering and prefixes; comparing the ASCII error-code names also matches Elixir’s ordering. Importantly, loka-numeric-v1 rejects non-ASCII object keys before contract validation. The Unicode-key fixtures therefore exercise direct-validator diagnostics, not newly accepted wire inputs. I found no remaining ordering discrepancy within the documented decoded-value domain.
```

## Re-review (fix round 1)

- Reviewed commit: `1c9947d` (`0d9ea71` is a merge of `origin/main` with regeneration;
  `6e4dda0` appended the Astra review above). Same reviewer, scoped to the fixes.
- Checks in a fresh detached worktree at `1c9947d`: `bin/check_all.sh` end to end, exit 0
  (Elixir half by the script, TypeScript half by hand after `npm ci` in `mobile/app`):
  `mix test` 82/82, `node --test` 24/24, `contracts.exs --check`, all red controls, Credo,
  size, ast-grep, docs, Prettier, both `tsc`.
- Merge `0d9ea71`: its tree equals the clean merge of its parents (`git merge-tree`) except
  the two conflicted files, which were resolved as the plain union (one comma added in
  `invalid.json`); `elixir bin/contracts.exs --check` also passes at the merge commit itself.
- Owner decision record `docs/decisions/owner-decisions-r3-pr4a-2026-09-24.md`: byte-identical
  to the PM's copy (SHA-256 `b3d5d673…a187f`).

### Verdict: APPROVE

| Finding | Disposition | Verified |
|---|---|---|
| F1 chapter-one lock portability untested | Fixed: both kernels assert each lock pin's registry entry is `portable` (`test/loka/core/contracts_test.exs:64-75`, `kernel/ts/test/validate.test.ts:33-45`); an unregistered pin still fails (`nil["portability"]` / `undefined?.portability`). | Mutants: `commerce@1` flipped to `server_only`/`realm_only_capability` (a valid entry) now fails 1 test in each kernel; `tide@1` deleted from the registry fails 1 test in each kernel. |
| F2 normalized manifest forms unrecorded | Fixed: amendment line in `docs/spec/IMPORT.md` "Amendments since import" naming `{at_least, below}` (MAJOR.MINOR, half-open) and the key-to-version map, with the owner decision ("yes to both") linked and indexed in `docs/decisions/README.md`. | Read; decision byte-identical. |
| N1 three spellings of "snake_case ≤64" | Fixed: `CartridgeId` now `^[a-z][a-z0-9_]{0,63}$`, `maxLength` dropped; descriptions aligned. Side effect judged below. | Differential, 16 values, zero disagreements. |
| N2 `ContentHash` over-committed to `hash(v)` | Fixed: "SHA-256 as 64 lowercase hex digits"; payload formation left to R4. | Read. |
| N3 `title minLength: 1` | Dropped, fixture updated. | Read; fixture passes in both kernels. |
| N4 key/value errors share a pointer | Design note; no change asked. | n/a |
| Astra A1 `party`, `shared_area` missing | Fixed: both added to `ExecutionProfile`, examples for each (`ExecutionProfile` and `DeploymentManifest`), invalid fixture now uses `shared_realm`. Confirmed against 07 §3 (`### party`, `### shared_area`) and 09 §20 ("intentionally reuse the canonical execution-profile vocabulary"); `embedded_instance` correctly not invented. | Mutants (regenerated each time): `party` removed fails the examples test in both kernels; `shared_area` misspelled fails 2 tests in both. |
| Astra AQ1 residency table provenance | Description now says the table is the PM's adopted reading of 05 §6, not spec text. | Read. |
| Astra view 7 smaller example locks | Examples reduced to `{movement, fact}`; the 37-key known-answer fixture and the registry are byte-unchanged in this round. | `git diff --stat` shows neither file touched. |

**Side effect of N1 (CartridgeId).** A 65-character `cartridge_id` now reports
`pattern_mismatch` instead of `too_long` on `DefinitionRef` (merged in PR #9) and on the
new manifest contracts. Both kernels agree on every probe (65- and 64-character ids, empty
id, uppercase, non-ASCII; `DefinitionRef`, `CartridgeRelease`, `CartridgeManifest`,
`CampaignManifest`). `DefinitionRefString` has its own pattern and is byte-unchanged;
`ReleaseVersion`, `kind` and `key` still use `maxLength` and still report `too_long`.
Acceptable: no consumer reads these codes yet (nothing is published before R4), the
change is one code for one violation, and the fixtures were updated deliberately. If the
developer prefers one convention repo-wide, `kind`/`key`/`ReleaseVersion` are the remaining
`maxLength` users; not required.

Nothing else in `1c9947d` touched validator, checker or generator code; the direct callers
of the changed tests are the fixtures and the registry, both checked above.
