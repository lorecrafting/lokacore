# M4-A first-encounter contract review — 2026-10-03

PR: [#151](https://github.com/lorecrafting/lokacore/pull/151). Reviewed commit: `04fa45025fd97013e469f9a37315714736c86f0a`.

**Verdict: APPROVE.** Fresh independent reviewer; authored none of the subject. Findings: none. Open items: none.

## Requirements derived before the diff

From merged `91da6b32e57d2e72ef7b96d4d158b6f3f92fa86f`: [M queue](../NEXT-MECHANICS.md), [delegation](../decisions/owner-decision-autonomous-mechanics-2026-10-03.md), [PM continuation policy](../decisions/pm-decision-mechanics-continuation-plan-2026-10-03.md) and [workflow](../WORKFLOW.md).

- Establish planned semantics for actual Maud-cellar rats, with content-owned numbers and minimal selected mechanics; preserve the installed/planned distinction.
- Pin conditional RNG, eligibility, deterministic escape and death-before-revival ordering; ordinary menus grant no immunity and mandatory reading remains safe.
- Require real persisted corpse custody and a reachable authored shrine before M6 lethality; retain story progress and recoverable possessions.
- Leave S1 population/objective/reward integration to its consuming slices; adopt no unreviewed PR #136 equations or unused resolver.

## Verification

Inspected all eleven changed Markdown files against those requirements. S0–S5 match the independently retained [numeric vectors](../spec/conformance/numeric-vectors.json) exactly. Hand-checked uniform acceptance/modulo arithmetic, conditional draw counts, alternating initiative and HP outcomes for oracles A/B/C. Their answers do not come from combat code.

Inspected targeted State/World, resource lookup and save-load source: actor-specific HP and durable dynamic-corpse gaps are accurately described. The four-room chapel route matches [00a §2](../archive/spec/00a-chapter-one-content.md#2-room-graph); those rooms are absent from the current sampler.

`git diff --check` passed. PM confirmed applicable exact-head CI green; code jobs were expected docs-only skips. No executable schemas, code or fixtures changed; no mutation tests, builds or native/storage operations were needed.

Ponytail Review: Lean already. Ship.
