# Review: docs compaction PR 2 (archive, ROADMAP shrink, AGENTS.md source of truth)

- PR: #119, branch `docs-compaction-2`
- Commit reviewed: `d38231c`
- Brief: docs compaction, "PR 2, move", and the OWNER DECISIONS 2026-10-02 at its end
- Stance: short (docs-only, plus one test path and comment paths); the only mutation was the red control the PM named
- PM rulings not reopened: the stale `docs/spec/` paths in `protocol/*.json` descriptions and `*.gen.*` wait for M1's regen; the 37.4 KB PM start set is accepted

**Verdict: APPROVE WITH NOTES**

## What must be true (written before reading the diff)

1. AGENTS.md "Specification (source of truth)" says: `docs/system/` plus `protocol/` plus the
   conformance fixtures are the truth; a change amends `docs/system` first, then the code;
   `docs/archive/` is history, read only when a task needs it.
2. Nothing live moved: the six 2026-10-02 decision records, `docs/spec/conformance/`,
   `release-scope.*`, `IMPORT.md` and `protocol/` stay where they are. Every check that reads a
   docs path still reads a real file.
3. In ROADMAP, each done stage is one line. The open rows (Quest from dialogue, R7/R8 for
   chapter one, Playtest) keep every carry. The old R6, SM2, Early R7/R8 and R6P rows and their
   slice tables are in the archive, verbatim.
4. A relinked link points at the same document as before, at its new place. No bracketed
   non-link (in a code fence or inline code) is rewritten.
5. No live doc tells an agent to read or amend `docs/spec/<moved file>`.

## Checks

1. AGENTS.md:15-22 matches the owner decision (decision record
   `docs/decisions/owner-decision-docs-compaction-2026-10-02.md:28-46`): system + protocol +
   fixtures, `docs/system` first, then code, archive is history. "(or an archived plan)" comes
   from the brief's proposal for new work. Pass.
2. `docs/decisions/` holds exactly the six 2026-10-02 records and the index. `docs/spec/` holds
   `conformance/`, `IMPORT.md`, `README.md` and `release-scope.{json,md}`. The only `protocol/`
   change is one link in `protocol/README.md`. Code that reads docs paths (`bin/features.exs`,
   `bin/contracts.exs`, `lib/loka/core/compose.ex`, the portable ABI, compose and Lantern tests)
   reads only files that stayed. `bin/check_all.sh` at `d38231c` in a fresh worktree: exit 0
   after `npm ci` in the three npm projects. `check_docs`: 251 docs, 0 broken, 0 unreachable.
   Pass.
3. Red control: the heading `## 23. Inventory/location invariant` in
   `docs/archive/spec/03-domain-state-persistence.md` was changed to `Inventory-location` in a
   throwaway worktree. `mix test test/loka/core/registries_test.exs` then fails with
   `no_heading: "one_container_per_item"`, exit 2. The worktree was removed. Pass.
4. ROADMAP: the three open rows are identical to `origin/main` byte for byte once link targets
   are removed. Every old table line 49-111 is in `docs/archive/ROADMAP.md` or the new ROADMAP
   (link targets removed), except the R3-R5 pointer row and the old Docs compaction plan row.
   Both are now replaced by their Done rows. The Verification harness section is archived and
   linked. Pass.
5. Links: rather than a sample, every old/new pair of moved or edited Markdown files was diffed
   after reducing each link target to `basename#anchor`. Apart from the intended prose edits
   (AGENTS, README, WORKFLOW, CHECKS, the agent files, `docs/system/README.md`,
   `owner-rules.md`, `IMPORT.md`, the decision record and two plain-text source paths), no line
   changed. So every relink keeps its document and anchor. Code fences and inline code: no
   change outside the moved `docs/spec/README.md` body. `check_docs` does not check anchors, so
   all 111 anchored links in the live docs and the archived ROADMAP were checked against
   GitHub-style heading slugs: 0 bad. Pass.
6. WORKFLOW and the agent files now cite `docs/system` sections, and decision links point into
   `archive/decisions/`. A grep of the live docs for the moved spec files finds only
   `docs/contracts.gen.md` and `kernel/ts/src/contracts.gen.ts` (PM ruling 1). Pass.

## Findings

- **N-1 (nit)** `lib/loka/core/invariants.ex:4`, `test/loka/core/registries_test.exs:184`:
  "docs/ROADMAP.md, verification harness" names a section that moved to
  `docs/archive/ROADMAP.md#verification-harness-adopted-2026-09-24`. Failure: an agent opens
  ROADMAP and finds only a one-line pointer (ROADMAP:10), so it takes one more hop. Fix when a
  later slice next touches these files.
- **N-2 (nit)** `docs/ROADMAP.md:27`: the slice count says "1 docs compaction", but the row at
  :21 says 2 (#117, #119). The total "48" is therefore one short.
- **N-3 (nit)** AGENTS.md:15-22 drops the old line that `docs/reference/` is "informative,
  never authority". `docs/reference/README.md` is still reachable from `docs/spec/IMPORT.md`.
  The new list names its sources in full, so the risk is low.
- **Q-1 (question, for the M1 brief)** `docs/ROADMAP.md:23` ("spec amendment") and :24 ("a
  reviewed amendment of 04 §5.3"): under the new rule, these mean a `docs/system` amendment.
  The rows stayed verbatim as the brief requires. The M1 brief should name the `docs/system`
  section that changes.
