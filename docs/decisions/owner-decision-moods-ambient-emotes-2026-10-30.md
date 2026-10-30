# Owner decision: moods, ambient emotes and canned emotes are three builder tools — 2026-10-30

Written 2026-10-30 in Claude Code (developer), from the Beads notes of `loka-x6t.71`.

Owner, 2026-10-30 (paraphrased): two things have been treated as one mechanic; separating them makes
play more immersive and gives builders clearer tools. Showing the state inside the goblin's
description is what LegendMUD and other MUDs call a mood. Separately, rooms have events (NPC
loglines): while the player is in the room, something emotes now and then. Emotes are a third
concept, canned or custom; canned only for now, so the actor reads "You cower in fear" and others
read "A goblin cowers in fear".

Answers to the PM's three questions (paraphrased): 1. yes, and rooms and every kind of item should
have ambient emotes; 2. yes; 3. yes, and each of these features must be shown in Storybook.

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
