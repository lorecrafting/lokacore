# Review: scene branching (loka-vduxr.26)

PR #557, branch `engine/scene-branching`, commit `068254bd9367e16a0a15aa6e61707661e6e61644` (a re-review; the first round at `93d694be0` is PR review 5728438475).
CI at that head (`gh run list --commit`): graph-diff, ci and book-e2e completed, success.
Governing: [mechanics.md Branching dialogue](../system/mechanics.md), [writing-the-game.md](../guides/writing-the-game.md), [book-ui.md](../system/book-ui.md), [Review count](../WORKFLOW.md#review-count).

**Verdict: CHANGES REQUIRED** (no blockers; three should-fixes). A second opinion is required before merge.

## Must be true (written before the diff)

1. Several nested scenes for one speaker: Talk opens a top by the merged selection rule, never a child, and survives reload.
2. A writer can state "first meeting, then later" without a trap that compiles and never plays.
3. `entry: false` means the same in Elixir and TypeScript; existing cartridges keep their hashes.
4. With nothing open the player sees no broken row.
5. The contract text matches the code; the PR body matches the head.

## Findings

- **S1 should-fix** `lib/loka/content/scene_lines.ex:104`, `lib/loka/content/scene_files.ex:237`, `docs/guides/writing-the-game.md:119`. File names decide who opens first. `smith_first` plus `smith_later` (`when: x`) compiles with only ENTRY_GUESSED on `smith_first`, whose line does not name `smith_later`; in play the later scene never opens. The remedy `entry: true` gets the next warning, "never opens". Fixing it by rename moves the dialogue key, child keys, `_done` facts and `then:` targets. `when: not x` gets `` `fact` is not valid here ``. **Ruling:** add `when: not <fact>`, mirroring `needs: not`; about five lines at the two cites, no runtime or contract change. A sidecar `fact_compare` with `equals: false` on `smith_first` plus `when: x` on `smith_later` already compiles with no warning, so the runtime supports it and name order stops mattering. No explicit ordering field. A guide line alone is not enough: the trap is a natural choice of names.
- **S2 should-fix** `docs/system/mechanics.md:485` says "the first available, else the first"; `kernel/ts/src/mechanics/dialogue/fall_through.ts:38` keeps every refusal. A cartridge or Book author reading the contract expects one refused row and gets one per dialogue.
- **S3 should-fix** PR body line 2 says "No runtime or `kernel_api` change", false at this head (1.142, `oneTalk`, `live`). Hashes and hosted runs cite `93d694be0`; the `comes_back?` open row is obsolete; `/code-review` covers no commit from `576a038ac` on (run in the fix round). A second-opinion reviewer briefed from it would skip the runtime.
- **N1 nit** `lib/loka/content/dialogue_links.ex:94` skips `entry: false` in ENTRY_UNUSED. A sidecar `{"entry": false}` on an only root, no `then` to it: no warning, the speaker has no Talk.
- **N2 nit** `docs/system/mechanics.md:3681` renumbered realm seams "6." and "7. to 9." to "3." and "4. to 9.", after "2. to 5.".
- **N3 nit** `lib/loka/content/explain.ex:85`: sidecar `choices: "bad"` still adds a false "`then` names `smith_talk`, and no dialogue has that key".
- **N4 nit** `kernel/ts/test/dialogue.test.ts:118`: "Breaks: every accepted action copying the choices map" now sits on the priority test.
- **N5 nit** `lib/loka/content/dialogue_once.ex:58`: mutant survivor from the first round; a doubled `once` in `lib/loka/content/scene_files.ex` silently passes.

## Coordinator's questions

1. **Several nested scenes, no sidecar: pass.** `smith_1_later` (`when: x`), `smith_2_first` (nested, `sets: x`), reloading every step: first, nested, close, then later. No warning, no reload difference.
2. **Ordering: S1.** Yes, a writer must name files; it is a trap, warned but not silent. `smith_10_later` sorts before `smith_9_first` with no warning; the guide does not mention lexical order.
3. **Runtime.** Selection honours `entry: false`: mutants in `selection.ts`, `fall_through.ts` and `dialogue_links.ex` all died. Hashes against `fbd1900c0`: 107 cartridges, none errored, all identical; no cartridge uses `entry: false`. The only GameView change: when one dialogue is open the speaker's refused rows go (8 story views; the Book already collapsed them). Saves: at this head a reload mid-conversation kept the talk, headless and in the browser. A save made on the base with a talk pending is refused at the pin (`mobile/authority/local-story/authority.ts:100`, Start over), as with every `kernel_api` bump, so no mid-conversation carry-over exists to break. **Second opinion required:** `protocol/dialogue.schema.json` gives `entry: false` a new meaning, and the [#560 ruling](2026-11-01-dialogue-entry-review.md) allows no additive carve-out for protocol contracts. The selection change alone would not need one; no save contract changed.
4. **None open:** the person page shows title, description, Look, Leave: no Talk card, no filler, matching `docs/system/book-ui.md:456`. The GameView keeps two refused rows; invoking one gives `invalid_state`; the player never sees them. Accepted; only S2's wording is wrong.
5. **Cookbook test: holds.** Null green; a planted `warning: x` on stderr fails; the lock line alone passes; lock plus real fails.
6. **Preview, 390 px, on a copy: pass.** Talk, Ask, Deeper, Back reopens the parent, `then: end` leaves only Leave, Talk then opens the later scene, reload keeps it, Finish works.

## Earlier findings

| First round | State at this head |
| --- | --- |
| B1 over-refusal on opposite `needs` | Fixed, `scene_files.ex:179`: warns, compiles |
| B2 sidecar `then` over a written `then` | Fixed, `scene_merge.ex:72-73`: refused, own line; mutants died |
| S3 #556 clash | Disposed: children `entry: false`; Talk opens the top |
| S4 `once` line | Fixed, `explain.ex:120` |
| S5 `keyword` line | Fixed for `keyword`; a malformed sidecar riddle still adds a cascade (N3) |
| S6 order | Fixed for dialogues (guide :113-121); choice order not rechecked |

## Tests

14 rows, one at a time, against the importing test files, two null controls green, tree clean. All 12 mutants died: `ts_live_entry`, `ts_onward_entry`, `ts_oneTalk_first_when_none`, `ts_oneTalk_first_not_available`, `ts_oneTalk_named_too`, `ex_live_entry`, `ex_unused_false`, `ex_free_links`, `ex_opened_entry`, `ex_merge_written`, `ex_merge_own`, `ex_unreachable_refused`. Hand-picked over the last commits, not a `bin/mutate_diff.sh` rerun. No frozen fixture touched beyond the regenerated `mobile/app/stories/live/*.sql` stamp lines.

Reruns of PR claims: "No runtime or `kernel_api` change" is false (S3); "107 cartridges, no difference" is backed.

## Re-check: head `280fe76d0` (merged with main `295aaeff5`, `kernel_api` 1.142, main 1.141)

**Verdict: CHANGES REQUIRED** (two blockers, one should-fix). CI at the full sha: `ci`, `book-e2e`, `graph-diff` completed success. The second opinion is still required.

| Earlier | State |
| --- | --- |
| S1 name order | Fixed. Played `sage_first`/`sage_later`, `sage_later`/`sage_first`, `sage_10_first`/`sage_9_later`, `sage_10_later`/`sage_9_first`: no warning, first meeting opens first, reload keeps it, later opens after. Mutants: `when: not` lowering without the `not` (`scene_files.ex:239`), fact recorded true (`scene_lines.ex:105`): both died |
| S2 `mechanics.md:485` | Fixed |
| S3 PR claim | Fixed: "Runtime change, unavoidable"; `kernel_api` 1.142 confirmed against main |
| N1 | Not rechecked (my run paired `entry: false` with `keyword`, which warned) |
| N2, N4 | Fixed |
| N5 | Doubled `once` refused; the `dialogue_once.ex:58` test now exists |
| N3 `explain.ex:85` | Open, nit |

### Findings

- **B1 blocker** `lib/loka/content/choice_order.ex:22`: `lower/1` renames choices but not a reaction's `on.choice`, and no check names it. Reaction on `choice_resolved` `choice: zebra`: written Apple, Zebra fires; written Zebra, Apple compiles with no warning, ids `c001_zebra`, `c002_apple`, fact never set. `writing-the-game.md:105-107` says moving a line changes the built id, but lists where a choice keeps its words (`then`, same-key JSON, `once` fact) and leaves out reactions; the cookbook teaches `choice_resolved` by id, and nothing warns. The rename is new here: `choice_order.ex` is not on main.
- **B2 blocker** `lib/loka/content/choice_order.ex:11`: same for `quest_resolved` `outcome`, because `rule.ts` resolves with the renamed id. Written Carry, Leave fires, outcome `carry`; written Leave, Carry compiles clean, saved outcome `c002_carry`, reaction never fires. `dialogues/<key>.json` story points are rewritten; this is not.
- **S1 should-fix** `lib/loka/content/scene_files.ex:124`: the guide's first meeting with nesting. Under `when: not sage_met`, a choice with `sets: sage_met` and a nested `Back`: Back closes the talk, no warning (`back -> undefined`), where `writing-the-game.md:102` promises it goes back. The implied return names a scene whose policy just closed. No loss; the next Talk opens the later scene.

### The ten `/code-review` items

| Item | Result | Disposition |
| --- | --- | --- |
| `choice_order.ex:22` | Run, confirmed | B1 |
| `choice_order.ex:11` | Run, confirmed | B2 |
| `choice_order.ex:16` | Run: new content over an old save refuses, `pinned_release_missing`; a migration across a release not run | File |
| `scene_files.ex:124` | Run, confirmed | S1 |
| `dialogue_links.ex:221` | Run: compiles with the warning `never opens`; wording speaks of "an `entry` dialogue" | File (wording) |
| `scene_lines.ex:157` | Run: `\xFF\xFE` and NUL in a nested line give a clean line-numbered refusal | Not a bug; drop |
| `scene_lines.ex:48` | Run: the refused line already fails the compile | File, harmless |
| `dialogue_once.ex:58` | Run: `once` beside `asked` hides the choice after taking it. Riddle: compiles, not played; `rule.ts:105` returns before the choice's steps, so a wrong answer spends nothing | File |
| `scene_lines.ex:107` | Run with one top unconditional: warns `ENTRY_GUESSED`. Two passing `when:` not played; guide teaches exclusive | File |
| `scene_files.ex:348` | Run: `Line `asked` is not `asked`, or repeats it` above the first choice; `once` has the proper message | File (wording) |

Reruns: new Elixir test 4 passed, cookbook test 11 passed at this head.

## Re-check: head `0440cf678` (scoped: findings, the `order` field, open items; merged with main `bfeaeb6a5`, `kernel_api` 1.144)

**Verdict: CHANGES REQUIRED** (two blockers, both a Talk refused for good with no word to the writer). CI at the full sha: `ci`, `book-e2e`, `graph-diff` completed success.

Must be true: a choice keeps the id its words give, so everything that names it resolves ([mechanics.md `then`, Links](../system/mechanics.md)); it shows as written, before and after a reload; only a scene writes `order`; Talk "is refused only if nothing further down opens" for a first meeting that links on ([writing-the-game.md:116-118, :142-144](../guides/writing-the-game.md)).

| Earlier | State |
| --- | --- |
| B1 reaction on a choice | Fixed. Written Zebra, Apple, Mango: `choice: zebra` fires |
| B2 quest outcome | Fixed. Written Zebra, Carry: `quest_resolved` `outcome: carry` fires |
| S1 Back under `when: not` | Resolved as the warning, below |
| Refused choice crash | Gone, test passes; mutant red |
| `RETURN_CLOSED` false warning | Gone: played the setter with `then: end` beside another way back, no warning; the plain case warns |
| N3 `explain.ex:85` | Not rechecked |

**`order`.** Played: shown `zebra, apple, mango`, then a sidecar's `aaa` last; the same after a cold reopen; nested set `zebra, apple`. `order` in a sidecar refused, `choice_order_written`. Story point and riddle by words: test.

**Hashes.** All 107 cartridges compiled at `bfeaeb6a5` and at the head, one VM each, 0 failures; `diff -rq` lists 0. Backed, but no cartridge has a `.scene`, so this does not reach `order`.

**`RETURN_CLOSED`: a warning is right.** [mechanics.md, After an answer](../system/mechanics.md) closes the talk with no line when a `then` target's policy fails, and a closed talk is a legal state; a refusal would add a second rule to that one for scene files alone. The guide (`writing-the-game.md:102-104`) now says it.

### Findings

- **R1 blocker** `kernel/ts/src/mechanics/dialogue/fall_through.ts:32`: `when: not sage_met`, `- Start`, nested `- Go` with `sets: sage_met`, `then: b2`. First talk plays to `b2`; second talk `available: false`, `invalid_state`, for good, no warning. The same scene with no nesting opens `c2`. The kernel keeps the letter of `entry: false`; the guide's intro linking to a hub does not survive nesting. Anything `b2` alone gives is lost once the player leaves.
- **R2 blocker** `kernel/ts/src/mechanics/dialogue/selection.ts:179`: `when: not sage_met`, `- Hello`, `once`, `sets: sage_met`, `then: d2`. That is the first meeting of [writing-the-game.md:141-143](../guides/writing-the-game.md) ("once the condition fails Talk opens the hub") written with this slice's `once`. Second talk refused for good, no warning. The guide's "other gate" can be read to cover a spent `once`, and the kernel follows "its policy holds"; so the fault is the silence, not the kernel, the same class as `RETURN_CLOSED`. Same trap, not a guide break by itself: a lone `once` with `then` and no `when:`, `needs: not` plus `sets`, and two `once` choices (refused once both are spent).
- Least fix for both: a compile warning where a speaker's only way to a live `then` target runs through an `entry: false` dialogue or a choice whose own step shuts it, and the guide says so. A second entry that opens clears it. A runtime change needs a spec change first.

### Other open items

| Item | Result | Disposition |
| --- | --- | --- |
| `scene_files.ex:122` | Read: a compile refusal, not a refused Talk | File |
| `scene_files.ex:38` | Read: duplicate constant | File |
| `action_lists.ts:109` | Read: Talk is listed only on `of`; the rows above all kept one | No risk found |
| PR's `choice_order.ex:16` | The file is gone | Nit: fix the cite in the PR body |

### Tests

Mutants, importing tests, all red: `choiceIds` reversed (`dialogue.test.ts` 1 fail); numbering reversed (2); `is_map_key` guard dropped (1); `order` refusal off (1); `RETURN_CLOSED` without the way-back test (1). Base: `content_scene_branching_test.exs` 26 pass, `dialogue.test.ts` 25 pass, `dialogue_cookbook.test.ts` 12 pass, as the PR claims. No test covers either blocker. `bin/mutate_diff.sh` not rerun, by brief.
