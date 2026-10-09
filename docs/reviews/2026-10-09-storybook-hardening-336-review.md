# Review: Storybook hardening, PageTurn wait, second tab, Live DB close, after_merge (PR #336)

- PR #336, branch `fix/storybook-hardening`, head `58e1fba3`. Beads loka-x6t.2 (loka-v2j, loka-rqv, loka-8rf, #335 nit).
- Governing: [BOOK-UI-COMPONENTS.md](../BOOK-UI-COMPONENTS.md) "Input" (lines 150-154), [web-preview.md#storybook](../web-preview.md#storybook), [WORKFLOW.md](../WORKFLOW.md) step 5 and step 7.
- Verdict: **APPROVE WITH NOTES** (one should-fix, one nit; neither blocks).

## Must be true

1. The PageTurn play waits on a real readiness signal, and a turn with no curl still fails it. The component keeps the skip after `motion.quick` (the spec requires it).
2. The MemoryVFS rewrite reaches only Storybook's Vite. The web game (Metro) keeps `AccessHandlePoolVFS` for saves.
3. Leaving a Live story closes its database. The live.ts checks fail when the close or the rewrite is removed.
4. after_merge never deletes a `review-<N>` whose record is not on main, and every refusal comes before any change.

## Proof

- (1) The play awaits `warm()`, which resolves after `image.decode()` of a real snapshot. It is not a timer. Mutant P1 (`late` timeout 0, `PageTurn.tsx:125`) fails with `expected null not to be null`. Baseline: 1/1 pass. The >160 ms skip is kept, as the spec requires ("never covers ... longer than that"). I agree with keeping it.
- (2) `expo export -p web` at head: the worker bundle has `AccessHandlePoolVFS.create(d,t)`. Red control: the same rewrite applied to `node_modules/expo-sqlite/web/worker.ts` flips the export to `MemoryVFS.create(d,t)`, so the probe sees a leak. The plugin exists only in `.storybook/main.ts` (`viteFinal`, `optimizeDeps`); `vitest.config.mts` loads it only through `storybookTest`. There is no diff to App.tsx, sqlite-web.ts, authority/, metro.config.js or patch-sqlite-web.cjs. Item 8 holds: the only story database is `':memory:'` (`Live.stories.tsx:20`).
- (3) One storybook:live run with the `beforeEach` close and the rewrite both removed: `FAIL ... 2 databases open after the switch, want 1` and `FAIL ... in a second tab render: ... createSyncAccessHandle`. The 9 per-story checks stayed `ok`. The all-green 11/11 run is the developer's; I did not repeat it (one live run allowed).
- (4) `bin/integration_red_controls.sh` at head: exit 0. Mutants:
  - M1 (no `rev-list --merges` guard) fails `merge-in-review`.
  - M2 (`*+*` never matches) fails `unmerged-review`.
  - M3 (`-D` back to `-d`) fails `cherry-picked`.
  - Two PR claims rerun and hold: "merge-in-review fails without the guard" and "cherry-picked fails with `-d`".
  - Squash merges, conflict-resolved picks and rebased PRs all refuse before any change.
- /code-review items: 1 is fixed and has a red control (M1). Items 2, 3, 5, 6 and 7 are accepted, and the reasons hold. Item 8 holds (above). I reject the reason given for item 4; see finding 1.

## Findings

1. **should-fix**, `mobile/app/stories/PageTurn.stories.tsx:47-49`: the play now does the component's warm-up for it, so the spec promise "prepared before the turn, so the first web turn curls too" (BOOK-UI-COMPONENTS.md:152-153) has no test.
   - Mutant P2 deletes the component's warm-up (`book/PageTurn.tsx:116`). The new story passes 2/2. Scenario: someone removes that `useEffect`, the app's first web turn under load changes with no curl, and the smoke stays green.
   - At idle the old story also passed 2/2, so this PR did not open the gap. It now hides the gap under load too, the very condition this slice targets.
   - Item 4's "enough at 2x" is about flakiness, not coverage. The comment at :47-48 credits the spec for preparation that the play itself does.
   - Fix: make the play wait for the component's own warm-up (or a signal it exposes), or record the gap on loka-v2j.
2. **nit**, `bin/after_merge.sh:58`: `-D` deletes whatever `review-<N>` points to at delete time. The check ran before the pull and the `br` calls. If a reviewer runs `git branch -f review-<N>` in that window, an unchecked record is deleted. The commit can be recovered only from dangling objects. Fix: save the sha you checked and use `git update-ref -d refs/heads/review-$pr "$sha"`.

## Open items

- loka-x6t.2's acceptance is "smoke passes under load" (load 25-70). The PR shows a pass at load about 15 / 2x CPU and 5/5 fails at 3x. loka-v2j stays open after merge, as the PR body says.
