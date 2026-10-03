# Owner decision: design seam for puppeting — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

The owner asked whether Loka will support Evennia-style puppeting (a player controlling an
NPC's body), how hard it is, and whether to design for it now.

What the PM proposed (summary): do not build puppeting now (the Lantern does not need it).
Commands already carry `actor_id` and the kernel keeps `world.character` apart from
`world.body`; the single-controller assumption sits at the admission boundary, the
`loka play` host, and (corrected after review) the shared `event()` helper and the rules'
use of `world.body`. Add one contract lesson now so no rule hard-codes the player (rules read
the actor from the command, never from `world.character`), and list puppeting on the
roadmap as a later capability: a control-permission policy at the authority, body-versus-
player state scope, pausing the NPC's behaviors through intent arbitration (21 §10),
a GameView from the puppeted body's perception, and displayed identity online.

Owner's words:

> yes please
