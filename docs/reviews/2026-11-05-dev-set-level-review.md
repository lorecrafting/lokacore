# Review: dev cheat Set level and attribute points (loka-x6t.137 part 2)

- PR: #667 `showcase/hotbar-skill`
- Reviewed commit: `2c593e03a7115ec4c7a37da9b5d37ad1a409c90a` (base main `a762e5d0a`)
- Governing: [cartridge.md dev set level](../system/cartridge.md) (line 985: experience = threshold of the level,
  0 at level 1; counts written; no line, no `level_reached`; refusals `not_found` / `invalid_state`),
  [mechanics.md dev row](../system/mechanics.md), [WORKFLOW review stance](../WORKFLOW.md#review-stance),
  [AGENTS writing tests](../../AGENTS.md)
- Independence: Fable, authored none of the slice; detached worktrees `loka-x6t.137-rev` (mutate_diff) and
  `loka-x6t.137-rev-mut` (hand mutants), both removed
- CI at head (`gh run list --commit`): ci success, book-e2e success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. `dev_set_level` is reachable only through `stepDev`: `step` refuses it, a non-dev host answers
   `unsupported_capability`, no cartridge action may name it, the schema/registry change advertises nothing to a
   normal client.
2. One `levelling.set` per accepted cheat: experience = threshold of the level (0 at level 1), counts as given,
   maxima settled like `raise_attribute`.
3. No prose line, no `level_reached`, no XP event; whatever silences the level reaction applies to this command
   only, never to real play, and the saved receipt replays to the same world.
4. The refusal set of cartridge.md:985 holds.
5. Tests pin literal expected values and the new logic dies under mutants.

## Checks that held

- Gate, every arrival path: `mobile/authority/local-story/invocation.ts:175-177` picks `resolveDev`/`stepDev` only
  when `host.dev === true` and the key is in the dev list; otherwise `resolve` finds no action and answers
  `unsupported_capability` (tested, `dev-cheats.test.ts`). `kernel/ts/src/runtime/world.ts:133` `step` refuses any
  `dev_` type with `permission_denied` (tested, `dev.test.ts`). `lib/loka/content/resolve.ex:444` refuses an action
  naming it (`UNKNOWN_COMMAND`); Elixir has no dev rule. Replay (`receipt-history.ts:47`) re-decides a saved `dev_`
  receipt with `stepDev`, the pre-existing cartridge.md behaviour for dev@1 receipts, unchanged here. `ActionInput`
  gaining `level`/`allocated` is inert: normal `resolve` needs an action in the actor's set and none may be dev.
- `quiet` (`levelling/shared.ts:43`, called `proposal.ts:106,190`): filters `levelling.set` only when the root
  command type is `dev_set_level`. The cheat emits no events, no fact assigns and no `time.advance`, so no reaction
  or job runs in its proposal: the only write it can strip is its own. Real play: `levelling.test.ts` goes red when
  `quiet` is made unconditional (hand mutant M3).
- Dispositions accepted: same level resets XP to the threshold (spec wording); `level_reached` after a set-down is
  how `levelsReached` compares expected to value; writer_group 0 vs 1 is a single write under `Math.max`
  (`proposal.ts:83`), same receipt either way.
- PR-body cites rerun at head: `const setLevel` `rule.ts:85-107`, `quiet` `shared.ts:43`, `proposal.ts:106,190`,
  `invocation.ts:177`; all match.
- Tests: expected values are literals (experience 30 / 100, cha 7), fixtures hand-written in
  `protocol/fixtures/invalid.json` (9 Command, 2 ActionInput); no change detectors.
- Focused suites green at head: `kernel/ts` `test/dev.test.ts test/levelling.test.ts`; `mobile/app`
  `author/place.test.ts ../authority/local-story/__tests__/dev-cheats.test.ts`.

## Mutants

`bin/mutate_diff.sh origin/main` at the head (MUTATE_MINUTES=30, exit 3): 33 mutants, 29 run; red-narrow 5
(`rule.ts:90,92,93×3`), TIMEBOX 24, NOT-UNIQUE 1 (`rule.ts:95`), BASELINE-RED 3 (`cheats.tsx:80`, no panel runner).
Same shape as the PR's table (one more `rule.ts:93` row reached). The TIMEBOX rows on the gate, `quiet` and the
row arithmetic are covered by the hand mutants below.

Hand mutants (each a unique replacement in the `-mut` worktree, restored after, `git status` clean), all red:
M1 host gate `invocation.ts:177` dropped → `dev-cheats.test.ts`; M2 `world.ts:133` `startsWith('dev_')` →
`'dev_go'` → `dev.test.ts`; M3 `quiet` unconditional → `levelling.test.ts`; M4 `!spec || level >` check dropped;
M5 bound `(level - 1)` → `level`; M6 falling-count check → `false`; M7 generated schema `level` minimum 1 → 0 →
`validate.test.ts` (the first attempt edited `protocol/command.schema.json` only, which the kernel does not read:
not a gap); M8 `quiet` filters nothing → `dev.test.ts`; M9 `thresholds[level - 2]` → `[level - 1]`; M10 `not_found`
check dropped; M11 `same` check dropped.

## Findings

- Nit `tools/author-panel/src/cheats.tsx` `Number(level)`: `2.5` or `1e400` reach the kernel and come back as a
  schema refusal note rather than a form hint; empty input is already disabled. Author-side only.
- Nit `kernel/ts/src/mechanics/dev/rule.ts:104`: once points are allocated, level 1 is unreachable (`spent > 0`),
  and so is any level whose grant is below the held count; cartridge.md:985 sanctions both ("count below already
  allocated", "more points than level grants"), so a developer resetting a preview starts over instead. Spec-bound,
  no change asked.

No blocker: the command is refused on every path outside a dev host, and `quiet` can only strip the cheat's own write.

APPROVE WITH NOTES
