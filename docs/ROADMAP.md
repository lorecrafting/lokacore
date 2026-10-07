# Roadmap to the first playable build

Planning, not spec: document 14 (with [pre-release-proof.md](archive/spec/pre-release-proof.md))
sets the gates; this page is the current slice plan.
Slices follow [the delivery workflow](WORKFLOW.md). The owner approved six R3 PRs,
compile-time Elixir contracts and the verification harness
([record](archive/decisions/owner-decision-roadmap-2026-09-24.md)); the later slice counts and the
estimate are the PM's planning, not owner decisions.

The original [M1–M23 mechanics proposal](NEXT-MECHANICS.md) retains dated slice detail.
Current Chapter 1 status and remaining proof follow [completion](#chapter-one-completion);
assignment records are in the [brief index](briefs/README.md).
The [actual chapter cutover](decisions/owner-decision-actual-chapter-cutover-2026-10-05.md)
sets the active development source and save. The [real chapter cast decision](decisions/owner-decision-real-chapter-cast-2026-10-05.md)
excludes Old Bram from the active chapter. Installed Q1/Q2 use the actual Ashmere
cast; required routes follow the [no-wait rule](decisions/owner-decision-no-wait-opening-2026-10-05.md).
The [Missing Child completion plan](MISSING-CHILD-PLAN.md), merged in
[#192](https://github.com/lorecrafting/lokacore/pull/192) after independent review,
maps 33 proposed PRs through the remaining player outcomes, dependencies, relative
lift and proof. Completed rows are recorded below. The
[33 provisional slice briefs](briefs/chapter-one/README.md), merged in
[#193](https://github.com/lorecrafting/lokacore/pull/193) after a dependency finding
was fixed and independently rechecked, provide candidate assignment detail.
The [Beads Rust pilot](WORKFLOW.md#beads-rust-pilot) mirrors all 33 Chapter 1 slices;
this roadmap remains the published completion record.

The red-control existing-file carry is closed: plants preflight occupied paths and create exclusively;
`test/loka/red_controls_test.exs` proves an occupied file is refused with its bytes preserved.

The verification harness (registered invariants, the deterministic simulator, fault simulation) is adopted ([record](archive/decisions/owner-decision-roadmap-2026-09-24.md)) and described in [architecture.md](system/architecture.md#hosts) and the [owner rules](system/owner-rules.md#architecture-and-engine); its planning text is [archived](archive/ROADMAP.md#verification-harness-adopted-2026-09-24).
The full 10,000-fresh-sequence CI simulator now runs in two workers ([#163](https://github.com/lorecrafting/lokacore/pull/163)); its seed and coverage contract is unchanged.

## Slices

| Stage | Slices | Content |
|---|---|---|
| R3 to R5 | 8 + 3 + 1 + 11 | Done; Gates R3 and R5 passed ([R5 review](archive/reviews/2026-09-30-r5-gate-review.md)); slices and decisions in [the archive](archive/ROADMAP.md). |
| R6 | 7 + 1 (P1) + 1 (SM) | Done; Gate R6 [review](archive/reviews/2026-09-30-r6-gate-review.md), deferred items carried (the one list is the [archived row](archive/ROADMAP.md)). |
| SM2 | 3 | Done: #77, #78, #79 (the book UI over the smoke controller); P4A-2 carried to R12 ([archived row](archive/ROADMAP.md)). |
| Early R7/R8 | 6 + 1 (G) | Done: #82 to #96; gate [review](archive/reviews/2026-10-01-early-r7r8-gate-review.md); carries in the R6P, R7/R8 and Playtest rows ([archived row](archive/ROADMAP.md)). |
| R6P | 11 + gate | Done ([gate review](archive/reviews/2026-10-02-r6p-gate-review.md)); deferred: touch-to-photon (R7/R8 row), unaided completion (Playtest row). [Rows](archive/ROADMAP.md) |
| Docs compaction | 2 | Done: #117 (`docs/system/`), #119 (archive, AGENTS.md source of truth; [decision](decisions/owner-decision-docs-compaction-2026-10-02.md)). |
| Presenter split | 1 | Done: #118 (`GameSession`, the words move to `mobile/app`; [review](archive/reviews/2026-10-02-presenter-split-review.md)). [Row](archive/ROADMAP.md) |
| Quest from dialogue | 1 | Done: merged #120 ([review](reviews/2026-10-02-m1-quest-dialogue-review.md)) (M1, [record](decisions/owner-decision-quest-from-dialogue-2026-10-02.md)): Bram's quest starts from his `bram_offer` dialogue choice, not a place action; spec in [mechanics](system/mechanics.md); Lantern hash `806508c7`; device rerun on the iPhone 11 passes ([evidence](evidence/2026-10-02-m1-quest-dialogue-iphone11/README.md)). |
| R7/R8 for chapter one | 12 + gate | Approved 2026-10-02 ([record](decisions/owner-decision-chapter-one-plan-2026-10-02.md)); all 12 [C1 slices](#c1-slices) done, Gate C1 passed via [#149](https://github.com/lorecrafting/lokacore/pull/149), with [closure checklist](C1-GATE.md). Carries and their triggers live in [C1 carry checkpoints](#c1-carry-checkpoints); content decision details remain in their linked record. |
| M mechanics continuation | 23 original planning groups | [Adopted queue #150](https://github.com/lorecrafting/lokacore/pull/150); dated proposal in [mechanics history](NEXT-MECHANICS.md). Installed Chapter 1 outcomes and remaining proof follow [current completion](#chapter-one-completion). |
| Later chapter mechanics lookahead | provisional; PR count unset | [C2/C3/CC quest-consumer queues](LATER-MECHANICS.md), after current Missing Child work. No installed mechanic, active M renumbering or completed-slice credit. |
| Playtest and tune | open; owner ends stage | [Owner decision](archive/decisions/owner-decision-playtest-2026-09-25.md); historical iterations in the [publication log](archive/ROADMAP-2026-10-06.md). Unaided first-tester completion remains a prelaunch obligation. Native proof is paused; current UI deferrals remain in [carry checkpoints](#c1-carry-checkpoints). |

## Chapter one completion

**30 of 33** proposed slices are complete: A1–A3, B1–B9, C1–C6 and D1–D12.
The latest chapter source publication is [#263](https://github.com/lorecrafting/lokacore/pull/263),
D10 Map/Where/Knock; the [current bundled chapter](system/cartridge.md#current-bundled-chapter)
owns the release/API/hash/ID pins. **E1–E3 remain open.**
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

The [dated publication log](archive/ROADMAP-2026-10-06.md) retains the individual
PRs, reviewed source identities and historical evidence claims. It is not an
assignment queue. Native verification remains paused under the
[owner ruling](decisions/owner-decision-web-first-mobile-pause-2026-10-05.md).

## C1 slices

Original owner-approved order; all rows below are completed. Each slice's scope and acceptance are in [the record](decisions/owner-decision-chapter-one-plan-2026-10-02.md).

| Slice | Branch | Status | PR |
|---|---|---|---|
| c1-host | `c1-host` | done | [#129](https://github.com/lorecrafting/lokacore/pull/129) |
| c1-numbers | `c1-numbers` | done | [#131](https://github.com/lorecrafting/lokacore/pull/131) |
| c1-attributes | `c1-attributes` | done | [#133](https://github.com/lorecrafting/lokacore/pull/133) |
| c1-doors | `c1-doors` | done | [#132](https://github.com/lorecrafting/lokacore/pull/132) |
| c1-equipment | `c1-equipment` | done | [#134](https://github.com/lorecrafting/lokacore/pull/134) |
| c1-locks | `c1-locks` | done | [#135](https://github.com/lorecrafting/lokacore/pull/135) |
| c1-position | `c1-position` | done | [#137](https://github.com/lorecrafting/lokacore/pull/137) |
| c1-journal | `c1-journal` | done | [#138](https://github.com/lorecrafting/lokacore/pull/138) |
| c1-chapters | `c1-chapters` | done | [#139](https://github.com/lorecrafting/lokacore/pull/139) |
| c1-scenes-modal | `c1-scenes-modal` | done | [#140](https://github.com/lorecrafting/lokacore/pull/140) |
| c1-sampler | `c1-sampler` | done | [#142](https://github.com/lorecrafting/lokacore/pull/142), [development Look repair #145](https://github.com/lorecrafting/lokacore/pull/145) |
| c1-touch | `c1-touch` | done | [#141](https://github.com/lorecrafting/lokacore/pull/141) |
| Gate C1 | `c1-gate-close` | passed; [checklist](C1-GATE.md) | [#149](https://github.com/lorecrafting/lokacore/pull/149) |

## C1 scene carries

- Beyond the installed modal subset and [B9 Rest dream](system/mechanics.md#s10-lantern-rest-and-dream-b9-selected-contract): arbitrary overlays, restricted control, role bindings, checkpoints/consequence beats and additional scene-ended quest objectives need a concrete consumer and reviewed contract.
- scene_started: add when a consumer needs a separate start event; it requires a
  proposal delivery event hook, with the corresponding review depth.
- SCENE-01 Simulator render/terminate/relaunch is complete: [touch proof](evidence/c1-touch/README.md).
  Headless close/reopen and receipt-retry proof is in the scene review.

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

M20-B1 — atomic Maud reward and usable storage mechanics — merged [#171](https://github.com/lorecrafting/lokacore/pull/171) under [PM adoption](decisions/pm-decision-m20-b1-reward-storage-2026-10-04.md). M20-B2 — playable Maud quest and chest content — merged [#172](https://github.com/lorecrafting/lokacore/pull/172) with [independent review](reviews/2026-10-05-m20-b2-mauds-cellar-review.md).

Closed C1 carries: bound Continue ([A3 review](reviews/2026-10-05-a3-green-primary-review.md));
implicit position/scene fact dependency ([loader review](reviews/2026-10-06-e1-loader-integrated-review.md));
spawn provenance ([C3 contract](system/protocol.md#c3-spawned-bundles-and-population-composition));
due-job generation re-read ([combat round contract](system/protocol.md#encounter-and-round-supplements-m6-a));
alias identity ([M12-A review](reviews/2026-10-05-m12-a-readable-review.md));
labelled dialogue selection ([D9 contract](system/cartridge.md#d9-village-reaction-content-selected-contract),
[D9 service/reopen proof and red controls](evidence/2026-10-06-d9-integration/README.md));
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
