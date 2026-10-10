# Docs review: showcase decision, Chapters 2-3 out of release scope (loka-exbe, PR #362)

- PR #362, branch `docs/retire-ch2-3`, head `ca2aca594f997df6a8a4857debee15e89699e5b2`, base `16245fa4` (14 files, docs only). Kept as a record at the PM's request (release-scope lock changes, [release-scope.md](../spec/release-scope.md)).
- Governing: [WORKFLOW](../WORKFLOW.md) decision records; [owner-rules](../system/owner-rules.md); [MECHANICS-TOOLBOX](../MECHANICS-TOOLBOX.md); Beads `loka-exbe` comments.
- Hosted CI on the head (checked at review time): graph-diff success; ci (run 38080486631) and book-e2e (run 38080486594) in progress. The PM confirms both before merge.
- Verdict: **APPROVE WITH NOTES** (one should-fix, two nits, one question).

## Must be true

1. The record marks owner words as paraphrased and PM rulings as PM rulings, and matches the `loka-exbe` comments (four-step district process, quests and scenes before Chapter 1 retires, polish clarification, `loka-kgd.69`/`.70` filed).
2. `release-scope.json` has no `chapter_two`/`chapter_three` key or reference; every consumer passes.
3. Moved files' links resolve; nothing live treats Chapters 2-3 as planned releases.
4. SHOWCASE.md agrees with the record and seeds quest and scene matrix rows.

## Proof

- (1) Record lines 7-10 and 29 mark both owner inputs "paraphrased"; rulings 1-3 are under "PM rulings and clarifications"; content matches all five Beads comments. `loka-kgd.69` and `loka-kgd.70` exist (open).
- (2) `git grep` for the six removed ids and both chapter keys outside `docs/archive`: no hits. Only consumer `bin/features.exs` reads `capabilities` only. `features.exs --check`, `contracts.exs --check` (includes toolbox.gen.json), `system_pages.exs --check`, `mix run bin/system_graph.exs --check`: exit 0. The four non-ghost/barter rows map to toolbox rows 38, 44, 37, 20a, W11, as release-scope.md:19 claims. QUEST still gates five rows; ESCROW now gates none and stays defined for row 20a, as the PR body states. [MISSING-CHILD-PLAN.md](../MISSING-CHILD-PLAN.md):108 requires a reviewed amendment for lock changes: this review.
- (3) `check_docs.exs`: 450 docs, 0 broken. Rerun of the PR's planted-link control in `docs/archive/README.md`: 1 broken link reported. Live-docs grep (chapter two/three/2/3, ch2/ch3, C2-/C3-M, LATER-ENDINGS, chapter_two/three, Barrow King, King's Road): dated decision records (history), toolbox row provenance ids, a superseded ROADMAP row, and two live clauses (finding 3). Out of scope by this decision (Chapter 1 frozen): the hash-pinned "comes in a later chapter" ancestry strings in `cartridges/ashmere_missing_child/text.json`, the Chapter 1 mock `docs/design/ui-exploration/chapter-one-playable.html:933`, and the release-scope `quest.escort` reason "not deferred to chapter two".
- (4) Matrix rows `quests x deadlines x hints` and `scenes x dialogue x reactions` present; social-district loop declared.

## Findings

1. **should-fix** `docs/SHOWCASE.md:3-4`: "its hub and first district land at the next batch's final review" contradicts SHOWCASE.md:39-40 and PM ruling 1 (record:28-33: the final review stays a review only; a separate Fable run plans the brief after approval). A PM reading the intro schedules district authoring inside the final-review run. Fix: "lands after the next batch's approval".
2. **nit** `docs/SHOWCASE.md:66`, `docs/decisions/owner-decision-showcase-2026-10-10.md:38`: "need a toolbox row (PM files them)" now filed; cite `loka-kgd.69` and `loka-kgd.70`.
3. **nit** `docs/system/mechanics.md:54` ("Per-exit and terrain costs are later (00 §11 chapter three)") and `docs/system/DIFFERENCES.md:14` ("chapter two, 00 §11") still place deferred mechanics in Chapters 2-3; a reader takes them as planned release content. Point them at toolbox row 43 and the matching sight/perception row, or drop the chapter words.

## Question

- Record line 29 cites an owner input ("Fable should write the plan"); no `loka-exbe` comment carries it, only the PM ruling comments. Add the owner input to Beads so the paraphrase is traceable.
