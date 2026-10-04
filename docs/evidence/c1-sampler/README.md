# C1 sampler source and headless proof

Base: `b4d91ea0ac0c02e7590fb33eaa02c5dbc96181b4`. This slice implements
[plan slice 11 / Q2](../../decisions/owner-decision-chapter-one-plan-2026-10-02.md#11-c1-sampler-the-gate-story-q2)
under the [identity and prose delegation](../../decisions/owner-decision-sampler-batch-2026-10-03.md).
It adds content using the current [compiler/loader](../../system/cartridge.md),
[mechanics](../../system/mechanics.md) and [save](../../system/save.md) contracts.
No rule, schema, protocol command, clock behavior or story picker changes.

## Source and independent answer

At `2b4c9d6`, all 23 source JSON files matched the approved author's final snapshot
byte for byte. The [PM band acceptance repair](../../decisions/pm-decision-sampler-bands-2026-10-03.md)
supplements only `cartridge.json` (baseline `world.bands`) and `text.json` (eleven
exact existing UI phrases). The other 21 source files and all 57 adopted story
values remain unchanged. The current [catalog](../../../cartridges/ashmere_sampler/text.json)
SHA-256 is `04b109f2dd02bbc6308c8c96f56f95496c2b0fca9c8a0a759292640318f0d64a`.
The original 57-string catalog SHA-256 was
`c9625cf219728e27efb27923ed302d02cfed51df1fa099239db6ffb76285808b`.
The exact owner-presented [prose batch](owner-prose-batch.txt) is retained as historical
raw text; its pending-approval/readiness statements describe preparation before the
linked delegation. Its SHA-256 is
`05e8865400e5a5c1cdac8669a972d87d7561fd6d1c32bb0c2543446a29967288`.
[Author provenance](provenance.json) distinguishes prototype reuse, adaptation and
new microquest text; its PM supplement records the two source-file additions. Those origin claims are author evidence; the implementation
verifies the adopted file bytes, not a new inspection of the prototype.

The [Python oracle](../../../test/loka/cartridge_sampler_hash.py) independently
assembles literal approved semantics, compiler-owned facts/resources and reference
expansion. Only the adopted story strings and reused UI labels are copied from source; the
world-band table is independently hand-declared. Python stdlib
canonical encoding/hash produces the [fixture](../../../protocol/fixtures/cartridge_sampler_hash.json),
content hash `5631ddf63007b837bef1e91dfb71fcfb8d31847257210c5de1caa5b198a771b5`.
The actual Elixir compiler matches the expected artifact byte for byte (16,587 bytes),
and the TypeScript loader accepts those bytes with the same hash and lock.
The [current oracle output](band-oracle.log) also independently derives initial IDs using the
[numeric profile](../../spec/conformance/numeric-profile.md); the normal walk uses
those literal target IDs and checks the actor and cloak holder.
All 19 prior fixture files and existing sources remain unchanged.

## Actual checks

The initial proof logs below describe `2b4c9d6` before the band repair. Current
[compiler/cross-loader checks](band-compiler-tests.log) pass three tests, and
[gameplay/SQLite/App checks](band-focused.log) pass three tests with the new hash.
Fresh HP projects `ready`/`normal` with the exact catalog phrase “is in perfect health.”
[Removing the table](band-mutant-missing-band-table.log) and
[removing its top-band text](band-mutant-missing-band-text.log) separately fail
the controlled walk/loader; [both actual red controls](band-mutations.json) were restored.

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
- The [initial ordinary pre-push](initial-prepush.log) passed Elixir (254 tests), kernel
  checks/typechecks/red controls and formatting, then failed two existing mobile
  fault-anchor tests because the fixture pool changed their selected cartridges.
  The [fault input remap](fault-seed-remap.json) preserves all 17 original sources,
  first-command types and full/drained resource profiles. Details 16314 → 61998
  preserves wait(1), wait(1), look(detail); dusk 114 → 422 preserves ring_bell. Every
  literal expected outcome/revision/clock remains unchanged. The [focused real
  SQLite fault corpus](fault-tests.log) then passed all 19 tests, including both anchors.
  Final ordinary pre-push passed; all six exact `fc5a6f1` CI checks passed, independently confirmed in the [review](../../reviews/2026-10-03-c1-sampler-review.md).

Raw captures are redacted and hashed in [SHA256SUMS](SHA256SUMS), with
[verification](SHA256SUMS.verify). These headless runs establish no native layout,
menu fit, gestures or device persistence observation.

## Acceptance ledger

| Requirement | Status |
|---|---|
| Approved identity/prose, independent artifact, dual loader, normal invocation and real SQLite reopen | Proven above |
| Content-owned condition phrase/tone | Fresh ready/normal/catalog proven above; final native phrase/normal tone and menu fit [proven](../c1-touch/README.md); warning/danger use controlled tests |
| Release Simulator sampler cartridge load/menu fit and kill/relaunch mid-scene with C1 presenter | Final clean integrated `9732b0e` Release [proves](../c1-touch/README.md) the supplemented hash, menu fit and scene line-two relaunch with identical state/receipts |
| Independent primary and separate Sol review, exact-head CI | [Primary APPROVE and separate Sol APPROVE](../../reviews/2026-10-03-c1-sampler-review.md); all six source-head CI checks passed |
| Gate C1 owner's iPhone play and touch-to-visible-feedback | Gate work, not supplied by this headless slice |

Self-review: Ponytail before implementation; Ponytail Review found no extra runtime
layer, dependency or speculative API. Correctness review checked actual source/fixture,
reference/default oracle, own-file open/delete and both point-choice branches; seven
mutants failed. The tests add content reachability, alternative wiring and actual App
binding checks rather than repeating rule conformance suites.
