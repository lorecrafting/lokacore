# Owner decision: the engine owns mechanics, cartridges own numbers — 2026-10-02

Relayed by the PM (Claude Code), **(paraphrased)**: the wording is smoothed, not quoted. No checker
can verify it against the chat.

While settling the Lantern's starting stats, the owner asked whether regeneration rates and the move
cost could be tuned per cartridge. Today a cartridge can override the pools' bounds, start values and
`gain` (`resources.json`), but the engine charges a hard-coded 1 mv per move and fixes the hourly
regen tick. The owner decided:

- **Rule.** The engine owns mechanics (paying a cost, refusing what cannot be paid, regenerating as
  time passes, positions); cartridges own the numbers and world settings (costs, durations, rates,
  odds, maximums, default stats, calendar lengths, thresholds). No game-world parameter or cartridge
  setting is hard-coded in the engine, and presenters do not bake world values either.
- **Inventory.** The PM ran an exhaustive audit; its result is [World parameters](../world-parameters.md):
  22 engine rows (W1–W22) and 9 presenter rows (P1–P9), each with its target content field and
  priority (before chapter one, with the time-model slice, or later). Future slices move the rows
  out and mark them DONE there.
- **Direction for the time model** (same conversation): time recovers MV and resting recovers it
  faster; the engine owns those mechanics, while the cartridge declares the move cost (default, per
  terrain or exit), the regen amount per pool and the multiplier per position.

Effect: [AGENTS.md](../../AGENTS.md) architecture rule; [ROADMAP](../ROADMAP.md) R7/R8 for chapter one row.
