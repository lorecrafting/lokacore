# Review: author panel lint covers .scene and .cut (PR #630, loka-vduxr.50)

- PR: [#630](https://github.com/lorecrafting/lokacore/pull/630), branch `editor/scene-lint`
- Reviewed commit: `36da5e97994390c3adc5cc393725f64a4fea2c95`
- Governing: [cartridge.md, Author panel](../system/cartridge.md#author-preview) ("under them the lint findings"), [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: the reviewer authored none of this slice.
- CI at reviewed head (`gh run list --commit 36da5e9...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body.
- Verdict: **CHANGES REQUIRED** (one blocker; it needs test lines only).

## Must be true (written before the diff)

1. Every finding `mix loka.lint` prints for a `.scene` or `.cut` source reaches the panel, and `.json` and `areas/` lines still do.
2. A `scenes/<key>.scene` dialogue gets every dialogue rule that `dialogues/<key>.json` gets: label, exit, action.talk and hand_over.
3. A `scenes/<key>.cut` (a cutscene) and a `scenes/<key>.json` are not read as dialogues.
4. The rules moved to `lint_labels.ex` are unchanged apart from the path reader.

## Checks that held

- Item 4: the old and new rule bodies differ only in `run/2` (was `labels/2`), the `parts/1` reader and the exits filter, which moved from a pattern to `match?`. For the rels that `lint_rel` produces, `match?(["dialogues", _], ...)` equals the old `"dialogues/" <> _` match.
- Item 3: `parts/1` maps only `scenes/*.scene`.
- identity_sampler: before and after on every cartridge with a `scenes/*.scene`, only identity_sampler changes, by one line. `stranger_talk.scene` has no `name` and is not `entry: false`, and `text.json` has no `action.talk`, so the Book would show the raw key. The finding is real.
- PR-body cites rerun: removing `scene` from `live.ts:55` fails `live.test.ts:217`, and removing the `ext === 'scene'` branch in `story.ts:85` fails `story.test.ts`. Both are backed.

## Mutants

`bin/mutate_diff.sh origin/main`: 12 mutants, 12 red-narrow, no TIMEBOX rows. This matches the handback.

Three hand mutants each change a call site back from `parts` to `Path.split`; each run is `test/loka/content_lint_test.exs` plus `content_lint_layout_test.exs`, 23 tests:

| Mutant | Result |
|---|---|
| `lint.ex:232` talk | green |
| `lint.ex:139` items refs | green |
| `lint_labels.ex:44` exits | green |

## Findings

1. **Blocker.** Each of the three call sites above can be undone with the suite still green.
   - Failure scenario: a `scenes/` dialogue loses its talk, exit or hand_over finding again, and no test fails.
   - The PR body says the call sites "share the helper, which the label test pins". These runs do not back that.
   - Fix: add one `scenes/x.scene` assertion each beside `content_lint_test.exs:65` (talk), `:164` (exits) and `:352` (hand_over). Show each one red against the mutant above.
   - Ruling on open point 1: a test is needed; the shared-helper test is not enough.
2. **Nit.** At `lint.ex:232`, the talk rule counts an `entry: false` dialogue as bare.
   - Every nested-set child is `entry: false` (`SceneFiles.parse` on a two-level scene gives `hal_ask` `%{"entry" => false}` and no `name`). Talk never offers such a child (`selection.ts:35,52`).
   - Failure scenario: a named `scenes/hal.scene` with one nested choice, and no `action.talk` text, gives the false finding `text.json: action.talk has no text, yet a dialogue has no name of its own`. The control without the child gives `[]`.
   - The same was already true under `dialogues/`. Optional in this round: add `d["entry"] != false` to the `bare?` check.
3. **Nit, Beads.** Ruling on open point 2: a finding for a nested child prints `scenes/<parent>_<choice>.scene`, a file that does not exist.
   - It is the same rel the compiler uses for that child (`SceneFiles.rel/2`), and the panel's `nodeOf` still attaches it to the right dialogue.
   - The owner can find the parent by its prefix. This is mildly misleading but does not block, and it predates this PR under `dialogues/`.
