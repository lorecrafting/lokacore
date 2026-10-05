# E2 — Compact R9C interaction cartridge

> **Publication note:** This is a provisional 2026-10-05 planning brief. Source heads, merge status and installed capabilities below describe the baseline inspected when drafted. Check the [current roadmap](../../ROADMAP.md) and re-pin merged dependencies before assignment; this brief does not authorize implementation or certify proof.

Provisional PM brief, 2026-10-05. **Provisional until full mechanics merge; not source GO, an implemented cartridge, a gate pass or native proof.** Parent plan: [public chapter completion plan](../../MISSING-CHILD-PLAN.md). Runner/policy dependency: [E1 repeatable certification](chapter-one-e1-r9-certification-brief-2026-10-05.md).

## Outcome, branch and dependency pin

Suggested branch: `proof/e2-r9c-interaction-cartridge`; developer uses an isolated worktree. Build a small permanent, synthetic cartridge whose legal scenarios prove that the chapter's implemented mechanisms compose. It is intentionally unpolished and has separate identity/save/transcripts from the real chapter. Reuse the same compiler, loader, kernel, local authority, Book presenter and E1 runner; never build a second game model to make proof easier.

Final read-only inspected baseline: clean PM `f467f75b1e5a68462e61987f078508dafcf97a42`, production chapter v012/API1.11; ROADMAP records PR190 rescue merged. Final R9C cartridge ID/version/hash/allocated IDs, engine revision, schema/policy revisions, E1 merge and E2 source/PR remain **null**. Suggested source directory `cartridges/r9c_interactions/` is a proposal, not an existing cartridge. Re-pin actual installed feature forms after A–D and E1 merge; collect minimal cross-feature regression inputs during those consumers rather than postponing their tests.

E1 provides exact-candidate selection and conservative applicability; A3 supplies acknowledged scene/story-point consequences; B/C/D supply real commerce/liquid/light/status/training/population/behavior/overlay/transport forms. Only merged features with named interactions enter this cartridge. E2's independent artifact does not inherit the production chapter hash or its content acceptance. E3 later re-pins E2's exact engine/check revision and reruns applicable evidence against its frozen chapter candidate.

## Governing clauses

| Behavior | Governing source |
|---|---|
| Current mechanics only; compact permanent architecture corpus | `docs/archive/spec/14-implementation-plan.md` R9C Build/Gate R9C |
| Minimum applicability, invariant/fault evidence | `docs/archive/spec/09-cartridge-lab-certification.md` §§1a,2,20,25,29,31,37; E1 brief |
| Writer ownership, actor, scope, causal order and conflict budgets | `docs/system/architecture.md` Building mechanics by composition/Two kernels, one semantic contract; `docs/system/protocol.md` Decision loop/Composition/Budgets/Events/ActionSet and admission/Target resolution |
| Exact custody, barrier, quest, scene, elapsed and later installed rules | `docs/system/mechanics.md` each owning capability's updated clause; `docs/system/cartridge.md` source/loader clauses; exact A–D amended contracts at re-pin |
| Atomic recovery and receipt replay | `docs/system/save.md` Receipts/Commit, fence, reconcile/Narration on reopen/Story points; archived 15 DET-01–10/OFF-03–07 |
| Browser projection and authority freshness | `docs/system/book-ui.md`; `docs/system/protocol.md` GameView; `docs/system/architecture.md` Mobile import rules |

R9C passes only available headless/browser rows here. Under ADR-074, both kernels still run portable foundation fixtures/differentials; story rules remain TypeScript-only until an actual server consumer. Hermes and physical host comparison remain deferred. A synthetic pass does not prove the chapter is coherent, understandable, or ready to ship.

## Scope and files

In scope: the bounded synthetic source directory; new independent artifact/hash/allocation fixtures and transcripts under the repository's current fixture conventions; one small interaction scenario suite using existing helpers; selected real-SQLite recovery/Book-projection cases; brief/review/evidence indexes and precise active system/future links. Hash oracle follows the existing independent `test/loka/cartridge_*_hash.py` convention, not the compiler's own hash helper. Choose actual new fixture names after the ID/version decision; do not edit frozen old answers.

Read/reuse `lib/loka/content/`, kernel loader/step/gameView/target-resolution/invariant functions, `kernel/ts/test/sim.ts`, `kernel/ts/test/{transcripts,cartridge}.test.ts` and existing corresponding capability tests; `mobile/authority/local-story/{authority,session}.ts` and fault/recovery tests; Book presenter/selection tests. Read `docs/lessons/{contracts,storage,evidence,mobile}.md` before the corresponding changes. Where an existing test already kills the exact interaction mutant, link its receipt and add only the cartridge scenario needed for standing integration coverage.

Out of scope: production Ashmere copy/quests/parameters, native builds or save/preview operations, engine features created just for coverage, LokaScript, spatial InstancePlan, ServiceJob escrow/queue, party/Realm/cross-authority work, store/accounts, synthetic mobile UI, a generic behavior tree or search generator. No new multi-actor command admission merely to satisfy a synthetic actor example. Preserve the existing supported actor model and exercise unauthorized/foreign actor refusal at its real boundary.

## Minimal interaction matrix

Every row uses a few controlled entities/rooms/commands, literal expected results and the later consumer that reveals the break. Synthetic labels are sufficient. Not every capability needs a standalone new test; each scenario must cross a meaningful boundary.

| Interaction | Observable result and plausible regression |
|---|---|
| Actor/scope + typed consequence | Two bound roles with explicit scopes; allowed player command touches only its scoped row/target. Foreign command actor is refused without mutation. A reaction uses its committed actor/target bindings; literal non-target row stays unchanged. Detect using the world's player/nearby role instead of the bound participant. |
| Text ambiguity + touch identity + stale invocation | Two matching nouns return canonical ordered candidates; distinct cards choose the exact different targets. A touch/text command for the same selected identity has equal domain result. A still-offered action survives elapsed redraw via the shared client contract; departed/changed-target/scene-line identity refuses. Detect picking the first string match or accepting a consumed continuation. |
| Exact custody + load/container admission + reciprocal barrier | Move one item through player, authored receptacle and another legal holder, then unlock/open/traverse both faces. Unique ownership, mass and barrier state stay coherent across refusal and retry. Detect a missed source debit, brass-key-like non-container admission or one-sided barrier update. |
| Quest fork + causal reaction + scene-end report | Fork from one valid common snapshot into mutually exclusive literal terminal outcomes. Distinct scoped reactions/scene consequences follow each; duplicate events/commands cannot duplicate reward or report. Final acknowledgement owns export/story point; no early export. Detect wrong ordering, another branch switch, false credit or render-triggered consequence. |
| Scoped dream overlay + elapsed/custody | Enter the actual overlay subset, choose its bounded branch, close/reopen before acknowledgement and exit legally. World elapsed jobs continue; no overlay entity/location/item leaks. Detect resolving Rest from menu opening or exporting an overlay-owned object to normal space. No spatial instance is invented. |
| Due jobs + behavior conflict + follower death | Use merged arbitration on a tiny legal schedule/follow/hostility case with exact roles and pending generation. Due jobs re-read prior committed changes; departed/dead actors cannot attack or grant route credit. Player death separates a follower and the legal recovery/rejoin path remains usable. Detect stale job reads, wrong follower identity or duplicate assist turns. |
| Spawn provenance + population cap + loot/scavenging | Spawn/kill/reopen/respawn one bounded supported population; scavenger acquires an eligible dropped item and yields reachable retrieval. Count/provenance/loot remain literal and bounded; protected quest/corpse items retain eligibility rules. Detect respawning a second live origin or creating loot on replay. |
| Immediate money/service + item/liquid/light conservation | Buy/use/refill a controlled real item, pour between supported holders and make one paid transport/service. Payment, stock/custody/liquid/fuel state commit together; carrying refusal leaves all unchanged. Retry does not charge/drink/refill twice; return/corpse access is available. Detect source quantity/coin debit omitted or service relocation before commit. |
| Skill qualification + harm/status + RNG/clock | Literal unlearned, learned-unqualified and qualified inputs exercise the actual skill-dependent effect, a real status producer and its cure. Record exact conditional draws and due boundary. Rejection changes no RNG; accepted failed roll advances once. Detect extra draw, missing qualification or stale expiry after cure. |
| Receipt fault + later cross-mechanic consumer | Fault one transaction that changes at least two domains, then reopen through the real loader and execute its dependent action. Observe all-prior or all-next, one receipt/reward/report, no false fresh narration. Detect partial cross-domain durability/adoption or receipt replay after freshness. |

At re-pin, each row either names its exact installed source form and literal scenario or has a documented nonapplicability reason based on the frozen artifact. Unknowns block. Select the smallest combined cases that cover these interactions; do not create ten near-identical fixture worlds or a generic matrix interpreter. Parameters come from the synthetic cartridge, not new kernel literals.

## Acceptance and red controls

1. Compiler and loader both admit the new independent artifact with closed schema/locks; short references expand and ID/hash outputs match independent answers. Static malformed/unknown use refuses before world/save mutation. Its source does not replace or retarget historical/prod fixtures.
2. Each legal ordered scenario runs through the actual kernel and, for durable interactions, the real authority/SQLite connection. At every committed intermediate state, close/reopen and run the next consumer; never skip an awkward legal state by rewriting the fixture. Compare literal domain result/state/RNG and invariant observations, then replay its exact inputs.
3. The E1 runner reports every used feature/transitive dependency, required gate and row disposition. Artifact and engine/check identities are separate and all receipts resolve. Actual branch/choice/scene/command coverage is listed; an unused capability is not coverage.
4. At least one **actual cross-mechanic defect not already caught by the focused suite** is planted in a throwaway worktree and fails this cartridge's focused scenario. Recommended search order: due-job generation reads before an earlier reaction, payment conserved while liquid source is not debited, or a death-separated follower granting later route credit. Pick a real reachable interaction from the final code; do not invent a mutant that production cannot encounter. Record mutant location, scenario, literal wrong result and failing invariant. If focused tests already catch all candidates, report that fact and retain the smallest integration red control with its shared coverage reason; do not falsely claim new detection.
5. Also verify existing guard sensitivity relevant to the selected cases: remove a source custody debit; allow a mutually exclusive terminal change; export before final acknowledgement; omit provenance/cap; move memory before a failed COMMIT. Reuse a current failing check where sufficient; new tests must catch a distinct regression and name that break before their body. Restore source and rerun once. Schema changes, if unavoidable, require the full bound/required mutant sweep.
6. Use rollback-journal real SQLite faults: failed write, genuinely failed COMMIT, successful COMMIT/lost acknowledgement and kill before/after commit. Every partial transaction stays fenced, reconciliation answers the prior/next state correctly, and duplicate same-payload retry is once-only. Node SIGKILL is a host transaction test, not a claim that a native app was killed.
7. Browser/Node runs compare identical controlled commands/seed to portable domain results where the browser harness exists. Browser refresh proves only its actual storage adapter. No browser result substitutes for Hermes, native accessibility/input, native SQLite or physical lifecycle evidence; those remain named pending rows.

Run `mise exec -- bin/check_all.sh`, focused synthetic/compiler/loader/transcript/kernel/local-authority checks, normal push and exact-head CI including headless `sim`. Record actual exit statuses. Apply Ponytail Review and correctness review to the actual diff. Independent fresh primary review and gate risk audit follow `docs/WORKFLOW.md`; authors do not supply their own independent verdict.

## Risks, stop triggers and handoff

Risks: an adversarial cartridge growing into a second product; a nominal feature declaring coverage without executing it; both hosts agreeing on the same wrong oracle; legal intermediate saves skipped; synthetic success mistaken for production/native success. Keep each scenario concrete and small.

Stop if a row requires an unimplemented future feature, admits a second command actor, changes frozen foundation answers, conflicts with a merged system clause, exposes an unfixed engine defect or needs native/owner-save work. Return the smallest failing repro to the owning slice, not an unrelated framework. No independent expected answer is regenerated to accept the faulty behavior.

Handoff includes exact synthetic artifact and source/check identities, scenario/coverage table, red-control repro/restore receipts, actual local/CI results, self-review disposition and deferred Hermes/native rows. Its completion claim is **applicable R9C headless/browser interaction evidence**, not full host certification or R10 content completion.

Planning self-review: Ponytail retained one compact cartridge and concrete scenarios over installed mechanics; no coverage-driven future features, second actor implementation or new interpreter. Correctness pass checked independent oracles, legal intermediate reopen, real fault branches, production/synthetic identity and native limits. This author check is not independent implementation review.
