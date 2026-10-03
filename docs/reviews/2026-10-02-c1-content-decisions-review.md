# Review: owner decisions, chapter-one content (PR #128)

- PR: #128, branch `c1-content-decisions`, commit reviewed `7a49168`
- Scope: docs only (one decision record, one index line); no mutation testing
- Verdict: **APPROVE WITH NOTES**

## What must be true (written before reading the diff)

1. Each of the five decisions matches the owner's answers ("Owner decisions 2026-10-02", `~/dev/loka-astra/r78/world-outline-summary.md`) in meaning: nothing added, nothing softened; the record says paraphrased.
2. Each cited archive clause is the clause the decision settles, and no clause the decision overrides is left uncited where a later author would follow it.
3. "Takes effect" agrees with the chapter-one plan (PR #127): content beyond the sampler is a later stage.
4. No `docs/archive` edit; one fact in one place; `check_docs` green.

## Checks

- Meaning: decisions 1, 2, 3 and 5 match the source exactly. Decision 4 adds "(ward)"; the owner said "a topic". It is the topic 00a:445 already gives S4, so not invented (N-1).
- Decision 5 arithmetic: Ash cloister 12-20, Hale cloister 18-6 (00a:232) -> overlap 18-20; 19:00 is inside. Ash's remaining hours (6-12 and 20-6 scriptorium) cover the day. Correct.
- Citations opened: 00 :30, :59, :612, :656; 00a :222, :231-238, :286, :379-382, :445, :481, :491-494, :510. All land on the stated clause, except F-1 and F-2.
- Plan (#127): c1-sampler uses "prose from the owner's UI prototype" (decision 1). Quests, topics, the rest of scene@1 and the time model are later stages after Gate C1 (plan Q1, item 20). The record does not contradict this.
- `git diff origin/main...` touches no `docs/archive` file. `elixir bin/check_docs.exs`: exit 0, 262 docs, 0 broken.

## Findings

- **F-1 should-fix**, `docs/decisions/owner-decision-chapter-one-content-2026-10-02.md:9`. Decision 3 (three endings) does not cite the clauses that still say two: 00a:508 "both endings reachable by deterministic bot ... under 400 commands each", 00a:485 and 00:714 "either intended ending". Failure: the author of the certification bot follows 00a §11, tests two endings, and the `stays` ending ships uncertified. Fix: add these clauses to the "Settles" cell.
- **F-2 should-fix**, same file `:10`. "00 §4.2 spell-word row (~line 338)": line 338 is in §4.3 Character and progression (00:329). §4.2 (00:314) is Time and environment. Failure: a reader who looks in §4.2 does not find the row. Fix: change §4.2 to §4.3.
- **N-1 nit**, `:10` and `:19`. "(ward)" and "the ward topic" are not in the owner's words. Add "(the topic 00a §7 S4 already gives)" so the reader can see where it comes from.
- **N-2 nit**, `:8-11`. "The chapter-one content slices" is not a name in the plan. The plan puts this content in later stages after Gate C1. Say "a later stage after Gate C1" to match plan Q1.

## Question

- Q-1, 00:55: the fey-touched ancestry gets "one spell word", and chapter one has all four ancestries (00:639). After decision 4, does a fey-touched character in chapter one still get a word? This is not an owner decision yet. The PM can ask the owner, or say in the record that it stays open.

## Fix round 1 re-check (21a0390)

Commits `b3580db`, `21a0390`, one file. Verdict: **APPROVE**.

- F-1 fixed, decision record line 9: it now cites 00a:508, 00a:485 and 00:714, and it requires certification of all three endings (rescued, stays, lost).
- F-2 fixed, line 10: the citation is now §4.3 (00:329 heading, row at 00:338).
- N-1 fixed, line 10: the ward topic is attributed to 00a:445, and the record says the owner said only "a topic".
- N-2 fixed, lines 8-10: "the later chapter-one stages after Gate C1 (plan #127)" matches plan Q1.
- Q-1 answered by the owner (relayed by the PM, paraphrased), line 10: fey-touched keeps +SPI and Priory -2, and its spell word waits for chapter two. The cited clauses are correct: 00:55 is the ancestry, 00:639 lists four ancestries in chapter one.
- `check_docs` is green (pre-push).
