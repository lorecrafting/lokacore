# Book interaction patterns

The pattern layer over [Book UI](../system/book-ui.md) (the long authority on behaviour) and the
[component catalogue](../BOOK-UI-COMPONENTS.md) (the parts and their rules). A new screen or action
names the template and the patterns it uses before anyone builds it; what fits none goes to the owner
([checklist](#new-feature-checklist)). This file states each rule once and links to where the
detail lives; it copies nothing. Owner words are quoted where a record holds them, else marked
(paraphrased). Enforcement names the test, lint or guard that catches a break, or "none yet".

Tests live in `mobile/app/book/`; lint rules in `lint/rules/` (ids in brackets).

## 1. Page templates

Why (all templates): a player who has learned one page knows every page of its kind; a part out of
order is a bug, not a variation ([owner, 2026-10-23](../decisions/owner-decision-room-page-anatomy-2026-10-23.md)).

### Room (World page)

- Order: room title; description paragraph (only fixture and furniture links interactive); people
  paragraph (PCs and NPCs as links); items paragraph (items as links); event log, where every
  line appends: ambient, your own, refusals, combat and a detail page's ([line placement](../system/book-ui.md#line-placement)).
- Never appears: action cards, chips, boxed tags, verb lists, warnings, notes,
  filler lines. Minimap, joystick, status line and the say field sit outside the scrolling page.
- Source: owner, quoted: "no random one off things"; the rest of the anatomy is his list in the
  [decision](../decisions/owner-decision-room-page-anatomy-2026-10-23.md); spec
  [Room page anatomy](../system/book-ui.md#room-page-anatomy).
- Enforcement: `refused_verbs.test.ts:66` (an aimed verb draws on its page, not World);
  `word_bar.test.ts:48` (word chips only in the open say field); `room_anatomy.test.ts` (the World
  page's pressables are the title, prose links, people and items; cues are log lines).

### Person (NPC or PC) detail

- Order: name; description; projected state (hostile line, conditions); visit history (only when
  nonempty); options in fixed groups: Talk, Trade, Use an item…, Cast a spell…, Lift/Take,
  Ask about, services; Leave last.
- Never appears: Give an item… (gifts start from the item), the NPC's name inside the Talk label,
  a status line, compass or say icon.
- Source: [NPC dialogue and action details](../system/book-ui.md#npc-dialogue-and-action-details),
  [dialogue hub decision](../decisions/owner-decision-dialogue-hub-2026-10-09.md).
- Enforcement: `polish_detail.test.ts:107` (no Give an item…), `detail_visit.test.ts:96` (no
  status line, Leave last), `hostile_refusal.test.ts:28` (hostile: refusal line, no Talk/Trade).

### Item detail

- Order: name; description; projected state (worn, lit, held by); visit history (only when
  nonempty); options: self verbs (Read, Eat, Wield, Remove…), then the pick options (Use an item…,
  Use on…, Cast a spell…), move verbs (Take, Lift, Drop), store and hand-over (Put in…, Give
  to…); Leave last.
- Never appears: a line twice on the page, an empty history heading.
- Source: [Item details and Take/Drop](../system/book-ui.md#item-details-and-takedrop),
  [detail-page order decision](../decisions/owner-decision-detail-page-order-2026-10-05.md),
  [corpse Take decision](../decisions/owner-decision-corpse-loot-take-detail-2026-10-06.md).
- Enforcement: `item_detail.test.ts:51` (history between description and options, empty omitted),
  `polish_detail.test.ts:16`, `:123` (Take/Drop return World only on confirmation), `:162`.

### Container

- Order: as Item detail; a closed container shows Open and no contents; an open one lists contents
  as item links, then Close.
- Never appears: contents or Take links while closed; a lid state the engine does not hold; your
  own take or put line (quiet: the contents list is the feedback).
- Source: owner, quoted: "Yeah make they need to open it first" (loka-x6t.121 notes); engine
  lids exist; Book half in progress.
- Enforcement: none yet (slice loka-x6t.121 adds its test).

### Shop (buy and sell)

- Order: Trade on the person page opens "<Name> can sell you…": buy cards ("Cob of bread — 4p";
  refused rows read "…: can't afford" or "…: sold out"), purse Note "You have <n>p.", history,
  Sell card last → "<Name> will buy…" with the same shape.
- Never appears: a page turn on a buy or sale; a price table; a confirm dialog; your own buy or
  sale line (quiet: purse and list are the feedback).
- Source: [NPC dialogue and action details](../system/book-ui.md#npc-dialogue-and-action-details)
  (shop subsection), [pegs shop decision](../decisions/pm-decision-b3-pegs-shop-2026-10-05.md),
  owner 2026-10-23 (paraphrased): a sale keeps the page, purse and list redraw (commit f136a6531).
- Enforcement: `shop.test.ts`, `hostile_refusal.test.ts:43` (buy keeps page, purse, row refused in
  words); row focus moves to the page title when a row goes (PR #462).

### Service and order

- Order: each service is its own Action card on the person page; an open order hides its
  commission and shows a "Your order" Section with claim and cancel only while the order is open.
- Never appears: claim or cancel with no order; two services' orders merged.
- Source: [NPC dialogue and action details](../system/book-ui.md#npc-dialogue-and-action-details).
- Enforcement: `offers.test.ts:52`.

### Notice and fixture

- Order: title; body (a notice invokes Read on open and shows its body once); history; Leave to
  World. A board lists its notices as links; notice → "Back to board" → "Back to World".
- Never appears: a Read card for a page that already read itself; a board line on World.
- Source: [Notice-board details](../system/book-ui.md#notice-board-details),
  [notice board decision](../decisions/owner-decision-m12-b-notice-board-2026-10-05.md),
  [room interactables decision](../decisions/owner-decision-room-interactables-2026-10-06.md).
- Enforcement: `polish_detail.test.ts:387`, `:404`, `:427`.

### Combat

- Order: own page; opponent block "name — band"; combat log (each line also in the World log); vertical action list (Stand, Flee,
  Look, item combat uses, Cast a spell… per foe); on closure the page stays with Back to World.
- Never appears: a minimap or say field; horizontal buttons.
- Source: [Combat interaction](../system/book-ui.md#combat-interaction),
  [Live combat response](../system/book-ui.md#live-combat-response-m6-a), owner decisions
  [actions](../decisions/owner-decision-m6-a-combat-actions-2026-10-04.md),
  [copy](../decisions/owner-decision-m6-a-combat-copy-2026-10-04.md),
  [pane](../decisions/owner-decision-m6-a-combat-pane-2026-10-04.md).
- Enforcement: `word_bar.test.ts:201` (no word press in combat); combat page tests under
  `mobile/app/book/`.

### Sections (Contents)

- Order: Contents lists exactly Character, Inventory, Map, Journal, Settings; each section ends
  with "Back to World". Character: resources, levelling and Raise cards, skills and professions,
  Spells (refused words with reasons). Journal: quests, then Lore. Settings: Reading size,
  page-turn sound.
- Never appears: a sixth section without an owner decision; game actions other than Raise and
  aimed spells; a status line.
- Source: [World and status entry](../system/book-ui.md#world-and-status-entry),
  [Levelling details](../system/book-ui.md#levelling-details), [Lore details](../system/book-ui.md#lore-details),
  [Skill tree details](../system/book-ui.md#skill-tree-details).
- Enforcement: `mobile/app/catalogue.test.ts` (every component listed); none yet for the fixed
  Contents list.

## 2. Where actions live

### Every action sits on a fixture, person or item page

- Rule: no action card on the World page; a verb aimed at a room thing lives on that thing's
  detail page. Room-level verbs (Gather ash and kin) move onto a fixture link in the description.
- Why: the World page is reading; acting is always a page deeper, so the reader knows where to look.
- Do: "ash heap" link in the description → Ash heap page → Gather. Don't: a Gather ash card under
  the room text.
- Source: owner, quoted: "unless its on a description room fixture/furniture, or npc/pc and item"
  (loka-x6t.120 notes); [Room page anatomy](../system/book-ui.md#room-page-anatomy).
- Enforcement: `refused_verbs.test.ts:66`; plain fixtures need a kernel projection (loka-x6t.120).

### Targeted actions use Pick a second thing

- Rule: a verb that needs a target is a card with an ellipsis (Use an item…, Use on…, Cast a
  spell…, Give to…); the pick list opens inline beneath it; an accepted pick returns to World with
  one log line; a refused pick keeps the page and adds a Note to its history.
- Why: one way to aim, learned once; the page never jumps before the result is known.
- Do: apple page → Give to… → Farmer → World: "You give the apple to the farmer." Don't: a Give
  card on the farmer's page listing your inventory.
- Source: [NPC dialogue and action details](../system/book-ui.md#npc-dialogue-and-action-details),
  [Item details](../system/book-ui.md#item-details-and-takedrop).
- Enforcement: `pick.test.ts`, `polish_detail.test.ts:69`, `:107`; [mobile-book-labels] (ellipsis
  words come from LABEL).

### Aimed spells

- Rule: Cast a spell… appears on person and item pages, on the Character Spells block ("Flamma,
  cast on…") and per foe on the Combat page; a refused spell lists its reason under Spells.
- Why: a spell is aimed like any other targeted action; the Spells block is the only place to read
  why one is refused.
- Source: [Word bar](../system/book-ui.md#word-bar) (spell words), [Combat interaction](../system/book-ui.md#combat-interaction).
- Enforcement: `word_bar.test.ts:171`.

## 3. Navigation

### A link opens its page; Leave returns to its origin

- Rule: tapping a name link in any paragraph turns forward to that thing's page; Leave (or "Back
  to <origin>") is the last control on every detail page and turns back to where the reader came
  from, never to a fixed home.
- Why: the book metaphor: a page opened from a page closes onto it.
- Do: board → notice → Back to board → Back to World. Don't: Leave on a notice jumping straight to
  World when it was opened from the board.
- Source: [Detail-page order](../system/book-ui.md#detail-page-order),
  [owner decision](../decisions/owner-decision-detail-page-order-2026-10-05.md).
- Enforcement: `detail_visit.test.ts:96` (Leave last); `polish_detail.test.ts:468` (Enter or
  Space on a name opens its page); none yet for Leave returning to its origin.

### Doors move through the minimap and joystick

- Rule: no door cards on World; releasing the joystick toward a shut door presses Unlock when
  available, else Open; the minimap tick tells closed from locked; a refusal logs one line.
- Why: movement is spatial, so it lives on the spatial control, not in the prose.
- Source: [Minimap, Map and presentation controls](../system/book-ui.md#minimap-map-and-presentation-controls).
- Enforcement: joystick and minimap tests under `mobile/app/book/`; none yet for "no door card on
  World" beyond `room_anatomy.test.ts`.

### Page turns

- Rule: forward turn on opening a detail; backward on a local return; no turn on an in-place
  result (buy, sale, refused pick, retained item action).
- Why: a turn means "you moved"; a result where you stand must not read as moving.
- Source: [Page turn](../BOOK-UI-COMPONENTS.md#page-turn); owner 2026-10-23 (paraphrased): no page
  turn on a sale.
- Enforcement: `hostile_refusal.test.ts:43`; Storybook page turns are spies (pages-npc--sale story).

## 4. Feedback

### After an action you stay where you are; the result shows in place

- Rule: a buy redraws purse and list on the shop page (its line is quiet); a retained item action appends to the
  item's history; Take, Drop and a confirmed pick return to World with one named log line.
- Why: the reader sees cause and effect on the same page, or one turn back with one line.
- Do: "You have 12p." updates under the cards. Don't: a toast, a modal, a second confirming line.
- Source: [Item details](../system/book-ui.md#item-details-and-takedrop),
  [Live action freshness](../system/book-ui.md#live-action-freshness).
- Enforcement: `polish_detail.test.ts:16`, `:123`, `:162`, `:241`; `hostile_refusal.test.ts:43`.

### Every line logs; some are quiet

- Rule: every line lands in the room event log. A display table gives each line, per event key and
  open page, one treatment: in place (page history and room log), log (room log only) or quiet
  (room log only, compacted as "<line> (N times)"). Quiet so far: your own buy and sale on the shop
  pages, your own take and put on an open container. Quiet is visual only: every quiet line is
  still announced. Other people's actions are never quiet.
- Why: owner, quoted: "Yes i like your idea if still logging to the room but compacted"; the log
  is the full record, and the page's own redraw is the feedback.
- Do: "You buy it. (3 times)" in the room log after three buys. Don't: the buy line on the shop
  page, or three equal lines in the log.
- Source: [Line placement](../system/book-ui.md#line-placement).
- Enforcement: none yet (narration log slice 3 adds the merge test).

### Refusals are plain prose lines

- Rule: a refusal is one ink-italic sentence in the log or page history; an action that is
  unavailable shows as `label: reason` in ActionCard's unavailable form; reasons come from
  `words.ts` `reason()`. No reason chip, badge or colour.
- Why: the book speaks; it does not flag.
- Do: "Remove: it will not come off." Don't: a red "Cursed" tag beside the card.
- Source: [Text clarity](../system/book-ui.md#text-clarity), pick mvlyp3gphp2t (no reason chip),
  [controlled refusals](../decisions/pm-decision-e1-controlled-refusals-2026-10-07.md).
- Enforcement: [mobile-book-reason-note]; `refused_verbs.test.ts:45`, `:134`.

### Screen-reader announcements

- Rule: one polite live region reads each press's new room-log lines (detail-page, combat,
  refused and quiet lines included), only the lines new since the last screen.
- Why: a sighted reader sees the line appear; a blind reader must hear the same line, once.
- Source: [Announcements](../system/book-ui.md#announcements).
- Enforcement: `live_region.test.ts:30`, `:42`.

### Label-in-name

- Rule: a control's accessible name starts with its shown text (Talk → "Talk to Nell"; a link
  "…, open"; a fixture "…, look").
- Why: WCAG 2.5.3; voice users say what they see.
- Source: [Grammar](../BOOK-UI-COMPONENTS.md#grammar).
- Enforcement: [mobile-book-labels]; none yet for the prefix rule.

## 5. Empty and edge states

### No filler lines

- Rule: an empty history, empty items paragraph or empty people paragraph is omitted, not
  described. The one allowed empty line is Journal's "Nothing written yet." when truly empty.
- Why: "There is nothing here" is noise a reader has to skip every time.
- Source: [Room page anatomy](../system/book-ui.md#room-page-anatomy), [Item details](../system/book-ui.md#item-details-and-takedrop).
- Enforcement: `item_detail.test.ts:51` (empty log omitted); none yet for paragraphs.

### No chips or boxed tags in the game world

- Rule: nothing inside a page is drawn as a chip, tag or box; state is a sentence. Known-word
  Chips exist only in the open say field, outside the page.
- Why: the page is a printed book; boxes belong to the controls around it.
- Source: [Word bar](../system/book-ui.md#word-bar), pick mvlyp3gphp2t.
- Enforcement: `word_bar.test.ts:48`; [mobile-book-bleed-only-tap]; none yet forbidding a Chip
  inside a page.

### Closed containers

- Rule: Open first; contents are hidden until opened (see [Container](#container)).
- Enforcement: none yet (loka-x6t.121).

## 6. Wording conventions

### Card labels: verb, or verb + name, from LABEL

- Rule: a card reads a bare verb (Talk, Trade, Sell, Take, Drop, Leave) or verb + target
  (Back to board, Leave the conversation); a targeted verb ends in an ellipsis (Give to…). Talk
  never carries the person's name; the name is in the accessible name only. Every label word
  comes from `mobile/app/book/labels.ts`.
- Why: short labels scan; the page title already names the person; one edit renames everywhere.
- Do: **Talk**. Don't: "Talk to Nell", "Chat", "Speak with".
- Source: [Grammar](../BOOK-UI-COMPONENTS.md#grammar), [dialogue hub decision](../decisions/owner-decision-dialogue-hub-2026-10-09.md).
- Enforcement: [mobile-book-labels].

### Sentence forms

- Rule: results are second person present, one sentence, ending in a full stop ("You pick up the
  apple."); shop headings read "<Name> can sell you…" / "<Name> will buy…"; prices read
  "Name — 4p"; refusals read as a sentence or `label: reason`.
- Why: one voice across every page.
- Source: [Text clarity](../system/book-ui.md#text-clarity), [Displayed name details](../system/book-ui.md#displayed-name-details).
- Enforcement: `item_detail.test.ts:101` (equip words); [mobile-book-text] (all lines through
  `Text.tsx`); content lint refuses an authored Leave-only choice.

### Each room speaks from its own point of view

- Rule: a room's log tells only what that room sees. Moving: the room left logs nothing new for
  the player (others: "Nell leaves north."); the room reached opens with "You arrive from the
  south." Fleeing: "You flee north." ends the fight room's log; the room reached opens with "You
  run in from the south." The direction is the arrival room's exit back to the origin; no way back
  reads "You arrive." / "You run in."; up and down read "from below" / "from above". Dying: "You fall." ends the fight room's
  log; the recovery room opens with "You wake at the inn."
- Why: the log is the room's record, not the player's diary.
- Do: "You arrive from the south." Don't: "You go north." in the new room.
- Source: [Line placement](../system/book-ui.md#line-placement), [record](../decisions/owner-decision-room-point-of-view-2026-10-24.md).
- Enforcement: `kernel/ts/test/barriers.test.ts` (the arrival direction), `kernel/ts/test/hidden_passage.test.ts` (a hidden way back gives "You arrive."), `mobile/authority/local-story/narration_routing.test.ts` and `mobile/app/book/combat_flow.test.ts` (flight and death lines stay with the fight). Other actors' lines: not built (Beads `loka-glj8` follow-up).

### Ellipsis

- Rule: an ellipsis (…, one character) ends a label that opens a pick or a heading that is
  completed by a list below it; nowhere else.
- Why: the ellipsis is the one visual promise that "more follows here".
- Source: [Grammar](../BOOK-UI-COMPONENTS.md#grammar).
- Enforcement: [mobile-book-labels] (ellipsis labels live in LABEL); none yet for stray ellipses in
  prose.

## New feature checklist

For a brief that adds or changes anything the player sees or taps
([Book interaction delivery](../WORKFLOW.md#book-interaction-delivery)):

1. Name the [template](#1-page-templates) each new screen uses; a screen that fits none is an
   owner question before building.
2. Name where each new action lives ([section 2](#2-where-actions-live)): which fixture, person or
   item page; whether it picks a second thing.
3. Name the return path ([section 3](#3-navigation)): what Leave returns to; which taps turn pages.
4. Name the result ([section 4](#4-feedback)): the in-place change, the one log line, the refusal
   sentence, and what the live region reads.
5. Name the empty state ([section 5](#5-empty-and-edge-states)) and confirm nothing is boxed.
6. Add every new label to LABEL and cite the [wording pattern](#6-wording-conventions).
7. Cite the `book-ui.md` clause for each Book-visible promise ([brief rules](../WORKFLOW.md#loop)).
8. Add or name the test that catches a break of each pattern used; a pattern marked "none yet"
   gets its check in the same slice when the slice touches it.

## Conflicts and gaps

Conflicts (code or spec contradicts a pattern above):

- Exit warning notes and the Continue conversation button still draw on the World page outside
  the five parts: loka-x6t.127 follow-ups.
- Containers show contents without Open: loka-x6t.121 (in progress).

Gaps (no pattern or no check yet):

- Fixed Contents list and "no Chip inside a page": needs filing (one render test each).
- Label-in-name prefix rule: needs filing (one accessibility-name test).
- Device Back on a pick list: loka-x6t.113. Whisper hidden until loka-x6t.115. Wider sale lists:
  loka-x6t.117. NPC conditions page: loka-x6t.70.
- Two foes with the same name give two identical Cast options on the Combat page: needs filing.
- Skill-gated room depth: loka-x6t.126, on hold (owner, quoted: "hold on that for now").
- Journal's "Nothing written yet." stays the one allowed empty state (owner 2026-10-23 chose
  "Keep it" over removal).
