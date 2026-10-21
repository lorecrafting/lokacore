# Showcase blind playtest sweep (2026-10-21, Fable, cut short by PM: browser driver switch)

Worktree detached at origin/main 531b4c1c5. Web Book on port 19116, Claude in Chrome.
**Viewport: the window never reached 390 px.** `resize_window` reported success three times but
`window.innerWidth` stayed 1345 (later 1331) x ~700. Every UI note below is at **1331-1345 px**; phone
layout is untested. Screenshots (01-15) were not archived.

Save reset: "Start over" uses a native `window.confirm` on web, which I may not trigger; I got a
fresh save by loading `http://127.0.0.1:19116/` (a second origin). Run A = localhost, run B = 127.0.0.1.

## Per district: what it wanted vs what I found (brief read only after play)

**Economy and law (Undercroft).** Wanted: price change reads as the shelf; the sign alone leads to
hide-then-lift; "wanted" visible in the world; the fine reads as a way out; the fence's refusal of
honest goods is clear. Found, without the brief: prices read as the shelf (2 -> 3 -> 5 buying, back to 1
when the shelf filled); the sign did lead me to hide behind the alley barrels first, and the unseen
lift worked ("You lift it unseen."); the fine read as a way out ("Three pennies, or you sit"); the
grate escape worked and resets on re-arrest. NOT met: "wanted" is invisible (no status token, no
Character line, no guard line until arrest); the fence refuses honest beeswax with "(not now)", which
says nothing; the yard purse did not come back, so "trying it all again" fails for theft; the fence
sells back what he bought, contrary to the sign; the work-off (clerk/jailer offer when broke) was never
reachable in play, and the sign never mentions it.

**Magic (Loft).** Wanted: ash found before trying lux twice; hush reads as the room's rule; the dark
crypt reads as "bring the light"; golem's rule guessable. Found: the slate told me ash and light before
I tried, so the bar's "too exhausted" at full mana was the only confusion (it hides the real reason, no
ash); the hush read as the room (Word bar vanishes, a "hushed 21s" debuff token); the crypt was reached
with the lantern lit and the wight listed. Lux cast twice in the room lit nothing because the lantern
must be held, and the cast line never says the lantern lit. Golem, attic and errand: not reached.

**Traps, hub regression (combat, social, fire, homestead):** not reached.

## GAMEPLAY findings

| # | Sev | District | Finding and repro |
|---|-----|----------|-------------------|
| G1 | high | economy | "Wanted" is not visible anywhere. Lift the worn purse in the yard beside the watchman ("You lift it, and someone sees."): status bar, Character page and Journal show nothing new; the first sign of it is the arrest on entering the market or the watchman's fight on the yard stair. |
| G2 | high | economy | Entering the yard while wanted starts a fight with no warning: Undercroft > down -> Combat page "The watchman bars the stair: You are wanted..." and rounds begin at once. Flee works (lands in the Undercroft) but a 10-hp player can be killed by a stair. |
| G3 | med | economy | The fence resells what he bought: Sell the merchant's purse 3p, then "Buy the merchant's purse — 6p" appears and works. The sign says he "keeps a hand on what he buys" / "never lets go". |
| G4 | med | economy | The yard "for trying it all again" does not refill the mark's purse: after one lift, "A sleeping man ... his purse in plain sight" has an empty Held list and "Nothing to do here" (checked ~3 game hours later). |
| G5 | med | economy | Casting with no money left: with 4p after fees I was 1p short of the strongroom and had no income (both purses gone, candles sell for what they cost). The district's cash is finite (10p + 6p of purses); a careless first run locks the strongroom out. Work-off was never offered to me (I always had >= 3p when wanted). |
| G6 | med | economy | Fine wording/flow: the clerk button reads "Pay the fine (3 pennies) the clerk"; the jailer's "Three pennies, or you sit." prints twice; sitting an hour in the cell does nothing (the sign's "or sit" is empty). |
| G7 | med | magic | "lux, cast: too exhausted" at ma 5/5, mv 100 when the real block is ash 0 (and again after each cast). The slate says ash; the bar says breath. |
| G8 | med | magic | Lux in the Loft with the lantern on the sill: "You speak lux and the ash flares." twice, the lantern stays "unlit" (2 casts, 4 ma, 2 ash lost). It lights only when held, and the cast line never says so. The slate says it "lights the lantern on the sill". |
| G9 | med | magic | Flamma on the wight: "a bolt of fire leaps from your hand", no damage line, then four rounds of "You miss. The blow catches you." took me 10 -> 2 hp before Flee. No way to cast again in the fight (known: Word bar hidden) and no sign of what the bolt did. |
| G10 | low | economy | Strongroom key before purchase: "Nothing to do here" with no reason; the sign promised "the words in the room say why". After purchase: "Take the strongroom key". |
| G11 | low | economy | "West: not now" on the open cell door while sitting; the reason (position) is never said. |
| G12 | low | economy | Smith: sign says the knife is handed over "an hour later"; the Book charges "Collect the knife (1p)". The collected knife cannot be wielded (item page: Drop / Give only; Inventory has an empty Wield slot). After collecting: "Order a knife (3p): There is nothing left to give." (meaningless). |
| G13 | low | economy | Chandler "Held" and the merchant "Held" use my own inventory heading for an NPC's stock; the chest/NPC page back link reads "Back to container" for a person. |
| G14 | low | economy | Typed Say ("hello") produced no echo on the page or in the Journal. |
| G15 | low | magic | Oilcan item page offers "Drink the oilcan". The winch's own page says "Nothing to do here"; the oiling verb is only on the oilcan. |

Positive: hide persists across rooms with a countdown; "You are plain to see again" logged; the
arrest narration, grate force -> open -> drain -> counting house loop, the strongroom lock/unlock/open
and both chests, the bank fee shape, the smith escrow timing and cancel/collect states all work.

## UI/UX findings (all at 1331-1345 px; phone width unverified)

| # | Sev | Page type | Finding | Shot |
|---|-----|-----------|---------|------|
| U1 | high | World page, Status bar | Conditions are a bare circle glyph ("+" for hidden, "−" for hushed) with no label; the name and timer exist only in the accessible label ("hidden, 51m remaining, buff"). "Wanted" has no token at all. | 06, 07 |
| U2 | high | World page | The action feedback line ("You lift it, and someone sees.", "You lift it unseen.", cast lines) is appended under the Word section at the bottom of the page; at 719 px height it was below the fold after every room action. | 08 |
| U3 | med | Status bar, position control | "standing, change position" is a blind four-step cycle (standing > sitting > resting > sleeping) with no menu and no page line; I had to tap three times to stand up. | — |
| U4 | med | Combat page | No enemy or own HP in the page body, no spell row, only Look / Flee; the two lines per round ("You miss. The blow goes wide." then reversed) read as one repeated line. Flee gives no "you flee" line, just Back to World. | 10, 15 |
| U5 | med | Shop page / NPC page | The player's pennies are not shown on any page (Character only). Shop lines say "You cannot afford that" without the balance; the bank never shows savings. | 04 |
| U6 | med | Map page | "Ask where" lists every NPC met so far (12 lines by the Loft) above Back to World; exits read as pairs ("Down: closed" and "The floor grate: closed"). The Map page repeats the last narration block at its top. | 01 |
| U7 | low | Page heading | A red focus ring appears round the page title (Journal, Settings, The Loft, Combat) after each page turn. | 12, 13, 14, 15 |
| U8 | low | NPC page | Verb labels: "Talk the jailer", "Talk the hedge-wizard"; "Back to container" for an NPC; empty state "Nothing to do here." shown above disabled service lines, so the page says nothing and lists things at once. | 05, 09 |
| U9 | low | Character page | "pennies 10 / 100" and "ash 0 / 5" read as meters with a cap nobody explained. | 03 |
| U10 | low | Word bar | Cast chips reorder after a cast (lux, flamma -> flamma, lux). | — |

## What felt good
The signs are good teachers: the alley hide, the grate, the oil, the ash all came from the signs alone.
The arrest narration and the ledger-strike on paying are satisfying. The chandler's shelf price is
legible as a shelf. The Journal's "(4 times)" folding is nice.

## Top 5 fixes
1. Make "wanted" visible: a status token/line from the seen lift until the fine (G1, U1).
2. Warn before the watchman fight on the yard stair, or bar the stair without combat (G2).
3. Fix the cast-bar reason: "no ash" instead of "too exhausted"; say "the lantern lights" on a held
   lantern and refuse (or explain) a cast with it on the sill (G7, G8).
4. Fence: no resale of lifted goods, and a reason for refusing honest goods; refill the yard purse (G3, G4).
5. Show pennies on shop/bank pages and move the action feedback line above the fold (U5, U2).

## NEXT SWEEPER

Covered: Undercroft fully (chandler, merchant purse unseen and seen theft, alley hide, fence buy/sell,
market clerk and clerk deposit/withdraw/fees, strongroom buy/key/door/chest, hoard chest, yard crate,
smith order/collect, jail: arrest, talk, pay, force grate, drain to counting house, re-arrest, sit).
Loft: slate, hedge-wizard learn lux, gather ash, cast in room and held, reading room hush, grimoire ->
flamma, oil winch, crypt gate, flamma on the wight, flee.

Left: Magic — the errand (third word), golem yard west (rain + spark, torch), attic (wight, bucket,
jar, torch), bier fire + bucket quench, hedge-wizard oil flask, lantern "Oil the lantern". Traps
(down from the drill yard): nothing. Hub regression: nothing. Work-off path: get wanted with < 3p and
talk to the jailer. Fence buying a stolen beeswax (lift from the chandler's Held while unhidden).

State notes: two saves exist. localhost:19116 (run A): 0p, smith's knife held, strongroom not bought,
fine paid, chandler shelf full. 127.0.0.1:19116 (run B): 5p... then 3p after beeswax; strongroom owned,
key + beeswax + grimoire + oilcan (2/2) + lit lantern held; lux and flamma known; hp 2/10, ma 0/5,
standing on the crypt stair, gate open, wight alive below. A third fresh save needs another origin
(e.g. a hostname alias) or the owner pressing Start over.

Route to resume magic: inn > up > east (crypt stair). Rest first (position cycle) — hp 2.
Route to traps: inn > west (drill yard) > down. Hub: inn signpost lists north/east/south/west.
Driver notes: RN-Web buttons need pointer+mouse events (plain `.click()` does nothing); the Map
button opens the exits page; "Leave" closes item/NPC pages; item verbs live on the item page in
Inventory, not on the target.
