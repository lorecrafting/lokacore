# Independent review: PR #9 "R3 PR 2: contract toolchain and identity/scope/error contracts"

- Reviewed commit: `324015c` (branch `r3-pr2-contracts`; `857eee2` plus a merge of
  `origin/main` and two self-review fixes)
- Reviewer: Claude Fable 5.1 (fresh agent; authored none of the work; Fable because the
  slice freezes contract formats and the schema toolchain)
- Date: 2026-09-24
- Depth: full (contract freeze), per [WORKFLOW.md](../WORKFLOW.md) "Review stance"
- Checks run in a detached worktree at `324015c`: `bin/check_all.sh` end to end, exit 0
  (`mix test` 39/39, `elixir bin/contracts.exs --check`, xref cycles and compile-connected at
  zero, Credo strict, both size checks, `bin/red_controls.exs` including the three new
  contract controls, `ast-grep test`, `ast-grep scan --error`, `bin/lint_red_controls.sh`,
  `check_docs`, `tsc` and `node --test` 20/20, mobile `tsc`).

## What must be true (derived from the spec before reading the diff)

From 14 §R3/§R3A/Gate R3, 04 §3/§7/§12/§21, 03 §2/§3/§6, 05 §4, 02 §1 and the frozen
numeric profile:

1. `protocol/` is the one source; TypeScript types and Elixir validation derive from it;
   no hand-maintained duplicate catalogs (04 §12, Gate R3).
2. StateScope is exactly player / party / instance / realm, each with its typed id, and a
   missing id never defaults to realm (03 §6).
3. The logical world id is nominally distinct from AuthorityDomainId, ZoneShardId and
   RealmId; the instance scope carries the logical world id, never a placement or fencing
   token (03 §6 "Logical world identity is not mutation-owner placement").
4. AudiencePolicy (public, player, party, instance, audience_set) is a separate axis from
   StateScope (03 §6 "independent axes").
5. DefinitionRef has cartridge_id, cartridge_version, kind, key; the canonical string is
   `cartridge_id@version:kind/key` (03 §2, 05 §4).
6. Runtime ids are UUIDs (03 §3); IdSource emits lowercase 8-4-4-4-12 (numeric profile).
7. The error registry holds 04 §7's fourteen codes and the ten frozen ABI codes, as stable
   machine codes (04 §7).
8. `Loka.Core` has no runtime filesystem, process or host dependency (02 §1).
9. The schema subset fails closed; the two validators accept and reject the same values
   with the same paths and codes; the drift check and each red control can fail.

## Verdict: APPROVE WITH NOTES

Requirements 1 to 8 hold. The contracts match 03 §6 exactly: instance scope and instance
audience carry `WorldContextId`; `AuthorityDomainId` and `ZoneShardId` exist as their own
named ids and appear in no scope; realm scope carries `RealmId`; there is no default branch.
The two validators agreed on all 8,653 differential cases (evidence below), the drift check
trips on every kind of in-place schema edit, and the planted controls fail as required.

Requirement 9 holds for every keyword but not for the `pattern` keyword's argument (F1):
the subset accepts any pattern PCRE compiles, and JavaScript's `u` mode rejects or
reinterprets several PCRE constructs, so a future schema can pass every check while the two
validators disagree. The contracts in this PR use only portable pattern syntax, so nothing
shipped here is wrong; the gap is in the toolchain being frozen. Three should-fix items
belong in the fix round; two nits.

## Evidence

**Differential agreement.** An 8,653-case corpus in the canonical domain (integers,
strings, booleans, null, arrays, ASCII-keyed objects): every example under every contract
(cross-contract), 6,000 one-to-three-step mutations of the examples and registry entries
(character substitution and insertion from an alphabet of `\n`, `\r`, U+2028, U+2029,
U+0085, U+00A0, U+FEFF, combining U+0301, `e`+U+0301, astral letters, Kelvin sign, long s,
Arabic-Indic digit, fullwidth `a`, NUL, DEL, `~`, `/`, quotes; case changes; length
doubling; key renames to `""`, `~`, `/`, `a/b~c`, `__proto__`, `constructor`, `toString`,
`hasOwnProperty`, `length`, `prototype`, digit keys; unsafe integers), 1,500 random values,
exact 63/64/65 boundaries for every segment, version, astral and combining-mark lengths and
`audience_set` sizes, multi-error objects for sort order, and prototype names as contract
names. Elixir results came from `Loka.Core.Contracts.validate/3`, TypeScript from
`validate()`; the corpus was decoded with each runtime's stdlib JSON. **Zero
disagreements, zero TypeScript throws.** Codes reached: unknown_property 4,224,
missing_property 2,702, invalid_type 2,157, pattern_mismatch 1,493, not_in_enum 1,422,
unknown_variant 127, too_short 18, const_mismatch 11, unknown_contract 7, too_long 5,
above_maximum 4, too_few_items 4, below_minimum 3, too_many_items 2.

**Drift check.** Editing a description, an example or a pattern in an existing schema, and
hand-editing a brand in `contracts.gen.ts`, each make `--check` exit 1; a whitespace-only
reformat does not. The three new red controls (`stale`, `unsupported keyword` at compile,
`unsupported keyword` at generation) fail as required in `bin/red_controls.exs`.

**Mutation check (test the tests).** 26 hand mutants, each reverted:

| Mutant | Result |
|---|---|
| Elixir: `minLength >=`→`>`, `maximum <=`→`<`, oneOf missing discriminator → `[]`, drop `:dollar_endonly`, no sort, graphemes instead of code points, accept unknown properties, unsafe integers accepted | killed |
| Schema: `additionalProperties` any boolean, unknown-keyword check off, required-not-declared off, repeated oneOf tag allowed, pattern compile unchecked | killed |
| TS: UTF-16 length, `isInteger` for `isSafeInteger`, no sort, pointer escape order swapped, unknown variant falls back to branch 0 | killed |
| Elixir and TS: `maxLength <=`→`<`, `minItems >=`→`>`, `maxItems <=`→`<` | **survived** (F2) |
| Schema: `duplicates/1` removed | **survived** (F3) |
| TS: `new RegExp(p)` without `u` | **survived** (folded into F1) |

**Pattern portability (F1), reproduced through the toolchain.** With a temporary
`protocol/zz_probe.schema.json` holding `DotProbe: {type: string, pattern: "^a.b$", examples:
["axb"]}` and `EscProbe: {type: object, properties: {opt: {type: string, pattern:
"^[a-z]+\\_x$"}}, examples: [{}]}`: `elixir bin/contracts.exs` exit 0, `mix test` 39/39,
`npm test` 20/20. Then `validate("DotProbe", "a\rb")` is `:ok` in Elixir and
`[{path: "", code: pattern_mismatch}]` in TypeScript; `validate("EscProbe", {opt: "a_x"})` is
`:ok` in Elixir and **throws** `Invalid regular expression: /^[a-z]+\_x$/u: Invalid escape`
in TypeScript. Direct probes with the validators' flags (`:unicode, :dollar_endonly` vs
`u`): `\_`, `\@`, `(?i)`, `\A` compile in PCRE and throw in JS; `.` matches `\r` and U+2028
in PCRE but not in JS; `\s` matches U+00A0 in JS but not in PCRE; `\w` and `\p{L}` agree.

## Findings

**F1 (should-fix)** `lib/loka/core/contracts/schema.ex:107` (`keyword("pattern", ...)`),
`kernel/ts/src/validate.ts:67`. The subset is closed over keywords but open over the
`pattern` argument: any PCRE-compilable pattern is accepted. Failure: the reproduction
above; a later schema using `.`, `\s`, or a non-syntax escape passes compile, generation,
`--check` and both suites, and the kernels then disagree (or TS throws) on real input.
Fix: at schema-check time accept only a portable grammar (anchors, ASCII literals,
`[...]` classes of ASCII members and ranges, `(...)`, `(?=...)`, `|`, `? * + {n} {n,m}`,
and escapes only of regex metacharacters), rejecting `.`, `\s \w \d \b`, inline flags,
`\p`, and any other backslash escape; add each rejected form to the "fails closed" test
list. Record in the module doc that Elixir compiles with `[:unicode, :dollar_endonly]` and
TypeScript with `u`, and add one probe fixture that only passes under `u` (for example
pattern `^[^a]$` against `"𝒶"`), so the surviving `u`-flag mutant dies.

**F2 (should-fix)** `protocol/identity.schema.json` and `protocol/scope.schema.json`
examples; `protocol/fixtures/subset.schema.json`. No example sits on a `maxLength`,
`minItems` or `maxItems` boundary, so the off-by-one mutants `<=`→`<` and `>=`→`>` survive
in both kernels (AGENTS.md "Mutation check": an off-by-one must fail a test). Failure: a
validator that rejects a 64-code-point `cartridge_id`, a one-member `audience_set` or a
64-member one passes every test. Fix: add a `DefinitionRef` example with a 64-code-point
segment, and `audience_set` examples with exactly 1 and exactly 64 members (or place the
boundaries in the probe schema).

**F3 (should-fix, small)** `lib/loka/core/contracts/schema.ex:58` (`duplicates/1`),
`test/loka/core/contracts_test.exs:45`. The cross-file duplicate-name guard has no test;
removing it survives. Failure: two schema files both defining `CharacterId` compile, and
`Map.new` silently keeps one of them. Fix: one two-file case in the "fails closed" list.

**N1 (nit)** `kernel/ts/src/validate.ts:4`. `SAFE` is imported and never used (`tsc` passes
because `noUnusedLocals` is off). Delete the import.

**N2 (nit)** `protocol/scope.schema.json`, `audience_set` description: "members must not
repeat (not checked by the schema subset)" states a MUST the contract cannot enforce, so a
value the prose calls invalid validates. Either say duplicates are permitted and carry no
meaning (set semantics), or add `uniqueItems` to the subset (see question 3).

Not findings, recorded for the fix round and later slices:

- `Loka.Core.Contracts` has compile-time edges to `Loka.Core.Canonical` and
  `Loka.Core.Contracts.Schema` (`mix xref graph --label compile`). The compile-connected
  check is at zero today because neither target has its own dependency; the first runtime
  dependency added to either will trip `--fail-above 0` and need the reviewed allowed list.
- In Elixir the nine ids are nominally distinct only by contract name until PR 3's structs;
  at the JSON level a `ZoneShardId` string validates as a `WorldContextId`. Inherent to JSON;
  the TypeScript brands carry the distinction now.
- The narrowed `File` lint admits `File` only inside a `@attr ...` expression. I found no
  runtime escape: `@x` inside a function body is a compile error, `@x || File.read!(p)`,
  `@x.(File.read!(p))` and `@x[File.read!(p)]` are all caught (the first is a test case).
  The compile-time read of `protocol/` is the mechanism 04 §12 asks for and the brief
  approves; `Loka.Core` still has no runtime filesystem dependency.
- Size and Credo: every file and function within limits, no `credo:disable` or
  `size: allow` comments. `contracts.gen.ts` is exempt by name and holds the long lines.
- Over-engineering: nothing to cut. `ErrorRegistryEntry` validates the registry's shape,
  the probe schema is the only way to exercise keywords no contract uses, `validate/3`'s
  `defs` argument is the smallest way to reach the probe. `Contract` and `DEFS` typing is
  used. The two `ponytail:` comments (pattern recompiled per call) name a real ceiling.
- The developer used `--no-verify` once to amend the merge commit message of `5557cfa`.
  Noted per the brief; the commit is a plain merge and the pushed head passed the full
  check line here and in CI. Not a code finding.

## Views on the six questions

1. **Ids are lowercase UUID strings of any version, CommandId included.** Accept. 04 §3
   says how CommandId is derived, not its shape, and the numeric profile treats it as an
   opaque string of Unicode scalars, so a UUID is consistent with both. It obliges PR 3 to
   derive CommandId as a UUID; the natural way is the IdSource construction with its own
   tag (a v8 UUID from the SHA-256 of `["loka-command-v1", idempotency_scope_id,
   invocation_id]`), which is deterministic and stable across authority handoff as 03 §6
   requires. Record that obligation as an owner decision so PR 3 cannot quietly widen the
   pattern. "Any version" admits the nil UUID for every id type; harmless.
2. **DefinitionRef segments lowercase snake_case, max 64, plain semver.** Accept. It fits
   every example in 03 §2 and 05 §4, and each rule can only be widened later (pre-release
   tags, longer segments) without invalidating stored values. 03 §2 says the canonical
   string "MAY be" this form; this PR makes it the form, which is what R3A is for. Record as
   an owner decision.
3. **`audience_set` without uniqueness.** Accept with N2: the semantics are a set, so a
   repeated member must be harmless to every consumer and the prose should say so rather
   than declare a MUST the validator cannot check. If the owner wants it enforced,
   `uniqueItems` is cheap and portable when equality is defined by canonical encoding
   (`Canonical.encode` exists in both kernels): about three lines each, plus a probe case.
4. **Instance scope uses `world_context_id`.** Correct, and the important one. 03 §6 names
   `WorldContextId / WorldInstanceId` as the logical context and forbids an instance id that
   doubles as a placement token; a separate "InstanceId" would recreate exactly that
   ambiguity. The IdSource tuple in the numeric profile already keys on `world_context_id`.
5. **`GameError.data` must be `{}`.** I would drop `data` for now. Nothing consumes it, every
   producer must emit `"data": {}`, and the future change (per-code fields) is not a
   widening of `{}` if any field becomes required, whereas adding `data` later as an
   optional property is backwards compatible with stored `{code}` values. If the owner
   prefers the field to exist from day one, the current shape is at least fail-closed.
6. **ErrorCode enum and `error_registry.json` both list the codes.** It is the same fact in
   two places, but the equality test already makes drift impossible, and it is not a change
   detector: it checks two artifacts a consumer relies on agreeing. Generating the enum from
   the registry would put registry-specific logic in a generic schema loader and make the
   schema file lie about its own content; generating the registry from the enum has nowhere
   to put category and description. Keep both with the test; no generator.

## Cross-vendor review (Astra), relayed verbatim by the owner

Reviewed commit `324015c`, independently of the review above. The PM checked findings A2–A4 against the code before forwarding them. A1 duplicates F1, which is already fixed in `99b0ba4`.

```text
ASTRA REVIEW
PR: lorecrafting/lokacore#9
Commit: 324015cd99de200440d0e0fbcf13c97a7baef246
Verdict: CHANGES REQUIRED

Requirements derived before reading the diff:
R1. Shared contracts must have one language-neutral, machine-readable source under protocol/, from which Elixir validation and TypeScript types are generated or checked; independently maintained portable catalogs are forbidden (04 §12, §21; 14 Gate R3).
R2. This slice must establish constitutional identity, scope and error contracts without prematurely implementing higher-level feature schemas, Builder operations or Realm transport; use the least code that correctly satisfies those obligations (14 R3A, R3B, Gate R3; AGENTS.md, Simplicity).
R3. DefinitionRef must identify an immutable cartridge release plus definition kind/key, support qualified identity without a global content-key namespace, and remain distinct from UUID-based runtime entity identity (03 §2–3; 05 §4).
R4. Logical world/context, mutation-authority domain, shard placement and Realm identities must have distinct nominal contracts; logical identity must not silently become a fencing or routing token (03 §6; 14 R3A).
R5. StateScope must explicitly distinguish player, party, instance and realm and require the corresponding identity; an omitted identity must never default to realm/global scope (03 §6).
R6. AudiencePolicy must remain independent of state ownership and authority placement; its eventual consumers must enforce visibility and interaction admission, not merely hide UI elements (03 §6).
R7. Errors must have stable machine-readable codes, with human-readable/localized presentation separate from the code and with a machine-readable diagnostic/error registry (04 §7; 14 R3A).
R8. Semantic Command identity must be derived/reused from trusted logical idempotency scope and invocation identity, remain stable through reconnect and authority handoff, and exclude ephemeral host metadata (04 §3, §21).
R9. Both kernels must preserve the frozen canonical profile: safe integers distinct from booleans, rejection of fractional/exponent input syntax, scalar Unicode, ASCII decoded object keys, duplicate-key rejection, deterministic ordering and the specified parsing/encoding errors (conformance/numeric-profile.md).
R10. Tests must use independently specified expected answers and exercise behavior rather than source text; realistic mutations and planted violations must actually make the relevant checks fail (AGENTS.md, Writing tests).

Findings:
A1 [should-fix] lib/loka/core/contracts/schema.ex:108
   Defect: Pattern admission checks only PCRE compatibility, so the supposedly portable subset accepts patterns that either crash the TypeScript validator or produce different validation results.
   Failure scenario: Add {"$defs":{"P":{"type":"string","pattern":"\\Aa\\z","examples":["a"]}}}; the subset checker accepts this PCRE pattern and Elixir accepts "a", but kernel/ts/src/validate.ts:67 constructs /\Aa\z/u and throws SyntaxError instead of returning validation errors.
   A second case shows that checking compilation in both engines would not be sufficient: {"type":"string","pattern":"^.$"} accepts a carriage-return string under the Elixir validator's PCRE options, while TypeScript returns [{"path":"","code":"pattern_mismatch"}].
   Suggested fix: Enforce a small explicitly portable pattern grammar, rejecting PCRE-only constructs and constructs with differing character semantics, and add literal cross-kernel regression cases for both failures.

A2 [should-fix] bin/contracts.exs:58
   Defect: Embedding canonical JSON directly as JavaScript object-literal source does not preserve JSON semantics for "__proto__" keys.
   Failure scenario: Define a closed object contract P with properties {"__proto__":{"type":"string"}} and examples [{}]; this is admitted by the subset checker, but the generated properties object treats "__proto__" as a prototype setter rather than an own property.
   For the input obtained from JSON.parse('{"__proto__":"ok"}'), Elixir recognizes the declared property and accepts the value, whereas TypeScript reports [{"path":"/__proto__","code":"unknown_property"}].
   The empty example still validates, and the textual drift check cannot detect that the generated JavaScript changed the schema's meaning.
   Suggested fix: Emit the schema data through JSON.parse of an appropriately quoted canonical JSON string, or another representation that preserves every key as an own data property, and add this exact regression case.

A3 [should-fix] bin/contracts.exs:32
   Defect: The generator inserts accepted JSON property names into TypeScript declarations without quoting them.
   Failure scenario: A closed object contract declaring and requiring the ASCII property "a/b~c" passes Schema.flatten!/1, but generation produces a member such as "readonly a/b~c: string", which is invalid TypeScript and fails typechecking.
   This is not an unsupported schema keyword or invalid canonical key; it is a property name accepted by the current toolchain.
   Suggested fix: Emit the property name using the existing Gen.lit/1 helper instead of raw interpolation, and test generation/typechecking with a punctuation-bearing property name.

A4 [should-fix] lint/rules/elixir-kernel-pure.yml:14
   Defect: The new File exemption covers every descendant of a module attribute, including File references that escape into runtime execution rather than performing a compile-time read.
   Failure scenario: A kernel module containing "@reader &File.read!/1" followed by "def read(path), do: @reader.(path)" passes this rule because its only File alias is beneath the exempt @ expression, but calling read/1 performs filesystem I/O at runtime.
   The existing direct-call invalid cases do not exercise this escape.
   Suggested fix: Narrow the exemption so module values and remote function captures cannot escape through attributes, and add this capture-and-invoke example as a planted purity violation.

Questions (no concrete failure scenario yet):
AQ1 kernel/ts/src/validate.ts:34
   Is successful canonical decoding an enforced precondition of value-level validation, or must validate also accept arbitrary values from ordinary JSON decoders?
   This distinction matters: ordinary decoding of {"n":1.0} gives TypeScript an integer-valued number that passes SubsetProbe, while Elixir's ordinary decoder preserves a float that contracts.ex:118 rejects; TypeScript's string predicate at validate.ts:33 also accepts lone-surrogate strings.
   These inputs are outside the frozen canonical profile, so I am not presenting them as a demonstrated bypass of the existing strict parser.
   The boundary should be explicit and tested: raw 1.0, 1e0 and duplicate keys must be rejected before their distinguishing information is lost, rather than expecting a value validator to reconstruct it after JSON.parse.

AQ2 lib/loka/core/contracts.ex:36
   The current Elixir interface validates ordinary values and returns :ok rather than a nominally typed identity; the PR explicitly defers structs to PR 3.
   Before those contracts acquire server-side consumers, will the Elixir representation preserve the WorldContextId/AuthorityDomainId/ZoneShardId distinctions rather than reducing them to interchangeable binary aliases?
   The named schemas and TypeScript brands reserve the intended distinctions here; I have not identified an existing consumer that mixes them up in this commit.

Views on Q1-Q6:
Q1: agree: A derived identity can still be represented as a lowercase UUID, so accepting different UUID versions is not itself inconsistent with 04 §3 or IdSource's v8 output. This validates representation, not provenance: the eventual Command constructor must derive/recover the same identity from logical scope and invocation identity, never mint another UUID on retry or include current authority placement in the derivation.

Q2: agree: Lowercase segments bounded to 64 characters and plain MAJOR.MINOR.PATCH are reasonable explicit v1 restrictions, although those exact restrictions are implementation choices rather than requirements already stated by 03 §2 or 05 §4. The object and string forms now express matching segment bounds. No cited requirement justifies adding prerelease/build metadata support or unused parsing/formatting helpers to this slice.

Q3: agree: A bounded list of character identities is a reasonable minimal representation for audience_set, and the cited spec does not require uniqueItems or a broader membership language. However, protocol/scope.schema.json:165 says members must not repeat while explicitly declining to enforce that promise. With duplicates deliberately tolerated, describe them as redundant membership rather than claiming a uniqueness invariant; consumers must not interpret repeated membership as permission to perform an action repeatedly.

Q4: agree: world_context_id is the correct logical identity for instance-scoped state and audience membership. It avoids equating the instance with its current mutation owner, while the separate authority-domain and shard contracts preserve the distinction required by 03 §6. A second synonymous instance identifier would add no demonstrated value here.

Q5: agree: Keeping GameError.data closed and empty is preferable to inventing unrestricted data fields before a code needs them. None of the cited requirements mandates a particular per-code payload in this slice. Introduce each code's typed data when its first consumer establishes the necessary fields; do not weaken additionalProperties merely to anticipate future errors.

Q6: disagree: I would not keep two handwritten code lists as the settled design. Derive ErrorCode from the authoritative error_registry.json through the existing loading/generation path, rather than requiring every addition to update two sources. The equality assertion in test/loka/core/contracts_test.exs:36 is a meaningful guard and there is no demonstrated current mismatch, so this duplication alone is not a merge-blocking runtime defect; consolidation is a simplification, not a reason to introduce another registry framework.
```

## Re-review (fix round 1)

- Reviewed commit: `3786ea3` (fix round 1 of at most 2). Reviewer: Claude Fable 5.1, a fresh
  agent (the first reviewer's context was gone); authored none of the work.
- Commits reviewed: `99b0ba4` (F1, F3), `ff6f7fb` (F2, N2), `393f3f5` (N1), `547da5d` (A2,
  A3, A4, AQ1, Q5), `3786ea3` (validate.ts table refactor). Skipped: `8e4cfa0` (merge),
  `5d722d2` (Prettier only). Records: `2676654` states the owner decision on Q1-Q6 exactly as
  the fix round assumes (lowercase UUIDs, CommandId derived in PR 3; snake_case segments of at
  most 64 with plain semver; `audience_set` 1-64 with set semantics; instance scope on
  `world_context_id`; `GameError.data` dropped; ErrorCode enum plus registry with the equality
  test); `100b29d` appends the Astra review.
- Checks at `3786ea3` in a detached worktree: `bin/check_all.sh` green through `check_docs`
  (`mix test` 60/60, `elixir bin/contracts.exs --check` exit 0, xref, Credo, both size checks,
  `red_controls.exs`, `ast-grep test --skip-snapshot-tests` 6/6, `ast-grep scan --error`,
  `lint_red_controls.sh`, kernel `tsc` and `node --test` 22/22); the mobile `tsc` step was not
  run here (no `npm ci` in `mobile/app`; no fix commit touches `mobile/`). Plain `ast-grep test`
  without `--skip-snapshot-tests` reports missing snapshot baselines; that is pre-existing and
  not part of this round.

### Disposition

| Finding | Disposition | Evidence |
|---|---|---|
| F1 pattern syntax not closed | **Fixed for every form F1 listed; not closed (F4 below)** | `schema.ex:37-40,119`: a portable grammar gates `pattern` before PCRE compile; 18 non-portable forms are test cases (`contracts_test.exs:94`); module doc records `[:unicode, :dollar_endonly]` vs `u`; astral probe `^[^a]$` / `"𝒶"` added. Mutants: grammar check removed (4 tests fail), `.` admitted outside a class (`^a.b$` case fails), TS `RegExp` without `u` (astral example fails). Remaining gap: F4. |
| F2 boundary examples | Verified | `DefinitionRef` example with three 64-code-point segments; `audience_set` examples with exactly 1 and exactly 64 members. Mutants `maxLength <=`→`<`, `maxItems <=`→`<`, `minItems >=`→`>` each fail "every example validates" in **both** kernels (previously survived). |
| F3 duplicate-name guard untested | Verified | `contracts_test.exs:106` two-file case; removing `duplicates/1` fails it. |
| N1 unused `SAFE` import | Verified | Import gone (`393f3f5`). |
| N2 `audience_set` prose | Verified | Description now "Order and duplicates carry no meaning (set semantics)", matching the owner's Q3 decision; `contracts.gen.ts` regenerated, `--check` exit 0. |
| A1 (= F1) | As F1 | Astra's `\Aa\z` and `^.$` are both in the rejected list (`\Aa$`, `^a\z`, `^a.b$`). |
| A2 `__proto__` lost in an object literal | Verified | `bin/contracts.exs:60`: each schema is `JSON.parse` of a JSON string; probe declares `__proto__`; tests in both kernels validate `{"__proto__":"ok"}`. Mutant: generator reverted to an object literal, regenerated: TS test fails (21/22). |
| A3 unquoted property names | Verified | `bin/contracts.exs:33` uses `lit(k)`; probe declares `a/b~c`; the probe is now generated into `kernel/ts/test/subset.gen.ts` and typechecked (`tsconfig.json` include). Mutant: `lit(k)`→`k`, regenerated: `tsc` fails. |
| A4 `File` exemption too wide | Verified | Rule admits `File` only as `File.read!(...)`/`File.read(...)` being the whole `@attr` value. Planted at `lib/loka/core/`: `@reader &File.read!/1` + `@reader.(path)`, `@m File` + `@m.read!`, `@s File.read!("x") \|> f()`, `@s [File.read!("x")]`, `@s {File.read!("x"), 1}`, `@s File.read!("x").a`, `@s File.write!` all reported; `@s File.read!("x")` and `@s File.read("x")` pass. Mutant: rule reverted to the any-descendant-of-`@` form: `ast-grep test` fails 5 cases. `contracts.ex:24-28` was restructured so its reads take that exact shape; scan is clean. See N4 for a dead clause. |
| AQ1 decode precondition | Verified (question answered) | Both module docs state values must come from canonical `decode`; tests in both kernels show `{"n":1.0}`, `{"n":1e0}`, `{"n":1,"n":1}` rejected at decode. |
| AQ2 Elixir nominal ids | **Deferred, no commit expected** | Not addressed by a commit and not named in the PR or the decision record; the first review's note ("nominally distinct only by contract name until PR 3's structs") is the disposition, and Astra's own text accepts that deferral. Recorded here so it is explicit. |
| Astra Q6 dissent | Settled by the owner | `2676654`: enum plus registry with the equality test. |
| Q5 `GameError.data` | Verified | `error.schema.json`: `GameError` is `{code}`; example, the three `invalid.json` cases (paths moved from `/data/...` to `/...`) and `contracts.gen.ts` updated; `{"code":"exit_locked","data":{}}` now `/data unknown_property` in both kernels. |
| `3786ea3` table refactor | Behavior-preserving; no test lost | Only `validate.ts` changed (16+/24-); `validate.test.ts` untouched; fixtures pass; differential below agrees on all 127 values. Mutants: table bypassed, `too_many_items` swapped for `too_few_items`, `enum` `some`→`every`: each fails. `keyword()` is within the 40-line limit. |

### Mutation results

All 21 mutants killed (each reverted afterwards): Elixir grammar check removed; grammar admits
`.`; `duplicates/1` removed; `maxItems`, `maxLength`, `minItems` off-by-one in Elixir and in TS
(six); TS `RegExp` without `u`; generator object literal instead of `JSON.parse`; generator
unquoted names (`tsc`); TS table bypassed; TS code swapped; TS `enum` inverted; lint rule
reverted. Control runs green between mutants.

### Differential corpus (Elixir `Contracts.validate/3` vs TS `validate()`, both fed by their canonical `decode`)

127 values under `CharacterId`, `DefinitionRef`, `DefinitionRefString`, `AudiencePolicy`,
`StateScope`, `GameError`, `ErrorCode`, `SubsetProbe` and three unknown contract names
(`Nope`, `__proto__`, `constructor`): uppercase and mixed-case UUIDs, the nil UUID, leading and
trailing newline and space, fullwidth and combining characters; 63/64/65-character segments in
both `DefinitionRef` forms; versions `0.0.0`, `1.0`, `1.0.0.0`, `01.0.0`, `1.00.0`,
`1.0.0-rc1`, `1.0.0+build`, Arabic-Indic digit, 64 and 65 characters, trailing newline,
`.0.0`, `1..0`; `audience_set` with 0, 1, 2 (duplicate), 64 (all duplicate), 65 members and
one uppercase member; wrong id keys per scope kind, missing `kind`, missing ids (realm never
defaults); `GameError` with `data`; astral, combining, U+2028, Kelvin-sign strings against
`^[^a]$`; `__proto__`, `constructor`, `a/b~c`, `""`, `~`, `/` keys; safe-integer edges and the
decode-level rejects (`2^53`, `1.0`, `1e0`, `-0`, duplicate key, escaped surrogate pair, lone
surrogate, non-ASCII key). **Zero disagreements.**

49 patterns through `Schema.flatten!/1`, the accepted ones shipped to TS as `JSON.parse` of
their flattened JSON and run against 27 sample strings (`a-b`, `a.b`, `a\nb`, `a\rb`, `𝒶`,
`é`, `""`, `\n`, U+2028, U+00A0, `-`, `.`, `a@b:c/d`, ...). 38 accepted; 30 of them agree on
every sample (810 cases: classes, ranges, trailing `-`, `\.`, `\-` in a class, lazy `*?`
`+?`, `{0}`, `{02}`, `(a|b|)`, unquantified lookahead, `a{1,2}b`, negated classes against
astral and U+2028). **8 accepted patterns throw in TypeScript on every sample (216 cases)**:
`^a\-b$`, `^a*+$`, `^a++$`, `^a?+$`, `^a{2}+$`, `^(?=a)+a$`, `^(?=a)?a$`, `^(?=a){2}a$`.
The corpus stays in scratch; the eight inputs belong in the "fails closed" list (F4).

### New findings

**F4 (should-fix)** `lib/loka/core/contracts/schema.ex:38` (`@token`). The grammar admits
three forms PCRE compiles and JavaScript `u` mode rejects: the escape `\-` outside a class
(`u`-mode identity escapes are limited to syntax characters; `-` is one only inside a class),
possessive quantifiers (`*+`, `++`, `?+`, `{n}+`: two quantifier tokens in a row), and a
quantified lookahead (`(?=...)+`, `?`, `{n}`: `)` may be followed by a quantifier whatever
group it closes). Failure, reproduced through the toolchain at `3786ea3`: a temporary
`protocol/zz_probe.schema.json` with optional properties `dash: "^a\\-b$"`,
`poss: "^a*+$"`, `look: "^(?=a)+a$"` and example `{}` passes `elixir bin/contracts.exs`,
`--check`, `mix test` 60/60, `tsc` and `node --test` 22/22; then
`validate("EscProbe", {dash: "a-b"})` is `:ok` in Elixir and throws `Invalid escape` in
TypeScript (`Nothing to repeat` and `Invalid quantifier` for the other two). Nothing shipped
uses these forms (the committed patterns use `-` bare, one quantifier per atom, and an
unquantified lookahead), so this is the toolchain gap F1 named, one step narrower. Fix in the
grammar itself: drop `\\[.-]` from the top-level token (a bare `-` is already a literal
there), bind quantifiers to an atom (`ATOM (?:[?*+]|\{n(,m)?\})? \??`) so two cannot follow
each other, and either forbid a quantifier after `)` (one line; widen later if a schema needs
`(...)+`) or track group kinds; add the eight inputs above to the rejected list.

**N3 (nit)** `lib/loka/core/contracts/schema.ex:20-21` vs `:37`. The module doc says classes
take "those literals" (`A-Z a-z 0-9 _ @ : / -`), but `@class_atom` admits only
`A-Za-z0-9_.` (plus `\.`, `\-` and ranges): `^[a-z:]+$` is rejected. Fails closed, so a
doc fix: say classes take `A-Z a-z 0-9 _ .`, ranges of those, `\.`, `\-`, and a trailing `-`.

**N4 (nit)** `lint/rules/elixir-kernel-pure.yml:24-25`. `not: { has: { nthChild: 2 } }` is
evaluated on the `@attr(...)` call's `arguments` node (always exactly one child), not on
`File.read!`'s, so it never fires: `@s File.read!("x", "y")` passes although the comment
says the call must be the whole value with one argument. No purity escape (any `File.read!`
that is the whole attribute value runs at compile time), so delete the clause or move it
under the `File.read!` call's `arguments`.

### Verdict: APPROVE WITH NOTES

Every F, N, A and AQ item and Q5 is fixed as the record asked, each with a test that fails
without the fix, and the two kernels agree on all 127 corpus values. One should-fix (F4)
remains for fix round 2: the portable grammar still admits three forms that make the
TypeScript validator throw, the same failure mode F1 described. Two nits.

## Re-review (fix round 2)

- Reviewed commit: `bb4a7fb` (fix round 2 of 2). Same reviewer as round 1; authored none of
  the work. Commits reviewed: `054bec4` (F4, N3), `bb4a7fb` (N4). Nothing else changed.
- Checks at `bb4a7fb` in a detached worktree: `bin/check_all.sh` green through `check_docs`
  (`mix test` 68/68, the 8 F4 inputs now in the rejected list; `contracts.exs --check` exit
  0; `ast-grep test --skip-snapshot-tests` 6/6, `elixir-kernel-pure` 37 cases; kernel `tsc`
  and `node --test` 22/22); mobile `tsc` not run, as in round 1 (nothing in `mobile/`).

### Disposition

| Finding | Disposition | Evidence |
|---|---|---|
| F4 grammar admits `\-`, stacked quantifiers, quantified lookahead | Verified | `schema.ex:39-40`: `@atom` is a literal, `\.` or a class; one quantifier (optionally lazy `?`) binds to an atom; `(`, `(?=`, `)` and `\|` take none. The 8 inputs are rejected test cases (`contracts_test.exs:94`). Mutants: quantifier allowed after `)` (3 lookahead cases fail), quantifier group `?`→`*` (4 possessive cases fail), top-level `\\[.-]` restored (`^a\-b$` fails). |
| N3 doc vs class atoms | Verified | Module doc now lists `A-Z a-z 0-9 _ .`, ranges, `\.`, `\-`, trailing `-` for classes; matches `@class_atom`. |
| N4 dead `nthChild: 2` clause | Verified | Clause deleted; lint tests pass; planted at `lib/loka/core/`: `&File.read!/1` capture, `@m File`, pipe, list, `File.write!` still reported; `@s File.read!("x")` and `@s File.read!("x", "y")` pass (both compile-time). |

### Differential (patterns, rerun at `bb4a7fb`)

The round-1 corpus (127 values, 49 patterns) plus 16 new patterns: lazy `??`, `{2}?`,
`{1,2}?`, `[a-z]+?`, `{1,3}?x`, `\.+`; the malformed `?*`, `*?+`, `{2}??`, `(+)`, `|+`;
quantified groups `(a)+`, `(a|b){2}`, `(a)?b`; and the two shipped shapes `[0-9a-f]{8}-...`
and `(0|[1-9][0-9]*)\.(...)`. Values: **0 disagreements** (unchanged). Patterns: 37/65
accepted; **999 match cases, 0 disagreements** (round 1: 216). Every accepted pattern
compiles under `u`; every pattern JavaScript rejects (`?*`, `*?+`, `{2}??`, `(+)`, `|+`) is
rejected by the grammar.

Accepted in round 1 and rejected now: the 8 F4 inputs and `^(a)?$`. The last is the
side effect the developer named: a quantified group is portable in both engines but the
grammar now forbids any quantifier after `)`. The kernels agreed on it, so it is a
capability the grammar gives up, not a correctness change; no shipped pattern quantifies a
group (the version pattern's groups are unquantified). Widen with group tracking if a schema
ever needs `(...)+`. Not a finding.

### Verdict: APPROVE

F4, N3 and N4 are fixed as asked, each with a test that fails without it. The portable
grammar now accepts only patterns both engines compile and read the same way on this
corpus. No open findings.
