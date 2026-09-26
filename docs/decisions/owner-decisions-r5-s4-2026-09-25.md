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
