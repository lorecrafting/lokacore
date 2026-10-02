# UX notes: the Lantern by touch, 2026-10-02 (R6P P6b)

These notes list the problems found. Nothing here is fixed in this PR.

**Where the notes come from.** The walk ran on the iOS Simulator (a dedicated iPhone 16e
simulator, iOS 27.0, a Release Hermes build) and was driven by agent-device. The build was the
UI-timing build (`dev-ui.diff`). That build is the real book UI on the PR base, except that the
save is `p6-ui.db` and the touch-timing log is added. On the iPhone 11, agent-device stopped at
the system prompt "Enter iPhone Passcode for XCTest — Enable UI Automation". The phone touch walk
is therefore an owner item (README, rows 13 and 14). Screen sizes differ from the iPhone 11
(414 × 896 pt). Layout notes (5, 9, 18) need a check on the phone.

**What was walked.** The carry ending, the locked gates (west from the landing, east from the
shelter), a kill and reopen with the choice open, Start over, the leave path, a wait to 19:00 with
the choice open (Bram leaves, the answers are refused), Close, the leave ending at the green, a
kill and reopen after the ending, and look and scan.

**Order.** The notes are in order of how much they confuse a first-time player. The top 5 are
1-5.

| # | Screen | What happens | Why it confuses | Screenshot | Suggested fix |
|---|---|---|---|---|---|
| 1 | Room page log | After each action the log shows the engine's outcome word: `activated`, `moved`, `taken`, `choice_opened`, `choice_closed`, `waited`, `scanned`, `looked`. | These are code words, not story text. `choice_opened` and `choice_closed` read as debug output. | [02](ux/02-after-offer.jpg), [05](ux/05-green.jpg), [08](ux/08-took.jpg), [12](ux/12-choice.jpg), [24](ux/24-after-close.jpg), [29](ux/29-scan-look.jpg) | Give each outcome a cartridge text key (for example "You set off north."). When there is no text, show only the `> action` line. |
| 2 | Room page, choice open, after Bram leaves or the player walks away | Bram's question stays on the page. Its answers are grey: "Carry it along the bank: not present", "Leave it with the search party: not present". The speaker line is gone. | "not present" is engine wording. The player cannot tell who is not present, or whether the story is now blocked. The answers cannot be tapped, so the refusal reason (`invalid_state`) is never shown. | [13](ux/13-choice-scrolled.jpg), [23](ux/23-after-wait-19.jpg) | When the speaker leaves, close the choice or show one line ("Bram is not here. Find him to answer."). Show a refused answer's reason in plain words. |
| 3 | Room page at 19:00 | "Wait until 19:00" moves Bram from the landing to the green. Nothing in the log says so; the log says only `waited`. Walking does not move the clock (it stays 06:00), so nothing hints that time matters. | Bram vanishes without a word. The player must search the map to find him. | [23](ux/23-after-wait-19.jpg), [26](ux/26-green-at-19.jpg) | Narrate the departure ("Bram walks up to the green to meet the search party."). Give the journal an objective that names the deadline or the meeting place. |
| 4 | Room page after an ending | After "Carry it along the bank" or "Leave it with the search party", the game goes on with the same actions. Nothing says the story is over. | No closure. The player cannot tell whether the proof story is finished. | [16](ux/16-carry-ending.jpg), [27](ux/27-leave-ending.jpg) | Show an ending page ("The end of The Ferryman's Lantern") with the outcome and Start over. |
| 5 | Room page, scroll | An agent-device "scroll down" moved the character north (Ferry Landing to Village Green). A pan that starts in the text (y 380) scrolled without moving. | Unconfirmed cause: the scroll most likely started low on the screen, on the map joystick. A thumb that starts a scroll near the footer could walk the character by accident. | [12](ux/12-choice.jpg) → [13](ux/13-choice-scrolled.jpg), [14](ux/14-scroll-test.jpg) | Check on the phone by touch. If it is real, add a dead zone above the joystick or require a short hold before a drag walks. |
| 6 | Footer, drag toward a locked gate | A small caps label "WEST: EXIT LOCKED" appears above the joystick and goes away. The log gets nothing. The room text invites the player ("An old gate stands in the west fence"). | The feedback is tiny and goes away. There is no why and no way forward (ROADMAP: by touch the old gate never opens, R6P P3 Q-3). | [04](ux/04-drag-west.jpg) | Write the refusal into the log as story text ("The old gate is locked."). |
| 7 | Lantern Shelter text | "An old gate in the east fence opens onto the landing." Dragging east is refused: "EAST: EXIT LOCKED". | The text says the gate opens. The game says it is locked. | [09](ux/09-shelter-east-gate.jpg) | Cartridge text: "An old gate in the east fence leads back to the landing; it is locked." |
| 8 | Ferry Landing text | After the player takes the lantern, the landing still says "a lantern swings once between the reeds and goes dark". | It describes a lantern that the player now carries. | [10](ux/10-back-landing.jpg) | A description variant once the lantern is taken (the landing already changes after the ending, [16](ux/16-carry-ending.jpg)). |
| 9 | Room page with a choice | After "Talk", the answers sit below the fold over the footer. The only scroll hint is a small dot. | The player may not see that a choice is waiting. | [12](ux/12-choice.jpg) | Scroll the log to the newest entry, or show the answers in a sheet above the footer. |
| 10 | Thing and NPC pages | The action labels are "Talk Bram the ferryman" (no "to"), "take a brass lantern" (lower case) and "Offer to fetch Bram's lantern" / "Wait" (capitals). "scan" is lower case too. | The casing and grammar are mixed, so the labels read as generated. | [01](ux/01-start.jpg), [07](ux/07-lantern-page.jpg), [11](ux/11-bram-page.jpg) | Use one casing rule and "Talk to Bram". |
| 11 | Journal | Only the quest name and a state word: "active", "resolved". No objective, no outcome. | The player cannot see what to do or which ending they chose. | [17](ux/17-journal-after-carry.jpg), [25](ux/25-journal-after-19.jpg) | Show the current objective and, once resolved, the outcome (carried or left). |
| 12 | Map page | The page is a text list: "Ferry Landing", "North" (accessibility label "Go north"), "West: exit locked", then "scan". | The visible label and the spoken label differ. "scan" on a map page reads as a stray item. | [03](ux/03-map.jpg) | Label the button "Go north". Move scan off the Map page, or say what it does. |
| 13 | Room page: look and scan | Tapping the title (look) or "scan" adds `> look / looked` or `> scan / scanned` with no content. The hint "Tap the title to look" then goes away. | Nothing visible happens, so the player cannot learn what look or scan are for. | [29](ux/29-scan-look.jpg) | Show the room or scan result in the log, or drop the log line for a read. |
| 14 | Thing page | Title "a brass lantern" (lower case, with the article). No description, only "take a brass lantern". | It reads as a debug page. | [07](ux/07-lantern-page.jpg) | Use a title-case name and a description line. |
| 15 | Wait page | Thirteen buttons, "Wait until 07:00" to "Wait until 19:00". 19:00 needs a scroll. | A long list with no hint which hour matters. | [22](ux/22-wait-page.jpg) | Fewer options ("Wait an hour", "Wait until evening"), or mark the hours when something happens. |
| 16 | Map hint | "Hold the map and drag toward a path to walk; tap it to open the map" with "Got it" comes back after every relaunch. | A dismissed hint returns. | [15](ux/15-reopen-mid-choice.jpg), [28](ux/28-reopen-after-leave.jpg) | Save the dismissal. |
| 17 | Room log after a place change | The log restarts when the place changes, so "> Talk Bram the ferryman" goes away while Bram's question stays. | The question floats without the action that asked it. | [14](ux/14-scroll-test.jpg) | Keep the open choice's prompt line with its speaker, or keep the log until the choice closes. |
| 18 | Footer | A small black dot (the scroll indicator) sits over "SETTINGS". | A visual glitch. | [24](ux/24-after-close.jpg), [27](ux/27-leave-ending.jpg) | Inset the scroll indicator above the footer. |

What worked: Start over asked first ("Start over? Your saved game will be lost.") and opened a
fresh book ([20](ux/20-start-over-confirm.jpg), [21](ux/21-after-start-over.jpg)). A kill with the
choice open reopened on the same question ([15](ux/15-reopen-mid-choice.jpg)). A kill after the
ending reopened with the ending's narration ([28](ux/28-reopen-after-leave.jpg), 06 §43). Both
endings were reachable by touch.
