# Review: NPC emotes, PR #509 (loka-kgd.193 slice A)

- PR [#509](https://github.com/lorecrafting/lokacore/pull/509) `feat/kgd193-npc-emotes` at `0e1fdaf56419e6f0ead666995d78e71452d6c47d`, diff `origin/main...0e1fdaf56`.
- Governing: "PLAN v2" and the PM slice A STOP ruling in `br show loka-kgd.193` (PLAN v2 voids the first PLAN, its PM decisions and the SLICE 2 DESIGNER RULINGS); [NPC emotes (G9)](../system/mechanics.md#npc-emotes-g9); [Emote declarations](../system/cartridge.md#emote-declarations); [Line placement](../system/book-ui.md#line-placement); [designer record](../decisions/owner-decision-designer-opus-2026-10-21.md) line 14; AGENTS.md "Writing tests".
- Reviewer: independent; authored none of the work.
- Verdict: **APPROVE WITH NOTES** (one should-fix, spec text only: a [small should-fix](../WORKFLOW.md#small-should-fix), so it is applied in place at re-check or the PR merges with it filed in Beads).

## Must be true (written before reading the diff)

1. `emote@1` owns one cartridge table `{key, others, to?: {others, you}}`; the section without the capability is UNDECLARED_CAPABILITY.
2. Every emote form is a catalog text key; a missing one is refused by the Elixir compiler.
3. A reaction step `{op: "emote", emote, npc?, to?: "subject"}` is refused for an unknown emote, a `to` on an emote without `to` forms, and a spawn-template `npc`.
4. At run time the emote plays only for a living NPC in the room the player sees; otherwise no line.
5. The engine emits one `emote.performed` line with actor and optional target; the Book words it from the authored form: `others`, `to.you` for the reader, `to.others` for a third party.
6. GameView carries the emote table only when non-empty (`minItems: 1`), and TS validation refuses malformed tables.
7. The narrate path and existing receipts, fixtures and hashes are unchanged.
8. Spec text (mechanics, cartridge, book-ui Line placement, toolbox row) is amended before or with the code.
9. Player emotes are not in this slice.

Results: 1-7 and 9 hold; 8 fails for book-ui.md (finding 1).

## Findings

1. **Should-fix, `docs/system/book-ui.md:281-284` (Line placement).** PLAN v2 "Amend first" lists the book-ui.md emote exception. The text still says an engine line is first or third person and only an authored line keeps its own text. `emote.performed` is an engine line worded from authored forms (`mobile/packages/game-view/line_words.ts:66-94`). The PR body proposes the wording and leaves it for the designer. Under the designer record (line 14) there is no per-slice design review, so the developer applies it. Failure: a later Book change that follows book-ui.md words `emote.performed` in first or third person and drops the authored text. Fix: land the proposed sentence as written.
2. **Nit, `test/loka/content_emotes_test.exs:70,77`.** The UNDECLARED_CAPABILITY and unknown-emote tests assert only the code. Failure: a diagnostic raised at the wrong path still passes.
3. **Nit, PR body cite "`emote.test.ts:65/:82/:87` hold the acceptance literals".** At the head, :65 is a "Breaks" comment, :82 a test title and :87 the `view.emotes` equality. The literals sit elsewhere in those tests. Failure: a reader following the cite finds no literal.

Not a finding: `reactions.ex:158` builds the ref string by hand, as `construction.ex:130`, `dialogues.ex:237` and `refs.ex:54` (inside `reference`) do; there is no shared formatter function.

Question, not a finding: the reader's perspective comes from the kernel omitting the target binding for the reader's own body (`kernel/ts/src/mechanics/emote/line.ts:41-44`, `line_words.ts:84-88`), not from comparing ids. This matches `lineSentence` and holds in single player; Realm multi-reader views are out of scope.

## Evidence

- Focused tests: `kernel/ts/test/emote.test.ts` 7/7; `test/loka/content_emotes_test.exs` 10/10.
- `bin/mutate_diff.sh origin/main` at the head, exit 0: 42 mutants, 38 run, 38 red-narrow, 4 NO-TESTS (`emotes.ex:11`, `:17`, `:20` x2), no SURVIVED, no TIMEBOX. This matches or improves on the handback table (taken at `c71f975f0`, one survivor since cleared). The NO-TESTS rows are covered by the PR's hand mutants. `line.ts:28` "drop return []" is red only by a SyntaxError; the PR's `if (false)` mutant covers it.
- Hand mutants, all red:
  - emoter := subject (`line.ts:23`);
  - drop `subject !== emoter` (`line.ts:31`);
  - `to.you` -> `to.others` (`line_words.ts:86`);
  - negate the `to` guard (`reactions.ex:156`);
  - drop the emote step's npc `instance` check (`reactions.ex:154`), red on the spawn-template test.
- Schema mutants:
  - drop GameView `emotes` `minItems`: red after regenerating contracts (`emote.test.ts:204`);
  - drop the step `to` enum: the regen refuses the schema (red-rebuild, as the PR says);
  - widen the enum to `["subject","actor"]`: green in both suites. A widening is not a removal under the contracts lesson, so it is not a finding.
- PR claims rerun:
  - "no fear, receipt or fixture files touched": confirmed (`git diff --stat`, no match for fear, receipt, conformance, fixtures or hash);
  - the acceptance-literal cite: not backed (nit 3).
- `/code-review medium` is reported in the PR body.
- No Storybook screenshots were taken (ports out of bounds for this review). The `NpcEmotes` and `GoblinsCower` story sources show the three authored forms through `lineWords`.
- CI at `0e1fdaf56` (`gh run list --commit`): ci, book-e2e and graph-diff completed success.

## Re-check: fix round 1 at `0c793857979758de24a6b967d2ec72b6a9d77978`

Scope: commit `0c7938579` only. Verdict: **APPROVE**.

- **Finding 1, fixed.** `docs/system/book-ui.md:284` now carries the PR's proposed `emote.performed` exception (`others`; `to.you` for the reader as target; else `to.others`). That matches `line_words.ts:84-88`.
- **Owner note.** The appended note in `owner-decision-moods-ambient-emotes-2026-10-30.md` quotes the owner text exactly as it stands in the `br show loka-kgd.193` note. It is dated and only appended.
- **Nit 2, fixed.** `content_emotes_test.exs:15-18` `refused/3` matches the code and the path together; :70 and :77 assert `emotes/cower.json` and `reactions/cower.steps[0].emote`. Focused run: 10/10. Red control, both path-only mutants together: `owned(rel, …)` -> `owned("x", …)` (`emotes.ex:12`) and `steps ++ [field]` -> `steps` (`refs.ex:55`). Exactly those two tests fail (8/10).
- **Nit 3, fixed.** The PR body cites `emote.test.ts:70/:76/:84/:89`. At the head these are the cower, hall-silence, "Nell bows to you." and "Nell bows to the goblin." literals.
- CI at `0c7938579` (`gh run list --commit`): graph-diff, ci and book-e2e completed success.

## Second opinion (at `0c793857979758de24a6b967d2ec72b6a9d77978`)

- Independent second reviewer; authored none of the work. Own findings written before reading the record above.
- Verdict: **APPROVE WITH NOTES** (two should-fixes, no blocker).
- Fix round 1 checked: `docs/system/book-ui.md:284` has the emote exception (finding 1); the path asserts are in (nit 2); the PR cites `emote.test.ts:70/:76/:84/:89` hold the literals (nit 3, rerun by `grep -n`).

### Findings

1. **Should-fix, `kernel/ts/src/content/cartridge.ts:83-107`.** `DEFINITION_MAPS` (the loader's key stage) lacks `emotes`. A hand-made artifact with a re-hashed `emotes["emote_sampler@0.0.1:emote/bow"].key = "cower"`, or the entry moved to `other@0.0.1:emote/bow`, loads (ACCEPT). The same edit on `npcs` is refused with ARTIFACT_DEFINITION_KEY_MISMATCH. Failure: the `bow` step words through the wrong entry, or through none and shows the raw key. Fix: add `'emotes'` and add one loader refusal test. (`populations` is missing too; that predates this PR.)
2. **Should-fix (or a PM ruling), `kernel/ts/src/mechanics/emote/line.ts:31-44` with `mobile/packages/game-view/line_words.ts:84-88`.** PLAN v2 P1 says "the client picks the reader's form ... kept for the Realm's many readers." Here the kernel picks: it drops the `target` binding when the target is the reader. `emoteSentence` then reads "no binding" as `to.you`. `lineSentence` instead gets the reader's person from its caller. Failure: if one line is delivered to every reader in a room (the Realm), a bystander reads "Nell bows to you." Fix: always bind the target, and have the client compare `participants.target` with its own body. Otherwise the PM rules P1 deferred.

Question: the step `to` enum widened to `["subject","actor"]` stays green. Both compilers refuse `to: "actor"` today (Elixir SCHEMA_VIOLATION at `reactions/greet.steps[0].to`, TS SCHEMA_VIOLATION). The schema is the contract, so a pin would only detect the change.

### Evidence

- Byte identity: all 106 existing cartridges have the same `content_hash` at merge-base `142f058d3` and at the head, and `emote_sampler` is the only new one. Every transcript was replayed at both trees and the full decision plus GameView compared after each command: 1487 lines, identical raw and with 64-hex values masked. No fixture, transcript or story view is in the diff.
- No save rows, jobs, events or commands: the registry `emote@1` lists `events: []` and `commands: []`, and `told` writes nothing.
- Loader against compiler, on hand-made artifacts:
  - Both refuse a step `to: "actor"` and a `to` that has only one form.
  - Only Elixir refuses an unknown emote, a step `to` on an emote without forms, an unknown `npc`, and `emotes` without `emote@1`. That matches the other kinds: the loader does no reference or capability-ownership checks.
- `bin/mutate_diff.sh origin/main` at the head, exit 0: 42 mutants, 38 red-narrow, 4 NO-TESTS (`emotes.ex:11,17,20x2`). This matches the record above.
- Hand mutants, all red-narrow:
  - emoter defaults to the actor (`line.ts:23`);
  - drop `!mine` (`line.ts:34`);
  - `to.others` -> `to.you` (`line_words.ts:88`);
  - drop the `others` text-key check (`emotes.ex:17`);
  - drop the ownership check (`emotes.ex:12`).
- Text player: `kernel/ts/play/spoken.ts` uses the same `emoteSentence`, so for a single player it reads the same as the Book.
- CI at the head (`gh run list --commit 0c7938579...`): ci 41124887928, book-e2e 41124888041 and graph-diff 41124896223 all completed success.

### Second opinion re-check (fix `ab6db7f400f1912cebc82dc8c41cc4e62df6d7de`)

- Verdict: **APPROVE**.
- Finding 1 is fixed. `kernel/ts/src/content/cartridge.ts:88` adds `'emotes'` to `DEFINITION_MAPS`, so `loadCartridge` (the only caller) now checks it. The new test `kernel/ts/test/emote.test.ts:222` computes the hash itself, and its expected code, path and data come from the input. Results: `emote.test.ts` passes 8/8. Red control: with the `'emotes'` line removed, that test alone fails (7 pass, 1 fail).
- Finding 2 is closed by the PM ruling. `kernel/ts/src/mechanics/emote/line.ts:31` has the `ponytail:` comment, and the follow-up is filed as loka-u6wj (open, P3).
- CI at `ab6db7f40` (`gh run list --commit`): ci 41128213253, book-e2e 41128213399 and graph-diff 41128221378 all completed success.
