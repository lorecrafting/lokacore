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
- **Quests and scenes** get their own guided loop in the social district: a quest with a deadline
  and hints, and a scene whose dialogue choices drive reactions.

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
| quests x deadlines x hints | | | | todo |
| scenes x dialogue x reactions | | | | todo |

## How a batch adds a district

The batch's Fable final-head review stays a review only. After the batch head is approved, each
district goes through four steps (owner input and PM ruling, 2026-10-10):

1. **Plan (Fable).** A separate Fable run writes a short district brief in `docs/showcase/`: the
   rooms, the guided loop and sandbox room, which matrix cells it exercises, the signpost text
   and the expected outcome of each step.
2. **Build (Opus developer).** An ordinary slice implements the brief: cartridge content, hash
   fixture, simulator seeds, walkthrough or recorder recipe and tests, using only installed
   mechanics.
3. **Review (Opus reviewer).** Reviewed against the brief like any slice.
4. **Recheck (Fable).** The next batch's Fable final review checks the district still matches
   its brief.

The brief adds matrix rows for the new pairs the batch makes possible and fills in the rows
it covers. A pair that needs engine code to work means the toolbox rows are not finished; that
goes back to the batch as a finding, not into the showcase.

## Retiring Chapter 1

Chapter 1 stays frozen (no story or content work; Book UI polish continues, see the
[decision](decisions/owner-decision-showcase-2026-10-10.md)) until the showcase covers each of its play
families: combat, death, commerce, quests, scenes and dialogue. Then Chapter 1 is retired and its
Chapter-1-specific pins (end-to-end tests, hash fixtures, the E1 recorder) are replaced by
showcase pins. Story-independent tests and fixtures stay.

Death and commerce coverage is limited to what the toolbox has rows for. Row 47 (death penalty
options) covers XP loss and item drop, not ghost-walk death, and no row covers barter; both need a
toolbox row before the showcase can show them.
