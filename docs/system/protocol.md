# Protocol: contracts, the decision loop, GameView

## Contracts

`protocol/*.schema.json` is a closed JSON Schema 2020-12 subset (`lib/loka/core/contracts/schema.ex:2`);
anything outside it fails compilation and generation. Nullable scalar unions and the exact
object-or-null union needed by escort's full prior-row precondition are supported
for explicit absent custody and unknown death attribution (M5-B). Both kernels validate values against the
flattened contracts with the same paths and error codes (`lib/loka/core/contracts.ex:69`,
`kernel/ts/src/foundation/validate.ts:51`; codes in `protocol/error_registry.json`). The
`exactlyOneRequired` object keyword names declared properties and requires exactly one to be
present. The scene `on` contract uses it for `story_point` versus `quest`, retaining the
existing story-point shape without a new discriminator. Failure reports `exclusive_properties`
at the containing object path in both validators.
Every contract's
`examples` must validate and `protocol/fixtures/invalid.json` must fail with exactly the listed
errors (`test/loka/core/contracts_test.exs:17`, `:26`). `bin/contracts.exs` generates
`kernel/ts/src/contracts.gen.ts`, [contracts.gen.md](../contracts.gen.md) and
[residency.gen.json](../residency.gen.json) and `--check` compares them. Registries
(`capability_registry.json`, 38 capabilities, all `portable_capability`; `event_registry.json`;
`error_registry.json`; `effect_registry.json`; `feature_registry.json`; `invariants.json`;
`residency.json`) are checked in `test/loka/core/registries_test.exs`: every command, event
and policy op has exactly one owning capability (`:159`).

## Numeric profile (frozen `loka-numeric-v1`)

[numeric-profile.md](../spec/conformance/numeric-profile.md) is the rule text; both kernels
pass `numeric-vectors.json` and `adverse-cases.json` (`test/loka/core/portable_abi_test.exs`,
`kernel/ts/test/portable_abi.test.ts`).

Implementations: canonical JSON and its hash (`kernel/ts/src/foundation/canonical.ts`,
`lib/loka/core/canonical.ex`), checked integers (`foundation/int.ts`, `int.ex`), RNG (`foundation/rng.ts`, `rng.ex`),
IdSource, CommandId and the job CommandId (`foundation/id_source.ts`, `id_source.ex`); a decision mints its
ordinals from one allocator (`kernel/ts/src/runtime/decision.ts:218`).

## The decision loop

The local authority runs this order for every ActionInvocation ([save.md](save.md) has the
storage half):

1. **Identify** (`kernel/ts/src/commands/invocation.ts:31`): validate the bounded ActionInvocation
   (malformed is `invalid`), the actor must be the host's trusted actor (`unauthorized`), derive
   the CommandId from the trusted scope and `invocation_id`, and digest the intent:
   SHA-256 of canonical `["loka-intent-v1", action_key, actor_id, target_ids, input]` (`:51`;
   pinned by `protocol/fixtures/intent_digest.json`). Neither failure gets a receipt.
2. **Receipt lookup**: a known `(scope, invocation_id)` replays its stored outcome; an altered
   intent is a conflict ([save.md](save.md#receipts)).
3. **Freshness**: a NEW invocation with a stale `view:` token is `stale_view`, no receipt
   ([save.md](save.md#replies)).
4. **Resolve** (`commands/invocation.ts:75`): the action key must be in the actor's current ActionSet,
   else `unsupported_capability`; its `target_ids` fill the Command's slots in order (`:57`:
   look/talk/perform one `target_id`; take/drop one `item_id`; give `item_id`, `recipient_id`);
   a recipe fills its key, a quest offer its quest, `close_choice` the pending continuation; the
   result must validate as a Command.
5. **Step** (`kernel/ts/src/runtime/world.ts:79`): the capability owning the command type
   (`CAPABILITY_OWNERS.command`) must be in the cartridge lock and have a rule, else
   `unsupported_capability`. Admission (`:106`): the nil CommandId is `permission_denied`
   (`:115`), another world or actor `not_found`, and the ActionSet must offer an action that
   resolves to this Command and accepts its target and input (`commands/actions.ts:186`:
   `unsupported_capability`; a recipe or quest the cartridge lacks `not_found`; offered but its
   policy fails `invalid_state`). Then the rule decides; `admit` faults `unowned_event` for an
   event the capability (or one it composes, `runtime/decision.ts:179`) does not own
   (`runtime/proposal.ts:285`); a `KernelError` is an `evaluator_error` fault (`runtime/world.ts:101`).
6. **Propose** (`runtime/proposal.ts:137`): the root's ops and events join first; each `fact.assign`
   that changes its fact gets a `fact_changed` at its causal position (`mechanics/fact.ts:108`); each
   event is queued FIFO; a queued `item_acquired` first completes the active quests it earns
   (`kernel/ts/src/mechanics/quest/lifecycle.ts:75`), then each ReactionRule it triggers runs as its own writer group when its
   `when` holds (`mechanics/reaction.ts:25`, `:44`), to quiescence; then, when the root advanced time,
   each due pending job runs as a `run_job` in `(due_time, job_id)` order with its reactions
   (`runtime/proposal.ts:253`). Deliveries, reaction depth and query steps are counted as they go.
7. **Adopt** (`runtime/proposal.ts:42`): a `fact.assign` outside its FactSpec faults
   `precondition_failed`; the whole proposal is checked against the budgets (`:60`); the delta
   composes (`foundation/compose.ts:82`) and the written rows, the RNG and each new continuation's
   `opened_revision` (the revision this commit will take) become the new state. After successful
   speculative apply, before returning accepted, check touched opted player-body resource
   rows against the final player position. A player position assignment also checks every
   opted player pool, including any omitted by the proposal. A missing required row or a
   rate differing from that final position's authored rate faults `precondition_failed`,
   attached to the affected resource target, and retains the prior World. This RPG agreement
   check does not add actor context to portable composition, run on proposal prefixes or
   scan unrelated state rows; time-only proposals need no resource write or agreement scan.
   A fault discards all of it.

A `DecisionResult` is `accepted` (`outcome`, `delta.ops`, `events`, `effects` (always empty
today), `rng`, optional `narration` lines), `rejected` (`error.code`, a gameplay code) or
`fault` (`code`, an evaluation fault: `EVALUATION_FAULTS`, generated from
`protocol/error_registry.json` into `kernel/ts/src/contracts.gen.ts:365`). A rejection or fault changes nothing: not the state, RNG,
clock or costs (invariant `rejection_consumes_nothing`, `kernel/ts/src/runtime/invariants.ts:246`).

## Composition

`compose` (`kernel/ts/src/foundation/compose.ts:82`; twin `lib/loka/core/compose.ex:59`, whose moduledoc
states the base-state shape) applies ops in order to an overlay over the committed state. Each
op has one MutationTarget (`foundation/compose.ts:50`); a second writer group on a target already written
faults `conflicting_write` (`:104`), no last-writer-wins. Ops and preconditions:

| Op | Target | Precondition |
|---|---|---|
| `fact.assign` | fact at scope | current value (or the default) equals `expected` |
| `entity.transfer` | the entity's container | container is `source_id`; no cycle (`containment_cycle`); destination under its capacity (`capacity_exceeded`); runtime item destinations without authored `container: true` have effective capacity zero |
| `quest.activate` | quest instance | new id; no open instance of that quest at that scope |
| `quest.transition` | quest instance | `from` is the state; legal (`:24`): active→objectives_complete/failed/abandoned, objectives_complete→resolved/failed/abandoned, failed/abandoned→active; `resolved` needs an outcome |
| `choice.open` / `resolve` / `close` | continuation | open: new id; resolve: pending, offers `choice_id`, `opened_revision` equals `expected_revision` (`:215`); close: pending |
| `job.schedule` / `job.complete` | job | schedule: new id, `due_time` later than the advance's target (`nonfuture_job`, `:169`); complete: pending and due by the target |
| `time.advance` | clock | `from` is the clock, `to` later |
| `resource.adjust` | resource of an entity | `from` is the current (regenerated) value; `to` within the spec's bounds |
| `cooldown.start` | actor's action | `from` is the stored start; `at` is the clock |
| `barrier.transition` | barrier | `from` is the state; the transition is legal (`:32`; [mechanics](mechanics.md#barrier1-kerneltssrcmechanicsbarrierrulets)) |

A resource's `from` is its regenerated value ([resource@1](mechanics.md#resource1-kerneltssrcmechanicsresourcets));
unset means `start` at time 0 for legacy pools without an explicit entity override (`:87`). Opted recovery requires the row
and metadata validation in [resource@1](mechanics.md#resource1-kerneltssrcmechanicsresourcets).
Optional `resource.adjust.at` is an authoritative due-job settlement time, never a
cartridge recipe/player input. Require committed base clock <= at <= the explicit
advance horizon, with equality at the base clock legal. When present, use that exact
clock for resource precondition, regeneration, override-row validation and written
row timestamp; when omitted all frozen base-clock behavior below remains unchanged.
Same-writer overlays must not move a written row backward in time. M6 rounds stamp
all their losses, wake settlement and death restoration at their actual due time.
Independent composition and precondition twins enforce this additive supplement.

Optional `resource.adjust.next_rate` is legal only for an opted pool and must be a
nonnegative ResourceInt member of its authored position table, including zero. Settle the
old rate against the committed **base clock**, check `from` and bounded `to`, then store
`to`, the base clock, the next rate (or retain the old rate), and the settled remainder
(zero when `to == maximum`). Successive same-writer costs use the row overlay, preserving
metadata. Independent `delta_preconditions_hold` replays these rows and preconditions
without using composition's settlement helper or result as its expected answer. The result is the
written rows sorted by canonical target text, which the host commits.

Composition base observations carry optional `entity_resource_specs`, keyed by canonical
resource MutationTarget. An exact override takes precedence over `resource_specs`, requires
its valid stored row, and uses the same row overlay for successive writes. The map is
immutable pinned definition data, preserved through proposal/adoption, not state or a new
hash field. Absent/empty maps preserve legacy results and hashes. Independent precondition
checkers resolve this precedence independently of composition.

**State** (`kernel/ts/src/runtime/decision.ts:47`): `clock`, `containers` (entity → container),
`rng`, and the sections written so far, each keyed by canonical target text or id: `facts`,
`resources` (`{value, at}` for legacy, `{value, at, rate, remainder}` for opted recovery), `cooldowns`, `barriers`, `quests` (`{quest, scope, state,
outcome?}`), `jobs` (`{job, due_time, status}`), `choices` (the `choice.open` fields plus
`status`, `opened_revision`, `choice_id?`). An unwritten section is absent, so a world that
never writes one keeps its state hash.

## Budgets

The eleven composition-profile limits and their values are `LIMITS`
(`kernel/ts/src/contracts.gen.ts:366`, generated from `protocol/`). One aggregate budget spans admission, the rule and the whole proposal; the first exhausted limit in
that order names the fault (`foundation/compose.ts:119`, `:130`), returned beside the decision and
observed as `evaluation.budget_exceeded`, never in the result (`runtime/proposal.ts:26`). Every policy
leaf evaluated adds one query step (`mechanics/policy.ts:32`).

Carrying admission shares the decision's existing query counter
([containment@1](mechanics.md#containment1-kerneltssrcmechanicscontainmentrulets)). A carrying
budget failure remains an evaluation fault, distinct from gameplay refusal `too_heavy` and
item-count fault `capacity_exceeded`. Malformed relevant item mass faults
`precondition_failed`, rather than silently becoming zero or a balancing refusal.
Custody reach uses that same counter before carrying admission, and reports relevant cycles
as `containment_cycle`. Item-barrier reach uses its decision counter too.

Each `lists()` projection uses one separate carry-local counter/context, with the registered
`query_steps` limit, reused across its item offers. This is a narrow carrying budget, not an
aggregate GameView budget. Exhaustion marks a Take needing further carrying inspection
unavailable with `budget_exceeded`, including an as-yet unestablished neutral acquisition; other lists remain.
Cached, genuinely established owned-child or zero-subtree admission remains legal after later
exhaustion. Neutrality is checked before current load, but uncached custody/node reads remain
charged. No second counter or unmetered scan establishes neutrality, and an unknown load never
becomes zero or `too_heavy`.
Take's reach prerequisite shares this projection counter; it cannot hang before carrying is evaluated.
Boolean reach results are cached per item within the same projection, preserving established reach
after later exhaustion without establishing an unknown result.

Put pair projection shares that projection counter. Charge destination enumeration and each
pair inspection before work against `query_steps` (32768). If enumeration cannot finish,
show the source Put unavailable with `budget_exceeded`, never a partial set of destinations.
Admission independently revalidates its pair under the decision counter.

## Invariants

`protocol/invariants.json` registers 18 invariants, each with a spec citation that must be a
real heading (`test/loka/core/registries_test.exs:196`) and the kernels that implement it.
Pure checks by id: `kernel/ts/src/runtime/invariants.ts:149` (all), `lib/loka/core/invariants.ex:34`
(the `elixir_and_typescript` ones), plus world-level checks beside the rules (`runtime/world.ts:141`).
The fixtures hold a holding and a violated case per shared invariant
(`test/loka/core/compose_test.exs:189`); the simulator checks the rest
([architecture.md](architecture.md#hosts)).

## Events

A `DomainEvent` (`kernel/ts/src/runtime/decision.ts:227`) has an IdSource id, the world, player scope,
the actor, the world's logical time, a one-based causal `position`, and the command as
`causation_id` and `correlation_id`. A job's `entity_entered_room` is at instance scope and the
job's due time, caused by the `run_job` (`mechanics/schedule/behavior.ts:58`); the proposal renumbers positions and
correlates everything to the player's command (`runtime/proposal.ts:183`). The modal scene subset
emits `scene_ended {scene}` on the final continue at position 2, leaving position 1
for its line fact's fact_changed; start is the fact's 0→1 change, with no scene_started
([scene@1](mechanics.md#scene1-mechanicsscenerulets)).
API1.12 permits that start to be caused by an evidenced actor-owned
`quest_resolved {quest, outcome}`. A bell Ring emits no `story_point_reached`;
its fact-change reactions emit Q3's typed resolution and, for the eligible
bell-first case, a typed Q2 failure transition without a new event.

## ActionSet and admission

An actor's actions (`kernel/ts/src/commands/actions.ts:154`) are, in order: the engine verbs of the
capabilities the lock holds (`VERBS`, `:86`: look, move, scan, take, drop, give, wait, open,
close, lock, unlock, wear, remove, stand, sit, rest, sleep, each with its target kind and input; policy always true), then the
cartridge's actions, recipes, the offers of quests that have one and the actor has no instance
of, and the talks of dialogues whose speaker is in the room (one per dialogue) (`override`: a cartridge may redefine a verb), then
the room's contributions by ADR-016's operations (union, override, replace, subtract,
intersect; `:59`), then the answers to a pending choice (`choose`, `close_choice`), which no
ordinary contribution removes; the combat restriction below takes precedence. A recipe's
admission adds `cooldown` and `insufficient_resource`
([action_recipe@1](mechanics.md#action_recipe1-mechanicsaction_reciperulets49)).
The door verbs (`open`, `close`, `lock`, `unlock`) stay in the set and admission is unchanged;
the GameView lists them only on the exits they act on and on the items with a barrier
(containers, c1-locks), never with the place's actions. On an item each is advertised with the
item's scope as its entity target and no input, so a client invokes it with `target_ids`
`[item]` and resolve fills `target_id` (`kernel/ts/src/commands/invocation.ts` `TARGETS`).
`wear` and `remove` (equipment@1) take an `inventory` item target in the set (an engine verb's
rule checks its own target); for a cartridge action resolving to `remove`, the `inventory` scope
also holds an item worn in the body's slot holders (`kernel/ts/src/commands/actions.ts:240`). The GameView lists `wear` on a held
item and `remove` on a worn one only when admission and equipment@1's check accept it now, all
available, never `drop`, `give` or `wear` on a worn item, and never either with the place's
actions (a targetless one is never accepted: its Command needs `item_id`) (c1-equipment).
`stand`, `sit`, `rest` and `sleep` (position@1) take no target; the GameView lists them with the
place's actions, except every action resolving to the current position's verb (a cartridge
alias included), which step would refuse `invalid_state` (c1-position).

While [scene@1](mechanics.md#scene1-mechanicsscenerulets) runs, this shared resolved set is
replaced by its single `continue` action (none target, empty input), after every
ordinary contribution. Both invocation resolution and direct Command admission
therefore refuse other commands with existing `unsupported_capability`, before
clock or state changes. Continue is never a general engine VERBS entry.

For A3, the new chapter's Continue input binds the drawn scene reference and shown
one-based line. The projected control, invocation resolution, direct Command admission
and scene rule compare that binding with the durable running scene. A fresh id with
stale scene or line refuses without advancing, ending or exporting; exact accepted
invocation replay returns its recorded result first. The implementation advances the
current API and generated schemas together under the
[forward-development decision](../decisions/owner-decision-forward-development-2026-10-05.md);
the resulting API version and wire shape remain unset until implementation.

An open encounter restricts the fully composed ActionSet to actions whose resolved Command
is exactly `flee`, `stand`, `look` or `scan`. This final restriction follows engine, cartridge,
room and pending-choice contributions; a key or alias cannot change the allowed command set.
Recipes (`perform`), repeated Attack, Move, dialogue/choices, inventory/equipment/door actions,
Wait and nonstanding position changes are unavailable. Projection, invocation resolution and
direct Command admission use this same restricted set. Excluded invocation keys use the
existing `unsupported_capability` result; a known direct Command excluded during combat
refuses `invalid_state`, before RNG, time or state changes. Encounter closure immediately
restores the ordinarily composed set, including on save reopen; no second persisted mode exists.

Only the internal Flee candidate search reads the composed set before this restriction, to
check ordinary authored movement policy without exposing a player Move bypass. Its existing
movement gates, standing and fare checks still apply. Pending choice projection is suppressed
while the encounter is open and is derived again when it closes. See the
[focused combat action decision](../decisions/owner-decision-m6-a-combat-actions-2026-10-04.md).

Put uses ActionInvocation `action_key: "put"`, `target_ids: [item_id, container_id]`, `input: {}`.
The installed engine offers Put on valid item containers, sources its first target from inventory,
and independently validates both targets.

## Policy

`holds` (`kernel/ts/src/mechanics/policy.ts:18`) evaluates `all`, `any`, `not` and the leaves
`fact_compare` (the fact's value at the actor's scope equals), `has_item` (inside the actor's
body, directly or nested), `barrier_state`, `quest_state` (false while the actor has no
instance), `time_window` (hour of day from the validated cartridge calendar, wrapping windows allowed),
`target_present` (the action's target is in reach, `:47`), and `stat_compare` and
`resource_compare` (`:60`, [attributes@1](mechanics.md#attributes1)). An op outside this list throws:
the loader closes the set (`content/cartridge.ts:160`).

## Target resolution

Before any Command exists, the host resolves the player's words (`kernel/ts/src/commands/target.ts:37`):
lowercase, split, a leading `at` and article dropped (`:20`), joined by `_`, matched exactly
against the aliases of the room's details and the keywords of items and NPCs in the room or
held by the body; none, unique, or ambiguous with candidate ids in ascending code-point order
(invariant `target_candidates_ordered`); over 1024 candidates it throws (`:50`). A barrier is
named by its keywords through `doors` (`:72`). A Command carries only ids, never words.

## GameView

EntityView and ContentView have optional `description: TextKey` on the wire, retaining
`loka-gameview-v1` and accepting older snapshots without it. Current NPC/item projection
always copies the required authored entity definition's `description` directly, including
room, held, worn and reachable-container paths. It never infers a key from the short name,
uses a room line or selects a room-line variant as full body prose. Presenters localize
that explicit key; an older view without it has no invented description. This changes no
adjacent-sight projection, rule, content artifact or saved state
([PM adoption](../decisions/pm-decision-description-projection-2026-10-03.md)).

`gameView` (`kernel/ts/src/view/view.ts:49`) projects, for the player: `actor_id`; `place` (room
id, title, the description variant whose condition holds, `mechanics/description_variant/rule.ts:26`);
`exits` in compass order, first checking Move against the actor's composed ActionSet with
the exit's direction: `unsupported_capability` when no matching action remains (including
while a modal scene runs), or `invalid_state` when every matching action's policy fails;
then `exit_closed`, `exit_locked` (a closed or locked
barrier), `invalid_state` (position@1: the actor is not standing; after the barrier, before the
fare) or `insufficient_resource` (the body cannot pay a move); an exit through a barrier
carries `door` (the barrier's short name, its state and the door verbs the actor may use on it
now: those admission and barrier@1's check accept, all available), also when passable; an exit
whose barrier does not bar the way carries `sight` (the destination room id and title and the
NPCs and items directly in it, in the order of `entities`), also when the move is unaffordable
(04 §15 as amended by c1-doors); `actions` of the place, without the door verbs, `wear` or `remove`,
nor the current position's verb; `position`, the actor's position, present exactly when the
cartridge locks `position@1` (04 §15 as amended by c1-position);
`entities` in the room and `inventory` of the body, each with its short name, explicit
full-description TextKey, kind and the
actions it accepts (NPCs first, then DefinitionRefString order). An offered action resolving
to Take, including an alias and reachable contents, uses the same carrying predicate as the
rule after its existing policy/reach checks: `too_heavy` is advertised unavailable with that
reason. `gameview_agrees_with_admission` checks that carrying refusal against the view,
using the supplied action identity and resolved Take command for an alias; a budget fault is
not a gameplay refusal. An item with a barrier also
carries its `state` and the container verbs admission and barrier@1's check accept now, all
available; an item without a barrier or with an open one carries `contents` when it holds an
item: every item inside it in reach (containment@1 custody: no closed or locked lid on the way),
at any depth, flattened in DefinitionRefString order, each with its `container_id` (its direct
container), its `state` if it has a barrier, and as actions only `take` and its container verbs
(a `ContentView`, also with its explicit full-description TextKey; a recursive view is not
allowed in the schemas). An NPC's possessions and a
worn item's contents are never shown (c1-locks); `equipment`, one entry per slot
holder in slot-key order with its `slot` and, when one is worn, the `item` with the actions it
accepts (only those resolving to `remove`), absent when the world has no holder
([equipment@1](mechanics.md#equipment1-kerneltssrcmechanicsequipmentrulets)); `journal` (each quest the player
has an instance of, with state and title, and optional `journal`, the selected TextKey
from [quest@1](mechanics.md#quest1-mechanicsquestrulets-kerneltssrcmechanicsquestlifecyclets)); `chapter` (`{index, title}`, a non-negative declaration index and TextKey), present exactly
when the cartridge declares chapters, selected by [Chapters](mechanics.md#chapters-kerneltssrcviewviewts);
`scene` (`{scene, line, index, count}`, DefinitionRef, TextKey, one-based shown line and
narrate count), present exactly while [scene@1](mechanics.md#scene1-mechanicsscenerulets) runs;
`time` (the logical clock); the pending `choice`
(prompt, speaker id, closable, each option available or blocked, `kernel/ts/src/mechanics/dialogue/shared.ts:80`); and
`resources`, each with current, maximum, a condition band key and its tone (`normal`, `warning`
or `danger`, which the presenter maps to a colour) from the table in effect: the pool's own
`bands` (resources.json), else the cartridge's `world.bands` (cartridge.json), else the engine
default of 11 bands by percentage of the range, `perfect_health` at 100 down to `dying` at 0,
tones `normal` from 80, `warning` from 40, `danger` below (`kernel/ts/src/view/view.ts:216`, `:235`). The band is the
first row whose cut p reaches, in integers: 100 × (current − minimum) ≥ cut × (maximum −
minimum); maximum = minimum gives the top row (04 §15 as amended 2026-10-02).
Actions are listed highest priority first, then by key, available or with the refusal code
(`kernel/ts/src/view/action_lists.ts:33`). Invariant `gameview_agrees_with_admission` holds this for exits and
recipes (including standalone and board-child Notice actions), and for the door and container verbs and `wear`/`remove`, matched by the Command each
listed action resolves to (a cartridge alias included): one listed on its exit or item (a nested
one in `contents` included) is never refused with a code the view predicts (`not_present`
among them), one not listed is never accepted, and none of `wear`/`remove` is a place action; a
position invocation (`stand`, `sit`, `rest`, `sleep`) checks its selected `action_key` when
the observation supplies it: an available matching place action is never refused
`invalid_state`, and an unavailable or absent one is never accepted. Without an action key,
any available place action resolving to that command qualifies. An available exit's move is
never refused `invalid_state` or `unsupported_capability`; a
`take` listed on an item is never refused `not_present` (`kernel/ts/src/view/invariants_view.ts:29`, `:76`).

Read uses `read {actor_id, target_id}` and ActionInvocation `action_key: "read"`,
`target_ids: [detail_id]`, `input: {}`. Its entity TargetSpec has scope
`inspectable_details`: detail identity does not imply a runtime entity. A current-room
readable is advertised as a place action with its authored label and exact detail ID;
projection respects the composed ActionSet, policy and scene/combat exclusions.
`gameview_agrees_with_admission` requires an accepted Read to match an available place
action's exact target ID and selected action key; an available matching offer cannot
refuse `invalid_target`, `not_present`, `invalid_state` or `unsupported_capability`. Missing
or non-readable targets and remote readable targets follow [readable@1](mechanics.md#readable1-mechanicsreadablerulets).

## Notice-board projection

GameView optionally supplies `notice_boards` only when the current room has boards, and
`notices` for its standalone readable details outside board membership. Each board
has `id`, `title: TextKey`, selected `description: TextKey` and ordered `notices`, each
with `id`, `title: TextKey`, selected `description: TextKey`. Board and notice arrays are
nonempty and bounded to 64. IDs are existing detail target IDs; bodies are never projected.
Standalone notices have the same `id`, `title` and selected `description` shape. Each Notice
optionally has `actions`, existing AdvertisedAction rows: exact-subject recipes for
that readable detail, available or with their actual refusal reason. These recipes are omitted
from World actions; Read remains in its existing exact-target entry channel. The view is
descriptive even when Read is unavailable. Existing exact-target place actions govern Read entry; Notice actions govern detail recipes, including policy, alias and modal restrictions.
Older snapshots without these optional fields keep their meaning and wire tag.

An AdvertisedAction may supply optional concrete `target_ids`; Put supplies its final item/container
pair on a directly held item, with destinations among reachable projected item containers. Ordinary
actions retain implicit targeting. Pair availability shares the containment refusal query.
`item_acquired` names the actual destination holder; depositing into a container does not count
as acquiring an item into the body for an acquisition quest.

## Trusted local elapsed replay

For supported fresh single-header traces containing elapsed, replay binds the semantic durable
save run from the header, requires complete newline-terminated NDJSON, validates every record
run and elapsed payload run before any drawing/execution,
and selects stepElapsed only on the replay entry. Ordinary commands stay on player step;
measured=false grants no authority. Generic traces without elapsed keep independent CLI or
simulator run identity. No clock is sampled. Capped prefixes/nonfresh/fault-rich segment limits
remain; byte-identical replay and derived receipt recovery remain required.
See [save](save.md#durable-elapsed-sessions).

## Durable corpse creation (M5-B)

`entity.create {writer_group, identity}` writes one immutable `entity` target keyed by
`identity.id` into optional State `created`. The identity is an `EntityIdentity` with death
origin `{kind: "death", victim_id, event_id, owner_id}`; owner is the body's CharacterId
for a player corpse and null for an NPC corpse. Shared corpses omit scope/audience.
The pinned `known_entities` observation maps every room, body, authored entity, detail
and slot holder to its kind (the body also has `owner_id`); `corpse_templates` maps
canonical template DefinitionRefs to `player` or `npc`. Neither observation is hashed.
Creation requires a fresh ID across saved and pinned identities, a matching template
and known victim/owner, and a contract-valid identity.

The immediately following op must be `entity.transfer` with that ID, `source_id: null`,
the same writer group and an existing room destination. It writes only containment.
Absent-source transfer is otherwise refused; duplicate creation/placement, an orphan
creation or a mismatched group faults the whole sequence. Ordinary transfers preserve
their existing source, cycle and capacity guards. Independent precondition and
one-container checks require the same creation/placement proof. Numeric-v1 and prior
fixtures stay unchanged; the additive `corpse_creation.json` supplement pins this surface.

Adoption and intermediate proposal reads hydrate created entities from their pinned
templates. Only a changed derived entity map is copied; unrelated state changes
retain it and the existing capacity map. Authored `entityIds` never gains template entries.

## Encounter and round supplements (M6-A)

Combat adds nominal EncounterId and optional State `encounters` keyed by that ID.
EncounterRow is `{character_id, body_id, npc_id, room_id, status, round, job_id}`:
status open/closed; round is a positive integer. `encounter.open` requires an absent ID
and validated distinct participants in a real room, with no other open encounter for
either participant. `encounter.advance` compares the open row's current job and round,
then replaces both with the next occurrence; `encounter.close` compares the current job
and closes the row. These share mutation target `{kind: encounter, encounter_id}`.

A combat `job.schedule` retains the NPC DefinitionRef and adds `encounter_id`; legacy
jobs omit it. `job.cancel {job_id, encounter_id}` requires a pending job bound to that
encounter and makes its status cancelled, even before it is due. Existing job.complete
remains due-only. Encounter rows and job binding are canonical changed rows; omitted
sections retain historical hashes. Both portable composition/precondition twins validate
the supplement against independent fixtures.

The schedule rule dispatches bound combat jobs to a pure round sequence. Before each
due delivery, the proposal re-reads pending status and the encounter's current binding;
stale occurrences produce no ops/events/draws. One proposal-local RNG flows from the
root through every due delivery, every prefix World and the final decision. Faults adopt
none of it. Due-job narration joins the root narration in due/event order and is saved
in the same receipt for the existing subscription/reopen narration path. Direct ownership is schedule→combat/death (and existing movement); the
combat Flee command uses a shared movement sequence and declares combat→movement.

`attack {actor_id, target_id}` and `flee {actor_id}` are complete engine verbs.
`attack_result {encounter_id, attacker_id, target_id, hit, loss}` is instance-scoped and
actor-free when caused by run_job. Loss is nonnegative actual clamped HP loss; miss
requires zero. Event IDs use the existing due command allocator. The credit delivery
uses the original fatal writer group and the proposal's hydrated intermediate World.

### Directionless combat Flee

`flee {actor_id}` accepts no direction field. Exit selection, proposal-local RNG and atomic
movement follow [combat mechanics](mechanics.md#combat1--first-live-encounter-m6-a). The
receipt pins the actual selected destination and final RNG; replay never chooses again.

## Bounded dialogue answers

API1.9 adds optional `answer` to Choose and ActionInput: 1–32 ASCII letters. PendingChoice
optionally projects `riddle {choice_id, bank}` with the ordered 1–32 uppercase letter bank,
never the canonical answer. The ordinary prompt supplies the clue. Projection/admission
share the saved continuation, choice and bound participant availability; malformed input
still fails the command/invocation boundary. Ordinary non-riddle choices retain their shape.


## Authored item Give restriction

API1.10 permits optional item `give_allowed: false` (absence means allowed).
Give projection and direct command admission share the same restriction for the item
and any container that holds it transitively; dialogue
hand_over remains an independently guarded transfer. PendingChoice availability and
Choose both re-evaluate the pinned dialogue policy against current actor state, alongside
bound-role and direct-custody checks. No GameView shape, command or event is added.

## Typed escort relation

API1.11 introduces escort@1's bounded relation branch, actor-keyed mutation target and
preconditioned escort.transition, plus the authored dialogue effect and escort_state
policy leaf described in [mechanics](mechanics.md#escort1). Contracts, compiler and loader
validate typed IDs/references, role/quest agreement, supported transitions and feature
minimum. The portable delta composer in both kernels checks full prior-row equality, legal
status edges and immutable binding. Runtime adoption and changed-row persistence add only
the escorts State section. Choose retains current policy and original-role revalidation.
Move/Flee and death include escort changes in the same root decision; no new command,
transcript, SQLite table, save format or UI mode is added.

## Selected S2 composition (pending implementation)

S2's accepted offer and turn-in use one typed proposal under the
[selected mechanic](mechanics.md#s2-chandlers-debt-selected-contract-pending-implementation).
An occurrence-bound expiry job identifies its actor and quest instance; completion
cancels or invalidates only that job. Due jobs settle before an input at the same
logical time. Exact payment debits and credits the two named resource targets in the
same proposal, with nonnegative, in-range preconditions; saturation is not payment.
The admitted choice and projected availability share current time, bound identity,
presence, custody, carrying and funding checks. Extend schemas and composition twins
only for the actual new operation/row fields, and retain the registered event,
writer-group, budget and deterministic-ID rules. This is a selected source contract,
not an installed operation.

## B3 shop composition

Commerce exposes exact Buy and Sell commands with actor, provider, item and quoted
price; the current ActionSet and NPC GameView projection use the same availability
query as direct admission. The NPC detail shows each eligible exact item with its
price and current availability, including sold-out and unaffordable states. A
displayed offer is never a reservation. The command rechecks the quote, stock,
custody, balances and carrying admission after elapsed-time settlement. Composition
uses existing `entity.transfer` and B2's two exact `resource.adjust` operations in
one writer group; no stock-count or creation operation is needed. The receipt records
one accepted exchange. Existing `query_steps` and failure codes govern each check;
the developer adds only the command, capability, authored offer and view schema
needed for this consumer.

The installed wire shape is `buy`/`sell` with `actor_id`, `provider_id`, `item_id`
and positive `quoted_price`. `ActionInput.quoted_price` carries that displayed quote;
ordered invocation targets are provider then item. API 1.16 adds NPC `shop` with
one conserved `resource`, finite `offers` (`item`, `buy`, `sell`) and `bought`/`sold`
narration keys. Each NPC `EntityView.shop` row carries `item_id`, `name` and its
Buy/Sell price, availability and optional typed refusal reason. Runtime admission
owns the exchange; this projection reserves nothing.

## C1 training and defense composition

**Selected, pending implementation.** [C1](mechanics.md#c1-training-and-armed-defense-selected-contract)
reuses Talk/Choose and the existing final combat ActionSet; there is no standalone
Learn or Dodge invocation, mid-fight equipment verb or new turn clock. The projected
Tobin lesson and direct Choose share the same acquired/payment/receive admission
checks. Qualification is evaluated at use, independently of learning admission.

Dialogue lowers its typed `skill.acquire` consequence through the skills owner to
the reserved acquired fact's ordinary `fact.assign`. Its lesson payment uses the
installed checked conserved resource transfer; the optional sword receive uses the
installed `entity.transfer`. Acquisition, payer debit, teacher credit, custody,
choice resolution, events and narration share writer group0. No acquisition table,
practice field, custom money ledger or portable foundation op is added. Ordinary
fact writers refuse the reserved acquisition target. Content and generated contracts
must describe this actual typed hook and reserved ownership, not a narrative Boolean
assignment that happens to use a skill name.

The shared skills query projects declared skill identity/name, acquired, qualified
and usable state; authored requirements and fees reach Book through typed data/text.
Item detail projects its usable slot/profile or shield chance from current content.
This is the minimum view supplement for Character, teaching and real equipment.
Missing acquisition defaults false; malformed current-build acquisition is a fault.

An `attack_result` may add `prevented_by: dodge | block` only for an attempted attack
stopped by that successful defense, requiring `hit:false` and `loss:0`. An accuracy
miss omits it. A landed hit also omits it. One existing attack-result event and its
authored narration distinguish all three outcomes; there is no duplicate damage
event. Validate this supplement at schema, receipt and view boundaries. Optional
metadata is absent for an ordinary no-defense encounter. Shared budgets, causal
event allocation and death closure use the existing round/proposal contracts.

## B5 harvest and exchange composition

[B5](mechanics.md#s9-infirmary-herbs-b5-selected-contract) needs only a typed
finite-stock harvest invocation and an exact multi-item dialogue exchange plus
explicit resolved-quest reacceptance with fresh occurrence identity. The actual
source consumer may reuse an existing invocation where it expresses this full
contract; do not add an item creation operation. The death-only entity.create
contract remains unchanged.

Admission and projection share the same current-stock, participant, occurrence,
exact-custody, contribution and final-load query under the existing command
budget. Bound multi-item lists are distinct and deterministic by EntityId; their
length comes from the authored exchange. Each transfer has the observed source,
known destination and ordinary preconditions. One writer group owns this bounded
exchange. Lower existing transfer/quest/fact operations where possible; no
post-commit authority or presenter gameplay writer is permitted. Receipts bind
actor, occurrence, Wick, all exact outgoing/incoming IDs and the actual faction
increase. Reacceptance cannot reuse an earlier occurrence ID. A stale continuation
cannot act on the latest occurrence merely because its quest definition matches.
GameView projects remaining harvest availability, exchange readiness, journal
state and authored refusal reasons from confirmed truth, without a stock ledger,
created-item origin, expiry job, daily clock cut or unbounded history collection.

API1.17 lowers explicit repeat to terminal-only `quest.retire` followed by a fresh
`quest.activate` in one writer group. The retire operation names the exact prior
instance, quest and scope; its null change removes only that quest row. An
exchange continuation carries `quest_instance_id` and deterministic outgoing/
incoming item role bindings. Quest-authored `exchange` tuning supplies the shared
readiness and lowering; detail-authored `harvest` supplies conserved stock IDs.

## B4 fuel composition

Planned [B4](mechanics.md#b4-light-and-darkness-selected-contract) adds `light@1`
with `ignite {actor_id, item_id}`, `douse {actor_id, item_id}` and
`refuel {actor_id, item_id, supply_id}`. Invocation targets are source then supply
for Refuel, and source for Ignite/Douse. The amount is derived from confirmed
headroom and supply, never player input. Extend ActionSet and the exact item view
only for these real controls, confirmed remaining/capacity and effective lit state.
An unavailable compatible supply produces no selectable Refuel promise.

The missing primitive is typed per-item fuel history: state rows and
`fuel.set {item_id, from, to}` targeting that item's fuel row. `from` is the entire
stored row, not its derived current value; `to` is the settled replacement at the
current authoritative clock. Both rows carry `remaining`, `at`, `lit` as defined
by the mechanic. Composition requires exact prior-row equality, a declared fuel
item, valid bounded charge/time and no lit supply. Conflicting writers retain
`conflicting_write`; precondition failures adopt nothing. The light rule owns
Ignite/Douse/Refuel writes. Time and custody changes need no fuel op.

Add only immutable per-item fuel specifications needed to validate those rows.
Do not encode engine history as untyped cartridge facts or generalize the new op
into arbitrary item-state assignment. Because a new delta target crosses portable
composition, both kernels require independently pinned valid/invalid/precondition
fixtures and differential coverage; the light story rule remains TypeScript-only.
The next API/release pins and exact generated shape are assigned from the actual
implementation base, not assumed by this planning contract. Existing error codes,
writer groups, checked arithmetic and query budgets apply.

## B7 liquid composition

**Selected, pending implementation.** `liquid@1` owns only commands
`fill {actor_id, source_id, vessel_id}`, `pour {actor_id, source_id, receiver_id}`
and `drink {actor_id, vessel_id}`. Fill's source is a detail; Pour's source is an
item. ActionInvocation targets retain that exact ordered pair (or Drink's one
item), with no player-supplied amount, kind or resource benefit. Projection and
admission share current custody, reach, compatibility, capacity and load checks.
Use structured filled/poured/drank outcomes containing bound participant IDs,
kind and actual quantity; no consumer reads success from narration.

The missing primitive is a typed exact-instance liquid row and
`liquid.set {item_id, from, to}` with whole-row equality precondition and one
writer target per item. Quantity is a bounded nonnegative integer; null kind iff
zero; positive kinds and capacity are validated against immutable per-vessel
specifications and declared liquid references. No facts/resources encode an
alternate quantity. Pour includes the two writes in one existing writer group;
any conflict, precondition/invariant or budget failure rolls back both. Emptying
a vessel preserves its item identity. Optional state sections remain absent in
cartridges without the capability; fresh worlds initialize only actual opted
vessels once. No generic create/destroy/mix liquid operation is introduced.

Reuse the existing delta dispatch, target/precondition machinery, immutable
observation validation and writer-group handling. B4's `fuel.set` has a timed
`at/lit` history invariant; liquid kind/volume has no burn clock. Do not remodel
one as the other or add a generic configurable row-operation registry merely
to share these two shapes. Existing resource rows recover/adjust numeric pools,
and containment rows move whole item identities; neither represents liquid
kind plus capacity. Only the new typed variant is justified.

The portable operation/precondition/invariant semantics require both checked
foundation twins, independently hand-checked new fixtures and randomized
comparison after fixture validation. Leave frozen fixtures unchanged. The
player rule and source/custody/issuance semantics stay TypeScript-only until an
actual server consumes them. Compose remains independent of RPG helpers.
The generic row invariant checks shape/capacity, not global water conservation:
Fill introduces water and Drink consumes it. Pour conservation and authorized
issuance/consumption are mechanic and receipt-bound obligations.

Extend GameView only for confirmed vessel kind/quantity/capacity, authored unit
labels and exact legal Fill/Pour/Drink actions; existing details and target
selection remain the UI boundary. No renderer arithmetic creates permission or
adjusts liquid/mass. Shared aggregate query, delta, event and writer budgets stay
in force; pair enumeration is bounded before work, not an unmetered all-item scan.
## C2 patrol composition and admission

**Selected, pending implementation.** [C2 patrol](mechanics.md#s3-finite-watch-patrol-c2-selected-contract)
uses a typed patrol row and full-prior-row transition, keyed to the actor's exact
quest instance, independently of the unchanged escort row. Register its minimal
state/mutation target/transition and invariant under the patrol owner. Preserve
foundation precondition/conflict semantics; any new delta/state composition branch
must have Elixir and TypeScript literal conformance and differential proof. Patrol
RPG admission and credit remain TypeScript story semantics, with no new server adapter.

Start, Continue rounds, Rejoin and Restart are bound dialogue consequences using
ordinary Talk/Choose and choice rows. Projection and direct Choose share current
identity, presence, life, posture, quest, attempt/cursor/status admission. Structured
input binds the quest instance, attempt and cursor/status drawn, as well as ordinary
continuation/choice identity; a fresh invocation id cannot convert an old leg into
the next leg. Normal combat/modal restrictions and Close/Leave remain in force.

Movement owns legal edge transfer and typed entered-room occurrence; patrol owns
leader progression/credit; quest owns S3 activation/resolution; death owns fatal
invalidation before revival; fact owns lowering of reserved trust in the same group.
No raw fact assignment or independently delivered entered-room event can mint credit.
Use actual accepted causal command/event identity, scope, ordering and proposal-prefix
presence. All reads share the command budget; bound the finite route before work.
Continue's leader transfer, player join/progress, pause, fatal reset and final
quest/trust consequence each commit or roll back as one root proposal. Concurrent
Wren follow transfers Wren once and preserves both relations' original identities;
neither relation adds a second player transfer or steals the other's mutation target.
No due-job chain, new player verb, global objective interpreter or per-frame writer
is needed. Declare new typed state/transition bounds and planted invalid fixtures;
update generated contracts and current release pins in the implementation PR.

## B6 bounded sitting and topic composition

Planned [B6](mechanics.md#s4-all-hours-wisp-b6-selected-contract) extends only
attribute-threshold checks, opted bounded riddle continuations and declared topic
projection/grant. Use the existing Perform/Talk/Choose/Close invocations and actor
ActionSet. Shared visibility/light/discovery/quest/participant policies govern
both offered controls and raw-command admission. For the real Aldric consumer,
Talk gains an optional exact dialogue DefinitionRef;
when supplied it must belong to the target speaker and resolve through the actor's
ActionSet with its own eligibility rechecked. Omission keeps first-eligible-key
behavior. This is a bounded selector, not a conversation graph. GameView reveals
bank and committed attempts/limit for an opted sitting, never the canonical answer.
Known topics project as key-sorted `{topic: DefinitionRef, label: TextKey}` entries;
the ward consumer reads the same declared Boolean membership as its admission.

Dialogue owns a typed continuation attempt supplement and `choice.attempt` operation:
bind continuation ID, actor, opening revision and exact prior count; increment by
one only for a pending bounded sitting, within its pinned authored limit. Conflicts,
wrong ownership and out-of-range rows fail closed. At the limit, increment and
ordinary choice close share one writer group; no intervening count-at-limit pending
world is adopted. This supplement is choice state, not a free-standing player fact,
quest occurrence, general puzzle state machine or a second receipt ledger.
Existing no-limit continuation semantics remain unchanged.

The portable delta/precondition/invariant additions receive independently authored
Elixir and TypeScript conformance answers and randomized differential proof, including
increment-plus-close and writer conflicts. Check/perception/topic gameplay stays
TypeScript-first. `topic.grant` is typed cartridge consequence lowering to the
existing Boolean fact assignment, with no new portable topic operation or writer.
Definition/participant/quest binding, causal ordering, query budgets and authority
commit/adopt/response ordering retain their existing contracts.

## B8 immediate service composition

**Selected, pending implementation.** A service invocation binds actor, exact
provider EntityId, declared service DefinitionRef and displayed positive quoted
price. The selected command is `use_service {actor_id, provider_id, service,
quoted_price}`, with `service` the authored DefinitionRef and accepted outcome
`service_used`. Invocation targets contain the provider; captured input supplies
service and quote. Add only the minimal `service@1` command/action/offer projection needed
for the [real consumer](mechanics.md#b8-mauds-immediate-services-selected-contract).
The projected NPC service row includes label, price, declared capped benefit and
current availability/reason; admission reuses its query after due/elapsed work.
A displayed offer is no reservation and a stale service never substitutes another.

Service lowering uses existing exact two-party `resource.adjust` payment,
`fact.assign` room entitlement, exact stock `resource.adjust`, settled capped MV
`resource.adjust`, and B7 whole-row-precondition `liquid.set`. All share one
writer group; any failed precondition/conflict/budget discards the entire service.
Provider-bound liquid consumption is an explicit typed service consequence with
historical provider custody/kind/quantity checks, distinct from actor-owned
Drink. Extend B7's verifier to recognize this producer, rather than spoof a
Drink command or add a second liquid mutation. No new portable operation,
service state row, item creation, clock advance, queue/escrow or automatic job
is needed. No new service DomainEvent is required: existing fact/resource/liquid
consequences and the bound receipt command prove the result. Register the actual
command/outcome ownership and invariants; do not invent receipt fields. The receipt command identifies its
original provider/service for confirmed narration routing and save validation.
