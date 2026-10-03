# Owner rules in force

One line per active rule, with its record. Superseded rules are not listed; their records stay in
`docs/decisions/` or `docs/archive/decisions/` ([index](../decisions/README.md)). The architecture decisions every agent must
know (candidate C, TypeScript-first rules, the persistence shape, PostgreSQL online and SQLite
offline, the bundled first release) are in [AGENTS.md](../../AGENTS.md#architecture-decisions-already-made-do-not-reopen-silently)
and not repeated here.

## Product and scope

- Finish and merge PR #137, then pause further position/terminal development; prioritize touch UI
  with required checks and independent review ([record](../decisions/owner-decision-touch-priority-2026-10-03.md)).
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
- `scene@1` is not built until chapter-one content needs scenes; the durable choice is dialogue's
  continuation row ([record](../archive/decisions/owner-decision-split-d-2026-10-01.md)).
- Puppeting comes later; rules read the actor from the command, never the player
  ([record](../archive/decisions/owner-decision-puppeting-2026-09-25.md)). Player-written descriptions
  come with the online work ([record](../archive/decisions/owner-decisions-r5-s4-2026-09-25.md)).
- Bram's quest starts from a dialogue choice, not a place action (the Lantern's `bram_offer`
  dialogue); one-off quest triggers may come later ([record](../decisions/owner-decision-quest-from-dialogue-2026-10-02.md)).
- The owner is the human-proof tester for now ([record](../archive/decisions/owner-decision-r6p-plan-2026-10-01.md)).

## Architecture and engine

- The engine owns mechanics; cartridges own numbers and world settings; no game-world value is a
  literal in the engine or a presenter. The inventory of values still to move:
  [world-parameters.md](../world-parameters.md)
  ([record](../decisions/owner-decision-world-parameters-2026-10-02.md)).
- Engine output is structured; each presenter owns its layout and wording; one `GameSession`
  boundary serves the TypeScript authority now and the Elixir Realm later; refusal words key on
  registered error codes ([record](../decisions/owner-decision-presenter-split-2026-10-02.md)).
- Default pools hp, ma, mv (DikuMUD-derived starts and gains), 1 mv per room by default (a
  cartridge's `world.movement.cost` overrides it; terrain costs later), regeneration per game
  hour derived from the clock; every v2 cartridge gets the pools
  ([record](../archive/decisions/owner-decision-hp-ma-mv-2026-09-25.md)).
- Condition bands: computed by the kernel from 04 §15's table, the engine default, which a
  cartridge may replace per pool or for all pools (bands with a tone; superseded "never a
  cartridge threshold" by the [chapter-one plan](../decisions/owner-decision-chapter-one-plan-2026-10-02.md),
  triage 21); the UI shows the phrase on hp and colours every resource; LegendMUD credited,
  never named in the UI ([record](../archive/decisions/owner-decision-condition-bands-2026-10-01.md)).
- Composability and emergence principles; every mechanic slice states what it composes with
  ([record](../archive/decisions/owner-decision-emergence-2026-09-25.md)).
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
- Saves: the app carries bundled releases newest first and reopens a save on its pin; a missing
  pin or unknown format is a typed refusal; every future save format keeps `save.format` readable
  by older apps; release deletion, migration staging and the recovery copy are carried
  ([record](../archive/decisions/owner-decision-s3b-scope-2026-09-30.md)).
- The book UI's departures from 00 §4.10 (map joystick, full pages, status line) are documented
  departures, no spec amendment ([record](../archive/decisions/owner-decision-sm2-scope-2026-10-01.md)).
- Narration binds its participants at commit; no `narration.emit`, no acknowledgement
  ([record](../archive/decisions/owner-decision-narrow-n-2026-10-01.md)).
- Open, not decided: the ADR-074 route at its trigger; the owner leans to a shared foundation with
  separate Realm rules under new keys ([leaning](../archive/decisions/owner-leaning-realm-separation-2026-10-01.md)).

## Process

The workflow itself is [WORKFLOW.md](../WORKFLOW.md); these records are its sources.

- Presenter boundary: engine output is structured and presenters own the words; the renderer reaches the game only through `GameSession`/`Game` (the player's play session and the story being played) and uses only React Native building blocks ([record](../decisions/owner-decision-presenter-split-2026-10-02.md)).
- A fresh agent of any vendor that authored none of the work is an independent reviewer
  ([record](../archive/decisions/owner-decision-reviewers-2026-09-24.md)).
- For c1-position PR #137 only, a fresh independent Codex agent replaces the primary Opus
  reviewer; all other review and merge requirements remain in force
  ([record](../decisions/owner-decision-c1-position-codex-review-2026-10-03.md)).
- Auto-merge: APPROVE or APPROVE WITH NOTES with nothing open and every CI job green
  ([record](../archive/decisions/owner-decisions-r3-lanes-2026-09-24.md)); the PM runs a slice to its
  merge and escalates hard calls up a ladder before the owner
  ([record](../archive/decisions/owner-decision-autonomy-2026-09-30.md)).
- Gates are slim: the owner's play when there is something touchable, one codex Astra audit of the
  riskiest code, and a short checklist with one reviewer; no Opus-plus-Astra double review of a
  docs-only gate PR ([record](../decisions/owner-decision-slim-gates-2026-10-02.md)).
- Reviews: codex Astra only on the gate audit and `proposal.ts` changes; Sol on other core and
  contract first reviews and every fix re-check; Fable only as codex's stand-in (and, by exception,
  the docs compaction); Opus drafts briefs; the PM keeps one persistent worktree
  ([record](../archive/decisions/owner-decision-review-rules-2026-10-01.md),
  [compaction](../decisions/owner-decision-docs-compaction-2026-10-02.md)). Codex is an everyday
  second opinion beside our own review, never instead of it
  ([record](../archive/decisions/owner-decisions-review-flow-2026-09-30.md)).
- Developers default to Sonnet; Opus for kernel and contract-freeze slices
  ([record](../archive/decisions/owner-decision-sonnet-developers-2026-09-30.md)).
- The TypeScript tests are type-checked (`kernel/ts` `npm run typecheck`, [CHECKS](../CHECKS.md))
  ([record](../archive/decisions/owner-decision-ts-test-types-2026-09-25.md)).
- Native mobile builds run only when native inputs change; the merge rule is every CI job that ran
  is green ([record](../archive/decisions/owner-decision-ci-mobile-builds-2026-09-25.md)).
- UI-slice reviews drive the app with agent-device on the iOS Simulator
  ([record](../archive/decisions/owner-decision-agent-device-2026-10-01.md)).
- Per-slice device rows run on the iOS Simulator; the iPhone 11 only at gates, before a release, and
  for native, performance or touch changes ([record](../decisions/owner-decision-simulator-device-rows-2026-10-02.md)).
- Source of truth: `docs/system/` plus `protocol/` and the conformance fixtures; a change amends
  `docs/system` first, then the code. `docs/archive/` is history, read when a task needs it; new
  decision records go in `docs/decisions/` and add a line here
  ([record](../decisions/owner-decision-docs-compaction-2026-10-02.md#decisions-for-the-move-2026-10-02)).
