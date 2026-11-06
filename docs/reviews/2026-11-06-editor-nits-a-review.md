# Review: Editor nit batch A, map, shell and Book death-page fixes (PR #677)

- PR: [#677](https://github.com/lorecrafting/lokacore/pull/677), branch `fix/editor-nits-a-2026-11-05`
- Reviewed commit: `cd39c8d280b3010c4ea99e671e3cdb758401c964`
- Governing: [book-ui.md Dead page, Turn](../system/book-ui.md) (:786) and Closure (:1021); [editor map and story rulings, E3a](../design/editor-map-and-story-rulings.md) (:13); [CHECKS.md size gate](../CHECKS.md) (:50-59); [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit cd39c8d2...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body (10 findings).

## Must be true (written before the diff)

1. An off-fight death turns the Book to the dead page from any page except that room's World page. On the World page the layout changes in place.
2. A death whose receipt closes an encounter belongs to the Combat page. The Combat page stays the shown page and the fatal hold holds still, with no turn (:786, :1021).
3. The press path (Book.tsx) and the background path (updates.ts) follow the same rule.
4. `/story`: a refusal shows one line and no map, and no answer keeps the last map.
5. The world switch restarts once the answer is sent or its client is gone, never twice, and never while busy.
6. Test-file size allows stay within the CHECKS.md escape hatch (≤ 1.5×500), and a split would be worse.

## Checks that held

- vduxr.76 conforms. The watcher answers a refused `/story` with a 500 from its catch (`live.ts:290`). With the watcher down, vite's proxy answers 502 (`vite/dist/node/chunks/node.js`, `writeHead(502)`). The watcher never sends a 4xx on GET `/story`, so a literal "4xx only" rule could never show the ruling's refusal row. `kept` (`map.ts:109`) is right.
- vduxr.71: `'close'` also fires after `'finish'` on a normal answer. The served test (`world_picker.test.ts`, `left` = `[d]`) still passes.
- Size allows: test files keep the escape hatch, and 550 and 600 are both under 750. panel.test shares one booted panel, so a split would need a second boot. A split would be worse.
- Left items: wfrgk.27/.28/.33/.34 are features, wfrgk.35 needs design calls, vduxr.77 needs the designer, vduxr.70 has no repro, and kgd.218 needs a ruling. The reasons hold.
- The `fresh` skip (self-review item 2) is correct. `Body.tsx:73` draws DeadPage from `screen.dead` whatever the stack holds, and Let go clears the stack.

## Mutants

The full `bin/mutate_diff.sh` was not rerun because load averaged 11.7 and the PM asked for targeted tests only. Hand mutants:

| Mutant | Test | Result |
|---|---|---|
| `map.ts:109` `>= 502` → `> 502` | author_map | red, `not ok 11` (backs the PR claim) |
| `worlds.ts:45` drop `name !== FROZEN` | world_picker | red (backs the PR claim) |
| `editing.ts:74` `'close'` → `'finish'` | world_picker | red |
| `updates.ts:117` drop `(!died \|\| before.stack.length)` | offfight_death | red |

## Findings

1. **Blocker**: `mobile/app/book/updates.ts:106-118`. `died` keys on `after.died`, the edge of any death, including a death that closes a fight. When the opponent's timed round lands a fatal blow, a background state update arrives with the stack at `[{kind:'combat'}]`. `died` is true, `next` is `[]` and `before.stack.length` is 1, so the page turns on the Combat page. A probe (`mounted`, then a fight opened by `combat.hit`, then a publish of `combat.death`) gave turn 0 → 1 at head and 0 → 0 on main. This breaks :1021 and :786. No test covers it. Fix: key on the dead-page predicate `after.dead` (spirit.ts:52), not `after.died`.
2. **Should-fix**: `mobile/app/book/Book.tsx:81,103-105`. A press death on an NPC or item page, where the recovery room is the death room, keeps the stack (`pagesAfter`). `next === before.stack && inline` holds, so the Book only redraws and does not turn. A probe expected `was+1` and got `was`. This breaks must-be-true 1 and 3, because updates.ts clears the stack (`died ? []`) and Book.tsx does not. Fix: mirror updates.ts:107 (dead → `[]`). The same `after.dead` key covers a receipt that opens and closes a fight with one press on the World page.
3. **Nit**: `kernel/ts/play/worlds.ts:45`. POST `/world` `{name:'lantern_proof'}` still opens the frozen fixture. Only a hand-made request reaches it, so it is an author-error guard. Optional.

## Verdict

CHANGES REQUIRED (finding 1).
