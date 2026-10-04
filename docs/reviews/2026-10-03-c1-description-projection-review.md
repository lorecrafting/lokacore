# C1 explicit entity description projection review

- PR: [#147](https://github.com/lorecrafting/lokacore/pull/147)
- Commit reviewed: `1f4e27ad0b6c33fda92250d85ae02490a26500b9`
- Diff base: `48405cd9fb5f743470125aaa65b23b374536dc51`
- Reviewer: fresh independent Codex primary; authored none of this slice. Bounded owner-approved stand-in while Claude was unavailable; no model identity inferred. Separate explicit Sol review is appended by the PM.
- Verdict: **APPROVE**

## Acceptance derived before reading the diff

From [PM adoption](../decisions/pm-decision-description-projection-2026-10-03.md), [canonical GameView](../system/protocol.md#gameview), the adopted projection plan and the owner's latest description direction:

1. Optional wire `description: TextKey` on EntityView/ContentView preserves `loka-gameview-v1`. Old examples may omit it; malformed provided values must fail both validators.
2. Current NPC/items copy exactly their required definition description through room, held, worn and reachable-container paths. No suffix inference, name/room-line fallback, unsupported variants or fabricated player projection.
3. Visibility, barriers and actions stay intact. No new mechanic, capability, loader, Elixir runtime, UI or persistence change; simulator/RNG/IDs/state/save formats and sampler pin stay unchanged.
4. All twenty cartridge artifacts, all cartridge sources and the nineteen older corpus sets remain byte-identical. Shared-contract changes use existing generated outputs and minimal invalid controls.
5. Existing full-object tests retain independent expected keys. A controlled unrelated key detects wrong mapping; hidden contents remain hidden. Plausible mutations must fail focused checks.

## Findings

None. `kernel/ts/src/view/view.ts:127` adds exactly `description: e.description` at the existing shared projection site, reached by room/inventory/equipment and flattened contents. The schema adds optional TextKey references without changing required fields or snapshot tags. The diff does not modify story sources, cartridge/entity schemas, mechanics, state, simulator or presentation. Documentation precedes implementation in the commit history; the decision and index/rule links are present.

The existing containment, equipment and locks tests retain their full-object behavior assertions. The controlled cap key `catalog.cap_body` is independent of its short name and catches suffix inference. No new framework, helper or overlapping test is added.

## Verification

Personally performed in an isolated detached checkout of the exact reviewed head:

- Focused Node run of `containment`, `equipment`, `locks` and `validate`: **34 passed**, baseline and final restoration.
- Actual independent omission, short-name mapping and suffix-inference mutations: each exited **1** with the relevant assertion failure.
- Relaxed each generated EntityView/ContentView description TextKey reference to an unrestricted string independently: each existing malformed-key fixture failed at `/description`, exit **1**. This controls the generated validator guard; the schema-to-generator sweep itself was not rerun here.
- Independent git-blob comparison: **234** cartridge-source/artifact files, including **all twenty** hash artifacts, byte-identical to the base; sampler pin remains `813fdf67dab4a1276362b2e3bdad08de8ae51b06d89f2e53bd64de0b1d001caa`. Existing view examples and **652** previous invalid rows remain intact; only two malformed view cases are appended.
- All **nine** retained author-evidence hashes verify. Author logs show the five restored controls and generator check; these are inspected evidence, not my executions.
- Independently inspected the PM's exact-head CI capture: all **six** completed jobs are SUCCESS. Full normal pre-push PASS is PM-reported; no duplicate full check, Mix compile or native operation was run in this review.

Independent redacted controls and their verified SHA256 manifest are retained in the shared private review scratchpad for PM incorporation. The mutation checkout was restored and removed.

## Ponytail Review and remaining scope

Lean already. Ship. One existing function and existing validators/generator cover the change; no abstraction, dependency or speculative mechanics.

No open source-review findings. Native description rendering is exercised by the upcoming UI review; combined native proof and the owner Gate C1 remain pending. This approval covers the bounded projection slice only.

## Separate GPT-6.1 Sol source review

```text
APPROVE — PR147 source delta only.
Head: 1f4e27ad0b6c33fda92250d85ae02490a26500b9
Base: 48405cd9fb5f743470125aaa65b23b374536dc51
Independent reviewer; authored none.

Findings: none.

Acceptance derived before diff from AGENTS.md, WORKFLOW,
canonical protocol, PM adoption/owner direction and adopted plan.
Reviewed every changed file and hunk.

The single view.ts assignment copies e.description through room,
held, worn and reachable-content projections. Visibility and actions
remain unchanged. Optional TextKey fields preserve old omissions and
loka-gameview-v1. No inferred keys, invented prose, players or UI change.
Docs-first commit ordering is confirmed.

Personally verified:
- Read-only focused Node run: 34 passed, zero failures.
- Git-object equality: 234 cartridge source/fixture files unchanged,
  including all 20 hash fixtures and sampler 813fdf67…001caa.
- Existing schema examples and invalid rows retained.
- Generated GameView definitions match the schema.
- Nine evidence checksums match; checkout remains clean.

Inspected author evidence: five red-control logs show expected failures
and restoration logs show 34 passing tests. Mutations were not rerun.
Generator drift PASS is author-reported.
PM personally verified all six exact-head CI jobs completed SUCCESS;
normal pre-push PASS is author-reported.

Limits: no writes, installs, builds, mutations, full checks, subagents
or native/GUI/save/lifecycle operations. Native renderer review and
combined owner proof belong to the upcoming UI review; C1 Gate remains
pending.

Ponytail Review: lean already; no complexity finding.
```
## PM publication

Both independent source verdicts are APPROVE with no findings. Source heads and actual evidence boundaries remain as recorded above. The [primary proof checksum manifest](../evidence/2026-10-03-c1-description-primary/SHA256SUMS) records the retained redacted controls; all hashes were personally verified during publication. Native UI rendering belongs to the following polish slice; this record does not claim owner Gate C1 acceptance.
