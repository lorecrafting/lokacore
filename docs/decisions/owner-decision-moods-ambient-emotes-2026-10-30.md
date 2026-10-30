# Owner decision: moods, ambient emotes and canned emotes are three builder tools — 2026-10-30

Written 2026-10-30 in Claude Code (developer), from the Beads notes of `loka-x6t.71`. The owner's
words are quoted verbatim.

Owner, 2026-10-30, quoted: "Ok i think we are conflating two 'mechanics' or two things for one thing.
Lets discuss this so we can make things more immersive and give more clearly defined tools to the
builder. I like your idea of showing it inside the goblins description, in LegendMUD or muds i believe
thats called 'moods' ... But there's also room events, or npc loglines ... where periodically if you
are in the room, they will emote something. And yes there's also teh concept of emotes, we can do
canned emotes, or custom ... but lets do canned for now. "You cower in fear" and othe rpoeple say "A
goblin cowers in fear""

Answers to the PM's three questions, quoted: "1. yes sounds good, and yes rooms should definitely have
ambient emotes, any type of 'item' in teh game. 2. Yes 3. yes sounds good. And make sure those features
are shown in storybook".

## Effect

1. **Moods** are an entity's `name_variants` and `description_variants`
   ([W6](../system/mechanics.md#entity-description-variants-toolbox-row-w6)). An NPC's
   `room_line_variants` are retired: the Book never drew them. An item's stay.
2. **Ambient emotes**: NPCs, rooms and every item kind may list ambient emotes, each with an optional
   `when`, played on a game-time interval while the player is in the room (Beads `loka-8ghm`).
3. **Canned emotes**: one cartridge emote table with self, others and targeted lines; NPC emotes play
   its entries; custom emotes stay with the Realm (Beads `loka-kgd.193`).
4. Order: moods first (`loka-x6t.71`), then canned emotes, then ambient emotes. Each feature ships a
   Storybook story that shows it.
