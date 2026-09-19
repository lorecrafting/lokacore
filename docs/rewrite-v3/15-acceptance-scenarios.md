# 15 — Adversarial Acceptance Scenarios

These scenarios turn architecture claims into observable behavior.

They are intended to seed automated tests, Cartridge Lab repros, architecture reviews, and implementation issues.

Scenario IDs are stable.

## A. Portable kernel and determinism

### DET-01 — Same command, same state

Given identical:

- cartridge hash;
- deployment;
- state snapshot;
- logical time;
- RNG state;
- command

the kernel returns canonically identical result across repeated runs.

### DET-02 — Cross-host equivalence

Run the same fixture through every host implementation/adapter required by the R1-selected portable-execution strategy.

For a shared native kernel this includes direct/native, BEAM, iOS, and Android host paths. For the documented dual-implementation fallback, compare the accepted Elixir and mobile implementations instead.

Domain-result hash MUST match.

### DET-03 — RNG replay

A randomized skill check is replayed from snapshot/seed and produces identical rolls/outcome.

### DET-04 — Wall clock ignored

Changing host system clock does not affect a `play_time` cartridge command result.

### DET-05 — Unknown capability

Artifact references unknown capability/version.

Compile/launch fails closed with typed diagnostic.

### DET-06 — Deterministic map ordering

Two hosts construct logically equivalent state maps/sets in different insertion orders.

Canonical decision/trace hash is identical.

### DET-07 — Deterministic IDs

A scripted spawn under identical instance/command/RNG/ID-source state produces the same canonical identity sequence across hosts.

### DET-08 — Numeric boundary

Rule-critical arithmetic at rounding/threshold boundaries produces identical results on ARM mobile and server host.

No platform floating-point difference changes quest/combat/economy outcome.

### DET-09 — Kernel proposal is non-mutating before commit

Decision returns a proposal/delta.

Host simulates persistence failure.

Subsequent decision observes the original committed state.

### DET-10 — Post-commit in-memory apply failure

Persistence commits delta, then injected kernel-state apply failure occurs.

Authority restarts/reloads committed state and does not execute command twice.

### DET-11 — Kernel panic boundary

Injected native failure cannot silently produce committed game state.

Host returns failure/restarts as applicable.

## B. Offline lifecycle

### OFF-01 — Airplane mode launch

Previously acquired/downloaded paid cartridge starts with no network.

### OFF-02 — Airplane mode full play

Player can complete representative cartridge without network.

### OFF-03 — App killed before local commit

Kill after decision but before SQLite transaction completion.

On restart state is previous committed revision.

### OFF-04 — App killed after local commit

Kill after SQLite commit but before UI update.

On restart new committed state appears once.

### OFF-05 — Duplicate local command

Same command ID is retried after crash.

Effect occurs once.

### OFF-06 — Low storage

SQLite write fails due simulated storage error.

UI does not advance durable state; user gets recoverable error.

### OFF-07 — Corrupt snapshot

Snapshot checksum/format invalid.

System attempts known-good prior snapshot/recovery path or reports typed save corruption; it does not invent state.

### OFF-08 — Long absence

Real-elapsed cartridge resumes after 30 days with many due jobs.

Jobs reconcile deterministically without freezing UI indefinitely or duplicating effects.

### OFF-09 — Clock rollback

Device clock is moved backward.

Elapsed-time policy handles according to defined rule; no negative timer corruption.

### OFF-10 — Divergent devices

Device A and B continue same cloud-backed save independently.

Sync preserves both branches and requests selection; no arbitrary merge.

### OFF-11 — Cartridge update

Save pinned to v1.2; v1.3 installed.

Save still opens with v1.2 or performs explicit certified migration.

### OFF-12 — Old artifact garbage collection

Attempt to delete v1.2 artifact while save requires it.

Deletion blocked or save migration/deletion explicitly required.

### OFF-13 — Resume-time advancement retry

A real-elapsed Story save resumes after an absence. The authority samples/clamps elapsed time and commits a resume-time advancement input, then the app crashes before presenting the updated view.

Restart/retry does not apply the same elapsed interval twice; scheduled jobs/deadlines observe exactly one accepted advancement.

## C. Containment and inventory

### INV-01 — Atomic pickup

Take item.

After commit item is in exactly one container: player inventory.

### INV-02 — Crash during pickup

Crash at every boundary.

Never observe item in neither room nor inventory or in both after recovery.

### INV-03 — Duplicate pickup

Two identical command retries.

One item acquired.

### INV-04 — Give item

Transfer player A→B online.

Ownership changes atomically.

### INV-05 — Shared race

Two players attempt same ground item concurrently.

Exactly one succeeds; loser receives typed stale/not-present response.

### INV-06 — Container deletion

Delete/despawn container.

Explicit containment policy applied; contents never silently vanish due generic recursive delete.

### INV-07 — Equipment ownership

Equipped item remains owned/contained consistently and cannot also be equipped by another character.

## D. Quest correctness

### QST-01 — Offered activation

An eligible offered quest has no QuestInstance before acceptance. Accepting it creates exactly one active QuestInstance with activation metadata through a legal transition.

### QST-02 — Double activation

Retrying the offered/automatic/discovery activation event does not create a duplicate QuestInstance.

### QST-03 — Wrong NPC talk

Talking to different NPC does not complete targeted objective.

### QST-04 — Wrong dialogue node

Talking to correct NPC but wrong node does not complete node-specific objective.

### QST-05 — Premature turn-in regression

Objective observation cannot cause the historical class of bug where turn-in action is skipped because quest was marked complete too early.

### QST-06 — Duplicate domain event

Same event ID processed twice.

Objective/reward advances once.

### QST-07 — Reward crash

Crash after quest completion decision before/after durable commit/effect.

Reward exists exactly once.

### QST-08 — Abandon/reaccept

Definition's retry policy honored; stale objective state does not leak unexpectedly.

### QST-09 — Deadline offline

Timed quest expires according to declared logical-time policy while app is closed and reconciles deterministically on resume.

### QST-10 — Quest version pin

Quest v2 published while v1 active.

Existing QuestInstance continues v1 until explicit migration/finish.

### QST-11 — Giver death

Quest giver permanently dies in private story.

Quest either intentionally fails or has certified alternate completion; player is not silently hard-locked unless intended ending.

### QST-12 — Player-scoped shared quest

Two MMO players talk to same shared NPC.

Their quest states remain independent.

### QST-13 — Party scope

Party quest progresses according to explicit party membership/policy and does not leak to another party.

### QST-14 — Realm event

Realm-scoped event intentionally changes all eligible players/world state; certification verifies this broad scope is explicit.

### QST-15 — Automatic discovery quest

Player discovers a hidden shrine whose prerequisite facts are satisfied.

Before the discovery trigger there is no QuestInstance. The activation index identifies the definition as a candidate, the quest activates without an NPC giver, records the discovery event once, and its journal visibility follows the separate reveal/visibility policy. It can resolve automatically without a turn-in NPC.

### QST-16 — Multiplayer kill credit

Player A and Player B share a zone. A kills a quest target.

For an `actor` credit objective, only A progresses.

For an eligible `party` policy, configured party members progress.

An unrelated nearby player does not progress unless the objective explicitly uses witness/scope policy.

### QST-17 — Witness credit requires actual observation

An objective credits witnesses to a public event.

A player in another room/instance does not progress merely because the DomainEvent exists globally.

### QST-18 — World-caused quest event

A quest target dies due to world simulation or another NPC rather than the player.

The quest follows its authored failure/alternate-outcome rule instead of assuming every relevant event has the questing player as actor.

### QST-19 — Quest unlocks area atomically

Completing a Story quest outcome opens a stateful gate/connection in the same local authority.

Crash is injected before and after commit.

After recovery, quest outcome and gate state are either both old or both committed; never split.

### QST-20 — Personal unlock does not leak

In Realm Mode, player A completes a player-scoped quest that grants access to a hidden passage.

Player A can use the passage. Player B, who has not met the condition, cannot.

The shared Realm connection/entity is not accidentally opened globally.

### QST-21 — Fact-driven world reaction

Quest sets `village.child_status = rescued`.

Without direct quest edits to each subsystem:

- mother dialogue changes;
- mother schedule/profile changes;
- ferryman ambient line set changes;
- follow-up quest becomes available;
- town description variant changes.

All reactions are explainable through fact/reference graphs.

### QST-22 — NPC branch state

Two branch forks end in `rescued` versus `dead`.

The mother's typed role state becomes `relieved` versus `grieving`; each state selects a valid schedule/dialogue profile and remains deterministic after seven simulated days.

### QST-23 — Consequence exactly once

Quest outcome grants item, sets fact, opens gate, and emits a custom DomainEvent.

Duplicate triggering event/retry cannot grant the item twice or re-run non-idempotent consequences.

### QST-24 — Consequence scope escalation rejected

A player-scoped quest contains an undeclared Realm-scoped consequence.

Compilation/certification rejects the quest rather than inferring global scope.

### QST-25 — Explicit Realm-wide consequence

A shared-area quest intentionally changes a Realm-scoped festival state.

The broader scope is explicit and multiplayer-certified; all eligible players observe the intended shared change.

### QST-26 — Cross-authority consequence retry

A quest outcome in ZoneShard A produces an idempotent effect intended for a Realm-wide service.

Crash/failure occurs after local outcome commit but before remote acknowledgement.

Outbox/reconciliation retries the remote operation exactly once without rolling back or duplicating the local quest outcome.

### QST-27 — Area unlock preserves reachability

A branch closes one road and opens another.

Static graph checks plus branch simulation prove the player is not trapped away from required content unless the branch explicitly defines that ending.

### QST-28 — Branch world comparison

The Lab forks immediately before a major choice.

Its comparison report correctly identifies differing facts, access, NPC states, dialogue/action sets, spawned actors, and follow-up quests.

## E. Dialogue

### DIA-01 — Conditional choice

Choice appears only when policy true.

### DIA-02 — Stale choice

Mobile shows choice; state changes before selection.

Server/local authority revalidates and rejects stale choice if no longer legal.

### DIA-03 — Reconnect mid-dialogue

Online reconnect reconstructs consequential dialogue state or safely restarts according to definition.

### DIA-04 — Offline resume

Local save mid-dialogue resumes without quest inconsistency.

### DIA-05 — Branch reachability

Certification proves intended endings reachable.

### DIA-06 — Knowledge leak

Semantic review flags dialogue revealing information before the player can learn it.

## F. Actions and policy

### ACT-01 — Union

Equipment grants action without removing base actions.

### ACT-02 — Remove

Stun removes attack action.

### ACT-03 — Intersect

Meditation room permits only whitelist.

### ACT-04 — Replace

Transformation replaces normal ActionSet.

### ACT-05 — Priority override

Two sources provide same action key; deterministic priority/override rule chooses one.

### ACT-06 — Unknown policy

Unknown policy operator denies/fails compilation; never defaults allow.

### ACT-07 — Touch/text equivalence

Touch “Talk” and terminal `talk ferryman` resolve to same command semantics.

### ACT-08 — Ambiguous text target

Two guards match “guard.”

Parser returns structured candidates, not arbitrary target.


### ACT-09 — Forged hidden action invocation

Client submits an ActionInvocation for an action key not present in its current GameView.

Local Story authority or BEAM Realm authority re-resolves current ActionSet and rejects it unless independently legal. Hidden UI is never the security boundary.

### ACT-10 — Stale action invocation

Client submits an invocation from GameView revision 41 after authority state advanced to revision 42 and the action is no longer legal.

Authority returns a typed stale/invalid-action result and fresh projection/resync guidance; it does not execute based solely on the old view.

### ACT-11 — Invocation retry

Client retries the same invocation after losing the acknowledgement.

The active authority maps it into the command/idempotency contract so a state-changing action cannot execute twice.

### ACT-12 — Realm local-kernel forgery

A modified one-app client computes a favorable local result for a Realm action and submits it.

The server ignores local decision output and accepts only the ActionInvocation, then performs its own authoritative resolution/decision.

### ACT-13 — Invocation retry after reconnect

A Realm ActionInvocation commits, the acknowledgement is lost, and the client reconnects under a new session ID before retrying the same invocation ID.

The authority derives the same semantic Command/idempotency identity and returns the prior result. The action executes once; ephemeral session identity does not mint a new mutation.

## G. Scripting

### SCR-01 — Allowed binding

Portable script emits typed effect and works identically offline/online.

### SCR-02 — Filesystem escape

Attempt to open/read file is rejected at compile/interpreter boundary.

### SCR-03 — Module call

Attempt arbitrary Elixir/Rust/module invocation rejected.

### SCR-04 — Infinite loop

Interpreter step budget terminates script deterministically.

### SCR-05 — Effect flood

Script attempts 10,000 spawns.

Budget rejects/halts before resource exhaustion.

### SCR-06 — Query flood

Budget enforced.

### SCR-07 — Event recursion

Script emits a custom DomainEvent that recursively causes itself.

Event-chain depth/cycle controls terminate with diagnostic.

### SCR-08 — RNG script

Same RNG state gives same script branch offline/online.

### SCR-09 — Server-only binding in offline cartridge

Compilation fails portability gate.

### SCR-10 — Wall-time guard is not game semantics

A certified script has deterministic step/query/resource limits and runs on both a slower supported mobile host and the server.

Both hosts produce the same semantic result or deterministic budget error. A host wall-time kill switch cannot produce a normal cartridge-visible branch on one host while the other succeeds; if the outer guard fires, conformance/runtime health fails instead.

## H. Living world and time

### WORLD-01 — NPC schedule

NPC wakes/works/sleeps over simulated day and reaches valid rooms.

### WORLD-02 — Closed route

Door schedule makes NPC route impossible.

Certification reports schedule/path conflict.

### WORLD-03 — Synchronized emptiness

All marketplace NPCs leave simultaneously.

Semantic/liveliness review may flag undesirable synchronized schedule.

### WORLD-04 — On-demand growth

Plant state after 7 days derived correctly without 7 days of ticks.

### WORLD-05 — Population leak

30-day simulation proves spawn count bounded.

### WORLD-06 — Shop hours

Offline resume at night reports shop closed from logical time without requiring background execution.

### WORLD-07 — Weather deterministic

Seed/time produces repeatable weather sequence for portable weather capability.

## I. Cartridge/compiler

### CAR-01 — Namespace collision

Two cartridges both define `rooms/tavern`.

Both coexist because canonical refs differ.

### CAR-02 — Broken reference

Quest references missing NPC.

Compilation fails with field-path diagnostic.

### CAR-03 — Template cycle

A→B→A mixins fail compile.

### CAR-04 — Reproducible build

Same source/compiler version produces same artifact hash.

### CAR-05 — Mutation after certificate

Source changes one byte.

Artifact hash changes; old certificate cannot promote new artifact.

### CAR-06 — Missing locale

Required localization key missing.

Certification profile handles as error/warning according to locale policy.

### CAR-07 — Unsupported client feature

Installed app lacks required renderer capability.

Offline launch fails gracefully before save mutation; online catalog blocks/requests update.

### CAR-08 — Hostile package structure

A signed or unsigned cartridge archive attempts path traversal, duplicate-path confusion, or decompression far beyond declared resource limits.

Install fails in staging before activation; no filesystem escape or unbounded extraction occurs.

### CAR-09 — Published version cannot be rebound

`story@1.2.0` is already published at hash H1.

A different artifact H2 attempts publication under the same cartridge ID/version.

Publication fails; a new semantic version/release is required.

### CAR-10 — Certificate/signature does not change semantic identity

A compiled candidate has semantic cartridge hash H.

Certification produces a certificate referencing H and release signing adds signature/certificate metadata.

The semantic cartridge hash remains H. An exact archive/package hash may differ after envelope material is added, and verification can prove both domains without circular hashing.

## J. Builder/AI

### BLD-01 — Revision conflict

Two builders edit same workspace revision.

Second mutation receives conflict; no silent overwrite.

### BLD-02 — Semantic rename

Rename NPC key.

Typed incoming references updated; diff shown; validation passes.

### BLD-03 — Dry-run delete

Delete quest giver dry-run lists affected quest/dialogue refs.

### BLD-04 — Agent missing capability

Agent requests possession mechanic not supported.

Builder returns structured MISSING_CAPABILITY; agent cannot bypass with hidden raw code.

### BLD-05 — Reviewer permissions

Review agent cannot publish.

### BLD-06 — Publication policy

Author agent cannot bypass failed certification.

### BLD-07 — MCP/terminal parity

Same Builder operation via MCP and terminal produces same underlying workspace result.

### BLD-08 — Lost Builder response retry

A mutating Builder operation commits revision 43, but the caller loses the response and retries the same `operation_id` with its original expected revision 42.

The Builder returns the original committed result/revision without applying the mutation again.

### BLD-09 — Reused Builder operation ID with different payload

An already committed `operation_id` is retried with different semantic input.

The Builder returns an idempotency/integrity conflict and does not apply either a second mutation or a misleading replay response.

## K. Mobile protocol

### PROTO-01 — Generated parity

Elixir and TypeScript fixtures decode same message schema.

### PROTO-02 — Old client

Unsupported protocol version rejected with typed upgrade response.

### PROTO-03 — Projection-sequence gap

Client misses a projected delta/message.

It detects a gap in its projection stream sequence and resyncs from a fresh GameView snapshot. Unrelated ZoneShard authority revisions do not by themselves create false client-gap detection.

### PROTO-04 — Stale local projection

Client button remains visible after server policy changes.

Server revalidates command; client receives typed rejection/new ActionSet.

### PROTO-05 — Unknown server message

Versioned handling does not crash app; incompatible required semantics force resync/update.

## L. Online transaction and recovery

### ONL-01 — Duplicate network command

Client retries after timeout.

Command receipt returns existing result; state/effects once.

### ONL-02 — DB failure

PostgreSQL commit fails.

WorldInstance does not adopt uncommitted state.

### ONL-03 — Crash after DB commit

WorldInstance crashes before reply.

Restart loads committed revision; retry returns receipt.

### ONL-04 — Outbox retry

External durable effect fails transiently.

Retries with same idempotency key.

### ONL-05 — World owner duplicate

Injected split-brain/stale owner attempts to write after ownership moved.

DB revision plus ownership/fencing-generation guard rejects the stale writer, including the case where its state revision would otherwise appear current.

### ONL-06 — Mailbox overload

World instance crosses queue threshold.

Gateway throttles/rejects non-critical commands; BEAM remains responsive.

## M. Session/account/character

### SES-01 — Two mobile sessions

Same account connects from two devices per configured policy; character control rules explicit.

### SES-02 — Disconnect

Session dies; character/world durable state remains.

### SES-03 — Reconnect

New session reattaches/resyncs.

### SES-04 — Entitlement not character field

Deleting/recreating character does not erase purchased cartridge entitlement.

## N. Offline-to-MMO reconciliation

### MMO-01 — Adventure portal

Previously released offline storypack is launched from shared hub as online private instance with same content semantics.

### MMO-02 — Embedded instance

Player crosses physical MMO entrance into party-specific story instance and returns.

### MMO-03 — No offline loot import

Modified local save claims 1,000,000 gold/legendary sword.

MMO account gains none.

### MMO-04 — Narrative memory import

Offline ending marker may sync only to explicitly non-competitive profile/memory field.

### MMO-05 — Shared promotion

Private cartridge gains shared deployment overlay.

It must pass new shared-area certification; private certificate alone is insufficient.

### MMO-06 — Shared NPC personal quests

100 players share ferryman NPC while each has independent quest/dialogue progress.

### MMO-07 — Shared NPC death policy

Private story allows permanent ferryman death; shared deployment defines respawn/immortality/instance policy explicitly.

### MMO-08 — Resource competition

Shared promoted zone handles simultaneous harvest/loot according to declared shared semantics.

### MMO-09 — Cross-shard handoff

Character moves zone A→B and crash occurs at each handoff boundary.

After recovery exactly one shard owns character.

## O. Commerce

### PAY-01 — Purchase then offline

Purchase verified, pack downloaded, airplane mode, launch succeeds.

### PAY-02 — Restore

Fresh device restores entitlement and downloads pack.

### PAY-03 — Refund while device offline

Device may remain playable per offline policy; on reconnect entitlement reconciles predictably without deleting save unexpectedly.

### PAY-04 — Tampered package

Hash/signature mismatch prevents launch.

### PAY-05 — Wrong product mapping

Platform SKU cannot directly unlock arbitrary cartridge without canonical server mapping.

## P. Operations

### OPS-01 — PostgreSQL unavailable

Readiness fails; liveness may remain; authoritative mutations unavailable rather than pretending success.

### OPS-02 — AI provider unavailable

Gameplay and cartridge runtime unaffected.

### OPS-03 — Builder unavailable

Published gameplay unaffected.

### OPS-04 — Backup restore

Restore staging environment from backup and prove known instance/catalog/entitlement state.

### OPS-05 — Kernel version deploy

Incompatible active instance is checkpointed/migrated/kept on compatible runtime according to explicit release policy; never silently reinterpret state.

## Q. Architecture tests

### ARCH-01

Portable kernel has no network/filesystem/database imports.

### ARCH-02

Core/domain layer cannot import Phoenix/Ecto/web adapters.

### ARCH-03

Web layer is only external adapter; game rules cannot import serializers/socket structs.

### ARCH-04

No production content path uses dynamic atom creation from content strings.

### ARCH-05

No Builder adapter bypasses canonical Builder API mutation layer.

### ARCH-06

No online gameplay path mutates durable world state outside authority/store commit boundary.

### ARCH-07

No offline gameplay path mutates durable local save outside LocalInstanceAuthority commit boundary.

### ARCH-08

No published cartridge uses raw `Code.eval_string` or arbitrary downloaded executable code.

## R. Definition of a regression

Any bug affecting state correctness should result in:

- new scenario or refinement of an existing scenario;
- deterministic repro fixture if possible;
- permanent test in the relevant profile.

The acceptance suite should grow monotonically with real failures.


## S. Cartridge composition

### COMP-01 — Campaign port binding

Chapter 1 exported exit is bound to Chapter 2 entry through campaign manifest.

Compiler resolves connection without exposing unrelated internals.

### COMP-02 — Private internal key

Expansion attempts to reference non-exported internal room from prior cartridge.

Compilation fails.

### COMP-03 — Extension point schema

Expansion contributes a quest hook to an exported extension point with wrong schema.

Compilation fails with typed diagnostic.

### COMP-04 — Immutable prior artifact

Installing expansion does not modify prior cartridge hash.

Only composite campaign/deployment manifest changes.

### COMP-05 — MMO mount

Shared realm mounts a certified cartridge through declared entry/exit ports.

No ad-hoc global-key reference is required.


## T. Long-lived offline compatibility and signing

### COMPAT-01 — App auto-update with old save

Device has cartridge/save pinned to older supported kernel API/rule-IR/content-schema versions.

App auto-updates with no network available.

Save opens and plays through backward-compatible execution or a fully local deterministic migration.

### COMPAT-02 — Failed save migration rollback

Injected crash/write failure occurs during local compatibility migration.

Original save and old artifact remain recoverable; no half-migrated save becomes authoritative.

### COMPAT-03 — Unsupported version removal gate

Release attempts to remove the only interpreter/migration path for a still-supported published cartridge.

Release certification blocks until compatibility/migration policy is satisfied.

### COMPAT-04 — Signing-key rotation

Cartridge A was signed with old trusted key K1. New catalog content uses K2 after rotation.

A remains verifiable while K1 is still in the supported verification keyset; new content verifies with K2.

### COMPAT-05 — Revoked signing key

On reconnect, client learns K1 is revoked due compromise.

Current product/security policy is applied explicitly; client does not silently equate signing-key revocation with deleting local saves.

### COMPAT-06 — Tampered key ID/signature metadata

Artifact substitutes key ID or signed metadata without valid signature.

Verification fails before launch.

### COMPAT-07 — Capability version remains semantically pinned

A published cartridge is certified against `schedule@1`.

The engine later introduces `schedule@2` with different semantics.

The old cartridge continues to execute `schedule@1` semantics or follows an explicit certified migration; merely installing the newer engine/app does not reinterpret the old artifact.

## U. Receipt and platform boundaries

### RECEIPT-01 — Retry returns stable committed response

Online state-changing command commits, client times out before receiving reply, then retries same command ID.

Runtime does not execute again and returns the original stable committed result/ack (or a reconstruction explicitly equivalent under the protocol), not merely “already processed.”

### RECEIPT-02 — Receipt/result corruption

Receipt claims processed command but durable response reference is missing/corrupt.

Runtime raises an integrity fault/resync path rather than re-executing mutation.

### RECEIPT-03 — Reused idempotency identity with different command

A previously committed Command ID/invocation identity is submitted again with a different semantic command payload.

The stored semantic-command digest does not match. Runtime rejects with an idempotency/integrity conflict; it neither executes the new payload nor pretends the old response belongs to the different request.

### PLATFORM-01 — Web adapter cannot grant entitlement directly

Attempt to mutate entitlement from Phoenix controller/channel without going through `loka_platform` application service/policy.

Architecture test fails.

### PLATFORM-02 — Entitlement service unavailable

Offline already-downloaded cartridge remains playable.

New purchase/restore may fail gracefully, while world simulation and unrelated online game instances remain isolated from the platform-service failure according to deployment topology.


## V. Client mode and builder target separation

### MODE-01 — Story Mode has no online world dependency

With all Loka online services unavailable, an installed offline-capable cartridge launches in Story Mode, plays, saves, and resumes.

### MODE-02 — Realm Mode has no local authority fallback

Realm Mode loses server connectivity during authoritative play.

It does not continue mutating a local authoritative copy. It reconnects/resyncs or presents disconnected status according to policy.

### MODE-03 — Exactly one active gameplay authority

While a Story session is active, the user switches to Realm Mode.

The Story session commits/closes before RemoteRealmSession becomes active. No world/save is simultaneously authoritative locally and remotely.

The reverse transition has the same guarantee.

### MODE-04 — Local kernel cannot authorize Realm state

A modified client invokes the embedded local kernel while connected to Realm Mode and fabricates favorable results.

BEAM ignores those results; only validated Realm commands and server decisions can mutate Realm state.

### MODE-05 — Shared GameView parity

Equivalent portable cartridge state rendered through LocalStorySession and an online-private RemoteRealmSession yields semantically equivalent GameView action/quest/dialogue visibility.

Presentation chrome may differ.

### MODE-06 — Realm code cannot mutate Story saves

Realm session/social/transport code attempts to write a Story save or local world revision.

Architecture/boundary test fails.

### MODE-07 — Story authority cannot bypass Realm transport

Story/local authority code attempts to mutate Realm character/economy/session state.

Architecture/boundary test fails.

### MODE-08 — Realm-specific UI is not on Story critical path

Guild/presence/shard services are unavailable or uninitialized.

Ordinary Story Mode launch/play remains functional.

### MODE-09 — App update preserves offline saves while Realm evolves

An app update changes Realm protocol/client features but leaves a supported Story save installed.

The Story save still opens through the documented kernel/rule-IR compatibility path.

### MODE-10 — Optional Story account, required Realm account

A legitimately acquired cartridge remains playable in Story Mode while signed out/offline.

Entering Realm Mode requires authenticated online identity.

### BUILDTARGET-01 — Story rejects server-only capability

A `story` workspace attempts to add `guild_market@1` or another server-only capability.

Compilation fails with a portability/target diagnostic.

### BUILDTARGET-02 — Realm permits server-only capability

A `realm` workspace may use a registered server-only capability and receives the corresponding multiplayer certification obligations.

### BUILDTARGET-03 — Realm state scope must be explicit

A realm quest/door/world event omits required multiplayer state scope where ambiguity exists.

Validation fails rather than defaulting to global.

### BUILDTARGET-04 — Promotion preserves source artifact

A `promote` workspace adapts a certified Story cartridge.

Original cartridge hash remains unchanged; promotion creates a new deployment/adaptation artifact and certificate.

### BUILDTARGET-05 — Promotion surfaces multiplayer questions

Promotion of a cartridge containing a permanently killable quest giver, unique loot, and player-local access facts returns structured required decisions for respawn, contention, and scope before shared-area certification can pass.

### ENTITLEMENT-01 — Local ownership is not Realm authority

The app has a locally cached verified Story entitlement and a modified local save.

Realm Mode may use server-verified entitlement/account rules to unlock content, but it does not grant competitive/persistent value from the local save or an unverified local ownership flag.


## W. Quest sharing, phasing, and scarce services

### SCOPE-01 — Personal progress in shared world

Players A and B share the same town and ferryman.

A accepts a player-scoped quest. B does not.

Only A's QuestInstance progresses while both continue to see/interact with the shared ferryman.

### SCOPE-02 — Party progress membership snapshot

A party activates a quest using snapshot membership.

A late joiner does not retroactively become an owner/recipient unless the definition explicitly allows it.

Leaving/rejoining cannot duplicate progress or rewards.

### SCOPE-03 — Party dynamic-present credit

A party quest using dynamic-present credit advances only eligible present members according to the objective's credit policy.

### SCOPE-04 — Instance-scoped puzzle

Two parties enter separate instances of the same dungeon.

Solving the puzzle in one instance changes only that instance.

### SCOPE-05 — Realm-scoped public event

A certified Realm event advances shared reconstruction progress once and is visible consistently to all eligible players.

### PHASE-01 — Personal quest NPC invisible to others

Player A is eligible for a quest apparition in a shared room.

A's GameView/search/action resolution includes it.

Player B's does not.

### PHASE-02 — Phased actor cannot leak shared effects

A player-scoped quest NPC dies and drops an item.

The drop remains player-scoped by default and cannot be looted or targeted by unrelated players.

### PHASE-03 — Lazy materialization survives cleanup

A personal quest actor is materialized while the player is nearby, then cleaned up after leaving.

On return, durable quest/fact state reconstructs the correct actor state without duplication.

### PHASE-04 — Shared NPC stays shared

Two players interact with the same shared smith NPC but have different trust/dialogue/quest actions.

Only one world NPC exists; per-player projections differ correctly.

### PHASE-05 — Overlay provenance

Developer/Lab trace can explain which shared/party/player layer caused a visible NPC, action, exit, or description variant.

### INSTANCE-01 — Private destructive branch

Player A destroys a bridge inside a private quest instance.

Shared Realm geography and Player B's experience remain unchanged.

### INSTANCE-02 — Instance reconnect

Player disconnects from a private/party quest instance and reconnects.

The correct instance identity and state are restored; a duplicate instance is not created.

### INSTANCE-03 — Instance teardown

Completed/expired private instance tears down ephemeral entities while explicitly exported rewards/memories survive according to policy.

### SERVICE-01 — Shared service slot race

Two Realm players submit requests for the only available slot on a shared service concurrently. The smithy forge case is one fixture.

Exactly one order receives that slot; the other is queued/rejected according to policy.

### SERVICE-02 — ServiceJob input escrow

Submitting a sword order moves required materials into escrow atomically with ServiceJob creation.

Crash at every boundary cannot duplicate or lose inputs.

### SERVICE-03 — ServiceJob completion exactly once

Scheduler retries the completion job after a crash.

Sword output is created/claimed once and the completion DomainEvent is idempotent.

### SERVICE-04 — Personal quest observes shared ServiceJob

Player A's personal quest requires the sword.

Player B also uses the same smithy.

Only completion of A's eligible ServiceJob progresses A's quest.

### SERVICE-05 — Capacity semantics are precise

Content declaring one start per day behaves differently from one concurrent one-day slot and one completion per day, and certification fixtures prove the selected rule.

### SERVICE-06 — Queue persists through restart

Realm service/ZoneShard restarts with queued and active ServiceJobs.

Queue order, reservations, escrow, and scheduled completion remain correct.

### SERVICE-07 — Story overnight forge

Story Mode submits an overnight order, app closes, and the cartridge's declared time policy is applied on resume.

The order completes or remains pending deterministically according to real-elapsed/play-time policy.

### SERVICE-08 — Cancellation and refund

Cancelling a queued/in-progress order applies the configured cancellation/escrow/refund policy once and cannot be exploited for material duplication.

### SERVICE-09 — Queue abuse limits

A character/account attempts to monopolize the smithy with excessive queued orders.

Configured max-outstanding/admission policy is enforced transactionally.

### SERVICE-10 — Cross-authority input escrow

A realm-wide service reserves scarce capacity while a required item is still owned by another authority domain.

Crashes/retries are injected before and after reservation, custody transfer, acknowledgement, and ServiceJob activation.

Recovery yields exactly one of: the requester still owns the item with no active consuming job, or the service owns/proves custody with one valid job. The item is never duplicated, lost, or spendable under both authorities, and stale provisional capacity is eventually released/reconciled.

### MIXED-01 — Personal quest + shared bottleneck + phased NPC

One quest simultaneously uses:

- player-scoped progress;
- shared service using the smithy fixture;
- player-beneficiary ServiceJob;
- player-phased quest apparition;
- shared town geometry.

All scopes remain independent and correct.

### MIXED-02 — Promote Story smithy to Realm

A portable Story cartridge with local overnight smithing is promoted.

Promotion explicitly chooses whether Realm deployment uses personal capacity, an instanced service, or a genuinely shared service queue and runs the matching certification gates.
