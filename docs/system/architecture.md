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
| `mobile/authority/remote-realm/`, `mobile/features/*`, `mobile/packages/*` | Realm transport, Story and Realm UX, shared packages: `export {}` stubs that pin the import rules | empty |
| `protocol/` | the frozen contracts, registries and fixtures both kernels validate against ([map](../../protocol/README.md)) | frozen |
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
admission re-checks event ownership (`runtime/proposal.ts:285`). The `ts-rule-*` lint rules
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
proposal. Cartridge definitions supply concrete actors, places, numbers and story
combinations. Capability code does not special-case a chapter or NPC or call another
mechanic's player verb; existing spec-required dependencies remain named exceptions.

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

## Two kernels, one semantic contract

The foundation (encoding, hash, integers, RNG, ids, composition, validation, the
`elixir_and_typescript` invariants) is built in both languages and held to the frozen fixtures
(`numeric-vectors.json`, `adverse-cases.json`, `composition.json`), then to each other:
`test/loka/core/compose_test.exs` "differential: Elixir and TypeScript compose identically" and
"differential on 300 simulator proposals" call the TypeScript peer (`:353`). Story rules are
TypeScript-only (ADR-074, [AGENTS.md](../../AGENTS.md)); `bin/contracts.exs` fails on an
Elixir host adapter for a `portable_capability` without a declared differential (`:10`,
`:100`). The compiler and the loader are checked against each other
([cartridge.md](cartridge.md#artifact-and-loader)).

## Mobile import rules

`lint/rules/mobile-*.yml`: only `mobile/authority/local-story` imports the kernel; shared
packages never import an authority or a feature; Story and Realm code never import each other.
The app shell imports the local authority's session controller
(`localSession`, `mobile/app/App.tsx:11`); it implements `GameSession`
([owner rule](owner-rules.md#architecture-and-engine)).

## Hosts

- **`loka play`** (`bin/loka` → `kernel/ts/play/main.ts`): loads an artifact, takes typed or
  scripted commands, prints the GameView, writes a transcript and the game trace; `--replay`
  re-decides the trace's Commands and requires a byte-identical transcript (`:2`, `:287`).
- **The phone app** (`mobile/app/App.tsx`): opens the bundled story and its expo-sqlite
  save under the current [sampler binding](cartridge.md#source-layout), plays through
  `localSession`, supplies separate wall (`Date.now`) and monotonic (`performance.now`) clocks, and draws
  the book UI or the save-error screen. Elapsed accounting follows
  [durable elapsed sessions](save.md#durable-elapsed-sessions); latency remains separate.
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
view, with the freshness token captured when the button was drawn. Cartridge text supplies
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
