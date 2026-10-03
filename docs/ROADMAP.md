# Roadmap to the first playable build

Planning, not spec: document 14 (with [pre-release-proof.md](archive/spec/pre-release-proof.md))
sets the gates; this page is the current slice plan.
Slices follow [the delivery workflow](WORKFLOW.md). The owner approved six R3 PRs,
compile-time Elixir contracts and the verification harness
([record](archive/decisions/owner-decision-roadmap-2026-09-24.md)); the later slice counts and the
estimate are the PM's planning, not owner decisions.

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
| R7/R8 for chapter one | 12 + gate | Approved 2026-10-02 ([record](decisions/owner-decision-chapter-one-plan-2026-10-02.md)); slices in [C1 slices](#c1-slices), ending at Gate C1. Planned after R6P, before R10. Every item left LATER, with its trigger, is in the record's §2 triage table; the content carries are in the [content decisions](decisions/owner-decision-chapter-one-content-2026-10-02.md) (each says where it takes effect). New carries from C1 reviews are added here, one clause each. LATER (c1-attributes): ancestries (00 §2; fey-touched's spell word waits for chapter two), trigger: the first content that offers an ancestry choice. LATER (c1-equipment): the two finger slots, trigger: the first content with rings (chapter two); slot compatibility, two-handed and dual wield (00 §4.4), trigger: the first two-handed or off-hand weapon content; granted modifiers and item affects, trigger: the first item with an affect; cursed and no-remove items, trigger: the first cursed item; a targetless cartridge alias of take, drop or give is listed but never accepted, trigger: the first content with such an alias; typed text cannot name a worn item (target resolution looks only in the room and held items), trigger: `loka play` or a typed client needs it; `bin/red_controls.exs` deletes an untracked file already at a planted path, trigger: its next change (then it refuses to plant over an existing file). LATER (c1-locks): `put` into a container, trigger: the first content that stores an item; text examine of an item inside a container, trigger: `loka play` or a typed client needs it; contents of worn containers, trigger: the first wearable container; target resolution throws past 1024 candidates with no overflow outcome (`kernel/ts/src/target.ts:35`), trigger: a TargetResolution version with one; a player can lock a container whose key is inside it (runtime lockout; c1-locks review F-1), trigger: content that lets a player carry a lockable container holding its own key, or the `put` command. LATER (c1-position): position regeneration bonuses (00 §4.2), trigger: the time model (chapter two); `meditating` (room-view need #2), trigger: the first content that reads it (spell words); sleeping characters cannot act, take double damage and wake on damage exactly once (21 §28), trigger: combat. LATER (c1-journal): journal keys in the pinned Lantern release, trigger: retaining the old pinned release when a new Lantern release is added (journal keys reach the phone first in c1-sampler); inline `continuationId`, trigger: the next necessary change to that boundary offers a typed replacement satisfying the rule purity guard. |
| Playtest and tune | open | after R6P, ended by the owner ([owner decision](archive/decisions/owner-decision-playtest-2026-09-25.md)): the owner plays on the phone; the PM batches the notes into small PRs: number tuning and UI styling (short review), changed or new mechanics and behaviour (normal slices, spec first). Terminal playtests with `loka play` run from R5 S6b on. The rule that a format change never breaks installed content starts at the first release to real players. Before that first release: report rows saved before #92 hold the key `milestone` and `deliver` sends them unchanged; no shipped save holds one ([review](archive/reviews/2026-10-01-r78-story-point-rename-review.md)). UI batch from the Gate R6P play (owner, paraphrased), presenter-only with short reviews, after the Presenter split: U7 first, a bug: a vertical joystick drag sometimes slides the whole app (the iOS bottom-edge system gesture); keep the joystick where it is and defer the bottom-edge system gestures (`preferredScreenEdgesDeferringSystemGestures`) with an Expo config plugin, never by hand-patching `ios/`; U1 drop the 'tap the title to look' hint; U2 one Look, no Scan button (the engine `scan` verb stays); U3 Journal, Carrying and Settings leave the bottom bar for a pane opened from the status line's stats; U4 no '>' before log events; U5 tapping an NPC opens a context menu that holds the dialogue; U6 joystick up/down, the direction label opposite the drag; U8 of the two divider lines near the footer, remove the one above the joystick; the save-error text set flush left (`mobile/app/SaveError.tsx`); the footer map's 'you' dot drifting after page turns (Polish O-1, [review](archive/reviews/2026-10-02-r6p-polish-review.md)). DEFERRED from Gate R6P (owner-accepted, paraphrased): before the first release, a fresh tester who has not seen the game completes each choice path by touch without developer instructions ([pre-release-proof](archive/spec/pre-release-proof.md#evidence-required-to-finish-r6p) :84). |

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
| c1-journal | `c1-journal` | in review | [#138](https://github.com/lorecrafting/lokacore/pull/138) |
| c1-chapters | `c1-chapters` | planned | |
| c1-scenes-modal | `c1-scenes-modal` | planned | |
| c1-sampler | `c1-sampler` | planned | |
| c1-touch | `c1-touch` | planned | |
| Gate C1 | `c1-gate` | planned | |
