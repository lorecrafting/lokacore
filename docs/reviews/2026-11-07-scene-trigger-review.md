# Review: modal scene Trigger row (loka-wfrgk.107)

- PR: #696 `editor/scene-trigger`
- Reviewed commit: `02d0406fe002728c99b8ee653a8753f0bcfefc37`
- Governing: brief in `br show loka-wfrgk.107`; compiler `lib/loka/content/scenes.ex` (:140-156, :174-181,
  :241-257, :274-292), `area_rules.ex:25-30`; schema `partial.source.SceneDefinition` `on`;
  [AGENTS.md Writing tests](../../AGENTS.md), [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: authored none of the slice; detached review worktrees
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **CHANGES REQUIRED**

## Must be true (written before the diff)

1. Every offered `on` compiles: one kind key; non-start has `outcome`; action has room, detail, `success`
   and its target room has the detail; story point outcome is one of the point's.
2. No offered `on` equals another scene's (`duplicates`, every `start` one group): one opening only.
3. Keys outside the scene file's area are not offered.
4. A switch writes the whole new `on` (Opening exactly `{start: true}`), no leftover fields.
5. Nothing is deleted; the leftover note only when the starter quest is named by nothing else.
6. Tests: literal expectations, a red control for each claim.

## Checks that held

- 1, 2, 4: compiled every offer `offers()` makes for showcase `letter_ash` (start, story point, 3 quests,
  10 actions) into a copy: all exit 0; controls (taken `letter_fate/deliver`, two kind keys, outcome `Bad Key`)
  exit 1. scene_sampler: `coil_rope` taken by `rope_reverie` is not offered to `bell_rung`.
- 3: `has()`/`choices()` filter by the reachable nodes (`right.tsx:37`); the unit test's `far` point.
- 5: `leftover` only renders a note; no delete path in the diff.
- 6: unit expectations are hand literals; cards test asserts file bytes on the real server.
- Claim reruns: "Trigger.tsx:46 survives" confirmed (hand mutant, cards.test.ts 3/3 green). "The cards hold none
  [logic]" is not backed: the per-point outcome filter (`Trigger.tsx:46`) and the typed-outcome refusal
  (`Trigger.tsx:99-100`) live in the card, untested.
- Open items: `:72` and `Trigger.tsx:39` under-offer (allowed by the bar); `Trigger.tsx:21` (no `on`) cannot compile
  anyway; `:77` area-prefixed strings: author-side. None block.

## Mutants

`bin/mutate_diff.sh origin/main` at the head: 35 mutants, red-narrow 23, SURVIVED 5, TIMEBOX 7 (unrun).

| Row | Result | Disposition |
|---|---|---|
| `scene_trigger.ts:11`, `:13` (`241`, `274`) | SURVIVED | equivalent: line cites in comments |
| `Trigger.tsx:20` drop `if (!t) return null` | SURVIVED | question 6 |
| `Trigger.tsx:46` `=== -> !==` | SURVIVED | finding 1 (blocker) |
| `Trigger.tsx:100` `!== -> ===` | SURVIVED | finding 2 |
| `Trigger.tsx:100`, `:109`, `:110` (7 rows) | TIMEBOX | unrun; same untested `QuestOutcome` as finding 2 |
| other 23 rows in `scene_trigger.ts`, `Scene.tsx`, `Trigger.tsx` | red-narrow | killed by named tests |

## Findings

1. **blocker** `tools/author-panel/src/edit/cards/Trigger.tsx:46`: the outcome list's per-point filter survives
   (`===` -> `!==`, cards.test.ts 3/3 green). Scenario: two story points in the scene's area; the scene starts
   on A; the regression lists B's outcomes; picking one writes `{story_point: A, outcome: <B's>}`, which
   scenes.ex:241-257 refuses. Fix: return per-point outcomes from `scene_trigger.ts` and assert it in
   `scene_trigger.test.ts` with a second point.
2. **should-fix** `Trigger.tsx:100`: `!==` -> `===` survives. Typing another scene's quest outcome is then
   written and refused as DUPLICATE_DEFINITION (scenes.ex:274-292). The "showcase has none" reason does not hold:
   cards.test.ts already rewrites and restores showcase files, so it can give `letter_read` a quest `on`.
3. **should-fix** `kernel/ts/play/scene_trigger.ts:20-25`: `same` does not collapse starts as scenes.ex:278
   does (its :19 comment says it does). `{start: true, outcome: "x"}` compiles (checked); with it on `dawn`,
   `offers(t, 'dusk', []).start` is `[{start: true}]`, and picking it is DUPLICATE_DEFINITION. One line:
   map any `start` on to one signature. Author-side input, so it alone would not block.
4. **nit** `Trigger.tsx:97-109`: the typed quest outcome is not checked against the `Key` pattern; `Bad Key` is
   posted and the server refuses it (nothing written).
5. **nit** `tools/author-panel/test/cards.test.ts:34-35`: "the compile refuses a start with any other key" is
   false for `outcome` (finding 3's check).
6. **question** `Trigger.tsx:20`: `triggers` is `undefined` while `story` is null (`right.tsx:36`), and `on` is
   hidden from the form for a modal scene (`Scene.tsx:153`), so the trigger is not editable until a compile
   loads. Intended?
