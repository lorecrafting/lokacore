# Owner decision: ADR-074 TypeScript-first rules — 2026-09-24

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's chat. No
checker can verify these quotes against the chat.

1. **The question that started it** (after Gate R3 planning):
   > I wonder if things would be a lot simpler if those single player storylines only used
   > the typescript engine, and then online used only the elixir server engine and there is
   > no cross in between them.  So like the player plays through all the singleplayer
   > stories and then after a while he can transition into the online server, so we dont
   > have to do two way checks of parity, or if we do its just to make the game mechanics
   > same but not critical.  Or is it like that already right now?

   After the PM's explanation:
   > yes draft the proposal after the gate closes
2. **The decision.** The PM asked "Which is it: accept or reject?" and summarized
   [proposed ADR-074](adr-074-ts-first-proposal.md): if you are sure stories will go
   online, reject; if you are genuinely unsure, accept. The owner answered:
   > accept, go with the typescript first approach

   Result: ADR-074 is accepted; spec amendments per its crosswalk land in a separate
   reviewed PR.
