# 04 — Commands, Domain Events, Effects, and Client Protocol

## 1. Four concepts, four responsibilities

Loka v3 MUST distinguish:

### Command

An authenticated request to change/inspect authoritative game state.

Examples:

- move north;
- take item;
- choose dialogue option;
- attack NPC;
- buy item;
- accept quest.

### Domain Event

A fact produced by a successful game decision.

Examples:

- entity_entered_room;
- item_acquired;
- npc_killed;
- dialogue_node_reached;
- quest_objective_completed.

Events explain what happened and drive other deterministic rules.

### Effect

An instruction produced by a decision that must be applied/executed.

Examples:

- schedule durable job;
- emit client notification;
- enqueue external push;
- transfer entity to another shard.

Pure in-instance state changes should usually already be reflected in the new state; effects are not a second backdoor to mutate arbitrary state.

### Client Message

A transport-facing projection.

Examples:

- room_snapshot;
- entity_actions_changed;
- dialogue_view;
- combat_update;
- quest_update;
- toast/narrative line.

Client messages are not domain events.

## 2. Host-neutral command semantics

The same logical command types drive offline and online play. Online they arrive through the external protocol; offline the React Native/local authority constructs the same canonical command payload locally.

### External online command envelope

```json
{
  "protocol_version": 1,
  "command_id": "uuid",
  "client_seq": 184,
  "instance_id": "uuid",
  "character_id": "uuid",
  "type": "move",
  "payload": {
    "direction": "north"
  },
  "expected_revision": 9201
}
```

The gateway supplies authenticated account/session identity; the client cannot claim arbitrary actor authority.

`expected_revision` MAY be omitted for commutative/read-like operations but SHOULD be used for state-sensitive interactions where stale UI matters.

## 3. Canonical command representation

After online protocol validation—or local offline input adaptation—the authority host constructs:

```elixir
%Command{
  id: uuid,
  type: :move,
  actor: character_id,
  instance_id: instance_id,
  session_id: session_id,
  payload: %Move{direction: :north},
  expected_revision: 9201,
  received_at_monotonic: ...
}
```

All payload variants are typed structs.

Unknown command types fail before reaching game rules.

## 4. Decision environment

The host-neutral decision layer / portable kernel receives explicit environment:

```elixir
%DecisionEnv{
  definition_registry: ...,
  logical_time: ...,
  rng: rng_state,
  capabilities: ...,
  policy_context: ...
}
```

They do not read wall clock/network/database.

## 5. Decision result

```elixir
{:ok,
 %Decision{
   new_state: state,
   rng: new_rng,
   domain_events: events,
   effects: effects,
   client_projection_hints: hints
 }}
```

or:

```elixir
{:reject, %GameError{code: :exit_locked, data: %{...}}}
```

Expected gameplay failure is data, not exception control flow.

## 6. Game error taxonomy

Every rejection has stable machine code:

```text
not_found
not_present
not_owned
permission_denied
invalid_target
invalid_state
stale_revision
insufficient_resource
exit_locked
quest_requirement
cooldown
rate_limited
unsupported_capability
...
```

Human text is localized/rendered separately.

Agents and mobile clients should never need to parse an English error string to decide what happened.

## 7. Domain event envelope

```elixir
%DomainEvent{
  id: uuid,
  type: :item_acquired,
  instance_id: ...,
  scope: {:player, character_id},
  actor_id: ...,
  subject_id: item_id,
  logical_time: ...,
  causation_id: command_id,
  correlation_id: correlation_id,
  payload: %ItemAcquired{...}
}
```

Event types and payloads are registered/machine-readable.

Events SHOULD be immutable values.

## 8. Event processing model

Within one command, deterministic event reactions may form a bounded chain:

```text
take item
  -> item_acquired
     -> quest reducer advances objective
        -> quest_objective_completed
           -> quest_completed
```

This chain runs as part of the same decision/commit where possible.

The runtime MUST impose:

- maximum event-chain depth;
- maximum generated event count;
- cycle detection where applicable;
- deterministic ordering.

This prevents script/rule loops.

## 9. Effect types

Effects are registered and typed.

Categories:

### Synchronous commit effects

Represented inside state transaction, not external dispatcher.

### Durable asynchronous effects

Use outbox.

### Ephemeral notifications

May be emitted after commit and dropped/reconstructed if necessary.

Every effect declares:

- durability;
- idempotency requirement;
- retry policy;
- allowed origin capabilities;
- schema.

## 10. Causation and correlation

All command-derived events/effects/messages share a correlation ID.

```text
command c1
  event e1 caused_by c1
    event e2 caused_by e1
      effect f1 caused_by e2
      client msg m1 caused_by e2
```

The trace viewer must reconstruct this graph.

## 11. Protocol source of truth for online transport

External protocol definitions MUST live in a language-neutral machine-readable schema source under `protocol/`.

Potential format: JSON Schema plus a small manifest.

Generate/check:

- TypeScript types;
- Elixir validation/struct mappings;
- protocol docs;
- compatibility tests;
- sample fixtures.

No hand-maintained duplicate `Room` interfaces.

## 12. Version negotiation

Client join request includes:

```json
{
  "protocol_version": 3,
  "client_version": "1.7.0",
  "client_features": [
    "dialogue_choices_v1",
    "minimap_v1"
  ]
}
```

Server responds with:

- accepted protocol version;
- required minimum app version;
- enabled feature set;
- instance/cartridge client requirements.

If incompatible, return a typed upgrade error before joining game state.

## 13. Client projection

The client SHOULD receive view models, not internal DB/entity structs.

Example room view:

```json
{
  "room": {
    "id": "uuid",
    "key": "ferry_dock",
    "title": "Old Ferry Dock",
    "description": "...",
    "exits": [
      {"direction": "north", "available": true}
    ],
    "entities": [
      {
        "id": "uuid",
        "name": "Old Ferryman",
        "kind": "npc",
        "actions": [
          {"key": "talk", "label": "Speak"},
          {"key": "inspect", "label": "Inspect"}
        ]
      }
    ]
  },
  "instance_revision": 9202
}
```

Internal component state is not dumped wholesale to mobile.

## 14. Portable game-view projection

Game-semantic view construction that must match offline and online SHOULD be defined once over portable committed state and cartridge definitions.

Examples:

- resolved ActionSet for an entity;
- visible room contents;
- quest journal state;
- dialogue choices currently available;
- shop/container semantic contents;
- map-discovery state;
- localized string IDs plus interpolation data.

The portable projector returns a host-neutral **GameView** / projection model.

Online:

```text
portable GameView
  -> Elixir protocol adapter
  -> Phoenix client message
```

Offline:

```text
portable GameView
  -> native/mobile binding
  -> React Native projection store
```

React Native owns presentation, animation, layout, accessibility, and localization rendering. It MUST NOT reimplement policy/action/quest visibility rules.

Host-only views—account catalog, entitlement, social realm presence, admin—remain outside the portable projector.

This avoids a second semantic fork where the server and offline client disagree about what the player can see/do.

## 16. Snapshot and delta model

On join/resync, server sends authoritative snapshot.

Subsequent messages may be deltas tagged with instance revision.

If the client detects a gap or server requests resync, it discards/reconciles local view state from a fresh snapshot.

The client store is a cache of server projection, not authority.

## 15. Text commands

Text parser is an adapter:

```text
"give jade amulet ferryman"
   ↓ parse
ActionIntent(:give, item query, target query)
   ↓ canonical Search service resolves IDs
Command(:give_item, ...)
```

Touch UI sends IDs directly but reaches the same command.

## 17. Search/target resolution

One canonical Search service supports:

- current room;
- inventory;
- equipment;
- nearby/zone scope where explicitly allowed;
- aliases;
- keywords;
- display names;
- ordinal disambiguation;
- exact IDs for tools/admin.

Ambiguous search returns structured candidates.

No transport-specific duplicated keyword lookup helpers.

## 18. Action availability

The server exposes resolved ActionSets so the touch UI does not reinvent conditions.

Action definitions include:

```text
key
label key/localization
target kind
priority
input schema
policy/conditions
cooldown/resource hints
accessibility description
```

The same metadata can feed terminal help.

## 19. Protocol tests

CI MUST include fixtures asserting both Elixir and TypeScript agree on:

- every command;
- every server message;
- error shape;
- version negotiation;
- representative snapshots.

Breaking protocol changes require version bump and compatibility policy.


## 20. Offline command conformance

The portable kernel command schema is also machine-readable. The online Elixir host and offline native/mobile host MUST serialize equivalent commands into the same kernel representation.

Golden conformance fixtures cover command -> decision/event/effect output independent of network transport. Online protocol code wraps these semantics; it does not redefine them.
