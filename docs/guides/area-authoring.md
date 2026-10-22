# Area authoring checklist

Check each line before a district or area plan is drafted, and again in its review.
Each rule names its cause family and one example row from
[playtest pass 1](../playtests/2026-10-21-pass1/analysis.md); cite the rule by its number.
Rules 5, 7, 9, 10 and 12 follow owner and PM rulings on the pass-1 questions (Q4, Q7, Q8, Q11, Q13, door Open on World, Lift); `docs/system` may lag them until the fixes land.

1. Every promise on a sign, description or journal entry is true in play: name the verb, the cost and the outcome it promises. (PROMISE, E3: the fence "never lets go" but resells.)
2. A sign that sets a trial names the verb the trial uses. (PROMISE, F2: "try the quern", but the trial is Take.)
3. Text that changes with state changes with it: a journal line does not keep saying "owes" after the debt is paid. (PROMISE, M6)
4. Every reaction or action that changes state writes a line: each step, reset and solve of a puzzle. (SILENT, T1: every lever pull logs the same line.)
5. Every hostile NPC has an `engage` line; every spell effect and kill writes a line. (SILENT, C2a: three hostiles open fights in silence; M3: a spell kill writes no line.)
6. Every policy that refuses the player has a `reason` that names the real cause. (REFUSAL, M1: flamma reads "not now".)
7. A refused offer stays on the page with its reason; it does not vanish. (REFUSAL, E8: a Take refused for permission is hidden.)
8. Do not offer a dialogue whose choices are all refused. (REFUSAL, M10c)
9. Every value a rule reads is on the page: a wanted status token, a puzzle readout (a room-detail aside until the projection lands), the opponent's band on the Combat page. (HIDDEN, E1, T3, C2b)
10. Every offer and its result are on the page the player is looking at: a door's Open is on the World page too, not only on the Map. (PAGE, R4)
11. Every verb has an `action.*` label key, and every readable has a title; read the composed label aloud. (VERB, UH: "Talk the jailer"; T5: "Read".)
12. One code or verb means one thing: `over_load` for your load, Lift for a person's goods. (VERB, R3: `too_heavy` meant both; E14: Take on a person was a theft.)
13. A tag query matches only the items it means: list what it matches. (WIRING, M8a: oil on any `metal` item opens the gate.)
14. Every item has a source and a sink; a vessel that must be filled has a fill source in reach. (WIRING, M8c: the dry flask.)
15. The top (normal) band of a resource starts below its maximum, and no description variant shadows a later one. (WIRING, UK: "normal" starts at 100%, so 99 warns; W1: tide.)

Run `mix loka.lint cartridges/<id>` before review: it checks parts of rules 4, 6, 11 and 15 ([CHECKS.md](../CHECKS.md)).

When a rule here can be decided by a script, it belongs in a check; see the candidate checks in the
[pass 1 analysis](../playtests/2026-10-21-pass1/analysis.md#candidate-deterministic-checks).
