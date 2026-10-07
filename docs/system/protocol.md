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
The `requiredUnless` object keyword maps one or more declared alternative properties to the same
list of required properties. Presence of any alternative waives that list; when none is present,
each missing listed property reports `missing_property`. This retains the combat encounter ID
requirement while allowing sight-member and water-generation cancellation.
The standard `dependentRequired` object keyword requires the declared companion properties
whenever its key is present. C5 uses it in both directions for a bleed body/generation pair;
an orphan generation cannot hide inside another cancellation binding. Missing companions
report `missing_property` at their property paths in both kernels.

Every contract's
`examples` must validate and `protocol/fixtures/invalid.json` must fail with exactly the listed
errors (`test/loka/core/contracts_test.exs:17`, `:26`). `bin/contracts.exs` generates
`kernel/ts/src/contracts.gen.ts`, [contracts.gen.md](../contracts.gen.md) and
[residency.gen.json](../residency.gen.json) and `--check` compares them. Registries
([`capability_registry.json`](../../protocol/capability_registry.json), all `portable_capability`; `event_registry.json`;
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
5. **Step** (`kernel/ts/src/runtime/world.ts:79`): the [D11 pre-choice gate](mechanics.md#d11-character-choice-selected-contract)
   refuses ordinary player commands as `invalid_state` before ActionSet matching. Otherwise,
   the capability owning the command type
   (`CAPABILITY_OWNERS.command`) must be in the cartridge lock and have a rule, else
   `unsupported_capability`. Admission (`:106`): the nil CommandId is `permission_denied`
   (`:115`), another world or actor `not_found`, and the ActionSet must offer an action that
   resolves to this Command and accepts its target and input (`commands/actions.ts:186`:
   `unsupported_capability`; a recipe or quest the cartridge lacks `not_found`; offered but its
   policy fails `invalid_state`). Then the rule decides; `admit` faults `unowned_event` for an
   event the capability (or one it composes, `runtime/decision.ts:179`) does not own
   (`runtime/proposal_admit.ts:13`); a `KernelError` is an `evaluator_error` fault (`runtime/world.ts:101`).
   The headless GameView/admission check classifies service invocation identity before
   comparing the observed player's offer: a nil CommandId agrees only with
   `permission_denied`; otherwise a foreign world or actor agrees only with
   `not_found`. A nonnil current-world, current-actor available service offer
   refused `not_found` remains a mismatch. Other commands retain the foreign-world
   envelope check before comparing their action offer.
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
clock or costs (invariant `rejection_consumes_nothing`, `kernel/ts/src/runtime/invariants.ts:116`).

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
Independent precondition replay uses the effective spec's authored `gain_every` boundaries
for legacy pools, retaining the hour boundary only when that field is absent.
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

`protocol/invariants.json` registers the active invariants, each with a spec citation that must be a
real heading (`test/loka/core/registries_test.exs:196`) and the kernels that implement it.
Pure checks by id: `kernel/ts/src/runtime/invariants.ts:34` (all), `lib/loka/core/invariants.ex:34`
(the `elixir_and_typescript` ones), plus world-level checks beside the rules (`runtime/world.ts:141`).
The fixtures hold a holding and a violated case per shared invariant
(`test/loka/core/compose_test.exs:189`); the simulator checks the rest
([architecture.md](architecture.md#hosts)).
The simulator checks registered portable delta invariants, including
`patrol_transitions_hold`, per step even when a frozen demo has no operation of that
family. This does not expand its demo corpus or change generated seed sequences;
the dedicated chapter/literal fixtures prove the family's real transitions.

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
is exactly `flee`, `stand`, `look` or `scan`, with the sole later C5 `bandage`
exception under its [exact-item/current-effect admission](#c5-bleed-and-bandage-composition).
This final restriction follows engine, cartridge, room and pending-choice contributions;
a key or alias cannot change the allowed command set.
Recipes (`perform`), repeated Attack, Move, dialogue/choices, other inventory/equipment/door actions,
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
`resource_compare` (`:60`, [attributes@1](mechanics.md#attributes1-kerneltssrcmechanicspolicyts60)). An op outside this list throws:
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
the exit's direction: before ancestry selection, each ordinary Move shows `invalid_state`
under the [D11 gate](mechanics.md#d11-character-choice-selected-contract), matching Step;
after selection, `unsupported_capability` when no matching action remains (including
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

<a id="selected-s2-composition-pending-implementation"></a>

## Selected S2 composition

S2's accepted offer and turn-in use one typed proposal under the
[selected mechanic](mechanics.md#s2-chandlers-debt-selected-contract).
An occurrence-bound expiry job identifies its actor and quest instance; completion
cancels or invalidates only that job. Due jobs settle before an input at the same
logical time. Exact payment debits and credits the two named resource targets in the
same proposal, with nonnegative, in-range preconditions; saturation is not payment.
The admitted choice and projected availability share current time, bound identity,
presence, custody, carrying and funding checks. Extend schemas and composition twins
only for the actual new operation/row fields, and retain the registered event,
writer-group, budget and deterministic-ID rules. S2 is installed in the
[current bundled chapter](cartridge.md#current-bundled-chapter).

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

**API1.18.** [C1](mechanics.md#c1-training-and-armed-defense-selected-contract)
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
assignment that happens to use a skill name. `DialogueChoice.sequence` carries
`{op: skill.acquire, skill}` and `lesson_payment` carries `{to, resource, amount}`,
where `to` is the bound original speaker role. `ItemDefinition.weapon` carries
`{skill, attack}`; `block_chance` is the shield's authored chance. The optional
combat `dodge {skill, chance}` identifies its usable defender skill.

The shared skills query projects declared skill identity/name, acquired, qualified
and usable state; authored requirements and fees reach Book through typed data/text.
Item detail projects its usable slot/profile or shield chance from current content.
This is the minimum view supplement for Character, teaching and real equipment.
Missing acquisition defaults false; malformed current-build acquisition is a fault.

An `attack_result` may add `prevented_by: dodge | block` only for an attempted attack
stopped by that successful defense, requiring `hit:false` and `loss:0`. An accuracy
miss omits it. A landed hit also omits it. One existing attack-result event and its
authored narration distinguish all three outcomes; there is no duplicate damage
event. The schema constrains its vocabulary. The existing schema subset cannot express
this cross-field implication, so saved-receipt recovery and committed narration
projection also enforce `hit:false` and `loss:0` when prevention is present. Optional
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

**API1.19.** [B4](mechanics.md#b4-light-and-darkness-selected-contract) adds `light@1`
with `ignite {actor_id, item_id}`, `douse {actor_id, item_id}` and
`refuel {actor_id, item_id, supply_id}`. Invocation targets are source then supply
for Refuel, and source for Ignite/Douse. The amount is derived from confirmed
headroom and supply, never player input. Extend ActionSet and the exact item view
only for these real controls, confirmed remaining/capacity and effective lit state.
An unavailable compatible supply produces no selectable Refuel promise.
Light item controls project optional `AdvertisedAction.command`, the resolved
semantic command key, alongside the authored `action_key` used for invocation.
The presenter uses this authority-supplied command for participant wording and
source ownership; authored aliases retain their own action identity. Light
projection runs keyed ordinary target/input/policy admission on the exact
candidate payload before its pure fuel transition.

The missing primitive is typed per-item fuel history: state rows and
`fuel.set {item_id, from, to}` targeting that item's fuel row. `from` is the entire
stored row, not its derived current value; `to` is the settled replacement at the
current authoritative clock. Both rows carry `remaining`, `at`, `lit` as defined
by the mechanic. Composition requires exact prior-row equality, a declared fuel
item, valid bounded charge/time and no lit supply. Conflicting writers retain
`conflicting_write`; precondition failures adopt nothing. The light rule owns
Ignite/Douse/Refuel writes. Time and custody changes need no fuel op.

Item definitions opt into `fuel`: a supply declares `kind: supply`, positive
`capacity`, bounded nonnegative `initial` and a `unit` key. A source declares
`kind: source` with those fields, positive `rate`, its exact compatible item
`supply` reference and the `ignited`, `doused`, `refueled` narration keys. Runtime
immutable `fuel_specs` bind these specifications to their actual item instances;
mutable `fuel` rows are keyed by item ID. A room's optional `dark_description`
is its authored darkness opt-in. Actual fuel or darkness fields require a
`requires.kernel_api.at_least` floor of 1.19 in both compiler and loader;
an unused reserved light capability does not impose that floor. `FuelView` carries confirmed `remaining`,
`capacity`, and effective `lit` without a presenter clock.

Add only immutable per-item fuel specifications needed to validate those rows.
Do not encode engine history as untyped cartridge facts or generalize the new op
into arbitrary item-state assignment. Because a new delta target crosses portable
composition, both kernels require independently pinned valid/invalid/precondition
fixtures and differential coverage; the light story rule remains TypeScript-only.
The [current chapter identity](cartridge.md#current-bundled-chapter) owns the
installed pin; B4's original C1/B5 predecessor remains dated evidence. Existing error codes,
writer groups, checked arithmetic and query budgets apply.

## B7 liquid composition

`liquid@1` owns only commands
`fill {actor_id, source_id, vessel_id}`, `pour {actor_id, source_id, receiver_id}`
and `drink {actor_id, vessel_id}`. Fill's source is a detail; Pour's source is an
item. ActionInvocation targets retain that exact ordered pair (or Drink's one
item), with no player-supplied amount, kind or resource benefit. Projection and
admission share current custody, reach, compatibility, capacity and load checks.
Use structured filled/poured/drank outcomes containing bound participant IDs,
kind and actual quantity; no consumer reads success from narration.

The concrete metadata is `LiquidDefinition {key, label, unit_label, grams_per_unit,
drink_amount}`, optional `ItemDefinition.vessel {capacity, unit_label, initial}`,
optional detail `liquid_source` and optional `CompiledCartridge.liquids`. Initial
and stored rows use a full liquid DefinitionRef or null. Immutable `liquid_specs`
observations bind each vessel to capacity and declared kinds; `liquid_rows_valid`
checks these specifications in both foundation kernels.

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
comparison after fixture validation. Current-development fixture changes follow the
[forward-development policy](../decisions/owner-decision-forward-development-2026-10-05.md),
with reviewed contract amendments and independent literal answers; retain guards for current behavior. The
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

[C2 patrol](mechanics.md#s3-finite-watch-patrol-c2-selected-contract)
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

C2 typed patrol state and drawn control input require kernel API **1.22**.
The concrete row is `PatrolRelation`, stored in `State.patrols` by QuestInstanceId:
actor/body/NPC, quest instance, activation continuation/choice, accepted command
`attempt_id`, route `cursor`, ordered unique room-ID `credit` and status.
`patrol.transition` targets that quest instance and compares its full prior row.
`QuestDefinition.patrol` owns leader, cyclic route, initial cursor, checkpoint subset,
required count, reserved trust fact and completion narration; its objective evidence
is `patrol`. Bound dialogue choices declare `patrol {quest, npc, transition}`.
Non-start Choose input carries `patrol {quest_instance_id, attempt_id, cursor, status}`
from the drawn PendingChoice. Shared read-only admission checks that exact value
before execution or GameView eligibility. Bounds are at most 64 route occurrences
and checkpoints; the authored count never exceeds its unique subset. The patrol
status, stored row and drawn-input schemas each have a literal valid example.

## B6 bounded sitting and topic composition

[B6](mechanics.md#s4-all-hours-wisp-b6-selected-contract) extends only
attribute-threshold checks, opted bounded riddle continuations and declared topic
projection/grant. Use the existing Perform/Talk/Choose/Close invocations and actor
ActionSet. Shared visibility/light/discovery/quest/participant policies govern
both offered controls and raw-command admission. For the real Aldric consumer,
Talk gains an optional exact dialogue DefinitionRef;
when supplied it must belong to the target speaker and resolve through the actor's
ActionSet with its own eligibility rechecked. An authored dialogue `label` opts
its named Talk control into exact selection and supplies its distinct player label;
unlabelled Talk controls omit the selector and keep first-eligible-key behavior.
A raw Talk without the selector also keeps first-eligible-key behavior. This is a bounded selector, not a conversation graph. GameView reveals
bank and committed attempts/limit for an opted sitting, never the canonical answer.
The marker declares `perception: {self_luminous: true, title: TextKey}`;
the NPC declares `perception: {discovered: DefinitionRef}` to a player Boolean.
The shared visible-target query consumes both metadata forms; Book reuses the
existing detail view for the marker.
Known topics project as key-sorted `{topic: DefinitionRef, label: TextKey}` entries;
the ward consumer reads the same declared Boolean membership as its admission.

Dialogue owns a typed continuation attempt supplement and `choice.attempt` operation:
`choice.open` pins `attempts: {count: 0, limit}` and the active quest occurrence.
`choice.attempt` binds continuation ID, actor, source DefinitionRef, quest occurrence,
opening revision and exact `prior_count`; increment by
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

## C3 spawned bundles and population composition

[C3](mechanics.md#c3-bounded-living-hounds-selected-contract)
requires a checked extension to death-only creation, not permission to trust the
currently schema-only `spawned` origin. Register separately keyed full-prior-row
transitions: target `{kind: population_plan, plan}` contains only current job ID
and next wander due; target `{kind: population_slot, plan, slot}` contains generation,
member ID and replacement due. `plan` is the full pinned DefinitionRef; `slot` is
one ordinal1..declared cap. Genesis creates every slot, including never-used rows.
Plan control duplicates no member list, count, generation or mutable slot index.
The declared fixed ordinal range is the only membership index: projection, dispatch
and load read those exact slot keys and reject absent, extra or foreign keys. Each
transition compares its own complete prior row; no transition rewrites the plan
plus all slots. State cannot be forged through ordinary fact assignment or a
player-accessible population verb.
Story admission remains TypeScript; added state/delta/precondition semantics and
creation validation retain both-kernel literal conformance then differential proof.

Each immutable spawned identity binds declared plan and bundle, slot, generation,
creation occurrence and hound member ID, with role hound or pelt. The hound binds
itself; its one pelt binds that exact hound, with matching origin fields. Allocate
hound before pelt in slot order using the existing occurrence allocator. IDs must
be fresh across authored, created and holder identities. Exact paired definition,
origin and membership proof rejects extra/missing/duplicate children, cross-plan
parents, reused generations and arbitrary nested spawn trees.

Each create remains immediately followed by same-group null-source placement:
hound into the declared home room, then pelt into that newly created hound. The
second destination is the sole new exception to room-only creation placement.
Initialize the exact hound HP row and commit both identities, placements and slot
transition in one writer group. Bundle completeness is checked at the complete
atomic group; valid paired prefixes must hydrate for later proposal reads without
mistaking a temporarily unfinished pair for a corrupt complete state. Generic
source/cycle/capacity guards and one-container proof stay in force.
The additive `spawned_bundle.json` fixture pins a complete accepted pair, final
bundle refusals and a composable paired prefix in both portable kernels.
At final admission, every occupied slot with no replacement due binds a fresh
same-group hound by full plan, slot, generation and member ID. Row-only occupied
slot examples exercise transition algebra only in explicit nonfinal composition;
they do not establish a complete birth.

Derived dynamic entities/resource specs/capacity and known-victim observations
include proven spawned hounds and pelts. `entityIds[DefinitionRef]` remains the
one-authored-instance map; it cannot pick a population member. Attack, targeting,
view, HP, death and encounters bind exact runtime IDs. A hound death selects its
plan's NPC corpse template and validates its actual dynamic victim, retaining the
ordinary player/default authored NPC corpse contracts. S1 cannot credit a hound.

Population owns membership/eligibility/bounded creation; movement owns legal
transfer; combat/resource/death own loss, closure, corpse and loot transfer;
schedule dispatches the exact saved plan/job occurrence under existing causation
and canonical `(due_time, job_id)` ordering. Each due job keeps its existing distinct
writer group. A fatal combat group writes only its victim's slot, with the ordinary
HP/encounter/corpse/loot ops; it never writes plan control. The plan-job group advances
control and only newly filled/replaced slots. No-op transitions of other slots are
forbidden. If population is first at an equal deadline, the still-engaged victim is
not moved or rewritten; if combat is first, that newly dead slot's future eligibility
prevents a replacement or rewrite. Other eligible slots use different mutation
targets. Control still binds one current pending successor; the plan's declared
ordinal range and all unchanged slot identities agree in either order. Wander <= replacement
delay ensures fatal eligibility cannot require an earlier plan-control write.

Ordinary same-target cross-group writes still fault `conflicting_write`, including
two attempted transitions of one population slot; there is no population exemption,
writer-group coalescing, job-priority change or last-writer-wins overlay. Only the
exact current pending binding may run; replayed, cancelled
or stale occurrences create/move/draw nothing. All writes use existing root
proposal, conflicts, shared work counters and changed-row transaction. No public
spawn action, per-hound job, global ecology service or unbounded history scan is
required. New schemas get invalid fixtures and required/bound mutant sweeps.

## C4 pack encounter and flight composition

[C4 mechanics](mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract)
adds only bounded active opponent IDs, primary and next-opponent ID to the owned
encounter transition. Each write checks the complete prior encounter row, current
job/round and exact character/body/room. Active IDs are unique, canonically ordered,
bounded before iteration and proven current members of the same full plan ref;
primary/cursor belong to that roster while open. Closed encounters have no active
participants or pending round. A member cannot belong to two open encounters.
This is combat-owned internal admission during Attack/run_job, never a public
assist/damage verb or a player-forgeable behavior intent. Ordinary non-pack NPC
admission remains one opponent. Generic state/delta/precondition changes require
both portable twins, independent literal fixtures, then differential proof.

For this actual scheduler seam, extend each separately targeted C3 slot with
nullable `last_flight_at`, initially null and reset to null only on a new generation.
A successful selected flight sets it to this occurrence's logical clock, checking
the exact plan/slot/generation/member and complete prior row. Fatal slot transitions
retain that generation's value. Population dispatch skips a living member when
it is engaged or its last flight equals that dispatch clock. It writes no unchanged
slot. The timestamp prevents combat-first flight followed by same-boundary wander
from moving one hound twice or causing a cross-group custody conflict; it is not
a cooldown, mirrored membership list or historical encounter scan.

Canonical `(due_time, job_id)` order and separate groups remain. Population-first
skips the still-engaged hound; combat-first records the same-clock flight so the
later population group skips it. Both permit only other unengaged members' ordinary
wander and one control successor. Flight writes its own slot/custody/encounter in
the combat group; population writes separate control and actual birth/replacement
slots. Same-slot or same-custody different-group writes still fault
`conflicting_write`; no priority rewrite, group merging or conflict exemption.
At a strictly later wander boundary an unengaged survivor may move normally.

Combat owns admission/rotation/removal/closure and its job; movement owns validated
flight; population owns slot provenance and its own job; death owns corpse/custody;
proposal retains atomic conflicts, event causation and shared command budgets;
authority alone commits changed rows plus the receipt. Flight/departure/primary
narration binds actual runtime IDs and committed room/membership changes. Stale or
cancelled round occurrences never move, hit, draw or revive membership. No new
per-hound job, whole-state copy, receipt ledger or actor assumption is introduced.

## D1 ferry transport composition

The Boathouse and Fen Isle Landing boarding details offer exact keyed outbound
and return actions. A bound transport invocation carries actor, endpoint detail,
authored route reference and displayed base fare; the authority derives the
destination and recipient. GameView and direct execution share one
admission query after ordinary elapsed, scene, combat, posture, life and freshness
checks. The query checks current endpoint room, authored route, Sedge's exact
recipient identity and balance, and the owned-corpse recovery exception. A
captured offer cannot substitute another endpoint or quote.

Transport lowers positive payment through B3's existing conserved two-party
resource transfer, then transfers the body and any eligible Wren through the
existing movement/escort consequence in one proposal/writer group. The outbound
base quote remains 2p when an owned-corpse waiver makes the charge zero.
Zero-fare crossings omit payment operations. Emit the normal accepted room-entry evidence
for the body; do not call Move as a second command, add a clock jump, or credit
Q2 return merely for crossing. A new narrow transport command/action/offer and
receipt owner is allowed because published B8 `service@1` is bound to a present
NPC and entitlement/meal/drink benefits. Do not widen that closed union into a
generic effect interpreter. The exact command key, source-authored action keys,
target order and input are frozen by the D1 source brief before implementation.

The `use_transport` payload contains `actor_id`, `endpoint_id`, `route` and
`quoted_fare`. Actions `board_ferry` and `return_ferry` target exactly one current
boarding detail in `inspectable_details`; captured input contains `route` and
`quoted_fare`. A `TransportOffer` on that notice projects the base `fare`,
effective `charge`, `waived` status and shared admitted action. Transport composes
resource transfer, movement room-entry evidence and escort travel; it introduces
no new delta operation or save row. A present NPC may project `lessons` as
original free-bound skill references; the Book reads their acquired/qualified
status from the same actor's existing `SkillView` entries.

Sedge's lesson stays a C1 dialogue Choose consequence with typed
`skill.acquire`; it is not a transport benefit or remote grant. Existing
reserved skill facts, dialogue binding, service/payment histories and movement
admission keep their separate writers.

## B8 immediate service composition

A service invocation binds actor, exact
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

`service@1` requires kernel API **1.23**. `ServiceDefinition` binds its original
provider, exact authored action key, currency, price, label/narration and one
closed `ServiceBenefit`: entitlement fact, meal stock/debit/MV, or provider-held
vessel/liquid/MV. NPC definitions list exact service references. `ServiceOffer`
projects the captured provider target, service reference/quote, declared benefit
and keyed admission. `ServiceBenefit` and `ServiceOffer` each declare a literal
valid example checked by the shared contract suite. Existing `UnavailableReason.message` distinguishes already
paid, full MV, sold out and unavailable exact payment without changing error codes.
The actual bed is an inspectable detail with `bed {title, entitlement}`; its
local projection emits ordinary targetless Rest and never changes raw Rest admission.

## D2 held-readable composition

[D2](mechanics.md#d2-held-books-and-public-priory-selected-contract) extends
existing Read targeting to authored readable items, retaining exact actor, item ID,
pinned definition and ActionSet resolution. Shared held-reach admission governs
item/contents offers and raw commands. Expose the authored Read label on each
eligible item detail; closed ancestors hide unreachable contents and leave no raw
ID bypass. Use current Item/ContentView and offered-action shapes where sufficient;
add only consumed readable metadata, never a generic document hierarchy.
The item-readable extension requires API1.24 and `readable@1`; its optional
`topic` requires `topics@1`. Item Read offers retain the resolved command while
preserving the authored action key.

Topic grants lower to the B6 Boolean owner; no new portable delta, event writer,
reading cursor or continuation is needed. Accepted receipt binds the exact Read
command and original book; confirmed topic projection uses B6's sorted topic entries.
B6 success and book Read compose on the same membership, so already-known grants
are neutral. Rejected commands write neither knowledge nor read narration. Current
scene/combat/freshness/retry rules remain in force. Authority commits changed facts
and receipt together before adopting memory or replying; no full-state copy occurs.

## B9 Rest occurrence and dream composition

Register `rested {body_id, room_id}` as a
position-owned DomainEvent for accepted `rest` only. Its full actor/player scope,
world/time, root command cause/correlation and causal position bind the actual
accepted body/room transition after prior-rate settlement. Root-to-event checks
must reject a rental/Sleep/refusal/foreign actor/body/room producer. Emit it for
accepted Rest generally; the cartridge's exact typed first-Rest binding selects
its eligible room and entitlement. An outcome label alone is not event evidence.

The guarded first-Rest delivery assigns its declared fact, activates the bound
quest once, then starts the exact dream checkpoint at beat1 in the same proposal. All
reads observe the proposal's causal prefix; all writes use registered fact,
quest and choice operations with existing conflict/rollback/shared budgets.
No new portable delta, dream row, clock op, scene queue or host callback is used.

Add only the [consumed scene subset](mechanics.md#s10-lantern-rest-and-dream-b9-selected-contract).
Continue binds the exact scene/beat; Resume/Close are local routes over
projected saved truth. The existing Choose command
binds its scene-owned continuation/expected revision and offered choice. A3's
scene/line freshness remains for modal scenes. For this subset, beat4 is choice,
beat5 the selected final narration; the saved ChoiceRow binds scene source,
beat4, actor/body and authored room anchor and survives resolution/end. A fresh
old occurrence or wrong branch/beat/control refuses; accepted-id replay is first.
The explicit scene source must not enter ordinary dialogue pending-choice selection.

GameView projects dream availability and exact controls under the real bed detail,
with authored text and bound choice when open. The shared query admits them only
at the safe anchor with no ordinary choice/modal/encounter, and confirms the same
rules for direct commands. The normal World, position and combat sets remain;
an outstanding presentation-only checkpoint does not create modal replacement.
Resume does not infer a world move, sleep or memory. Modal precedence and
combat suppression hide dream controls without erasing their checkpoint.
Final acknowledged end lowers one `dream_seen` assignment and bound S10 resolution
in one scene-owned writer sequence, with normal `scene_ended`/`quest_resolved`
evidence, no `story_point_reached`. The authority only commits changed rows and
receipt; the Book only emits captured invocations.

The consumed wire declarations are `SceneDefinition.control = presentation_only`
and `on.rest {room, detail, entitlement, credit, quest}`. That one binding owns the
first-Rest fact, quest activation and cursor start. Its exact steps are three
`narrate` entries, one `choice {key, prompt, choices}` with two
`{choice_id, label, text}` alternatives, one `branch`, `await_ack`, and `end`.
`on_end {assign, quest, outcome}` is the memory/quest-only alternative to the
existing story-point end. The scene cursor's maximum includes choice and branch.
The existing choice row binds the scene reference and authored choice key, with
exact `body` and `anchor` roles; no new row fields or portable operations are used.
Choose's optional `dream {scene, line, body_id, room_id, expected_revision}` draw
is mandatory only for scene-owned choices and must match the saved occurrence.
The real bed's optional `DreamView` carries current saved text, safe availability,
selected branch and exact Continue/choice offers. These controls preserve action
keys and captured inputs; scene-owned choices never enter ordinary dialogue
pending selection. The original B9 subset required API1.25; it is installed in the
[current bundled chapter](cartridge.md#current-bundled-chapter). Original integrated
answers remain in the [B9 evidence](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-05-b9-lantern-dream/README.md).
## D4 held-food composition

**D4 consumed subset.** [D4](mechanics.md#d4-homes-finite-apples-and-eat-selected-contract)
adds `food@1`, command payload `eat {actor_id: CharacterId, item_id: EntityId}`,
accepted outcome `eaten` with the exact consumed `item_id: EntityId` in the accepted
envelope (mandatory for this producer; receipt replay binds it), and immutable optional item metadata
`edible {resource: DefinitionRef(resource), amount: positive safe integer,
label: TextKey, narration: TextKey}`. The ActionSet key is `eat`, targeting one
exact directly held edible item with no input. Its GameView inventory action
uses the same pure keyed admission query as execution. Harvest remains the
installed containment invocation; only its orchard label says Forage.

Food reads actual custody, life, settled recovery/headroom and immutable metadata,
then lowers one ordinary conserved `entity.transfer` plus `resource.adjust` in
one writer group. No new event, fact, food-count row, mint, removal operation or
service benefit alternative is required. Add generated known-entity kind
`consumed` and one immutable food-enabled-world holder mapping, appended after
slot holders and before initial population births in fresh allocation. This consumed
subset requires API1.27. The terminal transfer guard must reject escape,
nonfood entry and foreign-source entry; food is the sole new admission owner.
Immutable composition context uses existing `known_entities`: the holder has
`kind=consumed`, opted item entries have `edible=true`, and only known-body source
entry is admissible. Runtime stores the generated holder ID once in immutable world
metadata; no saved holder/stock row is added. Containment and carry terminate there
as unowned custody; reach is false. Derive consumed status from custody.
Eat's accepted reply supplies its exact command ID for existing narration
recovery despite having no event. Its receipt-derived narration record is a
World result with no detail ID; live result routing must not fall back to the
submitted apple page after that identity leaves the projected inventory.

Keep shared query budget, structural sharing, exact replay and whole-proposal
rollback. Compiler/loader, ActionSet/verb, outcome/generated contracts, world/save
projection and both generic delta validators must agree on this consumed subset.
Keep current-behavior conformance guards; replace obsolete development-contract fixtures
only through a reviewed contract amendment with independent literal answers under the
[forward-development policy](../decisions/owner-decision-forward-development-2026-10-05.md).
Add independent literal terminal-transfer cases
and applicable two-kernel differential cases if the foundation changes.

## D6 water movement and corpse selection

Use installed `move` and
ActionInvocation. Descend: `action_key: "move"`, `target_ids: []`,
`input: {direction: "down"}`; surface: same key/targets with `{direction: "up"}`.
Trust actor/invocation/freshness fields normally. A shared read-only exact-edge
admission serves ExitView, execution and captured-invocation proof. Descend reads
skill/load/life/posture/encounter/MV/no-following-Wren and debits 10 MV instead of
ordinary fare. Living Up bypasses ordinary posture/fare checks and costs 0 MV.
Both preserve body transfer and `entity_entered_room`; other exits stay ordinary.

Accepted descent commits one occupancy generation, absolute deadline and due
job. On delivery, prove the same body remains below in that current generation.
No per-drain successor exists. Surface/death invalidate it; stale jobs do nothing.
Current expiry lowers positive HP to 0, passes that applied loss into the existing
fatal sequence in the same writer group, and emits optional typed drowning cause
with null killer/credit. MV 0 alone is not fatal. Settlement at the exact deadline
precedes action admission, including Up; no command-ID tie may grant extra time.
If existing scheduler ordering cannot express this locally, stop for PM rather
than change global ordering silently. Compiler/loader/save and event validation
must define the narrow occupancy/job/cause types before use. An underwater Up
reservation retains its original occupancy generation through elapsed preflight;
invalidating that generation returns `stale_view` before the movement rule,
leaving the same body at Chapel with one corpse. A clock tick within the same
occupancy does not invalidate the captured free Up. Global scheduler order stays.

Provisional source shape: [water contracts](../../protocol/water.schema.json)
define content `WaterSettings`, actor-keyed `WaterOccupancy`, bound `WaterJob`,
confirmed `WaterView` and selected `CorpseRecoveryView`. D6 content opts into
`real_elapsed`; the view carries logical remaining time and confirmed real
seconds derived from the cartridge rate, without a presenter clock. `water.transition`
compares the full prior row and increments the generation on entry or clear.
An active row binds body, bottom room, entry clock, absolute deadline and job;
a cleared row retains generation/body and has null room/entry/deadline/job.
The job binds actor/body/generation to the exact bottom DefinitionRef and due
clock. The [current bundled chapter](cartridge.md#current-bundled-chapter) owns the installed release answers.

Chapel `recover_corpse {actor_id, corpse_id}` binds `action_key: "recover_corpse"`,
`target_ids: [corpse_id]`, `input: {}`. Shared admission proves living actor at
actual shrine, selected death-origin ownership, nonempty direct roots and
current corpse location in `well_bottom` or `pool_bottom`. Containment transfers existing roots once in one accepted
writer group/receipt. Preserve descendants/empty corpse, forced overload, no
rewearing and no general remote Take. Malformed custody never creates an offer.

## D9 reaction, cue and Study admission composition

**Selected D9 contract.** The existing child and bell choice
producers emit their committed fact/quest events; D9 consumes them in the
bounded reaction queue. Terminal fact writers are unchanged. Cast and Green
profiles may be derived from current facts without a persisted mirror. A
single typed hound suppression generation/deadline and one resume job carry
the time-limited effect. Bell consequence delivery closes any current hound
encounter and cancels its round in the same causal writer group; population
jobs read the suppression and remain bounded. At deadline equality the resume
job checks its generation and actual living count; stale jobs do nothing.
When the current population job and its resume are both pending for the same
plan at that exact deadline, their ordered deliveries share one writer group
for that plan's control and slots. Each delivery re-reads the hydrated prefix;
unrelated jobs retain separate groups and ordinary conflict refusal.
If this composes into two conflicting writers on one encounter, stop for PM
before changing the proposal conflict rule.

The bell cue is bound to one accepted source event, its command/actor and the
observer's room at that logical instant. Only an observer in the cartridge's
explicit audible area receives it. The current accepted player command has a
Belfry observer; controlled frames prove other area boundaries without adding
another body or remote observer delivery. Subsequent projection is read-only
and may render retained history as a past cue, never as a fresh sound or second event.
No global sound bus, remote Scan or fabricated actor movement is selected.

Share one read-only Study ingress check between direct `move` admission,
ActionInvocation resolution, ExitView availability and actual movement. It
checks the exact Nave-west edge, fox allegiance, actual actor ownership,
corpse location in Study and direct nonempty custody at the current revision.
An ordinary blocked ingress is `exit_closed`; an eligible owner enters by the
ordinary `move` command and pays its ordinary fare. Study-east egress follows
normal movement checks. A captured old exception is rechecked on invocation;
forged corpse IDs, empty/foreign/moved corpses and stale offers cannot bypass
the gate. The shared reciprocal barrier transition and door verbs are not
changed. D6's `recover_corpse` remains restricted to its two underwater rooms.

## D12 Harvest method and Buy quote composition

[D12](mechanics.md#d12-practical-skill-consumers-selected-contract) extends only the existing Harvest command and action input with optional literal `method: "careful"`. A projected careful offer is `ActionInvocation {action_key: "gather_carefully", target_ids: [patch_detail_id], input: {method: "careful"}}`, with the ordinary actor/id context; it resolves to `{type: "harvest", actor_id, target_id: patch_detail_id, method: "careful"}`. `ActionInputParameter` registers `method`, and `ActionInput.method` plus `Command.harvest.method` accept only that literal. Ordinary Harvest has `input: {}` and omits the command method. A method requires the exact offered action's input declaration and the target's opted [careful metadata](cartridge.md#d12-practical-skill-declarations); neither an arbitrary detail nor ordinary Harvest input can invoke the benefit by name alone. Unsupported method/shape fails typed wire/admission validation before effects.

Shared keyed target/input admission and the method-aware pure Harvest query drive projection and execution. A loaded alias whose key differs from `harvest` must independently produce the literal invocation and resolved payload above before its successful result. The careful accepted proposal contains the selected distinct custody transfers and matching acquisition events in one writer group, one accepted receipt and the authored careful narration. The budget is shared across action policy, skill policy, selection and combined carrying; fatal exhaustion faults atomically. There is no new foundation op or command capability.

The existing `buy {actor_id, provider_id, item_id, quoted_price}` and ordered provider/item targets stay unchanged. Project and resolve the current effective Buy price through the shared commerce query and `ActionInput.quoted_price`, then compare that bound number again after authority elapsed preflight before any transfer. Qualification is an input to the quote, not a saved quote or acquisition condition. No stale offer may silently charge a newly computed price. The [chapter's optional shop declaration](cartridge.md#d12-practical-skill-declarations) owns the ratio/floor; Buy/Sell custody and checked payment compose exactly as B3. These protocol/schema/generated-contract changes are installed; the
[D12 save/protocol review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-d12-final-save-review.md) records their independent acceptance.

<a id="d7-sight-flight-composition-planning-contract"></a>

## D7 sight flight composition

Reuse the C3 plan/slot/control, paired create/placement and C4 legal NPC movement/last-flight contracts. D7 initializes and validates `last_flight_at` for deer sight-flight plans without enabling pack assistance. D7 is installed in the [current bundled chapter](cartridge.md#current-bundled-chapter). The deer and hide need distinct typed spawned-role declarations; their full plan, bundle, slot, generation, creation occurrence, member and parent provenance remain immutable. A deer is one current member of one one-slot plan, and its hide belongs to that exact birth pair. Existing hound/pelt roles and frozen fixtures retain their own meaning.

A sight binding is at most one pending job per current deer generation, carrying exact plan/slot/member/player, occurrence and due time; replacing it cancels the prior job atomically. Its job is internal, never a player ActionSet verb. Player entry or the checked population `entity.transfer` into the player's current room establishes co-presence; the latter schedules or resets sight in that same due-job writer group, bound to the exact transfer and population-job occurrence without requiring `entity_entered_room`. That cause and the current slot/job binding authorize dispatch. If the transfer is a new birth, include the sight binding in the birth slot transition rather than writing that slot twice. The sight group completes that job and makes one checked slot transition that clears its binding and, on actual flight, records the last-flight clock; legal deer transfer also stays in that group. Re-read the hydrated prefix; a stale generation, completed job, dead/departed deer or absent player cannot move anything. Sight first may transfer an engaged deer, close its encounter and cancel its still-pending current round entirely in the sight group. Unengaged deer use the same legal transfer without encounter changes. A stale or blocked sight completes harmlessly; when the encounter remains live, its current or successor round stays pending.

For the sole round-to-sight handoff, a current ordinary deer round in group G at the sight job's equal due clock survives and writes checked `encounter.advance` plus one successor `job.schedule`. The later current sight runs in fresh group H. Only its matching `encounter.close` and cancellation of that exact successor retain G; sight `job.complete`, deer transfer and slot transition stay H. Require the same encounter/member, predecessor round and successor job IDs, equal due time, exact current sight binding and no intervening writer to the encounter or successor target. A fatal round cancels its bound sight job in its own group. An intervening population job retains its group and skips the engaged deer; it grants no handoff. Different member, stale successor, unequal due time or any unrelated same-target cross-group write faults `conflicting_write` under ordinary rules. Jobs still sort `(due_time, job_id)` with their own groups; this narrow causal continuation changes neither job priority nor general conflict admission. A harmless current sight may first complete and clear its exact slot binding in group S, while a later equal-due population job in group P transfers that same living member into the player room and installs a fresh sight binding on the same slot. The checked clear and rebind may sequentially write only that slot target across S and P when the old sight job and the exact current population control job are both due at the equal time, the member, plan, slot and generation match, and the new sight schedule is bound to the actual population transfer. The final slot is the new binding; no other cross-group slot overwrite is permitted. No untyped fact, broad event listener or additional population ledger.

## C5 bleed and bandage composition

[C5](mechanics.md#c5-hound-bleeding-and-bandage-selected-contract) adds one body-keyed typed bleed row and checked `bleed.transition {body_id, expected, value}` delta. The closed C5 value retains a monotone positive generation even while inactive; its active form has producer hound EntityId, `ends_at`, cadence `next_tick_at` and exact pending JobId (whose due time may be the earlier tick or the end). Transitions compare the complete prior row, including null at first application. A new application increments the retained generation; refresh keeps the original producer, generation and pending cadence/job while extending the end after any eligible hound hit. The next cadence may pass the refreshed end; the pending job then runs at the earlier end to expire without damage. Tick advances that row; cure, expiry and death leave an inactive row with no due/job, preserving the generation needed to reject stale work. Schedule a final expiry delivery at `ends_at` when no damaging tick precedes it. One job owns only one current instance; stale generation/job work is harmless. Both generic delta validators, projection and loader reject malformed rows and impossible transitions. This installs no arbitrary effect script, stack collection or second scheduler.

The hound combat owner may transition only after its resolver actually lowers player HP by a positive nonfatal amount in that writer group. It binds the actual C3 member and body rather than trusting a free event or template name. Due tick reads that status row, body HP/life and owned job at the hydrated prefix; it composes existing `resource.adjust`, fatal sequence if needed, and status/job cleanup in its one writer group. Fatal combat loss and any player death clear this C5 row before return. No `attack_result` is fabricated by a status tick; its typed cause identifies bleeding and original hound without granting hound kill credit.

One narrow causal same-group exception handles a current bleed delivery and current encounter round when both jobs have the **same due time and same living body**, the status row names that exact pending bleed JobId/generation, and the encounter names that exact current round JobId/body. Verify both occurrences and bindings against the hydrated prefix before assigning their shared writer group; keep ordinary `(due_time, job_id)` execution order and revalidate before each delivery. If bleed runs first, damage/death/expiry settles before the round; a fatal tick makes the round harmless. If round runs first, its hit may refresh the same instance or death may inactivate it; the following bleed delivery re-reads `next_tick_at` and `ends_at` rather than trusting the old job label. A former expiry due at the cadence tick becomes one damaging tick if a same-clock refresh extends the end beyond it; if the next cadence tick is still future, the delivery reschedules without damage. If the first delivery closes/cancels the second job, skip the stale second without a write. The pair has one writer group solely for their legitimate same-body HP/status/death/encounter writes. Another job, another body or stale occurrence never joins it. A third due writer to the same target in its own group still faults `conflicting_write`; this is no generic job-coalescing rule or exemption from foundation conflict refusal. Existing segmentation and budgets still apply across arbitrary Flee, cold reopen and later re-engagement clocks; no special phase or tuned interval separates jobs.

Add typed `bandage {actor_id: CharacterId, item_id: EntityId, effect_generation: positive integer}` and exact one-target `ActionInvocation {action_key: "bandage", target_ids: [item_id], input: {effect_generation}}`; accepted outcome `bandaged` binds that item, effect and generation. The current GameView offer and raw command resolve through the same pure query: living actor/body, C1 acquired and currently qualified skill, current matching generation, declared bandage item directly in the actor's body holder, and reachable current mode. After due preflight, recheck all of it. The one proposal transitions body-held item to D4's existing consumed holder, clears the matching status and owned job, and returns one receipt with authored narration. No HP adjustment, clock jump, round advance, encounter close or RNG. A missing/expired/wrong-generation effect refuses before consumption. A later same-command replay returns its original receipt; a new command on a spent item refuses.

Bleed job scheduling and cancellation bind the body and generation together. A partial
bleed binding, an orphan bleed generation beside another cancel discriminator, or a
mixed bleed/sight or bleed/water schedule is refused, including a lone water body.
When a same-time round refreshes an already due expiry before the retained next tick,
that completed expiry hands off to a new job at the unchanged future cadence without
damage. Completion of a due tick advances cadence. Both portable composers enforce these
transitions and refusals; existing encounter, sight and water cancellation forms keep their
frozen answers.
The independent encounter/job replay must retain both bleed provenance fields in
scheduled, completed and cancelled rows, verify the exact body/generation on
cancellation, and reject partial or mixed bindings and counterfeit result rows.

Extend the existing consumed-holder entry guard narrowly: a declared edible enters only through Eat; a declared bandage enters only through this exact C5 command/result from direct body custody. Neither may leave. The already generated holder and immutable known-entity metadata remain; do not add a second terminal holder or delete item rows. Admit `bandage` as the sole C5 exception to focused combat after ordinary ActionSet composition, in both projection and raw command admission. `perform`, Eat, other item actions, aliases resolving to them and Move remain barred during combat. Register only consumed command/action/input/outcome, status/delta/job/cause fields and API gate; add fixtures for every required/bounded schema field, the status transition and terminal custody in both foundation validators. Fixture changes require reviewed contract amendments and independent literal answers under the [forward-development policy](../decisions/owner-decision-forward-development-2026-10-05.md); retain current-behavior guards.
## D10 knowledge and Knock composition

D10 is installed in the [current bundled chapter](cartridge.md#current-bundled-chapter);
that section owns release, API, hash and allocation answers.

`knowledge@1` owns `visited_rooms` rows keyed by canonical `{kind: "visit",
actor_id, room_id}` and `observed_npcs` rows keyed by canonical `{kind: "observation",
actor_id, npc_id}`. A `VisitedRoom` row contains `actor_id, room_id`; an
`ObservedNpc` row contains `actor_id, npc_id, room_id, at` (logical seconds).
`visit.record` writes the former only from absence; `observation.record` carries
`from` (null or the prior row) and `value`, and requires monotone observation time.
Both carry actor and target identity. Entry observations are captured at their causal
sequence; all knowledge writes form one final writer group, preserving their order and
prior rows. No mechanic reads knowledge during the same command. Look records observations
in its own accepted rule. Existing
changed-row storage and receipt history carry them; no separate database is added.


Typed character-owned visited-room and observed-NPC rows are the only new gameplay
knowledge. Their delta operations are written by the accepted entry/Look decision and
committed with the receipt; GameView, Map, Where and Knock never write them while
projecting. Observation retains exact entity ID, last visible room and logical time.
The loader rejects unknown room/NPC refs and evidence inconsistent with character
ownership or visible committed observation. GameView carries only the actor's known
rooms, observed targets and current-room door options, with no hidden coordinates,
unobserved NPC names or live remote positions. Where applies Look/direct-target current
visibility before returning `here` for an exact present NPC; hidden co-location falls
back to the actor's saved `last_seen` or `unknown`, for raw IDs, aliases and touch alike.
Ambiguity retains sorted exact IDs; no unseen candidate enters the list. Remote known
Map links carry no live Move availability; only current-room exits do. Knock's ActionSet
key resolves to its door command with the exact local
direction. View availability and invocation share that admission; narration belongs
to the accepted command receipt, and retry does not produce a second response.

## C6 expedition composition

C6 is installed in the [current bundled chapter](cartridge.md#current-bundled-chapter);
its [final save opinion](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-c6-final-save-second-opinion.md) records source acceptance.

An actor/quest-instance-keyed `ExpeditionAttempt` retains the bound living player body, original S27 quest occurrence, exact Start or Restart command ID as attempt ID, route cursor `0..5`, optional sheltered flag and status `active/failed/completed`. A checked complete-prior-row transition changes only this one attempt. The quest remains active through failed attempts; failure sets cursor0 and clears shelter; Restart replaces the attempt ID and retains cursor0 in the same row. Do not reuse C2's leader-bound patrol row or create a universal route interpreter. The fixed authored route and footprint are pinned definitions, not saved room tags or duplicated visit facts.

Use three exact authored keys resolving to one narrow typed `expedition` command: `begin_marsh_watch` at gnawed bones with `target_ids: [gnawed_bones_detail_id]`, `input: {transition: "start"}`; `retry_marsh_watch` at the same detail with `input: {transition: "restart", quest_instance_id, attempt_id}`; and `use_marsh_shelter` at Drowned Oak's new shelter detail with `target_ids: [shelter_detail_id]`, `input: {transition: "shelter", quest_instance_id, attempt_id, cursor: 3}`. All resolve to `{type: "expedition", actor_id, detail_id, ...input}` and are registered only for this declared quest/transition; wrong key, target, transition or input cannot invoke another stage. Exact detail IDs come from the loaded definitions. Projection and direct command share one admission query over current actor/body, room/detail, quest state, attempt state, and current C3 hound slots. A stale drawing cannot start a second attempt or use shelter after progress changes. Start activates S27 and transitions the attempt before optional C4 Attack-style encounter creation in **one** writer group. The encounter uses the same current hound identity, roster, current room and budget as deliberate C4 Attack; no separate AI job or opportunistic enemy strike is added. If no hound is eligible, no encounter write occurs. A current encounter still restricts ordinary Move; legal Flee may advance the route only if its accepted edge is the next declared one.

Movement's accepted transfer is the sole route-credit producer. At the hydrated proposal prefix, require the exact actor/body, active attempt ID, expected source/destination edge and next cursor; compose attempt transition with that one Move/Flee writer group. At cursor3 in Drowned Oak, Use shelter transitions the current attempt from unsheltered to sheltered once; no other stage/place/actor can record it and it never completes the quest. A wrong accepted edge inside the footprint earns no credit; an accepted exit outside marks failed. The fifth edge composes cursor5, quest resolution, one bounded faction adjustment and one reserved fact assignment in the same group. Death changes an active attempt to failed before the existing same-body return, with no quest completion or faction write. No event listener can credit an NPC entry or replay, and no independent fact/quest writer can forge terminal S27. Ordinary transaction, conflict, query and action budgets remain. Add the narrow typed state/delta/action and portable foundation fixtures only where necessary; declare the current release/API shape and independently re-pin affected known answers under the [forward-development policy](../decisions/owner-decision-forward-development-2026-10-05.md); retain current-behavior guards and explicit save mismatch refusal.

<a id="d8-exact-crow-transport-and-shoo-composition-selected-planning-contract"></a>

## D8 exact crow transport and Shoo composition (selected contract)

The committed player Drop remains the only intent producer: its `item_dropped` event binds the exact item EntityId, direct room holder, command cause and one eligible current crow slot/member generation. One typed occurrence per crow binds its current job and phase (`acquire`, `leg`, `return` or `paused_return`), member generation, original nest EntityId, and the exact item only during acquire/leg; return/paused_return has no reserved item. No unbounded candidate scan, claim table or new generic scheduler is selected. A job advances one acquisition/transport/return leg in its own writer group under canonical `(due_time, job_id)` order and shared budgets; scheduling its successor uses the pinned cartridge interval. A stale occurrence completes harmlessly and cannot reassign the item. Never merge unrelated job writer groups or weaken `conflicting_write`.

Each crow-bound scheduled job carries one closed `crow_phase` (`acquire`, `leg`, or `return`) copied from the occurrence at scheduling; run admission requires it to equal the current phase. This existing job-row field distinguishes a completed return from a stale acquisition after Take at a same-time population boundary; only a due `leg` or `return` job suppresses that member's ordinary wander. Job acquisition uses existing checked `entity.transfer` and `item_acquired` with the crow as holder and `run_job` causation. It is not a player Take; consumers requiring body acquisition still check the actual destination. Each leg uses ordinary NPC room transfer and `entity_entered_room` with job scope/cause. Deposit uses checked `entity.transfer` into the original open nest only at Oak Branches; its direct-root limit is checked before transfer. Failed capacity/location/open-edge conditions use a conserved transfer to the crow's present dry room and change the occurrence to return. Deposit also starts return. Each return job checks the same crow/slot/generation, current corridor room, home and job binding, then transfers the crow one adjacent edge toward home and schedules only the next return leg. If already at home, release clears the occurrence without a new job; otherwise the final home arrival clears it, after at most seven legs. No item stays reserved during return, but that crow remains unavailable for a new Drop until return ends. The same checked custody and query budget cover Shoo and Attack release. Neither fallback nor Shoo emits player acquisition or a reward. A malformed or no-longer-legal return edge faults without teleport or a zero-time retry.

Add `shoo {actor_id: CharacterId, crow_id: EntityId}` with exact `ActionInvocation {action_key: "shoo", target_ids: [crow_id], input: {}}` and accepted `shooed` binding crow, item and destination room. Shared projection/execution admission requires a living standing co-located actor, current living plan member, direct held eligible item and its pending transport occurrence. Before any transfer, recheck generation/job/custody and destination. The existing Attack command keeps its own shape; accepted Attack against a carrying or returning crow drops any held root locally, cancels the due job and records `paused_return` in the same group before encounter creation. On encounter close, the combat owner clears a dead member's occurrence or schedules one return job for the surviving member at the next authored interval; no return job runs during the encounter. Death uses existing forced corpse custody for any direct held root. Population work skips a member with a due transport/return job at the same clock, whether it ran first or second, without writing that member or sharing the job writer group. A refused/stale action leaves all rows unchanged. Extend only necessary closed command/action/outcome/job/event shapes and both validators; every new required field and bound gets a negative fixture and mutant. Retain exact replay, final-head budget behavior and current-behavior fixture guards; obsolete development fixtures follow the [forward-development policy](../decisions/owner-decision-forward-development-2026-10-05.md).
