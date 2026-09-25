# Review: PR #18, proposed ADR-074 (TypeScript-first rules until Story runs on a server)

- **PR:** #18, branch `proposal-ts-first`, head `0f7c4f6`. Docs only (one new file plus one
  index line); CI green. Reviewed by a fresh Fable reviewer (design judgment: the
  proposal changes what later work can cheaply change).
- **Verdict: CHANGES REQUIRED** (the document is honest in substance and the direction
  survives review, but two gaps change what the headline promises and the plain-words
  section, the part the owner will read, misstates the present and omits the net cost).
- Line numbers are in `docs/decisions/adr-074-ts-first-proposal.md` at `0f7c4f6`.

## 1. Derived first: what dual implementation is for in this spec

Written before reading the proposal, from ADR-068 (16), ADR-071, 14 §R1/R5/R6/R9/R9C/R10/
R14 and Gate R3, spec README §5–§6, 05 §6 and §24, 07 §1/§3/§4/§13/§23, 23 §6, envelope §2–§3,
15 DET-02 and SCR-10, 09 §1a/§5/§10, pre-release-proof.md and the ROADMAP harness.

| # | Risk it mitigates | When it becomes real |
|---|---|---|
| 1 | The owner's constraint: one Elixir/OTP server, no Node beside the BEAM (ADR-068); Hermes cannot run Elixir | when the server hosts rules (R14/R15) |
| 2 | Same cartridge, same semantics on every authoritative host (07 §1, §4, §13; 05 §24; Gate R14 "matches offline domain trace") | R14 |
| 3 | Drift between two implementations; ADR-068 calls the differential "drift control, not a proof of correctness" | only once two implementations exist |
| 4 | A second independent reading of the spec: disagreement exposes ambiguity; the envelope's 10,000 fresh sequences catch what nobody wrote down (§3: fixtures "stay authoritative", agreement "is not correctness") | from R5, when rules are first written and fixtures frozen; after the first certified release the answer can no longer move (05 §6 capability version immutability) |
| 5 | Evidence for 14 §R1's rejection test ("two-implementation maintenance cost is unreasonable"); ADR-071 deferred the §10/§11 comparison to R6P/R10 | R6P/R10, by ADR-071's own text |
| 6 | Elixir-side tooling that must evaluate rules before online play: the R4 compiler (02 §1 `Loka.Content`) producing the artifact the phone reads; the R9 Lab (02 §1 `Loka.Builder`) certifying chapter one for Gate R10 (09 §1a: DET-01..10, bot playthroughs, 30-day simulation; 09 §5 "BEAM runtime instance" boot mode; 09 §10 "StreamData on Elixir host") | R4 (bytes and hashes only), R9/R10 (rule execution), both before the first release |
| 7 | One TypeScript kernel on two engines (Node in CI, Hermes on the phone) must agree; envelope §3 applies to "every pair of hosts that must agree"; ADR-071 deferred the on-device differential to R6P because A2 ran on Node only | R6P |

Server-side milestone acceptance needs no rules (23 §6: policy acceptance of
`offline_client_report`, no replay service in the first release). Compiler-to-phone hash
agreement rests on canonical encoding, SHA-256 and the lock hash, which exist in both
kernels today (#4, #12, #13).

## 2. Checks against the proposal

**Citations (question 1).** Every quoted passage was checked by hand: 03 §25, 23 §6, PREP-03,
07 §1/§3/§4/§13/§17/§23/§30 (stages 3 and 6), 05 §24, 14 §R5/R9/R12A/R14/R15, 15 DET-02,
16 ADR-004/068/069, ADR-071's deferred list, envelope §3, ROADMAP quotes, 09 §31. All
accurate. "Already true" claims 1–4 (lines 33–46) hold. Two plain-words sentences do
not (S4). The ADR number is free (16 ends at 069; proposals cover 070–073).

**Missed reasons (question 2).** Rows 1–3 and 5 of the table are handled honestly (lines
110–117). Row 4 is acknowledged (lines 101–108) but its timing consequence is not (S5).
Rows 6 and 7 are missed (S1, S3). The compiler/runtime seam is kept implicitly but not
named (N1).

**Trigger (question 3).** Keyed to feature names, not to code; it can be slipped past
without anyone noticing (S2).

**Amendment list (question 4).** Incomplete (S6); the grep results are listed there.

**Re-estimate (question 5).** Arithmetic verified: 3.2M/8 = 0.4M per slice; every table
cell is slices x 0.4M with the 25–40% cut applied to the 7 + 5 rule slices (and the
simulation slice); totals 10.4M vs 8.4–9.1M; saving 1.3–2.0M; the ±1/3 band 7–14M vs
6–12M is right. Assumptions are stated as assumptions. Two caveats are missing (N2, S4b).

**Length and tone (question 6).** 1,557 words; the plain-words section is the right
device for a non-engineer owner. "Recommendation: accept" at line 21 precedes the trade-off
and the plain-words summary states the saving without the total (S4). §2 duplicates the
gate list that §5's amendments repeat (N4).

## 3. Findings

### S1 (should-fix) lines 110–117 and 88–91: the R9 Lab is silent, and it runs rules before the first release

"Did any reason for C need both kernels before R6P? No." is answered only for the
server. Gate R10 (before the first release) requires "full applicable `offline_private`
certification": 09 §1a's DET-01..10, bot playthroughs to both endings and a 30-logical-day
autonomous simulation. Those execute rules. The spec places the Lab in Elixir
(02 §1 `lib/loka/builder/`, "lab, certification"; 09 §5 "BEAM runtime instance" boot
mode; 09 §10 "StreamData on Elixir host"). Scenario: R9 begins under this proposal; the
Lab developer either writes Elixir rule evaluators (the trigger has not fired, so no
fixtures/differential obligation attaches: 05 §6's "semantic drift") or the Lab must
drive the TypeScript kernel on Node, a design the proposal never states. Either way the
headline "until online play" is not what happens. Fix: state where R9's Lab executes rules
(the cheap answer is the TypeScript kernel on Node with Elixir orchestrating, or a
TypeScript Lab runner; ADR-068's no-Node constraint is about the online server, not
development tooling), and add 02 §1, 09 §5 and 09 §10 to the amendment list.

### S2 (should-fix) lines 73–75 and 88–91: the deferral boundary and the trigger are by feature name, not by code

The deferred set is "world rules from R5 on"; the trigger is "runs Story content on a
server host". Scenario A: an R14/R18 Realm-skeleton slice implements `movement@1` in
Elixir for Realm-native content (route (a): "Realm has its own Elixir rules"). Story
content never runs on the server, so the trigger does not fire, yet a second
implementation of a portable capability now exists with no fixture or differential
obligation, the exact drift 05 §6 names. Scenario B: an R5 slice adds a versioned delta
operator (04 §5, "capabilities may add versioned delta operators") in TypeScript only; the
"kept" Elixir `compose` and its differential silently cover only the R3 operator set.
Fix: define both by residency class (05 §6, `protocol/residency.json`):
`portable_semantic_foundation` rows (canonical, numeric profile, delta algebra,
invariant registry, IdSource, RNG) stay in both kernels with their differential;
`portable_capability` rows are TypeScript-only until the trigger; the trigger is "the
first slice that gives any `portable_capability` row an Elixir host adapter, for any
reason (Story hosting, Realm mechanics, server replay, Lab analysis)". That is
checkable: `docs/residency.gen.json` `host_adapters`; a one-line check can fail when an
Elixir adapter appears on a `portable_capability` row without a listed differential.

### S3 (should-fix) lines 113–114 and 137–138: the on-device differential is downgraded to a fixture run without a reason

ADR-071 deferred "the R1-A2 on-device differential" to R6P because A2 ran on Node only.
Under this proposal the two hosts that must agree are the same TypeScript on Node (CI)
and on Hermes (phone); envelope §3's MUST covers "every pair of hosts that must agree".
Scenario: a Hermes string, sort-stability or number-formatting difference changes one
step's canonical bytes in a sequence no fixture covers; a fixture-only run on the phone
passes; the differential (per-step bytes recorded on Node, replayed on the phone from the
same seeds) fails. A single-kernel plan makes this cheaper, not unnecessary. Fix: keep
the on-device differential as Node-versus-Hermes; drop the "becomes an on-device fixture
run" amendment.

### S4 (should-fix) lines 10–19: the plain-words section misstates the present and omits the net cost

(a) "Today every story rule is written twice ... and a harness checks that both give
identical answers": nothing is written yet. R3 delivered contracts and foundation code;
the harness is the R5 simulation slice. The plan writes rules twice; the repo does not.
(b) "Savings: an estimated 15%": under route (b) the total rises (lines 173–174: save
1.3–2.0M now, pay 1.5–3M later, with cold context); the gain is deferral plus the option
never to pay it. (c) "the first release, which is offline-only": the release has the
R12A account server (line 42–44 says so); "offline play" is the accurate phrase.
Scenario: the owner reads the plain-words section (the intended reader) and concludes
there is duplicate code to delete and a net saving. Fix: three sentence edits.

### S5 (should-fix) lines 101–108: "harder later" omits that the resolution direction is forced after release

05 §6: a published `key@version` is immutable in meaning once a certified cartridge
depends on it. Scenario: at R14 the Elixir port disagrees with the TypeScript kernel on a
`movement@1` edge case, and the spec supports Elixir. After the first certified release
the answer cannot move: the port matches TypeScript (or a new capability version is
minted). Dual now finds ambiguities while the spec can still win; dual later finds them
when the TypeScript kernel has become the rulebook. This is the strongest argument
against the proposal and belongs in the owner's view, in plain words.

### S6 (should-fix) lines 135–149: the amendment list is incomplete

Grep for "both kernels", "differential", "cross-host", "Elixir and TypeScript", "dual"
across `docs/spec`, AGENTS.md, ROADMAP and WORKFLOW. Not listed: 09 §5 "Cross-host
conformance" ("compares the accepted Elixir/mobile implementations") and its "BEAM
runtime instance" boot mode; 09 §10 ("StreamData on Elixir host"); 05 §6's last
paragraph ("If R1 selects dual implementations, the same residency map identifies every
semantic contract that requires golden cross-host parity"); 10 §(line 482, "R1 tests dual
... C first"); AGENTS.md "Writing tests" ("Elixir and TypeScript are compared to the
fixtures, then to each other") and "Checks: CI" ("the differential runs at least 10,000
fresh sequences on every fast CI run"); pre-release-proof.md ("actual candidate
adapters"; P6 "numeric/state parity"); 02 §1 (S1). Reading aids (R-MILESTONES R1 row,
INDEX line 232) need a mention only. Say explicitly that 04 §20 (protocol fixtures in
both languages) is the R14 Realm protocol and unaffected, and that 14 §R1 is history and
untouched.

### N1 (nit) line 77–83: name the compiler/runtime seam

The Elixir compiler (02 §1 `Loka.Content`; PREP-03 "same format, validator and evaluator")
and the TypeScript runtime must still agree on artifact bytes, artifact and lock hashes,
and what is a valid policy/target spec. That rests on `protocol/` schemas and the kept
canonical/hash code and is exercised end to end at P3 to P4. One sentence in "Kept".

### N2 (nit) lines 153–161: two estimate caveats

R3's per-slice cost was 56% review (1.8M of 3.2M); reviewing one kernel is not half the
review, so 25–40% may be optimistic. R3 slices were contract slices; rule slices carry
fixtures and simulation. One line: re-estimate after the first two R5 slices (the
ROADMAP's own practice).

### N3 (nit) lines 126–129: route (a) is a larger spec change than route (b)

It also conflicts with 07 §1 ("the same compiled cartridge definitions and portable
simulation semantics run in both places"; "MUST avoid creating a disposable
single-player engine") and 05 §24. Say so, so the owner does not weigh (a) and (b) as
equal-sized choices.

### N4 (nit) lines 50–69: §2's gate list repeats the amendment list

Keep the two bullets the decision rests on (ADR-068's reason; portable reuse); the
gate citations already live at lines 135–149.

### Q1 (question) line 165: is the R4 compiler Elixir or TypeScript?

The row says "(no rules)". If the compiler is Elixir (02 §1), "capability validation" and
"policy compile" are Elixir's reading of contracts the TypeScript kernel evaluates; the
seam in N1 is where the first disagreement will surface. If the developer intends a
TypeScript compiler, that is a 02 §1 amendment and should be listed.

## 4. Recommendation for the owner, in plain words

Accept the direction, after the fixes above; the document is not yet fit to decide on.
Two things should decide it:

1. **Do you expect stories to go online?** The spec's plan says yes (adventure portal,
   online-private, stages 3 and 6). If you believe that, this proposal costs more in
   total (about 1.5–3M tokens later instead of 1.3–2M now) and buys time and the freedom
   to change your mind. If you are genuinely unsure whether online play happens, the
   option is worth the extra total.
2. **After the first release, the TypeScript behaviour becomes the rulebook.** A later
   Elixir version must copy it, quirks included, because shipped rule versions cannot
   change meaning. Building both now catches spec mistakes while they can still be fixed
   in the spec's favour. The proposed substitutes (adverse fixtures, invariant simulation,
   review) are real but weaker than a second independent reading.

And one condition to insist on: the reopen trigger must be about code (any Elixir
implementation of a portable rule, for any reason), not about a feature name, and the
proposal must say where the R9 Lab runs rules; otherwise "until online play" can slip.

## Cross-vendor review (Astra), relayed verbatim by the owner

Reviewed commit `0f7c4f6`, independently of the review above.

````text
```text
VERDICT: FIT WITH CHANGES

RECOMMENDATION TO OWNER: ACCEPT WITH CHANGES — Accept this as a staged implementation and assurance change, not as a finding that early dual implementation had no purpose. I found no inherent requirement for complete Elixir world-rule twins before R6P: an Elixir compiler can produce a language-neutral artifact consumed by TypeScript; R6 authority is local; and milestone acceptance under document 23 validates bounded reports rather than replaying Story rules. The central citations concerning save trust, bundled distribution, onboarding-only reports, and R14/R15 gameplay hosting are accurate. The proposal is substantially balanced: it discloses authorship, the loss of independent ambiguity discovery, cold-port risk, guessed discounts, and unmeasured PM tokens. However, its replacement conformance contract, outstanding gate dispositions, trigger boundary, and deferred-port scope need clarification before acceptance. The remaining-work estimate is a reasonable planning scenario, not measured savings or evidence of lower lifetime cost. The amendment omissions below are confirmed from pinned file reads; GitHub’s incomplete code-search results prevented certifying the inventory as exhaustive.

FINDINGS:

A1 [should-fix] docs/decisions/adr-074-ts-first-proposal.md:144 (at 0f7c4f6) — The envelope citation omits the operative “MUST for C” and treats removing a required implementation as though the existing applicability wording already authorizes that removal. Envelope §3 requires randomized per-step comparison, not merely running a finite known-answer corpus. Node and the two Hermes device paths also remain distinct execution paths even when they share TypeScript source. Lines 80–85 preserve fixtures and single-kernel simulation, but do not fully specify the replacement host-comparison and sampling obligations. Explicitly distinguish deferred Elixir-versus-TypeScript testing from retained TypeScript host conformance, state where the 10,000 fresh sequences and regression seeds run, and identify any owner-approved reduction in assurance. This need not require physical-device execution on every fast CI run — without that disposition, “no change beyond a note” can conceal a substantive acceptance-contract change.

A2 [should-fix] docs/decisions/adr-074-ts-first-proposal.md:137 (at 0f7c4f6) — The amendment inventory misses governing obligations beyond the listed R5/R9/DET-02 edits. Document 09 §5 explicitly selects Elixir/mobile comparison for the dual implementation; §1a and §31 inherit host-conformance obligations. DET-08 explicitly compares ARM mobile and the server host. ADR-071 still assigns the 100-instance server load/scheduler work, faults under load, server fault-record corrections, and maintenance/fault-containment comparison to R6P/R10. Its amendment bullet here mentions only selection wording and the on-device differential. AGENTS.md also contains a separate planned 10,000-sequence CI obligation outside its Candidate C bullet. Add an applicability crosswalk marking obligations retained, replaced, or deferred to a named trigger, while preserving historical failed/unmeasured results — otherwise the implementing PR can leave mutually inconsistent gates or silently waive outstanding evidence.

A3 [should-fix] docs/decisions/adr-074-ts-first-proposal.md:88 (at 0f7c4f6) — The trigger is sensible but underdefines the boundary between authoring/test execution and authoritative server execution. It names Story content and trace verification, but does not explicitly cover a Realm-native cartridge becoming the first server consumer of an existing portable capability. Conversely, headless Story simulation in CI or the Lab must not accidentally count as production server hosting. The concrete port-and-differential build gate is assigned to R14 in lines 141–142, although the trigger allows earlier verification work. Define the predicate in terms of the first planned server consumer of portable gameplay semantics or trusted trace-verification service, exclude static compilation and ordinary TypeScript test execution, and apply the required owner disposition and conformance evidence before that consumer is enabled regardless of milestone number — otherwise an early consumer can encounter an unplanned port or an ambiguous verification gate.

A4 [should-fix] docs/decisions/adr-074-ts-first-proposal.md:174 (at 0f7c4f6) — The deferred 1.5–3M port estimate has no stated capability/version scope. The cost discussion at line 101 describes roughly the twelve R6P rule slices, but line 74 defers later rules too. Full R7/R8 chapter mechanics and potentially further Story development accumulate before the trigger; document 14 explicitly allows R16 without R14/R15. Name whether this estimate covers only the Lantern subset, the first server cartridge’s exact capability lock, or all supported Story semantics and versions. Label additional coverage as unestimated where necessary — otherwise the owner can mistake a proof-subset catch-up estimate for the cost of restoring the promised online reuse after a full release.

A5 [should-fix] docs/decisions/adr-074-ts-first-proposal.md:126 (at 0f7c4f6) — Route (a)’s product-amendment footprint is understated. Beyond the named portal and online-private offering, document 14’s R14 gate requires an offline-matching cartridge playthrough, R18 requires launching the same packs from the hub, and R19 integrates previously proved Story instancing. Document 07 §17 also includes embedded-region and shared-area reuse, not just portal reuse. Moreover, treating parity as a design goal cannot authorize different meanings under an unchanged published portable capability key/version; 05 §6 makes those meanings immutable. Identify these as additional future amendments, and distinguish separately defined Realm mechanics from divergent implementations of the same portable contract — otherwise route (a) appears compatible with more retained product and capability promises than it actually is. This does not mean independent Realm-native party or instancing features must be cancelled.

A6 [nit] docs/decisions/adr-074-ts-first-proposal.md:166 (at 0f7c4f6) — The table’s discount is not completely reproducible from its stated twelve-rule-slice assumption. With twelve slices at 0.4M and a 25–40% saving, the saving is 1.20–1.92M and the remaining total is 8.48–9.20M; keeping the R5 simulation slice at baseline gives R5 2.08–2.50M rather than 2.0–2.4M. Discounting the simulation work as well could be reasonable, but that is an additional assumption. Show its separate allowance or revise the rounded figures — otherwise the headline incorporates an unstated saving from a slice explicitly retained.

A7 [nit] docs/decisions/adr-074-ts-first-proposal.md:10 (at 0f7c4f6) — The opening conflates the current implementation policy with completed implementation, and player hosting with development execution. R3 provides the portable foundation and composition machinery; the R5 Story/world rules discussed here are still ahead. Elixir already executes before release in conformance testing, including the retained compose differential. Say “the current plan requires each new portable rule in both languages” and “only TypeScript hosts released offline gameplay” — otherwise the opening makes the Elixir work sound exclusively useful after online launch, despite the assurance benefit acknowledged later.

MISSED DEPENDENCIES:

- R4 producer/consumer agreement remains mandatory even without Elixir world-rule twins. Loka.Content owns compilation under 02 §1; 05 §§8–11 define normalized artifacts and semantic hashing; R6P P3/P6 require compiled content and actual-adapter evidence. Preserve tests in which the real compiler’s artifact is loaded and validated by the TypeScript path, with the same canonical semantic bytes/hash, capability lock, and deterministic rejection of invalid content. Retaining codec unit tests alone does not establish this integration.

- Semantic authoring and certification need an explicit execution path before Realm. R5 simulation, R9 Lab execution, and R11 Lab control must exercise the production TypeScript rules against compiled artifacts rather than acquire an accidental dependency on absent Elixir evaluators. A headless TypeScript test runner can satisfy this without introducing Node into the production Realm authority.

- The assurance retained at R6P must still include actual iOS/Android adapter evidence, per-step canonical state/result diagnostics, real local-storage fault recovery, and the applicable on-device mismatch/mutant checks carried by ADR-071. Known-answer correctness, randomized invariant testing, cross-host equivalence, and authority-fault testing are different obligations; one must not be presented as a substitute for all the others.

- A later port must target an explicit supported capability/version inventory and retained fixtures, not whatever the then-current TypeScript implementation happens to do. Published semantic immutability and save-compatibility obligations survive the deferral; discovering an ambiguity during the port cannot silently redefine an already published capability.

- Neither R6 local authority nor first-release milestone acceptance introduces a hidden requirement to replay Story rules in Elixir. Document 23 separates local milestone production from authenticated, idempotent platform acceptance; R6P uses a fake synchronization adapter. These are dependencies to preserve, not reasons to pull the full Elixir world kernel forward.
```
````

## Re-review (fix round 1)

Reviewed `1545b82` only (the proposal at that commit; line numbers below are at
`1545b82`). Scope: each disposition of S1–S6, N1–N4, Q1, Astra's A1–A7 and the five
missed dependencies; the plain-words section; the crosswalk against the grep in S6.

**Verdict: APPROVE. The document is fit for the owner to decide on.**

| Finding | Where | Verified |
|---|---|---|
| S1 Lab runs rules before release | L74–80; appendix 02 §1, 09 §5, 09 §10 | Resolved: R5 simulation, R9 Lab and R11 Lab control run the TypeScript kernel headless on Node against compiled artifacts; stated not to fire the trigger; the three amendment rows are present. |
| S2 deferral boundary and trigger by residency | L63–72, L90–96 | Resolved: `portable_semantic_foundation` stays dual with its differential (a new delta operator lands in both); `portable_capability` is TypeScript-only; the trigger is "first planned server consumer of any `portable_capability` semantics", names the Realm-native case, excludes compilation and TS test execution, and is checkable on `docs/residency.gen.json` `host_adapters` (the rows carry that field today); owner route choice and conformance evidence precede enabling, regardless of milestone. |
| S3 on-device differential | L82–88; appendix ADR-071 row | Resolved: Node, Android Hermes and iOS Hermes named as distinct hosts; per-step bytes recorded on Node and replayed on device; 10,000 fresh sequences plus regression seeds on Node every fast CI run, a device sample at R6P; the Node-not-device reduction is stated as an owner-approved assurance change. |
| S4 plain words | L11–25 | Resolved: "No story rule has been written yet"; the plan, not the repo, writes twice; the R12A account server is named; the total-goes-up sentence is there with both numbers; the recommendation is now conditional ("unless you are sure stories will go online"). Accurate for a non-engineer. |
| S5 immutability after release | L104–110 | Resolved, and the plain-words section points to it. |
| S6 amendment list | appendix L174–204 | Resolved for every normative item in the grep (09 §5 and its BEAM boot mode, 09 §10, 05 §6 last paragraph, 10 line 482, AGENTS.md "Writing tests" and CI line, pre-release-proof.md, 02 §1, 04 §20 and 14 §R1 marked unaffected). Two mention-only omissions remain (nit below). |
| N1 compiler/runtime seam | L77–80 | Resolved: compiler stays Elixir; artifact loaded through the TypeScript path with the same bytes, hash, lock and deterministic rejection. |
| N2 estimate caveats | L159–162 | Resolved (56% review share; rule vs contract slices; re-estimate after two R5 slices). |
| N3 route (a) larger than (b) | L130–137 | Resolved; also carries A5's additions. |
| N4 §2 duplication | L51–59 | Resolved; §2 is two sentences plus a pointer to the appendix. |
| Q1 compiler language | L77 | Answered: Elixir. |
| A1 envelope "MUST for C" | L82–88, appendix envelope row | Resolved: deferred Elixir pair distinguished from retained TS host conformance; where the sequences run is stated; reduction identified. |
| A2 crosswalk | appendix | Resolved: retained / replaced / deferred / amend / unaffected per row; DET-08, the ADR-071 server-load, fault-record and maintenance items, AGENTS CI line all dispositioned; historical results stay. |
| A3 trigger predicate | L90–96 | Resolved (see S2). |
| A4 port estimate scope | L164–166 | Resolved: Lantern subset only; later rules unestimated. |
| A5 route (a) footprint | L130–137 | Resolved: R14 gate, R18, R19, 07 §17 embedded/shared reuse, 05 §6 immutability; separately named Realm mechanics allowed. |
| A6 table arithmetic | L146–157 | Resolved and reproduced: R5 7 × 0.4 × (0.60..0.75) + 0.4 = 2.08–2.50; R7/R8 1.20–1.50; totals 8.48–9.20; saving 12 × 0.4 × (0.25..0.40) = 1.20–1.92. The simulation slice is no longer discounted. |
| A7 opening | L11–15 | Resolved. |
| Missed dep 1 (R4 producer/consumer tests) | L77–80 | Resolved. |
| Missed dep 2 (execution path before Realm) | L74–76 | Resolved. |
| Missed dep 3 (R6P assurance retained) | L87–88; appendix "Retained" rows | Resolved: mutant check, iPhone timing, phone rows, storage-fault recovery, adapter evidence. |
| Missed dep 4 (port targets an inventory) | L112–115 | Resolved. |
| Missed dep 5 (no hidden Elixir replay) | L39–41, L44–45 | Preserved. |

**Crosswalk completeness against the S6 grep.** Every normative hit is dispositioned.
Not listed, mention-only: the reading aids (R-MILESTONES R1 row, INDEX line 232), which
"do not introduce new requirements" (README §8), and 07 §14 line 521 (the R1 comparison
procedure, history like 14 §R1). Nit, not a condition.

**One suggestion for the amendment slice, not for this document:** the trigger is
"checkable" on `docs/residency.gen.json`; the slice that amends the spec should also add
the one-line check (a `portable_capability` row with an Elixir host adapter and no listed
differential fails), so the trigger is checked, not just checkable.

### Owner recommendation, restated

The document is now honest and complete enough to decide on. It says, correctly: nothing
is written twice yet; the plan would write each new rule twice; writing only TypeScript
saves about 1.2–1.9M tokens before R6P; if stories later go online, the Elixir copy costs
about 1.5–3M or more for the proof subset alone, so the total goes up; what you buy is
time and the freedom to change course.

Decide on one question: **how sure are you that stories will go online?** If you are
sure (that is the spec's plan), write both now: cheaper overall, and spec mistakes get
found while the spec can still win; after the first release the TypeScript behaviour
becomes the rulebook. If you are genuinely unsure, accept: the trigger is now keyed to
code, not to a feature name, and cannot be slipped past without the owner's route choice
and passing conformance evidence.
