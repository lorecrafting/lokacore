# Blind playtest sweep A: traps + hub regression (2026-10-21, Fable, browser-use, 390x844)

Worktree detached at origin/main 531b4c1c5, Book on port 19116, browser sweepA:9311, fresh save.
Screenshots 01-23; archived: 10, 11, 21 as `shots/A-<n>-*.png`. Route: inn sign > Drill Yard > Sappers' Stair
(traps, all rooms) > Fell Road (gate, top, Wat's hut, Orla's still room, fold) > the Holding
(carpenter, farm, glade, hut, pond, kitchen) > Tidewater (steps, pools, both caves, cliff, drop) >
Low Wardle (green, Reeve, Nell, toll gate) > Drill Yard (Aldous, Gil's gate, raider, death, corpse).
Not reached (budget): the croft (hens, pool, sowing), the cook's stew, the Reeve's letter delivery,
the tallies/cheat branches, Tam at eleven, the church lectern, the moot hall, the boar, the pit
pack, the tilt yard, the bounty, levelling, the chief kill, exposure (the sky stayed clear).

## Per area: what it wanted vs what I found

**Traps (Sappers' Stair).** Wanted: search, disarm (clumsy hand), trigger, poison, bitters cure,
lever order from the note, dial from the slate, goblins run at "begone", cellar sandbox. Found:
search finds the plate; the first disarm set it off (timer reset to 120m, no "it bites" line);
the second wedged it. Walking north triggered it (good line); walking back south re-poisoned me
silently. Both doors DO open, but only through the Map page: A,B,C then "Open the lever door
(north)" appears there; wheels 3,1,2 then "Open the dial door (east)". The World page never
says a pull was right or wrong ("The lever clanks down and springs back." for every pull) and
never offers Open, so I tried all six orders and gave up before the brief told me. The dial's
digits cannot be read anywhere. "Begone": both goblins "cower, eyeing the way out" and stay (den
and cellar, three shouts); the sign says they run. The cellar's free bitters cured the poison;
the cellar plate sprang on entry with no line at all.

**Fell Road.** Wanted: exposure, hunger/thirst, draught + quern, lute + knucklebones, the fold.
Found: hunger and thirst on every crossing of Fell Top (24 h each, re-applied after the cure);
loaf and waterskin cure; draught gives "mighty 60m" and the shove works; the lute's "Play a
song" is a room verb (inspired 25m) and then the bones are caught; the quern has no verb at all,
mighty or not ("Take: too heavy to carry. Nothing to do here."). Exposure untested (clear sky).

**The Holding.** Wanted: learn trades, raise a hut from own timber, furnish, farm, fish, cook,
farmer remembers a gift. Found: whittle twice unlocks carving; carpentry after woodcutting;
chop, saw (2 logs = 1 timber), "Raise a timbered hut", rug warms the boards (variant drawn,
good); the apple gift ("She nods to you") and the pelt-for-knife trade work. Blockers: a load cap
of about 8 light items refuses a pelt and a dead rat with "Take: too heavy to carry" and HIDES
"Chop wood" until you drop things (no reason shown); the rod's "Cast the rod the pond" gave
"Nothing bites" once and then vanished; the cook needs two fish; the croft was not reached.

**Tidewater.** Wanted: tide gate, cliff + rope, cave shortcut after dark, moon door, changing
look-abouts, pools with every door open. Found: the gate opened at once ("Opened.") with no tide
anywhere on screen; "Search the cleft" after dark found the stair; the rope drop landed with no
line; the moon door closed under a dark moon (good variant). The pools' "every door open" still
shows "The moon door: closed". Look about: gulls, seal, seal (no third line).

**Low Wardle.** Wanted: a village that remembers; the Reeve's work; Warden; Tam at eleven. Found:
the Reeve's letter quest starts, the running head updates, the letter is takeable; Nell's shop
lists "Talk Nell, the baker" twice; the Warden offers Attack and Talk. Delivery untested.

**Drill Yard (combat).** Wanted: lesson + lent sword, "ware" carries to Gil, death loop. Found:
"Learn the blade" hands the sword (its item page says "Wear a training sword" for the wield
slot); shout "ware" printed nothing; Attack the raider opened Combat with no engage line; Gil
fought beside me ("Gil's spear finds your foe"); at 3 hp I fell, woke at the inn 10/10 with
Blade kept, "Your corpse is here." in the gate yard holding all nine items. Hunger read 0/10
after death (was 10/10 at start).

## GAMEPLAY findings

| # | Sev | Area | Finding and repro |
|---|-----|------|-------------------|
| A1 | high | traps | Lever/dial doors open only through the Map page's "Open the lever door (north)"; the World page gives no cue. Pull A,B,C: every pull logs "The lever clanks down and springs back." (same text for right and wrong), no door line, no Open verb on the World page. Only the Map lists "Open the lever door (north)". |
| A2 | high | holding | Load cap hides verbs and misnames the refusal. Hold axe, cask, bitters, lute, rug, 2 spoons, waterskin: a rabbit pelt and the dead rat read "Take: too heavy to carry"; "Chop wood" is absent in the glade. Drop five things: the pelt takes, "Chop wood" appears. No "too much carried" anywhere. |
| A3 | med | traps | "Shout begone and the goblins run": out of combat they only "cower, eyeing the way out" and stay (den, cellar, 3 shouts; the two lines print on one row). |
| A4 | med | traps | Dial wheels have no readout: "The wheel clicks round one notch." and nothing shows the digit; a player cannot set 3,1,2 from the slate without counting blind. |
| A5 | med | traps | Re-entry and the cellar plate poison you silently: south from Plate Passage over the sprung plate, and entering the cellar, reset the timer to 120m with no log line (first entry north has one). The failed disarm also resets the timer with only "The plate clicks under your fingers." |
| A6 | med | fell | Hunger and thirst (24 h) re-apply on every crossing of Fell Top, so Wat's one loaf and waterskin are undone on the walk back; the sign says only "the climb makes you hungry". |
| A7 | med | fell | The quern cannot be tried: no verb before or during "mighty"; its page reads "Take: too heavy to carry. Nothing to do here." The sign says "try the quern". |
| A8 | med | holding | Fishing dead-ends: the rod page's "Cast the rod the pond" gave "Nothing bites" (night, 子) and the verb then vanished with no reason; no second cast possible, so the cook's "two fish" cannot be reached. |
| A9 | med | tidewater | No tide on screen: the gate's "Open the tide gate (east)" worked at once with "Opened."; the status glyph shows only weather; the sign's "only at low tide" cannot be checked by a player. |
| A10 | med | tidewater | Tide Pools say "everything open" but the Map shows "West: closed / The moon door: closed". |
| A11 | med | holding | The dead rat (the sign's "not a dead rat" gift) cannot be taken when the load is full, and after dropping things I did not retest; the farmer's dislike path is unreachable on a full load. |
| A12 | low | combat | Shout "ware" in the Drill Yard logs nothing; Gil did fight beside me, so the effect is silent. |
| A13 | low | combat | Combat opens with no engage line: the page shows "the raider", condition lines, Look/Flee, empty log until the first round. |
| A14 | low | tidewater | The rope drop (Cliff Top > down with the rope) prints no line; "Go down" is offered without the rope too (untested whether it hurts). Look about: 2nd and 3rd visits both print the seal line; no "the shore knows you" line. |
| A15 | low | holding | Carpenter reasons: "Learn carpentry (2 pennies): not now" before woodcutting 2; "Learn whittling: not now" after learning it; the skill line still says "The carpenter teaches it free" once learned. |
| A16 | low | wardle | Nell's page lists "Talk Nell, the baker" twice; her row "a cob of bread: Buy 4p; Sell 1p (you are not holding it)" explains a sell state on a buy line. |
| A17 | low | combat | Training sword's slot action reads "Wear a training sword" (slot wield). Hunger 0/10 after death. |
| A18 | low | traps | The pinned note is an entity named "Read" ("Read, open"; page title "Read"); the bitters/waterskin/draught lines read "bitters · 1 doses", "water · 1 units". |

## UI/UX findings (390x844)

| # | Sev | Page type | Finding (design-system terms) | Rule | Shot |
|---|-----|-----------|-------------------------------|------|------|
| B1 | high | World page | CONFIRM U2 at 390: the log (action feedback) sits under the Word block; on any room with people the result line is below the fold after every tap (shove, song, chop, pull). In the den/cellar the last Shout chips are also under the fixed footer at the page's end: the scroll area has no bottom inset, so the last chip cannot scroll clear (chip box y 704-746 under the footer at 727). | Room page block order (BOOK-UI-COMPONENTS Room page); Page says nothing about a bottom inset: system silent | 13, 17 |
| B2 | high | Status icon row | CONFIRM U1: conditions are bare "−"/"+" discs; poisoned, hungry, thirsty, mighty, inspired are told apart only by hover/name. Four discs in a row (fold) are unreadable. | Status icon "glyph in type.label" with placeholders "until loka-x6t.63": system admits it | 05, 17 |
| B3 | med | Map page | CONFIRM U6, worse: the Map page repeats the whole World log at its top (18 lever lines, shot 11) and the Where list grows per NPC met with duplicates ("Ask where a goblin is" twice). Exits read as pairs ("North: closed" + "The lever door: closed"). The only door-opening control lives here (A1). | Minimap/Map rule says exits and Where; nothing about the log: system silent | 11 |
| B4 | med | Status line | mv 99/100 renders in the warning tone (orange) after any one-step move; resource bands fire at 99 %. | Status line "band colours per the status rule": the band threshold looks wrong | 05 |
| B5 | med | Word block | Two people with one shown name get two separate "Whisper to a goblin" rows (den, cellar, 4 chips each); the rule says they share one title. | Word bar: "Two present people with one shown name share that title" | 08 |
| B6 | med | NPC / item page | CONFIRM U8: "Talk the carpenter", "Talk Aldous", "Talk the Reeve"; "Cast the rod the pond"; pages that say "Nothing to do here." under a refused "Take: too heavy to carry." (quern, cot, pond, rat, pelt); a pond and the quern are entity lines with a Take refusal. | ActionCard unavailable form is "label: reason"; a Note empty state should not coexist with a refused line: system silent on precedence | 18 |
| B7 | med | Dialogue page | Two leave controls: a "Leave" choice card plus the "Leave the conversation" foot Control; "Leave the conversation" returns to the NPC page, then Leave again to the room. | Control catalogue lists both words; nothing says a dialogue shows both: system silent | 19 |
| B8 | low | Status icon | Durations in minutes only: "1440m remaining", "1428m". | Conditions details: "otherwise in whole minutes": the rule itself reads wrong above 2 h | 15 |
| B9 | low | Combat page | CONFIRM U4: no HP of either side in the body, no engage line, rounds read as near-identical lines ("You miss. The blow catches you." ×3). Closure "You fall." then Back to World works as specified. | Live combat response: as specified; system silent on HP | 21, 22 |
| B10 | low | Log line | Two events share one line ("The goblin cowers, eyeing the way out. The goblin cowers, eyeing the way out."); "Opened." bare; "Journal updated" shown in dialogue. | Log line: one Text per line | 09 |
| B11 | low | Character page | CONFIRM U9: "pennies 10 / 100", "ash 0 / 5", "xp 0 / 30" read as meters; the skill tree lists locked trades with reasons, good. "Blade — qualified; Aldous teaches it" stays after learning. | system silent | 07 |
| B12 | — | Page heading | DROP U7 at 390: no focus ring seen after pointer taps (shots 05-23). | Focus: ":focus-visible only" | — |
| B13 | — | Status line | U3 position cycle: CONFIRM (3 taps to sleep, 1 tap sleeping > standing). U5: not met (no shop bought). U10: no casts made. | | |

## What felt good
The trap sign teaches the whole district in one read; the hut chain (chop, saw, raise, rug warms
the boards) is a satisfying loop with the room text changing; "Gil's spear finds your foe" and
the death loop (inn, corpse holding everything, Blade kept, "Hob, asleep over the bar") all
land; the running head carries the Reeve's errand; the moon door under a "dark moon".

## Top 5
1. A1: put the door-opening cue on the World page (an Open verb line, or a "something shifts" line on the right pull) so the lever and dial puzzles can be solved without the Map page.
2. A2: say "you carry too much" instead of "too heavy to carry", and show a hidden verb as unavailable with that reason (Chop wood).
3. B1: move the log above the Word block or give the scroll area a footer inset; at 390 px every result line is off screen.
4. A3/A6/A7/A8: make the signs true: goblins run (or say "in a fight"), one hunger per climb, a quern verb, a second cast or a reason.
5. B2/B4: label the condition discs and fix the 99 % warning band on the status line.

## NEXT SWEEPER
Save state (sweepA, localhost): day 2 卯, inn-side; hp 10/10; corpse in the Gate Yard holds
axe, bitters (1 dose), cloak, farm knife, sealed letter, poultice, rod, rope, training sword.
Hut raised and rugged; lever and dial doors open; both plates disarmed; carving+carpentry learned.
Left: croft, cook, letter to Wat, boar/scar, pit pack, bounty, levelling, tilt yard, exposure.
