# Owner rules in force

One line per active rule, with its record. PM adoptions whose contract is installed in `docs/system` are not listed here: the [index](../decisions/README.md) lists every record. Superseded rules are not listed; their records are deleted
and linked by permalink from the [index](../decisions/README.md), or kept only where code or `protocol/` cites them ([move forward](../decisions/owner-decision-move-forward-2026-10-07.md)). The architecture decisions every agent must
know (candidate C, TypeScript-first rules, the persistence shape, PostgreSQL online and SQLite
offline, the bundled first release) are in [AGENTS.md](../../AGENTS.md#architecture-decisions-already-made-do-not-reopen-silently)
and not repeated here.

## Product and scope

- Chapter 1 proof order: E1 coverage complete, E2, UI polish phase, release-candidate certification, then E3 ([record](../decisions/owner-decision-chapter-one-polish-order-2026-10-07.md)).

- Book design foundation: the Chapter 1 mock's base look with only the page curl (one Skia shader for web and phone) and paper sound; day and night follow in-game time (no override for now) ([record](../decisions/owner-decision-design-foundation-2026-10-07.md)).

- Beads may include concrete, evidence-linked audit follow-up tasks alongside all 33 Chapter 1 slices; the PM owns tracker writes and reviewed merges own closure ([record](../decisions/owner-decision-beads-audit-followups-2026-10-06.md)).

- D1 uses a conserved paid outbound ferry, a free return and owned-corpse fare
  waiver; Sedge teaches swim immediately for free while the Chapel remains the
  death destination ([PM adoption](../decisions/pm-decision-d1-ferry-isle-2026-10-05.md)).

- B7 uses the public well and two finite Peg waterskins for mass-accounted Fill/Pour/Drink, without a passive need or resource benefit ([PM adoption](../decisions/pm-decision-b7-well-waterskin-2026-10-05.md)).

- B1 uses the delegated [chapter calendar/status selection](../decisions/pm-decision-b1-calendar-status-2026-10-05.md): cartridge time units and sky phases drive confirmed Book/CLI status; deadline effects follow in B2.

- B3 Peg's shop starts with a finite four-item authored shelf, exact conserved penny exchange,
  same-ID buyback and no restock ([PM adoption](../decisions/pm-decision-b3-pegs-shop-2026-10-05.md)).

- Only authored receptacles can hold items ([record](../decisions/owner-decision-container-eligibility-2026-10-05.md)).

- Detail pages follow the [canonical Book order](book-ui.md#detail-page-order), with no empty event-log heading or placeholder ([record](../decisions/owner-decision-detail-page-order-2026-10-05.md)).

- Active development targets the real Missing Child chapter; Old Bram is outside its active cast and Q1 must be designed from the actual Ashmere roles, cast and rooms ([cast decision](../decisions/owner-decision-real-chapter-cast-2026-10-05.md), [cutover](../decisions/owner-decision-actual-chapter-cutover-2026-10-05.md)).

- The opening chapter has no required idle waits for tides, night, next day or a returning NPC; any required opening NPC stays reachable, the mire has an always-passable non-swim route, and time may still drive deadlines and ambience ([record](../decisions/owner-decision-no-wait-opening-2026-10-05.md)).

- After each chapter, close the deterministic browser route/UI walk, exploratory E2E pass, visible headed run or video, isolated polish fixes and reruns, and exact-head independent review before calling that chapter closed ([record](../decisions/owner-decision-chapter-closure-e2e-loop-2026-10-05.md)).

- Later Ashmere conflicts follow the [PM-selected future policy](../decisions/pm-decision-later-story-reconciliation-2026-10-04.md); implementation and publication review remain pending, with no active M15/schema change.

- One shared game difficulty; no selectable difficulty modes or separate hard/ironman death policies
  ([record](../decisions/owner-decision-single-difficulty-2026-10-03.md)).
- Fixed time; no player-driven time skips. The later time model follows elapsed time, and rest or
  retrieval does not jump the clock ([record](../decisions/owner-decision-fixed-time-2026-10-03.md)).
- Backgrounding does not pause the world; the later time model preserves elapsed combat, recovery
  and world events ([record](../decisions/owner-decision-background-time-2026-10-03.md)).
- Close C1 after its reviewed checklist and merges under the owner's Simulator acceptance; deferred UI work remains tracked at the next UI checkpoint ([record](../decisions/owner-decision-c1-gate-ui-deferral-2026-10-03.md)).

- The development sampler chapel approach follows the [delegated PM content selection](../decisions/pm-decision-sampler-shrine-approach-2026-10-04.md).
- NPC dialogue/actions use a stable scrolling history with bottom-anchored offered controls; NPC/items use Leave and ordinary confirmed Take returns to World with named pickup narration; the status entry opens Contents with the five existing sections ([record](../decisions/owner-decision-c1-dialogue-contents-polish-2026-10-03.md)).
- Confirmed Take from a corpse's Contents stays on that corpse detail with Back to World and one local pickup line ([record](../decisions/owner-decision-corpse-loot-take-detail-2026-10-06.md)).
- C1 room output stays focused; NPCs open full details, section detail returns say Back to World, and position changes open only from the room status label ([record](../decisions/owner-decision-c1-playtest-polish-2026-10-03.md)).

- The sampler reuses existing UI labels and default band settings for its approved content-owned phrase/tone acceptance ([PM repair](../decisions/pm-decision-sampler-bands-2026-10-03.md)); descriptions, action text and other in-game copy are now PM-delegated without per-batch owner approval ([superseding decision](../decisions/owner-decision-copy-delegation-2026-10-04.md)).
- Sampler identity and complete prose follow the [owner delegation and PM selections](../decisions/owner-decision-sampler-batch-2026-10-03.md).

- World time continues during dialogue, menus and cutscenes; reading-speed fairness needs intentional timed choices and protection or an escape option while controls are restricted ([record](../decisions/owner-decision-reading-time-2026-10-03.md)).
- The first release bundles its chapter; downloadable story content waits for the pre-launch
  store-policy review ([PREP-03](../archive/decisions/owner-decision-prep-03-2026-09-24.md)).
- One save per story, no manual bookmarks; a new game replaces the save after the player confirms
  ([record](../archive/decisions/owner-decision-one-save-2026-09-30.md)).
- One phone, the owner's iPhone 11, until the first free product gate; Android evidence is deferred
  to that gate, not dropped ([record](../archive/decisions/owner-decision-android-descope-2026-09-30.md)).
- A playtest-and-tune stage after R6P, ended by the owner: number and UI PRs get a short review;
  changed or new mechanics are normal slices; until the first release to real players, formats and
  development cartridges may change and re-derived known answers are listed in the PR
  ([record](../archive/decisions/owner-decision-playtest-2026-09-25.md)).
- The Lantern proof has no wait and no schedule; the game clock stays and the status line shows the
  double hour's earthly branch; its stats start at hp 10, ma 100, mv 100 (in its `resources.json`
  only); the later time model targets about 72 real seconds per game hour
  ([record](../decisions/owner-decision-untimed-lantern-2026-10-02.md)). Lantern content rulings:
  a locked west gate keyed by the lantern; Bram's talk policy is quest active
  ([PM record](../archive/decisions/pm-decision-lantern-proof-content-2026-10-01.md)).
- The story-progress concept is a "story point" (event `story_point_reached`); project
  milestones keep their name ([record](../archive/decisions/owner-decision-story-point-2026-10-01.md)).
- `knock`, map discovery and `where` are chapter-one work, not R5
  ([record](../archive/decisions/owner-decision-r5-deferred-mechanics-2026-09-28.md)); the R5 deferrals
  land in R7/R8 for chapter one, after R6P and before R10
  ([record](../archive/decisions/owner-decision-early-r7r8-plan-2026-10-01.md)).
- `scene@1`'s modal text subset is now needed by the approved chapter-one
  [plan](../decisions/owner-decision-chapter-one-plan-2026-10-02.md), implemented as
  [scene facts](mechanics.md#scene1-mechanicsscenerulets); the durable choice remains dialogue's
  continuation row ([earlier record](../archive/decisions/owner-decision-split-d-2026-10-01.md)).
- Puppeting comes later; rules read the actor from the command, never the player
  ([record](../archive/decisions/owner-decision-puppeting-2026-09-25.md)). Player-written descriptions
  come with the online work ([record](../archive/decisions/owner-decisions-r5-s4-2026-09-25.md)).
- Bram's quest starts from a dialogue choice, not a place action (the Lantern's `bram_offer`
  dialogue); one-off quest triggers may come later ([record](../decisions/owner-decision-quest-from-dialogue-2026-10-02.md)).
- The owner is the human-proof tester for now ([record](../archive/decisions/owner-decision-r6p-plan-2026-10-01.md)).

## Architecture and engine

- LegendMUD is the mechanical planning baseline; reconcile existing plans and verify the applicable
  rule before each concrete consumer; adopted adaptations and historical proposals follow the
  [current PM reconciliation](../decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md)
  ([original direction](../decisions/owner-decision-legendmud-baseline-2026-10-03.md)).
- The TypeScript kernel uses the responsibility folders and colocated rule helpers in [architecture.md](architecture.md#typescript-kernel), preserving semantics and deterministic ownership/purity guards ([record](../decisions/owner-decision-kernel-layout-2026-10-03.md)).

- The engine owns mechanics; cartridges own numbers and world settings; no game-world value is a
  literal in the engine or a presenter. The inventory of values still to move:
  [world-parameters.md](../world-parameters.md)
  ([record](../decisions/owner-decision-world-parameters-2026-10-02.md)).
- Engine output is structured; each presenter owns its layout and wording; one `GameSession`
  boundary serves the TypeScript authority now and the Elixir Realm later; refusal words key on
  registered error codes ([record](../decisions/owner-decision-presenter-split-2026-10-02.md)).
- Installed default pools hp, ma, mv (historical DikuMUD-derived starts and gains; future
  derivation follows the LegendMUD reconciliation above), 1 mv per room by default (a
  cartridge's `world.movement.cost` overrides it; terrain costs later), regeneration per game
  hour derived from the clock; every v2 cartridge gets the pools
  ([record](../archive/decisions/owner-decision-hp-ma-mv-2026-09-25.md)).
- Condition bands: computed by the kernel from 04 §15's table, the engine default, which a
  cartridge may replace per pool or for all pools (bands with a tone; superseded "never a
  cartridge threshold" by the [chapter-one plan](../decisions/owner-decision-chapter-one-plan-2026-10-02.md),
  triage 21); the UI shows the phrase on hp and colours every resource; LegendMUD credited,
  never named in the UI ([record](../archive/decisions/owner-decision-condition-bands-2026-10-01.md)).
- Composability and emergence principles: briefs/reviews use [Building mechanics by composition](architecture.md#building-mechanics-by-composition), including missing primitives at real consumers ([owner clarification](../decisions/owner-decision-consumer-primitives-2026-10-04.md)); retain the [emergence record](../archive/decisions/owner-decision-emergence-2026-09-25.md).
- Ids: IdSource UUIDv8 and the frozen numeric profile v1; CommandId reuses the recipe and
  authority placement never enters it; lowercase UUID ids, snake_case segments, `ErrorCode` enum
  plus registry ([record](../archive/decisions/owner-decisions-r3-2026-09-24.md),
  [lanes](../archive/decisions/owner-decisions-r3-lanes-2026-09-24.md)).
- Ambiguous targets list by id; dotted fact names map to underscores with a collision check
  ([record](../archive/decisions/owner-decisions-r3-open-questions-2026-09-24.md)). Kernel API range as
  `{at_least, below}`; no count limits, a byte cap at the download boundary
  ([record](../archive/decisions/owner-decisions-r3-pr4a-2026-09-24.md)). `policy@1`,
  `target_resolution@1` and `fact@1` are `portable_capability`; Elixir domain types arrive with
  their first consumer ([record](../archive/decisions/owner-decisions-r3-gate-2026-09-24.md)).
- Cartridge source is JSON (YAML later); artifacts are capped at 4 MiB
  ([record](../archive/decisions/owner-decisions-r4-2026-09-25.md)); short references in source
  ([record](../archive/decisions/owner-decision-short-refs-2026-09-25.md)).
- Entity text has four tiers (keywords, short, room line, examine); the host synthesizes
  `fact_changed` at each assign's causal position; touch links are inline markup in catalog
  strings ([record](../archive/decisions/owner-decisions-r5-s4-2026-09-25.md)).
- Rule modules are locked down by lint; `loka play` is the agent-drivable terminal; the feature
  map is generated and drift-checked ([record](../archive/decisions/owner-decision-r5-setup-2026-09-25.md));
  failed lookups are observed as `target.unresolved` for the Lab
  ([record](../archive/decisions/owner-decision-lab-failed-lookups-2026-09-25.md)).
- Observability: one record format, stores joined by ids, a registered event-name list (ADR-075);
  `kernel_version` is `<KERNEL_ID>@<commit>`, a dirty build marked and never a repro key; the PM
  keeps `docs/dev-evidence.jsonl` ([record](../archive/decisions/owner-decisions-adr-075-2026-09-25.md)).
- Verification harness: invariants as registered data, deterministic simulation every CI run,
  fault simulation on real SQLite; owner attention goes to invariant lists and harness changes
  ([record](../archive/decisions/owner-decision-roadmap-2026-09-24.md), [ROADMAP](../archive/ROADMAP.md#verification-harness-adopted-2026-09-24)).
- The due-job drain landed with the first real job; `real_elapsed` time is carried until a
  cartridge declares it ([record](../archive/decisions/owner-decision-s4-scope-2026-09-30.md)).
- Pre-production: work forward from the current contract without older API/release/save
  compatibility, adapters or migrations. Update or remove obsolete fixtures and documentation
  when the contract changes, while retaining current-behavior guards, current-build save integrity,
  explicit pin refusal and no silent save deletion
  ([superseding decision](../decisions/owner-decision-forward-development-2026-10-05.md)).
- Preproduction previews may start fresh across builds; current-build save/retry/reopen and
  explicit Start over remain required ([clarification](../decisions/owner-decision-preproduction-preview-saves-2026-10-04.md)).
- Saves reopen on an available exact pin; missing pins and unsupported formats are typed refusals
  ([save contract](save.md#opening-a-story); [original scope](../archive/decisions/owner-decision-s3b-scope-2026-09-30.md)).
- The book UI's departures from 00 §4.10 (map joystick, full pages, status line) are documented
  departures, no spec amendment ([record](../archive/decisions/owner-decision-sm2-scope-2026-10-01.md)).
- Narration binds its participants at commit; no `narration.emit`, no acknowledgement
  ([record](../archive/decisions/owner-decision-narrow-n-2026-10-01.md)).
- Story-to-Realm learning, shared mechanics/interaction and replaceable story content follow the
  [owner direction](../decisions/owner-decision-story-realm-shared-mechanics-2026-10-04.md); the first Realm activity, unchanged-cartridge hosting and formal ADR-074 route remain open.

## Process

- During pre-production, metadata-only changes skip engine and browser jobs and Book-only changes skip engine jobs only after relevant green ancestors; unknown or source changes run broad checks ([owner decision](../decisions/owner-decision-preproduction-ci-scope-2026-10-06.md)).
- During pre-production, draft PRs run no hosted CI until marked ready for review ([owner decision](../decisions/owner-decision-skip-ci-on-drafts-2026-10-07.md)).
- Move forward: fold recurring failure classes into lessons first, then delete records of closed or superseded work; links become pinned permalinks. Protocol fixtures, in-force decisions and open work stay ([owner decision](../decisions/owner-decision-move-forward-2026-10-07.md)).
- After Chapter 1 E3, adopt fast iteration, full PR and milestone check lanes through a separate reviewed change; current gates and save safety remain in force until then ([owner decision](../decisions/owner-decision-tiered-ci-after-chapter-one-2026-10-06.md)).

- Keep review findings and dispositions as cross-referenceable history while their work is open ([closed work](../decisions/owner-decision-move-forward-2026-10-07.md)); promote lasting behavior to its active spec, recurring hazards to area lessons, enforceable invariants to checks and unfinished work to linked tasks ([record](../decisions/owner-decision-review-knowledge-trail-2026-10-05.md)).

- E1 credits an `any` child only when it evaluates true at the accepted action and never credits a negated guard for staying false; an unfireable guard closes only by a reviewed disposition reported apart from witnessed paths ([owner decision](../decisions/owner-decision-e1-branch-evidence-2026-10-07.md)).

- Web stays active through game completion: C2 has focused fresh Book proof, browser fatal/Restart remains due by the E3 browser walk, and the preserved terminal save has twice-reopened evidence after the separate Web fix; native verification follows the existing pause ([record](../decisions/owner-decision-c2-staged-browser-proof-2026-10-05.md)).

- Update canonical Book interaction rules in the same mechanic slice that changes them, reuse the component language, and fix obvious navigation/UI correctness defects before that slice completes; use E3 for the larger visual consistency pass ([owner decision](../decisions/owner-decision-book-ui-as-you-build-2026-10-05.md)).

- The one-time Chapter 1 [docs audit](../evidence/2026-10-06-chapter-one-docs-audit.md) and [architecture audit](../evidence/2026-10-06-post-d10-architecture-audit.md) are done and their repairs closed ([docs record](../decisions/owner-decision-chapter-one-docs-audit-2026-10-05.md), [architecture record](../decisions/owner-decision-chapter-one-architecture-audit-2026-10-05.md)); the architecture follow-ups stay Beads issues.

- After PRs #200–#204, use local branches as draft PRs. Complete units may merge provisionally into local `main` after focused checks and self-review while independent review runs in parallel; only reviewed units count as complete. Publish accumulated local history periodically after full checks and closed reviews; exact-head hosted CI gates later remote merges ([fast lane](../decisions/owner-decision-local-provisional-integration-2026-10-05.md), [original local cadence](../decisions/owner-decision-local-draft-pr-cadence-2026-10-05.md)). The owner authorized a one-time hosted-CI exception only for PRs #200–#204 during GitHub's runner incident.

- Reuse documents already loaded in each agent's context when following repeated links; reopen only when changed, truncated or missing a needed detail ([record](../decisions/owner-decision-read-once-docs-2026-10-05.md)).

- The PM may decide mechanics design/policy, adopt and extend slices beyond the M list, use Fable for gate-level audits and assign useful parallel work without waiting for owner input; normal review, checks, merge, privacy and no-paid-service requirements remain ([delegation](../decisions/owner-decision-autonomous-mechanics-2026-10-03.md)).

The workflow itself is [WORKFLOW.md](../WORKFLOW.md); these records are its sources.

- Presenter boundary: engine output is structured and presenters own the words; the renderer reaches the game only through `GameSession`/`Game` (the player's play session and the story being played) and uses only React Native building blocks ([record](../decisions/owner-decision-presenter-split-2026-10-02.md)).
- A fresh agent of any vendor that authored none of the work is an independent reviewer
  ([record](../archive/decisions/owner-decision-reviewers-2026-09-24.md)).
- Mechanics PRs use one fresh independent reviewer by default; a second opinion
  is reserved for save/reconciliation, protocol/foundation, proposal and milestone-gate risks
  ([record](../decisions/owner-decision-one-reviewer-default-2026-10-04.md)).
- Auto-merge: APPROVE or APPROVE WITH NOTES with nothing open and every CI job green
  ([record](../archive/decisions/owner-decisions-r3-lanes-2026-09-24.md)); the PM may merge PRs
  ([record](../decisions/owner-decision-claude-only-auto-merge-2026-10-07.md)) with GitHub auto-merge on
  the required `ci-green` and `book-e2e-green` checks; admins (the owner, or the PM when asked or
  for status-only commits) may push to `main` or merge directly, never for unreviewed code or past
  a red check ([record](../decisions/owner-decision-required-checks-merge-2026-10-08.md)); the PM runs a slice to its
  merge and escalates hard calls up a ladder before the owner
  ([record](../archive/decisions/owner-decision-autonomy-2026-09-30.md)).
- Gates are slim: the owner's play when there is something touchable, one fresh Opus audit (Fable for E2–E3) of the
  riskiest code, and a short checklist with one reviewer; no second review of a
  docs-only gate PR ([record](../decisions/owner-decision-slim-gates-2026-10-02.md)).
- Claude Code runs every role: a fresh Opus reviewer and fix re-check; Fable only for the E1 closure second opinion
  ([record](../decisions/owner-decision-e1-closure-reviewers-2026-10-07.md)), the E2 and E3 gate closures and audits, and the release-candidate certification audit; Codex and cross-vendor review are retired; Beads Rust is the
  permanent PM tracker; a second opinion never replaces the independent reviewer ([record](../decisions/owner-decision-claude-only-auto-merge-2026-10-07.md)).
- An Opus `designer` is the single writer of the Book UI design system and its spec text, consulted by every UI-changing slice; its design review plus a quick correctness pass is the independent review only for a pure UI polish batch ([record](../decisions/owner-decision-designer-role-2026-10-07.md)).
- Opus drafts briefs; the PM keeps one persistent worktree, the integration checkout
  ([record](../archive/decisions/owner-decision-review-rules-2026-10-01.md)).
- Developers default to Sonnet; Opus where the [routing table](../WORKFLOW.md#work-routing) says
  ([record](../archive/decisions/owner-decision-sonnet-developers-2026-09-30.md)).
- The TypeScript tests are type-checked (`kernel/ts` `npm run typecheck`, [CHECKS](../CHECKS.md))
  ([record](../archive/decisions/owner-decision-ts-test-types-2026-09-25.md)).
- Native mobile builds run only when native inputs change; the merge rule is every CI job that ran
  is green ([record](../archive/decisions/owner-decision-ci-mobile-builds-2026-09-25.md)).
- Source of truth: `docs/system/` plus `protocol/` and the conformance fixtures; a change amends
  `docs/system` first, then the code. `docs/archive/` holds only cited older records; new
  decision records go in `docs/decisions/` and add a line here
  ([record](../decisions/owner-decision-docs-compaction-2026-10-02.md#decisions-for-the-move-2026-10-02)).
- C5 PR #255 alone has one owner-approved third fix round for SO7/SO8, with scoped independent
  re-reviews and exact-head CI before merge ([record](../decisions/owner-decision-c5-third-fix-round-2026-10-06.md)); the general workflow cap remains.

- Latest Book UI polish supersedes the earlier fixed viewport-bottom NPC dock, pending-choice-preserving Leave and position detail page; follow [Book UI](book-ui.md) and the [new record](../decisions/owner-decision-c1-journal-position-polish-2026-10-03.md). Description projection is coordinated separately; no invented player presence or description keys.

- PM decision under mechanics delegation: [first cellar encounter](../decisions/pm-decision-first-encounter-2026-10-03.md), installed through M5/M6; new combat equations are not silently inherited from draft PR #136.

- PM reconciliation under mechanics delegation: [current Legend/M mechanics and chapter selections](../decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md); original owner records and provisional alternatives remain dated history.

- The pre-production mobile app CI exception excludes `mobile/authority/local-story/`: authority/save changes run the broad code lane and browser checks; native checks remain paused ([scope clarification](../decisions/owner-decision-preproduction-ci-scope-2026-10-06.md)).

- Current [mobile pause](../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md): no Android/iOS development, builds or verification until the owner resumes it; retain the Node TypeScript game simulator as an engine correctness check. These resume with native work: [agent-device UI walks](../archive/decisions/owner-decision-agent-device-2026-10-01.md), [iPhone 11 at gates](../decisions/owner-decision-simulator-device-rows-2026-10-02.md), [simulator-first validation](../decisions/owner-decision-simulator-first-validation-2026-10-04.md).

- Carrying admission follows the [M3-A PM selection](../decisions/pm-decision-m3-a-carrying-ceiling-2026-10-04.md) under mechanics delegation.
- First live fight narration and the corrected brass-key room line use the [owner-approved seven-line copy batch](../decisions/owner-decision-m6-a-combat-copy-2026-10-04.md).
- Combat uses its own Book page like dialogue, following the [owner combat-page decision](../decisions/owner-decision-m6-a-combat-pane-2026-10-04.md) and [active Book interaction contract](book-ui.md#live-combat-response-m6-a).
- Flee takes no player direction and chooses a legal exit through the [owner-approved random-Flee rule](../decisions/owner-decision-m6-a-random-flee-2026-10-04.md).

- Open encounters apply the [owner-approved focused combat ActionSet](../decisions/owner-decision-m6-a-combat-actions-2026-10-04.md) after ordinary contributions, with shared admission/projection and normal restoration on close.

- Nested chapter notice board: [M12-B owner direction](../decisions/owner-decision-m12-b-notice-board-2026-10-05.md).

- Opening room NPC for conversation and directions: [owner direction and PM selection of Elspeth](../decisions/owner-decision-opening-elspeth-2026-10-05.md).

