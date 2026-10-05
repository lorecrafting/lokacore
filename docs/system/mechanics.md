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
not held `not_owned`; authored item `give_allowed: false` refuses `invalid_state`
through the shared projection/admission predicate, including Give of any container
with a protected descendant (absence means allowed for items without protected contents); recipient missing `not_found`, not an NPC `invalid_target`, not here
`not_present`, at its declared capacity `invalid_state` (`:58`, undeclared is unlimited);
accepted `given`, `item_acquired` with the NPC as holder. Composition re-checks custody, cycles
and capacity. Policy leaf `has_item`; invariants `one_container_per_item`,
`containment_acyclic` (`:69`, `:76`).
A worn item ([equipment@1](#equipment1-kerneltssrcmechanicsequipmentrulets)) is in a slot holder,
not directly in the body: `drop` and `give` of it are `not_owned`, `take` is `not_present`
(the rule is unchanged; remove it first).

With authored [`world.carry`](cartridge.md#carrying-settings-and-item-mass), a voluntary
positive-load Take or dialogue receive has a carrying ceiling. After the existing target, directly-held and reach
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

`put {item_id, container_id}` moves an existing directly body-held item into a reachable
item explicitly authored with `container: true` (omitted capacity is unlimited only for
such receptacles). Missing eligibility refuses `invalid_target`; keys, clothes and ordinary
items cannot hold children. Reject missing/non-item targets, a worn or
otherwise non-body-held source (`not_owned`), an inaccessible destination (`not_present`),
a locked/closed lid (`exit_locked`/`exit_closed`), full immediate capacity (`invalid_state`),
and self/descendant destinations (`containment_cycle`). Check custody, lid, cycles and capacity
before transfer/event allocation, charging each inspected row/edge to the decision query counter.
Accepted `put` is one conserved transfer and `item_acquired` with the destination item as holder.
Put has no positive acquisition ceiling: overloaded deposits and body-to-own-bag rearrangements work.
Projection and admission share this pair legality query.

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

## readable@1 (`mechanics/readable/rule.ts`)

A room detail may declare `readable {label, text}`, both catalog TextKeys.
`read {actor_id, target_id}` reads exactly that detail in the actor body's current room.
An unknown ID, entity, room or non-readable detail is `invalid_target`; a declared
readable in another room is `not_present`. Accepted `read` returns exactly one narration
Text with the authored `text` key, empty delta operations/events and unchanged RNG.
Reading and re-reading grant no facts, quests or topics and consume no logical duration.
Normal authority elapsed preflight still advances the clock. Scene/combat admission wins.

The real consumers are the chapter landing notice and the Drowned Lantern board’s two
readable notices. [Board metadata](cartridge.md#notice-board-metadata) and
[local navigation](book-ui.md#notice-board-details) add no Read rule or gameplay write.
This composes existing detail identity/presence, ActionSet admission and authored narration
with receipt replay and Book’s notice detail history; there is no gameplay writer or saved
reading state.
Projection offers each exact present readable target with its authored label and shares
command eligibility. Held books, pagination and topic grants remain later M12 work.
The [PM adoption](../decisions/pm-decision-m12-a-readable-2026-10-05.md) records scope.

## target_resolution@1, policy@1, fact@1

Ruleless. `target_present` is true when the action's target is in reach (`mechanics/policy.ts:47`,
`commands/target.ts:59`). `policy@1` is `all`, `any`, `not` (`mechanics/policy.ts:18`). A fact is read and set at
its one declared scope: the actor's for `player`, the world's for `instance`
(`mechanics/fact.ts:21`); unset means its default; `fact_compare` compares equality. The host appends a
`fact_changed {fact, old, new}` for each `fact.assign` that changes its value, at the assign's
causal position (`mechanics/fact.ts:108`); an unchanged assign emits nothing. Invariant `facts_typed`.
Dialogue-only `fact.adjust {fact, amount}` requires a declared bounded integer fact and a safe
integer amount. Read the current value (including earlier sequence steps), check its type and
bounds, use checked safe addition, then clamp to the authored bounds. Lower to the existing
`fact.assign` in writer group 0; unchanged values emit no event. Corrupt values, unsafe sums
and reserved engine-fact writes fault, never repair. This adds no foundation delta operation.
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
authored `gain_every` boundary crossed, capped at `maximum` (`foundation/resource.ts:59`),
for legacy pools; historical pools without that field retain their installed hour boundary.
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

A quest starts through its offer, which is optional, a quest-resolution reaction, or a dialogue choice's `accept`
(dialogue@1 below; [owner decision](../decisions/owner-decision-quest-from-dialogue-2026-10-02.md)).
`accept_quest {quest}` is admitted only through the quest's offer (a quest without one has no
accept action), withdrawn once the actor has an instance (`commands/actions.ts:138`), so a second accept
and an undeclared quest are refused before the rule. Accepted: `quest.activate` at player scope and `quest_activated`; the outcome is
`activated_with_possession` when a `current_state` objective already holds, else `activated`
(nothing is stored for it). Objectives: `current_state` (a policy evaluated when needed, never
stored) or `post_activation_event` (met by an `item_acquired` of the named item into the
instance's actor's body, placed after activation; `earned`, `kernel/ts/src/mechanics/quest/lifecycle.ts:75`), which the proposal
completes to `objectives_complete` as its own writer group. Resolution (`:111`) happens in the
rule that resolves it (a dialogue choice or typed reaction): no open instance `invalid_state`; `active` with an
unmet `current_state` objective `quest_requirement`; else `quest.transition` to
`objectives_complete` (if needed) and `resolved` with the choice as outcome, and
`quest_resolved`. A typed reaction may instead fail an actor-owned active or
objectives_complete instance with a declared outcome. Failure never reopens a terminal
instance and emits no event. Policy leaf `quest_state`; the GameView journal lists the player's instances.
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
actor's or not offering the choice `invalid_state`; the pinned dialogue policy is
re-evaluated for that actor at Choose and pending-option projection, refusing
`invalid_state` when no longer true; a bound NPC not in the room `not_present`;
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

API1.9 adds an optional authored `riddle {choice_id, answer, bank, wrong}` to a dialogue.
The answer is 1–32 lowercase ASCII letters; the displayed bank is 1–32 uppercase ASCII
letter tiles, including duplicates. Its answer choice must exist and its answer's letter
multiset must fit the bank. `choose` accepts optional `answer` (1–32 ASCII letters) only
for that choice, and requires it there. After the ordinary bound-role revalidation,
ASCII case-folding and bank-multiplicity validation precede comparison. An absent, malformed,
extra or impossible-bank answer refuses without narration or mutation. A bank-valid wrong
answer accepts with outcome `riddle_wrong`, one authored wrong line and no operations or
events: the same pending continuation remains immediately retryable. Correct input follows
the ordinary atomic choice path, including its authored fact consequences and resolution.
No duration, cooldown or new continuation is created for an answer. Close stays available
when a participant leaves or dies. The invocation digest includes the answer.

A choice may declare `receive {item, from}` (without a resolving quest from API1.10) with bound item/NPC role names,
excluding `accept` and `hand_over`. Only that choice's incoming item role substitutes direct
custody by its named NPC for actor-held custody. Every other item role retains its contract.
Choose and its projected availability recheck the same bound live/present NPC, direct reward
custody, current quest objective and terminal state, and shared positive acquisition carry with
one query counter before event allocation. Transfer the saved item identity to the actor body,
emitting `item_acquired` with that body as holder; lower receive, bounded adjustments,
assignments, quest resolution and choice resolution together in writer group 0. The ordinary
proposal joins acquisition quests and reactions. Close remains usable when reward admission fails.

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

**A3 planned extension:** a story point reached by acknowledgement of an exact
`scene_ended` outcome uses its engine-owned player fact marker, including the selected
outcome, for chapter projection. It does not infer completion from a pending or delivered
report. Dialogue-triggered points keep the quest derivation above. Only the matching
final Continue may reach this point; a running scene, screen render and reopen cannot.

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
At `story_point_reached` or an evidenced actor-owned `quest_resolved` matching `on`, the proposal's reaction delivery appends a
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

**A3 planned extension:** Continue binds the scene identity and the line actually shown
when the control was drawn. Admission and the scene rule require both to equal the current
durable scene and line, including for a fresh invocation id or direct Command. An exact
accepted id replays its original receipt before current-state admission. A scene may start
from one exact accepted `action_completed` recipe at the Village Green, with a validated
actor, `market_cross` detail subject and pair-specific once-only condition. Its
acknowledged final end may make
only declared player fact assignments and one typed story-point reach within the same
proposal and shared budgets. No display callback, movement, elapsed settlement or reopen
starts a scene or writes its consequences.

## reaction@1 (`kernel/ts/src/mechanics/reaction.ts`)

Ruleless, run by the proposal: a ReactionRule triggers on `fact_changed` of its fact,
`entity_entered_room` into its room, or exact `quest_resolved {quest, outcome}`, in rule-key order.
For quest resolution, the source instance must exist at player scope, be resolved with the
event's quest/outcome, and agree with its actor and scope; inconsistent evidence faults
`precondition_failed`. The instance's actor owns the delivery. Legacy fact/room triggers retain
the command actor. Its `when` is read on the proposal so far at the event's logical time.
`apply` assigns facts at that actor's scope, activates a declared quest through
`quest.activate {quest}`, or requests typed `quest.resolve {quest, outcome}` and
`quest.fail {quest, outcome}` transitions. Resolve and fail are legal only on a
`fact_changed` trigger, for the trigger's actor; resolve checks the quest objective,
and fail requires an active or objectives_complete actor instance. Neither changes a
terminal instance. Activation is legal only on a quest-resolution trigger; any prior
instance for that actor, including terminal instances, skips activation. The delivery uses
one writer group and causal allocator; its quest-owned `quest_activated` is admitted through
reaction's quest composition, caused by the source event and correlated with the root command.
The resulting events trigger further rules, FIFO, to quiescence, within the deliveries,
`reaction_depth` and `query_steps` budgets. Matching [scene starts](#scene1-mechanicsscenerulets)
follow authored rules in scene-key order, using the same delivery machinery.

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
logical time is defined by the cartridge calendar: positive exact units per hour, hours per day
and displayed subdivisions per hour. Time 0 begins day 1 at midnight. Daily schedules and
policy leaf `time_window {from, to}` use calendar hours, including half-open windows that wrap
midnight; jobs schedule strictly after the current time. The compiler and loader reject hours
outside the authored day, unsafe day products and malformed periods. Optional ordered solar and
lunar phase cuts classify confirmed time; absent sky data produces no sky claim. Legacy
cartridges without the expanded calendar retain their installed fixed-hour meaning.
Invariant `job_complete_owned_by_run`.

## Engine-wide behaviours

- **Ids are deterministic**: every entity, event, instance, continuation and job id comes
  from the IdSource under its command, so a replay mints the same ids.
- **Composes-with**: a choice composes quest and containment, a recipe composes check, a job
  composes movement (`runtime/decision.ts:179`); facts, containment, barriers, resources and the clock
  are the shared vocabulary every mechanic reads through the same policy leaves.
  Scene starts read story_point_reached and write only their own facts; modal ActionSet
  replacement restricts position, equipment and door verbs without edits to those rules.
  Policies/reactions may read scene facts. Reactions compose quest activation and the existing
  scene event-start hook; both use the proposal's single delivery queue.

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

## escort@1

API1.11 adds one actor-keyed typed escort relation. Its immutable identity is
`{kind: escort, actor_id, body_id, npc_id, quest_instance_id, continuation_id, choice_id}`
and its status is following/separated/completed. The continuation and choice name the
original accepted start and bind the same authored NPC. No duplicate start or identity
swap is legal. `escort.transition {actor_id, expected, value}` compares the complete prior
row (null at start); the only transitions are null→following, following→separated,
separated→following and following→completed, retaining every identity field.

An authored dialogue choice may declare `escort {npc, quest, transition}` where npc is
a bound NPC role, quest is a local quest reference and transition is start/rejoin/complete.
Start requires no existing relation, active actor quest, original living co-located NPC
and ordinary dialogue policy/role admission. Rejoin requires the same separated binding,
active quest and physical presence; complete requires following, active quest and physical
presence. Complete must resolve that dialogue's same quest. The shared predicate guards
pending-option availability and Choose. `escort_state {quest, state}` reads only the
actor's typed relation for that quest instance and supports policy and journal selection.

Shared Move/Flee sequence appends the bound living NPC's transfer from the player's
actual source to the same actual destination when following. Ordinary stance, exit,
gate, fare and Flee choice/RNG remain authoritative. Invalid escort presence is a controlled
fault/refusal, never detachment or teleport; refused/composition-failed movement changes
neither. Fatal player death writes following→separated in death's existing writer group
beside shrine return, leaving NPC custody unchanged. No independent fare, roll, pathfinding
or after-commit write exists. Completed relations never follow subsequent movement.

## S2 Chandler's Debt selected contract (pending implementation)

This is the B2 source contract for the real Missing Child chapter, adopted in the
[PM decision](../decisions/pm-decision-b2-chandlers-debt-2026-10-05.md). It is not an
installed capability until the B2 source and its proof merge. Reuse quest, dialogue,
containment, resource, fact, reaction and schedule composition; add only the missing
typed binding and expiry operation required by this consumer.

Peg is always reachable at the chandler. Before logical time 237601 and only while the
actor has never held S2, her accepted offer atomically activates one actor-owned S2,
binds the original Peg, Aldric and ledger EntityIds, transfers that ledger from Peg
directly into the actor's body, and schedules one expiry for that occurrence at 237601.
Activation precedes `item_acquired` credit. A carrying refusal leaves every row and the
pending choice unchanged. No second acceptance or substitute ledger is allowed. At or
after 237601, a never-accepted player may hear that the offer elapsed, without S2,
transfer, job or penalty. The offer before or at 151200 states the on-time cutoff;
between 151201 and 237600 it states that only late delivery remains. The clock continues
through conversation; an offered option is rechecked when chosen.

The turn-in requires the bound living Aldric, present with the actor in the public Chapel
Nave, the actor-owned active S2, and that exact ledger directly in the actor's body.
Ground, bag, corpse, historical possession and an item with the same definition are not
delivery. A command settled at 151200 resolves `on_time`; one at 151201 through 237600
resolves `late`. It transfers the original item to Aldric, records the matching
`priory.tithe_delivered` fact and adjusts the Priory/Fen axis exactly once. On time it
also pays exactly 10 pennies from Aldric's explicit balance to the player; late pays
none. A missing or insufficient funding row refuses the whole outcome without a partial
handoff. Bell allegiance, study closure and unrelated scenes do not change Aldric's
public S2 eligibility. A held modal choice can be closed and the public route remains
available.

At 237601 the actor-bound expiry job runs before input at that clock. If its exact S2
occurrence is still active, it fails with outcome `never`, writes the matching fact and
adjusts Peg trust by −5 once. It leaves the ledger wherever ordinary custody or death
placed it. If the occurrence resolved, was already failed, or the job is stale, it has
no quest, fact, trust or payment effect. Completion cancels or otherwise makes its
pending job inert; a replay cannot act on another occurrence. While S2 is active,
ordinary Give/sale of the ledger or an ancestor container is refused, while Drop,
legal Put/Take and owned-corpse recovery remain available. Expiry removes that active
restriction without restoring custody or extending the deadline.

Pennies use a content-declared, zero-gain ResourceSpec with exact nonnegative balances
on the player body and the bound funding NPC. The chapter declares their starts and
bounds. Payment and later commerce use checked debit/credit in one proposal; neither
saturating `resource.adjust` nor `fact.adjust` counts as a conserved transfer. Missing,
malformed, out-of-range or insufficient participating rows refuse or fault before any
adoption, as appropriate to the trust boundary. Death preserves the same body's balance.
The Priory/Fen axis and Peg trust are separately bounded typed facts, with clamped
adjustments. Resource, fact, quest, binding, job and custody changes commit as changed
rows with one receipt before the host adopts or replies. Reopen validates the occurrence,
participants, item, job, status, facts and participating balances; inconsistent saved
truth is `save_corrupt`, never repaired in place.

The four deadline answers are literal: 151200 on_time, 151201 late, 237600 late,
237601 never for an accepted still-active obligation. These use the B1 chapter calendar
and existing due-before-input order; player Wait and clock skips remain unavailable.

## Peg's immediate shop (B3 selected contract)

At the chandler, the original living Peg offers the finite, authored
[B3 shelf](cartridge.md#pegs-b3-shelf). Buy and Sell bind Peg, one exact item EntityId and
the displayed price. The offer is rechecked against current co-location, direct custody,
catalog eligibility, price, balances and carrying load when executed; a stale view or
forged command has no authority. Reading the shop does not pause the clock. No hours gate
or restock job applies.

The shelf consists of the exact authored items initially held by Peg. An item is in
stock precisely while Peg directly holds it; its identity survives purchase, sale,
death and reopen. Only those authored IDs are saleable, and only while directly held
in the actor's body; worn, nested, ground, corpse-held and other IDs require ordinary
custody actions first or are ineligible. The S2 ledger and any active S2 ancestor remain
protected by the existing Give restriction. There is no mint, stock-count row, abstract
quantity, replacement or automatic restock. Peg's custody is the stock count.

A successful Buy transfers the exact item Peg→actor and its exact price actor→Peg in
one proposal. A successful Sell transfers that item actor→Peg and its declared sale
price Peg→actor. Use B2's checked conserved penny transfer, not saturating resource
adjustment. Reject absent/malformed/out-of-range balance, insufficient payer funds,
recipient overflow, unavailable custody, ineligible item, changed quote, absent Peg,
or positive-load carrying overflow before any effect or RNG consumption. A Buy that
exactly reaches the ceiling succeeds; a neutral transfer keeps the ordinary carrying
rules. The existing query budget covers the custody and carrying checks. Accepted
changes, receipt and narration commit together before adoption or reply; exact retry
returns the same receipt without another item or payment. Saved custody and both
participating balances must reopen as valid current-build truth.

## C1 training and armed defense (selected contract)

**Selected, pending implementation.** [PM adoption](../decisions/pm-decision-c1-tobin-training-2026-10-05.md)
adds the first skills and armed/defense consumer to the installed combat above.
The [cartridge](cartridge.md#c1-tobin-and-equipment) owns every threshold, price,
profile and chance. Qualification is current policy truth, never stored mastery.

`skills@1` owns acquired membership by CharacterId and declared skill reference.
Each skill has one compiler-generated, reserved player Boolean fact, default false;
true means acquired permanently. The skill reference deterministically owns its
fact; duplicates, collisions and non-skill writes to it are rejected. A typed
`skill.acquire` dialogue consequence checks declared identity and false membership,
then lowers to the existing `fact.assign` in the choice's writer group. It is not
a new foundation delta operation. Already acquired refuses before any lesson cost,
gift or result; replay returns the accepted receipt without running this check again.
The shared skills query returns acquired, current qualification and usable
(`acquired && qualified`) separately, using the ordinary VersionedPolicy evaluator
and the command/projection query budget. Failed qualification never clears acquisition.

Tobin's ordered swords, then dodge conversations bind the original living,
co-located teacher. Each completed Choose composes the skill acquisition, exact
conserved actor-to-teacher penny payment, ordinary choice resolution and authored
narration. The swords choice also receives the exact Tobin-held rusty sword through
the installed receive/carry predicate. Subsequent dodge teaching binds no sword.
Both lessons are immediate at every hour; opening Talk grants and charges nothing.
Learning is permitted independently of qualification for use. Recheck teacher,
membership, payment, bound custody and carrying before allocation. An unavailable
gift, insufficient balance, overflow or carrying failure refuses the whole choice;
Close stays available. No replacement sword, extra fee, cooldown or scheduled lesson
is introduced. Reserved acquisition facts cannot be assigned by ordinary recipes,
dialogue assignments or reactions to bypass the skills owner.

At each existing combat opportunity, re-read actual wield/off-hand custody and
usable skill state from its hydrated World. A directly equipped usable sword in
the actor body's `wield` holder selects that item's authored AttackProfile only
with acquired and currently qualified swords; otherwise use the existing unarmed
profile. A held, nested, foreign, removed or undeclared weapon gives no benefit.
No chapter/name/string matching belongs in the resolver.

Resolve accuracy → eligible dodge → eligible shield block → damage. Dodge requires
usable dodge and a living standing defender able to react. Block requires a living
standing defender and a usable actual shield in its body's `off_hand` holder;
it is equipment-based and needs no block skill. An absent/ineligible defense draws
nothing. Each eligible check uses uniform(100), strict roll < authored chance.
Stop after an accuracy miss or successful defense: no later defense, damage,
wake or HP operation. Variable damage draws once; fixed damage draws nothing.
Share the existing eight-raw-draw budget, including rejection draws, across the
whole round and discard the whole proposal on exhaustion or validation fault.

Existing initiative, due-time scheduling, absence/life rechecks, Flee, recovery,
sleep damage/wake and death credit stay in force. A sleeping survivor cannot defend
against the hit that wakes it; a later eligible opportunity may use standing defense.
The old untrained/unarmed no-defense A/B/C behavior remains a current regression
contract. NPCs without defense metadata use their ordinary attack profile; C1 adds
no NPC defense catalog. Learn/Wear/Remove stay unavailable during an open encounter
under the final shared combat ActionSet. Combat owns the attack/defense sequence,
reads skills through its shared query, and composes existing HP/job/death writes;
the authority remains the sole transaction/adoption owner.

## S9 Infirmary Herbs (B5 selected contract)

This consumer is adopted in the [PM decision](../decisions/pm-decision-b5-infirmary-herbs-2026-10-05.md).
It composes containment, carrying, dialogue, quest,
bounded fact adjustment and receipts. [Cartridge stock](cartridge.md#b5-herb-and-bandage-stock)
contains the exact quantities; no engine literal identifies Wick, fenwort or S9.

Chapel Nave north↔Cloister south and Cloister east↔Infirmary west are
public reciprocal exits. The original Wick is living,
present and reachable there at all hours, regardless of bell, child or faction
outcomes. Willow Shade has an inspectable fenwort patch with an explicit finite
set of authored item IDs initially directly in that room. Harvest selects the
lowest eligible EntityId in lexicographic order still directly in the patch's
room, and transfers that one real item into the actor's body. The patch is a
detail, not a new holder or portable container. Its remaining stock is derived
from these IDs' actual room custody. Ordinary Take of those same items is lawful
and consumes the same stock. A dropped eligible item in that room restores its
availability; no elapsed time refills it. Empty stock refuses before any effect.
Positive-load carrying admission, reach and query budgets are the existing Take
rules. No random roll, herbalism prerequisite, mint, count row or regrowth job
exists. Harvest neither deletes nor recreates an item.

Wick offers an explicit S9 acceptance only when the actor directly holds the
required eligible herbs and Wick directly holds the required funded bandages.
The offer creates one actor-owned occurrence bound to Wick; a later explicit
acceptance may replace that actor's resolved S9 with a fresh occurrence identity.
Active occurrences cannot be replaced, and no acceptance or replacement is
implicit in Talk or turn-in. Reacceptance has no time gate and does not reset the
separate player-scoped cumulative S9 contribution. Keep the latest quest row,
not a second quest history store; committed receipts retain older evidence.

Turn-in binds the active occurrence, Wick, the lexicographically lowest required
eligible herb IDs directly in the actor's body, and the lowest required funded
bandage IDs directly held by Wick. Choose rechecks those exact IDs and the living,
co-located participants; a stale binding cannot silently substitute other items.
Ground, worn, nested, corpse-held, foreign-definition and other-NPC herbs are
ineligible until ordinary custody actions restore direct body holding. Current
custody, not historical item_acquired credit, determines readiness.

One accepted exchange transfers all bound herbs actor→Wick and all bound bandages
Wick→actor, resolves that occurrence and applies its permitted S9 contribution
once. Herbs stay at Wick with their original IDs; no deletion/consumed-item sink
is introduced. The three-for-three numbers and faction increment/cap are content.
Check the final actor load after outgoing herbs and incoming bandages using the
shared carry query: equality fits; a positive net acquisition over the ceiling
refuses, while a neutral or load-reducing exchange follows ordinary carrying
semantics. Check recipient capacity, custody, distinct IDs and all participating
facts before effects. Every transfer, fact, quest, choice, event and narration
commits together or none does; no partial herbs-first delivery is possible.

The S9 contribution fact measures only cumulative gain actually awarded by S9,
independently of the global Priory/Fen axis. Requested gain is the smaller of the
authored increment and remaining S9 allowance. Apply B2's global bounds; record
the actual positive axis increase as contribution, so a globally saturated axis
cannot spend unawarded allowance. Never lower contribution on unrelated faction
loss. At the contribution cap, a lawful exchange still gives all its bandages.
An old receipt or continuation cannot resolve or reward a new occurrence.

S9 and all repetitions are optional and never gate the finale, required travel,
C5 learning or possession recovery. Drop, Put, Take and the existing owned-corpse
recovery preserve herbs/bandages and occurrence identity. Retrieval is required
before turn-in; death does not cancel or refill S9. Giving away an herb or bandage
may exhaust this optional supply; explain the unavailable exchange rather than
minting replacements or making the player wait. Any later required consumer of
bandages must adopt an immediate recovery/supply route before it is exposed.

## B4 light and darkness (selected contract)

Planned under the [B4 PM adoption](../decisions/pm-decision-b4-light-2026-10-05.md),
not installed source or proof. The first consumer is the optional Well Shaft detail,
using the real B3 torch and oil; no chapter-required route gains a light gate.
The torch is a reusable oil-soaked wick on a handle, with unchanged B3 identity,
prices, mass and light slot. [Cartridge tuning](cartridge.md#b4-well-and-fuel)
owns every fuel value. Light adds only per-item fuel history and one effective
illumination query; it composes equipment, custody, confirmed time and details.

Each authored source or supply has a required exact-instance fuel row
`{remaining, at, lit}`. Supply is always unlit; a source may be lit. At confirmed
clock `now`, effective source fuel is stored remaining minus elapsed logical units
multiplied by its authored burn rate, clamped at zero. Unlit rows and supplies do
not burn. Arithmetic must remain exact and bounded, including very large elapsed
intervals; compare exhaustion before multiplying an unsafe interval. A query writes
nothing. Effective `lit` requires stored lit and positive effective fuel.
Ignite, Douse and Refuel first settle the old interval to now, then write the new
row. There is no expiry job, per-second write, UI timer or automatic ignition.

Ignite requires a fueled source directly body-held or in the actor's light slot,
and refuses an already effectively lit source. Douse requires that same custody
and stored lit, including an exhausted source. Refuel binds such a source and an
exact compatible supply directly body-held by the actor. Transfer the lesser of
source headroom and supply remaining; preserve excess supply. Empty supply and a
full source refuse unchanged. Refuel preserves effective lit status; exhaustion
stays unlit. Source settlement and supply debit are one atomic writer group.
No refuel can consume foreign, nested, worn or corpse-held supply. Ordinary Take/
Remove must make it directly held first. Custody changes, death, Sell/Buy and reopen
preserve stored fuel and lit history; a lost lit source continues burning.

In a dark room the player has illumination only from an effectively lit source
directly body-held or in their own light slot. Nested, ground, NPC and corpse-held
sources do not illuminate, even when burning. The same bounded query governs
GameView, Look/Scan, detail links, target resolution and direct-command admission;
it charges the existing query budget. Without illumination expose the authored dark
room text and ordinary known traversable exits, inventory, posture and escape controls.
Hide other room details, items and NPC identities and adjacent sight descriptions
unless opted into the later [B6 narrow glow exception](#s4-all-hours-wisp-b6-selected-contract);
raw IDs or guessed keywords cannot bypass this gate. Existing combat restrictions
still win. A visible Exit into a dark room remains traversable; a hidden object is
not an equipment gate on movement.

Darkness exempts the actor's own actual corpses and their ordinary accessible
contents. The ownership/custody walk, locked bag rules and positive-load Take checks
remain authoritative; foreign corpses gain no exemption. Every known route back
from the shrine remains equipment-free. Well Shaft has no new enemy, water hazard,
barrier, required clue or deadline. Exhausted, sold, stored or lost light therefore
cannot strand chapter progress, egress or possession recovery. No free replacement,
shrine teleport or forced-overload recovery operation is added.

## B7 well and waterskin selected contract

**Selected, pending implementation.** B7 supplies the first `liquid@1` consumer:
Fill at Well Lane's authored well detail, Pour between two real obtainable
waterskins, and Drink water. [Tuning](cartridge.md#b7-water-and-vessels) supplies
units, capacity, density and drink amount. [Composition](protocol.md#b7-liquid-composition),
[recovery](save.md#b7-liquid-recovery) and [Book](book-ui.md#b7-water-details)
govern their shared boundary. No hunger/thirst clock, HP/MV benefit, spill, oil
conversion or finite environmental reservoir is selected. B8 must amend this
contract before adding its actual consumption benefit or ale consumer.

Each opted vessel has one exact-instance row `{kind, quantity}`. Empty is exactly
`{kind: null, quantity: 0}`; positive integer quantity names one declared liquid
kind and never exceeds authored capacity. Liquid capability does not imply an
item receptacle: waterskins cannot accept Put of keys or other item entities.
The empty shell persists after drinking; no item is deleted, minted or replaced.

All three verbs require a living actor and usable vessels whose custody reaches
that actor's body, including reachable open nested bags and their own worn
holders. Use the existing bounded custody/lid checks with one query budget;
reach alone also admits room items and therefore does not establish ownership.
Ground, NPC, corpse-held and closed/locked-bag vessels are unavailable until
ordinary Take/open/recovery puts them into eligible custody. Ordinary transfer,
Wear/Remove, Drop, death and shop Buy/Sell preserve the same vessel row and liquid.
No liquid verb transfers ownership, moves the actor or advances logical time.

Fill binds the exact well detail in the actor's current room and one compatible
vessel. It adds exactly its free capacity of the authored source kind. A full
vessel or nonempty different kind refuses unchanged. This source is explicitly
inexhaustible: an admitted Fill introduces water, and is not a closed-system
conservation claim. There is no other liquid issuance path in B7.

Pour binds distinct eligible source and receiver. Transfer exactly the lesser of
source quantity and receiver free capacity, only into an empty or same-kind
receiver. Source empty, receiver full, self-pour or different kinds refuse before
any write. Debit and credit commit atomically; exhausting the source resets its
kind to null. No arbitrary amount input or discard verb is added. Drink requires
at least the liquid's authored positive integer drink amount, consumes exactly
that amount and narrates the committed kind/amount. A smaller remainder refuses
unchanged; there is no partial last serving. Emptying resets kind to null. B7
water drinking changes no HP, MV, needs, faction, money, RNG or clock.

Effective item mass is shell mass plus quantity times the liquid's grams/unit,
in the existing carrying calculation, not a second stored load. Compiler/loader
validate safe integer products and bound each maximum effective item mass by the
existing item-mass limit; runtime checked arithmetic faults atomically on
malformed relevant data. Fill is positive acquisition and requires resulting
load at or below the authored ceiling; it never partially fills to evade that
ceiling. Pour within actor custody is neutral even when overloaded, and Drink
reduces load. Take, Buy and incoming transfer must include current liquid mass;
Drop and recovery move the same contents without refilling them.
## S3 finite watch patrol (C2 selected contract)

**Selected, pending implementation.** [PM adoption](../decisions/pm-decision-c2-watchmans-rounds-2026-10-05.md)
selects an all-hours, player-started patrol led by the original noncombatant Tobin.
The [cartridge route](cartridge.md#c2-watch-route-and-trust) supplies its finite
walk and checkpoints. This is player-follow-leader behavior; it does not change
[escort@1](#escort1)'s NPC-follow-player relation or occupy its actor-keyed row.

The patrol owner retains one typed row per actor's S3 quest instance: original
actor/body/leader, accepted activation choice, current attempt identity, route
cursor, bounded unique checkpoint credit and status together/awaiting/paused/
failed/completed. Start and Restart use their accepted command identity as the
attempt identity; a restart never allocates another quest instance. Every mutation
compares the complete prior row. The leader identity and activation binding never
change; cursor/attempt/status/credit changes obey the transitions below. Authoring
cannot assign patrol state or forge checkpoint credit through ordinary facts.

Start requires standing living co-located participants and activates S3 once, status
together, credit empty, at the authored initial route cursor. Continue rounds, from together, moves
Tobin alone along exactly the next adjacent legal edge and changes to awaiting.
It rechecks the original participants, current cursor, standing living actor and
ordinary passage admission. It invokes shared movement queries, never another
mechanic's player command. Tobin has no scheduled movement. Continue emits only
Tobin's actual movement occurrence; it never transfers the player, skips time,
spends RNG or fabricates a player entry.

While awaiting, the actor's accepted Move/Flee over that exact pending edge joins
Tobin, changes to together and credits the entered checkpoint at most once. Credit
requires the same attempt, living original participants, expected source/destination
and their co-location at the hydrated proposal prefix. Leader departure, starting
co-presence, pre-activation visits, repeated checkpoints and foreign/replayed events
earn nothing. Ordinary stance, passage, movement cost, combat and Flee remain
owned by their existing mechanics. A refusal/fault changes neither movement nor credit.

Any other accepted player departure while together/awaiting pauses the attempt,
retaining its credit and Tobin's actual location/cursor. Walking while paused grants
no credit, including arrival beside Tobin. Explicit standing, living co-located Rejoin changes paused
to together without credit; the next legal leg proceeds from that actual cursor.
An uncredited checkpoint is earned only by a later qualifying entry, at most one
more circuit away. No player inactivity or reading duration fails an attempt.

A real fatal event for the bound player body in together/awaiting/paused changes
the attempt to failed and clears all credit in the same death writer group as corpse
custody and shrine return. Tobin stays where he was. S3 remains active with a failed
attempt, rather than terminally failing and reopening generic quests. Immediate
standing, living co-located Restart replaces the attempt identity, clears credit and sets together
at Tobin's current cursor; the cyclic walk needs at most one circuit for four new
checkpoints. Old-attempt commands/events cannot resume or credit it. Failed-state
walking/revival grants no credit. Existing Wren death separation composes independently.

The fourth distinct qualifying checkpoint atomically marks completed, resolves S3
as `completed` and assigns its reserved player trust fact true, with committed
narration. Completed patrols never move Tobin again or offer restart/rewards.
Trust is recognition only; it opens no required gate and grants no skill, sword,
pennies or item. C1 remains the sole swords/gift lesson consumer. Both resolved
trust and nonterminal attempt failure have retained causal evidence, not room-count
inference. Scheduled hounds, arrest, NPC mortality/replacement and daily patrol AI
are outside this selected consumer.

## S4 all-hours wisp (B6 selected contract)

Planned under the [B6 PM adoption](../decisions/pm-decision-b6-wisp-2026-10-05.md),
not installed behavior or proof. [Cartridge](cartridge.md#b6-marsh-route-and-tuning)
owns the route, attribute, answer, limit and topic. S4 is optional and one-shot;
no night, tide, purchase, fuel, herb, bell, faction or Q2-completion gate applies.

At Marsh Light an authored self-luminous marker exposes **Seek Wisp**, even when
ordinary room details are dark. This narrow perception metadata exposes only the
marker and, after discovery, the original live co-located wisp; it illuminates
neither other objects nor adjacent rooms. It uses B4's shared visibility/admission
query, not a Book exception or a global bypass. Seek, Talk acceptance and answers
require `light_off`: the actor has no effectively lit directly held or light-slot
source. Nested, dropped, stored and corpse-held lights follow B4 unchanged.
Known exits and the actor's actual corpse remain accessible under B4 recovery.

Seek uses a deterministic `check@1` attribute-threshold arm. Read the commanded
actor's declared immutable attribute through the existing attributes query, pass
at equality, draw no RNG, and emit the owned `check_passed/check_failed` with the
recipe reference. Its success sequence alone assigns the player discovery Boolean;
failure leaves it false and offers immediate Seek again. Neither result grants S4
or ward. This extends checks, not attributes, ancestry, skills or progression.
After discovery a bound live/present wisp offers explicit S4 acceptance, followed
by its riddle while that actor's occurrence remains active. These policies are
rechecked at pending-option projection and Choose. Close always remains available.

The riddle retains the installed ASCII case/bank/multiplicity rules. Only this
opted dialogue declares a wrong limit. Its typed continuation count starts at zero;
each bank-valid wrong answer atomically commits one count increment, bound wrong
line and receipt. Below the limit the same continuation remains. At the limit,
close that sitting in the same decision and offer **Ask Wisp again** through the
ordinary bound Talk path, opening a fresh continuation with count zero. S4 stays
active; no terminal failure, cooldown, spawn, departure, job or time advance occurs.
Close/reopen Talk also starts a new sitting; the limit is a conversational pause,
not an anti-cheating quota. No-limit dialogues, including Q2, keep unlimited retry.
Malformed/impossible-bank input and exact invocation replay consume no attempt.

Correct input resolves the original actor-owned S4, assigns `fen_wisp_answered`,
grants the declared ward topic and resolves the choice in one atomic writer group.
A previously known ward never prevents S4 completion or duplicates knowledge.
Topics use a declared player-scoped Boolean mapping: typed `topic.grant` lowers to
existing `fact.assign` only when false; the fact writer owns the mutation. Known
labels derive in key order from those facts. The immediate ward consumer is the
public original Aldric's **Ask about ward** dialogue; it remains independently
selectable even when debt/bell dialogues are eligible. Its informational reply
requires known ward and a live/present Aldric; it changes no spells, resources,
faction, quest or chapter ending. This is one real topic consumer, not a full
conversation graph or a promise of all historical topics.

## B8 Maud's immediate services (selected contract)

**Selected, source implementation pending.** The [PM adoption](../decisions/pm-decision-b8-mauds-services-2026-10-05.md)
selects three all-hours services from the original living, co-located Maud at the
Drowned Lantern. Each accepted service immediately exchanges the exact quoted
pennies for its declared benefit in one proposal. A meal is eaten and a serving
of ale is drunk as part of that transaction; neither purchase creates an item
waiting for a later Eat/Drink. This deliberately replaces the provisional
purchase-then-consume recommendation and the historical hunger/drunk formulas.

Room grants one durable actor-scoped Boolean `lantern_bed_paid` for the current
save lineage. Its immediate consumer is the actual bed detail in Inn Rooms,
whose paid description and ordinary Rest offer become available. Renting changes
no position, rate, clock, HP/MV, slept fact, quest or dream state. A new rental
when already entitled refuses without payment. Ordinary unpaid Rest and all
upstairs, attic, cellar and corpse routes remain legal. Entitlement survives
death/reopen and has no night expiry or automatic renewal. B9 alone owns the
first qualifying actual accepted Rest at Inn Rooms after payment; earlier unpaid
Rest and rental are not retrospective dream credit. Already resting must Stand
then Rest for a new accepted transition; B8 adds no Rest event/dream writer.

Meal consumes one unit of Maud's finite nonregenerating meal-stock ResourceSpec
and grants its authored capped MV increment on the actor body. Drink consumes
one complete authored serving from the exact Maud-owned ale vessel's B7 liquid
row and grants its authored capped MV increment. Strict B7 last-serving refusal
applies: insufficient quantity never buys a partial drink. Exhaustion preserves
the same empty vessel shell. The shared service query proves original provider,
living actor/provider, co-location, exact service reference/quote, unowned room
entitlement or available stock, exact conserved funding and positive MV headroom.
Meal/drink at full MV refuse before charging or consuming. Near the maximum the
benefit caps; the displayed offer declares that cap. No HP/MA recovery, passive
hunger/thirst, intoxication, carrying acquisition, food issuance or restock job
is added. B7 water remains benefit-free and refill cannot introduce ale.

Service owns admission and lowering: payment uses B3's exact debit/credit query,
room uses existing fact assignment, meal stock uses exact resource debit, and
MV uses existing resource settlement/capped adjustment. Liquid owns the shared
pure exact-serving query/transition used for the provider-bound ale consequence;
service never calls another rule or fabricates an actor-owned Drink. All writes
share one writer group and query budget. Normal authority elapsed preflight,
scene/combat admission, freshness and receipt replay precede this work. S1 Talk,
accept/turn-in and earned chest/key remain reachable in every quest state;
services are separate direct offers, not a first-eligible dialogue replacement.
