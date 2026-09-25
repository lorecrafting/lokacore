# Independent review: PR #14 "R3 PR 4b: facts, relations, GameView, account envelopes"

- Reviewed commit: `bccc582` (branch `r3-pr4b-facts`, four commits on `main` at `d1b188c`)
- Reviewer: Claude Fable 5.1 (fresh agent; authored none of the work; Fable because the
  slice freezes the GameView, fact, relation and account envelopes and extends the schema
  subset)
- Date: 2026-09-24
- Depth: full (contract freeze), per [WORKFLOW.md](../WORKFLOW.md) "Review stance"
- Checks run in a detached worktree at `bccc582`: `bin/check_all.sh`, exit 0 (`mix test`
  101 tests, `node --test` 28 tests, contract drift check, red controls including the new
  anyOf control, Credo, both size checks, ast-grep, docs, Prettier, mobile `tsc`).

## What must be true (derived from the spec before reading the diff)

From 14 §R3A and Gate R3, 03 §3, §7, §11, §13, §14, §25-§27, 04 §5.2, §7, §14-§16, §19,
06 §37, §43, 21 §3.9, §4, 23 §2-§7, §11, 00 §4.10, 00a §6, pre-release-proof P5, and the
owner decisions (ids are lowercase UUIDs; `GameError.data` dropped; numeric profile frozen):

1. **Facts.** A FactSpec has a namespaced key, a versioned type with a default, allowed
   scopes and a meaning (03 §7); the chapter-one types are bool, enum and bounded int
   (00a §6). A stored fact is identified by owning context + scope + fact key (03 §13) and
   that identity equals PR 3's fact mutation target. Facts are typed, never a bag of
   string flags; `fact_changed` keeps old/new values and scope.
2. **Relations and provenance.** Relations are typed and capability-owned, never an
   untyped graph (21 §4); a runtime entity carries its own id, its DefinitionRef, and
   spawn/population provenance (21 §4, 05 §25), and is never the definition record
   (03 §3); overlay entities carry explicit scope and audience, shared ones omit them
   (03 §11).
3. **GameView.** The client gets view models, never component state (04 §14); the view is
   one host-neutral schema for Story and Realm (04 §15) with localized string ids plus
   interpolation data, resolved ActionSets, room contents, journal and current dialogue
   choices; the snapshot carries a monotonic projection sequence and an opaque
   freshness token that is neither an authority revision nor intent (04 §16, 03 §14). The
   touch layer decides no legality; it shows what GameView advertises, greyed with the
   reason (00 §4.10), with clear unavailable-action feedback and readable current state
   (P5). Human text is never parsed (04 §7).
4. **Narration.** Required narration commits with its consequence as a stable record of
   pinned text keys and bindings, redisplay is read-only, a retry may return historical
   narration plus a separately current GameView (06 §43; 04 §5.2 steps 7-8). The player
   can always close an unavailable interaction without changing its outcome (06 §43).
5. **Accounts.** Account progress is not a fifth StateScope; account ids, credentials and
   server time are host metadata outside portable inputs and the gameplay hash (23 §2,
   03 §26). A report names milestone, occurrence id, run, release, outcome and observed
   revision; authentication supplies the account, a payload label never grants authority,
   and only the server assigns an evidence class (23 §5-§6). A run pins an exact release
   and profile and binds an account once (23 §5, §11). Admission is an explicit
   conjunction of versioned requirement ids with alternative qualifying milestones;
   ungated is explicit, never an empty list; the result is eligible or typed missing
   requirements with policy and progress versions (23 §7).
6. **Subset and kernels.** Anything outside the closed subset fails compilation and
   generation; `anyOf` admits only branches of distinct scalar JSON types; the two
   validators agree on paths, codes and order; the generator emits a matching type; every
   check has a planted case that fails. Expected values never come from the code under
   test; frozen fixtures change only by a reviewed amendment; the DecisionResult
   amendment is additive (every PR 3 and PR 5 value stays valid).

## Verdict: APPROVE WITH NOTES

All six hold, with one should-fix on the sufficiency of GameView for the P5 touch path
(finding 1) and one process note on how the new fixtures were produced (finding 2, covered
here by an independent recomputation). The anyOf feature is small, closed, and the two
kernels agree on every hand-built value tried; the schemas cite real spec text and stay
inside it; the account contracts never touch StateScope or put an account in a report; the
DecisionResult amendment is additive and PR #15's composition model is not contradicted.

### Differential (Elixir vs TypeScript)

122 hand-built values decoded by each kernel's canonical decoder and run through both
validators: zero disagreements. They cover FactValue and TextValue with `true`, `1`, `"1"`,
`"true"`, `0`, `-1`, `-0`, the safe-integer bounds and one past each, `null`, `[]`, `{}`,
`[1]`, `{"a":1}`, an astral character, a 65-character Key, a 129-character TextKey, a
trailing newline, a NUL, `1.0`, `1e0`, `01` and a lone surrogate (the last four rejected at
decode by both); Text with empty, valid, uppercase, NUL-free but `/`- and `~`-containing,
64- and 65-character binding names (pointer escaping `~1`/`~0` matches), null/object/float
values and duplicate keys, plus a 42-key bindings map (over Elixir's 32-key sorted-map
threshold) mixing invalid names and values and a non-ASCII name, so error order is compared;
ScopedFact and `fact_compare`/`fact_changed` with every FactValue type; DecisionResult
narration at 0, 1, 64 and 65 lines, a bare string line, `null`, `{}`, and narration on the
rejected branch; UnavailableReason with a bound message, a string message, a missing code
and a code PR #15 adds. Observed: `-0` decodes and validates as an integer in both;
`"true"` is a valid FactValue (a Key), which the fact's FactType, not the contract, rules
out, as the description says.

### Independent recomputation of the fixtures

Because the developer says the new expected-error lists were "generated from the schemas,
then checked by hand" (finding 2), every expectation was recomputed here with a small
Python re-implementation of the documented subset (written from the `Schema` moduledoc,
not from either kernel): all 235 examples validate and 291 of 292 fixtures produce exactly
the listed errors. The one difference is a PR 2 fixture (CharacterId with a trailing
newline) where Python's `$` matches before a final newline and the kernels' dollar-endonly
regex does not; the fixture is right, the oracle is the weaker regex. Hand checks of the
non-mechanical entries (Text bindings with a bad name and a bad value at the same path
producing two `pattern_mismatch` errors at `/bindings/ `; the GameViewSnapshot with
`instance_revision`; the MilestoneReport with `account_id` and `evidence_class`) agree.

### Test the tests (mutants, each reverted)

| Mutant | Result |
|---|---|
| M1 Elixir validator: anyOf always takes the first branch | 2 tests fail (examples; fixtures) |
| M2 Elixir validator: a type miss returns no error | 1 test fails |
| M3 checker: distinct-types rule dropped | 2 tests fail |
| M4 checker: at-least-two-branches rule dropped | 1 test fails |
| M5 checker: `$ref` cycle guard dropped | the cycle test hangs and fails at ExUnit's 60 s timeout (80/81); caught, slowly |
| M6 TS validator: a type miss returns no error | fails (`fact_compare` `equals: null` fixture) |
| M7 TS validator: always the first branch | fails (`word_or_count: -1` gives `invalid_type`, not `below_minimum`) |
| M8 generator: anyOf emits only the first branch | `elixir bin/contracts.exs --check` exits 1 (drift) |
| S1 ExitView unavailable branch: `reason` not required | Elixir 1 test fails; TS fails after regeneration |
| S2 PendingChoice.choices: `minItems` dropped | 1 test fails |
| S3 DecisionResult.narration: `maxItems` dropped | Elixir 1 test fails; TS fails after regeneration |
| S4 RequirementId: `pattern` dropped | 1 test fails |
| S5 GameViewSnapshot.format: `const` dropped | 1 test fails |
| S6 MilestoneReport: `account_id` declared | 1 test fails |
| S7 AdmissionPolicy gated: empty `requirements` allowed | 1 test fails |
| S8 TextValue: boolean branch dropped | Elixir 1 test fails; TS fails after regeneration |
| S9 FactType int: `default` optional | 1 test fails |
| S10 effect registry: origin `narrator` | 1 test fails (the new origin test) |
| S11 FactSpec.scopes: `account` added | 1 test fails (only through the `["account"]` fixture; see nit 2) |
| S12 EntityIdentity: `origin` optional | 1 test fails |
| S13 GameView: `journal` optional | 1 test fails |
| S14 Text.bindings: `propertyNames` dropped | 1 test fails |

22 of 22 caught. The Elixir runs are `mix test --force test/loka/core/contracts_test.exs`
(81 tests); schema mutants reach TypeScript only after `elixir bin/contracts.exs`, which is
why the drift check matters. A schema fixture sweep of my own was not repeated; the
developer's 158-mutant sweep is consistent with the 14 sampled here.

### Spec conformance notes

- **anyOf (finding-free).** Checker `lib/loka/core/contracts/schema.ex:126-132, 180-192`:
  two or more branches, each `type` or `$ref` resolving to a distinct one of
  string/integer/boolean, `$ref` followed across files with a `seen` list; enum, const,
  oneOf, object, array, null and nested anyOf branches all resolve to `nil` and are
  rejected (11 rejected-form tests). Validator `lib/loka/core/contracts.ex:101-106` and
  `kernel/ts/src/validate.ts:108-111, 119-120` select the branch by JSON type, so `true`
  never enters the integer branch (Elixir booleans are atoms; `Number.isSafeInteger(true)`
  is false), an unsafe integer matches no branch, and `1.0`/`1e0` cannot appear
  post-decode. Both `$ref` resolvers run only over defs the checker already accepted, so
  the validators need no cycle guard. Generator `bin/contracts.exs:23` emits the union.
  Rewrite `schema.ex:227` covers anyOf, so cross-file refs flatten. On the developer's
  "hangs until timeout" mutant: see the table; a hang is an acceptable failure mode for a
  compile-time check over repository input (the test fails and the developer sees it at
  once), and the shipped checker terminates by construction.
- **DecisionResult amendment is additive** (`protocol/decision.schema.json`): the only
  removed line is the old description; `narration` is optional on the accepted branch and
  absent from rejected/fault; the PR 3 fixture `{"kind":"accepted"}` keeps the same missing
  list; PR #15's `compose_test.exs` validates DecisionResult values from
  `protocol/fixtures/composition.json` that carry no narration, so they stay valid.
  Narration lives on the decision output, not in the StateDelta PR #15 composes, and
  04 §5.2 step 7 commits "required continuation/narration" with the result and receipt,
  which is what `NarrationRecord` replays. No contradiction.
- **PR #15 overlap.** Both branches regenerate `kernel/ts/src/contracts.gen.ts` (PR #15 also
  appends `EVALUATION_FAULTS` and `LIMITS`): regenerate after the second merge and rerun
  `elixir bin/contracts.exs --check`. `bin/contracts.exs` hunks are disjoint (line 23 here;
  header and targets there). PR #15 alone touches `error.schema.json`/`error_registry.json`;
  this PR alone touches `invalid.json`. After both merge, `UnavailableReason.code` accepts
  PR #15's evaluation-fault codes as well (nit 3). A dry `git merge --no-commit` of PR #15's head `9131dbe` onto `bccc582` in the throwaway worktree conflicts only in `kernel/ts/src/contracts.gen.ts`; `bin/contracts.exs` auto-merges.
- **N1-N6 cite real text.** N1: P5 "clear unavailable-action feedback", 00 §4.10 compass
  "disabled when no exit, badge when locked". N2: 00 §4.10 "greyed with the reason", 04 §7
  codes with text rendered separately; keeping it off GameError respects owner Q5. N3:
  04 §15 "localized string IDs plus interpolation data", 06 §43 "pinned text keys and
  bindings". N4: 04 §15 "dialogue choices currently available", 06 §43 "current beat",
  "bound participant identities". N5: 06 §43, 04 §5.2 steps 7-8, 03 §14 replay. N6:
  06 §43 "never trapped in a modal screen", 06 §37 modal mode. Beyond the text: the
  optional `message` sentence (grounded in 04 §15, optional, harmless) and the snapshot's
  "narration not yet delivered on this stream" (question 1 below). The 64-line cap is
  declared as a contract limit, not a spec number, and the frozen numeric profile is
  untouched.
- **Lantern loop by touch (P5).** Both paths (accept, travel, take, return, talk, choose)
  and the frozen adverse paths that the traces exercise (early acquisition, lost custody
  shown as a greyed choice with `not_owned`, Bram absent as `not_present`, blocked west
  exit with `exit_locked`, consumed-choice replay with narration) are expressible with
  `exits`, `actions`, `entities[].actions`, `inventory`, `journal`, `choice` and
  `narration`, with no display text. The gap is the clock (finding 1). An advertised
  action carries no input list; the client resolves it from the generated
  ActionDefinition content by `action_key` (Gate R3 content types), which is fine.
- **Accounts.** `protocol/account.schema.json` references only manifest, action and its own
  defs: no StateScope. `MilestoneReport` has no `account_id` and no `evidence_class`
  (fixtures reject both); `QueuedReport.account_id` is the local binding 23 §5 requires;
  `MilestoneAcceptance.account_id` is the authenticated principal of the server record.
  `AdmissionPolicy` makes ungated explicit (`kind: "ungated"`) and forbids an empty gated
  list; `AdmissionResult` carries policy and progress versions. Server receipt time is
  deferred to R12A with the developer's flag (owner question 4).
- **The one changed PR 3 fixture** (`protocol/fixtures/invalid.json:57`): `fact_compare`
  with `equals: 1` was invalid only because FactValue was a Key; the PM approved widening
  FactValue, so `1` is valid by design. The fixture's purpose (a non-FactValue `equals` is
  `invalid_type` at `/equals`) is preserved with `null`. Legitimate; the other 191 PR 2/3
  entries are byte-identical.
- **Over-engineering.** Nothing to cut. The four account id types repeat one UUID pattern,
  matching the identity file's style and giving distinct TypeScript brands. The three
  `available` oneOfs cannot share branches under the subset. The two 64-line boundary
  examples are bulky but are the valid side of a pinned limit.

## Findings

### 1. Should-fix: GameView has no logical time, so `wait` cannot be built by touch

`protocol/gameview.schema.json:397-450` (`GameView`). PR 3's `wait` action takes
`until: LogicalTime` (`protocol/action.schema.json` ActionInput; `command.schema.json`
LogicalTime), and the R6P proof has an adverse path "wait until Bram moves (presence
rejection with close/return path)" with Bram at the landing 06:00-19:00
(pre-release-proof.md, "Fixed content intent"). Scenario: the touch client shows `wait` as
an available place-level action; the player taps it; the client must supply an absolute
`until` but the view carries no current time, so it can only guess, fall back to the text
drawer, or open a second data path outside GameView, which P5 ("readable current state")
and 04 §15 (the client "MUST NOT reimplement" semantics) rule out. The PR defers this as
N14 ("nice to have"); for the Lantern's time-gated interaction it is a must. Fix: one
required `time: LogicalTime` on GameView (or on the snapshot) with one fixture; the format
is unreleased, so no version bump. If the PM prefers to keep the format unchanged until R6P
builds the touch path, record N14 as a P5 requirement rather than a nice-to-have.

### 2. Should-fix (process): fixture expectations generated by the code under test

`protocol/fixtures/invalid.json` (the ~100 new entries). The PR says the sweep's expected
error lists were generated, then checked by hand against the spec. AGENTS.md "Writing
tests": expected values never come from the implementation. Scenario: a validator bug that
emits a wrong list for, say, a missing oneOf discriminator would have been frozen into the
fixture and passed both kernels, since they are checked against the fixture and then each
other. Covered for this PR by the independent recomputation above (291/292 agree; the
exception is the oracle's regex). No fixture needs changing. For future sweeps the
expectation must come from the schema text or a separate oracle, and the PR should say so.

### Nits (at most five)

1. `protocol/text.schema.json:7` TextKey description still says "Interpolation data is
   added with its first use"; `Text.bindings` now is that data.
2. `protocol/fact.schema.json` FactSpec.scopes hand-lists `player, party, instance, realm`,
   a duplicate of the StateScope discriminators in `scope.schema.json`. A mutant adding a
   fifth kind to one file only is caught only through the `["account"]` fixture; a
   one-line equality test (like the ErrorCode/registry test) would catch drift in either
   direction.
3. `protocol/gameview.schema.json` UnavailableReason.code is any ErrorCode, so
   `{"code": "invalid_json"}` validates today and evaluation-fault codes will after PR #15.
   The projector should restrict to `gameplay_rejection` category codes (R6); the
   subset cannot express the restriction.
4. `protocol/account.schema.json` StoryRun.parent_run_id names the parent run; 23 §11 says
   "explicit parent snapshot". The restore point itself (10 §31-33 bookmarks) is not
   identified; presumably joins at R6. Question rather than defect.
5. The two 64-line examples (`decision.schema.json`, `gameview.schema.json`) and the
   65-line fixtures add ~500 lines of `{"key": "n"}`; a comment naming them as boundary
   cases would help the next reader.

### Questions (no failure scenario)

1. `GameViewSnapshot.narration` is "records not yet delivered on this stream". Delivered
   by whom, acknowledged how? For the offline single client this is trivial; for a Realm
   stream it implies per-client delivery state the transport (R14) must define. Fine as an
   optional field now; the meaning should be pinned when the first host fills it.
2. `PendingChoice.closable: false` with every option unavailable would trap the player,
   which 06 §43 forbids; this is a projector invariant, not a schema one. Worth a line in
   the R7 scene work.

## Views on the PR's open questions (plain language for the owner)

Marked **owner** where the owner's word is actually needed; the rest the PM can settle.

1. **Fact names with dots** (`village.child_status`). The engine's reference key allows no
   dots (frozen in PR 2). The developer proposes the compiler rewrites authored dotted
   names to `village_child_status` and the cartridge is the namespace. This works and
   changes nothing the player sees. One condition: the compiler must reject two authored
   names that rewrite to the same key (`a.b_c` and `a_b.c`). **Owner, but with a safe
   default:** only if you care that builder/authoring tools show dotted names; otherwise
   accept the rewrite.
2. **"export" facts** (`memory.*`). Their values are undefined in the spec; leaving the
   type out until campaign continuity is specified is right. Not an owner decision.
3. **GameView details for later** (hidden-found badge, incremental updates). Correct to
   defer; each is a new format version. Not an owner decision. Note finding 1: the clock is
   not "later".
4. **Acceptance record names** (`integrity_conflict`, `outcome_conflict`). They match the
   two cases 23 §5 describes (same report id with different content; a different outcome
   for the same milestone in one run). Receipt time deferred to the platform API. Not an
   owner decision.
5. **Requirement ids** exactly `namespace.name@version`. Matches the spec's only example;
   widening later is compatible. Not an owner decision.

## Cross-vendor review (Astra), relayed verbatim by the owner

Reviewed commit `bccc582`, independently of the review above. The PM checked A1 against the code before forwarding it: `AdvertisedAction` in `protocol/gameview.schema.json` has only `available`, `action_key`, `label` (and `reason`), closed with `additionalProperties: false`.

```text
VERDICT: CHANGES REQUIRED

FINDINGS:
A1 [blocker] protocol/gameview.schema.json:12 (at bccc582) — AdvertisedAction omits the target/input contract needed to turn an advertised action into an invocation — A legal Lantern action definition requires input ["until"] for wait, but its projection can contain only {available:true, action_key:"wait", label:"action.wait"}. A touch client consuming GameView cannot discover that requirement or distinguish it from a no-input action without maintaining a separate action-to-parameters catalog. Sending input:{} then fails action resolution; trying to project input metadata currently produces /input:unknown_property because the advertised object is closed. This contradicts 04 §2's affordance contract and §17's requirement that touch construct invocations from GameView action metadata. Project the existing target/input metadata, or typed prepared invocation bindings, rather than making the UI reconstruct it. This does not require exposing command internals or policy ASTs.

QUESTIONS:
AQ1 — What generated the new expected-error lists in protocol/fixtures/invalid.json? The PR description says they were generated and then hand-checked, while test/loka/core/contracts_test.exs and kernel/ts/test/validate.test.ts call them hand-written. Please identify the generator and its inputs: independent derivation from the specification is different from recording Contracts.validate/validate output and reviewing it afterward. The checked-in tests do not establish that provenance, so I cannot confirm the required independence.

AQ2 — Which envelope owns the explicit parent snapshot/ancestor revision required by 23 §11 and 03 §25? StoryRun records parent_run_id but cannot identify which restore point within that run produced a fork. Restoring two different bookmarks of the same parent therefore leaves the branching point unidentified in this envelope. A separate save-header contract can own it; please identify that boundary rather than treating parent_run_id alone as complete restore provenance.

AQ3 — What retained R6/P2/P6 test will cover committed narration surviving a crash before display, and receipt replay returning the original narration alongside a current GameView without resurrecting the consumed choice? The DecisionResult addition is structurally additive: narration remains optional, the existing required fields are unchanged, and rejected/fault branches remain closed. Its descriptions correctly assign persistence to the host and replay to the receipt, but these schemas do not themselves prove that transaction/recovery behavior. Also clarify whether “not yet delivered” means transport delivery or durable client acknowledgement; neither should silently substitute for presentation progress.

VIEWS:
Q1 — Do not approve an unconditional dots-to-underscores rewrite: a.b and a_b would collide, as would relationship.bram.trust and relationship_bram_trust. Specify a collision-checked canonical mapping or explicit compiled keys, including the 64-character limit, before R4 relies on it; do not silently rewrite references or merge distinct facts.
Q2 — Keeping “export” out of FactType is appropriate: export describes continuity behavior, not a JSON value type. Give each memory fact an actual bool/enum/int representation and an explicit export declaration when continuity is implemented; do not add an untyped export escape hatch.
Q3 — Snapshot-only GameView is appropriate here; incremental transport and hidden-found badges can wait for their first required capability. The unavailable-exit reasons, Text bindings, prompt/speaker, narration records and closable flag have specification support. Fix A1 rather than compensating with a handwritten UI action catalog; no minimap, combat HUD or general presentation framework is needed for this slice.
Q4 — integrity_conflict and outcome_conflict accurately distinguish the two cases in 23 §5. Deferring the server receipt-time encoding to R12A is reasonable for this envelope, but the eventual durable platform acceptance record must still retain that required timestamp; the current schema is not the complete persistence record.
Q5 — Exactly namespace.name@version is sufficient for the stated requirement example and bounded initial policy. Make that an explicit naming decision, not an accidental consequence of the regex subset. There is no demonstrated need to extend the pattern language merely to allow deeper requirement namespaces.
anyOf assessment — No defect found in the inspected checker/dispatch/generator extension. FactValue accepts true and 1 independently; "1" selects the string branch and fails Key's pattern rather than becoming an integer. Focused tests against the exact TypeScript validator blob passed for reference chains, branch-order reversal, bounds, escaped paths and error ordering. I did not run the full pinned Elixir/TypeScript suite, so this is not a claim of executed cross-language conformance.
Account isolation — MilestoneReport contains neither account_id nor a client-selected evidence class, and the account contracts do not reference StateScope. Account binding on StoryRun/QueuedReport and authenticated-account identity on platform acceptance are correctly outside the milestone payload.
Cuts — Keep the small type-disjoint anyOf implementation and capability-specific relations. Move the repetitive 64-line boundary examples into focused tests instead of duplicating them in shipped schema/DEFS data; the existing 1024/1025-candidate tests demonstrate that approach. Do not expand this PR into a generic relation framework, arbitrary-union validator, or Realm transport layer.
```
