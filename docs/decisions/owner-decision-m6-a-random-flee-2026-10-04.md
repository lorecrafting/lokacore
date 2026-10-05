# Owner decision: one directionless random Flee action

Date: 2026-10-04. Status: approved owner direction for M6-A (first live cellar fight).

Owner direction (paraphrased): Flee is one combat action that chooses a random legal exit,
inspired by LegendMUD. Directional movement must not let the player choose an escape route.
Public command documentation does not establish LegendMUD's exact exit-selection RNG;
the following is Loka's selected rule, not a claim of verified parity.

After due settlement, consider composed movement legality, gates, standing and the existing
multiplied fare in canonical direction-key order. No legal exit means refusal without change;
one means no RNG; two or more mean one logical uniform selection using the existing reviewed
rejection sampler with eight raw draws maximum. Commit destination, payment, encounter closure,
job cancellation and RNG atomically. Receipt replay does not choose again. Engaged Move/aliases
are refused/hidden; outside combat ordinary movement remains unchanged.

This supersedes the earlier directional escape clauses, including the M4 PM decision, without
changing its frozen A/B/C attack/death vectors. Additive independent exit-selection cases govern
this consumer. The canonical contracts are [combat mechanics](../system/mechanics.md#combat1--first-live-encounter-m6-a),
[protocol](../system/protocol.md#directionless-combat-flee) and [Book UI](../system/book-ui.md#live-combat-response-m6-a).
