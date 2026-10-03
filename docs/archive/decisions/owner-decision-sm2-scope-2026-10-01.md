# Owner decision: SM2 scope — 2026-10-01

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

The PM put three points to the owner before building SM2; the owner chose the recommended answer
on each:

- **What SM2 is.** The owner's book-style UI ([room view](../../design/room-view/README.md)) on the
  iPhone over the existing smoke controller and the bundled items cartridge, with all six panes
  (room, map, character, journal, carrying, settings). A prototype to tweak, not the R6P gate. Its
  departures from [00 §4.10](../spec/00-first-cartridge-design.md#410-touch-interface) (map joystick,
  full pages, status line) stay documented departures, with no spec amendment for now.
- **Real data only.** Panes show only what GameView projects today; resources, position, map
  coordinates and quest objectives (room-view README, GameView needs 1–3, 5, 7) wait for a separate
  core slice that adds them to GameView.
- **Feel.** Bundled fonts (IM Fell English, EB Garamond), the paper palette and a simple page-turn
  animation. The shader page curl, sounds and the effects lab wait for a later polish slice.

Effect: [ROADMAP SM2](../../ROADMAP.md) is three slices (SM2a, SM2b, SM2c).
