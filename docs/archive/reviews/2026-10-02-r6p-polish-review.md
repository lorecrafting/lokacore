# Review: R6P Polish, the phone-test UX notes (PR #107)

- PR: #107, branch `r6p-polish`. Commit reviewed: `7643b44`.
- Reviewer: a fresh Opus reviewer that authored none of the work. The codex Sol review runs separately.
- Brief: the PM's polish brief (owner asleep, PM rulings auto-approved). The 15 FIX notes, plus note 4's ending
  line. The OWNER items are not built. The cartridge change is three text keys. Note 5 is not a bug. Note 18 is
  open with no app change.
- **Verdict: APPROVE WITH NOTES.** Two should-fix findings (F-1, F-2), two nits, and one open item for the gate (O-1, note 18's cause).

## What must be true (written before reading the diff)

From 00 §4.10 (touch rules), 06 §43 (choices and narration), 04 §14-§16 and the brief:
1. The touch layer decides no legality. It shows only what GameView advertises. The refused-walk line, the
   absent-speaker line and the ending line are presentation only: no unlock and no new command.
2. Dialogue shows closed choices greyed, with their reason in plain words (00 §4.10). No kernel code
   (`moved`, `choice_opened`, `exit_locked`) reaches the log or an answer.
3. A closed interaction can still be closed (06 §43). Close stays drawn when the speaker has gone.
4. A reopen shows the last committed narration again (06 §43). The ending line is computed from the view, so it
   comes back after a relaunch too.
5. The absent-speaker line depends on the speaker being missing, not on `not_present` (a dropped lantern also gives
   `not_present`). Arrive and leave lines are for NPCs only, and only when the place does not change.
6. The cartridge changes exactly three keys. The known answer is regenerated hand-first → Python → compile, and both
   hash pins move to the same new hash.
7. No kernel, `protocol/` schema, GameView or `proposal.ts` change. Every file stays within the size limits.

## Check against the list

- 1: `refused` (model.ts:34) only builds a line. Footer still walks only on `e?.available` (Footer.tsx:38). Pass.
- 2: `said` (smoke.ts:116) uses OUTCOME with an empty fallback, and refusals go through `reason`. `why` uses `reason`.
  The walk showed no code word anywhere. The REASON table itself is untested (F-2).
- 3, 4: pass on the Simulator (r17, r18, r23).
- 5: `absent` keys on `speaker_id` (model.ts:41-44). `comings` (smoke.ts) filters `kind === 'npc'` and returns `[]`
  on a place change. Both were mutation-checked below.
- 6: `python3 test/loka/cartridge_lantern_hash.py` in my worktree regenerated the fixture byte for byte
  (`747a5bd8…b297`). The diff of `text.json` is the three named keys. `content_lantern_test` passes in
  `bin/check_all.sh`.
- 7: no kernel, protocol or GameView file is in the diff. smoke.ts is 299 lines (limit 300), pages.tsx 266.
  `bin/check_all.sh` exit 0 and `npx tsc --noEmit` exit 0 in my worktree.
- Deviations accepted: the extra `smoke.test.ts`/`touch.test.ts`/`start_over.test.ts` edits only drop `'moved'`,
  capitalise fallback labels or follow "Talk to" (rows 1, 6, 10). The old text left in
  `docs/spec/pre-release-proof.md:51` and the room-view mockups is informative and stays (PM ruling).

## Mutants (throwaway edits in the review worktree, each reverted; mobile Node suites)

| # | Mutant | Result |
|---|---|---|
| M2 | words.ts: delete `exit_locked` | killed (model row) |
| M4 | smoke.ts:116 `?? ''` → `?? d.outcome!` (raw code back) | killed (10 tests) |
| M6 | `comings`: drop the place check | killed (10 tests) |
| M7 | `comings`: count items too | killed (3) |
| M8 | keep the look echo | killed |
| M9 | "leaves" ↔ "arrives" | killed |
| M10 | rejected answer shows the raw code | killed |
| M11 | `ended`: `every` → `some` | killed |
| M12 | `ended`: drop `journal.length > 0` | killed |
| M13 | `ended`: drop `'resolved'` from OVER | killed |
| M14 | `absent` keyed on the answers' `not_present` | killed |
| M15 | `absent` inverted | killed |
| M16 | `refused`: drop the cartridge-message branch | killed |
| M3 | words.ts: delete `not_present` | **survives** (F-2) |
| M3b | words.ts: delete `invalid_state` | **survives** (F-2) |
| M1 | reason fallback returns the raw code | survives. Not reachable: every code the Lantern reaches has an entry. Not a finding. |
| M5 | NPC lines before the answer line | survives. Neither order is wrong. Not a finding. |

## Findings

**F-1 (should-fix): a refused walk reads as the refusal of the move that just succeeded.**
`mobile/authority/local-story/smoke.ts:126` and `mobile/app/book/Book.tsx:50`.
The room log starts at the echo of the move that arrived (`setFrom(logLength)` is taken before the echo is
pushed). This PR removes `moved`, so that echo now stands alone. Then the new refused-walk line follows it.
Scenario (walk r07): walk east into the Lantern Shelter, then drag east. The page reads "> Go east / The way east is
locked." A player reads this as "my move east was refused", but the move east succeeded. Before this PR, `moved`
stood between the two lines. Every room page also opens with a lone "> Go south" (r14, r27). The smallest fixes:
start the room log after the arriving echo, or treat `moved` like `looked` and drop its echo. Either fix changes the
smoke rows that pin the echo, so the PM rules which one.

**F-2 (should-fix): the refusal words that fix note 2 are untested.**
`mobile/authority/local-story/words.ts:20-21`. Delete `not_present` (or `invalid_state`) and the whole suite
stays green. With Bram gone after 19:00, the answers then read "Carry it along the bank: not present". That is
note 2's exact complaint. Acceptance row 3 ("no answer shows a raw code") is checked only on log lines
(`touch.test.ts`'s CODE regex), never on the drawn answers (`why`). The `touch.test.ts:130` row reads
`o.reason.code`, not the words. Break to catch: a reachable code with no entry. A behavior assertion would catch
it, for example that `why` of each answer differs from its code with spaces, not a pinned wording.

**N-1 (nit): `absent` shows on a speakerless choice.** `mobile/app/book/model.ts:42`. `PendingChoice.speaker_id`
is optional (`kernel/ts/src/contracts.gen.ts:113`). A choice without a speaker matches no entity, so the line
"They are not here to answer" would show under a narrator's choice. Today only `dialogue.ts:91` makes choices, and
it always sets the speaker, so this cannot happen yet. Guard: `v.choice?.speaker_id && …`.

**N-2 (nit, player): "not yours" misleads.** `mobile/authority/local-story/words.ts:23`. After the lantern is
dropped with the choice open (r16), or before it is fetched (r25a), the answers read "Carry it along the bank: not
yours". The lantern is Bram's, so a player can read this as true and stop. "you don't have it" says what is
missing.

## Open item for the gate

**O-1: the note 18 dot is the footer map's own "you" dot, not a scroll indicator.** It is shown by
`mobile/app/book/MapDrawing.tsx:143-144`. It has the same size and ink colour. Whenever the stray dot shows,
the joystick centre has no dot (r17, r20, r27). Whenever the centre dot shows, there is no stray dot (r02-r07,
r09-r11). In r14 the centre dot is missing and no stray dot is in view.
Journal → Back remounts the Footer and puts the dot back at the junction (r22). The whole drawing is also offset
about 11 pt right, so the cause is likely the joystick's transforms (a native-driven `scale` with a JS-driven
`knob` translate) after page turns. I did not confirm this. It is reproduced after Talk in both endings: over
"SETTINGS" (r20, r27) and below the home bar after the Wait page (r17). It is **pre-existing**: the developer's
`before-10`/`before-11` shots at a559ffd show it. **Gate:** it does not block understanding, and walking still
works. It should not block the gate. Carry it as a footer-map bug with this cause, not as "not the app".

## Simulator walk (polish-414, 414 × 896, iOS 27, Release build of 7643b44, agent-device 0.21.19)

Shots are in [2026-10-02-r6p-polish-review-walk/](2026-10-02-r6p-polish-review-walk/). This is why the commit
holds more than the record and the index line (brief row 9).

| Step | Result | Shot |
|---|---|---|
| (a) accept | "You take on the task. It is in your journal." | r02 |
| (b) drag west at the landing | "The way west is locked." in the log, no page turn (the footer label overlaps the tip, as the PR says) | r03 |
| shelter, drag east | "The way east is locked." (see F-1) | r07 |
| (c) take | thing page "A brass lantern", "Take a brass lantern", log "Taken." | r08, r09 |
| look / scan | look: log unchanged, hint gone. Scan: "> Scan" only (O-scan, OWNER) | r10 |
| (d) Map page | "Go north", "West: locked" | r12 |
| (e) talk | the answers and Close are in view with no scroll | r14 |
| drop with Bram present | no absent line. Answers "…: not yours" (N-2) | r16 |
| (f) wait until 19:00 | "Time passes." "Bram the ferryman leaves." Absent line, answers "…: not here", Close drawn | r17 |
| (g) close, green, carry | "You leave the question for now."; carry narration; "The story ends here. Start over is in Settings." | r18, r20 |
| Settings | "Start over" is there, so the ending line is true. It asks first | r24 (not kept) |
| (h) terminate + relaunch | both hints stay gone. The narration and the ending line come back | r23 |
| leave ending (2nd game) | leave narration + ending line. No ending line on the fresh game | r27 |
| refused choice | answers greyed with their reason (r16, r17, r25a) | |
| note 17: talk, then walk north without Close | the log shows only "> Go north". There is no speaker label. The prompt (it names Bram) and "They are not here to answer…" show, the answers read "…: not here", and Close is in view. A player can tell who "They" are. Pass | r28 |
| (i) dot over settings | **reproduced** (O-1) | r17, r20, r27 |
| (j) note 5 | start in the text (y 440): stayed at Ferry Landing. Start 20 pt above the joystick top (y 689): stayed. Start on the joystick centre: walked to Village Green. **NOT-A-BUG** confirmed | r04, r05, r06 |

Player notes (not blockers; the OWNER items are already listed): scan still does nothing visible. After 19:00 nothing
says where Bram went (O-3b). After an ending, Wait, Scan and Talk stay offered, and the ending line is the only
closure (O-4). Once, a quick batch of six joystick pans right after a press did not walk. With a 1 s gap it never
failed again, so I could not reproduce it. It may be agent-device timing during the page turn. This is a question,
not a finding.

## Tests and over-engineering

- The new tests name their breaks. Their expected values are fixture text or hand literals. The CODE regex is a
  behavior check, not a change detector. No mocks.
- `/ponytail-review` result in the PR: lean. I agree. `words.ts` (25 lines) is the smallest home the brief allowed.
  The `answer`/`comings` split keeps `press` under 40 lines. Nothing to delete.
- Composes with: these are app words over existing codes. No mechanic is named. `ended` keys on the journal states,
  not on Lantern content.

## Codex Sol first review (gpt-6.1-sol, at 7643b44), verbatim

REQUEST CHANGES

```text
POL-1 | blocker | mobile/authority/local-story/touch.test.ts:211 | The refused west move never asserts that an explanation appears. An in-memory mutation making said() return '' for every saved rejection still passes both new polish tests: the code filter accepts missing feedback. Assert the literal refusal immediately after this press and confirm that mutation fails.

POL-2 | should-fix | mobile/app/book/pages.tsx:106 | Hint-storage failures escape rendering and input handlers (also Footer.tsx:30,35). An unreadable hint database prevents the book from rendering; a failed setItemSync at pages.tsx:102 prevents Look from reaching p.press, despite a healthy story save. Expo's storage propagates real SQLite errors, verified in memory. Catch optional hint-storage failures and fall back to session memory.
```

## Fix round 1 (deda151; merge of main 94a0405): refusal line asserted; hint storage falls back to session memory; PM rulings (auto-approved under owner overnight authority, paraphrased): room-name heading after a successful move, "you are not holding it", "No one is here to answer."; note 18 carried as a footer-map bug. Sol re-check, verbatim

APPROVE

```text
none
```
