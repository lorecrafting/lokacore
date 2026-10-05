# M20-A0 no-wait opening plan review

- PR: [#174](https://github.com/lorecrafting/lokacore/pull/174)
- Commit reviewed: `8ed66151c67572bfa53b5b1d8fac3b64888ee593`
- Reviewer: fresh independent Codex reviewer; authored none of the work.

## Requirements derived before reading the diff

Source: [owner no-wait opening decision](../decisions/owner-decision-no-wait-opening-2026-10-05.md).

1. Sampler Bram and chapter Q1 remain reachable; Q1 completes at the Green with Elspeth, without waiting or catching a returning NPC.
2. Q2's plank, fox charm and recovery route have no tide window; North Gate cannot require daytime. Optional night/next-day quests need player-initiated entry or explicit deferral; wisp retries cannot require idle nights.
3. Keep the clock, schedule mechanism and frozen fixture, deadlines and recovery/accessibility safeguards. No player time skips or unnecessary tide-engine prerequisite.
4. Clearly supersede only conflicting archived clauses and sampler content. Active plans must agree, while installed behavior is reported accurately as still scheduled pending a later source release.

## Verdict: CHANGES REQUIRED

### M20A0-R1 — should-fix: active tide applicability contradicts the adopted queue

`docs/spec/release-scope.json:272` still marks `tide@1` as `first_required: chapter_one`.
The active summary (`docs/spec/release-scope.md:68`) and generated feature map
(`docs/features.gen.md:42`) repeat that requirement. A developer taking chapter-one
prerequisites from the applicability source can require the tide engine even after
M10-A is retired and no optional tide consumer exists. Amend the applicability source,
its summary and generated output to match the owner decision: tide is deferred until
an actual later consumer justifies it. This is active planning metadata, not a frozen
conformance fixture.

## Checks and scope

- Actual GitHub CI at the reviewed head: changes/lint SUCCESS; Elixir, simulator and
  TypeScript jobs skipped as expected for docs-only work. Run
  [37259602884](https://github.com/lorecrafting/lokacore/actions/runs/37259602884).
- Archived Q1 sequence checked: Green entry then Elspeth `tells_name`; the decision
  preserves completion without a Bram return. Q2 plank/charm and North Gate windows,
  S3/S4/S27 entry windows and the next-night wisp retry are explicitly superseded.
  S2/Q2 deadlines and recovery/reading safeguards are retained.
- Active queue and roadmap distinguish intended stationary Bram from the currently
  scheduled sampler. Historical M1 briefs and installed cartridge documentation correctly
  describe prior/current schedule work; no claim that the replacement is installed.
- Ponytail Review: lean already; no additional framework or implementation introduced.
- Docs-only: mutation testing and device work are inapplicable. No Simulator touched.

## Scoped fix recheck — APPROVE

- Fix reviewed: `d2469f5d9dcb285e4974ef82b7f51d9746bdf3dc`.
- M20A0-R1 closed: tide is absent from chapter-one applicability in JSON and Markdown;
  the generated feature map leaves its first-required release unassigned. Registry and
  frozen conformance fixtures remain intact; no speculative later prerequisite is added.
- Independently ran `mise exec -- elixir bin/features.exs --check`: exit 0.
- Exact-head [CI run 37259909968](https://github.com/lorecrafting/lokacore/actions/runs/37259909968):
  changes, lint, Elixir, simulator and TypeScript all completed SUCCESS.
- No open findings. Scope was the three fix files and their feature-generation consumer.
