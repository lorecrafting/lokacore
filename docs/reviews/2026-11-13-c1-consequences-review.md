# Review: C1 consequence preview of a choice (PR #722, loka-wfrgk.115.5)

- Written 2026-11-13 07:16 UTC in the Pi harness by openai-codex/gpt-5.6-luna.
- Routing: the requested Opus reviewer was unavailable (expired anthropic OAuth, low credits, quota, and no OpenRouter credits). This review ran on **openai-codex/gpt-5.6-luna** at high thinking; the owner may want an Opus re-review when those credentials are restored.
- PR: [#722](https://github.com/lorecrafting/lokacore/pull/722), branch `story/c1-consequences`
- Reviewed commit: `7cea8bfd1fd08c68c56142c804c8c2b6157026e3`
- Base: `0ec838811a5b7a99e8b6fa4d6195a6ce59a05b75`
- Governing: [story tooling C1](../design/story-tooling.md#c1-consequence-preview-of-a-choice), [story map §4.3](../rnd/story-map-design-2026-11-05.md#43-what-cannot-be-derived-statically-and-how-it-shows), [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: authored none of this slice.
- CI at reviewed head: `ci`, `book-e2e`, and `graph-diff` all success.

**Verdict: CHANGES REQUIRED** (three blockers, one should-fix).

## Must be true

1. Hop 1 includes every declared effect; hop 2 follows fact, quest, story-point, and choice readers exactly once.
2. Every policy leaf remains visible; only a statically known fact comparison is settled, and all other leaves say `depends on play`.
3. Write-only facts appear once; the panel works for choices and bare nodes without evaluating live state.

## Findings

- **Blocker B1** `kernel/ts/play/consequences.ts:117-126`: hop 2 iterates only fact/quest writes. A scene `on_end.story_point` is shown in hop 1 but its `on.story_point` scenes are never returned. Fix story-point outcome fan-out (and add a planted test).
- **Blocker B2** `kernel/ts/play/reach.ts:59-67`, `consequences.ts:140`: only `fact_compare` edges carry `leaf`, while `gatesOf` drops every other leaf. `npc_present`, `fact_at_least`, etc. disappear instead of dashed `depends` rows. Preserve all leaves.
- **Blocker B3** `kernel/ts/play/consequences.ts:105,150-152`: `fact.adjust`/`fact.stamp` are marked writes with no known final value, but the map presence settles them as false. They must remain `depends`.
- **Should-fix S1** `consequences.ts:93-95,107`: dedupe includes `via`; a reader of two hop-1 effects renders twice, and repeated writes duplicate `never read`. Aggregate by reader and use a set for facts.

## Claims and checks

(a) Partly rejected by B1/S1. (b) rejected by B2/B3. (c) accepted: fields and pins are tightened, not relaxed. (d) accepted: choice walks, palette/keyboard wiring, and bare no-choice nodes degrade without a crash; the 20-row cap reports `more`. `label()` handles bare dialogue refs. Focused tests: 47 pass; kernel/panel typechecks, Prettier, size gate, and CI pass. `bin/mutate_diff.sh` found 89 mutants, 68 run, with 15 survivors.
