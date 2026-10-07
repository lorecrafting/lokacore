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

`newWorld(cartridge, context, seed)` (`kernel/ts/src/runtime/fresh.ts`) mints ids under the nil
CommandId in a fixed order: the player's CharacterId, its body, each room (DefinitionRefString
order), each room's details, one instance from each ordinary NPC [blueprint](glossary.md),
one from each ordinarily placed item blueprint, then one job per NPC with a daily schedule,
then one slot holder per distinct `slot` some item declares, in slot-key order (UTF-8 bytes;
[equipment@1](#equipment1-kerneltssrcmechanicsequipmentrulets)). NPCs marked `spawn_template`
and items at `location.in: template` are definitions only at this stage; they receive no
ordinary instance or placement. A slot holder is an entity inside the body with capacity1;
it is not in `entities`, so no command targets it and no view lists it. A food-enabled world
then mints its single roomless terminal [consumed holder](#d4-homes-finite-apples-and-eat-selected-contract).
Bounded population initialization follows using the same mint sequence: each authored plan
creates its admitted initial slots/members and optional held loot, then its control job.
Population state, origins, HP and custody are composed before play; template definitions
never appear as extra ordinary NPCs or items. The [current allocation oracle](cartridge.md#current-bundled-chapter)
pins this complete order.
The body starts in `entry`, each ordinary NPC in its room, each ordinary item at its location; the clock is
`calendar.start` or 0; each scheduled NPC's first job is due at its schedule's first
hour strictly after the start; facts hold their defaults, with no record until the first change
(so the [position](#position1-kerneltssrcmechanicspositionrulets) fact adds nothing to a fresh state); a world starting after time 0 stores
the body's legacy resources at their start values. Every opted recovery pool has a required
player-body row at the birth clock, including zero, with its authored start, standing rate
and zero remainder ([resource@1](#resource1-kerneltssrcmechanicsresourcets)). One body per world;
rules read the actor from the
command and its body from `bodyOf` (`runtime/decision.ts`). When `knowledge@1` is opted in,
fresh creation records the entry room for that character and observations of exactly the
visible co-present NPCs at the birth clock, after population initialization. This grants
no remote map knowledge. A chapter declaring ancestries starts without a selected character
row; [D11 selection](#d11-character-choice-selected-contract) precedes ordinary player commands,
while trusted elapsed updates retain their separately authorized admission.

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

<a id="barrier1-kerneltssrcrulesbarrierts"></a>

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

<a id="containment1-kerneltssrcrulescontainmentts"></a>

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

<a id="equipment1-kerneltssrcrulesequipmentts"></a>

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

<a id="position1-kerneltssrcrulespositionts"></a>

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
command eligibility. The selected [D2 held-book extension](#d2-held-books-and-public-priory-selected-contract)
adds item Read and declared grants; pagination remains deferred. Ordinary room
notices retain the eventless/no-topic contract above.
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
The leaves `stat_compare` and `resource_compare` are [attributes@1](#attributes1-kerneltssrcmechanicspolicyts60)'s.

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

<a id="attributes1"></a>

## attributes@1 (`kernel/ts/src/mechanics/policy.ts:60`)

An attribute starts from the definition `AttributeSpec {key, start}` in the cartridge's
`attributes` map (source `attributes.json`, [cartridge.md](cartridge.md#source-layout));
the engine declares no world stats. The installed [D11 writer](#d11-character-choice-selected-contract)
commits `character.select` with the chosen ancestry and complete attribute values in
`state.characters[CharacterId]`. These values belong to the character, never its replaceable
body. `attributeValue` reads that character row when present, otherwise the definition start;
policy, recipe thresholds and skill qualification share this lookup. Actors and cartridges
without a selected row retain definition starts. No training/equipment attribute writer is installed.
`attributes@1` owns two 06 §21 leaves, each `{<ref>, at_least}` (a ResourceInt; "below" is
`not`, a range `all`): `stat_compare {attribute, at_least}` holds when the actor's value is at
least `at_least`; `resource_compare {resource, at_least}` when the current value of the pool
on the actor's body, as [resource@1](#resource1-kerneltssrcmechanicsresourcets) derives it and before the action's costs, is.
Both fail closed: an actor without a body reads no pool, and the compiler and loader reject an
unresolved reference or a leaf whose owner the lock lacks (`UNDECLARED_CAPABILITY`). Not
`resource@1`'s: a new op would take `resource@2`, re-deriving every v2 lock and hash.

## D11 character choice (selected contract)

The [D11 decision](../decisions/pm-decision-d11-character-choice-2026-10-06.md) selects four immutable, once-only character ancestries before ordinary play. [Chapter declarations](cartridge.md#d11-ancestry-declarations-selected-contract) own the six starting values, four modifiers and ancestry effects; [save](save.md#d11-character-choice-recovery) owns durable choice identity; [Book](book-ui.md#d11-character-choice-interaction) owns the initial control. This extends `attributes@1` from definition-only starts to per-character values. Both policy `stat_compare` and the B6 Seek recipe's direct `attribute_threshold` check must read the selected actor's value; C1/D12 skill qualification, B4 darkness and B2 Priory/Fen axis also consume the selected state. No world number is hardcoded in the engine.

Fresh play requires one selected key from the pinned chapter's four declarations. No elapsed timer, default choice, preview render or browser refresh selects one. One accepted authority command commits that exact character's choice, its six values, starting acquired skill where declared and initial faction adjustment in one proposal. A different later choice refuses without change; replay of the same invocation returns its original receipt. No training or equipment writer is added. Death moves the body/custody as already specified but retains character identity, attributes, skill and faction. New game uses the existing explicit Start over boundary.

Under the [owner's elapsed ruling](../decisions/owner-decision-d11-prechoice-elapsed-2026-10-06.md), trusted schedule-owned elapsed updates may advance the clock and due jobs before selection. They do not choose an ancestry or open player command admission.

`stat_compare` and `attribute_threshold` read the selected character value after choice on each check; neither caches qualification. STR, DEX, INT and PER have installed check consumers. CON and SPI are saved/displayed but have no Chapter 1 stat-check consumer. Hill-folk's dark-sight exempts only the selected character from B4's missing-light visibility gate, both in their current room and when ordinary Scan projects a legal adjacent dark destination. It does not create a lit source or change `illuminated`; B6 `light_off` therefore retains its physical-light answer, including Seek and Talk for a hill-folk character. Barred passages still stop Scan, and hidden-exit, closed-door, custody and other perception checks still apply. No spell/mining/Crown track, derived resource or generic vision framework is selected. D6 swimming still requires real acquired and currently qualified Swim under its own no-CON rule; D12 Haggle follows its DEX/MV rule. B6 difficulty5 must remain immediately passable for all four selected ancestries.

Compiler, loader, command admission and composition reject unknown choices, partial or
contradictory effects, malformed values and attempts to change identity. The [D11 source review](../reviews/2026-10-06-d11-character-choice-primary-review.md)
records the independent checks and fixed findings. Preproduction pin mismatch refuses
explicitly without deleting or retargeting a save. Obsolete development compatibility follows
[forward-development policy](../decisions/owner-decision-forward-development-2026-10-05.md).

The source shape is `choose_ancestry {actor_id, ancestry}` under `attributes@1`. An authored, closed `ancestries` map gives each key its label, one attribute modifier, optional acquired skill, optional faction starting value and optional dark sight. The accepted decision writes one `character.select` row keyed by CharacterId containing the ancestry key and complete attribute values, with any acquired-skill and faction facts in the same decision and receipt. Composition admits this row only when absent. No ordinary player command is admitted before selection. The saved row is immutable and survives body replacement; the selected attribute lookup reads it for the player and falls back to definition starts for actors without a selected character row.

## check@1 (`mechanics/action_recipe/rule.ts:109`)

Ruleless, resolved inside `perform`: a `luck` check draws one uniform integer in [0, 100) from
the world's RNG (at most 8 draws, `:103`) and passes below `chance`; a `threshold` check draws
nothing and passes when the body's value of `resource` at admission (before costs) is at least
`difficulty`. B6's `attribute_threshold` arm also draws nothing and compares the commanded
actor's attribute to its authored difficulty; D11 selects the saved character value as its
source after creation. It emits `check_passed` or `check_failed` at position 1 and selects the
`success` or `failure` outcome. A rejected command draws no RNG.

## action_recipe@1 (`mechanics/action_recipe/rule.ts:49`)

`perform {action, target_id?}`: no recipe by that key in the actor's set `not_found`; a target
other than the recipe's detail `invalid_target`; the detail outside the room `not_present`;
then `cooldown` (time since the actor's last admitted attempt below the recipe's cooldown) and
`insufficient_resource` (`commands/actions.ts:223`). Accepted, in one decision: the costs' adjusts;
the check and its event; the chosen outcome's `sequence` in order (`fact.assign` with the
expected value as the steps before left it, saturating `resource.adjust`, `event.emit` as
`custom_event`); `action_completed` unless the outcome is `failure`; a `cooldown.start` when
the recipe has a cooldown (`:73`); a `time.advance` by `duration` after the steps (`:77`),
which is an explicit advance that runs due jobs. A failure commits its costs, draw, cooldown
and time exactly like success. The outcome is `success`, `failure` or `performed` (no check).
The narration is the outcome's `narration.actor` key with its participants pinned to EntityIds
(`:90`). Recipes are offered by the cartridge and by room contributions (ActionSet).

<a id="quest1-rulesquestts-kerneltssrcquestts"></a>

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

<a id="chapters-kerneltssrcviewts"></a>

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

Dialogue-triggered points derive from existing quest state
([chapter-one plan](../decisions/owner-decision-chapter-one-plan-2026-10-02.md),
§3 slice 9 and §6; the owner's chapter-marker addition). Scene-end points use the
persisted marker described below. To keep this derivation unambiguous, a counted
trigger is rejected if another dialogue resolves the same quest with the same choice id;
[the compiler and loader check](cartridge.md#compiler) fails closed with the existing
`OUTCOME_MISMATCH` code. This narrow check is the PM's continuing-workflow choice,
not an explicit owner response to the chapter brief's Q4.

**A3 completion:** a story point reached by acknowledgement of an exact
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

The installed subset of archived 06 §33–§37 and 21 §3.6 has two closed control modes.
A `modal` SceneDefinition starts from a declared story-point, quest outcome or bound
accepted action, and has n≥1 `narrate {text}` steps followed by `await_ack`, then `end`.
It is not skippable or restartable. Its optional validated `on_end` atomically assigns
declared player facts and reaches one story point; [A3](cartridge.md#a3-green-finale)
consumes this completion. B9 adds the anchored, resumable `presentation_only` Rest dream,
with its bounded choice/branch and final quest acknowledgement; its exact step and
availability rules live in [S10](#s10-lantern-rest-and-dream-b9-selected-contract).
Arbitrary overlays, scripts, role bindings, checkpoints and consequence beats remain later.

For modal scene key k, the compiler adds `<id>@<ver>:fact/scene_<k>` exactly as follows
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

While the actor's modal scene fact is in 1..n, the resolved ActionSet is replaced by only
`continue` (target none, exact input `{scene, line}`, `action.continue`). Normal admission refuses
all other commands with `unsupported_capability`, through invocation or direct
Command alike, before effects or clock changes. Every exit advertises the same
refusal. The GameView includes `scene {scene, line, index, count}` exactly while
running; line is the current narrate TextKey, index is one-based and count is n.

`continue` at i < n returns `continued`, one fact.assign `expected: i, value: i+1`,
no rule event. At n it returns `ended` with the cursor assign `expected: n, value: -1`,
any declared `on_end` fact/story-point assignments, then `scene_ended {scene}` and,
when declared, `story_point_reached`. Event positions follow all changed facts, leaving
their causal positions for the host's `fact_changed`; without final consequences,
`scene_ended` is at position2.
The final continue acknowledges the last line and runs end: await_ack adds no wait.
All continuation uses the command's actor. No running scene is the rule's defensive
`invalid_state`; ordinary admission refuses continue as `unsupported_capability`.
SCENE-01 has headless line-2 reopen and actual Release Simulator terminate/relaunch
proof in the [touch review](../reviews/2026-10-03-c1-touch-review.md) and its
[native evidence](../evidence/c1-touch/README.md). SCENE-03 and QUESTSCENE-01's
start-once half are covered by the [scene review](../reviews/2026-10-03-c1-scenes-modal-review.md).
Every Continue binds the scene identity and the line actually shown
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

<a id="schedule1-behavior1-calendar1-mechanicsschedulerulets-kernelts-srcmechanicsschedulebehaviorts"></a>

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
[ActionSet](protocol.md#actionset-and-admission) allows Flee, Stand, Look and Scan by
resolved command, after all ordinary contributions; [C5](#c5-hound-bleeding-and-bandage-selected-contract)
later adds only its exact bandage treatment. This blocks repeated Attack, directional
Move, dialogue/choices, other inventory/equipment/doors, Wait, recipes and Sit/Rest/Sleep, including
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

<a id="s2-chandlers-debt-selected-contract-pending-implementation"></a>

## S2 Chandler's Debt selected contract

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

[PM adoption](../decisions/pm-decision-c1-tobin-training-2026-10-05.md)
adds the first skills and armed/defense consumer to the installed combat above.
The [cartridge](cartridge.md#c1-tobin-and-equipment) owns every threshold, price,
profile and chance. Qualification is current policy truth, never stored mastery.

`skills@1` owns acquired membership by CharacterId and declared skill reference.
Each skill has one compiler-generated, reserved player Boolean fact, default false;
true means acquired permanently. The skill reference deterministically owns its
fact named `skill_<key>`; duplicates, collisions and non-skill writes to it are rejected. A typed
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

Selected under the [B4 PM adoption](../decisions/pm-decision-b4-light-2026-10-05.md),
the first consumer is the optional Well Shaft detail,
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

The [selected D11 hill-folk effect](#d11-character-choice-selected-contract) permits that
character to perceive ordinary current-room and legal adjacent-room dark content
without a physical source. This changes darkness visibility, including Look/Scan
and direct-command admission, while `illuminated` remains false. B6 `light_off`
continues to test actual carried/worn lit fuel; hill sight neither douses a source
nor makes one lit. A barred exit, hidden passage or separate perception policy
still wins over sight into darkness.

Darkness exempts the actor's own actual corpses and their ordinary accessible
contents. The ownership/custody walk, locked bag rules and positive-load Take checks
remain authoritative; foreign corpses gain no exemption. Every known route back
from the shrine remains equipment-free. Well Shaft has no new enemy, water hazard,
barrier, required clue or deadline. Exhausted, sold, stored or lost light therefore
cannot strand chapter progress, egress or possession recovery. No free replacement,
shrine teleport or forced-overload recovery operation is added.

## B7 well and waterskin selected contract

B7 supplies the first `liquid@1` consumer:
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

[PM adoption](../decisions/pm-decision-c2-watchmans-rounds-2026-10-05.md)
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

Installed under the [B6 PM adoption](../decisions/pm-decision-b6-wisp-2026-10-05.md),
using the selected contract. [Cartridge](cartridge.md#b6-marsh-route-and-tuning)
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
actor's selected character attribute after D11 choice (otherwise its definition start), pass
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

## C3 bounded living hounds (selected contract)

[PM adoption](../decisions/pm-decision-c3-living-hounds-2026-10-05.md)
selects the first dynamic population consumer; [cartridge](cartridge.md#c3-hound-population-and-loot)
owns its bounds, periods, area and profiles. C3 hounds engage only on deliberate
Attack using C1's single-opponent resolver. C4 owns aggression, pack assistance and
enemy flight; C5 owns actual bleeding. No hound is a required quest objective.

One instance-scoped plan owns a fixed ordered set of separately targeted slot rows,
numbered1 through its declared cap. A slot retains its generation, exact current
hound identity and optional death-to-replacement due time.
Never-used slots have generation0, null member and null due time. Occupied slots
start at generation1; a living member has null replacement due. A proven fatal HP
transition retains the dead member identity and sets due = fatal clock + declared
replacement delay in the same fatal writer group. Only then may a slot replace it
at or after due, incrementing generation and allocating a fresh hound and pelt.
Old identities, HP0, corpses and taken loot remain; they are not active membership.

The first daytime-target slots can fill at every hour; extra nighttime-target
slots can fill only in the authored night window. Existing live extra members
remain at dawn. Count all plan-owned living members across both allowed rooms,
not only the home room; never count authored rats or another plan's animals.
An eligible never-used slot fills immediately; a dead slot respects its due time
even when night raises the target. No silent live retirement, corpse decay or
population-disable consumer is selected. This bounds live membership and scheduled
work, not total historical corpse/identity/save size.

Fresh worlds initialize the same checked bundle/state transition used by live
replacement, under the existing genesis allocator. One current plan-owned job
handles all slots, in slot order. Its successor is due at the earliest next wander
boundary, day/night target boundary or eligible replacement time, strictly after
this occurrence. Ignore past due times for night-only slots while ineligible;
the next night boundary reconsideration prevents a zero-time loop. Require wander
interval <= replacement delay. The current plan job is no later than the next
wander boundary, hence no later than a newly fatal member's replacement due. Death
writes only that slot's eligibility; it never reschedules or writes plan control.
Existing due ordering, segmentation and shared command budgets apply; plan work
cannot scan historical created rows to find its six current members.

Equal-time combat and population jobs retain canonical `(due_time, job_id)` order
and distinct writer groups. Population dispatch changes only actual birth/replacement
slots, never unchanged living or not-yet-eligible dead slots. Thus population-first
skips the engaged hound before fatal combat; combat-first leaves a dead slot whose
new due is strictly later, which population skips. Both advance the separate plan
control once and conserve the same fatal slot/corpse/pelt. No whole-plan slot rewrite
or cross-writer exception is permitted; see [targets](protocol.md#c3-spawned-bundles-and-population-composition).

At a wander boundary each living, unengaged member alternates between the two
adjacent declared rooms through ordinary legal movement. A blocked edge leaves it
in place; it spends no RNG or player MV. A newly spawned member stays at home for
that occurrence. An open encounter suppresses its voluntary wander; dead members
never move. No hound enters the required rescue/shrine corridor. Replacement and
wandering grant no quest, skill, kill credit or money. Immutable template metadata
never stores instance HP or location; every query and combat job uses the actual
runtime EntityId. The created hound's lethal producer uses its declared hound corpse
and transfers its same directly held pelt through ordinary death custody once.

Combat loss leaves an immediate safe return/recovery route; surviving hounds can
be deliberately retried now, and defeated hounds' loot is immediately available.
No required chapter path or Book proof waits for a replacement or night.

## C4 hound response, pack assistance and flight (selected contract)

[PM adoption](../decisions/pm-decision-c4-hound-behavior-2026-10-05.md)
extends C3's deliberate fight with bounded pack help and wounded flight. Entry,
reading, elapsed time and night never initiate hostility. This selects response
to player aggression and defers the provisional night-auto-aggression proposal
and archived population's aggressive20–6 behavior. No required route, loss retry,
owned-corpse recovery or first proof depends on night or replacement.

Attack keeps installed standing/life/co-location/sanctuary/modal admission and
binds the exact attacked EntityId as primary. For a proven C3 hound whose plan
declares pack assistance, admit that hound plus all currently living, co-present,
unengaged members of that exact plan, in canonical EntityId order. Inspect its
fixed slots before traversal; the roster cannot exceed the plan cap. Members in
another room/plan, retired generations, corpses and authored NPCs cannot join.
Admission occurs once in Attack's writer group with one encounter/round job, no
damage/RNG and narration naming actual helpers. There is no later join, pursuit,
remote assistance or helper job. Other opponents retain single-member encounters.

The encounter owns an ordered unique active roster, primary and next-opponent ID.
Initially primary and next opponent are the attacked hound, even when it is not
the lowest ID. At each round, prune absent/dead members and repair removed primary
to the lowest remaining ID; repair a removed cursor to its next greater remaining
ID, wrapping to the lowest. Lock that round's selected opponent before either
opportunity. Retain exactly two opportunities: player against current primary,
and the selected opponent against the body. Odd rounds are player-first, even
rounds opponent-first. If the selected opponent dies/departs during the first
opportunity, skip its slot without replacement or RNG; another helper does not
inherit the lost opportunity. At round end set the next opponent to the next
greater remaining ID after the selected ID, wrapping. Primary stays until it
leaves. Revalidate exact life/presence/job immediately before each opportunity.
Thus assistance supplies a real rotating opponent attack, never one attack per
helper. Share C1's attack/defense resolver and the eight-raw-draw round budget.

Immediately before its selected opponent opportunity, a living co-present hound
strictly below its cartridge HP-fraction threshold attempts flight before attack.
Compare with checked integer arithmetic; do not round a percentage. Enumerate
ordinary legal adjacent NPC transfers inside the declared population area in
canonical direction order, using shared policy/work budgets. Choose the first
legal exit deterministically, with the declared zero animal fare, no player MV,
key use, RNG or clock advance. If none is legal, perform at most that ordinary
opponent attack. Flight transfers the same hound once, preserving injury and its
same held pelt, removes it from the encounter and records its slot's last-flight
clock in the same group. It creates no corpse, kill credit, loot or replacement.
Nonselected injured members wait only for their bounded rotating opportunity;
no extra timer or player Wait is introduced. Voluntary wandering stays suppressed
for active members and at the exact last-flight boundary; see
[composition](protocol.md#c4-pack-encounter-and-flight-composition).

After departure/death, repair primary/cursor as above and narrate the new exact
primary. With no remaining members close once and cancel/complete the current job.
A hound's fatal sequence still writes only its own C3 slot and transfers its actual
pelt to its own public corpse. Player death closes the entire encounter before
same-body shrine return; no helper strikes the revived body. Player Flee retains
its existing standing, legal-exit, fare, RNG and budget checks, moves once and
closes the entire roster without retaliation. It is an immediate action when its
ordinary prerequisites hold, not an unconditional free escape. Outside combat,
all hounds are passive, so gear-free corpse recovery and immediate deliberate
retry of a surviving hound need no time gate. No behavior framework is required.

## D1 paid ferry and Sedge lesson (selected contract)

The first chapter ferry is an unattended rope ferry operated from an inspectable
boarding detail at the Boathouse and Fen Isle Landing. A successful outbound
crossing moves the living standing actor body from Boathouse to Fen Isle Landing
once, charges **2 pennies** to Mother Sedge's declared balance, and carries a
valid co-present following Wren at no extra charge. The return moves body and
eligible follower from Fen Isle Landing to Boathouse for **0 pennies**. This is a
transport action, not an ordinary compass exit or a B8 `service@1` benefit:
that published command requires a co-located living NPC and its closed benefit
union has no movement case. The transport admission binds the exact endpoint,
destination, quoted fare and declared recipient. It reuses B3's exact two-party
resource transfer for the positive fare and the existing movement/escort transfer
consequences in one writer group. No MV charge or time jump is added; normal
authority elapsed preflight still applies. Crossing is not Elspeth rescue credit.

The outbound fare is waived only when the actor owns an actual nonempty corpse
on the isle. Its current room custody and contained roots, including nested
descendants, are checked through the existing corpse/containment owner. An empty
corpse, someone else's corpse, a mainland corpse or client assertion cannot waive
payment. The recovery passage remains available at zero balance and with no
gear. A refused, stale or blocked crossing moves and charges nothing. Exact
receipt replay moves and charges once; unknown commits fence input until resolved.
Known exits and owned-corpse visibility in a dark Hut Loft obey B4; the isle
route must permit gear-free recovery of actual belongings from the Chapel Nave
death return. D1 does not move the shrine destination to Isle Shrine.

Mother Sedge stays reachable in Isle Hut at every hour. Her co-located, free
**Learn swim** dialogue choice uses C1's reserved `skills@1` acquisition owner.
It grants learned swim once, refuses an already learned new choice without
grant or charge, and survives death/reopen. Learning does not itself assert
current water qualification or open D6 bottom rooms. S27 may acknowledge this
existing lesson; it cannot gate it. No quest, discount, herbalism lesson, token,
schedule or island enemy is part of D1.

## B8 Maud's immediate services (selected contract)

The [PM adoption](../decisions/pm-decision-b8-mauds-services-2026-10-05.md)
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
when already entitled refuses without payment. Only service writes its opted
entitlement fact; ordinary authored assignments cannot grant or revoke paid truth.
Ordinary unpaid Rest and all
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
entitlement or available stock and exact conserved funding. Positive MV headroom
is required only for meal/drink; room rental remains available at full MV.
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

## D2 held books and public Priory (selected contract)

Installed under [PM adoption](../decisions/pm-decision-d2-priory-books-2026-10-05.md),
D2 completes the ten public Priory rooms through the reciprocal
[authored route](cartridge.md#d2-public-priory-and-book-authoring). Movement retains
its ordinary cost and position rules; no key, light, topic, bell/faction outcome,
NPC schedule, fare, water skill or time window gates this extension. These are
safe walking rooms, not a new hazard. Aldric remains public in Chapel Nave;
S2/S4/Q3 and Wick's S9 stay independently usable. Study's ledger is descriptive,
never a second Peg ledger. Future private gate/crypt and far Scan are excluded.

A readable item declares one authored text and at most one declared topic. The
existing actor-bound Read command accepts the exact original book only while
it is directly held by that actor's body or reachable inside an open chain of
held containers. Reuse the bounded custody walk and actor/body lookup, sharing
one command query budget. A closed or locked ancestor, ground/room custody,
foreign holding, worn-only custody or corpse custody does not qualify; a declared
book outside this held reach refuses `not_present` before narration or grant.
Unknown/non-readable targets remain `invalid_target`. Projection and raw admission
use the same eligibility. Take, Look/Examine, opening details, text rendering and
ordinary notice Read grant nothing. No keyword or same-key object substitutes
for the original target identity and pinned definition.

Accepted book Read narrates its one declared text and lowers the optional topic
grant through [B6's declared Boolean mapping](#s4-all-hours-wisp-b6-selected-contract).
Readable owns the text; topic lowering owns idempotence; facts owns the knowledge
write. Already-known Read still narrates, but adds no second grant/write. RNG and
logical duration remain unchanged; authority elapsed preflight and schedules keep
running. Ward from either lawful source enables the same public Aldric ward
conversation; Bell is a real known-topic entry, not Q3 activation, permission,
resolution or spell acquisition. No quest, faction, resource or skill is awarded.

Dropping/storing/giving a book moves its real identity and never unlearns a topic.
Death preserves knowledge and puts the actual held books in ordinary owned-corpse
custody; gear-free shrine routes permit recovery, then ordinary Take/Read. Optional
books given away need no replacement or mint and cannot strand a required path.

## S10 Lantern Rest and dream (B9 selected contract)

The [PM adoption](../decisions/pm-decision-b9-lantern-dream-2026-10-05.md)
extends position/scene/quest at this first consumer. The first accepted actor-owned
`rest` transition at actual `inn_rooms`, with B8 `lantern_bed_paid=true` and
`slept_at_lantern=false`, sets that declared player fact true and activates the
actor's sole S10 instance in the same proposal. This is causal post-payment
credit: unpaid earlier Rest, rental, Sleep, menu/display, elapsed time, reopen,
refused already-resting Rest and another actor's transition never count. Payment
while already resting requires a new accepted Stand→Rest. No wait for night,
MV deficit, elapsed sleep duration or chapter/quest prerequisite is required.

Position emits typed `rested {body_id, room_id}` only after the actual accepted
transition and old-rate settlement; actor/scope/root cause identify that exact
occurrence. The consequence reads the causal hydrated prefix, including paid
eligibility, actual body/room and prior position, not today's unrelated last
receipt. Reaction owns the guarded first-Rest fact/quest activation; scene owns
its checkpoint start. Shared delivery ordering, query/output budgets and one
writer per target apply. No named Lantern switch or second Rest writer belongs
in position. The room/fact/quest/scene binding is cartridge data.

S10 has no failure/repeat/abandon reward path. Its current-state objective is
`dream_seen=true`, but only the exact acknowledged dream end may set it and
resolve S10 with outcome `acknowledged`. First Rest starts one durable dream
checkpoint at beat1 in that same proposal. Confirmed presentation opens only
when safe; another interaction defers presentation, never the saved start.
Resume at the actual bed reads this checkpoint. No second Start command, armed
fact, queue or timer is required.

Extend scene@1 only with this bounded `presentation_only`, room-anchored subset:
three narration beats, one two-option scene-owned choice, one selected final
narration and final acknowledgement/end. Reuse reserved scene cursor facts and
existing choice rows, adding the exact scene source/beat/actor/anchor binding.
Continue at beat3 atomically advances to choice4 and opens its one ChoiceRow;
Choose atomically resolves that row and advances to the selected final beat5.
The choice persists `follow_fox` or `wake`; both reach the same memory consequence.
Neither is movement or sleep. No ambience entity, map, body, inventory copy,
spatial SceneSpace instance or arbitrary consequence/script interpreter is built.

A presentation-only checkpoint does not replace the ordinary ActionSet or count
as a running modal scene. Its choice is offered only through its dream detail,
not as an ordinary pending dialogue choice; it neither blocks another dialogue
nor overwrites one. Close returns to the real bed/World without a gameplay write.
A saved checkpoint is resumable only by a living actor at its exact room anchor,
with no encounter, modal or ordinary pending choice. Travel, damage/return or
another modal makes presentation unavailable, preserves the beat/branch, and
leaves normal Stand/Flee/movement/recovery available. Return legally and Resume;
no teleport, immunity, time pause, rerun of first Rest or mandatory dream screen.

Every fresh Continue/choice binds the shown scene, beat and exact choice occurrence
where applicable; direct Command and projected admission agree. Final Continue
requires the selected final line in the safe anchor context. It atomically ends
this scene, assigns `dream_seen=true` and resolves only the bound S10 once. This
Boolean is the durable local memory `player.dream_seen`; no second export marker,
`prologue_completed` point/report, account transfer or numerical reward is added.
Exact accepted replay retains its receipt before current-state admission; new
stale controls cannot skip a beat, change the branch or repeat the consequence.

## D4 homes, finite apples and Eat (selected contract)

**D4 source contract.** [PM adoption](../decisions/pm-decision-d4-homes-orchard-2026-10-05.md)
selects the [chapter declarations](cartridge.md#d4-homes-and-orchard-declarations).
The orchard detail reuses B5 Harvest over three actual authored item identities.
Stock is their direct orchard custody, including lawful Drop/Take; no stock row,
resource node, random roll, regrowth job or seasonal availability gate is added.
Gareth and Ada use ordinary schedules and flavor dialogue, with no repair service
or required waiting. Elspeth remains at Ferry Landing. Cottage and Green variants
read the exact committed child enum; they do not move or create Wren, complete
an escort, write a child outcome or claim that Wren is in the cottage.

D4 is the first held-food consumer. B8 supplies resource recovery semantics;
`food@1` owns the installed `eat
{actor_id, item_id}` and accepted `eaten {item_id}`. Admission requires the exact
opted edible item directly in the living actor's body and positive headroom in
its declared recovery pool. An unknown item is `not_found`, a nonfood target is
`invalid_target`, indirect/foreign/room/spent custody is `not_owned`, and no
headroom is `invalid_state`. Existing scene/combat admission wins. At the admitted
clock, settle recovery and use checked arithmetic to cap the authored positive
increment at the current maximum; atomically transfer the same item to terminal consumed custody and
adjust the pool in one writer group. D4 adds no currency, time skip, RNG, hunger, HP
healing, acquisition event or new consumable issuance.

Ordinary transfer alone cannot express consumption: existing destinations retain
recoverable custody and permit a later transfer back. There is no installed item
removal or spent-item pattern; erasing an authored identity would also weaken
identity/receipt validation. Add terminal custody rather than weakening the
existing one-container invariant. The missing primitive is one reserved
roomless consumed holder per food-enabled world, minted after existing slot
holders in the fresh allocation order and recorded as known kind `consumed`.
It has no body/room parent, capacity limit, public entity definition or actions.
Existing `entity.transfer` retains each food identity and one-container invariant;
food alone admits direct-body to consumed transfer. No transfer out is lawful,
and nonedible items cannot enter. Containment queries terminate there, deriving
no inventory, room presence, reach or carried mass. Do not implement this as an
invisible room, NPC, mutable narrative fact, deleted item or second stock ledger.
Immutable known-entity metadata tags the holder `consumed` and each opted item
`edible=true`. Generic transfer composition rejects any consumed source and admits
consumed destinations only for an opted item directly transferred from a known body.
The food rule alone admits that transition for its command actor and capped recovery.
Both foundation validators and independent precondition checks enforce the terminal
subset; literal fixtures and differential proof cover it.
Projection and execution share one budgeted pure admission query, including exact
keyed-action admission. Ordinary uneaten food custody and death remain unchanged.

## D5 dry Deep Fen exploration (selected contract)

Selected under the [D5 PM adoption](../decisions/pm-decision-d5-deep-fen-2026-10-05.md).
Five optional rooms reuse ordinary reciprocal movement, detail Read and Q2 escort.
[Cartridge authoring](cartridge.md#d5-deep-fen-route-and-details) declares the exact
route. Every new room is dry traversable ground and naturally lit at all hours,
including the shallow fox den; none declares `dark_description`. No swim, tide,
light, time, topic, bell, faction or quest gate applies. The existing B4 dark-room
rules and B6 glow exception remain unchanged elsewhere.

A following original Wren travels on these ordinary edges. Fatal player death
leaves that same Wren separated in the actual death room; the gear-free shrine
route must expose ordinary Talk/Rejoin there, then permit the existing Elspeth
rescue. A reachable owned corpse alone does not prove a reachable Wren: darkness
would conceal the ordinary NPC even though B4 reveals the corpse. No new NPC
visibility exception, escort teleport, replacement or schedule is selected.

The ward stone is a fixed ordinary readable detail: Read narrates its authored
inscription only and Examine describes the stone. Neither grants a Ward/Bell
topic, Q2 credit, branch choice, relationship or item. The original protected
`vesper_message` remains the sole Q2 message with its existing custody, transfer
and Elspeth admission. No D5 operation changes Q2 facts or evidence. Landscape
prose adds no far Scan, fish interaction, crow holder, drift or bottom-room access.

<a id="d6-water-depths-and-owned-corpse-recovery-selected-pending-implementation"></a>

## D6 water depths and owned-corpse recovery (selected contract)

The [PM decision](../decisions/pm-decision-d6-water-depths-2026-10-06.md)
selects optional `well_bottom` and `pool_bottom` below Well Shaft and the dry
Black Pool bank. Rescue/bell stays dry and open all hours. Sedge's free D1 lesson
provides acquired swim before S27. Descending requires currently usable learned
swim, load≤6000g with nested/worn mass counted once, living/standing/out of
encounter and MV≥10. Refuse a bound following Wren without moving or separating
either actor. D1 retains vacuous skill qualification; no CON/DEX gate,
roll, percentage, tide or new lesson. Entry debits 10 MV instead of ordinary fare.
Living actors below surface for 0 MV regardless of current skill/load/MV/posture/
light. Both directions use existing `move` and normal room-entry evidence.

One water occupancy generation binds one absolute submersion deadline and one
due job. The selected chapter duration is in [cartridge](cartridge.md#d6-bottom-rooms-and-water-tuning-selected-contract).
There is no periodic drain: MV 0 alone never drowns, and ordinary fractional
resource recovery remains unchanged. Surface and every death invalidate water
occupancy; stale/canceled/re-entry jobs cannot affect a later occupancy.
At or past the deadline, before admitting an action at equal logical time,
the current water producer lowers positive HP to 0 and invokes the existing
same-body fatal sequence atomically. Death carries typed drowning, null killer/
credit, one actual corpse/held-worn roots/descendants and Chapel return. Ordinary
elapsed settlement and cold reopen cannot grant a fresh deadline or skip expiry.
A captured underwater Up reservation binds its original occupancy generation.
If elapsed preflight expires or invalidates that generation, return `stale_view`
with the body at Chapel and one corpse; never reinterpret it as a Chapel exit.
Ordinary time settlement that retains the same occupancy does not block Surface.
No second clock, wetness, drift, ghost mode or global movement rewrite.

At Chapel, use `recover_corpse` only for an actual nonempty actor-owned corpse
currently in `well_bottom` or `pool_bottom`. Transfer its actual direct corpse roots to
held body custody in one proposal; preserve descendants and empty corpse
identity, allow forced overload, never auto-equip/copy or restore rewards/
deadlines. Foreign/forged/empty/non-underwater corpses cannot yield belongings at Chapel.
Ordinary physical corpse recovery remains available, including D1's fare-waived
isle return. No general remote Take or replacement-gear system.

<a id="d9-village-consequences-and-prior-study-access-selected-pending-implementation"></a>

## D9 village consequences and Prior Study access (selected contract)

**Selected D9 contract.** The five valid terminal pairs are
`rescued/prior`, `rescued/fox`, `stays/prior`, `stays/fox` and `lost/prior`.
`lost/fox` remains invalid. Child and bell quest owners alone write their
terminal facts. Elspeth, Maud, the Green, Aldric, Vesper and Sedge read
those committed facts for distinct authored responses; reading or rendering
never changes them, reopens an ending or pays a reward. A missing child or
unknown allegiance retains truthful search/base text.

The actual accepted bell occurrence emits one committed cue for the actor's
observer frame only when it is in the chapter's declared audible area. In the
installed single-body chapter this frame is Belfry; other room eligibility is
proved with controlled projection frames over that occurrence. The
cue retains its event/command cause, actor, room and logical time; a later
Look, Read, reopen or travel cannot generate another sound. The ordinary bell
scene remains the initiating actor's immediate narration. Reed Path and Mire
may describe flood after the bell, but their dry exits, rescue and corpse routes
stay passable.

The bell suppresses Fen hound spawning and aggression for the cartridge's
172800 logical seconds from the accepted occurrence. Existing hounds remain
living, present and loot-free; any open hound encounter closes without an
attack/reward and cancels its current round. Suppressed population jobs
advance harmlessly. At the exact deadline normal bounded population resumes
from actual living count and current generation, with no accumulated spawn
debt or duplicate job. Sedge's hostile/warm response never disables her
existing lessons or recovery route.

Fox allegiance restricts only **Nave west → Prior Study** ingress. The shared
barrier state remains unchanged and no door Open/Unlock bypass is invented.
Ordinary ingress refuses `exit_closed`. The owning living actor may enter when
an actual actor-owned corpse is still in the Study with at least one direct
item root. The opposite **Study east → Nave** exit always admits ordinary
movement (subject to unrelated normal life/posture rules); taking the corpse's
last root removes the ingress exception on the next decision. There is no
remote Study recovery, duplicate item, item teleport or resurrection. The
public Nave and Aldric's S2 turn-in remain accessible. The gate does not close
Bell Tower, Belfry or any mandatory route. See the [D9 decision](../decisions/pm-decision-d9-village-reactions-2026-10-06.md).

## D12 practical skill consumers (selected contract)

The [D12 decision](../decisions/pm-decision-d12-practical-skills-2026-10-06.md) selects the first herbalism and haggle consumers; [chapter declarations](cartridge.md#d12-practical-skill-declarations) own all fees, starts, qualification thresholds, yields and price tuning. This extends C1 acquisition/qualification, B5 finite custody and B3 conserved exchange, without a new skills framework.

Original living, co-located Sedge and Peg teach their respective skills through bound Talk/Choose, typed `skill.acquire` and conserved `lesson_payment` in one proposal. Acquisition is independent of current qualification. Already acquired refuses before any new fee or grant; exact invocation replay returns the existing accepted receipt. Lessons are optional and all-hours; neither learning nor either benefit gates ferry, recovery, ordinary Harvest, S9 or chapter completion. Sedge's existing free swim choice remains separate and available.

The existing Willow Shade patch opts into careful Harvest. Read current acquired/qualified/usable through the skills query; only usable herbalism permits the careful method. Select the authored number of distinct lowest lexicographic eligible EntityIds still directly held by the patch's room. Reject too few eligible IDs or combined carrying overflow before any transfer, event or allocation. Reuse the shared finite selection and `carryingExchange` query/budget, not independent checks against the original load for each incoming item. On success, transfer every selected identity room→actor body in one writer group and emit exactly one `item_acquired` event per transfer. Drop, storage, ordinary Take, S9 and death retain those same IDs. An omitted method retains ordinary one-item Harvest with no skill prerequisite; careful refusal cannot remove that legal ordinary route. No stock row, mint, regrowth or Herb Garden node is introduced.

Peg's opted Buy quote uses current usable haggle after normal elapsed settlement. The effective quote is `max(minimum, floor(base_buy × numerator / denominator))` when usable, otherwise the authored base; Sell stays authored. The existing shared shelf/admission query supplies the effective price for display, exact invocation and execution. `quoted_price` must equal that current effective price before conserved currency/item transfer; stale cheap or dear quotes refuse without silently changing the charge. Recheck all B3 provider, item, custody, balance/overflow and carrying admission. No RNG, daily counter, reserved price, token, extra ledger or stock replacement is added. Qualification is derived at use and never stored; failed qualification never erases acquired membership.

<a id="d7-bounded-deer-and-delayed-sight-flight-planning-contract"></a>

## D7 bounded deer and delayed sight flight

[D7 decision](../decisions/pm-decision-d7-deer-2026-10-06.md) composes three one-slot C3-style populations, not a new ecology. The [cartridge declarations](cartridge.md#d7-deer-declarations) own all numbers and allowed rooms. Each living member is the original saved identity of its current slot generation; death alone makes that slot eligible for replacement and transfers its one held hide to its actual corpse. No sight, flight, arrival or render path births a deer, grants rat credit or produces loot.

The first sight of a living deer on player entry binds one current one-shot job to that exact member and generation, due at sight clock plus the declared delay. A population due job that checks and transfers a deer into the player's current room binds or resets that sight job in the same writer group, using the exact transfer and population-job occurrence as cause; it needs no new generic arrival event. A later sight before dispatch replaces the pending occurrence and its deadline. At dispatch, revalidate current job, generation, life, player/deer co-location and legal adjacent destination in the plan's two-room area. Transfer the original deer once, preserving HP and hide. If sight runs first while an encounter is open, it closes that encounter and cancels its pending current round in the sight group. If its current round runs first at the same due clock, survives and advances the encounter, the later sight job may close that exact encounter through the narrow [round-to-sight handoff](protocol.md#d7-sight-flight-composition). A missing legal exit, stale sight or departure completes sight harmlessly and leaves any live successor round pending; a fatal round cancels its bound sight job. No damage, corpse, loot, credit, clock jump or RNG accompanies flight. Combat begun before the deadline remains legal; the pending job does not make a present deer untargetable.

The plan's ordinary wander still skips engaged members and the member transferred by sight flight at that same clock, using C4's last-flight guard. At equal sight/combat/population deadlines preserve normal `(due_time, job_id)` order and distinct writer groups: a fatal round cancels its bound sight job; sight first moves the deer and makes a later round harmless; a surviving round first can hand off its exact successor for sight flight; an intervening population job sees engagement and may skip. Only the checked matching encounter closure and successor cancellation use the preceding round group in that handoff. Other same-target conflicts still fault atomically. No priority override, global sight scan or per-hound job is added.

## C5 hound bleeding and bandage (selected contract)

[C5 decision](../decisions/pm-decision-c5-bleeding-bandage-2026-10-06.md), [chapter values](cartridge.md#c5-bleed-and-bandage-declarations), [composition](protocol.md#c5-bleed-and-bandage-composition), [recovery](save.md#c5-bleed-and-bandage-recovery) and [Book](book-ui.md#c5-bleeding-and-bandage-details) govern this one real effect. C3/C4's existing hound damage, C1's acquired/current qualification, B5's real finite bandages and D4's terminal consumed holder are the producers and primitives. No generic status interpreter is selected.

Only an actual C3 hound's positive HP loss to the surviving player body during its combat opportunity applies bleeding. Miss, successful defense, clamped zero loss, fatal hit, other opponents and forged event/name matches do not. The existing combat writer group adds one typed body/effect instance with source hound identity, generation, `ends_at`, `next_tick_at` and current owned job. A second qualifying hit while active refreshes `ends_at = now + authored duration` but retains the generation and pending next tick; it neither stacks nor postpones that tick. A new application after cure/expiry uses a fresh generation. The hound's later death or flight does not cancel its already inflicted effect.

At a current tick strictly before `ends_at`, lose the authored fixed HP amount, clamped by current HP, through the existing resource/death sequence. Schedule the next tick if it is strictly before end, otherwise schedule one expiry delivery at end; expiry removes the active instance without damage. Every due job rechecks body, generation, current job, life and time. Cure/expiry/death inactivate the instance and cancel or complete its work in the same writer group; the retained generation makes stale jobs harmless. Player death clears this bleed before same-body Chapel return and closes the entire pack encounter. Equal-time jobs retain canonical `(due_time, job_id)` order; only the [exact current bleed/round pair](protocol.md#c5-bleed-and-bandage-composition) shares a writer group, while unrelated jobs retain ordinary conflict refusal. Each delivery revalidates the hydrated prefix. Already-due work settles before player treatment at the same clock.

Wick's optional all-hours bound lesson uses C1 `skill.acquire`; acquisition is permanent, while use requires current qualification. Exact held bandage treatment is immediate, costs no HP/MA/MV or clock, spends no combat round/opportunity and gives no HP. It atomically transfers that one item to D4's terminal consumed holder, removes the current bleed and cancels its job, then returns a typed result. Refuse without any change if the actor is dead, unlearned/unqualified, another body/effect/generation is targeted, the bandage is not directly held and opted in, or the selected bleed is absent. Normal prerequisite due settlement can cause that last refusal. No remote, nested, worn or corpse-held treatment; retrieve the bandage through ordinary custody first.

Amend the focused combat ActionSet for this exact bandage command after shared ordinary action composition. It may be offered and admitted during an open encounter together with Flee, Stand, Look and Scan. Other item actions, recipes, movement and equipment remain excluded; a raw command or alias cannot widen the exception. Treatment leaves the encounter and pending initiative intact. Flee remains immediate under its existing prerequisites. No required story path, death recovery or owner save depends on teaching, stock, waiting or UI polish.

<a id="d10-discovered-places-observations-and-knock-selected-pending-implementation"></a>

## D10 discovered places, observations and Knock (selected contract)

D10 is installed in the [current bundled chapter](cartridge.md#current-bundled-chapter).

Map knowledge belongs to the character. A new character knows only the entry room. An
accepted body entry adds the destination room once, in the same proposal as its real
transfer; this includes a paid ferry, a water surface move and a death respawn. Looking,
adjacent sight, a refused or stale move and opening Map do not visit a room. The visited
relation is monotone for that character and never grants an exit, changes a barrier or
teleports an actor. The view joins visited room identities with static cartridge map
positions and actual exits; it shows a connection only when both ends are visited. A
visited connection outside the actor's current room is only a known static link, not a
promise of current traversal. Only exits from the actor's current room show live
availability from ordinary Move admission, including the D9 Study ingress rule. No
remote admission simulation or automatic travel is selected.

`where {target_id}` resolves an exact currently **visible and present** NPC or a previously
observed exact NPC ID belonging to this character. `Here` requires the same current
visibility gate as Look and direct target admission, whether the request arrived as a
raw ID, alias or touch selection. A co-located NPC hidden by darkness or another
visibility rule is not `here`: use the actor's saved last observation, or `unknown`
when there is none. A prior observation reports its **last observed** room and logical
time, never its live location. The observation is recorded only at a successful body
entry or an accepted `look` in the actor's current room, for NPCs actually visible
to that actor at that point; `look {target_id}` also observes its actual visible target.
Recording an unchanged observation need not write a row. An unobserved, ambiguous or
unresolvable name reveals no remote identity or location. Observation does not imply
current presence, route availability or room visitation beyond the actor's own entry.
An NPC hidden by darkness or another visibility rule cannot be observed.
`where` itself is read only. It uses existing exact keyword/alias and ambiguity rules,
extended to the actor's remembered IDs without leaking unknown candidates; touch passes
the chosen ID. No schedule prediction or global tracker is selected.

`knock {direction}` is offered only for a physical barrier on an exit from the actor's
current room whose content declares a response. It resolves the same exact exit/barrier
identity as the existing door verbs. A knock produces the authored local response as
an accepted, receipt-bound narration with no barrier transition, actor movement,
payment, quest or fact mutation. It remains usable whether the physical door is open
or closed. A missing, remote or undeclared door refuses. The response cannot bypass
the D9 Prior Study ingress predicate, which is not a physical barrier. The chapter's
first selected door is the Chapel Steps north / Chapel Nave south pair, initially open;
Knock is declared on the Steps north face only. Its response comes from the Nave
only while the actual Aldric is present there.
An absent Aldric yields the authored no-answer response, without asserting his location.

<a id="c6-s27-night-in-the-marsh-selected-planning-contract"></a>

## C6 S27 Night in the Marsh (selected contract)

The [C6 decision](../decisions/pm-decision-c6-night-marsh-2026-10-06.md), [chapter route](cartridge.md#c6-s27-expedition-declarations), [composition](protocol.md#c6-expedition-composition), [recovery](save.md#c6-expedition-recovery) and [Book](book-ui.md#c6-marsh-expedition) select one optional survival expedition. The owner's [no-wait rule](../decisions/owner-decision-no-wait-opening-2026-10-05.md) supersedes the archived night-window trigger: the title and historical `fen.night_survived` fact do not impose a clock condition.

At any hour a standing living player at Hound Run deliberately starts S27 once. Starting binds an actor-owned quest occurrence and a five-entry ordered route attempt with cursor zero. Each later **accepted actual player Move or Flee** along the next authored edge advances that cursor exactly once. Starting co-location, NPC movement, replayed/refused movement, revisiting a room without the next edge, transport and pre-start visits earn nothing. The fifth accepted entry resolves the same quest and awards its selected consequences atomically. There is no idle survival timer, night boundary, arbitrary room-tag counter or new global objective interpreter.

The opt-in Start also provokes the lowest-ID currently living co-present unengaged C3 hound, if one exists, through C4's bounded encounter admission in that same proposal; the player may fight, use C5's legal bandage or Flee under existing combat rules. This is the sole all-hours S27 hostility exception. An absent, dead, engaged or wandered-away hound does not block Start or cause a replacement wait. Outside an active Start, C4's passive hounds and ordinary safe corpse retrieval remain unchanged. No extra opponent opportunity, free strike, hound spawn or forced damage is granted. A real qualifying hound hit may cause C5 bleeding; S27 never writes a bleed directly.

An accepted departure from the declared expedition footprint before completion fails only this attempt, retaining the quest active. A fatal event for the bound player body invalidates the attempt before Chapel return; death does not erase other quest progress. Either failure allows an immediate explicit Restart at Hound Run with a new attempt identity, cursor zero and the same quest occurrence. Old attempts cannot grant credit or rewards. No hound kill, item, swim qualification, clock, bell or faction state is a start/route gate. Completion is once only; Start/Restart disappear after resolution. At Drowned Oak after the third entry, one optional Use shelter action records a bound sheltered flag and narration; it is neither a completion gate nor Rest, healing or a time skip. The fifth entry returns to safe Reed Bank.

<a id="d8-crow-scavenging-selected-planning-contract"></a>

## D8 crow scavenging (selected contract)

[D8's PM decision](../decisions/pm-decision-d8-crow-scavenge-2026-10-06.md) selects one bounded consumer of C3 population, D5's real canopy, ordinary containment and scheduled jobs. Only a directly room-held `old_coin` dropped by the player in Village Green or Drowned Oak is eligible. It must be the exact D6 item, not a keyword match; no quest item, corpse, descendant, worn or nested item, container, or NPC-held item is eligible. A committed `item_dropped` can bind one living, co-located, idle crow (lowest EntityId) and that item to one acquisition job. The player can Take the coin before the job; the job then completes harmlessly. An idle crow carries at most one acquired root. There is no reservation or new ownership ledger.

At the authored acquisition deadline, revalidate the exact drop cause, item custody, crow identity, life, room and idle job. Transfer that same item room→crow, emit `item_acquired` with the crow as actual holder and `run_job` cause, and schedule one transport leg. Never credit the player with Take, a quest acquisition or a reward. Each subsequent job revalidates current custody, member generation, life, location and original nest identity, then moves the crow by one legal adjacent exit along the authored Green-to-Branches corridor. That transport excursion is the only reason a live crow may be outside its plan's two-room ordinary wander pair; the plan retains its slot and ordinary wander skips that member while the transport or return occurrence is active. Deposit transfers crow→the open original nest in Oak Branches only while the nest is there and below its direct-root capacity. Successful deposit starts a bounded return to that crow's authored home, even if the player later Takes and drops the coin again. A return job moves the same living crow one checked adjacent corridor edge toward home every authored interval, with no item transfer; it ends at home and ordinary two-room wander resumes on a later boundary. From any corridor room, at most seven return legs are needed. The crow may be observed holding the coin between committed legs. No teleport, remote Take, pathfinder, item mint or clock skip is added.

If a leg or deposit becomes impossible because the original nest is absent, closed or full, or the next edge is blocked, transfer the held coin to the crow's present dry room and start its return. A stale job after Take, Shoo, combat, death or generation replacement moves nothing. Shoo is a living co-located player action only on a crow currently carrying the eligible root; it moves that exact root to the present room and changes the current transport to a return, atomically. Accepted Attack on a carrying or returning crow releases any held coin to the present room, cancels its due job and pauses return while the encounter is open; a refused Attack changes neither. At encounter close, a surviving crow resumes return with one new job unless already home, when it becomes idle; actual death clears return and uses C3's ordinary same-ID corpse transfer for any still held property. The crow cannot acquire another drop while carrying, returning or paused. Ordinary population work skips a member that had a due transport/return job at the same clock even if that job ran first and reached home; writer groups stay distinct. Return never silently teleports or retires a live crow. This is one crow-item transport state, bounded by the four live population slots; no general scavenger system is selected.
