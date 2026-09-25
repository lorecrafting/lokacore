# Review: observability design slice plan, Astra scope (PR #28)

- PR: [#28](https://github.com/lorecrafting/lokacore/pull/28), branch `docs-observability-plan`
- Commit reviewed: `ac8d833`
- Reviewer: independent (Opus); authored none of it. Docs-only, so the short review
  ([Review stance](../WORKFLOW.md#review-stance)); no mutation testing.
- **Verdict: APPROVE WITH NOTES**

## What must be true (written before reading the diff)

1. Owner quotes are marked as verbatim relays, attributed, and not strengthened by the
   surrounding text; the PM's own proposal is labeled as the PM's.
2. The PM-proposal summary matches spec 11 §11-15, 08 §6, 09 (§7 trace viewer) and
   Foundry's `docs/OBSERVABILITY.md` and `REPAIR-PLAN.md` FR-18.
3. The ROADMAP row links rather than restates facts owned elsewhere, and the slice count
   and its estimate agree.
4. The WORKFLOW Astra rule is unambiguous and consistent with the Fable rule above it and
   with every other Astra mention in the docs.

## Checks

- Quotes: both sections open with an attribution line and a "no checker can verify"
  caveat; typos are preserved; the PM text is labeled "(summary)". Holds, except N1.
- Spec: 11 §11-15 (identity, structured logs, telemetry, tracing, separate game trace
  store), 08 §6 (diagnostics consumed by code, not prose) and 14 §R14 ("observability")
  match the summary. Holds.
- Foundry: FR-18A (unknown/unavailable/corrupt distinct from empty healthy), FR-18B
  (producer/validator split), OpenTelemetry export as step 5 of 7 and an optional sink,
  cost tied to accepted outcomes, "observation is never authority". Mostly holds; N2.
- Slice count: 3 + 1 + 8 + 6 + 5 + 4 = 27. Correct. Estimate: S1.
- `grep -rni astra` over the docs and `.claude/`: the only live process text is WORKFLOW
  l.20-26 and l.66 ("Astra relays" still go to the owner), which agree. Other hits are
  review records (history) and spec prose naming Astra as an agent. No contradiction.
- The added scratchpad bullet (WORKFLOW l.82) is consistent with Git hygiene.

## Findings

- **S1 (should-fix)** `docs/ROADMAP.md:48-50`. The count moved from 26 to 27 but the
  estimate beside it is still ADR-074 §6's 8.48-9.20M, which is the sum for exactly 26
  slices at 0.4M each. A reader budgeting to R6P from this page undercounts by about 0.4M.
  Fix: raise it to about 8.9 to 9.6 million, or say the ADR-074 figure covers the 26 and
  the observability slice adds about 0.4M.
- **S2 (should-fix)** `docs/ROADMAP.md:42`: "the game-trace format (derived from committed
  state, never authority)". Spec 11 §12 logs `runtime.command.rejected` and
  `runtime.commit.failed`, and 09 §7's trace is keyed on "decision accepted revision
  18→19", which implies rejected decisions are traced too. A developer briefed from this row
  designs a trace built only from commits and cannot record a rejected command or a failed
  commit, the cases a repair loop most needs. Neither the spec nor the decision record says
  "derived from committed state". Fix: "never authority" alone, or "records decisions,
  never authority".
- **N1 (nit)** `docs/decisions/README.md:41` and `docs/WORKFLOW.md:22-23`. The link text
  "Astra only for foundational freezes" and the "owner decision" label present the PM's
  rule as the owner's. The owner said "important PRs or important work ... maybe astra
  extra reviews for foundational super critical pieces ... I leave it up to you". The
  record's l.37 says correctly that the PM applied it. Scenario: a later PM treats "only
  foundational freezes" as an owner constraint it cannot relax for an important
  non-foundational PR. Fix: "Astra scope (delegated to the PM)".
- **N2 (nit)** `docs/decisions/owner-decisions-observability-astra-2026-09-25.md:21,25`.
  (a) "drifted from its validators and was deleted" reads as cause and effect. Foundry's
  OBSERVABILITY.md says the telemetry was deleted with the daemon stack in the clean-room
  batch A1; the drift is FR-18B's separate finding. (b) "measure accepted outcomes, not
  tokens" inverts FR-18B/step 7: Foundry keeps token usage (input, cache, output,
  reasoning) as required measures and ties them to the accepted outcome, so that "a cheaper
  token path cannot hide worse ... outcomes". Scenario: the design slice drops token usage
  from the record format on the strength of this line. Fix: "tie token cost to accepted
  outcomes".
- **N3 (nit)** `docs/ROADMAP.md:42`. The row cites "Spec 11 §11-15, 08 §6" but not 09 §7
  (trace viewer), which the record cites and which fixes the trace's grouping by
  correlation. It also restates design principles (unknown/unavailable, stores by purpose)
  that the record already holds and the slice's own output will own, so the row goes stale
  when the slice lands. Fix: add 09 §7; keep the row to scope and links.
- **N4 (nit)** `docs/WORKFLOW.md:20-22`. The Astra examples ("a new encoding, hash domain
  or core contract, a gate review") do not match the Fable list three lines up ("a spec
  amendment, a canonical encoding, an identity or delta contract, a gate review"). A PM
  matching words cannot tell whether a spec amendment (ADR-074 had Astra) or an identity
  contract qualifies. "The PM decides" covers it, so this is not a blocker. Fix: say
  whether spec amendments are in or out. The parenthetical also mixes examples, an
  exclusion, a decider and a citation in one clause, and l.23 is unwrapped (about 150
  characters against the file's 90).
