# Toolbox showcase

`cartridges/toolbox_showcase` (the hub and the body, world and social districts of [showcase plan 1](showcase/hub-and-first-districts.md) are built, the combat district of [showcase plan 2](showcase/combat-district.md) is built, the cause-and-effect slice of [showcase plan 3](showcase/cause-and-effect.md) is built; compiled answer
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

Status `planned (plan N)` means that showcase plan ([plan 1](showcase/hub-and-first-districts.md),
[plan 2](showcase/combat-district.md), [plan 3](showcase/cause-and-effect.md)) names the rooms and steps and the build slice is still to come; `built` means the pin walks the plan's steps; `later` means no brief covers it yet.

| Mechanics | District | Rooms | Pin | Status |
|---|---|---|---|---|
| statuses x reactions | body | `fell_top` (exposure by weather), `still_room` (draught, song) | `kernel/ts/test/showcase_body.test.ts` (body 2, 3, 8, 12) | built |
| sky x exposure x equipment | body | `fell_gate` garments, `fell_top` | `showcase_body.test.ts` (body 2, 5, 6, 13) | built |
| disposition x commerce x dialogue | social | `village_green` (Nell's shop and prices, the Reeve's `help`/`wrong`, the apple), `warden_gate` (engage) | `kernel/ts/test/showcase_social.test.ts` (social 1-4) | built |
| deadlines x schedules x away recap | social | the letter quest, Tam's day, the recap block on return | `mobile/app/book/showcase_recap.test.ts` (the block is Book-side); `showcase_social.test.ts` (social 14) for the facts | built |
| combat x loot x levelling x death | combat | `boar_run` (an unarmed death and the corpse, then the boar's tusk and purse), the Raise after the bounty | `kernel/ts/test/showcase_combat.test.ts` (combat 4-8) | built |
| hidden exits x senses x traps | world (hidden exits), combat (senses) | `sea_cave` night search; the boar's grunt heard from `drill_yard` | `kernel/ts/test/showcase_world.test.ts` (world 5, 7); `showcase_combat.test.ts` (combat 1, 8) | hidden exits built; senses built; traps later (after M8) |
| quests x deadlines x hints | social | `carry_letter` from the Reeve to Wat | `showcase_social.test.ts` (social 10, 13) | built |
| scenes x dialogue x reactions | social | Wat's `deliver`/`burn`, story point `letter_fate`, scenes `letter_read`/`letter_ash`, standing on scene end | `showcase_social.test.ts` (social 12) | built |
| rumour x dialogue check x codex | social | `mill`, `village_green` (Tam tells Nell; `press` grants "The fire") | `showcase_social.test.ts` (social 5, 8) | built |
| visit tiers x codex badge | social | five rooms grant "Wardle walker" | `showcase_social.test.ts` (social 9) | built |
| tide gate x hidden exit x time window x climb | world | `shore_steps` to `sea_cave` loop | `showcase_world.test.ts` (world 2 to 7, 9) | built |
| potion x derived carry | body | `still_room` (the quern lifts only under `might`) | `showcase_body.test.ts` (body 9-10) | built |
| NPC status x variants x schedule | body and world | Wat on `fell_top` at 08:00; Idony's dozing and winter variants | `showcase_body.test.ts` (body 7); `showcase_world.test.ts` (world 8) | built |
| deadline x exposure | social and body | the letter run across `fell_top` | `showcase_social.test.ts` (social 11) | built |
| pick x force x skill growth | social | `tollhouse` (strongbox, fragile and iron doors) | `showcase_social.test.ts` (social 6-7) | built |
| schedule cases x sky | social | Tam's 11:00 case (rain sends him to the church) | `showcase_social.test.ts` (social 8, rain) | built |
| target choice x pack x kill credit | combat | `goblin_pit` (two goblins on one pack plan; Attack the second to switch) | `showcase_combat.test.ts` (combat 9) | built |
| allies x kill credit x quest | combat | `gate_yard` (Gil's blow kills the raider; the bounty resolves) | `showcase_combat.test.ts` (combat 4) | built |
| scars x death x same-body return | combat | the boar's `gored` survives the unarmed death in `boar_run` | `showcase_combat.test.ts` (combat 6) | built |
| bleed status x cure x immune | combat | `bleeding` from the boar, the poultice, the boar immune to its own wound | `showcase_combat.test.ts` (combat 6, 8) | built |
| say and shout x keyword dialogue x reactions | combat | `say steel` opens Aldous's answer; `shout ware` warns Gil next door | `showcase_combat.test.ts` (combat 2, 3) | built; kernel-only until the Book input (`loka-kgd.72`) |
| lesson x weapon x derived damage | combat | Aldous's lesson and sword; Raise str after level 2 | `showcase_combat.test.ts` (combat 2, 5, 8) | built |
| disposition x resistances | social and combat | the Warden's mail (`physical` 100) against the sword | `showcase_combat.test.ts` (combat 10) | built |
| fuse status x status_expired x schedule cases x disposition | social | `tollhouse` (the forced strongbox carries `word_travels`), `village_green` (the Warden's 13:00 walk), `warden_gate` (engage, the ledger mend) | `showcase_consequence.test.ts` (social 15-18, 21) | built |
| rumour hops x conditional schedule x dialogue check x codex deduction | social | `shepherd_hut` (burn), `warden_gate` (Wat tells Tam), `village_green` (Tam tells Nell; `press`), `church` ("What the letter carried") | `showcase_consequence.test.ts` (social 19-20) | built |
| fire: statuses on things x tags x reactions x use-on x cues x barriers (row W22) | body (sandbox off `the_fold`) | `smithy` (torch, kindling, bench, anvil, bucket), `woodstore` behind the burnable `store_door` | `kernel/ts/test/showcase_fire.test.ts` | built |
| traps x statuses x combat; fear x pack x shout; use-on x fire; puzzles | combat | | | later (after M8) |

## How a batch adds a district

The batch's Fable final-head review stays a review only. After the batch head is approved, each
district goes through five steps (owner input and PM ruling, 2026-10-10):

1. **Plan (Fable).** A separate Fable run writes a short district brief in `docs/showcase/`: the
   rooms, the guided loop and sandbox room, which matrix cells it exercises, the signpost text
   and the expected outcome of each step.
2. **Build (Opus developer).** An ordinary slice implements the brief: cartridge content, hash
   fixture, the district's rooms in the simulator's showcase pass (`kernel/ts/test/sim.test.ts`),
   walkthrough or recorder recipe and tests, using only installed mechanics, plus one Book e2e
   playthrough of the district's happy path in the real UI (owner, loka-y6yg.6).
3. **Review (Opus reviewer).** Reviewed against the brief like any slice.
4. **Playtest (Fable).** Before the owner plays it, a blind Fable agent plays the district in
   the web Book and reports ([AI playtest](#ai-playtest); owner, loka-y6yg.7).
5. **Recheck (Fable).** The next batch's Fable final review checks the district still matches
   its brief.

The brief adds matrix rows for the new pairs the batch makes possible and fills in the rows
it covers. A pair that needs engine code to work means the toolbox rows are not finished; that
goes back to the batch as a finding, not into the showcase.

### AI playtest

1. **When:** once per new district before the owner plays it, and after a big Book UI change.
2. **Who:** a Fable agent, blind: it reads neither the district brief nor the cartridge until
   it has played.
3. **Start the Book on the showcase** ([web preview](web-preview.md)):
   `bin/loka dev cartridges/toolbox_showcase`, then
   `cd mobile/app && LOKA_PREVIEW_PORT=19116 LOKA_METRO_PORT=0 npm run author`. Ports 19006 and
   19007 belong to the owner's `~/dev/lokacore-preview`.
4. **Play** with the Claude in Chrome tools in a new tab, at phone width (360-390 px) first.
   Read by page text (`get_page_text`, `find`); screenshot only on a new page type or a
   suspected visual problem.
5. **Stop** the servers it started, by PID.
6. **Report:** what the district wanted and whether it got there without the brief; gameplay
   findings with repro and severity; UI/UX findings in design-system terms with screenshot
   references; what felt good; the top 5 fixes.
7. **Routing:** a triage agent files gameplay causes in Beads under the label
   `showcase-playtest`; the [designer](decisions/owner-decision-designer-role-2026-10-07.md)
   turns UI findings into polish-lane Beads under `loka-x6t` and spec changes; fixes batch on
   the owner's go.

## Retiring Chapter 1

Chapter 1 stays frozen (no story or content work; Book UI polish continues, see the
[decision](decisions/owner-decision-showcase-2026-10-10.md)) until the showcase covers each of its play
families: combat, death, commerce, quests, scenes and dialogue. Then Chapter 1 is retired and its
Chapter-1-specific pins (end-to-end tests, hash fixtures, the E1 recorder) are replaced by
showcase pins. Story-independent tests and fixtures stay.

Death and commerce coverage is limited to what the toolbox has rows for. Row 47 (death penalty
options) covers XP loss and item drop, not ghost-walk death, and no row covers barter; both need a
toolbox row before the showcase can show them.
