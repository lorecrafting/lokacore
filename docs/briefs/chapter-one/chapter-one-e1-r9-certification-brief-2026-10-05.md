# E1 — Repeatable R9 headless/browser certification

> **Publication note:** This is a provisional 2026-10-05 planning brief. Source heads, merge status and installed capabilities below describe the baseline inspected when drafted. Check the [current roadmap](../../ROADMAP.md) and re-pin merged dependencies before assignment; this brief does not authorize implementation or certify proof.

Provisional PM brief, 2026-10-05. **Provisional until the full mechanics merge; not source GO, an adopted certification policy, a gate pass, or native certification.** Parent plan: [public chapter completion plan](../../MISSING-CHILD-PLAN.md).

**2026-10-06 packaging assignment:** implementation begins from published
`71c3323dee2d9265e59587957eea3e3c90f544ac` under the bounded active
[exact candidate proof policy](../../system/architecture.md#e1-exact-candidate-proof-policy).
The [packaging evidence](../../evidence/2026-10-06-e1-runner-packaging/README.md)
records author checks and pending acceptance. The [current bundled chapter](../../system/cartridge.md#current-bundled-chapter)
supplies the inspected candidate pin; final published A–D plus Round2 fixes source identity
and the certification verdict remain unassigned until those dependencies merge and run.

## Outcome, branch and dependencies

Suggested branch: `proof/e1-r9-minimum-certification`; developer creates its own worktree. A developer can run the applicable minimum checks against one frozen candidate, retain a failing scenario with enough identity to reproduce it, and distinguish a proved gate from an unavailable host row. Reuse the existing compile/load, fixture/differential, simulator, transcript and real-SQLite fault tools. No general search framework, dashboard, signed publication service or generalized CoverageManifest.

Inspected baseline was initially clean PM HEAD `0fbd284784f4e4756ea40e8bbcc46da6a3e02339`. At final read-only recheck PM HEAD is `f467f75b1e5a68462e61987f078508dafcf97a42`, chapter `ashmere_missing_child@0.0.12`, API1.11; ROADMAP records PR190 merged and both complete Q2 return paths. This baseline still has 16 room files and three quest files; it cannot be the full-chapter candidate. A–D remain dependencies. No implementation checks or candidate evidence were captured by this planning task.

Packaging may begin after A3's final-acknowledgement/story-point path and B2's timed quest have merged. Final runner/policy acceptance requires every A–D semantic surface merged, the implicit position/scene→fact loader dependency closure verified (source merged in [#264](https://github.com/lorecrafting/lokacore/pull/264), [review](../../reviews/2026-10-06-e1-loader-integrated-review.md)), and each consuming brief's selected parameters/failure rules recorded. E2 adds interaction receipts; E3 supplies full-content/browser-human receipts and uses this runner again at its final candidate. An E1 merge does not preapprove either later artifact.

Re-pin before implementation: dependency merge SHAs, current system clauses, changed contract fixtures and real command/fault coverage. Final candidate version/hash/allocation, engine revision, protocol/schema revision, certification-policy/check revision, E1 PR/head and browser storage host remain **null** until inspected. Record deployment identity as explicitly not applicable for this bundled private Story candidate, rather than inventing a deployment hash.

## Governing clauses

Amend the relevant active clauses before implementation in the same PR; archived text is the plan for new certification work.

| Requirement | Governing source |
|---|---|
| Minimum gates and feature-derived applicability | `docs/archive/spec/09-cartridge-lab-certification.md` §1a and §20 Gate applicability classes; `docs/spec/release-scope.md` Feature-level applicability and Limits and later scope |
| Exact candidate and reproducible identity | 09 §§2,25,36–37; `docs/archive/spec/14-implementation-plan.md` R9 Build minimum first/Gate R9 |
| Per-step deterministic foundation and rules | `docs/system/architecture.md` Two kernels, one semantic contract/Hosts; `docs/system/protocol.md` Decision loop/Composition/Budgets/Invariants; archived 15 DET-01–10 |
| Changed rows, receipt-before-reply, uncertain commit and typed refusal | `docs/system/save.md` Opening a story/Receipts/Commit, fence, reconcile/Story points/The game trace; archived 15 OFF-03–07 |
| Same shared Book authority flow; no renderer writer | `docs/system/architecture.md` Mobile import rules; `docs/system/book-ui.md`; `docs/system/protocol.md` ActionSet and admission/GameView |
| Independent oracles, real faults and retained evidence | `AGENTS.md` Writing tests; `docs/lessons/contracts.md`, `docs/lessons/storage.md`, `docs/lessons/evidence.md`, and before any mobile-host changes `docs/lessons/mobile.md`; `docs/CHECKS.md` |
| Headless sim retained; browser-first with native deferred | The [adopted mobile pause](../../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md) and current workflow govern routing. Existing simulator-first/per-slice native records remain history, not browser evidence. |

Old 09/14 references to two endings are superseded by `docs/decisions/owner-decision-chapter-one-content-2026-10-02.md`: three child outcomes/five valid child×bell variants. Old tide/North Gate/novice fixtures need the no-wait/current content decisions, not silent fixture rewrites.

## Files and smallest implementation

Read/reuse `bin/check_all.sh`, `bin/loka`, `kernel/ts/test/sim{,.test,_batch}.ts`, `kernel/ts/play/replay.ts`, `kernel/ts/test/transcripts.test.ts`, `mobile/authority/local-story/{faults,recovery,saves,story_points}.test.ts`, current chapter tests, `test/loka/cartridge_missing_child_hash.py`, and compiler/loader/registry tests. Preserve the separate historical simulator corpus and its 10,000-fresh-sequence CI job.

In scope: one thin headless certification entrypoint plus a bounded engine-owned applicability table/report only where no existing helper provides it; controlled repro fixtures/tests in existing proof directories; `docs/system/{architecture,cartridge,future}.md` as needed; one E1 brief/review/evidence index and linked roadmap state. Proposed tool/report paths must be chosen after the re-pin and kept explicit in the PR. No new runtime abstraction or production table. JSON plus existing validation/hash tools is sufficient for evidence; do not introduce a new protocol contract solely for a private report.

The current `protocol/feature_registry.json` describes authoring kinds. It is **not** an implemented certification-policy registry. Derive used semantic features from the admitted compiled artifact and the engine's dependency declarations, including implicit rule dependencies. `docs/spec/release-scope.json` is planning input, not certificate authority. A missing known dependency or unknown feature/version cannot produce a skipped green gate. Keep the classifier bounded to implemented forms; an unknown form blocks pending explicit policy disposition.

The current `sim.ts` default loads curated `cartridge_*hash.json` fixtures; new chapter fixtures are not automatically the same corpus. Select the frozen chapter explicitly using the simulator's existing cartridge argument or a minimal caller. A generic green default run cannot stand in for chapter-specific evidence. `sim.ts`'s generated `loka play --replay` trace is playback without invariant checks; the retained failing repro must also re-check the failed invariant against the exact initial state. Never describe playback alone as reproduction.

Out of scope: engine mechanic fixes beyond a proved packaging defect, broad fixture cleanup, old-save migration, Realm/server story adapters, native builds/DeviceHub/Simulator, owner save/preview access, R11 Builder, accounts/cloud sync/store release and UI blur. A genuine mechanic defect goes back to the owning developer through a reviewed fix, then changes invalidate affected receipts.

## Candidate and repro records

Freeze normalized artifact bytes and store their independently checked content hash before execution. Each gate receipt binds candidate ID/version/hash, artifact byte digest, engine/portable-rules source SHA, protocol/schema and capability-lock identity, check/policy revision, host/toolchain identity, command and exit status, plus references to hashed raw evidence. Browser host/storage receipts identify the real adapter and its limits. Nonapplicable fields carry a reason; unknown facts stay null and cannot satisfy required identity.

Each failure additionally retains initial-state hash/controlled construction, logical clock, RNG algorithm/state/seed, deterministic world/IdSource identity, ordered commands, fault schedule, expected invariant and observed result. Fresh-start and adjusted-start scenarios are distinguished. Export these sufficient inputs with a literal expected failure, not only a seed whose meaning changes with the generator. Candidate bytes and check implementation stay discoverable without local scratch paths.

Minimal report statuses: pass with a resolvable receipt, fail with repro, not applicable with the engine-policy reason, and deferred/pending with its owner checkpoint. Missing evidence is never pass. A headless/browser subset may be complete while full R9 device-dependent rows remain pending; do not emit an unqualified promotable `offline_private` certificate.

## Acceptance and proof controls

1. Run static schema/reference/unknown-field/template-cycle/capability/localization/asset checks on the frozen artifact. Reject a hand-built artifact missing an implicit required fact dependency before world creation. Demonstrate the existing compiler/loader boundary rejects unknown capability/version/used feature. Test a removed dependency and an unknown applicability entry: the certification command exits nonzero and names the missing obligation.
2. Inventory every actual chapter command type and meaningful mutation/admission path from the final compiled features. Map each to the existing controlled test/fault receipt and name uncovered paths; a family-level capability label cannot hide a newly added command. Topology/quest/world/scene gates include executable scenario/model checks, not filename counts or source-text matching. E3 supplies the final complete content scenarios; missing inputs stay pending.
3. DET-01–10: repeat each controlled scenario and compare per-step canonical domain result, committed state, RNG and deterministic identity using frozen/hand-checked expected values. Preserve >32-key canonical-order vectors, numeric boundaries and two-kernel foundation fixture/differential checks. Accepted failed rolls advance RNG exactly once; pure rejection/fault changes no state/RNG/cost. DET-02/08 native comparison remains deferred; Node repetition or browser agreement is not ARM/Hermes proof.
4. OFF-03–07: for every chapter command type's distinct commit path, the real local authority/SQLite harness observes before-transaction kill, after-COMMIT-before-adoption/display kill, duplicate same-payload retry, changed-payload conflict, real SQLITE_FULL, a genuinely failed COMMIT and a succeeded-COMMIT-with-lost-result branch. Assert literal all-prior or all-next rows/receipt/reports, then reopen and invoke the later consumer. Typed malformed-save/pin refusal offers explicit recovery without silent reset. SQLite uses rollback journal `delete` as specified in the storage lessons.
5. Distinguish host fault injection from actual app lifecycle proof: process kill and real Node SQLite establish the listed host transaction contract. Browser refresh/close establishes only the observed browser host behavior. Native app kill/background/offline/error-screen rows remain pending even when the logical recovery harness passes.
6. Required end-to-end coverage records each quest outcome, dialogue choice and scene beat, reward-once and consequence scope; lawful committed intermediate saves reopen through the real loader. Acknowledged finale writes the story point and local pending report atomically once. Do not require a live account server in Lab proof.
7. Reproduce the retained failures from a clean isolated worktree with the pinned toolchain and inputs. Wrong candidate, wrong initial-state hash, missing fault schedule or truncated evidence must refuse or clearly remain incomplete. Editing candidate content after freeze creates a new identity and invalidates candidate-specific receipts. A prior green source SHA cannot certify a final changed SHA.

Required red controls reuse existing distinct tests where they already fail. Add only uncovered realistic regressions: remove dependency/unknown applicability to catch false green; adopt memory before failed COMMIT to catch loss of atomicity; replay after freshness instead of before to catch a retry refusal/double effect; omit a pending story report to catch premature finale success. Name each new test's realistic break before its body. Plant at least one transaction fault in the real path and one applicability defect, observe the exact focused check fail, restore the source and rerun. Keep the smallest repro. No test derives its expected value from the classifier/kernel being tested.

Validation: `mise exec -- bin/check_all.sh`; targeted existing kernel/mobile/compiler/fixture commands for the changed proof path; normal pre-push and exact-head shared CI including `sim`. Keep actual exit statuses and failing lines. No native job is claimed run merely because its historical workflow still exists. Before handoff apply Ponytail Review and a correctness pass over the actual diff; report both. Fresh primary reviewer plus workflow-required risk audit/opinion; merge only after scoped findings close and every started head job is green.

## Risks and stop triggers

Main risks: a broad lock mistaken for used semantics, incomplete dependency closure, a replay that does not assert its invariant, self-generated expected answers, mutated final candidate, and conflating browser storage with SQLite/native lifecycle. The bounded report addresses these without a new Lab framework.

Stop and return evidence if applicability is genuinely unknown, a required mechanic/implicit dependency remains unbuilt, a current-contract fixture change lacks its reviewed contract amendment or independent expected answers (obsolete development fixtures may be replaced under the [forward-development policy](../../decisions/owner-decision-forward-development-2026-10-05.md)), current system/spec conflict cannot be settled by adopted decisions, a new server rule adapter is required, or native/owner-save/paid work becomes necessary. A deferred host row is a recorded carry, not authority to run it or mark it passed. PM resolves a scope/policy decision; developer fixes a proven code defect through the normal workflow. Final E1 source/hash/allocation and certification verdict remain null until this acceptance is actually executed.

Planning self-review: Ponytail retained one thin runner over existing tools and a bounded applicability table; no generalized Lab/search/certificate service. Correctness pass checked exact identity, implicit dependencies, invariant-sensitive reproduction, real commit fault branches and host-claim separation. This author check is not independent implementation review.

The [legal 57-room route author checks](../../evidence/2026-10-06-e1-legal-routes/README.md)
retain the topology recipe's distinct red control. The [provisional integration checkpoint](../../evidence/2026-10-06-e1-topology-integration/README.md) records source-bound registration and 57 room visits; final certification remains pending.

Optional quest route checkpoint: [controlled debt and Lantern dream receipts](../../evidence/2026-10-06-e1-optional-quests/README.md), with remaining outcomes pending.

Optional exact recorder/replay integration: [provisional receipts and remaining-path breakdown](../../evidence/2026-10-06-e1-optional-integration/README.md); final E1 proof remains pending.
Disjoint path author checkpoint: [watch rounds and the original blocked marsh Start](../../evidence/2026-10-06-e1-night-watch/README.md); registration and final certification remain pending.

Disjoint path author checkpoint: [Wisp ward and four funded herb exchanges](../../evidence/2026-10-07-e1-wisp-herbs/README.md); registration and E1 certification remain pending.

[Dialogue and selected choice binding](../../evidence/2026-10-07-e1-dialogue-binding/README.md) is a bounded checkpoint; other authored paths and final certification remain pending.

[Reviewed Watch, Wisp and herb route registration](../../evidence/2026-10-07-e1-route-registration/README.md) records a corrected-source 16-case replay with 609 authored obligations still pending.

[Maud's five-credit cellar route](../../evidence/2026-10-07-e1-maud-cellar/README.md) is a source-bound author checkpoint; recorder registration and E1 certification remain pending.

[Modal scene acknowledgement binding](../../evidence/2026-10-07-e1-modal-scene-binding/README.md) is a clean-source recorder checkpoint with ten dream scene paths and other authored obligations pending.

[Selected dialogue policy binding](../../evidence/2026-10-07-e1-dialogue-policy-binding/README.md) is a bounded checkpoint for an accepted `all` branch; other authored policy paths remain pending.

Disjoint path author checkpoint: [legal Night route after the published checker fix](../../evidence/2026-10-07-e1-night-published/README.md), preserving the original failure receipt; independent review/registration and E1 certification remain pending.
