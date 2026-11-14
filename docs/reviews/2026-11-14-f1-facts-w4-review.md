# Review: F1 Facts table + W4 reachable range

Written 2026-11-14 00:20 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017 (role reviewer)

Head `4de4aef4d` on `story/f1-facts-w4`, diffed against `main`. Verdict: **REQUEST CHANGES** — one
wrong branch in W4's repeat rule makes `reach` backwards for quests, and the new test's expected row
label is not what the code renders.

The table itself is sound: `factUsage` counts the two sides from the same `isWrite`/`isRead` pair
the Story report uses, `orphanFacts` now reads its three lists off those rows, and the sort puts
`both` last by a rank that is absent from `TROUBLE`. `node --test` on `author_facts` and
`author_story`: 19 pass.

1. **Edge direction — none.** `count()` splits the inbound edges by `isWrite(e)` for `write` and
   `isRead(e)` for `read`, and `isRead = reads(isWrite(e), kind)` (`reads.ts`: not a write, or a
   topic). So a `fact_compare` gate counts as a read, a `fact.assign`/`fact.adjust`/`fact.stamp` or
   a `SITES` write path counts as a write, a topic's bare `fact` counts as both, and a fact that
   assigns `false` still counts as written — matching the Story report. No edge lands on the wrong
   side.

2. **Sort — none.** `rank` is `TROUBLE.indexOf(status)`, and `both` is absent from
   `TROUBLE = ['read_only','write_only','unused']`, so it takes `TROUBLE.length = 3` and sorts after
   all three; the tie-break is `key.localeCompare(key)`. The planted cartridge lists
   `mood · seen · ghost · gold`, i.e. `read_only`, `write_only`, `unused`, then the rest.

3. **Hand-derived expectations — one exception.** `author_facts.test.ts:110`
   (`'gold · int · 2 · story ·  · 5 · 1 · both · 0..16'`) is not hand-worked: the empty `meaning`
   column renders two spaces around the separator, which the aligned source spells with one, so the
   literal double space can only have come from a real run. Hand-worked expectations are
   `reach === 16` (:89), `'-5..1'` (:91), the two `''` ranges (:96-99), the order string, and the
   `seen` label (:107) with its trailing empty range.

4. **W4 deviation — stated, then broken by one inverted branch.** The PR body states the floor
   deviation plainly ("L2a computes only a ceiling… the declared `minimum` to L2a's ceiling") and
   `range()` does exactly that: `type === 'int' && minimum !== undefined`, else `''`; `ghost` (int,
   no minimum) and `seen` (bool) render empty. The once-only sum is right for scenes and reactions
   and takes only positive amounts, as L2a does. But
   `kernel/ts/play/reach.ts:184` — `if (section === 'quests') return def.repeatable !== true;` —
   is L2a's rule negated: L2a's `repeats?` returns `v["repeatable"] == true`, so a quest's write
   counts toward the ceiling only when the quest *is* repeatable. Measured on this head: a
   non-repeatable quest writing `+10` on default `1` gives `reach = 1`, and a repeatable one gives
   `11`; L2a says 11 and 1. The 11 in 47 of the showcase's facts are untouched (they are shown as
   `both`, and no test plants a quest write), so the test suite does not see it.

5. **Engine-owned filter — none.** The filter is `expectedFacts(c)`'s reserved keys plus
   `engineWrittenRefs(c)`, exactly the two the Story report already excluded. Removal is guarded
   twice, both verified by running them: dropping `expectedFacts` (i.e. the lock's `position`, which
   this fixture plants) fails `author_facts.test.ts` "the fact the compiler reserves for the engine
   is left out of the table"; dropping `engineWrittenRefs(c)` fails the existing
   `content_graph.test.ts` "engine write sites and engine-owned facts are not reported read_only".
   The new test pins only the reserved half, but the engine-write half is not left to chance.

Findings:

1. **Blocker** `kernel/ts/play/reach.ts:184` — the quest branch is inverted (`!== true` should be
   `=== true`), so every fact only a non-repeatable quest raises gets a ceiling that omits the
   write while a repeatable quest's write is added as if it happened once. Fix: negate the line to
   `return def.repeatable === true;` (a write repeats only when the quest is repeatable, L2a's
   sense), and add a test planting one non-repeatable and one repeatable quest writing the same
   fact, with the two literal reaches L2a gives.
2. **Major** `kernel/ts/test/author_facts.test.ts:110` — the `gold` label literal carries a run's
   output, not a hand derivation (see 3), and the aligned source reads as if the column were one
   space wide. Fix: hand-write what `factRows` should render (or make the empty column render
   nothing) so the literal is derived, not copied.

Not re-opened: the panel wiring, `story.ts`'s allowance and `orphanFacts`'s new shape; the sort,
counts and empty-range rules above need no change.

## RECHECK (2026-11-14)

Written 2026-11-14 03:05 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017 (role reviewer)

Reviewed only the fix commit `80713a03b` on `story/f1-facts-w4` and the two findings of the record
above. Verdict: **REQUEST CHANGES** — the quest branch is fixed, the reaction branch is now inverted
the other way, and no test covers it.

### 1. Blocker (quest branch) — fixed

`kernel/ts/play/reach.ts:172` now reads `return def.repeatable === true;`. `repeats()` answers "may
run more than once"; L2a's `repeats?` (`lib/loka/content/lint_facts.ex:78`) answers the same
question with `v["repeatable"] == true`, and `adjust/2` keeps the amount when `repeats?` is false.
Same truth table. Mutant run: inverting the branch to `def.repeatable !== true` fails
`a quest counts its adjust unless it is repeatable, as L2a does` (`11` vs `1`); restoring it passes.

### 2. Blocker (reaction branch) — still wrong, inverted by this fix

`kernel/ts/play/reach.ts:178` now reads `return q !== undefined && (c.quests as Obj)?.[q]?.repeatable === true;`.
That is the opposite of L2a. `reaction_repeats?` (`lint_facts.ex:103`) returns
`quest_repeats?(on, files)`, and `quest_repeats?` (`:110-114`) is true only when the named quest
exists **and** is repeatable. So on a `@once` event (`quest_resolved quest_failed quest_activated
level_reached`, `lint_facts.ex:14`) a reaction counts as once-only when the quest is *absent or not
repeatable* — exactly the pre-fix `q === undefined || repeatable !== true`. The lint's own comment
(`:99-102`) states the behaviour: "Without it, a reaction on a one-shot event runs once". A one-shot
quest fires once, so its reaction's adjust belongs in W4's ceiling; the new code drops it, and a
repeatable quest's is now counted in.

Not visible in any current assertion: no test or fixture puts a reaction on a quest event, so `gold`
stays at 16 and the suite is green. Mutant run: replacing line 178 with `return true;` leaves all
seven tests passing, which is this very regression. The doc comment above `repeats()`
(`reach.ts:165-169`) was rewritten in the same commit and now describes the inverted rule, so it
does not catch it either.

Fix: restore `return q === undefined || (c.quests as Obj)?.[q]?.repeatable !== true;` and add one
test that names the break — two reactions on `quest_resolved`, one of a one-shot quest and one of a
`repeatable` quest, with a default-1 fact: the one-shot one must reach 1 + its amount, the
repeatable one must stay 1.

### 3. Major (`gold` label) — fixed

`kernel/ts/test/author_facts.test.ts:112-122` splits the label on `' · '` and compares nine cells
(`gold`, `int`, `2`, `story`, `''`, `5`, `1`, `both`, `0..16`). Those cells are the planted fixture's
own values (default 2, scope `story`, no `meaning`, five writes, one read, the ceiling `0..16`
asserted independently at `:89`), not a copied run output, and the empty meaning cell is a real gap
in the join rather than a restatement of one string. The test passes (7/7, `npx tsx --test
kernel/ts/test/author_facts.test.ts`).

### 4. Major (the new quest test's numbers) — accepted

`11` is the spec's own arithmetic: L2a's sum is the default (1, `mood`) plus the once-only write (10),
and `1` is the repeatable quest's write left out. Both are literals in the test, and the `11`/`1`
pair is what makes the inverted branch fail, so they are not derived from the implementation.

## RECHECK 2 (2026-11-14)

Written 2026-11-14 00:37 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017 (role reviewer)

Reviewed only the fix commits `6ba05595d` and `5fe0ced52` and the two open items of the previous
sections. Verdict: **APPROVE**.

**I was wrong in the previous pass about the reaction branch** — my proposed line answered "is
once-only" and inverting it inside `repeats()` turned a correct line into a wrong one.

### 1. Reaction branch (was finding 2) — the head's code is right

`kernel/ts/play/reach.ts:178` returns `q !== undefined && (c.quests as Obj)?.[q]?.repeatable ===
true;`. `repeats()` answers "may run more than once", and on a `@once` event
(`quest_resolved quest_failed quest_activated level_reached`, `lint_facts.ex:14`) L2a's
`reaction_repeats?` → `quest_repeats?` (`lint_facts.ex:103-114`) is true only when the named quest
exists and is `repeatable`; no quest named, a missing quest, and a one-shot quest all give `false`
(once-only, so the write counts). The line matches that table on all four cases; my earlier
`q === undefined || repeatable !== true` would have made the no-quest case repeat, i.e. drop a
write the lint counts.

Mutant run, reproduced here: replacing line 178 with exactly my proposed line fails the new test
`a reaction on a quest event counts unless that quest is repeatable` (actual `1`, expected `11`),
and the suite returns 7/7 with the file restored (`npx tsx --test kernel/ts/test/author_facts.test.ts`).

### 2. Lint failure (`as never`) — fixed

`5fe0ced52` drops the test's `as never` casts on real types; `sh bin/check_as_never.sh` now exits 0
(baseline 0). My first record missed it.

### 3. Not re-opened

The quest branch (`=== true`), the `gold` label split and the test's `11`/`1`/`11`/`11` literals
stand as settled in the sections above; the new test file's four assertions are hand-worked and each
names the break it guards.
