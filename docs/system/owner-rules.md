# Owner rules in force

One line per active rule, with its record. Superseded rules are not listed; their records stay in
`docs/decisions/` ([index](../decisions/README.md)). The architecture decisions every agent must
know (candidate C, TypeScript-first rules, the persistence shape, PostgreSQL online and SQLite
offline, the bundled first release) are in [AGENTS.md](../../AGENTS.md#architecture-decisions-already-made-do-not-reopen-silently)
and not repeated here.

## Product and scope

- The first release bundles its chapter; downloadable story content waits for the pre-launch
  store-policy review ([PREP-03](../decisions/owner-decision-prep-03-2026-09-24.md)).
- One save per story, no manual bookmarks; a new game replaces the save after the player confirms
  ([record](../decisions/owner-decision-one-save-2026-09-30.md)).
- One phone, the owner's iPhone 11, until the first free product gate; Android evidence is deferred
  to that gate, not dropped ([record](../decisions/owner-decision-android-descope-2026-09-30.md)).
- A playtest-and-tune stage after R6P, ended by the owner: number and UI PRs get a short review;
  changed or new mechanics are normal slices; until the first release to real players, formats and
  development cartridges may change and re-derived known answers are listed in the PR
  ([record](../decisions/owner-decision-playtest-2026-09-25.md)).
- The Lantern proof has no wait and no schedule; the game clock stays and the status line shows the
  double hour's earthly branch; its stats start at hp 10, ma 100, mv 100 (in its `resources.json`
  only); the later time model targets about 72 real seconds per game hour
  ([record](../decisions/owner-decision-untimed-lantern-2026-10-02.md)). Lantern content rulings:
  a locked west gate keyed by the lantern; Bram's talk policy is quest active
  ([PM record](../decisions/pm-decision-lantern-proof-content-2026-10-01.md)).
- The story-progress concept is a "story point" (event `story_point_reached`); project
  milestones keep their name ([record](../decisions/owner-decision-story-point-2026-10-01.md)).
- `knock`, map discovery and `where` are chapter-one work, not R5
  ([record](../decisions/owner-decision-r5-deferred-mechanics-2026-09-28.md)); the R5 deferrals
  land in R7/R8 for chapter one, after R6P and before R10
  ([record](../decisions/owner-decision-early-r7r8-plan-2026-10-01.md)).
- `scene@1` is not built until chapter-one content needs scenes; the durable choice is dialogue's
  continuation row ([record](../decisions/owner-decision-split-d-2026-10-01.md)).
- Puppeting comes later; rules read the actor from the command, never the player
  ([record](../decisions/owner-decision-puppeting-2026-09-25.md)). Player-written descriptions
  come with the online work ([record](../decisions/owner-decisions-r5-s4-2026-09-25.md)).
- Bram's quest starts from a dialogue choice, not a place action (not built yet: the ROADMAP row
  "Quest from dialogue"); one-off quest triggers may come later ([record](../decisions/owner-decision-quest-from-dialogue-2026-10-02.md)).
- The owner is the human-proof tester for now ([record](../decisions/owner-decision-r6p-plan-2026-10-01.md)).

## Architecture and engine

- The engine owns mechanics; cartridges own numbers and world settings; no game-world value is a
  literal in the engine or a presenter. The inventory of values still to move:
  [world-parameters.md](../world-parameters.md)
  ([record](../decisions/owner-decision-world-parameters-2026-10-02.md)).
- Engine output is structured; each presenter owns its layout and wording; one `GameSession`
  boundary serves the TypeScript authority now and the Elixir Realm later; refusal words key on
  registered error codes ([record](../decisions/owner-decision-presenter-split-2026-10-02.md)).
- Default pools hp, ma, mv (DikuMUD-derived starts and gains), 1 mv per room until terrain costs,
  regeneration per game hour derived from the clock; every v2 cartridge gets the pools
  ([record](../decisions/owner-decision-hp-ma-mv-2026-09-25.md)).
- Condition bands: one table (04 §15), computed by the kernel, never a cartridge threshold; the UI
  shows the phrase on hp and colours every resource; LegendMUD credited, never named in the UI
  ([record](../decisions/owner-decision-condition-bands-2026-10-01.md)).
- Composability and emergence principles; every mechanic slice states what it composes with
  ([record](../decisions/owner-decision-emergence-2026-09-25.md)).
- Ids: IdSource UUIDv8 and the frozen numeric profile v1; CommandId reuses the recipe and
  authority placement never enters it; lowercase UUID ids, snake_case segments, `ErrorCode` enum
  plus registry ([record](../decisions/owner-decisions-r3-2026-09-24.md),
  [lanes](../decisions/owner-decisions-r3-lanes-2026-09-24.md)).
- Ambiguous targets list by id; dotted fact names map to underscores with a collision check
  ([record](../decisions/owner-decisions-r3-open-questions-2026-09-24.md)). Kernel API range as
  `{at_least, below}`; no count limits, a byte cap at the download boundary
  ([record](../decisions/owner-decisions-r3-pr4a-2026-09-24.md)). `policy@1`,
  `target_resolution@1` and `fact@1` are `portable_capability`; Elixir domain types arrive with
  their first consumer ([record](../decisions/owner-decisions-r3-gate-2026-09-24.md)).
- Cartridge source is JSON (YAML later); artifacts are capped at 4 MiB
  ([record](../decisions/owner-decisions-r4-2026-09-25.md)); short references in source
  ([record](../decisions/owner-decision-short-refs-2026-09-25.md)).
- Entity text has four tiers (keywords, short, room line, examine); the host synthesizes
  `fact_changed` at each assign's causal position; touch links are inline markup in catalog
  strings ([record](../decisions/owner-decisions-r5-s4-2026-09-25.md)).
- Rule modules are locked down by lint; `loka play` is the agent-drivable terminal; the feature
  map is generated and drift-checked ([record](../decisions/owner-decision-r5-setup-2026-09-25.md));
  failed lookups are observed as `target.unresolved` for the Lab
  ([record](../decisions/owner-decision-lab-failed-lookups-2026-09-25.md)).
- Observability: one record format, stores joined by ids, a registered event-name list (ADR-075);
  `kernel_version` is `<KERNEL_ID>@<commit>`, a dirty build marked and never a repro key; the PM
  keeps `docs/dev-evidence.jsonl` ([record](../decisions/owner-decisions-adr-075-2026-09-25.md)).
- Verification harness: invariants as registered data, deterministic simulation every CI run,
  fault simulation on real SQLite; owner attention goes to invariant lists and harness changes
  ([record](../decisions/owner-decision-roadmap-2026-09-24.md), [ROADMAP](../ROADMAP.md#verification-harness-adopted-2026-09-24)).
- The due-job drain landed with the first real job; `real_elapsed` time is carried until a
  cartridge declares it ([record](../decisions/owner-decision-s4-scope-2026-09-30.md)).
- Saves: the app carries bundled releases newest first and reopens a save on its pin; a missing
  pin or unknown format is a typed refusal; every future save format keeps `save.format` readable
  by older apps; release deletion, migration staging and the recovery copy are carried
  ([record](../decisions/owner-decision-s3b-scope-2026-09-30.md)).
- The book UI's departures from 00 §4.10 (map joystick, full pages, status line) are documented
  departures, no spec amendment ([record](../decisions/owner-decision-sm2-scope-2026-10-01.md)).
- Narration binds its participants at commit; no `narration.emit`, no acknowledgement
  ([record](../decisions/owner-decision-narrow-n-2026-10-01.md)).
- Open, not decided: the ADR-074 route at its trigger; the owner leans to a shared foundation with
  separate Realm rules under new keys ([leaning](../decisions/owner-leaning-realm-separation-2026-10-01.md)).

## Process

The workflow itself is [WORKFLOW.md](../WORKFLOW.md); these records are its sources.

- A fresh agent of any vendor that authored none of the work is an independent reviewer
  ([record](../decisions/owner-decision-reviewers-2026-09-24.md)).
- Auto-merge: APPROVE or APPROVE WITH NOTES with nothing open and every CI job green
  ([record](../decisions/owner-decisions-r3-lanes-2026-09-24.md)); the PM runs a slice to its
  merge and escalates hard calls up a ladder before the owner
  ([record](../decisions/owner-decision-autonomy-2026-09-30.md)).
- Gates are slim: the owner's play when there is something touchable, one codex Astra audit of the
  riskiest code, and a short checklist with one reviewer; no Opus-plus-Astra double review of a
  docs-only gate PR ([record](../decisions/owner-decision-slim-gates-2026-10-02.md)).
- Reviews: codex Astra only on the gate audit and `proposal.ts` changes; Sol on other core and
  contract first reviews and every fix re-check; Fable only as codex's stand-in (and, by exception,
  the docs compaction); Opus drafts briefs; the PM keeps one persistent worktree
  ([record](../decisions/owner-decision-review-rules-2026-10-01.md),
  [compaction](../decisions/owner-decision-docs-compaction-2026-10-02.md)). Codex is an everyday
  second opinion beside our own review, never instead of it
  ([record](../decisions/owner-decisions-review-flow-2026-09-30.md)).
- Developers default to Sonnet; Opus for kernel and contract-freeze slices
  ([record](../decisions/owner-decision-sonnet-developers-2026-09-30.md)).
- The TypeScript tests are type-checked (`kernel/ts` `npm run typecheck`, [CHECKS](../CHECKS.md))
  ([record](../decisions/owner-decision-ts-test-types-2026-09-25.md)).
- Native mobile builds run only when native inputs change; the merge rule is every CI job that ran
  is green ([record](../decisions/owner-decision-ci-mobile-builds-2026-09-25.md)).
- UI-slice reviews drive the app with agent-device on the iOS Simulator
  ([record](../decisions/owner-decision-agent-device-2026-10-01.md)).
- The docs describe the current system; history lives in an archive read when a task needs it
  ([record](../decisions/owner-decision-docs-compaction-2026-10-02.md)).
