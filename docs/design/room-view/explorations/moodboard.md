# Loka UI mood board (round 1)

Sources: docs/spec/00-first-cartridge-design.md §1, §4.10, §6; pre-release-proof.md (Lantern); 00a §8, §12.

| # | Name | Risk | One-line hook |
|---|---|---|---|
| 1 | Paperback | safe | The room is a book page; nouns are the buttons |
| 2 | Chip Rail | safe | A MUD transcript with a thumb rail of chips |
| 3 | Storylet Deck | safe-ish | Every action is a card that states what it needs |
| 4 | Card Table | mid | The room is a tableau; you drag cards onto cards |
| 5 | Pawn & Map | mid | The map is the screen; prose arrives on a parchment card |
| 6 | Field Journal | mid | A damp notebook the character writes in |
| 7 | Phosphor | weird | A real MUD terminal where every bracket is a button |
| 8 | Lantern Light | weird | Darkness is the default; light is what you can read |
| 9 | Messages from the Fen | weird | The world texts you; choices are replies |
| 10 | Current | weird | Text flows in the direction you travel |

## 1. Paperback
A full-bleed reading page in a book serif. Tappable entities, details, and exits are
underlined inline in the prose and repeated as a short card strip under it, per §4.10.
Tapping a noun opens a bottom sheet with 2–6 actions. A compass ring sits in the bottom bar
under the thumb, and swiping the page also moves you. It has almost no chrome, so it looks
the most like a book.
Refs: Inkle's 80 Days and Sorcery! text pages, Lectrote/Frotz IF readers, Kindle, Fallen
London's prose column.

## 2. Chip Rail
A modern MUD client. Prose goes into a scrolling transcript, so every look, take, and reply
appends and you can scroll back. The thumb zone holds a horizontal rail of grouped chips
(Exits · People · Things · You), and the text drawer is the same rail with a keyboard.
It teaches the drawer better than any other direction because the two are visibly one input.
Refs: Mudlet/MUSHclient, Blightmud, iMessage quick replies, A Dark Room's button stack,
Choice of Games apps.

## 3. Storylet Deck
Prose sits on top. Below it, each available action is a small card with a verb, a target,
and requirement pips. Unavailable actions stay in the deck, greyed, with the reason printed
on the card ("West: the path is under water · needs low tide"). Dialogue topics are storylets
too. This direction gives the strongest unavailable-action feedback because showing the
reason is how the cards work.
Refs: Fallen London / Sunless Sea storylets, Cultist Simulator verbs, King of Dragon Pass.

## 4. Card Table
The place is a location card at the top. Bram, the lantern, and the shelter door are cards
dealt onto the table below, and your inventory is a hand fanned at the bottom edge. To take,
drag a card to your hand. To give or put, drag a hand card onto a table card. Choices are
played as cards. Tapping any card is always an equal alternative to dragging.
Refs: Reigns, Cultist Simulator, Slay the Spire's hand, Arkham Horror LCG location cards,
Inscryption.

## 5. Pawn & Map
The discovered map fills the top half: rooms are nodes and exits are paths, and you drag or
tap your pawn to move. The current room's prose and entities rise as a parchment card you can
pull up to full screen for reading. The z-level stepper sits on the map's edge. This is the
most spatial direction, and it gives the room count and the seven levels a physical shape.
Refs: Sorcery! (Inkle), the 80 Days globe, Heaven's Vault, Hitman GO / Lara Croft GO boards,
board-game pawns.

## 6. Field Journal
Diegetic: a waterproofed notebook. The room is what "you" wrote on arriving, entities are
inked marginal notes you tap, inventory is a list pinned inside the cover, and quests are
dog-eared pages. Choices are two lines ruled at the bottom of the page with a pencil tick.
The death/ghost view is the same page water-damaged.
Refs: Return of the Obra Dinn's logbook, Pentiment, Heaven's Vault, Infocom feelies,
80 Days' journal.

## 7. Phosphor
Honest retro. Monospace, a dark field, and a restrained ANSI palette. The screen looks like a
Diku session, but every `[bracketed]` word, exit, and prompt option is a 44pt touch target.
The drawer is a real `>` prompt. It is aimed squarely at the "played a Diku MUD" player
from §1, and it carries the most accessibility risk (see notes).
Refs: DikuMUD/CircleMUD, Zork, cool-retro-term, A Dark Room minimalism, Hypnospace.

## 8. Lantern Light
The page is dark and your light source decides how much prose is legible and which entities
glow. With no lantern, the shelter is two dim lines. Once you pick the lantern up, the page
warms and the details appear. Light becomes a mechanic you can see. It needs a plain-text
mode fallback and a strict low-cost implementation (a static gradient mask, no per-frame
shaders).
Refs: Simogo's Device 6 and Year Walk, Limbo, Darkwood, Lume.

## 9. Messages from the Fen
The narrator and each NPC are message threads. Bram "texts" you, room descriptions arrive as
narrator bubbles, and your choices are reply chips. Exits and entities are attachments you
tap. The pacing is intimate and it fits one-handed use perfectly. The risk is confusing it
with real chat, which the spec keeps outside the game canvas (10 §83).
Refs: Lifeline (3 Minute Games), Bury Me, My Love, Florence, SMS games.

## 10. Current
Typography as geography. The prose flows in the direction of travel: go east and the next
room's text slides in from the right, go down and it drops. Exits are the text's own edges,
which you pull. It is weird and memorable, and done badly it hurts reading. A plain mode
is mandatory.
Refs: Device 6 (rooms as text corridors), House of Leaves, Florence's gestures.
