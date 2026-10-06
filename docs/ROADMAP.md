# Roadmap to the first playable build

Planning, not spec: document 14 (with [pre-release-proof.md](archive/spec/pre-release-proof.md))
sets the gates; this page is the current slice plan.
Slices follow [the delivery workflow](WORKFLOW.md). The owner approved six R3 PRs,
compile-time Elixir contracts and the verification harness
([record](archive/decisions/owner-decision-roadmap-2026-09-24.md)); the later slice counts and the
estimate are the PM's planning, not owner decisions.

The complete [M1–M23 mechanics slice list](NEXT-MECHANICS.md) gives each lettered slice,
its dependencies, lift and acceptance. Prepared assignments are in the [brief index](briefs/README.md).
The [actual chapter cutover](decisions/owner-decision-actual-chapter-cutover-2026-10-05.md)
sets the active development source and save. The [real chapter cast decision](decisions/owner-decision-real-chapter-cast-2026-10-05.md)
retires Old Bram from active Q1 planning; the [queue](NEXT-MECHANICS.md) routes Q1
design from Ashmere’s actual cast and retains the no-wait route rule.
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
| M mechanics continuation | 23 groups; PR count unset | Plan merged [#150](https://github.com/lorecrafting/lokacore/pull/150) under [PM adoption](decisions/pm-decision-mechanics-continuation-plan-2026-10-03.md): [M1–M23 queue](NEXT-MECHANICS.md), dependencies, lift and acceptance; implementation [brief index](briefs/README.md). Parallel [M4-A first-encounter planning](briefs/m4-a-first-encounter.md). Distinct from historical M1 quest-from-dialogue. M1-A [#153](https://github.com/lorecrafting/lokacore/pull/153) merged; M1-B1 driver/save [#154](https://github.com/lorecrafting/lokacore/pull/154) merged; M1-B2 lifecycle/UI/sampler [#155](https://github.com/lorecrafting/lokacore/pull/155) merged; M2-A position recovery [#156](https://github.com/lorecrafting/lokacore/pull/156) merged after primary/Astra findings were closed and a separate Sol fix recheck; M3-A carrying limits [#159](https://github.com/lorecrafting/lokacore/pull/159) merged after the custody-cycle finding was fixed and independently rechecked; M4-A contract [#151](https://github.com/lorecrafting/lokacore/pull/151) merged; M5 chapel-approach content [#152](https://github.com/lorecrafting/lokacore/pull/152) merged. M5-A entity-specific persisted HP for five passive cellar rats [#165](https://github.com/lorecrafting/lokacore/pull/165) merged after two independent approvals; M5-B durable corpse custody and same-body shrine return [#167](https://github.com/lorecrafting/lokacore/pull/167) merged after provenance/order test gaps were fixed and independently rechecked; The listed M1–M5 engine and supporting content PRs are merged. Legend reconciliation [#136](https://github.com/lorecrafting/lokacore/pull/136) merged ([decision](decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md), [review](reviews/2026-10-04-legend-mechanics-reconciliation-review.md)). M6-A first live cellar fight and focused combat page [#168](https://github.com/lorecrafting/lokacore/pull/168) merged after the scheduled-opponent departure/save-reopen finding was fixed and independently rechecked. Supporting mechanics lessons [#169](https://github.com/lorecrafting/lokacore/pull/169) merged. M20-B1 atomic Maud reward and usable storage mechanics [#171](https://github.com/lorecrafting/lokacore/pull/171) merged after the older-API gate finding was superseded by the owner pre-production policy and independently re-reviewed; M20-B2 playable Maud quest, earned reward and usable chest content [#172](https://github.com/lorecrafting/lokacore/pull/172) merged after an independent APPROVE and exact-head CI; its isolated Release walk proved five rat kills, reward, cold-reopen Put/Take and the Book side-quest ending fix. |
| Later chapter mechanics lookahead | provisional; PR count unset | [C2/C3/CC quest-consumer queues](LATER-MECHANICS.md), after current Missing Child work. No installed mechanic, active M renumbering or completed-slice credit. |
| Playtest and tune | open | after R6P, ended by the owner ([owner decision](archive/decisions/owner-decision-playtest-2026-09-25.md)): the owner plays on the phone; the PM batches the notes into small PRs: number tuning and UI styling (short review), changed or new mechanics and behaviour (normal slices, spec first). Terminal playtests with `loka play` run from R5 S6b on. The rule that a format change never breaks installed content starts at the first release to real players. Before that first release: report rows saved before #92 hold the key `milestone` and `deliver` sends them unchanged; no shipped save holds one ([review](archive/reviews/2026-10-01-r78-story-point-rename-review.md)). UI batch from the Gate R6P play (owner, paraphrased), presenter-only with short reviews, after the Presenter split: U7 first, a bug: a vertical joystick drag sometimes slides the whole app (the iOS bottom-edge system gesture); keep the joystick where it is and defer the bottom-edge system gestures (`preferredScreenEdgesDeferringSystemGestures`) with an Expo config plugin, never by hand-patching `ios/`; U1 drop the 'tap the title to look' hint; U2 one Look, no Scan button (the engine `scan` verb stays); U3 Journal, Carrying and Settings leave the bottom bar for a pane opened from the status line's stats; U4 no '>' before log events; U5 tapping an NPC opens a context menu that holds the dialogue; U6 joystick up/down, the direction label opposite the drag; U8 of the two divider lines near the footer, remove the one above the joystick; the save-error text set flush left (`mobile/app/SaveError.tsx`); the footer map's 'you' dot drifting after page turns (Polish O-1, [review](archive/reviews/2026-10-02-r6p-polish-review.md)). DEFERRED from Gate R6P (owner-accepted, paraphrased): before the first release, a fresh tester who has not seen the game completes each choice path by touch without developer instructions ([pre-release-proof](archive/spec/pre-release-proof.md#evidence-required-to-finish-r6p) :84). C1 polish [#143](https://github.com/lorecrafting/lokacore/pull/143), [#144](https://github.com/lorecrafting/lokacore/pull/144) and [#148](https://github.com/lorecrafting/lokacore/pull/148) merged; supporting kernel layout [#146](https://github.com/lorecrafting/lokacore/pull/146) and authored-description projection [#147](https://github.com/lorecrafting/lokacore/pull/147) merged. |

M1-B3 — still-offered Book controls across live-clock redraws — merged in [#173](https://github.com/lorecrafting/lokacore/pull/173) after independent approval and exact-head CI; it includes the Maud-acceptance west-exit regression.
NW-01 — always-available sampler Bram — merged in [#175](https://github.com/lorecrafting/lokacore/pull/175) after independent approval, six green source-head checks and a late-hour Release Simulator smoke; the historical development sampler reached 0.0.11, while the engine's schedule fixture remains covered.

CHAPTER-01 — actual chapter cutover — merged in [#176](https://github.com/lorecrafting/lokacore/pull/176)
after independent approval, a separate save/bundle opinion and six green source-head checks:
distinct Missing Child cartridge/save, retained playable Maud S1, retired temporary
Lantern/Bram content. This is an incremental chapter release, not full chapter completion.
Real Q1 awaits design from the actual Ashmere cast and rooms, without the sampler
errand or Old Bram ([cast decision](decisions/owner-decision-real-chapter-cast-2026-10-05.md)).

M12-A — read the Missing Child landing notice and inn rumor board — merged in
[#177](https://github.com/lorecrafting/lokacore/pull/177) after the authored-alias
Book finding was fixed, independently rechecked and approved; a separate protocol
opinion and six green source-head checks cover chapter release 0.0.2.

UI-DETAIL — item-detail event history before options — merged in
[#178](https://github.com/lorecrafting/lokacore/pull/178) after independent approval,
three killed UI regressions and exact-head CI; item narration stays in the detail pane.

CONTAINER-ELIGIBILITY — only authored receptacles accept item storage — merged in
[#179](https://github.com/lorecrafting/lokacore/pull/179) after independent approval,
separate protocol/save approval and six green source-head checks; the real chapter is 0.0.3.

CAST-DIRECTION — real Missing Child uses the Ashmere cast, not Old Bram or the sampler —
merged in [#180](https://github.com/lorecrafting/lokacore/pull/180) after independent
approval and green docs-head checks; Q1 giver remains to be designed.

LOCAL-FAST-LOOP — owner testing on Debug/Metro with playable-checkpoint source switches
and coherent PR batching — merged in [#181](https://github.com/lorecrafting/lokacore/pull/181)
after independent approval and green docs-head checks.

WEB-FIRST-PAUSE — mobile-specific CI checks, native builds and device Simulator
verification paused while headless engine simulation stays active — merged in
[#191](https://github.com/lorecrafting/lokacore/pull/191) after two workflow-review
findings were fixed and independently rechecked. Five source-head CI checks and
final review-head checks passed. The [owner decision](decisions/owner-decision-web-first-mobile-pause-2026-10-05.md)
sets the temporary routing; browser preview implementation remains separate.

WEB-PREVIEW — the actual Expo/React Native Book runs in a local browser with
Fast Refresh and an isolated browser save — merged in
[#194](https://github.com/lorecrafting/lokacore/pull/194) after primary and
save-recovery reviews, five green source-head checks and green review-head checks.

DOC-READ-ONCE — agents reuse governing documents already loaded in their own
context — merged in [#195](https://github.com/lorecrafting/lokacore/pull/195)
after independent approval and green docs-head checks.

BUILDER-LEARNING — the Builder's Guide uses real chapter examples and points
future story authors from review findings to reusable lessons, contracts and
tests — merged in [#197](https://github.com/lorecrafting/lokacore/pull/197)
after independent approval and green docs-head checks.

M12-B — nested notice-board and notice detail pages — merged in
[#182](https://github.com/lorecrafting/lokacore/pull/182) after the cold-reopen,
navigation-label and malformed-save findings were fixed; primary and protocol/save
rechecks approved, with six green source-head checks and green review-only head checks.

OPEN-ELSPETH — real opening-room NPC directs newcomers toward Well Lane, the Green
and the inn — merged in [#183](https://github.com/lorecrafting/lokacore/pull/183)
after independent primary and pin/save approvals, six green source-head checks and
green review-only head checks. Chapter release 0.0.5 does not yet offer Q1.

FEN-01 — the first south search route from Ferry Landing through Reed Path, Reed Bank,
Willow Shade and Drowned Oak — merged in
[#184](https://github.com/lorecrafting/lokacore/pull/184) after the clue-title finding
was fixed and primary and pin/save reviewers approved. All six source-head checks
passed, with green review-only head checks. Release 0.0.6 remains pre-Q2; the rest
of the fen and rescue route follow separately under the
[FEN-01 decision](decisions/pm-decision-fen01-south-search-2026-10-05.md).

Q1-A — Elspeth's first Wren clue: accept The First Lead, find the fox drawing on
Village Green and report it as a possible lead — merged in
[#185](https://github.com/lorecrafting/lokacore/pull/185) after primary and pin/save
approvals, six green source-head checks and green review-only head checks. Chapter
release 0.0.7 leaves Q2 search and rescue for later slices.

FEN-02 — the all-hours route through Mire Crossing to Fox Hollow with two descriptive
detail pages — merged in [#186](https://github.com/lorecrafting/lokacore/pull/186)
after primary and pin/save approvals, six green source-head checks and green
review-only head checks. Chapter release 0.0.8 remains pre-Q2 discovery and rescue.

Q2-A — automatic Missing Child search activation after Q1 and Study of Reed Bank
tracks — merged in [#187](https://github.com/lorecrafting/lokacore/pull/187)
after the malformed-receipt recovery finding was fixed and independently rechecked.
The primary and separate save opinions approved, six source-head checks passed,
and the final review-only head checks passed. Chapter release 0.0.9 keeps Q2 active;
Wren has not yet been found.

Q2-B — meet Wren and Vesper at Fox Hollow and solve the durable letter-bank
riddle — merged in [#188](https://github.com/lorecrafting/lokacore/pull/188)
after the malformed dialogue-source recovery finding was fixed. Primary and
separate protocol/save rechecks approved, six fix-source checks passed, and the
final review-only head checks passed. Chapter release 0.0.10 keeps Q2 active;
the escort or message return remains to be built.

Q2-C-stays — carry Vesper’s unique message to Elspeth and resolve the complete
`stays` path — merged in [#189](https://github.com/lorecrafting/lokacore/pull/189)
after the forged-terminal-save finding was fixed. Primary and separate save
rechecks approved, six fix-source checks passed, and the final review-only head
checks passed. Chapter release 0.0.11 offers one complete return path.

Q2-C-rescue — escort the original Wren, recover after death separation, and return
him to Elspeth for the `rescued` path — merged in
[#190](https://github.com/lorecrafting/lokacore/pull/190) after malformed saved Q1
references were fixed. Primary and separate Sol save rechecks approved, five
scheduled source-head checks (including headless `sim`) passed, and the final
review-record head passed its checks. Chapter release 0.0.12 offers both complete
return paths.

A1 Q3-B — reach the bell and resolve the prior/lost path — merged in
[#196](https://github.com/lorecrafting/lokacore/pull/196) after the scene-contract and
save-reopen findings were fixed, independently rechecked and approved. The lost
outcome is now playable.

B1 — authored calendar and truthful Book sun/moon status — merged in
[#201](https://github.com/lorecrafting/lokacore/pull/201). A2 Q3-F — the
fox/silent-bell outcome after Wren's return — merged in
[#202](https://github.com/lorecrafting/lokacore/pull/202) at chapter 0.0.15/API1.13.
Local and GitHub `main` have completed **24 of the 33** proposed Chapter 1 completion slices
(A1, B1, A2, B2, A3, B3, B4, B5, B6, B7, B8, B9, C1, C2, C3, C4, D5, D2, D1, D4, D3, D12, D6, D7). The latest source publication is
[#253](https://github.com/lorecrafting/lokacore/pull/253), D7 bounded deer sight flight, replacement and conserved hides.
Supporting [#200](https://github.com/lorecrafting/lokacore/pull/200) adds Book keyboard
exits. [#203](https://github.com/lorecrafting/lokacore/pull/203) adopts the B2
Chandler's Debt quest contract, and [#204](https://github.com/lorecrafting/lokacore/pull/204)
adopts the A3 Green finale and five-outcome plan; neither PR alone completed a source slice.
The owner's [one-time hosted-CI exception](decisions/owner-decision-local-draft-pr-cadence-2026-10-05.md)
applied to these five merges while GitHub Actions delayed and cancelled runners.
B2 Chandler's Debt quest mechanics are implemented and independently reviewed on
local `main` at chapter 0.0.16/API1.14. The accumulated local and six hosted checks
passed for [#205](https://github.com/lorecrafting/lokacore/pull/205). A3 Green finale is implemented at chapter
0.0.17/API1.15 and independently approved after the bound-Continue and save-proof
findings were fixed ([primary review](reviews/2026-10-05-a3-green-primary-review.md),
[save review](reviews/2026-10-05-a3-save-second-review.md)). Both are published in #205.
B3 Peg's finite shop is implemented at chapter 0.0.18/API1.16 and independently
approved after its ID-pin and schema-example findings were fixed
([primary review](reviews/2026-10-05-b3-pegs-shop-primary-review.md),
[save review](reviews/2026-10-05-b3-pegs-shop-save-second-review.md)). It is published in #205. B4 refillable light and
safe dark-well recovery have an [adopted plan](decisions/pm-decision-b4-light-2026-10-05.md),
[independent plan approval](reviews/2026-10-05-b4-light-plan-review.md),
[primary source review](reviews/2026-10-05-b4-light-primary-review.md) and
[save/protocol second opinion](reviews/2026-10-05-b4-light-save-second-review.md).
All source findings closed on local `main` at chapter 0.0.21/API1.19, hash
`a274bb1c6b22306718648bbcb1b967ee017e0420b62589afe10e1009434dbbfa`
and 94 IDs. The accumulated local and six hosted checks passed; it is published in #206.

B5 Infirmary Herbs is implemented on local `main` at chapter 0.0.19/API1.17.
Its finite fenwort harvest, four bandage exchanges and bounded Priory contribution
passed focused source proof. Trusted elapsed replay, pinned dialogue roles and
paired quest retirement findings were fixed and independently approved
([primary review](reviews/2026-10-05-b5-infirmary-herbs-primary-review.md),
[save/portable review](reviews/2026-10-05-b5-infirmary-herbs-save-second-review.md)).
It is published in #205.

B6 Wisp has an [adopted all-hours riddle/ward contract](decisions/pm-decision-b6-wisp-2026-10-05.md),
[focused brief](briefs/chapter-one/b6-wisp-ward-riddle-brief-2026-10-05.md),
[primary source review](reviews/2026-10-05-b6-wisp-primary-review.md) and
[save/protocol second opinion](reviews/2026-10-05-b6-wisp-save-second-review.md).
Both source reviews approved exact head `e7aeace7` with no findings. Chapter
0.0.23/API1.21 has independently pinned hash
`e7333f694e6ec2c9f02a39944d994d4452f26fffc5534ff217346504471e4c71`
and 103 IDs. The accumulated local checks and all six hosted checks passed on
the source and final review/evidence heads; B6 is published in #210.

B7 Well and waterskin has an [adopted liquid contract](decisions/pm-decision-b7-well-waterskin-2026-10-05.md)
and [focused brief](briefs/chapter-one/b7-well-waterskin-brief-2026-10-05.md)
with an [independent plan review](reviews/2026-10-05-b7-waterskin-plan-review.md).
Its [primary source review](reviews/2026-10-05-b7-waterskin-primary-review.md) and
[save/protocol second opinion](reviews/2026-10-05-b7-waterskin-save-second-review.md)
approved after the authored-alias, Pour ownership and live-quantity findings were
fixed. Local `main` carries chapter 0.0.22/API1.20, hash
`0f744a6c12e8cde1c70cac454e16c733bf5ec27265fc6ad2cd7ad1b025e9dbf8`
and 96 IDs. Accumulated local and all six hosted checks passed; it is published in #209.

B8 Maud's paid room, food and drink services have an
[adopted immediate-benefit contract](decisions/pm-decision-b8-mauds-services-2026-10-05.md)
and [independently approved plan](reviews/2026-10-05-b8-maud-services-plan-review.md).
The [brief](briefs/chapter-one/b8-mauds-services-brief-2026-10-05.md) now pins
published B7's reviewed source and publication base `547f809c`, chapter
0.0.22/API1.20 with 96 independent IDs. B3/B7/Rest behavioral dependencies are met.
B8 source is published in [#215](https://github.com/lorecrafting/lokacore/pull/215)
at chapter 0.0.25/API1.23, hash
`c8bc55ca6aa55af4b7579e570b3e6f85fce370b80ebda766df16780fa8f8933a`
and 111 IDs. Primary, separate save/protocol and scoped example/validator reviews
approved after findings were fixed. The exact source passed the local full gate and
all six hosted checks before merge. Native preview is paused.

B9 Room at the Lantern has an [adopted actual-Rest/dream contract](decisions/pm-decision-b9-lantern-dream-2026-10-05.md)
and [focused brief](briefs/chapter-one/b9-inn-dream-brief-2026-10-05.md).
It is published in [#226](https://github.com/lorecrafting/lokacore/pull/226)
at chapter 0.0.28/API1.25, hash
`424a4497cca18c9f00b333cc8489eb9e95ce52f5239d6a394e4fa25e3d1fb34e`
and 127 starting IDs. A paid Rest opens a resumable dream; only final
acknowledgement commits its memory and S10 resolution. The
[primary](reviews/2026-10-05-b9-lantern-dream-primary-review.md) and
[save/protocol](reviews/2026-10-06-b9-lantern-dream-save-carryover-review.md)
reviews approved after compiler and Book label findings were fixed. The exact
source passed the local gate, all six hosted checks and final Sol review; the
record-only head passed its applicable hosted checks. Actual Web choice,
Resume, acknowledgement and cold reload passed. Native preview remains paused.

C1 Tobin training has an [adopted acquisition/qualification and armed-fight contract](decisions/pm-decision-c1-tobin-training-2026-10-05.md)
and [focused brief](briefs/chapter-one/chapter-one-c1-tobin-training-brief-2026-10-05.md).
Its [independent plan review](reviews/2026-10-05-c1-tobin-plan-review.md),
[primary source review](reviews/2026-10-05-c1-tobin-primary-review.md) and
[save/protocol second opinion](reviews/2026-10-05-c1-tobin-save-second-review.md)
approved after all findings were fixed. Local `main` carries chapter 0.0.20/API1.18,
the independently pinned hash `78ade4fab1341f1781262ce6327ca8a77ea4e4c0a01fa5279abe7ba874735d3e`
and 92 IDs. The accumulated local check and all six hosted checks passed;
C1 is published in #205.

C2 Watchman's Rounds has an [adopted finite-patrol contract](decisions/pm-decision-c2-watchmans-rounds-2026-10-05.md),
[focused source brief](briefs/chapter-one/chapter-one-c2-watchmans-rounds-brief-2026-10-05.md)
re-pinned for source assignment, and
[independent plan approval](reviews/2026-10-05-c2-watchmans-rounds-plan-review.md).
B1, Q2-C-rescue and C1 are integrated. C2 is published in
[#214](https://github.com/lorecrafting/lokacore/pull/214) at chapter 0.0.24/API1.22
with 109 independent IDs. Its primary, save/protocol, staged browser scope,
terminal cold-reopen evidence, simulator invariant and publication-gate reviews
approved; the exact final head passed the local gate and all six hosted checks.
Tobin's finite four-checkpoint patrol, detour/Rejoin, fatal failure and immediate
Restart are playable. The completed Web save opened cold twice after published
[#213](https://github.com/lorecrafting/lokacore/pull/213), bounded SQLite reads.
Browser fatal/Restart remains a named E3 proof obligation.

C3 Living hounds has an [adopted bounded population/fight-loot contract](decisions/pm-decision-c3-living-hounds-2026-10-05.md)
and [focused brief](briefs/chapter-one/chapter-one-c3-living-hounds-brief-2026-10-05.md).
It is published in [#229](https://github.com/lorecrafting/lokacore/pull/229)
at chapter 0.0.29/API1.25, hash
`f49de549377f7068fac51896ccd1f177241712ed064baaef0fefc14c6c05d67e`
and 140 starting IDs. A bounded hound population persists through day/night replacement;
their fights create real corpses with conserved pelt loot. Confirmed Take stays on
the corpse detail, with Back to World. The
[primary](reviews/2026-10-06-c3-living-hounds-primary-review.md),
[save/protocol](reviews/2026-10-06-c3-hounds-save-second-review.md) and
[Astra proposal](reviews/2026-10-06-c3-proposal-astra-review.md) reviews approved
after remount, receipt-replay and birth-membership findings were fixed. The exact
source passed the local gate, all six hosted checks and final Astra review;
the record-only head passed its applicable hosted checks. C4 hound aggression,
pack assistance and flight followed in [#239](https://github.com/lorecrafting/lokacore/pull/239).

C4 Hound behavior has a [selected bounded pack/flight contract](decisions/pm-decision-c4-hound-behavior-2026-10-05.md)
and [implementation brief](briefs/chapter-one/chapter-one-c4-hound-behavior-brief-2026-10-05.md)
and an independently reviewed implementation integrated with published D1 and D4.
Its v032/API1.28 successor hash and 167 starting IDs are frozen; the cumulative
gate and fresh primary and save/protocol carryover reviews passed. The source merged in
[#239](https://github.com/lorecrafting/lokacore/pull/239) at `2714519c` after all six hosted checks passed.

D2 public Priory rooms and held-book Ward/Bell topics have an
[adopted contract](decisions/pm-decision-d2-priory-books-2026-10-05.md),
[focused brief](briefs/chapter-one/d2-priory-books-brief-2026-10-05.md) and
[independent plan approval](reviews/2026-10-05-d2-priory-books-plan-review.md).
D2 source is published in [#223](https://github.com/lorecrafting/lokacore/pull/223),
with its held-book and Priory interaction proof in the linked source reviews.
D1 paid ferry, Mother Sedge and safe isle return has an
[adopted PM contract](decisions/pm-decision-d1-ferry-isle-2026-10-05.md),
[source brief](briefs/chapter-one/d1-ferry-isle-brief-2026-10-05.md) and
[independent plan approval](reviews/2026-10-05-d1-ferry-plan-review.md),
published in [#217](https://github.com/lorecrafting/lokacore/pull/217).
The source is published in [#231](https://github.com/lorecrafting/lokacore/pull/231)
at chapter 0.0.30/API1.26, hash
`dbff57ba20305dffa4a0679ab58d480574fbc3fd93fddeb3bf08d48d78e057b9`
and 149 starting IDs. It adds six isle rooms, a conserved paid crossing, free
immediate Sedge swim training and an owned-corpse fare waiver. Production Book
ferry/lesson/exploration/return and controlled browser corpse recovery pass;
the [primary](reviews/2026-10-06-d1-ferry-isle-primary-review.md) and
[save/protocol](reviews/2026-10-06-d1-ferry-save-second-review.md) reviews,
six source-head hosted checks and final Sol review approved. The controlled
recovery variant supplies a real island death producer for proof; the public
isle has no attacker or hazard.

D4 homes and orchard has an [adopted contract](decisions/pm-decision-d4-homes-orchard-2026-10-05.md)
and [brief](briefs/chapter-one/d4-homes-orchard-brief-2026-10-05.md).
Its integrated v031/API1.27 source opens Gareth's Smithy, the Orchard and
Elspeth's Cottage, with finite Forage/Take apples and held-item Eat.
[PR #233](https://github.com/lorecrafting/lokacore/pull/233) merged at
`536c80bc76882839465aecc330e22e891e1e137d`: fresh
[primary](https://github.com/lorecrafting/lokacore/blob/e42d467d/docs/reviews/2026-10-06-d4-integrated-primary-review.md) and
[save/protocol](https://github.com/lorecrafting/lokacore/blob/e42d467d/docs/reviews/2026-10-06-d4-integrated-save-second-review.md) reviews
approve, the local gate and isolated browser proof pass, and all six hosted
checks are green on the exact reviewed head.

D3 western Ashmere's five mill/cottage rooms, Hob and readable clues are published in
[#243](https://github.com/lorecrafting/lokacore/pull/243) at chapter v033/API1.28.
The [final independent review](reviews/2026-10-06-d3-western-ashmere-final-review.md),
full local gate, isolated Book browser routes and all exact-head hosted checks passed.

D7 bounded deer is published in [#253](https://github.com/lorecrafting/lokacore/pull/253)
at chapter v036/API1.31. Three cap-one deer have generation-bound delayed sight
flight, replacement and conserved hides. The [final primary review](reviews/2026-10-06-d7-deer-final-primary-review.md)
and [save/protocol review](reviews/2026-10-06-d7-deer-final-save-review.md)
approved the fixed source; the local gate, Book browser routes, SQLite replay,
schema mutation sweep and all exact-head hosted checks passed. The independently
derived hash is `b0c0da219ee8d19a5d6bf0e9d6a18c138d9c5da1543c28e8b1949d5e17aebfc0`
with 199 genesis IDs.

D6 underwater routes, qualified swim, the drowning deadline and owned-bottom-corpse
Chapel recovery are published in [#247](https://github.com/lorecrafting/lokacore/pull/247)
at chapter v035/API1.30. The [selected contract](decisions/pm-decision-d6-water-depths-2026-10-06.md),
[final primary review](reviews/2026-10-06-d6-water-final-primary-review.md),
[save/protocol second opinion](reviews/2026-10-06-d6-water-final-save-second-review.md),
full local gate, bundled Book browser routes, real SQLite recovery/replay and all
exact-head hosted checks passed. The first hosted browser attempt hit a generic
Web SQLite save timeout; an unchanged-head rerun passed, as did the local full
browser suite with one worker.

D12 practical herbalism and haggle is published in
[#245](https://github.com/lorecrafting/lokacore/pull/245) at chapter v034/API1.29.
The [selected contract](decisions/pm-decision-d12-practical-skills-2026-10-06.md),
[final primary review](reviews/2026-10-06-d12-final-primary-review.md),
[save/protocol second opinion](reviews/2026-10-06-d12-final-save-review.md),
full local gate, isolated Book lesson/benefit flows and all exact-head hosted checks passed.

60 planned slices after R3 (3 R4 + 1 observability + 11 R5 + 9 R6 including P1 and SM + 3 SM2 + 7 early R7/R8 + 11 R6P + 1 docs compaction + 1 presenter split + 1 quest from dialogue + 12 chapter one). Estimates and re-estimates are in [the archive](archive/ROADMAP.md).

Legend reconciliation: [#136](https://github.com/lorecrafting/lokacore/pull/136) retains the
original owner records/research and dated alternatives, with the [current PM selections](decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md).
Independent review is complete; this docs update implements no mechanic. The
[research reference](reference/legendmud-system.md) preserves sources and unknowns.

Composition-audit carry PC01 (exit availability follows composed movement admission) is
fixed in [#160](https://github.com/lorecrafting/lokacore/pull/160) after its
[independent review](reviews/2026-10-04-pc01-exit-projection-review.md).
PC11 (invalid fact defaults refused by the cartridge loader) is fixed in
[#161](https://github.com/lorecrafting/lokacore/pull/161) after its
[independent review](reviews/2026-10-04-pc11-fact-default-review.md).

## C1 slices

Owner-approved, in this order, one at a time; each slice's scope and acceptance are in [the record](decisions/owner-decision-chapter-one-plan-2026-10-02.md).

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

- The rest of scene@1 (restricted/presentation_only, overlays/dreams, dialogue/choice,
  role bindings, checkpoints/consequence beats, quest objectives on scene_ended): add
  when chapter content first needs a step or mode beyond the
  [installed modal subset](system/mechanics.md#scene1-mechanicsscenerulets).
- scene_started: add when a consumer needs a separate start event; it requires a
  proposal delivery event hook, with the corresponding review depth.
- SCENE-01 Simulator render/terminate/relaunch is complete: [touch proof](evidence/c1-touch/README.md).
  Headless close/reopen and receipt-retry proof is in the scene review.

## C1 carry checkpoints

These stage rows route the original [plan §2 triage](decisions/owner-decision-chapter-one-plan-2026-10-02.md#2-triage-of-the-row-31-of-31-plus-item-32-from-fix-round-1)
and new review carries; their linked records retain the governing details.

| Stage / checkpoint | Carry and trigger |
|---|---|
| UI follow-up | [UI-FUZZ-01](https://github.com/lorecrafting/lokacore/issues/254): remove the page turn now under the [current owner direction](decisions/owner-decision-ui-fuzz-immediate-2026-10-06.md) and [Book text clarity](system/book-ui.md#text-clarity); native cause, before/after proof and owner feedback remain pending under the mobile pause. UI-PHONE-01 remains at the next UI checkpoint under the [C1 carry](decisions/owner-decision-c1-gate-ui-deferral-2026-10-03.md). |
| Next scene input contract / first independent scene-command client | Fresh-id Continue can advance an unseen line. Touch presentation has been reviewed, but it does not add a line-bearing command guard; install and prove that contract before relying on cross-client stale-tap rejection. |
| Next position/scene artifact-loader boundary change | Implicit fact dependency: compiler adds fact@1 for position/scene; a hand-built artifact omitting it can pass the loader when no authored use requires it. Before general dependency certification, specify and test the loader's implicit rule-dependency closure ([scene boundary observation](reviews/2026-10-03-c1-scenes-modal-review.md#limits-and-nonblocking-boundary-observation)). |
| Time model | Original triage 5/20/22: elapsed-time model, position regeneration and W3–W6/W8/W12/W16/W19/W20; retain world-time reading direction and separately settle protection/interruption. The [content record](decisions/owner-decision-chapter-one-content-2026-10-02.md) routes its novice schedule fixture here. |
| First population consumer | Original triage 10: EntityOrigin with first-spawner provenance, alongside population@1. |
| First job cancellation/rescheduling/completion operation | Original triage 11: generation re-read and skipping stale advance snapshot entries; no current command creates the stale-entry case. |
| First larger scene consumer | Original triage 12: remaining scene@1 modes, role bindings, dialogue/choices, checkpoints and scene-ended quest objectives; scope and start-event trigger in [scene carries](#c1-scene-carries). |
| First narration emit/observer consumer | Original triage 13: narration.emit, observers and rendering names beyond pinned participants. |
| First strict-quest activation root with matching acquisition | Original triage 14: conflicting_write composition; sampler must not compose it. |
| First job-emitted acquisition | Original triage 15: join's before=now branch; prove item_acquired emitted by a job. |
| First selector-overflow contract or content exceeding the selector cap | Original triage 16 and c1-locks target overflow: typed graceful overflow; current selectors are bounded at 1024. |
| First alias-bearing cartridge | Original triage 28: host trace invoked-key identity; sampler declares no alias. |
| First speaker with two simultaneously eligible dialogues | Original triage 30: selection ambiguity policy; sampler has one graph per NPC. |
| First NPC dialogue that exceeds available scrolling space | Original triage 31: legacy menu-fit carry is superseded for the current scrollable presenter; recheck reachability/fit for that new content ([Book UI](system/book-ui.md)). |
| First NPC-to-player item handoff | Original triage 32: explicit acquisition vocabulary/transfer, distinct from hand_over to an NPC. |
| First authored breakable key / one-way or bent passage / keyless locked door | Original triage 1/6/7: install the corresponding content and loader semantics before accepting it. |
| Before public release, after chapter mechanics stabilize | Reviewed clean development baseline: keep current fixtures/traces active and archive or remove obsolete preproduction evidence/checks from active runs; retain Git history and add no compatibility adapters ([preproduction policy](archive/decisions/owner-decision-playtest-2026-09-25.md)). Cleanup is deferred. |
| Later chapter-one content | Approved child-status reactions, three dawn endings and Aldric/S4 spell-word deferral remain routed by the [content decisions](decisions/owner-decision-chapter-one-content-2026-10-02.md). |
| First ancestry-choice content | [D11 character choice](briefs/chapter-one/d11-character-choice-brief-2026-10-05.md) follows D6 water depths and D12 practical skills for real inherited-skill consumers; ancestries (00 §2), with fey-touched's spell word deferred to chapter two. |
| First rings / two-handed or off-hand weapon / affect / cursed-item content | c1-equipment: finger slots; slot compatibility, two-handed and dual wield; granted modifiers/item affects; cursed/no-remove items. Each corresponding content type triggers its own capability work. |
| First content reading meditating / first combat | c1-position: meditating waits for a reader (spell words); sleeping action restrictions, double damage and wake-on-damage once (21 §28) wait for combat. |
| First put / wearable container / held lockable container containing its own key | c1-locks: put into containers; contents of worn containers; self-key runtime lockout (review F-1) before content can lock its only key inside a held container, or put can do so. |
| First touch recipient selector | Touch Give: supply a projected valid recipient; meanwhile suppress incomplete item-only Give and preserve complete invocations ([Book UI](system/book-ui.md)). |
| First typed worn/nested-item consumer / targetless item alias | Equipment: typed targets omit worn items; locks: typed examine omits nested items. Revisit when a typed client needs them. A targetless take/drop/give alias is listed but never accepted; revisit before first such authored alias. |
| Next necessary dialogue boundary change / retained older Lantern release with journal text | c1-journal: inline continuationId when a typed replacement satisfies rule purity; journal keys for a retained pinned Lantern require its own release handling. Current development sampler replacement follows its own ruling. |

M20-B1 — atomic Maud reward and usable storage mechanics — merged [#171](https://github.com/lorecrafting/lokacore/pull/171) under [PM adoption](decisions/pm-decision-m20-b1-reward-storage-2026-10-04.md). M20-B2 — playable Maud quest and chest content — merged [#172](https://github.com/lorecrafting/lokacore/pull/172) with [independent review](reviews/2026-10-05-m20-b2-mauds-cellar-review.md).
