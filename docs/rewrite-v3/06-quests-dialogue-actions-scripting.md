# 06 — Quests, Dialogue, Actions, and Scripting

## 1. Quest Runtime

Quest correctness is a primary v3 requirement.

The high-level lifecycle remains deliberately small:

```text
available
  -> accepted
  -> in_progress
  -> objectives_complete
  -> turned_in

branches:
  in_progress -> failed
  in_progress -> abandoned
  failed/abandoned -> accepted   # only if definition allows retry
```

A state-machine validator guards lifecycle transitions.

The terminal successful state SHOULD be modeled as `resolved` with a named outcome rather than assuming every quest literally ends by “turning in” to an NPC. A turn-in interaction is one completion policy.

Complexity belongs in objective graphs/outcomes, not dozens of lifecycle states.

## 2. Quest definition

Example:

```yaml
kind: quest
key: missing_child
scope: player
giver: npcs/old_ferryman
turn_in: npcs/old_ferryman

prerequisites:
  all:
    - quest_completed: village_arrival

objectives:
  all:
    - id: learn_name
      event:
        type: dialogue_node_reached
        target: npcs/child_mother
        node: tells_name

    - id: find_tracks
      event:
        type: discovered
        target: clues/river_tracks

    - any:
        - id: rescue
          event:
            type: npc_escorted
            target: npcs/missing_child
        - id: discover_fate
          event:
            type: discovered
            target: clues/child_fate

activation:
  mode: offered

resolution:
  mode: turn_in

outcomes:
  ...
```

### Activation modes

Quest availability SHOULD normally be derived from prerequisites/facts rather than creating persistent QuestInstances for every locked quest.

Supported activation patterns should include:

- `offered` — player explicitly accepts from an NPC/object/action;
- `automatic` — becomes active when prerequisites/world condition becomes true;
- `discovered` — activates when the player discovers a place/clue/event;
- `hidden` — tracks internally without exposing normal journal UI until revealed.

### Resolution modes

Supported completion patterns should include:

- `turn_in` — objectives complete, then a valid turn-in action resolves the quest;
- `automatic` — resolving objective/outcome resolves immediately;
- `choice` — a final dialogue/action choice selects outcome and resolves.

The resolved outcome ID is durable quest state.

A quest giver and turn-in target are therefore optional content roles, not hard engine requirements.

## 3. Objective operators

Quest grammar SHOULD support:

- event match;
- all;
- any;
- sequence;
- count;
- optional;
- within/time window;
- condition-gated activation;
- branch;
- repeatable counter;
- explicit failure condition.

Each operator has a pure reducer and schema.

### Objective credit/causation policy

In multiplayer, matching the event is not enough. Each objective type MUST define who is eligible to receive credit.

Common policies:

- `actor` — only the event actor;
- `party` — eligible members of the actor's party;
- `participants` — entities recorded as participants/contributors;
- `witness` — scoped characters who actually witnessed/observed the event according to world rules;
- `scope_any` — any eligible quest instance in the declared instance/realm scope.

Policies may add constraints such as:

- same instance/zone;
- within distance;
- contribution threshold;
- alive/present;
- event happened after quest activation.

Credit is deterministic data derived from event/state, not a transport/UI guess.

Story Mode normally collapses to actor/player semantics, but uses the same contract.

Do not add arbitrary scripting for common quest logic.

## 4. Quest instance

```elixir
%QuestInstance{
  id: ...,
  definition_ref: ...,
  scope: {:player, character_id},
  lifecycle: :in_progress,
  resolved_outcome: nil,
  objectives: typed_state,
  variables: %{},
  revision: 8,
  processed_event_ids: bounded/idempotency structure,
  accepted_at: logical_time
}
```

Definition version is pinned.

## 5. Quest event processing

Quest Runtime consumes canonical DomainEvents only.

Movement code does not call “increment quest.”

Dialogue does not call “complete objective.”

Scripts do not directly edit quest JSON.

```text
world DomainEvent
   ↓
matching active quest instances by scope/subscription
   ↓
QuestReducer.reduce()
   ↓
Quest StateDelta
   + quest DomainEvents
   + typed outcome-consequence requests
   ↓
capability consequence evaluators
   ↓
combined world StateDelta / DomainEvents / Effects
   ↓
one authority commit
```

The quest engine never receives generic write access to entity/component storage.

## 6. Exactly-once rewards

Quest completion produces reward state/effects with stable idempotency keys:

```text
quest_instance_id + completion_revision + reward_key
```

Retry/restart cannot grant twice.

## 7. Quest subscriptions/indexing

Do not evaluate every active quest against every event if scale grows.

At acceptance/compile/load time build indexes by event type and target where possible.

Example:

```text
{:death, "goblin"} -> [quest instance ids]
:dialogue_node_reached -> [...]
```

Private cartridges may begin simpler but API should allow indexing.

## 8. Quest invariants

Certification MUST check:

- references exist;
- prerequisite graph acyclic unless explicit repeat loop;
- completion can be reached;
- required turn-in entity can be reachable under expected branches;
- objective IDs unique;
- no reward without valid terminal transition;
- no objective completes from unrelated target/topic;
- duplicate event is idempotent;
- version migration explicit;
- state scope intentional.

## 9. Quest/world contract

A quest is not a private world-mutation engine.

It has three responsibilities:

1. **observe** typed world DomainEvents and current scoped facts/state;
2. **remember** quest-specific objective/lifecycle/branch state;
3. **declare outcomes/consequences** through registered capability operations.

The world remains responsible for applying its own semantics.

This creates a feedback loop:

```text
WORLD
 movement / NPC schedules / combat / weather / dialogue / economy
       ↓ DomainEvents
QUEST
 objectives / branches / outcome
       ↓ typed consequences
WORLD STATE
 facts / entity states / topology / relationships / spawned actors
       ↓ reactive rules + changed policies
WORLD
 new dialogue / new routes / changed schedules / rumors / ambience
       ↓
future DomainEvents
```

A quest can therefore cause meaningful world change without bypassing world invariants.

## 10. Quest outcomes and typed consequences

Quest definitions SHOULD name explicit outcomes rather than encode all consequences in arbitrary scripts.

Example:

```yaml
outcomes:
  rescued:
    when:
      branch_completed: rescue

    consequences:
      - fact.set:
          key: village.child_status
          value: rescued
          scope: instance

      - connection.set_state:
          target: exits/shrine_road
          state: open
          scope: instance

      - relationship.adjust:
          npc: npcs/old_ferryman
          subject: quest_actor
          trust: 10
          scope: player

      - event.emit:
          type: village/child_returned
          scope: instance
```

Each consequence operator is registered by a capability and declares:

- valid target types;
- input schema;
- allowed scopes;
- portability;
- whether it produces StateDelta, DomainEvents, Effects, or a bounded combination;
- idempotency semantics;
- conflict/composition behavior;
- certification rules.

A consequence may not write arbitrary component fields.

### Same-authority consequences

When quest state and affected world state share one authority owner, quest completion and its StateDelta-producing consequences SHOULD commit atomically in the same decision.

Example in Story Mode:

```text
quest outcome = rescued
+ village.child_status = rescued
+ shrine road = open
+ mother role state = relieved
--------------------------------
one local SQLite commit
```

### Cross-authority Realm consequences

A quest running in one ZoneShard may need to affect another authority such as:

- realm economy;
- guild state;
- another shard;
- global event service.

Those cannot pretend to be one database transaction.

The local quest/outcome commits first with a durable, idempotent cross-authority Effect/outbox record. The receiving authority applies its own command/protocol and reconciliation rules.

Certification must test failure/retry at that boundary.

## 11. Prefer facts for broad narrative consequences

If many independent systems need to know the same durable story truth, prefer a typed scoped Fact instead of directly editing each subsystem.

Example:

```text
village.child_status = rescued
```

may drive:

- mother's dialogue;
- mother's daily schedule;
- ferryman ambient lines;
- guard disposition;
- town description variants;
- rumor availability;
- shop inventory;
- follow-up quest prerequisites;
- festival attendance;
- access to the northern road.

This is more coherent than a quest directly issuing eight unrelated edits.

Use direct consequence operators when the mechanical change is inherently local:

- open this gate;
- move this NPC;
- grant this item;
- spawn this encounter;
- reveal this map location.

The rule of thumb:

> **Facts express truths. Consequences express actions. Reactive world rules express how the world responds to truths/actions.**

## 12. Opening and changing areas

Quest-gated exploration SHOULD normally use precompiled topology/content plus runtime access/activation state.

Preferred patterns:

### Access policy

The exit/portal already exists but is inaccessible until a condition becomes true:

```yaml
connection:
  to: rooms/mountain_pass
  when:
    fact_equals:
      key: village.pass_open
      value: true
```

Useful for personal/player-scoped unlocks.

### Stateful connection

A gate/bridge/door has runtime state:

```text
collapsed → repairing → open
```

The corresponding capability controls whether movement/action is available.

Useful when the world itself physically changes.

### Content activation

A precompiled encounter/location group is inactive until a typed capability activates it.

Useful for:

- cave-in reveals;
- temporary festival spaces;
- invasion camps;
- post-quest settlements.

Do not make ordinary quest progression dynamically generate arbitrary new definitions at runtime.

### Map discovery

A location can exist physically while the player's map/journal does not reveal it until discovery.

Map visibility and physical accessibility are separate concerns.

### Multiplayer scope

In Realm Mode, “unlock this area for me” normally uses player/party policy or instancing/phasing.

A player-scoped quest MUST NOT silently open a realm-shared gate for everyone.

A true realm-wide unlock requires explicit realm scope and shared-area certification.

## 13. NPC state, schedules, relationships, and memory

Quest consequences should change **runtime state/profile**, not replace NPC definitions.

Useful capability patterns:

### NPC role/state machine

```text
mother:
  searching → grieving
  searching → relieved
  relieved  → rebuilding_life
```

Transitions can be triggered by facts/events and validated by a state machine.

### Behavior/schedule profiles

An NPC definition can provide profiles:

```yaml
schedule:
  profiles:
    searching:
      ...
    normal:
      ...
    mourning:
      ...
```

The active profile may derive from world facts instead of requiring the quest to manually rewrite schedule entries.

### Player-specific relationship state

Shared NPC:

```text
relationship(player, ferryman).trust += 10
```

does not alter the ferryman's global personality toward every Realm player.

Dialogue/action availability can query that scoped relationship.

### NPC memory

Important narrative interactions may create typed personal memories:

```text
memory:
  key: player_returned_child
  subject: player_id
  value: true
```

A memory should have bounded schema/meaning, not become unlimited free-form model-generated history.

## 14. Reactive world rules

World systems may register deterministic reactions to DomainEvents/fact changes.

Example:

```yaml
react:
  on:
    fact_changed:
      key: village.child_status

  when:
    fact_equals:
      key: village.child_status
      value: rescued

  apply:
    - behavior.select_profile:
        target: npcs/child_mother
        behavior: schedule
        profile: normal

    - ambient.enable:
        group: child_returned_lines
```

At runtime these compile into registered capability evaluators inside the same bounded event/decision model.

Rules:

- no polling every frame just to discover a fact changed;
- reactions produce typed StateDelta/DomainEvents/Effects;
- event chains remain bounded and deterministic;
- cycles are detected/budgeted;
- all referenced facts/capabilities/targets are compile-validated.

Whenever possible, prefer **derived behavior** over mutation. For example, a room description may select its variant directly from facts/time/weather with no stored “current description” field.

## 15. Consequence scope and escalation

Quest scope and consequence scope are related but NOT automatically identical.

A player-scoped quest may safely produce:

- player-scoped facts;
- personal relationships;
- personal map discovery;
- personal ActionSet/access changes.

It may also affect instance/party/realm state only when the consequence explicitly declares that broader scope and the target profile permits it.

Compiler/certification MUST flag scope escalation such as:

```text
player-scoped quest
   ↓
realm-scoped gate unlock
```

unless explicitly authored and certified.

No consequence operator defaults to realm/global scope because scope was omitted.

## 16. Branches should leave durable world consequences

Meaningful quest branches SHOULD differ in more than reward text.

Possible consequences include:

- alternate NPC role states;
- different faction reputation;
- different schedules;
- destroyed/repaired locations;
- permanent access differences;
- prices/services available;
- ambient descriptions;
- rumors;
- follow-up quests;
- companion availability;
- weather/world-event triggers;
- campaign continuity memories.

The Cartridge Lab should be able to fork before the branch and compare resulting world states/simulations.

A branch does not need to change everything. The requirement is that intended consequences are represented as typed world state rather than hidden in prose only.

## 17. Dialogue definition

Dialogue is a graph of nodes with typed conditions/actions.

```yaml
kind: dialogue
key: ferryman

entry: greeting

nodes:
  greeting:
    text: dialogue.ferryman.greeting
    choices:
      - id: ask_missing_child
        text: dialogue.ferryman.ask_child
        when:
          quest_state:
            quest: quests/missing_child
            state: available
        next: missing_child_offer
```

Dialogue selection emits canonical DomainEvents such as `dialogue_node_reached`.

## 18. Dialogue state

Session may track which dialogue UI is open, but authoritative dialogue/quest state that matters after reconnect belongs to world/player state as defined by the feature.

Do not make socket assigns the only location of consequential branch state.

## 19. ActionSet algebra

Adopt a formal composition model inspired by mature MUD command-set systems and Lokacore's existing Action Resolver.

Sources produce action contributions:

```text
entity base
equipment
status effects
skills
quest grants
room policy
world state
scripts
transformation/modal state
```

Operations:

- `union`
- `subtract`
- `intersect`
- `replace`
- `override`

Stable action key is identity.

After composition, evaluate policies/conditions and sort by priority/presentation group.

## 20. Action definition

```yaml
key: talk
label: actions.talk
target: npc
command: talk
priority: 100
policy:
  all:
    - target_present: true
```

Actions may require additional input schema.

The same action supports touch and terminal adapters.

## 21. Policies/conditions

Policy AST is typed and fail-closed.

Core operators:

```text
all
any
not
permission
owner/self
tag
has_item
flag
stat_compare
resource_compare
quest_state
faction_compare
time_window
target_present
scope_matches
```

A policy evaluator is pure.

Policy definitions may be reused by exits, actions, dialogue choices, builder operations, and publication rules where semantics match.

## 22. Text command parser

Text parsing is not game logic.

Flow:

```text
raw text
 -> tokenize/parse
 -> identify action alias
 -> Search resolve target(s)
 -> build typed command
 -> runtime
```

Parser should support classic MUD conveniences:

- aliases;
- abbreviations where unambiguous;
- ordinal/multi-match selection;
- inventory/current-room search;
- quoting names;
- helpful ambiguity errors.

## 23. Scripting goals

We want a powerful AI-friendly escape hatch without reintroducing unrestricted runtime code.

V3 SHOULD define **LokaScript**, an Elixir-looking restricted language whose released form is portable across offline mobile and online BEAM hosting.

Key idea:

> Parse Elixir-like syntax during authoring into a portable normalized AST/bytecode, then interpret that representation inside the shared deterministic kernel. Do not execute cartridge source with `Code.eval_string`.

This keeps syntax familiar to Elixir-capable models while creating a real semantic boundary.

## 24. LokaScript allowed model

Potential allowed forms:

- literals;
- maps/lists/tuples;
- boolean operators;
- comparisons;
- `if` / `case` over bounded values;
- bounded `for`/collection transforms only if interpreter budgets them;
- calls to registered script bindings;
- local immutable variable binding.

Forbidden:

- module calls;
- `apply`;
- process operations;
- receive/send/spawn;
- filesystem/network;
- code loading;
- macros;
- module definitions;
- anonymous recursion;
- arbitrary Erlang BIF access;
- wall clock/global randomness.

## 25. Portable script binding registry

Bindings are capabilities:

```text
query.entity
query.flag
query.quest
query.time
query.weather
emit.say
emit.message
effect.set_flag
effect.spawn
effect.move
effect.damage
effect.heal
effect.schedule
event.emit
rng.chance
rng.pick
```

Each binding has input/result schema, cost, and portability classification. Offline cartridges may call portable bindings only.

Mutation-like bindings return typed effects/events; they do not write DB directly.

## 26. Script budgets

Each execution has:

- max AST steps;
- max wall execution budget as outer safety;
- max queries;
- max emitted events/effects;
- max spawn count;
- max scheduled jobs;
- max result size;
- max collection size.

Budget exceed is a typed script error and trace.

## 27. Deterministic scripts

Scripts receive:

- logical time;
- explicit RNG;
- immutable view/query context.

Given the same compiled script, state/event, logical time, and RNG state they MUST produce the same canonical result on mobile and server hosts.

No hidden wall-clock access.

## 28. Trusted compiled Elixir extensions

Engine developers MAY implement new capabilities as normal compiled Elixir modules.

That is different from cartridge scripting and normally requires engine release/version change.

Repeated LokaScript patterns SHOULD be candidates for promotion into compiled capabilities.

## 29. Script lifecycle

```text
source
 -> parse to AST
 -> schema/binding validation
 -> static budget/forbidden-form validation
 -> compile to normalized interpreted form
 -> cartridge hash
 -> Lab execution
 -> semantic review
 -> release
```

Runtime never executes unvalidated raw source.

## 30. Cartridge custom domain events

Cartridges may declare namespaced custom DomainEvents for loosely coupled world behavior:

```text
fox_spirit/bell_rung
village/guard_alerted
festival/started
ferry/arrived
```

These are ordinary typed DomainEvents, not a separate signal bus.

Rules:

- event keys/schemas are registered by the cartridge/capability compiler;
- unknown events fail validation where statically knowable;
- event emission uses the same bounded event chain, causation/correlation, and deterministic ordering as engine events;
- scripts use `event.emit` and receive no direct PubSub/database escape hatch.

## 31. State machine use outside quests

Small state machines remain useful for:

- combat phase;
- doors;
- NPC high-level modes;
- crafting jobs;
- sessions;
- cartridge lifecycle.

Use them when states/transitions are explicit.

Do not force every behavior into a state machine when a pure function/derived state is simpler.
