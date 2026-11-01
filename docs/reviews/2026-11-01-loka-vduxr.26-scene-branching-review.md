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
