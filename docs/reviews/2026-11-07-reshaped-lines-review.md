# Review: a capitalised Book line opens its field (loka-wfrgk.100.2)

- PR: #702 `book/reshaped-lines`
- Reviewed commit: `8ce70bdcceebac815d01748ffce084576a2fdb84`
- Governing: brief in `br show loka-wfrgk.100.2`; [book-ui.md Author mode (dev only)](../system/book-ui.md#author-mode-dev-only);
  [AGENTS.md Writing tests](../../AGENTS.md), [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: authored none of the slice; detached review worktrees
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **CHANGES REQUIRED**

## Must be true (written before the diff)

1. A line drawn as `cap(text(K))` opens K's field, showing and saving K's file words (lowercase), never the
   capitalised form; unchanged words write nothing.
2. A field opens only on the key whose words were drawn; a double-click never opens (and Enter never writes)
   another key's line.
3. A line found exactly keeps its key (exact before lowered); an embedded key (`words.ts:220`) opens only if
   found exactly, else the existing note.
4. Release Book unchanged: no `mobile/app/book/` change, `mobile-book-*` rules clean.
5. Tests pin 1-3 with literal expectations and a red control.

## Checks that held

- 1: test `inbook.test.ts:150` (field "a hooded stranger", `/edit` posts it, `frozen` lowercase). Save posts
  `f.at` from `/line?key=` (`inbook.ts:174`), so the written line is chosen by key, not by drawn words.
- 3 (embedded): `words.ts:222` `noted(shown, t.key, ...)` notes the whole speaker line: exact match, claim holds.
- 4: diff is `mobile/app/author/` only; `ast-grep scan` reports no `mobile-book-*` finding; `panel.tsx` already
  imported `book/words.ts`.
- Claim rerun: "`:243` `!==` -> `===` survives the tool": see Mutants. "lineWords notes the whole line": holds.
- New path (lowered fallback onto a key from chrome `cap()`: slot, position, ancestry, state, untexted action
  labels, sentence-initial name links): scanned every cartridge's `text.json`; no instance in the tree.

## Mutants

`bin/mutate_diff.sh origin/main` at the head: 9 mutants, red-narrow 9 (the handback's 8 + the `:243` survivor, now
killed by the nested-span test at `inbook.test.ts:150`). No row reaches `panel.tsx:217` (no operator).

Hand: `inbook.ts:45` order swapped (lowered tried before exact): `author/inbook.test.ts` 27/27 green.
Hand: `panel.tsx:217` fallback dropped (`seen.get(words)` only): every test file naming `panel` passes except 4
`App` clock tests that fail on this worktree's missing dev deps, unrelated; the fallback is unpinned.

## Findings

1. **blocker** `mobile/app/author/inbook.ts:44-47` (and `panel.tsx:217`): a capitalised Menu title opens
   another key's field on shipped content. `journal_sampler/text.json:29` `quest.oar.title` = "The lost oar",
   `:36` `item.oar.short` = "the lost oar". After the Journal page draws the quest title (`journal.tsx:61`),
   the oar's item page title (`Menu.tsx:123`, `cap(victimWords(...))` = "The lost oar") matches exactly and
   opens `quest.oar.title`; Enter writes the quest title's line. Reproduced with a scratch test on the PR's
   `capitalised()` harness: `/line?key=quest.oar.title`, expected `item.oar.short`. Same result with main's
   `inbook.ts`, so not introduced, but the slice claims Menu titles as covered and the PM's bar is "a wrong
   key's field is a blocker". Fix (smallest): when `t` and its lowered form are both in `seen` under different
   keys, `drawn()` returns nothing (no field, the existing note); pin it with a test seeding both.
2. **blocker** `inbook.ts:45`: exact-before-lowered is unpinned (hand mutant above stays green). The PR body
   accepts "exact wins" as a rule; finding 1's test would pin the ambiguous case.
3. **should-fix** `mobile/app/author/panel.tsx:217`: the click-select / Alt-click fallback has no test (hand mutant
   above). Scenario: a later edit drops it and clicking an NPC title stops selecting its card, unnoticed. Select
   and open only, no write, so not a blocker.
4. **nit** follow-up (Beads), not covered by this slice: `Menu.tsx:128` (`heldBy`, embedded), `Shelf.tsx:28-29`
   (composite shop line), `Shelf.tsx:132` (inside `buysTitle`/`sellsTitle`), `people.tsx:130` (drawn by
   `nameLink`; links get no field), `Npc.tsx:174`, `skills.tsx:266`, `Menu.tsx:89/:123` for a corpse
   (`victimWords` fills `{victim}`, `seen` holds the unfilled form). Covered: `Npc.tsx:165`, `Menu.tsx:89/:123`
   bare names.
