# Independent review: PR #4 "R3 PR 1: portable ABI (codec, integers, RNG, hash, IdSource)"

- Reviewed commit: `99b9b37` (branch `r3-pr1-portable-abi`, merge of `origin/main` into
  `f7018b2`)
- Reviewer: Claude Fable 5.1 (fresh agent; authored none of the work; Fable because the
  slice freezes the canonical encoding and the ID scheme)
- Date: 2026-09-24
- Depth: full (contract freeze), per [WORKFLOW.md](../WORKFLOW.md) "Review stance"
- Checks run in a detached worktree at `99b9b37`: `mix test` 15/15, `npm run typecheck`
  and `npm test` 15/15, `ast-grep test` 6/6, `ast-grep scan --error` clean,
  `bin/lint_red_controls.sh` all ok, `elixir bin/check_docs.exs` clean. Fixture SHA-256s
  match [IMPORT.md](../spec/IMPORT.md) (`85472ae4…`, `1b699cf2…`).

## What must be true (derived from the spec before reading the diff)

From [numeric-profile.md](../spec/conformance/numeric-profile.md), 01 A8, 04 §3/§5.1/§21,
14 §R3A and proposed ADR-071:

1. Integers are exact in `[-(2^53-1), 2^53-1]`; overflow is a typed error, never
   wraparound or float rounding; division truncates toward zero, `r = a - trunc(a/b)*b`,
   zero divisor is a typed error; intermediates are checked with sufficient precision.
2. Canonical text: UTF-8, ASCII keys in ordinal (byte) order, no whitespace, exact decimal
   integers, arrays in order, no normalization; short escapes for `\b \t \n \f \r`, lowercase
   `\u00xx` for other controls, `"` and `\` escaped, everything else literal UTF-8.
   Parse rejects duplicate keys, NaN/Infinity, fractions, exponents, out-of-range integers and
   lone surrogates (raw or escaped); `-0` parses as `0`.
3. The two kernels accept and reject the same inputs and produce byte-identical canonical
   text and hashes (ADR-071: same fixtures, then differential testing). Divergence on any
   input is a defect in the freeze.
4. RNG: `xoshiro128**` 1.1 output `rotl32(s1*5,7)*9`, published transition, four u32
   words not all zero; `uniform` needs `1 <= bound <= 2^32`, accepts `raw < 2^32 - (2^32
   mod bound)`, rejected draws advance the state, a budget bounds the draws and exhaustion is
   a typed error. Fixture codes `invalid_bound`, `invalid_rng_state`,
   `rng_budget_exhausted`; later decision `invalid_rng_budget`, `invalid_ordinal`.
5. IdSource: owner-approved tuple `["loka-id-v1", world_context_id, command_id, ordinal]`
   canonically encoded, SHA-256, first 16 bytes, byte 6 `(b & 0x0f) | 0x80`, byte 8
   `(b & 0x3f) | 0x80`, lowercase hyphenated UUID; no host entropy.
6. Kernels stay pure: TS runs on Hermes with erasable TS only and no host APIs; the Elixir
   purity lint admits only `:crypto.hash/2` and still catches every other `:crypto` use.
7. Tests read the frozen fixtures in place after hash verification, expected values never
   come from the code under test, and the suite fails when the core logic is broken.

## Verdict: APPROVE WITH NOTES

Every requirement above holds on the fixtures and on everything I could construct except one
class of input (F1). Both kernels agree on 3,748 differential cases and the TS post-check
overflow argument is correct (evidence below). Two should-fix items belong in the fix round
before this slice is treated as the frozen contract: a host-dependent nesting limit that
makes the two kernels disagree (F1), and the spec text that the code has now decided but the
profile does not state (F2). Neither changes a byte of any fixture result.

## Evidence

**Encoding agreement.** A 4,095-case corpus (1,500 randomly serialized valid documents with
random whitespace, `ensure_ascii` on and off, keys such as `""`, `__proto__`, `constructor`,
`"a\""`, `"\u0001"`, integer-like keys; 2,500 byte-level mutations of valid documents drawn
from a JSON-punctuation, digit, escape, control, DEL, BOM, overlong, CESU-surrogate and
`> U+10FFFF` alphabet; 95 hand-picked cases covering `-0`, `-00`, `1E2`, 17-digit integers,
`2^53` and `-2^53`, `\uD800A`, `􏿿`, `\uDC00\uDC00`, `a` duplicate
after decoding, `\/`, `\u007f`, `\u0080`, U+2028, trailing commas, `\U0041`, `+1`, `.5`,
`0x10`, NBSP/VT/FF whitespace) was run through `Loka.Core.Canonical` and
`kernel/ts/src/canonical.ts`. Result: identical accept/reject on every input both kernels
can receive, identical canonical bytes on all 1,037 accepted inputs, and `decode(encode(v))`
re-encodes to the same bytes in both. The 310 inputs that are not valid UTF-8 (unreachable
as a JS string) are all rejected by Elixir. A leading BOM is rejected by both.

**TS overflow check (after the operation).** The claim is correct for all four operations.
For safe operands `a`, `b`: if the exact result lies in `[-(2^53-1), 2^53-1]` it is a
representable double, so IEEE add/sub/mul return it exactly; if it lies outside, rounding is
monotonic and `2^53` is representable, so the double is at least `2^53` in magnitude and the
check rejects it. No product of two safe integers reaches Infinity (`< 2^106`). `divide`
uses `a % b`, which is exact for doubles, and `(a - r) / b` is an exact integer quotient.
Brute force against BigInt truth: 7,901,008 operations biased to the edges (`±2^53-1`,
`94906266²`, `3037000500²`, 27-bit × 26-bit products), 1,790,471 of them overflow cases,
0 mismatches, and no `-0` escapes.

**RNG.** Transition and output match the upstream `xoshiro128starstar.c` line for line; the
five `rng_steps` vectors and all 11 `uniform` rows pass in both kernels; `bound = 2^32`
gives `limit = 2^32` (always accept) in both; check order (bound, budget, state) is the same
in both, so a row with two faults yields the same code.

**SHA-256 and IdSource.** Constants and schedule checked against FIPS 180-4; `hash` and
`IdSource` literals recomputed with Python `hashlib` and match; the 56-byte case exercises
the second padding block. Version and variant land on bytes 6 and 8 in both kernels.

**Lint.** The narrowed `elixir-kernel-pure` rule passes the four new lint tests and
`bin/lint_red_controls.sh`. Planted in `lib/loka/core/rng.ex`: `:crypto.strong_rand_bytes/1`,
`:crypto.mac/4`, `:crypto.hash_init/0`, `:crypto.hash_update/2` and a nested
`strong_rand_bytes` inside `hash/2` were all reported; `:crypto.hash(:sha256, x)` was not.

**Test the tests.** 17 TypeScript mutants and 14 Elixir mutants, each a plausible bug (rotl
11→10, `s1*5`→`s1*3`, rejection region removed, budget off by one, keys unsorted, duplicate
keys accepted, `\f` emitted as `\u000c`, range check off by one, raw controls accepted, lone
escaped surrogate accepted, σ0 rotation 18→17, padding byte 0x01, UTF-8 3-byte lead wrong,
variant mask `0x0f`, version on byte 7, `check <= SAFE+1`, floor division): every one
fails at least one test in its kernel. One deliberate equivalent mutant (Elixir digit cap
16→17) survives, correctly: the range check covers it and the cap is only a guard against
`String.to_integer` on huge input.

Process note for the PM (not a finding against the PR): Mix compares source and manifest
mtimes at one-second granularity, so a mutation followed by `mix test` and `git checkout` in
the same second leaves the mutated `.beam` in `_build`; my first Elixir run reported a false
kill this way. Use `mix test --force` when mutation testing. The developer's 25 Elixir
mutants may have had the same exposure; my forced rerun confirms the suite catches all 14
real mutants above, so the conclusion stands.

## Findings

### F1 (should-fix). Nesting depth is a host stack limit, not a profile rule, so the kernels disagree

`kernel/ts/src/canonical.ts:142` catches `RangeError` and reports `invalid_json`;
`kernel/ts/src/canonical.ts:169-195` (`write`) has no such catch; `lib/loka/core/canonical.ex:43-44`
has no depth bound at all.

Scenario: `text = "[" * 5000 + "]" * 5000`. Elixir: `{:ok, _}` (it decodes depth 1,000,000
in 677 ms). TypeScript on Node 24: `KernelError('invalid_json')`. On Hermes the native stack
is smaller, so the threshold is lower and differs by device. Encode is worse: `encode` of the
value Elixir produced at depth 3000 throws a bare `RangeError` from TS (`forEach` callbacks
add frames), an untyped error from a kernel that promises typed ones, and on a value the TS
`decode` had just accepted. ADR-071 holds both kernels to identical behavior; 01 A8 says the
canonical serialization must be defined, and a host's stack size does not define it.

Fix (small): one `MAX_DEPTH` in the profile (something like 128; real state trees are far
shallower), counted in `value()`/`write` and in `value/1`/`enc/1`, returning `invalid_json`
on parse and the encoder's error on encode; delete the `RangeError` catch. Add one
differential test at `MAX_DEPTH` and `MAX_DEPTH + 1` in each kernel.

### F2 (should-fix). The profile and the decision record do not yet state what the code decided

`docs/spec/conformance/numeric-profile.md:3` still reads "proposed R1 input, not an
accepted production ABI. Review/freeze before candidate performance results";
`docs/decisions/owner-decisions-r3-2026-09-24.md:13-16` holds the owner's one-line approval
plus the developer's summary. AGENTS.md says amend the spec first, then code; 14 §R3A names
"canonical serialization/hash/IdSource/RNG/numeric rules" as constitutional. The code now
fixes several points the profile leaves open. Both kernels agree on each of them, so this is
a documentation gap, but a freeze that lives only in two source trees is not a freeze.

Scenario: a third implementation (or the same two after a refactor) reads only the profile
and legitimately rejects whitespace, accepts non-ASCII keys, or picks a different UUID
layout; every fixture still passes, and the kernels diverge.

The profile amendment (or a section the decision record links as normative) should hold:

- Status: frozen for R3 (drop "proposed R1 input"), and the frozen profile id: today
  `loka-numeric-proposed-v1` appears only in the fixture, and nothing in either kernel
  names a profile version.
- Parse accepts RFC 8259 whitespace (` \t\n\r`) between tokens and top-level scalars;
  rejects a BOM, any other whitespace, and trailing data. `\/` is accepted on input and
  emitted as `/`; U+007F and all non-ASCII scalars are literal.
- Object keys must be ASCII; a non-ASCII key is rejected on parse and on encode (today's
  text says "ASCII object keys" without saying what happens otherwise). Key order is byte
  order. Duplicate detection runs after escape decoding.
- The nesting limit from F1.
- Hash: SHA-256 over the canonical UTF-8 bytes, lowercase hex.
- Draw budget: `max_draws` is a non-negative integer (`invalid_rng_budget` otherwise);
  `max_draws` draws are allowed and the next is `rng_budget_exhausted`, so `0` exhausts
  immediately.
- Error registry (R3A "diagnostic/error registry"): `invalid_json`, `invalid_canonical`,
  `integer_overflow`, `division_by_zero`, `invalid_bound`, `invalid_rng_budget`,
  `invalid_rng_state`, `rng_budget_exhausted`, `invalid_ordinal`; Elixir `{:error, code}`,
  TS `KernelError.code`.
- IdSource, in full: the domain tag `"loka-id-v1"` and that a scheme change bumps it; the
  tuple and that it is hashed as canonical JSON; `world_context_id` and `command_id` are
  Unicode scalar strings, naming which spec identities they are (the stable Command ID of
  04 §3; the logical-world placement identity of R3A); `ordinal` is a non-negative safe
  integer allocated per command starting at 0, unique within a decision, and replay of the
  same command yields the same ids (04 §3 idempotency); truncation to 16 bytes with version 8
  and RFC 9562 variant, leaving 122 hash bits; the output is the 36-character lowercase
  hyphenated form and is the id, so no other layer re-parses it.

### N1 (nit). Error shape differs between kernels on programmer errors

- Encoder: `lib/loka/core/canonical.ex:174` raises `ArgumentError`;
  `kernel/ts/src/canonical.ts:166` throws `KernelError('invalid_canonical')`.
- Unsafe operands: `lib/loka/core/int.ex:13-19` fail with `FunctionClauseError`;
  `kernel/ts/src/int.ts:7` throws `integer_overflow`.
- Non-string ids: `lib/loka/core/id_source.ex:14` `FunctionClauseError`;
  `kernel/ts/src/id_source.ts:8` encodes whatever it is given (a JS caller passing a number
  gets an id Elixir can never produce).

Scenario: the R5 differential harness compares error codes; these paths produce a code on
one side and a crash on the other. All are kernel-internal misuse, so a raise is defensible
in both; pick one shape per case and note it in the F2 registry.

### N2 (nit). The TS hash path copies the message three times

`kernel/ts/src/sha256.ts:58-67` builds a `number[]` (8 bytes per byte) then
`Uint8Array.from` copies it; `sha256.ts:16-17` copies the whole message again into the padded
buffer. Scenario: hashing a 730 KB checkpoint on the phone allocates about 6 MB of boxed
numbers plus two more copies before any hashing happens (AGENTS.md: keep whole-value copies
off the phone). Write UTF-8 into a preallocated `Uint8Array(3 * s.length)` and hash 64-byte
blocks straight from `data`, padding only the tail. Linear either way; this is memory, not
complexity. Fine to defer until the checkpoint path exists.

### Q1 (question). Nothing runs the TS kernel on Hermes yet

`kernel/ts/src/canonical.ts:102` uses `Object.hasOwn` (ES2022); `tsconfig` `lib` is ES2022
and CI runs Node 24. Hermes support for the ES2020-22 surface used here (`??`,
`Object.hasOwn`, `padStart`, string iteration, `DataView`) is expected but unverified in this
repository. The first on-device run in R5 should load this module before anything else.

## Not findings

- Over-engineering: nothing to delete. The `run`/slice copying in both parsers is the
  minimal linear approach; `LITERALS`, `SHORT`, `KernelError` and `SAFE` are each used more
  than once.
- Tests follow AGENTS.md "Writing tests": fixtures read in place with hash checks, literals
  from `shasum`/`hashlib`, each edge-case test names its bug, the >32-key map test exists
  because a mutant survived. The `-0` decode path is doubly normalized (decoder and
  encoder), so a decoder-only `-0` mutant survives; that is a redundancy, not a gap.
- The new AGENTS.md lesson about Elixir small maps (≤ 32 keys iterate sorted) is accurate.
- The merge of `origin/main` into the branch (rather than a rebase) follows "never
  force-pushes".

## Re-review of the fix commits (`ed48a4b`, `0be8816`, `81ad9fd`; head `e258bff`)

Scope: each disposition, the code each fix touched and its direct callers, the parser
refactors in both `canonical` modules, and the amendment text read as normative. The merges
`b7a9af3` and `e258bff` were not reviewed. The freeze itself is still pending the owner.

Checks at `e258bff` in a fresh detached worktree: the full AGENTS.md line passes (`mix test`
18/18, `npm test` 18/18, typecheck, both xref gates, `red_controls.exs`, `ast-grep test`
6/6, `scan` clean, `lint_red_controls.sh` 6 ok, `check_docs.exs` 57 docs clean).

### Verdict: APPROVE WITH NOTES

All three findings and both nits are fixed as described, the two kernels still agree on
every input, and the amendment covers the F2 list and matches the code. One should-fix
remains, a test gap the refactor exposed (R1 below); it is a one-line addition to each
suite, not a behavior change, and can land with the freeze approval.

### Dispositions

- **F1 (depth): fixed.** `MAX_DEPTH = 128` in `kernel/ts/src/canonical.ts:12` and
  `@max_depth 128` in `lib/loka/core/canonical.ex:10`, counted the same way on both sides
  (root container opens at depth 0; the 129th `{`/`[` is rejected). The `RangeError` catch is
  gone. Differential corpus extended with 33 nesting cases (arrays, objects, and three
  interleavings, at depths 1, 127, 128, 129, 130, 200, plus a depth-128 tree with wide
  siblings and whitespace): both kernels accept 128 and reject 129 identically. Mutants
  `depth === MAX_DEPTH` → `depth > MAX_DEPTH` on parse and on encode fail
  `nesting is limited to 128 containers` in both kernels.
- **F2 (spec): fixed, pending the owner.** The new "Frozen v1 rules (R3)" section covers
  every item on my list: status and profile id (`loka-numeric-v1`, with the fixture's
  `loka-numeric-proposed-v1` explained), whitespace set and BOM rejection, top-level scalars,
  trailing data, `\/`, U+007F and non-ASCII literal, ASCII keys with byte order and
  duplicate detection after decoding, the depth limit, hash definition, draw-budget semantics
  and check order, operand-before-divisor order, the error registry (now including
  `invalid_id`), and IdSource in full (domain tag and bump rule, tuple, `WorldContextId` from
  03 and the stable Command ID from 04 §3, ordinal type and allocation, truncation with
  version and variant leaving 122 bits, the 36-character form as the id). I checked each
  sentence against both kernels: all consistent, including the claims about check order,
  non-text input to `decode`, and the "four frames per level" remark (`value` → `array` →
  `members` → closure). IMPORT.md records the amendment; the decision record marks the freeze
  as pending.
- **N1 (error shapes): fixed.** Elixir `encode`/`hash` return `{:ok, _} | {:error,
  :invalid_canonical}`; `Int` returns `:integer_overflow` for non-integer operands and checks
  operands before the divisor (both kernels, tested); `IdSource` returns `:invalid_id` /
  throws `invalid_id` for non-string ids; `decode` on non-text is `invalid_json` in both.
  Callers updated: `IdSource.id/3` consumes the encode tuple; `hash/1` uses `with`. No other
  callers exist yet.
- **N2 (hash copies): fixed.** `sha256.ts` reads whole blocks through a `DataView` over the
  input's own buffer (honouring `byteOffset`) and copies only the tail into a 64- or 128-byte
  pad; `utf8` writes into one preallocated `Uint8Array(3 * length)` and returns a subarray.
  Verified against Node's `crypto` for every length 0..200, both at offset 0 and as a
  subarray at offset 37 (0 mismatches); `utf8` equals `Buffer.from(s, 'utf8')` on a 48 KB
  mixed 1- to 4-byte string; 3 MB hashes in 28 ms. Mutants killed by the new 55/56/120-byte
  and U+2000B literals: tail threshold `< 56` → `<= 56`, padding byte at `tail[0]`, skipping
  the first whole block, 4-byte lead `c >> 17` (the mutant that survived in round one). The
  three new hash literals recomputed with `hashlib` match.
- **Q1: answered** in the amendment (not yet run on Hermes; first R5 device run).
- **Process note: recorded** in AGENTS.md (`mix test --force` for Elixir mutants).

### Parser refactors

`canonical.ts` moved from closures to module functions over a `Parser` cursor, with a shared
`members` loop and an `ESCAPES` table; `canonical.ex` extracted `key/2` and `colon/1`.
Re-ran the original 4,095-case corpus plus the 33 depth cases: identical accept/reject on all
3,781 inputs both kernels can receive, identical canonical bytes on all 1,150 accepted, and
`decode(encode(v))` stable in both. Mutants on the refactored code (duplicate check removed,
`ESCAPES` missing `/`, `colon/1` accepting any byte, `decode` type guard removed) each fail a
test in both kernels.

### Finding

**R1 (should-fix). No test pins the separator between members, in either kernel.**
`kernel/ts/src/canonical.ts:73` (`if (c !== ',') invalid()`) and
`lib/loka/core/canonical.ex:74,97` (`_ -> throw(:invalid)`). Mutating each to continue
parsing instead of failing survives both suites (18/18 green), so `[1 2]` and
`{"a":1 "b":2}` would parse as two-element containers with no test noticing. The shipped
code rejects both (confirmed directly and by the corpus); the gap is in the tests, on the
exact function the refactor rewrote. AGENTS.md "Mutation check" names missing validation of
malformed input as a required mutant. Fix: add `'[1 2]'` and `'{"a":1 "b":2}'` to the
`decode edge cases` rejection lists in both suites.

Equivalent mutant, not a finding: `utf8`'s 3-byte branch boundary (`c > 0xdbff` →
`c > 0xdfff`) survives because lone low surrogates never reach `utf8`; `encode` rejects
them first.

### Not findings

- The `.githooks` directory the coordinator mentioned exists only on the `local-hooks`
  branch, not at `e258bff`, so no pre-push hook ran from this worktree.
- The amendment's "128 levels take about 500 JavaScript frames" is informative, not
  normative; the normative sentence is the depth limit itself.

### Addendum: `eb6dd03`

Pushed while this re-review was being written; docs-only (decision record, IMPORT.md, the
profile's status line). It quotes the owner's approval verbatim ("okay yes" to "Approve
freezing it as v1?") and flips the status to **frozen v1, owner-approved 2026-09-24**. No
rule text changed, so the consistency check above still holds. The freeze is no longer
pending; R1 remains the only open item.
