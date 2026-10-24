# Owner decision: each room speaks from its own point of view — 2026-10-24

Written 2026-10-24 in Claude Code by anthropic/claude-opus-5-5 (designer).

## Decision

Owner (2026-10-24, quoted in full): "Yes i like that rule each room speaks from teh rooms point of
view, please codify that"

Accepting the PM proposal (paraphrased): each room's event log speaks from that room's point of view.

- Plain move: the room left logs nothing new for the player; others there see "<Name> leaves
  north." The room reached opens with "You arrive from the south." (others: "<Name> arrives from
  the south.").
- The direction is the destination's exit that leads back to the origin (its reciprocal face, as
  in `cartridge_barriers.ts`), never a blind opposite flip. No way back reads "You arrive."; up and
  down read "from below" and "from above".
- Flight: "You flee north." stays the fight's last line in the fight room's log; the room reached
  opens with "You run in from the south." (same direction rules; "You run in." with no way back).
- Replaces the "You go north." opening line and the rule that a flight's closing lines open the
  arrival room's log.
- Spec: [Book UI, Line placement](../system/book-ui.md#line-placement), [wording pattern](../design/interaction-patterns.md#each-room-speaks-from-its-own-point-of-view).
