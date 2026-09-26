# Owner decisions: entity text and fact_changed for R5 S4 — 2026-09-25

Relayed verbatim by the coordinating assistant (Claude Code) from the owner's answers to a
multiple-choice prompt. No checker can verify these quotes against the chat.

## Q1: LegendMUD-style entity text in S4

What the PM asked (summary): each item gets keywords (what the player types), a short
description ("a brass lantern", used in action messages and the inventory), a room line
("A brass lantern sits here.", which may vary with world state using the S3 description
variants) and an examine description. S4 needs item names for take/drop/give anyway.

Owner's answer:

> Yes, all four (Recommended)

## Q1b: room brief mode

What the PM asked (summary): when should brief mode (title and contents only on revisiting a
room) arrive: S4, S7, or after R5?

Owner's answer:

> S7 (Recommended)

## Q1c: player-written descriptions

What the PM asked (summary): schedule player-written look/examine text with the online work?

Owner's answer:

> Yes, with online (Recommended)

## Q2: fact_changed

What the PM proposed (summary): the host synthesizes `fact_changed` from the composed fact
changes, so fact@1 owns the event and any capability can set facts through `fact.assign`
without emitting the event itself (admit() would fault `unowned_event` if take emitted it).

Owner's answer:

> Proceed as planned (Recommended)

PM clarification after review (#41 finding 1): the host appends `fact_changed` at the causal
position of each executed `fact.assign` (04 §5.2 steps 4-6), not after composition, so
subscribers such as the chapter-one reactions run in the same decision. An assign that leaves
the value unchanged emits no event.

## Q3: the touch keyword (added by the owner after Q1)

Owner's words:

> Also the room keywords, or item keywords there should be for the touch based interface, a
> keyword that is underlined, maybe a new field for that?  Like 'underlined_keyword' or
> 'touchable_keyword' or something idk you figure a good name for it, or some mechanism that
> allows the mobile client to know which word to underline so it can be targeted by a touch

PM ruling (the owner delegated the choice): mark the tappable words inside the authored text
itself, not in a separate field. A separate `touchable_keyword` field would make the client
search the sentence for the word, which breaks on repeated words ("the lantern beside the
lantern hook"), on inflections, and on translation, where the word moves or changes. An
inline link keeps the word and its target together in every language:

```text
A [brass lantern] sits here.                       <- item text: the link targets that item
Rope is looped over the [old post](mooring_post).  <- room text: targets a detail or entity
```

The markup lives in the catalog strings (`Text` stays `{key, bindings}`), so each locale
marks its own words. The compiler resolves a link target against the room's details and the
cartridge's items and entities; a target that does not resolve is an error. A visible item or
inspectable detail with no link in a given description variant or room-line variant is a
warning, not an error: hidden details are exempt, and 00 §4.10 also lists entities and details
as cards below the prose, so nothing becomes untappable.

S4 builds the markup and these checks for item text and S2 details, and updates the existing
cartridges where that is cheap. Carrying the spans and targetable details in GameView (room-view
need #6) is a GameView contract change and joins the GameView-for-touch work at R6P.
