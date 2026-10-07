# D11 provisional browser and faction proof — 2026-10-06

This check used the local D11 integration over published D7 main `9efebfd5`, with a
provisional chapter `0.0.38` pin. It is not final C5-based release or review proof.
The browser runner used its fresh profile and isolated save; no owner save or device
was used. Raw command output was not retained.

- `mise exec -- npm run test:e2e -- tests/character_choice.e2e.ts` from
  `mobile/app`: one passed. Four separate fresh selections survived browser
  SQLite reload. Fen-born entered Well Bottom without a Swim lesson; road-born
  received and used Peg's 2p Haggle quote without a lesson; hill-folk saw the
  full unlit Mill Loft description.
- Red controls: suppressing Fen Swim removed the dive action; suppressing Road
  Haggle failed the 2p quote assertion; disabling dark sight failed the loft
  description assertion. Each browser run failed at its intended consumer, and
  the source was restored before the final passing run.
- `mise exec -- node --test mobile/authority/local-story/character_choice.test.ts`:
  four passed, including a real SQLite creation receipt and cold reopen for
  fey-touched's `priory_fen_axis = -2`. Suppressing that faction assignment made
  the focused test fail; the source was restored.

Current GameView and Book do not project the character's current faction value.
The fey starting value therefore has no distinguishing browser assertion. The
real SQLite receipt and reopen check owns that boundary; the browser test covers
fey selection, SPI display and reload. Final D11 publication must re-pin over C5,
repeat the checks on that exact head, and obtain independent review.
