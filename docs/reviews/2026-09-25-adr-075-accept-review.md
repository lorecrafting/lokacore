# Independent review: PR #33 "ADR-075 accepted; first dev-evidence entries; merge-rule wording"

- PR: [#33](https://github.com/lorecrafting/lokacore/pull/33), branch `adr-075-accept`
- Commit reviewed: `544b263`
- Reviewer: Claude Opus 5.5, fresh agent; authored none of the work.
- Depth: short (docs/data slice, no mutation testing of code, per WORKFLOW "Review stance");
  the ledger check was exercised on planted violations.
- Brief: record the owner's acceptance of [ADR-075](../decisions/adr-075-observability-proposal.md)
  the way ADR-074 was recorded; append the PR #29 and #30 `agent.work` lines; reword step 7.

## What must be true

1. The owner record quotes exactly `okay yes` and follows the established owner-record
   format; ADR-075's status line and document 16 name it Accepted and link the record.
2. The document 16 entry has the ADR-074 shape (index link, heading, status line, summary),
   and its summary neither misstates nor overstates ADR-075: four stores, observation never
   authority, the replay input, unknown/unavailable, redaction, kernel version as source
   revision.
3. `docs/dev-evidence.jsonl` holds seven canonical, valid, unique `agent.work` lines with the
   intended values, and `registries_test.exs` fails if one is broken.
4. Review records and older owner decisions are unchanged; step 7 keeps the owner's rule.
5. `check_docs` passes; CI green.

## Verdict: APPROVE WITH NOTES

No blocker. One should-fix (document 16 summary omissions), three nits.

## Verified

- **Owner record.** `owner-decision-adr-075-2026-09-25.md` quotes `> okay yes` exactly and
  uses the same shape as `owner-decision-ci-mobile-builds-2026-09-25.md` (relay line,
  "What the PM proposed (summary)", "Owner's words", result). ADR-075's status line matches
  ADR-074's wording. The plural `owner-decisions-adr-075-2026-09-25.md` (items 1-2, which
  the ADR cites) is a distinct, untouched file; the two names are close but both linked
  from `docs/decisions/README.md`.
- **Document 16 shape.** Index link at :89, heading :900, status :902, summary :904: same
  as ADR-074's entry (which also carries a crosswalk; ADR-075 has none, correctly omitted).
- **Summary accuracy.** Record format, canonical JSON Lines, registry, four stores joined by
  closed per-store ids, `kernel_version` as source revision, explicit unknown/unavailable,
  "observation explains and never decides", registration with the first producer, producer
  validation in CI: each is stated in the ADR (§1, §2, §3, §5, §4, §7). Nothing overstated.
- **Ledger.** Decoded independently (Python): the seven lines are PR 29 pm opus 1 unknown;
  developer opus 1 observed 714818; reviewer fable 1 observed 777244; reviewer astra 2
  unknown; PR 30 pm opus 1 unknown; developer opus 1 observed 95895; reviewer opus 1
  observed 73212; all `merged`. Each equals its sorted-key compact re-encoding; file ends
  in one newline. `mix test test/loka/core/registries_test.exs`: 16 passed.
  Planted: astra's `instance` 2 → 1 gives `duplicate: {29, "reviewer", 1}` (fails);
  developer tokens as bare `714818` fails as `:invalid`. Both restored.
- **History.** `git diff origin/main...HEAD` touches no file under `docs/reviews/` and no
  older owner decision; the only edited decision file is ADR-075's status line.
- **Step 7.** "every CI job started on the head has finished green" keeps the owner's rule
  ("every CI job that ran is green on the head") and closes the reading where a job still
  running has not yet "run". The owner record it cites is unchanged.
- `mix run bin/check_docs.exs`: 104 docs, 0 broken links, 0 unreachable. PR checks
  `elixir`, `lint`, `typescript` pass.

## Findings

1. **should-fix** — `docs/spec/16-decision-register.md:904`: the summary omits redaction
   and the replay input. Document 16 is the register a later brief cites; an R5 producer
   briefed from it learns neither that every producer's acceptance tests must plant a
   schema-valid leak (home/worktree path in `Diagnostic.path`, device serial in
   `Diagnostic.data`) and strip or reject it (ADR §6), nor that the replay input is the
   `trace.run` header plus the Commands by gap-free `ordinal`, and that replay never reads a
   decision or commit outcome (ADR §4). "Replaying the seed" alone reads as if the seed were
   the whole repro. Suggested addition: "Replay input is the `trace.run` header plus the
   Commands by ordinal; replay never reads a decision or commit outcome. Records carry no
   device ids or local paths, game traces stay on the device by default, and each producer
   tests one planted leak."
2. **nit** — `docs/spec/16-decision-register.md:904`: "`kernel_version` is the source
   revision" drops the `-dirty` rule (a dirty tree never reports bare HEAD, ADR §3), the
   part that keeps a record a valid repro key. Four words fix it: "... revision (`-dirty`
   when the tree is)".
3. **nit** — same line: "Unknown and unavailable measures are explicit, never 0 or absent"
   compresses two rules (unknown is never 0; unavailable is never absent and carries its
   cause) and the ADR applies them to the commit outcome, RNG draws and run header too, not
   only Measures. Harmless as a pointer; the full text is linked.
4. **nit** — `docs/spec/09-cartridge-lab-certification.md:199` and
   `docs/spec/11-security-observability-operations.md:256,278,319,337,356` still link
   "proposed ADR-075". A reader of 11 may take those amendments as pending. Precedent left
   "proposed ADR-073" at `14-implementation-plan.md:245`, so optional; if changed, change
   all six.
