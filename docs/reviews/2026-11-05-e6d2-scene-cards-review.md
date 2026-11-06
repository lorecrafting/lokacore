# Review: Editor E6d.2 Scene cards, `.scene` lines via `/set` (loka-wfrgk.50)

- PR: #673 `editor/e6d2-scene`
- Reviewed commit: `f5b491984d0d66068cc9c30f913d43ab76cec008` (base main `f74802703`)
- Governing: [cartridge.md Editor write path](../system/cartridge.md#author-preview) (`/edit`, `/set`,
  `was` staleness, journal), [WORKFLOW review stance](../WORKFLOW.md#review-stance),
  [architecture: composition](../system/architecture.md#building-mechanics-by-composition),
  `.scene` grammar `lib/loka/content/scene_files.ex:5-30`, `then` resolution
  `lib/loka/content/dialogue_links.ex` (`link/6`, `unlinkable/3`)
- Independence: Fable, authored none of the slice; detached worktree `review-673`
- CI at head (`gh run list --commit f5b491984…`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body
- Verdict: **CHANGES REQUIRED** (two should-fixes; the trust boundary itself holds)

## Must be true (written before the diff)

1. `/set` writes only a `.scene` under the cartridge root: no traversal, symlink, sibling root, non-`.scene`
   or non-listed file; the value is one `[a-z0-9_]+` key (no newline, `~`, `/`); a stale line is 409.
2. The write is line-exact: indent, trailing bytes and the final newline (or its absence) are kept.
3. Two-way gate: a card never offers what `/set` or `/edit` refuses, and `/set` accepts every key the
   compiler resolves for that verb (same key source as the picker).
4. `/edit` stays prose-only; cartridge.md says what `/set` and `/edit` accept, accurately.
5. Tests pin behavior with independent literals; mutants on the new logic die; the new red control fails
   on its planted violation.

## Checks that held

- (1) `guarded(root, file, 'read')` (`guard.ts:73-93`) refuses `\0`, `/`, non-normalized, outside
  `root + sep`, symlinked parent, unlisted or non-regular; `placed(file)?.ext !== 'scene'`
  (`scene_card.ts:26`); `named(value)` (`:27`) refuses `guard\nnpc: x`, `a/b`, `Guard`, `''`, `7`;
  `lines[line-1] !== was` → 409 (`:31`). Same line-text staleness model as `/edit` (accepted).
- (2) `VALUE` groups keep head/indent and trailing `\s*` (incl. `\r`); `split('\n')`/`join('\n')`
  keep or omit the final newline as before (test "/set changes one value…" byte-for-byte round trip).
- Deviations sound: `/source` `text` for `.scene` (`write.ts:198-202`; the push carries only changed
  keys); `live.ts` `once`→`o` cosmetic; `ci.yml` mise stub now before `npm ci` via `GITHUB_PATH`.
- Round trip on identity_sampler `stranger_talk.scene` (test 1 and the served test with `/undo`).
- Red control `scene-card` (`bin/red_controls.exs:249`) ran green in the head's `ci` job (`ci.yml:73`).

## Mutants

- `bin/mutate_diff.sh origin/main` at head: 54 mutants, 36 run, all 36 red-narrow (`scene_card.ts`,
  `scene_lines.ts`, `write.ts`); the 18 `Scene.tsx`/`right.tsx` rows were BASELINE-RED here (the
  Chrome panel suite did not pass its baseline on the loaded M1); the PR table lists them SURVIVED
  with 12 of 15 cleared by hand mutants and 3 open (`Scene.tsx:31,33`).
- Hand mutants (`bin/mutate.sh`, narrow `kernel/ts/test/scene_card.test.ts`), all red: drop the stale
  check `scene_card.ts:31`; weaken `named(value)` to `typeof value === 'string'` (`:27`); own-key order
  `.`→`_` in `scene_lines.ts:28`.
- PR-body claims rerun: `scene_card.ts:30` `>`→`>=` red (test "a then: takes…"); `Room.tsx:173`
  anyOf hide present.

## Findings

**Should-fix A — `/set` refuses keys the compiler resolves; the picker offers them.**
`kernel/ts/play/scene_card.ts:11-17` builds keys from source files (`placed()` = `npcs/<k>.json`,
`dialogues/*`, `*.scene`); the picker (`Scene.tsx:19-20`) uses compile nodes. Probe (tmp copy of
identity_sampler): a nested set `- Thank them` under `Ask their name` plus `then:
stranger_talk_ask_their_name` on another choice compiles clean, yet `ids().then` is
`['stranger_talk','end']` → the picker offers the key, `/set` answers 400 `then: no such key`.
Likewise `ids(speech_sampler).npc` is `[]`: a scene saying `npc: elder` (bundle NPC in
`areas/village.json`) could never be set. `/set` is the wrong side: take the keys from the last good
compile (the picker's source, as the World card does) and amend `cartridge.md:949-951`, which
restates the file-derived rule ("a non-abstract NPC source's key", "a dialogue's") and inherits it.
Confirms the PM's rating.

**Should-fix C — "Edit in Book" on a role line, which `/edit` refuses.**
`kernel/ts/play/scene_lines.ts:36-40` keys a `<role>: words` line (the documented prompt/reply form,
`scene_files.ex:12`; used as `bram: ~` in `test/loka/content_scene_branching_test.exs:16`), and the
developer's test pins it (`scene_card.test.ts:150,167`). `prose.ts:23-25` accepts only `* ` scene
lines and refuses the rest with `a key line`; `cartridge.md:946-947` says so. Scenario: the owner
writes `stranger: Hello.`, clicks Edit in Book, edits, gets 400. Either hide the button on role
lines (smallest, keeps "/edit prose-only") or widen `worded()` plus the spec; both sides must agree.
No repo cartridge has such a line yet, so no live content breaks today.

Nits (no fix round):
- `write.ts:202` filters `startsWith('dialogue.${key}')`, a superset of the documented
  `dialogue.<key>.` / `dialogue.<key>_` (`cartridge.md:939-941`); `dialogue.<key>2.*` leaks in.
  Harmless since `sceneLines` orders own keys first.
- `Scene.tsx:19-20` `then:` offers quest/keyword/riddle dialogues `dialogue_links.ex:387-394`
  refuses (OUTCOME_MISMATCH). Author-error guard.
- `Scene.tsx:31-34` reload-on-outside-write mutants: a test is feasible (serve a scratch copy as
  `scene_card.test.ts`'s `sampler()` does, `writeFileSync` from the test, await the input's new
  value); acceptable as an open item.
- PR body mutate table: `Scene.tsx` rows depend on the Chrome panel suite, which the sweep cannot run
  under load; say so in the table's note.

## Disposition

Fix round for A and C; re-check verifies `/set` and the picker share one key source (a nested-set
`then:` and a bundle `npc:` round-trip), the role-line button or `/edit` agree, and cartridge.md
states the accepted keys as implemented.
