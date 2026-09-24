# Storage lessons

Hard-won lessons for SQLite and persistence, moved verbatim from AGENTS.md. Persistence lessons from R6 onward go here too. For expo-sqlite on the phone, see [mobile lessons](mobile.md).

**SQLite fault testing**
- `PRAGMA max_page_count` clamped to the current page count, then a write that must grow
  the file, gives a real deterministic `SQLITE_FULL`.
- An "unknown COMMIT" test that discards the result of a COMMIT that succeeded never
  exercises the not-committed branch; inject a genuinely failed COMMIT too.
