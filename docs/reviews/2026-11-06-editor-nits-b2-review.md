# Review: editor nit batch B2, story list, Flow and picker nits

- PR: #679 `fix/editor-nits-b2-2026-11-06` (loka-wfrgk.18.4, .18.5, .18.8, .43 item 3)
- Reviewed commit: `933b8586cb8247421355daed94da17a920d4c20d`
- Governing: [story map rulings S2/S3](../design/editor-map-and-story-rulings.md) (row ids, palette `beat <n>`,
  Keyboard, "Changed in the last burst"), [cartridge.md Author preview](../system/cartridge.md) (pickers offer keys
  from the last good compile), [WORKFLOW review stance](../WORKFLOW.md#review-stance); author-error guards are nits
- Independence: authored none of the slice; detached review worktree
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (9 findings; 1-5 and 7 fixed, 8 disputed, 6 and 9 filed)
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. A refused duplicate `n` never hides a valid outline: only a repeat across the whole outline is refused, because
   row ids (`beat:<n>`), the palette target and Bind key a beat by `n` alone.
2. The scroll save records the position at the event and writes once, after 200 ms of quiet.
3. Trace and Bind ghosts take Tab only on the tab row, and their action leaves focus on that row.
4. No kernel typecheck (`tsc`, `-p test`, `-p play`) pulls a `.tsx`, `author.ts` or React.
5. A failed compile labels the pickers that offer compiled keys as stale; loading does not.

## Checks that held

- `beat:${b.n}` is the id at storylist.ts:131/207/262 and flow.ts:130, so a cross-part duplicate collides; the
  refusal at story.ts:216-220 is justified, and a refused file falls back to the existing refusal row.
- story.ts:217/218 mutants are red on a valid-outline test (`a seed with no later payoff...`), so the refusal cannot
  silently fire on every outline.
- `tsc --listFiles` for `-p test` and `-p play`: no `.tsx`, no `author.ts`, no React; the author-panel files are
  `.ts` only. `@rjsf/*` comes from card tests already on main.
- `compiled` defaults to true (author.ts:93), so `stale` is off while loading.
- Finding 8 (`inColumn` cost): the dispute holds. Both old and new cost O(columns x drawn) plus a per-column sort.
- Merge with origin/main (#678): `git merge-tree` is clean, and the hunks in Generic.tsx and World.tsx do not overlap.
  GitHub reports `mergeable: UNKNOWN`.
- PR claims rerun:
  - the widened raw-colours rule misses the planted template case on main's rule (0 passed, 1 failed), and has no
    false positives over `tools/author-panel/src`;
  - `mutate_diff` story.ts:214/217/218, flow.ts:266/270 and flowread.ts:100 are red-narrow, as claimed (the line
    numbers moved one with 933b8586c).

## Mutants

- `bin/mutate_diff.sh origin/main`: 17 mutants (16 run): red-narrow 9, SURVIVED 7, NOT-UNIQUE 1.
- The survivors are all in tsx with no node harness: flow.tsx:37, flowcard.tsx:142, storylist.tsx:48/110/152/154 (x2).
  The PR marks them BASELINE-RED and covers them with walk hand mutants. Here they ran green, not baseline-red.
  This is the same gap; the harness is filed under loka-wfrgk.18.4.
- Hand mutants:
  - inColumn `a.y - b.y` -> `b.y - a.y`: red (author_flow 16, 22);
  - readOutline over `parts.slice(0, 1)`: red (story 21);
  - burst `===` -> `<=`: red (author_flow 17). `===` -> `>=` is equivalent, because the feed is newest-first.

## Findings

1. nit, Scene.tsx Value (~:73-98), Entity.tsx placement (~:134-150), Dialogue.tsx links (:116/:152). These pickers
   also offer last-good-compile keys (cartridge.md Author preview) but use no `FieldName`. Failure: after a failed
   compile, a scene `npc:` picker offers a key that was deleted, with no ` stale`. The .43 item 3 sweep is
   incomplete; follow-up.
2. nit, flow.ts:258. A refused outline (now including a duplicate `n`) shows "No outline.json; columns are
   dependency layers." while the file exists. The Story list shows the reason; Flow misleads. This predates the PR.
3. nit, flow.tsx:37 `?? 0`. Dropping it is not equivalent: with an empty feed at the first story, two bursts before
   the next story dot only the newest one. The code is right but untested; move the fallback into `burst` to test it.
4. nit, story.ts:216. Compile and check do not refuse a duplicate `n` (filed as loka-wfrgk.18.4.1).
5. nit, storylist.tsx:43-49. The module-level timer drops the last scroll if the page reloads within 200 ms.
