# Roadmap to the first playable build

Planning, not spec: document 14 (with [pre-release-proof.md](archive/spec/pre-release-proof.md))
sets the gates; this page is the current slice plan, run per [the delivery workflow](WORKFLOW.md).
Slice counts and estimates are the PM's planning, not owner decisions.

The [Missing Child completion plan](MISSING-CHILD-PLAN.md) ([#192](https://github.com/lorecrafting/lokacore/pull/192))
maps 33 PRs through the remaining player outcomes; the [slice briefs](briefs/chapter-one/README.md)
give candidate assignment detail; [Beads Rust](WORKFLOW.md#beads-rust) mirrors the slices, and this
roadmap remains the published completion record. The [actual chapter cutover](decisions/owner-decision-actual-chapter-cutover-2026-10-05.md)
sets the active development source and save; the [real chapter cast decision](decisions/owner-decision-real-chapter-cast-2026-10-05.md)
excludes Old Bram; required routes follow the [no-wait rule](decisions/owner-decision-no-wait-opening-2026-10-05.md).

## Slices

| Stage | Slices | Content |
|---|---|---|
| R3 to C1 | done | Gates R3, R5, R6, early R7/R8, R6P and C1 ([#149](https://github.com/lorecrafting/lokacore/pull/149), [checklist](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/archive/C1-GATE-2026-10-03.md)) passed; slices, reviews and decisions in [the archive](archive/ROADMAP.md) and the [publication log](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/archive/ROADMAP-2026-10-06.md). Open C1 carries: [C1 carry checkpoints](#c1-carry-checkpoints). |
| M mechanics continuation | 23 original planning groups | [Adopted queue #150](https://github.com/lorecrafting/lokacore/pull/150); dated proposal in [mechanics history](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/archive/NEXT-MECHANICS-2026-10-06.md). Installed Chapter 1 outcomes and remaining proof follow [current completion](#chapter-one-completion). |
| Later chapter mechanics lookahead | provisional; PR count unset | [C2/C3/CC quest-consumer queues](LATER-MECHANICS.md), after current Missing Child work. No installed mechanic, active M renumbering or completed-slice credit. |
| Playtest and tune | open; owner ends stage | [Owner decision](archive/decisions/owner-decision-playtest-2026-09-25.md); historical iterations in the [publication log](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/archive/ROADMAP-2026-10-06.md). Unaided first-tester completion remains a prelaunch obligation. Native proof is paused; current UI deferrals remain in [carry checkpoints](#c1-carry-checkpoints). |

## Chapter one completion

**31 of 33** proposed slices are complete: A1–A3, B1–B9, C1–C6, D1–D12 and E1 ([#288](https://github.com/lorecrafting/lokacore/pull/288)).
The latest chapter source publication is [#263](https://github.com/lorecrafting/lokacore/pull/263),
D10 Map/Where/Knock; the [current bundled chapter](system/cartridge.md#current-bundled-chapter)
owns the release/API/hash/ID pins. **E2 and E3 remain open**; E2 S1, the synthetic cartridge, merged in [#309](https://github.com/lorecrafting/lokacore/pull/309); S0, the runner's second candidate, in [#312](https://github.com/lorecrafting/lokacore/pull/312).
Order: E1 (coverage complete), E2, a Chapter 1 UI polish phase, release-candidate
certification on one frozen source, then E3 and release
([record](decisions/owner-decision-chapter-one-polish-order-2026-10-07.md)).
The [completion plan](MISSING-CHILD-PLAN.md) and [proof briefs](briefs/chapter-one/README.md#e-proof-and-closure)
define the remaining acceptance. Supporting loader dependency closure merged in
[#264](https://github.com/lorecrafting/lokacore/pull/264); save recovery fixes merged in
[#265](https://github.com/lorecrafting/lokacore/pull/265). Neither closes E1 certification.
The [C6 headless checker evidence](evidence/2026-10-06-e1-expedition-invariant/README.md)
records a legal expedition Start correction; it grants no E1 path credit.

The [post-D10 architecture record](evidence/2026-10-06-post-d10-architecture-audit.md)
links that resolved recovery defect and four concrete post-E3 maintenance risks,
with source evidence, triggers and minimal red controls. The PM owns follow-up
scheduling and Beads links; this record does not close E1–E3 or start refactors.
The architecture record was published in [#278](https://github.com/lorecrafting/lokacore/pull/278);
its supplemental Beads follow-ups were published in [#280](https://github.com/lorecrafting/lokacore/pull/280).

The [one-time documentation audit](evidence/2026-10-06-chapter-one-docs-audit.md)
records six findings on its dated baseline. Their reviewed
[repair dispositions](evidence/2026-10-07-chapter-one-docs-repairs.md) are
published; E1–E3 acceptance remains open.

The [dated publication log](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/archive/ROADMAP-2026-10-06.md) retains the individual
PRs, reviewed source identities and historical evidence claims. It is not an
assignment queue. Native verification remains paused under the
[owner ruling](decisions/owner-decision-web-first-mobile-pause-2026-10-05.md).

## C1 scene carries

- Beyond the installed modal subset and [B9 Rest dream](system/mechanics.md#s10-lantern-rest-and-dream-b9-selected-contract): arbitrary overlays, restricted control, role bindings, checkpoints/consequence beats and additional scene-ended quest objectives need a concrete consumer and reviewed contract.
- scene_started: add when a consumer needs a separate start event; it requires a
  proposal delivery event hook, with the corresponding review depth.

## C1 carry checkpoints

These stage rows route the original [plan §2 triage](decisions/owner-decision-chapter-one-plan-2026-10-02.md#2-triage-of-the-row-31-of-31-plus-item-32-from-fix-round-1)
and new review carries; their linked records retain the governing details.

| Stage / checkpoint | Carry and trigger |
|---|---|
| Next UI checkpoint; reviewed again at the next gate | UI-FUZZ-01 and UI-PHONE-01: complete the deferred investigation and human/device proof under the [canonical acceptance record](decisions/owner-decision-c1-gate-ui-deferral-2026-10-03.md). |
| Time model | Elapsed authority and position recovery are installed. E1 must reconcile remaining proof applicability for original W3–W6/W8/W12/W16/W19/W20 against current consumers; retain continuous-time reading and identify any unresolved protection/interruption requirement. The [content record](decisions/owner-decision-chapter-one-content-2026-10-02.md) routes its novice schedule fixture here. |
| First larger scene consumer | Original triage 12: scene modes beyond the installed modal/B9 dream subset, arbitrary role bindings, checkpoints and additional scene-ended quest objectives; scope and start-event trigger in [scene carries](#c1-scene-carries). |
| First narration emit/observer consumer | Original triage 13: narration.emit, observers and rendering names beyond pinned participants. |
| First strict-quest activation root with matching acquisition | Original triage 14: recheck strict-quest activation/acquisition writer composition against an actual consuming root before claiming that case certified. The old sampler restriction is historical. |
| First job-emitted acquisition | D8 now emits job-scoped acquisition to the crow ([contract](system/protocol.md#d8-exact-crow-transport-and-shoo-composition-selected-contract)). Unresolved: prove the quest join's before=now branch for a job acquisition whose actual holder qualifies the player quest. |
| First selector-overflow contract or content exceeding the selector cap | Original triage 16 and c1-locks target overflow: typed graceful overflow; current selectors are bounded at 1024. |
| First NPC dialogue that exceeds available scrolling space | Original triage 31: legacy menu-fit carry is superseded for the current scrollable presenter; recheck reachability/fit for that new content ([Book UI](system/book-ui.md)). |
| First authored breakable key / one-way or bent passage / keyless locked door | Original triage 1/6/7: install the corresponding content and loader semantics before accepting it. |
| Before E1 certification | Complete the current baseline reset/audit under the [forward-development policy](decisions/owner-decision-forward-development-2026-10-05.md). Retain current-behavior guards, independently re-pin changed answers and retire obsolete development-only coverage through reviewed changes. [Fixture migration follow-up](#baseline-audit-follow-up) remains explicit; no blanket fixture deletion or completed-cleanup claim. |
| Later chapter-one content | Child-status reactions and the five valid finale combinations are installed. The Aldric/S4 spell-word deferral remains routed by the [content decisions](decisions/owner-decision-chapter-one-content-2026-10-02.md). |
| First rings / two-handed or off-hand weapon / affect / cursed-item content | c1-equipment: finger slots; slot compatibility, two-handed and dual wield; granted modifiers/item affects; cursed/no-remove items. Each corresponding content type triggers its own capability work. |
| First meditation reader / sleeping combat consumer | c1-position: meditating waits for a spell-word reader. The full sleeping restriction/double-damage/wake-on-damage contract (21 §28) needs an actual sleeping combat consumer; installed standing combat does not itself close that carry. |
| First wearable container / held lockable container containing its own key | Put and earned storage are installed in [M20-B1 #171](https://github.com/lorecrafting/lokacore/pull/171). Unresolved: worn-container contents and self-key runtime lockout (review F-1) before a held lockable container can trap its only key. |
| First touch recipient selector | Touch Give: supply a projected valid recipient; the current presenter suppresses incomplete item-only Give and preserves complete invocations ([Book UI](system/book-ui.md)). |
| First typed worn/nested-item consumer / targetless item alias | Equipment: typed targets omit worn items; locks: typed examine omits nested items. Revisit when a typed client needs them. A targetless take/drop/give alias is listed but never accepted; revisit before first such authored alias. |
| Next necessary dialogue boundary change | c1-journal: inline continuationId when a typed replacement satisfies rule purity. Older-development Lantern migration is not required under the [preproduction policy](decisions/owner-decision-forward-development-2026-10-05.md); retain saved bytes and exact mismatch refusal. |

Closed C1 carries: bound Continue ([A3 review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-05-a3-green-primary-review.md));
implicit position/scene fact dependency ([loader review](reviews/2026-10-06-e1-loader-integrated-review.md));
spawn provenance ([C3 contract](system/protocol.md#c3-spawned-bundles-and-population-composition));
due-job generation re-read ([combat round contract](system/protocol.md#encounter-and-round-supplements-m6-a));
alias identity ([M12-A review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-05-m12-a-readable-review.md));
labelled dialogue selection ([D9 contract](system/cartridge.md#d9-village-reaction-content-selected-contract),
[D9 service/reopen proof and red controls](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-d9-integration/README.md));
NPC-to-player acquisition ([dialogue receive contract](system/mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltssrcmechanicsdialoguesharedts));
ancestry choice ([D11 contract](system/cartridge.md#d11-ancestry-declarations-selected-contract)).
These source proofs do not close E1–E3.

## Baseline audit follow-up

Before E1 certification, inventory remaining sampler and older-release fixtures/tests
against current behavior. For each obsolete development pin, identify the current
regression it still guards, then migrate that proof to the current chapter or record
why deletion is safe; independently derive changed literal answers. The
[Round 1 audit](reviews/2026-10-06-current-baseline-round1-review.md) retains the
findings and exact audited source. This documentation correction does not migrate
or delete runtime fixtures and does not close this follow-up. E1 also resolves the
[known planning-matrix omissions](spec/release-scope.md) before final applicability certification. Preserve owner-save
bytes, current-build retry/reopen, typed exact-pin refusal and explicit Start over.
