# Owner playtest direction: scrolling NPC dialogue and Contents — 2026-10-03

Owner wording, verbatim:

> Also i need some feedback about the character sheet having the other optiosn like journal, carrying and settings below everyting, looks kinda weird.  What would be a better 'menu system? just talking for now no implementation.  Should have these sections.  Character, Equipment & Inventory, Map, Journal, Settings.  For now.  ANything else you can think of?

> no i want the entrypoint to be clicking on the status.  no "menu" button

> We wait to queue that up for the next polish round

Latest owner direction, verbatim; it authorizes this round now:

> Okay when talking to bram, the expected behaviour is to land inside of the npc detail view and being able to talk to him, but everytime we take an action in brams detail view it flips the page and changes the action, it should be a dialogue/action log that scrolls, inside of the npc detail view, please put that in polish notes for next round.  Actually work on that now, and the contents thing now, and then i'll see the next iteration

Additional owner wording, verbatim:

> also the dialogue choice actions should be anchored to the bottom of the scrolling event/dialogue log, and instead of the bottombar back to game world for npc detail have a 'leave' option.  In the future there will be other options like attack, apply skill etc or whatever

Further owner wording, verbatim:

> Also when i click into the brass lantern it shows an item detail view.  It should have two options "take" and "leave" i see no "leave".  And when i press "take" it should go back to the game world and spit out in the room event log "You pick up a brass lantern".  So picking up items should echo in the room event log. Is tthat an engine or mechanic thing?

Latest additional owner wording, verbatim:

> And now when i walk around it has "You can't do that: unsupported capability:" in every room i traverse to.  That should not show, what is that bug?

> The room shoudln't echo "You leave the question for now." So when leaving dialogue, no echo in the room, unless quest things are triggered

> So all these notes of ui polish should we gather it somewhere? Because there are sort of like UI specs, in case we want to rebuild it some other time at least we have the specs

Owner navigation requirement, verbatim:

> Also how will LLMS know about where the UI spec is? Can you make sure its traversible? Root is agents.md right? And there should be an index somewhere? idk if its in agents.md or somewhere else

Owner room-log confirmation, verbatim:

> yes each rooms even tlog should clear when going to a new room

Owner inventory-action placement, verbatim:

> i like your recommendation of exposing in its item detail view while its in the players inventory

## PM implementation interpretation

- Keep the NPC detail route and a stable detail screen during its ordinary Talk/action/choice results. Append meaningful dialogue/action output to a scrolling log inside that detail; do not perform the book-page flip for each ordinary NPC action. Current offered choices/actions stay anchored at the bottom of the NPC detail; the log scrolls above them. Replace the ordinary NPC bottom-bar Back to World return with **Leave**, a presentation-only return to World that preserves a pending saved choice. Do not add an engine leave verb, movement, or speculative Attack/skill buttons. Item details also use Leave; other section detail pages retain Back to World. A real modal scene or queued chapter still takes precedence under the existing rules.
- Tapping the existing status/resources entry opens a Contents page containing Character, Equipment & Inventory, Map, Journal, Settings. No separate Menu button or extra row of world-pane links. The room position target remains separate and room-only.
- Reuse the existing five section views; Equipment & Inventory presents the existing held/worn data. Tapping a carried item opens its detail with Drop and any other currently offered item actions, plus Leave. Use/Equip appear only when genuinely offered; no new hold-and-slide interaction or placeholder actions. Remove unrelated Journal/Carrying/Settings links from the Character sheet. Preserve accurate World destinations (Leave on NPC/item details, Back to World on section details) and current offered-action freshness/safety.
- An item detail offers its current legal actions plus **Leave**. For the available brass lantern this is Take and Leave. After confirmed successful Take, return to World and append a descriptive pickup line using the real projected item name (for this sampler, “You pick up a brass lantern.”) instead of the generic presenter fallback “Taken.” Preserve authored narration when supplied. Pending, rejected, failed or stale attempts must not be announced as successful; retry must not duplicate the pickup. Under PM adoption of the accepted inventory-action recommendation, confirmed successful Drop likewise returns to World and appends a projected-name drop event (“You drop a brass lantern.”), with the same pending/refused/stale/fault/retry honesty. This symmetry is a PM implementation choice, not extra owner wording. Other item actions retain their established detail behavior unless their item becomes unavailable. This supersedes item-page retention for successful Take and Drop; no mechanic or save change.
- Routine dialogue exit must not append a generic exit sentence to the World log. Leave is presentation navigation; if an offered dialogue Close is used, keep meaningful authored/quest consequences but omit generic `choice_closed` World narration structurally, not by English-text filtering.
- Gather the book UI behavior in a dedicated canonical spec, directly linked from AGENTS.md and the existing docs/system/README.md index, with an architecture link. The spec links its governing owner decisions and evidence/review index so readers can traverse root → system index → UI behavior → decision/proof. Original feedback remains in these decision records; reviews/PRs record implementation and verification. Keep future ideas distinct and avoid duplicating the spec across docs. The owner-reported unsupported-capability message was inspected read-only in the current exact9f18 preview: one malformed one-target Give was rejected; later movements were accepted and the retained error followed the room log. Fix the incomplete presenter Give control, preserving engine validation and meaningful errors. A second inspected presenter regression removed the room-change log reset: restore the World log scope on an actual committed change of place, before appending meaningful new movement consequences. Do not clear on a refused/stale/pending attempt or routine rerender/detail navigation; active save errors remain visible. NPC history remains independently session-bounded. The latest owner confirmation explicitly approves clearing each room event log on entering a new room; the committed-place-change boundary and failed/pending safety remain PM implementation details. Touch recipient selection is deferred until a real gift interaction requires it; do not expose incomplete Give meanwhile. This is inspected trace/source evidence and a bounded PM implementation disposition, not additional owner wording.
- NPC history is bounded presenter-session state, not a new saved transcript or story mechanic. Preserve pending-choice reopen/relaunch and retry behavior; use authored/projected text, no invented speaker prose. Host-neutral unclassified restored narration remains the previously declared bounded World fallback.

These are presentation-only changes. No engine mechanics, kernel, authority/store, protocol, content pin, native plugin, dependencies or save format changes. Amend [Book presenter](../system/architecture.md#book-presenter) before code. This round follows PR #143; it does not pass Gate C1 or start further mechanics.

PM review choice under existing owner delegation: fresh independent Codex primary and separate Sol while Claude quota is unavailable; normal checks and actual isolated Release interaction required. This is a PM execution choice, not an owner model quote. Owner tests the updated preview and supplies the next feedback batch.
