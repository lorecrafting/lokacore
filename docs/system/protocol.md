# Protocol: contracts, the decision loop, GameView

## Contracts

`protocol/*.schema.json` is a closed JSON Schema 2020-12 subset (`lib/loka/core/contracts/schema.ex:2`);
anything outside it fails compilation and generation. Both kernels validate values against the
flattened contracts with the same paths and error codes (`lib/loka/core/contracts.ex:69`,
`kernel/ts/src/validate.ts:51`; codes in `protocol/error_registry.json`). Every contract's
`examples` must validate and `protocol/fixtures/invalid.json` must fail with exactly the listed
errors (`test/loka/core/contracts_test.exs:17`, `:26`). `bin/contracts.exs` generates
`kernel/ts/src/contracts.gen.ts`, [contracts.gen.md](../contracts.gen.md) and
[residency.gen.json](../residency.gen.json) and `--check` compares them. Registries
(`capability_registry.json`, 37 capabilities, all `portable_capability`; `event_registry.json`;
`error_registry.json`; `effect_registry.json`; `feature_registry.json`; `invariants.json`;
`residency.json`) are checked in `test/loka/core/registries_test.exs`: every command, event
and policy op has exactly one owning capability (`:159`).

## Numeric profile (frozen `loka-numeric-v1`)

[numeric-profile.md](../spec/conformance/numeric-profile.md) is the rule text; both kernels
pass `numeric-vectors.json` and `adverse-cases.json` (`test/loka/core/portable_abi_test.exs`,
`kernel/ts/test/portable_abi.test.ts`).

Implementations: canonical JSON and its hash (`kernel/ts/src/canonical.ts`,
`lib/loka/core/canonical.ex`), checked integers (`int.ts`, `int.ex`), RNG (`rng.ts`, `rng.ex`),
IdSource, CommandId and the job CommandId (`id_source.ts`, `id_source.ex`); a decision mints its
ordinals from one allocator (`kernel/ts/src/decision.ts:218`).

## The decision loop

The local authority runs this order for every ActionInvocation ([save.md](save.md) has the
storage half):

1. **Identify** (`kernel/ts/src/invocation.ts:31`): validate the bounded ActionInvocation
   (malformed is `invalid`), the actor must be the host's trusted actor (`unauthorized`), derive
   the CommandId from the trusted scope and `invocation_id`, and digest the intent:
   SHA-256 of canonical `["loka-intent-v1", action_key, actor_id, target_ids, input]` (`:51`;
   pinned by `protocol/fixtures/intent_digest.json`). Neither failure gets a receipt.
2. **Receipt lookup**: a known `(scope, invocation_id)` replays its stored outcome; an altered
   intent is a conflict ([save.md](save.md#receipts)).
3. **Freshness**: a NEW invocation with a stale `view:` token is `stale_view`, no receipt
   ([save.md](save.md#replies)).
4. **Resolve** (`invocation.ts:75`): the action key must be in the actor's current ActionSet,
   else `unsupported_capability`; its `target_ids` fill the Command's slots in order (`:57`:
   look/talk/perform one `target_id`; take/drop one `item_id`; give `item_id`, `recipient_id`);
   a recipe fills its key, a quest offer its quest, `close_choice` the pending continuation; the
   result must validate as a Command.
5. **Step** (`kernel/ts/src/world.ts:79`): the capability owning the command type
   (`CAPABILITY_OWNERS.command`) must be in the cartridge lock and have a rule, else
   `unsupported_capability`. Admission (`:106`): the nil CommandId is `permission_denied`
   (`:115`), another world or actor `not_found`, and the ActionSet must offer an action that
   resolves to this Command and accepts its target and input (`actions.ts:186`:
   `unsupported_capability`; a recipe or quest the cartridge lacks `not_found`; offered but its
   policy fails `invalid_state`). Then the rule decides; `admit` faults `unowned_event` for an
   event the capability (or one it composes, `decision.ts:179`) does not own
   (`proposal.ts:285`); a `KernelError` is an `evaluator_error` fault (`world.ts:101`).
6. **Propose** (`proposal.ts:137`): the root's ops and events join first; each `fact.assign`
   that changes its fact gets a `fact_changed` at its causal position (`fact.ts:108`); each
   event is queued FIFO; a queued `item_acquired` first completes the active quests it earns
   (`kernel/ts/src/quest.ts:75`), then each ReactionRule it triggers runs as its own writer group when its
   `when` holds (`reaction.ts:25`, `:44`), to quiescence; then, when the root advanced time,
   each due pending job runs as a `run_job` in `(due_time, job_id)` order with its reactions
   (`proposal.ts:253`). Deliveries, reaction depth and query steps are counted as they go.
7. **Adopt** (`proposal.ts:42`): a `fact.assign` outside its FactSpec faults
   `precondition_failed`; the whole proposal is checked against the budgets (`:60`); the delta
   composes (`compose.ts:93`) and the written rows, the RNG and each new continuation's
   `opened_revision` (the revision this commit will take) become the new state. A fault
   discards all of it.

A `DecisionResult` is `accepted` (`outcome`, `delta.ops`, `events`, `effects` (always empty
today), `rng`, optional `narration` lines), `rejected` (`error.code`, a gameplay code) or
`fault` (`code`, an evaluation fault: `EVALUATION_FAULTS`, generated from
`protocol/error_registry.json` into `kernel/ts/src/contracts.gen.ts:365`). A rejection or fault changes nothing: not the state, RNG,
clock or costs (invariant `rejection_consumes_nothing`, `kernel/ts/src/invariants.ts:246`).

## Composition

`compose` (`kernel/ts/src/compose.ts:93`; twin `lib/loka/core/compose.ex:59`, whose moduledoc
states the base-state shape) applies ops in order to an overlay over the committed state. Each
op has one MutationTarget (`compose.ts:49`); a second writer group on a target already written
faults `conflicting_write` (`:104`), no last-writer-wins. Ops and preconditions:

| Op | Target | Precondition |
|---|---|---|
| `fact.assign` | fact at scope | current value (or the default) equals `expected` |
| `entity.transfer` | the entity's container | container is `source_id`; no cycle (`containment_cycle`); destination under its capacity (`capacity_exceeded`) |
| `quest.activate` | quest instance | new id; no open instance of that quest at that scope |
| `quest.transition` | quest instance | `from` is the state; legal (`:24`): active→objectives_complete/failed/abandoned, objectives_complete→resolved/failed/abandoned, failed/abandoned→active; `resolved` needs an outcome |
| `choice.open` / `resolve` / `close` | continuation | open: new id; resolve: pending, offers `choice_id`, `opened_revision` equals `expected_revision` (`:215`); close: pending |
| `job.schedule` / `job.complete` | job | schedule: new id, `due_time` later than the advance's target (`nonfuture_job`, `:169`); complete: pending and due by the target |
| `time.advance` | clock | `from` is the clock, `to` later |
| `resource.adjust` | resource of an entity | `from` is the current (regenerated) value; `to` within the spec's bounds |
| `cooldown.start` | actor's action | `from` is the stored start; `at` is the clock |
| `barrier.transition` | barrier | `from` is the state; the transition is legal (`:32`; [mechanics](mechanics.md#barrier1-kerneltssrcrulesbarrierts)) |

A resource's `from` is its regenerated value ([resource@1](mechanics.md#resource1-kerneltssrcresourcets));
unset means `start` at time 0 (`:87`). The result is the
written rows sorted by canonical target text, which the host commits.

**State** (`kernel/ts/src/decision.ts:47`): `clock`, `containers` (entity → container),
`rng`, and the sections written so far, each keyed by canonical target text or id: `facts`,
`resources` (`{value, at}`), `cooldowns`, `barriers`, `quests` (`{quest, scope, state,
outcome?}`), `jobs` (`{job, due_time, status}`), `choices` (the `choice.open` fields plus
`status`, `opened_revision`, `choice_id?`). An unwritten section is absent, so a world that
never writes one keeps its state hash.

## Budgets

The eleven composition-profile limits and their values are `LIMITS`
(`kernel/ts/src/contracts.gen.ts:366`, generated from `protocol/`). One aggregate budget spans admission, the rule and the whole proposal; the first exhausted limit in
that order names the fault (`compose.ts:130`, `:141`), returned beside the decision and
observed as `evaluation.budget_exceeded`, never in the result (`proposal.ts:26`). Every policy
leaf evaluated adds one query step (`policy.ts:32`).

## Invariants

`protocol/invariants.json` registers 18 invariants, each with a spec citation that must be a
real heading (`test/loka/core/registries_test.exs:196`) and the kernels that implement it.
Pure checks by id: `kernel/ts/src/invariants.ts:149` (all), `lib/loka/core/invariants.ex:34`
(the `elixir_and_typescript` ones), plus world-level checks beside the rules (`world.ts:141`).
The fixtures hold a holding and a violated case per shared invariant
(`test/loka/core/compose_test.exs:189`); the simulator checks the rest
([architecture.md](architecture.md#hosts)).

## Events

A `DomainEvent` (`kernel/ts/src/decision.ts:227`) has an IdSource id, the world, player scope,
the actor, the world's logical time, a one-based causal `position`, and the command as
`causation_id` and `correlation_id`. A job's `entity_entered_room` is at instance scope and the
job's due time, caused by the `run_job` (`behavior.ts:58`); the proposal renumbers positions and
correlates everything to the player's command (`proposal.ts:183`). The modal scene subset
emits `scene_ended {scene}` on the final continue at position 2, leaving position 1
for its line fact's fact_changed; start is the fact's 0→1 change, with no scene_started
([scene@1](mechanics.md#scene1-rulesscenets)).

## ActionSet and admission

An actor's actions (`kernel/ts/src/actions.ts:154`) are, in order: the engine verbs of the
capabilities the lock holds (`VERBS`, `:86`: look, move, scan, take, drop, give, wait, open,
close, lock, unlock, wear, remove, stand, sit, rest, sleep, each with its target kind and input; policy always true), then the
cartridge's actions, recipes, the offers of quests that have one and the actor has no instance
of, and the talks of dialogues whose speaker is in the room (one per dialogue) (`override`: a cartridge may redefine a verb), then
the room's contributions by ADR-016's operations (union, override, replace, subtract,
intersect; `:59`), then the answers to a pending choice (`choose`, `close_choice`), which no
contribution removes. A recipe's admission adds `cooldown` and `insufficient_resource`
([action_recipe@1](mechanics.md#action_recipe1-rulesaction_recipets49)).
The door verbs (`open`, `close`, `lock`, `unlock`) stay in the set and admission is unchanged;
the GameView lists them only on the exits they act on and on the items with a barrier
(containers, c1-locks), never with the place's actions. On an item each is advertised with the
item's scope as its entity target and no input, so a client invokes it with `target_ids`
`[item]` and resolve fills `target_id` (`kernel/ts/src/invocation.ts` `TARGETS`).
`wear` and `remove` (equipment@1) take an `inventory` item target in the set (an engine verb's
rule checks its own target); for a cartridge action resolving to `remove`, the `inventory` scope
also holds an item worn in the body's slot holders (`kernel/ts/src/actions.ts:240`). The GameView lists `wear` on a held
item and `remove` on a worn one only when admission and equipment@1's check accept it now, all
available, never `drop`, `give` or `wear` on a worn item, and never either with the place's
actions (a targetless one is never accepted: its Command needs `item_id`) (c1-equipment).
`stand`, `sit`, `rest` and `sleep` (position@1) take no target; the GameView lists them with the
place's actions, except every action resolving to the current position's verb (a cartridge
alias included), which step would refuse `invalid_state` (c1-position).

While [scene@1](mechanics.md#scene1-rulesscenets) runs, this shared resolved set is
replaced by its single `continue` action (none target, empty input), after every
ordinary contribution. Both invocation resolution and direct Command admission
therefore refuse other commands with existing `unsupported_capability`, before
clock or state changes. Continue is never a general engine VERBS entry.

## Policy

`holds` (`kernel/ts/src/policy.ts:18`) evaluates `all`, `any`, `not` and the leaves
`fact_compare` (the fact's value at the actor's scope equals), `has_item` (inside the actor's
body, directly or nested), `barrier_state`, `quest_state` (false while the actor has no
instance), `time_window` (hour of day from `clock / 3600 % 24`, wrapping windows allowed, `:42`),
`target_present` (the action's target is in reach, `:47`), and `stat_compare` and
`resource_compare` (`:60`, [attributes@1](mechanics.md#attributes1)). An op outside this list throws:
the loader closes the set (`cartridge.ts:160`).

## Target resolution

Before any Command exists, the host resolves the player's words (`kernel/ts/src/target.ts:37`):
lowercase, split, a leading `at` and article dropped (`:20`), joined by `_`, matched exactly
against the aliases of the room's details and the keywords of items and NPCs in the room or
held by the body; none, unique, or ambiguous with candidate ids in ascending code-point order
(invariant `target_candidates_ordered`); over 1024 candidates it throws (`:50`). A barrier is
named by its keywords through `doors` (`:72`). A Command carries only ids, never words.

## GameView

`gameView` (`kernel/ts/src/view.ts:49`) projects, for the player: `actor_id`; `place` (room
id, title, the description variant whose condition holds, `rules/description_variant.ts:26`);
`exits` in compass order, unavailable with `unsupported_capability` while a modal scene
runs (before passage, position and fare), else `exit_closed`, `exit_locked` (a closed or locked
barrier), `invalid_state` (position@1: the actor is not standing; after the barrier, before the
fare) or `insufficient_resource` (the body cannot pay a move); an exit through a barrier
carries `door` (the barrier's short name, its state and the door verbs the actor may use on it
now: those admission and barrier@1's check accept, all available), also when passable; an exit
whose barrier does not bar the way carries `sight` (the destination room id and title and the
NPCs and items directly in it, in the order of `entities`), also when the move is unaffordable
(04 §15 as amended by c1-doors); `actions` of the place, without the door verbs, `wear` or `remove`,
nor the current position's verb; `position`, the actor's position, present exactly when the
cartridge locks `position@1` (04 §15 as amended by c1-position);
`entities` in the room and `inventory` of the body, each with its short name, kind and the
actions it accepts (NPCs first, then DefinitionRefString order); an item with a barrier also
carries its `state` and the container verbs admission and barrier@1's check accept now, all
available; an item without a barrier or with an open one carries `contents` when it holds an
item: every item inside it in reach (containment@1 custody: no closed or locked lid on the way),
at any depth, flattened in DefinitionRefString order, each with its `container_id` (its direct
container), its `state` if it has a barrier, and as actions only `take` and its container verbs
(a `ContentView`; a recursive view is not allowed in the schemas). An NPC's possessions and a
worn item's contents are never shown (c1-locks); `equipment`, one entry per slot
holder in slot-key order with its `slot` and, when one is worn, the `item` with the actions it
accepts (only those resolving to `remove`), absent when the world has no holder
([equipment@1](mechanics.md#equipment1-kerneltssrcrulesequipmentts)); `journal` (each quest the player
has an instance of, with state and title, and optional `journal`, the selected TextKey
from [quest@1](mechanics.md#quest1-rulesquestts-kerneltssrcquestts)); `chapter` (`{index, title}`, a non-negative declaration index and TextKey), present exactly
when the cartridge declares chapters, selected by [Chapters](mechanics.md#chapters-kerneltssrcviewts);
`scene` (`{scene, line, index, count}`, DefinitionRef, TextKey, one-based shown line and
narrate count), present exactly while [scene@1](mechanics.md#scene1-rulesscenets) runs;
`time` (the logical clock); the pending `choice`
(prompt, speaker id, closable, each option available or blocked, `kernel/ts/src/dialogue.ts:80`); and
`resources`, each with current, maximum, a condition band key and its tone (`normal`, `warning`
or `danger`, which the presenter maps to a colour) from the table in effect: the pool's own
`bands` (resources.json), else the cartridge's `world.bands` (cartridge.json), else the engine
default of 11 bands by percentage of the range, `perfect_health` at 100 down to `dying` at 0,
tones `normal` from 80, `warning` from 40, `danger` below (`kernel/ts/src/view.ts:216`, `:235`). The band is the
first row whose cut p reaches, in integers: 100 × (current − minimum) ≥ cut × (maximum −
minimum); maximum = minimum gives the top row (04 §15 as amended 2026-10-02).
Actions are listed highest priority first, then by key, available or with the refusal code
(`kernel/ts/src/action_lists.ts:33`). Invariant `gameview_agrees_with_admission` holds this for exits and
recipes, and for the door and container verbs and `wear`/`remove`, matched by the Command each
listed action resolves to (a cartridge alias included): one listed on its exit or item (a nested
one in `contents` included) is never refused with a code the view predicts (`not_present`
among them), one not listed is never accepted, and none of `wear`/`remove` is a place action; a
position invocation (`stand`, `sit`, `rest`, `sleep`) checks its selected `action_key` when
the observation supplies it: an available matching place action is never refused
`invalid_state`, and an unavailable or absent one is never accepted. Without an action key,
any available place action resolving to that command qualifies. An available exit's move is
never refused `invalid_state` or `unsupported_capability`; a
`take` listed on an item is never refused `not_present` (`kernel/ts/src/invariants_view.ts:29`, `:76`).
