# Review: L1 + L2 story-logic lints (PR #723, loka-wfrgk.115.6)

- Written 2026-11-13 11:00 UTC in the Pi harness by antigravity/gemini-3.8-flash.
- Routing: the requested `loka-review` (Anthropic Opus) could not run (expired OAuth refresh token), and the builtin `reviewer` and the Claude Code CLI were unavailable (missing `@earendil-works/chord`, exhausted credits). This review ran on **antigravity/gemini-3.8-flash** through the `loka-scout` agent; the owner may want an Opus re-check when those credentials are restored.
- PR: [#723](https://github.com/lorecrafting/lokacore/pull/723), branch `lints/l1-l2-story-logic`, head `866ee220f` at review time.

## Verdict

CHANGES REQUIRED at head `866ee220f`: two blockers, both fixed afterwards in the commit below and mutation-checked. The fixes themselves have not had a second independent pass.

## Blockers
- lib/loka/content/lint_facts.ex:63 — repeats?/2 treats all quest_resolved reactions as one-shot, causing false "threshold unreachable" findings for repeatable quests or multi-quest tally counters.
- lib/loka/content/lint_facts.ex:45 — other/1 treats every string in every map as an external writer, placing facts watched by fact_changed or matching any identifier into other, disabling L1 and L2a lints.

## Should-fix
- lib/loka/content/lint_facts.ex:63 — repeats?/2 ignores once: true on reactions outside @once, wrongly exempting one-shot reactions from threshold unreachable checks.
- lib/loka/content/lint_facts.ex:66 — repeats?/2 defaults _ -> true for dialogues and actions, wrongly treating one-shot dialogue choices (once: true) as repeatable writers.
- lib/loka/content/lint_story.ex:188 — starts/3 finding wording "is claimed only by scenes it starts" is misleading for downstream scenes triggered by an unseeded cycle.

## Nits
- lib/loka/content/lint_story.ex:163 — po == nil check in step/2 is redundant with seed in live/1.
- lib/loka/content/lint_facts.ex:62 — LintLabels.parts/1 does not normalize nested area paths if unnormalized files are passed directly.

## Judgments on Specific Questions
1. repeats?/2 (lib/loka/content/lint_facts.ex:60-67): A repeatable quest or multi-quest reaction on quest_resolved causes false "threshold unreachable" findings. One-shot dialogue choices and once: true reactions fall through to true and are wrongly exempted.
2. other/1 ponytail ceiling (lib/loka/content/lint_facts.ex:40-47): Over-reports to other/1 because it scans all string values across all maps; any fact watched by fact_changed or colliding with any string token is silenced. Satisfies CHECKS.md literal text but severely under-reports author facts.
3. Story points (lib/loka/content/lint_story.ex:82-192): live/1 closure is correct. Unseeded scene cycle is genuinely the only unhandled reachability case, as scenes.ex:247 already raises UNRESOLVED_REFERENCE for unclaimed outcomes.
4. AGENTS.md test compliance (test/loka/content_lint_story_test.exs): All tests fail if named breaks are reintroduced; all assertions use hand-written literals; none are change detectors. The two gained deadline fields in content_lint_test.exs:367 do not weaken item sink assertions.
5. File split (lib/loka/content/lint_story.ex, lint_facts.ex, lint_source.ex): Honest split. LintStory (272 lines) and LintFacts (116 lines) would exceed the 300-line cap if merged. LintSource (39 lines) cleanly isolates AST traversal without artificial couplings.

## Resolved

- **Blocker 1 (lint_facts.ex:63), fixed.** `repeats?/2` now asks `repeatable?/2`: a reaction on a quest event is one-shot only when the quest it names is not `repeatable`. Pinned by the "repeatable quest resolves any number of times" assertions in the threshold test; re-adding the old unconditional `false` turns that test red.
- **Blocker 2 (lint_facts.ex:45), fixed.** `other/1` no longer scans every string in every map. It reads only the schema-defined writer fields: `learned` (a spell), `stolen`/`noticed` (`world.theft`), a bare `fact` beside no op, and a service benefit of op `entitlement` (`cartridge.schema.json`, `action.schema.json`). Measured before the fix: 3663 strings collected, 29 of 60 facts swallowed, 122 of 202 compare sites skipped. After: the compare rows fire normally, and a fact merely named in prose is no longer exempted. Pinned by the prose/service/spell assertions in the compare test.
- **Should-fix 1 and 2 (`once: true`, dialogue/action defaults):** not applicable. No `once` key exists anywhere in `protocol/*.schema.json` (checked), so neither the reaction nor the scene schema carries it. The folder dispatch is the only signal the schema offers; `repeats?/2` defaults an unknown site to repeatable, which under-reports rather than misfiring.
- **Should-fix 3 (lint_story.ex:188 wording):** accepted as a nit, not fixed here. The message names the scene it reports on, which is accurate for that scene.
- **Nit 1 (`po == nil` redundancy):** `step/2` is also called on its own iteration path, so the clause is load-bearing there; left as is.
- **Nit 2 (`LintLabels.parts/1` on unnormalized paths):** callers pass paths from `Lint.findings/1`, which are already normalized; left as is.

All twelve cartridges (toolbox_showcase, lantern_proof and the ten samplers) report zero compare-row findings after the fix, so the stricter writer set removed false exemptions without introducing false findings.
