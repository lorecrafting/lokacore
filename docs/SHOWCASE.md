# Toolbox showcase

`cartridges/toolbox_showcase` (not yet created; its hub and first district land at the next
batch's final review) is the composition proof for the [mechanics toolbox](MECHANICS-TOOLBOX.md):
one playable cartridge where finished mechanics meet each other, so a pair that only works in its
own sampler shows up here ([owner decision](decisions/owner-decision-showcase-2026-10-10.md)).
Integration rows such as W22 Fire live in it. It replaces Chapter 1 as the regression fixture once
it covers Chapter 1's play families (see [Retiring Chapter 1](#retiring-chapter-1)).

## Structure

- **Hub inn**: the start room, linked to every district.
- **One district per mechanic family**: body, world, social, combat, magic/use-on, economy/law,
  settlement.
- **Each district** is a guided loop of 3 to 6 rooms that opens with a signpost readable
  explaining what to try, plus one sandbox room where the district's mechanics can be combined
  freely.

## Pairwise mechanic matrix

Each row is a set of mechanics that must work together in one room or loop. A batch fills in the
district and room that shows the pair, and the pin (test or recorder) that holds it.

| Mechanics | District | Rooms | Pin | Status |
|---|---|---|---|---|
| statuses x reactions | | | | todo |
| sky x exposure x equipment | | | | todo |
| disposition x commerce x dialogue | | | | todo |
| deadlines x schedules x away recap | | | | todo |
| combat x loot x levelling x death | | | | todo |
| hidden exits x senses x traps | | | | todo |

## How a batch adds a district

At each toolbox batch's final-head review, Fable authors that batch's district (or extends an
existing one): the guided loop, the signpost readable and the sandbox room, using only installed
mechanics. It adds matrix rows for the new pairs the batch makes possible and fills in the rows
it covers. A pair that needs engine code to work means the toolbox rows are not finished; that
goes back to the batch as a finding, not into the showcase.

## Retiring Chapter 1

Chapter 1 stays frozen (no story or polish work) until the showcase covers each of its play
families: combat, death, commerce, quests, scenes and dialogue. Then Chapter 1 is retired and its
Chapter-1-specific pins (end-to-end tests, hash fixtures, the E1 recorder) are replaced by
showcase pins. Story-independent tests and fixtures stay.
