# Review: /line opens an inline prose key's own definition line (loka-wfrgk.100.3)

- PR: #693 `editor/prose-line-own-file`
- Reviewed commit: `d56eb23e85f0406c2e0391b3cf23fe475842433d`
- Governing: [cartridge.md Inline prose](../system/cartridge.md) (:275-286, :420-443: key
  `<kind>.<key>.<path>`, `room_line` step written `room`, prose after `extends`, area bundles and folders),
  [WORKFLOW review stance](../WORKFLOW.md#review-stance), AGENTS.md "Writing tests"
- Independence: authored none of the slice; detached review worktree
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (5 rounds)
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. An inline key resolves only to a line in its own definition (own file, area folder file or bundle
   member) at the key's path, with `room` reading `room_line` when both sit beside each other.
2. Inherited words (prose runs after `extends`) have no own line; the fallback keeps every hit as on main.
3. True ambiguity inside the own file is still 400; the `was` guard and `worded()` refusals are untouched.
4. A `~` line without a trusted map stays 409 (wait for the compile); a scene key keeps its scene hits.
5. No input resolves to another key's line.

## Checks that held

- prose.ts `own`/`marked`/`valueAt`: probes on controlled trees, expected values hand-written
  (area folder file, dialogue JSON + own scene + another scene, array index path `variants.0/.1`, nested
  `behaviours.0.with.bye` with a same-words sibling, `room` ref beside `room_line`, extends child overriding
  the parent, bundle `rooms.m` vs `items.m`, `status`/`replenish` dirs, own file with other words -> `[]`,
  undefined key -> every hit as on main): all as expected. No wrong-line input found.
- told.test.ts:110 400 -> 409: own-file narrowing leaves one `* ~` in `u.scene`, which names no key, so the
  stale-map refusal (409) is the right answer; not loosened. live.test.ts:115/:117 pin the own scene only
  and `[]` for stale words: right.
- Claim reruns: origin/main prose.ts against head told.test.ts fails at :110 (`actual: 400`) and in the new
  test (400 "more than one source line"); prose.ts:122 `||` -> `&&` fails live.test.ts open (`actual:
  undefined`). Both as the PR body states.
- `fits` plural guess covers every dir in source.ex `@dirs` (:210-232).

## Mutants

`bin/mutate_diff.sh origin/main` at head: 30 rows, all BASELINE-RED (the one-hop test set needs `mix`
in parallel; PR body reports 32, same cause). Hand mutants against told + live tests (baseline in the
scratch worktree: 1 fail, `GET /numbers` needs mix):

| Mutant | Result |
|---|---|
| prose.ts:130 `? kept : hits` -> `? hits : kept` | red (+3 fails) |
| prose.ts:96 drop `\|\| value?.prose === MARK` | red (+1) |
| prose.ts:80 drop `room` -> `room_line` alias | red (+1) |

## Findings

1. **should-fix (for the PM; outside this slice's files)** mobile/app/author/inbook.ts:72
   `void api('/open', {key, words})` discards the response; with stale words the new narrowing gives
   `kept = []` so live.ts:168 answers 404 and the author sees nothing happen (callers :184, :278). The PM
   accepted "opens nothing" but asked that the author get a message. Follow-up Beads item, not a fix round.
2. **nit** PR body says docs/system-graph.gen.json was regenerated; the diff vs merge-base is three files
   and does not touch it (no graph change was needed, so nothing is wrong; the body is inaccurate).
3. PR #690 (card words field): `fields.tsx` builds the key with `proseKey` and words with `inline()` and
   calls the same GET /line; it gets the narrowing for free, and a stale `was` still hits /edit's 409. No
   interaction beyond that.

Developer's open list (prose.ts:105 plural guess, `bundled()` rescan, `fileOf` vs `lineAt`, :122 scene hits
kept, told.test.ts:265 overlap): agreed as nits or accepted behaviour; none is a finding.
