# Feature-map red controls and size-control extraction

- Local branch: `fix/features-red-control`; base `c5bc8164`.
- Exact source reviewed: `4b451a5c35281110ec5aedda79f7236a9fffff73`.
- Fresh independent reviewer; authored none of the source change.
- Verdict: **APPROVE**. No findings or open items.

## Required behavior

[CHECKS](../CHECKS.md) requires an implemented capability missing feature-map
cells to fail, and each planted violation to trigger its intended diagnostic.
[Workflow](../WORKFLOW.md#review-stance) requires proportionate independent
verification. Plants must preserve existing files; extracting size controls must
retain their literal cases, cleanup, output and parent failure propagation.

## Independent verification

- Inspected cumulative `c5bc8164..4b451a5c` diff. Both selectors require absent
  rule, implementation marker and spec; the ruleless selector also requires no
  commands. Existing occupied-path refusal and exclusive creation remain intact.
- `elixir bin/features.exs --check`: exit 0 before and after controls.
- Ran the three feature cases from the exact final `bin/red_controls.exs` in
  isolation: exit 0, each planted check returned its required failure diagnostic.
  The prior harness reproduced the stale `skills@1: missing spec` expectation
  failure against already-implemented skills.
- In-memory mutations removing required-cell checks and ruleless detection both
  made the feature harness fail, including the relevant missing-spec controls.
  No source edits were needed for these controls.
- `elixir bin/red_size_controls.exs`: exit 0. Extracted cases and literal expected
  diagnostics are unchanged; the main script forwards output and accumulates
  the child exit status. Isolated parent tail with a controlled child exit 1
  also exited 1.
- Focused source-size check and `mix format --check-formatted` pass. Parent and
  child are 222 and 114 lines. Working tree was clean after all planted cases.
- Commands used the pinned toolchain through `mise exec --`. The full accumulated
  publication check remains the PM's gate; it was not rerun for this review.

Ponytail review: Lean already. Ship.
