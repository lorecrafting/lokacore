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
