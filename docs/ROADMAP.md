# Roadmap to the first playable build

Planning, not spec: document 14 (with [pre-release-proof.md](spec/pre-release-proof.md))
sets the gates; this page is the current slice plan toward R6P ("The Ferryman's Lantern").
Slices follow [the delivery workflow](WORKFLOW.md). The owner approved six R3 PRs,
compile-time Elixir contracts and the verification harness below
([record](decisions/owner-decision-roadmap-2026-09-24.md)); the later slice counts and the
estimate are the PM's planning, not owner decisions.

## Verification harness (adopted 2026-09-24)

The reviewed known-answer fixtures stay authoritative (two kernels can agree on a wrong
answer); around them, an automated harness every change must pass; review is a fast
filter on top. Adapted from Datadog's
[harness-first write-up](https://www.datadoghq.com/blog/ai/harness-first-agents/).

- **Invariants are registered data** ([protocol/invariants.json](../protocol/invariants.json), since R3). Each spec invariant (for example one
  container per item, 03 §23; no proposed event escapes a failed commit, 04 §5.1; a retry
  replays its receipt and never rerolls, 03 §14) gets a stable ID, its spec citation and a
  pure check (foundation invariants in both kernels; rule invariants in TypeScript,
  [ADR-074](decisions/adr-074-ts-first-proposal.md)). Tests and the simulator check
  invariants by ID.
- **Deterministic simulation (R5).** Seeded random command sequences run through the
  TypeScript kernel headless on Node; every step records canonical bytes and checks every
  registered invariant. The differential compares the foundation across both kernels and
  the TypeScript hosts (Node bytes replayed on Hermes; a device sample at R6P). A
  failure reproduces from its seed and is shrunk to a minimal case. Seed counts follow
  the [envelope's differential target](spec/r1-acceptance-envelope.md) (every fast CI run).
  Built in the R5 +1 slice: `kernel/ts/test/sim.ts`, its seeds in `sim_seeds.json`; its real
  proposals feed the compose differential (`test/loka/core/compose_test.exs`).
- **Fault simulation (R6).** The same runs through the local authority with injected
  host faults: failed commit, unknown commit outcome, kill after commit before reply,
  duplicate delivery. Storage faults are real SQLite faults (AGENTS.md).
- **Owner attention goes to invariant lists and harness changes**, not line-by-line code.
- Later (R14, optional): a networked telnet/SSH terminal adapter for `loka play` once the
  online server exists (SSH or a browser terminal; plain telnet is unencrypted).
- Later (with NPC behaviors or the online server): puppeting, a player controlling an NPC's
  body. Needs a control-permission policy at the authority, body-versus-player state scope,
  pausing the NPC's behaviors (21 §10 arbitration), a GameView from the body's perception
  and displayed identity online ([owner decision](decisions/owner-decision-puppeting-2026-09-25.md)).
- Later (with the online work): player-written descriptions ([owner decision](decisions/owner-decisions-r5-s4-2026-09-25.md)).
- Not now: TLA+ (revisit for Realm handoff and cross-authority effects, R14/R20) and
  production telemetry loops (no production yet; phone timing at R6P is the stand-in).

## Slices

| Stage | Slices | Content |
|---|---|---|
| R3 to R5 | 8 + 3 + 1 + 11 | Done; Gate R3 and Gate R5 passed ([R5 review](reviews/2026-09-30-r5-gate-review.md)). Slice lists, PR numbers and the R5 owner decisions are in [the archive](ROADMAP-archive.md). |
| R6 | 5 + 1 | the [14 §R6](spec/14-implementation-plan.md#r6--offline-authority-and-save-system) build list as R6P needs it (including the fake synchronization adapter); plus fault simulation. DEFERRED from R5: the first `evaluation.budget_exceeded` producer and its registration ([04 §5.4-5.5](spec/04-command-event-effect-protocol.md#54-bounded-causality-and-durable-waiting)): the kernel reports which limit ran out, and the local authority, `loka play` and the simulator emit it. `loka play` and the simulator already carry genuine ReplayIds (`kernel/ts/play/run.ts`), so 04 §5.4 applies to them now; the rule is dormant only because no R5 content reaches a budget |
| Early R7/R8 | 5 | one quest, a dialogue choice, a schedule, reactions, narration (TypeScript); DEFERRED from R5 (Gate R5 reports them as deferred, not missing): keys that break on a failed force and locked containers from 00 §4.4 (the door commands gain an optional target), a policy leaf reading resources, positions and their regeneration bonuses, one-way and bent door passages, loosening the loader's rejection of a keyless locked door whose far room is reachable another way, `equipment@1` and `attributes@1` (`release-scope.json` phase R5, first needed by chapter one), and spawned-entity provenance (`EntityOrigin`, with the first spawner); `knock` and map discovery/`where` wait for chapter one (R10) ([owner decision](decisions/owner-decision-r5-deferred-mechanics-2026-09-28.md)) |
| R6P | 4 | compiled Lantern cartridge, touch UI, device and human proof. DEFERRED from R5, landing before the compiled Lantern: install `target_resolution@1` with its `target_present` policy leaf (resolution itself is built, `kernel/ts/src/target.ts`); this needs both the `RULELESS` entry in `kernel/ts/src/world.ts` and the leaf in `holds()` (`kernel/ts/src/policy.ts`), since the entry alone lets a cartridge using the leaf load and then crash the game instead of faulting; DEFERRED from R5: graceful handling of a lookup over `selector_cardinality` candidates (today `resolve` throws, 04 §5.3, and `loka play` refuses it), either an overflow outcome in `TargetResolution` and in the `target.unresolved` observation's outcome list, or a loader bound with a new diagnostic code in both kernels, chosen when real content needs it; the UI slices and GameView v2 take [the room view's GameView needs](design/room-view/README.md#gameview-needs) as input |
| Playtest and tune | open | after R6P, ended by the owner ([owner decision](decisions/owner-decision-playtest-2026-09-25.md)): the owner plays on the phone; the PM batches the notes into small PRs: number tuning and UI styling (short review), changed or new mechanics and behaviour (normal slices, spec first). Terminal playtests with `loka play` run from R5 S6b on. The rule that a format change never breaks installed content starts at the first release to real players |

Token estimates and the re-estimates are in [the archive](ROADMAP-archive.md).
