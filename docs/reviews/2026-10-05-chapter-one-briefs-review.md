# Chapter 1 implementation and proof briefs — PR #193

Reviewed source: `87b7bbcad00684b39284973f0ee3f55beee597e3`.
Independent docs-only review. **Verdict: CHANGES REQUIRED.**

## Requirements derived before the diff

The roadmap must lead a developer to the public 33-row plan and every corresponding brief. The approved plan owns dependencies; in particular, D1 offers Sedge's immediate swim lesson, D6 uses that earlier lesson, and C6 may later grant it idempotently (PR #192 scoped review and `docs/MISSING-CHILD-PLAN.md`). The briefs are provisional assignment advice: they cannot claim source authorization, merged future dependencies, release identity, gate approval, browser proof or native/public-release certification. Current owner decisions require the real Ashmere cast, no mandatory wait and a browser-first development pause with native evidence carried to prelaunch.

## Finding

- **R193-1, should-fix — `docs/briefs/chapter-one/d1-ferry-isle-brief-2026-10-05.md:9,23` and `docs/briefs/chapter-one/chapter-one-c6-marsh-expedition-brief-2026-10-05.md:9`.** D1 explicitly sends swim to D6 and excludes training, while C6 says finishing S27 opens Sedge's lesson. The approved public row requires an immediately available lesson in D1, before D6, and the PR #192 review specifically closed the pre-S27 access issue on that basis. A developer following D1 would ship Sedge without the promised lesson; a developer following C6 could gate a lesson that should already be free. Align the three briefs on one sequence: D1 offers it, D6 consumes it, and C6 only acknowledges or idempotently repeats it if retained. D6's own brief already describes early free learning, but conflicts with D1's explicit scope exclusion.

## Checks

The index has 33 distinct IDs and 33 distinct existing brief files; none is unindexed. Local Markdown links from the roadmap, public plan, index and all 33 briefs resolve. Every brief links the current roadmap, carries a provisional publication note and leaves future pins null; no private filesystem path was found. I inspected A1–A3, B1, D1, D6, C6 and E1–E3 in depth, and scanned the remaining briefs for dependency, status, release and approval language. No implementation tests or mutation controls apply to this docs-only review. No source, native, device or owner-save work was performed.
