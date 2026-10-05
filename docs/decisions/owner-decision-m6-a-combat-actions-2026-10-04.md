# Owner decision: focused actions during combat

Date: 2026-10-04. Status: approved owner direction for M6-A (first live fight).

Owner direction (paraphrased): implement a focused combat action set now. While an encounter
is open, only Flee, Stand, Look and Scan remain available by resolved command, after every
ordinary source contributes. Repeated Attack, Move, dialogue/choices, item/equipment/door
actions, Wait, recipes and Sit/Rest/Sleep must not bypass the restriction through raw commands
or aliases. Close restores normal actions; reopening derives the same mode from saved state.

Use the existing ActionSet algebra and shared admission/projection, without a second command
framework or new schema. Flee alone checks composed ordinary movement policy internally
before the combat restriction, preserving the approved random-exit selection and no player
Move bypass. The existing frozen attack/death examples stay unchanged; nonstanding combat
fixtures represent controlled state, not permission to Sit/Rest/Sleep during a live encounter.

Normative details live in [ActionSet and admission](../system/protocol.md#actionset-and-admission),
[combat mechanics](../system/mechanics.md#combat1--first-live-encounter-m6-a) and
[Book UI](../system/book-ui.md#live-combat-response-m6-a).
