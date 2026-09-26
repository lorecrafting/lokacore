# Owner decision: default HP, MA and MV pools — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

Owner's words:

> please instiute a default HP Mana and MV system, HP MA MV, just like LEgendMUD

The PM then asked three multiple-choice questions (summaries); the owner's answers:

- Should walking between rooms cost MV from S6b?
  > Yes, 1 MV per room now (Recommended)

  (The option read: moving costs 1 MV; at 0 MV the move is refused; per-terrain costs from
  00 stay R8; existing cartridges keep their behaviour and transcripts.)
- Should HP/MA/MV regenerate over time in S6b, a set amount per game hour, faster resting?
  > Yes, in S6b (Recommended)

  (Derived from the clock, not ticked; resting doubles it once positions exist.)
- Default maximums for a new character?
  > The mockup's 300/120/200 (Recommended)

  (hp 300, ma 120, mv 200, as on the chosen [room view](../design/room-view/README.md)
  status line; a cartridge can override them.)

The PM then reported what it could and could not confirm about LegendMUD and DikuMUD
numbers; the owner answered:

> yeah lets make it closer to DikuMUD, and if we can find out, LEgendMUD, since i want to
> base this off LegendMUD and therefore Diku

PM application (superseding the 300/120/200 answer above). LegendMUD's own numbers are not
published; these come from the original DikuMUD source (`sneezymud/dikumud`: `act.wizard.c`
`do_start`, `limits.c`, `constants.c` `movement_loss`, `act.movement.c`), and a LegendMUD
figure replaces one when the owner confirms it in-game:

- Starting maximums: HP 20 (a chosen value at the caster end of Diku's level-1 range of
  about 18-30), MA 100, MV 82. Diku: base HP 10 plus a level-1 class roll (3-15)
  and constitution and age bonuses; mana 100; moves 82 at the starting age of 17.
- Regeneration per game hour: HP 5, MA 4, MV 18 (Diku's gains at age 17); once positions
  exist, sleeping, resting and sitting add Diku's position bonuses.
- Moving costs 1 MV per room (Diku's indoor cost) until terrain arrives; from R8 a move costs
  the average of the two rooms' terrain costs, rounded down (Diku: inside 1, city 2, field 2, forest 3,
  hills 4, mountains 6, swimming 4). At too little MV: "You are too exhausted."

Effect: R5 S6b (resources) builds the three default pools, the 1 MV move cost and
regeneration; document 00's "HP, stamina, spirit" becomes HP/MA/MV (amended in 00 §4).
