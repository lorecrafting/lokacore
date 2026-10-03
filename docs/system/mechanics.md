# Mechanics: the rules of each installed capability

Every rule is a pure function `decide(world, command, mint, steps)` returning a
DecisionResult (`kernel/ts/src/decision.ts:192`). Admission, budgets and composition are in
[protocol.md](protocol.md). Refusal codes are gameplay rejections (`protocol/error_registry.json`).
Which capability owns which command, event and policy op: `CAPABILITY_OWNERS`
(`kernel/ts/src/contracts.gen.ts:367`), summarised in the [feature map](../features.gen.md).

The clauses below describe installed behavior. Future character, resource, skill, magic and combat
planning follows the [LegendMUD baseline decision](../decisions/owner-decision-legendmud-baseline-2026-10-03.md);
its reconciliation table must be resolved before an implementation changes these clauses.

## A fresh world

`newWorld(cartridge, context, seed)` (`kernel/ts/src/fresh.ts:26`) mints ids under the nil
CommandId in a fixed order: the player's CharacterId, its body, each room (DefinitionRefString
order), each room's details, each NPC, each item, then one job per NPC with a daily schedule,
then one slot holder per distinct `slot` some item declares, in slot-key order (UTF-8 bytes;
[equipment@1](#equipment1-kerneltssrcrulesequipmentts)). A holder is an entity inside the
body with capacity 1; it is not in `entities`, so no command targets it and no view lists it.
The body starts in `entry`, each NPC in its room, each item at its location; the clock is
`calendar.start` or 0 (`:40`); each scheduled NPC's first job is due at its schedule's first
hour strictly after the start; facts hold their defaults; a world starting after time 0 stores
the body's resources at their start values. One body per world; rules read the actor from the
command and its body from `bodyOf` (`decision.ts:159`).

## movement@1 (`kernel/ts/src/rules/movement.ts`)

`move {direction}`: a direction outside the six compass directions is `invalid_target`
(`:31`); no exit here, `not_found`; an exit through a closed or locked barrier, `exit_closed`
or `exit_locked` (`passage`, `:59`); the move costs the body the cartridge's
`world.movement.cost {resource, amount}`, else (the engine default) 1 mv when the cartridge
declares `mv`, else nothing, and an unpayable move is `insufficient_resource` (`fare`, `:70`).
Per-exit and terrain costs are later (00 §11 chapter three). Accepted
`moved`: the `resource.adjust` (none without a cost), one `entity.transfer` of the body and
`entity_entered_room`. `scan` is accepted `scanned` with nothing to change and no event
(`:29`). The GameView carries `sight` (`:85`) per exit: nothing through a barrier that bars the
way (`passage`), else the destination room and the NPCs and items directly in it. Invariants `player_in_one_room`, `exits_resolve` (`:97`).

## barrier@1 (`kernel/ts/src/rules/barrier.ts`)

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

## containment@1 (`kernel/ts/src/rules/containment.ts`)

An entity's one container is `State.containers`; inventory is what the body contains, never
stored. `take {item_id}`: no entity `not_found`, not an item `invalid_target`, already held
`invalid_state`, out of reach `not_present`; accepted `taken`, `item_acquired`, one transfer
from its container to the body. Custody (c1-locks; `reach`, `kernel/ts/src/lookups.ts:33`): walking up `State.containers`
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
A worn item ([equipment@1](#equipment1-kerneltssrcrulesequipmentts)) is in a slot holder,
not directly in the body: `drop` and `give` of it are `not_owned`, `take` is `not_present`
(the rule is unchanged; remove it first).

## equipment@1 (`kernel/ts/src/rules/equipment.ts`)

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

## description_variant@1 and inspectable_detail@1 (`rules/description_variant.ts`)

`look` with no target: accepted `looked`, nothing changes; the host shows the GameView, whose
room description is the first variant whose `when` holds, else the base (`describe`, `:26`).
`look {target_id}` at a detail of the room, an entity in it, or a held item: unknown id
`not_found`, elsewhere `not_present`; accepted `examined`. A detail's own description is
chosen the same way. Details are named through their aliases ([target resolution](protocol.md#target-resolution)).

## target_resolution@1, policy@1, fact@1

Ruleless. `target_present` is true when the action's target is in reach (`policy.ts:47`,
`target.ts:59`). `policy@1` is `all`, `any`, `not` (`policy.ts:18`). A fact is read and set at
its one declared scope: the actor's for `player`, the world's for `instance`
(`fact.ts:21`); unset means its default; `fact_compare` compares equality. The host appends a
`fact_changed {fact, old, new}` for each `fact.assign` that changes its value, at the assign's
causal position (`fact.ts:108`); an unchanged assign emits nothing. Invariant `facts_typed`.
The leaves `stat_compare` and `resource_compare` are [attributes@1](#attributes1)'s.

## resource@1 (`kernel/ts/src/resource.ts`)

Ruleless. A body's current value is derived from the stored row and the clock: `gain` per
hour boundary crossed, capped at `maximum` (`compose.ts:87`). Costs are paid in order as exact
`resource.adjust` ops; one that would go below `minimum` refuses the whole command
`insufficient_resource` (`pay`, `:67`). A recipe step `resource.adjust` saturates at the bounds
and is dropped when it changes nothing (`adjust`, `:39`; `rules/action_recipe.ts:146`). No
events. The engine pools are hp, ma, mv ([cartridge.md](cartridge.md#compiler)); the GameView
shows each with a condition band and its tone from the pool's own `bands`, else the
cartridge's `world.bands`, else the engine default table ([protocol.md](protocol.md#gameview)).

## attributes@1 (`kernel/ts/src/policy.ts:60`)

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

## check@1 (`rules/action_recipe.ts:109`)

Ruleless, resolved inside `perform`: a `luck` check draws one uniform integer in [0, 100) from
the world's RNG (at most 8 draws, `:103`) and passes below `chance`; a `threshold` check draws
nothing and passes when the body's value of `resource` at admission (before costs) is at least
`difficulty`. It emits `check_passed` or `check_failed` at position 1 and selects the
`success` or `failure` outcome. A rejected command draws no RNG.

## action_recipe@1 (`rules/action_recipe.ts:49`)

`perform {action, target_id?}`: no recipe by that key in the actor's set `not_found`; a target
other than the recipe's detail `invalid_target`; the detail outside the room `not_present`;
then `cooldown` (time since the actor's last admitted attempt below the recipe's cooldown) and
`insufficient_resource` (`actions.ts:249`). Accepted, in one decision: the costs' adjusts;
the check and its event; the chosen outcome's `sequence` in order (`fact.assign` with the
expected value as the steps before left it, saturating `resource.adjust`, `event.emit` as
`custom_event`); `action_completed` unless the outcome is `failure`; a `cooldown.start` when
the recipe has a cooldown (`:73`); a `time.advance` by `duration` after the steps (`:77`),
which is an explicit advance that runs due jobs. A failure commits its costs, draw, cooldown
and time exactly like success. The outcome is `success`, `failure` or `performed` (no check).
The narration is the outcome's `narration.actor` key with its participants pinned to EntityIds
(`:90`). Recipes are offered by the cartridge and by room contributions (ActionSet).

## quest@1 (`rules/quest.ts`, `kernel/ts/src/quest.ts`)

A quest starts through its offer, which is optional, or through a dialogue choice's `accept`
(dialogue@1 below; [owner decision](../decisions/owner-decision-quest-from-dialogue-2026-10-02.md)).
`accept_quest {quest}` is admitted only through the quest's offer (a quest without one has no
accept action), withdrawn once the actor has an instance (`actions.ts:134`), so a second accept
and an undeclared quest are refused before the rule. Accepted: `quest.activate` at player scope and `quest_activated`; the outcome is
`activated_with_possession` when a `current_state` objective already holds, else `activated`
(nothing is stored for it). Objectives: `current_state` (a policy evaluated when needed, never
stored) or `post_activation_event` (met by an `item_acquired` of the named item into the
instance's actor's body, placed after activation; `earned`, `kernel/ts/src/quest.ts:75`), which the proposal
completes to `objectives_complete` as its own writer group. Resolution (`:111`) happens in the
rule that resolves it (a dialogue choice): no open instance `invalid_state`; `active` with an
unmet `current_state` objective `quest_requirement`; else `quest.transition` to
`objectives_complete` (if needed) and `resolved` with the choice as outcome, and
`quest_resolved`. Policy leaf `quest_state`; the GameView journal lists the player's instances.

## dialogue@1 (`rules/dialogue.ts`, `kernel/ts/src/dialogue.ts`)

`talk {target_id}`: a target that speaks no dialogue `not_found`. A speaker may have several
dialogues; the talk opens the first, in key order, whose own policy holds: none holding, or the
actor already having a pending choice, `invalid_state`. Accepted
`choice_opened`: one `choice.open` of a new continuation (ordinal 0 of this command), the
dialogue's roles bound to EntityIds in role-name order, the choice ids in key order, and
`choice_opened`. `choose {continuation_id, choice_id}`: a continuation not pending, not the
actor's or not offering the choice `invalid_state`; a bound NPC not in the room `not_present`;
a bound item not held `not_owned` (`kernel/ts/src/dialogue.ts:66`; the GameView shows the same); then the
dialogue's quest resolves (above), or the choice's `accept` activates its quest as
`accept_quest` does, `invalid_state` when `accept_quest` would be: the actor already has an
instance, or the quest's offer, if declared, has a policy that fails (the talk-time policy may be
stale; `quest.ts` `acceptRefused`). The GameView shows such an accept unavailable with the same
code. Accepted, outcome the choice id, in one decision: the
`hand_over` (an `entity.transfer` of the bound item to the bound NPC and `item_acquired`),
the choice's `fact.assign` steps, the quest's transitions and `quest_resolved` (or the accepted
quest's `quest.activate` and `quest_activated`), `choice.resolve`
at the continuation's `opened_revision`, `choice_resolved`, one narration line with the actor
and every bound role as participants, and the `story_point_reached` of a story point outcome
whose trigger is this dialogue and choice (`rules/dialogue.ts:177`). `close_choice {continuation_id}`: the
actor's pending continuation closes, nothing else (`choice.close`), else `invalid_state`.
While a choice is pending, `choose` and `close_choice` are the actor's answers and no room
contribution removes them (`kernel/ts/src/dialogue.ts:151`). Only a dialogue's speaker, present in the room,
offers its talk (`:138`), one per dialogue under the dialogue's key, available while that
dialogue's policy holds. The loader rejects an `accept` in a dialogue that has a `quest`
(accepting would resolve it) or on a choice with a `hand_over` (activation and acquisition in one
decision conflict), both `OUTCOME_MISMATCH`.

## narration@1

Ruleless: a committed narration line binds its participants' EntityIds at commit (recipe
narration and dialogue choices above); no `narration.emit` consequence, no acknowledgement.

## reaction@1 (`kernel/ts/src/reaction.ts`)

Ruleless, run by the proposal: a ReactionRule triggers on `fact_changed` of its fact or
`entity_entered_room` into its room (`:25`), in rule-key order; its `when` is read on the
proposal so far at the event's logical time; when it holds, its `apply` is a sequence of
`fact.assign` at the actor's scope as its own writer group (`:44`); the `fact_changed` they
emit trigger further rules, FIFO, to quiescence, within the deliveries, `reaction_depth` and
`query_steps` budgets.

## schedule@1, behavior@1, calendar@1 (`rules/schedule.ts`, `kernel/ts/src/behavior.ts`)

`wait {until}`: not later than now `invalid_state` (`:46`); accepted `waited`, one
`time.advance`, no event. Any explicit advance (a wait or a recipe's duration) runs every
pending job due at or before its target, in `(due_time, job_id)` order, each as a `run_job` the
host builds with the job's CommandId; one that is not accepted is the advance's result
(`proposal.ts:253`). `run_job` is authority-internal: a cartridge action may not name it. It
runs one job of an NPC's `daily_schedule` (hour of day → room): a job not pending
`invalid_state` (`:23`); the NPC moves to the room listed for the job's hour unless already
there (an `entity_entered_room` at the job's time), the job completes, and the next job is
scheduled at the schedule's next listed hour, strictly later (`behavior.ts:24`). One unit of
logical time is one second, an hour 3600, a day 86400, time 0 midnight (`behavior.ts:18`;
`policy.ts:42`). `calendar@1` is the cartridge's start time only. Policy leaf `time_window
{from, to}` in hours, wrapping past midnight. Invariant `job_complete_owned_by_run`.

## Engine-wide behaviours

- **Ids are deterministic**: every entity, event, instance, continuation and job id comes
  from the IdSource under its command, so a replay mints the same ids.
- **Composes-with**: a choice composes quest and containment, a recipe composes check, a job
  composes movement (`decision.ts:179`); facts, containment, barriers, resources and the clock
  are the shared vocabulary every mechanic reads through the same policy leaves.
