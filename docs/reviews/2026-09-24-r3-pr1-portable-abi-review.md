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
