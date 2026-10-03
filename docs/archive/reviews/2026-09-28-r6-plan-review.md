# R6 plan review — PR #58

Reviewed head: `05af857` (`r6-plan`). Independent Codex review; reviewer authored none of the proposal. Docs-only, so no mutation testing.

## Requirements derived before reading the diff

- R6 plans a serialized `LocalInstanceAuthority`, SQLite atomic state/receipt/RNG commit, recovery after definitive rollback and uncertain COMMIT, save slots/snapshots, installed cartridge management, offline time policy, and local milestone/report capture with fake synchronization ([14 §R6](../spec/14-implementation-plan.md), [03 §§14–15](../spec/03-domain-state-persistence.md), [07 §§8–10](../spec/07-offline-storypacks-to-mmo.md)).
- Retry admission authorizes the logical lineage, compares stable invocation intent, and looks up receipts before current-world action resolution. Successful and failed admitted attempts are durable; replay never reexecutes costs, RNG, effects, or consequence. A save failure cannot advance displayed durable state ([03 §§14–15](../spec/03-domain-state-persistence.md), [OFF-03–06](../spec/15-acceptance-scenarios.md)).
- The proof uses only selected R7/R8 slices: one offered quest, durable consequential choice, typed fact/reaction, Bram's schedule, touch actions, four connected places, and short readable prose. It is separate from the full 57-room chapter and does not pull in later capability features just because they share a family ([pre-release proof](../spec/pre-release-proof.md), [release scope](../../spec/release-scope.json)).
- R6P tickets follow P1 identity/outcome → P2 atomic authority; P3 compiled content depends on P1 and minimal R4; P4 shared interaction depends on P2/P3; P5 touch depends on P4; P6 device/adversarial evidence depends on P5. Proof completion needs exact candidate-adapter known answers, crash/retry boundary checks, physical iOS and Android evidence, and human touch comprehension ([pre-release proof](../spec/pre-release-proof.md)).
- Offline time includes idempotent sampled/clamped `real_elapsed` resume input; default Story time advances through accepted actions/waits. Cartridge/version/capability pins preserve old runs. Three named bookmarks, migration and manual export/import are first-public-release obligations, distinct from R6P proof scope ([07 §10](../spec/07-offline-storypacks-to-mmo.md), [10 §§31–32](../spec/10-mobile-commerce-release.md), [OFF-07–13](../spec/15-acceptance-scenarios.md)).

## Findings

- **B1 (blocker), `docs/ROADMAP.md:62`.** P1 is a prerequisite for S1, but the six R6 slices contain no P1 deliverable, and the four R6P slices are listed after R6. If development starts with S1, `mobile/authority/local-story/index.ts` still only exports `KERNEL_ID`; there is no accepted identity/outcome adapter for S1 to use. Assign P1 to an explicit slice before S1, or include its full deliverable and known-answer acceptance in S1, then reconcile the slice order/count.
- **S1 (should-fix), `docs/ROADMAP.md:68`.** S3 pins content and handles a missing release, but does not plan the installed-cartridge manager or retention check required by R6 and OFF-12. If a v1.2 bookmark remains after v1.3 installs, cleanup could delete v1.2; reporting a missing-release error on restore does not satisfy the required deletion block or explicit migration/deletion. Include the installed-release reference/garbage-collection rule and a controlled deletion attempt in S3 acceptance ([10 §16](../spec/10-mobile-commerce-release.md), [OFF-12](../spec/15-acceptance-scenarios.md)).
- **S2 (should-fix), `docs/ROADMAP.md:66`.** S1 says to look up receipts before current-target validation and reject altered intent, but its acceptance only says “duplicate delivery” without a consumed target or altered payload. A test that redelivers `wait` while it is still valid could pass even if an old choice is revalidated and rejected after consumption, or a changed choice under the same ID is admitted. Require replay of a consumed/stale choice and integrity rejection for the same ID with different intent ([03 §14](../spec/03-domain-state-persistence.md), [pre-release proof adverse paths](../spec/pre-release-proof.md)).
- **S3 (should-fix), `docs/ROADMAP.md:54`.** The early R7/R8 list names schedule and behavior but omits `calendar@1`, which `release-scope.json` marks proof-required in R8 and `docs/features.gen.md` still marks unimplemented. Bram's 06:00–19:00 schedule could be implemented against an ad hoc time interpretation without the required calendar capability or lock. Assign its minimal proof semantics alongside schedule (or name the slice that already supplies them); the R6 host's S4 clock reconciliation alone does not implement this portable capability.
- **N1 (nit), `docs/ROADMAP.md:73`.** The stage rows now sum to 30 slices after R3 (`3 + 1 + 11 + 6 + 5 + 4`), while this line says 27; an explicit P1 slice would make 31. An owner using this total to budget the approved plan undercounts the work. Recompute the total and label the older ADR estimate as historical if retained.

## Checks and verdict

- Compared the one-file, 17-line PR diff with the requirements above and the cited acceptance scenarios. The new early R7/R8 wording names quest, dialogue, durable scene choice, schedule/behavior, reaction and narration; the omitted proof calendar is S3.
- Simplicity review: the diff adds no implementation abstractions or dependencies. The findings concern a missing prerequisite and contract evidence, not a request to broaden the proof.
- No mutation test (docs-only). `mise exec -- elixir bin/check_docs.exs`: 141 docs, 0 broken links, 0 unreachable. `gh pr checks 58`: Elixir, lint and TypeScript all passed at `05af857`. `git diff --check origin/main...HEAD`: clean.

**Verdict: CHANGES REQUIRED.**

## Fix round 1 — `e3cf692`

Scoped re-review of the changes after `95061a9`; the five original findings were checked against their direct roadmap lines and the governing spec. No implementation or mutation test (docs-only).

| Finding | Disposition |
|---|---|
| B1 | **Partially fixed.** `docs/ROADMAP.md:53,55,64` puts P1 before S1, assigns a distinct slice, and corrects the P2/P3–P6 sequence. Its acceptance still says only “controlled known answers.” [P1](../spec/pre-release-proof.md#implementation-tickets-and-dependency-graph) requires **exact fixture results on selected host paths**, and the proof's evidence section requires running the corpus against the actual candidate adapters. A pure digest/helper test could pass while the adapter's Node or Hermes path produces different identity or outcome bytes. Name the selected P1 host paths and require exact frozen fixture results from the actual adapter there; P6 retains full device proof. This is a remaining **should-fix** acceptance gap, not an unscheduled-prerequisite blocker. |
| S1 | Fixed. `docs/ROADMAP.md:67` now makes installed-release retention cover saves, bookmarks, recovery copies, pending validated restores, active references/downloads and completed migration, and requires an old-release deletion control. |
| S2 | Fixed. `docs/ROADMAP.md:65` now requires replay of a consumed choice from a stale view and integrity conflict for changed intent under the same ID. |
| S3 | Fixed. `docs/ROADMAP.md:54` assigns the proof's calendar with the NPC schedule/behavior slice. |
| N1 | Fixed. `docs/ROADMAP.md:72` totals 31 slices and labels the older estimates historical. |

`mise exec -- elixir bin/check_docs.exs`: 141 docs, 0 broken links, 0 unreachable. `git diff --check 95061a9..e3cf692`: clean. PR body matches the revised sequence. All three CI jobs at `e3cf692` passed (Elixir, lint, TypeScript).

**Verdict at `e3cf692`: CHANGES REQUIRED** (one should-fix remains).

## Fix round 2 — `460b47d`

Scoped to the remaining P1 acceptance finding. `docs/ROADMAP.md:64` now requires the **actual adapter** on Node, Android Hermes and iOS Hermes to match exact frozen fixture results, with per-step canonical state/result bytes for mismatches. This satisfies [R6P P1](../spec/pre-release-proof.md#implementation-tickets-and-dependency-graph), its candidate-adapter evidence rule, and [ADR-074 §3](../decisions/adr-074-ts-first-proposal.md#3-the-proposal). P6 retains the full physical-device proof. The PR body agrees; no new finding.

`git diff --check c2f384f..460b47d`: clean. `mise exec -- elixir bin/check_docs.exs`: 141 docs, 0 broken links, 0 unreachable. CI for `460b47d` was pending at review time; the PM must confirm it finishes green before merge.

**Verdict at `460b47d`: APPROVE.**
