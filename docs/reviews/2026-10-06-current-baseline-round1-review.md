# Current baseline Round 1 independent review — 2026-10-06

Fresh independent reviewer; authored none of the candidate. Reviewed local branch
`docs/current-baseline-round1`, exact head
`c6efb4203e966f9552c411c4a7e5aeb47dfc0dbc`, against published main `87ac4cbb`.
Scope: the 15 Markdown files in this baseline reset. ROADMAP carry cleanup,
old conformance packets and fixture retirement belong to later batches.

Governors: [active system](../system/README.md), [owner rules](../system/owner-rules.md),
[forward development](../decisions/owner-decision-forward-development-2026-10-05.md),
[preproduction compatibility](../decisions/owner-decision-preproduction-compatibility-2026-10-04.md),
[mobile pause](../decisions/owner-decision-web-first-mobile-pause-2026-10-05.md),
and the published [roadmap](../ROADMAP.md).

## Requirements

The active baseline must describe published A–D behavior and one current v042
identity, while keeping E1–E3 and native verification open. Genesis must distinguish
ordinary placement from templates/population births and account for the consumed
holder and initial knowledge. Saved attributes, modal/dream controls and bound
Continue must agree with current source. Historical records and inbound links must
survive. Forward development must preserve explicit pin refusal, owner-save bytes
and isolated testing without implying backward compatibility or native proof.

## Verdict: CHANGES REQUIRED

**BASE-R1 — should-fix — reconcile the remaining published-feature status claims.**
At the reviewed head, `docs/system/cartridge.md:1346` still declares D12 implementation,
PR and source proof **null until source work**, and `docs/system/protocol.md:1180`
assigns its protocol/schema changes to a future source slice. Meanwhile
`docs/system/owner-rules.md:128` says C3 implementation and independent proof remain
ahead; `docs/system/cartridge.md:942` calls deer/crows, bell disable and C4 future.
The roadmap records D12 published in PR #245 and C3/C4/D7/D8/D9 among the completed
30 slices; their implementations are present in the reviewed baseline. A builder
following these active clauses would treat installed behavior as unavailable or
start redundant implementation/pinning work, contradicting the reset's current
chapter claim. Replace those stale status statements with current behavior or links
to the existing identity and dated proof. Retain the historical records unchanged.

## Verification and assessment

- `mise exec -- elixir bin/check_docs.exs`: **755 docs, 0 broken links, 0 unreachable**.
  `git diff --check 87ac4cbb HEAD`: passed.
- Independently checked all **25** renamed headings against their explicit retained
  old IDs; representative D10 source-review and S2/D7/D8 inbound fragments resolve.
- Source manifest and v042 artifact agree on `0.0.42` / API1.37; artifact has 57
  rooms and allocation oracle has 211 IDs. SHA-256 of the oracle's canonical bytes
  matches the stated final hash and D10's scoped final content review.
- Inspected fresh allocation/filtering, population genesis, visible initial knowledge,
  selected-attribute fallback, modal Continue/final consequences and the actual
  anchored `DreamPage`/Resume controls. The changed descriptions agree with those
  implementations; no new runtime behavior is selected.
- The candidate changes no decision, review, evidence, code or fixture history.
  Mobile lessons preserve the native pause, isolate fresh-start tests, protect the
  owner save and require byte-preserving mismatch refusal. They do not claim native
  or blur proof from headless/browser results.
- Ponytail Review: no new machinery or competing release-identity source. The
  retained heading aliases are small and necessary for historical references.
  BASE-R1 can be fixed by removing stale status prose and linking existing truth.
  No new tests or mutation checks are warranted for this documentation-only change.

No native session, browser session or owner-save access was performed.

## Scoped BASE-R1 recheck — APPROVE

Reviewed only `c6efb420..388c430eb9b14f285d44c6c2285c3c94890946d8`
and the three changed documents' linked contract/proof destinations. **BASE-R1
closed; no open findings.** D12 now links the current chapter identity and final
primary/save acceptance; C3 links its published source/save approval; C4, D7, D8
and D9 are correctly identified as installed consumers. The dated records remain
unchanged and the current release answer still has one owning section.

Independently read the three cited review records and checked v042's two D12 skills,
careful two-item declaration, Peg discount, eight population plans and C4 pack
opt-in. All five current-contract fragments introduced by the correction resolve.
`mise exec -- elixir bin/check_docs.exs` passes with the review record present:
**756 docs, 0 broken links, 0 unreachable**. Scoped `git diff --check` passes.
Ponytail Review: **Lean already. Ship.** The fix replaces stale status prose with
existing contracts/proof links and adds no parallel implementation or pin source.
This approval covers documentation truth at `388c430e`; remaining chapter and
native gates retain their existing scope.
