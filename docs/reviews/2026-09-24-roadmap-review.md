# Review: roadmap to R6P and verification harness (PR #5)

- PR: [#5](https://github.com/lorecrafting/lokacore/pull/5), branch `roadmap`
- Commit reviewed: `3638143`
- Reviewer: fresh Opus agent, authored none of the work. Docs-only planning, short review
  (no mutation testing).
- Verdict: **APPROVE WITH NOTES**

## What must be true (written before reading the diff)

1. The roadmap links to the gates in document 14 (R3 to R6P) and
   [pre-release-proof.md](../spec/pre-release-proof.md) and does not restate them. Where it
   summarizes, it does not contradict them or any other owner-approved target.
2. Each invariant example cites the section that actually states it.
3. The owner record quotes the owner verbatim, and nothing claims more approval than the
   quotes give.
4. The Datadog source is described as it is: what was adopted, what was deferred, no
   borrowed authority.
5. Each fact lives in one place (AGENTS.md); new facts are not copied into a second doc.

## Evidence

- `mise exec -- elixir bin/check_docs.exs`: 54 docs, 0 broken, 0 unreachable.
- Invariant citations checked against the spec text. All three are correct: 03 §23 ("An
  item has one authoritative containment/location relation"), 04 §5.1 (proposed
  DomainEvents MUST NOT be published before commit succeeds; rollback discards them), 03
  §14 ("Replays never rerun effects, ... RNG"). "One container per item" is also a
  document 14 R5 property.
- TLA+ deferral targets exist: R14 (online authority) and R20 (shard/zone handoff).
- Datadog post (fetched 2026-09-24): harness-first engineering, where deterministic
  simulation, formal specs, shadow evaluation and telemetry loops replace line-by-line
  review as the main source of correctness. The roadmap adopts invariants, deterministic
  simulation and fault injection, keeps review, and names what it defers (TLA+,
  telemetry) and why. That is an honest adaptation.
- The owner quotes keep their typos, so they read as verbatim. The IdSource record named
  in the header exists on `r3-pr1-portable-abi`
  (`docs/decisions/owner-decisions-r3-2026-09-24.md`), not yet on main.

## Findings

1. **should-fix**, `docs/ROADMAP.md:20-21`: "About 500 seeds per PR; the 10,000-sequence
   run stays nightly" contradicts the owner-approved target in
   [r1-acceptance-envelope.md](../spec/r1-acceptance-envelope.md) (randomized
   differential testing, approved under ADR-064): "every fast semantic CI run ...
   executes a fixed regression seed set plus at least 10,000 fresh sequences". No owner
   decision relaxes that target, and the owner record's item 3 does not mention a per-PR
   seed count. Failure scenario: a PM sizes the R5 simulation slice to 500 seeds per PR,
   citing an "owner-approved" roadmap. A divergence that shows up about once in 5,000
   sequences then gets through PR CI, which the approved target was set to catch.
   The "stays nightly" half also restates `AGENTS.md:185-186`, which already carries the
   same deviation (that line predates this PR). Fix: either get an owner ruling on
   per-PR sizing and link it, or drop the numbers and link the envelope.
2. **should-fix**, `docs/ROADMAP.md:5-6`: "Owner approval of the plan and of the
   verification additions" overclaims. The record covers compile-time Elixir contracts,
   six R3 PRs, and the harness suggestions. It does not cover the R4 to R6P slice counts,
   the per-PR seed count or the 8 to 18 million token estimate. Failure scenario: a later
   reader treats the whole ~32-slice plan and its estimate as owner-approved and does not
   ask again when R4/R5 are split. Fix: "Owner approval of the R3 split and the
   verification harness".
3. **should-fix**, `docs/ROADMAP.md:10-11`: "Correctness comes from an automated harness"
   lists only invariants, kernel-to-kernel simulation and faults. It leaves out the
   reviewed known-answer fixtures, which the envelope makes authoritative ("Agreement
   between implementations is not correctness ... the reviewed known-answer fixtures
   stay authoritative"; also AGENTS.md "Writing tests"). Failure scenario: both kernels
   agree on a wrong Lantern step, every invariant holds, the simulation is green, and by
   this page's definition the change is correct even though it diverges from
   `conformance/lantern-traces.json`. Fix: one clause saying the reviewed fixtures stay
   the oracle, linked instead of restated.
4. **should-fix**, `docs/ROADMAP.md:33` (R3 row): six PRs are listed, but three R3A
   constitutional contracts from document 14 are in none of them: core policy
   AST/versioning, the TargetResolution `none | unique | ambiguous` result contract, and
   the typed relation/provenance foundation. The Gate R3 outputs (capability/schema docs,
   residency matrix) are also missing. Failure scenario: PRs 1 to 5 get briefed from this
   table and the gap only appears at the PR 6 gate review, as a seventh PR. Fix: assign
   them, or say the R3A list in document 14 is the checklist and link it. The second
   option also avoids a partial restatement.
5. **nit**, `docs/ROADMAP.md:36` (R6 row): the fake synchronization adapter, installed
   cartridge manager and play-time reconciliation from document 14 R6 are missing. The
   fake adapter is required by pre-release-proof P2/P6.
6. **nit**, `docs/decisions/owner-decision-roadmap-2026-09-24.md:3,8-14`: the header says
   "relayed verbatim", but only the answers are verbatim. The bold headings and item 3's
   question are paraphrases (the R3 IdSource record quotes its question). Label them as
   paraphrase. Also, once PR 1 merges, turn the backticked IdSource filename into a link.

No over-engineering: one page plus one record, with links instead of copied gate text,
except as noted in findings 1 and 4.

## Re-review of `f564fa7` (fix commit, scoped)

Verdict: **APPROVE**. I checked only `git show f564fa7`. `check_docs`: 55 docs, 0 broken,
0 unreachable, and AGENTS.md is within its word budget (1,960 words). `check_docs` does not
check anchors, so I checked the two new anchors against GitHub's slug rules by hand:
`#r3--contractschema-foundation` and `#r6--offline-authority-and-save-system` both resolve.

1. Seed target: fixed. The roadmap now links the envelope instead of giving numbers.
   `AGENTS.md:185-186` now matches the envelope (at least 10,000 fresh sequences on every
   fast CI run). It still restates the number with a filename citation. That is
   acceptable in a checks summary, but it is not a link.
2. Approval scope: fixed. The roadmap names what the owner approved and labels the slice
   counts and estimate as PM planning.
3. Fixtures: fixed. The reviewed known-answer fixtures are stated as authoritative, with
   the reason.
4. R3 coverage: fixed. Document 14 §R3A/§R3B and Gate R3 are the linked checklist. Policy
   AST, TargetResolution, relations/provenance, the residency matrix and generated docs
   are now assigned to PRs 3 and 4.
5. R6 nit: fixed. The row links 14 §R6 and names the fake synchronization adapter.
6. Owner-record nit: fixed. The header separates the verbatim answers from the
   assistant's summaries. The IdSource filename stays in backticks until R3 PR 1 merges,
   as the finding allowed.

No new issues in the touched lines.
