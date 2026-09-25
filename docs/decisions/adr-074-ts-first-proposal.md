# Proposed ADR-074 — TypeScript-first rules until Story runs on a server — 2026-09-24

**Status: proposed, not decided.** Written by the developer agent (Claude Code, Claude
Opus) at the owner's request after Gate R3; revised after review
([record](../reviews/2026-09-24-adr-074-ts-first-review.md)). It enters
[document 16](../spec/16-decision-register.md) only if the owner accepts it and the
amendments in the appendix are reviewed. No spec text changes here.

## In plain words

No story rule has been written yet. The current plan writes each new rule twice, in
TypeScript (the phone) and Elixir (the server), and checks that both agree. Only
TypeScript runs the game in the first release; Elixir would run those rules only in
tests until online story play (R14 or later). The first release does have a small Elixir
account server, but it runs no story rules.

The proposal: write new story rules only in TypeScript until something on a server
first needs them, and keep the reviewed test answers as the judge of correctness.

It saves about 1.2–1.9M tokens before R6P. If stories later go online through an
Elixir copy, that copy costs about 1.5–3M or more, so **the total goes up**. What you
buy is time and the freedom to change course. The strongest argument against it is in §4.

**Recommendation: accept, unless you are sure stories will go online; then writing
both now is cheaper overall and safer.**

## Owner's question (verbatim, 2026-09-24)

> I wonder if things would be a lot simpler if those single player storylines only used
> the typescript engine, and then online used only the elixir server engine and there is
> no cross in between them. [...] Or is it like that already right now?

After the PM's explanation: "yes draft the proposal after the gate closes".

## 1. Already true: offline and online do not mix

- Offline saves "MUST NOT be imported as authoritative MMO economy/competitive
  progression" ([03 §25](../spec/03-domain-state-persistence.md)).
- Only bounded milestone reports cross, for onboarding only, labeled
  `offline_client_report`; no first-release server replay service
  ([23 §6](../spec/23-accounts-progress-admission.md)).
- The first release bundles its chapter ([PREP-03](owner-decision-prep-03-2026-09-24.md));
  "Do not require Realm online-private deployment for launch"
  ([07 §23](../spec/07-offline-storypacks-to-mmo.md)). Its server is the R12A account
  service ([14 §R12A](../spec/14-implementation-plan.md)).
- A server runs a story from R14 ("Run the same cartridge rules online under OTP") and
  R15 (online-private).

So the owner's picture is already true for **data**, not for **code**.

## 2. Why the current plan writes rules twice

Candidate C ([ADR-068](../spec/16-decision-register.md), [ADR-071](adr-071-072-proposal.md)):
the owner wanted one Elixir server with no Node process beside it, and Hermes cannot run
Elixir. And stories are meant to go online unchanged
([05 §24](../spec/05-cartridges-content-capabilities.md); "A player in the MMO launches
the original cartridge as a private or party adventure",
[07 §17](../spec/07-offline-storypacks-to-mmo.md)). The gates that assume two kernels are
in the appendix.

## 3. The proposal

The split follows the residency classes of
[05 §6](../spec/05-cartridges-content-capabilities.md) and `docs/residency.gen.json`.

**Stays in both kernels, with its differential:** `portable_semantic_foundation`:
canonical encoding and hash, checked integers, RNG, IdSource, the delta algebra
(`compose`) and the invariant registry. A new delta operator or foundation change lands
in both kernels.

**TypeScript only until the trigger:** `portable_capability` rules (R5, R7/R8 and later)
and their invariant checks.

**Where rules execute before the trigger.** R5 simulation, the R9 Lab and R11 Lab
control run the production TypeScript kernel headless (a Node test runner) against
compiled artifacts. That is authoring and certification, not server hosting, and does
not fire the trigger. The compiler stays in Elixir (`Loka.Content`,
[02 §1](../spec/02-beam-runtime-architecture.md)); tests load the real compiler's
artifact through the TypeScript path and require the same canonical bytes and hash, the
same capability lock and deterministic rejection of invalid content. R4 is unchanged.

**TypeScript host conformance is kept.** Node, Android Hermes and iOS Hermes are
distinct hosts that must agree ([envelope §3](../spec/r1-acceptance-envelope.md)): per-step
canonical bytes recorded on Node are replayed on device. The 10,000 fresh sequences plus
regression seeds run on Node every fast CI run; a device sample runs at R6P. That the
fresh sequences run on Node, not on devices, is an assurance reduction the owner
approves by accepting this. ADR-071's on-device mismatch and mutant checks, real
local-storage fault recovery and actual adapter evidence stay at R6P.

**Trigger:** the first planned server consumer of any `portable_capability` semantics:
Story content on a server host, a Realm-native cartridge using a portable capability, or
a trusted trace-verification service (23 §6 `server_replayed_trace`). Checkable: a
`portable_capability` row in `docs/residency.gen.json` gains an Elixir host adapter.
Static compilation and TypeScript test execution do not count. Before that consumer is
enabled, whatever the milestone number, the owner chooses a route (§5) and the
Elixir-versus-TypeScript conformance evidence passes.

## 4. Consequences

**Cheaper now.** Twelve rule slices are built and reviewed once; CI skips the cross-kernel
run. If an R6P phone measurement reopens ADR-071 and leads to B (one Rust kernel), no
Elixir rule code is discarded.

**The strongest argument against.** After the first certified release, a
`key@version` "is immutable in meaning" (05 §6). If a later Elixir port disagrees with
TypeScript and the spec favours Elixir, TypeScript still wins, quirks included, or a new
version is minted. Building both now finds spec ambiguities while the spec can still win.
Fixtures catch only what someone wrote down; the adverse known answers
([ADR-069](../spec/16-decision-register.md)), the invariant simulation and review are
weaker than a second independent reading.

**Harder later.** A port of many slices at once, with cold context. It must target an
explicit capability/version inventory and the retained fixtures, not whatever TypeScript
then does; an ambiguity found during the port cannot silently redefine a published
capability.

**Did any reason for C need Elixir rules before R6P?** Not for the server: ADR-068's
reason holds (no Node on the server; it hosts no rules until the trigger). ADR-071's
deferred items are dispositioned in the appendix; the 14 §R1 maintenance comparison
("two-implementation maintenance cost is unreasonable for the chapter-one rule surface")
was never measured and waits for the port.

**Unchanged.** No save import; fixtures are the authority; ADR-072 and the
structural-sharing lessons; no disposable single-player engine (07 §1).

## 5. The decision that can wait until the trigger

- **(b) Stories run online via an Elixir port** held to the fixtures, then the
  differential. Keeps the spec as written; pays the port.
- **(a) Stories never run online; Realm defines its own mechanics.** The owner's
  original idea, but a larger change than (b): it drops or amends 07 §1 ("the same
  compiled cartridge definitions ... run in both places"), 07 §17 (portal, embedded
  regions, shared areas), 07 §23 and §30 stages 3 and 6, 05 §24, the R14 gate
  (offline-matching playthrough), R15, R18 ("same packs can launch from shared hub") and
  R19 (Story instancing). Realm may define *separately named* mechanics with their own
  keys; a different Elixir meaning under an unchanged portable `key@version` is not
  allowed (05 §6). Independent Realm party or instancing features are unaffected.

## 6. Re-estimate to R6P (estimates, not measurements)

R3 (PM's approximate counts; 8 slices incl. two stacked docs/gate PRs): developers about
1.4M, reviewers about 1.8M, so about 0.4M per slice in subagents. PM coordination is on
top and **unmeasured**. The prior estimate was 8–18M, most likely 13M, for about 34 slices
including R3's ([ROADMAP](../ROADMAP.md)).

Assumptions: 0.4M per remaining slice; the Elixir twin plus differential is 25–40% of a
rule slice (a guess); the R5 simulation slice is not discounted; slice counts stay.
Saving = 12 rule slices × 0.4M × 25–40% = 1.20–1.92M.

| Stage | Slices | Current plan | TS-first |
|---|---|---|---|
| R4 minimal | 3 | 1.2M | 1.2M |
| R5 | 7 + 1 | 3.2M | 2.08–2.50M |
| R6 | 5 + 1 | 2.4M | 2.4M |
| Early R7/R8 | 5 | 2.0M | 1.20–1.50M |
| R6P | 4 | 1.6M | 1.6M |
| **Total, subagents** | 26 | **10.4M** | **8.48–9.20M** |

Caveats: R3 was about 56% review, and reviewing one kernel is not half the review, so
25–40% may be optimistic; rule slices carry fixtures and simulation that contract slices
did not; a third either way on R3's rate gives 7–14M against 6–12M. Re-estimate after the
first two R5 slices. Calendar time barely moves (owner approvals, device sessions).

Deferred port under route (b): an estimated 1.5–3M for **the R6P (Lantern) rule subset
only**. Full chapter-one R7/R8 rules and any later Story semantics built before the
trigger are **unestimated** and add to it.

## Owner decision requested

1. Accept, reject, or amend: TypeScript-only `portable_capability` rules until the
   trigger.
2. Not now: route (a) or (b), decided before the first server consumer is enabled.

## Appendix: applicability crosswalk (the amendments if accepted)

"Deferred" means deferred to the trigger. Historical failed and unmeasured results stay
recorded as they are.

| Obligation | Disposition |
|---|---|
| ADR-004, ADR-068 (16); ADR-071 selection text | Amend: C's Elixir rules arrive at the trigger; add ADR-074 |
| ADR-071: on-device differential | Replaced: Node-recorded per-step bytes replayed on Hermes (§3) |
| ADR-071: on-device mutant check, iPhone timing, R6P phone rows | Retained |
| ADR-071: 100-instance server load and scheduler, faults under load, server fault-record fixes | Deferred (no server rules before then) |
| ADR-071: §10/§11 maintenance and fault-containment comparison | Deferred |
| Envelope §3 differential ("MUST for C") | Amend: Elixir pair deferred; TS host pairs retained (§3) |
| 02 §1 | Amend: note the Lab drives the TypeScript kernel headless |
| 05 §6 last paragraph (residency lists parity contracts) | Retained; it is how the trigger is checked |
| 05 §24; 07 §3 | Unchanged ("may later be hosted") |
| 07 §4, §13 | Amend: the BEAM path joins conformance at the trigger |
| 09 §1a (DET-01..10, bots, 30-day simulation) | Retained, run on the TS kernel on Node and devices |
| 09 §5 cross-host conformance; BEAM runtime boot mode | Amend: TS hosts now, Elixir at the trigger |
| 09 §10 ("StreamData on Elixir host") | Amend: foundation only; rule properties on TS |
| 09 §31 metamorphic | Retained, single kernel |
| 10 (line ~482, "R1 tests dual ... C first") | Note only |
| 14 R5 gate; R9 runner; R10 certification | Amend: "hosts that run the rules" |
| 14 R14 | Amend: Elixir port and differential before its playthrough gate |
| 15 DET-02, DET-08, SCR-10 | Amend: TS hosts now; server host at the trigger |
| pre-release-proof.md: actual adapters, P6 parity | Retained with TS host adapters |
| Spec README §5–§6 | Amend wording; [IMPORT.md](../spec/IMPORT.md) amendments list |
| AGENTS.md: Candidate C bullet, "Writing tests", CI differential line | Amend to match |
| ROADMAP harness and R5 row | Amend |
| 04 §20 protocol tests | Unaffected: client–server message agreement, not rules |
| 14 §R1 | Unaffected: history of the R1 spike |
