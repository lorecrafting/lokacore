# Area authoring checklist

Check each line before a district or area plan is drafted, and again in its review.
Each rule names its cause family and one example row from
[playtest pass 1](../playtests/2026-10-21-pass1/analysis.md); cite the rule by its number.
Rules that wait on an owner ruling (spell lines, Map-only door offers, one word for two refusals) are left out until the ruling lands in `docs/system`.

1. Every promise on a sign, description or journal entry is true in play: name the verb, the cost and the outcome it promises. (PROMISE, E3: the fence "never lets go" but resells.)
2. A sign that sets a trial names the verb the trial uses. (PROMISE, F2: "try the quern", but the trial is Take.)
3. Text that changes with state changes with it: a journal line does not keep saying "owes" after the debt is paid. (PROMISE, M6)
4. Every reaction or action that changes state writes a line: each step, reset and solve of a puzzle. (SILENT, T1: every lever pull logs the same line.)
5. Every hostile NPC has an `engage` line. (SILENT, C2a: three hostiles open fights in silence.)
6. Every policy that refuses the player has a `reason` that names the real cause. (REFUSAL, M1: flamma reads "not now".)
7. Do not offer a dialogue whose choices are all refused. (REFUSAL, M10c)
8. Every verb has an `action.*` label key, and every readable has a title; read the composed label aloud. (VERB, UH: "Talk the jailer"; T5: "Read".)
9. A tag query matches only the items it means: list what it matches. (WIRING, M8a: oil on any `metal` item opens the gate.)
10. Every item has a source and a sink; a vessel that must be filled has a fill source in reach. (WIRING, M8c: the dry flask.)
11. The top (normal) band of a resource starts below its maximum, and no description variant shadows a later one. (WIRING, UK: "normal" starts at 100%, so 99 warns; W1: tide.)

When a rule here can be decided by a script, it belongs in a check; see the candidate checks in the
[pass 1 analysis](../playtests/2026-10-21-pass1/analysis.md#candidate-deterministic-checks).
