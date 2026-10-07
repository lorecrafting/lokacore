# Storage lessons

Hard-won lessons for SQLite and persistence. Persistence lessons from R6 onward go here too. For expo-sqlite on the phone, see [mobile lessons](mobile.md).

**SQLite fault testing**
- `PRAGMA max_page_count` clamped to the current page count, then a write that must grow
  the file, gives a real deterministic `SQLITE_FULL`.
- An "unknown COMMIT" test that discards the result of a COMMIT that succeeded never
  exercises the not-committed branch; inject a genuinely failed COMMIT too.
- expo-sqlite on iOS sets no journal mode: the phone's save runs SQLite's default rollback
  journal (`delete`), not WAL. Headless tests run in that mode too, so a test never relies on
  WAL-only behaviour (a reader beside an open write) the phone lacks.
- A receipt used to justify a derived quest or scene row must bind the stored command ID,
  full definition references, scopes and event cause/correlation, not just matching keys.
  Mutate each linked field in a real saved SQLite row and require typed corruption recovery
  without rewriting the file; include intermediate scene values and an uncertain COMMIT.
  Compare a receipt's branch effects to the current rows in both directions: a historical
  lost transition cannot justify a later active quest merely because its fact rows changed.

**Recovery and retry**
- Cold-reopen validation replays the exact stored receipts; it never re-infers order with
  a second heuristic. A validator that read every drop in writer-group number as a sight
  handoff rejected a lawful combat/bleed interleaving as `save_corrupt`, and a D9
  suppression deadline check did the same
  ([ARCH-D10-01](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/evidence/2026-10-06-post-d10-architecture-audit.md)).
- Snapshot caller-owned input deeply at admission. A session shallow-copied the caller's
  intent; the caller later appended a target, so the retry no longer matched the private
  reservation and every later command returned `conflict`
  ([M1-B1 review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-04-m1-b1-driver-review.md)).
- Generic row validators do not check a mechanic's own fields: an active bleed row missing
  every active field passed them (C5-S1), and in D2 all 497 mobile tests stayed green with a history guard
  removed. Each new persisted field or history gets its own forged-row cold-reopen red
  control that expects typed corruption and unchanged file bytes
  ([C5 save review](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/reviews/2026-10-06-c5-bleeding-bandage-save-second-review.md)).
