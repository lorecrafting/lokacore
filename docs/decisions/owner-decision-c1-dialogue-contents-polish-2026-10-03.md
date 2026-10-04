# Owner playtest direction: scrolling NPC dialogue and Contents — 2026-10-03

Owner wording, verbatim:

> Also i need some feedback about the character sheet having the other optiosn like journal, carrying and settings below everyting, looks kinda weird.  What would be a better 'menu system? just talking for now no implementation.  Should have these sections.  Character, Equipment & Inventory, Map, Journal, Settings.  For now.  ANything else you can think of?

> no i want the entrypoint to be clicking on the status.  no "menu" button

> We wait to queue that up for the next polish round

Latest owner direction, verbatim; it authorizes this round now:

> Okay when talking to bram, the expected behaviour is to land inside of the npc detail view and being able to talk to him, but everytime we take an action in brams detail view it flips the page and changes the action, it should be a dialogue/action log that scrolls, inside of the npc detail view, please put that in polish notes for next round.  Actually work on that now, and the contents thing now, and then i'll see the next iteration

Additional owner wording, verbatim:

> also the dialogue choice actions should be anchored to the bottom of the scrolling event/dialogue log, and instead of the bottombar back to game world for npc detail have a 'leave' option.  In the future there will be other options like attack, apply skill etc or whatever

## PM implementation interpretation

- Keep the NPC detail route and a stable detail screen during its ordinary Talk/action/choice results. Append meaningful dialogue/action output to a scrolling log inside that detail; do not perform the book-page flip for each ordinary NPC action. Current offered choices/actions stay anchored at the bottom of the NPC detail; the log scrolls above them. Replace the ordinary NPC bottom-bar Back to World return with **Leave**, a presentation-only return to World that preserves a pending saved choice. Do not add an engine leave verb, movement, or speculative Attack/skill buttons. Other detail pages retain Back to World. A real modal scene or queued chapter still takes precedence under the existing rules.
- Tapping the existing status/resources entry opens a Contents page containing Character, Equipment & Inventory, Map, Journal, Settings. No separate Menu button or extra row of world-pane links. The room position target remains separate and room-only.
- Reuse the existing five section views; Equipment & Inventory presents the existing held/worn data. Remove unrelated Journal/Carrying/Settings links from the Character sheet. Preserve accurate World destinations (Leave on NPC details, Back to World on other details) and current offered-action freshness/safety.
- NPC history is bounded presenter-session state, not a new saved transcript or story mechanic. Preserve pending-choice reopen/relaunch and retry behavior; use authored/projected text, no invented speaker prose. Host-neutral unclassified restored narration remains the previously declared bounded World fallback.

These are presentation-only changes. No engine mechanics, kernel, authority/store, protocol, content pin, native plugin, dependencies or save format changes. Amend [Book presenter](../system/architecture.md#book-presenter) before code. This round follows PR #143; it does not pass Gate C1 or start further mechanics.

PM review choice under existing owner delegation: fresh independent Codex primary and separate Sol while Claude quota is unavailable; normal checks and actual isolated Release interaction required. This is a PM execution choice, not an owner model quote. Owner tests the updated preview and supplies the next feedback batch.
