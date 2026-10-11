# Showcase plan 3: cause and effect in Low Wardle

Content brief for `cartridges/toolbox_showcase` ([showcase](../SHOWCASE.md), Beads `loka-y6yg.4`, idea
`loka-lvno`), written by Fable for an Opus developer and an Opus reviewer. Base: `main` after PR #369
(the combat district): the build keeps the Warden's `resistances` and combat 10. Only installed
mechanics; every shape below has a precedent in this cartridge or a sampler, cited per item.
A step that needs engine code is a [toolbox finding](#toolbox-findings), not showcase work.

The experiment: the village remembers two acts and answers days later, in the world, never in a
score. Two patterns from the owner's consultation: (3) the burnt letter echoes back through Wat, Tam
and Nell to a codex deduction; (4) a forced strongbox lights a fuse that turns the Warden. Each has
a quiet twin (deliver; pick) that pays nothing back.

## Hard rules (the reviewer checks every line)

- The Book never shows standing, trust or any score; nothing new on the Character or Journal pages
  beyond the existing Lore list and quest outcomes.
- No line says "because you did X". A variant, a rumour or a goal line describes what is, never why.
  Nell reports what the village heard; only Wat knows who held the letter.
- No narrator adjectives for the player (no "cruel", "guilty", "troublemaker" in new text), and
  two plan 1 lines are rewritten to the same rule (see [Toolbox findings](#toolbox-findings) 4):
  the Warden's `engage` and `scene.letter_ash.2`.
- Consequences are detours, never walls: the hostile Warden leaves the gate for an hour a day, the
  mill track still reaches the tollhouse through the forced wooden door, and a gift mends him.
- Asymmetric: the delivered letter and the picked lock change nothing beyond what plan 1 built.
- `sign_social` is rewritten (loka-y6yg.14) so it names no score and announces neither pattern: a
  signpost that announced these would be the telling.
- Words are the developer's; the lines below are gists, not pins.

Clock: 3600 units a game hour, rate 50, so one real minute is 50 game minutes, a game day 28.8 real
minutes and the 30-minute recap threshold 25 game hours. One number differs from the owner's sketch:
the fuse is **one** game day, not two, so the owner's playtest fits one absence of about 35 real
minutes; it is two fields (`statuses/word_travels.json` `duration` and `tick_every`, `tick_every` one
unit less, as the compiler requires it below `duration`) to retune.

## Pattern 4: the forced strongbox (a fuse)

- Recipe `force_strongbox` at `tollhouse` detail `strongbox_lock` (rating 1), alias `force`, check
  `{key: force_strongbox, kind: opposed, attribute: str}` (str 10 beats 1: forcing a cheap lock is
  easy and loud; picking is the quiet skill), policy `all(strongbox_picked false, strongbox_forced
  false)`, success `fact.assign strongbox_forced true`, a failure outcome with its line
  (`recipes/force_tollhouse_door.json`). `pick_strongbox`'s policy adds `strongbox_forced false`;
  `barriers/strongbox_lid.json` `opens_when any(strongbox_picked, strongbox_forced)`.
- Status `word_travels`: `duration` 86400, `tick_every` 86399 (the compiler refuses a tick at or past the end), `resource` hp, `per_tick` -1, label and
  three narration keys (required, never shown: an item's status says nothing,
  [row G3](../system/mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3)). It lives on the
  **strongbox item**, not the Warden: an item has no pools, so the tick changes nothing, and the Book
  shows no NPC status anyway. A silent tick at +86399 (no pool, no line), then the job at +86400
emits `status_expired` only (an expired job skips the tick, `kernel/ts/src/mechanics/status/job.ts`).
- Reaction `box_forced`: `on {event: fact_changed, fact: strongbox_forced}` `apply status.apply
  {status: word_travels, item: strongbox}` (`npc_status_sampler` torch on the door). Reaction
  `word_out`: `on {event: status_expired, status: word_travels}` `apply fact.assign warden_knows true`
  (`npc_status_sampler/reactions/charred.json`; the delivery runs for the command actor, so the
  player's fact is written whatever advance crosses the expiry). Fact `warden_knows`, player bool.
- Warden (`npcs/warden.json`): `disposition.hostile` becomes `any(all(wardle_standing -2, trust 0 at
  target), all(warden_knows true, trust 0 at target))`; `engage` unchanged. `daily_schedule` `"13":
  [{when: fact_compare warden_knows true, room: village_green, goal: npc.warden.goal_green},
  warden_gate]`, `"14": warden_gate` (13:00, so a box forced before 13:00 on day 1 sends him
  out on day 2; an earlier hour would make the owner's first day a sprint) (Tam's 11:00 shape; a case reads a player fact with the player as
  actor, [row W10](../system/mechanics.md#conditional-schedules-toolbox-row-w10)). The fallback is
  the room he is in, so no new arrival line appears in a world where the box is whole (the recap pin
  `mobile/app/book/showcase_recap.test.ts` stays as is). `room_line_variants` and
  `description_variants` on `fact_compare warden_knows true`: he watches your hands (the Reeve's
  `letter_late` variant shape).
- Mend: reaction `gift_ledger` `on {event: item_acquired, item: mill_ledger}` `apply fact.adjust
  trust +1` (`gift_apple` shape: the holder is the subject; the player's own take raises no NPC's
  trust, and the pin reads the Warden's row only). Giving
  the Warden the ledger back, or the apple, makes him wary again; the variant stays (the look is
  memory, the trust is the mend).
- On the green from 13:00 to 14:00 he is hostile too: a player who walks onto the green then is
  engaged there (G11: an ordinary move into his room), a player already there is not. Intended: it is
  a found-out moment and a detour, not a wall. His attack chance is 0, so no damage lands; the
  player unarmed lands nothing and with #369's sword hits for no loss; Flee from the green has five
  exits (a draw), and the encounter ends once they are apart.

## Pattern 3: the burnt letter (an echo)

- `reactions/letter_ash_after.json` adds `fact.assign letter_burnt true` (player bool) beside the
  standing -2.
- Wat (`npcs/wat.json`): `daily_schedule` adds `"14": [{when: fact_compare letter_burnt true, room:
  warden_gate, goal: npc.wat.goal_gate}, shepherd_hut]`, `"16": shepherd_hut`; hours 8 and 9 stay
  (body 7 pins them). `room_line_variants` and `description_variants` on `letter_burnt`, listed **before** the
  `chilled` variants (first match wins, and on a frost day Wat is chilled 08:00 to 10:30): a line
  that reads true in the hut and at the gate (he turns his cap in his hands; he does not look at you).
- Fact `knows_ash`: instance bool, `per_subject`, as `knows_fire`. Three reactions
  ([row W3](../system/mechanics.md#rumour-by-co-presence-toolbox-row-w3), the `tam_sees` and
  `tam_tells_nell` shapes): `wat_at_gate` `on {entity_entered_room, room: warden_gate, npc: wat}`
  `apply fact.assign knows_ash true` (unnamed: the entrant); `tam_hears_wat` `on
  {entity_entered_room, room: warden_gate, npc: tam}` `when fact_compare {knows_ash, npc: wat}`
  `apply fact.assign {knows_ash, npc: tam, value: true}`; `tam_tells_nell_ash` `on
  {entity_entered_room, room: village_green, npc: tam}` `when fact_compare {knows_ash, npc: tam}`
  `apply fact.assign {knows_ash, npc: nell, value: true}`. Wat's fact is set at the gate, not at
  the burn, so Tam hears only after they have stood at the gate together (14:00 to 16:00; Tam
  arrives 15:00).
- Dialogue `nell_ash` (sorts before `nell_rumour`, so it opens first when both hold): policy
  `all(fact_compare {knows_ash, subject: target, equals: true}, not topic_surety_known)`; one choice
  `press`, check `{key: press_nell_ash, kind: opposed, skill: intimidate, rating: 2, failure}`,
  sequence `fact.assign topic_surety_known true` (the `nell_rumour` shape; one choice because the
  sequence assigns a topic fact). Gist: Tam says Wat was at the gate asking after his brother; Hal
  has sat in the toll cell since the fair on the Reeve's word, and the paper that would have let him
  out never came down the fell. Topic `surety` ("The surety"). Nell refuses to talk at standing -2
  (G11), so a player who burnt at standing 0 must first mend it with the Reeve's `help`: that is the
  cartridge's existing rule and a detour, named in the playtest script.
- `readable.parish_roll` gains one line: Hal, Wat's brother, taken up at the toll gate at the fair.
- Deduction recipe `think_letter` at `church` detail `lectern`, a distinct alias (`think` is
  `think_lectern`'s on the same detail), policy `all(topic_parish_known, topic_surety_known, not
  topic_letter_known)`, success `fact.assign topic_letter_known true`; topic `letter` labelled
  "What the letter carried" (`think_lectern` shape, [row 46](../system/mechanics.md#lore-codex-and-deduction-toolbox-row-46)).
  Gist of the success line: the Reeve's thumbprint was Hal's way out before the moot; it is ash, and
  the cell is still shut.

## Steps and expected outcomes

The build picks a world context id whose day 1 is frost (the letter run) and whose days 2 and 3 are
dry, so Tam reaches the green at 11:00 each day (the existing SOCIAL id has rain on day 2, which
sends him to the church; weather is a hash of world id and day, as plan 1's tests choose). Times are
the game clock; the tests advance by `elapsed` as the social pins do.
Social steps continue plan 1's numbering.

| # | Step | Expected |
|---|---|---|
| 15 | Fresh world, 07:00 day 1. Reeve: `help` (no letter: an undelivered letter would fail `late` during step 17 and move the standing); Warden: `lean` twice; east; `force_strongbox` at about 08:00. | Passes (10 ≥ 1); `strongbox_forced` true; the lid opens; `pick_strongbox` unavailable; a `word_travels` row on the strongbox, `ends_at` = force time + 86400; no narration line, Character page unchanged; `warden_knows` false; the Warden's room line is the base. Take the ledger; `force_tollhouse_door`; north to the mill, down to the green. |
| 16 | Same world, `pick_strongbox` instead (two tries). | No status row anywhere; after the whole of step 17's wait `warden_knows` is still false and the Warden is at his gate with the base line. |
| 17 | From step 15, stand on the green; elapse to 14:30 day 2. | At force time + 86400 (about 08:00 day 2) `status_expired` and `warden_knows` true, nothing said. 13:00 day 2: the Warden enters the green (`entity_entered_room`; he walked in, so no engage, G11); his room line and description read the hands variant. 14:00: he goes back to the gate. Walk east at 14:30: `engage` opens an encounter (standing 1, trust 0, `warden_knows`); the Warden's chance is 0 so the player takes nothing, and the player's blow lands nothing unarmed (a hit for no loss with the sword, as combat 10); `toll_gate` is still open (the Book cannot shut it: finding 1). |
| 18 | Branch at 13:00 day 2 on the green, the player there since before 13:00. (a) East, then east again. (b) Give the Warden the ledger, then at 14:30 walk east. (c) From the inn, south onto the green at 13:30. | (a) The gate room is empty, the tollhouse reached, no engage; his 14:00 return engages no one. (c) `engage` on the green; Flee leaves by one of five exits. (b) `trust` (Warden) 1: wary; no engage at 14:30; the hands variant still shows. |
| 19 | Fresh world, 07:00 day 1, standing 1 after `help`; `accept`, take the letter; reach the hut after 09:00; `burn`. | Scene `letter_ash`; standing -1; `letter_burnt` true; Wat's room line and description read the variant at once; `knows_ash` false on Wat, Tam and Nell. 14:00 day 1: Wat enters the gate (`knows_ash` on Wat; the goal line only if the player is in the hut). 15:00: Tam enters the gate, `knows_ash` on Tam. 16:00: Wat home. 11:00 day 2: Tam on the green, `knows_ash` on Nell. Talk to Nell at 11:30: `nell_ash` opens (ahead of `nell_rumour`); `press` fails twice and passes the third time with intimidate 0 at the start (growth `[1, 2]`); Lore lists "The surety". Church: read the roll ("The parish"); the Journal shows the card "What the letter carried" from those two (and the heir card once "The fire" is known); `think_letter` grants it once. |
| 20 | Fresh world, as 19 but `deliver`. | `letter_burnt` false; Wat is in the hut at 14:00 and 16:00 (no event); Tam's 15:00 arrival writes nothing; Nell on day 2 opens `nell_rumour` only; no letter card; standing 2. |
| 21 | Kernel half of the recap: from step 15 (forced about 08:00), then `accept`, the letter, and the burn before 14:00 day 1, back on the green by about 10:00 day 1; elapse to 14:30 day 2 (over 90000 units). | The settlement's receipts carry Tam's entries (11:00 day 1 and 2) and exit (15:00 day 1) and the Warden's entry (13:00 day 2) and exit (14:00), no Wat (he visits the gate); also the `chilled` tick and expiry lines from the frost crossing of `fell_top` on the way to the hut, so the pin names them rather than asserting Tam and the Warden alone. The Book groups them in the existing recap block; no new Book test. |

## Pins the build writes

- `kernel/ts/test/showcase_consequence.test.ts` social 15 to 21 as above, including: the strongbox's
  status row and its `ends_at`; `warden_knows` false before and true at the expiry; no line in the
  expiry receipt; the Warden's entry at 13:00 day 2 with no encounter and the engage at 14:30; the
  empty gate at 13:00 and the ledger mend; `knows_ash` on Wat, Tam and Nell at exactly 14:00 day 1,
  15:00 day 1 and 11:00 day 2 and never in the deliver world; `nell_ash` before `nell_rumour`; the
  deduction card's `from` and its once-only grant.
- `protocol/fixtures/toolbox_showcase_hash.json` (held by `test/loka/content_showcase_test.exs`).
- Unchanged and re-run: body 7 (Wat's 08:00), social 5 to 8 and 14, `showcase_recap.test.ts`
  (Tam only) and #369's combat 10 (the Warden hostile at standing -2: a hit for no loss, Flee).

## Owner's playtest script

Two saves, both from a fresh world at 07:00 day 1. The first act in each: talk to the Reeve,
`help` once (Nell will not talk to anyone the village is down on; without it the burn leaves you
at -2 and she turns you away until you mend it with the Reeve). Then `accept` and take the letter.

**Save A, quiet.** Lean on the Warden twice, go east, pick the lock (twice), take the ledger, force
the wooden door, north to the mill, down to the green. Inn, fell, hut after 09:00: give Wat the
letter. Back to the green before 13:00 on the game clock (about seven real minutes from the
start). Close the app for 35 real minutes.

**Save B, loud.** The same walk, but force the box, and burn the letter in Wat's fire. Look at Wat
before you leave the hut. Back to the green before 13:00. Close the app for 35 real minutes.

Each new save draws its own sky, so day 1 may not be frost (no chill; a hot day overheats on the
fell). If the day after is a rainy one Tam shelters in the church at 11:00 and Nell hears nothing
until the next dry day; the sky shows it on the fell, and the wait is a real half hour.

On return (about 18:00 day 2, the Warden back at his gate), in each save: read the recap block;
walk east and look at the Warden; talk to Nell; read the roll in the church and open the Journal's
Lore. In save B, if there is time: be on the green before 13:00 the next day (walk onto it after
13:00 and he meets you there instead: flee, nothing lands), give the Warden the ledger when he
walks in, and go east while he is away from the gate.

Expected, save A: the recap names Tam only; the Warden leans on his bar and lets you by; Nell has
the fire; the church has the heir card. Save B: the recap names the Warden walking the green; his
line at the gate changes and he squares up (the rewritten engage line); Nell has a second thing to
be pressed for, and it is from her that you learn Wat went down to the gate; the roll and Nell together make "What the letter carried"; at
13:00 the gate stands empty; the ledger returned ends the cudgel, not the look.

Then the question: **did I find out what I did, or was I told?** And two more: which line, if any,
told you; where did you first notice.

## Matrix cells this plan adds

Two rows in [SHOWCASE.md](../SHOWCASE.md#pairwise-mechanic-matrix), both `built` (slice D): fuse
status x status_expired x schedule cases x disposition (the Warden); rumour hops x conditional
schedule x dialogue check x codex deduction (the letter).

## Toolbox findings

1. **No reaction step changes a barrier.** `apply` offers fact, quest, status, population and
   experience steps only (`protocol/reaction.schema.json`), so the toll gate cannot shut when the
   Warden learns; `opens_when` gates `open`, and the gate is already open in every forced save.
   Content fallback: the Warden himself is the shut gate (engage), and his 13:00 walk the detour.
   Kin of Beads `loka-kgd.22` (no step moves an NPC); filed as Beads `loka-kgd.96` (a reaction
   step that opens, closes or locks a barrier).
2. **A reaction's `when` cannot read the fuse holder.** `status_active` reads the action target
   only, and `sequence` passes no target (`kernel/ts/src/mechanics/reaction.ts`; Beads
   `loka-kgd.86`, batch M8). Content fallback used here: one status, one holder, and the fact
   `warden_knows` carries the result. A fuse that should test "is the box still broken" or "is the
   Warden still angry" waits for `loka-kgd.86`.
3. **No leaf reads an NPC's room** (row W3's limit): Wat and Tam are co-present only because their
   schedules coincide; the entity fact set on Wat's arrival keeps the hop honest. A `co_present
   {npc, npc}` leaf, or `loka-kgd.22`, would let the rumour follow people, not timetables.
4. **Wording (required).** Two plan 1 lines tell what this brief wants found, and the build rewrites
   both (the showcase tests pin keys, not words): the Warden's `engage`, "knows you for a
   troublemaker and raises his cudgel", becomes what he does with no judgment of the player (he
   steps into the road and lifts the bar's chain); `scene.letter_ash.2`, "The village will hear of
   this.", announces the echo at the act and so answers the owner's question in advance; it becomes
   what Wat does (he looks at the ash, then at the door).
