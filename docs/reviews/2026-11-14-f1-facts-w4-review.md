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
