# Review: UI batch U1-U6, save-error padding, footer dot, carries

- PR: #123 (branch `ui-batch`), commit reviewed `575636b`
- Brief: `loka-astra/r78/ui-batch-brief.md` (owner answers at its end are final)
- Stance: short (UI slice), plus one mutation round on the menu and joystick side logic
- Reviewer: Opus, independent
- **Verdict: CHANGES REQUIRED** (one blocker, B-1)

## Must be true (written from the brief before reading the diff)

1. U1: no "Tap the title to look" hint and no `hint.looked` store; the title tap still looks; no Look button.
2. U2: no Scan button on the room or map page; the engine `scan` verb stays.
3. U3: the status line keeps the time glyph and the stats button (its a11y label); the Character page
   reaches Journal, Carrying and Settings through `Sheet`/`Tap`; no new modal.
4. U4: no `>` echo in the log.
5. U5: an NPC tap opens an in-page menu holding the NPC's actions and the pending choice. It shows while
   `view.choice` is set or an NPC is tapped (a restored choice reopens it). The footer stays usable, and
   walking away keeps the choice pending, with the answers showing `not_present`. Dismissing sends nothing;
   only Close sends `close_choice`. Dialogue shows in the menu only; the room log gets only the result
   line. Items keep `ThingPage`. No offer-specific code.
6. U6: the label goes opposite the drag (pure function plus one table test); up and down stay hidden unless
   the exit exists.
7. Save error: the same side padding as the room page; the button stays as it is.
8. O-1: the "you" dot no longer drifts.
9. Carries: the renderer lint flags every `require()` and `import()`, with planted cases including
   `require('x' as const)`; a test kills the `!!f.newGame` mutant (NOTADB shows Start over).
10. No engine, authority, protocol or cartridge change; no source file over 300 lines.

## Checks run (worktree at `575636b`)

- `mobile/app` `npm test`: 149 pass, 1 skipped. `npx tsc --noEmit`: clean. `ast-grep test`, `ast-grep scan --error`
  and `bin/lint_red_controls.sh`: green. Largest source file `Book.tsx`, 232 lines.
- CI on `575636b`: bundle, elixir, lint and typescript all pass.
- Planted renderer file `book/zz.tsx` with `require('./paper.ts')` and `import('./model.ts')`: both flagged.
- Mutants, all red:
  - M1: `menuOpen` ignores `dismissed`;
  - M2: `sideOf` with east and west swapped;
  - M3: a kept note placed `below`;
  - M4: `startOver: !!f.newGame` (smoke NOTADB test);
  - M5: `menuOpen` with `!!tapped` (an NPC who left).
- Diff scope: `mobile/app`, one authority test file, lint, docs. No kernel, protocol or cartridge file.
  `presenter.ts` drops the echo and the look `pop`. A look has no narration and no `OUTCOME` entry, so a
  look still adds no line. A talk has none either, so the log gets only the choose and close results.

## Reviewer Release walk

The build came from the developer's worktree at `575636b` (clean status), built `xcodebuild -configuration Release` onto
a Simulator I created (`rev-uibatch`, iPhone 11, iOS 27) and deleted afterwards. `main.jsbundle` starts with the Hermes
magic `c61fbc03`. I did not use polish-414. The walk used agent-device.

- No hint and no Scan on the first screen. The status line has the glyph and the Character button only.
- Tap Bram, then Talk: the menu shows the prompt, the offer, Close and Done. Done hides the menu, and tapping Bram
  again shows the same choice (pending, nothing sent). Close: "You leave the question for now." shows in the
  menu and in the log. Talk, then the offer: the result line shows in the menu and in the log, with no dialogue in the log.
- A drag west (the gate is locked): "WEST · LOCKED" shows right of the map mid-drag; after release the kept
  note "WEST: LOCKED" shows above.
- Character leads to Journal ("Bram's lantern, active"), Carrying and Settings (Start over), each with Back.
- Map, then Back: the dot sits at the junction (tip already dismissed; the developer's shot 03 covers the fresh-tip case).
- NOTADB: the save file was overwritten with random bytes and the app relaunched. It shows "The save is damaged..."
  and `(save_corrupt)` with a 24 pt side margin, and Start over is centred.
- **Failed:** Talk, Done, tap Bram again, walk north: no menu in Village Green (B-1). Talk, Done, walk north:
  no menu either (F-1).

Walk shots in `docs/reviews/ui-batch-walk/` were checked: 05, 06, 10 and 14 match the items. Shot 06: the north label
is about 58 pt above the bottom edge, which clears the home indicator.

## Findings

**B-1 (blocker) `mobile/app/book/Menu.tsx:53`.** `tap` sets `tapped` but never clears `dismissed`.
- Scenario: Talk to Bram, press Done, tap Bram again (the menu shows the choice), walk north.
- Result: `menuOpen` is false. Bram is not here, and `continuation_id === dismissed`. The pending choice and its
  `not_present` answers vanish while still pending. Reproduced on the Release Simulator.
- This breaks the brief's U5 visibility rule and its walk row "Walk north: the answers show `not_present`". The same
  walk works only if the player never pressed Done on this choice.
- `model.test.ts` stays green because the defect is in the hook, not in `menuOpen`.
- Suggested fix: `setDismissed(undefined)` in `tap`.

**F-1 (should-fix) `docs/lessons/mobile.md:59`.**
- The doc says: "`press 'label="Done"'` hides the menu (a pending choice shows it again in the next room)".
- On the Simulator: Talk, Done, walk north showed no menu. The code keeps a dismissed `continuation_id` hidden in
  every room until the NPC is tapped.
- This file is the walk script, so the next walker expects the wrong result. B-1's fix does not make the line true.
- Correct the text, or make the code match: clear `dismissed` on a room change. The developer picks.

**N-1 (nit) `lint/rules/mobile-renderer-imports.yml:19`.**
- `fonts/[\w.-]+` is still in the renderer allowlist, but the fonts now load in `App.tsx`, which is outside `files:`.
- So a static `import f from './fonts/x.ttf'` in `book/` still passes. Drop the entry.

## Known gaps (developer-declared): rulings

- **An NPC who leaves and returns reopens its menu** (`tapped` persists): **not blocking**. It is cosmetic,
  Done recovers it, and nothing is sent. It lives in the same hook as B-1; fixing it is optional.
- **The menu does not scroll** (`Menu.tsx:71`, ScrollView blurred text on iOS 27): **not blocking** for this slice.
  The Lantern's longest choice fits on an iPhone 11 (shots 05, 16 and 19).
- Open item: with longer content, Close and Done fall off-screen. A pending, undismissed choice would then keep the
  menu over every room, and nothing could hide it except returning. Carry this to the next content slice.

## Open

- After #120 merges: merge `origin/main` and check that U5 shows Bram's offer choice (the PR's own open item).
- Codex Sol review: appended by the PM.
