# PC11: validate cartridge fact defaults during loading — independent review

PR: [#161 — reject invalid cartridge fact defaults](https://github.com/lorecrafting/lokacore/pull/161)  
Source head reviewed: `95912961dc337785e1b6d392685b0595912751db`  
Reviewer: fresh independent Codex agent; authored none of the implementation.

## Requirements derived before the diff

From [Artifact and loader](../system/cartridge.md#artifact-and-loader) and
`lib/loka/content/compiler.ex:220`: the loader must reject an enum default absent from
its values and an integer default outside its inclusive bounds, with
`FACT_DEFAULT_INVALID` at the fact's `value_type.default` path. This applies to v1
and v2, after schema/hash/identity/lock validation and before runtime consumption.
Valid bools, enums, bounded and unbounded integers must remain valid. Reuse existing
fact typing; do not alter fixture answers or broaden the fact contract.

## Verdict

**CHANGES REQUIRED.** One blocker in regression protection; no production correctness
failure found in the submitted head.

## Findings

**PC11-R1 — blocker — `kernel/ts/test/cartridge.test.ts:39`.** The helper always loads
`cartridge_hash.json`, a v1 cartridge, so both new tests omit the explicitly required
v2 branch. A plausible regression adding `c.format === 'loka-cartridge-v1' &&` to
the new default guard passes all **406 TypeScript tests**, including the 76 loader
tests. Under that mutant, an otherwise valid v2 `cartridge_facts_hash.json` artifact
with an added ordinary fact `review_default`, enum values `['missing']`, default
`'rescued'`, and an independently recomputed hash returns `ok: true`. The same
artifact with integer bounds 0..1 and default 2 also loads. The submitted head
correctly rejects both, so this is an executed test gap, not an existing production
acceptance defect. The reviewer workflow treats a surviving core-logic mutant as a
blocker. Add a minimal controlled v2 rejection case with a literal diagnostic and
show this format-restricted mutant fails; retain v1 coverage. No new framework or
fixture rewrite is needed.

## Inspection and validation

- The [composition audit's fact-default finding](../evidence/2026-10-04-primitive-composition/report.md#pc-11--actual-static-trust-boundary-defect-fact-default-validation-differs-between-compiler-and-loader)
  is the same trust-boundary defect. The fix reuses `mechanics/fact.ts:69` without
  introducing a mechanic/content dependency or changing runtime semantics.
- Inspected `checkers`, `refStage`, loader stage ordering, `typed`, compiler defaults,
  and the unwritten-fact fallback. The guard precedes the v1 early return; schema
  validation guarantees FactType structure. Diagnostic sorting remains unchanged.
- Baseline: `mise exec -- node --test kernel/ts/test/cartridge.test.ts` passed 76/76.
- Removing the new guard: the same command exited 1, with exactly the new enum and
  bounded-int cases failing (74 passed, two failed).
- Restricting the guard to v1: the loader suite passed 76/76; `mise exec -- npm test`
  in `kernel/ts` passed 406/406. The controlled v2 artifacts above returned success.
- Restored production source: 16 controlled loader probes passed across v1/v2:
  invalid enum, below-minimum and above-maximum integers were rejected with the
  literal code/path; both inclusive bounds, unbounded integer, valid enum and false
  boolean loaded. Probe artifacts used standard-library sorting/JSON/SHA-256 and
  literal expected acceptance/diagnostics, independent of loader implementation.
- The new tests use literal expected diagnostics and standard-library artifact hash
  construction; no frozen answers changed. All temporary mutations were restored.

Ponytail Review: **Lean already. Ship.** The three-line production guard reuses the
existing validator. No complexity findings; this does not override PC11-R1.

## Fix round 1 — v2 default regression protection

Fix head reviewed: `5e669b0c6df87566b138473819970dad7451518e`. Same independent
reviewer; scope limited to PC11-R1, the changed test helper and its direct loader call.

**APPROVE. PC11-R1 closed; no open findings.**

The added test at `kernel/ts/test/cartridge.test.ts:77` builds a controlled ordinary
v2 enum fact with values `['missing']` and default `'rescued'`, using the existing v2
fixture and an independently recomputed standard-library hash. Its expected diagnostic
code and path are literals. The small shared artifact loader helper preserves the v1
enum and bounded-integer cases; adding the fixture's `resource` capability ensures
that bypassed semantic validation cannot hide behind installed-capability rejection.
Production code and frozen fixtures are unchanged.

Independent validation in a fresh detached worktree:

- Baseline loader suite: 77 passed, zero failed.
- Reapplied the exact surviving mutation from PC11-R1: prefix the default guard with
  `c.format === 'loka-cartridge-v1' &&`. Loader suite exited 1: exactly the new v2
  test failed, with the previous 76 tests still passing.
- Restored production source: loader suite passed 77/77; working tree clean before
  adding this review update.
- Rechecked the direct `loadCartridge` call and reference-stage placement: both formats
  still reach default validation, with schema/hash validation preceding it.

Scoped Ponytail Review: **Lean already. Ship.** One regression test and reused artifact
construction close the finding without new production machinery. Final exact-head CI
and any main-branch reconciliation remain the PM's merge prerequisites.
