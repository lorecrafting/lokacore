# Missing Child complete-chapter plan — PR #192

Reviewed `bc92912f08831d61ecb91aeff2359eca58a93b12` against the active chapter decisions, `docs/spec/release-scope.md`, `docs/system/owner-rules.md`, `docs/ROADMAP.md`, and the private Astra complete-slice map. This is a docs-only review; no mutation test applies. Exact-head CI was green at review time.

## Requirements checked before the diff

The plan must preserve 57 genuinely reachable rooms (25 Ashmere, 22 Fen, ten public Priory), ten playable quests, three child outcomes and the five valid child/bell pairs. Active chapter routes require no idle wait or unrecoverable corpse/possessions. Every required release capability needs a real consumer or a reviewed applicability amendment. Browser evidence must stay distinct from native SQLite, Hermes, touch and device proof; the active owner validation rule needs one source of truth.

## Verdict: CHANGES REQUIRED

- **R192-1, should-fix — `docs/MISSING-CHILD-PLAN.md:93`.** The plan defers native build/device evidence but links `docs/system/owner-rules.md`, which at this reviewed head still states simulator-first validation. PR #191 carries the newer browser-first owner decision and owner-rule update, and is planned to merge before this PR. Until that dependency merges and this plan cites its exact decision, a developer following the current active rule gets conflicting validation instructions. Merge #191 first, then point this paragraph to the new decision and retain the prelaunch native carry.
- **R192-2, should-fix — `docs/MISSING-CHILD-PLAN.md:68`.** D6 depends on C1 and D1 but the water rule never states how the player obtains any swim qualification before reaching its two bottom rooms. C6 depends on D6 if its S27 swim reward is retained. If a later brief treats S27 as the first swim lesson, D6 and C6 block one another and the 57-room claim becomes unreachable. State that D6 provides an immediate earlier training route, or select a non-swim authored access rule; keep S27's later reward idempotent if retained.

## Checked without findings

The row count is 3 + 9 + 6 + 12 implementation/content candidates and three proof candidates. The disjoint additions sum to 41; 16 + 41 = 57. Q1/Q2/S1 plus Q3/S2/S9/S4/S10/S3/S27 = ten. The five pairs exclude lost/fox. The B/C/D rows provide named consumers for the remaining chapter-one release-scope families, subject to their later briefs. No row reintroduces Old Bram or makes a mandatory tide/night wait; D1 and D6 name recovery obligations. E3 distinguishes browser content proof from native/public release certification. These 33 rows are a plan, not 33 separately authored implementation briefs.
