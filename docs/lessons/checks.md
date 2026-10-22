# Check lessons

Hard-won lessons for CI, hooks, skip rules and test reliability. Current gates: [CHECKS](../CHECKS.md).

- A skip classifier fails open in ways nobody plants: git rename detection listed only the
  new `.md` path of a renamed `.ts` file, a generated `.gen.md` counted as prose, and a
  cancelled run looked like a green ancestor. Classify unknown or mixed changes as code, and
  give every skip path a planted red control (rename, generated file, cancelled run)
  ([process speed-up review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-03-process-speedup-review.md)).
- A timeout counted in loop iterations stretches with machine load. Use a monotonic-clock
  deadline and test it with a delayed reply that must succeed and a silent peer that must
  time out ([browser SQLite deadline](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-web-sqlite-sync-deadline/README.md)).
- "Every code is reached" over a sliding window of random seeds flaked in about 2% of local
  runs. Assert reachability on fixed regression seeds; random runs check invariants only
  ([test audit trim review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-02-test-audit-trim-review.md)).
- Line pointers in docs drift silently after a split (three `App.tsx:N` pointers landed on
  comments). `bin/check_docs.exs` now fails a live-doc pointer past the end of its file;
  a moved line inside the file still needs the reviewer
  ([pointer drift review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-02-docs-system-drift-review.md)).
- Under heavy parallel agent load (load average about 50 on the M1) three Elixir content
  tests hit the 60 s ExUnit timeout and passed on retry: check load before treating such a
  timeout as a failure, and limit parallel heavy runs.
- A cancelled run fails the `ci-green` or `book-e2e-green` gate and needs a manual
  `gh run rerun <id>`; runs on one ref share a concurrency group, so a second dispatch cancels the first.
- Enforce a rule with a hook or check only when a script can decide it, a miss is costly and
  misses have been seen; never hook a judgment rule. Prose otherwise ([workflow step 7](../WORKFLOW.md#loop)).
- A new delta operation kind needs handling in the independent precondition checker: production committed an expedition Start that independent replay rejected (`delta_preconditions_hold`) because the checker lacked `expedition.transition`. Replay every new operation through the independent checker before trusting a green authority run ([night-watch blocker](https://github.com/lorecrafting/lokacore/tree/4c1bb174b603e16f425b21a7752c576939bcf1db/docs/evidence/2026-10-06-e1-night-watch)).
- A coverage witness compares resolved IDs, never display titles: a same-titled wrong room credited a ferry route. Plant that wrong-but-same-title case as the red control ([ferry room identity](https://github.com/lorecrafting/lokacore/tree/4c1bb174b603e16f425b21a7752c576939bcf1db/docs/evidence/2026-10-07-e1-ferry-room-identity)).
- Run mutants with `bin/mutate.sh` narrow first (the test files that import the mutated module); a full-suite
  sweep only at release-candidate certification and the E3 gate ([record](../decisions/owner-decision-process-tightening-2026-10-08.md)).
- Tag every playtest triage row with the rail that would have caught it: in pass 1, 18 of 70
  rows were decidable by a loader lint, a kernel test or a sim test, 22 by a scripted Book
  walk, and only 30 needed a reader. Sign promises are the largest family (13 rows); a walk
  tests 11 of them. Build the cheap checks before the next playtest, not after ([pass 1 analysis](../playtests/2026-10-21-pass1/analysis.md)).
- A retire or rename sweep greps every identifier form, not only the name: Ashmere's chapter-coded `book-ui.md` section ids (C1, D11, B4) survived the name sweep of #426 until #429. List the forms (names, ids, headings, fixture and file names) before the sweep and grep each.
