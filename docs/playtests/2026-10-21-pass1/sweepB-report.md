# Blind playtest sweep B (2026-10-21, Fable, browser-use, 390x844)

Fresh save on localhost:19116 (browser profile sweepB). Viewport verified 390 px (`innerWidth` 390).
Screenshots 01-30; archived: 16, 22, 27, 30 as `shots/B-<n>-*.png`. Route: inn signpost > Loft (errand, crypt, attic,
golem yard) > Undercroft (arrest, work-off, fence). Showcase docs read only after play.

## Per area: what it wanted vs what I found

**Magic (Loft).** Wanted: the errand gives the third word; the crypt reads "bring the light"; the bolt
half-burns the wight and lights the bier, the bucket quenches it; the golem minds rain plus spark, the
torch dries it; the attic is a lit sandbox for the same. Found: lux, the hush, the grimoire, the oiled
gate, the lit crypt and the two-bolt kill all work from the signs alone. NOT met: the first bolt
starts a fight that killed a 10-hp player in about three seconds with no round line and no death
line; I "fled" into a respawn at the inn and found "Your corpse is here" in a dark crypt. The third
word turned up in the Cast row with no handover line while the Journal says she still "owes" it.
The bier never says it burns or burns out (one smoke cue), and "Quench the bier" was offered then
refused "not now". The golem yard gave me nothing to do: every yard item "too heavy to carry" (I was
holding eight things; the same words mark fixtures), the golem "Nothing to do here"; in the attic the
bucket, jar and torch only offer Give, which does nothing. (Showcase: the trial is Drop. I never
guessed Drop; nothing in the Book suggests it.) Taking the hedge-wizard's flask and my own bucket
back from the practice golem were thefts under a Take label.

**Economy and law (Undercroft), phone pass.** Wanted: wanted ends by fine or work in the cell; the
fence buys lifted goods only. Found: the work-off path works (arrested at 2p, "Work it off" clears the
name, pennies stay 2) and the fence buys the lifted beeswax at 2p. NOT met: "wanted" still invisible;
the charge says "seen stealing in the Undercroft" for a lift done in the attic; the pay line's
unavailable reason is "too exhausted"; the fence resells the beeswax at 4p (G3 confirmed) and lists
"Buy 6p (sold out)" for purses he never bought.

## GAMEPLAY findings

| # | Sev | Area | Finding and repro |
|---|-----|------|-------------------|
| B1 | high | magic | Silent death and respawn. Crypt, lantern lit: tap "flamma, cast" > Combat page shows only the bolt line; hp 10 > 4 in ~3 s with no round lines; "Flee" > "Back to World" lands at the Crossroads Inn at hp 10/10 with a stray "You can't do that: not now." in the log; back in the crypt: "It is pitch dark... Your corpse is here." Nothing ever said you died, where your things are, or that the inn is the respawn. Shots 15-19. |
| B2 | high | magic, economy | Take on a living NPC's Held list is a theft with a Take label. "Take the oil flask" on the hedge-wizard > "You lift it unseen."; "Take the attic bucket" (my own bucket, just given) from the practice golem > "You lift it, and someone sees." > arrested on entering the market, charge "seen stealing in the Undercroft". The verb never says lift, steal or risk. |
| B3 | high | magic | The golem yard has no reachable interaction: rain bucket, spark jar and torch all read "Take: too heavy to carry. Nothing to do here." (I held 8 items), the golem "Nothing to do here"; held attic bucket/jar/torch offer only "Give ... to a stone golem", which logs "You give..." and nothing else. Same in the attic. The sign promises rain, spark and torch trials. (Showcase says Drop is the trial; untested, unguessable.) Shot 22. |
| B4 | med | magic | Third word: after reading the grimoire, "ward" is in the Cast row before the wizard is spoken to again, no line says she gave it; she then says "You have all I can give"; the Journal entry reads "resolved... the hedge-wizard owes you the third word". Reason text "Needs a second level and more presence" shows at Level 2 (CHA 6). Character lists "The word flamma" only. |
| B5 | med | magic | Bier fire is invisible: after the bolt the room shows a cue "Woodsmoke, thick and bitter", the bier page still "A dry wooden bier... Nothing to do here"; no "catches fire"/"burns out" line; "Quench the bier" on the held bucket refused "You can't do that: not now." and vanished (~60-90 s after the cast). |
| B6 | med | magic | Wight kill line is "A wight leaves." while "A corpse is here." appears; no damage line on either bolt (G9 confirmed). |
| B7 | med | economy | Wrong unavailable reasons: "Pay the fine (3 pennies): too exhausted" at 2 pennies; "lux, cast: too exhausted" at ma 5/5, ash 0 (G7 confirmed); "flamma, cast: not now" with no reason outside the crypt. |
| B8 | med | economy | Fence rows "the merchant's purse: Buy 6p (sold out)" and "a worn purse: Buy 6p (sold out)" shown before he has bought anything; after my sale "Buy a beeswax candle — 4p" appears (G3 confirmed). |
| B9 | low | magic | Wizard dialogue repeats: the "second word is in the book north" line prints three times on one page; "Journal updated" and "Fetch the second word: not now" sit inside the dialogue. The jailer's "Three pennies, or you sit." prints again after the name is struck (G6 confirmed). |
| B10 | low | magic | "Oil the lantern" on a full lantern and "Oil the winch" both log the same "You work oil into it."; the can stays 2/2; oiling does not open the gate, the Map's "Open the crypt gate (down)" does. The flask: "A stoppered flask, dry. Fuel 0 of 3600, unlit" with no verb but Drop/Give. "Drink the oilcan", "Drink the loft bucket", "Put the lantern in your corpse" offered. |
| B11 | low | magic | Grimoire has no Read verb in the room; it must be taken, then Read from Inventory. One read grants flamma and a level at once. |
| B12 | low | hub | Map "Ask where" lists every NPC met including the dead wight and both golems (7 lines in the cell). |

Sweeper 1 rows rechecked at 390: G1, G3, G6, G7, G9 confirmed; G8 partly (the held lantern lit on the
first cast, the line never says so).

## UI/UX findings (390 px)

| # | Sev | Page type | Finding (design-system terms) | Rule | Shot |
|---|-----|-----------|-------------------------------|------|------|
| U1 | high | Status bar | CONFIRM: condition icon is a bare "−" disc with a ring; the label and time live only in the accessible name. No wanted token. | book-ui Conditions details: icon glyphs placeholders "until loka-x6t.63" (known); wanted: system silent | 11 |
| U2 | high | World page | CONFIRM, worse: the log sits under the Word block; in Market Row (4 NPCs) the Word block is seven chip rows (~1000 px) so every action line is two screens down. | book-ui Word bar puts the block before the log; system silent on long rooms | 27 |
| U3 | med | Status bar | CONFIRM: one tap on "standing" > "sitting", no menu, no line. | system silent | — |
| U4 | med | Combat page | CONFIRM, worse: no round lines at all, no enemy or own hp in the body; the only hp is the status bar, whose name says "hp dying". After Flee the status-bar button no longer opens Contents. | book-ui Live combat response: expects per-round lines | 15, 16 |
| U5 | med | Shop/NPC page | CONFIRM: no pennies on the chandler, fence or jailer pages; "can't afford" with no balance. | B3 shop detail: "refreshes pennies" but no rule to show them; system silent | 28, 30 |
| U6 | med | Map page | CONFIRM: last narration block repeated at the top; exit pairs "Down: closed" + "The floor grate: closed"; 7 "Ask where" lines. | system silent | 26 |
| U7 | low | Page heading | DROP at 390 with pointer input: no red focus ring on any page turn in 30 shots (likely keyboard focus only). | — | 11, 28 |
| U8 | low | NPC page | CONFIRM: "Talk the hedge-wizard", "Talk the jailer"; "Back to container" on an NPC's held item; "Nothing to do here" above "Take: too heavy to carry". | labels.ts rule 3: control words from LABEL | 25 |
| U9 | low | Character page | CONFIRM: "pennies 4 / 100", "ash 0 / 5", "xp 40 / 100" read as capped meters. | system silent | 12 |
| U10 | low | Word bar | DROP: chips stayed flamma, lux, ward (alphabetical) across casts; sweeper 1 saw a reorder on learning, not on casting. | — | — |
| B-U1 | med | Status bar | The first status token is a Chinese earthly-branch glyph plus a weather word ("辰 heat", "巳 heat", ... "子 frost"); the glyph changes every game hour and nothing names it. A new player cannot read the hour. | tokens/catalogue: Status icon row names no clock glyph; system silent | 01, 11 |
| B-U2 | med | NPC dialogue | Two exits on one conversation page: "Leave" and "Leave the conversation" stacked; and the quest line "Read the second word..." renders above the fixed page title in small caps, outside the page rhythm. | book-ui NPC dialogue: one Leave; Storylet card details: system silent on a banner above the title | 09, 10, 11 |
| B-U3 | med | Item page | Verb lists mix nonsense with the real action: "Drink the oilcan", "Drink the loft bucket", five "Put X in your corpse"/"in a corpse" cards above "Quench the bier". The one verb that matters is last. | catalogue: ActionCard rows; ordering rule absent (system silent) | 19 |
| B-U4 | low | Container page | "Your corpse" uses the chest layout ("Inside"), then after taking everything shows only five "Put ... in your corpse" cards. | detail-page order: system silent on corpses | 19 |
| B-U5 | low | Shop page | Shop offer rows are dim prose ("a tallow candle: Buy 3p; Sell 1p (you are not holding it).") duplicated by the Buy/Sell cards under them; the Held list below is the lift target with no hint. | BOOK-UI-COMPONENTS: "live shop row is a plain dim line until a row here replaces it" (known gap) | 28 |

## What felt good
The slate and both signposts taught every real step (ash, light, oil, hide, fence). The price shelf
2 > 3 > 5 reads clearly. The arrest narration, the ledger strike and the scrub-the-floor work-off
line are satisfying. The corpse keeps everything and the lantern stays lit. Page turns and the
390 px type are comfortable; nothing overflowed horizontally.

## Top 5
1. Death: a death line, a respawn line, and the corpse's room named (B1); combat round lines on the
   Combat page at phone width (U4).
2. Rename or warn on Take from a living NPC's Held list: "Lift" with a risk line (B2).
3. Give the golem and attic trials a verb the Book shows (Douse/Spark/Dry or a hint that Drop is the
   trial), and never "too heavy" for fixtures and load alike (B3).
4. True unavailable reasons: "no ash", "2 of 3 pennies", "no dead here" (B7, G7).
5. Name the clock token and the wanted state in the status bar (B-U1, U1).

COST: ~120k tokens.
