# Gate review: R3 (PR #16 "R3 PR 6b") and Gate R3 as a whole

- PR: [#16](https://github.com/lorecrafting/lokacore/pull/16), branch `r3-pr6b-gate`
- Commit reviewed: `5ee2aa7` (one commit on `main` at `4e8f40b`)
- Reviewer: Claude Fable 5.1, fresh session; authored none of R3. Fable because this is a
  gate review ([WORKFLOW](../WORKFLOW.md), "Fable reviews design judgment").
- Depth: full for the PR (its self code-review had run against `main`, so it is treated as
  having had no correctness pass) and broad for the gate.
- Spec read first: 14 §R3, §R3A, §R3B, Gate R3; 05 §6 (vocabulary, version immutability,
  residency matrix), §7; 03 §6; 21 §3.2, §3.3; 00a §1 (the capability list). Then the R3
  review records (`2026-09-24-r3-*`) and the bodies of PRs #4, #9, #11, #12, #13, #14, #15.
- Checks: `bin/check_all.sh` in a detached worktree at `5ee2aa7`, exit 0 (`mix test` 109,
  `node --test` 33, `contracts.exs --check`, red controls, both xref gates, Credo, both size
  checks, ast-grep and lint red controls, `check_docs` 74 docs / 0 broken / 0 unreachable,
  Prettier, mobile `tsc`). Mutants and type-checker probes in a second throwaway worktree;
  both removed afterwards.

## Verdicts

- **PR #16: APPROVE WITH NOTES.** Two should-fix items, both documentation edits (F1, F2),
  two nits. No code defect found; every new check bites on its planted case.
- **Gate R3: PASS WITH NOTED GAPS.** Every R3A item, every R3B envelope and every Gate
  bullet is satisfied on `main` plus this PR. The PR's five gaps are acceptable deferrals
  under 14's and 05 §6's own text; this review adds a sixth (the residency matrix lists
  registered capabilities only, F2). Nothing needs an owner decision to close the gate;
  the residency classification (owner question 1) is a low-stakes, reversible naming call
  on which this review agrees with the PR.

## Requirements written down before reading the diff

From 14 Gate R3, 05 §6 and 03 §6:

1. From the constitutional registries, tooling generates or checks: Elixir portable/domain
   types and validators; TypeScript ActionInvocation/GameView/content types (authority
   Command types only where the local adapter needs them); capability/schema docs and help
   excerpts; canonical test fixtures; a machine-readable capability/residency matrix.
2. The fixture suite proves StateDelta conflict/composition behavior and that proposed
   DomainEvents cannot escape before a failed commit.
3. No handwritten duplicate portable command/event/GameView catalogs.
4. Nothing for Builder/MCP operations or the Realm network protocol.
5. 05 §6: the residency view distinguishes (at minimum) the six classes; for every
   registered capability version tooling SHOULD report portability, residency, host
   adapters and conformance fixtures; declared residency must not read as evidence of an
   implementation (Astra, #12 view 3); with dual implementations the map "identifies every
   semantic contract that requires golden cross-host parity".
6. 03 §6: world-context, authority-domain, shard and realm identities "MUST NOT be
   interchangeable"; R3 "must reserve distinct nominal contracts". Astra AQ2 (#9, #13,
   #15): Elixir needs a minimal generated tagged/opaque representation before the gate,
   or an explicit gate amendment.
7. Every R3A bullet has a `protocol/` contract; every R3B family has a reserved envelope
   with a freeze milestone; the three null residencies are classified.
8. Docs tidy (WORKFLOW "Milestone gate"): no fact stated twice, no stale lesson, no
   catch-all, across docs changed in R3 (not spec, reviews or decisions).

## PR #16: what was verified

**Generator and drift check** (`bin/contracts.exs:88-160, 176-189`). Read in full. The
matrix is keyed by every residency value the `CapabilitySpec` enum admits plus
`unclassified` (5 keys: `portable_semantic_foundation`, `portable_capability`,
`realm_only_capability`, `client_presentation`, `unclassified`; 37/0/0/0/0 entries).
Effects per capability come from `effect_registry.json` `allowed_origins`; nothing else is
hand-typed. The docs table only carries keys and enum values, so no cell can contain a
pipe; the one description with a pipe (`TargetResolution`) lands in a bullet, where it is
harmless. All 108 `$defs` have descriptions; the two `AdmissionResult` variants without one
render as bare bullets. `--check` now reports every stale target before exiting 1.

**Nominal ids** (`lib/loka/core/contracts.ex:40-52`). 31 constructors, generated at compile
time from the same predicate `bin/contracts.exs:16-18` uses for TypeScript brands
(`type: string`, no `enum`, no `const`). The constructor validates, then tags. Elixir 1.20.4's
type checker under `--warnings-as-errors` was probed with ten shapes (planted in
`lib/loka/core/red_control.ex`, compiled with `--force`):

| Shape | Rejected? |
|---|---|
| A. red control's exact shape (constructor, then `scope({:character_id, _})`) | yes |
| B. through an intermediate function with no pattern on its argument | yes |
| C. through a function in another module | yes |
| D. tag inside a map field, matched by `%{actor: {:character_id, _}}` | yes |
| E. `with {:ok, p} <- party_id(v)` | yes |
| F. ids collected with `Enum.map`, consumed with `Enum.map(ps, &scope/1)` | **no** |
| G. hand-built literal `{:party_id, v}` | yes |
| H. returned from a project function, then matched | yes |
| I. stored in a tuple, destructured, then matched | yes |
| J. consumer uses a guard (`elem(t, 0) == :character_id`) instead of a pattern | yes |
| K. control: correct `character_id` flow | compiles |

So the protection is robust for direct flows in project code, including across function
and module boundaries, and fragile through higher-order standard-library functions (and,
by the same mechanism, through anything read out of a canonical JSON map, which is
`dynamic()`). See F1.

**Mutants run** (each restored afterwards):

| Mutant | Result |
|---|---|
| Constructor skips `validate` | `contracts_test` fails |
| Every constructor tags `:character_id` | `contracts_test` fails; nominal red control FAILS (planted misuse compiles) |
| Constructor returns the bare value (no tag) | nominal red control FAILS |
| `--check` silently skips the `docs/` targets | new docs red control FAILS ("expected docs/contracts.gen.md is out of date") |
| Gate: `no_proposed_event_escapes` treats a failed commit as committed, Elixir | `compose_test` invariant known answers fail |
| Gate: same mutant in `kernel/ts/src/invariants.ts` | `node --test` fails: "published after failed commit" |
| Gate: cross-group `conflicting_write` no longer faults (Elixir) | composition known answers and the differential fail |
| Random earlier-PR check (`$RANDOM` picked the #14 `allowed_origins` subset test): plant `narrator` | `contracts_test` fails |

The composition fixture holds 59 cases (40 fault, 19 changes; 7 `conflict-*`), the
publication section covers committed / failed / unknown commit and rejected / fault
decisions, and `target_candidates_ordered` has two holding and two violated observations
(Astra #13 V1's precondition for the gate).

**Docs tidy.** The `>32 keys` lesson now lives only in `docs/lessons/contracts.md`;
WORKFLOW step 7 links to AGENTS.md instead of restating the lesson-placement rule; the
stale "join by name once their registries exist (R3 PR 3)" sentence is replaced by the
fact; AGENTS.md is 1,678 words of a 2,500 budget; no other forward "PR N" reference
remains in `protocol/` or the docs. ROADMAP: see N1.

## Findings

### F1 (should-fix) `lib/loka/core/contracts.ex:40-42`, `docs/lessons/contracts.md`: the stated guarantee is wider than the check

The comment says `mix compile --warnings-as-errors` "rejects one tag where another is
matched". Probe F above compiles: ids collected through `Enum.map` (or read from a decoded
canonical map, the input of every R5 rule) are `dynamic()`, and the misuse is not seen.
Failure scenario: an R5 rule gathers party ids with `Enum.map`, hands the list to a helper
matching `{:character_id, _}`; it compiles, and fails at run time with a
`FunctionClauseError` (fail-closed, but not the compile-time rejection the comment and the
PR body promise). Fix: one sentence in the comment and one bullet in
`docs/lessons/contracts.md` naming the limit (the check holds where the type flows through
patterns and returns of project code; through `Enum`, `Map` and decoded JSON it is
dynamic, so apply the constructor at the boundary and match the tag immediately). No code
change; the red control's shape is the right one.

### F2 (should-fix) `bin/contracts.exs:88-112`, `docs/residency.gen.json`: the matrix lists registered capabilities only; the foundation row is empty and its existing fixtures are invisible

05 §6 gives the residency map a second job under dual implementations: it "identifies
every semantic contract that requires golden cross-host parity". The contracts that carry
that obligation today (canonical encoding, hash, IdSource, RNG, integers, CommandId,
StateDelta composition, the invariant checks) are the `portable_semantic_foundation` row's
contents, have real fixtures (`docs/spec/conformance/*`, `protocol/fixtures/*`) and both
kernels, and appear nowhere in the matrix, whose every `conformance_fixtures` is `null`.
Failure scenario: an R5 developer opens the matrix to learn which contracts need golden
parity fixtures and finds 37 capabilities with none listed and an empty foundation row.
Smallest fix: name it as gap 6 in the PR body and checklist ("the matrix covers
registered capabilities; foundation contracts and their fixtures are not registry entries
and are not listed"), and add that sentence to the generated header string
(`bin/contracts.exs:129-130`). Populating the row is R5 work, when capability rules exist
and the binding shape (05 §6 "host adapters, conformance fixtures", #12 question 3) is
decided. This does not block the gate: 14 Gate R3 asks for a "capability/residency
matrix", which exists.

### N1 (nit) `docs/ROADMAP.md:36`: "Open: PR 6b" is stale the moment this PR merges

The tidy pass's own rule. Mark it done with `#16` in this PR (the PM can do it at merge).

### N2 (nit) `bin/contracts.exs:16-18` and `lib/loka/core/contracts.ex:43-44`: the brand predicate lives twice with nothing tying them

The PR's ponytail note kept it (sharing would make the script depend on a new public
function). If one copy drifts, TypeScript brands and Elixir tags disagree silently. A
one-line test that the constructor names equal the branded names in `contracts.gen.ts`
would tie them; not required now.

No blocker. No over-engineering found: the generator is 70 lines of data-to-text with no
abstraction, the nominal ids are 14 lines, and nothing in the diff could be replaced by
stdlib or existing code.

## Gate R3: checklist verified against the code

Derived from 14 before reading the PR's table; every row checked on the branch.

| 14 item | Verified where |
|---|---|
| R3A DefinitionRef, runtime identity | `protocol/identity.schema.json` (#9) |
| Manifests, version envelopes | `manifest.schema.json` (#12); `{at_least, below}` amendment in `docs/spec/IMPORT.md` |
| Capability registry, exact lock, residency reporting | `capability.schema.json`, `capability_registry.json` (37 entries, all portable), lock hash known answer (#12); every residency classified, matrix generated (#16) |
| StateScope/AudiencePolicy; distinct world-context and authority-placement ids | `scope.schema.json`, `identity.schema.json` (#9); 31 tagged Elixir id types (#16) |
| Action/ActionInvocation | `action.schema.json` (#13) |
| Portable Command registry | `command.schema.json` (#13) |
| StateDelta algebra | `delta.schema.json` (#13); `compose` in both kernels, 59-case fixture, seeded differential (#15) |
| DomainEvent, proposed vs committed | `event.schema.json` (#13); `no_proposed_event_escapes` with committed/failed/unknown/rejected/fault cases (#15) |
| Effect registry, durability/idempotency | `effect.schema.json`, `effect_registry.json`; origins checked against the capability registry (#13, #14) |
| Core policy AST/versioning | `policy.schema.json` `VersionedPolicy` (#13) |
| TargetResolution `none \| unique \| ambiguous` | `action.schema.json`; `target_candidates_ordered` with negative cases (#13, #15) |
| Typed relation/provenance | `relation.schema.json` (#14) |
| FactSpec / scoped narrative state | `fact.schema.json`; `FactValue` anyOf (#14) |
| GameView envelope/freshness | `gameview.schema.json`, logical time added in #14 fix round |
| Portable-rules ABI (R1) and canonical/hash/IdSource/RNG/numeric | `loka-numeric-v1` frozen, owner-approved; both kernels; CommandId amendment (#4, #13) |
| Diagnostic/error registry | `error.schema.json`, `error_registry.json` (#9, #13, #15) |
| Account/run binding, milestone reports, admission | `account.schema.json` (#14) |
| R3B: the 12 envelope families | `feature.schema.json`, `feature_registry.json`: 19 kinds, each with a freeze milestone; `consequence_operator` at R5 (#11) |
| Gate: Elixir types and validators | `Loka.Core.Contracts` reads `protocol/` at compile time (#9); tagged ids (#16) |
| Gate: TypeScript types | `kernel/ts/src/contracts.gen.ts`, drift-checked; no authority Command types beyond what `contracts.gen.ts` carries for validation |
| Gate: docs and help excerpts | `docs/contracts.gen.md`, drift-checked (#16) |
| Gate: canonical fixtures | checked, not generated (AGENTS.md forbids computed expectations): schema `examples` and `invalid.json` in both kernels; `composition.json`, `command_id.json`, `capability_lock_hash.json`, `docs/spec/conformance/*` |
| Gate: machine-readable matrix | `docs/residency.gen.json` (#16); F2 |
| Gate: fixture suite proves conflict/composition and no escape before a failed commit | 7 `conflict-*` cases; publication cases; mutants above die in both kernels |
| Gate: no handwritten duplicate catalogs | TypeScript generated; Elixir validates from `protocol/`; `compose` implements each op by clause and `unknown_types_fail_closed` covers the rest; no second list of commands, events or GameView fields anywhere in `lib/` or `kernel/ts/src` |
| Non-goals: no Builder/MCP ops, no Realm protocol | `lib/loka/builder.ex` and `lib/loka_web.ex` are R2 boundary stubs; `protocol/` has no Builder operation or transport contract |

**Follow-ups addressed to 6b or the gate, and their state:**

| Source | Item | State |
|---|---|---|
| #12 body, review Q4 | classify `policy@1`, `target_resolution@1`, `fact@1` | closed (`portable_capability`) |
| #12 body | generated docs and matrix | closed |
| #12 body, Astra view 3 | version-immutability check before the first certified/published dependency | open, gap 3: nothing is published before R4 artifacts; 05 §6 binds the rule to a dependent cartridge |
| #12 Q3, Astra view 3 | host adapters / fixtures per capability; declared is not evidence | open, gap 1; the matrix says so in its header |
| #13 body, #9/#13/#15 AQ2, #13 review view 2 | Elixir nominal ids or a gate amendment | closed (tagged types; F1 for the limit) |
| #13 body | `allowed_origins` subset of the registry | closed (#14) |
| #13 body, Astra V8 | publication only after confirmed commit, failed and unknown cases | closed at fixture level (#15); stateful model is R6, gap 4 |
| #13 Astra V1 | distinctness/order checks with negative fixtures before the gate | closed (#15) |
| #13 Astra V5 | `FactValue` coordinated with FactSpec before the gate | closed (#14) |
| #15 A2, A5, A1 invariant, Q5 | R5 follow-ups | not addressed to 6b; registered in #15 |
| #15 A3 | commit-boundary fault simulation | R6, gap 4 |
| #14 follow-ups | narration survival, save header, rejection codes | R6/R7; not addressed to 6b |
| #11 review N | roadmap: PM split vs owner decision | closed (ROADMAP says so) |

**Gap assessment.** Gaps 1-5 in the PR are acceptable deferrals: 05 §6 makes adapter and
fixture reporting a SHOULD and ties immutability to a published dependency; 14 §R3B
freezes feature detail with its first use; 14 §R6 and the ROADMAP place fault simulation
at R6; and the tagged ids have no consumer until R5 rule code exists. Gap 6 (F2) is the
same kind. None needs the owner.

## Plain language for the owner

**Where do policy, target resolution and facts live?** The engine keeps a map of "who
runs what". Two rows matter here: the *foundation* (the engine's own arithmetic: how
values are encoded, how changes combine, how randomness and ids are made) and *portable
capabilities* (game rules that must behave identically on the phone and on the server:
movement, quests, dialogue, and so on). The PR files policy evaluation, target resolution
and facts under the second row. This review agrees: chapter one (00a §1) already lists
all three as capabilities the cartridge requires, 05 §6 says capabilities own their
policies and rules, and the foundation row is about value types and mechanics, not
game-facing rules. The #12 reviewer's "foundation" reading rested on these being
constitutional contracts; their *contracts* are constitutional either way, the question
is only where their *evaluators* sit. It is a naming choice with no effect on any hash or
frozen format (the lock records keys and versions only), so it can be changed in a
one-line registry edit if R5 shows otherwise. Recommendation: accept.

**Can R3 be declared closed?** Yes, with the noted gaps. Every contract 14 asks for exists
as a machine-readable file, both kernels validate against the same source, the generated
TypeScript, docs and matrix are drift-checked in CI, the fixture suite proves the
composition rules and that nothing is published after a failed or unknown commit, and
the checks were shown to fail when the logic is broken. What is deferred is honest and
small: the matrix has empty slots waiting for real implementations, the "an old version
may never change meaning" check waits for the first published cartridge, and the
fault-injection run waits for the real save system (R6).

**What the owner must decide.** Nothing to close the gate. Two answers would be welcome
when convenient:
1. A nod on the residency classification above (owner question 1 in the PR).
2. The owner questions still parked in earlier PR bodies. Truly the owner's: #13 Q1
   (how ambiguous targets are ordered: by id, or inventory-then-room like classic MUDs;
   a one-line change either way) and #14 Q1 (dotted fact names like `village.child_status`
   are mapped to keys by the compiler, with a collision error). The rest (#11 Q1-Q3, Q5;
   #13 Q4-Q8; #14 Q2-Q5) are engineering calls the earlier reviews found the spec already
   answers; the PM can settle them and record the settlement.
