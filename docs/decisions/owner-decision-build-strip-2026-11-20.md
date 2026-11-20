# Owner decision: the Build strip is author chrome over the Book (2026-11-20)

Asked in the PM session for builder slice 1.2 (loka-hcnlh.6, PR #766). The owner chose the recommended
answer. Paraphrased.

**Question.** The Build strip fits no template in [interaction patterns](../design/interaction-patterns.md):
every template there is a player page. Accept a new pattern, "author chrome over the Book", with the
Build toggle on that bar, which shows even with Build off, rather than in the Book's chrome row as the
[builder design](../rnd/in-game-builder-mode-2026-11-19.md) section 4.1 drew it? Putting it in the chrome
row would need a second seam in `mobile/app/book/`, which ruling 2 (one seam, in `Text.tsx`) rules out.

**Answer: accepted.** A dev-only bar drawn from `mobile/app/author/`, never from `book/`, sits above the
Book, outside its page and chrome row, in Book tokens and the Book's current palette. It carries the
Build switch and a polite status line, and shows in the author preview whether Build is on or off. It
never ships in a release build.
