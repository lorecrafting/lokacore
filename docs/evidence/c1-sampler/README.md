# C1 sampler source and headless proof

Base: `b4d91ea0ac0c02e7590fb33eaa02c5dbc96181b4`. This slice implements
[plan slice 11 / Q2](../../decisions/owner-decision-chapter-one-plan-2026-10-02.md#11-c1-sampler-the-gate-story-q2)
under the [identity and prose delegation](../../decisions/owner-decision-sampler-batch-2026-10-03.md).
It adds content using the current [compiler/loader](../../system/cartridge.md),
[mechanics](../../system/mechanics.md) and [save](../../system/save.md) contracts.
No rule, schema, protocol command, clock behavior or story picker changes.

## Source and independent answer

The 23 source JSON files match the approved author's final snapshot byte for byte.
The [catalog](../../../cartridges/ashmere_sampler/text.json) SHA-256 is
`c9625cf219728e27efb27923ed302d02cfed51df1fa099239db6ffb76285808b`.
The exact owner-presented [prose batch](owner-prose-batch.txt) is retained as historical
raw text; its pending-approval/readiness statements describe preparation before the
linked delegation. Its SHA-256 is
`05e8865400e5a5c1cdac8669a972d87d7561fd6d1c32bb0c2543446a29967288`.
[Author provenance](provenance.json) distinguishes prototype reuse, adaptation and
new microquest text. Those origin claims are author evidence; the implementation
verifies the adopted file bytes, not a new inspection of the prototype.

The [Python oracle](../../../test/loka/cartridge_sampler_hash.py) independently
assembles literal approved semantics, compiler-owned facts/resources and reference
expansion. Only the adopted text catalog is copied from source. Python stdlib
canonical encoding/hash produces the [fixture](../../../protocol/fixtures/cartridge_sampler_hash.json),
content hash `0e66807306404138bd5dcb07893f3ef1d6edff7a2141d4c2c38753f8f70b4e55`.
The actual Elixir compiler matches the expected artifact byte for byte (15,519 bytes),
and the TypeScript loader accepts those bytes with the same hash and lock.
The [oracle output](oracle.log) also independently derives initial IDs using the
[numeric profile](../../spec/conformance/numeric-profile.md); the normal walk uses
those literal target IDs and checks the actor and cloak holder.
All 19 prior fixture files and existing sources remain unchanged.

## Actual checks

- `mise exec -- mix test test/loka/content_sampler_test.exs test/loka/cartridge_cross_kernel_test.exs`:
  [three tests passed](compiler-tests.log); independent compiler answer and actual
  compiler-to-TypeScript loader/canonical/hash/lock agreement.
- `NODE_NO_WARNINGS=1 mise exec -- node --test mobile/authority/local-story/sampler.test.ts mobile/app/sampler.test.ts`:
  [three tests passed](focused.log). The normal invocation path reaches all six rooms,
  accepts before acquisition, checks sight, locked cellar refusal, keys, trunk
  unlock/open/take, reciprocal door open/close, wear/remove, sit/rest/stand, active/met/
  dropped/terminal journal, both lantern choices and all scene lines. Real SQLite
  closes and reopens on line two; retried trigger keeps the revision/report count.
  Executing the App shell with controlled native APIs stores the sampler pin in its
  own file; Start over replaces it while the existing Lantern file stays byte-identical.
- [Seven actual mutants](mutations.json) failed their relevant checks. Each mutation
  was restored, then the focused tests passed again. Failure logs cover
  [missing capability](mutant-missing-equipment-capability.log),
  [unreachable key](mutant-unreachable-cellar-key.log),
  [wrong point choice](mutant-wrong-point-choice.log),
  [wrong slot](mutant-wrong-cloak-slot.log),
  [missing scene start](mutant-missing-scene-start.log),
  [wrong save binding](mutant-app-reuses-lantern-save.log) and
  [wrong bundle](mutant-app-rebundles-lantern.log).
- [Generator 12 → 13 input remap](seed-remap.json) preserves each inherited source,
  first command and full/drained resource representative. No gameplay answer changes.

Raw captures are redacted and hashed in [SHA256SUMS](SHA256SUMS), with
[verification](SHA256SUMS.verify). These headless runs establish no native layout,
menu fit, gestures or device persistence observation.

## Acceptance remaining

| Requirement | Status |
|---|---|
| Approved identity/prose, independent artifact, dual loader, normal invocation and real SQLite reopen | Proven above |
| Release Simulator sampler cartridge load/menu fit and kill/relaunch mid-scene with C1 presenter | Pending coordinated integration with c1-touch; no native proof claimed |
| Independent primary and separate Sol review, exact-head CI | Pending draft PR workflow |
| Gate C1 owner's iPhone play and touch-to-visible-feedback | Gate work, not supplied by this headless slice |

Self-review: Ponytail before implementation; Ponytail Review found no extra runtime
layer, dependency or speculative API. Correctness review checked actual source/fixture,
reference/default oracle, own-file open/delete and both point-choice branches; seven
mutants failed. The tests add content reachability, alternative wiring and actual App
binding checks rather than repeating rule conformance suites.
