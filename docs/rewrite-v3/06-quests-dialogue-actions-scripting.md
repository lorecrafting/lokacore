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

Complexity belongs in objective graphs, not dozens of lifecycle states.

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

outcomes:
  ...
```

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

Do not add arbitrary scripting for common quest logic.

## 4. Quest instance

```elixir
%QuestInstance{
  id: ...,
  definition_ref: ...,
  scope: {:player, character_id},
  lifecycle: :in_progress,
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
domain event
   ↓
matching active quest instances by scope/subscription
   ↓
QuestReducer.reduce()
   ↓
new quest state + quest domain events + typed effects
```

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

## 9. Dialogue definition

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

## 10. Dialogue state

Session may track which dialogue UI is open, but authoritative dialogue/quest state that matters after reconnect belongs to world/player state as defined by the feature.

Do not make socket assigns the only location of consequential branch state.

## 11. ActionSet algebra

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

## 12. Action definition

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

## 13. Policies/conditions

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

## 14. Text command parser

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

## 15. Scripting goals

We want a powerful AI-friendly escape hatch without reintroducing unrestricted runtime code.

V3 SHOULD define **LokaScript**, an Elixir-looking restricted language whose released form is portable across offline mobile and online BEAM hosting.

Key idea:

> Parse Elixir-like syntax during authoring into a portable normalized AST/bytecode, then interpret that representation inside the shared deterministic kernel. Do not execute cartridge source with `Code.eval_string`.

This keeps syntax familiar to Elixir-capable models while creating a real semantic boundary.

## 16. LokaScript allowed model

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

## 17. Portable script binding registry

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

## 18. Script budgets

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

## 19. Deterministic scripts

Scripts receive:

- logical time;
- explicit RNG;
- immutable view/query context.

Given the same compiled script, state/event, logical time, and RNG state they MUST produce the same canonical result on mobile and server hosts.

No hidden wall-clock access.

## 20. Trusted compiled Elixir extensions

Engine developers MAY implement new capabilities as normal compiled Elixir modules.

That is different from cartridge scripting and normally requires engine release/version change.

Repeated LokaScript patterns SHOULD be candidates for promotion into compiled capabilities.

## 21. Script lifecycle

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

## 22. Cartridge custom domain events

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

## 23. State machine use outside quests

Small state machines remain useful for:

- combat phase;
- doors;
- NPC high-level modes;
- crafting jobs;
- sessions;
- cartridge lifecycle.

Use them when states/transitions are explicit.

Do not force every behavior into a state machine when a pure function/derived state is simpler.
