# Architecture

Offline-first story engine: one Elixir application `:loka` (the online server, today only its
portable foundation and the cartridge compiler) and a TypeScript kernel that runs on Node and
on Hermes inside one React Native (Expo) app. Story play is decided and saved on the phone by a
local authority; the online Realm authority (BEAM, Phoenix transport) is not built yet.

## Layout

| Path | What | Status |
|---|---|---|
| `lib/loka/core/` | the portable semantic foundation in Elixir: canonical encoding and hash, checked integers, RNG, IdSource, StateDelta composition, contract validation, invariant checks | built |
| `lib/loka/content/` | the cartridge compiler (`mix loka.compile`) | built |
| `lib/loka/{store,platform,runtime,builder}.ex`, `lib/loka_web.ex` | declared boundaries, no code yet (each file is its `use Boundary` line) | empty |
| `kernel/ts/src/` | the TypeScript kernel: foundation twins plus every story rule | built |
| `kernel/ts/play/` | `loka play`, a MUD-style terminal over the kernel on Node | built |
| `kernel/ts/test/` | kernel tests, the deterministic simulator (`sim.ts`), differential peers the Elixir tests call | built |
| `mobile/authority/local-story/` | the local Story authority: admission, receipts, the SQLite save, recovery, the trace, story point delivery, the session controller | built |
| `mobile/app/` | the Expo shell (`App.tsx`) and the book-style touch UI (`book/`) | built |
| `mobile/authority/remote-realm/`, `mobile/features/*` | Realm transport and Story/Realm UX | empty |
| `mobile/packages/game-view/session.ts` | host-neutral renderer/session boundary used by the local authority | built |
| `mobile/packages/ui/` | shared UI package | empty |
| `protocol/` | the current contracts, registries and fixtures both kernels validate against ([map](../../protocol/README.md)) | active |
| `cartridges/` | development cartridge sources and their replayable transcripts | content |
| `bin/` | checks and generators; `bin/check_all.sh` runs them all; `bin/loka` the CLI | tooling |

## Elixir boundaries (compile-checked)

`boundary` in strict mode; a planted violation must fail (`bin/red_controls.exs:23`). The
declared dependencies, from each boundary's top module:

| Boundary | Depends on | Exports | Source |
|---|---|---|---|
| `Loka.Core` | nothing | `Canonical`, `Contracts` | `lib/loka/core.ex:7` |
| `Loka.Content` | Core | none | `lib/loka/content.ex:21` |
| `Loka.Store` | Core | none | `lib/loka/store.ex:7` |
| `Loka.Platform` | Core, Store | none | `lib/loka/platform.ex:7` |
| `Loka.Runtime` | Core, Content | none | `lib/loka/runtime.ex:7` |
| `Loka.Builder` | Core, Content, Runtime | none | `lib/loka/builder.ex:7` |
| `LokaWeb` | Core, Platform, Runtime, Builder | none | `lib/loka_web.ex:7` |
| `Mix.Tasks.Loka.Compile` | Content, Mix (top level) | | `lib/mix/tasks/loka.compile.ex:9` |

Core never depends on Phoenix, Ecto, the filesystem, the network or processes; Content owns
compile-time definitions, never runtime authority; Web is a transport adapter only. Zero
dependency cycles and zero compile-connected edges (`mix xref`, [checks](../CHECKS.md)).

## TypeScript kernel

Pure: no I/O, clock, randomness, locale or Node API (`kernel/ts/src/index.ts:1`;
`lint/rules/ts-kernel-pure.yml`; `bin/kernel_red_controls.sh` plants each escape and requires
`tsc` to fail). The [owner-approved layout](../decisions/owner-decision-kernel-layout-2026-10-03.md)
gives existing code clear homes; the public entry remains `src/index.ts` and generated
contracts remain `src/contracts.gen.ts`.

| Under `kernel/ts/src/` | Role |
|---|---|
| `foundation/` | canonical encoding/hash, integers, RNG, IdSource, delta composition, validation and errors; imports only its own modules and generated contracts |
| `runtime/` | `runtime/decision.ts` state and typed Rule ABI; `runtime/world.ts` routing and installed capabilities; `runtime/proposal.ts` admission, composition and adoption; `runtime/apply.ts`, `runtime/fresh.ts`, the mixed conformance invariant registry and known-answer runner |
| `content/` | `cartridge*.ts`, the artifact loader and validation stages |
| `mechanics/<capability>/rule.ts` | one pure rule per capability that owns commands; quest lifecycle, dialogue/position/scene queries and schedule behavior live beside their rule |
| `mechanics/{fact,policy,lookups,resource,reaction}.ts` | shared mechanic queries and deliveries |
| `commands/` | `commands/actions.ts` admission, `commands/invocation.ts` identify/resolve and `commands/target.ts` targeting |
| `view/` | GameView projection, action lists and the view/admission conformance check |
| `contracts.gen.ts` | generated from `protocol/` by `bin/contracts.exs`; never hand-edited |

Rules are registered in `runtime/world.ts` only as `<module>.decide`. The typed `Rule<C>`
contract (`runtime/decision.ts:192`) limits each rule to its capability's commands and events;
admission re-checks event ownership (`runtime/proposal_admit.ts:13`). The `ts-rule-*` lint rules
keep rule exports in `mechanics/<capability>/rule.ts`, ban mutation and type escapes there,
and permit only kernel helpers, never another rule. The foundation import rule enforces its
narrow dependency boundary; actual-path plants prove these guards in [CHECKS](../CHECKS.md).

The other folders describe responsibilities, with these existing dependency directions:

| Folder | Other kernel dependencies |
|---|---|
| `runtime` | foundation, content types, commands, mechanics, view and generated contracts |
| `content` | foundation, runtime definitions, fact helpers and generated contracts |
| `mechanics` | foundation, runtime, commands and generated contracts |
| `commands` | foundation, runtime, mechanics and generated contracts |
| `view` | foundation, runtime, commands, mechanics and generated contracts |

`runtime/world.ts` remains the composition root. `runtime/proposal.ts` calls quest lifecycle
`earned`, reaction delivery and the schedule rule; commands and mechanics have reciprocal
query dependencies, and action/view queries consume RPG mechanics. The conformance invariant
registry in runtime includes the view/admission check. This move preserves these couplings,
the static capability registry and pure Rule ABI; loading and executing rules stays static.

## Building mechanics by composition

A mechanic reads shared typed facts, properties, relations, containment, resources,
jobs, perception and events, then requests registered typed consequences in the normal
proposal. Cartridge [blueprints](glossary.md) supply concrete NPCs and items; its other
definitions supply places, numbers and story combinations. Capability code does not
special-case a chapter or NPC or call another mechanic's player verb; existing spec-required
dependencies remain named exceptions.
The [shared Story/Realm and replaceable-content direction](../decisions/owner-decision-story-realm-shared-mechanics-2026-10-04.md) applies at this boundary.

Reuse the smallest existing primitive that preserves the required behavior. When a real
consumer needs semantics or an invariant the vocabulary cannot express, create or extend
its smallest reusable primitive with that consumer, under the [owner clarification](../decisions/owner-decision-consumer-primitives-2026-10-04.md).
Do not weaken the mechanic, duplicate a writer or use untyped facts to evade a contract.
A primitive has a semantic contract, an owner and an invariant; it need not be a separate
package, framework, registry or public interface. Existing reserved fact-backed engine
state and documented quest/dialogue/scene hooks retain their current contracts.

The brief records the real consumer, shared reads, typed writes/consequences and writer
ownership, reused primitives, each missing invariant, what composes without extra code,
and justified named-mechanic/content exceptions with their governing clauses. Review that
record against the actual consumer: ordering and causal credit, conflict/atomic rollback,
trust-boundary validation, bounded traversal before work, shared projection/admission,
and changed-row save/reopen when state is added. Reuse unchanged proofs; add focused
controlled-input checks and red controls only for distinct plausible regressions.

The portable foundation owns generic arithmetic, identity and delta/precondition/invariant
semantics; RPG helpers interpret posture, life, skill and content. Shared foundation changes
retain the [two-kernel fixture/differential obligations](#two-kernels-one-semantic-contract).
New story capabilities stay TypeScript-only until the established server-consumption trigger.
The authority owns clock input, receipts, transactions and adoption; the presenter consumes
GameView and emits ActionInvocation. Neither is an additional gameplay writer.

Prefer a derived query where no history is needed, typed facts for durable narrative truth,
an immediate sequence for a bounded decision, a reaction for typed event consequences,
and a job/quest/scene/state machine for the required durable continuation. Add only the
actual subset; existing writer conflicts, budgets and ordering remain governed by
[protocol](protocol.md) and [mechanics](mechanics.md). The [emergence decision](../archive/decisions/owner-decision-emergence-2026-09-25.md)
and [primitive graduation rules](../archive/spec/21-composable-world-primitives.md#24-primitive-graduation-rule)
supply the historical direction, without making the whole catalog an implementation queue.

The controlled M20-B1 consumer composes five typed rat-death credits with a current-state
quest, a live/present bound NPC, incoming item custody, carrying capacity and bounded trust.
Dialogue owns incoming transfer and adjustment lowering; containment owns Put; proposal owns
acquisition quests/reactions; authority owns atomic save/receipt/adoption. No named Maud or
chest rule belongs in the kernel. See [PM adoption](../decisions/pm-decision-m20-b1-reward-storage-2026-10-04.md).

## Two kernels, one semantic contract

The foundation (encoding, hash, integers, RNG, ids, composition, validation, the
`elixir_and_typescript` invariants) is built in both languages and held to the current fixtures
(`numeric-vectors.json`, `adverse-cases.json`, `composition.json`), then to each other:
`test/loka/core/compose_test.exs` "differential: Elixir and TypeScript compose identically" and
"differential on 300 simulator proposals" call the TypeScript peer (`:353`). Story rules are
TypeScript-only (ADR-074, [AGENTS.md](../../AGENTS.md)); `bin/contracts.exs` fails on an
Elixir host adapter for a `portable_capability` without a declared differential (`:10`,
`:100`). The compiler and the loader are checked against each other
([cartridge.md](cartridge.md#artifact-and-loader)).

The Node simulator splits its fresh contiguous seed range across two workers, sampling the
first seed once in the parent. It combines sequence counts, step-length buckets, outcomes
and command/cartridge coverage before applying the existing assertions. A worker failure
fails the run; invariant failures retain the simulator's reproducer and trace report.
The [acceptance envelope §3](../archive/spec/r1-acceptance-envelope.md#3-corpus-command-mix-and-sampling)
still governs the seed count, determinism and regression controls. The default demo
catalogue (`cartridge_*hash.json`) preserves its curated generator16 regression seeds.
The active [chapter release](cartridge.md#source-layout) has a separate controlled
corpus run through the same generator and per-step invariant checks; its versioned
release pin does not silently retarget the historical demo regression corpus.
Simulator composition consumes the runtime's complete immutable world input projection.
Its independent adoption check applies composed row changes, including removal of a
retired quest's [null change](protocol.md#b5-harvest-and-exchange-composition).

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
unqualified `offline_private` certificate. E1 stays open until one final published A–D plus
review-fix candidate has applicable controlled tests, 10,000 candidate sequences, real SQLite
receipts and independent review. Browser interaction/content receipts belong to E2/E3.
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

## Mobile import rules

`lint/rules/mobile-*.yml`: only `mobile/authority/local-story` imports the kernel; shared
packages never import an authority or a feature; Story and Realm code never import each other.
The app shell imports the local authority's session controller
(`localSession`, `mobile/app/App.tsx:16`); it implements `GameSession`
([owner rule](owner-rules.md#architecture-and-engine)).

## Hosts

- **`loka play`** (`bin/loka` → `kernel/ts/play/main.ts`): loads an artifact, takes typed or
  scripted commands, prints the GameView, writes a transcript and the game trace; `--replay`
  re-decides the trace's Commands and requires a byte-identical transcript (`:2`, `:287`).
- **The phone app** (`mobile/app/App.tsx`): opens the bundled story and its expo-sqlite
  save under the current [chapter binding](cartridge.md#current-bundled-chapter), plays through
  `localSession`, supplies separate wall (`Date.now`) and monotonic (`performance.now`) clocks, and draws
  the book UI or the save-error screen. Elapsed accounting follows
  [durable elapsed sessions](save.md#durable-elapsed-sessions); latency remains separate.
- **The local browser preview** (`mobile/app/`): Expo serves the same App, Book presenter,
  bundled chapter and local Story authority through React Native Web. Metro watches that
  source worktree; Book UI edits use Fast Refresh, while an existing game retains its
  loaded rules and cartridge until a page reload or a fresh game. The browser uses its
  own origin-scoped SQLite/OPFS save and first-run hints; it never opens or changes a
  native app save. The Web host opens SQLite asynchronously, then reads multi-row results
  through synchronous SELECT pages of at most 64 rows so growing save/receipt recovery does
  not send an entire result through the worker's fixed response buffer. Authority queries, row order
  and validation remain unchanged; the native host keeps its existing connection methods.
  A current-build game survives a page reload and a closed/reopened tab.
  The preview is for development;
  browser saves have no compatibility promise across chapter builds. The local run and
  worktree-switch procedure is in [web preview](../web-preview.md).
  The [Web recovery evidence](../evidence/2026-10-05-web-sqlite-stream/README.md)
  records cold-open verification and the remaining transport limits.
- **The simulator** (`kernel/ts/test/sim.ts`): seeded random command sequences against the
  demo cartridges, every registered invariant checked per step, failures shrunk to a minimal
  case (`:167`); the regression seeds plus fresh sequences (10,000 in CI, 500 locally) run in every `npm test`
  (`kernel/ts/test/sim.test.ts:30`). Its proposals feed the Elixir compose differential.
- **Fault simulation** (`mobile/authority/local-story/faults.test.ts`): the simulator's
  sequences through the local authority on real SQLite with real faults (SQLITE_FULL, a failed
  COMMIT, SIGKILL just before or after COMMIT; `:4`).

## Book presenter

The phone book consumes the host-neutral [GameSession](../decisions/owner-decision-presenter-split-2026-10-02.md)
boundary and [GameView](protocol.md#gameview); it sends only the actions offered by that
view, retaining its drawn action/context under [Book live action freshness](book-ui.md#live-action-freshness). Cartridge text supplies
resource-band phrases (`band.<key>`), journal text, chapter titles and scene lines; projected
resource tones map to the paper palette without presenter thresholds.

Views, controls, history, return destinations and modal priority are specified once in
[Book UI](book-ui.md).

## Observability

One record format `loka-obs-v1` with a registered event name and store
(`protocol/observation.schema.json`, `protocol/event_registry.json`: `trace.run`,
`trace.command`, `content.diagnostic`, `simulation.invariant_failed`, `target.unresolved`,
`evaluation.budget_exceeded`, `kernel.decision_latency`, `agent.work`). Producers: `loka play`
and the simulator (`kernel/ts/play/obs.ts`, player words redacted, `:60`), the local authority
(the save's `trace` and `observation` tables, [save.md](save.md#the-game-trace)), and the PM's
`docs/dev-evidence.jsonl` (one `agent.work` line per role per PR; checked in
`test/loka/core/registries_test.exs` "docs/dev-evidence.jsonl holds only unique canonical
agent.work records"). Observation is never authority: a trace or observation write failure
never changes a decision, a commit or a retry (`mobile/authority/local-story/trace.ts:59`).

## Checks and CI

Every check, its planted violation and the CI workflows: [CHECKS.md](../CHECKS.md).
During the [mobile verification pause](../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md),
automated gates cover the Elixir and TypeScript kernels, including the Node game simulator,
and documentation. Native builds, Hermes mobile bundles and mobile source checks are deferred.
`bin/check_all.sh` is the local line and what pre-push runs (`.githooks/pre-push`, TypeScript
checks only when a pushed ref touches TypeScript inputs).

## Elapsed session driver

The local authority/session owns elapsed accounting and one retained player reservation
([save](save.md#durable-elapsed-sessions)). Its shared session notifications follow the
[Book boundary](book-ui.md#shared-elapsed-statuscompletion-boundary). The renderer receives no
World, SQLite handle or elapsed entry.

The App owns one AppState listener and one `setTimeout` chain per current Game, registered
before the font-loading return. Active entry requests resume; catching-up debt yields to the
next host turn, and ready active sampling uses a 250ms host responsiveness cadence. The first
inactive transition cancels wakeups and requests pause once, without unbounded draining.
There is no background-execution promise: resume accounts absence from the durable wall anchor.
Cleanup and Game/session identity invalidate old callbacks; the authority additionally checks
the durable run. Fast Refresh cleans the previous global chain before installing its owner.

The AppState listener requests one synchronous resume pulse on active entry, before another
player press can arrive, then schedules the single chain. The private driver obligation follows
[durable reservation accounting](save.md#durable-elapsed-sessions): a retained player or clock
candidate can consume the pulse without consuming resume. Existing active/reservation entry
captures the remaining wall evidence only after receipt/freshness preflight and prerequisite
settlement. A press never performs a pre-pulse plus invoke. Catching-up debt yields to the next
host turn. Unknown-save, fault, error or replacement stops wakeups. Active re-entry and Game
replacement are retry entries; a confirmed user retry or matched terminal completion may
re-arm the same chain. A healthy confirmed catching_up retry also re-arms to finish retained
debt. Conflict, invalid, stale or fault replies alone never certify recovery. The same Shell
callback cancels already queued wakeups on observed blocked status; it schedules recovery on
a host turn, never recursively pulses from a completion or creates a Book-owned chain.

The consumer composes with confirmed subscriptions, fixed input horizons, ordered schedule
recurrence and changed-row saves. [B2 policy](../decisions/pm-decision-m1-b2-lifecycle-2026-10-04.md)
records bounded parallel authoring and the separate controlled native proof requirement.
