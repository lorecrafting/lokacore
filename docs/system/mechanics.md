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
it is not in `entities`, so no command targets it and no view lists it; the `finger` holder has capacity 2. A food-enabled world
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
the body's legacy resources at their start values, and one starting at 0 still stores the row of
the [wage](#hireling-wages-toolbox-row-22b) resource. Every opted recovery pool has a required
player-body row at the birth clock, including zero, with its authored start, standing rate
and zero remainder ([resource@1](#resource1-kerneltssrcmechanicsresourcets)). One body per world;
rules read the actor from the
command and its body from `bodyOf` (`runtime/decision.ts`). When `knowledge@1` is opted in,
fresh creation records the entry room for that character and observations of exactly the
visible co-present NPCs at the birth clock, after population initialization. This grants
no remote map knowledge. A chapter declaring ancestries starts without a selected character
row; [D11 selection](#d11-character-choice-selected-contract) precedes ordinary player commands
and trusted elapsed updates; world time starts at selection.

## movement@1 (`kernel/ts/src/mechanics/movement/rule.ts`)

`move {direction}`: a direction outside the six compass directions is `invalid_target`
(`:33`); no exit here, or one [hidden](#hidden-passages-and-search-toolbox-row-11) from the actor, `not_found`; an exit through a closed or locked barrier, `exit_closed`
or `exit_locked` (`passage`, `:62`); under [position@1](#position1-kerneltssrcmechanicspositionrulets), an
actor not standing, `invalid_state` (`kernel/ts/src/mechanics/position/shared.ts` `standing`); the move costs the body
the cartridge's `world.movement.cost {resource, amount}`, else (the engine default) 1 mv when the cartridge
declares `mv`, else nothing, and an unpayable move is `insufficient_resource` (`fare`, `:73`).
Per-exit and terrain costs are later (toolbox row 43a; the archived 00 §11 placed them in a chapter three that is no longer planned). Accepted
`moved`: the `resource.adjust` (none without a cost), one `entity.transfer` of the body, a [climb](#rope-and-climb-toolbox-row-30)'s fall when it has one, and
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
exit and no other item (the loader's `BARRIER_MISMATCH`). Policy leaf `barrier_state`. An optional `opens_when` gates `open` ([row 10](#time-windows-hour-and-moon-gates-toolbox-row-10)). A reaction's `barrier.set` ([row W22](#fire-toolbox-row-w22)) moves a barrier with none of these checks. Keys that
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
`finger`, `waist`, `legs`, `feet`, `wield`, `off_hand`, `light`). Worn means inside the body's holder for
that slot ([A fresh world](#a-fresh-world)); wearing and removing reuse `entity.transfer`, with
no new op and no event. The actor's holders are those whose container is its body.
`wear {item_id}`: no entity `not_found`, not an item `invalid_target`, already in one of the
actor's holders `invalid_state`, not directly in the body `not_owned`, no `slot` or no holder
for it `invalid_target`, the holder full (two items for `finger`, one otherwise) `invalid_state`; accepted `worn`, one transfer
body → holder. `remove {item_id}`: no entity `not_found`, not an item `invalid_target`, directly
in the body `invalid_state` (not worn), anywhere but one of the actor's holders `not_owned`, worn
but barred by its own statuses ([cursed items](#cursed-items-and-blessing-toolbox-row-28)) `invalid_state`;
accepted `removed`, one transfer holder → body. These checks are one read-only function the
rule and the GameView share. Composition re-checks custody, cycles and the holder's capacity.
`has_item` climbs containers, so a worn item still counts. A worn item's affects move its
wearer's attributes ([toolbox row 3](#item-slots-and-affects-toolbox-row-3)); when the hp maximum
is derived, wearing or removing an item with affects first settles hp, as every attribute writer does ([resource@1](#resource1-kerneltssrcmechanicsresourcets)). Slot compatibility
and dual wield are LATER ([ROADMAP](../ROADMAP.md)).

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
Every change between two positions is legal (twelve). `move` needs standing
([movement@1](#movement1-kerneltssrcmechanicsmovementrulets)); a sleeping actor may only use the
position verbs, move, look, wait and answer a modal ([Sleep](#sleep-toolbox-row-w9)); every other
verb works in any position. Content may read the fact
(`fact_compare`, a reaction's `on.fact`) but never write it (`RESERVED_FACT`). The GameView
shows `position` and lists the verbs but the current position's with the place's actions
([protocol.md](protocol.md#gameview)). Position affects opted resource recovery as
specified below ([PM adoption](../decisions/pm-decision-m2-a-position-recovery-2026-10-04.md)),
what a sleeper may do and a Sleep's provocation ([Sleep](#sleep-toolbox-row-w9)); a combat hit
doubles on and wakes a sleeper ([combat@1 rounds](#combat1--first-live-encounter-m6-a)).
`meditating` is LATER ([ROADMAP](../ROADMAP.md)).

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
(`mechanics/fact.ts`); a `per_subject` fact also at its subject ([row W2](#entity-and-pair-facts-toolbox-row-w2)); unset means its default; `fact_compare` compares equality. The host appends a
`fact_changed {fact, old, new}` for each `fact.assign` that changes its value, at the assign's
causal position (`mechanics/fact.ts:108`); an unchanged assign emits nothing. Invariant `facts_typed`.
Dialogue-only `fact.adjust {fact, amount}` requires a declared bounded integer fact and a safe
integer amount. Read the current value (including earlier sequence steps), check its type and
bounds, use checked safe addition, then clamp to the authored bounds. Lower to the existing
`fact.assign` in writer group 0; unchanged values emit no event. Corrupt values, unsafe sums
and reserved engine-fact writes fault, never repair. This adds no foundation delta operation.
The leaves `stat_compare`, `resource_compare` and `level_compare` ([row 29a](#spell-cast-admission-toolbox-row-29a)) are [attributes@1](#attributes1-kerneltssrcmechanicspolicyts60)'s.
How a leaf is named, dispatched and checked by both kernels: [the policy leaf set](#property-tags-and-the-policy-leaf-set-toolbox-row-g1).

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

The player body's hp maximum moves with the derived `hp_max` table
([row 2](#stats-derived-from-attributes-toolbox-row-2); [PM decision](../decisions/pm-decision-derived-pool-max-2026-10-09.md)):
its effective maximum is the authored `maximum` plus the bonus, saturated to the ResourceInt range and never below `minimum`, read on
each use and never stored. Every bound above uses it: queries, saturation, costs, regeneration
(which stops there), the GameView maximum and band, the status tick and the death restore (capped
at it). The start value is unchanged, so a raised maximum is reached by regeneration. Every writer
of an attribute change that can move it first settles hp with a zero-amount `resource.adjust` under
the old maximum, as position@1 does: wear and remove of an item with affects ([equipment@1](#equipment1-kerneltssrcmechanicsequipmentrulets)),
`raise_attribute` ([row 4](#experience-and-levelling-toolbox-row-4)) and `choose_ancestry`
([D11](#d11-character-choice-selected-contract)), and any later attribute writer (PM ruling 2026-10-09, `loka-kgd.11`), so credit banked while capped is discarded and never granted by the new
maximum. Composition
carries it as the non-saved `resource_maxima` map, keyed by the exact canonical resource target,
in both kernels' composition and independent replay; an entry replaces the spec's `maximum` for
that target, and a row stored at or above it (the maximum fell since) reads as the maximum with
a zero remainder, so the next write starts there. Without an entry, a row above `maximum` still fails.
NPC bodies, other pools and cartridges without `hp_max` are unchanged.

<a id="attributes1"></a>

## attributes@1 (`kernel/ts/src/mechanics/policy.ts:60`)

An attribute starts from the definition `AttributeSpec {key, start}` in the cartridge's
`attributes` map (source `attributes.json`, [cartridge.md](cartridge.md#source-layout));
the engine declares no world stats. The installed [D11 writer](#d11-character-choice-selected-contract)
commits `character.select` with the chosen ancestry and complete attribute values in
`state.characters[CharacterId]`. These values belong to the character, never its replaceable
body. `attributeValue` reads that character row when present, otherwise the definition start;
policy, recipe thresholds and skill qualification share this lookup, which adds the affects of the
actor's worn items ([row 3](#item-slots-and-affects-toolbox-row-3)) and the modifiers of the statuses
active on its body ([row 2c](#status-modifiers-toolbox-row-2c)). Actors and cartridges
without a selected row retain definition starts. No training attribute writer is installed.
`attributes@1` owns two 06 §21 leaves, each `{<ref>, at_least}` (a ResourceInt; "below" is
`not`, a range `all`): `stat_compare {attribute, at_least}` holds when the actor's value is at
least `at_least`; `resource_compare {resource, at_least}` when the current value of the pool
on the actor's body, as [resource@1](#resource1-kerneltssrcmechanicsresourcets) derives it and before the action's costs, is.
Both fail closed: an actor without a body reads no pool, and the compiler and loader reject an
unresolved reference or a leaf whose owner the lock lacks (`UNDECLARED_CAPABILITY`). Not
`resource@1`'s: a new op would take `resource@2`, re-deriving every v2 lock and hash. A third leaf, `level_compare {at_least}` ([row 29a](#spell-cast-admission-toolbox-row-29a)), holds when the actor's level is at least `at_least`.

## D11 character choice (selected contract)

The [D11 decision](../decisions/pm-decision-d11-character-choice-2026-10-06.md) selects four immutable, once-only character ancestries before ordinary play. [Chapter declarations](cartridge.md#d11-ancestry-declarations-selected-contract) own the six starting values, four modifiers and ancestry effects; [save](save.md#d11-character-choice-recovery) owns durable choice identity; [Book](book-ui.md#d11-character-choice-interaction) owns the initial control. This extends `attributes@1` from definition-only starts to per-character values. Both policy `stat_compare` and the B6 Seek recipe's direct `attribute_threshold` check must read the selected actor's value; C1/D12 skill qualification, B4 darkness and B2 Priory/Fen axis also consume the selected state. No world number is hardcoded in the engine.

Fresh play requires one selected key from the pinned chapter's four declarations. No elapsed timer, default choice, preview render or browser refresh selects one. One accepted authority command commits that exact character's choice, its six values, starting acquired skill where declared and initial faction adjustment in one proposal, after a zero-amount hp settle when the hp maximum is derived ([resource@1](#resource1-kerneltssrcmechanicsresourcets)). A different later choice refuses without change; replay of the same invocation returns its original receipt. No training or equipment writer is added. Death moves the body/custody as already specified but retains character identity, attributes, skill and faction. New game uses the existing explicit Start over boundary.

Under the [owner's world-time ruling](../decisions/owner-decision-world-time-starts-at-entry-2026-10-08.md), world time starts when the player first enters the world: the accepted selection. Before selection, `stepElapsed` refuses trusted elapsed updates as `invalid_state`, as Step refuses ordinary commands, so the clock and due jobs stay at the birth clock. The local driver credits no wall time before selection; credited time starts at the selection invocation's reservation. This supersedes the [2026-10-06 pre-choice elapsed ruling](../decisions/owner-decision-d11-prechoice-elapsed-2026-10-06.md).

`stat_compare` and `attribute_threshold` read the selected character value after choice on each check; neither caches qualification. STR, DEX, INT and PER have installed check consumers. CON and SPI are saved/displayed but have no Chapter 1 stat-check consumer. Hill-folk's dark-sight exempts only the selected character from B4's missing-light visibility gate, both in their current room and when ordinary Scan projects a legal adjacent dark destination. It does not create a lit source or change `illuminated`; B6 `light_off` therefore retains its physical-light answer, including Seek and Talk for a hill-folk character. Barred passages still stop Scan, and hidden-exit, closed-door, custody and other perception checks still apply. No spell/mining/Crown track, derived resource or generic vision framework is selected. D6 swimming still requires real acquired and currently qualified Swim under its own no-CON rule; D12 Haggle follows its DEX/MV rule. B6 difficulty5 must remain immediately passable for all four selected ancestries.

Compiler, loader, command admission and composition reject unknown choices, partial or
contradictory effects, malformed values and attempts to change identity. The [D11 source review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-d11-character-choice-primary-review.md)
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
source after creation. An `opposed` check compares the actor's skill level or attribute with the target detail's rating ([rows 5 and G5](#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5)). It emits `check_passed` or `check_failed` at position 1 and selects the
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
actor already in conversation with that speaker, `invalid_state`. A talk to another speaker
while a conversation is open ends that one first, as Leave would: the same decision's
`choice.close` of the open row precedes the new `choice.open` (owner ruling 2026-10-09 in Beads
loka-x6t.5, paraphrased: an open conversation must not block the world;
`mechanics/dialogue/selection.ts:152`). Accepted
`choice_opened`: one `choice.open` of a new continuation (ordinal 0 of this command), the
dialogue's roles bound to EntityIds in role-name order, the choice ids in key order, and
`choice_opened`. `choose {continuation_id, choice_id}`: a continuation not pending, not the
actor's or not offering the choice `invalid_state`; the pinned dialogue policy is
re-evaluated for that actor at Choose and pending-option projection, refusing
`invalid_state` when no longer true; a bound NPC not in the room `not_present`;
a bound item not held `not_owned` (`kernel/ts/src/mechanics/dialogue/shared.ts:85`; the GameView shows the same); then the
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
whose trigger is this dialogue and choice (`mechanics/dialogue/rule.ts:225`). The conversation then
(unless the choice is [checked](#dialogue-skill-checks-toolbox-row-14), which ends it) returns to its hub (owner OK 2026-10-09 in Beads loka-x6t.5, paraphrased: after every answer return
to the person's topics; the conversation stays open until Leave the conversation): the same
decision appends a `choice.open` of a fresh continuation (the next minted id) with the resolved row's
source, beat, roles and choice ids, and its `choice_opened` after `choice_resolved`. The answer
ends the conversation instead, opening nothing, when its dialogue resolves a quest (story points
and scene starts follow only such answers) or declares a riddle, when the answer has a `patrol`
transition (the speaker sets off on a leg), or when the dialogue has a single choice (one-shot
offers, lessons, escort starts and single-choice farewells such as "Take your leave";
`mechanics/dialogue/behavior.ts:72`). A farewell choice in a dialogue with other choices, such as Aldric's "Leave
Aldric.", returns to the hub like any other answer. The reopened options keep their
declared availability: an answer whose effects make the dialogue's policy or an option fail shows
those options unavailable with the usual codes, and Leave the conversation stays offered. A
riddle's wrong answer keeps its row, as below. `close_choice {continuation_id}`: the
actor's pending continuation closes, nothing else (`choice.close`), else `invalid_state`; it is
Leave the conversation, offered while any dialogue row is pending (`modal`, `closable: true`).
A hub conversation (a dialogue that returns to its hub, above) also ends as Leave would, with no
event, once its actor and speaker no longer share a room or the speaker dies: the player moves
away or the speaker leaves. The proposal, once composed with its due jobs, appends the
`choice.close` of each such row in id order (`kernel/ts/src/runtime/proposal.ts:102`,
`mechanics/dialogue/selection.ts:162`). A one-shot dialogue's row stays pending when either
leaves, its options `not_present`
([adverse case](../spec/conformance/adverse-cases.json) `walked-away-rejects-new-choice`).
While a choice is pending, `choose` and `close_choice` are the actor's answers and no room
contribution removes them (`kernel/ts/src/mechanics/dialogue/shared.ts:264`). Only a dialogue's speaker, present in the room,
offers its talk (`mechanics/dialogue/selection.ts:80`), one per dialogue under the dialogue's key, available while that
dialogue's policy holds. The loader rejects an `accept` in a dialogue that has a `quest`
(accepting would resolve it) or on a choice with a `hand_over` (activation and acquisition in one
decision conflict), both `OUTCOME_MISMATCH`. In a dialogue that returns to its hub, an answer
that could repeat must not reach a once-per-lineage save proof: the loader and the compiler
reject, `OUTCOME_MISMATCH` at the field, a `receive`, a `topic.grant` step, a `fact.assign` step
of a fact the save proves by one receipt (a topic's fact, a perception `discovered` fact or a
bounded riddle's answer fact; [save](save.md)) or an escort `start` on a choice with neither an `accept` (refused once accepted) nor a `patrol` (which ends the
conversation) (`kernel/ts/src/content/cartridge_dialogues.ts:264`, twin
`lib/loka/content/hub.ex`). A `hand_over` cannot repeat: the bound NPC keeps the item.

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
proof in the [touch review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-03-c1-touch-review.md) and its
[native evidence](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/c1-touch/README.md). SCENE-03 and QUESTSCENE-01's
start-once half are covered by the [scene review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-03-c1-scenes-modal-review.md).
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
`entity_entered_room` into its room, exact `quest_resolved {quest, outcome}`, `rested` in its
room, or (toolbox row W1) any other registered event kind with optional filters, in rule-key order.
Rules run one after another: each rule's `when` reads the writes of the rules and deliveries before it in the same command, and a later rule may rewrite a fact an earlier one wrote (the write joins the earlier write's writer group, `assignment` in `kernel/ts/src/mechanics/reaction.ts`, loka-j2mo), so the last write wins, deterministically by rule-key and delivery order. Archived 04 §5.3 calls repeated independent assignments a conflict; this rule governs ([difference 11](DIFFERENCES.md)).
Every filter present must equal its payload field; a filter means the same field in every kind:

| Trigger `on.event`                                                                                                   | Optional filters (payload field)                                                                                      | Subject (status.apply target)                  |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `item_acquired`                                                                                                      | `item` (item_id)                                                                                                      | holder_id                                      |
| `item_dropped`, `shooed`                                                                                             | `item` (item_id), `room` (room_id)                                                                                    | the actor's body                               |
| `quest_activated`                                                                                                    | `quest`                                                                                                               | the actor's body                               |
| `choice_opened`                                                                                                      | none                                                                                                                  | the actor's body                               |
| `choice_resolved`                                                                                                    | `choice` (choice_id)                                                                                                  | the actor's body                               |
| `story_point_reached`                                                                                                | `story_point`, `outcome`                                                                                              | the actor's body                               |
| `custom_event`                                                                                                       | `custom` (the event's key)                                                                                            | the actor's body                               |
| `action_completed`                                                                                                   | `action`                                                                                                              | the actor's body                               |
| `check_passed`, `check_failed`                                                                                       | `check` (the check's key)                                                                                             | the actor's body (subject_id is the target)    |
| `barrier_changed`                                                                                                    | `barrier`, `to`                                                                                                       | the actor's body                               |
| `scene_ended`                                                                                                        | `scene`                                                                                                               | the actor's body                               |
| `entity_died`                                                                                                        | `victim` (victim_definition), `room` (room_id)                                                                        | victim_id                                      |
| `attack_result`                                                                                                      | `hit`, `attacker` (attacker_id is that NPC's authored instance; [loka-kgd.79](#attacker-filter-loka-kgd79))           | target_id                                      |
| `filled`, `poured`, `drank`                                                                                          | `kind`                                                                                                                | the actor's body                               |
| `entity_entered_room`                                                                                                | `room` (required), `npc` (entity_id is that NPC's authored instance; [row W3](#rumour-by-co-presence-toolbox-row-w3)) | entity_id                                      |
| `rested`                                                                                                             | `room` (required)                                                                                                     | body_id                                        |
| `clock_hour` ([row W25](#exposure-cold-hot-damp-and-windy-toolbox-row-w25))                                          | none                                                                                                                  | the actor's body                               |
| `fact_changed`                                                                                                       | `fact` (required)                                                                                                     | subject_id when present, else the actor's body |
| `status_applied` ([status readers](#status-readers-toolbox-rows-sr1-sr2-and-sr3)), `status_ticked`, `status_expired` | `status`                                                                                                              | body_id (the status's holder)                  |
| `quest_resolved`                                                                                                     | `quest`, `outcome` (both required)                                                                                    | the actor's body                               |

Attribution: every delivery runs for the command actor (the quest-resolution exception below),
so an event whose subject is an NPC or a thing (a hound's death, a hit on a guard, a crow
taking an item) still reads the actor's `when` and writes the actor's facts, quests and
experience; only `status.apply`, ([status reader 3](#status-readers-toolbox-rows-sr1-sr2-and-sr3)) `status.cure` and `status_active {subject: "subject"}` follow the subject, which may be the actor's body, an NPC or an
item ([row G3](#statuses-on-npcs-and-things-toolbox-row-g3)), unless the step names an `item`, ([row 42](#potions-and-songs-toolbox-rows-18-and-42)) an `npc` or ([status reader 9](#a-room-as-a-status-holder-status-reader-9)) a `room`; any other subject (a detail) takes nothing, and since status reader 9 a room subject takes it; ([row W22](#fire-toolbox-row-w22)) `barrier.set` names its barrier or acts on the event's room; ([row 41](#decay-toolbox-row-41)) `item.move` moves the subject when it is an item. A check, action or custom event's subject_id
names its target, so its status lands on the doer: a failed disarm poisons the actor. A filter naming a definition (`item`,
`room`, `quest`, `story_point`, `barrier`, `scene`, `kind`, `victim`, `npc` and `attacker` as an NPC, `status`) must name one of
this cartridge (`item` matches its authored instance only, never a created one such as a
harvested pelt); key filters (`custom`, `check`, `choice`, `action`, `outcome`) are not resolved
and a key no event carries never matches.
For quest resolution, the source instance must exist at player scope, be resolved with the
event's quest/outcome, and agree with its actor and scope; inconsistent evidence faults
`precondition_failed`. The instance's actor owns the delivery. Its `when` is read on the proposal so far at the event's logical time.
`apply` assigns facts at that actor's scope, activates a declared quest through
`quest.activate {quest}`, or requests typed `quest.resolve {quest, outcome}` and
`quest.fail {quest, outcome}` transitions, or ([row 41](#decay-toolbox-row-41)) moves the subject item to a room through `item.move {room}`. Resolve and fail are legal only on a
`fact_changed` trigger, for the trigger's actor; resolve checks the quest objective,
and fail requires an active or objectives_complete actor instance. Neither changes a
terminal instance. Activation is legal only on a quest-resolution trigger; any prior
instance for that actor, including terminal instances, skips activation. The delivery uses
one writer group and causal allocator; its quest-owned `quest_activated` is admitted through
reaction's quest composition, caused by the source event and correlated with the root command.
The resulting events trigger further rules, FIFO, to quiescence, within the deliveries,
`reaction_depth` and `query_steps` budgets. Matching [scene starts](#scene1-mechanicsscenerulets)
follow authored rules in scene-key order, using the same delivery machinery.
A delivery's narration lines (today only a `status.apply` first application on the player's own
body says a line, [row 1](#status-effects-over-time-toolbox-row-1); a refresh while active is
silent) join the receipt's narration as the delivery is admitted (`runtime/proposal.ts` `react`):
the root command's own lines first, then its reactions' lines in delivery order, cascades
included; then each due job's line, followed by its reactions' lines; the
[level-up](#experience-and-levelling-toolbox-row-4) line last. Fixed in Beads `loka-kgd.13`
(2026-10-10): before it, the proposal dropped reaction lines. Where reopen replays receipt
history, a save holding such an unvoiced first application re-decides differently and opens
`save_corrupt` with Start over ([save.md](save.md)); no Chapter 1 reaction says a line, so Chapter 1 receipts are unchanged.

<a id="schedule1-behavior1-calendar1-mechanicsschedulerulets-kernelts-srcmechanicsschedulebehaviorts"></a>

## schedule@1, behavior@1, calendar@1 (`mechanics/schedule/rule.ts`, `kernel/ts/src/mechanics/schedule/behavior.ts`)

`wait {until}`: not later than now `invalid_state` (`:46`); accepted `waited`, one
`time.advance`, no event. Any explicit advance (a wait or a recipe's duration) runs every
pending job due at or before its target, in `(due_time, job_id)` order, each as a `run_job` the
host builds with the job's CommandId; one that is not accepted is the advance's result
(`runtime/proposal.ts:253`). `run_job` is authority-internal: a cartridge action may not name it. It
runs one job of an NPC's `daily_schedule` (hour of day → room): a job not pending
`invalid_state` (`:23`); the NPC moves to the room listed for the job's hour (or the room of its
first holding case, [row W10](#conditional-schedules-toolbox-row-w10)) unless already
there (an `entity_entered_room` at the job's time), the job completes, and the next job is
scheduled at the schedule's next listed hour, strictly later (`mechanics/schedule/behavior.ts:24`).
A next listed hour the same advance also crosses (loka-qi0r) runs as a sub-step of that row's one
`run_job` instead: the row runs and completes once, and its occurrence stays its due time, so this
is no change to the job CommandId clause ([numeric-profile.md](../spec/conformance/numeric-profile.md)).
Each sub-step sits in `(due_time, job_id)` order among the other due jobs, in the job's writer
group, under the CommandId derived from the job and that hour (`jobCommandId(job_id, hour)`): the
move, the `entity_entered_room` at that hour and its reactions, as hour-by-hour play gives them;
only the last sub-step schedules the next job, after the target. Job rows and ids differ from
hour-by-hour play (one row completes, no row per crossed hour). A reaction's write to a fact row
an earlier reaction of the same advance wrote joins that write's writer group, so a reaction firing
on two sub-steps of one wait, or for two NPCs in one advance, writes the row in order
(`mechanics/reaction.ts` assignment, loka-j2mo). Every drain step counts toward
`due_jobs_per_advance`, and a wait crossing more steps faults `budget_exceeded`; while hours are
crossed, the count also includes due jobs the drain skips, so that fault can come early. One unit of
logical time is defined by the cartridge calendar: positive exact units per hour, hours per day
and displayed subdivisions per hour. Time 0 begins day 1 at midnight. Daily schedules and
policy leaf `time_window {from, to}` use calendar hours, including half-open windows that wrap
midnight; jobs schedule strictly after the current time. The compiler and loader reject hours
outside the authored day, unsafe day products and malformed periods. Optional ordered solar and
lunar phase cuts classify confirmed time; absent sky data produces no sky claim. Legacy
cartridges without the expanded calendar retain their installed fixed-hour meaning.
Invariant `job_complete_owned_by_run`: each completion belongs to its job's own `run_job`,
outside the root command's writer group 0, and the job is due by the advance's target.
Equal-due combat round/bleed pairs and a plan's current and resume jobs run by one advance (protocol.md, D9) may share a writer group, and a
combat round joins the status writer group of its body and every roster member in the advance
(row 2c; [row 6b](#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b)); a bleed tick joins
its body's group too, which is how an equal-due round/bleed pair shares one. When those are
different groups, the lowest is kept and the proposal's earlier writes in
the others take its number, so every write to those rows composes in order (loka-x2gv); the group
does not identify a unique job completion. A job's ops `at` its due time hydrate
from the advance's base clock, as the whole proposal composes (`now` in `runtime/proposal.ts`).

## Engine-wide behaviours

- **Ids are deterministic**: every entity, event, instance, continuation and job id comes
  from the IdSource under its command, so a replay mints the same ids.
- **Composes-with**: a choice composes quest, containment and check, a recipe composes check, a job
  composes movement (`runtime/decision.ts:204`); facts, containment, barriers, resources and the clock
  are the shared vocabulary every mechanic reads through the same policy leaves.
  Scene starts read story_point_reached and write only their own facts; modal ActionSet
  replacement restricts position, equipment and door verbs without edits to those rules.
  Policies/reactions may read scene facts. Reactions compose quest activation and the existing
  scene event-start hook; both use the proposal's single delivery queue.

## M1-A elapsed authority time

[Contract decision](../decisions/pm-decision-m1-a-elapsed-contract-2026-10-04.md). `manifest.time_policy.profile = real_elapsed` disables player Wait and recipe time skips; omitted policy retains legacy behavior. `stepElapsed(world, command, revision)` admits only schedule-owned `elapsed {actor_id, run_id, from, until}`. It validates schema and derived CommandId, rejects nil ID (`permission_denied`), wrong world/actor (`not_found`), and refuses wrong derived ID (`permission_denied`), wrong profile or interval, or any elapsed before [D11 selection](#d11-character-choice-selected-contract) (`invalid_state`). A valid interval has `from == world.state.clock`, `until > from`. Accepted outcome `elapsed` contains one root `time.advance`, no own narration/event/RNG; the existing proposal supplies due jobs, reactions, owned events and all budgets. Faults adopt nothing. Normal `step` refuses elapsed (`permission_denied`) even if supplied a forged ActionSet action. Scenes retain Continue-only player admission while this trusted path advances time.

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
attack-result EventId before death EventId before corpse EntityId, with no death RNG
unless the victim declares [drops](#loot-tables-and-random-drops-toolbox-row-8).
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
[Row 17](#ranged-first-strike-toolbox-row-17) makes the player's round-1 opportunity a shot that takes the foe's.
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
water drinking changes no HP, MV, needs, faction, money, RNG or clock (since [row G13](#hunger-thirst-and-dry-days-toolbox-rows-g13-and-w25-dry) a liquid's `cures` may end statuses).

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
A successor the same advance also crosses (loka-6ql4) runs as a sub-step of the plan job's
one `run_job`, as a crossed schedule hour does (loka-qi0r, [schedule@1](#schedule1-behavior1-calendar1-mechanicsschedulerulets-kerneltssrcmechanicsschedulebehaviorts)):
births, wanders and the target read that hour, and the wander boundary is the one hour-by-hour
play would hold; plan control is written once, by the last sub-step, which schedules the next
plan job after the target (`kernel/ts/src/mechanics/population/shared.ts` `runPopulation`).

Equal-time combat and population jobs retain canonical `(due_time, job_id)` order
and distinct writer groups. Population dispatch changes only actual birth/replacement
slots, never unchanged living or not-yet-eligible dead slots. Thus population-first
skips the engaged hound before fatal combat; combat-first leaves a dead slot whose
new due is strictly later, which population skips. Both advance the separate plan
control once and conserve the same fatal slot/corpse/pelt. No whole-plan slot rewrite
or cross-writer exception is permitted; see [targets](protocol.md#c3-spawned-bundles-and-population-composition).

At a wander boundary each living, unengaged member alternates between the two
adjacent declared rooms through ordinary legal movement. A blocked edge leaves it
in place; it spends no RNG or player MV. An [encounter plan](#random-encounters-toolbox-row-9) departs from this RNG-free rule: it draws once per wander-boundary opportunity. A newly spawned member stays at home for
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
leaves or, in a cartridge that opts into [target choice](#target-choice-in-the-same-room-toolbox-row-6a), the player picks another member. Revalidate exact life/presence/job immediately before each opportunity.
Thus assistance supplies a real rotating opponent attack, never one attack per
helper. Share C1's attack/defense resolver and the eight-raw-draw round budget.

Immediately before its selected opponent opportunity, a living co-present hound
strictly below its cartridge HP-fraction threshold (or holding a [fear status](#fear-and-morale-for-npcs-toolbox-row-w21)) attempts flight before attack.
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
with no encounter or modal. An open ordinary conversation does not block Continue: Continue
ends it first, as Leave would, in the same decision (owner ruling 2026-10-09, loka-x6t.5;
`mechanics/scene/sequence.ts:42`); the dream's own choice is still refused while one is open.
Travel, damage/return or
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

[C5 decision](../decisions/pm-decision-c5-bleeding-bandage-2026-10-06.md), [chapter values](cartridge.md#c5-bleed-and-bandage-declarations), [composition](protocol.md#c5-bleed-and-bandage-composition), [recovery](save.md#c5-bleed-and-bandage-recovery) and [Book](book-ui.md#c5-bleeding-and-bandage-details) govern this one real effect. C3/C4's existing hound damage, C1's acquired/current qualification, B5's real finite bandages and D4's terminal consumed holder are the producers and primitives. The generic status interpreter of [toolbox row 1](#status-effects-over-time-toolbox-row-1) runs beside C5 and does not replace it.

Only an actual C3 hound's positive HP loss to the surviving player body during its combat opportunity applies bleeding. Miss, successful defense, clamped zero loss, fatal hit, other opponents and forged event/name matches do not. The existing combat writer group adds one typed body/effect instance with source hound identity, generation, `ends_at`, `next_tick_at` and current owned job. A second qualifying hit while active refreshes `ends_at = now + authored duration` but retains the generation and pending next tick; it neither stacks nor postpones that tick. A new application after cure/expiry uses a fresh generation. The hound's later death or flight does not cancel its already inflicted effect.

At a current tick strictly before `ends_at`, lose the authored fixed HP amount, clamped by current HP, through the existing resource/death sequence. Schedule the next tick if it is strictly before end, otherwise schedule one expiry delivery at end; expiry removes the active instance without damage. Every due job rechecks body, generation, current job, life and time. Cure/expiry/death inactivate the instance and cancel or complete its work in the same writer group; the retained generation makes stale jobs harmless. Player death clears this bleed before same-body Chapel return and closes the entire pack encounter. Equal-time jobs retain canonical `(due_time, job_id)` order; only the [exact current bleed/round pair](protocol.md#c5-bleed-and-bandage-composition) shares a writer group, while unrelated jobs retain ordinary conflict refusal. Each delivery revalidates the hydrated prefix. Already-due work settles before player treatment at the same clock.

Wick's optional all-hours bound lesson uses C1 `skill.acquire`; acquisition is permanent, while use requires current qualification. Exact held bandage treatment is immediate, costs no HP/MA/MV or clock, spends no combat round/opportunity and gives no HP. It atomically transfers that one item to D4's terminal consumed holder, removes the current bleed and cancels its job, then returns a typed result. Refuse without any change if the actor is dead, unlearned/unqualified, another body/effect/generation is targeted, the bandage is not directly held and opted in, or the selected bleed is absent. Normal prerequisite due settlement can cause that last refusal. No remote, nested, worn or corpse-held treatment; retrieve the bandage through ordinary custody first.

Amend the focused combat ActionSet for this exact bandage command after shared ordinary action composition. It may be offered and admitted during an open encounter together with Flee, Stand, Look and Scan. Other item actions, recipes, movement and equipment remain excluded; a raw command or alias cannot widen the exception. Treatment leaves the encounter and pending initiative intact. Flee remains immediate under its existing prerequisites. No required story path, death recovery or owner save depends on teaching, stock, waiting or UI polish.

<a id="d10-discovered-places-observations-and-knock-selected-pending-implementation"></a>

## D10 discovered places, observations and Knock (selected contract)

D10 is installed in the [current bundled chapter](cartridge.md#current-bundled-chapter).

Map knowledge belongs to the character. A new character knows only the entry room. An
accepted body entry adds the destination room once, in the same proposal as its real
transfer (with `variety@1` locked each later entry also counts it, [visit tiers](#narration-variety-and-visit-tiers-toolbox-row-w7)); this includes a paid ferry, a water surface move and a death respawn. Looking,
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

The headless invariant check accepts that legal Start and compares each expedition transition's expected attempt with the prior row. Composition checks the allowed lifecycle step; adopted-state checks compare the final changed row. An invalid old row, attempt step or final row fails the corresponding check.

The opt-in Start also provokes the lowest-ID currently living co-present unengaged C3 hound, if one exists, through C4's bounded encounter admission in that same proposal; the player may fight, use C5's legal bandage or Flee under existing combat rules. This is the sole all-hours S27 hostility exception. An absent, dead, engaged or wandered-away hound does not block Start or cause a replacement wait. Outside an active Start, C4's passive hounds and ordinary safe corpse retrieval remain unchanged. No extra opponent opportunity, free strike, hound spawn or forced damage is granted. A real qualifying hound hit may cause C5 bleeding; S27 never writes a bleed directly.

An accepted departure from the declared expedition footprint before completion fails only this attempt, retaining the quest active. A fatal event for the bound player body invalidates the attempt before Chapel return; death does not erase other quest progress. Either failure allows an immediate explicit Restart at Hound Run with a new attempt identity, cursor zero and the same quest occurrence. Old attempts cannot grant credit or rewards. No hound kill, item, swim qualification, clock, bell or faction state is a start/route gate. Completion is once only; Start/Restart disappear after resolution. At Drowned Oak after the third entry, one optional Use shelter action records a bound sheltered flag and narration; it is neither a completion gate nor Rest, healing or a time skip. The fifth entry returns to safe Reed Bank.

<a id="d8-crow-scavenging-selected-planning-contract"></a>

## D8 crow scavenging (selected contract)

[D8's PM decision](../decisions/pm-decision-d8-crow-scavenge-2026-10-06.md) selects one bounded consumer of C3 population, D5's real canopy, ordinary containment and scheduled jobs. Only a directly room-held `old_coin` dropped by the player in Village Green or Drowned Oak is eligible. It must be the exact D6 item, not a keyword match; no quest item, corpse, descendant, worn or nested item, container, or NPC-held item is eligible. A committed `item_dropped` can bind one living, co-located, idle crow (lowest EntityId) and that item to one acquisition job. The player can Take the coin before the job; the job then completes harmlessly. An idle crow carries at most one acquired root. There is no reservation or new ownership ledger.

At the authored acquisition deadline, revalidate the exact drop cause, item custody, crow identity, life, room and idle job. Transfer that same item room→crow, emit `item_acquired` with the crow as actual holder and `run_job` cause, and schedule one transport leg. Never credit the player with Take, a quest acquisition or a reward. Each subsequent job revalidates current custody, member generation, life, location and original nest identity, then moves the crow by one legal adjacent exit along the authored Green-to-Branches corridor. That transport excursion is the only reason a live crow may be outside its plan's two-room ordinary wander pair; the plan retains its slot and ordinary wander skips that member while the transport or return occurrence is active. Deposit transfers crow→the open original nest in Oak Branches only while the nest is there and below its direct-root capacity. Successful deposit starts a bounded return to that crow's authored home, even if the player later Takes and drops the coin again. A return job moves the same living crow one checked adjacent corridor edge toward home every authored interval, with no item transfer; it ends at home and ordinary two-room wander resumes on a later boundary. From any corridor room, at most seven return legs are needed. The crow may be observed holding the coin between committed legs. No teleport, remote Take, pathfinder, item mint or clock skip is added.

If a leg or deposit becomes impossible because the original nest is absent, closed or full, or the next edge is blocked, transfer the held coin to the crow's present dry room and start its return. A stale job after Take, Shoo, combat, death or generation replacement moves nothing. Shoo is a living co-located player action only on a crow currently carrying the eligible root; it moves that exact root to the present room and changes the current transport to a return, atomically. Accepted Attack on a carrying or returning crow releases any held coin to the present room, cancels its due job and pauses return while the encounter is open; a refused Attack changes neither. At encounter close, a surviving crow resumes return with one new job unless already home, when it becomes idle; actual death clears return and uses C3's ordinary same-ID corpse transfer for any still held property. The crow cannot acquire another drop while carrying, returning or paused. Ordinary population work skips a member that had a due transport/return job at the same clock even if that job ran first and reached home; writer groups stay distinct. Return never silently teleports or retires a live crow. This is one crow-item transport state, bounded by the four live population slots; no general scavenger system is selected.

## Status effects over time (toolbox row 1)

[Toolbox row 1](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#status-declarations), [composition](protocol.md#status-composition), [recovery](save.md#status-recovery) and [Book](book-ui.md#conditions-details) govern it. A cartridge declares statuses; each has a duration, a tick cadence, one resource of this cartridge and a signed per-tick amount. The engine owns the mechanic; the cartridge owns every number.

A reaction step `status.apply` applies the status at the cause's logical time to the event's subject ([reaction@1](#reaction1-kerneltssrcmechanicsreactionts) table); on an `entity_entered_room` cause that is the entering entity, which since [row G3](#statuses-on-npcs-and-things-toolbox-row-g3) may be an NPC. A holder whose `entity_died` comes after the cause in the same proposal takes no status step (Beads `loka-kgd.105`): the killing blow's `attack_result` never lands on the player's body returned by the death (`react`, `kernel/ts/src/runtime/proposal.ts`), while a reaction on `entity_died` itself still does, and a permanent status (row W8) still lands, as it survives the return. A rule applies each status at most once per holder per delivery; a later step naming the same status on the same holder is skipped (since [row G3](#statuses-on-npcs-and-things-toolbox-row-g3) one rule may burn two items). The first application opens generation 1 with `ends_at = now + duration`, `next_tick_at = now + tick_every` and one pending unbound job of kind `status` due at the earlier of the two; a later application after cure or expiry opens the next generation. An application while active refreshes `ends_at` only: it keeps the generation, the pending tick and the job. The sampler's dart corridor applies `poison` on entry and its shrine applies `blessing`.

At a due job strictly before `ends_at` and not before `next_tick_at`, add `per_tick` to the resource, saturating at the pool's authored bounds (the op itself is exact; a saturated zero writes nothing), then schedule the successor job at the earlier of the next tick and the end. A job at or after `ends_at` expires the status without a tick. A successor the same advance also crosses (Beads `loka-6ztc`) runs as a sub-step of that job's one `run_job`, as a crossed schedule hour does ([schedule@1](#schedule1-behavior1-calendar1-mechanicsschedulerulets-kerneltssrcmechanicsschedulebehaviorts)): at that time, in `(due_time, job_id)` order under the first job's id and in the holder's writer group, it ticks, expires or kills as job-by-job play would (an equal-due tie with another job may order differently, as job-by-job play would use the successor's new id); the drain carries each sub-step's next tick, and the last sub-step writes the row and schedules the successor after the target (`runStatus`, `kernel/ts/src/mechanics/status/job.ts`). A refresh between sub-steps (a reaction re-applying the status) writes its new end as the row's `next_tick_at`, since the composer refuses a tick before the advance end; the next sub-step overwrites it, so job-by-job semantics hold: no tick at the old end, the new end honoured. _Known limit:_ a refresh whose new end is at or before the advance end still faults `precondition_failed` (the composer refuses `ends_at` not after the horizon; the same bound as Beads `loka-kgd.104`). Job rows and ids differ from job-by-job play (one job completes, no row per crossed tick). A negative tick that brings `hp` to 0 closes the body's encounter, inactivates the status and runs the ordinary death sequence with no killer; the same-body return clears every status but a [permanent](#permanent-statuses-toolbox-row-w8) one. An edible item whose `cures` lists the status ends it when eaten; such an item is edible at the pool maximum while a listed status is active, and then restores nothing. Expiry, cure and death leave the inactive generation in place and do not cancel the pending job: a due job whose row is inactive or owned by another job completes with no change. Statuses on NPCs and things follow [row G3](#statuses-on-npcs-and-things-toolbox-row-g3). A rate modifier (changing a pool's regen rate for a time) is not in this row; a buff is a positive per-tick amount.

## Stats derived from attributes (toolbox row 2)

[Toolbox row 2](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#derived-stat-declarations) govern it; the formula and its limits are the PM decisions in Beads `loka-kgd.3` (2026-10-09). A cartridge may declare a table per derived stat; each table's bonus is `floor(Σ per_point × (value − pivot) / divisor)`, where `value` is the player character's attribute as [attributes@1](#attributes1-kerneltssrcmechanicspolicyts60) reads it on each use (the selected D11 value, otherwise the definition start), each term `per_point × (value − pivot)` and then their sum saturate to the ResourceInt range (−2³¹ to 2³¹−1, `protocol/resource.schema.json`), so no read faults, in an action or the GameView (PM ruling in Beads `loka-kgd.8`), and the division rounds toward minus infinity (−5 / 2 is −3). The engine owns the formula; the cartridge owns every number. The bonus is added to the authored number it modifies, then clamped:

- `hit_chance`: the player's attack chance (the usable wielded weapon's, otherwise `combat.player_attack`), clamped to 0..100.
- `damage`: both `damage_min` and `damage_max` of that profile, each clamped at 0, so the interval keeps its order; a hit whose damage is 0 deals no loss.
- `carry_grams`: `carry.max_grams` for the player's body, clamped at 0, on every carry path (Take, purchase and dialogue receipt, exchange and harvest, Fill).
- `hp_max`: the hp pool's `maximum` for the player's body, clamped at the pool's `minimum` ([resource@1](#resource1-kerneltssrcmechanicsresourcets); Beads `loka-kgd.8`).

Nothing is stored: the stats are read at use, so a later attribute writer changes them at once. An NPC's attack takes the `hit_chance` and `damage` tables only when its definition declares `attributes`, read from its own values ([row G3](#statuses-on-npcs-and-things-toolbox-row-g3)); other NPC attack profiles, NPC hit points and any other body's carrying are unchanged. A cartridge without `world.derived` behaves as before. The sampler's ancestries give strength 15 (strong), 5 (nimble) and constitution 16 (hardy): with the base chance 75, damage 4, carry 10000 g and hp maximum 10, the strong character hits at 100 for 6 and lifts the 8000 g anvil; the nimble one hits at 50 for 1 and cannot lift it; the hardy one starts at hp 10 of 16 and regenerates to 16. The player sees no new Book line: the Character page already shows the attributes and each pool's current and maximum.

## Item slots and affects (toolbox row 3)

[Toolbox row 3](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#item-affect-declarations) and [Book](book-ui.md#worn-affects-details) govern it; the PM decision is in Beads `loka-kgd.10` (2026-10-09). The `finger` slot holds two items; every other slot holds one ([equipment@1](#equipment1-kerneltssrcmechanicsequipmentrulets)). An item with a slot may declare `affects`, each `{attribute, modifier}`: while the item is worn by the player's body, [attributes@1](#attributes1-kerneltssrcmechanicspolicyts60) reads the attribute as its selected (else starting) value plus the sum of `modifier` over the worn affects naming it; the sum and then the value saturate to the ResourceInt range, as in row 2. Nothing is stored: the D11 selection row stays immutable, the value is derived on each read, and removing the item restores it at once. Every reader sees it: `stat_compare`, recipe `attribute_threshold`, skill qualification and the [derived stats](#stats-derived-from-attributes-toolbox-row-2), including the hp maximum, whose fall on removal follows [resource@1](#resource1-kerneltssrcmechanicsresourcets). The engine owns the mechanic and the two fingers; the cartridge owns every amount. Items worn by NPCs, carried but unworn, or inside a worn container grant nothing. The sampler's copper, silver and tin rings each give PER +2, so two worn rings read PER 14 and reveal the hall's `stat_compare` variant, a third is refused, and its belt gives STR +2 and CON +4: with carry 1000 g at STR 10 and 1000 g per point, the 2500 g stone lifts only while it is worn, and the hp maximum reads 14 instead of 10.

## Experience and levelling (toolbox row 4)

[Toolbox row 4](../MECHANICS-TOOLBOX.md#ranked-toolbox); the PM decision is in Beads `loka-kgd.11` (2026-10-09): class-free (owner 2026-10-08), a new per-character row, the D11 selection row stays immutable. Draft by the developer (`loka-kgd.11` notes); items marked _completion_ fill places where the decision was silent.

- **Declaration.** A cartridge may declare `world.levelling`: `thresholds`, the strictly increasing positive experience totals that reach levels 2, 3 and so on; `points_per_level`, the attribute points each level grants (at least 1); `kills`, a list of `{npc, experience}`, the experience a credited kill of that NPC definition grants; `level_up`, the TextKey of the level-up line. Every number is the cartridge's. It needs attributes@1.
- **Row.** One `levelling` row per character, `{experience, allocated}`, `allocated` mapping an attribute's DefinitionRefString to the points spent on it; absent reads as zero experience and nothing allocated. _Completion:_ level and unspent points are derived on read, never stored: level is 1 plus the count of thresholds at or below the experience; unspent is `points_per_level × (level − 1) − Σ allocated`.
- **Write.** The delta op `levelling.set {character_id, expected, value}` composes, in both kernels, only when the stored row equals `expected` (null when absent) and neither the experience nor any allocated count falls. The story rule keeps Σ allocated within the granted points.
- **Experience.** Each death the combat credit names for the player character, whose victim definition matches a `kills` entry, adds its experience. The reaction step `experience.grant {amount}` adds `amount` for the acting character, so a quest's `quest_resolved` reaction rewards it. Every experience source in one proposal (each credited kill and each `experience.grant`) adds to one levelling write per character, since the composer refuses a row written by two writer groups. Experience saturates at the ResourceInt maximum.
- **Spending.** One `raise_attribute` action with an `attribute` input (an authored attribute's DefinitionRef) is offered while unspent points remain; the Book shows one Raise card per authored attribute. It first settles a derived hp maximum ([resource@1](#resource1-kerneltssrcmechanicsresourcets)), then adds one allocated point; with none left nothing is offered, and a forged invocation is refused by keyed admission (the rule also refuses it, `invalid_state`). Replay returns the original receipt.
- **Reading.** [attributes@1](#attributes1-kerneltssrcmechanicspolicyts60) reads selected (else starting) value plus allocated points plus worn affects (row 3), saturated as in row 2, so every derived stat follows. The GameView carries `{level, experience, next, unspent}` (`next` absent at the top level); reaching a level adds one receipt narration line, the `level_up` text: _completion:_ after the whole proposal (root, reactions and jobs) is composed, the last `levelling.set` of the player character in it is compared with the stored row before the step, and the line is appended once at the end of the narration when its level is higher, so a step that crosses two thresholds still adds one line.
- **Sampler.** `cartridges/levelling_sampler`: three rats grant 10 experience each, thresholds 30 and 100, one point per level; three kills reach level 2 with one point; resolving the den quest grants 20 by `experience.grant`; Raise STR moves the derived damage (STR, divisor 1) and Raise CON the derived hp maximum (CON, hp regenerating 1 per hour) by the cartridge's tables.

## Property tags and the policy leaf set (toolbox row G1)

[Toolbox row G1](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#tag-declarations) govern it; the brief and its decisions are in Beads `loka-kgd.17` (2026-10-10).

- **Tags.** Item, barrier and room definitions may declare `tags`, a list of `Tag` (`protocol/entity.schema.json`): `burnable`, `fragile`, `liquid_holding`, `metal`, `sharp`, `silver` (added by [row G2](#damage-kinds-resistances-and-critical-hits-toolbox-row-g2)), `wooden`, and `warm`, `cool`, `waterproof`, `windproof` (added by [row W25](#exposure-cold-hot-damp-and-windy-toolbox-row-w25)). The vocabulary is a closed engine set, not a cartridge declaration: the later rows that give a tag meaning (G2 material damage, W22 fire, row 31 `exposed`) key engine code on its name, so the engine must know every name anyway (`fragile` is the one exception: since G12 shipped as content, only a cartridge `has_tag` policy reads it, and an engine-owned force rule is LATER; it is no precedent, so a new tag still needs an engine reader), and a schema enum gives both kernels the same closed check with no twin code. A row whose mechanic needs a new tag adds it to the enum; a world-only label no mechanic reads is a fact. Tags are definition data: nothing writes them and nothing is saved. A cartridge that declares tags needs `tags@1` (UNDECLARED_CAPABILITY at the `tags` member otherwise); one without tags behaves as before.
- **`has_tag {tag, subject}`** (owned by the ruleless `tags@1`): exactly one subject. `subject: "target"` holds when the action's target is an item whose definition declares the tag (false without a target, for a detail or for an NPC; it does not check reach, so a condition that needs the target in reach adds `target_present`); `subject: "room"` reads the actor's current room; `item`, `barrier` or `room` names a definition of this cartridge, a constant of the cartridge (barriers have no EntityId, so a door is never an action target and is named this way). No actor carries tags in this row, so there is no `actor` subject.
- **Leaf naming.** A leaf is a snake_case predicate named for what it reads: `has_<x>` for possession or membership (`has_item`, `has_tag`), `<x>_state` for equality with a lifecycle state (`quest_state`, `barrier_state`, `escort_state`), `<x>_compare` for an at-least comparison of a named quantity's current value (`stat_compare`, `resource_compare`, `level_compare`), `<x>_count` for an at-least count of things or events (`visited_count`, `population_count`), an adjective or participle for a boolean (`target_present`, `light_off`), and a noun for the environment source a leaf reads (`sky`), its fields naming what is read (`lunar`; `weather`, `season` and `tide` in row 31); an at-least threshold is the field `at_least`. A context-relative subject (the target, the actor's room, a body) is always the field `subject` (`target` or `room` for `has_tag`), never a field named `body` or `actor`. A field naming a definition is usually named for its kind (`item`, `barrier`, `quest`) but may differ (`population_count.plan` names a `population`): the reference tables map each field to its kind explicitly, and the compiler expands a short reference to that kind. Alternative subjects are exclusive (`exactlyOneRequired`). Each leaf belongs to exactly one capability's `policies` in `protocol/capability_registry.json`; both kernels refuse an op whose owner the cartridge does not require (UNDECLARED_CAPABILITY).
- **Dispatch.** `holds()` (`kernel/ts/src/mechanics/policy.ts:24`) evaluates `all`, `any` and `not`, then adds one query step per leaf (04 §5.4) and dispatches one `case` per leaf to a pure read over committed state; a read longer than a line is a helper beside it or in the leaf's capability module. The `default` is exhaustive (`never`), so a schema leaf without its case fails the TypeScript build.
- **Two-kernel parity.** The Elixir compiler does not evaluate policies (story rules are TypeScript-only, ADR-074); its parity is the shared schema, the registry ownership check and the reference fields. `Loka.Content.LeafRefs` (`lib/loka/content/leaf_refs.ex`, dependency-free so the checks read it at compile time) maps each leaf's reference fields to their definition kinds (`{field => kind}`); short-reference expansion (`Loka.Content.Checks.expand/2`) and the compiler's reference checks read it, and the loader's twin is the `LEAF_REFS` table (`kernel/ts/src/content/cartridge_leaf_refs.ts`) read by `refStage` (`kernel/ts/src/content/cartridge_refs.ts`); `kernel/ts/test/tags.test.ts` asserts the two tables are equal and name exactly each leaf's DefinitionRef fields in `protocol/policy.schema.json`. A leaf-specific check (EMPTY_TIME_WINDOW) is one clause in each. A later leaf (`skill_compare`, `owner`, `role`, ...; `status_active` and `npc_present` came with [row W6](#entity-description-variants-toolbox-row-w6)) adds its schema branch and invalid fixtures, its registry entry, its `holds()` case, its `LeafRefs` and `LEAF_REFS` entries when it names a definition, and its tests.
- **Sampler.** `cartridges/tags_sampler`: a wooden hall (`wooden`) with a wooden door north (`wooden`, `burnable`) and an iron door east (`metal`), a stick (`wooden`, `burnable`) and an iron rod (`metal`). Examining the wooden door shows its burnable variant; the iron door's identical `has_tag burnable` variant never shows; the hall's description reads its own tag through `subject: "room"`. The player sees no new Book element: tags show only through authored variants and later mechanics.
- **Composition record.** Consumer: description variants now, the G2, G12, W22 and row 31 mechanics later. Reads: definition data only; writes, events, jobs and save rows: none. Reused: the policy evaluator and its step budget, description variants, short-reference expansion, schema validation and capability ownership. New: the `Tag` vocabulary, the `tags` field and one leaf; no foundation change.

## Loot tables and random drops (toolbox row 8)

[Toolbox row 8](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#drop-declarations) govern it; the PM brief is in Beads `loka-kgd.20` (2026-10-10). The table lives on the creature, not the population: an NPC definition may declare `drops`, an ordered list of `{item, chance}`, each item an authored item the NPC holds at genesis and `chance` an integer percentage 1 to 100. Authored creatures (rats) are not population members, so a population plan could not carry their table; populations keep their fixed `loot_role` pelt or hide. Drops create no entity: they decide the custody of items that already exist.

- **Roll.** When combat's fatal producer runs the [death sequence](#death1--corpse-custody-and-same-body-return-m5-b-foundation) for an NPC with `drops`, the sequence draws one uniform integer in [0, 100) per entry, in table order, from the world RNG after the round's attack draws; an entry passes when roll < chance. Each entry draws even when its item is no longer held, so later entries keep their draw. Each draw has its own eight-raw-draw budget and does not count against the round's budget. A death without `drops` draws nothing, as before.
- **Custody.** Death custody transfers the victim's sorted held item roots to the corpse, except a held drop item whose entry failed: it stays held by the dead NPC, which nothing reaches: a table requires the NPC's `hp.gain` to be 0, so the dead NPC never regenerates, revives or re-rolls (the compiler and loader refuse a table on a regenerating NPC). Items the NPC holds that no entry names always transfer. Combat and, since [row G3](#statuses-on-npcs-and-things-toolbox-row-g3), a status tick kill an NPC; a status death draws the drops from the world's RNG; the bleed and water deaths are the player's body and draw nothing.
- **Replay.** The rolls are part of the committed proposal and its RNG state, so a replay returns the same receipt and state.
- **Book.** A dropped item appears in the corpse's Contents, where existing loot appears; the player sees no new line.
- **Sampler.** `cartridges/loot_sampler`: a rat holds a tail (chance 50) and a coin (chance 10); one player attack kills it. From seed `[1, 1, 1, 1]` the hit draw is followed by rolls 60 and 20 (nothing drops); from `[1, 2, 3, 4]` by 0 and 40 (the tail drops); from `[9, 10, 11, 12]` by 80 and 0 (the coin drops); from `[5, 6, 7, 8]` by 40 and 0 (both drop).

## Damage kinds, resistances and critical hits (toolbox row G2)

[Toolbox row G2](../MECHANICS-TOOLBOX.md#ranked-toolbox) (merges rows 7 and 40); [declarations](cartridge.md#damage-declarations) govern it; the PM brief is in Beads `loka-kgd.18` (2026-10-10). It refines the [combat@1](#combat1--first-live-encounter-m6-a) attack; a cartridge without its fields keeps its bytes, hash, draws and damage.

- **Variance.** The existing inclusive `damage_min`..`damage_max` roll is the hit variance; this row adds no second variance field.
- **Critical hit.** An attack profile's optional `crit {chance, multiplier}` makes a hit critical when its accuracy roll (the one uniform(100) every attack already draws) is below `crit.chance`; a critical hit's rolled damage is multiplied by `multiplier`. Deriving it from the hit draw costs no draw: one NPC attack can already spend hit, dodge, block and damage draws of the round's eight-raw-draw budget, so a fifth draw could exhaust it, and a cartridge that opts in keeps every later draw of the round in place. `crit.chance` is a percentage of attack rolls, so it is a share of hits only up to the profile's `chance`; a miss or a prevented attack is never critical. This is outcome randomness, not variety ([trap 5](../MECHANICS-TOOLBOX.md#traps) does not apply).
- **Kind.** An attack profile's optional `kind` is a `DamageKind` (`protocol/entity.schema.json`: `cold`, `fire`, `physical`, `poison`), a closed engine set like `Tag`; a profile without one matches no kind resistance. The player's kind is that of the profile that strikes (the usable wielded weapon's, else `world.combat.player_attack`).
- **Material.** When the wielded item's own `weapon.attack` strikes, the item's tags are the attack's materials; an unarmed strike (`world.combat.player_attack`, also while a weapon is held whose skill is not usable) and an NPC's attack carry none (PM ruling, `loka-kgd.18`).
- **Resistance.** An NPC definition's optional `resistances` maps a `DamageKind` or a `Tag` to a percent, -100 to 100 (negative is a weakness). An attack on that NPC sums the entries for its kind and each of its materials, clamps the sum to -100..100 and multiplies its damage by (100 - sum) / 100, rounded down. At 100 a hit deals 0 loss (`attack_result` keeps `hit: true`, `loss: 0`, narrated as a hit). The player carries none of its own; [rows SR4 and SR5](#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5) add an active status's entries for any struck body.
- **Order.** Rolled damage, then the crit multiplier, then resistance, then the sleep multiplier, then the target's HP cap.
- **Book.** No new line: a critical or resisted hit shows only as its HP change.
- **Sampler.** `cartridges/damage_sampler`: the player's unarmed attack and both swords' `weapon.attack` (skill `swords`) are chance 100, damage 5, `physical`, crit 10 x2; the `fighter` ancestry knows `swords`, the `farmer` does not; a wight (HP 20) resists `physical` 50 and `fire` 75 and takes `silver` -50; an iron sword (`metal`, `sharp`) and a silver sword (`metal`, `sharp`, `silver`) lie in the hall. One round from a hit roll of 60 leaves the wight 18 with the iron sword (5 at 50%: 2) and 15 with the silver one (50 - 50 = 0%: 5), and 18 for a farmer holding the silver sword (an unarmed strike: no silver); from a roll of 0 (critical) 15 and 10; with `fire` swords 19 (75%: 1.25, so 1) and 17 (25%: 3.75, so 3). From seed `[2229621088, 1003500358, 2750031949, 1263371380]` the silver fight leaves 15, 5, 0: the second round's player roll 6 is the one doubled hit.
- **Composition record.** Consumer: combat's attack (`kernel/ts/src/mechanics/combat/round_attack.ts`, `dealt`). Reads: the attack profile, the hit draw, the striking weapon's G1 tags and the target NPC's definition; writes, events, jobs and save rows: none new. Reused: the hit draw, the equipment slot lookup, G1 tags, checked integer arithmetic and the `KERNEL_API_RANGE_INVALID` floor. New: `DamageKind`, `Resistances`, `AttackProfile.kind` and `.crit`, `NpcDefinition.resistances` and the `silver` tag; no foundation change.

## Skill growth and opposed checks (toolbox rows 5 and G5)

[Toolbox rows 5 and G5](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#skill-growth-and-rating-declarations) govern it; the PM brief is in Beads `loka-kgd.19` (2026-10-10).

- **Growth.** A skill may declare `growth`, 1 to 8 strictly increasing positive use counts: the counts at which the level rises by one: for a taught skill they reach levels 2, 3 and so on, for an untaught one levels 1, 2 and so on. The count is a reserved player fact `uses_<key>` (int, default 0, minimum 0, maximum the last `growth` entry), synthesized beside `skill_<key>` only for a skill with growth and written only by skills@1. _Why a fact, not a row like levelling's:_ fact@1 already gives the op, composition, save, replay and the typed-value invariant in both kernels, and the count is one bounded integer per character and skill; a new row would need a new delta op and its compose twins for no added rule.
- **Level.** Derived on read, never stored: 1 when the skill is acquired (`skill_<key>`), else 0, plus the number of `growth` entries at or below the count. A skill without growth reads 1 acquired, 0 not. Qualification does not enter: it gates actions through their policies, as before.
- **Opposed check.** A recipe check `{kind: "opposed", key}` names exactly one of `skill` or `attribute`. It draws no RNG and passes when the commanded actor's value, read at admission, is at least the `rating` of the recipe's target detail: the skill's level, or the attribute's value as [attributes@1](#attributes1-kerneltssrcmechanicspolicyts60) reads it. The detail of a recipe with an opposed check must declare `rating` (an integer), unless the check names an `npc`: then the rating is that NPC's value of the attribute ([row G3](#statuses-on-npcs-and-things-toolbox-row-g3)).
- **Use.** Each accepted perform of a recipe whose opposed check names a skill with growth is one use, passed or failed: after the check event (position 1) the count gains 1, as a `fact.assign` whose `fact_changed` takes position 2; the outcome's sequence follows. The check reads the level before this use. At the maximum nothing is written, so practice stops at the last authored threshold and no gate exists beyond the authored ratings (trap 6). A rejected command uses nothing.
- **No leaf.** Neither acceptance needs a policy to read a level, so `skill_compare` waits for its first gating consumer, under the [leaf-set rule](#property-tags-and-the-policy-leaf-set-toolbox-row-g1).
- **Book.** Nothing new yet: the level reaches the player only through check outcomes; showing it on the Character page is a separate designer-approved Book change.
- **Sampler.** `cartridges/skills_sampler`: `pick` with growth `[1, 2, 3, 4, 5]`, not taught, and STR 8; in one room a chest rated 3, a gate rated 5 and a vault rated 7. Picking the gate fails five times (levels 0 to 4) and opens on the sixth (level 5); then picking the chest passes (5 ≥ 3) and the vault fails (5 < 7), and the count stays 5; forcing the vault by STR passes (8 ≥ 7).
- **Composition record.** Consumer: action recipes. Reads: the skill acquisition fact, the count fact, attributes@1 values and the target detail's definition. Writes: the count by `fact.assign`; events: the existing `check_passed`/`check_failed` and `fact_changed`; jobs and save rows: none new. Reused: check@1, fact@1 reserved facts and their ownership, attributes@1 `value`. New: the `growth` and `rating` fields and the `opposed` check kind; no foundation change.

## Hidden passages and search (toolbox row 11)

[Toolbox row 11](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#hidden-passage-declarations) govern it; the PM brief is in Beads `loka-kgd.26` (2026-10-10).

- **Hidden face.** An exit may declare `hidden_until {fact, equals}`. While the commanded character's value of that fact differs from `equals`, the exit does not exist for that character: [movement@1](#movement1-kerneltssrcmechanicsmovementrulets) `sight` (scan and the GameView's exits) omits it, the D10 map draws no link for it even when both rooms are visited, and a Move through it is `not_found`, the same code as a direction with no exit, decided before barrier, water, position or fare admission, so a forged Move learns nothing. A hidden face carries no barrier, so no door verb (open, close, lock, unlock, knock) can name it. Each face is declared on its own: a passage hidden from one side may stand open from the other. A fleeing NPC never takes a face that declares `hidden_until`, whether or not the player has found it: hound flight (`kernel/ts/src/mechanics/combat/behavior.ts` `flightExit`) and sighted refuge (`kernel/ts/src/mechanics/population/behavior.ts` `refuge`) skip it, so no enemy_fled or sight narration names it; the NPC has no value of the fact, and reading the player's would make NPC moves depend on the player. The player's Flee skips a face hidden from them (it draws from the moves admission allows). A patrol leg with any hidden face to its next room, or an expedition route edge through one, is refused at load ([declarations](cartridge.md#hidden-passage-declarations)). Known limit (open): a wandering population member or the crow may still cross a hidden face; cartridges keep those areas off hidden faces until a later row decides.
- **Search.** Discovery is an ordinary [action recipe](#action_recipe1-mechanicsaction_reciperulets49) whose outcome assigns the fact, with or without a [check](#check1-mechanicsaction_reciperulets109); the fact is normally `player`-scoped so the find belongs to the character, like D10's visited rooms. _Why a fact, not a discovered-exit row:_ fact@1 already gives the op, save, replay and per-character scope in both kernels; a row would need a new delta op for no added rule.
- **No leaf.** Gating reads the fact directly; no policy leaf is added, so the [leaf-set rule](#property-tags-and-the-policy-leaf-set-toolbox-row-g1) does not apply.
- **Book.** No new element: the found exit joins the existing Exits list, Scan and Map; the search's authored narration tells the player what changed. (Wording proposed; designer to approve.)
- **Sampler.** `cartridges/hidden_sampler`: a hall whose east face to a study is hidden until the player fact `panel_found`; `search` on the hall's panel sets it. The hall also leads north to a gallery, east to a stairhead and south to the study, whose west face back to the hall is not hidden. Before the search the hall lists only north, a forged `move east` is `not_found`, and after walking hall, gallery, stairhead, study, hall the map links the study west but not the hall east; after it the hall lists east, the map links it and the move succeeds.
- **Composition record.** Consumer: movement admission, `sight`, the D10 map, NPC flight and refuge, and the patrol and expedition route checks. Reads: the exit's definition and one fact value; writes, events, jobs and save rows: none new (the search writes through fact@1). Reused: fact@1 values and scopes, action recipes, the `corpse_ingress` `{fact, equals}` shape and its reference checks, the `KERNEL_API_RANGE_INVALID` floor. New: `Connection.hidden_until` and the `hidden` predicate (`kernel/ts/src/mechanics/lookups.ts`, beside `exitOf`); no foundation change.

## Time windows: hour and moon gates (toolbox row 10)

[Toolbox row 10](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#time-gate-declarations) govern it; the PM brief is in Beads `loka-kgd.27` (2026-10-10).

- **`sky {lunar}`** (owned by `calendar@1`): holds when the lunar phase at the committed clock is `lunar`: the phase of the last `calendar.lunar.phases` cut at or before ((clock - origin) mod period), the value the calendar status already shows (`lunarPhase`, `kernel/ts/src/mechanics/calendar.ts`). Derived on read, never stored or ticked ([trap 1](../MECHANICS-TOOLBOX.md#traps)). One phase per leaf; a set of phases is an `any` of leaves. The field is named for the calendar cut it reads, so [row 31](../MECHANICS-TOOLBOX.md#ranked-toolbox) adds its weather, season and tide as alternative fields of the same leaf (`exactlyOneRequired`), not new leaves. It names no definition, so it has no `LEAF_REFS` entry. The hour gate is the existing `time_window` (schedule@1).
- **Gate.** A barrier definition's optional `opens_when` (a VersionedPolicy) must hold for `open`: after the state checks (a locked barrier is still `exit_locked`), a failing condition refuses `invalid_state`. Close, lock and unlock ignore it, and an open barrier stays open when the condition stops holding: nothing closes it on a clock edge. The check is in `transition` (`kernel/ts/src/mechanics/barrier/rule.ts`), so the GameView offers Open on that door only while the condition holds, and the exit stays `exit_closed`. A barrier, not an exit, carries the gate: movement admission is unchanged.
- **Book.** Nothing new: outside its window the closed door shows no Open, as a locked one does; a typed `open` is refused with the existing invalid_state wording. A cartridge says why in its own words with a description variant on the same leaf ([trap 12](../MECHANICS-TOOLBOX.md#traps): the sign is in the text).
- **Sampler.** `cartridges/time_sampler`: 100 units an hour, 10 hours a day, a lunar period of 2000 (`new` from 0, `full` from 1000). From the hall the silver door north (`opens_when: sky lunar full`) is refused at 0 and 999, opens at 1000, is refused again at 2000 and opens at 3000; the brass door east (`opens_when: time_window 2 to 4`) is refused at 199, opens at 200, is refused at 400 and opens at 1399. The hall's description has a full-moon variant.
- **Composition record.** Consumer: barrier@1's `open` and every policy site (variants, recipes, reactions). Reads: the committed clock and the authored calendar; writes, events, jobs and save rows: none. Reused: the policy evaluator and its step budget, the lunar cut lookup of the calendar status, barrier@1's transition and the GameView door verbs. New: the `sky` leaf and `BarrierDefinition.opens_when` (`kernel_api` at least 1.45); no foundation change.

## Rope and climb (toolbox row 30)

[Toolbox row 30](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#climb-declarations) govern it; the PM brief is in Beads `loka-kgd.28` (2026-10-10).

- **Climb face.** An exit may declare `climb {item, damage, fell}`. A [movement@1](#movement1-kerneltssrcmechanicsmovementrulets) Move through it is admitted exactly like any other (a [hidden face](#hidden-passages-and-search-toolbox-row-11) is still `not_found`, a barrier still bars it, position and fare still apply); only then does the climb decide. A mover whose body holds `item`, directly or inside a container it carries (the `has_item` reading, `kernel/ts/src/mechanics/policy.ts` `held`), climbs down: the move is ordinary. One without it falls: the move still happens (the body lands in the destination, with the same transfer, events and route progress), and it also loses `damage` HP after the fare, as one more `resource.adjust` after the transfer, with the authored `fell` narration first. The player's Flee may choose a climb face and falls the same way. _Why a named item, not a tag:_ the aid is one authored thing, the reference and its checks already exist, and a `rope` tag would add an engine vocabulary entry for a single consumer; a cartridge that wants several aids authors several faces or waits for a G4-style use verb.
- **A fall never kills.** The loss stops at 1 HP (or the pool's minimum, if higher); there the climber still falls (narrated) and loses nothing. _Why:_ a death inside a Move would compose the transfer with the [death sequence](#death1--corpse-custody-and-same-body-return-m5-b-foundation) (a corpse in the destination, the return to the shrine, a new `entity_died` cause in the event contract) for a slice of size S; the fall is a consequence, not a gate ([trap 8](../MECHANICS-TOOLBOX.md#traps)). A lethal fall is a later row if a cartridge needs one.
- **NPCs.** An NPC never takes a face that declares `climb`: hound flight (`kernel/ts/src/mechanics/combat/behavior.ts` `flightExit`) and sighted refuge (`kernel/ts/src/mechanics/population/behavior.ts` `refuge`) skip it, and a patrol leg with any climb face to its next room is refused at load ([declarations](cartridge.md#climb-declarations)). Known limit (open), as for hidden faces: an escort follower, a wandering population member or the crow may still cross a climb face, unhurt; cartridges keep those off climb faces until a later row decides.
- **No leaf.** Admission reads the item's custody directly; no policy leaf is added, so the [leaf-set rule](#property-tags-and-the-policy-leaf-set-toolbox-row-g1) does not apply.
- **Book.** No new element: the exit stays in the Exits list, Scan and Map; the fall shows as its authored narration line and the HP change. (Wording proposed; designer to approve.)
- **Sampler.** `cartridges/climb_sampler`: a clifftop (HP 10, no regeneration) whose down face to a ledge is a climb needing the rope that lies there (damage 4); the ledge's up face is plain. Climbing down without the rope four times leaves HP 6, 2, 1 and 1, each time on the ledge with the fall narrated; after taking the rope the climb is unhurt and silent.
- **Composition record.** Consumer: movement (`moveSequence`, `kernel/ts/src/mechanics/movement/sequence.ts`), NPC flight and refuge, and the patrol route check. Reads: the exit's definition, the item's custody and the HP level after the fare; writes: one `resource.adjust` of HP; events, jobs and save rows: none new. Reused: movement admission and its hidden and barrier gates, `has_item`'s `held`, `resource.adjust`, narration keys, item reference checks, the `KERNEL_API_RANGE_INVALID` floor. New: `Connection.climb` and the `fall` helper (`kernel/ts/src/mechanics/movement/shared.ts`); no foundation change.

## Narration variety and visit tiers (toolbox row W7)

[Toolbox row W7](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#narration-variety-declarations) govern it; the PM brief is in Beads `loka-kgd.29` (2026-10-10). Owned by the ruleless `variety@1`, opt-in: Chapter 1 and the corpus do not lock it and are unchanged.

- **Alternates.** `alternates` maps a text key to its alternates. Every committed narration line whose key has alternates shows one of the key and its alternates, `n` lines in all, chosen once when the proposal is composed (`propose`, `kernel/ts/src/runtime/proposal.ts`; the pick is `kernel/ts/src/mechanics/variety.ts`): line `i` (0 the key itself, then the alternates in order), where `i` is the first four bytes of SHA-256 of the UTF-8 string `<command id>:<key>`, read as a big-endian unsigned integer, modulo `n`. The authority RNG is never drawn ([trap 5](../MECHANICS-TOOLBOX.md#traps)), so a world reaches the same state with and without alternates. The receipt stores the chosen key, so redisplay and reopen show the same line, and replaying the same command ids replays the same lines; every line is authored ([trap 4](../MECHANICS-TOOLBOX.md#traps)). An alternate is shown as written: its own alternates are not applied. Lines with the same key in one command show the same alternate. Only committed narration varies: descriptions and labels the GameView derives from state have no command id and show their key.
- **`visited_count {room, at_least}`** (owned by `variety@1`): holds when the actor's count of accepted body entries into `room`, the current entry included, is at least `at_least` (at least 1). A new character's start room counts as visited once (D10 records it at creation); any other room's count is 0 until the actor enters it. Two entries into the room in one command count twice (the second `visit.record` follows the first in the same writer group). It is stored, not derived: rules are pure over committed state and the visits relation records a room once, so nothing committed counts entries. With `variety@1` and `knowledge@1` locked, every later entry writes `visit.record` with `from`, the current row, and `value.count`, its count (1 when absent) plus one; a first visit has neither. Both kernels' composition and the knowledge invariant refuse a missing, stale or skipped count (`protocol/fixtures/knowledge_composition.json`). Without `knowledge@1` nothing is recorded and the count stays 0; the compiler warns (VISITS_UNRECORDED, the build succeeds). A tier is a description variant on this leaf: the first visit shows the base description, the tenth the variant.
- **Save.** `VisitedRoom` gains the optional `count` (at least 2; absent means 1) and `visit.record` the optional `from`; the host keeps both in the existing `visited_rooms` rows. A world without `variety@1` saves exactly as before.
- **Book.** Nothing new: a varied line is an ordinary narration line, a tier an ordinary description.
- **Sampler.** `cartridges/variety_sampler`: in the hall, `walk` narrates `narration.walk` or one of its two alternates; over twelve walks all three show, and the same command ids give the same lines. The garden north shows its long description on visits one to nine and the one-line `room.garden.familiar` from the tenth.
- **Composition record.** Consumer: every committed narration line (recipes, reactions, jobs) and every policy site (variants, recipes, reactions, gates). Reads: the command id, the cartridge's alternates, the actor's visit rows; writes: the `visit.record` count; events and jobs: none. Reused: the proposal's narration, SHA-256, the knowledge recorder and its composition, the policy evaluator and description variants. New: `alternates`, the `visited_count` leaf, `VisitedRoom.count` and `visit.record.from` (`kernel_api` at least 1.45); the only foundation change is the counted visit in both kernels' composition.

## Derived sky: weather, season and tide (toolbox row 31)

[Toolbox row 31](../MECHANICS-TOOLBOX.md#ranked-toolbox) (W5 merged into it); [declarations](cartridge.md#sky-declarations) govern it; the PM brief is in Beads `loka-kgd.30` (2026-10-10). Archived precedent: spec 21 `tide@1` (derived, never stored).

- **Derived, never stored.** `calendar.season` and `calendar.tide` are cycles shaped like `calendar.lunar` (`CalendarCycle`: `period`, `origin`, ordered `phases` cuts in logical units): the phase at the committed clock is the last cut at or before ((clock - origin) mod period). `calendar.weather` is a table of `{phase, weight, wet?}`; each calendar day (the status `day`, floor(clock / day length) + 1) takes one entry with probability weight / total weight. The draw is the first four bytes, read as a big-endian unsigned integer, of SHA-256 over the UTF-8 text `weather:<world context id>:<day>`, modulo the total weight, walked down the table in order. The world context id is the stable per-world key (`World.context`): `state.rng` advances on every authority draw, so it is never read ([trap 5](../MECHANICS-TOOLBOX.md#traps)); the same world and day always give the same weather, whatever the authority seed. Nothing is written, ticked or saved ([trap 1](../MECHANICS-TOOLBOX.md#traps)). One reader serves every consumer: `sky(cartridge, context, time)` and `weather(...)` in `kernel/ts/src/mechanics/calendar.ts`.
- **`sky {weather | season | tide}`**: the [row 10 leaf](#time-windows-hour-and-moon-gates-toolbox-row-10) takes exactly one of `lunar`, `weather`, `season` or `tide` (`exactlyOneRequired`) and holds when that derived phase is the named one.
- **`exposed`** joins the closed `Tag` set (rooms declare it; it has a `Resistances` member like every tag, which no weapon uses). light@1's `ignite` is refused `invalid_state` while the body's room is `exposed` and the day's weather entry is `wet`, inside the shared `transition` (`kernel/ts/src/mechanics/light/shared.ts`), so the GameView offers no Ignite there. A torch already lit stays lit when rain begins or when carried into the rain: putting it out would need a clock edge (trap 1).
- **Book.** The status line shows the weather in words beside the sky glyph and adds weather, season and tide to the glyph's accessible label ([Book UI](book-ui.md#world-and-status-entry); trap 12). A cartridge says why a torch will not light with a description variant on `sky weather` (the sign is in the text).
- **Sampler.** `cartridges/sky_sampler`: 100 units an hour, 10 hours a day; weather `clear` 1, `rain` 1 (wet); season `spring` from 0 and `autumn` from 2000 of 4000; tide `low` from 0 and `high` from 250 of 500. The yard (`exposed`) has a rain variant; the shed east is sheltered. With world id `5b7d9f1a-3c5e-4a7b-9d1f-4a6c8e0b2d4f` days 1 to 5 are rain and day 6 is clear: a held torch is refused in the yard on day 1, lights in the shed, and lights in the yard at 5000.
- **Out of scope.** Seasonal weather tables, tide-gated connections (archived `tide@1`), a rain status row (no state: trap 11) and dousing a lit flame.
- **Composition record.** Consumer: description variants and every policy site, the GameView calendar status, light@1's ignite; later W25 exposure through `sky()` and `weather()`. Reads: the committed clock, the world id and the authored calendar; writes, events, jobs and save rows: none. Reused: the lunar cut lookup (now `CalendarCycle`), the policy evaluator, G1 tags, light@1's shared transition and the GameView verb filter, the SHA-256 foundation. New: `calendar.weather`, `.season`, `.tide`, three `sky` fields, three `CalendarStatus` fields and the `exposed` tag (`kernel_api` at least 1.45); no foundation change.

## Pick and force a barrier (toolbox rows 13 and G12)

[Toolbox rows 13 and G12](../MECHANICS-TOOLBOX.md#ranked-toolbox), content only; [declarations](cartridge.md#pick-and-force-declarations) govern it; the PM brief is in Beads `loka-kgd.35` (2026-10-10).

- **Content, not a barrier field.** A keyless barrier starts `closed` with an [`opens_when`](#time-windows-hour-and-moon-gates-toolbox-row-10) that reads an instance fact (`fact_compare picked true`); an [action recipe](#action_recipe1-mechanicsaction_reciperulets49) on a detail that stands for its lock, with an [opposed check](#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5) against the detail's `rating`, assigns that fact on success. _Why not a barrier field or a new verb:_ failure must be able to write something (a jam, a use of the skill), and only an accepted recipe with a check commits a failure (04 §5.0); a barrier verb that fails is a rejection and changes nothing. A recipe step that changes barrier state would also have to pass `BARRIER_UNREACHABLE_KEY`, which refuses a locked barrier with no key in reach in both kernels; a closed barrier behind `opens_when` needs neither.
- **Pick (row 13).** The check names a skill (`{kind: "opposed", skill}`), so each attempt, passed or failed, is a use and the level grows by the skill's `growth` (rows 5 and G5). The check draws no RNG, so replay needs nothing new.
- **Jam.** "Failure may jam" is authored per recipe: a failure sequence that assigns a jam fact, and a recipe policy that requires it false, so a jammed lock offers no more picks. A recipe whose failure assigns nothing can be retried. The jam gates only further picks, not the barrier itself: a cartridge that jams a lock a quest needs gives it another way, such as force.
- **Force (row G12).** The check names an attribute (`{kind: "opposed", attribute: "str"}`, row 2's attributes@1 value) and the recipe's policy reads the barrier's tag with [`has_tag {barrier, tag: "fragile"}`](#property-tags-and-the-policy-leaf-set-toolbox-row-g1), so against a door without `fragile` (iron, `metal`) the force is shown unavailable and refused; success assigns the fact its `opens_when` reads (an `any` when a door can be picked or forced).
- **After.** The fact stays: the barrier then opens and closes like any other and, without a `key_item`, can never be locked again (`not_owned`).
- **Known limit (open).** A recipe targets a room detail and items have no fixed flag, so a pickable container should stay where its lock detail is; the sampler's chest can still be carried off, and its lock picked from the storeroom. Each force recipe also carries its own `has_tag fragile` condition: a force recipe written without it would force any door.
- **No leaf.** Gating reads facts and tags through existing leaves; the [leaf-set rule](#property-tags-and-the-policy-leaf-set-toolbox-row-g1) does not apply.
- **Book.** Nothing new: until the fact holds the closed door or lid shows no Open, as a locked one does; the pick and force recipes are offered as actions with their authored labels, shown unavailable while their policy fails (a jammed lock, a door without `fragile`, a lock already picked), and a jammed lock says so in a description variant, an unforceable door in its base description ([trap 12](../MECHANICS-TOOLBOX.md#traps)). (Wording proposed; designer to approve.)
- **Sampler.** `cartridges/barrier_sampler`: `pick` with growth `[1]`, not taught, and STR 8. In the storeroom a keyless chest (an item whose lid opens when `chest_picked`) with its lock detail rated 1, a fragile wooden door north (`wooden`, `fragile`; opens when `door_picked` or `door_forced`) rated 5 whose failed pick sets `door_jammed`, and an iron door east (`metal`) rated 5 whose force recipe requires `fragile`. Opening the chest is refused, the first pick fails (level 0), the second passes (level 1) and the chest opens; picking the door fails (1 < 5) and jams it, so a second pick and opening north are refused; forcing it passes (8 ≥ 5) and north opens; forcing the iron door is refused and east stays shut.
- **Composition record.** Consumer: action recipes and barrier@1's `open`. Reads: instance facts, skill and attribute values, the detail's `rating`, the barrier's tags. Writes: facts by `fact.assign` and the use count; events: the existing `check_passed`/`check_failed` and `fact_changed`; jobs and save rows: none new. Reused: check@1's opposed check, skills@1 growth, attributes@1, tags@1's `has_tag`, row 10's `opens_when`, fact@1. New: nothing in the engine and no field; the `kernel_api` floor is row 10's 1.45 for `opens_when`.

## Traps: trigger, disarm and reset (toolbox row 12)

[Toolbox row 12](../MECHANICS-TOOLBOX.md#ranked-toolbox), content only, after [C2-M03](../archive/LATER-MECHANICS.md) (one trap with revealed state, one trigger, one legal avoidance path; reset policy is content, never inferred); [declarations](cartridge.md#trap-declarations) govern it; the PM brief is in Beads `loka-kgd.73` (2026-10-10).

- **Content, not a trap field.** A trap is two instance bool facts (spent and disarmed), a [row 1](#status-effects-over-time-toolbox-row-1) status and three [reactions](#reaction1-kerneltssrcmechanicsreactionts); its avoidance is a [search](#hidden-passages-and-search-toolbox-row-11) and a disarm recipe. _Why no engine state (the row's barrier-state and bleed-job hints):_ fact@1 already gives the spent and disarmed state its op, save row, replay and scope in both kernels, the status gives the timed harm, and W1's triggers give every event a trap fires or resets on; a trap row or job would add a delta op and a save section for no rule these lack.
- **Trigger.** A reaction on the event that springs it (the sampler: `entity_entered_room` into the vault) whose `when` requires both facts false applies the status and assigns the spent fact. The status lands on the event's subject, the entrant (row G3); the spent write makes it fire once: a second crossing finds the fact true and the rule does not match. Removing the write is the red control.
- **Disarm.** A recipe on a room detail with an [opposed check](#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5) against the detail's `rating` assigns the disarmed fact on success; its policy may require a player fact a search recipe sets (row 11), so the trap must be found first. A failed disarm of an armed trap harms the doer through a reaction on `check_failed {check}` gated on the spent fact false, whose status lands on the actor's body ([reaction@1](#reaction1-kerneltssrcmechanicsreactionts)): `status.apply` is a reaction step, not a recipe outcome op.
- **Reset policy.** Authored per trap as one more reaction that assigns the spent fact false, gated on it being true; with none the trap is one-shot. The sampler re-arms on [`clock_hour`](#exposure-cold-hot-damp-and-windy-toolbox-row-w25) (one firing per settlement, its known limit), so the plate stays spent until the next game-hour boundary, from a moment to an hour, not a fixed time after it fired; `status_expired`, `entity_entered_room` elsewhere or `rested` serve as well. A disarmed trap never fires again whatever the reset does, since the trigger reads the disarmed fact.
- **Known limits.** The facts are instance-scoped, so a trap sprung or disarmed by one character is so for every character of the world. Any entrant springs it: a scheduled NPC walking in takes the status (row G3) and spends the trap; an author who wants only players to spring it keeps NPC routes away.
- **Traps.** Trap 11: no status row on the plate; its state is two facts. Trap 12: the found, disarmed and harm states are words (the detail's variants and the status's lines).
- **Book.** Nothing new: the search and disarm are offered as actions with their authored labels, the disarm shown unavailable until the trap is found and after it is disarmed; the found and disarmed states are the detail's description variants; the harm is the status's applied line and condition. (Wording proposed; designer to approve.)
- **Sampler.** `cartridges/traps_sampler`: an antechamber whose `flagstones` (rating 1) hide a plate on the vault threshold north; `poison` lasts 300, -1 hp every 60, hp 10 with no gain; `disarm` grows `[1]`, not taught. Entering the vault at 0 poisons (ends 300) and spends the plate; re-entering at 120 changes nothing; at the 3600 clock_hour the plate re-arms (hp 6) and the next entry opens generation 2 (ends 3900). On a fresh world disarm is refused before the search; after it the first disarm fails (level 0 < 1) and poisons the doer, the second passes, and entering at 120 leaves the poison as it was.
- **Composition record.** Consumer: reactions, action recipes and description variants. Reads: two instance facts and one player fact, the skill level and the detail's `rating`. Writes: `fact.assign` and the status transition; events: the existing `entity_entered_room`, `check_failed`, `fact_changed` and `clock_hour`; jobs: the existing status and calendar jobs; save rows: none new. Reused: row 1's status, G3's subject-following apply, W1's `check_failed` trigger and filter, W25's `clock_hour`, row 11's search-by-fact, G5's opposed check, fact@1. New: nothing in the engine and no field; the `kernel_api` floor is W25's 1.46 for `clock_hour`.

## Sequence and combination puzzles (toolbox row 26)

[Toolbox row 26](../MECHANICS-TOOLBOX.md#ranked-toolbox), content only; [declarations](cartridge.md#puzzle-declarations) govern it; the PM brief is in Beads `loka-kgd.75` (2026-10-10). Riddles are dialogue's (`mechanics/dialogue/shared.ts`); this row adds the order and dial puzzles.

- **Content, not a puzzle field.** A puzzle is bounded int instance facts, one action recipe per lever or wheel (a room detail), [reactions](#reaction1-kerneltssrcmechanicsreactionts) on `action_completed {action}` and a barrier whose [`opens_when`](#time-windows-hour-and-moon-gates-toolbox-row-10) compares the facts. _Why no engine state:_ fact@1 gives the progress its op, save row, replay and scope; reactions run in rule-key order and each rule's `when` reads the writes of the rules before it in the same delivery, so an ordered pair of rules is a conditional step, and the later rule's write of the same fact wins ([reaction@1](#reaction1-kerneltssrcmechanicsreactionts); archived 04 §5.3 differs: [difference 11](DIFFERENCES.md)).
- **Order puzzle.** An int fact counts how many levers of the order are pulled in a row (the sampler: `lever_stage` 0 to 3, order A, B, C). The first lever's recipe assigns 1 itself, so pulling it always restarts the order at 1. Every other lever has two reactions: a reset (`when` not stage == its place - 1, assign 0) whose key sorts before its step (`when` stage == its place - 1, assign its place); `lever_b_reset` before `lever_b_step`. Any other lever pulled out of turn resets to 0, and a reset never lets its own step fire, since the step reads 0. Keying the reset after the step is the red control: the step's write fails the reset's `when`, so the right lever resets too.
- **Dial puzzle.** One bounded int fact per wheel, 0 to 10 (one past the last digit, so the clamp never stops 9 to 10). A wheel's turn rule `fact.adjust`s it by 1 ([row 15](#standing-and-disposition-toolbox-rows-15-and-g11)); a wrap rule keyed after it assigns 0 when it reads 10, so 9 turns to 0 within one command. The door's `opens_when` is an `all` of one `fact_compare` per wheel. Dropping the wrap rule is the red control.
- **Known limits.** No reaction opens a barrier: a solved puzzle makes `open` admissible and the player opens the door; a lever pulled or a wheel turned after solving and before opening locks it again, and an opened door stays open ([row 10](#time-windows-hour-and-moon-gates-toolbox-row-10)). The facts are instance-scoped, so the puzzle state is shared by every character of the world. A wrap commits two `fact_changed` events (to 10, then to 0), so a rule on a wheel's `fact_changed` sees the 10. Each lever appears once in the order (A, B, A cannot be built: the first lever always restarts). A spoken dial is not offered: a [`say`](#social-verbs-say-whisper-and-shout-toolbox-row-g9-engine-half) word is letters only. The order length and the number of wheels cost one fact value and two rules per lever or wheel.
- **Book.** Nothing new: each lever and wheel is an action with its authored label, the door's Open is offered only while its condition holds, and the progress is never shown except by narration and description variants the author adds. (Wording proposed; designer to approve.)
- **Sampler.** `cartridges/puzzles_sampler`: a hall with levers A, B and C (north door) and three wheels (east door, code 3, 1, 2), each showing its digit by a description variant per digit 1 to 9. A, C resets the stage to 0, B leaves it 0 and north is refused; then A, B, C reaches 3 and north opens. Wheels at 3, 1, 1 refuse east; one more turn of the third opens it. Nine turns of a wheel read 9, the tenth reads 0.
- **Composition record.** Consumer: barrier@1's `open`. Reads: instance facts through the policy evaluator. Writes: `fact.assign` (the first lever's recipe step, the reactions', and `fact.adjust` lowered to it); events: the existing `action_completed`, `custom_event` (the other recipes' required step) and `fact_changed`; jobs and save rows: none new. Reused: W1's `action_completed` trigger and filter, rule-key order and proposal-so-far `when`, row 15's reaction `fact.adjust` and clamp, row 10's `opens_when`, action_recipe@1, fact@1. New: nothing in the engine and no field; the `kernel_api` floor is row 15's 1.47 for a reaction's `fact.adjust`.

## Exposure: cold, hot, damp and windy (toolbox row W25)

[Toolbox row W25](../MECHANICS-TOOLBOX.md#ranked-toolbox) (owner 2026-10-10: cold, hot, damp, windy, dry); [declarations](cartridge.md#exposure-declarations) govern it; the PM brief is in Beads `loka-kgd.39` (2026-10-10).

- **`wearing {tag}`** (owned by equipment@1): holds when an item in one of the actor's body's slot holders (what [equipment@1](#equipment1-kerneltssrcmechanicsequipmentrulets) calls worn) declares `tag`; a carried item does not count. It names no definition, so it has no `LEAF_REFS` entry ([leaf-set rule](#property-tags-and-the-policy-leaf-set-toolbox-row-g1)).
- **Tags.** `warm`, `cool`, `waterproof` and `windproof` join the closed `Tag` set (each with its `Resistances` member, which no weapon uses); only `wearing` reads them.
- **`clock_hour`** (owned by schedule@1): a cartridge with a reaction on it gets one unbound pending job of kind `calendar` per world, due at the first hour boundary after the start. A due run emits one `clock_hour` (instance scope, no payload fields) at the committed clock, the advance's target, and schedules its successor at the first hour boundary strictly after that clock. It reads nothing else, so replay is unchanged. One settlement that crosses many boundaries fires once ([trap 1](../MECHANICS-TOOLBOX.md#traps)): the host never ends an elapsed step at this job (`mobile/authority/local-story/elapsed.ts` boundary), so a long absence is one firing, not one per elapsed hour. _Known limit:_ the host also ends an elapsed step at every other due job, so an absence with pending jobs (a status tick every 7200, say) fires once per such step: a ten-hour absence with a chilled body commits about five, never one per hour (Beads `loka-kgd.47`). Its reaction has no filters; a status lands on the actor's body ([reaction@1](#reaction1-kerneltssrcmechanicsreactionts)).
- **Drains.** Content, on [row 1](#status-effects-over-time-toolbox-row-1) statuses: per condition one reaction on `entity_entered_room` into each exposed room and one on `clock_hour`, both with `when` all(`sky {weather}`, `has_tag {tag: "exposed", subject: "room"}`, not `wearing {tag}`), applying that condition's status. While the conditions hold, each game hour refreshes `ends_at` silently: the applied line comes only on a first application. In shelter nothing refreshes and the status expires by itself, after at most one tick that was already due, with no cure. A due tick or expiry and a refresh in one settlement commit in order in the holder's writer group ([row G3](#statuses-on-npcs-and-things-toolbox-row-g3)); an expiry and a re-application in one settlement open the next generation, as row 1 says. When the expiry and the calendar job are due at the same time they run in job-id order, so the hour is either a refresh while active (same generation) or an expiry and re-application (next generation); both follow row 1. The event carries the committed clock, which is in the same hour (so the same day and weather) as the last boundary; a later-due job in the same settlement may carry an earlier logical time (known limit).
- **Dry.** A drought day's thirst drain, ended by any drink: [hunger, thirst and dry days](#hunger-thirst-and-dry-days-toolbox-rows-g13-and-w25-dry).
- **Book.** Nothing new: each condition is a status whose label is a line in words on the Character page, and the room's weather variant says why ([trap 12](../MECHANICS-TOOLBOX.md#traps)).
- **Sampler.** `cartridges/exposure_sampler`: 3600 units an hour, 24 hours a day (Chapter 1's 72 s per game hour at rate 50); weather `clear`, `frost`, `heat`, `rain` (wet), `gale`, weight 1 each; the fell (`exposed`) north of the inn has a variant per weather; a wool cloak (`warm`), straw hat (`cool`), oilskin (`waterproof`) and scarf (`windproof`); `chilled`, `overheated`, `soaked` and `windburnt` each drain 1 hp every 7200 (2.4 real minutes) for 9000, hp 10 without regeneration and a pool minimum of 1, so exposure alone never kills ([trap 6](../MECHANICS-TOOLBOX.md#traps)). With world id `7e1f0c2a-5d3b-4c8e-9a6f-000000000003` days 1 to 5 are frost, clear, gale, heat and rain: on day 1 a body with a carried cloak is chilled on the fell, at hp 8 after 14400, and in the inn the condition ends by 23400 at hp 7; with the cloak worn nothing applies.
- **Composition record.** Consumer: reactions (status drains) and every policy site. Reads: worn items' tags, the committed clock. Writes: the calendar job's completion and successor; events: `clock_hour`; statuses through row 1; save rows: none new. Reused: row 1 statuses, row 31's `sky` leaf and `exposed` tag, G1's `has_tag`, reaction@1, the run_job drain, equipment@1's slot holders, G3's per-holder writer groups. New: the `wearing` leaf, four tags, the `clock_hour` event and job (`kernel_api` at least 1.46); the host's elapsed boundary skips that job.

## Statuses on NPCs and things (toolbox row G3)

[Toolbox row G3](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#status-declarations), [composition](protocol.md#status-composition) and [recovery](save.md#status-recovery) govern it; the brief and its decisions are in Beads `loka-kgd.33` (2026-10-10). It extends [row 1](#status-effects-over-time-toolbox-row-1) from the player's body to NPCs and items; the row shape, generations, refresh and the unbound tick job are unchanged.

- **Holders.** A status row's holder (`body_id`) is the player's body, a living NPC (a dead one, hp 0, takes nothing) or an item, or since [status reader 9](#a-room-as-a-status-holder-status-reader-9) a room; both kernels refuse any other entity (a detail or slot). A `status.apply` step lands on the event's subject ([reaction@1](#reaction1-kerneltssrcmechanicsreactionts) table) or, when the step names `item` (or `npc`, [row 42](#potions-and-songs-toolbox-rows-18-and-42)), on that authored item's (or NPC's) instance, or with `co_present` ([row W21](#fear-and-morale-for-npcs-toolbox-row-w21)) on every living NPC in the event's room; a subject of another kind takes nothing and the rule's other steps still run. Barriers have no EntityId, so a door that burns is an item; fire opens a barrier by a reaction's `barrier.set` instead ([row W22](#fire-toolbox-row-w22)), and a barrier never holds a status.
- **Immune.** An NPC or item definition may declare `immune`, a list of this cartridge's statuses; `status.apply` writes nothing for a listed status on that instance, or on an NPC or item created from that definition (it copies the list), so it never ticks. Every applier gets the check, since it sits in the one apply helper.
- **Tick.** The due job finds the active row that names it (its `job_id`) and so its holder. An NPC's tick adds `per_tick` to that NPC's pool, saturating as in row 1; an item has no pools, so its tick changes nothing. A negative tick that brings an NPC's `hp` to 0 inactivates the status, closes its encounter when it is the only opponent (a pack fights on, as in combat), and runs the ordinary [death sequence](#death1--corpse-custody-and-same-body-return-m5-b-foundation) with no killer and no credit, its drops drawn from the world's RNG. Every NPC death ends the NPC's active statuses, so no later tick lands on the dead body. The status jobs on one holder due in one advance share a writer group, so two statuses on one pool (poison and fire on the guard) tick in sequence instead of conflicting; this also holds for the player's body. A reaction's `status.apply` on a holder shares that holder's group in the advance, whether it runs before or after the holder's status job, so a tick that re-poisons its holder, an expiry that re-sets the status, or a re-entry refresh due with a tick commits in order.
- **Events.** Every due tick, on any holder and whether or not a pool changed, emits `status_ticked {body_id, status}`; every expiry emits `status_expired {body_id, status}`; a cure or a death emits neither. A reaction's first application emits `status_applied` ([status reader 2](#status-readers-toolbox-rows-sr1-sr2-and-sr3)). Both are status@1's, instance-scoped like a scheduled NPC's entry, and trigger reactions with an optional `status` filter; the subject is `body_id`, so a reaction's `status.apply` lands on the ticking holder (fire spreading is row W22's content).
- **Narration.** The applied, tick and expired lines are the player's own: an NPC's or item's status adds no line and no new Book element. Its later surfaces are W6's description variants and W21's fear.
- **Opt-in.** An `immune` list, a step's `item`, a status trigger, NPC `attributes` or a check's `npc` needs `kernel_api` 1.46. Subject-following and the two events are not gated: they hold at any `kernel_api`, but no current cartridge applies a status to a non-player subject, and Chapter 1 declares no status. A player's tick and expiry now also emit their events, so an older status-sampler save with a tick may re-decide differently and open `save_corrupt` ([pre-production rule](save.md)); its rows still load.
- **Reuse.** [Row 2c](#status-modifiers-toolbox-row-2c)'s `modifies` reads a holder's active statuses at use through the same row lookup, so an NPC-side modifier needs no second writer.
- **Sampler.** `cartridges/npc_status_sampler`: at 07:00 a guard and a stone golem (`immune: [poison]`) walk into the dart corridor; the guard is poisoned (hp −1 every 60 s for 300 s) and reads 9 after one tick and 6 at expiry, the golem stays at 10. A torch dropped in the gatehouse sets the door `burning` (180 s, ticks every 60 s); the door keeps no pool, and when it burns out a `status_expired` reaction sets `charred`; the guard's first tick sets `groaned`. `cartridges/npc_attr_sampler`: player str 10 (the start) shoves at a broad guard (str 15) and a slight guard (str 5) with opposed str checks naming each: the first fails, the second passes; `kernel/ts/test/derived.test.ts` gives the derived sampler's dummy str 20, so its attack (1) hits for 1 + floor((20 − 10) / 2) = 6.
- **Composition record.** Consumer: reactions, opposed checks and NPC attacks now; rows 2c, 18, 42, W6, W21, W22 and 41 later. Reads: status rows, NPC pools, the NPC and item definitions' `immune` and NPC `attributes`. Writes: `status.transition` on the new holders, NPC `resource.adjust`, the death sequence's ops. Events: `status_ticked`, `status_expired`. Jobs and save rows: none new (the existing unbound status job and `statuses` row). Reused: row 1's row, job, saturation and composer; reaction subjects and filters; the death sequence and its drop roll; attributes@1 starts and row 2's formula (`derived`, given a value reader). New: two event kinds, two triggers, the `item` step field, `immune`, NPC `attributes`, the check's `npc` and the `npcValue` reader; no foundation change.
- **Attributes.** (Beads `loka-kgd.42`.) An NPC definition may declare `attributes`, its base [attributes@1](#attributes1-kerneltssrcmechanicspolicyts60) values; the instance carries them as definition data (a spawned NPC copies its template's), and one reader, `npcValue` (`kernel/ts/src/mechanics/attributes/shared.ts`), returns the declared value, else the attribute's start, saturated, at each use. Nothing is stored and no writer changes them ([trap 11](../MECHANICS-TOOLBOX.md#traps); no NPC training, [trap 2](../MECHANICS-TOOLBOX.md#traps)). Two consumers read it:
  - an opposed check that names an `npc` ([row G5](#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5)) passes when the actor's value is at least that NPC's value of the same attribute. _Completion:_ the value is read wherever the NPC is, alive or dead, as a detail's rating is read; a recipe gates the check on the NPC being here and alive with [row W6](#entity-description-variants-toolbox-row-w6)'s `npc_present {npc}`;
  - [row 2](#stats-derived-from-attributes-toolbox-row-2)'s `hit_chance` and `damage` tables apply to the attack of an NPC that declares `attributes`, with its values as `value`. _Completion:_ `hp_max` and `carry_grams` stay the player's; an NPC without `attributes` keeps its authored attack.

## Potions and songs (toolbox rows 18 and 42)

[Toolbox rows 18 and 42](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#status-declarations) govern them; the brief and its decisions are in Beads `loka-kgd.36` (2026-10-10). Both are [row 2c](#status-modifiers-toolbox-row-2c) statuses without `per_tick`, applied by a reaction; per the PM ruling in Beads `loka-kgd.50` they modify attributes the derived hp maximum does not read.

- **Potion (row 18, content only).** A potion is a liquid kind in a vessel; Drink emits `drank {kind}`, whose subject is the drinker, so a reaction on that kind applies the status ([reaction@1](#reaction1-kerneltssrcmechanicsreactionts)). Eat emits no reaction event, so an edible potion is not built. _Stacking:_ a second dose while active refreshes `ends_at` to now + duration and never stacks (one row per holder and status, [row 1](#status-effects-over-time-toolbox-row-1)); different statuses sum (row 2c).
- **Song (row 42).** A song is an action recipe whose policy needs the instrument (`has_item`); its `action_completed {action}` reaction applies the status to the performer. No event a player's action emits has a co-present NPC as its subject, and a song's recipe steps cannot apply a status (only a spell's can, [row 29b](#spell-effects-toolbox-row-29b)), so the one engine addition is a `status.apply` step's `npc`: like `item`, it names an authored NPC, whose instance takes the status (a dead one takes nothing, `immune` holds). Presence stays content: each listener has its own rule on the same trigger with `when: npc_present {npc}` ([row W6](#entity-description-variants-toolbox-row-w6)), so an absent listener takes nothing and the performer's rule never depends on a listener. _Known limits:_ listeners are authored one rule each, never "everyone present"; a spawned copy of a template never takes it (both kernels refuse a template).
- **Opt-in.** A step's `npc` needs `kernel_api` 1.46; a cartridge without it keeps its bytes, hash and behavior; Chapter 1 declares no status.
- **Book.** No new element: the condition line names the player's status and the Character page shows the attribute with the modifier (row 2c); a listener's status adds no line (row G3).
- **Sampler.** `cartridges/buffs_sampler` (str and dex start at 10): drinking a dose from the vial applies `might` (str +3 for 3600 s), so str reads 13; a second dose at +1800 still reads 13 and moves the end to +5400, when str reads 10. "Play a song" at the hearth is refused without the lute; with it, `inspired` (dex +2 for 1800 s) reaches the player and the listener in the hall (dex 12), not the traveller in the yard (dex 10), until +1800.
- **Composition record.** Consumer: the attributes@1 readers (row 2c). Reads: liquid rows, held items, NPC presence, status rows. Writes: `status.transition` and the status job (row 1), the vessel's liquid change. Events: `drank`, `action_completed` (existing; the sampler's `song` custom event only fills the outcome's required step). Jobs and save rows: none new. Reused: row 1's row, refresh and expiry, row 2c's `modifies`, row G3's holders and `immune`, reaction@1 triggers and `when`, `has_item`, `npc_present`, liquid@1 Drink, action_recipe@1. New: the `status.apply` step's `npc` field and its checks.

## Quest deadlines (toolbox row W24, engine half)

[Toolbox row W24](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#quest-deadlines); the PM briefs are in Beads `loka-kgd.45` (engine) and `loka-kgd.46` (Journal countdown, sampler, mobile proof).

- **Two shapes.** S2's legacy deadline (`at`, `fact`, `trust_fact`, `trust_amount`, scheduled by a bound dialogue acceptance, expiry assigning the fact and adjusting trust, no event) is unchanged, so Chapter 1 keeps its bytes. A generic deadline is `{after or at, outcome}`.
- **Scheduling.** Every activation of a quest with a generic deadline (accept_quest, a dialogue accept, a reaction) adds one `job.schedule` in the activation's writer group (`begun` in `mechanics/quest/lifecycle.ts`, called by the proposal in place of `stamp`): due at the sequence cause's logical time plus `after`, or at `at`; never from `started_at`. Never-fault rule: the due time is at least the proposal's horizon + 1 (its `time.advance` target, else the clock), so a deadline already past at activation, or one falling inside the advance that activated it, expires on the next advance instead of faulting the proposal (`nonfuture_job`).
- **Expiry.** The job (`mechanics/quest/job.ts`) fails the open instance (`active` or `objectives_complete`) with the outcome and emits `quest_failed {quest, instance_id, outcome}` (quest@1); penalties are reactions on `quest_failed` (filters `quest`, `outcome`). An instance already closed or retired (resolved earlier, a repeatable re-run) only completes the job. A `quest.fail` reaction and a legacy expiry emit no `quest_failed`.
- **Journal.** While the instance is open (`active` or `objectives_complete`) and its pending job exists, `QuestView.remaining` is the job's due time minus the clock, at least 0, in logical units (`view/quest_journal.ts` `remaining`); nothing more is stored. A legacy deadline shows none, so Chapter 1 views keep their bytes; a closed instance shows none although its stale job stays pending until due.
- **Book.** The Journal entry adds one note line "Time left: <duration>" after the hint, through the Conditions duration format (`mobile/app/book/model.ts` `timeLeft`). (Wording proposed; designer to approve, including whether logical units read as seconds under `real_elapsed`.)
- **Bound items.** Giving away an item bound to an open instance of any quest with a deadline, legacy or generic, is refused as in S2 (`mechanics/containment/shared.ts` `giveRefused`); a generic deadline binds items only through a bound dialogue acceptance.
- **Sampler.** `cartridges/quest_sampler`: find_key fails `late` 40 real minutes (120000 logical units) after acceptance; the Journal counts down. On time: take the key, then Leave word by the hook (`recipes/leave_word.json`, `fact.assign word_left`), and `reactions/word_left.json` resolves the quest on that `fact_changed`; the stale job then only completes. Late: `reactions/late.json` on `quest_failed {quest, outcome: late}` assigns `keeper_trust` 0 (default 2).
- **Composition record.** Consumer: reactions and the Journal. Reads: the quest definition's deadline, the instance row. Writes: `job.schedule` (quest_instance_id, actor_id; both kernels' existing job composition), `quest.transition` to failed, `job.complete`. Events: `quest_failed`. Reused: the legacy deadline job row shape, the job queue and its ordering, reaction@1 triggers, the 1.46 floor, the Conditions duration format. New: `QuestDefinition.deadline.after`, the generic shape check, the `quest_failed` event and trigger, `QuestView.remaining`.

## Quest stage hints (toolbox row W23)

[Toolbox row W23](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#quest-stage-hints) and [recovery](save.md) govern it; the PM brief is in Beads `loka-kgd.38`.

- **Stage start.** A quest whose journal declares `hints` gets `started_at` on its instance row: the proposal (`kernel/ts/src/runtime/proposal.ts` via `stamp` in `mechanics/quest/lifecycle.ts`) puts the logical time of the sequence's cause on each `quest.activate` and `quest.transition` of that quest, and composition stores it, replaced by each transition and removed by one without it. Other quests' ops carry no field, so their deltas and saves keep their bytes. Replay-safe: the time is the command's or due job's logical time, never the wall clock.
- **Real minutes.** `after` is real minutes since the stage began; with the `real_elapsed` time policy one real minute is `60 x rate` logical units (rate 50: 3000). The [dev clock](../web-preview.md) advances the elapsed input, so it moves hints as real time would. Hints without `real_elapsed` are refused at load.
- **Journal.** While the instance is open, the Journal shows the last hint of the shown stage (`active`, or `objectives_met` when that text shows) whose time has passed; none once the quest closes or when the row has no `started_at` (a save from before API 1.46). Known limit: a current_state objective met without a transition counts its `objectives_met` hints from activation.
- **Book.** The entry adds one note line "Hint: <text>" under the journal text. (Wording proposed; designer to approve.)
- **Action tip.** A recipe may declare `tip` (a text key). Its first accepted perform by an actor (success, failure or performed) assigns the engine-owned player fact `seen_tip_<key>` true after the outcome's steps (its `fact_changed` before `action_completed`) and adds the tip as a second narration line after the outcome's; later performs neither assign nor show it (`kernel/ts/src/mechanics/action_recipe/rule.ts` `tip`). The compiler adds the fact; only that recipe writes it (authored facts and writes of it are `RESERVED_FACT` at load). In the Book the tip is an ordinary story line.
- **Sampler.** `cartridges/quest_sampler`: accepting the lost-key quest shows no hint at nine real minutes, "look" at ten, "take" at twenty; taking the key starts `objectives_met`, whose hint shows ten minutes later. Searching the hall floor shows the search tip once.
- **Composition record.** Consumer: the quest journal view. Reads: the instance row's `started_at`, the clock and the time policy rate. Writes: optional `started_at` on `quest.activate` and `quest.transition` (both kernels' composition). Events, jobs: none. Reused: the time policy rate, the `KERNEL_API_RANGE_INVALID` floor (1.46) and `INVALID_TIME_POLICY`. New: `QuestJournal.hints`, `QuestView.hint`, the delta field and the save field. The tip: consumer, the recipe's narration; reads and writes the compiler-added fact through `fact.assign` (fact@1, reserved like `skill_<key>`), whose `fact_changed` precedes `action_completed`; new: `ActionRecipe.tip`.

## Entity description variants (toolbox row W6)

[Toolbox row W6](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#entity-variant-declarations) govern it; the PM brief is in Beads `loka-kgd.37` (2026-10-10).

- **Variants.** An NPC may declare `short_variants`, `room_line_variants` and `description_variants`, an item `short_variants` and `description_variants` (its `room_line_variants` are older); each is a `TextVariants` list (`protocol/entity.schema.json`) of `DescriptionVariant`, read like a room's: the first whose `when` holds replaces the base text, which stays mandatory. One reader, `describeEntity` (`kernel/ts/src/mechanics/description_variant/rule.ts`), calls `describe` with the entity as the policy target, so in an entity's own variant `subject: "target"` and `target_present` read the thing described.
- **Where shown.** The GameView entity `name` (short) and `description` (room contents, inventory, nested contents); the text player's room lines and examine. Every other reader of `short` (combat opponent names, shop lines, Knowledge, escort leader, water, recovery narration, the text player's take, drop and give narration, scan, disambiguation and NPC locations) still shows the base text (known limit). An item's older `room_line_variants` now also read the item as the target; no cartridge's room-line variant reads a target.
- **`status_active {subject: "target", status}`** (owned by status@1): holds when the target has an active row of the status (any [row G3](#statuses-on-npcs-and-things-toolbox-row-g3) holder); false without a target or for a detail, so it serves an entity's own variants and the policy of an action that targets an entity, and never holds in a room or detail variant, a reaction or a recipe (whose target is a detail). Only `subject: "target"` exists: no acceptance needs the actor's own statuses or a named holder.
- **`npc_present {npc}`** (owned by target_resolution@1, beside `target_present`): holds when the named NPC's instance is in the actor's current room and living (hp above 0 when it has hp); no light, perception or reach test, unlike `target_present`. It names a definition because a recipe's target is a detail, so `subject: "target"` could not name the NPC. It is presence, not posture: the player's posture is position@1's `position` fact, read by `fact_compare`. _Why not owned by position@1:_ requiring position@1 adds the posture fact and the sit and stand verbs. _Known limit:_ a spawned copy of a template is not its definition's instance, so it reads false.
- **Presence gate (row G3 carry, Beads `loka-kgd.42`).** A recipe whose opposed check names an `npc` adds `npc_present {npc}` to its policy, so the check is shown unavailable and refused while that NPC is elsewhere or dead.
- **Opt-in.** The new lists and both leaves need `kernel_api` 1.46; an item's `room_line_variants` do not. A cartridge without them keeps its bytes, hash and GameView; Chapter 1 declares none.
- **Book.** Nothing new: a variant replaces a name or text where it already shows, in words ([trap 12](../MECHANICS-TOOLBOX.md#traps)). Authored variants only ([trap 4](../MECHANICS-TOOLBOX.md#traps)).
- **Sampler.** `cartridges/variants_sampler`: from 05:00 a guard (hp 10, str 5) keeps the taproom's cellar door; his short reads "a sleeping guard" before 06:00 (`time_window`). At 07:00 Maud walks into the raided yard, whose `entity_entered_room` reaction applies `bruised` to her and `notched` to the sword in the taproom; at 08:00 she is back: "Maud, bruised, wipes the counter." (room line and description), and the sword reads "a notched sword". "Shove past the guard" (an opposed str check naming the guard, policy `npc_present {npc: guard}`) is offered at 05:00 and 08:00, and unavailable at 07:00 (the guard is in the bunkroom) and once his hp is 0. Both statuses expire after ten game hours: a lasting notch waits for row W8's permanent statuses ([trap 11](../MECHANICS-TOOLBOX.md#traps)).
- **Composition record.** Consumer: the GameView and the text player (entity texts), every policy site (two leaves), action recipes (the G3 carry). Reads: status rows, containers, NPC hp. Writes, events, jobs and save rows: none. Reused: `describe` and the policy evaluator with its step budget, G3 status rows, `living`, `LeafRefs` and short-reference expansion, `KERNEL_API_RANGE_INVALID`. New: `TextVariants`, five entity fields, two leaves and `describeEntity`; no foundation change.

## Status modifiers (toolbox row 2c)

[Toolbox row 2c](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#status-declarations) govern it; the brief and its decisions are in Beads `loka-kgd.34` (2026-10-10).

- **Modifiers.** A status may declare `modifies`, a list of 1 to 16 `{attribute, modifier}` (row 3's `ItemAffect` shape). While the status is active on a holder, [attributes@1](#attributes1-kerneltssrcmechanicspolicyts60) reads each named attribute with the sum of `modifier` over the holder's active statuses naming it added: the player's through `value` (after its selection, levelling points and worn affects), an NPC's through `npcValue` (after its declared value, else the start), both in `kernel/ts/src/mechanics/attributes/shared.ts`. The sum and then the value saturate to the ResourceInt range, as in row 3.
- **Read at use.** Nothing is stored: no attribute writer or save row; the modifier lives on the existing status row ([trap 11](../MECHANICS-TOOLBOX.md#traps)). Expiry, cure and death inactivate that row ([row 1](#status-effects-over-time-toolbox-row-1)), so the next read drops the modifier. Every reader sees it: `stat_compare`, recipe `attribute_threshold`, skill qualification, an opposed check naming an NPC and [row 2](#stats-derived-from-attributes-toolbox-row-2)'s derived stats, including the player's hp maximum: as wear and remove do, the first application, expiry and cure on the player's body of a status that modifies an `hp_max` term attribute write a zero hp adjust first (`settleFor` in `mechanics/status/shared.ts`; a status naming no such attribute writes none), so credit banked under the old maximum settles there ([resource@1](#resource1-kerneltssrcmechanicsresourcets)); death needs none, since the same-body return rewrites hp. _Known limit:_ compose reads hp maxima from the proposal's base, so an hp write later in the same advance than a status change that lowers the maximum (a con buff expiring before a combat round) faults `precondition_failed`, and death's restore stays capped by the maximum before it clears statuses (Beads `loka-kgd.50`; until then no content declares a modifier on an hp-maximum attribute). It also reaches the attack of an NPC that declares `attributes`. An NPC without declared `attributes` keeps its authored attack.
- **Stacking.** Different active statuses on one holder sum. One status never counts twice: a holder has one row per status, and an application while active refreshes `ends_at` only (row 1).
- **Targets.** Attributes only; a derived stat moves through its table. A direct stat modifier (`hit_chance`, `damage`, `carry_grams`, `hp_max`) is not built (open item, Beads `loka-kgd.34`).
- **Tick.** A modifying status may omit `per_tick` (PM ruling, Beads `loka-kgd.34`); both kernels refuse a status that has neither. Without it the status never ticks: its first application sets `next_tick_at` to `ends_at`, so its one job is the expiry; it emits no `status_ticked` and adds no tick line, and the Book's condition line drops its tick part. A refresh moves `ends_at` past the pending job, which then reschedules at the new `ends_at` (`mechanics/status/job.ts`). `tick_every`, `resource` and `narration.tick` stay required.
- **Opt-in.** `modifies` needs `kernel_api` 1.46. A cartridge without it keeps its bytes, hash and behavior; Chapter 1 declares no status.
- **Book.** No new element: the condition line names the status, and the Character page's attribute value includes the modifier while its "(+N worn)" note counts items only (designer question, Beads `loka-kgd.34`).
- **Sampler.** `cartridges/derived_sampler`: entering the shrine applies `might` (str +3 for 3600 s), so the strong character (str 15) hits the dummy for 4 + floor((18 − 10) / 2) = 8 instead of 6 until the hour ends. `cartridges/npc_status_sampler`: the guard declares str 12; poison leaves 12, and each poison tick applies `fury` (str +3 for 600 s), so it reads 15 from the first tick to 600 s after the last (+840 s), then 12.
- **Composition record.** Consumer: the attributes@1 readers above; rows 18 and 42 later. Reads: the holder's active status rows (`activeStatuses`) and each status's `modifies`. Writes: the zero hp settle adjust on the player's body (reused from resource@1); events, jobs and save rows: none new. Reused: row 1's row and generations, row 3's affect shape and saturation, row G3's holders and `npcValue`, the 1.46 floor. New: `StatusDefinition.modifies` and the `modifiers` reader.

## Hunger, thirst and dry days (toolbox rows G13 and W25 dry)

[Toolbox row G13](../MECHANICS-TOOLBOX.md#ranked-toolbox) and row W25's `dry` condition; [declarations](cartridge.md#need-declarations) govern them; the PM briefs are in Beads `loka-kgd.36` and `loka-kgd.44` (2026-10-10).

- **Drains.** Content on [row 1](#status-effects-over-time-toolbox-row-1): a need is a cartridge pool and a status with a negative `per_tick` on it. A tick saturates at the pool's authored minimum, and only an hp tick runs death, so a need pool at its floor never kills (W25's content floor).
- **Cures.** Bread is an edible item whose `cures` lists the hunger status (row 1). A liquid may declare `cures` too: a Drink of it ends each listed active status in the same commit, as Eat does (`kernel/ts/src/mechanics/liquid/shared.ts`). A service serving (`serving`, Maud's ale) cures nothing (known limit). Neither restores the need pool: food restores only `mv` (D4) and a Drink restores nothing (B7); restoring a need pool is not in these rows.
- **Dry.** Row W25's shape without clothing: a reaction on `entity_entered_room` into the exposed room and one on `clock_hour`, both with `when` all(`sky {weather: drought}`, `has_tag {tag: "exposed", subject: "room"}`), apply the dry status to the thirst pool; each hour refreshes it silently and in shelter it expires by itself. A Drink ends it; on the exposed ground in a drought the next hour applies it again.
- **Opt-in.** A liquid's `cures` needs `kernel_api` at least 1.46. A cartridge without it keeps its bytes, hash and behavior; Chapter 1 declares none.
- **Book.** Nothing new: each drain is a status whose label is a line in words on the Character page, and the room's drought variant says why ([trap 12](../MECHANICS-TOOLBOX.md#traps)).
- **Sampler.** `cartridges/needs_sampler`: 3600 units an hour, 24 hours a day; weather `clear` and `drought`, weight 1 each; pools `hunger` and `thirst` (0 to 10, start 10, no regeneration, each with its own band words, so an empty pool never reads as hp's "dying"). Entering the long track east of the inn applies `hungry` and `thirsty` (each 1 point every 3600 for 86400); on a drought day the salt flats (`exposed`) north of the inn apply `parched` (1 thirst every 1800 for 5400). Bread (`mv` 5) cures `hungry`; the waterskin's water cures `thirsty` and `parched`. With world id `7e1f0c2a-5d3b-4c8e-9a6f-000000000004` day 1 is drought and day 2 clear: on day 1 a body on the flats is parched, at thirst 6 after 7200, and a drink in the inn ends it there; a whole drought day on the flats leaves thirst 0 and hp 10.
- **Composition record.** Consumer: the Drink rule (liquid@1) and reactions (status drains). Reads: the liquid's `cures`, active status rows. Writes: `status.transition` (inactive) in the Drink's commit, after row 2c's zero hp settle adjust when the status modifies an hp-maximum attribute (`expire` in `mechanics/status/shared.ts`, as Eat's cure); events, jobs and save rows: none new. Reused: row 1 statuses and food `cures`, row 31's `sky` leaf and `exposed` tag, G1's `has_tag`, W25's `clock_hour`, B7's Drink. New: `LiquidDefinition.cures` (`kernel_api` at least 1.46) in the compiler (`lib/loka/content/status.ex`) and the loader (`kernel/ts/src/content/cartridge_status.ts`).

## Sense cues: sound, smell and heat (toolbox row G6)

[Toolbox row G6](../MECHANICS-TOOLBOX.md#ranked-toolbox) (merges W4); [declarations](cartridge.md#cue-declarations) govern it; the brief and its decisions are in Beads `loka-kgd.61` (2026-10-10). Owner: the ruleless `sense_cue@1` (archived 21 §: projection only, range per cue, no authoritative state).

- **Declaration.** One shape, `Cue {sense, text, range, when?}` (`protocol/entity.schema.json`): `sense` is `sound`, `smell` or `heat`; `text` an authored line with the sense in its words ([trap 12](../MECHANICS-TOOLBOX.md#traps)); `range` the rooms it carries, 0 (its own room) to 2 ([trap 7](../MECHANICS-TOOLBOX.md#traps)); `when` an optional condition. A `cues` list (1 to 4) may sit on a room, a detail, an item or NPC definition, a fuel source (active only while lit), a status (active while active on a holder, from the holder's room) and a recipe outcome (transient, below). A source's room is its own, a detail's room, or the room an entity is in through its containers. Authored instances only: a created entity (a spawned NPC) carries none yet.
- **Reach.** One walk (`kernel/ts/src/mechanics/senses.ts` `reaching`) from the listener's room, breadth first to two exits, exits in direction-key order: each room gets its distance and the first exit towards it, so of two equal routes the first direction wins. Exits hidden from the reading actor ([row 11](#hidden-passages-and-search-toolbox-row-11)) carry nothing, so a cue never betrays a passage; closed and locked doors carry cues (a cue that a door muffles says so in its `when`, `barrier_state`). A cue reaches when its source room is within its `range` and its `when` holds for the reading actor. Every exit and every container hop is one query step (04 §5.4); an exhausted budget stops the walk, the view then refuses `budget_exceeded` and the leaf is false. A cartridge without `sense_cue@1` pays nothing: the reader returns at once.
- **Reader 1, the view.** GameView `cues` (`CueView {sense, text, direction?}`) lists the cues reaching the player's room, nearest first, then by direction and text; `direction` is absent for a cue from the player's own room; absent when none. Transient outcome cues never show.
- **Reader 2, NPC perception.** The leaf `cue_perceived {npc, sense}` holds when the NPC is alive and a cue of that sense reaches its room, read for the reading actor. In a reaction's `when` whose cause is a recipe outcome event (`check_failed`: the failure outcome; `check_passed` and `action_completed`: the success outcome) it counts only that outcome's transient cues, from the actor's room, so the guard hears the pick and not the forge next to it; an outcome without cues is heard by no one. Cues of a dead NPC are silent. _Why a leaf and transient outcome cues:_ a reaction already runs on the failed check, so the hook is one condition and no new event, state, job or save row; a stored "noise" would be authority state. An NPC perceives its own cues; a cue's own `when` never perceives (the leaf is false there, and the loader does not refuse it), so evaluation cannot recurse. Two sources with one text and direction show two lines.
- **D9's bell cue stays.** The Chapter 1 bell (`world.bell_cue`, [D9](#d9-village-consequences-and-prior-study-access-selected-contract)) is the earlier, event-bound instance: one accepted `fact_changed`, an explicit audible room list and retained history ([protocol](protocol.md)). It is not folded, so Chapter 1 bytes and GameView are unchanged; a bell written today is a transient outcome cue for NPCs plus a room cue with a fact `when` for the player. No global sound bus.
- **Opt-in.** A cue or a `cue_perceived` leaf needs `sense_cue@1` (UNDECLARED_CAPABILITY) and `kernel_api` at least 1.48 (KERNEL_API_RANGE_INVALID). Chapter 1 and the corpus declare none.
- **Book.** The World page shows each cue as a quiet line ([Book UI, Sense cues details](book-ui.md#sense-cues-details); proposed wording "{text} from the {direction}", pending designer approval, Beads `loka-kgd.65`).
- **Sampler.** `cartridges/senses_sampler`: storeroom, hall, forge east of the hall, barracks north of the hall, tower east of the barracks, guardroom south of the storeroom. In the hall the player reads hammering (sound, range 1) from the east and stew (smell, range 2, from the tower kitchen) from the north, not the forge heat (range 0); a lit torch adds its smoke from the hall itself; the storeroom hears nothing. Picking the storeroom lock fails (pick 0 against rating 5) and rattles (range 1): the guard in the guardroom next door is alerted, the sentry in the barracks two rooms away is not.
- **Composition record.** Consumer: the view and reaction conditions. Reads: definition cues, fuel rows, status rows, containers, exits and their `hidden_until` facts, the cause event of a reaction. Writes, events, jobs and save rows: none. Reused: the policy evaluator and its step budget, `fuelView`, status rows, `hidden`, reaction conditions, short-reference expansion and capability ownership. New: the `Cue` shape on six definitions, one leaf, one GameView field, and the reaction cause passed to its condition; no foundation change.

## Target choice in the same room (toolbox row 6a)

[Toolbox row 6a](../MECHANICS-TOOLBOX.md#ranked-toolbox); the PM brief is in Beads `loka-kgd.63` (2026-10-10). It amends the [C4 primary rule](#c4-hound-response-pack-assistance-and-flight-selected-contract) for opted-in cartridges only.

- **Choosing.** Attack's `target_id` already picks the foe that opens an encounter. With `world.combat.target_choice`, Attack also works inside an open roster (pack) encounter: a target that is another active member of the player's own encounter (not the current primary) becomes the primary. The command shape is unchanged. Every other Attack admission holds (body, life, standing, co-location, sanctuary, scene); the current primary, a non-member and any target without the opt-in are refused `invalid_state`, as before.
- **Effect.** One `encounter.target` delta ([protocol](protocol.md#c4-pack-encounter-and-flight-composition)) writes the new primary; no round, RNG draw, job or event. The next round's player opportunity strikes the new primary; the rotating opponent opportunity, the cursor, the round order and the job are unchanged, so a switch never moves or delays a round. Removal repair (dead or departed primary) is unchanged. The receipt carries the pack's `primary_changed` note naming the new primary.
- **Offer.** While the player fights a roster with two or more members still here (living and in the encounter room; the row itself is pruned only at round end), the encounter ActionSet keeps Attack beside Flee, Stand, Look, Scan and Bandage; the GameView lists one Attack per present attackable NPC, available on the other roster members and unavailable (`invalid_state`) on the current primary, by the same admission the rule uses. A single-foe fight, or a cartridge without the opt-in, keeps today's ActionSet. Wording of the choice is pending the designer (Beads `loka-x6t.14`).
- **General target model.** The choice is the encounter's `npc_id` (the player's target); the opponent who strikes is still the rotating cursor. Rows 6b (allies) and 6c (several foes on one pack plan) widen who may be in the roster and who strikes, not this field. _Known limit:_ the pending round job keeps the old primary's definition ref, which round dispatch checks against the primary (`kernel/ts/src/mechanics/combat/round.ts`); this holds while a roster shares one definition (one population bundle), so a row that admits mixed definitions must re-point the job on a switch. [Row 6b](#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b) keeps allies out of the roster, so no row admits mixed definitions yet.
- **Opt-in.** `target_choice` needs `kernel_api` 1.48. A cartridge without it keeps its bytes, hash, receipts and GameView; Chapter 1 declares none, so its fen hound pack keeps "primary stays until it leaves".
- **Traps.** None applies: no environment, NPC need, rumour, prose, variety draw, drain, memory, consequence, free text, ecology, status row or colour cue is involved; the note is text.
- **Sampler.** `cartridges/targets_sampler`: two goblins of one pack plan (6 HP, a sure hit for 1 since [row 6c](#several-foes-with-a-pack-plan-toolbox-row-6c)) in the den; the player's blow always hits for 2. Attacking the first goblin admits both; Attack on the second makes it primary, and the next round leaves the second at 4 HP and the first at 6 (without the switch: the first at 4, the second at 6).
- **Composition record.** Consumer: Attack (combat@1) and the GameView. Reads: the open encounter row, the roster, containment and the member's population slot. Writes: `encounter.target` (new, both kernels' composers and precondition guards); events, jobs and save rows: none new (the encounter row shape is unchanged). Reused: Attack admission (`attackRefused`), `engaged`, the pack roster and `primary_changed` narration, the round's primary-targeted player opportunity, `KERNEL_API_RANGE_INVALID`. New: `CombatSettings.target_choice`, the `retarget` predicate (`kernel/ts/src/mechanics/combat/shared.ts`) and the delta.

## Permanent statuses (toolbox row W8)

[Toolbox row W8](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#status-declarations), [composition](protocol.md#status-composition) and [recovery](save.md#status-recovery) govern it; the brief is Beads `loka-kgd.67` (2026-10-10). It is [row 1](#status-effects-over-time-toolbox-row-1)'s status with `duration: "permanent"`: a wound, scar or mark.

- **Row.** The first application on a holder ([row G3](#statuses-on-npcs-and-things-toolbox-row-g3)) writes `{active: true, generation}` with no `ends_at`, `next_tick_at` or `job_id` and schedules no job, so it never ticks or expires and emits no `status_ticked` or `status_expired`. An application while active writes nothing and says nothing (no refresh). `statusStep` (`mechanics/reaction.ts`) returns the applied line on a first application, with or without a job; the proposal does not yet deliver reaction lines (Beads `loka-omvi`).
- **Ends.** Only a cure ends it: an edible or liquid whose `cures` lists it (row 1, row G13). The player's same-body return keeps it, while every other status ends there (`clearStatuses` in `mechanics/status/shared.ts`). An NPC's death still ends all of that NPC's statuses (row G3). A cure after the return opens the next generation, as in row 1.
- **Modifiers.** It may carry [row 2c](#status-modifiers-toolbox-row-2c)'s `modifies`, but never on an attribute the derived hp maximum reads (Beads `loka-kgd.50`). Both kernels refuse such a modifier with SCHEMA_VIOLATION at that `modifies[i].attribute`, so the return's capped restore and settle question cannot arise. It declares no `per_tick` (SCHEMA_VIOLATION), and `tick_every < duration` is not checked; `tick_every`, `resource` and the three narration keys stay required, as in row 2c.
- **Gates.** It gates nothing by itself. Content may read it through [row W6](#entity-description-variants-toolbox-row-w6)'s `status_active {subject: "target"}`, which holds while the row is active.
- **Opt-in.** A permanent status needs `kernel_api` 1.48 (KERNEL_API_RANGE_INVALID). Chapter 1 declares no status, so its bytes are unchanged.
- **Book.** The Character page's condition line already shows the label ("Scarred"). The status line and combat page show the label alone, with no time or tick part (`conditionLine`). Final wording goes to the designer (Beads `loka-x6t.14`).
- **Sampler.** `cartridges/scars_sampler`: every hit applies `scar` (a reaction on `attack_result {hit: true}`). The player (hp 10, attack 100% for 1) attacks the wolf (hp 30, bites 100% for 4). After the first round the player is at hp 6 and scarred, and the wolf reads "a scarred wolf" (its `short_variants`). The third bite kills; the player returns to the hall at hp 10, still scarred. Eating the healer's salve (`cures: [scar]`) ends it.
- **Composition record.** Consumers: reactions (`status.apply`), cures, the death return, the GameView and W6 variants. Reads: status rows and each status's `duration`. Writes: `status.transition` (the permanent row shape is new in both composers: exact keys, never turning timed or back while active). Events, jobs and save rows: none new. Reused: row 1's row, generations, cure path and applier; row G3 holders; row 2c's `modifies`; W6's `status_active`; `KERNEL_API_RANGE_INVALID`. New: the `"permanent"` duration, the job-less `StatusRow` shape, an optional `ConditionView` end and tick, and the return's `returning` filter. Foundation change: the `StatusRow` delta and save shape and both `status.transition` composers (`foundation/compose_status.ts`, `lib/loka/core/compose_status.ex`), held to `protocol/fixtures/status_composition.json`.

## Several foes with a pack plan (toolbox row 6c)

[Toolbox row 6c](../MECHANICS-TOOLBOX.md#ranked-toolbox); the PM brief is in Beads `loka-kgd.66` (2026-10-10). It adds no combat rule and no field: several foes of one population plan already fight the player on the [C4 pack round](#c4-hound-response-pack-assistance-and-flight-selected-contract), which any population whose plan declares `pack` gets (the member role defaults to `hound` whatever the NPC is).

- **Who strikes.** Each round one selected member strikes the player, rotating through the roster in EntityId order; the player's blow goes to the primary. Every member therefore acts on the one pack plan, never one attack per foe per round, inside the eight-draw round budget.
- **One definition.** A roster is one plan's members (`admission` in `kernel/ts/src/mechanics/combat/behavior.ts` requires the same `by`), one plan has one bundle and one bundle one NPC definition, so the round job's definition ref never needs re-pointing on a [target switch](#target-choice-in-the-same-room-toolbox-row-6a); [row 6b](#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b) keeps allies outside the roster, so this still holds.
- **Offer after a loss.** A member that dies or leaves between rounds (a status tick, for example) stays in the row until the next round prunes it; with [target choice](#target-choice-in-the-same-room-toolbox-row-6a) on, the encounter ActionSet counts only the members still here, so Attack rows go when one member is left (without the opt-in, as in Chapter 1, the fight offers no Attack at all).
- **Proof.** `cartridges/targets_sampler` (row 6a's); its goblins now hit for 1, so both strike the player in turn (C4's rotation tests in `kernel/ts/test/c4_pack.test.ts` pin the order). A seeded differential (`test/loka/core/c4_pack_composition_test.exs`) composes random mixes of the C4 pack fixture's ops in both kernels; the older random pool and the simulator sample carry no encounter op.
- **Traps.** None applies: no environment, need, rumour, prose, variety draw, drain, memory, consequence, free text, ecology, status row or colour cue.
- **Composition record.** Consumer: the pack round and the encounter ActionSet. Reads: the open encounter row, roster presence (`eligible`). Writes, events, jobs, save rows and fields: none new. Reused: C4 admission, rotation and flight, row 6a's choice. New: the ActionSet counts present members.

## Dialogue skill checks (toolbox row 14)

[Toolbox row 14](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#dialogue-check-declarations) govern it; the PM brief is in Beads `loka-kgd.55`.

- **Check.** A dialogue choice may declare `check`, an [opposed check](#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5) as a recipe's: exactly one of `skill` or `attribute`, against exactly one of a fixed `rating` or an `npc` (an NPC instance declaring the attribute, [row G3](#statuses-on-npcs-and-things-toolbox-row-g3)). The choose that selects it reads the check after every admission check (a refused choose reads nothing) through the same comparison as a recipe's (`opposed` in `kernel/ts/src/mechanics/skills.ts`); it draws no RNG, so a replay decides it the same way. Its `check_passed` or `check_failed` takes position 1 with the named NPC, else the speaker, as subject; a skill with growth then gains one use, passed or failed, its `fact_changed` at position 2 (`checked` in `kernel/ts/src/mechanics/dialogue/sequence.ts`). dialogue@1 now composes check@1.
- **Pass.** The choice applies as an unchecked one does, its sequence after the check's positions, then `choice_resolved`; the conversation then ends, even in a hub (`hub` in `kernel/ts/src/mechanics/dialogue/behavior.ts`), for the save reason under Retry rule (a new talk may choose it again).
- **Failure.** The decision's outcome is `check_failed`: the actor reads the check's `failure` line, the conversation's row closes (`choice.close`), and nothing else of the choice applies: no sequence, no `choice_resolved`, so no story point or quest step hangs on a failed check.
- **Retry rule.** A checked choice, passed or failed, ends the conversation; a new talk offers every choice again. The check is deterministic, so a retry passes only once the actor's value has risen: a skill with growth rises by its uses, so practice persuades in the end while a fixed attribute keeps failing. _Why closing, not dropping the one choice from the reopened hub:_ a hub row always lists the dialogue's every choice (the save check in `mobile/authority/local-story/dialogue-save.ts` refuses any other row), and closing needs no new state. "Until a fact changes" would need change tracking; an author who wants a once-only attempt gates the dialogue's policy on a fact the choice's pass sets, or on one a reaction on `check_failed` for the check's key sets after a failure.
- **Plain choices only.** A checked choice carries only `label`, `narration`, `sequence`, `availability` and `check`, in a dialogue with no quest and no riddle, and its sequence grants no skill (else `OUTCOME_MISMATCH`): transfers, payments, quest steps, escorts and patrols fix their own event positions and receipts, and none may hang on a check that can fail. The failure branch is a line only; a failure sequence waits for a consumer.
- **No leaf.** Gating stays on facts; no policy leaf is added, so the [leaf-set rule](#property-tags-and-the-policy-leaf-set-toolbox-row-g1) does not apply.
- **Book.** No new element: the choice is listed and chosen as any other, and its narration or failure line tells the player the outcome. (Wording proposed; designer to approve.)
- **Sampler.** `cartridges/persuade_sampler`: the player (cha 6) and a guard (cha 5). "Talk the guard round" (cha against the guard) passes and opens the gate. "Lean on the guard" (intimidate, untaught, growth `[1, 2]`, rating 1) fails at level 0 and closes the talk; a new talk passes at level 1.
- **Composition record.** Consumer: dialogue choose. Reads: the skill acquisition and use facts, attributes@1 values (the actor's, the named NPC's) and the choice's definition. Writes: the use by `fact.assign`, `choice.close` on failure; events: the existing `check_passed`/`check_failed`, `fact_changed`; jobs and save rows: none new. Reused: the recipe's opposed comparison, skills@1 `practised`, the hub's `choice.close`, the `KERNEL_API_RANGE_INVALID` floor (1.47) and the check key's `DUPLICATE_DEFINITION`. New: `DialogueChoice.check` (`DialogueCheck`) and the `check_failed` outcome; no foundation change.

## Entity and pair facts (toolbox row W2)

[Toolbox row W2](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#entity-and-pair-fact-declarations) govern it; the PM brief is in Beads `loka-kgd.53` (2026-10-10). Rows 15, G11, W3, G7 and W15 build on it.

- **Shape.** A fact declaring `per_subject: true` has one value per subject, an NPC, item or detail: an **entity fact** (`scopes: ["instance"]`, one value per thing) or a **pair fact** (`scopes: ["player"]`, one value per thing and character). The row names them scopes; they are stored as the existing scope plus the subject's `subject_id`, the identity `ScopedFact` and the fact `MutationTarget` already carry, because 03 §6 closes `StateScope` at player, party, instance and realm (pinned by `test/loka/core/contracts_test.exs`, "FactSpec scopes are exactly the StateScope kinds"). A G7 grant is a pair fact on the thing and the grantee.
- **Subject.** `targetOf` (`kernel/ts/src/mechanics/fact.ts`) gives a fact's target; a `per_subject` fact read or set without a subject throws `KernelError` (the decision faults `evaluator_error`), never a shared row; the loader's site walk keeps such reads and writes out of content. Writers name the subject by context, as `status.apply` does: a dialogue's `fact.assign` and `fact.adjust` write at the speaker (the row's bound NPC role that is the dialogue's `npc`); a recipe's `fact.assign` at the recipe's target; a reaction's `fact.assign` at its named `npc`'s or `item`'s authored instance, else at the event's subject (the reaction@1 table) when that is an NPC, item or detail, and with no such subject the step writes nothing (an entrant player's body is never a subject). `fact_compare` reads one at exactly one of `npc`, `item` (that instance) or `subject: "target"` (the action's target; in a dialogue's policy the speaker); without a target it is false, like `status_active`, so `subject: "target"` is useful only where a policy has one (an action, a dialogue, an entity's own variant); the loader refuses it in a reaction's `when`, a quest, a barrier or a skill qualification (FACT_SCOPE_UNSUPPORTED). `fact_changed` carries the subject as `subject_id`, so a reaction on it sees the thing.
- **Rows.** Only changed facts have rows: the `facts` section, keyed by the canonical fact target text, now with `subject_id` for these facts ([save](save.md#entity-and-pair-fact-recovery)); a stranger NPC has no row and reads the default. Memory is bounded by declaration ([trap 7](../MECHANICS-TOOLBOX.md#traps)): one value per declared fact per subject that a writer reached.
- **Limits.** Save recovery checks a dialogue receipt's `fact.assign` and `fact_changed` at the speaker (`mobile/authority/local-story/dialogue-consequences.ts`), but reconciles some choices' facts by fact alone, with no subject: escort, receive and hand_over (`dialogue-save.ts`), a riddle answer with a `wrong_limit` (`topics-save.ts`) and every choice of a dialogue whose quest has a legacy deadline `fact` (`deadline-receipts.ts`); a `per_subject` fact is not written there (FACT_SCOPE_UNSUPPORTED); a reaction's `fact.adjust` came with [row 15](#standing-and-disposition-toolbox-rows-15-and-g11); a reaction's `when` still has no target.
- **Book.** Nothing new: these facts show only through authored dialogue, variants and later prices and dispositions ([trap 8](../MECHANICS-TOOLBOX.md#traps)).
- **Sampler.** `cartridges/scoped_facts_sampler`: the smith, the miller and a stranger in a square; each dialogue's `greet` adds 1 to the pair fact `times_met` and `help` 1 to `trust` (-3 to 3). Greet the smith twice and help her once, greet the miller once: the smith reads met 2, trust 1; the miller met 1, trust 0; the stranger met 0, trust 0, with no row. Giving the smith the apple sets the entity fact `fed` on her (the `item_acquired` holder), not on the miller.
- **Composition record.** Consumer: dialogue, reactions, recipes and every policy site; rows 15, G11, W3, G7 next. Reads: fact rows. Writes: `fact.assign` with its optional `subject_id` (no new delta op), `fact_changed` with `subject_id`. Jobs: none. Save rows: the existing `facts` section, with a subject in the key. Reused: `ScopedFact` and fact `MutationTarget` identity, `fact.adjust`'s bounded lowering, the reaction subject table, short-reference expansion and `LeafRefs`, `KERNEL_API_RANGE_INVALID`, FACT_SCOPE_UNSUPPORTED. New: `FactSpec.per_subject`, `fact_compare`'s `subject`/`npc`/`item`, a reaction `fact.assign`'s `npc`/`item`, `targetOf`, the loader's site walk and the save check `facts-save.ts`; no foundation change.

## Conditional schedules (toolbox row W10)

[Toolbox row W10](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#conditional-schedule-declarations) govern it; the PM brief is in Beads `loka-kgd.56` (2026-10-10).

- **Cases.** An NPC's artifact may declare `schedule_cases` (`protocol/entity.schema.json` `ScheduleCases`): for an hour its `daily_schedule` lists, 1 to 8 cases `{when, room, goal?}`. When that hour's job runs, the NPC goes to the room of the first case whose `when` holds, else to the hour's `daily_schedule` room (the fallback); the move, the `entity_entered_room` and the next job are as for a plain hour. One reader, `placeOf` (`kernel/ts/src/mechanics/schedule/behavior.ts`), the `describe` first-match pattern.
- **Policy context.** A `run_job` has no actor, so a case reads with the player (`world.character`) as the actor, as the other job rules do (population sight, bleed), and the NPC as the target, as an NPC's own text variants do ([row W6](#entity-description-variants-toolbox-row-w6)): a player fact reads the player's value, an instance fact the world's, `subject: "target"` leaves read the NPC. The clock is the job's due time, as for status ticks and reactions, so a long wait or elapsed settlement crossing the hour reads the hour itself; the facts are the proposal's at that job, in `(due_time, job_id)` order, so replay gives the same room. _Known limit:_ the host's job drain gives each `run_job` its own step counter (`runtime/proposal.ts` calls `schedule.decide` without the command's), so case leaves are not charged to the command's `query_steps`, as for population sight and combat rounds; at most 8 cases per hour bound the work. _Known limit:_ actor-relative leaves read the player's room and light, not the NPC's ([the list](cartridge.md#conditional-schedule-declarations)).
- **When it is read.** Only when a listed hour's job runs: a fact that changes mid-hour moves the NPC at the next listed hour, not at once (list more hours for finer timing). A reaction moving an NPC at once (Beads `loka-kgd.22`) is not this row.
- **Goal.** A case's optional `goal` is a text key, returned as the job's narration only when the case moves the NPC and the player's body is in the room it leaves (as population sight narration); nothing is stored. The fallback has no goal.
- **Exits.** A schedule move is a jump to the room, as before: it crosses no exit, so hidden, climb and barrier faces are never taken and nothing is routed through one. NPCs walking through exits and doors are row W26 (the shared NPC exit check, Beads `loka-kgd.32`).
- **Opt-in.** `schedule_cases` needs `kernel_api` 1.47. A cartridge without it keeps its bytes, hash and behavior; Chapter 1 declares none.
- **Book.** Nothing new: the goal is one narration line in words ([trap 12](../MECHANICS-TOOLBOX.md#traps)), shown where job narration already shows; proposed for designer approval. Authored lines only ([trap 4](../MECHANICS-TOOLBOX.md#traps)); no needs simulation behind it ([trap 2](../MECHANICS-TOOLBOX.md#traps)).
- **Sampler.** `cartridges/schedule_sampler`: 07:00 in Maud's cottage. Her 08:00 hour is `[{when: child_lost, room: green, goal}, garden]`, 12:00 the cottage. Walking north into the woods sets the instance fact `child_lost` (a reaction on `entity_entered_room`). Waiting in the cottage to 08:00 shows "Maud hurries to the Green." and she is on the Green; with the child safe she goes to the garden with no line; waiting in the woods she still goes to the Green, with no line.
- **Composition record.** Consumer: schedule@1's `run_job`. Reads: the policy evaluator over committed state at the job's due time, containers. Writes, events and jobs: as a plain hour (`entity.transfer`, `entity_entered_room`, `job.complete`, `job.schedule`); save rows: none new. Reused: `holds` with its step budget, `describe`'s first-match pattern, `entered`, narration on `job_ran`, `KERNEL_API_RANGE_INVALID`. New: `ScheduleCases`, the NPC field `schedule_cases`, `placeOf`; no foundation change.

## Standing and disposition (toolbox rows 15 and G11)

[Toolbox rows 15 and G11](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#standing-and-disposition-declarations) govern them; the PM brief is in Beads `loka-kgd.54` (2026-10-10).

- **Standing and trust (row 15).** Both are content on [W2](#entity-and-pair-facts-toolbox-row-w2): a faction's standing is a bounded int instance fact, an NPC's trust a bounded int pair fact. A tier is a `fact_compare`, or an `any` of them over a range (the leaf compares equality only, so bounds stay small). Tiers show as lines, prices and dispositions, never quest or barrier gates ([trap 8](../MECHANICS-TOOLBOX.md#traps)). No leaf is added, so the [leaf-set rule](#property-tags-and-the-policy-leaf-set-toolbox-row-g1) does not apply.
- **Reaction `fact.adjust`.** A reaction step `fact.adjust {fact, amount}` adds `amount` to a bounded int fact, clamped to its bounds as a dialogue's (`bounded` in `kernel/ts/src/mechanics/fact.ts`, which both share). It lowers to the reaction's `fact.assign` at the same subject (`assignment` in `kernel/ts/src/mechanics/reaction.ts`): the named `npc` or `item`, else the event's subject when that is an NPC, item or detail. A change emits `fact_changed` as an assign does; a clamped no-change writes the same value and emits nothing.
- **Gifts.** A gift is content: a reaction on `item_acquired` for the authored item, whose subject is the holder, adjusts the holder's trust. Taking the item yourself writes nothing (the player's body is never a subject), and an item with no reaction (a stone) changes nothing. One authored item changes hands to an NPC once; an author who lets it come back guards the reaction's `when` with a pair fact read at a named `npc`.
- **Disposition (G11).** An NPC may declare `disposition {hostile?, friendly?, engage?}`. It is read when used, never stored (no third store): hostile while `hostile` holds, else friendly while `friendly` holds, else wary (also for an NPC without it, which keeps today's behavior). Both conditions read with the player as the actor and the NPC as the target, so `subject: "target"` reads the NPC's pair fact with the player, and an instance fact the faction's standing (`disposition` in `kernel/ts/src/mechanics/disposition.ts`). _Why a declaration and not leaves only:_ a dialogue policy can already gate a greeting on the facts, but no leaf can refuse a trade, change a price or start a fight; one declared reader keeps the three consumers agreeing.
- **Readers.** Talk: a hostile NPC opens no dialogue (`spokenBy`, so the listing and admission agree; `talkRefused`). Trade: a hostile shopkeeper refuses buy and sell with `invalid_state` (`exchange`; the shelf shows the reason); a `buy_discount` with `friendly: true` applies only while the NPC is friendly (`buyPrice`, shared by the shelf and the buy check). Combat: an ordinary move into a room with a living, unengaged NPC that has an `attack` and an `engage` line and is hostile opens an encounter as Attack does (first round at now + the interval, no draw), the first such NPC in EntityId order, and the receipt says `engage` ([trap 12](../MECHANICS-TOOLBOX.md#traps)); never in a sanctuary. [C4](#c4-hound-response-pack-assistance-and-flight-selected-contract)'s "entry never initiates hostility" is about hounds and still holds: only a declared hostile disposition engages.
- **Limits.** A disposition that turns hostile while the player stands in the room, an NPC that walks in, or a flight into its room engages no one (only an ordinary move does, and a [Sleep](#sleep-toolbox-row-w9) in its room). The entry check reads the conditions before the move's own writes (the body's arrival, an expedition's faction change on its last edge), so a room- or presence-relative leaf there reads the room the player left. A transport arrival engages no one. A conversation already open when its speaker turns hostile runs on; the next talk is refused. Save recovery replays receipts, so a disposition is re-derived; dialogue `fact.adjust` is still not re-checked by recovery ([W2 limits](#entity-and-pair-facts-toolbox-row-w2)), and the sampler uses none of the choice kinds whose facts recovery reconciles without a subject.
- **Opt-in.** Any of the three fields needs `kernel_api` 1.47. A cartridge without them keeps its bytes, hash and behavior; Chapter 1 declares none.
- **Book.** Nothing new: the greeting is an authored dialogue, the discount a price on Peg's page, a refusal the page's existing reason, and the engage line one narration line on the move. (Wording proposed; designer to approve.)
- **Sampler.** `cartridges/standing_sampler`: the square holds Maud, Peg (bread 4, half price when friendly), an apple and a stone; the gate east holds the guard. Village standing runs -2 to 2, trust 0 to 2. Maud's `help` adds 1 to standing and `wrong` takes 2. Peg is friendly at standing 1 or 2 and hostile at -2; the guard is hostile at -2 while his trust is 0. Maud's warm greeting opens at standing 1 or 2 or her trust 1 or 2. Giving Maud the apple raises her trust to 1 and opens her greeting; the stone does nothing. After `help`, bread costs 2. After `wrong`, Peg refuses to trade or talk and walking east the guard engages; had the player given the guard the apple first, he does not.
- **Composition record.** Consumer: dialogue talk, commerce buy/sell and shelf, movement. Reads: fact rows through the policy evaluator, the NPC definition. Writes: the reaction's `fact.assign` (no new op); on entry `encounter.open` and `job.schedule` as Attack's; events: `fact_changed` (existing); jobs: the encounter's round job; save rows: none new. Reused: W2 pair and instance facts and subjects, `holds`, the dialogue adjust clamp (now `bounded`), the reaction subject table, Attack's encounter ops, `buy_discount` and its save checks, `KERNEL_API_RANGE_INVALID`. New: the reaction step `fact.adjust`, `NpcDefinition.disposition`, `buy_discount.friendly`, `disposition` and `engage`; no foundation change.

## Rumour by co-presence (toolbox row W3)

[Toolbox row W3](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#rumour-declarations) govern it; the PM brief is in Beads `loka-kgd.57` (2026-10-10).

- **Pattern.** News is an [entity fact](#entity-and-pair-facts-toolbox-row-w2) and passes by a reaction on `entity_entered_room`, never by a global write. A reaction's `when` reads for the player and has no target, so it cannot read the entrant's fact by context: the author names every NPC. The trigger names the room and the carrier (`on: {room, npc}`); `when` reads the carrier's fact (`fact_compare {fact, npc: carrier}`); `apply` writes the listener's (`fact.assign {fact, npc: listener, value}`). To learn on arrival instead, name the listener in the trigger and the knower in `when`, and leave `fact.assign` unnamed: it writes at the entrant (the reaction@1 subject), and a player entrant writes nothing. An NPC learns at a place the same way: an unnamed `fact.assign` on entering it.
- **Entrant filter.** `npc` on `entity_entered_room` holds when the entrant is that NPC's authored instance, as `item` does for an item (`FILTERS` in `kernel/ts/src/mechanics/reaction.ts`). Without it the rule fires on anyone entering the room, the player included, while the carrier is elsewhere, so the news would not need co-presence (`kernel/ts/test/rumour.test.ts`, "the player entering the inn while Ada is away carries nothing", fails without the filter).
- **Schedule moves.** A schedule hour's jump emits `entity_entered_room` ([row W10](#conditional-schedules-toolbox-row-w10)), and the job's reactions run at its due time with the player anywhere, so news moves while the player is away.
- **Limits.** The listener must be in the room: no leaf reads an arbitrary NPC's room (`npc_present` reads the player's), so the author keeps the listener there (no schedule) or names the carrier in the listener's own room. News never decays here: an author who wants it to fade adds a reaction that clears the fact (for example on `clock_hour` with a `time_window`); none is built. One `wait` across several listed hours runs each hour in order (loka-qi0r), so the news still passes, also when the same reaction fires twice in that wait (loka-j2mo).
- **Opt-in.** The `npc` filter needs `kernel_api` 1.47. A cartridge without it keeps its bytes, hash and behavior; Chapter 1 uses none.
- **Book.** Nothing new: the news shows only through authored dialogue and variants ([trap 8](../MECHANICS-TOOLBOX.md#traps)).
- **Sampler.** `cartridges/rumour_sampler`: 15:00 in the square; the inn is west, the mill east. Ada's schedule is the mill at 16:00, the inn at 17:00, the square at 18:00; the innkeeper stays in the inn. Entering the mill sets `knows_mill` on Ada; her entering the inn sets it on the innkeeper. Talking to the innkeeper at 15:00 is refused; at 16:30 Ada knows and the innkeeper does not; at 18:30 the innkeeper knows and his `innkeeper_mill` dialogue (policy `fact_compare {subject: "target"}`) opens. The player walking into the inn at 16:30 tells him nothing.
- **Composition record.** Consumer: reaction@1 on `entity_entered_room`, including schedule@1's job moves. Reads: the trigger's `entity_id`, fact rows. Writes: `fact.assign` at the named NPC (no new delta op), `fact_changed`. Jobs and save rows: none new. Reused: row W2's entity facts, `fact_compare {npc}` and named `fact.assign`, row W10's schedule events, the W1 filter table, `KERNEL_API_RANGE_INVALID`, UNRESOLVED_REFERENCE. New: the `npc` trigger filter on `entity_entered_room`; no foundation change.

## Lore codex and deduction (toolbox row 46)

[Toolbox row 46](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#lore-deduction-declarations) govern it; the PM brief is in Beads `loka-kgd.58`.

- **Lore.** GameView `topics` (topics@1, known topics in key order) is the codex. A readable item whose `topic` is declared grants it when read ([readable@1](#readable1-mechanicsreadablerulets)), so a read book is listed by its topic; no read-state row exists, and a readable without a topic leaves no trace.
- **Badges.** A badge is a topic whose fact a reaction assigns: one `entity_entered_room` reaction per counted room, each `when` all the rooms' `visited_count` at least 1 and the badge unknown. The visit counts (knowledge@1) are the counters; no counter fact and no save row is added. The reaction's `when` reads the proposal after the entry, so the fifth room grants it.
- **Deduction.** GameView `deductions` (new in `kernel_api` **1.47**) lists, in recipe key order, each recipe whose policy is an `all` with at least two `fact_compare` items requiring a topic's fact true, and whose success sequence assigns another topic's fact true, while the actor knows those topics and not that one (`mechanics/topics/shared.ts` `lore`). Each entry is `{action, label, from}`: the recipe's key and label and the known topics' labels. The recipe stays an ordinary action_recipe@1: it is performed at its detail, and its policy's `not` of the granted topic makes it once only. Absent when none, so a cartridge without such a recipe (Chapter 1) projects exactly as before.
- **No leaf.** No policy leaf, no command and no cartridge field are added; the [leaf-set rule](#property-tags-and-the-policy-leaf-set-toolbox-row-g1) does not apply.
- **Book.** The Journal page lists the known topics under Lore, then each deduction's topics and its card, unavailable with the action's reason where the place lists it unavailable and "Not here" elsewhere ([Book UI](book-ui.md#lore-details)). (Wording proposed; designer to approve, Beads `loka-x6t.14`.)
- **Sampler.** `cartridges/codex_sampler`: a hall and four rooms. Entering the fifth room grants the "Wanderer" badge; reading the carter's note and the mill ledger lists "The missing cart" and "The mill", and the study desk's "Think it through" then grants "The smugglers" once; "Follow the cart tracks" at the desk grants "The mill" from the note alone and, gated on one topic, is never listed as a deduction.
- **Composition record.** Consumer: GameView projection (`view/view.ts`). Reads: the topics' facts, the recipes' policies and success sequences. Writes: nothing (view only); the badge and the deduction write through the existing reaction@1 and action_recipe@1 `fact.assign`, events the existing `fact_changed`. Opt-in: a cartridge's own topics, reactions and recipes; Chapter 1 and the corpus are unchanged.

## Away recap (toolbox row W27)

[Toolbox row W27](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#away-recap-declarations) govern it; the PM brief is in Beads `loka-kgd.59` (owner 2026-10-10: a page block, not a Journal entry).

- **Threshold.** A cartridge may author `time_policy.recap_after_minutes`, a positive integer of real minutes. GameView then carries `recap_after`, that threshold in logical seconds (minutes × 60 × `rate`; `kernel/ts/src/view/time.ts`), so the Book compares logical times and never reads the rate. No engine default: absent, there is no recap.
- **No state.** Nothing is computed, stored or saved by the engine: the recap is the Book's grouping of the narration the elapsed receipts already carry ([away recap](book-ui.md#away-recap)). No save, receipt or command change; the settlement itself is unchanged ([elapsed session driver](architecture.md#elapsed-session-driver)).
- **What it groups today.** Every World-log line of the settlement: status applied, tick and expiry lines (row 1, on the player), reaction step lines (Beads `loka-kgd.13`: a first application voiced, refreshes silent), schedule goal lines (row W10), deadline outcomes and other job narration, and the arrivals and departures seen in the player's room. Lines routed to a detail, a conversation or the combat log keep their routes and are not grouped.
- **Opt-in.** `recap_after_minutes` needs `kernel_api` 1.47. A cartridge without it keeps its bytes, hash and behavior; Chapter 1 authors none, so it shows no recap after any absence.
- **Sampler.** `cartridges/recap_sampler` (threshold 30 minutes, rate 50): the dart room poisons for 720 s with a tick every 60 s (eleven ticks, then expiry) and chills for 120 s (one tick, sharing the first poison tick's receipt, and expiry with the second); Maud keeps the hall from 06:00 and her garden from 18:00; a pebble lies in the hall (a press with its own World line). Poisoned, back in the hall, three real hours away (150 game hours) opens the hall page with one collapsed block: the tick line with its count 11, the chill's tick and expiry lines, the poison's expiry line, "Maud leaves." with 6 and "Maud arrives." with 6; two real minutes away shows no block and the log as without the field (one entry per receipt, so the first two join their chill line).
- **Composition record.** Consumer: the Book presenter's background updates (`mobile/app/book/presenter.ts` `background`, `mobile/app/book/recap.ts`). Reads: GameView `recap_after` and `time`, each update's latest receipt narration (`lastNarration`), the elapsed status. Writes, events, jobs and save rows: none. Reused: `TimePolicy`, the elapsed driver's state updates, `narrationLines`' rendering, `comings`, `KERNEL_API_RANGE_INVALID`. New: the manifest field `time_policy.recap_after_minutes`, the GameView field `recap_after`, the Book's away recap block; no foundation change.

## Social verbs: say, whisper and shout (toolbox row G9, engine half)

[Toolbox row G9](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#speech-declarations) govern it; the PM brief is in Beads `loka-kgd.71` (2026-10-10). Emotes are deferred to the Realm.

- **Commands.** `speech@1` owns three engine verbs, each with one input `word` (`Word`: 1 to 32 ASCII letters, the riddle answer's bound): `say {word}` and `shout {word}` (no target), `whisper {target_id, word}` (an NPC in the room). The rule case-folds the word and refuses `invalid_state` for anything else (a space, a digit, a non-ASCII letter, 33 letters), even when a host skips the schema, and also without a body. While the actor's conversation is open the GameView does not offer the verbs, so Step refuses them `unsupported_capability` at admission (`engine` in `kernel/ts/src/commands/actions.ts`; Leave it first: a say that left it, as talk does, would close a riddle row no saved receipt allows). A whisper to an NPC not alive in the actor's room is `not_present`, to anything else `not_found`.
- **Free text** ([trap 9](../MECHANICS-TOOLBOX.md#traps)). The word is matched only against authored keywords and never reaches narration. An event carries it only when it equals one: a dialogue's `keyword` or a `spoken` reaction's `word`; otherwise the event has no `word`. _Known limit:_ one word, no sentences.
- **Who hears.** Each hearer gets one `spoken {entity_id, loudness, word?}` event, in EntityId order: a whisper only its addressee; a say each living NPC in the actor's room; a shout each living NPC in the rooms within one exit, through [G6's walk](#sense-cues-sound-smell-and-heat-toolbox-row-g6) (`around` in `kernel/ts/src/mechanics/senses.ts`, depth 1): exits hidden from the actor carry nothing, closed doors carry it, every exit is one query step. _Why one event per hearer:_ a reaction then filters the hearer with `npc` (as W3 filters the entrant), and an unnamed `fact.assign` or `status.apply` lands on the hearer (the reaction@1 subject), so a whisper can never be overheard by a reaction and no `when` has to test range.
- **The answer.** A dialogue may declare `keyword`. A say or whisper of it opens that dialogue as talk would (`choice.open` and `choice_opened` at position 1, then the `spoken` events): of the dialogues keyed by the word, in key order, the first whose speaker hears it (for a whisper, the addressee) and answers (its policy holds and it is not hostile, row G11; `answer` in `kernel/ts/src/mechanics/speech/shared.ts`). Its `prompt` is the answer, and its choices, [checks](#dialogue-skill-checks-toolbox-row-14) and [entity facts](#entity-and-pair-facts-toolbox-row-w2) apply as in any conversation. Talk never offers or opens a keyword dialogue, so the word is the only way in. A shout opens nothing. Accepted outcome: `choice_opened` when a dialogue opens, else `spoken`; no narration line.
- **Reactions.** A `spoken` trigger may filter `npc` (the hearer), `word` and `loudness` (`FILTERS` in `kernel/ts/src/mechanics/reaction.ts`). The guard in the next room who hears a shout of "help" is `{event: "spoken", npc: "guard", word: "help", loudness: "shout"}`.
- **Limits.** A `spoken` reaction without an `npc` filter fires once per hearer; when two hearers' firings write one shared fact (an instance or player fact), the writes compose in order and the step commits, as [any reaction writes](#reaction1-kerneltssrcmechanicsreactionts) (`kernel/ts/test/speech.test.ts`). Speech is neither offered nor accepted while the actor's conversation is open.
- **Opt-in.** The verbs are offered only to a cartridge locking `speech@1`; a keyword or a `spoken` reaction needs `speech@1` and `kernel_api` 1.48. Chapter 1 and the corpus lock none, so their ActionSets, bytes and GameView are unchanged.
- **Book.** Not built: the Book has no text input (the only `TextInput` is the dev time panel). The Book half is Beads `loka-kgd.72`, with the proposed text for the designer.
- **Sampler.** `cartridges/speech_sampler`: mill, lane, square and watchhouse in a row west to east; the elder and the smith in the square, the watchman in the watchhouse, the miller in the mill. Saying "WARD" opens the elder's `elder_ward` ("The ward fails at the new moon"), heard by both; whispering "ward" to the smith opens nothing and the elder hears nothing; a shout of "help" alerts the watchman next door, not the miller two rooms away; a shout of "hello" alerts no one (`kernel/ts/test/speech.test.ts`).
- **Composition record.** Consumer: the speech rule (`kernel/ts/src/mechanics/speech/rule.ts`) and reaction@1. Reads: containers, NPC life, exits and their hidden facts, dialogue definitions and policies, reaction triggers. Writes: dialogue@1's `choice.open` (speech composes dialogue); events: the new `spoken`, dialogue's `choice_opened`; jobs and save rows: none new. Reused: talk's opening (`opening` in `mechanics/dialogue/behavior.ts`) and selection (`spokenBy`), G6's walk, the W3 `npc` filter and the reaction subject table, the riddle answer's bound, `KERNEL_API_RANGE_INVALID`. New: `speech@1` with commands `say`, `whisper`, `shout` and event `spoken`, the input `word`, `DialogueDefinition.keyword`, the `spoken` trigger with filters `word` and `loudness`; no foundation change.

## NPC-vs-NPC damage, allies and kill credit (toolbox row 6b)

[Toolbox row 6b](../MECHANICS-TOOLBOX.md#ranked-toolbox); the PM brief is in Beads `loka-kgd.68` (2026-10-10). It amends the [combat round](#combat1--first-live-encounter-m6-a) and the [C4 pack round](#c4-hound-response-pack-assistance-and-flight-selected-contract) for opted-in cartridges only.

- **Who is an ally.** An authored NPC listed in `world.combat.allies` ([cartridge](cartridge.md)). The relation is static: no save row, no delta op and no encounter field records it; the round derives it from the list and presence. Allies stay out of the roster (`active_ids`), so they are never the primary, never [target choice](#target-choice-in-the-same-room-toolbox-row-6a) and never re-point the round job.
- **Never a target.** Attack on an ally is refused `invalid_target`, and the GameView offers no Attack on it, in or out of a fight.
- **Reactions.** An ally's blow emits `attack_result` with the ally as `attacker_id`; a reaction meant only for one NPC's blows names it with the [`attacker` filter](#attacker-filter-loka-kgd79); no filter names the player's own blows, so a rule on `attack_result` without one fires on the player's, the guard's and the foe's alike.
- **The ally's turn.** Each round (ordinary or pack), after the player's and the opponent's turns, the first listed ally living in the encounter room strikes the player's target (the primary, or the first roster member still here when the primary is gone), with its own `attack` profile and NPC attribute bonuses. One ally per round keeps the round inside its eight-draw budget (player 2, opponent 4 with dodge and block, ally 2); a round whose rejected draws leave the ally fewer than two skips its turn. Limit: an ally that starts with exactly two draws left can still exhaust the budget when its hit draw is rejected (about 2e-8 per draw); the round then faults `rng_budget_exhausted` atomically, and identically on replay. The ally still strikes when the player's blow has just killed the opponent whose turn came next. The target's dodge, block and the sleep multiplier apply only to blows on the player. The receipt narrates `ally_hit` or `ally_miss`.
- **Party credit.** An NPC's death in the player's encounter, by the player's blow or an ally's, is credited to the player: `entity_died` carries `killer_id` (the body or the ally) and `credited_character_id` (the encounter's character), so `world.death_credit` facts and `levelling.kills` experience follow (`kernel/ts/src/mechanics/combat/credit.ts` accepts a listed ally as the killer). The victim is the encounter's primary (`npc_id`) or any member of the round's starting pack roster, and the round's own encounter write in the fatal blow's writer group proves the occurrence: the `encounter.close` when the fight ends, the `encounter.advance` when a pack fights on (Beads `loka-lpq6`). So every pack member the player or the ally kills pays, and a round in which each kills one goblin credits both in one levelling write. A pack still closes on a kill only when its roster row (pruned at round end) holds one member (`lastOpponent` in `kernel/ts/src/mechanics/combat/shared.ts`, which a fatal status tick and a spell's `damage` also read).
- **Writer groups.** A round's status writer group (`statusGroup`, `kernel/ts/src/mechanics/status/job.ts`) now holds every roster member, not just the primary, as the player's or the ally's blow lands on another member when the primary is gone; a status tick on that member due in the same advance then composes in sequence. A round whose body, members and bleed pair already hold different groups merges them into the lowest (loka-x2gv).
- **Known limits.** Foes strike only the player: an ally takes no combat damage, so it never dies in a round (a status can still kill it; a fallen ally stays in the room and no longer strikes). A second listed ally waits. Listed allies follow no one; the [group primitive](#group-primitive-toolbox-row-g8) (row G8) adds dynamic members who follow and count as allies beside this list, and hirelings (row 22) build on it.
- **Opt-in.** `allies` needs `kernel_api` 1.48. A cartridge without it keeps its bytes, hash, receipts and GameView; Chapter 1 declares none.
- **Traps.** None applies: no environment, NPC need, rumour, prose, variety draw, drain, memory, consequence, free text, ecology, status row or colour cue is involved; ally narration is text.
- **Sampler.** `cartridges/targets_sampler`'s yard, south of the hall: a guard ally (a sure hit for 1) and a goblin raider (3 HP, a sure hit for 1). Attacking the raider, in the first round the player's blow leaves it at 1 HP and the guard's kills it; `raider_slain` (a `death_credit` fact) becomes true for the player.
- **Composition record.** Consumer: the combat and pack rounds, Attack admission, the GameView and death credit. Reads: `world.combat.allies`, the ally's presence and HP, the encounter row. Writes: the target's `resource.adjust` and the existing death sequence; events, jobs, delta ops and save rows: none new. Reused: `attack`, the round order, `deathSequence`, `deathCredit`, `statusGroup`, `attackRefused`. New: `CombatSettings.allies` and its narration keys, the `ally`/`allyOf` predicates (`kernel/ts/src/mechanics/combat/shared.ts`).

## Held tools

One rule says when the actor holds a tool, for [G4 use tools](#use-x-on-y-toolbox-row-g4) and [harvest tool gates](#tool-gated-harvest-toolbox-row-19) alike (PM decision, Beads `loka-kgd.84`, 2026-10-10): the item is carried directly in the body, worn or wielded (itself in one of the body's equipment@1 slot holders), or in an open container, at any depth of open containers, that the body carries. An item on the floor, in a closed or locked container, inside a worn container, or held by someone else is not held. The worn-container exclusion keeps step and the GameView in agreement: a worn entry lists no contents, so a tool there could never be offered (PM decision, Beads `loka-kgd.84`, 2026-10-10). `toolHeld` (`kernel/ts/src/mechanics/lookups.ts`) is the one walk; it faults as `reach` does (`containment_cycle`, `budget_exceeded`, one query step per link). It is wider than `reach`'s held mode, which Read keeps (a worn item does not count there).

## Use X on Y (toolbox row G4)

[Toolbox row G4](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#use-declarations) govern it; the PM brief is in Beads `loka-kgd.76` (2026-10-10). Engine half; the Book input is Beads `loka-kgd.77`.

- **A recipe variant, not a new verb.** A use recipe is an [action recipe](#action_recipe1-mechanicsaction_reciperulets49) whose target is `{kind: "use", tool}` instead of a detail, performed with the existing `perform {action, target_id, item_id}`: `item_id` is the tool, `target_id` the thing it is used on. One authored rule covers every pair with the right properties: the tool must have the `UseTool`'s `tag` (row G1) and hold some of its `liquid` (liquid@1, quantity above 0); the target is whatever the recipe's `policy` admits with that item as its target, through `has_tag` and `status_active` (`subject: "target"`). No item or target id appears in the recipe. _Why not a new command:_ admission (policy, cooldown, costs), the check, the outcome sequence, narration and `action_completed` are the recipe's already; a `use_on` verb would duplicate them.
- **Admission.** One read-only refusal (`useRefused`, `kernel/ts/src/mechanics/action_recipe/shared.ts`) is shared by the rule, step's admission (`refusal` in `kernel/ts/src/commands/actions.ts`) and the GameView: `invalid_target` unless both ids name distinct items; `not_present` unless the tool is [held](#held-tools) (`toolHeld`, `kernel/ts/src/mechanics/lookups.ts`) and the target on the room's floor or directly in the body: the offer's target scopes `room_contents` and `inventory`, which `useRefused` enforces since a perform's admission never runs `accepts`, so an item in an open crate is refused; `invalid_target` when the tool lacks the tag or liquid; a reach fault on the tool (`budget_exceeded`, `containment_cycle`) is returned as that code, which step's admission runs first and returns as a plain rejection (the rule's fault branch is not reached through step). Then the policy with the target (`invalid_state`), then cooldown and costs as for any recipe. A detail recipe refuses an `item_id` (`invalid_target`).
- **Effects.** The outcome sequence runs on the target as subject: `fact.assign` of an entity fact ([row W2](#entity-and-pair-facts-toolbox-row-w2)) lands on it, `event.emit` and `action_completed` name it. The new step `status.cure {status}`, allowed only on a use recipe (a detail holds no status), ends that status when active on the target, as a cure does (`cureOps`, `kernel/ts/src/mechanics/status/shared.ts`; no event, row G3); a repeated cure of one status in a sequence ends it once. Cold reopen re-decides it like any cure ([status recovery](save.md#status-recovery)). _Known limits:_ the use consumes no liquid (deferred to Beads `loka-kgd.78`); an opposed check must name an `npc`, as there is no detail rating; targets are items only: a barrier has no EntityId (row G3), so it cannot be a use target, and row W22 burns items and breaks barriers by reaction (PM decision in Beads `loka-kgd.76`); a scene cannot start on a use recipe.
- **Offer.** The GameView lists each use recipe on the held tool's inventory or worn entry, once per item it is admitted on (`useActions`, `kernel/ts/src/view/use.ts`), by the same refusal and policy step runs: `target_ids: [target, tool]`, which fill `perform`'s `target_id` then `item_id` ([invocation](protocol.md)), and the target spec `{kind: "entity", scopes: ["room_contents", "inventory"]}` describes `target_id`. A pair the refusal or policy rules out is not listed; one blocked by cooldown or costs is listed unavailable with that code, the code step returns. Only recipes the held tool fits walk the world's items; the walk counts one query step per entity, as Put's pairs do, and exhaustion replaces the recipe's offers with one unavailable `budget_exceeded` entry. _Known limit:_ in a large Realm the shared `query_steps` budget runs out and the use offers, and the offers listed after them, degrade; the result is deterministic, as a complete walk costs the same steps in any order and an exhausted one collapses to that single entry, so one state gives one set of pairs. `gameview_agrees_with_admission` finds a use perform's entry by that pair on the tool (`kernel/ts/src/view/invariants_view.ts`).
- **Opt-in.** A use target (and so a `status.cure` step) needs `kernel_api` 1.49. Cartridges without them keep their bytes, hash and GameView.
- **Book.** Not built: the Book has no way yet to pick a tool and then a target. Proposed text for the designer (Beads `loka-kgd.77`): on a held item's card, each offered pair reads "<label> the <target short>" (e.g. "Quench the cart"). (Wording proposed; designer to approve.)
- **Traps.** None applies: no free text, no new state, no ecology; a cure ends a status row like Eat's.
- **Sampler.** `cartridges/use_sampler`: in the yard a bucket (`liquid_holding`, 4 water), an oilcan (`liquid_holding`, 2 oil), a wooden `burnable` cart, an iron `metal` winch and a torch; dropping the torch sets the cart `burning` (a reaction). `quench` (tool `liquid_holding` with water; policy `status_active burning` on the target) puts the cart out; `oil` (tool with oil; policy `has_tag metal` on the target) sets the winch's entity fact `oiled`. The oilcan on the cart, the bucket on the winch, a dropped bucket and the bucket on itself are refused (`kernel/ts/test/use.test.ts`). Row W22's "poured water cures a burning thing" is the `quench` recipe as content.
- **Composition record.** Consumer: action_recipe@1 and the GameView; row W22 next. Reads: containment, slot holders and reach, item tags, liquid rows, status rows, the recipe policy with the target. Writes: the recipe's existing ops and `status.transition` (inactive) through `cureOps`; events: the recipe's existing ones; jobs and save rows: none new. Reused: recipe admission, check, sequence and narration; G1 `has_tag` and W6 `status_active` on the target; W2 entity facts; the [held-tool](#held-tools) walk `toolHeld` (row 19a; `reach` before it); `cureOps`; `putPairs`' bounded pair walk shape; `KERNEL_API_RANGE_INVALID`. New: `RecipeTarget` kind `use` and `UseTool`, the `status.cure` step, `perform.item_id`, `useRefused`, `fits` and `useActions`, listed on inventory and (row 19a) worn entries; the Elixir step reference fields moved to `Loka.Content.LeafRefs.steps/0`; no foundation change.

## Tool-gated harvest (toolbox row 19)

[Toolbox row 19](../MECHANICS-TOOLBOX.md#ranked-toolbox) (C3-M01); [declarations](cartridge.md#harvest-tool-declarations) govern it; the PM brief is in Beads `loka-kgd.84` (2026-10-10). It amends [B5 Harvest](#s9-infirmary-herbs-b5-selected-contract) for opted-in details only.

- **Gate.** A harvest detail may declare `tool: {tag}`. Harvest of it, ordinary or careful, is refused `invalid_state` unless the actor [holds](#held-tools) an item whose definition declares that [G1 tag](#property-tags-and-the-policy-leaf-set-toolbox-row-g1) (`toolHeld`, as G4's tool); the same item on the floor does not count. The check runs after presence and before the careful skill and the stock selection, inside `harvest` (`kernel/ts/src/mechanics/containment/harvest.ts`), which the rule and the GameView's Harvest offer both call, so a refused seam is listed unavailable with the code step returns. _Known limit:_ the GameView shares one `query_steps` budget across its offers, so in a large Realm the offer can show `budget_exceeded` while step, with a fresh budget, accepts (as G4's offers do). Carried items are found by a walk over every entity in EntityId order, one query step per entity, stopping at the first held match, so one state always costs the same steps; a reach fault (`budget_exceeded`, `containment_cycle`) faults the command, as Harvest's other queries do. The tool is not consumed or moved.
- **Why not content.** No step of an action recipe or reaction transfers an item, so a G4 use recipe cannot yield ore; a Harvest action's policy is shared by every harvest detail it is offered on (`noticeOffer`, `kernel/ts/src/view/action_lists.ts`), and no leaf reads a carried item's tags (`has_tag`'s target is false on a detail; `wearing` reads slot holders only).
- **Depletion.** Unchanged B5: the stock is the detail's authored items still directly in its room; each Harvest moves one (careful: `count`) to the body, and an empty seam refuses `not_found`.
- **Regrowth.** [Replenish](#replenish-toolbox-row-19b) moves conserved stock back into a seam on a schedule; nothing mints an item.
- **Opt-in.** `tool` needs `kernel_api` 1.52. Cartridges without it keep their bytes, hash and GameView.
- **Book.** No new element: the Harvest card shows the seam's existing offer, unavailable without the tool. Proposed text for the designer: the unavailable reason reads "You need a <tag> tool." (Wording proposed; designer to approve.)
- **Traps.** None applies: no new state, no free text, no ecology.
- **Sampler.** `cartridges/harvest_sampler`: in the mine an ore seam holds two lumps of ore and declares `tool: {tag: sharp}`; a pickaxe (`metal`, `sharp`, wieldable), a stick (`wooden`) and an open sack lie on the floor. With empty hands or the stick held the seam refuses and keeps its ore; with the pickaxe held it yields one lump per Harvest, then refuses `not_found` (`kernel/ts/test/harvest_tool.test.ts`); the wielded pickaxe and one in a carried open sack mine too, and the same two whittle the stick through the G4 recipe `whittle` (tool `{tag: sharp}`); in the worn (`waist`) sack the pickaxe is not held: both are refused, and `gameview_agrees_with_admission` holds. With the `mining` skill learned, careful harvest (`mine_carefully`, two lumps) is refused without the pickaxe, with the code its offer shows, and accepted with it. `sharp` is an existing tag, so a knife would mine too; a dedicated mining tag is one `Tag` enum entry when content needs it.
- **Composition record.** Consumer: B5 Harvest and its GameView offer. Reads: item definitions' tags, slot holders, containment and reach. Writes, events, jobs and save rows: none new (B5's transfers and `item_acquired`). Reused: B5 Harvest and stock selection, G1 tags and their tags@1 ownership, G4's `fits` and the [held-tool](#held-tools) walk `toolHeld` (shared with G4, whose tool check moved from `reach` to it), `KERNEL_API_RANGE_INVALID`. New: `harvest.tool`, its 1.52 floor and its tags@1 ownership in both kernels; no foundation change.

## Fear and morale for NPCs (toolbox row W21)

[Toolbox row W21](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#status-declarations) govern it; the PM brief is in Beads `loka-kgd.74` (2026-10-10). It amends the [C4 flight rule](#c4-hound-response-pack-assistance-and-flight-selected-contract) for opted-in cartridges only.

- **Fear.** A status declaring `fear: true` is a fear status; it is a [row G3](#statuses-on-npcs-and-things-toolbox-row-g3) status in every other way (holders, `immune`, duration, refresh, expiry, death clearing). It may omit `per_tick`, so it need not tick.
- **Reader.** Immediately before its selected opponent opportunity, a pack member holding an active fear status attempts C4 flight as a member below `flight_below_percent` does, whatever its hp (`afraid` in `kernel/ts/src/mechanics/combat/behavior.ts`, called by `maybeFlight` in `round_flow.ts`): the same legal exits, area, order, budgets and writes, no RNG. With no legal exit it attacks, as C4 says. The reader reads the round's prefix state, so a fear status applied or ended earlier in the same advance counts. Only the selected member acts each round, so two feared goblins leave on their own turns, over two rounds; then the pack withdraws.
- **Known limits.** Fear only moves a pack member in a fight: an authored NPC, a member outside its area, a member out of combat and the player's body hold it with no effect. While it lasts, a frightened member flees on each of its turns in any fight, back toward the room it came from too, so a chased pack keeps running until the status ends. _Surrender is deferred_ (Beads `loka-kgd.80`): no outcome exists for an NPC that yields (an encounter that closes without death, its credit and its narration).
- **Appliers.** Any `status.apply` that reaches the member. A shout is content: a `spoken` reaction's status lands on each hearer ([row G9](#social-verbs-say-whisper-and-shout-toolbox-row-g9-engine-half)), spawned pack members included, within the shout's one-exit range. A leader's death uses the one engine addition, a `status.apply` step's `co_present: true`: the status lands on every living NPC in the event's room (its `room_id`, else the room directly holding the event's subject; a carried or unplaced subject gives no room and no holder), in EntityId order, never on the player's body; the dead victim is no longer living. With `tag` ([row W22](#fire-toolbox-row-w22)) it lands instead on every item so tagged lying directly in that room. So `{on: {event: entity_died, victim: chief}, apply: [{op: status.apply, status: afraid, co_present: true}]}` frightens the pack around the fallen chief. Each holder is handled as a single step's holder: once per rule, `immune` holds, and its writes join the writer group its status rows already hold in the advance (`statusStep` in `kernel/ts/src/mechanics/reaction.ts`), so the chief falling in the wait that ends the pack's fear commits as two waits would. An ally opts out by declaring the status in its `immune` list; nothing else exempts an NPC.
- **Opt-in.** `fear` and `co_present` each need `kernel_api` 1.50. Chapter 1 declares no status, so its bytes, hash and receipts are unchanged.
- **Book.** No new element: the pack's `enemy_fled` line narrates the flight in words ([trap 12](../MECHANICS-TOOLBOX.md#traps)); an NPC's status adds no line (row G3).
- **Traps.** Trap 3 holds: a shout frightens only the NPCs it reaches. Trap 11 holds: the fear row has a duration. Trap 12 holds as above.
- **Sampler.** `cartridges/fear_sampler`: hall, den and burrow in a row west to east; two goblins of one pack plan (6 HP, a sure hit for 1, area den and burrow) in the den; the player (10 HP) always hits for 2. Shouting "begone" in the den frightens both (`afraid`, 600 s); attacking the first, round 1 leaves it at 4 HP and it flees east, round 2 the second flees east before the player's turn, and the encounter closes with the player at 10 HP. Without the shout both stay and strike: the player at 8 HP, the first goblin at 2. The den also holds the goblin chief (2 HP, so the player's first blow fells it) and a guard immune to `afraid`; reaction `leader_fell` frightens the den when the chief dies, after which the same fight on the first goblin plays as the shout's, while the guard and the player take nothing (`kernel/ts/test/fear.test.ts`).
- **Composition record.** Consumer: the C4 pack round. Reads: the member's status rows and the status declarations (`activeStatuses`). Writes, events, jobs and save rows: none new (C4 flight's `entity.transfer` and `population.slot`). Reused: C4 flight and its exit walk, row G3 holders, `immune`, the status row and the per-holder writer-group join, row G9's `spoken` subject and its `npcsIn`, `entity_died`'s `victim` filter, `KERNEL_API_RANGE_INVALID`. New: `StatusDefinition.fear`, the `afraid` predicate, the `status.apply` step's `co_present` and its checks (never with `item` or `npc`: SCHEMA_VIOLATION at that field), and the 1.50 floor; no foundation change.

## Status readers (toolbox rows SR1, SR2 and SR3)

[Toolbox rows SR1 to SR3](../MECHANICS-TOOLBOX.md#ranked-toolbox) (Beads `loka-kgd.86` to `.88`, "Status reader 1/2/3"); [declarations](cartridge.md#status-declarations) govern them; the gaps are section O of the [status effects survey](https://github.com/lorecrafting/lokacore/blob/95e160a490a02010096438f3d234ada4c9b4cc23/docs/reviews/2026-10-10-status-effects-survey.md). Three small [row G3](#statuses-on-npcs-and-things-toolbox-row-g3) pieces that make status pairs content: a status is a node, a reaction on its landing with a condition on another status is an edge, and a reaction cure is an overcoming edge. No pair table, intensity counter or damage formula: amplification is a second, stronger status.

- **Reader 1: whose status.** `status_active` takes `subject: "target" | "self" | "subject"` (`statusActive` in `kernel/ts/src/mechanics/policy.ts`). `target` is unchanged (the action's target, an entity's own variant). `self` is the actor's body, in any policy: a spell, recipe, dialogue choice or reaction can gate on the actor's own status. `subject`, in a reaction's `when`, is the event's subject from the [reaction@1 table](#reaction1-kerneltssrcmechanicsreactionts), the holder a plain `status.apply` lands on (`sequence` passes it as `ctx.subject`); anywhere else it reads false. The reaction's `target` stays unset, so `has_tag`, `fact_compare` and `target_present` with a target keep their meaning in a `when`.
- **Reader 2: `status_applied {body_id, status}`.** A reaction's `status.apply` that starts a status (over no row or an inactive one) emits it once per holder, in step order, while a reaction listens for it (opt-in below); a refresh while active, an immune holder or a refused holder emits nothing, a permanent status's first application does. Owned by status@1; reaction@1 composes it (`COMPOSES` in `kernel/ts/src/runtime/decision.ts`). Its subject is `body_id`, with the optional `status` filter. A status is applied by a reaction step or, since [row 29b](#spell-effects-toolbox-row-29b), a spell's `status.apply`; Eat, Drink and the G4 use recipe only cure. The emission sits in `statusStep` (`kernel/ts/src/mechanics/status/shared.ts`), not in `applyStatus`, and both appliers go through it.
- **Reader 3: `status.cure` in a reaction.** `{op: "status.cure", status}` ends that status when active on the event's subject, as a cure does (settling a derived hp maximum first, row 2c; no event, no line). It names no holder. A cure and a `status.apply` share the rule's once-per-holder-and-status set: the first of the two on one pair in a rule wins, so a rule never writes one row twice. The cure reads the proposal so far, so it ends a status an earlier delivery of the same advance applied.
- **Writer groups.** A reaction's cure joins the writer group its holder's status rows already hold in the advance, as `status.apply` does ([row W21](#fear-and-morale-for-npcs-toolbox-row-w21)'s `co_present` join; `statusStep` in `kernel/ts/src/mechanics/reaction.ts`), so "shocked lands, then a second rule cures it" composes in order in one command.
- **Loops.** A rule re-applying the status that triggered it only refreshes it, so no second `status_applied` and the delivery quiesces. Two rules that cure and re-apply each other land a new status per level; the existing `reaction_depth` budget (32, `react` in `kernel/ts/src/runtime/proposal.ts`) cuts the chain and the whole command faults `budget_exceeded`, committing nothing, as any reaction cycle does (`kernel/ts/test/elements.test.ts`). _Known limit:_ such content makes the triggering action unusable; the loader does not detect the cycle.
- **Opt-in.** Each piece needs `kernel_api` 1.53. The event is emitted only while some reaction of the cartridge triggers on `status_applied` (`landing` in `kernel/ts/src/mechanics/status/shared.ts`, as row W25's `clock_hour`), so cartridges without such a trigger keep their bytes, hash and receipts.
- **Book.** No new element: a cure says nothing and an NPC's status adds no line (row G3); the player's own applied line is row 1's.
- **Traps.** Trap 11 holds: every status still has a duration. No procedural table (trap 4): each edge is an authored rule.
- **Sampler.** `cartridges/elements_sampler`: a stone golem (20 HP) in a yard with a bucket, a charged jar and a lit torch; dropping each applies `wet`, `shocked` (hp −1 every 60 s for 120 s) or `warm` to the golem. Rule `shock_on_wet` (`on status_applied shocked`, `when status_active subject wet`) applies `stunned` (hp −3 every 60 s) and cures `shocked` and `wet`: bucket then jar leaves only `stunned`, the golem at 17 HP 60 s later, against 19 on a dry golem. Rule `warmth_dries` (`on status_applied warm`) cures `wet`, so bucket, torch, jar only shocks it (`kernel/ts/test/elements.test.ts`).
- **Composition record.** Consumer: reactions (the sampler's elemental edges), spells and recipes through `self` next (row 29b). Reads: status rows, the reaction subject table. Writes: `status.transition` through row 1's `applyStatus` and `expire`; events: `status_applied`; jobs and save rows: none new. Reused: the reaction subject table and `status` filter, `statusStep`'s holder loop, once-set and writer-group join, `expire`, the reaction budgets, `KERNEL_API_RANGE_INVALID`. New: two `subject` values and `ctx.subject`, one event kind and trigger, the reaction step `status.cure`, reaction@1 composing status@1, and the 1.53 floor; no foundation change.

## Spell cast admission (toolbox row 29a)

[Toolbox row 29a](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#spell-declarations) govern it; the PM brief is in Beads `loka-kgd.81` (2026-10-10). Engine half of admission; effects are row 29b; the Book input is Beads `loka-kgd.82`.

- **A spell is a recipe cast by its word.** A spell is an [action recipe](#action_recipe1-mechanicsaction_reciperulets49) whose target is `{kind: "spell", word}` (`word` a `SpokenKeyword`, 1 to 32 lowercase letters, unique among the cartridge's spells). It is never offered or performed by its key: the ActionSet leaves it out, and `perform` of its key is `not_found` like a key no recipe has. The one way in is the engine verb `cast {word}` (action_recipe@1, target none, input `word`, like [say](#social-verbs-say-whisper-and-shout-toolbox-row-g9-engine-half)), offered only in a cartridge that declares a spell. The typed word is case-folded (`folded`, `kernel/ts/src/mechanics/speech/shared.ts`) and names the spell (`spellOf`, `kernel/ts/src/mechanics/action_recipe/shared.ts`); its subject is the caster's body. _Why a new verb and a recipe variant, not a recipe per key:_ a keyed recipe is listed in the GameView, shown unavailable while its policy fails, which would print every secret word; a word typed into one verb lists none. The recipe already owns policy, costs, cooldown, check, sequence, narration and `action_completed`, so the spell reuses them all (the same `decide` runs for perform and cast).
- **Admission.** Step's admission (`refusal`, `kernel/ts/src/commands/actions.ts`) runs `castAdmission`: an unknown word and a spell whose policy fails are refused alike, `invalid_state`, so a refusal never tells which words are spells. Then the recipe's own admission: cooldown, then costs (`insufficient_resource`, nothing changes). The requirements are content: a learned gate is a `fact_compare` on a fact a quest's reaction, a teacher's dialogue or a read topic (`readable` with `topic`) sets; a minimum level is the new leaf `level_compare {at_least}` (attributes@1; the actor's [level](#experience-and-levelling-toolbox-row-4), 1 in a cartridge without `world.levelling`); attributes are `stat_compare`; mana is a `RecipeCost` on a mana pool; reagents are a `RecipeCost` on a reagent pool (a counted resource the content fills, here by a recipe step). _Known limit:_ reagents are pools, not items: moving an item to the consumed holder is a food@1-only foundation precondition in both kernels (`edible` or `bandage`), so item reagents need a foundation change (Beads `loka-kgd.83`). PM ruling (2026-10-10): pools are accepted for row 29a; item reagents wait for `loka-kgd.83`. A reagent pool is a body resource, so the GameView shows it as a vital meter (`ash` at 0 reads band `dying`). A held focus that is not consumed is `has_item` in the policy. A fight's action restriction keeps `cast` ([row 29b](#spell-effects-toolbox-row-29b)), with flee, stand, look, scan, bandage and attack. A spell's policy is read with no target, as for a recipe without a detail, so target-subject leaves (`status_active`, `has_tag` and `fact_compare` with `subject: "target"`) read false; a gate on the caster's own status is `status_active {subject: "self"}` ([status reader 1](#status-readers-toolbox-rows-sr1-sr2-and-sr3)).
- **Effects.** The outcome sequence is a recipe's (`event.emit`, `fact.assign`, `resource.adjust`) plus the spell-only steps of [row 29b](#spell-effects-toolbox-row-29b). This sampler's light is a narration line and a `light_cast` event.
- **Opt-in.** A spell target or a `level_compare` leaf needs `kernel_api` 1.51 (KERNEL_API_RANGE_INVALID); a shared spell word is DUPLICATE_DEFINITION at each spell's `target.word`; an opposed check on a spell must name an `npc` (no detail rating). Cartridges without spells keep their bytes, hash and GameView (no `cast` verb).
- **Book.** Not built: the Book has no word entry for cast yet (Beads `loka-kgd.82`). Proposed text for the designer: a "Cast" control opens a one-word field, as Say does; a refusal reads "Nothing happens." whatever the cause, except "Not enough <pool>." for a cost. (Wording proposed; designer to approve.)
- **Traps.** Trap 9 (free text): the word reaches no event or narration; only an authored spell's narration is shown. No new state, job or save row.
- **Sampler.** `cartridges/spells_sampler`: in the tower, gather ash at the hearth (`ash` +1); `lux` costs 2 mana and 1 ash; `ward` needs `ward_taught` (the apprentice quest's reward, with 20 experience: level 2), `level_compare 2` and `stat_compare wis 11` (one raise); `noctis` needs `noctis_known`, the topic of the grimoire. `xyzzy` and unread `noctis` are both `invalid_state` (`kernel/ts/test/spells.test.ts`).
- **Composition record.** Consumer: action_recipe@1 (perform and cast) and the GameView's engine verbs. Reads: the recipe policy (facts, levelling row, attributes), resource pools, cooldown rows. Writes: the recipe's existing ops; events: the recipe's existing ones; jobs and save rows: none new. Reused: recipe admission, costs, check, sequence and narration; speech's `folded`; quest reactions, `experience.grant`, readable topics, `stat_compare`; `KERNEL_API_RANGE_INVALID`, `DUPLICATE_DEFINITION`. New: `RecipeTarget` kind `spell`, the `cast` command, the `level_compare` leaf, `spellOf` and `castAdmission`; no foundation change.

## Command blocks and resistances on a status (toolbox rows SR4 and SR5)

[Toolbox rows SR4 and SR5](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#status-declarations) govern them; the PM brief is in Beads `loka-kgd.89` and `loka-kgd.90` (2026-10-10), from the status survey (`docs/reviews/2026-10-10-status-effects-survey.md` on `main`, G, H, J). Two more readers of a [row G3](#statuses-on-npcs-and-things-toolbox-row-g3) status row; the row itself is unchanged.

- **Blocks and allows (SR4).** A status may declare `blocks` and `allows`, each a list of Command types (`CommandPayload` `type`). While statuses are active on the actor's body, it may not issue a type any of them blocks, and where any declares `allows`, only a type every such list names (several `allows` lists intersect). A modal answer (dialogue's `choose` and `close_choice`, a scene's `continue`) and `wait` are always admitted, so no status traps the player in a conversation or scene, or stops time in a cartridge where only `wait` moves it. A permanent status that bars its own cure (`blocks: [eat]` with an edible cure) is the author's to avoid. Silence is `blocks: [say, shout, whisper, cast]`; stun, paralysis and sleep `allows: [look]`; entangle `blocks: [move, flee]`; berserk `allows: [attack, flee]`; fear on the player `blocks: [attack]`.
- **Where.** One filter at the end of the actor's action set (`resolved` in `kernel/ts/src/commands/actions.ts`, beside the fight restriction, through `permits` in `kernel/ts/src/mechanics/status/permits.ts`, which adds the modal and `wait` exemption to `statusAllows` in `kernel/ts/src/mechanics/status/shared.ts`), so the GameView, invocation and step read the same set: a barred verb is not listed and a barred exit is listed unavailable with the step's code (`gameview_agrees_with_admission` is checked for a hushed `say` under an alias, `kernel/ts/test/status_readers.test.ts`). The type is what is barred, whatever the action's key: a cartridge action keyed `chant` whose command is `say` is withheld with `say`.
- **Refusal.** Step refuses a barred command `invalid_state` when the set before the filter offers its type, as the fight restriction does (the action exists; the actor's state forbids it now); a type the set never offers stays `unsupported_capability`, and a `perform` of a key no recipe has stays `not_found`. A barred exit shows `invalid_state` as its reason. An invocation of a barred key is `unsupported_capability`, as for any key not in the set.
- **Engine verbs of other systems.** A [spell](#spell-cast-admission-toolbox-row-29a) is `cast`; a keyed recipe and a [use pair](#use-x-on-y-toolbox-row-g4) are both `perform`, so blocking `perform` bars every recipe; speech is `say`, `whisper` and `shout`; dialogue opens with `talk`. Flee picks its exit from the set before the fight restriction, so a block on `move` does not stop flight: content blocks `flee` too (entangle above). A fight's own restriction still applies, so a berserk player outside a target-choice fight keeps only `flee`.
- **Resistances (SR5).** A status may declare `resistances` (G2's `Resistances`: `DamageKind` and `Tag` entries, -100..100). An attack on a body holding it (the player's body or an NPC, in [`dealt`](#damage-kinds-resistances-and-critical-hits-toolbox-row-g2)), or a [row 29b](#spell-effects-toolbox-row-29b) spell's damage on an NPC holding it, adds (`resisted`, `kernel/ts/src/mechanics/combat/shared.ts`) each active status's entries for its kind and materials to the NPC definition's, then clamps the one sum to -100..100. _Why sum, not max:_ a vulnerability must cancel a resistance (an NPC resisting fire 50 while `wet` at fire -100 takes 150%); max would keep the 50 and lose it, and the sum is G2's existing rule. Two shields stack up to immunity at the clamp.
- **Combat turns (Beads `loka-kgd.98`).** Each combat blow reads the same rule as an `attack` (`statusAllows`, without the modal exemption): a body whose active statuses bar `attack` takes no blow that turn, the player's round blow, an NPC's, and the player's ally's alike, in a lone or a pack fight (one guard in `attack`, `kernel/ts/src/mechanics/combat/round_attack.ts`). A skipped turn writes nothing and emits no event, so it narrates nothing; the fight goes on and its rounds keep their schedule. A pack member whose statuses bar `flee` does not take its C4 or [fear](#fear-and-morale-for-npcs-toolbox-row-w21) flight and then strikes as usual unless `attack` is barred too; flight (`maybeFlight`, `kernel/ts/src/mechanics/combat/round_flow.ts`) is tried before the `attack` bar, so fear with `blocks: [attack]` still flees. Stun is `allows: [look]`: the stunned body neither flees nor strikes, and a stunned player cannot `cast` either (admission, above).
- **NPC movement (Beads `loka-kgd.102`).** An NPC whose active statuses bar `move`, or whose `allows` list leaves it out, does not move (`moves`, `kernel/ts/src/mechanics/status/shared.ts`, one `statusAllows` read each mover makes; there is no single NPC move path): a schedule job runs and completes but leaves it where it is (its goal line stays unsaid), a wanderer's step, a sighted refuge, a hound's pack flight (it stays and fights) and a crow's outbound leg (the find is dropped as a fallback) do not happen, a crow's return leg is retried next interval, and a patrol Continue is refused `invalid_state`. Installed kernel 1.63; no field, so no floor.
- **Known limits.** Escorts still move a rooted NPC: the follower travels with the player's own Move, and leaving it behind would break the escort's same-room rule (M9 follow-up). A skipped turn has no Book line yet (designer). Only statuses on the actor's body bar its commands; a status on a worn item bars only that item's `remove` ([row 28](#cursed-items-and-blessing-toolbox-row-28)). Resistances apply to combat attacks and spell damage only; a status tick has no damage kind.
- **Opt-in.** Any of `blocks`, `allows` or `resistances` needs `kernel_api` 1.54; such a status may omit `per_tick`. Cartridges without them keep their bytes, hash and GameView.
- **Book.** No new element: the Conditions line already names the status, a barred verb is not listed and a barred exit reads unavailable with the existing `invalid_state` wording. Proposed text for the designer: none new (designer to approve).
- **Traps.** Trap 6 holds: a block is an authored, timed status, never fatigue. Trap 11 holds: no new row.
- **Sampler.** `cartridges/ward_sampler`: the shrine north of the hall applies `warded` (physical 50) and `hushed` (blocks say, shout, whisper, cast; 120 s); in the den east a troll (8 HP, physical 50 of its own, a sure physical hit for 2) is `soaked` (physical -100) by a spoken "drench" and `stunned` (allows look; 200 s) by a spoken "thunder". The player always hits for 2, physical. One round leaves the player and the troll at 8 and 7 unwarded, 9 and 7 warded, and 8 and 5 after "drench" (50 - 100 = -50: 3). Hushed, `say` and `shout` are `invalid_state` and unlisted until 120 s pass. Stunned, the troll takes no blow in the round at 150 s (10 and 7) and clubs again at 300 s (8 and 6); a player stunned when hushed ends mid-fight takes no blow at 150 s (9 and 8 warded) (`kernel/ts/test/status_readers.test.ts`; the pack cases are in `kernel/ts/test/fear.test.ts`, the stunned ally in `kernel/ts/test/targets.test.ts`).
- **Composition record.** Consumer: the actor's action set (step, GameView, invocation), combat's `dealt` and row 29b's spell damage (`resisted`), and every combat blow and pack flight (`loka-kgd.98`). Reads: the body's status rows and the status declarations (`activeStatuses`), the NPC definition's resistances. Writes, events, jobs and save rows: none new. Reused: row G3 holders and rows, G2 `Resistances` and its sum and clamp, the fight restriction's place in `resolved`, `UNKNOWN_COMMAND`, `KERNEL_API_RANGE_INVALID`. New: `StatusDefinition.blocks`, `.allows` and `.resistances`, `permits`, `statusAllows` and `statusResistance`, the 1.54 floor (installed kernel 1.57 for the combat turns, which add no field and so no floor); no foundation change.

## Perception and concealment on a status (toolbox rows SR6 and SR8)

[Toolbox rows SR6 and SR8](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#status-declarations) govern them; the PM brief is in Beads `loka-kgd.91` and `loka-kgd.93` (2026-10-11), from the status survey (`docs/reviews/2026-10-10-status-effects-survey.md` on `main`, D and E). Two more readers of a [row G3](#statuses-on-npcs-and-things-toolbox-row-g3) status row; the row itself is unchanged. One scan serves both (`perceives` and `concealed`, `kernel/ts/src/mechanics/status/shared.ts`), and it runs only when some status of the cartridge declares `perception` or `concealment`.

- **Blind (SR6).** `perception: {sight: blind}` on the player's body makes `dark()` true in every room (`kernel/ts/src/mechanics/light/shared.ts`), whatever a held light or dark sight says: the room shows its `dark_description` where it has one, and its contents and the next rooms' contents on scan vanish as in an [unlit room](#b4-light-and-darkness-selected-contract); beyond darkness, `visible()` hides every NPC (a discovered one too) and a self-luminous detail. _Known limit:_ a room without a `dark_description` keeps its plain description while blind; an engine fallback line ("You cannot see.") would be the first engine-owned text key, so it waits for the designer (proposal below).
- **Dark sight (SR6).** `perception: {sight: dark_sight}` sees in an unlit room as an ancestry's `dark_sight` does (`darkSight`, `kernel/ts/src/mechanics/attributes/shared.ts`, read by `dark()` and scan). Blindness wins over it.
- **Deaf (SR6).** `perception: {hearing: deaf}`: no `sound` [cue](#sense-cues-sound-smell-and-heat-toolbox-row-g6) reaches the holder. On the player's body the GameView lists none (`cueViews`); on an NPC, `cue_perceived {sense: sound}` naming it is false (`perceived`, `kernel/ts/src/mechanics/senses.ts`). Smell and heat are unchanged.
- **Concealment (SR8).** `concealment: invisible | hidden`. On an NPC, the player does not see it: `visible()` is false for it before any other rule (so a discovered NPC's perception fact does not reveal it), so it is not listed, not a target of any verb (step refuses it as any absent target) and not shown by scan into its room (`sight`, `kernel/ts/src/mechanics/movement/rule.ts`). On the player's body, a hostile NPC does not engage it on entry (one clause in `hostileAt`'s candidate filter, `kernel/ts/src/mechanics/disposition.ts`). `invisible` yields to a `perception: {sight: see_invisible}` status on the seer (the player's body, or the NPC); `hidden` yields to nothing, so row 16's sneak is "apply `hidden` on a passed check, end it on a failed one". Concealment on an item is not read: inventory stays visible.
- **Known limits.** Only entry engagement reads the player's concealment: an NPC already fighting the player keeps fighting, and an invisible hostile NPC still engages the player who walks in (the combat view then names it while the room lists nothing and no attack is offered; the expedition hound's `houndHere` likewise ignores concealment), and talk, trade and the other [G11](#standing-and-disposition-toolbox-rows-15-and-g11) readers do not check it. Blindness is not concealment: a blind player is still seen, and an NPC's own `blind` or `dark_sight` is not read (a blinded troll still engages). An NPC concealed mid-fight stays in the fight: the round blows go on both ways and the combat view still names it, but a new `attack` on it is refused `not_present`; flee still works. No status bars or refuses a verb by itself; content pairs `blind` with [`blocks: [read, scan]`](#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5).
- **Opt-in.** Either field needs `kernel_api` 1.61; such a status may omit `per_tick`; an empty `perception` is refused (SCHEMA_VIOLATION). Cartridges without them keep their bytes, hash and GameView.
- **Book.** No new element: darkness, the Conditions line, the cue list and the room's NPC list already show every effect. Proposed text for the designer: an engine fallback room line for a blind player in a room without a `dark_description` (designer to approve).
- **Traps.** Trap 6 holds: blindness is an authored, timed status. Trap 11 holds: no new row.
- **Sampler.** `cartridges/ward_sampler` with the fields swapped in by the tests (the sampler's own statuses keep SR4 and SR5). Warded blind (the shrine), the troll in the lit den is unlisted and its attack refused; blind in the chapter's marsh, neither the discovered wisp nor the glow is seen, and a lit torch leaves the well shaft dark (`kernel/ts/test/light.test.ts`); with the den unlit, a warded `dark_sight` sees it, and a hushed `blind` beside it does not. A troll `soaked` invisible by "drench" is unseen from the den and from the hall's scan, seen by a hushed `see_invisible`, and unseen again when hidden. A hostile troll engages on entry, not an invisible player, and does when it holds `see_invisible`, but not a hidden one (`kernel/ts/test/status_readers.test.ts`); a deaf player's cues drop the forge's hammering and keep the stew, and a deaf guard misses the failed pick (`kernel/ts/test/senses.test.ts`).
- **Composition record.** Consumer: light@1's `dark()` and `visible()`, the attributes' `darkSight`, movement's scan, sense_cue@1's `cueViews` and `cue_perceived`, the G11 entry engagement. Reads: the holder's status rows and the status declarations (`activeStatuses`). Writes, events, jobs and save rows: none new. Reused: row G3 holders and rows, the darkness path, `KERNEL_API_RANGE_INVALID`, `SCHEMA_VIOLATION`. New: `StatusDefinition.perception` and `.concealment`, `perceives` and `concealed`, the 1.61 floor; no foundation change.

## A room as a status holder (status reader 9)

[Status survey](../reviews/2026-10-10-status-effects-survey.md) row P (reader 9); [declarations](cartridge.md#status-declarations) govern it; the PM brief is in Beads `loka-kgd.94` (2026-10-11). A room may hold a [row G3](#statuses-on-npcs-and-things-toolbox-row-g3) status row: the row, its key (the room's EntityId as `body_id`), its job and its events are G3's.

- **Producer.** A reaction's `status.apply` may name `room` (a room of the cartridge): the status lands on that room, at most once per delivery, refreshed while active as on any holder. Never with `item`, `npc` or `co_present` (compiler and loader SCHEMA_VIOLATION at `room`). A `status_ticked` or `status_expired` on a room has the room as its subject, so a reaction's unnamed `status.apply` or `status.cure` lands on the room.
- **Tick.** A room has no pools: its tick changes nothing, never kills, and still emits `status_ticked` (`amount`, `kernel/ts/src/mechanics/status/job.ts`); expiry is row 1's. Ticks and expiry run through the ordinary status job, sub-steps included. A room never dies, so nothing clears its statuses but expiry and a cure step.
- **Darkness.** A status with `perception: {sight: blind}` ([SR6](#perception-and-concealment-on-a-status-toolbox-rows-sr6-and-sr8)) held by the room the player's body stands in makes `dark()` and `visible()` read as if the body were blind: magical darkness that a held light or dark sight does not pierce (`blinded`, `kernel/ts/src/mechanics/light/shared.ts`). Its other perception and concealment fields mean nothing on a room.
- **Opt-in.** A step naming `room` needs `kernel_api` 1.65 (KERNEL_API_RANGE_INVALID). Cartridges without one keep their bytes and hash; an unnamed step whose event subject is a room (a `fact_changed` about a room) now lands on it with no floor (pre-production, no compatibility).
- **Scan.** Scan from a neighbouring room does not see into a darkened room: movement@1 `sight` (`kernel/ts/src/mechanics/movement/rule.ts`) treats a destination holding a `blind` room status as unlit, so it lists the direction without contents until the status expires.
- **Known limits.** No `status_active {subject: room}` leaf and no `room_id` event subject yet; the GameView shows no room status (a darkened room shows as darkness). Consecration and surfaces are later readers.
- **Book.** No new element: darkness already shows. Proposed for the designer: a room-condition line under the room title (designer to approve).
- **Composition record.** Consumer: reaction@1's `status.apply`, light@1's `dark()` and `visible()`, movement@1's scan (`sight`). Reads: the room's status rows and declarations (`activeStatuses`). Writes: G3's `status.transition` and status job on a room holder; events: G3's `status_ticked`, `status_expired`, `status_applied`; save rows: none new (the `statuses` row and job shapes are unchanged, [save](save.md#status-recovery)). Reused: row G3 holders, rows and writer groups, SR6's `perception`, the darkness path. New: `room` on the reaction step, `room` in both composers' holders (`protocol/fixtures/status_composition.json`), the 1.65 floor.

## Cursed items and blessing (toolbox row 28)

[Toolbox row 28](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#status-declarations) govern it; the brief is in Beads `loka-kgd.97` with the PM ruling of 2026-10-11 (the curse is hidden until worn; a blessing lifts it and the player keeps the item). A curse is a [row G3](#statuses-on-npcs-and-things-toolbox-row-g3) status on the item; one engine read makes it hold the item on.

- **Held on.** [equipment@1](#equipment1-kerneltssrcmechanicsequipmentrulets) `remove` of a worn item whose own active statuses bar `remove` ([SR4](#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5)'s `statusAllows`, read on the item: a `blocks` naming it, or an `allows` leaving it out) is refused `invalid_state`. The check sits in the read-only `transfer` the rule and the GameView share, so a held item lists no `remove` and the GameView invariant is unchanged. An item status's other `blocks` and `allows` entries mean nothing, and the wearer's own statuses still bar only the wearer's commands. Wear is never barred: a curse already on a carried ring does not stop the player putting it on.
- **Hidden until worn.** `cursed` joins the closed `Tag` set (`protocol/entity.schema.json`). No mechanic gives it a meaning of its own (`has_tag`, `wearing` and [resistances](#damage-kinds-resistances-and-critical-hits-toolbox-row-g2) see it as any tag): content marks a curse-bearing item with it, so the item's [W6](#entity-description-variants-toolbox-row-w6) name variant can hold on `all(status_active {subject: target, status}, wearing {tag: cursed})` and the cursed name shows only once worn. _Known limit:_ the tag stays after a blessing, so while any item tagged `cursed` is worn, even a blessed one, a second, carried cursed item also shows its cursed name. An [identify](#unidentified-items-toolbox-row-27) fact in the cursed name's `any(...)` (`all(status_active {subject: target, status}, any(wearing {tag: cursed}, fact_compare {fact, equals: true}))`) reveals a curse before wear; that is content, and no engine code is needed.
- **Blessing.** Content, no engine: a reaction's `fact.assign` of an [entity fact](#entity-and-pair-facts-toolbox-row-w2) naming the item emits `fact_changed` with the item as subject, so a reaction on that fact with an unnamed `status.cure` ([status reader 3](#status-readers-toolbox-rows-sr1-sr2-and-sr3)) lifts the curse; the item stays worn and may then be removed. The same fact in the curse reaction's `when` keeps a blessed item from being cursed again.
- **Death.** Death's custody moves worn items without equipment@1 ([death@1](#death1--corpse-custody-and-same-body-return-m5-b-foundation)), so a curse never keeps an item on a corpse; the status stays on the item.
- **Opt-in.** No field and no floor: the tag and the read hold at any `kernel_api` (installed kernel 1.66). No cartridge before this row put a status barring `remove` on an item.
- **Book.** No new element: the worn ring shows its cursed name through W6 and simply offers no Remove. Proposed for the designer: whether a refused or missing Remove needs its own cue (Beads `loka-x6t.38`).
- **Sampler.** `cartridges/curse_sampler`: a plain silver ring lies in the market. Taking it applies the permanent `cursed` (`blocks: [remove]`) to the ring, whose name stays "a silver ring" while carried; worn, it reads "a cursed silver ring", lists no Remove and a `remove` is refused `invalid_state`. Entering the chapel north with the ring blesses it (`blessed` on the ring), which cures `cursed`: the name is plain again, Remove is listed and accepted, and dropping and retaking the ring does not curse it again (`kernel/ts/test/curse.test.ts`).
- **Composition record.** Consumer: equipment@1's `transfer` (step and GameView). Reads: the item's status rows and declarations (`statusAllows`). Writes, events, jobs and save rows: none new. Reused: G3 item holders, SR4's `statusAllows`, row W8's permanent status, W6 variants with `status_active` and W25's `wearing`, W2 entity facts and their `fact_changed` subject, status reader 3's cure. New: the `cursed` tag and one check in `transfer`; no foundation change.

## Unidentified items (toolbox row 27)

[Toolbox row 27](../MECHANICS-TOOLBOX.md#ranked-toolbox) (C2-M06 in [later mechanics](../archive/LATER-MECHANICS.md)); [declarations](cartridge.md#item-affect-declarations) and [Book](book-ui.md#worn-affects-details) govern it; the brief and the PM rulings are in Beads `loka-kgd.112` (2026-10-12). Identity is the player's knowledge of an item definition, held in one plain fact; the item's mechanics apply whether it is known or not.

- **Identity.** An item with [affects](#item-slots-and-affects-toolbox-row-3) may declare `identified`, naming a boolean fact that is not per_subject. The item is identified while that fact reads true for the player (fact@1's `value`: its record at the fact's scope, else its default) and unidentified while it reads false; an item without the field is always identified. Knowledge is per item definition, not per instance. Identifying is content: any existing writer of a plain fact (a dialogue choice's `fact.assign`, a reaction, a recipe) sets it, so no verb, op or event is added, and the existing `facts` save section keeps the knowledge across save and reopen.
- **Name.** Content on [W6](#entity-description-variants-toolbox-row-w6): the item's base `short` and `description` are the unidentified texts ("a dull ring"), and a `short_variants` and `description_variants` entry on `fact_compare {fact, equals: true}` gives the true name. The base text is the unidentified one because every reader W6 does not vary (shop lines, the text player's take, drop and give narration, disambiguation) shows the base text, so a true base name would leak there.
- **Affects.** Unchanged: [attributes@1](#attributes1-kerneltssrcmechanicspolicyts60) adds every worn affect, so `stat_compare`, the derived stats and the hp maximum see an unidentified item's affects at once. Only GameView `attributes`' `worn` sum (`attributeViews`, `kernel/ts/src/view/skills.ts`) counts identified worn items alone, so the Character page reads "PER 12" before identification and "PER 12 (+2 worn)" after.
- **Opt-in.** `identified` needs `kernel_api` 1.68 (KERNEL_API_RANGE_INVALID). A cartridge without it keeps its bytes, hash and GameView.
- **Book.** No presenter change: the worn note shows what GameView `worn` carries ([worn affects details](book-ui.md#worn-affects-details)).
- **Sampler.** `cartridges/identify_sampler`: a dull ring (PER +2, `identified: ring_known`) and a sage share the hall. Worn, the ring reads "a dull ring" and PER 12 with no worn note; the sage's dialogue, offered while the player has the ring (`has_item`), asks about it and sets `ring_known`; then the ring reads "a ring of keen sight", worn or carried, and PER 12 (+2 worn); removed, PER reads 10 (`kernel/ts/test/identify.test.ts`).
- **Composition record.** Consumer: the GameView attribute view (`attributeViews`) and, through it, the Book Character page's worn note. Reads: worn items (`wornItems`) and each one's `identified` fact for the player. Writes, events, jobs and save rows: none new; identification uses the dialogue `fact.assign`, `fact_changed` and the `facts` section. Reused: row 3 affects and `worn`, W6 variants with `fact_compare`, plain facts, dialogue policies and `has_item`, `Refs.reference` and `named`, W2's FACT_SCOPE_UNSUPPORTED site walk, FACT_TYPE_MISMATCH, KERNEL_API_RANGE_INVALID. New: the `ItemDefinition.identified` field, one identified-only filter on the view's worn sum and the 1.68 floor; no foundation change. Not touched: knowledge@1 (visit counts) and equipment@1 (`transfer`).
- **Known limits.** Identity is per definition: two instances of one item are known together, and per-instance identification waits for an entity-fact consumer. The value still moves on wear, so a player can infer an unknown affect from it (C2-M06: the mechanics apply while unknown). Only the GameView worn note hides an unidentified affect; the text player shows no worn note.

## Spell effects (toolbox row 29b)

[Toolbox row 29b](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#spell-declarations) govern it; the PM brief is in Beads `loka-kgd.99` (2026-10-10). A [row 29a](#spell-cast-admission-toolbox-row-29a) spell's outcome sequence may hold three more steps, in order with its others (`effect`, `kernel/ts/src/mechanics/action_recipe/spell.ts`); no other recipe may.

- **`status.apply {status, npc?}`.** Starts or refreshes the status on the named NPC's instance, else on the caster's body, through status@1's `statusStep` (`kernel/ts/src/mechanics/status/shared.ts`), the one a reaction's `status.apply` uses: a dead NPC or an immune holder takes nothing; a first application emits `status_applied` ([status reader 2](#status-readers-toolbox-rows-sr1-sr2-and-sr3)) at its causal position while a reaction listens, and on the caster adds the status's applied line after the spell's own; a refresh while active is silent. Once per holder and status in a spell: a later step on the same pair writes nothing.
- **`damage {npc, kind, amount}`.** The named NPC's instance, while alive, loses `amount` hp of the `DamageKind` after its [G2 resistances](#damage-kinds-resistances-and-critical-hits-toolbox-row-g2) and its active statuses' ([SR5](#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5)) (the same `resisted`, `kernel/ts/src/mechanics/combat/shared.ts`; no crit, no draw), stopping at 0. A loss to 0 closes the NPC's encounter when it is the only opponent (as a fatal status tick) and runs the [death sequence](#death1--corpse-custody-and-same-body-return-m5-b-foundation) with the caster's body as killer and the caster as `credited_character_id`, its drops drawn from the RNG after the spell's check. An NPC without an hp pool, or one an earlier step of the spell killed, takes nothing. Presence is content, as for a song: the spell's policy holds `npc_present {npc}` (the sampler's `flamma` does). _Known limit:_ a kill in a pack fight leaves the dead member in the roster until the round prunes it, as a fatal status tick does.
- **Kill credit and the fight (Beads `loka-kgd.101`).** A spell kill is credited as a combat kill: `deathCredit` (`kernel/ts/src/mechanics/combat/credit.ts`) grants its `world.levelling.kills` experience and its `death_credit` fact when the death's cause is the player's own `cast` and the caster's body the killer, with the same corpse and fatal-loss checks as a round's kill, in the cast's writer group; no encounter is needed. A spell's damage that leaves its NPC alive starts the fight as Attack would (`fightBack`, `spell.ts`): when Attack would admit that NPC (the caster sees it, `visible`, as Attack's command admission requires, and `attackRefused` admits it), the encounter opens with its first round one `combat.interval` after the cast ends (after its `duration`, so the cast's own advance never crosses it), through the ops a hostile NPC's engage writes (`opened`, `kernel/ts/src/mechanics/disposition.ts`), with no line. Only the first NPC so hurt; a caster already fighting, an NPC already fighting, a status step and a fully resisted hit start nothing (_known limit:_ admission reads the world before the cast, so a bolt that kills the sole opponent and hurts a second NPC leaves the second passive). NPCs have no sleep state (only a sleeping player is woken, by a round's hit), so the fight is the wake. Installed kernel 1.60; no field, so no floor.
- **`light.ignite {item}`.** Ignites the named fuel source exactly as the ignite verb does (`transition`, `kernel/ts/src/mechanics/light/shared.ts`: held directly or in the light slot, fueled, unlit, not rained out), so a dark room is lit while the caster holds it; otherwise it writes nothing and the spell still succeeds. The verb's line is not added: the spell narrates.
- **In a fight.** `cast` stays offered while engaged, and a spell without a `duration` is admitted, so a bolt is cast between rounds; the round job runs on its own clock. A spell with a `duration` is refused while engaged (`invalid_state`, as a spell whose policy fails; `castAdmission`, `kernel/ts/src/mechanics/action_recipe/shared.ts`): its `time.advance` would run the round job inside the cast. _Known limit:_ outside a fight, a spell with a `duration` whose `status.apply` lands or refreshes a status faults `precondition_failed` or `nonfuture_job` when its advance crosses that status's tick or end, because the cast writes the row and its job before its own advance (not the drain's crossed sub-steps; Beads `loka-kgd.104`); no shipped cartridge reaches it, since `real_elapsed` cartridges refuse recipe durations.
- **Opt-in.** An effect step needs `kernel_api` 1.55 (KERNEL_API_RANGE_INVALID) and sits on a spell (SCHEMA_VIOLATION at its `op`); its owner is declared (UNDECLARED_CAPABILITY). Cartridges without effect steps keep their bytes, hash and behavior.
- **Book.** No new element: the spell's line, the status's condition line, the NPC's HP change and the lit room are existing surfaces. _Known limits:_ a damage or status step names an authored NPC, so a spawned foe (a pack hound) cannot be targeted; `light.ignite` needs a held source, so a spell lights nothing on its own.
- **Traps.** Trap 9: no word reaches narration. No new state, job or save row.
- **Sampler.** `cartridges/spell_effects_sampler`: take the orb in the hall and go east into the dark crypt; `lux` ignites the orb and the crypt is lit (without the orb it stays dark); `flamma` deals 8 fire to the wight (hp 8, fire 50): 4, and a second bolt cast in the fight kills it, closing the encounter (`entity_died`, killer the caster); `ward` lands `warded` on the caster, whose `status_applied` reaction sets `ward_landed`; a recast while warded emits nothing (`kernel/ts/test/spell_effects.test.ts`).
- **Composition record.** Consumer: action_recipe@1's cast. Reads: status rows and definitions, NPC hp and resistances, fuel rows and custody, the encounter row. Writes: `status.transition` and the status job, NPC `resource.adjust`, the death sequence's ops and `encounter.close`, `fuel.set`, a hit's `encounter.open` and round `job.schedule`, a kill's credit `fact.assign` and experience; events: `status_applied`, `entity_died`; jobs and save rows: none new. Reused: status@1's `statusStep` (moved from reaction.ts, shared), G2's resistance sum (extracted from `dealt`), light@1's `transition`, the death sequence, `closeEncounter`, `deathCredit`, `attackRefused`, the engage's encounter ops, the fight restriction; `KERNEL_API_RANGE_INVALID`, `UNDECLARED_CAPABILITY`. New: three `RecipeStep` ops, action_recipe@1 composing status@1 and death@1 (`COMPOSES`), and the 1.55 floor; no foundation change.

## Fire (toolbox row W22)

[Toolbox row W22](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#status-declarations) govern it; the PM brief is in Beads `loka-kgd.100` and the barrier step in `loka-kgd.96` (2026-10-11). An integration row: fire is content on rows G1, G3, G4, G6, G12 and W1, plus two small pieces of vocabulary those rows lacked (the PM ruled both, 2026-10-11).

- **Spread: `co_present` with a `tag`.** A `status.apply` step with `co_present: true` and `tag: <Tag>` lands on every item lying directly in the event's room (its `room_id`, else the room directly holding the subject; none for a carried one) whose definition carries the tag, the event's subject included, in EntityId order (`itemsTagged`, `kernel/ts/src/mechanics/lookups.ts`). Otherwise it works as [row W21](#fear-and-morale-for-npcs-toolbox-row-w21)'s `co_present` does: once per holder in a rule, `immune` honoured, writes joining the holder's writer group. _Why:_ before it, a step reached one named item, the subject or living NPCs, and no leaf reads where an item lies, so "every burnable thing here" could not be written as content (a W21/G3 vocabulary gap that W22 found).
- **Barrier step `barrier.set` (`loka-kgd.96`).** `{op: "barrier.set", to, barrier | tag}` moves the named barrier, or each barrier carrying `tag` on an exit of the event's room (direction-key order, each once), to `to` (`setBarrier`, `kernel/ts/src/mechanics/barrier/react.ts`). It skips the door verbs' checks: no key, no `opens_when`, no reach. Each legal step on the way (open, closed, locked) is one `barrier.transition` and one `barrier_changed`, so a locked door opens through closed. A barrier already at `to` takes nothing. The step reads the proposal so far, so of two burning things ticking in one advance the second finds the door open. Its writes join the writer group an earlier reaction write of the advance gave the barrier row. reaction@1 composes barrier@1's `barrier_changed` (`COMPOSES`, `kernel/ts/src/runtime/decision.ts`). `to: "locked"` needs a `key_item` on every barrier it can reach (BARRIER_UNREACHABLE_KEY at load in both kernels; for `tag`, every tagged barrier on an exit of the trigger's `room` filter when it has one, else on any exit, since any room may be the event's; `loka-kgd.103`), so the step never locks a keyless barrier. _Known limit:_ whether that key can still be reached is not checked, the runtime lockout barrier@1 already names.
- **Break is open (known limit).** G12's "broken" state is not a barrier state: barrier@1 has only open, closed and locked. A burnt door is opened by `barrier.set {to: open}` and then behaves like any open door: a player may close it again, and its `opens_when` then gates opening once more. A real broken state would need schema, view and save work (PM ruling, 2026-10-11).
- **Known limit: root writes.** The writer-group join covers only reaction writes. A reaction that moves a barrier the root command already moved in the same command (open it, then a rule closes it) faults `conflicting_write`, committing nothing.
- **The fire, as content.** A `burning` status (180 s, ticking every 60 s; an item has no pools, so its tick changes nothing) declares a smell cue of range 1: the smoke ([row G6](#sense-cues-sound-smell-and-heat-toolbox-row-g6)). Dropping the torch applies `burning` with `co_present` and `tag: burnable`. A rule on `status_ticked {status: burning}`, whose `when` is `not status_active {subject: "subject", status: spent}` ([status reader 1](#status-readers-toolbox-rows-sr1-sr2-and-sr3)), spreads `burning` the same way, opens each `burnable` barrier with `barrier.set {to: open, tag: burnable}` and applies `spent` (600 s) to the ticking thing. So each thing spreads once, on its first tick, and the fire burns out. Without `spent`, every tick would refresh every burning thing, the ticking one included, and a fire would never end. _Known limit (kept, `loka-kgd.103`):_ a first tick still refreshes the burning things beside it and itself, restarting their 180 s, so a thing burns until 180 s after the last first tick in its room, not 180 s after it caught; `spent` bounds it, as every thing ticks first only once. Skipping holders already burning would change what a re-applied status does for every `co_present` step. The [G4](#use-x-on-y-toolbox-row-g4) `quench` recipe (a held `liquid_holding` tool with water, on a `burning` target) cures it. Fire triggers on `status_ticked`, never `status_applied`: a `status_applied` trigger would turn that event on for every status application in the cartridge (`landing`).
- **Budget (the red control).** One command that sets n things burning creates n status jobs, so a spread is cut first by `created_jobs` (64 per command, `docs/spec/conformance/composition-profile.json`), not by `deliveries` (8192): the row's "stops at the delivery budget" pin reads "stops at the composition budget". The 65th burnable in one room faults the whole drop `budget_exceeded`, which commits nothing, so no fire starts (`kernel/ts/test/showcase_fire.test.ts`). _Known limit:_ as with any reaction budget, too much fuel in one room makes the triggering action unusable; the loader does not count it.
- **Opt-in.** A `co_present` `tag` or a `barrier.set` step needs `kernel_api` 1.56. Cartridges without them keep their bytes, hash and receipts.
- **Book.** No new element: the smoke is a cue line ([Book UI, Sense cues details](book-ui.md#sense-cues-details)), an item's status adds no line ([row G3](#statuses-on-npcs-and-things-toolbox-row-g3)), the opened door shows as open, and quench waits on the G4 Book input (Beads `loka-kgd.77`).
- **Traps.** Trap 11 holds: `burning` and `spent` both have durations. Trap 12 holds: the smoke is words.
- **Sampler.** The showcase smithy (`cartridges/toolbox_showcase`, south of `the_fold`): a lit torch, a bundle of kindling and a heavy bench (`wooden`, `burnable`), an iron anvil (`metal`), a bucket (`liquid_holding`, 4 water), and a barred door south to the woodstore (`wooden`, `burnable`; `opens_when` reads `store_unbarred`, which nothing sets). Dropping the torch sets the kindling and bench burning, not the anvil. In the fold two smoke lines read from the south, one per burning thing. The first tick opens the woodstore door, which no rule names. The bucket quenches both, and left alone the fire burns out by 900 s (`kernel/ts/test/showcase_fire.test.ts`).
- **Composition record.** Consumer: reactions (the showcase fire) now; plan 3's toll gate next (a named `barrier.set`). Reads: entity locations and item tags, room exits and barrier tags, barrier states on the proposal so far, status rows. Writes: `status.transition` through row 1's `applyStatus`, `barrier.transition`; events: `status_applied` (only while listened for), `barrier_changed`; jobs and save rows: none new (the status job and the `barriers` row). Reused: row W21's `co_present` holder loop, once-set and writer-group join; row G3's item holders, `immune` and `status_ticked`; status reader 1's `subject`; G1 tags; G4 `quench` and `status.cure`; G6 status cues; the barrier row, `barrier.transition` and `barrier_changed`; `BARRIER_UNREACHABLE_KEY`; `KERNEL_API_RANGE_INVALID`. New: the `co_present` `tag`, `itemsTagged` and `eventRooms` (W21's room rule, moved to `lookups.ts`), the `barrier.set` step and `setBarrier`, reaction@1 composing barrier@1, and the 1.56 floor; no foundation change.

## Attacker filter (loka-kgd.79)

Found by [showcase plan 2](../showcase/combat-district.md) (#368); the PM brief is in Beads `loka-kgd.79` (2026-10-11). [Declarations](cartridge.md#status-declarations) govern it.

- **Rule.** `attacker` on `attack_result` holds when the payload's `attacker_id` is that NPC's authored instance (`FILTERS` in `kernel/ts/src/mechanics/reaction.ts`, the way `npc` matches the entrant), so two foes in one room can inflict different wounds. A spawned pack member, the player and any other attacker never match; the event gains no field.
- **Limits.** One NPC per rule: a wound shared by two foes takes one rule per foe. No filter names the player's blows or a spawn template's members. A fatal blow's reaction reads after the player's death has moved the body to its return room, so a status rule on `attacker` alone lands on the woken body; keep a `when` that the death breaks (`npc_present` of the attacker, as the showcase boars do).
- **Opt-in.** `attacker` needs `kernel_api` 1.58. A cartridge without it keeps its bytes, hash and behavior; Chapter 1 uses none.
- **Book.** Nothing new: the wound shows as before.
- **Sampler.** `cartridges/toolbox_showcase`: `boar_gore` and `tilt_boar_gore` each name one boar. The drill-yard boar's hit gores the player (combat 6) and a tilt-yard goblin's hit beside the tilt boar does not (the tilt yard pin, `kernel/ts/test/showcase_combat.test.ts`).
- **Composition record.** Consumer: reaction@1 on `attack_result`. Reads: the trigger's `attacker_id`, the world's authored instance ids. Writes, events, jobs and save rows: none new. Reused: the W1 filter table, the W3 entrant's instance match and spawn-template refusal, `KERNEL_API_RANGE_INVALID`, UNRESOLVED_REFERENCE. New: the `attacker` trigger filter and the 1.58 floor; no foundation change.

## Movement on a status (toolbox row SR7)

[Toolbox row SR7](../MECHANICS-TOOLBOX.md#ranked-toolbox); [declarations](cartridge.md#status-declarations) govern it; the PM brief is in Beads `loka-kgd.92` (2026-10-11), from the status survey (`docs/reviews/2026-10-10-status-effects-survey.md` on `main`, F). One more reader of a [row G3](#statuses-on-npcs-and-things-toolbox-row-g3) status row.

- **Cost.** A status may declare `movement.cost_percent` (0 to 1000). A move's fare (`world.movement.cost`, else 1 mv, times the flee multiplier while engaged) is multiplied by each active status's percent in turn, in definition order, each step rounded down (`fare` in `kernel/ts/src/mechanics/movement/shared.ts`). With the default 1 mv fare, 50 makes a move free (a fare of 0 writes no mv op): content that wants haste to cost something sets a larger fare. Water entry (D6 `entry_cost`) is not scaled.
- **Terrain.** A room tagged `air`, `chasm` or `water` (`TERRAIN`) admits a move into it only when the mover's active statuses together `pass` each such tag (`crossable`, read in `movementPlan` in `kernel/ts/src/mechanics/movement/sequence.ts` right after the barrier check). Step and flee refuse `invalid_state`; the GameView lists the exit unavailable with the same reason, since it reads `movementPlan`. Leaving such a room is never barred. The check runs before D6 water edges, so a water-tagged D6 room also needs a pass.
- **Known limits.** NPC movement (patrol, wandering, refuge, schedules, the crow, escorts) uses `passage`, not `movementPlan`, so it ignores terrain. (Reader 7 terrain on NPC moves needs the destination room at each mover, so it is not folded into `loka-kgd.102`.) Exits carry no tags: only the destination room's tags bar. An empty `movement: {}` is accepted (the schema subset has no `minProperties`) and does nothing. Not read: an ancestry's `passes`, `passes: [water]` as an alternative to D6's water skill gate, and a feather-fall pass on a climb. Expiry over terrain is content (a `status_expired` reaction with `has_tag {subject: room}`). Row 43a's per-room costs should reuse the same tags.
- **Opt-in.** A status `movement`, or a terrain tag on a room, item or barrier (new `Tag` members), needs `kernel_api` 1.62; a movement status may omit `per_tick`. Cartridges without them keep their bytes, hash and GameView.
- **Book.** No new element: the Conditions line names the status, the mv pool shows the fare, and a barred exit reads unavailable with the existing `invalid_state` wording. Proposed text for the designer: none new (designer to approve).
- **Traps.** Trap 11 holds: no new row, event or job.
- **Sampler.** None committed: `kernel/ts/test/status_movement.test.ts` edits `cartridges/ward_sampler` (the den tagged `water`, `warded` and `hushed` given `movement`, a 15 mv fare).
- **Composition record.** Consumer: movement's `movementPlan` (step, flee, GameView) and `fare`. Reads: the body's status rows and declarations (`statusMovement` in `kernel/ts/src/mechanics/status/shared.ts`), the destination room's `tags`. Writes, events, jobs and save rows: none new; the fare's mv debit is the existing `pay`. Reused: G3 status rows, G1 tags, `invalid_state` as SR4 uses it for a barred exit.

## Ranged first strike (toolbox row 17)

[Toolbox row 17](../MECHANICS-TOOLBOX.md#ranked-toolbox): "bow strikes first at a foe in the same room; ammo consumed; melee follows"; owner answer 2 ([record](../decisions/owner-decision-mechanics-toolbox-2026-10-08.md#answers-to-the-open-questions)) starts ranged combat with a same-room first strike. [Declarations](cartridge.md#ranged-weapon-declarations) govern it; the PM brief is in Beads `loka-kgd.110` (2026-10-12). It refines the [combat@1](#combat1--first-live-encounter-m6-a) round; Attack admission and Attack itself are unchanged (no RNG at Attack).

- **Shot.** In an encounter's round 1 (the encounter row's `round` is 1), the player's opportunity is a shot when the player wields an item whose `weapon` has `ranged {ammo}`, the weapon's skill is usable ([row G2](#damage-kinds-resistances-and-critical-hits-toolbox-row-g2)), the body holds at least 1 in the `ammo` resource pool, and the turn's existing guards pass (standing; `statusAllows` attack, [SR4](#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5)). The shot strikes with the weapon's own `attack` profile, with G2 kind, crit and the item's tags as materials, plus [row 2](#stats-derived-from-attributes-toolbox-row-2)'s bonuses (`attackProfile` in `kernel/ts/src/mechanics/combat/round_attack.ts`).
- **Foe waits.** The foe's round-1 opportunity is skipped exactly when the shot was taken, hit or miss: the ordinary round's NPC and the pack round's selected member (whose skipped turn includes flight). The pack cursor, the round order and the successor job are unchanged; the [6b](#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b) ally turn is unchanged.
- **Ammo.** Each shot writes one `resource.adjust` of -1 on the body's ammo pool in the round's writer group: an existing op, with no new delta, event, job or save row.
- **Melee follows.** After round 1, and in any round without a shot, a wielded ranged weapon never strikes: the player strikes with `world.combat.player_attack`, the unarmed profile (no materials). No weapon switching mid-fight.
- **Any opener.** The rule applies to round 1 of every encounter, deliberately: Attack, a hostile NPC's engage, or a spell's `fightBack` ([row 29b](#spell-effects-toolbox-row-29b), "Kill credit and the fight").
- **Budget.** A shot spends the player's usual hit draw, plus a damage draw only for variable damage; it adds no draw to the eight-raw-draw round budget, and the skipped foe turn draws nothing.
- **Kill and credit.** A shot that kills goes through the round's existing path (`injure`, the death sequence, `deathCredit`). `attack_result` is reused, so reactions and the [attacker filter](#attacker-filter-loka-kgd79) see the shot as the player's blow.
- **Narration.** The receipt narrates a shot with `world.combat.narration.shot_hit` or `shot_miss` (text is content); every other player blow keeps `player_hit` and `player_miss`.
- **Known limits.** Ammo is a counted resource pool, not items: item consumption needs the foundation consumed-holder change in Beads `loka-kgd.83`, and the [29a](#spell-cast-admission-toolbox-row-29a) ruling that reagents are pools is the precedent. A pool shows in the GameView as a resource meter whose 0 band reads danger (`loka-kgd.83`), so keep ammo pools to samplers. No shot into an adjacent room (owner answer 2).
- **Opt-in.** `weapon.ranged` needs `kernel_api` 1.67 (KERNEL_API_RANGE_INVALID). A cartridge without it keeps its bytes, hash, receipts and GameView; Chapter 1 declares none.
- **Book.** No new element: two text lines and the existing resource meter for the pool. Proposed sampler wording for the designer: "You loose an arrow into your foe." (`shot_hit`) and "Your arrow flies wide." (`shot_miss`), as in the sampler (designer to approve).
- **Traps.** None applies: the outcome RNG is not variety ([trap 5](../MECHANICS-TOOLBOX.md#traps)), and the pool is a counted resource, not a status row ([trap 11](../MECHANICS-TOOLBOX.md#traps)).
- **Sampler.** `cartridges/ranged_sampler`: a field with a wolf (6 HP, a sure hit for 1) and a den with two goblins of one pack plan (6 HP, a sure hit for 1); the unarmed blow is a sure hit for 1; a bow (`wield`, skill `archery`, a sure hit for 4, `physical`, `ranged {ammo: arrows}`); `arrows`, a pool starting at 2. The `archer` ancestry knows `archery`, the `farmer` does not. With the bow and 2 arrows the wolf is at 2 after round 1 (the player unhurt, 1 arrow), at 1 after round 2 (the player 1 down) and dies in round 3; with 0 arrows, or as a farmer, round 1 is melee (wolf 5, the player 1 down). In the den the shot leaves the first goblin at 2 and the second at 6, the player unhurt.
- **Composition record.** Consumer: the combat round's player and foe opportunities (`ordinaryRound` in `kernel/ts/src/mechanics/combat/round.ts`, `packTurns` in `round_flow.ts`) and round narration (`narrate`). Reads: the wielded item's `weapon.ranged`, the ammo pool level, skill usability, `statusAllows` and the encounter row's `round`. Writes: an ammo `resource.adjust` (existing op); events, jobs, delta ops and save rows: none new. Reused: `attack`, `attackProfile` and `equipped`, `bonused`, skills `status`, `statusAllows`, the resource adjust, `injure`, the death sequence and `deathCredit`, the round order, `allyOf`, `narrate`, `KERNEL_API_RANGE_INVALID`, SCHEMA_VIOLATION. New: `WeaponProfile.ranged {ammo}`, the narration keys `shot_hit` and `shot_miss`, one shot test (`attackProfile`) whose result (`Round.shot`, set by `shoot`) both round kinds read, the round-1 foe skip and the 1.67 floor; no foundation change.

## Durability, crafting quality and repair (toolbox row 21)

[Toolbox row 21](../MECHANICS-TOOLBOX.md#ranked-toolbox): "wear per use, a quality band from the forge check, and a repair service (`mechanics/service/`) that restores durability for a fee (review 3)"; [mechanics review 3](../reviews/2026-10-10-mechanics-review-3.md) merged repair into this row; the archived plan's C3-M03 ([LATER-MECHANICS](../archive/LATER-MECHANICS.md)) asks for "two committed uses→0" and leaves "quality bands/salvage" to their own consumer. [Declarations](cartridge.md#durability-declarations) govern it; the PM brief is in Beads `loka-kgd.111` (2026-10-12). Durability is a [row W2](#entity-and-pair-facts-toolbox-row-w2) entity fact on the weapon, not a new pool; the cartridge owns every number (maximum, default, wear, repair amount and price; [owner decision](../decisions/owner-decision-world-parameters-2026-10-02.md)).

- **Declaration.** An item's `weapon` may declare `durability {fact, wear}`: `fact` names a bounded int entity fact (`per_subject`, scopes `["instance"]`, a safe integer minimum and maximum); its default is a new weapon's value; `wear` is 1 to 2^31-1.
- **Wear.** In a [combat@1](#combat1--first-live-encounter-m6-a) round, when the player's attack hits (`attack_result.hit`, a fully resisted `loss: 0` included) with the wielded weapon's own durable attack, the round writes one `fact.assign` on that item (subject the weapon's EntityId): the current value minus `wear`, clamped to the fact's minimum (`bounded`, `kernel/ts/src/mechanics/fact.ts`). A miss, an unarmed blow, an NPC's or an ally's blow wears nothing. The write (`wear` in `kernel/ts/src/mechanics/combat/durability.ts`) goes through `assigned` in the round's writer group and leaves the next causal position free for the host's `fact_changed` (subject the weapon); the next round reads the committed value.
- **Broken.** A weapon whose durability fact reads at or below its minimum is broken: the usable-weapon test of the [wield resolver](#c1-training-and-armed-defense-selected-contract) (`attackProfile` in `kernel/ts/src/mechanics/combat/round_attack.ts`) treats it as unusable, so the player strikes with `world.combat.player_attack` and no material tags ([row G2](#damage-kinds-resistances-and-critical-hits-toolbox-row-g2)), and it takes no further wear. The item stays wielded; the Attack offer is unchanged. A broken [ranged](#ranged-first-strike-toolbox-row-17) weapon shoots no more.
- **Repair.** A service may declare the benefit `{kind: "repair", fact, amount}` ([B8 services](#b8-mauds-immediate-services-selected-contract)). Its target is the item directly in the actor body's `wield` holder whose `weapon.durability.fact` is `fact` (`equipped`, `kernel/ts/src/mechanics/lookups.ts`, the lookup combat uses). The new value is the current value plus `amount`, capped at the fact's maximum, through `assigned` with payment in one writer group. After the quote, provider and payment checks, as for meal and drink: no such wielded item refuses `invalid_state` with `service.nothing_to_repair`; a value already at the maximum refuses `invalid_state` with `service.full_durability`; both before any charge. The GameView service offer reads the same `availability`, so an offer the command would refuse is listed unavailable with that reason. _Known limit:_ `use_service` names no item, so a weapon carried but not wielded cannot be repaired.
- **Writer.** A fact any item's `weapon.durability.fact` names is written only by combat wear and service repair (`durable` in `kernel/ts/src/mechanics/fact.ts`: the owner `durability` of `ownership` for recipe and dialogue steps, and a check in a reaction's `fact.assign` and `fact.adjust`, which do not pass through `ownership`). A recipe's, dialogue's or reaction's write of it throws `precondition_failed`, as for an entitlement fact, so the decision faults `evaluator_error` with nothing changed; two writers can never race one row.
- **Quality.** Content, no engine code: a forge is a [G4 use recipe](#use-x-on-y-toolbox-row-g4) with a check whose outcomes `fact.assign` an enum entity fact on the target (success one band, failure another), read by [W6](#entity-description-variants-toolbox-row-w6) short variants through `fact_compare {subject: "target"}`; a recipe policy on the unforged value stops a re-forge. _Known limits:_ two bands (pass and fail), and quality changes neither durability nor damage; those wait for content that selects such a consumer (for example S5's Armorer's test). Salvage, NPC weapons, armour, shield and tool wear are not built.
- **Opt-in.** `weapon.durability` and the `repair` benefit need `kernel_api` 1.69 (KERNEL_API_RANGE_INVALID). A cartridge without them keeps its bytes, hash, receipts and GameView; Chapter 1 declares none.
- **Book.** The weapon's W6 variant names it ("a broken sword"); a broken weapon simply strikes as the bare hand. The repair offer's label is a follow-up: the Book prints "up to +N MV, capped" for every non-entitlement benefit. Proposed for the designer: "Mend — 2p; restores up to 2" (wording proposed; designer to approve).
- **Traps.** Trap 11 holds: durability is a fact row, not a status row; no new job, event or save section.
- **Sampler.** `cartridges/durability_sampler`: the player has 5 pennies, knows `swords` and strikes unarmed for a sure 1. In the yard an iron sword (`wield`, skill `swords`, a sure hit for 5, `durability {fact: edge, wear: 1}`; `edge` 0 to 2, default 2), a wooden sword (chance 0, damage 5, the same durability), a hammer (`metal`) and a straw dummy (30 HP, never hits); the smith (0 pennies) offers `mend` (2 pennies, `repair {fact: edge, amount: 2}`). Two hits with the iron sword take the dummy to 20 and the edge to 0 ("a broken sword"); the third hit is unarmed (19) and leaves the edge at 0. Mended at 0 the edge is 2 (pennies 5 to 3, the smith 0 to 2) and the next hit deals 5; mended at 1 it is 2; at 2 the mend is refused `service.full_durability`, carried but not wielded `service.nothing_to_repair`, with 1 penny `service.unaffordable`. The wooden sword misses and keeps its edge. `forge` (tool tag `metal`; policy `has_tag sharp` and `quality` unforged on the target; check `attribute_threshold` str 12) sets `quality` fine for the `smith` ancestry (str 15, "a fine sword") and crude for the `scholar` (str 5, "a crude sword"); a forged sword is not offered the forge again (`kernel/ts/test/durability.test.ts`).
- **Composition record.** Consumer: combat@1's player attack (`attack`, `attackProfile`), service@1 `transition` and the GameView service offer. Reads: the wield slot holder custody, the item's `WeaponProfile`, the entity fact rows and defaults, the fact bounds. Writes: `fact.assign` (existing op) on the weapon subject from combat and service; payment is B3's existing transfer. Events: the host's existing `fact_changed` (subject the weapon). Jobs: none new. Save rows: the existing `facts` section (W2 subject key); no new section. Reused: W2 entity facts, `assigned`, `bounded` and `ownership`, the B8 service query and payment, the `equipped` wield lookup (moved to `lookups.ts`), G4 use recipes with checks and W6 variants (the whole quality half), `KERNEL_API_RANGE_INVALID`. New: `WeaponProfile.durability`, the `repair` ServiceBenefit, the owner `durability` and `durable`, `wear` and `broken`, two refusal keys, the W2 site walk admitting the two new fact fields; no foundation change, no new delta op, event, job or save section.

## Replenish (toolbox row 19b)

[Toolbox row 19b](../MECHANICS-TOOLBOX.md#ranked-toolbox): the owner's ask (2026-10-11) for regrowth plus a general restocking mechanic. [Declarations](cartridge.md#replenish-declarations) govern it; the PM brief is in Beads `loka-kgd.85` (2026-10-12). No item is minted: a due job moves authored, conserved items from a reserve holder to a target holder up to a cap, so harvest regrowth, shop restock and refilled chests are custody, and saves, receipts and conservation need no new item kind. The cartridge owns every number (cap, count, interval; [owner decision](../decisions/owner-decision-world-parameters-2026-10-02.md)).

- **Declaration.** A top-level `replenish` section, keyed like `populations`; each entry `{items, from, to, cap, count, every}`: `items` an identity set of authored item refs (as `harvest.items`); `from` and `to` each an `ItemLocation` (room, npc or item; not `template`); `cap`, `count` and `every` integers of at least 1, `every` in clock units.
- **Job.** One pending `job {kind: "replenish", key}` per entry, first due at the world's start clock plus `every`. A fresh world seeds them after the calendar job (`firstJobs`, `kernel/ts/src/mechanics/schedule/behavior.ts`), in DefinitionRefString order, so a cartridge without `replenish` mints the same ids as before.
- **Run.** schedule@1's `run_job` (`runReplenish`, `kernel/ts/src/mechanics/containment/job.ts`) counts `held`, the entry's items directly in `to` (`selected`, `kernel/ts/src/mechanics/containment/stock.ts`, one query step per listed item), then moves `min(count, cap - held, free)` of its items directly in `from`, where `free` is the target's declared capacity less everything directly in it (one query step per container row, as a shop's Sell; unbounded without a capacity), lowest EntityId first, by `entity.transfer` in one writer group. It completes the job and schedules the next at its due time plus `every`, a fixed grid. A next due time the same advance also crosses runs as its own drain step (`next`, as `scheduledJob`'s crossed hour), so a long wait runs every interval once. An empty reserve or a full target, by `cap` or by its capacity, moves nothing and still reschedules, so a run never faults and time always advances.
- **Harvest.** A harvest item that a replenish entry lists and whose `to` is the detail's room may start in any authored holder (the [B5](#s9-infirmary-herbs-b5-selected-contract) stock check otherwise asks for the room); Harvest still selects only items directly in the room.
- **Host.** Unchanged: the elapsed host stops at every pending job but the calendar job (`boundary`, `mobile/authority/local-story/elapsed.ts`), so each interval runs once however an absence is chunked.
- **Silent.** No narration and no event: a refill shows only as the holder's contents, and the Book never promises a regrowth time ([book-ui.md](book-ui.md)).
- **Known limits.** A finite reserve is the lifetime supply unless a [decay](#decay-toolbox-row-41) `item.move` (row 41) sends items back into it: a sealed room is then both the decay sink and the reserve. No `when` gate yet. The reserve is any authored holder; a sealed room, which `reach.ts` lists unreachable, keeps it out of play. `cap` counts only listed items; a player's Put or Sell can fill the target's capacity with others, which then holds the refill back.
- **Opt-in.** `replenish` needs `kernel_api` 1.71 (KERNEL_API_RANGE_INVALID at `requires.kernel_api.at_least`). Both kernels refuse a `template` location, a holder with no entity (a spawn-template NPC or a template item), an item holder that is not a container, an item `to` when any listed item is a container (it may be or hold `to`: a containment cycle), or `from` equal to `to` (SCHEMA_VIOLATION) and an unresolved item or holder (UNRESOLVED_REFERENCE). A cartridge without it keeps its bytes, hash, ids, receipts and GameView; Chapter 1 declares none.
- **Book.** No new element and no line; the holder's contents list already shows the refill.
- **Traps.** [Trap 1](../MECHANICS-TOOLBOX.md#traps) holds: due times are on the logical clock. No new save section, op or event.
- **Sampler.** `cartridges/replenish_sampler`: the mine's `seam` harvests `ore_01`..`ore_05` (no tool); the mine holds `ore_01` and `ore_02`; the sealed store holds `ore_03`..`ore_05`, a stone and a crate holding `apple_01`; a trader in the mine holds nothing. `seam_regrowth` `{items ore_01..05, from store, to mine, cap 2, count 1, every 3600}`; `shelf` `{items [apple_01], from crate, to trader, cap 1, count 1, every 3600}`. Harvested twice at 0 the seam refuses `not_found`; at 3600 the mine holds 1 ore and the store 2; at 7200 2 and 1; at 10800 still 2 and 1; one wait from 0 to 10800 ends the same. Unharvested, at 3600 the mine holds 2 and the store 3. At 3600 the trader holds `apple_01` and the crate is empty. The stone never moves (`kernel/ts/test/replenish.test.ts`).
- **Composition record.** Consumer: schedule@1 `run_job`; Harvest, shops and the GameView read the result unchanged. Reads: containers. Writes: `entity.transfer`, `job.complete`, `job.schedule` (existing ops). Events and save rows: none new. Reused: `selected`, `firstJobs`, the crossed-step drain (`next`), `ItemLocation`, the job row. New: the `replenish` section, its job kind, `firstReplenish` and `runReplenish`, the harvest stock allowance and the 1.71 floor; no foundation change.

## Group primitive (toolbox row G8)

[Toolbox row G8](../MECHANICS-TOOLBOX.md#ranked-toolbox): "leader, members, co-move, shared credit"; its sampler: "two followers move with the leader; leaving the group stops the follow". [Declarations](cartridge.md#group-declarations) govern it; the PM brief is in Beads `loka-kgd.115` (2026-10-12). It reconciles [row 6b](#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b)'s static ally list with a dynamic relation; [row 22](../MECHANICS-TOOLBOX.md#ranked-toolbox) (hirelings) builds on it.

- **Membership.** `world.group {member}`: `member` names a bool [row W2](#entity-and-pair-facts-toolbox-row-w2) pair fact (`per_subject: true`, scopes `["player"]`). An NPC is in the character's group while that fact is true for (NPC, character); the character is the leader (`member`, `kernel/ts/src/mechanics/escort/shared.ts`). Join and leave are content: a dialogue's `fact.assign` at the speaker, or a reaction's. Nothing stored is new.
- **Co-move.** When Move, Flee or a transport moves the body, every living NPC directly in the source room whose member fact is true moves to the same destination in the same writer group, in EntityId order: one `entity.transfer` each, from `travel` (`kernel/ts/src/mechanics/escort/shared.ts`), the place [escort@1](#escort1) already moves its NPC. A member elsewhere stays put (no fault, no write) and follows again once co-located. The escorted NPC is skipped by the group walk, so it moves once.
- **Shared credit and fighting.** A member counts as an ally of its leader's character: `ally` (`kernel/ts/src/mechanics/combat/shared.ts`) takes the character and is true for a listed ally or a member. Attack on a member is refused `invalid_target` and the GameView offers no Attack on it. The ally that strikes each round (`allyOf`) is the first listed ally living in the encounter room, else the first member there (EntityId order) with an `attack`; one ally turn per round, so the round's eight-draw budget is unchanged. Party credit follows (`entity_died` credits the character for a member's kill).
- **Death.** A player's death writes nothing for the group: membership survives and the body returns alone.
- **Known limits.** Members ride free and pass every exit the leader passes, with no `entity_entered_room` (the escort precedent); a schedule or wander still moves a member; NPC-led groups and parties wait for the Realm; members take no combat damage (row 6b).
- **Opt-in.** `world.group` needs `kernel_api` 1.70 (KERNEL_API_RANGE_INVALID). A cartridge without it keeps its bytes, hash, receipts and GameView; Chapter 1 declares none.
- **Book.** No new element: the room list shows who came along. A "follows you" line is not built (as for escort; designer question parked).
- **Traps.** None applies: no new job, event, save row or status.
- **Sampler.** `cartridges/group_sampler`: a yard with a road north. Ada and Bram offer the dialogues `join` (`in_group` true) and `leave` (false); Cole never joins. Bram strikes for a sure 1 (`attack` chance 100, damage 1), as does the player; a goblin in the yard has 2 HP and never hits, and its death sets `goblin_slain` (`world.death_credit`). Ada and Bram join and the player moves north: both are in the road, Cole in the yard; Ada leaves and the player moves south: Bram follows, Ada stays. With Bram a member the goblin dies in round 1 and `goblin_slain` is true; without him it is at 1. Attack on Bram is refused `invalid_target` and not offered (`kernel/ts/test/group.test.ts`).
- **Composition record.** Consumer: `travel` (Move, Flee, transport), the ally turn, Attack admission, the GameView Attack offer, death credit. Reads: the member fact (W2 pair fact rows and default), presence, life. Writes: `entity.transfer` (existing op) for each co-located member. Events, jobs, save rows: none new. Reused: W2 pair facts and `value`, `npcsIn`, escort's `travel`, row 6b's ally turn and party credit, `KERNEL_API_RANGE_INVALID`. New: `world.group`, the `member` query, member-aware `ally` and `allyOf`, the 1.70 floor; no foundation change.

## Random encounters (toolbox row 9)

[Toolbox row 9](../MECHANICS-TOOLBOX.md#ranked-toolbox): random encounters, the RNG draw a per-plan option so RNG-free ecology plans and encounter plans never share a plan; its sampler: "road room spawns a bandit 1 in 4 per hour, capped at one". [Declarations](cartridge.md#encounter-declarations) govern it; the PM brief is in Beads `loka-kgd.117` (2026-10-12). An encounter is a [C3 population plan](#c3-bounded-living-hounds-selected-contract) with a chance per opportunity; the cartridge owns the chance and the rate ([owner decision](../decisions/owner-decision-world-parameters-2026-10-02.md)).

- **Declaration.** A `PopulationPlan` may declare `chance`, an integer 1 to 100 (a percent, as a loot drop's `chance`). A plan with `chance` is an encounter plan; a plan without it is an ecology plan, RNG-free as before. The one field decides; no plan has both behaviors.
- **Genesis.** An encounter plan births nothing at world creation: every slot starts at generation 0 with no member, as a slot above the genesis target does (`initialOps`, `kernel/ts/src/mechanics/population/shared.ts`). Its first plan job is scheduled as an ecology plan's.
- **Opportunity.** A plan occurrence at a wander boundary (a crossed sub-step included, [loka-6ql4](#c3-bounded-living-hounds-selected-contract)) that is not suppressed and has at least one eligible slot (`eligible`, `kernel/ts/src/mechanics/population/settle.ts`: slot within the target, no living member, its replacement due reached). Each opportunity draws exactly one `uniform(state.rng, 100, 8)` (`encounter`, same file); a roll below `chance` births the first eligible slot only, one birth per opportunity even when `cap` is above 1. No eligible slot draws nothing. An occurrence off the wander boundary (a replacement due, a night boundary off the hour) and the suppression resume never birth and never draw.
- **RNG.** The drawn state returns with the plan job's decision (`accepted`), so a later crossed sub-step of the same advance draws from it (`kernel/ts/src/runtime/proposal.ts`).
- **Members.** Combat and death of an encounter member are unchanged: a dead slot keeps `replacement_delay`, then waits for a boundary draw. Wandering is unchanged.
- **Silent.** No narration and no event beyond a birth's: the member appears in its room's list.
- **Known limits.** No aggression: an encounter member fights only when attacked, as a hound. One bundle per plan (no weighted tables) and one chance per plan (not per room).
- **W12 forward rule (M12).** W12's `population_count` may name an encounter plan wherever a policy is allowed, except inside a population plan's own birth or wander `when`; W12's `when`, `prey` and floor are refused on an encounter plan, which is never part of an RNG-free ecology chain. Ecology plans read only ecology plans.
- **Opt-in.** A plan with `chance` needs `kernel_api` 1.74 (KERNEL_API_RANGE_INVALID at `requires.kernel_api.at_least`) in both kernels. A cartridge without `chance` keeps its bytes, hash, ids, receipts and behavior; Chapter 1's `fen_hounds` declares none.
- **Book.** No new element and no line.
- **Traps.** No new job kind, save row, op or event; the opportunity is on the logical clock.
- **Sampler.** `cartridges/encounter_sampler`: a road and a crossroads, start hour 8; `bandits` `{home road, area [road, crossroads], cap 1, day_target 1, night_target 1, night_start 20, night_end 6, replacement_delay 3600, wander_interval 3600, chance 25}`. A fresh world holds no bandit. From RNG `[1,2,3,4]` one hour rolls 20 and births a bandit in the road (RNG `[7,0,1026,12288]`); the next hour has no eligible slot and draws nothing. From `[1,1,1,1]` one three-hour advance rolls 60, 60, 20 and births at the third boundary (RNG `[2560,513,262145,5242880]`). From `[1,7000003,1,1]` two hours roll 25, 25 and birth nothing (`kernel/ts/test/encounter.test.ts`).
- **Composition record.** Consumer: `runPopulation` (schedule@1 `run_job`); the `.107.7` fight matrix and W12 read the plan. Reads: `plan.chance`, slot rows, the wander boundary, `state.rng`. Writes: `state.rng`; births through the existing `birthSlot` ops. Events, jobs, save rows: none new. Reused: the population plan, `births`, `wanders`, `uniform` (as row 8's `rollDrops`). New: the `chance` field, `eligible` and `encounter`, the genesis condition and the 1.74 floor; no foundation change.

## Hireling orders (toolbox row 22a)

[Toolbox row 22](../MECHANICS-TOOLBOX.md#ranked-toolbox): "hire, follow, stay, attack, guard"; its sampler slice here: "hire a guard; stay blocks following; attack order joins combat". The M10 plan splits the row: 22a (this section) is orders; 22b is wages, loyalty and the hire fee. [Declarations](cartridge.md#group-declarations) govern it; the PM brief is in Beads `loka-kgd.116` (2026-10-12). It builds on the [group primitive](#group-primitive-toolbox-row-g8): a hireling is a group member.

- **Hire.** Hire is membership: the member fact true; dismiss is the member fact false ([G8](#group-primitive-toolbox-row-g8), unchanged). A dismiss resets nothing by engine rule; content that wants a re-hire to start following and holding assigns the order facts false in the dismiss choice.
- **Orders.** `world.group` may declare `stay` and `fight`, each a bool pair fact like `member`. An order is a dialogue choice whose `sequence` `fact.assign`s one of them at the speaker, as a join does. The engine knows no order names; the authored set is: stay (`stay` true), follow (`stay` false), attack (`fight` true), hold (`fight` false), guard (`stay` and `fight` true, one choice with two assigns). Every choice stays offered; there is no per-choice condition.
- **Following.** Move, Flee and transport bring a member (`travel`, `kernel/ts/src/mechanics/escort/shared.ts`) only while its `stay` fact is not true for (NPC, character). Without `stay` declared every member follows (G8).
- **Fighting.** With `fight` declared, a member takes the ally turn (`allyOf`, `kernel/ts/src/mechanics/combat/shared.ts`) only while its `fight` fact is true; without it every member with an attack may (G8). A listed ally (`world.combat.allies`) reads neither fact. The attack order joins the player's fights; it never opens combat on a target.
- **Still an ally.** Membership alone keeps the NPC an ally (`ally` unchanged): a holding or staying hireling is still refused as an Attack target (`invalid_target`), offered no Attack in the GameView, and credits kills to the party.
- **Guard.** Guard is stay plus fight: the hireling holds its room and fights in any encounter the character has there. _Known limit:_ no guard job and no aggression; a guard starts no fight, and NPCs attack only as before.
- **Known limits.** Carried from G8: members take no combat damage; a schedule or wander still moves a staying member.
- **Opt-in.** `world.group` with `stay` or `fight` needs `kernel_api` 1.73 (KERNEL_API_RANGE_INVALID); a group with `member` only stays at 1.70. A cartridge without them keeps its bytes, hash, receipts and GameView; Chapter 1 declares none.
- **Book.** No new element and no [Book UI](book-ui.md) change: orders are dialogue choice labels; the room list shows who came along.
- **Traps.** None applies: no new job, event, save row or status.
- **Sampler.** `cartridges/hireling_sampler`: a yard with a road north. The player strikes for a sure 1. Hal (5 HP, a sure 1) is in the yard; his dialogue offers hire, dismiss, stay, follow, attack, hold and guard over the pair facts `hired`, `staying` and `fighting` (default false); dismiss assigns all three false. A goblin in the yard has 2 HP and never hits; its death sets `goblin_slain`. Hired, Hal follows the player north; told to stay, he stays in the yard; told to follow, he comes along again. Hired but holding, he takes no ally turn and the goblin is at 1 after round 1; ordered to attack, the goblin dies in round 1 (1 + 1) with `combat.ally_hit`. Guarding, he stays in the yard while the player walks north and back, then kills the goblin with the player in round 1. Holding, he is still refused as an Attack target and only the goblin is offered (`kernel/ts/test/hireling.test.ts`).
- **Composition record.** Consumer: `hireling_sampler`; later row 22b wages (reads `member`) and W9 sleep (combat). Reads: the `member`, `stay` and `fight` pair facts at (character, NPC). Writes: nothing new (the dialogue `fact.assign` already writes pair facts). Events, jobs, save rows: none new. Reused: G8 `member`, `travel` and `allyOf`, W2 pair facts, dialogue choices, `KERNEL_API_RANGE_INVALID`. New: two optional `world.group` fields, a fact parameter on `member`, the 1.73 floor; no foundation change.

## Hireling wages (toolbox row 22b)

[Toolbox row 22](../MECHANICS-TOOLBOX.md#ranked-toolbox)'s sampler line: "daily wage settles once; unpaid guard leaves". Row 22b adds the hire fee and the recurring wage that [hireling orders](#hireling-orders-toolbox-row-22a) deferred. [Declarations](cartridge.md#group-declarations) govern it; the PM brief is in Beads `loka-kgd.118` (2026-10-12). The cartridge owns every number (fee, wage, interval; [owner decision](../decisions/owner-decision-world-parameters-2026-10-02.md)). Loyalty stays an authored [W2](#entity-and-pair-facts-toolbox-row-w2) pair fact; the engine stores none.

- **Hire fee.** A hire choice may declare `lesson_payment {to, resource, amount}`, the existing player-to-speaker payment (`choicePayment`, `kernel/ts/src/mechanics/dialogue/payment.ts`), without a `skill.acquire` step. A player who cannot pay is refused `insufficient_resource` before any write, so a broke player is not hired.
- **Declaration.** `world.group` may declare `wage {resource, amount, every}`: `resource` a conserved resource (gain 0, no regen: what `transfer` accepts), `amount` and `every` integers of at least 1, `every` in clock units.
- **Job.** A cartridge with `wage` gets one pending `job {kind: "wage", key: "group"}`, first due at the world's start clock plus `every`, seeded after the replenish jobs (`firstJobs`, `kernel/ts/src/mechanics/schedule/behavior.ts`), so a cartridge without `wage` mints the same ids as before. Wages run whether or not anyone is a member.
- **Run.** schedule@1's `run_job` (`runWage`, `kernel/ts/src/mechanics/escort/job.ts`) walks, in EntityId order, every living NPC whose member fact is true for (NPC, character). It pays each `amount` from the player's body to the NPC against a running balance, one `resource.adjust` per side threaded through the decision's levels (two `transfer` calls from one purse would both write the same `from`): the paid members are the longest EntityId-order prefix the balance covers (player value less `amount` stays at least its minimum, and the NPC's row takes `amount` without passing its maximum). Payment is all or nothing per member. Every living member not paid has its member fact assigned false at (character, NPC); its `stay` and `fight` facts and its room are untouched, so a re-hire restores its old orders. A dead member is skipped, neither paid nor dismissed. The run completes the job and schedules the next at its own time plus `every`, a fixed grid; a next due time the same advance also crosses runs as its own drain step (`next`, as [replenish](#replenish-toolbox-row-19b)'s), so each due settles exactly once however an absence is chunked.
- **Host.** Unchanged: the elapsed host stops at every pending job but the calendar job (`boundary`, `mobile/authority/local-story/elapsed.ts`). The member's `fact_changed` is the host's, as for any job's `fact.assign`.
- **Silent.** No narration, no notice and no new event: the player sees coins drop and the hireling stop following.
- **Known limits.** No notice when a hireling leaves. The grid is the world's, not the hire's: a hire just before a due pays a full wage at once. One wage for every member. A hireable NPC without a row for the wage resource can never be paid and leaves at its first wage (no loader check: the loader cannot know who is hireable). The balance ledger reports the wage under `coins.unclassified`. A cartridge whose shop currency is also the wage resource would fail the mobile shop-receipt reconciliation on reopen (`commerceSave`, `mobile/authority/local-story/commerce-save.ts`, knows no job payment); no cartridge does yet.
- **Fresh row.** A world starting at clock 0 still births the player body's row of the wage resource at its start (`started`, `kernel/ts/src/runtime/fresh.ts`, beside the service and transport currencies), since `transfer` and the wage need a real row; the hireling's row is its authored `resource_starts`.
- **Opt-in.** `world.group.wage`, or a `lesson_payment` without `skill.acquire`, needs `kernel_api` 1.75 (KERNEL_API_RANGE_INVALID at `requires.kernel_api.at_least`) in both kernels. A cartridge without them keeps its bytes, hash, ids, receipts and GameView; Chapter 1 declares none.
- **Book.** No new element and no line.
- **Traps.** [Trap 1](../MECHANICS-TOOLBOX.md#traps) holds: due times are on the logical clock. One new job kind; no new save section, op or event.
- **Sampler.** `cartridges/hireling_sampler` gains `coins` (minimum 0, maximum 100, start 10, gain 0), Hal's `coins` row at 0, a hire fee of 3 coins to Hal and `wage {coins, 3, 86400}`. Hired, the player holds 7 and Hal 3; a player with 2 coins is refused. A day later 4 and 6; two days 1 and 9; at the third day 1 cannot pay 3: Hal is no longer hired and stays in the yard when the player walks north, and a fourth day changes nothing. One delivery straight to two days pays exactly two wages. Never hired, two days change nothing and the job is still pending. With two hirelings and 4 coins at a due, the lower EntityId is paid and the other leaves. A dead hireling is skipped and stays hired (`kernel/ts/test/hireling.test.ts`).
- **Composition record.** Consumer: `hireling_sampler`; later W2 loyalty content and the F-series balance tools. Reads: `world.group.{member, wage}`, the member pair facts, the resource rows of the body and the members, life. Writes: `resource.adjust` (player, members), `fact.assign` member false, `job.complete`, `job.schedule` (existing ops). Events and save rows: none new beyond the job row. Reused: G8 and 22a `member`, B3 conserved rows and `adjust`, replenish's fixed grid and `next`, dialogue `lesson_payment`, elapsed delivery. New: the `wage` object, the `wage` job kind, `firstWage` and `runWage`, the relaxed lesson rule and the 1.75 floor; no foundation change.

## Sleep (toolbox row W9)

[Toolbox row W9](../MECHANICS-TOOLBOX.md#ranked-toolbox): sleep vulnerability and dream hooks; its sampler: "sleeping in the fen takes double damage and wakes; after the hound kill the player dreams of hounds". The PM brief is in Beads `loka-kgd.119` (2026-10-12). It builds on [position@1](#position1-kerneltssrcrulespositionts); the double damage and the wake are [combat@1](#combat1--first-live-encounter-m6-a)'s (`world.combat.sleep_multiplier`), unchanged.

- **Cannot act.** While the actor's position is `sleeping`, the final [ActionSet](protocol.md#actionset-and-admission) keeps only the position verbs (every change between positions stays legal; Sleep again is the rule's `invalid_state`), look, wait and move (which [movement@1](#movement1-kerneltssrcmechanicsmovementrulets) refuses short of standing, water's captured free Up aside), plus the modal answers (dialogue `choose` and `close_choice`, a scene's `continue`), beside status reader 4's allow lists (`permits`, `kernel/ts/src/mechanics/status/permits.ts`, read by the ActionSet and the refusal). Every other command a sleeper sends is `invalid_state`, as in a fight. In an open encounter both filters apply, so a sleeper is offered Stand and Look only.
- **Never skips time.** Sleep advances no clock: only Wait and elapsed delivery pass time, as before. Recovery at the sleeping rate is [W1](#position1-kerneltssrcrulespositionts)'s, unchanged.
- **Provokes.** An accepted Sleep runs [G11](#standing-and-disposition-toolbox-rows-15-and-g11)'s entry engagement (`engage`, `kernel/ts/src/mechanics/disposition.ts`) on the sleeper's room in the same proposal: the first living, unengaged, hostile NPC with an `attack` and an `engage` line opens the encounter exactly as walking in does (first round at now + the interval, no draw, its engage line narrated; never in a sanctuary or a scene). Its ops share the position change's one writer group. Rest and Sit do not provoke. The first round then reaches the sleeper through the existing nonstanding skip, the multiplier and the wake. This is the PM's provisional answer to an owner question (Beads `loka-kgd.119`): it is one call in `kernel/ts/src/mechanics/position/rule.ts`, named by one test.
- **Dream.** None new. Sleep emits no `rested`, so a Rest-anchored [B9](#s10-lantern-rest-and-dream-b9-selected-contract) Dream (Ashmere's inn dream) never starts on Sleep. A dream earned elsewhere is an authored `rested` reaction that applies a permanent [status](#status-effects-over-time-toolbox-row-1) whose applied line is the dream.
- **Known limits.** An NPC that walks in on a sleeper does not engage (G11's limit; aggression is C4's). NPCs have no sleep state (row 29b). A `presentation_only` Dream needs a paid-bed entitlement (a service's benefit, `lib/loka/content/dreams.ex`, B9), so a dream earned by a kill is authored as a `rested` reaction applying a permanent status (its applied line the dream, its label a lasting condition), not a Dream scene; a reaction's `quest.activate` compiles only under `quest_resolved` ([Cartridge](cartridge.md)). `meditating` is LATER.
- **Opt-in.** No field and no floor: the rules apply to every cartridge locking position (pre-production). Chapter 1 declares no engage NPC, so a Sleep there provokes nothing. Installed kernel 1.76.
- **Book.** No new element and no [Book UI](book-ui.md) change: while asleep the page offers fewer verbs, from the ActionSet.
- **Traps.** None applies: no new job, event or save row; the sampler's status is authored content.
- **Sampler.** `cartridges/sleep_sampler`: the fen (start) and a camp east. It locks `description_variant`, the capability that offers Look. The player has 10 HP (no regen) and strikes for a sure 1; `world.combat` interval 150, `sleep_multiplier` 2. A hound in the fen has 2 HP (no regen), strikes for a sure 1 and is always hostile with an engage line; its death sets `hound_slain`. Sleep in the fen opens the fight at once and leaves the clock; the sleeper is offered Stand and Look, and Flee is `invalid_state`. Round 1 (player first) skips the sleeper without a draw, and the hound hits for 2: 8 HP, awake. Round 2: 7 HP, hound 1; round 3: the hound dies, `hound_slain`. A Rest in the fen then sets `dreamt_of_hounds` and applies the permanent status `hound_dream`, whose applied line is the dream; a second Rest does nothing more. Rest or Sit beside the living hound opens no fight. Asleep without a fight the page offers Look, the position verbs and Move, and Take the stone and Move are `invalid_state`; standing, Take is accepted (`kernel/ts/test/sleep.test.ts`).
- **Composition record.** Consumer: `sleep_sampler`; later ambush and aggression rows. Reads: the position fact, G11's disposition and engage line, the open encounter. Writes: the position `fact.assign` (existing) and the encounter ops G11's `opened` writes; events, jobs and save rows: none new. Reused: position@1, G11 `engage`, combat@1 rounds with `sleep_multiplier` and the wake, the authored `rested` reaction and a permanent status, combat's focused mode. New: one sleeper allow list in `permits` and one `engage` call; no foundation change.

## Decay (toolbox row 41)

[Toolbox row 41](../MECHANICS-TOOLBOX.md#ranked-toolbox): "a status with expiry on a thing (G3) whose expiry reaction (W1) moves it to the terminal consumed holder"; its sampler: "fish spoils after a day while smoked fish lasts; a corpse and a dropped rag are cleaned up". The PM brief is in Beads `loka-kgd.121` (2026-10-12). No reaction step could move an item, and D4's consumed holder takes only edible items from a body, so the row adds one [reaction@1](#reaction1-kerneltssrcmechanicsreactionts) step whose target is any authored room: a sealed room is a terminal sink, and as a [replenish](#replenish-toolbox-row-19b) reserve it feeds the item back. [Declarations](cartridge.md#status-declarations) govern it.

- **Step.** `item.move {room}` reads the rule's subject (the reaction@1 table: `status_expired`, `status_applied` and `status_ticked` give the status's holder). When the subject is an item whose container is neither `room` nor the consumed holder, the step writes one `entity.transfer` of it from that container (a room, body, NPC or container item) to `room`, in the delivery's writer group (`moveItem`, `kernel/ts/src/mechanics/containment/react.ts`). Any other subject (a body, NPC or room), an item already directly in `room`, or an eaten one takes nothing. No event, no line, no capacity or reach check: the room is an authored sink.
- **Eaten items.** Eat leaves a status row on the item, so its expiry still fires in the consumed holder; the step skips it there, and the item stays eaten.
- **Opt-in.** A cartridge with an `item.move` step needs `kernel_api` 1.77 (KERNEL_API_RANGE_INVALID at `requires.kernel_api.at_least`); its `room` must resolve (UNRESOLVED_REFERENCE at the step's `room`), in both kernels. Installed kernel 1.77. Chapter 1 declares none.
- **Book.** No new element and no line: the item leaves the inventory or the room listing. A status's expired line is said only on the player's own body, so a spoiled fish says nothing.
- **Known limits.** No "spoiled" line (a designer follow-up). Re-acquiring an item re-applies an `item_acquired` status, which refreshes its end, so decay restarts on every pickup. A status that expires while the rule's `when` refuses the move leaves the item where it is with no status; nothing re-arms it. Corpse decay is not in this row: created corpses carry keywords, not tags, so `status.apply` cannot reach them, and `entity_died`'s subject is the victim (follow-up). `item_dropped`'s subject is the dropper's body, so a drop cannot move the dropped item at once; a status on it does. Moving a worn or wielded item is whatever `entity.transfer` does today. Open (PM, `loka-kgd.121`): one advance in which decay and a replenish job both move the same item (a single wait across the spoil and the next restock) faults `conflicting_write`, since the step and the job write its container in different writer groups.
- **Traps.** [Trap 1](../MECHANICS-TOOLBOX.md#traps) holds: the expiry is G3's status job on the logical clock. No new job, event, op or save section.
- **Sampler.** `cartridges/decay_sampler`: the market (entry) and the sealed midden. In the market a fish, a smoked fish (`immune: [spoiling]`) and a rag. `spoiling` lasts 86400 and `rot` 3600 (each ticks for -1 hp, which changes nothing on an item). Taking the fish or the smoked fish applies `spoiling` to it; dropping the rag applies `rot`. `spoil` (`status_expired spoiling`) and `sweep` (`status_expired rot`, `when` the player does not hold the rag) move the subject to the midden; `restock` `{items [fish], from midden, to market, cap 1, count 1, every 5000}`. Taken at C0, the fish is held at C0 + 86399 and in the midden at C0 + 86400; still there at C0 + 89999 and back in the market at C0 + 90000. The smoked fish is held with no status at C0 + 172800. The dropped rag lies in the market at C0 + 3599 and is in the midden at C0 + 3600; taken back at C0 + 1800 it is still held at C0 + 3600 (`kernel/ts/test/decay.test.ts`).
- **Composition record.** Consumer: `decay_sampler`; later perishable food (C3-M04), dropped-item cleanup in chapters, the corpse decay follow-up. Reads: the reaction subject, the item's container, the consumed holder. Writes: `entity.transfer` (existing op). Events, jobs and save rows: none new. Reused: G3 statuses on things (duration, expiry, immune), W1 reactions (`item_acquired`, `item_dropped`, `status_expired`, `when`), 19b replenish from a sealed room, the containment transfer op shape. New: the `item.move` step, `moveItem` and the 1.77 floor; no foundation change.
