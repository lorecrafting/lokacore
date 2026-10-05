# Protocol: contracts, the decision loop, GameView

## Contracts

`protocol/*.schema.json` is a closed JSON Schema 2020-12 subset (`lib/loka/core/contracts/schema.ex:2`);
anything outside it fails compilation and generation. Nullable scalar unions are supported
for explicit absent custody and unknown death attribution (M5-B). Both kernels validate values against the
flattened contracts with the same paths and error codes (`lib/loka/core/contracts.ex:69`,
`kernel/ts/src/foundation/validate.ts:51`; codes in `protocol/error_registry.json`). Every contract's
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
| `entity.transfer` | the entity's container | container is `source_id`; no cycle (`containment_cycle`); destination under its capacity (`capacity_exceeded`) |
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
Put is additive for valid older cartridge containers on the installed kernel; API1.7 gates
authored use of the new vocabulary. The engine verb sources its first target from inventory and independently validates both targets.

## Policy

`holds` (`kernel/ts/src/mechanics/policy.ts:18`) evaluates `all`, `any`, `not` and the leaves
`fact_compare` (the fact's value at the actor's scope equals), `has_item` (inside the actor's
body, directly or nested), `barrier_state`, `quest_state` (false while the actor has no
instance), `time_window` (hour of day from `clock / 3600 % 24`, wrapping windows allowed, `:42`),
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
recipes, and for the door and container verbs and `wear`/`remove`, matched by the Command each
listed action resolves to (a cartridge alias included): one listed on its exit or item (a nested
one in `contents` included) is never refused with a code the view predicts (`not_present`
among them), one not listed is never accepted, and none of `wear`/`remove` is a place action; a
position invocation (`stand`, `sit`, `rest`, `sleep`) checks its selected `action_key` when
the observation supplies it: an available matching place action is never refused
`invalid_state`, and an unavailable or absent one is never accepted. Without an action key,
any available place action resolving to that command qualifies. An available exit's move is
never refused `invalid_state` or `unsupported_capability`; a
`take` listed on an item is never refused `not_present` (`kernel/ts/src/view/invariants_view.ts:29`, `:76`).

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
