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
