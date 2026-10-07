# E1 selected skill/topic effects independent review

Initial **CHANGES REQUIRED** at source `0e07767c3e39ead7e357586c917d180d79b9b7e6`,
evidence `83fe4bdc81b2e294c60245ff37409269154ec734`. The reviewer authored
none of this source or evidence. Review used a separate checkout and the available
Codex agent; no unavailable reviewer model is claimed. No PR was opened for this
bounded task. E1 certification remains pending.

Requirements derived from [the exact-candidate policy](../system/architecture.md#e1-exact-candidate-proof-policy)
and AGENTS.md: credit only the selected authored sequence index, require a
pending-to-resolved continuation for the same actor/source/choice, require an
actual false-to-true membership transition, and bind the complete committed fact
event to the actor, scope, world and command cause/correlation. Neither definition
presence nor unrelated events may earn a skill/topic definition witness. Tests
must independently fail when a required guard is removed.

## Finding

**E1-K1 — blocker — `kernel/ts/test/e1_knowledge_effects.test.ts:70`.** The
`has(after)` and `has(before, before)` controls change continuation status as well
as facts. They are refused by the earlier pending/resolved guard, so they do not
exercise the claimed already-known and no-transition checks. Independently
replacing the helper's complete fact-value predicate with `if (!fact)` leaves
both new tests green (exit 0). A future regression crediting a resolved choice
with unchanged membership therefore escapes this focused check.

Keep the original pending/resolved continuation pair, mutate only the membership
facts in the pre-state or post-state, and require no sequence witness. Demonstrate
that the removed value-guard mutant fails those controls and restore it. No
runtime correction is currently requested: the implementation contains the
required guard.

## Verification and simplicity

- New focused baseline: two tests pass, exit 0.
- Independent removal of the pre/post membership checks: two tests pass, exit 0;
  this is the failing test control described above.
- Independent removal of event world-context validation: both tests fail, exit 1.
  All reviewer mutations were restored byte-for-byte.
- Every author evidence hash verifies. Author old-suite controls each contain
  twelve passing tests, new missing-binding/receipt controls each fail two tests,
  and restored evidence records fourteen passing tests. These retained controls
  establish binding and event checks, but do not resolve E1-K1.
- Code inspection confirms full reference equality, false/true event values,
  actor/scope/world/cause/correlation checks, and unchanged selected-path-only
  emission. No skill/topic definition path is added. Source digest includes the
  helper. Existing acquisition, fact scope and comparison functions are reused.
- Ponytail Review: no unnecessary machinery found. The 49-line helper keeps the
  existing witness file within the repository size limit; no dependency or runtime
  behavior changes. Test inputs need isolation as described above.

The parent integration owns the full local gate and recorder. This review does
not claim full authored coverage, final 10,000-sequence proof or certification.

## Round 1 scoped recheck — APPROVE

Fix source `3ce2d9c1a6237e1e63cc3dc6e8b732e3a1e28ce0`, retained evidence
`5bbd2fb67efc5f307e282298215d65259f712746`. **E1-K1 closed; APPROVE.**
Only the two negative inputs changed: before/after membership facts are replaced
while their original pending/resolved continuations and receipt fields remain
intact. No implementation, route or expected path changed. The fix is minimal.

Independent verification on the fixed source:

- Focused baseline: two tests pass, exit 0.
- Remove only the prior-membership false guard: both tests fail, exit 1.
- Restore it and remove only the resulting-membership true guard: both tests
  fail, exit 1. Source restored byte-for-byte after both controls.
- All seven round-1 evidence hashes verify. Retained author evidence records
  old twelve tests passing under the combined membership mutant, new two tests
  failing, restored fourteen passing, and typecheck/size checks passing.

The review finding's initial line reference was corrected to line 70 at the
original source. No new finding. Full integrated checks, recorder capture and
E1 certification remain the parent's separate work.
