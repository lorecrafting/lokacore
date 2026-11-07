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
- 4: diff is `mobile/app/author/` only; `panel.tsx` already imported `book/words.ts`.
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
   key's field is a blocker". Required outcome: the item title never opens `quest.oar.title` (mechanism open:
   tagging per the brief, or the cheap trade "both `t` and lowered `t` seen under different keys -> no field,
   the existing note", which also costs the Journal quest title its field once the oar's short is seen; no
   field beats a wrong write). Test both directions: the item title does not open the quest key; the quest
   title's result when both are seen.
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

## Re-check: fix commits `bdd6e516f`, `9fc766e2d` (head `9fc766e2d`)

Verdict: **APPROVE WITH NOTES**. PM ruling: no field for shared words this session; key tagging is the follow-up.

- 1 closed: `mobile/app/author/prose_rules.ts:14-25`. `bind` poisons words two keys draw (`''`), and `drawnWords` opens
  only when exactly one of exact/lowered is seen and bound. Oar probe: `inbook.test.ts:182` (double-click gives the
  note, and Edit in Book for either key goes to `/open`, with no field) and `prose_rules.test.ts:157` (both bind orders).
- 2 closed: the order no longer decides. Hand mutants on the touched test files, every one red:
  `found.length >= 1` exact-first (2 fail), the same lowered-first (2), `bind` last-wins (1), `bind` first-wins (1).
- 3 closed: `panel.tsx:217` now calls `clicked()`, pinned by `prose_rules.test.ts:157`. Mutants: exact-only lookup (1
  fail), Alt-click words = drawn text (1).
- `bin/mutate_diff.sh origin/main`: 19/19 red-narrow.
- Wrong-key paths: every lookup goes through `drawnWords` (`inbook.ts:43-44` keyOf, lines, climb `:239`, lineOf
  `:270`; `panel.tsx:217`). Every bind goes through `bind` (`panel.tsx:42`, `:141`). Open (the note from the first
  review): a capital string that never went through `text()` (chrome `cap()`), whose lowered form is the words of
  exactly one bound key, still opens that key's field. No instance found in the tree; the key-tagging follow-up covers it.
- Nit 4 (uncovered call sites) stays a follow-up.
- CI `9fc766e2d`: ci, book-e2e and graph-diff all succeeded.
