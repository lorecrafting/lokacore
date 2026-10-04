# C1 riskiest-code audit — Astra

Independent GPT-6 Astra audit of `b4d91ea0ac0c02e7590fb33eaa02c5dbc96181b4`, after ten C1 slices. The reviewer authored none. Verdict: **APPROVE WITH NOTES**, no findings. This closes the code-audit part of [Gate C1](../WORKFLOW.md#milestone-gate), not the whole gate. Owner phone play, measured touch-to-visible-feedback and the short gate checklist remain pending.

## Scope carried forward

The PM compared every enumerated audited file against sampler `fc5a6f110211937dd0d3c80b5b743e994f28fb5b` and integrated touch `9732b0ec58f81ae74b7ca4e4cf8dd736d4cd409a`. Only `mobile/app/App.tsx` changed. The fresh separate Sol sampler reviewer explicitly inspected that App diff and its direct callers, with no findings; see the [sampler review and verbatim answer](2026-10-03-c1-sampler-review.md). The touch presenter was separately reviewed; [native evidence](../evidence/c1-touch/README.md) supplies the rendering and scene-relaunch proof that this source audit did not run. Code and final integrated CI were separately verified by the PM.

## Verbatim independent answer

```text
Verdict: APPROVE WITH NOTES
Audited SHA: b4d91ea0ac0c02e7590fb33eaa02c5dbc96181b4
Independent reviewer; authored none.

Audited files (brace lists enumerate files; relevant scope):
- kernel/ts/src/{fresh,behavior,decision,lookups,compose,fact,position,scene,actions,action_lists,invocation,world,view,reaction,proposal}.ts
- kernel/ts/src/rules/{equipment,containment,barrier,position,scene}.ts
- kernel/ts/src/cartridge{,_refs,_barriers,_position,_scenes,_dialogues}.ts
- lib/loka/content/{compiler,artifact,checks,entities,barriers,position,scenes}.ex
- mobile/authority/local-story/{authority,save,store,session}.ts
- mobile/app/{App.tsx,metro.config.js}
- .github/workflows/mobile-bundle.yml
- protocol/scene.schema.json
Supporting evidence: focused tests, frozen wear/locks/rest/scene and numeric/composition/loader fixtures, and C1 host/equipment/locks/position/scenes review records.

Requirements derived first from governing system docs, numeric profile and plan §§4–6:
Deterministic appended holder IDs and conserved transfers; every-ancestor custody with NPC exclusion; fail-closed reachability and reserved-fact writes; modal admission, guarded single start and persisted continuation; durable seed/context and truthful build identity.

Findings: none. No actionable correctness defect found in this bounded audit.
Holder ordering/capacity and composition agree; TypeScript loader and Elixir compiler reachability checks exclude inaccessible/NPC keys. Reserved facts cover all three authored write sites. Scene starts use bounded proposal delivery; receipts precede resolution. Ponytail Review found no speculative machinery to remove.

Personally run:
- 124/124 focused Node tests passed: equipment, locks, position, scene, cartridge, compose, portable_abi.
- Independently reproduced four fixture canonical bytes/hashes and holder UUID literals at ordinals 11–13. Initial probe serializer corrected for JavaScript numeric-key ordering.
- In-memory SQLite probe passed: zero-seed redraw, literal context pin, reconstructed IDs, line-two restoration, trigger/continue retries without duplicate progress, and no ended-scene restart.
- Exact HEAD and clean checkout verified.

Reported, not rerun:
Prior reviews’ implementation/schema red controls and file-backed reopen proofs; PM’s green CI/mobile-build verification.

Declared existing carries:
Fresh-id staleContinue; compiler-only implicit fact dependency promise; held-container key/runtime lockout limits; remaining scene modes and device rendering/kill proof. Future world-time/protection/combat decisions install no behavior here.

Limits:
No mutations, file writes, full checks or native/device runs. Elixir inspection was source-only; build/dependencies unavailable for xref. In-memory authority reopen is not crash proof. Remote main/CI were not independently verified; local main differs from the pinned HEAD.

PM must re-check later diffs to audited files before counting this audit. This grants no merge authorization, owner-play verdict, sampler/device proof or whole-gate closure.
```