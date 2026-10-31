# Owner decision: every word the player reads is hand-written; a lowered prose scene format — 2026-10-31

Written 2026-10-31 in Claude Code (PM session). Owner quotes verbatim; the rest paraphrased.

Owner, 2026-10-31, quoted: "i want to handwrite everythign". Asked whether the tools should be a
place-keeping preview, named checkpoints, an author column, a small prose-first scene format
lowered by the compiler and a still-to-write check, the owner answered, quoted: "okay i will go
with yoru recommendation". Later the same day, quoted: "Use Fable for the 'builder' with live
preview, as if I were building the game live, or super hyper fast recompiles without any checks
as i build it, to make building loop extremely fast."

## Effect

1. Every word the player reads is the owner's. AI may create structure (rooms, NPCs, quests,
   scenes) with empty text; it writes no player-facing prose. Prose in an AI-drafted outline is
   reference only and is written fresh by the owner. Store wording stays honest: a human wrote all
   story text while AI helped with planning and engine code.
2. This supersedes effect 1 of the [2026-10-23 record](owner-decision-authoring-builder-2026-10-23.md)
   only for the lowered scene format (`*.scene` files: speech, choice, reply, `when:`, `gives:`),
   and its premise that areas are rarely hand-written. The scene format is lowering only: the
   Elixir compiler turns it into today's dialogue JSON and text keys at compile time; no
   runtime interpreter, no protocol, save or kernel_api change; a re-expressed sampler dialogue
   compiles byte-identical (gate D of that record). Everything the format does not say stays in
   JSON beside it. Effects 2 to 4 of that record stand.
3. The authoring loop is fast by default: a saved text edit shows in the running Book with no
   visible wait and without the content checks; the skipped checks run in the background and
   report in the author column, and in full at release. Nothing a fast path produces can ship:
   the release compile and every CI gate are unchanged.
4. Tools: [Authoring tools](../system/cartridge.md#author-preview) and the owner's
   [writing guide](../guides/writing-the-game.md).
