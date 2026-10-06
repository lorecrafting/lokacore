# Chapter 1 integration publication status — independent review

Initial head `8001562367c48312e0b53bffa1909b61d782e374`, against published
main `c20addb09431f1ab75b56402d422cc9a29cb8360`. Fresh reviewer authored
none of the combined planning/status changes; reviewed in a separate detached
worktree. Scope: combined docs/Beads publication, not provisional source approval.

## Initial finding and scoped correction

**C1S-1 — should-fix:** the D6 tracker note called the water-rule plan adopted,
while its independent planning approval leaves policy/spec adoption open. A future
PM could mistake plan review for an adopted implementation contract. The PM
corrected only that note to require policy/spec adoption, exact-base re-pin and
reviewed planning publication before source. D6 remains open and uncounted.

## Scoped final verdict — APPROVE

Exact corrected head `47cd1ee90a82b9fc8168f966fca27625294e20a0`.
The single D6 note correction closes C1S-1; no open findings. Complete export
check and diff whitespace check pass after the correction; the final record/index
also pass docs checks (645 documents, zero broken links or unreachable documents).

## Verified aggregate status

- GitHub confirms [PR231](https://github.com/lorecrafting/lokacore/pull/231)
  merged at the base above and [PR223](https://github.com/lorecrafting/lokacore/pull/223)
  merged at `4bcb2eafd0a984c611b71c3e4dc1e0d26defd533`. All six D1 source/evidence
  jobs at `cd84ff6d` succeeded; final record head `299fbb30` has successful applicable
  jobs and skipped code jobs. D1 primary/save and final Sol records approve; prior
  browser findings are closed. The roadmap distinguishes public-isle play from
  controlled death/corpse proof and removes stale D1/D2 source-unbuilt claims.
- Exactly 33 unique tracker rows: 18 closed, 2 in progress (C4/D4), 13 open.
  Closed slices exactly match the roadmap: A1–A3, B1–B9, C1–C3, D1, D2 and D5.
  Only D1 newly closes. The graph is acyclic. Its ready unfinished rows are
  C4, D3, D4, D6 and D12; graph readiness does not waive adoption/source gates.
  C5 waits for C4, C6 for C5, D7 for C4/D4, D8 for D6, D9 for D4,
  D10 for D3/D4/D6, D11 for D6/D12, E1 for unfinished slices, E2 for E1,
  and E3 for E2.
- D8’s plan/brief/export consistently require D6’s real old coin; its independent
  dependency approval is retained. C5 correctly names Wick’s finite herb exchange,
  B8 provider-stock debit and conditional D4 held-food custody; its separate
  approved correction keeps C4/publication and adopted bleed/combat-use gates.
- Local C4 corrected-source primary/save/foundation approvals at review commits
  `4cefadc8`, `99cf48d0` and `e99f57ee` support the provisional WIP claim;
  source `251b0bff`/evidence `7b38aa14` still require D1 integration, successor
  pins, combined gate and publication. Local D4 primary/save records approve
  provisional source `347c8197`/evidence `b656219d` only. D3 review `58de427c`,
  D6 planning approval at `37989396`, and D12 scoped approval at `5dc4cfca`
  support the short local-plan notes. None is counted published by this update.

Validation at initial aggregate head: complete Beads export check exit0;
`mise exec -- elixir bin/check_docs.exs` exit0 (644 documents, zero broken links
or unreachable documents); aggregate diff whitespace check exit0. Export is
path-clean; actual changed tracker fields contain no machine paths. Existing
per-correction reviews remain intact. No source, owner save, preview/native
session or tracker database was changed by this reviewer. Docs-only scope
requires no mutation or runtime suite.

Ponytail Review and correctness: lean status corrections using existing records,
links and tracker; no extra machinery or unrelated source changes.
