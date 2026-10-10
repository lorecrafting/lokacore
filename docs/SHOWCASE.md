# Toolbox showcase

`cartridges/toolbox_showcase` (the hub and the body and world districts are built; the social district
is planned in [showcase plan 1](showcase/hub-and-first-districts.md); compiled answer
`protocol/fixtures/toolbox_showcase_hash.json`, held by `test/loka/content_showcase_test.exs`) is the composition proof for the [mechanics toolbox](MECHANICS-TOOLBOX.md):
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

Status `planned (plan 1)` means [showcase plan 1](showcase/hub-and-first-districts.md) names the
rooms and steps and the build slice is still to come; `built` means the pin walks the plan's steps; `later` means no brief covers it yet.

| Mechanics | District | Rooms | Pin | Status |
|---|---|---|---|---|
| statuses x reactions | body | `fell_top` (exposure by weather), `still_room` (draught, song) | `kernel/ts/test/showcase_body.test.ts` (body 2, 3, 8, 12) | built |
| sky x exposure x equipment | body | `fell_gate` garments, `fell_top` | `showcase_body.test.ts` (body 2, 5, 6, 13) | built |
| disposition x commerce x dialogue | social | `village_green` (Nell's shop and prices, the Reeve's `help`/`wrong`, the apple), `warden_gate` (engage) | `kernel/ts/test/showcase_social.test.ts` | planned (plan 1) |
| deadlines x schedules x away recap | social | the letter quest, Tam's day, the recap block on return | an app test beside `mobile/app/book/recap.test.ts` (the block is Book-side); `showcase_social.test.ts` for the facts | planned (plan 1) |
| combat x loot x levelling x death | | | | later (combat district) |
| hidden exits x senses x traps | world (hidden exits only) | `sea_cave` night search | `kernel/ts/test/showcase_world.test.ts` (world 5, 7) | hidden exits built; senses and traps later |
| quests x deadlines x hints | social | `carry_letter` from the Reeve to Wat | `showcase_social.test.ts` | planned (plan 1) |
| scenes x dialogue x reactions | social | Wat's `deliver`/`burn`, story point `letter_fate`, scenes `letter_read`/`letter_ash`, standing on scene end | `showcase_social.test.ts` | planned (plan 1) |
| rumour x dialogue check x codex | social | `mill`, `village_green` (Tam tells Nell; `press` grants "The fire") | `showcase_social.test.ts` | planned (plan 1) |
| visit tiers x codex badge | social | five rooms grant "Wardle walker" | `showcase_social.test.ts` | planned (plan 1) |
| tide gate x hidden exit x time window x climb | world | `shore_steps` to `sea_cave` loop | `showcase_world.test.ts` (world 2 to 7, 9) | built |
| potion x derived carry | body | `still_room` (the quern lifts only under `might`) | `showcase_body.test.ts` (body 9-10) | built |
| NPC status x variants x schedule | body | Wat on `fell_top` at 08:00; Idony's dozing and winter variants | `showcase_body.test.ts` (body 7); `showcase_world.test.ts` (world 8) | built |
| deadline x exposure | social and body | the letter run across `fell_top` | `showcase_social.test.ts` | planned (plan 1) |
| pick x force x skill growth | social | `tollhouse` (strongbox, fragile and iron doors) | `showcase_social.test.ts` | planned (plan 1) |
| schedule cases x sky | social | Tam's 11:00 case (rain sends him to the church) | `showcase_social.test.ts` | planned (plan 1) |

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
