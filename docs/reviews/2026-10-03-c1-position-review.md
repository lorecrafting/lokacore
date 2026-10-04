# c1-position independent primary review — 2026-10-03

PR: #137. Reviewed head: `7cb725f75065db11792fb976ff61f1a7f7a2974d` against base `e59627c8e94c62216e7c4dd10e829f2cad3911c0`.

Reviewer: independent Codex, authored none of this slice, under the owner’s one-slice exception: “Use independent Codex for this slice”. The PM records that decision before merge. This is the primary review replacing Opus for this slice only.

## Requirements derived before reading the diff

Sources: settled c1-position brief and PM settlement; docs/system/mechanics.md (fresh world, movement@1, position@1); docs/system/cartridge.md (Compiler, Artifact and loader); docs/system/protocol.md (ActionSet and admission, GameView); chapter-one plan slice 7. Contract-freeze review depth applies.

- Only position@1 adds the exact engine FactSpec from cartridge.md and fact@1 to requires/lock. Its default is standing; fresh state stores no position row and preserves ids and state hash. An ordinary content fact named position remains allowed without position@1.
- Targetless stand/sit/rest/sleep use admission and invocation, refuse all four same-position commands, and permit all twelve different-position transitions. Exactly one player-scoped fact.assign uses the actor and current expected value; only the host adds fact_changed.
- Only move is position-gated, after direction/exit/passage checks and before fare. Other verbs remain usable while sitting/resting/sleeping. No position affects regeneration.
- Position projects iff position@1 is locked. Place actions omit every alias resolving to the current position verb; the listing/admission invariant must detect a false available action and an omitted accepted position verb. Exit projection shares move refusal precedence.
- Content may read position but cannot author its FactSpec or write it in recipe outcomes, reaction apply, or dialogue choices. Both compiler/loader reject these with RESERVED_FACT; artifact loaders reject a missing or non-exact FactSpec.
- Position survives persisted save/reopen. Existing artifacts, hashes, bundled release and traces remain unchanged. No new delta, event or refusal code; no changes to proposal/compose/fact/resource/app behavior.

## Verdict at the initial heads

**CHANGES REQUIRED.** C1P-01 is open. N1 is a non-blocking documentation nit. The code review covers `7cb725f75065db11792fb976ff61f1a7f7a2974d`; the later process/metadata-only commit `cf4727f463d0fd52a62d222fdfe44c594d495b42` was also independently inspected. That commit records the owner exception and fixes the feature-map PR number; it changes no implementation.

## Findings

- **C1P-01 — blocker — `lib/loka/content/compiler.ex:95` (also `lib/loka/content/artifact.ex:11`).** The compiler adds fact@1 only when building the artifact, after all ownership checks have used the original manifest. A manifest requiring position@1 without explicitly requiring fact@1 therefore rejects legal fact_compare reads of the injected position fact, and legal ordinary fact operations, with UNDECLARED_CAPABILITY. The spec promises compiler-added fact@1 and permits content reads. The ferry-derived test helper already requires fact@1, hiding this case. The PM reported this developer self-review defect during the review; I independently reproduced it by removing authored fact@1 when the helper adds position@1 (test exits 2 with extra UNDECLARED_CAPABILITY diagnostics). I also independently compiled a controlled ferry source with position@1/reaction@1, no explicit fact@1, and a reaction reading position through fact_compare: the expected-success assertion fails, including UNDECLARED_CAPABILITY at `reactions/settle.when.root.op`. Normalize the automatic dependency before ownership checks, while preserving validation of raw declared capabilities, and retain a regression input without authored fact@1.
- **N1 — nit — `docs/world-parameters.md:35`.** W13 points to `view.ts:173 (used :189)`, but its actual use is now line 197. A reader following the use pointer lands on a comment instead of the band selection. Update the use pointer.

## Review and validation

Requirements above were written before reading the diff. I reviewed every implementation/schema/test hunk, the spec-first commit, compiler extraction, deferred scope and the PR’s composes-with statement. Position reuses scoped fact assignment and host fact_changed; movement’s required cross-mechanic check is explicitly specified. The kernel helper has multiple consumers and preserves the rule import boundary. No delta/event/refusal/proposal/compose/fact/resource/app change occurs. All twelve different-position transitions and four same-position refusals appear in the literal invocation walk. New tests use controlled behavioral input and independent literal expected diagnostics/outcomes; C1P-01 exposes their missing automatic-dependency input.

Checks actually run in the detached review worktree, using mise:

- `node --test kernel/ts/test/position.test.ts mobile/authority/local-story/position.test.ts`: 6/6 passed.
- `mix test test/loka/content_rest_test.exs test/loka/cartridge_cross_kernel_test.exs --force`: 4/4 passed, with a separate local _build.
- `node --test kernel/ts/test/validate.test.ts kernel/ts/test/transcripts.test.ts kernel/ts/test/sim.test.ts mobile/authority/local-story/faults.test.ts`: 45/45 passed, including 500 fresh simulator sequences, revised fault seeds and literal fault anchors.
- All 16 source cartridges were independently recompiled with Loka.Content.compile and compared with the exact artifact bytes in their known-answer fixtures: passed.
- Independent Python source/spec reconstruction of the complete new rest artifact matches its value, canonical bytes and SHA256 `54950826152db53659e9fdda58316820982f3dc754bc539548c8041d0f578d27`. Existing invalid cases are unchanged, with ten cases appended. Diff inspection confirms existing cartridges, hashes, compiled fixtures, bundled release and traces are unchanged.
- A direct CLI-parser assertion confirms all four new verbs parse to their literal targetless payloads.
- `elixir bin/features.exs --check` at cf4727f: passed. `elixir bin/check_docs.exs`: the first run found only this unindexed draft review record; after adding its index entry, it passes (278 docs, zero broken links or unreachable files).

Independent mutations, each performed only in the detached worktree and restored:

| Mutation | Observed failure |
|---|---|
| Remove TypeScript loader recipe write-site check | Position loader test fails; exit 1 |
| Remove movement standing gate | Invocation walk fails at its GameView/admission check; exit 1 |
| Remove compiler reaction write-site check | Content reserved-write test fails; 1/2 passed, exit 2 |

Restored Elixir content tests pass 2/2. Restored TypeScript position/save tests were rerun and pass 6/6; the subsequent broader 45-test run also passes. The C1P-01 reproductions are additional expected-success probes, not mutations of production logic; all their temporary inputs/test edits were removed.

Ponytail Review: lean already; no unnecessary abstraction, configuration or dependency to cut. Preserve the reserved-fact validation. The compiler extraction is justified by the size cap. No redesign or deferred feature is requested.

The PM verified the full pre-push line and all six GitHub checks green at 7cb725f before review; those are PM verification, not tests I reran. I do not claim green CI for the subsequent local cf4727f metadata commit. The developer’s schema sweep and other mutants remain developer evidence and are not claimed as my independent executions. A fix to compiler ownership normalization requires broad contract-freeze re-review under the settled brief.

Review record/index remain uncommitted for the PM to transfer; this explicit handoff exception avoids two branch writers. No external communication, push or merge was performed.


## Independent Sol second opinion at 7cb725f

Started as the ordinary secondary opinion before the owner authorized the primary-review exception. The following answer is verbatim; its final Opus sentence describes the policy at start. The one-slice owner exception governs the primary Codex review.

```text
CHANGES REQUIRED

Reviewed exact base e59627c8e94c62216e7c4dd10e829f2cad3911c0 → head 7cb725f75065db11792fb976ff61f1a7f7a2974d.

SOL-01 | blocker | lib/loka/content/artifact.ex:12
fact@1 is added after compiler validation. Add a valid fact_compare reading position to ashmere_rest, whose source requires position@1 without explicitly requiring fact@1: compilation rejects policies/upright.root.op with UNDECLARED_CAPABILITY. The loader accepts the equivalent artifact with the compiler-promised lock. Apply the implicit requirement before ownership checks; add a regression using this source configuration.

SOL-02 | should-fix | kernel/ts/src/invariants_view.ts:56
The position invariant aggregates available aliases without accounting for keyed admission. With ordinary sit available and kneel→sit blocked by its policy, keyed step correctly refuses kneel with invalid_state and the view correctly advertises it unavailable, yet the invariant returns false because sit is available. Distinguish the selected action when checking keyed decisions.

Independently verified:
- Focused position, schema, loader, resource, barrier, invocation and keyed-admission suites passed.
- All 16 cartridges compiled in memory to their frozen canonical bytes and hashes.
- Compiler rejected authored position and all three assignment sites.
- In-memory write-guard and same-position mutants failed existing tests.
- Real SQLite in-memory save/reload preserved the position fact.
- New fixture canonical/hash checked with Python; existing frozen assets unchanged.
- Workspace remained clean; no material over-engineering found.

Limitations: full pre-push, full mutation/schema sweeps, file-backed reopen and device checks were not rerun. No files changed or external communication performed. This secondary opinion does not replace the required independent Opus review.
```
## Developer fix round 1 (review pending)

- C1P-01 / SOL-01: apply Position.requires in Compiler.manifest after validation of authored capability versions and before content ownership checks; remove the late redundant call in Artifact. Existing reads/writes test now omits authored fact@1 when requiring position. A separate minimal regression prevents implicit fact@1 from hiding an unsupported authored fact@2.
- SOL-02: position view/admission observations optionally include the selected action_key. Keyed decisions inspect that action; unkeyed decisions retain matching-action aggregation. The existing alias test now includes an unavailable kneel alias while ordinary sit remains available. Governing protocol section amended before the fix.
- N1: W13’s BANDS use pointer corrected to view.ts:197; changed invariant pointer corrected too.
- Controlled reproductions: automatic-dependency input failed 1/2 before the fix and passes after; blocked-alias input failed before the invariant fix and passes after. Focused Elixir compiler/cross-kernel checks after both new regressions: 5/5, exit 0. Focused TS position: 5/5, exit 0.
- Developer mutation run after fixes: 20/20 killed, zero survivors, all restored. Adds automatic dependency omission, normalization hiding authored fact@2 and selected-alias omission to the initial 17 controls. Every failing log contains assertion evidence. All 16 cartridge source artifacts still match frozen bytes after the compiler fix.
- Ponytail and correctness self-review: two small fixes at shared boundaries; no new runtime dependency, storage shape or schema. The extra test catches normalization accidentally bypassing the existing authored-version validation. Required full pre-push check and broad primary/Sol re-review follow on the committed fix head; no approval is claimed here.


## Independent primary fix re-review — 2026-10-03

**APPROVE** at exact pushed head `678c00572f2bb3297c06114d2320b9fef064c7fc`. No remaining findings. Reviewed fixes `cdc2e7e` and `678c005` against the initial code head `7cb725f`; the initial verdict and evidence above remain historical.

The owner resumed this PR after the development/review pause. This re-review retains the one-slice independent Codex primary-review exception. I fetched the branch and reviewed in the existing detached worktree; preserved the initial local draft in the scratchpad, then loaded the committed record/index before appending. No implementation was authored or fixed by this reviewer.

The settled brief requires broad contract-freeze re-review after a compiler/loader fix. I rechecked the original requirements, the amended compiler/admission clauses, the complete position path and its contract neighbors. The fixes introduce no schema, fixture, delta, event, refusal code, persistence or app change. Existing artifact/release/trace bytes remain unchanged. The latest owner-priority documentation is process scope, not a mechanic change.

### Dispositions

- **C1P-01 / SOL-01 closed:** Compiler.manifest validates authored capability versions with Requires.check, then normalizes Position.requires before definitions and content ownership checks. Artifact no longer supplies the late redundant normalization. The existing controlled reads/reserved-writes case now omits authored fact@1; legal reads compile and all reserved writes retain the exact expected diagnostics. The new independent literal UNKNOWN_CAPABILITY case rejects authored fact@2, so normalization cannot silently hide an unsupported declared version.
- **SOL-02 closed:** The position invariant filters by observation.action_key when supplied; unkeyed Command observations retain matching-action aggregation. The alias test exercises unavailable kneel→sit while ordinary sit is available. The guarded commandOf lookup preserves own-property checks in position, door and equipment consumers.
- **N1 closed:** W13’s actual use pointer is view.ts:197; the changed invariant pointer also lands on its take refusal entry at line 76.

### Independent verification on the fix head

All commands used mise; all mutations were confined to this detached worktree with a separate local _build.

- Focused Node position, invocation, equipment, validator, transcript and file-backed SQLite reopen suites: **29/29 passed**. Separate `keyed_admission.test.ts`, `barriers.test.ts` and `sim.test.ts`: **31/31 passed**, including 500 fresh simulator sequences and existing planted controls.
- `mix test test/loka/content_rest_test.exs test/loka/cartridge_cross_kernel_test.exs --force`: **5/5 passed**.
- All **16** source cartridges independently recompiled to exact frozen known-answer artifact bytes, including rest. No frozen artifact, release or trace change appears in the fix diff.
- Eleven literal controlled observations independently check selected available/unavailable/missing aliases, the unkeyed fallback, and inherited resolver entries in position, door and equipment checks: passed.
- `elixir bin/contracts.exs --check`, `elixir bin/features.exs --check`, `elixir bin/check_docs.exs`, and `node bin/check_ts_size.mjs`: passed (docs: 279, zero broken links or unreachable files).

The following independent mutations each failed with assertion evidence, and were restored:

| Mutation | Intended failure observed |
|---|---|
| Remove early Position.requires normalization | Known-answer and legal-read/reserved-write cases fail; exit 2 |
| Normalize before raw Requires.check | Authored fact@2 regression fails; exit 2 |
| Omit selected action_key filtering | Policy-blocked alias invariant test fails; exit 1 |
| Remove loader recipe reserved-write guard | Position loader diagnostic test fails; exit 1 |
| Remove movement standing gate | Invocation walk/admission invariant fails; exit 1 |

After restoration, the Elixir compiler/cross-kernel suites pass **5/5**, and position plus SQLite reopen pass **6/6**. Source diff is clean before writing this appendix. The earlier schema sweep is not repeated or represented as independent reviewer execution because the fixes change no schema.

Ponytail Review: lean already. A single normalization line fixes the compiler boundary; commandOf reuses the guarded lookup across three consumers and fits the size budget. New regression inputs catch distinct realistic failures; no redundant fixture or future scaffolding is required. Correctness and contract-neighbor review found no new failure scenario.

The PM reports the full normal pre-push checks passed and all six GitHub jobs green on this exact head (changes, bundle, lint, elixir, sim, typescript). Those are PM verification, not my reruns. This independent approval covers code at 678c005; later owner-priority Markdown and review-record commits remain subject to the workflow’s final exact-head CI requirement. Record/index are left uncommitted for PM transfer; no push, merge or external message was performed.

## Independent Sol fix re-review at 678c005

Verbatim second opinion, run concurrently with the primary fix review:

```text
APPROVE — PR #137, fix round 1
Broad review: e59627c → 678c00572f2bb3297c06114d2320b9fef064c7fc.
No open or new findings.

C1P-01 / SOL-01 | blocker | CLOSED | lib/loka/content/compiler.ex:95
Position without authored fact@1 now permits position fact_compare reads and ordinary fact writes. Raw capability validation precedes normalization; authored fact@2 still fails. Artifact.cartridge no longer adds the dependency late.

SOL-02 | should-fix | CLOSED | kernel/ts/src/invariants_view.ts:57
With sit available and policy-disabled kneel→sit, keyed kneel refusal now satisfies the invariant. Incorrect acceptance fails it. Unkeyed observations retain aggregation; direct callers remain compatible.

N1 | nit | CLOSED | docs/world-parameters.md:35
W13 now points to the actual band selection at view.ts:197.

Independent checks actually run:
- 173 TypeScript tests passed, including position, keyed admission, schemas, loaders, equipment, containers and composition.
- Controlled probes verified twelve transitions, four same-position refusals, distinct actor scope, movement refusal order, optional projection, aliases and unchanged regeneration.
- In-memory Elixir compilation matched all 16 frozen artifacts; compiler probes checked implicit ownership, reads, three write guards and authored-fact rejection.
- Six in-memory mutations killed: compiler dependency omission, premature normalization, compiler/loader write-guard removal, same-position acceptance and selected-key omission.
- Real SQLite in-memory save/reload preserved sitting and the headless state hash.
- Independent Python artifact reconstruction passed; 500 simulator sequences passed; 15 transcripts/119 commands replayed byte-identically.
- Generated contracts, feature/docs and size checks passed. Existing hashes/releases/traces and excluded runtime files are unchanged. Ponytail review found no unnecessary machinery. Workspace remained clean.

Limits: no full pre-push, CI verification, full schema sweep, file-backed reopen or device run. Missing dependencies prevented Mix tests/xref; Elixir probes omitted Boundary setup only.
```
