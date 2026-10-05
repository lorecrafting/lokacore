# Mechanics: the rules of each installed capability

Every rule is a pure function `decide(world, command, mint, steps)` returning a
DecisionResult (`kernel/ts/src/runtime/decision.ts:192`). Admission, budgets and composition are in
[protocol.md](protocol.md). Refusal codes are gameplay rejections (`protocol/error_registry.json`).
Which capability owns which command, event and policy op: `CAPABILITY_OWNERS`
(`kernel/ts/src/contracts.gen.ts:367`), summarised in the [feature map](../features.gen.md).

The clauses below describe installed behavior. Future character, resource, skill, magic and combat
planning follows the [LegendMUD baseline direction](../decisions/owner-decision-legendmud-baseline-2026-10-03.md)
and [current PM reconciliation](../decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md).
Planned selections do not change these installed clauses; each consumer amends them before code.

## A fresh world

`newWorld(cartridge, context, seed)` (`kernel/ts/src/runtime/fresh.ts:26`) mints ids under the nil
CommandId in a fixed order: the player's CharacterId, its body, each room (DefinitionRefString
order), each room's details, one instance from each NPC [blueprint](glossary.md), one from each
item blueprint, then one job per NPC with a daily schedule,
then one slot holder per distinct `slot` some item declares, in slot-key order (UTF-8 bytes;
[equipment@1](#equipment1-kerneltssrcmechanicsequipmentrulets)). A holder is an entity inside the
body with capacity 1; it is not in `entities`, so no command targets it and no view lists it.
The body starts in `entry`, each NPC in its room, each item at its location; the clock is
`calendar.start` or 0 (`:40`); each scheduled NPC's first job is due at its schedule's first
hour strictly after the start; facts hold their defaults, with no record until the first change
(so the [position](#position1-kerneltssrcmechanicspositionrulets) fact adds nothing to a fresh state); a world starting after time 0 stores
the body's legacy resources at their start values. Every opted recovery pool has a required
player-body row at the birth clock, including zero, with its authored start, standing rate
and zero remainder ([resource@1](#resource1-kerneltssrcmechanicsresourcets)). One body per world;
rules read the actor from the
command and its body from `bodyOf` (`runtime/decision.ts:159`).

## movement@1 (`kernel/ts/src/mechanics/movement/rule.ts`)

`move {direction}`: a direction outside the six compass directions is `invalid_target`
(`:33`); no exit here, `not_found`; an exit through a closed or locked barrier, `exit_closed`
or `exit_locked` (`passage`, `:62`); under [position@1](#position1-kerneltssrcmechanicspositionrulets), an
actor not standing, `invalid_state` (`kernel/ts/src/mechanics/position/shared.ts` `standing`); the move costs the body
the cartridge's `world.movement.cost {resource, amount}`, else (the engine default) 1 mv when the cartridge
declares `mv`, else nothing, and an unpayable move is `insufficient_resource` (`fare`, `:73`).
Per-exit and terrain costs are later (00 §11 chapter three). Accepted
`moved`: the `resource.adjust` (none without a cost), one `entity.transfer` of the body and
`entity_entered_room`. `scan` is accepted `scanned` with nothing to change and no event
(`:31`). The GameView carries `sight` (`:88`) per exit: nothing through a barrier that bars the
way (`passage`), else the destination room and the NPCs and items directly in it. Invariants `player_in_one_room`, `exits_resolve` (`:100`).

## barrier@1 (`kernel/ts/src/mechanics/barrier/rule.ts`)

`open`, `close`, `lock`, `unlock` name exactly one of `direction` (the barrier on that exit of the
actor's room) or `target_id` (the barrier on that item, a container's lid; c1-locks), else
`invalid_target`. Direction: outside the compass `invalid_target`, no exit `not_found`, an exit
without a barrier `invalid_target`. Target: no entity `not_found`, not an item
`invalid_target`, out of reach (containment@1's custody walk, below) `not_present`, an item
without a barrier `invalid_target`. Then, for both: legal transitions only (`MOVES`, `:39`):
open needs closed (a locked one is `exit_locked`), close needs open, lock needs closed, unlock
needs locked, else `invalid_state`; lock and unlock need the barrier's `key_item` held by the
body, directly or nested, else `not_owned` (`:84`). `has_item` climbs every held container, a
locked one included, so a key locked inside a held chest still opens it (a `ponytail:` limit).
The loader rejects keys that can never be reached at load time, but play can still lock a
container whose key is inside it and drop it out of reach (a runtime lockout), and the later `put`
would add more ways to cause it, so a lockout rule is the eventual fix. These checks are one read-only function the rule and the GameView's door and
container verbs share (`transition`, `:64`). Accepted: one `barrier.transition` and
`barrier_changed`. Both faces of a door name one state; a barrier an item names is named by no
exit and no other item (the loader's `BARRIER_MISMATCH`). Policy leaf `barrier_state`. Keys that
break on a failed force are LATER (owner descope, [plan](../decisions/owner-decision-chapter-one-plan-2026-10-02.md)).

## containment@1 (`kernel/ts/src/mechanics/containment/rule.ts`)

An entity's one container is `State.containers`; inventory is what the body contains, never
stored. `take {item_id}`: no entity `not_found`, not an item `invalid_target`, already held
`invalid_state`, out of reach `not_present`; accepted `taken`, `item_acquired`, one transfer
from its container to the body. Custody (c1-locks; `reach`, `kernel/ts/src/mechanics/lookups.ts:33`): walking up `State.containers`
from the item, every container before the body's room or the body is an item without a barrier
or with an open one; an NPC, a slot holder or a closed or locked lid on the way fails it. A
container without a barrier is open: its contents are in reach (a sack can be emptied).
Custody leaves `has_item` and target resolution's `target_present` unchanged. `drop`: not
held `not_owned` (`:49`); accepted `dropped`, `item_dropped`. `give {item_id, recipient_id}`:
not held `not_owned`; recipient missing `not_found`, not an NPC `invalid_target`, not here
`not_present`, at its declared capacity `invalid_state` (`:58`, undeclared is unlimited);
accepted `given`, `item_acquired` with the NPC as holder. Composition re-checks custody, cycles
and capacity. Policy leaf `has_item`; invariants `one_container_per_item`,
`containment_acyclic` (`:69`, `:76`).
A worn item ([equipment@1](#equipment1-kerneltssrcmechanicsequipmentrulets)) is in a slot holder,
not directly in the body: `drop` and `give` of it are `not_owned`, `take` is `not_present`
(the rule is unchanged; remove it first).

With authored [`world.carry`](cartridge.md#carrying-settings-and-item-mass), only a voluntary
positive-load Take has a carrying ceiling. After the existing target, directly-held and reach
checks, a candidate whose custody already reaches the actor's body is neutral. Otherwise its
subtree includes its own shell and every nested item, even behind closed or locked lids. A
zero-mass subtree is neutral; for a positive subtree, Take refuses `too_heavy` exactly when
current load plus that subtree exceeds `carry.max_grams` (equality fits). Current load counts
every item EntityId whose custody reaches the body once, including worn items under slot
holders; body, rooms, NPCs and slot holders have no mass. Definitions supply mass, not reach or
barrier state. Distinct instances of one definition count separately.

The shared reach prerequisite charges each custody edge to the same query counter and
terminates on a repeated ancestor with `containment_cycle` or exhaustion with `budget_exceeded`.
A closed lid or non-item holder still refuses `not_present` before inspecting ancestry beyond it.
Take propagates reach failures as evaluation faults; projected Take offers expose the same code.
Item-barrier admission also propagates these faults instead of treating an error as reachable.

The shared carrying predicate uses one ephemeral context per decision or `lists()` projection,
and derives a parent-to-children map from custody rows only when an external subtree must be measured.
Iterative traversal memoizes subtree totals by EntityId. Every inspected custody row/node and
slot-holder entry charges the existing `Steps` counter before inspection and accumulation; cache hits do not
traverse again. Decision admission and carrying share that counter. Relevant malformed mass
faults `precondition_failed`; a relevant custody cycle faults `containment_cycle`. Exceeding
`query_steps` faults `budget_exceeded` before allocating any event or transfer. At its frozen
32768 limit and the 2147483647 item-mass bound, a successful combined traversal sums at most
70368744144896 grams, below the safe-integer bound; totals use checked addition.

Drop, Give, Wear/Remove and conserved forced transfers retain their existing admission rules.
There is no global overload invariant: an overloaded body can take a zero-mass subtree,
extract its own reachable child and rearrange worn gear, then Remove and Drop to shed load.
Without a carry setting, legacy carrying behavior is unchanged. This mechanic composes custody, equipment,
cartridge definitions and the existing conserved transfer; it introduces no persisted load.

## equipment@1 (`kernel/ts/src/mechanics/equipment/rule.ts`)

An item may declare one `slot` (`SlotKey`: `head`, `neck`, `body`, `cloak`, `arms`, `hands`,
`waist`, `legs`, `feet`, `wield`, `off_hand`, `light`). Worn means inside the body's holder for
that slot ([A fresh world](#a-fresh-world)); wearing and removing reuse `entity.transfer`, with
no new op and no event. The actor's holders are those whose container is its body.
`wear {item_id}`: no entity `not_found`, not an item `invalid_target`, already in one of the
actor's holders `invalid_state`, not directly in the body `not_owned`, no `slot` or no holder
for it `invalid_target`, the holder occupied `invalid_state`; accepted `worn`, one transfer
body → holder. `remove {item_id}`: no entity `not_found`, not an item `invalid_target`, directly
in the body `invalid_state` (not worn), anywhere but one of the actor's holders `not_owned`;
accepted `removed`, one transfer holder → body. These checks are one read-only function the
rule and the GameView share. Composition re-checks custody, cycles and the holder's capacity.
`has_item` climbs containers, so a worn item still counts. Finger slots, slot compatibility
and dual wield, granted modifiers and affects, curses and no-remove items are LATER
([ROADMAP](../ROADMAP.md)).

## position@1 (`kernel/ts/src/mechanics/position/rule.ts`)

Shared position queries and the verb mapping live in `kernel/ts/src/mechanics/position/shared.ts`; rule modules
use that kernel helper without importing another rule module.

The actor's position is the engine fact `position` (enum `standing`, `sitting`, `resting`,
`sleeping`, default `standing`, scope player), which the compiler adds when the lock holds
`position` ([cartridge.md](cartridge.md#compiler)). `stand`, `sit`, `rest`, `sleep` (no
target): the command's position equal to the current one is `invalid_state`; else accepted
`stood`, `sat`, `rested` or `slept`. Resolve the actor's body through `bodyOf`; for each
opted recovery pool in DefinitionRef order, emit an exact zero-amount `resource.adjust` with
the destination position's `next_rate`, including when `from == to`. These operations settle
the old rate first, then one `fact.assign` at the actor's player scope has `expected` the
current position. All operations share one writer group; the host adds `fact_changed` at
the assignment's causal position. Legacy pools receive no position adjustment.
Every change between two positions is legal (twelve), and every verb but `move` works in any
position ([movement@1](#movement1-kerneltssrcmechanicsmovementrulets)). Content may read the fact
(`fact_compare`, a reaction's `on.fact`) but never write it (`RESERVED_FACT`). The GameView
shows `position` and lists the verbs but the current position's with the place's actions
([protocol.md](protocol.md#gameview)). Position affects only opted resource recovery as
specified below ([PM adoption](../decisions/pm-decision-m2-a-position-recovery-2026-10-04.md)).
Sleeping that cannot act, waking on damage, double damage and `meditating` are
LATER ([ROADMAP](../ROADMAP.md)).

## description_variant@1 and inspectable_detail@1 (`mechanics/description_variant/rule.ts`)

`look` with no target: accepted `looked`, nothing changes; the host shows the GameView, whose
room description is the first variant whose `when` holds, else the base (`describe`, `:26`).
`look {target_id}` at a detail of the room, an entity in it, or a held item: unknown id
`not_found`, elsewhere `not_present`; accepted `examined`. A detail's own description is
chosen the same way. Details are named through their aliases ([target resolution](protocol.md#target-resolution)).

## target_resolution@1, policy@1, fact@1

Ruleless. `target_present` is true when the action's target is in reach (`mechanics/policy.ts:47`,
`commands/target.ts:59`). `policy@1` is `all`, `any`, `not` (`mechanics/policy.ts:18`). A fact is read and set at
its one declared scope: the actor's for `player`, the world's for `instance`
(`mechanics/fact.ts:21`); unset means its default; `fact_compare` compares equality. The host appends a
`fact_changed {fact, old, new}` for each `fact.assign` that changes its value, at the assign's
causal position (`mechanics/fact.ts:108`); an unchanged assign emits nothing. Invariant `facts_typed`.
The leaves `stat_compare` and `resource_compare` are [attributes@1](#attributes1)'s.

## resource@1 (`kernel/ts/src/mechanics/resource.ts`)

An explicit NPC `hp` definition resolves once at birth into an immutable World
`entityResourceSpecs` map, keyed by the canonical resource MutationTarget (resource
DefinitionRef plus EntityId). Effective spec precedence is exact entity-resource override,
then pool DefinitionRef spec. The override is a complete HP spec with no position recovery;
lookup, adjustment, ordered costs and both portable composition/precondition twins use it.
Among NPC resources, only explicit overrides get required `{value: start, at: birth_clock}` rows, including
clock zero. Required rows contain exactly `value` and `at`: bounded integer value and safe
integer `0 <= at <= committed clock`. Missing or invalid rows fail queries/preconditions,
never falling back to start. A zero-gain NPC stays wounded or at zero as time advances;
zero HP alone has no death behavior. No NPC rows are initialized for other pools.

Ruleless. A body's current value is derived from the stored row and the clock: `gain` per
hour boundary crossed, capped at `maximum` (`foundation/resource.ts:59`), for legacy pools.
An optional `regen {every, by_position}` instead uses a required stored
`{value, at, rate, remainder}` row. At `now`, settle the **old stored rate** over `now-at`:
conceptually divide `remainder + (now-at)*rate` by `every`, adding the quotient and retaining
the residual. `gain` is ignored for opted recovery. At maximum discard all credit, including
the fraction; an explicit adjustment to maximum does the same. Spending below full preserves
the fraction; a zero rate preserves it while below maximum. Queries are pure and never write
metadata. Split elapsed time into whole intervals and residual before multiplying: a positive
rate caps immediately when whole intervals suffice, otherwise their gain is bounded by the
resource span and the residual multiplication is exact under the authored bound in
[cartridge.md](cartridge.md#compiler). No per-unit loop or unsafe full elapsed product.
Opted rows require bounded integer value, safe integer `0 <= at <= committed clock`, an
authored rate, and integer `0 <= remainder < every`; full rows require zero remainder.
Missing or malformed opted rows fail preconditions rather than falling back to time zero.
Costs are paid in order as exact
`resource.adjust` ops; one that would go below `minimum` refuses the whole command
`insufficient_resource` (`pay`, `:73`). A recipe step `resource.adjust` saturates at the bounds
and is dropped when it changes nothing (`adjust`, `:45`; `mechanics/action_recipe/rule.ts:146`). No
events. The engine pools are hp, ma, mv ([cartridge.md](cartridge.md#compiler)); the GameView
shows each with a condition band and its tone from the pool's own `bands`, else the
cartridge's `world.bands`, else the engine default table ([protocol.md](protocol.md#gameview)).

## attributes@1 (`kernel/ts/src/mechanics/policy.ts:60`)

Ruleless, and no state. An attribute is a definition `AttributeSpec {key, start}` in the
cartridge's `attributes` map (source `attributes.json`, [cartridge.md](cartridge.md#source-layout));
the engine declares none, so the six 00 §4.3 stats are content. Every actor's value of an
attribute is its `start`: nothing writes attributes yet, so no row, delta op or state hash
carries them. The first writer (training, chapter three, or an ancestry modifier, LATER)
decides whether a value belongs to the body or the character and how it is saved.
`attributes@1` owns two 06 §21 leaves, each `{<ref>, at_least}` (a ResourceInt; "below" is
`not`, a range `all`): `stat_compare {attribute, at_least}` holds when the actor's value is at
least `at_least`; `resource_compare {resource, at_least}` when the current value of the pool
on the actor's body, as [resource@1](#resource1) derives it and before the action's costs, is.
Both fail closed: an actor without a body reads no pool, and the compiler and loader reject an
unresolved reference or a leaf whose owner the lock lacks (`UNDECLARED_CAPABILITY`). Not
`resource@1`'s: a new op would take `resource@2`, re-deriving every v2 lock and hash.

## check@1 (`mechanics/action_recipe/rule.ts:109`)

Ruleless, resolved inside `perform`: a `luck` check draws one uniform integer in [0, 100) from
the world's RNG (at most 8 draws, `:103`) and passes below `chance`; a `threshold` check draws
nothing and passes when the body's value of `resource` at admission (before costs) is at least
`difficulty`. It emits `check_passed` or `check_failed` at position 1 and selects the
`success` or `failure` outcome. A rejected command draws no RNG.

## action_recipe@1 (`mechanics/action_recipe/rule.ts:49`)

`perform {action, target_id?}`: no recipe by that key in the actor's set `not_found`; a target
other than the recipe's detail `invalid_target`; the detail outside the room `not_present`;
then `cooldown` (time since the actor's last admitted attempt below the recipe's cooldown) and
`insufficient_resource` (`commands/actions.ts:253`). Accepted, in one decision: the costs' adjusts;
the check and its event; the chosen outcome's `sequence` in order (`fact.assign` with the
expected value as the steps before left it, saturating `resource.adjust`, `event.emit` as
`custom_event`); `action_completed` unless the outcome is `failure`; a `cooldown.start` when
the recipe has a cooldown (`:73`); a `time.advance` by `duration` after the steps (`:77`),
which is an explicit advance that runs due jobs. A failure commits its costs, draw, cooldown
and time exactly like success. The outcome is `success`, `failure` or `performed` (no check).
The narration is the outcome's `narration.actor` key with its participants pinned to EntityIds
(`:90`). Recipes are offered by the cartridge and by room contributions (ActionSet).

## quest@1 (`mechanics/quest/rule.ts`, `kernel/ts/src/mechanics/quest/lifecycle.ts`)

A quest starts through its offer, which is optional, or through a dialogue choice's `accept`
(dialogue@1 below; [owner decision](../decisions/owner-decision-quest-from-dialogue-2026-10-02.md)).
`accept_quest {quest}` is admitted only through the quest's offer (a quest without one has no
accept action), withdrawn once the actor has an instance (`commands/actions.ts:138`), so a second accept
and an undeclared quest are refused before the rule. Accepted: `quest.activate` at player scope and `quest_activated`; the outcome is
`activated_with_possession` when a `current_state` objective already holds, else `activated`
(nothing is stored for it). Objectives: `current_state` (a policy evaluated when needed, never
stored) or `post_activation_event` (met by an `item_acquired` of the named item into the
instance's actor's body, placed after activation; `earned`, `kernel/ts/src/mechanics/quest/lifecycle.ts:75`), which the proposal
completes to `objectives_complete` as its own writer group. Resolution (`:111`) happens in the
rule that resolves it (a dialogue choice): no open instance `invalid_state`; `active` with an
unmet `current_state` objective `quest_requirement`; else `quest.transition` to
`objectives_complete` (if needed) and `resolved` with the choice as outcome, and
`quest_resolved`. Policy leaf `quest_state`; the GameView journal lists the player's instances.
A quest may declare `journal` texts: `active`, `objectives_met`, `resolved`, `failed`,
`abandoned`, and optional `outcomes` keyed by outcome. The view selects one TextKey without
persisting it: `active` shows `objectives_met` while `holdsNow` holds, else `active`;
`objectives_complete` shows `objectives_met` (event-earned credit survives dropping the item);
`resolved`, `failed` and `abandoned` show `outcomes[outcome]` when declared, else their state's
text. Without `journal`, the entry has only quest, state and title. Outcome keys need not name
a dialogue choice: an unknown key falls back to the state's text. Revisit that check when a
rule other than a dialogue choice resolves or fails a quest with an outcome.

## dialogue@1 (`mechanics/dialogue/rule.ts`, `kernel/ts/src/mechanics/dialogue/shared.ts`)

`talk {target_id}`: a target that speaks no dialogue `not_found`. A speaker may have several
dialogues; the talk opens the first, in key order, whose own policy holds: none holding, or the
actor already having a pending choice, `invalid_state`. Accepted
`choice_opened`: one `choice.open` of a new continuation (ordinal 0 of this command), the
dialogue's roles bound to EntityIds in role-name order, the choice ids in key order, and
`choice_opened`. `choose {continuation_id, choice_id}`: a continuation not pending, not the
actor's or not offering the choice `invalid_state`; a bound NPC not in the room `not_present`;
a bound item not held `not_owned` (`kernel/ts/src/mechanics/dialogue/shared.ts:66`; the GameView shows the same); then the
dialogue's quest resolves (above), or the choice's `accept` activates its quest as
`accept_quest` does, `invalid_state` when `accept_quest` would be: the actor already has an
instance, or the quest's offer, if declared, has a policy that fails (the talk-time policy may be
stale; `mechanics/quest/lifecycle.ts` `acceptRefused`). The GameView shows such an accept unavailable with the same
code. Accepted, outcome the choice id, in one decision: the
`hand_over` (an `entity.transfer` of the bound item to the bound NPC and `item_acquired`),
the choice's `fact.assign` steps, the quest's transitions and `quest_resolved` (or the accepted
quest's `quest.activate` and `quest_activated`), `choice.resolve`
at the continuation's `opened_revision`, `choice_resolved`, one narration line with the actor
and every bound role as participants, and the `story_point_reached` of a story point outcome
whose trigger is this dialogue and choice (`mechanics/dialogue/rule.ts:177`). `close_choice {continuation_id}`: the
actor's pending continuation closes, nothing else (`choice.close`), else `invalid_state`.
While a choice is pending, `choose` and `close_choice` are the actor's answers and no room
contribution removes them (`kernel/ts/src/mechanics/dialogue/shared.ts:151`). Only a dialogue's speaker, present in the room,
offers its talk (`:138`), one per dialogue under the dialogue's key, available while that
dialogue's policy holds. The loader rejects an `accept` in a dialogue that has a `quest`
(accepting would resolve it) or on a choice with a `hand_over` (activation and acquisition in one
decision conflict), both `OUTCOME_MISMATCH`.

## Chapters (`kernel/ts/src/view/view.ts`)

A cartridge may declare an ordered, non-empty `chapters` list of titles. The opening
chapter (index 0) has neither `story_point` nor `outcome`; every later chapter names a
story point and may select one of its outcomes. The current chapter is the highest
reached index, else 0. GameView carries its `index` and `title` TextKey exactly when
chapters are declared; the presenter can compare consecutive indices to show a title page.

A chapter selecting outcome O of story point P is reached when the player's instance of
the quest of O's trigger dialogue D is `resolved` with outcome C, where O's trigger is
`{dialogue: D, choice: C}`. The story point outcome key and the dialogue choice id are
different keys: the projection maps through the trigger. Without an `outcome`, any
outcome of P reaching its trigger counts. An active or `objectives_complete` quest does
not reach a chapter, even when its objective holds; another player's quest does not count.

This derives only from existing quest state, with no persisted marker, op or event
([chapter-one plan](../decisions/owner-decision-chapter-one-plan-2026-10-02.md),
§3 slice 9 and §6; the owner's chapter-marker addition). It holds while story points
come only from quest-resolving dialogue choices. Revisit with a persisted story-point
record when another source appears. To keep this derivation unambiguous, a counted
trigger is rejected if another dialogue resolves the same quest with the same choice id;
[the compiler and loader check](cartridge.md#compiler) fails closed with the existing
`OUTCOME_MISMATCH` code. This narrow check is the PM's continuing-workflow choice,
not an explicit owner response to the chapter brief's Q4.

## narration@1

Ruleless: a committed narration line binds its participants' EntityIds at commit (recipe
narration and dialogue choices above); no `narration.emit` consequence, no acknowledgement.

## scene@1 (`mechanics/scene/rule.ts`)

Shared fact/reference, running-line, modal action and start-delivery queries live in
`kernel/ts/src/mechanics/scene/shared.ts`, used by the pure rule, reaction delivery, admission and view,
following position@1's existing helper pattern. The rule retains typed ownership and
never casts schema values or imports I/O.

Dated implementation amendment, 2026-10-03: the installed subset of archived 06
§33–§37 and 21 §3.6 is a modal text sequence in `current_world`, as needed by 00a §9
and the approved [C1 plan](../decisions/owner-decision-chapter-one-plan-2026-10-02.md).
A SceneDefinition has `on {story_point, outcome}`, `control: modal`, and n ≥ 1
`narrate {text}` steps followed by `await_ack`, then `end`. It is not skippable and
never replays. Other control modes, overlays/dreams, dialogue/choice, role bindings,
checkpoints and consequence beats, and a quest objective on `scene_ended` remain later.

For scene key k, the compiler adds `<id>@<ver>:fact/scene_<k>` exactly as follows
(only `<k>` and `<n>` substitute; `1..n` is literal, n counts narrates):

```json
{"key": "scene_<k>", "version": 1, "value_type": {"type": "int", "minimum": -1, "maximum": <n>, "default": 0}, "scopes": ["player"], "meaning": "Scene <k>'s line (scene@1): 0 not started, 1..n shown, -1 ended; only scene@1 writes it."}
```

The fact is absent until changed: 0 means not started, 1..n the line shown, −1 ended.
Content may read it but cannot author or assign it ([compiler](cartridge.md#compiler)).
At `story_point_reached` matching `on`, the proposal's reaction delivery appends a
scene start after authored reactions, in scene-key order: `when` fact equals 0,
`apply` fact := 1. This reuses the existing delivery budgets, FIFO and writer groups;
scene starts require scene@1 alone, never reaction@1. There is no `scene_started`.
The guarded start is part of the triggering command's atomic proposal, after its
choice closes. Duplicate delivery or receipt retry never restarts an ended scene.

While the actor's scene fact is in 1..n, the resolved ActionSet is replaced by only
`continue` (target none, empty input, `action.continue`). Normal admission refuses
all other commands with `unsupported_capability`, through invocation or direct
Command alike, before effects or clock changes. Every exit advertises the same
refusal. The GameView includes `scene {scene, line, index, count}` exactly while
running; line is the current narrate TextKey, index is one-based and count is n.

`continue` at i < n returns `continued`, one fact.assign `expected: i, value: i+1`,
no rule event. At n it returns `ended`, one assign `expected: n, value: -1`, and
`scene_ended {scene}` at position 2, leaving position 1 for the host's fact_changed.
The final continue acknowledges the last line and runs end: await_ack adds no wait.
All continuation uses the command's actor. No running scene is the rule's defensive
`invalid_state`; ordinary admission refuses continue as `unsupported_capability`.
SCENE-01 has headless line-2 reopen and actual Release Simulator terminate/relaunch
proof in the [touch review](../reviews/2026-10-03-c1-touch-review.md) and its
[native evidence](../evidence/c1-touch/README.md). SCENE-03 and QUESTSCENE-01's
start-once half are covered by the [scene review](../reviews/2026-10-03-c1-scenes-modal-review.md).
A stale fresh-id Continue can still advance an unseen line at the command boundary;
the [ROADMAP carry](../ROADMAP.md#c1-carry-checkpoints) distinguishes presenter input
review from the future line-bearing contract.

## reaction@1 (`kernel/ts/src/mechanics/reaction.ts`)

Ruleless, run by the proposal: a ReactionRule triggers on `fact_changed` of its fact or
`entity_entered_room` into its room (`:26`), in rule-key order; its `when` is read on the
proposal so far at the event's logical time; when it holds, its `apply` is a sequence of
`fact.assign` at the actor's scope as its own writer group (`:47`); the `fact_changed` they
emit trigger further rules, FIFO, to quiescence, within the deliveries, `reaction_depth` and
`query_steps` budgets. Matching [scene starts](#scene1-mechanicsscenerulets) follow authored
rules in scene-key order, using the same delivery machinery.

## schedule@1, behavior@1, calendar@1 (`mechanics/schedule/rule.ts`, `kernel/ts/src/mechanics/schedule/behavior.ts`)

`wait {until}`: not later than now `invalid_state` (`:46`); accepted `waited`, one
`time.advance`, no event. Any explicit advance (a wait or a recipe's duration) runs every
pending job due at or before its target, in `(due_time, job_id)` order, each as a `run_job` the
host builds with the job's CommandId; one that is not accepted is the advance's result
(`runtime/proposal.ts:253`). `run_job` is authority-internal: a cartridge action may not name it. It
runs one job of an NPC's `daily_schedule` (hour of day → room): a job not pending
`invalid_state` (`:23`); the NPC moves to the room listed for the job's hour unless already
there (an `entity_entered_room` at the job's time), the job completes, and the next job is
scheduled at the schedule's next listed hour, strictly later (`mechanics/schedule/behavior.ts:24`). One unit of
logical time is one second, an hour 3600, a day 86400, time 0 midnight (`mechanics/schedule/behavior.ts:18`;
`mechanics/policy.ts:42`). `calendar@1` is the cartridge's start time only. Policy leaf `time_window
{from, to}` in hours, wrapping past midnight. Invariant `job_complete_owned_by_run`.

## Engine-wide behaviours

- **Ids are deterministic**: every entity, event, instance, continuation and job id comes
  from the IdSource under its command, so a replay mints the same ids.
- **Composes-with**: a choice composes quest and containment, a recipe composes check, a job
  composes movement (`runtime/decision.ts:179`); facts, containment, barriers, resources and the clock
  are the shared vocabulary every mechanic reads through the same policy leaves.
  Scene starts read story_point_reached and write only their own facts; modal ActionSet
  replacement restricts position, equipment and door verbs without edits to those rules.
  Policies/reactions may read scene facts. The one direct coupling, reaction → scene,
  is limited to event start delivery until a second capability needs this hook.

## M1-A elapsed authority time

[Contract decision](../decisions/pm-decision-m1-a-elapsed-contract-2026-10-04.md). `manifest.time_policy.profile = real_elapsed` disables player Wait and recipe time skips; omitted policy retains legacy behavior. `stepElapsed(world, command, revision)` admits only schedule-owned `elapsed {actor_id, run_id, from, until}`. It validates schema and derived CommandId, rejects nil ID (`permission_denied`), wrong world/actor (`not_found`), and refuses wrong derived ID (`permission_denied`), wrong profile or interval (`invalid_state`). A valid interval has `from == world.state.clock`, `until > from`. Accepted outcome `elapsed` contains one root `time.advance`, no own narration/event/RNG; the existing proposal supplies due jobs, reactions, owned events and all budgets. Faults adopt nothing. Normal `step` refuses elapsed (`permission_denied`) even if supplied a forged ActionSet action. Scenes retain Continue-only player admission while this trusted path advances time.

A single advance still faults when a job it schedules would be due at or before its target; M1-B must segment at earliest due boundaries. M1-A does not implement a clock source, background driver or recurring catch-up.

## death@1 — corpse custody and same-body return (M5-B foundation)

The pure fatal sequence consumes a validated positive-to-zero HP transition. It creates
a distinct corpse identity and initial room custody, then transfers sorted direct held
item roots and roots in the victim body's worn slot holders. Nested descendants remain
in their bags; holders remain on the body; unrelated items stay put. Death custody
transfers emit no item_acquired and bypass voluntary carrying limits. Corpses persist
when empty and have no decay.

`entity_died` names victim, optional victim definition (none for a player body), death
room, killer and credited character where known, and corpse. The producer allocates
attack-result EventId before death EventId before corpse EntityId, with no death RNG.
The actual M6 producer owns lethal loss and encounter/job closure in the same writer
group before this sequence; no public death/damage command or test-only engine verb
exists. The installed combat producer below provides live Attack/round/death/escape integration.

A player returns as the same body and character directly to `world.death.shrine`, with
no fare, gate traversal, clock jump or lineage/story reset. Position recovery settles
the old rate through the fatal clock, then switches to standing. HP/MV restore to the
authored amounts (full pools discard remainder); MA and unrelated story state persist.

Corpses are fixed room containers: Take/Drop/Give/Wear refuse the whole corpse even
by raw ID. Contents of a player corpse are available only to its owner; NPC corpse
contents are public. The shared custody walk and projection enforce the same boundary,
including nested locked bags and ordinary positive-load Take admission. NPCs with
explicit HP0 retain identity and resource provenance but disappear from living room,
scan, targeting, dialogue and Give paths; malformed explicit HP remains corruption.

## combat@1 — first live encounter (M6-A)

Attack admits a living standing character/body and one living explicitly attackable NPC
in the same nonsanctuary room, with no modal scene or open encounter for either participant.
It creates an encounter and its first round job at now + the authored interval; it does
not attack immediately, advance time or draw RNG. The encounter pins character, body,
NPC, room, round and current job. While the encounter is open, the final shared
[ActionSet](protocol.md#actionset-and-admission) allows only Flee, Stand, Look and Scan by
resolved command, after all ordinary contributions. This blocks repeated Attack, directional
Move, dialogue/choices, inventory/equipment/doors, Wait, recipes and Sit/Rest/Sleep, including
aliases and raw commands. Closure restores ordinary actions from state; reopening derives the
same restriction. This focused mode leaves actor-free scheduled rounds and their existing
nonstanding/wake semantics intact.

Rounds follow the frozen [first-encounter oracles](../spec/conformance/first-encounter.md).
Odd rounds give the player the first opportunity; even rounds give the NPC the first.
Revalidate life, room, current occurrence and position before each opportunity. A
nonstanding player skips without a draw. Every eligible attack draws uniform(100), with
strict roll < chance; only a hit with variable damage draws for its inclusive interval.
Fixed damage draws nothing further. Positive damage to a sleeping player is multiplied
and wakes a survivor through ordinary position/recovery settlement. Resting/sitting do
not wake. Checked arithmetic and an eight-raw-draw round budget fault atomically.
Recovery remains active. Successors use the prior due time plus the content interval.

An attack_result names encounter, attacker, target, hit and actual clamped HP loss.
Allocate its event before a fatal entity_died and corpse. The fatal sequence's one writer
group loses HP, closes encounter/completes its current job, then invokes the installed
[death sequence](#death1--corpse-custody-and-same-body-return-m5-b-foundation) exactly once.
The revived body has no remaining opportunity in the closed round. Actor-free run_job
uses the encounter's validated character/body and NPC for owner, killer and credit.

Flee is one directionless action. After prerequisite due work settles, enumerate exits in
canonical direction-key order and retain only those admitted by composed ordinary movement
policy, standing, destination, gate and the authored flee-multiplied fare. Zero candidates
refuses invalid_state without RNG, payment or change; one is deterministic without RNG.
Two or more use one logical uniform selection with the existing rejection sampler and an
eight-raw-draw safety budget. Revalidate the chosen move at that same state. Success pays
once, transfers once, closes once and cancels the pending round, without retaliation; RNG
and destination commit/replay together. Failure discards all changes. During an encounter,
raw directional Move refuses invalid_state; excluded invocation keys and aliases use the
ActionSet boundary refusal and are unavailable in projection,
so they cannot choose an escape direction. Ordinary movement outside combat is unchanged.
Stand retains ordinary piecewise recovery. This supersedes the earlier directional escape
clause under the [owner random-Flee decision](../decisions/owner-decision-m6-a-random-flee-2026-10-04.md).

The content death-credit mapper consumes entity_died at its hydrated proposal prefix,
before adoption, in the fatal writer group. It matches exact authored NPC instance and
definition, required death room, and encounter-validated credited character/body. It
requires that this proposal lost positive HP to zero and created the event's corpse with
matching event/victim/owner origin, configured NPC corpse definition and room custody.
Only then does it assign that player's mapped Boolean fact. Order is attack_result,
entity_died, fact_changed. Corpse Take, forged events, duplicate instances and replay do
not earn credit. Quest acceptance/rewards are later consumers of these facts.
