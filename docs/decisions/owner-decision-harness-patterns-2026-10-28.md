# Owner decision: harness patterns (storage, roles, tools, briefs), 2026-10-28

Written 2026-10-28 in Claude Code by anthropic/claude-opus-5-5 (PM).

## Decision

The owner shared a thread of agent-harness patterns (2026-10-24) and asked what Loka could adopt. The PM
proposed five changes from evidence in this repo; the owner (2026-10-24, quoted): "yes do all of them and just
directly commit".

1. **HANDOFF holds the present only.** [HANDOFF](../HANDOFF.md) is a short current-state page (open work, next
   steps, owner questions, standing rules the repo does not state yet), rewritten in place at each checkpoint.
   History lives in git, Beads and the review records; no dated session sections pile up (it had reached 502 lines).
2. **Rulings edit briefs in place.** A ruling made after a brief is drafted rewrites that part of the brief and
   deletes the old text; no appended "rulings override the body" sections
   ([WORKFLOW, Brief](../WORKFLOW.md#loop)).
3. **Tools, not repeated commands.** `bin/wait_ci.sh` takes a branch and waits on its fetched origin head (a stale
   sha watched the wrong head on #475); `bin/ci_fail.sh <sha|branch>` prints only a red run's failing lines;
   `bin/after_merge.sh` closes several comma-separated Beads ids (loka-4zvw). Each has a case in
   `bin/integration_red_controls.sh`.
4. **Memory index stays current.** Superseded or paused memories are deleted or folded into the memory that
   replaced them, not kept as pointers.
5. **Roles are for independent judgement, not file ownership.** The fresh reviewer and the designer exist so
   their view is not anchored on the author's. Any agent fixes a stale line in a doc it is touching; the PM
   writes small decided spec text itself and the reviewer checks it; the designer is spawned for design
   decisions, not to type decided text ([WORKFLOW, roles note](../WORKFLOW.md#work-routing)).
   Evidence (paraphrased): on #476 a designer spawn wrote three decided paragraphs and then left HANDOFF
   inconsistent because "that file belongs to the PM".

Kept: Beads and the one-file-per-memory index already follow the "one record per file plus an index" pattern;
large reference specs such as [Book UI](../system/book-ui.md) stay as they are.
