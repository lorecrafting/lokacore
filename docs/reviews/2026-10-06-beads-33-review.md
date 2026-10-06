# Chapter 1 Beads Rust expansion — independent review

Scope: operational tracker expansion from seven pilot tasks to all 33 slices in
[`docs/MISSING-CHILD-PLAN.md`](../MISSING-CHILD-PLAN.md), with workflow and owner
decision updates. The reviewer authored none of this change and reviewed its
actual branch diff against main.

Initial verdict: **CHANGES REQUIRED**.

- **BR33-1, blocker:** Git-tracked `.beads/issues.jsonl` had 32 tasks while local
  SQLite reported 33. B6 (S4 Wisp) was omitted; five other tasks referenced its
  absent ID. A fresh checkout could not display the complete graph. The generated
  B6 ID used Beads Rust's reserved `-wisp-` marker for ephemeral records.

Fix: B6 received a durable ID; its seven dependency references were updated.
The export checker now compares the tracked tasks with the chapter plan, checks
dependency targets, and rejects reserved IDs. Red controls prove that omission
and reserved-ID variants fail. A separate fresh checkout imported and listed all
33 tasks, including B6; `bv --robot-plan` completed.

Scoped fix recheck verdict: **APPROVE**. The reviewer confirmed 33 records (13
closed, four in progress, 16 open), matching plan edges and brief links, no
dangling references or machine paths, and passing checker, red controls and
diff hygiene. No open findings. The viewer's read-only access may leave a local
WAL-index directory, now ignored by `.beads/.gitignore`.
