# Review: Hierarchy New + and kind-header + (loka-wfrgk.108)

- PR: #698 `editor/hierarchy-new`
- Reviewed commit: `9d49e30d7ba68cee78b9f62c9a3abbb668346f5f`
- Governing: brief in `br show loka-wfrgk.108` (PM ruling: no capability gate);
  [cartridge.md Author preview](../system/cartridge.md); [editor chrome rulings](../design/editor-chrome-rulings.md) :180;
  [AGENTS.md Writing tests](../../AGENTS.md), [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: authored none of the slice; detached review worktree
- Lane: a panel slice, not a contract slice; recorded here because the PM asked for a record
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (two runs)
- Verdict: **CHANGES REQUIRED**

## Must be true (written before the diff)

1. The + beside World lists every kind of `edit/new.json`, grouped, each with one plain line.
2. Each kind header has a + that makes that kind; no + makes a different kind.
3. Every + runs the palette's `command()`; no second create path; no prompt except text and behaviours.
4. With a room selected, npcs and items are made in it, and the label says so.
5. No + writes something the compiler refuses.
6. Tests use hand literals, and each one has a red control.

## Checks that held

- 1: `GROUPS` equals `new.json` (`author_shell.test.ts:192`). `new.json` equals `Starters.kinds() -- ["cartridge"]` (`test/loka/content_starters_test.exs:22`).
- 5: `allowed()` (`kernel/ts/play/allowed.ts:157`) reads only the declared capabilities, and each starter merges its own (`starters.ex:70`, `:80`). A conflicting value refuses before any write. Rerun: `mix test --force test/loka/content_starters_fresh_test.exs` 15/15. Every kind compiles on a fresh cartridge.
- 2: the showcase graph kinds (attribute, barrier, dialogue, fact, item, liquid, npc, population, quest, reaction, replenish, resource, room, scene, service, skill, status, structure, topic) each map to the starter that writes that kind. `action` and `story_point` get no +.
- 3: `App.tsx:94` is the only caller of `newCommand`, and it goes through `command()` → `created`/`mapCommand`. The label and the click both read `layout.selection` (`App.tsx:94`, `:113`, `left.tsx:142`).
- PR cites `left.tsx:142` and `shell.ts:136`/`:146-147` hold.
- Mutation: `bin/mutate_diff.sh origin/main`. The left.tsx rows came back BASELINE-RED here because the whole map.test.ts was red locally; the two new tests alone pass. `shell.ts:136` is red-narrow. The six `shell.ts:147` rows SURVIVED. The handback lists them as SURVIVED at `:146` and clears them with hand mutants. Rerun: its `npcs ===→!==` goes red, but that is because every other kind's label lookup breaks too. Hand mutants, each run against the named test, all red:
  - STARTER `.reverse()`
  - the label without `sel` (this closes the PR's open item "label/selection fix has no test")
  - `'items'`→`'item'`
  - `[0]` split dropped

## Findings

1. should-fix: `left.tsx:89`, `:124`: the icon + buttons have an `aria-label` but no tooltip. The rulings (:180) and the `Row` Play button (`left.tsx:44` `title=`) give every icon button one. Failure: with `smithy` selected, a sighted author hovers the item header's + and nothing says it makes "New item here" in smithy and not a loose item. Fix: `title={label(...)}`.
2. nit (designer): `left.tsx:103`: the New list row shows `items`, but its accessible name is "New item here". The visible text never says "here", and voice control "click items" misses the row.
3. nit (designer): `left.tsx:121`: the + inside `<h3>` makes the heading's name "item New item here". Fix: put the button beside the heading, not inside it.
4. blocker: `shell.ts:147`: placing an NPC in the selected room, which the brief names, has no test. The mutant `kind === 'npcs'`→`'npc'` passes `author_shell.test.ts` and both new `map.test.ts` tests. Failure: with smithy selected, the npc header's + reads "New npcs" and makes an unplaced NPC, and the suite stays green. Fix: one test where the npc + with a room selected gives `map-npc` (or an NPC whose room is smithy), with a red control.

Open, unchanged: the developer's PR-body open items (missing schema descriptions, cache life, the split at an abbreviation).
