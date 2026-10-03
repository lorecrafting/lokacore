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
