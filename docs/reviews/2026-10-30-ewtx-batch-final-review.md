# Review: engine batch loka-ewtx final (NPC condition, worn, speaker, unhurtable, liquid vessel, kernel_api pin)

- Main at `33427137b8417c342268be44d6a00405fd9545e8`; batch diff `f230a41816d...33427137b` (merges #512 loka-tc2e, #514 loka-548k, #515 loka-ysbt, #516 loka-zvwh, #517 loka-oc5i, #518 loka-xyyd, #519 loka-daha; #513 polish inside the range, out of scope). kernel_api 1.122 -> 1.126.
- Governing: `br show loka-ewtx` (PM renumbering and "strictly above main" rule); [protocol.md](../system/protocol.md) worn (`:375-380`), bands (`:400-409`), `cannot_be_hurt` (`:712-716`); [mechanics.md](../system/mechanics.md) combat@1 (`:792-804`); [save.md](../system/save.md) Opening a story; [cartridge.md](../system/cartridge.md) `requires.kernel_api` (`:22`); the seven single records in this directory (2026-10-30 tc2e, 548k, ysbt, oc5i, xyyd, daha).
- Reviewer: independent; authored none of the work. Batch-final and protocol second opinion (2026-10-28 contract-batch ruling).
- Verdict: **APPROVE WITH NOTES** (no blocker; one should-fix, docs only; three nits). Protocol second opinion: the 1.122-1.126 clauses (liquid vessel, speaker, band, worn, cannot_be_hurt) and the gameview schema agree with the code at the head; no contract objection.

## Must be true (written before reading the diffs)

1. kernel_api `1.126` agrees in `world.ts`, the showcase and its hash fixture; every cartridge `at_least` <= installed; docs name the same history.
2. An NPC with no `hp` of its own: no `band` in `entities` or `combat`; Attack offered unavailable and refused `invalid_target`/`cannot_be_hurt` on every entry to a fight; never engages, never a population member, never a foe by any `encounter.open` producer; still a valid dialogue speaker.
3. `worn` = slotted direct holdings, shown regardless of theft; `contents` only under theft; the admission invariant reads `worn`.
4. The save pin carries the kernel_api and is compared by equality before `load`; older, newer and absent pins refuse with Start over.
5. Spec clauses edited by seven slices do not contradict each other.
6. No test became vacuous or a duplicate; no capability code names content.

Results: 1-4 and 6 hold; 5 has one leftover (finding 1).

## Evidence (head, detached worktree `worktrees.noindex/review-ewtx`)

- `encounter.open` producers: `combat/rule.ts:45` (after `attackRefused`), `disposition.ts:153` via `hostileAt` (`:123` `npc.hp`) and spell `fightBack` (`spell.ts:118` `attackRefused`), `expedition/sequence.ts:134` (`:112` `attackRefused`; hunters are population members, `population.ex:220` requires hp). No other producer. Speaker: `talk` gates on `speaks()` only (`dialogue/rule.ts:68`), hp irrelevant.
- xyyd claim rerun: no cartridge NPC has `attack` without `hp` (script over `cartridges/*/npcs` and `areas`): none.
- `view.ts:246` `bandOf(...)!.band` after #516 made `bandOf` possibly undefined: an NPC with own hp and no hp row throws `precondition_failed` from `living()` first (probe on the theft guard; `death/shared.ts:12`), so the `!` is unreachable. Not a finding.
- `bin/mutate_diff.sh f230a41816d` (MUTATE_MINUTES=20): 125 mutants, 121 run: red-narrow 13, SURVIVED 7, NO-TESTS 2 (`App.tsx:49`, `toolbox_showcase.walk.ts:67`, Book/walk glue), NOT-UNIQUE 2, TIMEBOX 101 (Book UI files, `view.ts:188/246`; unrun). The seven survivors cleared: `disposition.ts:123` `&&`->`||` #2/#3 (xyyd record, hand red against `fear.test.ts`), `ask.ts:68` seq literal (548k record, equivalent), `combat.ts:48` `&&`->`||` red against `combat_band.test.ts`, `resources.ts:53` guard dropped red against `fear`+`theft`+`combat_band`+`view_actor`, `view.ts:174` `===`->`!==` (predates the batch, base `:171`; red against `containment`+`equipment`). The one-hop narrow sets missed those test files; no suite stayed green under a hand mutant.
- Hand mutants (`bin/mutate.sh`, narrow tests only): all red, each alone, worktree clean after: `combat/shared.ts:42` `!npc.hp && false` (fear 1 fail); `disposition.ts:123` drop `npc.hp &&` (fear); `view.ts:246` drop the `e.hp` gate (theft); `invariants_view.ts` worn ignored by the admission invariant (theft test 9); `authority.ts:98` pin check `saved && false` (release_pin).
- CI: `gh run list --commit 33427137b8417c342268be44d6a00405fd9545e8` and `--commit f63141c12...` list no run (the nightly runs on main at `7a436c81`); the #519 head `e66de946f`: ci, book-e2e, graph-diff all success.

## Findings

1. should-fix (docs) `docs/system/protocol.md:409` vs `docs/system/cartridge.md:22`. protocol says the entity band clause is "kernel_api 1.123, so the showcase that the Book's Look page reads pins it" and the showcase sits at `at_least 1.126`, 23 dialogue cartridges at `1.124` (all contract bumps, no new content feature); cartridge.md (#519) says a contract bump "never" changes a cartridge. Scenario: the next kernel_api bump's developer follows protocol.md's precedent and bumps the showcase (or every dialogue cartridge), the churn #519 exists to end; or follows cartridge.md and a reviewer cites protocol.md against it. Fix: drop the "so the showcase ... pins it" clause; one dated line in cartridge.md that floors from before loka-daha stand.
2. nit `docs/reviews/2026-10-30-548k-dialogue-speaker-review.md:59`: claims `cartridge_cross_kernel_test.exs:193`'s `"1.124"` makes "the next bump fail loudly". It is the floor for the cellar and journal samplers (both `at_least 1.124`); 1.125 and 1.126 passed it silently. No code change; the record's note is unbacked.
3. nit `kernel/ts/src/view/combat.ts:44` and `kernel/ts/test/combat_band.test.ts:42`, `fear.test.ts:280`: the combat-foe hp gate guards a state no producer can reach at this head (every `encounter.open` is hp-gated and #519 refuses pre-1.126 saves). Defensive; keep, but the two tests pin a hand-built state, not a reachable one.
4. nit: already filed, not re-filed: `standing.ex:52` requires an engage line for hostile+attack with no hp check while `hostileAt` never engages such an NPC (loka-zmqs item 3); damage spells on an hp-less NPC (loka-zmqs item 1); the `cannot_be_hurt` SENTENCE (polish batch, xyyd record).

## Disposition

Open: finding 1 (fix round or the next kernel_api bump). Nits 2-4 need no change.
