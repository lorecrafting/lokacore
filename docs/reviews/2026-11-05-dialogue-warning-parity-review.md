# Review: dialogue warnings match Talk (loka-vduxr.32, loka-69yuw)

- PR: #666 `engine/dialogue-warning-parity`
- Reviewed commit: `31550f4e7bcfb29eaa1db447036ad97f1285ebbf` (base main `ea982a395`)
- Governing: [mechanics.md dialogue@1 Links](../system/mechanics.md) (:502), Homestead hs-14 (`concealed`,
  `kernel/ts/src/mechanics/skills.ts:38`; `offered`, `selection.ts:102`), owner ruling loka-kgd.108.14,
  [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: authored none of the slice; detached worktree `worktrees.noindex/review-666`
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. `opens?` claims "always opens" only where TS `shown(offered(..))` is non-empty in every state: no own
   policy, no keyword, a choice with no policy that `offered` keeps.
2. The ENTRY_GUESSED list is `spokenBy`'s try order (entries, then breadth-first `onward` targets by key), cut at the
   first that always opens; the message says what Talk does.
3. The compiler passes the real hidden predicate (`dialogues.ex:43`), not only the test stub.
4. Shared rows are TS answers: `dialogue_branching.test.ts:597` runs every row.

## Checks that held

- `shown` filters only choice `policy`; `offered` only concealed teaching (`selection.ts:102,140`). No other runtime
  filter, so `opens?` (`dialogue_links.ex:250`) is exact up to hidden-with-always-true prerequisite (over-warns only).
- Dispute `skills.ex:133` upheld: `protocol/cartridge.schema.json` `dependentRequired: {hidden: [prerequisite]}`.
- Dispute `dialogue_links.ex:245` upheld: a policy-less entry that fails pushes no `onward` target (its free choices
  have failing policies or teach, which is not a free step, `fall_through.ts:19`), and TS tries every entry first.
- loka-vduxr.31 "cannot happen" confirmed: `canonical.ex:187` and `canonical.ts:200` sort keys; choice ids match
  `^[a-z][a-z0-9_]{0,63}$`, so no integer-like key reorders `Object.values`. The TS row runner builds choices in
  fixture order (`Object.fromEntries`); every new row's choice keys are already sorted.
- `data.target` as `"a or b"`: only `explain.ex` target substitution reads it; no panel or mobile consumer.
  Story map ([design](../rnd/story-map-design-2026-11-05.md):312) must split on `" or "` when it lands. Not a break.
- Size allow 502 to 547 (test file, 547 lines): the new compile test and the pinned assertion; justified.
- PR-body claims rerun: TS runs the rows (a red control on the new `b_two or q` row: TS 0/1, Elixir 16/17);
  `dialogues.ex` predicate `fn _ -> false end` turns `:411` red.

## Mutants

`bin/mutate_diff.sh origin/main`: 17 mutants, 17 run, red-narrow 17 (PR: 16 + 1 survivor since killed by `:411`).
Hand mutants against `content_dialogue_links_test.exs`, all red: wiring stub in `dialogues.ex:43` (16/17);
`Skills.hidden?` never matches (16/17); `upto_sure` `Enum.take(rest, 1)` to 0 (15/17); split_while without
`!opens?` (16/17).

## Findings

- **Should-fix** `lib/loka/content/dialogue_links.ex:278-282`, `lib/loka/content/explain.ex:64`: when no first-level
  candidate always opens, `spokenBy` goes on breadth-first to their own `onward` targets, which the warning never
  names, while the message says Talk "opens the first of these whose condition holds". Probe row, run in both
  suites: `a_one` (shut) to `b_c` (shut) and `c_d` (shut); `b_c` to plain `e_z`. TS opens `e_z` with every condition
  failing; Elixir warns `b_c or c_d`. The PR body lists this as "Open: separate issue", but no Beads issue exists.
  (Searched `.beads/issues.jsonl` for ENTRY_GUESSED, deeper, upto_sure, breadth.) Disposition (small should-fix, no
  logic change): reword `explain.ex:64` to "...whose condition holds, or, when none holds, what they lead to", and
  file a Beads issue with this row; naming the next level when `rest == []` (a logic change) goes in that issue.
- Nit `test/loka/content_dialogue_links_test.exs:433`: `base` is bound twice; put `z_open` in the first list.

Open items from the developer: `:237` data.target ruled above; `:279` second walk and `skills.ex:140` closure kept
(nits, accepted).
