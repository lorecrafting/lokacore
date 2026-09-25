# Proposed ADR-074 — TypeScript-first rules until Story runs on a server — 2026-09-24

**Status: proposed, not decided.** Written by the developer agent (Claude Code, Claude
Opus) at the owner's request after Gate R3. It enters
[document 16](../spec/16-decision-register.md) only if the owner accepts it and the
amendments in "Spec changes if accepted" are reviewed. No spec text changes here.

## In plain words

Today every story rule is written twice: once in TypeScript for the phone, once in Elixir
for the server, and a harness checks that both give identical answers. Only the phone
version runs before and in the first release, which is offline-only. The server copy
is for a later feature, playing the same story online, that is scheduled for R14 or later.

This proposal: write story rules only in TypeScript until the first slice that actually
runs a story on the server. The reviewed test answers (fixtures) stay the judge of
correctness, so a later Elixir version has an exact target. Savings: an estimated 15%
of the remaining token cost to R6P. The Elixir work is postponed, not removed, unless
online play later takes a different route.

**Recommendation: accept.** Decide the online route when the trigger below fires.

## Owner's question (verbatim, 2026-09-24)

> I wonder if things would be a lot simpler if those single player storylines only used
> the typescript engine, and then online used only the elixir server engine and there is
> no cross in between them. [...] Or is it like that already right now?

After the PM's explanation: "yes draft the proposal after the gate closes".

## 1. Already true: offline and online do not mix

- Offline saves never become authoritative online: "Offline runtime state is
  user-controlled and MUST NOT be imported as authoritative MMO economy/competitive
  progression" ([03 §25](../spec/03-domain-state-persistence.md)).
- Only bounded milestone reports cross, for onboarding only, labeled
  `offline_client_report`; they "MUST NOT import currency, inventory, statistics, XP ...
  or other Realm value", and there is no first-release server replay service
  ([23 §6](../spec/23-accounts-progress-admission.md)).
- The first release bundles its chapter in the app ([PREP-03](owner-decision-prep-03-2026-09-24.md)).
  "Do not require Realm online-private deployment for launch"
  ([07 §23](../spec/07-offline-storypacks-to-mmo.md)). Its only server is the R12A
  account/progress service, which runs no story rules
  ([14 §R12A](../spec/14-implementation-plan.md)).
- The server running a story arrives at R14 ("Run the same cartridge rules online under
  OTP") and R15 (online-private), after the first release ([14](../spec/14-implementation-plan.md)).

So the owner's picture is already true for **data**. It is not yet true for **code**.

## 2. What the current plan requires, and why

- **Candidate C** ([ADR-068](../spec/16-decision-register.md), [ADR-071](adr-071-072-proposal.md)):
  rules in Elixir and TypeScript, one schema, shared fixtures, randomized differential
  testing. ADR-068's reason: the owner wanted a single Elixir/OTP server with no Node
  process beside the BEAM, and Hermes cannot run Elixir (no WebAssembly).
- **Portable Story reuse**: a Story cartridge "may later be hosted online unchanged for
  private/party use" ([05 §24](../spec/05-cartridges-content-capabilities.md)); "A player
  in the MMO launches the original cartridge as a private or party adventure"
  ([07 §17](../spec/07-offline-storypacks-to-mmo.md)), under the `online_private` and
  `party` profiles ([07 §3](../spec/07-offline-storypacks-to-mmo.md)).
- **Both kernels in gates**: R5 "Golden vectors pass through the R1-selected
  portable-rules implementation(s) and every accepted authoritative host path"; R9's
  "cross-host differential/conformance runner" ([14](../spec/14-implementation-plan.md));
  DET-02 compares "the accepted Elixir and mobile implementations"
  ([15](../spec/15-acceptance-scenarios.md)); 07 §13 runs golden vectors through "the BEAM
  authority adapter/implementation".
- **Roadmap**: R5 is "world rules the Lantern needs, in both kernels"; the harness runs
  seeded sequences "through both kernels" and each invariant has "a pure check in both
  kernels" ([ROADMAP](../ROADMAP.md)).

## 3. The proposal

**Deferred** until the trigger:
- Elixir implementations of world rules from R5 on (R5, early R7/R8 and later rules).
- The cross-kernel differential and cross-kernel simulation; Elixir twins of new invariants.

**Kept:**
- The language-neutral contracts in `protocol/`, the generated TypeScript contracts and
  the Elixir schema validator with nominal ids (Gate R3).
- The reviewed known-answer fixtures as the authority. The TypeScript kernel is held to
  them on Node, iOS and Android, so DET-02 still compares every host that runs the rules.
- The existing Elixir `canonical`, `int`, `rng`, `id_source`, `compose` and `invariants`
  code and its compose differential stay and stay tested.
- The R5 deterministic simulation, run on the TypeScript kernel and checking every
  registered invariant; the R6 fault simulation (already local-authority only);
  metamorphic tests ([09 §31](../spec/09-cartridge-lab-certification.md)).

**Trigger that reopens it:** the first slice that runs Story content on a server host
(`online_private`, `party`, Realm adventure portal, R14/R15), or any server re-verification
of offline traces, such as 23 §6's future `server_replayed_trace` or
`server_authoritative_run` evidence. That slice first decides the online route (§5).

## 4. Consequences

**Cheaper now.** Twelve rule slices (R5's 7, early R7/R8's 5) are built once; review
covers one kernel; CI skips the 10,000-sequence cross-kernel run
([envelope §3](../spec/r1-acceptance-envelope.md)). If an R6P phone measurement fails and
ADR-071's reopen condition leads to B (one Rust kernel for both hosts), no Elixir rule
code is thrown away.

**Harder later.** Porting about a dozen slices' worth of rules at once, with cold
context, costs more than building them alongside. The loss that matters most: two
independent implementations expose gaps in the spec when they disagree, and fixtures
catch only what someone wrote down. The adverse known answers
([ADR-069](../spec/16-decision-register.md)), the invariant simulation and review must
carry that job alone until the port. TypeScript habits could also leak into
semantics; the frozen numeric profile and canonical encoding, both still implemented in
Elixir, limit that.

**Did any reason for C need both kernels before R6P?** No. ADR-068's reason (one
Elixir server runtime) holds unchanged: under this proposal the server runs no Node and
no rules until the port. ADR-071's server numbers measure latency that matters only
once the server hosts rules. ADR-071 does defer two dual-kernel items to R6P and R10:
the "R1-A2 on-device differential" (it becomes an on-device fixture run) and the
maintenance comparison behind 14 §R1's rejection test ("two-implementation maintenance
cost is unreasonable for the chapter-one rule surface"), never measured; it waits for
the port.

**Unchanged.** No save import; fixtures are the authority; the ADR-072 persistence shape
and structural-sharing lessons ([AGENTS.md](../../AGENTS.md)); no disposable
single-player engine (07 §1), because the TypeScript kernel meets the same portable
contract a later host must meet.

## 5. The decision that can wait until the trigger

- **(a) Stories never run online; Realm has its own Elixir rules.** The owner's original
  idea. Parity becomes a design goal, not a byte check. Cost: the adventure portal
  (07 §17 A), online-private (07 §23, R15) and 07 §30 stages 3 and 6 are dropped, and
  shared mechanics (move, take) drift unless kept consistent by hand.
- **(b) Stories run online later via an Elixir port** held to the same fixtures, then the
  differential. Keeps 07 as written; pays the port.

Nothing built before the trigger forecloses either.

## Spec changes if accepted (not made now)

- ADR-071 text: C becomes "TypeScript rules now, Elixir rules at the trigger"; the
  on-device differential becomes an on-device fixture run. Document 16 ADR-004 and
  ADR-068 get a matching sentence; ADR-074 is added.
- 07 §4 and §13: the BEAM path joins conformance when it hosts Story rules.
- 14 R5 gate and R9 runner item: cross-host means hosts that run the rules; R14 gains
  the Elixir port and differential as build items before its playthrough gate.
- 15 DET-02 and SCR-10: compare the Elixir implementation once it exists.
- Envelope §3 already scopes the differential to "every pair of hosts that must agree"; no
  change beyond a note.
- 05 §24 and 07 §3: no change ("may later be hosted"; profiles stay).
- Spec README §5 and the §6 table (the "R1 tests C" wording); the
  [IMPORT.md](../spec/IMPORT.md) amendments list.
- Outside the spec: AGENTS.md "Candidate C" bullet; ROADMAP harness and R5 row.

## 6. Re-estimate to R6P (estimates, not measurements)

Calibration from R3 (PM's approximate counts; 8 slices incl. two stacked docs/gate PRs):
developers about 1.4M tokens, reviewers about 1.8M, so about 0.4M per slice in subagents.
PM coordination is on top and **unmeasured**. The prior estimate was 8 to 18M, most likely
13M, for about 34 slices including R3's 8 ([ROADMAP](../ROADMAP.md)).

Assumptions: remaining slices cost about what R3's did; the Elixir twin plus the
differential is 25–40% of a dual-kernel rule slice's tokens (a guess: in R3 PR 5 the
Elixir `compose` was a separate module about the size of the TypeScript one, but
spec reading, fixtures and review are not halved); slice counts stay.

| Stage | Slices | Current plan | TS-first |
|---|---|---|---|
| R4 minimal | 3 | 1.2M | 1.2M (no rules) |
| R5 | 7 + 1 | 3.2M | 2.0–2.4M |
| R6 | 5 + 1 | 2.4M | 2.4M (already local-only) |
| Early R7/R8 | 5 | 2.0M | 1.2–1.5M |
| R6P | 4 | 1.6M | 1.6M |
| **Total, subagents** | 26 | **about 10.4M** | **8.4–9.1M**, about 8.8M |

If R3 rates are off by a third either way: 7–14M against 6–12M. PM tokens are extra in
both columns. Saving: about 1.3–2.0M, roughly 15%. Calendar time barely moves: it is bounded by owner approvals and device sessions. Deferred cost, only
under route (b): an estimated 1.5–3M tokens at R14 for the port and the differential.

## Owner decision requested

1. Accept, reject, or amend this proposal (TypeScript-only rules until the trigger).
2. Not now: route (a) or (b), decided when the trigger fires.
