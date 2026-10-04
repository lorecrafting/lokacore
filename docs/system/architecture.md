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
`tsc` to fail). Rules live only in `kernel/ts/src/rules/<capability>.ts`, one per capability
that owns a command, bound in the rule table `RULES` (`kernel/ts/src/world.ts:34`); the lint
rules `lint/rules/ts-rule-*.yml` keep them there, pure, importing only kernel modules and
registered only as `<module>.decide`. The typed `Rule<C>` contract limits a rule to its own
commands and events (`kernel/ts/src/decision.ts:192`), and admission re-checks event ownership
(`kernel/ts/src/proposal.ts:285`).

| Module | Role |
|---|---|
| `world.ts` | `step`: routes a command to its capability's rule, admission, budgets, adopt (`:77`); `INSTALLED` (`:63`) |
| `proposal.ts` | the whole proposal of one decision: root, quest deliveries, reactions, due jobs; composition and adoption |
| `compose.ts`, `apply.ts` | StateDelta composition over an overlay; the state after it |
| `decision.ts` | `World`, `State`, the `Rule` contract, IdSource allocator, event and acceptance helpers |
| `fresh.ts` | a new world from a loaded cartridge |
| `actions.ts`, `dialogue.ts`, `quest.ts`, `reaction.ts`, `behavior.ts`, `resource.ts`, `fact.ts`, `policy.ts`, `target.ts` | what rules, admission and the GameView share |
| `view.ts` | the GameView projection |
| `invocation.ts` | the authority boundary: identify an ActionInvocation, resolve it to a Command |
| `cartridge*.ts` | the artifact loader and its stages |
| `canonical.ts`, `sha256.ts`, `int.ts`, `rng.ts`, `id_source.ts`, `validate.ts`, `invariants.ts` | the portable foundation, twins of `lib/loka/core` |
| `contracts.gen.ts` | generated from `protocol/` by `bin/contracts.exs`; never hand-edited |

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
- **The phone app** (`mobile/app/App.tsx`): bundles the Lantern known answer
  (`protocol/fixtures/cartridge_lantern_hash.json`), opens one expo-sqlite file per story
  (`loka-lantern.db`, `:31`), plays through `localSession` with the device clock for latency
  (`:50`), and draws the book UI or the save-error screen.
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

The room and Map pages show each exit's adjacent sight and legal door actions. Carrying
separates held items from worn slots; item pages expose projected reachable contents and
legal container/equipment actions. Same-room item actions retain the open page while its
item remains projected; leaving the room or losing that item closes it. Position is shown
in the status line, with the offered stand/sit/rest/sleep controls on Character.

A declared chapter opens a title page on launch and when its index changes, once per
presenter session. A running modal scene takes precedence, drawing its persisted current
line and only its offered Continue action; ordinary book controls and NPC menus are hidden.
A simultaneously reached chapter title waits until the scene ends. Dismissing a chapter
page changes only presentation. World-clock, safety and interruption integration remains
future work under the [reading-time decision](../decisions/owner-decision-reading-time-2026-10-03.md).
Touch and Simulator acceptance follows [C1 slice 12](../decisions/owner-decision-chapter-one-plan-2026-10-02.md#12-c1-touch-the-phone-draws-the-new-gameview).

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
