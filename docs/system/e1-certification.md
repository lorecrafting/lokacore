# E1 certification

The E1 exact candidate proof policy, split out of [Architecture](architecture.md#e1-exact-candidate-proof-policy).

## E1 exact candidate proof policy

E1 implements the bounded minimum from [the E1 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md),
archived [09 §1a and §20](../archive/spec/09-cartridge-lab-certification.md) and
[14 R9](../archive/spec/14-implementation-plan.md#r9--cartridge-lab-v1).
The private runner accepts only the [current bundled candidate](cartridge.md#current-bundled-chapter).
It freezes normalized artifact bytes before execution, checks the independent known answer,
and admits those bytes through the real loader. In particular the loader owns the implicit
position/scene → fact dependency; certification does not replace that check.

The executable policy is bounded to this candidate's admitted forms. Derive used definitions,
policy operations, authored commands and engine commands from the admitted artifact and the
engine ownership tables; retain each use and its location. Every admitted locked capability
also supplies conservative dependency obligations, including capabilities that own no command.
An unknown capability/version, command or policy disposition blocks. Feature gates add to
these obligations: quest outcomes/escort/survival/deadline, scene beats/modal/dream/finale,
immediate service/commerce/transport, durable scheduling/population/patrol, resource recovery,
food/bleed/water, equipment/custody and ancestry/knowledge. Record each authored definition,
choice, consequence and command path that still lacks candidate-specific controlled evidence.
World settings retain their semantic owner: `bands` → resource, `bell_cue` → fact,
`carry` → containment, `combat` and `death_credit` → combat, `death` → death,
`movement` → movement and `water` → water. Unknown world keys block applicability.

Neither [release-scope planning file](../spec/release-scope.md) nor `protocol/feature_registry.json`
is executable certification authority; their omissions never waive a gate.

The runner wraps existing frozen foundation/compiler/loader tests, controlled chapter tests,
real Node SQLite authority tests and `simulate(seed, KERNEL, [loadedCandidate])` explicitly.
Keep the historical demo corpus separate. Every failed command exits nonzero and its raw
redacted output has a byte hash. Receipts bind artifact byte/content hashes, source commit,
protocol/schema/lock and policy/check digests, pinned toolchain, host platform/architecture
and command/exit status. A dirty source tree cannot issue a source receipt. Bundled private
content has no deployment identity; record the reason. Test-suite success is evidence of the
named suite, not proof that every inventoried content path ran.

An invariant failure retains the exact initial state and its hash, fresh/adjusted construction,
clock, RNG algorithm/state/seed, world and deterministic IdSource identity, ordered commands,
explicit fault schedule and the asserted failure. Replay rechecks the simulator's invariants
from that state against the same bytes and source identity; an absent field or changed hash
refuses. `loka play --replay` alone is playback, not reproduction.

Reports use pass, fail, pending/deferred or not applicable with a reason. Required missing
evidence and unknown applicability exit nonzero; a complete headless subset is not an
unqualified `offline_private` certificate. The scenario recorder exits 0 (pass) only when every
case passes, no authored path is pending, every coverage family gap (rooms, quests, dialogues,
choices, scenes) is empty and the disposition and replay checks hold; it exits 2 (pending)
while anything remains pending and 1 on any failure. A pass is coverage, not a certificate. E1
closes at coverage complete: that pass plus independent review and exact-head CI; the freeze,
the 10,000 candidate sequences and the gate audit belong to release-candidate certification
([owner order](../decisions/owner-decision-chapter-one-polish-order-2026-10-07.md)). Browser
interaction/content receipts belong to E2/E3.
Native ARM/Hermes, app lifecycle and blur remain deferred under the mobile pause; preserve
owner save bytes and explicit pin refusal. No general Lab service or new protocol schema.

The E1 scenario recorder is a fixed program for the admitted bundled chapter over the
existing local authority and real Node SQLite. It records legal player routes, five fresh
child/allegiance endings, completionist and negative paths, and thirty adopted calendar days
through trusted elapsed input. Reuse existing clock segmentation and invariant checks; no
player Wait, wall-clock sleeping, altered cartridge, hidden state writer or second mechanic
implementation supplies a fresh-path receipt. Explicit adjusted starts remain separately
labeled when needed for a controlled admission or fault boundary.
Independently checked chapter routes enter the recorder as named fresh cases only with
their literal result assertions intact; their committed steps must pass the same semantic
replay, SQLite observation and candidate/source checks as the ending cases.
For the [Maud cellar contract](cartridge.md#mauds-cellar-content-m20-b2), the combat
route keeps each distinct earned death credit and the final atomic reward visible
across cold reopens; authored resource recovery occurs through trusted elapsed input.

The training/social circuit uses fresh ancestry selection, authored lesson payments and
ferry fares, then selects each recorded conversation choice against its pending continuation.
Skill flags, the original training sword and literal balances survive cold reopen; an
offered lesson or an unvisited conversation earns no execution credit.

Coverage names actual committed room visits, quest transitions/outcomes, resolved dialogue
choices, scene beats/consequences and command paths. An offer or a definition count is not
execution. Check literal terminal facts, all 57 declared room routes and every authored
quest/choice/scene against the recorded uses, leaving unexecuted paths pending.
For dialogue proof, a newly opened pending dialogue witnesses that dialogue's authored
definition; only an accepted choice against that pending continuation witnesses its
specific choice path. Rejected or merely offered choices remain pending. Replay derives
these witnesses from committed commands and states, and requires their explicit receipt
paths rather than accepting a coverage claim by itself.
Ending-specific conversations must be opened after that ending is committed, then
their selected choices resolved; one ending's dialogue cannot stand in for another.
For modal scenes, only an accepted Continue on the displayed line witnesses that
line's authored step. The first acknowledgement also witnesses the scene definition;
the final acknowledgement witnesses the structural `await_ack` and `end` steps only
when the scene actually closes. Presentation-only dream scenes require separate
choice/beat evidence and are not credited by this modal rule.
For a presentation-only dream, accepted Continue on the displayed dream line witnesses
that line's authored narration or branch. The first acknowledgement witnesses the scene
definition; the last witnesses its closing steps only after the dream ends. An accepted
choice against the pending dream continuation witnesses the choice beat and its exact
selected option. A displayed or offered dream alone witnesses none of these paths.
An accepted `talk` also witnesses the selected dialogue's satisfied policy root
and the descendants the [branch evidence rule](#e1-policy-branch-evidence) credits.
Rejected talk and merely offered dialogue actions witness no policy path.
An accepted selected dialogue choice witnesses an authored fact assignment or
adjustment sequence step only when that exact fact changes from its prior value
to the authored result and the committed receipt records the same transition.
A selected dialogue `skill.acquire` or `topic.grant` step also requires its
exact membership fact to change from false to true, the pending continuation
to resolve, and a matching committed fact event with the same actor, scope,
world and command cause/correlation. The witness credits only that sequence
step; it does not certify the skill/topic definition or any unselected choice.
Other sequence operations and unselected choices require separate evidence.
An accepted `perform` witnesses its exact authored recipe definition, admitted
policy root and the descendants the [branch evidence rule](#e1-policy-branch-evidence) credits. Recipe outcomes and
sequence steps require their own consequence witnesses.
An accepted recipe result witnesses its selected outcome only when every
authored sequence step has an exact committed effect witness. A fact assignment
requires the matching before/after fact transition and event; an emitted event
requires its exact receipt. A check-failed empty sequence requires its failed
check event. Unexecuted sibling outcomes stay pending.
An accepted command that changes an exact quest instance from unresolved to
resolved witnesses that quest definition and objective. For a current-state
objective, its satisfied root and the descendants the [branch evidence rule](#e1-policy-branch-evidence)
credits are also witnessed. A failed or merely active quest
does not discharge its resolved objective.
After an accepted command, an active player quest may witness only the first
satisfied authored journal variant whose exact text appears in the resulting
GameView journal. Its satisfied policy root and the descendants the
[branch evidence rule](#e1-policy-branch-evidence) credits are witnessed; other matching variants remain pending.
Resolved or failed journals and a final outcome alone cannot prove an earlier
active variant. Replay derives the same selection at each committed boundary
and requires those exact paths in the retained step receipt.
An accepted `use_transport` reaching the exact authored destination witnesses
the selected transport definition.
An accepted `use_service` witnesses its exact authored service only when the
selected provider and quote match, the receipt and before/after state agree on
the payer debit and provider credit, and the selected benefit is committed:
the entitlement fact transition, meal stock debit and recovery, or drink serving
debit and recovery. A service offer, rejected purchase, or payment without its
benefit witnesses no service path.
For authored item and NPC definitions, an accepted room entry may witness only
entities actually present in the resulting Book's visible room, inventory or
equipment projection. Hidden, absent and unvisited entities remain pending;
the definition inventory alone grants no witness.
An accepted ancestry selection witnesses only its selected authored ancestry when
an absent character selection becomes that ancestry and the receipt's exact
`character.select` value matches the committed row. An accepted item transfer
witnesses only a static authored item whose prior and resulting holders match
its receipt's `entity.transfer` operation and acquisition or drop event; static
NPC holders participating in that transfer may also be witnessed. Opening a
pending dialogue witnesses its exact static NPC target only when that NPC is
bound in the new continuation. Merely inspecting merchant stock grants no item
witness; dynamically created entities require separate provenance evidence.
An accepted step creating a death-origin corpse witnesses that corpse item only when its
`entity_died` event names the same victim and corpse, the committed created row equals the
receipt identity, the corpse lies in the room the victim occupied, and its definition is the
victim's population bundle corpse, else the world player or NPC corpse. For a spawned member,
that death also witnesses its population plan and NPC definition when the member is the
bundle NPC bound to its slot generation and the receipt's `population.slot` row schedules
replacement at death time plus the plan's `replacement_delay`; with those, it witnesses the
bundle loot item only when the receipt moves that member's own spawned loot from the member into its corpse.
A bleed definition is witnessed only when the receipt opens a new active row equal to the
committed row, sourced by a created NPC whose attack names that bleed, after its positive-loss
hit at time t, ending at t + `duration` with its first tick at t + `tick_every`. A reaction
triggered by a committed event of the accepted step witnesses its definition and each apply
step only when it has at least one apply step and every apply step has an exact committed
effect witness in one writer group G of the receipt. If it has a `when`, that root must also
hold in the [reaction's state](#e1-policy-branch-evidence), which then credits the root and
its descendants by the branch evidence rule. The effect witnesses, each in G and matching the
committed after state:
`quest.activate` needs no prior instance of the quest, a `quest.activate` op creating an
active player instance and a `quest_activated` event naming it; `quest.resolve` needs the
quest's active or objectives_complete instance to become resolved with the authored outcome
and a matching `quest_resolved` event; `quest.fail` needs the same transition to failed with
the authored outcome (the runtime emits no event); `fact.assign` needs the fact to change from
the op's expected value to the authored value, with a matching `fact_changed` event;
`population.suppress` needs each named plan, unsuppressed before the accepted step, to newly
gain suppression caused by that event, ending at its time plus the authored duration, matching
the receipt's `population.control` row. A step of any other kind has no effect witness.
Each event named above must have the triggering event as its causation. Causation alone does
not identify the rule, since every rule on one trigger shares it; so a receipt op that the
steps of two or more reactions triggered in the same step would match (same op kind, target
and authored value) credits none of them, and a reaction whose apply steps are all
`quest.fail` (no event to name the trigger) is not witnessed. A `fact.assign` op must also be
at the scope the fact resolves to for the player.
Sightings, wander ticks and bleed refreshes witness none of these paths.
World settings, resource pools and the ale cask are witnessed only by one exact exercise of
the primary literal named below ([PM decision](../decisions/pm-decision-e1-batch-f-world-witness-2026-10-07.md)).
Each clause judges an accepted step (carry: two steps of one case) against its before state, its
committed after state and its receipt ops; a band or bell cue clause judges the projection of
the committed after state. Each credits only its own path: never the setting's other fields
or the owner's capability family ([world-key owners](#e1-exact-candidate-proof-policy)). Definitions, fresh pools, offers and other
refusals credit nothing.
- `movement`: a `move` whose receipt adjusts the body's `cost.resource` by exactly
  −`cost.amount`, from its before level to its after level.
- `water`: a `move` from a route's `surface` into its `bottom` whose receipt adjusts the body's
  mv by exactly −`entry_cost` and opens a water row in that bottom room with deadline equal to
  entry time plus `duration`.
- `death`: a step whose `entity_died` event names the player body in the room it occupied
  before, after which the body lies in `shrine` and the receipt sets its hp to `restore.hp`.
- `death_credit`: a step whose `entity_died` event names an entry's static `npc` in that entry's
  `room`, credited to the player, while the entry's `fact` changes from false to true for the
  player with a matching receipt `fact.assign`.
- `combat`: a step completing an encounter's pending round in which the player body attacks,
  whose receipt schedules that encounter's next round exactly `interval` after the attack's time.
- `bands`: a step that changes the level of a body pool without its own bands, after which the
  GameView shows the world band whose `at_percent` equals the pool's exact percent.
- `bell_cue`: a step that changes `bell_cue.fact` from false to true for the player in one of
  `rooms`, whose caused `fact_changed` event projects the cue `text` into that room.
- `carry`: both, in one case and in this order: an accepted player `take` whose committed
  after load is exactly `max_grams`; then a player `take` of an item with positive mass,
  refused with `too_heavy`, state unchanged, from a before load of exactly `max_grams`. The
  first half must be a take: a forced transfer (which bypasses the carry check, as corpse
  recovery does) cannot stand in for it, and the refusal alone credits nothing.
- A pool with positive `gain` and no `regen`: a step whose receipt advances time and has no
  adjust of that pool on the body, while its level rises to
  min(before + `gain` × `gain_every` boundaries crossed, `maximum`).
- A pool with `regen`: a step whose receipt adjusts it on the body, from and to equal to the
  before and after levels, with `next_rate` equal to `regen.by_position` of the committed
  position, and the committed rate changes to it.
- `pennies`, `lantern_meals` and the ale cask: a step whose [service witness](#e1-exact-candidate-proof-policy)
  holds for a service whose `currency` is that pool (payer debit of `price`), whose meal
  `stock` is that pool (provider debit), or whose drink `vessel` is the cask (its `liquid.set`).
Replay re-derives each clause from the committed command, decision and states, the case's
steps in order (carry), and credits a path only when the retained step receipt lists it.
An exact authored consequence may be discharged only by a retained step witness whose
command, accepted decision and literal before/after assertion are checked again in replay.
The initial bounded binding covers only `study_tracks`' success `fact.assign` step:
`perform` names that recipe and `fen_tracks_found` changes from false to true. Missing,
invalid or unrelated witnesses leave the exact path pending; this never certifies sibling
policies, the whole recipe or a capability family. At the
thirty-day horizon, observe scheduled destinations and population/provenance/pending-job
bounds at each committed boundary, with deterministic clock/RNG/fuel replay. Existing
independent fixture and authority faults supply unchanged contract proof; export new
candidate fault schedules and reopen the resulting intermediate saves before their next
consumer. Scenario receipts bind the same artifact/source/check/policy identities as the
runner and retain commands, exact starts, state/receipt digests and asserted failures.

### E1 policy branch evidence

This rule ([owner decision](../decisions/owner-decision-e1-branch-evidence-2026-10-07.md))
decides which descendants of a witnessed satisfied policy root are also witnessed. A node's
polarity is positive under an even number of `not` ancestors within that root and negative
under an odd number. Walk down from the root, which must hold in the evaluated state (otherwise
nothing is credited):

- A positive-polarity node is credited when it evaluates true and every ancestor evaluated to
  its own polarity (true when positive, false when negative). Children of a credited `all`
  hold by definition. Each child of a credited `any` is evaluated and only a true child is
  credited, recursively. A credited `not` flips its child's polarity, so under `not(not(X))`
  the inner `not` stays pending and `X` is credited when true.
- A negative-polarity node is never credited, including for evaluating false: a negated
  guard that did not fire has not been shown to fire. Under `not(all(…))` and `not(any(…))`
  no descendant is credited unless a further `not` restores positive polarity.
- A refusal is not evidence: the runtime records no refusing policy node, so a refused
  command credits no witnessed path.

Evaluation uses the state and target the runtime judged: the state before the accepted
`talk` or `perform` with that action's admission target, and the committed resulting state
for the selected journal variant. A resolved quest objective (its instance's player, no
target) may be judged before the command or mid-command after effects, so it is evaluated
in both the before and the committed resulting state: a root holding in both credits only
the paths credited in both, and a root holding in one state uses that state. A reaction's
`when` root (the step's player, no target) holds at neither boundary in general, so it is
evaluated in the state that reaction's delivery read: the before state composed with the
receipt's ops that precede G's first op, at its cause event's logical time. That prefix is the
delivery's read state only when every op before G has a lower writer group and no op after it
has one (the runtime reuses lower groups for due-job pairs and the sight handoff, and stamps
knowledge ops group 0); when a lower group appears at or after G's first op, the reaction is
not witnessed. The same polarity rule applies below that root; a negative-polarity node is
never credited. Replay recomputes these credits from the replayed before/after states and
the retained receipt ops, and accepts only paths also recorded in the retained step receipt,
as for journal variants.

A negative-polarity path, or any other authored path no execution can witness, closes only
by a reviewed disposition: a row `{path, reason, evidence, review}` in the checked-in table
`kernel/ts/test/e1_dispositions.json`, naming an authored path, a reason (for example an
unreachable or always-false guard), a pointer to the evidence and the independent review
record. A negative-polarity guard that can fire is dispositioned from a controlled refusal
([PM decision](../decisions/pm-decision-e1-controlled-refusals-2026-10-07.md)): its
row adds `refusal: {case, code}`, naming a recorded case built so that every other admission
condition holds and only that guard's condition is true, and the refusal code. The recorder
fails unless that case's final replayed step is refused with exactly that code by the dialogue
the row's path names; attribution comes from the controlled setup, since the runtime names no
refusing node.
The recorder reports dispositioned paths separately from witnessed and pending ones;
a disposition never adds to the witnessed set, and a row for an unknown or witnessed path
fails the run.
A dispositioned dialogue or choice path also closes that dialogue's or choice's coverage gap
([PM decision](../decisions/pm-decision-e1-batch-e-dispositions-2026-10-07.md)).
