# Owner decision: chapter-one stage plan (Gate C1) — 2026-10-02

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

The PM proposed the plan (an Opus draft at `f8564cb`, reviewed by codex Astra, which asked for
changes, folded and re-checked twice by codex Sol) and four questions. The owner's answers, a
later descope and two later additions are in [Owner decisions](#owner-decisions); the plan below already applies them.

## Owner decisions

- **Q1, stage scope: approved.** This stage is the ROADMAP row "R7/R8 for chapter one", plus
  the two additions below. The rest of scene@1, `narration.emit`, combat, death, skills, status, population (with `EntityOrigin`),
  commerce, service, topics, relationship, faction, readable, light, liquid, tide and sense_cue
  are later stages after Gate C1.
- **Q2, the gate story: yes.** A new development story of about six Ashmere rooms, its keys and
  wearables found in rooms or given by a dialogue choice (no combat, commerce or trust), prose from
  the owner's UI prototype. **No story picker:** for the gate the sampler replaces the Lantern on
  the phone. The app opens the sampler in its own save file; the Lantern's save file stays on the
  phone untouched (not deleted); the Lantern stays reachable for tests through Node (`loka play`,
  its compiled fixture and frozen traces).
- **Q3, sight lines: in this stage, not later.** Look shows what is visible in the adjacent rooms
  (the c1-doors slice, below).
- **Q4, review exceptions: yes to both,** with audited SHAs recorded and later diffs re-checked:
  (a) a Fable subagent does the gate's riskiest-code audit if codex has ended; (b) Astra reviews a
  slice only if a new delta op comes back.
- **Descope (later the same day): keys that break on a failed force, not now.** c1-locks keeps
  locked containers only; force, the snapped-key sink and its device and touch rows leave the
  stage. The carry stays in the ROADMAP row with its trigger.
- **Additions (later the same day): chapter markers and modal cutscenes, both small,** after
  c1-journal and before c1-sampler. Chapter markers: the cartridge declares chapter titles tied to
  story points; the phone shows a title page at the start and when one is reached. Cutscenes:
  modal text scenes only (narrate lines, tap to continue), the 00a §9 `bell_rung` kind. Restricted
  control, scoped overlays and dreams, dialogue and choices inside scenes, and consequence beats
  with checkpoints stay in the next stage. The sampler holds one of each; c1-touch draws both.

## 1. Goal

The owner plays, by touch on the iPhone 11, a small Ashmere piece from 00a: doors per exit and
what is seen through them, a locked container, wearing, sitting and resting, each quest's journal
text, a chapter title page and a modal cutscene. W1, W2, W13 are content; every phone save has its own seed and a clean kernel version.

## 2. Triage of the row (31 of 31)

IN = slice below; LATER = not this stage, reason given (each stays in the ROADMAP row).

| # | Row item (row's words, short) | Call |
|---|---|---|
| 1 | "keys that break on a failed force" (00 §4.1, §4.4) | LATER: owner descoped; trigger: content that needs a breakable key |
| 2 | "locked containers ... the door commands gain an optional target" (00 §4.4) | IN c1-locks |
| 3 | "a policy leaf reading resources" (06 §21) | IN c1-attributes |
| 4 | "positions" (`position@1`; 00 §4.3) | IN c1-position |
| 5 | "their regeneration bonuses" (00 §4.2) | LATER: rides with the time model (W12 is a time-model row) |
| 6 | "one-way and bent door passages" (21 §5) | LATER: no chapter-one content needs it; 00a §2 "every listed exit has its reciprocal" |
| 7 | "loosening the loader's rejection of a keyless locked door" | LATER: every 00a locked door has a key (§2 watch_cell, §5 keys) |
| 8 | "`equipment@1`" (21 §8; 00 §4.4) | IN c1-equipment |
| 9 | "`attributes@1`" (00 §4.3 six stats) | IN c1-attributes |
| 10 | "spawned-entity provenance (`EntityOrigin`, with the first spawner)" | LATER: rides with population@1 (Q1) |
| 11 | "the 04 §5.4 generation re-read ... first slice that adds an operation cancelling, rescheduling or completing a job" | LATER: no slice here adds one; trigger unchanged |
| 12 | "scene@1 ... until chapter-one content needs scenes" | partly IN c1-scenes-modal (modal text scenes); LATER (Q1, next stage): restricted control, scoped_overlay and dreams, dialogue and choices in scenes, consequence beats with checkpoints |
| 13 | "narration@1 beyond pinned participants: `narration.emit`, observers, rendering names" | LATER (Q1): with scene@1 |
| 14 | G1 "a root that activates a strict quest and then emits its matching acquisition faults `conflicting_write`" | LATER, trigger kept: the sampler must not compose it (c1-sampler acceptance) |
| 15 | G2 "the `before = now(p)` branch of `join` ... first slice letting a job emit an acquisition" | LATER, trigger kept: no slice here lets a job emit `item_acquired` |
| 16 | "graceful handling of a lookup over `selector_cardinality`" | LATER: 57 rooms and about 60 definitions, cap 1024 |
| 17 | Q-3 "GameView lists `unlock` available without the key ... per-exit actions, need #12" | IN c1-doors (kernel), c1-touch (UI) |
| 18 | "the journal's quest objective (O-11, need #7)" | IN c1-journal (kernel), c1-touch (UI) |
| 19 | "scan content (O-scan: scan returns nothing, `movement.ts:30`)" | IN c1-doors (Q3: sight in Look), c1-touch |
| 20 | "LATER: the time model" | LATER: [untimed Lantern](owner-decision-untimed-lantern-2026-10-02.md) |
| 21 | "move world parameters W1, W2 and W13 to content" | IN c1-numbers |
| 22 | "the time-model rows (W3-W6, W8, W12, W16, W19, W20)" | LATER: with the time model |
| 23 | nit: "the `Checks` type restated in `cartridge_quests.ts`, ..." | IN c1-journal (first slice touching `cartridge_quests.ts`) |
| 24 | nit: "`continuationId` in `dialogue.ts` is a one-caller wrapper" | IN c1-journal |
| 25 | nit: "the stale 'R6P row' pointer in `kernel/ts/src/target.ts:34`" | IN c1-locks (the optional target touches target resolution) |
| 26 | "every new game uses one fixed seed and world context" | IN c1-host (`mobile/authority/local-story/session.ts:24`) |
| 27 | "a measured touch-to-visible-feedback (touch-to-photon) on the iPhone 11" | IN Gate C1 (owner's human part) |
| 28 | "a host trace stores the Command, not the invoked key ... before the first cartridge with an alias" | LATER, trigger kept: the sampler declares no alias (c1-sampler acceptance) |
| 29 | "the phone reports `kernel_version` `loka-kernel@000…0-dirty`" | IN c1-host (`session.ts:27`) |
| 30 | M1 ruling a "two dialogues of one speaker whose policies both hold" | LATER: 00a §8 "Each named NPC has one dialogue graph" |
| 31 | "the NPC menu (`Menu.tsx`) does not scroll ..." | LATER, trigger kept: every sampler choice fits the menu (c1-sampler acceptance) |

Files at their cap (CHECKS: split, never raise): `mobile/authority/local-story/authority.ts`
300/300, `kernel/ts/src/cartridge_refs.ts` 314 and `checks.ex` 315 (both allow 315; new loader
checks land there), `compose.ts` 300/300, `compose.ex` 313 (allow 315), `decision.ts` 299,
`actions.ts` 297, `proposal.ts` 295. A file that must grow splits first in its own commit,
behaviour unchanged. No slice plans to touch `proposal.ts` or `compose.*`.

### Delta ops: reuse, no new op

FactValue is a Key, integer or boolean, never an EntityId.

| State | Existing op | Why no new op |
|---|---|---|
| Worn slot (c1-equipment) | `entity.transfer` into a slot holder entity inside the body (capacity 1), made by `fresh.ts` per declared slot | conservation, one container (03 §23), capacity and `has_item` "directly or nested" already hold; `fact.assign` cannot hold an item id |
| Position (c1-position) | `fact.assign` on an engine fact the compiler adds when `position@1` is locked (as `resources.ex` adds hp/ma/mv), scope player, Key value | `expected` = current position is the transition check; the loader refuses content that writes it |
| Locked container (c1-locks) | `barrier.transition` on a barrier attached to the item | the target is already the barrier, not the exit |
| Chapter reached (c1-chapters) | none: derived in the view from quest state | a story point outcome fires on a dialogue choice that resolves a quest (cartridge.md, story points), so "reached" is that quest resolved with that outcome, already persisted |
| Scene in progress (c1-scenes-modal) | `fact.assign` on an engine fact per declared scene (beat number, 0 = not running), compiler-added as for position | the beat is an integer; the fact persists, so a scene in progress survives reopen |

`compose.*` stays untouched. If a slice's spec commit shows a reuse fails, that slice adds the op in
both kernels with new conformance cases, splits `compose.*` first, and gets Astra (Q4 b). Slot
holders are allocated after every existing kind, in slot-key order, under an additive amendment of
the numeric profile's "Initial world ids", so a cartridge without `equipment@1` keeps every id;
independent known answers pin the new ids. Equipment, locks, position and scenes change the fresh
world or the command protocol: contract-freeze depth (full review, broad re-review after a core fix).

## 3. Slices (in order, one at a time)

Common to all: brief per WORKFLOW step 2; AGENTS.md Simplicity and Writing tests passed in;
`bin/check_all.sh` green; `/ponytail-review` in the PR. **Spec first:** a slice that changes
`protocol/` or a schema makes the `docs/system` amendment (and the archived spec or conformance
text that pins it) its first commit, naming the clause; the reviewer reviews it before the code.
The brief lists every protocol file the slice may change. **Scope trigger:** a change to an
existing frozen case or to a protocol file the brief does not list: stop and ask; new named cases
are in scope. **Hashes:** gameplay outcomes and state hashes of existing traces must not change; a
cartridge `content_hash` may change when its content moves into the artifact; the PR lists each
re-derived hash with its fixture and bundled release, and keeps old pinned releases loadable where
the save acceptance needs them. **New commands** take the whole invocation path: command ownership
in `capability_registry.json`, action registration, the `invocation.ts` `TARGETS` map, offered
actions in GameView, and a touch row in c1-touch.

### 1. c1-host: a seed and a clean kernel version per lineage
- First: the row's trigger is "before the first cartridge whose play draws the RNG", and
  DIFFERENCES 6 and 7 are bugs on their own.
- Commit 1: split `authority.ts` (300/300), behaviour unchanged.
- Docs: save.md (new game, the pin); DIFFERENCES rows 6, 7; ADR-075. No protocol change.
- Files: `session.ts` (:24 SEED, :27 KERNEL_VERSION), the split `authority.ts`, the build step
  that stamps the kernel commit. Random source `expo-crypto` (installed), no native code.
- Opus. Device: P6 rows on a Release Simulator build (load, kill, luck replay, damaged save).
- Acceptance: two new games store different seeds and contexts in their pins; reopen replays a
  luck draw identically; a release build reports `loka-kernel@<40-hex>` without `-dirty`; an older
  `loka-save-v1` opens unchanged; DIFFERENCES 6, 7 deleted; P6 DONE; the comment fixed; a constant
  seed fails a test.

### 2. c1-numbers: W1, W2, W13 to content (with the loader split)
- Commit 1: split `cartridge_refs.ts` and `checks.ex`, behaviour unchanged.
- Commit 2, spec: mechanics.md movement@1, resource@1; protocol.md GameView bands; cartridge.md
  `resources.json`; amends 00 §4 amendment 2026-09-25 ("1 MV per move"), the resource.schema
  ResourceSpec description, 04 §15 bands amendment 2026-10-01 (bands and their tone are content).
- Protocol files: `cartridge.schema.json`, `resource.schema.json`, `gameview.schema.json`
  (ResourceView.band: the closed eleven-key enum becomes a content Key; a tone field).
- Code: `rules/movement.ts` (:71, :93), `view.ts` (:80-104), `resources.ex`. Opus. Device: none.
- Acceptance: `world.movement.cost {resource, amount}`, default `mv`/1 (per-exit and terrain
  LATER, 00 §11 chapter three); cost 2 charges 2 and refuses at 1 `insufficient_resource`;
  `<pool>.bands [{at_percent, key, tone}]` with a cartridge default; a custom band ("winded")
  validates and shows its text and tone; values on each threshold boundary land in the right band;
  malformed tables (unsorted, gap, duplicate, missing text key, cost on a missing pool) are
  diagnostics in both kernels; Lantern outcomes and state hashes unchanged, its content hash
  re-derived and listed; W1, W2, W13 DONE.

### 3. c1-attributes: `attributes@1` and the resources policy leaf
- Spec: new mechanics.md section; amends 06 §21 (policy leaves: one reading a resource, one an
  attribute); 00 §4.3 six stats; release-scope.json (chapter_one, R5).
- Protocol files: `policy.schema.json`, `cartridge.schema.json` (or an attributes file schema),
  `capability_registry.json`.
- Code: `policy.ts`, loader in both kernels, `fresh.ts`, features.json. Opus. Device: none.
- Acceptance: starting values are content; each leaf true and false on literal tables; a leaf
  used without the lock fails `UNDECLARED_CAPABILITY`; the feature map row filled.

### 4. c1-doors: per-exit door actions and sight lines (need #12, Q-3, Q3)
- Commit 1: split `actions.ts`, behaviour unchanged.
- Spec: protocol.md ActionSet and GameView ExitView; mechanics.md movement@1 (the GameView, not
  only the host, carries `sight`); amends 04 §15 (an exit's door and state when passable, and what
  is seen through it) and room-view need #12 (marked done).
- Protocol files: `gameview.schema.json` ExitView.
- Code: `actions.ts`, `view.ts`, `rules/barrier.ts`; `rules/movement.ts` `sight` (:82) reused, not
  rewritten. TypeScript only: Elixir has no GameView. Opus. Device: none.
- Sight rule (00 §4.1 "`scan` adjacent rooms", chapter one; far scan from `view` rooms is chapter
  two, 00 §11): per exit, what `sight` returns today: the destination room and the NPCs and items
  directly in it, or nothing beyond a barrier that bars the way. `sight` follows `passage`, not
  `fare`, so the field sits on both ExitView branches.
- Acceptance: each barrier exit shows its door and state even when passable, with only its legal
  verbs; `unlock` toward `old_gate` absent without the lantern, present with it; an open exit shows
  its room and the entities in it, also at 0 MV (unavailable, `insufficient_resource`); a closed or
  locked door shows nothing beyond; schema mutant sweep; re-derived Lantern trace rows listed
  (outcomes unchanged).

### 5. c1-equipment: `equipment@1` (contract-freeze depth)
- Spec: new mechanics.md section; amends 21 §8 Equipment (slot holders inside the body), 00 §4.4
  (14 slots; chapter one fills nine, 00a §5), numeric-profile "Initial world ids" (slot holders).
- Protocol files: `entity.schema.json` (item slot), `command.schema.json` (wear, remove),
  `gameview.schema.json` (worn slots, offered actions), `capability_registry.json`.
- Code: new `rules/equipment.ts`, `fresh.ts`, `world.ts`, `invocation.ts` TARGETS, loader in both
  kernels; `decision.ts` split first if it must grow. Opus. Device: none.
- Acceptance: wear and remove by invocation (not only `step`) with refusals (not held, slot taken,
  no slot); one item per slot; `one_container_per_item` holds; slot holder ids match independent
  known answers and an unequipped cartridge's ids are unchanged; dual wield, affects, curses LATER.

### 6. c1-locks: locked containers (contract-freeze depth)
- Spec: mechanics.md barrier@1, containment@1; amends 00 §4.4 ("Containers with locks"),
  cartridge.md loader reachability.
- Protocol files: `command.schema.json` (optional target on open, close, lock, unlock),
  `entity.schema.json` (a barrier on an item), `capability_registry.json`, `gameview.schema.json`.
- Code: `rules/barrier.ts`, `rules/containment.ts` (:43 take), `cartridge_barriers.ts` (:48) and
  its Elixir twin, `invocation.ts`, `target.ts` (nit #25). Opus. Device: none.
- Custody contract: `take` reaches an item in a container only when the container is in the room
  or held, every ancestor up to it is open, and no NPC holds it.
- Acceptance: lock, unlock, open, close and take by invocation with a container target; runtime
  refusals: `take` behind a closed ancestor and of an NPC's possessions; the loader in both kernels
  (`BARRIER_UNREACHABLE_KEY`) rejects only keys that can never be reached: inside their own locked
  chest, circular key dependencies; a key in a closed, unlocked chest loads (valid content).

### 7. c1-position: `position@1` (contract-freeze depth)
- Spec: new mechanics.md section; amends the 21 §28 `position@1` row, 00 §4.3 Positions (the
  engine fact); room-view need #2.
- Protocol files: `command.schema.json` (stand, sit, rest, sleep), `gameview.schema.json`
  (position, offered actions), `capability_registry.json`.
- Code: new `rules/position.ts`, `rules/movement.ts`, `invocation.ts`, the compiler-added fact in
  both kernels. Opus. Device: none.
- Acceptance: legal transitions only, by invocation; `move` when not standing refused with a typed
  reason; survives save and reopen; content cannot write the fact (diagnostic); no regen bonus.

### 8. c1-journal: the quest's journal text (need #7, O-11) and the nits
- Today `QuestDefinition` is key, title, offer, one objective (`quest.schema.json`,
  `additionalProperties: false`): there is no stage text to project.
- Spec: protocol.md GameView QuestView; mechanics.md quest@1; amends 06 §2 (journal) and 04 §15.
- Protocol files: `quest.schema.json` (optional `journal {active, objectives_met, resolved,
  failed, abandoned, outcomes?: {<outcome>: TextKey}}`), `gameview.schema.json` QuestView.
- Selection, computed in the view, never persisted: an active quest shows `objectives_met` when its
  objective holds now (`quest.ts` `holdsNow`; for `current_state` objectives `objectives_complete`
  is written only at resolution), else `active`; a persisted `objectives_complete` (a
  `post_activation_event` quest, earned by acquisition) also shows `objectives_met` and keeps it
  after drop and reopen; a terminal quest shows `outcomes[outcome]`, else its state's key (failed
  with no outcome, abandoned); no `journal` shows the title only.
- Code: `view.ts`, `cartridge_quests.ts` (and the Elixir loader), `cartridge_reactions.ts`,
  `cartridge_dialogues.ts` (nit #23), `dialogue.ts` (nit #24). Opus. Device: none.
- Acceptance: literal checks for active, take the lantern (met), drop it (active again), reopen
  (same), an event-earned `objectives_complete` kept after drop and reopen, resolved per outcome,
  failed with and without outcome, abandoned; no new persisted field, frozen state hashes
  unchanged; a missing text reference is `UNRESOLVED_REFERENCE` in both kernels; the Lantern gains
  its journal keys ("find the lantern", "bring it to Bram"; the owner may reword); nits fixed.

### 9. c1-chapters: chapter markers (not yet specced)
- Spec first: a new mechanics.md section (or story points in cartridge.md) and protocol.md
  GameView; the first commit, before any code.
- Protocol files: `cartridge.schema.json` (chapters: an ordered list of `{title: TextKey,
  story_point?, outcome?}`, the first with no story point), `gameview.schema.json` (the current
  chapter's key).
- Code: `view.ts`, the loaders in both kernels (each reference resolves; only the first chapter
  has no story point). Rule: the current chapter is the last declared one whose story point
  outcome is reached (its quest resolved with that outcome), else the first. No new persisted
  field, no new op. Opus. Device: none.
- Acceptance: literal checks: a new game shows the first chapter; the outcome's choice moves it to
  its chapter, the other outcome does not; it survives reopen; frozen state hashes unchanged;
  unresolved title or story point is a diagnostic in both kernels.

### 10. c1-scenes-modal: modal text cutscenes (contract-freeze depth)
- Spec first: mechanics.md scene@1 (the modal subset of 06 §33-§37: steps `narrate`,
  `await_ack`, `end`; control `modal`; not skippable, no replay); amends the 21 §28 scene row and
  release-scope.json to say which part of scene@1 is installed.
- Protocol files: a scene definition schema, `cartridge.schema.json`, `command.schema.json`
  (continue), `gameview.schema.json` (the scene's current lines), `capability_registry.json`.
- Code: new `rules/scene.ts` (TypeScript only, ADR-074), `invocation.ts`, `actions.ts`, the
  compiler-added beat fact and the loader in both kernels. Opus. Device: Simulator kill row.
- Trigger (00a §9, QUESTSCENE-01): a story point outcome; the decision that emits its
  `story_point_reached` sets the scene's beat to 1.
- Acceptance: the scene starts once (a retried choice does not start a second, QUESTSCENE-01);
  while it runs, only `continue` is offered and a direct `move` is refused (SCENE-03); each
  `continue` advances one beat, the last ends it and emits a typed event; a kill and reopen
  mid-scene shows the same beat and re-applies nothing (SCENE-01 minimum); content cannot write
  the fact; a scene with a step outside the subset is a loader diagnostic in both kernels.

### 11. c1-sampler: the gate story (Q2)
- Docs: cartridge.md; 00a §2, §5. No protocol change.
- Content: about six Ashmere rooms (for example well_lane, drowned_lantern, inn_rooms, inn_attic
  with its locked trunk, lantern_cellar); keys and wearables placed in rooms or given by a dialogue
  choice; the cellar key just unlocks; prose from the owner's UI prototype.
- Files: `cartridges/<owner-named id>/**`, its compiled fixture with an independent known answer;
  `mobile/app/App.tsx` (the single-story constant `NAME`, :31, and the fixture import, :14) points
  at the sampler, in its own save file; the Lantern's file stays on the phone untouched and its
  Node tests (`loka play`, fixture, frozen traces) stay green.
- Sonnet, Opus reviewer. Device: Simulator cartridge-load and kill rows.
- Acceptance: identical hash in both kernels; locks only installed capabilities; no action alias
  (item 28); no root that activates a quest and acquires its item (item 14); every dialogue choice
  fits the menu on an iPhone 11 with Close and Done visible (item 31); at least one sight line (an
  NPC or item seen through an open exit); one chapter marker after the opening chapter and one
  modal cutscene, both on story point outcomes; a scripted walk reaches every room, lock, wear,
  sit, journal, chapter and scene path.

### 12. c1-touch: the phone draws the new GameView
- Docs: room-view needs #2, #7, #12; mobile lessons. Presenter only (`mobile/app/book/*`); no
  story picker.
- Sonnet. Device: agent-device walk on the Simulator in review.
- Acceptance, each by touch on the sampler: per-exit doors (a sampler door unlocks with its key);
  what is seen through each exit on the room page (DIFFERENCES 3 deleted); wear and remove;
  container unlock, open, take; sit, rest, stand and moving again; worn slots in Carrying; position
  in the status line with an English label; journal text; band phrase and tone from content (P3
  DONE: no colour cut left in `pages.tsx`); a chapter title page at the start and when the marker
  is reached; the cutscene's lines page by page, tap to continue, and again after a kill
  mid-scene.

### Review capacity (codex ends about 2026-10-14)

Slices 1-10 (kernel, contract, save) go first and get codex Sol on heads and fix re-checks. Fable
only as a codex stand-in on kernel and contract-freeze slice heads, never on fix re-reviews; Astra
only on the gate, `proposal.ts` changes and (Q4 b) a slice that adds a delta op. Every codex or
Fable review records the audited head SHA; a later change to an audited file (`fresh.ts`,
`barrier.ts`, `containment.ts`, `authority.ts`, the loaders) gets a scoped re-check of that diff
before the gate counts the audit.

## 4. Gate C1

- Owner's human parts: plays the sampler by touch on the iPhone 11, UI notes to the Playtest row;
  the measured touch-to-photon (item 27, slow-motion video against envelope §5), evidence under
  `docs/evidence/`.
- Riskiest-code audit, codex Astra, or a Fable subagent if codex has ended (Q4 a): slot holders in
  `fresh.ts` and their ids, container custody and loader reachability, the position and scene
  facts' write guards, the scene's modal restriction and single start, c1-host's seed in the pin; audited SHAs recorded, later diffs re-checked.
- Checklist, one reviewer: spec proofs linked (00 §4.1/§4.3/§4.4, 00a §9, 06 §2/§21/§35/§37,
  15 SCENE-01/SCENE-03/QUESTSCENE-01, 21 §8, 04 §15, numeric profile, the new chapter-marker
  section); every carry in a stage row (items 1, 5-7, 10-16 (12: the scene@1 rest), 20, 22, 28, 30, 31 with
  triggers); DIFFERENCES 3, 6, 7 gone and row 10 narrowed to far scan from `view` rooms
  (chapter two), perception and darkness; W1, W2, W13, P3, P6 DONE; docs tidy pass.

## 5. Count and models

12 slices + gate (host, numbers, attributes, doors, equipment, locks, position, journal,
chapters, scenes-modal, sampler, touch; Gate C1); ten Opus developers, two Sonnet.

## 6. Open for the PM (settle in the slice brief)

- Sight lines (c1-doors): in every GameView snapshot or only in the reply to a `look`. On the phone
  they are the same (Look shows the GameView); the plan assumes every snapshot.
- Chapter markers (c1-chapters): "reached" is derived from the quest resolved with the story
  point's outcome, which holds while story points fire only from quest-resolving dialogue choices
  (cartridge.md); a later trigger kind needs a persisted record.
- Modal scenes (c1-scenes-modal): installed under the `scene@1` name with the subset declared, or
  a narrower capability name; 06 and 21 §28 name only the whole of scene@1. The trigger is a story
  point outcome only (QUESTSCENE-01).

## 7. Review dispositions (summary)

codex Astra's review had 11 findings (R01-R11), all fixed in the draft: the NPC menu fit (R01),
GameView bands and tone (R03), journal keys and selection (R04), the whole invocation path (R05),
custody and loader reachability with negative cases (R06), id allocation order (R07), the hash
rule (R08), the `authority.ts` split (R09), the review exceptions as Q4 (R10), and Q2 as approval
of the subset (R11). R02 (the rooted snapped-key sink) is moot after the descope. codex Sol's two
re-checks refined the journal selection (persisted `objectives_complete` and terminal fallbacks;
the last fixed by the PM at the two-round limit) and split runtime custody refusals from loader
reachability.

Effect: [ROADMAP](../ROADMAP.md#c1-slices) chapter-one row and C1 slices.
