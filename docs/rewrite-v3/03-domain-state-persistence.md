# 03 — Domain State and Persistence

## 1. Core state model

Loka v3 separates four concepts that Lokacore often blurred:

1. **Definition** — immutable content from a specific cartridge release.
2. **Runtime entity** — mutable world instance created from a definition.
3. **Scoped state** — state owned by player/party/instance/realm rather than a physical entity.
4. **Durable platform state** — accounts, entitlements, release catalog, audit/certification metadata.

These MUST have distinct identities and storage semantics.

## 2. Definition identity

A definition reference is globally stable:

```elixir
%DefinitionRef{
  cartridge_id: "fox_spirit_of_yunmeng",
  cartridge_version: "1.2.0",
  kind: :npc,
  key: "old_ferryman"
}
```

A human-readable canonical form MAY be:

```text
fox_spirit_of_yunmeng@1.2.0:npc/old_ferryman
```

Local content may reference `npc/old_ferryman`; the compiler qualifies it.

Definition references are immutable. Updating source creates a new cartridge release/hash.

## 3. Runtime entity identity

Runtime entities use UUIDs:

```elixir
%RuntimeEntity{
  id: uuid,
  instance_id: world_instance_uuid,
  definition: DefinitionRef.t(),
  kind: :npc,
  location_id: room_uuid,
  state: %{...typed component state...},
  tags: [...],
  revision: 17
}
```

Two goblins from the same definition share a definition ref but have different runtime IDs/state.

The runtime entity MUST NOT also act as the canonical definition record.

## 4. Component state

Components are typed and registered.

A component contract includes:

```elixir
%ComponentSpec{
  key: "health",
  version: 1,
  applies_to: [:character, :npc],
  definition_schema: ...,
  runtime_schema: ...,
  merge_policy: :replace,
  migration_hooks: ...
}
```

Unknown component keys fail cartridge compilation.

Runtime component values SHOULD be represented by structs internally after loading/validation, not arbitrary nested maps everywhere.

Content-originated keys MUST NOT create atoms dynamically.

## 5. Persistent vs ephemeral state

Every state field must answer: does it survive process restart?

### Durable

Examples:

- character inventory;
- quest progress;
- currency;
- world door state if intended persistent;
- instance variables;
- spawned/despawned persistent entities;
- durable scheduled jobs;
- RNG state if exact replay/recovery requires it.

### Ephemeral

Examples:

- socket ref;
- temporary UI menu state;
- cached search results;
- ambient-emote timer refs;
- derived pathfinding caches;
- transient combat animation timing.

Ephemeral state may be reconstructed after restart.

## 6. State scopes

State scope is a first-class type:

```elixir
@type scope ::
  {:player, character_id}
  | {:party, party_id}
  | {:instance, instance_id}
  | {:realm, realm_id}
```

Quest instances, flags, reputation tracks, world events, and similar state MUST declare a scope.

No helper may default to realm/global scope merely because an ID was omitted.

## 7. PostgreSQL working decision

The v3 rebuild SHOULD use PostgreSQL from the beginning in all realistic environments.

Reasons:

- eventual concurrent shared-world writes;
- robust transactional semantics;
- row/constraint/index tooling;
- operational backup/replication maturity;
- fewer production-only surprises than switching from SQLite later;
- Ecto support is excellent.

Tests MAY use sandboxed PostgreSQL. Development SHOULD use PostgreSQL too, preferably via a simple container/dev setup, so database behavior does not drift.

## 8. Proposed durable schema families

Exact migrations are implementation work, but the logical model should include:

### Platform

```text
accounts
characters
entitlements
catalog_entries
cartridge_releases
cartridge_certificates
```

### Runtime

```text
world_instances
runtime_entities
quest_instances
scheduled_jobs
command_receipts
effect_outbox
event_traces
state_snapshots
```

### Authoring

```text
builder_workspaces
workspace_revisions
build_artifacts
certification_runs
```

First-party source may primarily live in Git; authoring tables can reference Git/workspace revisions rather than replacing version control.

## 9. World instance row

Logical fields:

```text
id UUID
release_id
mode private|party|shared
realm_id nullable
status creating|running|paused|completed|failed|archived
revision bigint
logical_time
rng_algorithm
rng_state
snapshot_version
created_at
updated_at
```

The instance revision increments with committed authoritative commands/batches.

## 10. Runtime entity rows

Logical fields:

```text
id UUID
instance_id UUID
definition_namespace
definition_version
definition_kind
definition_key
kind
location_id nullable
state JSONB
tags/search columns as needed
revision bigint
created_at
updated_at
```

JSONB is acceptable for typed component state if schemas/migrations validate it. Frequently queried/indexed fields may be promoted to columns deliberately.

Do not create an EAV table for every component field by default.

## 11. Quest instance rows

Keep quest runtime separate enough to query, migrate, and certify:

```text
id UUID
instance_id
scope_type
scope_id
quest_definition_ref
lifecycle_state
objective_state JSONB
variables JSONB
accepted_logical_time
revision
completed_at nullable
```

A unique constraint should prevent duplicate active quest instances where the quest's repeatability rules disallow them.

## 12. Command receipts

Every client/agent command carries a stable command ID.

```text
instance_id
command_id
actor_id
accepted_revision
result_code
result_digest
created_at
```

Unique key: `(instance_id, command_id)`.

If the same command is retried, runtime returns the prior result/ack rather than executing again.

## 13. Transactional command commit

For a command changing durable state:

```text
BEGIN
  verify command_id not processed
  verify expected instance revision if supplied
  update affected runtime entities / quest instances
  update world instance revision + RNG/logical state
  insert command receipt
  insert event trace records required for diagnostics
  insert durable effect_outbox entries
COMMIT
```

Only after commit does the in-memory owner adopt the committed state revision.

If commit fails, no authoritative in-memory advancement is allowed.

## 14. Effect outbox

External/delayed effects that cannot safely occur inside the DB transaction use an outbox.

Examples:

- push notification;
- analytics export;
- email;
- entitlement webhook reconciliation;
- cross-shard handoff message;
- asset/catalog publication side effect.

Gameplay state that can be represented atomically inside the same instance SHOULD be part of the decision/transaction, not unnecessarily asynchronous.

Outbox rows have:

```text
effect_id
idempotency_key
kind
payload
status pending|running|done|failed
attempt_count
next_attempt_at
causation_id
```

## 15. Event trace is not full event sourcing

The current durable state remains authoritative.

Event traces exist to support:

- debugging;
- correlation;
- deterministic repro;
- audits;
- semantic review;
- certification evidence.

The system MUST NOT require replaying the entire history from genesis to boot a world.

Periodic snapshots plus current state are sufficient.

## 16. Snapshots

A snapshot captures enough state to recreate an instance deterministically:

```text
instance revision
cartridge release/hash
logical clock
RNG state
runtime entities
quest/scoped state
durable scheduler state reference
```

Snapshots are useful for:

- Lab rewind;
- bug reproduction;
- save checkpoints;
- migrations;
- staging copies.

Snapshot format must be versioned.

## 17. Optimistic concurrency

World owners serialize normal commands, reducing contention.

Database revisions still protect against:

- duplicate owners after failover bugs;
- admin/manual writes;
- cross-shard coordination;
- stale maintenance jobs.

Updates SHOULD include expected revisions.

A revision conflict is an invariant signal, not something to silently overwrite.

## 18. Persistence adapters

`loka_core` defines ports/protocols such as:

```elixir
@callback commit(CommandCommit.t()) :: {:ok, CommitReceipt.t()} | {:error, term()}
@callback load_instance(id) :: {:ok, snapshot} | ...
```

`loka_store` implements them with Ecto.

The Cartridge Lab can provide an in-memory deterministic adapter where appropriate, while integration certification uses PostgreSQL too.

## 19. Migration rules

### Engine schema migration

Database migrations are normal application deploy concerns and must support rollback/forward procedures.

### Cartridge definition migration

An active world/quest is pinned to a cartridge release.

New release does NOT automatically reinterpret old saves.

Allowed strategies:

- continue on old release;
- explicit compatible migration function;
- complete/archive old instance;
- clone to new version via tested migration.

### Component migration

Each component version transition that changes persisted runtime state must register a deterministic migration.

No “read old shape and guess.”

## 20. Deletion semantics

Deleting content source never invalidates an already published immutable release.

Deleting a runtime entity must define containment semantics.

No generic `delete(entity)` may recursively delete contents unless the caller explicitly chooses a policy such as:

- cascade;
- move contents to parent/location;
- orphan prohibited;
- archive.

This prevents surprising inventory/world loss.

## 21. Inventory/location invariant

An item has one authoritative containment/location relation.

Do not separately store:

- item.location_id = player
- AND player.inventory = [item]
as two independent truths.

Choose one canonical relationship and derive/cache the other.

Recommended direction:

```text
RuntimeEntity.container_id
```

Rooms, characters, chests can all be containers.

Inventory is a query/index over contained item IDs.

Equipment adds an equipment-slot relation/assignment but does not duplicate ownership.

## 22. Definition cache

Compiled cartridge definitions are immutable and may be aggressively cached in ETS/`:persistent_term` or application memory.

Because they are content-hash/version keyed, invalidation is simple.

Runtime mutable state must not use the same cache semantics.
