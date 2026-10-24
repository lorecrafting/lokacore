# Owner decision: room page anatomy — 2026-10-23

Written 2026-10-23 in Claude Code by anthropic/claude-opus-5-5 (designer), live polish session.

## Decision

Owner (2026-10-23, quoted in full): "So do you understand the pattern now, no random one off
things its only Room Title, Room description that has clickable fixtures/furniture and if we have
like high perception or 'lore' or whatever that the player has, in the future, new
descriptions/fixture/furtniture can show up in the room. Like a new sentence in the description
paragraph if it passes the lore/perc check or whatever, but hold on that for now. And then pc/npcs
paragraph, and then items paragraph, and below that is the room event log. So any ambient things
just append to the even tlog, like sounds heard from the next room, weather changes, room events,
npcs doing things, emoting, etc, do you understand this simple design, please set it in stone and
codify it and put in design guides if not already"

- The World page is the room title, the description paragraph (its only pressables the fixture and
  furniture links), the people paragraph, the items paragraph and the room event log, in that
  order, and nothing else. Every action lives on a fixture, person or item detail page; anything
  ambient is a log line.
- On hold: a skill check (perception, lore) adding a sentence, fixture or furniture to the
  description itself, never a separate block.
- Builds on owner picks mvlyd5tkelmt (no impromptu room actions, `loka-x6t.120`) and the asides
  removal (`loka-x6t.125`), both 2026-10-23.
- Spec: [Book UI, Room page anatomy](../system/book-ui.md#room-page-anatomy).
