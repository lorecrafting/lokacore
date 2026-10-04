# Roadmap to the first playable build

Planning, not spec: document 14 (with [pre-release-proof.md](archive/spec/pre-release-proof.md))
sets the gates; this page is the current slice plan.
Slices follow [the delivery workflow](WORKFLOW.md). The owner approved six R3 PRs,
compile-time Elixir contracts and the verification harness
([record](archive/decisions/owner-decision-roadmap-2026-09-24.md)); the later slice counts and the
estimate are the PM's planning, not owner decisions.

The red-control existing-file carry is closed: plants preflight occupied paths and create exclusively;
`test/loka/red_controls_test.exs` proves an occupied file is refused with its bytes preserved.

The verification harness (registered invariants, the deterministic simulator, fault simulation) is adopted ([record](archive/decisions/owner-decision-roadmap-2026-09-24.md)) and described in [architecture.md](system/architecture.md#hosts) and the [owner rules](system/owner-rules.md#architecture-and-engine); its planning text is [archived](archive/ROADMAP.md#verification-harness-adopted-2026-09-24).

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
| R7/R8 for chapter one | 12 + gate | Approved 2026-10-02 ([record](decisions/owner-decision-chapter-one-plan-2026-10-02.md)); all 12 [C1 slices](#c1-slices) done, Gate C1 [closure checklist](C1-GATE.md) pending. Carries and their triggers live in [C1 carry checkpoints](#c1-carry-checkpoints); content decision details remain in their linked record. |
| Playtest and tune | open | after R6P, ended by the owner ([owner decision](archive/decisions/owner-decision-playtest-2026-09-25.md)): the owner plays on the phone; the PM batches the notes into small PRs: number tuning and UI styling (short review), changed or new mechanics and behaviour (normal slices, spec first). Terminal playtests with `loka play` run from R5 S6b on. The rule that a format change never breaks installed content starts at the first release to real players. Before that first release: report rows saved before #92 hold the key `milestone` and `deliver` sends them unchanged; no shipped save holds one ([review](archive/reviews/2026-10-01-r78-story-point-rename-review.md)). UI batch from the Gate R6P play (owner, paraphrased), presenter-only with short reviews, after the Presenter split: U7 first, a bug: a vertical joystick drag sometimes slides the whole app (the iOS bottom-edge system gesture); keep the joystick where it is and defer the bottom-edge system gestures (`preferredScreenEdgesDeferringSystemGestures`) with an Expo config plugin, never by hand-patching `ios/`; U1 drop the 'tap the title to look' hint; U2 one Look, no Scan button (the engine `scan` verb stays); U3 Journal, Carrying and Settings leave the bottom bar for a pane opened from the status line's stats; U4 no '>' before log events; U5 tapping an NPC opens a context menu that holds the dialogue; U6 joystick up/down, the direction label opposite the drag; U8 of the two divider lines near the footer, remove the one above the joystick; the save-error text set flush left (`mobile/app/SaveError.tsx`); the footer map's 'you' dot drifting after page turns (Polish O-1, [review](archive/reviews/2026-10-02-r6p-polish-review.md)). DEFERRED from Gate R6P (owner-accepted, paraphrased): before the first release, a fresh tester who has not seen the game completes each choice path by touch without developer instructions ([pre-release-proof](archive/spec/pre-release-proof.md#evidence-required-to-finish-r6p) :84). C1 room/details polish [#143](https://github.com/lorecrafting/lokacore/pull/143) merged; dialogue/Contents/pickup iteration is authorized under its [record](decisions/owner-decision-c1-dialogue-contents-polish-2026-10-03.md). |

60 planned slices after R3 (3 R4 + 1 observability + 11 R5 + 9 R6 including P1 and SM + 3 SM2 + 7 early R7/R8 + 11 R6P + 1 docs compaction + 1 presenter split + 1 quest from dialogue + 12 chapter one). Estimates and re-estimates are in [the archive](archive/ROADMAP.md).

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
| Gate C1 | `c1-gate-close` | closure preparation; [checklist](C1-GATE.md) | |

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
| Next UI checkpoint; reviewed again at the next gate | UI-FUZZ-01 and UI-PHONE-01: complete the deferred investigation and human/device proof under the [canonical acceptance record](decisions/owner-decision-c1-gate-ui-deferral-2026-10-03.md). |
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
| Later chapter-one content | Approved child-status reactions, three dawn endings and Aldric/S4 spell-word deferral remain routed by the [content decisions](decisions/owner-decision-chapter-one-content-2026-10-02.md). |
| First ancestry-choice content | c1-attributes: ancestries (00 §2); fey-touched's spell word waits for chapter two. |
| First rings / two-handed or off-hand weapon / affect / cursed-item content | c1-equipment: finger slots; slot compatibility, two-handed and dual wield; granted modifiers/item affects; cursed/no-remove items. Each corresponding content type triggers its own capability work. |
| First content reading meditating / first combat | c1-position: meditating waits for a reader (spell words); sleeping action restrictions, double damage and wake-on-damage once (21 §28) wait for combat. |
| First put / wearable container / held lockable container containing its own key | c1-locks: put into containers; contents of worn containers; self-key runtime lockout (review F-1) before content can lock its only key inside a held container, or put can do so. |
| First touch recipient selector | Touch Give: supply a projected valid recipient; meanwhile suppress incomplete item-only Give and preserve complete invocations ([Book UI](system/book-ui.md)). |
| First typed worn/nested-item consumer / targetless item alias | Equipment: typed targets omit worn items; locks: typed examine omits nested items. Revisit when a typed client needs them. A targetless take/drop/give alias is listed but never accepted; revisit before first such authored alias. |
| Next necessary dialogue boundary change / retained older Lantern release with journal text | c1-journal: inline continuationId when a typed replacement satisfies rule purity; journal keys for a retained pinned Lantern require its own release handling. Current development sampler replacement follows its own ruling. |
