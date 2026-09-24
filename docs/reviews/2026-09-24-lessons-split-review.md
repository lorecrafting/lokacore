# Review: lessons split (PR #8)

- PR: #8, branch `lessons-split`, commit reviewed `9bbd478`
- Scope: docs-only; short review, no mutation testing (Review stance)
- Verdict: **APPROVE WITH NOTES**

## What must be true

1. Every moved lesson appears word for word in exactly one area file; nothing lost or altered.
2. "Performance" and "Canonical encoding (R3)" stay in AGENTS.md.
3. AGENTS.md has one pointer per area file, worded by trigger so an agent in that area opens it,
   plus the rule that new lessons go to their area file.
4. No remaining text refers to a moved section by a name that no longer resolves.
5. Nothing that applies to all work was moved out of AGENTS.md.
6. WORKFLOW step 2 has the PM name the lessons file in the brief.

## Checks

- Verbatim: the removed AGENTS.md lines, sorted, match the bodies of the three new files
  line for line. The one difference is the intended update of the Writing-tests
  cross-reference (`see SQLite fault testing` now links to the storage lessons file).
- Performance and Canonical encoding (R3) remain in AGENTS.md. WORKFLOW step 2 now names the
  `docs/lessons/` file.
- Pointers are trigger-worded ("Before touching `mobile/` or running on a phone", "Before touching
  SQLite or persistence", "Before capturing or committing evidence"); the links resolve.
- Stale names: the only other hit is `docs/reviews/2026-09-24-workflow-review.md:67`, a historical
  record, left as is.

## Findings

1. **should-fix** `docs/lessons/evidence.md:6` (moved from AGENTS.md). The rule never to print or
   commit device identifiers, team/certificate IDs, home/scratch/worktree paths or container UUIDs
   applies to every commit, review record, PR body and log, not only evidence capture. It was the
   only statement of this rule in AGENTS.md. Its pointer is gated on "capturing or committing
   evidence", so a developer writing a PR body or a reviewer writing this kind of record never
   opens the file and pastes `/Users/<name>/dev/...` into a commit. Keep that bullet (or a
   one-line version of it) in AGENTS.md; the `redact()` sentence can stay in evidence.md.
2. **should-fix** `docs/WORKFLOW.md:55`. Step 7 still says "Update AGENTS.md lessons if the slice
   taught one", which contradicts the new rule at `AGENTS.md:41`. A PM following step 7 adds the
   next mobile lesson back to AGENTS.md. Reword to "Add the lesson to its `docs/lessons/` file
   (AGENTS.md only if it applies to all work)."
3. **nit** `docs/lessons/evidence.md:12-13`. "Nothing invented; unknowns stay null" and "Declare
   any performance variant before tuning it, and keep failing results" read as general rules of
   honest reporting and measurement. The second one fits beside Performance in AGENTS.md. Owner's
   call; not a blocker.
4. **nit** `docs/lessons/storage.md:3`. The two expo-sqlite items in `mobile.md` (double-open NPE,
   helpers that COMMIT themselves) matter for persistence work too. An agent on host storage
   outside `mobile/` would read storage.md only. A one-line "see also mobile.md, expo-sqlite"
   covers it.
5. **nit** `docs/lessons/mobile.md:29`. The zsh word-splitting lesson applies to any shell work,
   not just mobile builds.

## Re-review of fix commit `9ab9094`

Scope: that commit only. Verdict: **APPROVE**.

- Finding 1 (privacy rule): resolved. The bullet is back in AGENTS.md under **All work**,
  unchanged, including the `redact()` sentence, and removed from `evidence.md`.
- Finding 2 (WORKFLOW step 7): resolved. Step 7 now records a lesson in its `docs/lessons/` file,
  and in AGENTS.md only if it applies to all work, which matches the rule in AGENTS.md.
- Nit 3: resolved. "Nothing invented; unknowns stay null." moved to **All work**. The rest of that
  evidence bullet keeps its original wording. The performance-variant bullet is now under
  **Performance**, unchanged.
- Nit 4: resolved. `storage.md` now links to the mobile lessons for expo-sqlite, and the link
  resolves.
- Nit 5: resolved. The zsh bullet is now under **All work**, unchanged.
- Verbatim: every relocated sentence matches the text removed from its old file character for
  character. Nothing was dropped.
- `elixir bin/check_docs.exs`: 62 docs, 0 broken links, 0 unreachable, exit 0 (word budget
  included).
