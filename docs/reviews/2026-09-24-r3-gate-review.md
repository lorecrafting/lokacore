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

## Cross-vendor review (Astra), relayed verbatim by the owner

Reviewed commit `5ee2aa7`, independently of the review above. The PM checked A1 against 05 §6 before forwarding it: the residency table there names six classes, including authority-host coordination and authoring/certification, which `docs/residency.gen.json` omits.

```text
PR VERDICT: CHANGES REQUIRED
GATE R3 VERDICT: NOT YET

FINDINGS:

A1 [blocker] bin/contracts.exs:97-101 (at 5ee2aa7) — The generated residency view omits two responsibility classes explicitly required by 05 §6 — Generating from the current registry produces docs/residency.gen.json with portable_semantic_foundation, portable_capability, realm_only_capability, client_presentation and unclassified, but no authority-host coordination or authoring/certification. A consumer asking where transaction coordination or compilation belongs cannot obtain that distinction from this purported architecture-level matrix. Regeneration and --check reproduce the same incomplete view.
  The cause is deriving the complete residency vocabulary from CapabilitySpec's allowed residencies: that schema correctly excludes host coordination and authoring from gameplay capabilities, but those exclusions must not remove their architecture-level responsibility classes.
  Fix: derive the full six-class residency vocabulary from a protocol-owned source independently of capability admission. Represent host/authoring responsibilities separately from capability entries, with unknown bindings explicit. Do not invent gameplay capabilities for PostgreSQL, sessions or the compiler. This is a completeness defect, not a failure of the textual drift comparison.

A2 [blocker] lib/loka/core/contracts.ex:43-52 (at 5ee2aa7) — The “Elixir portable/domain types and validators” gate row is only partially implemented — Give the toolchain the already-frozen ActionInvocation, DefinitionRef, StateDelta or GameView contracts: TypeScript receives schema-derived type declarations, while the Elixir generation loop skips these object/union contracts entirely. It generates types only for non-enum, non-constant strings. defs/0 supplies schema data and validate/2,3 returns :ok/errors; neither supplies the missing Elixir domain type mappings.
  Consequently, changing a frozen composite contract and regenerating the existing outputs still leaves no corresponding Elixir domain type artifact or mapping to check. The new ID types close part of the identity-representation gap, not the whole Gate R3 types requirement.
  Fix: provide schema-derived Elixir representations/type mappings for the currently frozen domain contracts, with the promised generation/check coverage. This does not require implementing R5 rules or generating Builder/Realm contracts. Alternatively, explicitly amend the gate before describing validators plus string-ID types as full satisfaction.

A3 [blocker] test/loka/core/compose_test.exs:54-70 (at 5ee2aa7) — The failed-commit publication requirement is represented as a return-value truth table, not exercised as a publication boundary — The helper receives an already-constructed decision and final commit status; the test compares its returned list and then checks an invariant against the fixture's literal published list. The TypeScript counterpart at kernel/ts/test/compose.test.ts:58-61 checks only those literal observations.
  Concrete escaping-event scenario: propose E → deliver E to an observer before checking the commit result → commit fails → return []. A boundary helper mutated to perform that eager delivery while retaining the current return values would satisfy these publication assertions, because neither test observes delivery history. The composition tests also do not connect their later-fault cases to an observed publication boundary.
  This is a gate-evidence defect, not a demonstrated production leak: no production commit/publication implementation exists here.
  Fix: add a small test-only sequenced boundary exercise that runs composition, injects a failed commit, and records actual observer delivery and adoption. Assert that both histories remain empty on failure and that delivery occurs only after confirmed success. Demonstrate that an eager-delivery mutant fails. Real SQLite failures, crash recovery and uncertain-outcome reconciliation can remain R6. The PR #15 review's deferral does not itself amend 14's explicit R3 fixture obligation.

A4 [should-fix] bin/red_controls.exs:19-23 (at 5ee2aa7) — The nominal-ID red control supports a narrower guarantee than the PR's owner-facing claim — It proves a definitely incompatible literal tag reaches an explicitly tag-matching receiver. It does not establish that declaring Contracts.character_id() in an @spec enforces that contract across ordinary domain APIs or map construction.
  Concrete consumer:
    @spec player_scope(Contracts.character_id()) :: map()
    def player_scope(id), do: %{kind: :player, character_id: id}
  Passing the p obtained from {:ok, p} = Contracts.party_id(valid_uuid) to this function has no tag check in the function body and returns a player-scope map containing a party tag. The generated @type/@spec declarations do not make this a compiler-enforced CharacterId boundary.
  Literal-tag patterns are useful and are not restricted to the exact red-control spelling: inferable constraints can propagate through calls and map patterns. However, Elixir 1.20.4's inference is best-effort, existing typespecs are not its user-supplied static signatures, and gradual unions with an accepted alternative need not produce a warning. “A party id cannot be passed where a character id is expected” is therefore too broad.
  Fix: state the actual guarantee, require explicit tag validation/matching at nominal domain boundaries, and test representative boundary shapes rather than treating this one red control as general nominal-type enforcement. No new dependency is automatically warranted.
  Language reference: Elixir 1.20.4, “Gradual set-theoretic types,” especially “The dynamic() type,” “Type inference,” and “Roadmap”:
  https://elixir.hexdocs.pm/gradual-set-theoretic-types.html
  The consumer above is a source-derived counterexample, not a claim that I executed the pinned compiler during this review.

QUESTIONS:

AQ1 — Can the pinned-toolchain verification retain results for a cross-module tag-matching receiver, a tag matched inside a map, the @spec-only receiver above, and a runtime-selected CharacterId|PartyId value forwarded through another function? These cases distinguish genuine inferred protection from the broader guarantee being claimed. I inspected the committed control and existing review/CI evidence; I did not rerun Elixir 1.20.4 or the complete dual-runtime suite.

AQ2 — Which boundary will convert validated wire UUID strings into tagged Elixir domain identities and convert them back? The constructors introduce tuples, while the frozen canonical protocol remains JSON. This is appropriately a first-consumer integration question, but R5 must not accidentally pass tagged tuples into canonical serialization or unwrap them early enough to lose the intended identity distinction.

GAP VIEWS:

Gap 1 — ACCEPT WITH A FIRST-USE CONDITION: null host_adapters and conformance_fixtures honestly report absent bindings; 05 §6's per-capability reporting language is SHOULD, and R5 is a reasonable binding point for unimplemented capability rules. The capability rows, effect associations and schema-description excerpts are source-derived; the generator's comparison also detects missing or stale generated files. Those properties do not cure A1's omitted architecture classes, and declared residency must never be presented as demonstrated conformance.

Gap 2 — ACCEPT AS A BOUNDED R4/R5 FOLLOW-UP: command/event/policy ownership must be recorded before compilation, dispatch or emission authorization relies on it. The current command/event schemas still provide machine-readable catalogs; missing ownership metadata does not require implementing future evaluators now. R3B's deferral must not become permission for R4/R5 consumers to infer ownership ad hoc or maintain another handwritten catalog.

Gap 3 — ACCEPT UNTIL THE SPECIFIED TRIGGER: the immutability check must exist before the first certified/published cartridge depends on a capability version. A checked-in lock known-answer fixture is not itself certification/publication. Tie the follow-up to that trigger rather than an indefinite later milestone; the lack of a published dependency is not permission to change an already-frozen constitutional contract without its amendment process.

Gap 4 — NOT ACCEPTABLE AS A COMPLETE R3 DEFERRAL: actual SQLite fault simulation and recovery belong to R6, but the failed-commit non-publication fixture obligation is explicitly in Gate R3. Supply the bounded observed-boundary evidence in A3 now, or obtain a reviewed gate amendment. A status-to-list truth table alone does not establish the temporal guarantee.

Gap 5 — ACCEPT THE ABSENCE OF PRODUCTION CONSUMERS, NOT THE CLAIMED COMPLETE TYPE COVERAGE: R3 may reserve nominal identities before R5 consumes them. That does not satisfy the missing composite Elixir type mappings in A2 or justify the compiler guarantee challenged in A4. Establish the boundary discipline before the first consumer. The small constructor-generation loop itself is proportionate; a larger abstraction or new checker dependency is not inherently necessary.

OWNER DECISIONS NEEDED:

1. Resolve the disputed R3 closure interpretation. Recommended disposition: implement A1-A3 under the current normative text. Closing R3 with fewer residency classes, reduced Elixir type output or only the publication truth table requires an explicit reviewed amendment to the relevant gate/spec obligations—not merely acceptance of a PR-body deferral.

2. Record the policy@1, target_resolution@1 and fact@1 residency choice. I support portable_capability for their gameplay evaluators; their AST/value/result contracts remain shared protocol foundations. Their inclusion in R3A does not by itself make their evaluators portable_semantic_foundation.

No additional owner decision is needed for the lesson relocation, WORKFLOW link-based deduplication or the compact generation approach. I found no additional material docs-tidy or over-engineering defect in those changes.
```

## Re-review (fix round 1)

- Commits reviewed: `9d4e894` (six-class residency view, sequenced boundary test,
  nominal-id probes), `94b15fb` (owner decisions, Gate R3 Elixir-types amendment, roadmap),
  head `94b15fb`; plus the merge `a346056` of `main` (PR #17), whose only conflict was the
  reviews index (both entries present, checked).
- Scope per the role file: each disposition, the code each fix touched, its direct callers.
- Checks: `bin/check_all.sh` in a detached worktree at `94b15fb`, exit 0 (`mix test` 113,
  `node --test` 34, 25 red controls ok, `check_docs` 79 docs / 0 broken / 0 unreachable).

### Verdicts

- **PR #16: APPROVE.** Every item verified; the new tests fail on the mutants they exist
  for; nothing open.
- **Gate R3: PASS WITH NOTED GAPS.** Astra's A1-A3 are closed under the current text or
  under the owner's recorded amendment; the remaining gaps (1-6 in the PR body) are
  deferrals 05 §6, 14 §R3B and 14 §R6 permit, each tied to its trigger.

### Dispositions

| Item | Fix | Verified |
|---|---|---|
| A1 / F2: six classes | `ResidencyClass` enum (`capability.schema.json`) with all six 05 §6 classes; `Responsibility` contract; `protocol/residency.json` with 20 rows (9 foundation with fixture paths, 7 host, 4 authoring); generator keys the matrix by the enum, not by what `CapabilitySpec` admits; each class carries `capabilities` and `responsibilities`; a docs section lists the rows | Matrix has 7 keys (six classes + `unclassified`). Mutants: a row dropped without regenerating → `--check` reports both docs stale; a fixture path that does not exist → `contracts_test` fails; `authority_host_coordination` removed from the enum → the example and residency-row tests fail. Every listed fixture is read by at least one Elixir and one TypeScript test (grep). Vocabulary is protocol-owned and independent of capability admission, as A1 asked; no host service became a capability. |
| Gap 6 (foundation fixtures declared, not proved) | Stated in the PR body: the test checks the files exist, not that both kernels read them; `id_source` shows `null` because its known answers are inline literals, not a file | Honest and sufficient for R3: the declared paths are the actual files the kernel tests load today (checked by hand), the unbound rows say `null` rather than `[]`, and the docs header says "declared, not evidence". A "both kernels read this fixture" check would be a change detector on test source; not asked for. |
| A3: observed boundary | Test-only sequenced boundary in both kernels (`compose_test.exs:71-121`, `compose.test.ts:63-102`): compose, record the commit outcome, adopt and deliver only on `committed`, in order; runs a failed commit, an unknown commit, a composition fault, then a successful commit | Planted five mutants: Elixir eager delivery before the commit check, Elixir adopt-on-any-status, Elixir deliver-on-fault, TypeScript eager delivery, TypeScript deliver-before-adopt order swap. Each fails exactly the new test. The failed and unknown cases are real (the helper receives `failed`/`unknown` after composing real ops), so this is an observed sequence, not a status-to-list table. Real SQLite faults and unknown-outcome recovery stay R6 (gap 4), which 14 §R6 and the ROADMAP place there. |
| A4 / F1 / AQ1: the guarantee | `contracts.ex:40-46` comment and `docs/lessons/contracts.md` restated; `test/loka/core/nominal_ids_test.exs` compiles six shapes on the pinned toolchain with `infer_signatures: [:elixir]` and asserts the hand-recorded warn/no-warn per shape | Recorded results (cross-module: warns; tag in a map: warns; `@spec`-only receiver: no; runtime-chosen union forwarded: no; through `Enum`: no; control: no) match this review's own probes at `5ee2aa7`. Flipping either a `true` or a `false` fails the test. The wording claims no more than the test shows and names the rule (construct at the boundary, match the tag in every domain function head). |
| A2: composite Elixir types | Owner chose Option A; amendment in `docs/spec/IMPORT.md` "Amendments since import"; decision record `docs/decisions/owner-decisions-r3-gate-2026-09-24.md`, indexed | The record quotes the owner verbatim ("And for the capaability category, whatever you recommend"; "A, go with your recommendation") and states what was recommended. The amendment says exactly what Option A offered: validators plus nominal id types satisfy the row in R3; composite types arrive with their first Elixir consumer, generated from or checked against `protocol/`; 14's text unchanged. Registered as an R5 follow-up in the PR body. |
| AQ2: wire-to-tag boundary | R5 follow-up in the PR body: one conversion place, tagged tuples never enter `Canonical.encode` | Appropriate; nothing to verify in code yet. |
| N1 | ROADMAP marks PR 6b done (#16) | Done. |
| N2 | `contracts_test.exs:231-242`: constructor set equals the TypeScript-branded set | Mutant: Elixir skips `PartyId` → three tests fail, including this one. (Dropping the `enum`/`const` guards is an equivalent mutant: no string contract carries `enum`, and the one `const` string is excluded either way.) |
| Residency of policy/target_resolution/fact | Owner: "whatever you recommend" → `portable_capability` | Recorded; matches this review's and Astra's view. |

No new findings. The fixes touched `bin/contracts.exs` (its only caller is `--check` in
`check_all.sh`, CI and the red controls, all green), `Loka.Core.Contracts` (comment only;
constructors unchanged), and test code.

## Cross-vendor re-check (Astra), relayed verbatim by the owner

Astra re-checked its own findings against fix head `94b15fb`.

```text
PR VERDICT: APPROVE WITH NOTES
GATE R3 VERDICT: PASS WITH NOTED GAPS

DISPOSITIONS:
A1: resolved — At 94b15fb, bin/contracts.exs:88-120 derives the architecture-level vocabulary from ResidencyClass, independently of CapabilitySpec admission, and separates capabilities from non-capability responsibilities. protocol/residency.json:1-119 supplies foundation, authority-host and authoring rows; docs/residency.gen.json:1 contains all six classes plus unclassified, with unbound fixtures represented as null. Host/authoring responsibilities have not become gameplay capabilities. Foundation fixture associations remain declarations rather than proof of both kernels consuming them; gap 6 remains acceptable.

A2: resolved differently but acceptable — docs/spec/IMPORT.md:50-55 and docs/decisions/owner-decisions-r3-gate-2026-09-24.md:12-19, at 94b15fb, explicitly record the owner-authorized alternative offered in the original finding: schema-driven validators plus generated nominal-ID types satisfy this R3 requirement; composite Elixir types must be generated from or checked against protocol/ with their first Elixir consumer. This resolves the gate interpretation through an amendment, not by claiming the missing composite types now exist.

A3: resolved — test/loka/core/compose_test.exs:72-122 and kernel/ts/test/compose.test.ts:63-103, at 94b15fb, invoke actual composition and observe ordered commit/adoption/delivery histories across failed commit, unknown commit, composition fault and success. Failure histories permit neither adoption nor delivery; success requires commit → adopt → deliver, with expected changes taken from the fixture. Eager delivery would leave forbidden history entries even if the helper retained its previous return values. This supplies the bounded test-only evidence originally requested; real storage failures, crash recovery and uncertain-outcome reconciliation remain R6. I inspected the mutant-sensitive assertions but did not independently rerun the reported mutants.

A4: resolved — lib/loka/core/contracts.ex:40-46 and docs/lessons/contracts.md:11-15, at 94b15fb, replace general nominal-type enforcement claims with the narrower inference guarantee, explicitly identify @spec-only and dynamic-flow limitations, and require constructor use plus explicit tag matching at domain boundaries. The documentation no longer represents typespecs alone as enforcing CharacterId/PartyId separation.

AQ1: resolved — test/loka/core/nominal_ids_test.exs:18-68, at 94b15fb, retains all four requested probes: cross-module tag matching warns; tag matching inside a map warns; the @spec-only receiver does not warn; the runtime-selected CharacterId|PartyId forwarded through another function does not warn. It also retains Enum-flow and correct-ID controls and explicitly enables signature inference for the probes. Head CI run 36101358446 passed the pinned Elixir tests, TypeScript tests and generated-output drift check. This verification used source inspection and existing head CI, not a local pinned-toolchain rerun.

AQ2: resolved differently but acceptable — Concrete wire/domain conversion remains a first-consumer integration task, not implemented R3 behavior. At 94b15fb, contracts.ex:40-55 and docs/lessons/contracts.md:11-15 establish construction and explicit tag-matching discipline; PR #16's “Follow-ups (R5)” records a single wire/tag conversion boundary, forbids tagged tuples entering Canonical.encode, and requires unwrapping only at that boundary. Acceptable for this gate, but the first consumer must implement and test that boundary before relying on nominal-ID protection.

NEW FINDINGS: none

OWNER DECISIONS NEEDED: none
```
