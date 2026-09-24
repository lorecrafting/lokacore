# Portable numeric profile v1

Status: **frozen v1 for R3 (profile id `loka-numeric-v1`), subject to the owner's approval**, amended 2026-09-24 by R3 PR 1 ([import record](../IMPORT.md#amendments-since-import), [owner decisions](../../decisions/owner-decisions-r3-2026-09-24.md)). It was the proposed R1 input `loka-numeric-proposed-v1`, the `profile` value in the frozen `numeric-vectors.json`; the rules and known answers are unchanged, and the [frozen v1 rules](#frozen-v1-rules-r3) below state what the R1 text left open. This profile is deliberately small and is separate from runtime selection.

## Integers and representation

Rule-critical integers are exact signed integers in `[-9007199254740991, 9007199254740991]`. Overflow is a typed error, never wraparound or silent floating-point rounding. Division truncates toward zero; remainder is `a - trunc(a/b)*b`; zero divisors fail. Intermediates must be checked or evaluated with sufficient precision before range checking. Booleans are not integers. Fixed-point capabilities must separately name scale and rounding; this profile does not silently define them.

The fixture encoding is UTF-8 canonical JSON with ASCII object keys in ordinal order, no whitespace, exact integer decimal notation, JSON booleans/null, arrays in semantic order, and scalar-Unicode strings without normalization. Escape quote/backslash and controls per JSON; use short escapes for backspace/tab/newline/formfeed/carriage return, lower-case `\u00xx` for other controls, and literal UTF-8 for other scalars. Reject duplicate keys, non-finite numbers, floats/exponents, out-of-range integers and isolated surrogate code points. Numeric input `-0` normalizes to integer zero; there is no separate semantic negative zero. This is a fixture profile, NOT an unqualified claim of RFC 8785 support or a ban on non-ASCII player prose.

## RNG

Use the proposed `xoshiro128ss-1.1` transition: four explicit unsigned 32-bit words, not all zero. Arithmetic in the RNG transition alone wraps modulo 2^32. The output is `rotl32(s1*5, 7)*9`; then apply the published xoshiro128** 1.1 state transition. Snapshot the algorithm ID and all four words. R1 starts from explicit words; no host-specific seed expansion is allowed. Initial save seeding belongs to the host, which supplies and persists the explicit state. This PRNG is for gameplay, not keys, tokens, signatures or other security randomness.

For a uniform integer in `[0,bound)`, require `1 <= bound <= 2^32`; draw raw uint32 values until `raw < 2^32 - (2^32 mod bound)`, then return `raw mod bound`. Rejected draws advance the proposed RNG. A deterministic draw budget (fixture default 1024) bounds work; budget exhaustion aborts the decision and discards all proposed draws. A 50% check uses `uniform(100) < 50`.

A valid failed check commits the new RNG with the failed-attempt receipt. A duplicate delivery does not draw again. Gameplay rejection and definitive rollback do not advance RNG. Uncertain COMMIT must reconcile before another draw.

## Known answers and provenance

`numeric-vectors.json` contains manually retained output and next-state vectors for explicit `[1,2,3,4]`, plus signed division and range edges. These values were cross-checked against a standalone C rendition of the upstream transition, not generated from the Python candidate during CI. This is a cross-language numeric check, not independent review or full host conformance.

Primary algorithm source: [Blackman/Vigna xoshiro128** 1.1](https://prng.di.unimi.it/xoshiro128starstar.c), retrieved 2026-09-22. The upstream code is dedicated to the public domain; preserve attribution when adapting it. Its current extra jump APIs are not part of this proposed profile.

## Frozen v1 rules (R3)

Both kernels (`lib/loka/core`, `kernel/ts/src`) implement exactly these rules; where the sections above are silent, this section governs. A change to any rule is a new profile version.

**Parsing.**
- Whitespace between tokens is exactly space, tab, line feed and carriage return; any other character there, including a byte-order mark, is rejected. The top-level value may be any JSON value, scalars included. Data after it is rejected.
- `\/` is accepted on input and decodes to `/`. Escaped surrogate pairs decode to one scalar; a lone surrogate, raw or escaped, is rejected. Raw control characters (below U+0020) inside strings are rejected.
- Integers are `-?(0|[1-9][0-9]*)`; a fraction, an exponent, a leading `+` or leading zeros are rejected. `-0` decodes to 0.
- Object keys must be ASCII after escape decoding, and duplicate detection compares the decoded keys, so `{"a":1,"\u0061":2}` is rejected. A non-ASCII key is rejected on parse and on encode.
- Containers nest at most **128** deep (`MAX_DEPTH`): 128 nested arrays or objects are valid, 129 are rejected on parse (`invalid_json`) and on encode (`invalid_canonical`). The limit belongs to the profile, not to a host stack; the deepest frozen fixture nests 9, and 128 levels take about 500 JavaScript frames in the TypeScript parser (four per level), far below the depth at which Hermes reports a stack overflow; the TypeScript kernel has not yet run on a device (first R5 device run).

**Encoding.** Object keys are sorted by byte (equivalently code point, since keys are ASCII). `/`, U+007F and every non-ASCII scalar are emitted literally; only `"`, `\` and controls are escaped, as above. The encoder rejects a value outside the profile (a non-integer or unsafe number, a string that is not valid Unicode scalars, a non-ASCII or non-string key, any other type) with `invalid_canonical`.

**Hash.** `hash(v)` is SHA-256 over the canonical UTF-8 bytes of `v`, as 64 lowercase hex digits.

**Draw budget.** `max_draws` must be a non-negative integer, else `invalid_rng_budget`. `uniform` performs at most `max_draws` draws; if none is accepted the result is `rng_budget_exhausted`, so `max_draws = 0` exhausts at once. Argument checks run in the order bound, budget, state.

**Integers.** An operand that is not an integer in the safe range, or a result outside it, is `integer_overflow`. Operands are checked before the divisor is compared with zero.

**Error codes.** Elixir returns `{:error, code}` with `code` an atom; TypeScript throws `KernelError` whose `code` is the same string. Programmer errors (wrong argument types) use the same codes, never a crash on one side.

| Code | Raised by |
|---|---|
| `invalid_json` | parse: any input outside these rules, including non-text input |
| `invalid_canonical` | encode, hash, IdSource: a value outside the profile |
| `integer_overflow` | add, sub, mul, divide |
| `division_by_zero` | divide |
| `invalid_bound` | uniform |
| `invalid_rng_budget` | uniform |
| `invalid_rng_state` | next, uniform: not four integers in `0..2^32-1`, or all zero |
| `rng_budget_exhausted` | uniform |
| `invalid_id` | IdSource: an id that is not a string |
| `invalid_ordinal` | IdSource: an ordinal that is not an integer in `0..2^53-1` |

**IdSource** (01 A8; owner decision [R3](../../decisions/owner-decisions-r3-2026-09-24.md)). A generated gameplay id is:

1. the canonical JSON array `["loka-id-v1", world_context_id, command_id, ordinal]`, where `"loka-id-v1"` is the domain tag (any change to this scheme uses a new tag);
2. `world_context_id` is the logical world/context identity (`WorldContextId`, 03, not an authority-domain or shard id) and `command_id` is the stable Command ID (04 §3), both strings of Unicode scalars; `ordinal` is an integer in `0..2^53-1`;
3. hashed with SHA-256; the first 16 bytes are kept, byte 6 becomes `(b & 0x0f) | 0x80` (version 8) and byte 8 becomes `(b & 0x3f) | 0x80` (RFC 9562 variant), leaving 122 hash bits;
4. written as 36 characters, lowercase hex in 8-4-4-4-12 groups. That string is the id; no layer re-parses it.

Ordinals are allocated per command starting at 0, in the decision's deterministic order, each used once within a decision. Replaying the same command against the same state allocates the same ordinals and so yields the same ids.
