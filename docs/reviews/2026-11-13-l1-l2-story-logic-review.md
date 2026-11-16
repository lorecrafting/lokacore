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
- **Should-fix 1 and 2 (`once: true`, dialogue/action defaults): accepted and fixed.** The reviewer was right and the first draft of this section was wrong: it checked `protocol/*.schema.json` for a `once` key, found none, and concluded the finding did not apply. But `once: true` is a real lowered form — `lib/loka/content/reaction_once.ex:42` accepts `once` and `cooldown` on a reaction and rewrites it into a done-fact guard plus a done write (`:71-82`), and `lib/loka/content/dialogue_once.ex:28` does the same for a choice. `cartridges/reactions_sampler/reactions/bone_taken.json` uses it in the repo today. Such a rule fires once however often its event does, so its `fact.adjust` is one-shot. `repeats?/2` now returns false for a reaction carrying `once: true` before it looks at the event. Pinned by the `once: true` assertions in the threshold test; removing the clause turns them red.
- **Dialogue choice `once: true` is still not attributed** — `walk/1` flattens a file, so an adjust step cannot be traced back to the choice holding it. Those adjusts count as repeatable, which under-reports the row; it is marked with a `ponytail:` comment naming the ceiling and the upgrade (walk choices with their keys).
- **Should-fix 3 (lint_story.ex:188 wording):** accepted as a nit, not fixed here. The message names the scene it reports on, which is accurate for that scene.
- **Nit 1 (`po == nil` redundancy):** `step/2` is also called on its own iteration path, so the clause is load-bearing there; left as is.
- **Nit 2 (`LintLabels.parts/1` on unnormalized paths):** callers pass paths from `Lint.findings/1`, which are already normalized; left as is.

All twelve cartridges (toolbox_showcase, lantern_proof and the ten samplers) report zero compare-row findings after the fix, so the stricter writer set removed false exemptions without introducing false findings.

## Found after the review: three more false findings, all fixed

Running the new rows over every cartridge in the repo (not just `toolbox_showcase`, which the baseline test pins) found findings the reviewer had no reason to reach, since they needed the real source:

- **A quest that completes itself was reported as stranded** (`lint_story.ex`, `self_ending?/1`). Only `patrol` and `expedition` were exempt; `current_state` — met while its policy holds — and `post_activation_event` — met when the named item is picked up after the quest starts — are the two most common objectives and need no resolver at all (`protocol/quest.schema.json` `QuestObjective`). `errand_sampler`/`quests/lantern.json` (`current_state` + `has_item lantern`) and `journal_sampler`/`quests/oar.json` (`post_activation_event`) were each falsely reported. Pinned by a test over all four self-completing evidences; narrowing the clause back to `patrol`/`expedition` turns it red.
- **A dialogue's own `quest` field and a scene's `on_end.quest` resolve a quest**, and neither was counted — every choice of a quest-bearing dialogue resolves it with the choice id as the outcome (`kernel/ts/src/mechanics/dialogue/rule.ts:211`), and a scene ending on `quest` resolves it too (`kernel/ts/src/mechanics/scene/sequence.ts:103`). Pinned per path; dropping any one turns its assertion red.
- **A build order with escrow writes its fact** (`step.schema.json`, `build`: "With fact and escrow it becomes an order") and was not counted as a writer, so `build_sampler`/`rooms/lane.json` reported `hut_ordered` as never written. Pinned both ways: with escrow silent, without it the finding returns.

After all fixes every cartridge in `cartridges/` reports zero findings from the new rows, `test/loka/lint_baseline.txt` is unchanged, and the slice's 29 tests pass. Mutation check: each fix was reverted and its test watched fail (the `once: true` clause, the `escrow` clause, `current_state` in `self_ending?/1`, and each of the two quest-resolver paths).

One process note worth keeping: the first version of this record dismissed the reviewer's `once: true` finding after checking only `protocol/*.schema.json`. The key is absent from the schemas because it is lowered before validation — absent from a schema is not evidence that a field does not exist.

## Re-check 2

Written 2026-11-13 16:20 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017

Rechecked `2c8690dc5` only (lint_facts.ex two new `compare/4` clauses, one test). Owner's Anthropic
subscription is paused; no tests or mutants were run.

- Clause order holds: the bool/enum head needs `type in ["bool","enum"]` and the general int head is
  general, so the two new int heads shadow only `t > maximum` cases — which must be findings.
- `fact_compare` on an int is plain equality (policy.schema.json: "equals"), `maximum` is inclusive,
  so `equals` above it can never hold. Genuine.
- A fact with `maximum` but no `default` is fine: the new heads never read `default`; only the
  general clause does (`vt["default"] || 0`).
- The new test fails if both clauses are dropped (`at_least.(4)` would be exempted by the entitlement
  writer and yield `[]`); its `at_least.(3) == []` assert pins the `>` boundary.
- Finding (low, lint_facts.ex:135,145): the new heads guard on `t > max` without `is_integer(t)`, and
  Erlang term order makes `nil`/binaries compare greater than an integer, so a malformed `at_least`
  (or a non-int `equals`) reports "no value above N is allowed" with an empty interpolation instead
  of falling through to the general clause's `!is_integer(t)` guard. Add `is_integer(t) and t > max`.
- Also noted: the new heads now pre-empt the general clause's `t in ctx.values` suppression, so a
  literal write above `maximum` is reported by this row rather than excused. Correct, but it is a
  second behavior change; worth one sentence in the commit or a test.
