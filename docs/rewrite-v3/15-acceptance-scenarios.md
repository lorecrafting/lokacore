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

Run the same fixture through:

- direct kernel;
- BEAM/Rustler adapter;
- iOS binding;
- Android binding.

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

### QST-01 — Accept

Available quest becomes accepted/in-progress through legal transition.

### QST-02 — Double accept

Retry does not create duplicate QuestInstance.

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

Script signals itself recursively.

Event-chain depth/cycle controls terminate with diagnostic.

### SCR-08 — RNG script

Same RNG state gives same script branch offline/online.

### SCR-09 — Server-only binding in offline cartridge

Compilation fails portability gate.

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

## K. Mobile protocol

### PROTO-01 — Generated parity

Elixir and TypeScript fixtures decode same message schema.

### PROTO-02 — Old client

Unsupported protocol version rejected with typed upgrade response.

### PROTO-03 — Revision gap

Client misses delta.

Detects gap and resyncs snapshot.

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

Injected split-brain/stale owner attempts write with stale revision.

DB revision/ownership guard rejects.

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

## U. Receipt and platform boundaries

### RECEIPT-01 — Retry returns stable committed response

Online state-changing command commits, client times out before receiving reply, then retries same command ID.

Runtime does not execute again and returns the original stable committed result/ack (or a reconstruction explicitly equivalent under the protocol), not merely “already processed.”

### RECEIPT-02 — Receipt/result corruption

Receipt claims processed command but durable response reference is missing/corrupt.

Runtime raises an integrity fault/resync path rather than re-executing mutation.

### PLATFORM-01 — Web adapter cannot grant entitlement directly

Attempt to mutate entitlement from Phoenix controller/channel without going through `loka_platform` application service/policy.

Architecture test fails.

### PLATFORM-02 — Entitlement service unavailable

Offline already-downloaded cartridge remains playable.

New purchase/restore may fail gracefully, while world simulation and unrelated online game instances remain isolated from the platform-service failure according to deployment topology.


## V. Client and builder target separation

### CLIENT-01 — Stories has no online world dependency

With all Loka online services unavailable, an installed offline-capable Stories cartridge launches, plays, saves, and resumes.

### CLIENT-02 — Online has no local authority fallback

Loka Online loses server connectivity during authoritative play.

It does not silently continue mutating a local authoritative world; it reconnects/resyncs or presents offline status according to policy.

### CLIENT-03 — Shared GameView parity

Equivalent portable story state rendered through Stories and through an Online private instance yields semantically equivalent GameView action/quest/dialogue visibility.

Presentation styling may differ.

### CLIENT-04 — Online app does not require embedded portable kernel

A normal shared-realm Loka Online client build operates entirely from typed server projections/commands; no client-side simulation kernel is used as authority.

### CLIENT-05 — Stories app excludes realm-only surface

Stories production binary/workspace has no requirement for guild chat, shard handoff, shared realm economy, or other realm-only authority to play ordinary cartridges.

### BUILDTARGET-01 — Story rejects server-only capability

A `story` workspace attempts to add `guild_market@1` or another server-only capability.

Compilation fails with a portability/target diagnostic.

### BUILDTARGET-02 — Realm permits server-only capability

A `realm` workspace may use a registered server-only capability and receives the corresponding multiplayer certification obligations.

### BUILDTARGET-03 — Realm state scope must be explicit

A realm quest/door/world event omits required multiplayer state scope where ambiguity exists.

Validation fails rather than defaulting to global.

### BUILDTARGET-04 — Promotion preserves source artifact

A `promote` workspace adapts a certified Stories cartridge.

Original cartridge hash remains unchanged; promotion creates a new deployment/adaptation artifact and certificate.

### BUILDTARGET-05 — Promotion surfaces multiplayer questions

Promotion of a cartridge containing permanently killable quest giver, unique loot, and player-local door flags returns structured required decisions for respawn, contention, and scope before shared-area certification can pass.

### CLIENT-ENTITLEMENT-01 — Stories purchase does not self-authorize Online

Stories device reports local cartridge ownership but no verified online entitlement exists.

Loka Online does not grant competitive/persistent access solely from the local claim.
